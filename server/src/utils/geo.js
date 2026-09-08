// ====== IP 地理位置批量解析（ip-api.com /batch + 内存缓存，防打爆免费限流）======
// 供访问统计(analytics)等模块复用。一次请求最多 100 个 IP，超量分批。
// ⚠️ 与 admin.js 内联 geo 逻辑同源；admin 侧暂未收敛至此，属待合并技术债。
import axios from 'axios';

const cache = new Map();     // ip -> {country, city}
const cacheTime = new Map(); // ip -> 时间戳
const TTL = 30 * 60 * 1000;  // 缓存 30 分钟
const BATCH = 100;

export const isLocalIp = (ip) => !ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === '::ffff:127.0.0.1';

async function queryBatch(ips) {
  const { data } = await axios.post('http://ip-api.com/batch?lang=zh-CN', ips, { timeout: 6000 });
  if (!Array.isArray(data)) return;
  const now = Date.now();
  data.forEach((g, i) => {
    const ip = ips[i];
    const geo = g && g.status === 'success' ? { country: g.country, city: g.city } : { country: '', city: '' };
    cache.set(ip, geo);
    cacheTime.set(ip, now);
  });
}

// 输入 IP 数组 → 输出 { ip: {country, city} }。本地/非法 IP 一律返回空地点，不消耗配额。
export async function resolveGeoMap(ips) {
  const result = {};
  const now = Date.now();
  const clean = [...new Set((ips || []).filter((x) => typeof x === 'string' && !isLocalIp(x)))];
  const missing = clean.filter((ip) => {
    if (cache.has(ip) && now - (cacheTime.get(ip) || 0) < TTL) { result[ip] = cache.get(ip); return false; }
    return true;
  });
  for (let i = 0; i < missing.length; i += BATCH) {
    try { await queryBatch(missing.slice(i, i + BATCH)); } catch { /* 外呼失败跳过，缺失的下面统一补空，不崩 */ }
  }
  [...clean, ...missing].forEach((ip) => { if (!result[ip]) result[ip] = cache.get(ip) || { country: '', city: '' }; });
  return result;
}
