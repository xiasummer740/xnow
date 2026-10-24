// ====== 前端 SEO 引擎：每路由独立 title/description/canonical，功能页一律 noindex ======
// 白名单 = 允许被搜索引擎收录的公开营销页；其余(登录/下单/充值/后台等)全部 noindex，防私密页入索引。
// 双语结构：`/` = 中文主版，`/en` = 英文镜像（同组件强制英文），互相 hreflang alternate；x-default 指回中文。
//
// 🔒 92 期：这份文案（含主站域名 + 品牌名）以前是打进前端 JS 的 —— 分站客户按 F12 就能看到
//    「xnow.taikon.top / XNOW PRO」。现在改由服务端 /api/public/seo 只对【主站】下发，
//    分站请求直接 404，分站 bundle 里一个主站字样都没有。
//    拿不到配置时（主站接口挂了）也只是标题退化成站名，不影响页面功能。
import { useAppStore } from '../stores/app';

interface SeoConf { lang: string; title: string; description: string; ogImageAlt: string; }
interface SeoConfig { siteUrl: string; ogImage: string; brand: string; pages: Record<string, SeoConf>; }

let CFG: SeoConfig | null = null;
let loading: Promise<SeoConfig | null> | null = null;
let lastPath = '/';

function ensureCfg(): Promise<SeoConfig | null> {
  if (CFG) return Promise.resolve(CFG);
  if (!loading) {
    loading = fetch('/api/public/seo')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && j.status === 'success' && j.data) CFG = j.data as SeoConfig;
        return CFG;
      })
      .catch(() => null)
      .then((v) => { loading = null; return v; });
  }
  return loading;
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  document.head.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
  const link = document.createElement('link');
  link.setAttribute('rel', 'canonical');
  link.setAttribute('href', href);
  document.head.appendChild(link);
}

const origin = (): string => (typeof window !== 'undefined' ? window.location.origin : '');

// 🏬 分站：canonical / og 一律用【分站自己的域名与站名】，绝不出现主站品牌
function applySubsite(path: string, brand: string) {
  document.documentElement.lang = path === '/en' ? 'en' : 'zh-CN';
  document.title = brand;
  const base = origin();
  const indexable = path === '/' || path === '/en';
  setMeta('name', 'robots', indexable ? 'index, follow' : 'noindex, nofollow');
  if (indexable) {
    setCanonical(path === '/' ? base : base + path);
    setMeta('property', 'og:site_name', brand);
    setMeta('property', 'og:title', brand);
    setMeta('property', 'og:url', path === '/' ? base : base + path);
  } else {
    document.head.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
  }
  // 清掉主站留下的 hreflang / og:image（分站没有主站的图和双语镜像）
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
}

function applyMain(path: string, cfg: SeoConfig, brand: string) {
  const conf = cfg.pages[path];
  const base = (typeof window !== 'undefined' ? window.location.origin : cfg.siteUrl).replace(/\/+$/, '');
  const ogImage = base + cfg.ogImage;
  if (conf) {
    document.documentElement.lang = conf.lang;
    document.title = conf.title;
    setMeta('name', 'description', conf.description);
    setMeta('name', 'robots', 'index, follow, max-image-preview:large');
    setCanonical(path === '/' ? base + '/' : base + path);
    const url = path === '/' ? base + '/' : base + path;
    const ogLocale = conf.lang === 'en' ? 'en_US' : 'zh_CN';
    ([
      ['og:locale', ogLocale], ['og:type', 'website'], ['og:site_name', cfg.brand || brand],
      ['og:title', conf.title], ['og:description', conf.description], ['og:url', url],
      ['og:image', ogImage], ['og:image:width', '1200'], ['og:image:height', '630'],
      ['og:image:alt', conf.ogImageAlt],
    ] as [string, string][]).forEach(([k, v]) => setMeta('property', k, v));
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', conf.title);
    setMeta('name', 'twitter:description', conf.description);
    setMeta('name', 'twitter:image', ogImage);
    // `/`(中文) 与 `/en`(英文) 互相声明 hreflang
    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    if (path === '/' || path === '/en') {
      ([['zh-CN', base + '/'], ['en', base + '/en'], ['x-default', base + '/']] as [string, string][])
        .forEach(([hreflang, href]) => {
          const link = document.createElement('link');
          link.setAttribute('rel', 'alternate');
          link.setAttribute('hreflang', hreflang);
          link.setAttribute('href', href);
          document.head.appendChild(link);
        });
    }
  } else {
    document.documentElement.lang = 'zh-CN';
    document.title = cfg.brand || brand;
    setMeta('name', 'robots', 'noindex, nofollow');
    document.head.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  }
}

// 路由变化时调用：营销页写入完整 SEO 元信息，功能页标 noindex 且回退品牌标题
export function applySeo(path: string) {
  lastPath = path;
  const store = useAppStore();
  const brand = store.brandName;

  // 分站：不请求主站 SEO，直接用站长自己的站名
  if (store.isSubsite) return applySubsite(path, brand);

  if (CFG) return applyMain(path, CFG, brand);

  // 配置还没到手：先给个中性标题，拿到后再应用（只对最后一次跳转生效，避免错位）
  document.title = brand;
  ensureCfg().then((cfg) => {
    if (cfg && lastPath === path && !useAppStore().isSubsite) applyMain(path, cfg, useAppStore().brandName);
  });
}
