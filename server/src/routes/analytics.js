import express from 'express';
import jwt from 'jsonwebtoken';
import { PageView } from '../models/index.js';
import { isLocalIp } from '../utils/geo.js';

const router = express.Router();

// 轻量节流：同一访客+路径 30 秒内只记 1 条，防刷新刷屏/脚本乱打（内存上限防无限涨）
const recent = new Map(); // key: visitor_id|path -> 时间戳
const RECENT_TTL = 30 * 1000;
const MAX_ENTRIES = 50000;

/**
 * 判断这条访问是不是站长自己的。
 *
 * 🏠 2026-11-09：实测 1223 PV 里 712 PV（58%）是站长自己刷的，真实访客只占 6%。
 *    后台「访问趋势」看着有量，实际没有任何参考价值。
 *
 * 两道判据，任一命中就算自己人：
 *   ① 上报名单里带了有效的管理员 JWT —— 前端从 localStorage 取 xnow_token
 *      塞进 body（sendBeacon 不能设 header，所以走 body）
 *   ② IP 在 OWNER_IPS / OWNER_IP_PREFIX 里（管理员注册 IP + 已知自有出口）
 *
 * ⚠️ token 解析失败一律当普通访客 —— 埋点接口绝不能让浏览主流程报错。
 */
const OWNER_IPS = [
  '64.186.242.99',                              // 管理员账号注册 IP
  '2605:52c0:1:ff8:18e6:b1ff:fec1:a885',        // 站长常用设备的 IPv6
  '2409:8a55:392d:9f64:56cb:b05e:a64e:1315',    // 站长另一台设备（联通 IPv6，访问过 /admin）
  '192.129.210.52',                             // VPS 自身（服务器内部 curl 测试留下的）
];
const OWNER_IP_PREFIX = ['84.236.238.'];        // 站长设备换 IP 后的网段

const isOwnerVisit = (token, ip) => {
  // ① 管理员登录态
  if (token && typeof token === 'string') {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload && ['admin', 'super_admin'].includes(payload.role)) return true;
    } catch { /* 过期 / 伪造 / 格式错：当普通访客，不报错 */ }
  }
  // ② 已知自有 IP
  const cleanIp = String(ip || '').replace(/^::ffff:/, '');
  if (OWNER_IPS.includes(cleanIp)) return true;
  if (OWNER_IP_PREFIX.some((p) => cleanIp.startsWith(p))) return true;
  return false;
};

/**
 * 从上报的 token 里解出登录用户 id（没登录返回 null）。
 *
 * 👤 2026-11-11：后台要区分「已成交 / 注册未成交 / 未注册」三类访客，
 *    所以每条访问都要记下它属于哪个登录用户。
 *    前端埋点本来就在传 token（当初为判断 is_owner 加的），这里顺手解出 user_id。
 *    ⚠️ token 无效 / 过期一律返回 null 当匿名访客 —— 埋点绝不能因此报错。
 */
const userIdFromToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = Number(payload && payload.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
};

router.post('/visit', async (req, res) => {
  try {
    const body = req.body || {};
    const ip = req.ip || '';
    const vid = (typeof body.visitor_id === 'string' ? body.visitor_id : '').slice(0, 64) || ip;
    const path = (typeof body.path === 'string' ? body.path.slice(0, 300) : '/') || '/';
    const referrer = (typeof body.referrer === 'string' ? body.referrer.slice(0, 600) : '') || '';
    const now = Date.now();

    const key = vid + '|' + path;
    if (recent.has(key) && now - recent.get(key) < RECENT_TTL) return res.status(204).end();
    recent.set(key, now);
    if (recent.size > MAX_ENTRIES) recent.clear();

    await PageView.create({
      visitor_id: vid,
      ip: isLocalIp(ip) ? '' : ip,
      path,
      referrer,
      ts: now,
      is_owner: isOwnerVisit(body.token, ip) ? 1 : 0,
      user_id: userIdFromToken(body.token),
    });
    res.status(204).end();
  } catch {
    res.status(204).end(); // 埋点失败绝不影响用户浏览主流程
  }
});

export default router;
