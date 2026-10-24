// ============================================================================
// 🖼 92 期：装修页的"真预览"
//
// 祥哥反馈："这个预览跟首页也不像啊" —— 因为之前那张预览是用 CSS 画的近似图，
// 只能看个大概配色，跟真实首页差得远。
//
// 现在改成：把【真实的分站首页】用 iframe 装进手机框，站长改任何一项，
// 把当前（还没保存的）配置编码进 URL 传给 iframe，iframe 里的首页读到就先按草稿渲染。
// 于是看到的就是真首页，一个像素都不差。
//
// 草稿只活在 URL 里：不写数据库、不写 localStorage，关掉就没了。
// ============================================================================

export interface PreviewDraft {
  [key: string]: any;
}

const KEY = 'draft';

function decodeB64Utf8(b64: string): string {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encodeB64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 从地址栏读草稿（?draft=<base64url json>）；没有或解析失败返回 null */
export function readPreviewDraft(): PreviewDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = new URLSearchParams(window.location.search).get(KEY);
    if (!raw) return null;
    const obj = JSON.parse(decodeB64Utf8(raw));
    return obj && typeof obj === 'object' ? obj : null;
  } catch (e) {
    return null;
  }
}

/** 把草稿拼成可放进 URL 的字符串 */
export function encodePreviewDraft(draft: PreviewDraft): string {
  try { return encodeB64Utf8(JSON.stringify(draft)); } catch (e) { return ''; }
}

/** 标记：本次访问是"预览模式"（页面顶部会提示，方便站长知道自己看的不是线上效果） */
export function isPreviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search);
  return p.get('pv') === '1' && !!p.get(KEY);
}
