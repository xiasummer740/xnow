#!/usr/bin/env node
// 构建后预渲染：把每个公开营销页的 SEO 元信息「静态」写进各自的 HTML，
// 让首字节就带正确的 title / description / canonical / hreflang / og —— 不再依赖客户端 JS。
// 为什么要它：社交平台爬虫（Facebook / Twitter / Discord）不执行 JS，之前二期做的
// 「随语言 og」在分享时全部失效；Google 也要跑完 JS 才看到，收录更慢。
//
// 数据源与前端 src/utils/seo.ts 共用 src/utils/seo-config.json，避免两处漂移。
// 产物：`/` → dist/index.html，`/en` → dist/en.html，其余同理（配合 nginx `try_files $uri $uri.html`）。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distIndex = resolve(root, 'dist/index.html');

const cfg = JSON.parse(readFileSync(resolve(root, 'src/utils/seo-config.json'), 'utf8'));
const siteUrl = cfg.siteUrl.replace(/\/+$/, '');
const ogImage = siteUrl + cfg.ogImage;

const START = '<!--seo:start-->';
const END = '<!--seo:end-->';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pageUrl = (path) => (path === '/' ? siteUrl + '/' : siteUrl + path);

// `/` 与 `/en` 互为语言镜像，其余页无 alternate（与 seo.ts applyHreflang 同规则）
function hreflangTags(path) {
  if (path !== '/' && path !== '/en') return [];
  return [
    `<link rel="alternate" hreflang="zh-CN" href="${siteUrl}/" />`,
    `<link rel="alternate" hreflang="en" href="${siteUrl}/en" />`,
    `<link rel="alternate" hreflang="x-default" href="${siteUrl}/" />`,
  ];
}

function seoBlock(path, conf) {
  const url = pageUrl(path);
  const t = esc(conf.title);
  const d = esc(conf.description);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: cfg.brand,
    url,
    operatingSystem: 'Web Application',
    applicationCategory: 'BusinessApplication',
    description: conf.description,
    inLanguage: conf.lang,
  };
  const tags = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`,
    `<meta name="author" content="${esc(cfg.brand)} Team" />`,
    `<meta property="og:locale" content="${conf.lang === 'en' ? 'en_US' : 'zh_CN'}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(cfg.brand)}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${ogImage}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(conf.ogImageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${ogImage}" />`,
    ...hreflangTags(path),
  ];
  const ldJson = JSON.stringify(ld, null, 2).split('\n').join('\n    ');
  tags.push(`<script type="application/ld+json">\n    ${ldJson}\n    </script>`);
  return tags.join('\n    ');
}

// ——— 主流程 ———
if (!existsSync(distIndex)) {
  console.error('[prerender] 找不到 dist/index.html —— 请先跑 vite build');
  process.exit(1);
}

const template = readFileSync(distIndex, 'utf8');
const s = template.indexOf(START);
const e = template.indexOf(END);
if (s === -1 || e === -1) {
  console.error(`[prerender] dist/index.html 缺少 ${START} / ${END} 标记，无法注入（中断，避免产出无 SEO 的页面）`);
  process.exit(1);
}

let count = 0;
for (const [path, conf] of Object.entries(cfg.pages)) {
  const html =
    template.slice(0, s + START.length) + '\n    ' + seoBlock(path, conf) + '\n    ' + template.slice(e);
  const withLang = html.replace(/<html lang="[^"]*"/, `<html lang="${conf.lang}"`);
  const out = path === '/' ? distIndex : resolve(root, `dist${path}.html`);
  writeFileSync(out, withLang);
  console.log(`[prerender] ${path.padEnd(8)} -> ${out.slice(root.length + 1)}  (lang=${conf.lang})`);
  count++;
}
console.log(`[prerender] 完成：${count} 个路由已静态化`);
