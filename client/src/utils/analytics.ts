// ====== 访客埋点：向 /api/track/visit 上报。uv 口径 = localStorage 一次性 uuid ======
// sendBeacon 优先(页面跳转不丢包)；与后端 30s 同源节流形成双保险，埋点失败静默不影响主流程。
//
// 🔑 2026-11-09 新增 token 上报：站长自己天天在站上操作，后台「访问趋势」里
//    58% 是他自己的流量（实测 1223 PV 里 712 PV 是自己），真实访客只占 6%。
//    上报时带上登录令牌，后端能识别「这是管理员」，把记录标成 is_owner，
//    统计时默认排除 —— 后台看到的才是真实用户数据。
//    ⚠️ sendBeacon 不支持自定义 header，所以 token 放在 JSON body 里。
//       没登录（普通访客）就没有 token，后端当正常访客处理，行为不变。
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
  let token = '';
  try { token = localStorage.getItem('xnow_token') || ''; } catch { /* ignore */ }
  const payload = JSON.stringify({ visitor_id: visitorId, path, referrer: document.referrer, token });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track/visit', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/track/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
    }
  } catch { /* 埋点失败静默 */ }
}
