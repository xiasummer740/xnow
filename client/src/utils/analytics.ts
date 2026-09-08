// ====== 访客埋点：向 /api/track/visit 上报。uv 口径 = localStorage 一次性 uuid ======
// sendBeacon 优先(页面跳转不丢包)；与后端 30s 同源节流形成双保险，埋点失败静默不影响主流程。
const VKEY = 'xnow_visitor_id';
let visitorId = '';
try {
  visitorId = localStorage.getItem(VKEY) || '';
  if (!visitorId) {
    visitorId = crypto.randomUUID
      ? crypto.randomUUID()
      : `v${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(VKEY, visitorId);
  }
} catch { visitorId = ''; }

const lastSent: Record<string, number> = {};

export function trackVisit(path: string) {
  const now = Date.now();
  if (now - (lastSent[path] || 0) < 30000) return; // 30s 节流
  lastSent[path] = now;
  const payload = JSON.stringify({ visitor_id: visitorId, path, referrer: document.referrer });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track/visit', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/track/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
    }
  } catch { /* 埋点失败静默 */ }
}
