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
    });
    res.status(204).end();
  } catch {
    res.status(204).end(); // 埋点失败绝不影响用户浏览主流程
  }
});

export default router;
