#!/usr/bin/env node
// ============================================================================
// 分站专用静态入口：dist/site.html
// ----------------------------------------------------------------------------
// 为什么需要它：
//   分站和主站共用同一份前端产物，而 dist/index.html（以及 en/vpn/finance.html）
//   里写死了平台自己的 SEO 元信息。分站 vhost 原来用 `try_files $uri $uri.html
//   $uri/ /index.html` —— 结果站长的顾客打开 his-site/vpn 看到的是「XNOW 全球
//   安全节点」，打开 /finance 看到「XNOW 财务大盘预览」，分享链接的预览卡片也
//   全是 XNOW PRO。这是最伤的一类泄露：客户还没进门就知道这是二道贩子。
//
// 做法：
//   把 index.html 复制一份，把 <!--seo:start--> 到 <!--seo:end--> 整段换成中性
//   文案；再确保文件里一个 XNOW 都不剩。分站 vhost 的回退目标改成 /site.html。
//   真正的站名 / 描述由前端拿到 /api/public/config 后在运行期写入（JS 能跑的环境
//   就是站长自己的站名；社交爬虫不跑 JS，但看到的是中性文案而不是平台品牌）。
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distIndex = resolve(root, 'dist/index.html');
const distOut = resolve(root, 'dist/site.html');

if (!existsSync(distIndex)) {
  console.error('[subsites-html] 找不到 dist/index.html，请先 vite build');
  process.exit(1);
}

const src = readFileSync(distIndex, 'utf8');

const NEUTRAL_TITLE = '社媒增长服务';
const NEUTRAL_DESC = 'TikTok / Instagram / YouTube / Telegram 等平台的粉丝、播放与成员增长服务，自动交付，注册即用。';

const NEUTRAL_SEO = `<!--seo:start-->
<!-- 🏬 分站中性 SEO 块（由 scripts/subsites-html.mjs 生成，勿手改）-->
<title>${NEUTRAL_TITLE}</title>
<meta name="description" content="${NEUTRAL_DESC}" />
<meta name="robots" content="index, follow" />
<meta name="theme-color" content="#0f172a" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${NEUTRAL_TITLE}" />
<meta property="og:description" content="${NEUTRAL_DESC}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${NEUTRAL_TITLE}" />
<meta name="twitter:description" content="${NEUTRAL_DESC}" />
<!--seo:end-->`;

let out = src.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, NEUTRAL_SEO);

// 平台图标也换掉：浏览器标签页上露出平台 logo 一样会穿帮（用内联 SVG，不发请求）
const NEUTRAL_ICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230f172a'/%3E%3Cpath d='M18 42l10-20 8 14 10-14' stroke='%2322d3ee' stroke-width='5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" />`;
out = out.replace(/<link[^>]*rel="icon"[^>]*>\s*/gi, '');
out = out.replace(/<link[^>]*rel="apple-touch-icon"[^>]*>\s*/gi, '');
out = out.replace('</head>', `  ${NEUTRAL_ICON}\n</head>`);

// 安全闸：分站入口里绝不允许残留平台品牌名
const left = (out.toUpperCase().match(/XNOW/g) || []).length;
if (left > 0) {
  console.error(`[subsites-html] 生成结果里仍有 ${left} 处 XNOW，已中止（请检查 index.html）`);
  process.exit(1);
}

writeFileSync(distOut, out, 'utf8');
console.log(`[subsites-html] 已生成 dist/site.html（${out.length} 字节，XNOW 0 处）`);
