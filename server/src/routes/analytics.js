import express from 'express';
import { PageView } from '../models/index.js';
import { isLocalIp } from '../utils/geo.js';

const router = express.Router();

// 轻量节流：同一访客+路径 30 秒内只记 1 条，防刷新刷屏/脚本乱打（内存上限防无限涨）
const recent = new Map(); // key: visitor_id|path -> 时间戳
const RECENT_TTL = 30 * 1000;
const MAX_ENTRIES = 50000;

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
    });
    res.status(204).end();
  } catch {
    res.status(204).end(); // 埋点失败绝不影响用户浏览主流程
  }
});

export default router;
