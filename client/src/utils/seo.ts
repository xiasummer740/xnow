// ====== 前端 SEO 引擎：每路由独立 title/description/canonical，功能页一律 noindex ======
// 白名单 = 允许被搜索引擎收录的公开营销页；其余(登录/下单/充值/后台等)全部 noindex，防私密页入索引。
// 双语结构：`/` = 中文主版，`/en` = 英文镜像（同组件强制英文），互相 hreflang alternate；x-default 指回中文。
// 元信息数据源 = ./seo-config.json（构建期 scripts/prerender.mjs 共用同一份，避免两处漂移）
import seoConfig from './seo-config.json';

export const SITE_URL = seoConfig.siteUrl;

interface SeoConf { lang: string; title: string; description: string; ogImageAlt: string; }

const BRAND_TITLE = seoConfig.brand;

// 可收录的营销页及其独立 SEO 元信息（`/` 与 `/en` 为同一内容的中英镜像）
const INDEXABLE = seoConfig.pages as Record<string, SeoConf>;

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

const OG_IMAGE = SITE_URL + seoConfig.ogImage;

// OpenGraph / Twitter 卡片随页面语言走：英文镜像分享出去是英文卡
function setSocialMeta(conf: SeoConf, path: string) {
  const ogLocale = conf.lang === 'en' ? 'en_US' : 'zh_CN';
  const url = path === '/' ? SITE_URL : SITE_URL + path;
  const props: [string, string][] = [
    ['og:locale', ogLocale], ['og:type', 'website'], ['og:site_name', seoConfig.brand],
    ['og:title', conf.title], ['og:description', conf.description], ['og:url', url],
    ['og:image', OG_IMAGE], ['og:image:width', '1200'], ['og:image:height', '630'],
    ['og:image:alt', conf.ogImageAlt],
  ];
  props.forEach(([k, v]) => setMeta('property', k, v));
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', conf.title);
  setMeta('name', 'twitter:description', conf.description);
  setMeta('name', 'twitter:image', OG_IMAGE);
}

// `/`(中文) 与 `/en`(英文) 互相声明 hreflang；其余页无 alternate
function applyHreflang(path: string) {
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  if (path !== '/' && path !== '/en') return;
  const zhHref = SITE_URL;          // 中文主版恒在 `/`
  const enHref = SITE_URL + '/en';  // 英文镜像恒在 `/en`
  const mk = (hreflang: string, href: string) => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate'); link.setAttribute('hreflang', hreflang); link.setAttribute('href', href);
    document.head.appendChild(link);
  };
  mk('zh-CN', zhHref);
  mk('en', enHref);
  mk('x-default', SITE_URL); // 无语言信号时默认中文主版
}

// 路由变化时调用：营销页写入完整 SEO 元信息，功能页标 noindex 且回退品牌标题
export function applySeo(path: string) {
  const conf = INDEXABLE[path];
  if (conf) {
    document.documentElement.lang = conf.lang;
    document.title = conf.title;
    setMeta('name', 'description', conf.description);
    setMeta('name', 'robots', 'index, follow, max-image-preview:large');
    setCanonical(path);
    setSocialMeta(conf, path);
    applyHreflang(path);
  } else {
    document.documentElement.lang = 'zh-CN';
    document.title = BRAND_TITLE;
    setMeta('name', 'robots', 'noindex, nofollow');
    document.head.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
    applyHreflang(path); // 清除残留 alternate
  }
}
