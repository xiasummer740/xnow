// ====== 前端 SEO 引擎：每路由独立 title/description/canonical，功能页一律 noindex ======
// 白名单 = 允许被搜索引擎收录的公开营销页；其余(登录/下单/充值/后台等)全部 noindex，防私密页入索引。
export const SITE_URL = 'https://xnow.taikon.top';

interface SeoConf { title: string; description: string; }

const BRAND_TITLE = 'XNOW PRO';
// 可收录的营销页及其独立 SEO 元信息
const INDEXABLE: Record<string, SeoConf> = {
  '/': {
    title: 'XNOW PRO | 全球社交媒体增长引擎 - TikTok/IG/YT 涨粉与流量变现',
    description: 'XNOW PRO 专为出海企业、个人 IP 与独立站提供 TikTok / Instagram / YouTube 等主流社媒的粉丝、播放与点赞增长服务与流量变现方案，注册即用，全自动交付。',
  },
  '/vpn': {
    title: 'XNOW 全球安全节点 - 高速稳定线路 · 多协议多端接入',
    description: 'XNOW 提供覆盖全球的高速安全代理节点，多协议、多设备一键接入，稳定高速不掉线，为海外访问与出海业务保驾护航。',
  },
};

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

function setCanonical(path: string) {
  document.head.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
  const link = document.createElement('link');
  link.setAttribute('rel', 'canonical');
  link.setAttribute('href', path === '/' ? SITE_URL : SITE_URL + path);
  document.head.appendChild(link);
}

// 路由变化时调用：营销页写入完整 SEO 元信息，功能页标 noindex 且回退品牌标题
export function applySeo(path: string) {
  const conf = INDEXABLE[path];
  if (conf) {
    document.title = conf.title;
    setMeta('name', 'description', conf.description);
    setMeta('name', 'robots', 'index, follow, max-image-preview:large');
    setCanonical(path);
  } else {
    document.title = BRAND_TITLE;
    setMeta('name', 'robots', 'noindex, nofollow');
    document.head.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
  }
}
