// ============================================================================
// 可被搜索引擎 / AI 抓取的公开页（2026-10-29）
// ----------------------------------------------------------------------------
// 背景：分站首页原来是**纯 SPA**，HTML 里只有 1676 字节、可见中文 6 个字，
//       title 全站一模一样（"社媒增长服务"），没有 sitemap.xml，没有结构化数据。
//       结果是「Google 抓不到内容、AI 抓不到内容」，SEO/GEO 等于零。
//
// 这个模块提供 4 个**服务端渲染**的公开地址（nginx 把这几条路径转发到后端）：
//   GET /robots.txt     按域名生成（放行检索型 AI 爬虫，禁止训练型）
//   GET /sitemap.xml    按域名生成（首页 + 每个平台落地页）
//   GET /c/:slug        平台落地页（服务端渲染，带 JSON-LD / FAQ / 价格区间）
//   GET /               首页 HTML 壳（注入 title/description/canonical/JSON-LD + 内容块）
//
// 三条硬约束：
//   1. 分站页面**绝不能**出现平台品牌 / 上游分类原文（那些分类名里带内部编号）。
//      文案只用站长自己的站名 + 归一化后的平台名 + 真实价格。
//   2. 价格必须和下单页口径一致（单服务定价 > 站内倍率 > 全局倍率，再乘活动折扣）。
//   3. 客户端的 Vue 仍然挂载到 #app，会覆盖服务端塞进去的内容 —— 人看到的是正常页面，
//      爬虫看到的是有内容的 HTML。两边都不受伤。
// ============================================================================

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Service, SiteServicePrice, Config, VpnProduct } from '../models/index.js';
import { platformOf, slugOf, labelOfSlug, PLATFORM_CN, typeOf, per1000, PLATFORM_LABELS } from '../utils/platform.js';
import { copyOf } from '../utils/platformCopy.js';
import { typeCopyOf, TYPE_COPY } from '../utils/typeCopy.js';
import { ARTICLES, articleOf, articleOfLang, hasLang } from '../utils/guideCopy.js';
import { LANGS, LANG_ORDER, copyOfLang, typeLabelOf } from '../utils/langCopy.js';

const router = express.Router();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DIST = process.env.CLIENT_DIST || path.join(ROOT, 'client', 'dist');

const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const hostOf = (req) => {
    const h = String(req.get('host') || '').split(':')[0].toLowerCase();
    return h || 'localhost';
};

// ── 模板（HTML 壳）：按 mtime 缓存，重新部署后自动刷新 ──────────────────────
const tplCache = new Map();
const readTemplate = (kind) => {
    // kind: 'main' → index.html（中文首页）、'site' → site.html（分站）、
    //       'en' → en.html（英文首页）
    // ⚠️ 新增语种（id / pt）**没有各自的 HTML 壳** —— prerender 只生成
    //    index/en/vpn/site 四份。语言页复用 index.html 的壳（壳里只有
    //    `<div id="app">` + 资源引用，正文与 head 全部由 SSR 注入），
    //    所以它们都传 'main'。别为每个语种凭空造一个壳，构建脚本不产出就 404。
    const file = path.join(DIST, kind === 'site' ? 'site.html' : kind === 'en' ? 'en.html' : 'index.html');
    try {
        const st = fs.statSync(file);
        const hit = tplCache.get(kind);
        if (hit && hit.mtime === st.mtimeMs) return hit.html;
        const html = fs.readFileSync(file, 'utf8');
        tplCache.set(kind, { mtime: st.mtimeMs, html });
        return html;
    } catch (e) {
        return null;
    }
};

// 把模板里平台自己的 SEO 元信息全部剥掉，换成我们生成的
const stripSeo = (html) => html
    .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["'](?:og:[^"']+|twitter:[^"']+)["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["'](?:twitter:[^"']+|robots|theme-color)["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi, '');

const injectIntoShell = (html, { head, body }) => {
    let out = stripSeo(html);
    if (body) {
        // ⚠️ 给 #app 打上 data-ssr="1"：main.ts 见到这个标记就**不挂载 Vue**。
        //
        // 为什么必须这样：Vue 的 mount('#app') 会清空容器再挂载组件树。
        // 而这些落地页在 Vue Router 里根本没有对应路由（/guide、/price、/id、
        // /ar…），挂载的结果就是 SSR 内容被抹掉、页面变成空白。
        // 2026-11-08 踩过：curl 看到 8000 字，浏览器打开只有 300 字。
        //
        // 不挂载的代价是没有 SPA 交互，但这些页面本来就是内容页，
        // 里面的链接都是整页跳转，纯静态反而更快。
        out = out.replace(/(<div id=["']app["'])([^>]*)(>)([\s\S]*?)(<\/div>)/i,
            (m, open, attrs, gt, _inner, close) => `${open}${attrs} data-ssr="1"${gt}${body}${close}`);
    }
    out = out.replace(/<\/head>/i, `${head}\n</head>`);
    return out;
};

// ── 目录数据（每个站点一份，5 分钟缓存）──────────────────────────────────
const CATALOG_TTL = 5 * 60 * 1000;
const catalogCache = new Map();

const loadCatalog = async (site) => {
    const key = site ? `s${site.id}:${site.multiplier}:${site.discount_rate}:${site.discount_until}` : 'main';
    const hit = catalogCache.get(key);
    if (hit && Date.now() - hit.ts < CATALOG_TTL) return hit.data;

    const [services, confRows] = await Promise.all([
        Service.findAll({ attributes: ['service_id', 'name', 'category', 'rate', 'custom_rate', 'min', 'max'], order: [['sort', 'ASC']] }),
        // 🔍 2026-11-07：多读两个客服联系方式 —— Organization 结构化数据里的
        //    sameAs / contactPoint 要靠它们。AI 判断「这个品牌是否可信」时看这个，
        //    缺了就会被当成无名小站（实测 Bing 搜品牌词命中 0）。
        Config.findAll({ where: { key: ['global_multiplier', 'site_name', 'boost_tg', 'boost_tg_url', 'boost_wechat_id'] } }),
    ]);
    const conf = {};
    confRows.forEach((c) => { conf[c.key] = c.value; });

    let overrides = new Map();
    if (site) {
        try {
            const rows = await SiteServicePrice.findAll({ where: { site_id: site.id } });
            overrides = new Map(rows.map((r) => [Number(r.service_id), parseFloat(r.rate)]));
        } catch (e) { overrides = new Map(); }
    }

    const globalMul = parseFloat(conf.global_multiplier || 2.0) || 2.0;
    const mul = site ? (parseFloat(site.multiplier) || globalMul) : globalMul;
    let discount = 1;
    if (site) {
        const dr = parseFloat(site.discount_rate);
        const du = parseInt(site.discount_until || 0);
        const active = isFinite(dr) && dr > 0 && dr < 1 && !(du > 0 && Math.floor(Date.now() / 1000) > du);
        discount = active ? dr : 1;
    }

    const platforms = new Map();
    for (const s of services) {
        const base = (s.custom_rate !== null && s.custom_rate !== undefined) ? parseFloat(s.custom_rate) : parseFloat(s.rate);
        if (!isFinite(base) || base <= 0) continue;
        const raw = overrides.has(Number(s.service_id)) ? overrides.get(Number(s.service_id)) : base * mul;
        const price = Number((raw * discount).toFixed(4));
        if (!isFinite(price) || price <= 0) continue;

        const plat = platformOf(`${s.category || ''} ${s.name || ''}`);
        const type = typeOf(s.name);
        if (!platforms.has(plat)) platforms.set(plat, { label: plat, slug: slugOf(plat), count: 0, minPrice: Infinity, types: new Map() });
        const p = platforms.get(plat);
        p.count += 1;
        if (price < p.minPrice) p.minPrice = price;
        if (!p.types.has(type)) p.types.set(type, { label: type, count: 0, minPrice: Infinity, minQty: Infinity, maxQty: 0 });
        const t = p.types.get(type);
        t.count += 1;
        if (price < t.minPrice) t.minPrice = price;
        const mn = Number(s.min || 0); const mx = Number(s.max || 0);
        if (mn > 0 && mn < t.minQty) t.minQty = mn;
        if (mx > t.maxQty) t.maxQty = mx;
    }

    // 排序：服务多的平台在前，Other 永远最后
    const list = [...platforms.values()]
        .map((p) => ({ ...p, types: [...p.types.values()].sort((a, b) => b.count - a.count) }))
        .sort((a, b) => (a.label === 'Other' ? 1 : b.label === 'Other' ? -1 : b.count - a.count));

    const data = {
        platforms: list,
        totalServices: services.length,
        globalBrand: conf.site_name || 'XNOW PRO',
        // 品牌实体信号（给 Organization 结构化数据用）
        brandMeta: {
            tgHandle: String(conf.boost_tg || '').trim(),        // 形如 @xnowfans
            tgUrl: String(conf.boost_tg_url || '').trim(),       // 形如 https://t.me/xnowfans
            wechatId: String(conf.boost_wechat_id || '').trim(),
        },
    };
    catalogCache.set(key, { ts: Date.now(), data });
    return data;
};

// 首页/描述里平台的展示顺序：按客户认知的主次排，而不是"谁的服务数最多"。
// （第一版按数量排，结果 meta description 开头是「网站流量、TikTok…」，很怪）
// IndexNow 密钥（Bing / Yandex / Seznam 通用，Google 不支持 —— 它只认 Search Console）
// 作用：页面增删改时主动通知搜索引擎来抓，不用等它自己爬。零账号成本。
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '9750e61ef15e5367ff27f64bf3767673';

const PREFERRED = ['TikTok', 'Instagram', 'YouTube', 'Telegram', 'Facebook', 'Twitter',
    'Shopee', 'WhatsApp', 'Line', 'Traffic', 'Spotify', 'Discord', 'Twitch', 'Apple Music', 'SoundCloud', 'Other'];
const prefIndex = (label) => { const i = PREFERRED.indexOf(label); return i < 0 ? 99 : i; };

const brandOf = (req, catalog) => {
    const site = req.site;
    // 主站沿用「XNOW PRO」这个既有品牌（别把已经建立起来的名字换掉），分站只用站长自己的站名
    const mainBrand = String(catalog.globalBrand || 'XNOW');
    const mainName = /pro/i.test(mainBrand) ? mainBrand : `${mainBrand} PRO`;
    return {
        name: site ? String(site.name || '本店') : mainName,
        host: hostOf(req),
        isSubsite: !!site,
        site,
        meta: catalog.brandMeta || {},
    };
};

// ── 公共内容片段 ──────────────────────────────────────────────────────────
const faqOf = (brand, platCn, p) => {
    const cheapest = p ? per1000(p.minPrice) : '—';
    const total = p ? p.count : 0;
    const items = [
        {
            q: `${brand.name} 的 ${platCn} 服务多少钱？`,
            a: `${brand.name} 现有 ${total} 个 ${platCn} 相关的增长服务，价格按“每 1000 个”计价，最低 ${cheapest} 元起；不同质量与速度的档位价格不同，下单页可以按数量实时看到总价。`,
        },
        {
            q: '下单后多久开始？需要自己盯着吗？',
            a: '提交订单后系统自动派单开始处理，进度可以在“我的订单”里随时查看，不需要人工催单。',
        },
        {
            q: '需要注册账号吗？',
            a: `浏览服务不需要登录，提交订单前注册登录即可。${brand.name} 支持在线充值，余额即时到账。`,
        },
        {
            q: `${brand.name} 还支持哪些平台？`,
            a: '除本页平台外，还支持 Instagram、YouTube、Telegram、Facebook、X（Twitter）、Spotify、Discord、网站流量等，全部在首页分类里可以看到。',
        },
    ];
    return items;
};

const jsonLdOf = (brand, canonical, page) => {
    const base = `https://${brand.host}`;
    const m = brand.meta || {};
    // 实体信号：sameAs 指向品牌在别处的官方账号 —— 这是 AI 把「你」和「你的名字」
    // 关联起来的主要依据。分站没有自己的社交账号，所以只给主站输出。
    const sameAs = [];
    if (!brand.isSubsite) {
        if (m.tgUrl) sameAs.push(m.tgUrl);
        if (m.tgHandle && /^https?:\/\//i.test(m.tgHandle)) sameAs.push(m.tgHandle);
    }
    const org = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: brand.name,
        alternateName: brand.isSubsite ? undefined : ['XNOW', 'XNOW PRO'],
        url: `${base}/`,
        description: `${brand.name}：社媒增长服务，自动交付。`,
        logo: {
            '@type': 'ImageObject',
            url: `${base}/logo.png`,
            width: 512,
            height: 512,
        },
        image: `${base}/og.png`,
    };
    if (sameAs.length) org.sameAs = sameAs;
    if (!brand.isSubsite && (m.tgUrl || m.wechatId)) {
        org.contactPoint = [{
            '@type': 'ContactPoint',
            contactType: 'customer support',
            availableLanguage: ['zh-CN', 'en'],
            ...(m.tgUrl ? { url: m.tgUrl } : {}),
        }];
    }
    // 去掉 undefined 字段，避免输出脏数据
    Object.keys(org).forEach((k) => { if (org[k] === undefined) delete org[k]; });

    const ld = [
        org,
        {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: brand.name,
            url: `${base}/`,
            inLanguage: ['zh-CN', 'en'],
        },
    ];
    if (page) {
        ld.push({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: brand.name, item: `https://${brand.host}/` },
                { '@type': 'ListItem', position: 2, name: `${page.platCn} 增长服务`, item: canonical },
            ],
        });
        ld.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: page.faq.map((f) => ({
                '@type': 'Question', name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
        });
        if (page.types && page.types.length) {
            ld.push({
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: `${page.platCn} 增长服务价格`,
                itemListElement: page.types.slice(0, 8).map((t, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    item: {
                        '@type': 'Offer',
                        name: `${page.platCn} ${t.label}`,
                        priceCurrency: 'CNY',
                        price: Number(t.minPrice.toFixed(2)),
                        description: `${t.count} 个服务，${per1000(t.minPrice)} 元起 / 1000 个`,
                    },
                })),
            });
        }
    }
    return ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');
};

const headOf = ({ brand, title, desc, canonical, ld, hreflangs, locale = 'zh_CN', ogImageAlt }) => `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${esc(canonical)}" />
${(hreflangs || []).map((h) => `<link rel="alternate" hreflang="${esc(h.lang)}" href="${esc(h.href)}" />`).join('\n')}
<meta name="robots" content="index, follow, max-image-preview:large" />
<!-- Bing Webmaster 站点验证（2026-11-08）。Bing 只校验首页，但全站带上更省事。
     ⚠️ 验证成功后千万不要删，否则 Bing 会取消已验证状态。 -->
<meta name="msvalidate.01" content="A7003F7341A3B427C0759A2603DF6916" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:site_name" content="${esc(brand.name)}" />
<meta property="og:image" content="https://${esc(brand.host)}/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(ogImageAlt || (brand.name + ' · 社媒增长服务'))}" />
<meta property="og:locale" content="${esc(locale)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://${esc(brand.host)}/og.png" />
${ld}`;

const styleBlock = `<style>
.seo-wrap{max-width:820px;margin:0 auto;padding:28px 20px 60px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#e2e8f0;line-height:1.75}
.seo-wrap h1{font-size:26px;line-height:1.35;margin:0 0 12px;font-weight:800}
.seo-wrap h2{font-size:17px;margin:26px 0 8px;font-weight:700}
.seo-wrap p{margin:8px 0;color:#cbd5e1}
/* 方向性样式统一用逻辑属性（margin-inline-start / text-align:start），
   这样阿拉伯语 <html dir="rtl"> 下会自动镜像，不用为 RTL 单独写一份 CSS。 */
.seo-wrap ul{margin:8px 0;margin-inline-start:20px;color:#cbd5e1}
.seo-wrap ol{margin:8px 0;margin-inline-start:20px;color:#cbd5e1}
.seo-wrap li{margin:4px 0}
.seo-wrap dl{margin:10px 0}
.seo-wrap dt{font-weight:700;color:#e2e8f0;margin-top:12px}
.seo-wrap dd{margin:2px 0 0;color:#cbd5e1}
.seo-table{width:100%;border-collapse:collapse;margin:10px 0;font-size:14px}
.seo-table th,.seo-table td{border-bottom:1px solid #334155;padding:8px 6px;text-align:start}
.seo-table th{color:#94a3b8;font-weight:600;font-size:13px}
/* 正文里 h3 是二级小标题（h2 是一级），字号递减但保持层次 */
.seo-wrap h3{font-size:15px;margin:20px 0 6px;font-weight:700;color:#e2e8f0}
.seo-wrap ol{margin:8px 0;margin-inline-start:22px;color:#cbd5e1}
.seo-wrap ol li{margin:6px 0}
.seo-wrap ul li{margin:6px 0}
/* 强调块：正文里以 > 开头的行 */
.seo-note{margin:14px 0;padding:12px 14px;background:#0f2033;border-inline-start:3px solid #06b6d4;border-radius:0 8px 8px 0;color:#cbd5e1;font-size:14px;line-height:1.7}
.seo-links{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.seo-links a{color:#22d3ee;text-decoration:none;border:1px solid #334155;border-radius:999px;padding:4px 12px;font-size:13px}
.seo-faq dt{font-weight:700;margin-top:12px;color:#f1f5f9}
.seo-faq dd{margin:4px 0 0;color:#cbd5e1}
.seo-cta{display:inline-block;margin-top:18px;background:#06b6d4;color:#04121a;font-weight:800;padding:10px 22px;border-radius:12px;text-decoration:none}
.seo-foot{margin-top:34px;font-size:12px;color:#64748b}
</style>`;

const linksTo = (brand, platforms, currentSlug) => {
    const items = platforms
        .filter((p) => p.slug !== currentSlug)
        .slice(0, 10)
        .map((p) => `<a href="/c/${p.slug}">${esc(PLATFORM_CN[p.label] || p.label)}</a>`)
        .join('');
    return items ? `<div class="seo-links">${items}</div>` : '';
};

const typeTable = (platCn, types) => {
    if (!types || !types.length) return '';
    const rows = types.map((t) => {
        const qty = (t.minQty > 0 && isFinite(t.minQty)) ? `${t.minQty} 起` : '—';
        return `<tr><td>${esc(platCn)} ${esc(t.label)}</td><td>¥${per1000(t.minPrice)} / 1000</td><td>${t.count} 个档位</td><td>${esc(qty)}</td></tr>`;
    }).join('');
    return `<table class="seo-table"><thead><tr><th>服务类型</th><th>起价</th><th>可选档位</th><th>最小数量</th></tr></thead><tbody>${rows}</tbody></table>`;
};

/**
 * 平台页的同义词汇总（2026-11-08）
 *
 * 一个平台页要覆盖「涨粉 / 刷赞 / 刷播放 / 涨订阅…」这一整片搜索词，
 * 光靠标题不够。这里把所有类型下的叫法聚成一段自然文字，
 * 既让人看懂「这些都指同一批服务」，也让长尾词在页面里有落点。
 */
const platformSynonyms = (platCn, types) => {
    const buckets = [];
    for (const t of types || []) {
        const tc = typeCopyOf(t.label);
        if (!tc || !Array.isArray(tc.aliases)) continue;
        buckets.push({ name: tc.name, aliases: tc.aliases.filter((x) => x && x !== tc.name) });
    }
    if (buckets.length < 2) return '';
    const lines = buckets.map((b) =>
        `<li><b>${esc(b.name)}</b>：${b.aliases.map((x) => esc(x)).join('、')}</li>`
    ).join('');
    return `<h2>这些词说的都是同一批服务</h2>
<p>${esc(platCn)} 上不同的人对这些服务有不同叫法。按你习惯的说法对号入座就行，交付内容是一样的：</p>
<ul>${lines}</ul>
<p>不管搜的是哪个词，下单流程都一样：选类型、填目标链接或用户名、填数量，页面按每 1000 个实时算出总价。</p>`;
};

const faqHtml = (faq) => `<dl class="seo-faq">${faq.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('')}</dl>`;

// ── GET /<key>.txt（IndexNow 密钥校验文件）─────────────────────────────────
router.get(`/${INDEXNOW_KEY}.txt`, (req, res) => {
    res.type('text/plain; charset=utf-8').set('Cache-Control', 'public, max-age=86400').send(INDEXNOW_KEY);
});

// ── GET /robots.txt ──────────────────────────────────────────────────────
router.get('/robots.txt', async (req, res) => {
    const host = hostOf(req);
    const base = `https://${host}`;
    const body = `# ${host}
# 搜索收录 + AI 检索引用：都放行；模型训练：不放行
User-agent: *
Allow: /
Content-Signal: search=yes,ai-train=no,use=reference
Disallow: /admin
Disallow: /api
Disallow: /order
Disallow: /mass-order
Disallow: /history
Disallow: /recharge
Disallow: /vip
Disallow: /affiliate
Disallow: /finance.html
# ⚠️ 2026-11-07：/vpn 从 Disallow 名单里移除了 —— 页面已改成服务端渲染（有真内容），
#    要收录。只拦它的登录后子路由（我的节点 / 后台），那些没有收录价值。
Disallow: /vpn/admin
Disallow: /vpn/clients

# 检索型 AI 爬虫（用户提问时来取内容，属"引用"不属"训练"）
User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Perplexity-User
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Bingbot
Allow: /

Sitemap: ${base}/sitemap.xml
`;
    res.type('text/plain; charset=utf-8').set('Cache-Control', 'public, max-age=600').send(body);
});

// ── GET /sitemap.xml ─────────────────────────────────────────────────────
router.get('/sitemap.xml', async (req, res) => {
    try {
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        const base = `https://${brand.host}`;
        const now = new Date().toISOString().slice(0, 10);
        // 语言互指（hreflang）：全部语种的首页/价格页/平台页互为 alternate。
        // ⚠️ 必须**每个语言页都把全部语言列全**（含自己），否则 Google 会
        //    判定 hreflang 簇不完整而整体忽略 —— 这是最常见的 hreflang 坑。
        // 用 LANG_ORDER 动态生成，加语种时不用再改这里。
        const altFor = (suffix) => LANG_ORDER
            .map((l) => ({ lang: LANGS[l].code, href: `${base}${LANGS[l].path}${suffix}` }))
            .concat([{ lang: 'x-default', href: `${base}${suffix}` }]);
        const ALT_HOME = altFor('');
        const ALT_PRICE = altFor('/price');
        const urls = brand.isSubsite
            ? [{ loc: `${base}/`, pri: '1.0' }]
            : [
                { loc: `${base}/`, pri: '1.0', alt: ALT_HOME },
                ...LANG_ORDER.filter((l) => l !== 'zh').map((l) => ({
                    loc: `${base}${LANGS[l].path}`, pri: '0.9', alt: ALT_HOME,
                })),
            ];
        const ordered = [...catalog.platforms].sort((a, b) => prefIndex(a.label) - prefIndex(b.label));
        for (const p of ordered) {
            if (!p.count) continue;
            // 「其他」是兜底分类（上游脏分类全归到这里），不是真平台：
            // 拿它做落地页既没有搜索词，内容也杂，不放进 sitemap。
            if (p.label === 'Other') continue;
            urls.push({ loc: `${base}/c/${p.slug}`, pri: p === ordered[0] ? '0.9' : '0.8' });
            // 多语种平台页（2026-11-08）：en / id / pt / vi / ar / ru。分站不做。
            // 类型子页暂不做多语种 —— 内容量不够，宁缺毋滥（低质量页会拖整体）。
            if (!brand.isSubsite) {
                for (const l of LANG_ORDER.filter((x) => x !== 'zh')) {
                    urls.push({
                        loc: `${base}${LANGS[l].path}/c/${p.slug}`,
                        pri: '0.8',
                        alt: altFor(`/c/${p.slug}`),
                    });
                }
            }
            // 类型子页（平台 × 服务类型）。档位太少的不进 sitemap —— 内容撑不起来。
            for (const t of p.types) {
                const tc = typeCopyOf(t.label);
                if (tc && t.count >= 3) {
                    urls.push({ loc: `${base}/c/${p.slug}/${tc.slug}`, pri: '0.7' });
                }
            }
        }
        // 价格表（2026-11-08）：拿 `smm panel price list` / `cheapest smm panel`
        // 这类高购买意图商用词。多数同行不公开价格，这是我们的天然优势。
        urls.push({ loc: `${base}/price`, pri: '0.9', alt: ALT_PRICE });
        if (!brand.isSubsite) {
            for (const l of LANG_ORDER.filter((x) => x !== 'zh')) {
                urls.push({ loc: `${base}${LANGS[l].path}/price`, pri: '0.9', alt: ALT_PRICE });
            }
        }
        // 知识库：拿问答词，页面数 +1 列表 +N 篇
        urls.push({ loc: `${base}/guide`, pri: '0.8' });
        for (const a of ARTICLES) {
            urls.push({ loc: `${base}/guide/${a.slug}`, pri: '0.7' });
        }
        // 英文知识库（2026-11-08）：只收录真正有英文翻译的那几篇 + 列表页。
        // 没翻译的走回退会显示中文，那种页面不该以 en 身份出现在 sitemap 里。
        if (!brand.isSubsite) {
            const enArticles = ARTICLES.filter((a) => a.en);
            if (enArticles.length) {
                const altKb = (slug) => [
                    { lang: 'zh-CN', href: `${base}/guide${slug ? '/' + slug : ''}` },
                    { lang: 'en', href: `${base}/en/guide${slug ? '/' + slug : ''}` },
                    { lang: 'x-default', href: `${base}/guide${slug ? '/' + slug : ''}` },
                ];
                urls.push({ loc: `${base}/en/guide`, pri: '0.8', alt: altKb('') });
                for (const a of enArticles) {
                    urls.push({ loc: `${base}/en/guide/${a.slug}`, pri: '0.7', alt: altKb(a.slug) });
                }
            }
        }
        // 安全节点（2026-11-07 起服务端渲染，分站不卖这个，只主站出）
        if (!brand.isSubsite) {
            urls.push({ loc: `${base}/vpn`, pri: '0.8' });
        }
        // ⚠️ 这里**故意不加** <?xml-stylesheet?>：
        //    加了之后浏览器会把 XML 渲染成漂亮表格，但 Chrome 从 2026 起对 XSLT 弹红色警告
        //    （"此网站使用了 XSLT，该功能很快就会从此浏览器中移除"），比原始 XML 树更让人以为坏了。
        //    搜索引擎读的是 XML 原文，加不加样式对收录没有任何影响。
        //    （/sitemap.xsl 路由保留着，将来需要时把上面那行 PI 加回来即可。）
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => {
            const alt = (u.alt || []).map((a) => `\n    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${a.href}"/>`).join('');
            return `  <url><loc>${u.loc}</loc>${alt}<lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>${u.pri}</priority></url>`;
        }).join('\n')}
</urlset>`;
        res.type('application/xml; charset=utf-8').set('Cache-Control', 'public, max-age=1800').send(xml);
    } catch (e) {
        console.error('[seo] sitemap 生成失败', e.message);
        res.status(500).type('text/plain').send('sitemap error');
    }
});

// ── GET /sitemap.xsl（把 sitemap 渲染成人能看的表格）──────────────────────
router.get('/sitemap.xsl', (req, res) => {
    const xsl = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9" exclude-result-prefixes="sm">
<xsl:output method="html" encoding="UTF-8" indent="yes" />
<xsl:template match="/">
<html lang="zh-CN"><head><meta charset="UTF-8" />
<title>站点地图 · ${esc(hostOf(req))}</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
body{margin:0;padding:28px 18px 60px;background:#0b1220;color:#e2e8f0;
font:15px/1.7 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:820px;margin:0 auto}
h1{font-size:20px;margin:0 0 6px}
p.sub{color:#94a3b8;margin:0 0 22px;font-size:13px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{border-bottom:1px solid #22304a;padding:10px 8px;text-align:left}
th{color:#94a3b8;font-weight:600;font-size:12px;letter-spacing:.04em}
a{color:#22d3ee;text-decoration:none;word-break:break-all}
a:hover{text-decoration:underline}
td.n{color:#94a3b8;white-space:nowrap}
.foot{margin-top:24px;color:#64748b;font-size:12px}
</style></head>
<body><div class="wrap">
<h1>站点地图</h1>
<p class="sub">共 <xsl:value-of select="count(sm:urlset/sm:url)" /> 个页面 · 本文件给人和搜索引擎共用，搜索引擎读取的是 XML 原文</p>
<table>
<thead><tr><th>页面地址</th><th>优先级</th><th>更新频率</th><th>最后更新</th></tr></thead>
<tbody>
<xsl:for-each select="sm:urlset/sm:url">
<xsl:sort select="sm:priority" order="descending" />
<tr>
<td><a href="{sm:loc}"><xsl:value-of select="sm:loc" /></a></td>
<td class="n"><xsl:value-of select="sm:priority" /></td>
<td class="n"><xsl:value-of select="sm:changefreq" /></td>
<td class="n"><xsl:value-of select="sm:lastmod" /></td>
</tr>
</xsl:for-each>
</tbody></table>
<div class="foot">本页由服务端按当前在售服务实时生成 · 价格与平台会随店铺配置变化</div>
</div></body></html>
</xsl:template>
</xsl:stylesheet>`;
    res.type('text/xsl; charset=utf-8').set('Cache-Control', 'public, max-age=3600').send(xsl);
});

// ── GET /llms.txt & /llms-full.txt（给 AI 引擎的站点摘要）──────────────────
// 2026-11-07 新增。背景：之前 /llms.txt 是**假 200** —— nginx 的 SPA 兜底
// 把未知路径统一返回 index.html，AI 引擎请求 llms.txt 拿到一坨 HTML，解析直接失败。
// 现在改为真文件。规范见 https://llmstxt.org/ —— 一个 Markdown 短摘要 + 链接清单，
// 让模型在不抓全站的前提下知道「这个站是什么、有哪些内容、怎么联系」。
const pickOrdered = (catalog) => [...catalog.platforms]
    .filter((p) => p.count && p.label !== 'Other')
    .sort((a, b) => prefIndex(a.label) - prefIndex(b.label));

router.get('/llms.txt', async (req, res) => {
    try {
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        const base = `https://${brand.host}`;
        const ordered = pickOrdered(catalog);
        const cheapest = ordered.length ? per1000(Math.min(...ordered.map((p) => p.minPrice))) : '—';
        const m = brand.meta || {};

        const L = [];
        L.push(`# ${brand.name}`);
        L.push('');
        L.push(`> ${brand.name} 是社媒增长服务面板：提供 TikTok、Instagram、YouTube、Telegram、Facebook、X（Twitter）、Spotify 等平台的`
            + `粉丝、点赞、播放、订阅、评论增长服务。全部按“每 1000 个”计价，最低 ${cheapest} 元起，`
            + `提交订单后系统自动开始处理，不需要提供账号密码。`);
        L.push('');
        L.push('## 关键事实');
        L.push('');
        L.push(`- 在售服务数：${catalog.totalServices} 个`);
        L.push(`- 计费方式：按每 1000 个计价，不同质量/速度档位价格不同，下单页按数量实时算总价`);
        L.push(`- 交付方式：提交订单后自动派单开始处理，进度在“我的订单”可查，不需要人工催单`);
        L.push(`- 账号安全：只填目标链接或用户名，不需要登录密码`);
        L.push(`- 支付：站内余额充值，余额即时到账`);
        L.push('');
        L.push('## 各平台服务页');
        L.push('');
        for (const p of ordered) {
            const cn = PLATFORM_CN[p.label] || p.label;
            L.push(`- [${cn} 增长服务](${base}/c/${p.slug})：${p.count} 个服务，${per1000(p.minPrice)} 元起 / 1000 个`);
        }
        L.push('');
        L.push('## 其他页面');
        L.push('');
        L.push(`- [首页](${base}/)：平台与服务总览、各平台起价`);
        L.push(`- [英文版 English](${base}/en)：Full English homepage — platform list, per-1,000 starting prices, how it works, and FAQ`);
        L.push(`- [知识库](${base}/guide)：下单前必看 —— 链接格式、掉粉、档位选择、直播数据等 ${ARTICLES.length} 篇实操说明`);
        L.push(`- [完整服务清单](${base}/llms-full.txt)：逐条列出全部在售服务与价格区间`);
        L.push('');
        L.push('## 说明文档');
        L.push('');
        for (const a of ARTICLES) {
            L.push(`- [${a.title}](${base}/guide/${a.slug})：${a.desc}`);
        }
        L.push('');
        L.push('## 下单前须知');
        L.push('');
        L.push('- 涨粉类服务需要填**主页链接或用户名**（例如 `tiktok.com/@用户名`），填视频链接会失败');
        L.push('- 同一个链接不要重复下单，重复单会被判定失败并退款');
        L.push('- 账号需为公开状态，私密账号无法交付');
        L.push('');
        if (m.tgUrl || m.wechatId) {
            L.push('## 联系');
            L.push('');
            if (m.tgUrl) L.push(`- Telegram：${m.tgUrl}`);
            if (m.wechatId) L.push(`- 微信：${m.wechatId}`);
            L.push('');
        }
        res.type('text/plain; charset=utf-8')
            .set('Cache-Control', 'public, max-age=1800')
            .send(L.join('\n'));
    } catch (e) {
        console.error('[seo] llms.txt 生成失败', e.message);
        res.status(500).type('text/plain').send('llms.txt error');
    }
});

router.get('/llms-full.txt', async (req, res) => {
    try {
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        const ordered = pickOrdered(catalog);
        const L = [];
        L.push(`# ${brand.name} — 完整服务清单`);
        L.push('');
        L.push(`> 本文档由服务端按当前在售服务实时生成，价格可能随店铺配置变化。`);
        L.push('');
        for (const p of ordered) {
            const cn = PLATFORM_CN[p.label] || p.label;
            L.push(`## ${cn}`);
            L.push('');
            L.push(`页面：https://${brand.host}/c/${p.slug}`);
            L.push('');
            L.push(`共 ${p.count} 个服务，最低 ${per1000(p.minPrice)} 元 / 1000 个。`);
            L.push('');
            for (const t of p.types) {
                L.push(`- ${t.label}：${t.count} 个档位，${per1000(t.minPrice)} 元起 / 1000 个`
                    + (t.minQty > 0 ? `，单次 ${t.minQty}–${t.maxQty} 个` : ''));
            }
            L.push('');
        }
        res.type('text/plain; charset=utf-8')
            .set('Cache-Control', 'public, max-age=1800')
            .send(L.join('\n'));
    } catch (e) {
        console.error('[seo] llms-full.txt 生成失败', e.message);
        res.status(500).type('text/plain').send('llms-full error');
    }
});

// ── GET /__404（nginx 的 error_page 404 落到这里）──────────────────────────
// 2026-11-07：之前所有不存在的路径都被 SPA 兜底成「200 + 首页」，
// 搜索引擎判为 soft 404，抓取预算全浪费在空页面上。现在 nginx 把真 404 转到这里，
// 返回带品牌和返回链接的页面，HTTP 状态保持 404。
router.get('/__404', (req, res) => {
    const host = hostOf(req);
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>页面不存在 · ${esc(host)}</title>
<meta name="robots" content="noindex, follow">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#0b1220;color:#e2e8f0;font:16px/1.75 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.box{max-width:520px;padding:32px 24px;text-align:center}
h1{font-size:52px;margin:0 0 8px;font-weight:800;color:#22d3ee;letter-spacing:-2px}
p{margin:6px 0;color:#94a3b8}
a{display:inline-block;margin-top:22px;padding:11px 26px;border-radius:10px;background:#22d3ee;color:#06232b;
text-decoration:none;font-weight:700}
a:hover{background:#67e8f9}</style></head>
<body><div class="box"><h1>404</h1>
<p>这个页面不存在，或者已经被移走了。</p>
<p style="font-size:13px;color:#64748b">${esc(host)}</p>
<a href="/">回首页</a></div></body></html>`;
    res.status(404).type('text/html; charset=utf-8').set('Cache-Control', 'no-store').send(html);
});

// ── GET /c/:slug/:type（平台 × 服务类型子页，2026-11-07）──────────────────
// 客户真实搜的是「TikTok 涨粉」这种「平台 + 动作」组合词，而不是「TikTok 增长服务」。
// 把平台页拆到类型级，一个平台覆盖 4–6 个独立搜索意图。
// 只有 TYPE_COPY 里写过硬内容的类型才出子页 —— 「其他」这类杂类不做，
// 否则就是给搜索引擎喂一堆没有搜索词的空页。
const typeOfSlug = (plat, slug) => {
    for (const t of plat.types) {
        const tc = typeCopyOf(t.label);
        if (tc && tc.slug === slug) return { t, tc };
    }
    return null;
};

router.get('/c/:slug/:type', async (req, res) => {
    try {
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        const label = labelOfSlug(req.params.slug);
        const plat = label ? catalog.platforms.find((p) => p.label === label) : null;
        const hit = plat && plat.count ? typeOfSlug(plat, req.params.type) : null;
        const notFound = () => res.status(404).type('text/html; charset=utf-8').send(
            `<!doctype html><meta charset="utf-8"><title>页面不存在</title><meta name="robots" content="noindex"><div style="font:16px system-ui;padding:40px">没有找到这个页面。<a href="/">回首页</a></div>`
        );
        if (!hit) return notFound();

        const { t, tc } = hit;
        const platCn = PLATFORM_CN[plat.label] || plat.label;
        const canonical = `https://${brand.host}/c/${plat.slug}/${tc.slug}`;
        const cheapest = per1000(t.minPrice);
        // 🔑 标题用「动作词」而不是「类型名词」（2026-11-08）。
        //   中文用户搜的是「TikTok 涨粉」「TikTok 刷赞」，不是「TikTok 粉丝服务」。
        //   「粉丝」是名词（想了解这个东西），「涨粉」是动作（想买这个服务）——
        //   搜索意图完全不同，标题里必须出现动作词才可能被搜到。
        //   同时保留类型名词，覆盖「TikTok 粉丝」这类搜法。
        const act = tc.action || tc.name;
        const title = `${platCn} ${act}服务 ${cheapest} 元起 · ${tc.name}价格表 · ${brand.name}`;
        const desc = `${brand.name} 提供 ${platCn} ${act}服务：${t.count} 个档位，${cheapest} 元起 / 1000 个。${t.minQty > 0 ? `单次 ${t.minQty}–${t.maxQty} 个，` : ''}提交订单后自动开始处理，不需要账号密码。`;
        const pc = copyOf(plat.label);

        const qty = t.minQty > 0 ? `${t.minQty}–${t.maxQty}` : '按需';
        const rows = `<table class="seo-table"><thead><tr><th>档位</th><th>起价 / 1000 个</th><th>服务数</th></tr></thead>
<tbody><tr><td>${esc(platCn)} ${esc(tc.name)}</td><td>¥${cheapest}</td><td>${t.count} 个</td></tr></tbody></table>`;

        const body = `<div class="seo-wrap">${styleBlock}
<nav style="font-size:13px;color:#94a3b8;margin-bottom:10px">
<a href="/" style="color:#22d3ee">首页</a> › <a href="/c/${plat.slug}" style="color:#22d3ee">${esc(platCn)}</a> › ${esc(tc.name)}
</nav>
<h1>${esc(platCn)} ${esc(tc.name)}服务 · ${esc(act)} ${esc(cheapest)} 元起 · ${esc(brand.name)}</h1>
<p>${esc(tc.intro)}</p>
<p>${esc(brand.name)} 现有 <b>${t.count}</b> 个 ${esc(platCn)} ${esc(tc.name)}档位，最低 <b>${cheapest} 元</b> / 1000 个，单次数量 ${esc(qty)}，提交订单后系统自动开始处理。</p>
${rows}
<h2>${esc(tc.name)}类指标分别是什么意思</h2>
<dl>${tc.metrics.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
<h2>什么情况下需要${esc(tc.name)}</h2>
<ul>${tc.scenes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<h2>最容易踩的坑</h2>
<ul>${tc.pitfalls.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
${(() => {
                // 🔑 同义词覆盖（2026-11-08）：用户对这个服务的叫法有几十种，
                //   标题只能挑最主流的两个。把其余叫法自然列成一节，
                //   页面就能匹配大量长尾搜索词 —— 这是抓长尾最有效的做法，
                //   而且对读者也有用（他可能就是搜另一个词进来的）。
                const al = Array.isArray(tc.aliases) ? tc.aliases.filter((x) => x && x !== tc.name) : [];
                if (al.length < 3) return '';
                return `<h2>${esc(tc.name)}服务还有哪些叫法</h2>
<p>不同平台、不同地区的人对同一件事的叫法不一样。你搜到的下面这些词，说的都是同一类服务 —— 给${esc(platCn)}账号增加${esc(tc.name)}：</p>
<p style="color:#cbd5e1">${al.map((x) => esc(x)).join('、')}。</p>
<p>叫法不同不影响交付内容，最终看的还是同一个东西：<b>数量、质量档位、起量速度</b>。下单时按需求填数量，页面会按每 1000 个实时算出总价，不用自己换算。</p>`;
            })()}
<h2>${esc(platCn)} ${esc(tc.name)}怎么选</h2>
<p>${esc(tc.choose)}</p>
${pc ? `<h2>为什么在 ${esc(platCn)} 上做增长</h2><p>${esc(pc.intro)}</p>` : ''}
<h2>常见问题</h2>
${faqHtml(tc.faq.map(([q, a]) => ({ q, a })))}
<h2>${esc(platCn)} 的其他服务</h2>
<ul>${plat.types.filter((x) => x.label !== t.label && typeCopyOf(x.label)).map((x) => {
            const xtc = typeCopyOf(x.label);
            return `<li><a href="/c/${plat.slug}/${xtc.slug}" style="color:#22d3ee">${esc(platCn)} ${esc(x.name || x.label)}服务</a>（${x.count} 个档位，${per1000(x.minPrice)} 元起）</li>`;
        }).join('')}</ul>
<h2>其他平台</h2>
${linksTo(brand, catalog.platforms, plat.slug)}
<a class="seo-cta" href="/order">去下单 →</a>
<div class="seo-foot">${esc(brand.name)} · 自动交付 · 在线充值</div>
</div>`;

        // 结构化数据：三级面包屑 + 该类型 FAQ
        const base = `https://${brand.host}`;
        const ldExtra = [
            {
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: brand.name, item: `${base}/` },
                    { '@type': 'ListItem', position: 2, name: `${platCn} 增长服务`, item: `${base}/c/${plat.slug}` },
                    { '@type': 'ListItem', position: 3, name: `${platCn} ${tc.name}服务`, item: canonical },
                ],
            },
            {
                '@context': 'https://schema.org',
                '@type': 'Service',
                name: `${platCn} ${tc.name}服务`,
                serviceType: `${platCn} ${tc.name}增长`,
                provider: { '@type': 'Organization', name: brand.name, url: `${base}/` },
                areaServed: 'Worldwide',
                offers: {
                    '@type': 'Offer',
                    priceCurrency: 'CNY',
                    price: Number(t.minPrice.toFixed(2)),
                    priceSpecification: {
                        '@type': 'UnitPriceSpecification',
                        price: Number(t.minPrice.toFixed(2)),
                        priceCurrency: 'CNY',
                        unitText: '每 1000 个',
                        referenceQuantity: { '@type': 'QuantitativeValue', value: 1000, unitCode: 'C62' },
                    },
                    availability: 'https://schema.org/InStock',
                    url: canonical,
                },
            },
            {
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: tc.faq.map(([q, a]) => ({
                    '@type': 'Question', name: q,
                    acceptedAnswer: { '@type': 'Answer', text: a },
                })),
            },
        ];

        const shell = readTemplate(brand.isSubsite ? 'site' : 'main');
        if (!shell) return res.status(503).type('text/plain').send('building');
        const ldAll = ldExtra.map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');
        const html = injectIntoShell(shell, {
            head: headOf({ brand, title, desc, canonical, ld: ldAll }),
            body,
        });
        res.type('text/html; charset=utf-8').set('Cache-Control', 'public, max-age=1800').send(html);
    } catch (e) {
        console.error('[seo] 类型子页失败', e.message);
        res.status(500).type('text/plain').send('error');
    }
});

// ── GET /guide 与 /guide/:slug（知识库，2026-11-07）────────────────────────
// 产品页拿交易词，这里拿问答词。AI 引擎被问到「买粉丝会掉吗」时，
// 引用的是有明确判断标准的那一段 —— 这就是这一层存在的意义。
// 正文里的 `反引号` 渲染成 <code>，其余按纯文本转义。
// 正文行内 markdown：`代码`、**粗体**、[文字](/站内路径)
// ⚠️ 链接只允许站内相对路径（以 / 开头）。esc() 已经把 < > & 转义了，
//    再限制 href 不能是 javascript:/http: —— 文章内容虽然是自家写的，
//    但没有理由给它开一个能注入外链或脚本的口子。
const mdInline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code style="background:#152036;padding:1px 5px;border-radius:4px;font-size:.92em">$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong style="color:#f1f5f9">$1</strong>')
    .replace(/\[([^\]\n]+)\]\((\/[^)\s]*)\)/g, '<a href="$2" style="color:#22d3ee">$1</a>');

// 把正文 markdown 去掉标记，变成纯文本（给 JSON-LD 用）
// ⚠️ 原来只 replace(/`/g,'')，漏了 ** 粗体和 [文字](/path) 链接 ——
//    结果 FAQ 结构化数据里塞的是 `**绝大多数情况不是内容问题**` 这种带标记的
//    脏文本，Google 和 AI 摘录时读到的是原始 markdown。所有文章的 FAQ 都受影响。
const mdPlain = (s) => String(s || '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^\|/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();

/**
 * 正文块解析：一段文字里支持多行结构。
 *
 * 2026-11-08 升级：原来每个小节只能是「标题 + 一整段话」，撑不起「全面讲解」
 * 那种密度。现在同一段文本里可以混排：
 *
 *   普通段落文字，可以换行但会被合并成一段
 *   - 无序列表项
 *   - 另一项
 *   1. 有序步骤
 *   2. 第二步
 *   > 需要强调的提醒，渲染成高亮框
 *   | 表头 | 表头 |
 *   |---|---|
 *   | 单元格 | 单元格 |
 *
 * 小标题用 '### ' 开头会渲染成 h3（二级小标题），否则是 h2。
 */
const mdBlock = (text) => {
    const lines = String(text || '').split('\n');
    const out = [];
    let i = 0;
    const isTableSep = (s) => /^\|[\s:|-]+\|$/.test(s);
    while (i < lines.length) {
        const t = lines[i].trim();
        if (!t) { i++; continue; }

        // 表格：当前行以 | 开头，下一行是分隔行
        if (t.startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1].trim())) {
            const head = t.split('|').slice(1, -1).map((x) => x.trim());
            i += 2;
            const rows = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                rows.push(lines[i].trim().split('|').slice(1, -1).map((x) => x.trim()));
                i++;
            }
            out.push(`<div style="overflow-x:auto"><table class="seo-table"><thead><tr>${
                head.map((h) => `<th>${mdInline(h)}</th>`).join('')
            }</tr></thead><tbody>${
                rows.map((r) => `<tr>${r.map((c) => `<td>${mdInline(c)}</td>`).join('')}</tr>`).join('')
            }</tbody></table></div>`);
            continue;
        }

        // 无序列表
        if (/^[-*]\s+/.test(t)) {
            const items = [];
            while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
                items.push(`<li>${mdInline(lines[i].trim().replace(/^[-*]\s+/, ''))}</li>`);
                i++;
            }
            out.push(`<ul>${items.join('')}</ul>`);
            continue;
        }

        // 有序列表（步骤）
        if (/^\d+\.\s+/.test(t)) {
            const items = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
                items.push(`<li>${mdInline(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`);
                i++;
            }
            out.push(`<ol>${items.join('')}</ol>`);
            continue;
        }

        // 强调块
        if (/^>\s+/.test(t)) {
            const buf = [];
            while (i < lines.length && /^>\s+/.test(lines[i].trim())) {
                buf.push(lines[i].trim().replace(/^>\s+/, ''));
                i++;
            }
            out.push(`<div class="seo-note">${mdInline(buf.join(' '))}</div>`);
            continue;
        }

        // 普通段落
        const para = [];
        while (i < lines.length) {
            const cur = lines[i].trim();
            if (!cur) break;
            if (/^([-*]\s|\d+\.\s|>|\|)/.test(cur)) break;
            para.push(cur);
            i++;
        }
        if (para.length) out.push(`<p>${mdInline(para.join(' '))}</p>`);
    }
    return out.join('\n');
};

const guideBody = (a) => a.body.map(([h, p]) => {
    const isSub = /^###\s+/.test(h);
    const title = h.replace(/^###\s+/, '');
    const tag = isSub ? 'h3' : 'h2';
    return `<${tag}>${esc(title)}</${tag}>\n${mdBlock(p)}`;
}).join('\n');

// FAQ 结构化数据：取正文前四节的问题 + 答案（去掉 markdown 标记）
// ⚠️ 必须用 mdPlain 清干净：原来只清反引号，导致 JSON-LD 里塞的是
//    `**加粗**` 和 `[文字](/path)` 这种原始 markdown，Google 和 AI 摘录时
//    读到的就是带符号的脏文本。
const guideFaqLd = (a) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: a.body.slice(0, 4).map(([h, p]) => ({
        '@type': 'Question',
        name: h.replace(/^###\s+/, ''),
        acceptedAnswer: { '@type': 'Answer', text: mdPlain(p) },
    })),
});


// ── 知识库（中 / 英共用同一套渲染，2026-11-08）──────────────────────────
// 抽成函数而不是复制两份：中文 18 篇、英文 8 篇（其余回退中文），
// 如果按语种各写一套路由，加第 3 个语种时又要复制一遍。
const GUIDE_UI = {
    zh: {
        home: '首页', kb: '知识库', related: '相关阅读', next: '下一步',
        nextText: '看完了就可以去下单。不确定选哪个档位，先在对应平台页看各类型服务的起价和档位说明。',
        cta: '去下单 →', foot: '自动交付 · 在线充值', svc: '增长服务',
        notFound: '没有找到这篇。', backKb: '回知识库',
        h1: '社媒增长知识库',
        intro: '分两部分：<b>运营方法</b>讲怎么起号、怎么引流、数据怎么看；<b>下单说明</b>讲链接怎么填、档位怎么选、出了问题怎么判断。都是实操里真会遇到的事，不给形容词只给判断标准。',
        opsHead: '运营方法', orderHead: '下单说明', priceHead: '价格与平台',
        priceText: '所有服务按每 1000 个计价，全平台明码标价，不用注册就能看：',
        priceLink: '完整价格表', docs: (n) => `${n} 篇`,
        listTitle: (n, b) => `社媒增长知识库 · 起号、引流、看数据、下单说明 ${n} 篇 · ${b}`,
        listDesc: (n) => `新号为什么只有 200 播放、跨境店铺五个引流渠道怎么排、互动率多少算正常、自然涨粉和加速涨粉什么时候用哪个，以及下单前必看的链接格式、档位选择、掉粉判断 —— ${n} 篇实操说明，不给形容词只给判断标准。`,
        updated: '更新于', locale: 'zh_CN',
    },
    en: {
        home: 'Home', kb: 'Guides', related: 'Related reading', next: 'Next step',
        nextText: 'Ready to order? If you are unsure which tier to pick, check the starting prices and tier notes on the relevant platform page first.',
        cta: 'Start an order →', foot: 'automatic delivery · pay as you go', svc: 'services',
        notFound: 'This article does not exist.', backKb: 'Back to guides',
        h1: 'Growth knowledge base',
        intro: 'Two sections: <b>operating methods</b> covers getting an account started, driving traffic, and reading the numbers; <b>ordering notes</b> covers link formats, tier selection, and diagnosing problems. All of it comes from actual practice — thresholds rather than adjectives.',
        opsHead: 'Operating methods', orderHead: 'Ordering notes', priceHead: 'Pricing and platforms',
        priceText: 'Everything is priced per 1,000 units, published openly across all platforms — no signup required:',
        priceLink: 'Full price list', docs: (n) => `${n} articles`,
        listTitle: (n, b) => `Growth knowledge base · ${n} practical guides on account setup, traffic and pricing · ${b}`,
        listDesc: (n) => `Why a new account plateaus at 200 views, how to rank five traffic channels for a cross-border store, what engagement rate is normal, when to use organic growth versus acceleration, plus link formats, tier selection and drop-off diagnosis — ${n} practical guides with thresholds instead of adjectives.`,
        updated: 'Updated', locale: 'en_US',
    },
};

const GUIDE_OPS_TAGS = ['起号实操', '店铺运营', '数据判断', '策略选择', '运营方法', 'Getting started', 'Store operations', 'Reading data', 'Strategy'];

/** 知识库列表页（中 / 英） */
const renderGuideList = async (req, res, lang) => {
    const ui = GUIDE_UI[lang];
    const isEn = lang === 'en';
    const catalog = await loadCatalog(req.site);
    const brand = brandOf(req, catalog);
    const base = `https://${brand.host}`;
    const canonical = `${base}${isEn ? '/en' : ''}/guide`;

    // 英文列表只展示真正翻译过的文章，避免把 10 篇中文混进英文页面
    const pool = isEn ? ARTICLES.filter((a) => a.en) : ARTICLES;
    const ops = pool.filter((a) => GUIDE_OPS_TAGS.includes(a.tag));
    const ord = pool.filter((a) => !GUIDE_OPS_TAGS.includes(a.tag));
    const view = (a) => (isEn ? articleOfLang(a.slug, 'en') : a);

    const cardOf = (a) => {
        const v = view(a);
        return `<li style="margin:14px 0">
<a href="${isEn ? '/en' : ''}/guide/${a.slug}" style="color:#22d3ee;font-weight:700;font-size:16px">${esc(v.title)}</a>
<div style="color:#94a3b8;font-size:14px;margin-top:4px">${esc(v.desc)}</div>
<div style="color:#64748b;font-size:12px;margin-top:4px">${esc(v.tag)} · ${esc(ui.updated)} ${esc(a.updated)}</div>
</li>`;
    };
    const plats = [...catalog.platforms].filter((p) => p.count && p.label !== 'Other').slice(0, 6);
    const platHead = (p) => (isEn ? p.label : (PLATFORM_CN[p.label] || p.label));

    const body = `<div class="seo-wrap">${styleBlock}
<h1>${esc(ui.h1)}</h1>
<p>${ui.intro}</p>
<h2>${esc(ui.opsHead)}（${ui.docs(ops.length)}）</h2>
<ul style="list-style:none;padding:0">${ops.map(cardOf).join('')}</ul>
${ord.length ? `<h2>${esc(ui.orderHead)}（${ui.docs(ord.length)}）</h2>
<ul style="list-style:none;padding:0">${ord.map(cardOf).join('')}</ul>` : ''}
<h2>${esc(ui.priceHead)}</h2>
<p>${esc(ui.priceText)}</p>
<ul>
<li><a href="${isEn ? '/en' : ''}/price" style="color:#22d3ee">${esc(ui.priceLink)}</a></li>
${plats.map((p) => `<li><a href="${isEn ? '/en' : ''}/c/${p.slug}" style="color:#22d3ee">${esc(platHead(p))} ${esc(ui.svc)}</a></li>`).join('')}
</ul>
<a class="seo-cta" href="/order">${esc(ui.cta)}</a>
<div class="seo-foot">${esc(brand.name)} · ${esc(ui.foot)}</div>
</div>`;

    const ld = [{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: ui.h1,
        description: ui.listDesc(pool.length),
        inLanguage: isEn ? 'en' : 'zh-CN',
        url: canonical,
        hasPart: pool.map((a) => ({
            '@type': 'Article',
            headline: view(a).title,
            url: `${base}${isEn ? '/en' : ''}/guide/${a.slug}`,
        })),
    }].map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');

    const shell = readTemplate(brand.isSubsite ? 'site' : 'main');
    if (!shell) return res.status(503).type('text/plain').send('building');
    let html = injectIntoShell(shell, {
        head: headOf({
            brand, title: ui.listTitle(pool.length, brand.name), desc: ui.listDesc(pool.length),
            canonical, ld, locale: ui.locale,
            hreflangs: [
                { lang: 'zh-CN', href: `${base}/guide` },
                { lang: 'en', href: `${base}/en/guide` },
                { lang: 'x-default', href: `${base}/guide` },
            ],
        }),
        body,
    });
    if (isEn) html = setHtmlLang(html, 'en');
    res.type('text/html; charset=utf-8').set('Cache-Control', 'public, max-age=1800').send(html);
};

/** 知识库详情页（中 / 英） */
const renderGuideArticle = async (req, res, lang) => {
    const ui = GUIDE_UI[lang];
    const isEn = lang === 'en';
    const a = articleOfLang(req.params.slug, lang);
    if (!a) {
        return res.status(404).type('text/html; charset=utf-8').send(
            `<!doctype html><meta charset="utf-8"><title>404</title><meta name="robots" content="noindex"><div style="font:16px system-ui;padding:40px">${esc(ui.notFound)} <a href="${isEn ? '/en' : ''}/guide">${esc(ui.backKb)}</a></div>`
        );
    }
    const catalog = await loadCatalog(req.site);
    const brand = brandOf(req, catalog);
    const base = `https://${brand.host}`;
    const pfx = isEn ? '/en' : '';
    const canonical = `${base}${pfx}/guide/${a.slug}`;
    // 相关阅读：英文只推有英文版的，避免点了跳到中文
    const related = ARTICLES
        .filter((x) => x.slug !== a.slug && (!isEn || x.en))
        .slice(0, 4)
        .map((x) => (isEn ? articleOfLang(x.slug, 'en') : x));
    const plats = [...catalog.platforms].filter((p) => p.count && p.label !== 'Other').slice(0, 6);
    const platHead = (p) => (isEn ? p.label : (PLATFORM_CN[p.label] || p.label));

    const body = `<div class="seo-wrap">${styleBlock}
<nav style="font-size:13px;color:#94a3b8;margin-bottom:10px">
<a href="${pfx}/" style="color:#22d3ee">${esc(ui.home)}</a> › <a href="${pfx}/guide" style="color:#22d3ee">${esc(ui.kb)}</a> › ${esc(a.tag)}
</nav>
<h1>${esc(a.title)}</h1>
<p style="color:#cbd5e1">${esc(a.desc)}</p>
<div style="color:#64748b;font-size:12px;margin:8px 0 18px">${esc(a.tag)} · ${esc(ui.updated)} ${esc(a.updated)}</div>
${guideBody(a)}
<h2>${esc(ui.related)}</h2>
<ul>${related.map((x) => `<li><a href="${pfx}/guide/${x.slug}" style="color:#22d3ee">${esc(x.title)}</a></li>`).join('')}</ul>
<h2>${esc(ui.next)}</h2>
<p>${esc(ui.nextText)}</p>
<ul>${plats.map((p) => `<li><a href="${pfx}/c/${p.slug}" style="color:#22d3ee">${esc(platHead(p))} ${esc(ui.svc)}</a></li>`).join('')}</ul>
<a class="seo-cta" href="/order">${esc(ui.cta)}</a>
<div class="seo-foot">${esc(brand.name)} · ${esc(ui.foot)}</div>
</div>`;

    // 只有真正有英文版的文章才声明 en 的 hreflang；没翻译的回退页不参与互指，
    // 否则会出现「两个 URL 同一种语言」的重复内容信号。
    const trans = hasLang(a.slug, 'en');
    const alt = trans ? [
        { lang: 'zh-CN', href: `${base}/guide/${a.slug}` },
        { lang: 'en', href: `${base}/en/guide/${a.slug}` },
        { lang: 'x-default', href: `${base}/guide/${a.slug}` },
    ] : [];

    const ld = [
        {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: a.title,
            description: a.desc,
            datePublished: a.updated,
            dateModified: a.updated,
            inLanguage: isEn ? 'en' : 'zh-CN',
            author: { '@type': 'Organization', name: brand.name, url: `${base}/` },
            publisher: { '@type': 'Organization', name: brand.name, url: `${base}/` },
            mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
            image: `${base}/og.png`,
        },
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: brand.name, item: `${base}/` },
                { '@type': 'ListItem', position: 2, name: ui.kb, item: `${base}${pfx}/guide` },
                { '@type': 'ListItem', position: 3, name: a.title, item: canonical },
            ],
        },
        guideFaqLd(a),
    ].map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');

    const shell = readTemplate(brand.isSubsite ? 'site' : 'main');
    if (!shell) return res.status(503).type('text/plain').send('building');
    let html = injectIntoShell(shell, {
        head: headOf({
            brand, title: `${a.title} · ${brand.name}`, desc: a.desc, canonical, ld,
            locale: ui.locale, hreflangs: alt,
        }),
        body,
    });
    if (isEn) html = setHtmlLang(html, 'en');
    res.type('text/html; charset=utf-8').set('Cache-Control', 'public, max-age=1800').send(html);
};

router.get('/guide', (req, res) => renderGuideList(req, res, 'zh').catch((e) => {
    console.error('[seo] 知识库列表失败', e.message);
    res.status(500).type('text/plain').send('error');
}));

router.get('/guide/:slug', (req, res) => renderGuideArticle(req, res, 'zh').catch((e) => {
    console.error('[seo] 知识库详情失败', e.message);
    res.status(500).type('text/plain').send('error');
}));

router.get('/en/guide', (req, res) => renderGuideList(req, res, 'en').catch((e) => {
    console.error('[seo] /en/guide 列表失败', e.message);
    res.status(500).type('text/plain').send('error');
}));

router.get('/en/guide/:slug', (req, res) => renderGuideArticle(req, res, 'en').catch((e) => {
    console.error('[seo] /en/guide 详情失败', e.message);
    res.status(500).type('text/plain').send('error');
}));

// ── GET /vpn（全球安全节点，2026-11-07）────────────────────────────────────
// 之前这个页面是 client/public/vpn.html 一个 2.9KB 的手写壳，<div id="app"> 全空、
// 正文 0 字 —— 搜索引擎抓到的是空页面，而 robots.txt 又 Disallow 了它，
// meta 却写着 index,follow。三处互相抵消，等于什么都没做。
// 现在改成服务端渲染，和 /c/:slug 一个套路。
//
// ⚠️ 关键：**没配节点时也要有真内容**。当前 vpn_products 表是 0 行，
//    如果按「有货才渲染」写，上线第一天就是空页面。所以下面把计费方式、
//    协议、接入流程、FAQ 全部写死在服务端，节点列表只是其中一块。
//    祥哥配好节点后，这块自动填上，不用改代码。
const VPN_FAQ = [
    ['怎么使用？', '下单后在「我的节点」里会拿到订阅链接和二维码。把订阅链接导入对应客户端（Windows 用 v2rayN / macOS 用 V2Box / iOS 用 Shadowrocket / Android 用 v2rayNG），点更新订阅就能看到全部线路，选一条连接即可。不需要手工填地址和密码。'],
    ['流量怎么算？', '按你购买的流量包扣减，上传和下载都计入。流量用完即停，不会自动续费、不会有超额扣款。到期时间从开通那一刻开始算 30 天，流量没用完也会到期，两者先到先停。'],
    ['能几台设备同时用？', '默认同一份订阅可以在多台设备上导入，但同时在线数受节点配置限制。如果是团队使用，建议按人数购买多个订阅，避免互相挤占。'],
    ['节点在哪些地区？', '按实际可用的地区展示，通常在页面上会标注国旗和机房位置。选节点时不要只看距离 —— 到你常用网站的路由质量比物理距离更重要，建议下单前先申请试用测一下。'],
    ['能试用吗？', '支持试用（页面上的「免费试用」按钮，具体额度和是否开放由站点配置决定）。试用拿到的是和正式订阅一样的接入方式，可以先测延迟和速度再决定买多少流量。'],
    ['到期了怎么办？', '到期后订阅自动失效，需要重新购买并重新导入订阅。已经过期的订阅链接不会恢复，请在「我的节点」里换取新的链接。'],
    ['为什么连接不上？', '按这个顺序排查：① 订阅是否更新到最新（客户端里点「更新订阅」）；② 设备时间是否准确（时间偏差超过 2 分钟会导致握手失败）；③ 换一条线路试；④ 本地网络是否拦截了对应端口。四条都试过还不行，联系客服并提供客户端名称和报错截图。'],
];

router.get('/vpn', async (req, res) => {
    try {
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        // 分站不卖安全节点（站长没有这个业务，前端菜单也是 v-if="!isSubsite" 隐藏的）
        if (brand.isSubsite) {
            return res.status(404).type('text/html; charset=utf-8').send(
                `<!doctype html><meta charset="utf-8"><title>页面不存在</title><meta name="robots" content="noindex"><div style="font:16px system-ui;padding:40px">页面不存在。<a href="/">回首页</a></div>`
            );
        }

        const base = `https://${brand.host}`;
        const canonical = `${base}/vpn`;
        const m = brand.meta || {};

        let products = [];
        try {
            products = await VpnProduct.findAll({ where: { active: true }, order: [['sort', 'ASC']] });
        } catch (e) {
            console.error('[seo] 读取节点失败', e.message);
        }
        const hasNodes = products.length > 0;
        const minPricePerGb = hasNodes
            ? Math.min(...products.map((p) => Number(p.price_per_gb || 0)).filter((n) => n > 0))
            : 0;
        const priceText = minPricePerGb > 0 ? `${minPricePerGb.toFixed(2)} 元 / GB 起` : '按节点配置定价';

        const title = `全球安全节点 · 多协议一键接入 · ${brand.name}`;
        const desc = hasNodes
            ? `${brand.name} 全球安全节点：${products.length} 个地区可选，${priceText}，支持 VLESS / VMess / Trojan / Shadowsocks / Hysteria2 多协议，下单即得订阅链接，Windows / macOS / iOS / Android 全平台可用。`
            : `${brand.name} 全球安全节点：支持 VLESS / VMess / Trojan / Shadowsocks / Hysteria2 多协议，按流量 GB 计费，下单即得订阅链接，Windows / macOS / iOS / Android 全平台可用。`;

        // 节点表：有货才渲染，没货给一句状态说明（不留空白，页面始终有内容）
        const nodeBlock = hasNodes
            ? `<table class="seo-table"><thead><tr><th>节点</th><th>地区</th><th>最大流量</th><th>价格</th></tr></thead><tbody>${
                products.map((p) => `<tr>
<td>${esc(p.flag_emoji || '')} ${esc(p.name)}</td>
<td>${esc(p.vps_location || '—')}</td>
<td>${p.max_traffic_gb ? `${esc(String(p.max_traffic_gb))} GB` : '—'}</td>
<td>${Number(p.price_per_gb) > 0 ? `${Number(p.price_per_gb).toFixed(2)} 元 / GB` : '按流量包'}</td>
</tr>${p.description ? `<tr><td colspan="4" style="color:#94a3b8;font-size:13px;padding-top:0">${esc(p.description)}</td></tr>` : ''}`).join('')
            }</tbody></table><p>全部节点按流量计费，30 天有效期，流量用完即停，不自动续费。</p>`
            : `<p>节点正在配置中。当前可直接联系客服了解开通时间，或先看下面的计费方式与接入流程 —— 开通后本页会自动列出全部可用地区与价格。</p>`;

        const protocols = ['VLESS + Reality', 'VMess + WebSocket', 'Trojan + TLS', 'Shadowsocks', 'Hysteria2'];
        const clients = [
            ['Windows', 'v2rayN / Clash Verge'],
            ['macOS', 'V2Box / ClashX'],
            ['iOS', 'Shadowrocket / Stash'],
            ['Android', 'v2rayNG / Clash Meta'],
            ['Linux', 'v2rayA / Clash'],
        ];

        const body = `<div class="seo-wrap">${styleBlock}
<nav style="font-size:13px;color:#94a3b8;margin-bottom:10px">
<a href="/" style="color:#22d3ee">首页</a> › 全球安全节点
</nav>
<h1>${esc(brand.name)} 全球安全节点</h1>
<p>覆盖多地区的安全接入节点，支持主流协议，下单后直接拿到订阅链接，导入客户端点一下就能用。不需要手工配置地址和密钥。</p>
<p>计费方式：<b>按流量 GB 计费</b>，${esc(priceText)}，开通后 30 天有效，流量用完即停，不自动续费、不超额扣款。</p>

<h2>可用节点</h2>
${nodeBlock}

<h2>支持的协议</h2>
<ul>${protocols.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
<p>协议在节点侧配置好后由客户端自动识别，你不需要手动选择 —— 导入订阅后客户端会列出全部可用线路。</p>

<h2>四步接入</h2>
<ol>
<li>下单并完成支付（余额支付，即时到账）</li>
<li>进入「我的节点」拿到<b>订阅链接</b>和二维码</li>
<li>在客户端里添加订阅、点「更新订阅」，线路列表就出来了</li>
<li>选一条延迟低的连接即可，之后每换设备只需再导入一次</li>
</ol>

<h2>支持哪些设备</h2>
<table class="seo-table"><thead><tr><th>系统</th><th>常用客户端</th></tr></thead><tbody>
${clients.map(([os, app]) => `<tr><td>${esc(os)}</td><td>${esc(app)}</td></tr>`).join('')}
</tbody></table>
<p>同一份订阅可以在多台设备上导入，但同时在线数受节点配置限制。团队使用建议按人数分别购买。</p>

<h2>常见问题</h2>
${faqHtml(VPN_FAQ.map(([q, a]) => ({ q, a })))}
${m.tgUrl || m.wechatId ? `<h2>联系</h2><ul>${m.tgUrl ? `<li>Telegram：${esc(m.tgUrl)}</li>` : ''}${m.wechatId ? `<li>微信：${esc(m.wechatId)}</li>` : ''}</ul>` : ''}
<a class="seo-cta" href="/vpn">进入节点商城 →</a>
<div class="seo-foot">${esc(brand.name)} · 按流量计费 · 订阅式接入</div>
</div>`;

        const ld = [
            {
                '@context': 'https://schema.org',
                '@type': 'Service',
                name: `${brand.name} 全球安全节点`,
                serviceType: '安全网络接入服务',
                description: desc,
                provider: { '@type': 'Organization', name: brand.name, url: `${base}/` },
                areaServed: 'Worldwide',
                availableChannel: {
                    '@type': 'ServiceChannel',
                    serviceUrl: canonical,
                    servicePhone: undefined,
                },
                ...(hasNodes && minPricePerGb > 0 ? {
                    offers: {
                        '@type': 'Offer',
                        priceCurrency: 'CNY',
                        price: Number(minPricePerGb.toFixed(2)),
                        priceSpecification: {
                            '@type': 'UnitPriceSpecification',
                            price: Number(minPricePerGb.toFixed(2)),
                            priceCurrency: 'CNY',
                            unitText: '每 GB 流量',
                        },
                        availability: 'https://schema.org/InStock',
                        url: canonical,
                    },
                } : {}),
            },
            {
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: VPN_FAQ.map(([q, a]) => ({
                    '@type': 'Question', name: q,
                    acceptedAnswer: { '@type': 'Answer', text: a },
                })),
            },
            {
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: brand.name, item: `${base}/` },
                    { '@type': 'ListItem', position: 2, name: '全球安全节点', item: canonical },
                ],
            },
        ];

        const shell = readTemplate('main');
        if (!shell) return res.status(503).type('text/plain').send('building');
        const ldAll = ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');
        res.type('text/html; charset=utf-8')
            .set('Cache-Control', 'public, max-age=900')
            .send(injectIntoShell(shell, { head: headOf({ brand, title, desc, canonical, ld: ldAll }), body }));
    } catch (e) {
        console.error('[seo] /vpn 失败', e.message);
        res.status(500).type('text/plain').send('error');
    }
});

// ── GET /c/:slug（平台落地页）────────────────────────────────────────────
router.get('/c/:slug', async (req, res) => {
    try {
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        const label = labelOfSlug(req.params.slug);
        const plat = label ? catalog.platforms.find((p) => p.label === label) : null;
        if (!plat || !plat.count) {
            return res.status(404).type('text/html; charset=utf-8').send(
                `<!doctype html><meta charset="utf-8"><title>页面不存在</title><div style="font:16px system-ui;padding:40px">没有找到这个页面。<a href="/">回首页</a></div>`
            );
        }
        const platCn = PLATFORM_CN[plat.label] || plat.label;
        const cheapest = per1000(plat.minPrice);
        const canonical = `https://${brand.host}/c/${plat.slug}`;
        // 🔑 平台页标题要覆盖中文用户真实搜的那几个词（2026-11-08）：
        //   「涨粉」「买粉」「平台」「刷赞」—— 竞品标题都是「XX涨粉投流平台」
        //   「买粉平台」这种结构，我们原来写「增长服务」，一个都没打中。
        //   同时保留「粉丝/点赞/播放」这些名词，覆盖另一种搜法。
        const title = `${platCn} 涨粉平台 ${cheapest} 元起 · 粉丝/点赞/播放/评论 自助下单 · ${brand.name}`;
        const desc = `${brand.name} 的 ${platCn} 涨粉平台：${plat.count} 个服务覆盖粉丝、点赞、播放、评论、分享，${cheapest} 元起 / 1000 个，自助下单自动交付，不需要账号密码。`;
        const extra = copyOf(plat.label);
        const faq = faqOf(brand, platCn, plat).concat(extra ? extra.faq : []);

        // 平台专属内容：同一套模板下每个平台的正文都不一样（否则 15 个页面内容雷同）
        const deep = extra ? `<h2>这些指标分别是什么意思</h2>
<dl>${extra.metrics.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
<h2>什么情况下用得上</h2>
<ul>${extra.scenes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<h2>最容易踩的坑</h2>
<ul>${extra.pitfalls.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<h2>${esc(platCn)} 服务怎么选</h2>
<p>${esc(extra.choose)}</p>` : `<h2>${esc(platCn)} 服务怎么选</h2>
<p>按“数量 + 质量档位”选：量大、要求快的选高单价档；先小量测试再放量更稳。下单页会按你填的数量实时算出总价，不用自己换算。</p>`;

        const body = `<div class="seo-wrap">${styleBlock}
<h1>${esc(platCn)} 涨粉平台 · 粉丝/点赞/播放/评论 ${esc(cheapest)} 元起 · ${esc(brand.name)}</h1>
${extra ? `<p>${esc(extra.intro)}</p>` : ''}
<p>${esc(brand.name)} 是一个 ${esc(platCn)} 涨粉平台：现有 <b>${plat.count}</b> 个服务，覆盖涨粉（粉丝）、刷赞（点赞）、刷播放（播放量）、刷评论、刷分享，价格按每 1000 个计算，最低 <b>${cheapest} 元</b> 起。自助下单，提交后系统自动开始处理，不需要提供账号密码。</p>
${typeTable(platCn, plat.types)}
${(() => {
            const subs = plat.types
                .filter((x) => x.label !== 'Other' && typeCopyOf(x.label) && x.count >= 3)
                .map((x) => {
                    const xtc = typeCopyOf(x.label);
                    // 子页链接文字同样用动作词，内链锚文本也参与关键词相关性
                    const subAct = xtc.action || xtc.name;
                    return `<li><a href="/c/${plat.slug}/${xtc.slug}" style="color:#22d3ee">${esc(platCn)} ${esc(subAct)}服务</a>（${esc(xtc.name)}，${x.count} 个档位，${per1000(x.minPrice)} 元起）</li>`;
                });
            return subs.length ? `<h2>按${esc(platCn)}服务类型查看</h2>\n<ul>${subs.join('')}</ul>` : '';
        })()}
${platformSynonyms(platCn, plat.types)}
${deep}
<h2>常见问题</h2>
${faqHtml(faq)}
<h2>其他平台</h2>
${linksTo(brand, catalog.platforms, plat.slug)}
<a class="seo-cta" href="/order">去下单 →</a>
<div class="seo-foot">${esc(brand.name)} · 自动交付 · 在线充值</div>
</div>`;

        const shell = readTemplate(brand.isSubsite ? 'site' : 'main');
        if (!shell) return res.status(503).type('text/plain').send('building');
        const html = injectIntoShell(shell, {
            head: headOf({ brand, title, desc, canonical, ld: jsonLdOf(brand, canonical, { platCn, faq, types: plat.types }) }),
            body,
        });
        res.type('text/html; charset=utf-8').set('Cache-Control', 'public, max-age=600').send(html);
    } catch (e) {
        console.error('[seo] 落地页失败', e.message);
        res.status(500).type('text/plain').send('error');
    }
});

// ── GET /（首页 HTML 壳）─────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
    try {
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        const canonical = `https://${brand.host}/`;
        const top = [...catalog.platforms]
            .filter((p) => p.label !== 'Other')
            .sort((a, b) => prefIndex(a.label) - prefIndex(b.label))
            .slice(0, 6);
        const topNames = top.map((p) => PLATFORM_CN[p.label] || p.label).join('、');
        const cheapest = top.length ? per1000(Math.min(...top.map((p) => p.minPrice))) : '—';
        const title = brand.isSubsite
            ? `${brand.name} · 社媒增长服务（${topNames}）`
            : `${brand.name} - TikTok涨粉/IG涨粉/YouTube订阅 全网底价社媒增长平台`;
        const desc = `${brand.name} 提供 ${topNames} 等平台的粉丝、点赞、播放、评论增长服务，${cheapest} 元起 / 1000 个，自动交付，在线充值即用。`;
        const faq = faqOf(brand, top[0] ? (PLATFORM_CN[top[0].label] || top[0].label) : '社媒', top[0] || null);

        const rows = top.map((p) => `<tr><td><a href="/c/${p.slug}" style="color:#22d3ee">${esc(PLATFORM_CN[p.label] || p.label)}</a></td><td>¥${per1000(p.minPrice)} / 1000</td><td>${p.count} 个服务</td></tr>`).join('');
        const body = `<div class="seo-wrap">${styleBlock}
<h1>${esc(brand.name)} · 社媒增长服务</h1>
<p>${esc(brand.name)} 提供 ${esc(topNames)} 等平台的粉丝、点赞、播放、评论增长服务，最低 <b>${cheapest} 元</b> 起 / 1000 个，自动交付，在线充值即用。</p>
<h2>平台与起价</h2>
${rows ? `<table class="seo-table"><thead><tr><th>平台</th><th>起价</th><th>服务数</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
${linksTo(brand, catalog.platforms, '')}
<h2>常见问题</h2>
${faqHtml(faq)}
<a class="seo-cta" href="/order">去下单 →</a>
<div class="seo-foot">${esc(brand.name)} · 自动交付 · 在线充值</div>
</div>`;

        const shell = readTemplate(brand.isSubsite ? 'site' : 'main');
        if (!shell) return next();     // 还没构建好 → 交给后面的静态兜底
        // 语言互指：主站首页 ↔ /en。分站没有英文版，不声明。
        const hreflangs = brand.isSubsite ? [] : [
            { lang: 'zh-CN', href: `https://${brand.host}/` },
            { lang: 'en', href: `https://${brand.host}/en` },
            { lang: 'x-default', href: `https://${brand.host}/` },
        ];
        const html = injectIntoShell(shell, {
            head: headOf({ brand, title, desc, canonical, ld: jsonLdOf(brand, canonical, null), hreflangs }),
            body,
        });
        res.type('text/html; charset=utf-8').set('Cache-Control', 'public, max-age=300').send(html);
    } catch (e) {
        console.error('[seo] 首页壳失败', e.message);
        next();
    }
});

// ── /en 英文首页（服务端渲染）────────────────────────────────────────────
// 2026-11-08 实测：/en 之前只是 prerender 出来的 en.html —— <head> 里
// title/description/hreflang/JSON-LD 一应俱全，但 <body> 只有空的
// <div id="app">，正文约 599 字节、0 个 h1/h2。搜索引擎抓到的是
//「标题很漂亮、内容全空」的壳，全球英文用户实际上搜不到任何实质内容。
// 这里按中文首页同样的办法回填英文正文，复用同一份实时目录数据。
router.get('/en', async (req, res, next) => {
    try {
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        // 分站没有英文版，不生成（交给静态兜底，避免串站）
        if (brand.isSubsite) return next();
        const base = `https://${brand.host}`;
        const canonical = `${base}/en`;
        const top = [...catalog.platforms]
            .filter((p) => p.label !== 'Other')
            .sort((a, b) => prefIndex(a.label) - prefIndex(b.label))
            .slice(0, 6);
        const topNames = top.map((p) => p.label).join(', ');
        const cheapest = top.length ? per1000(Math.min(...top.map((p) => p.minPrice))) : '—';
        const title = `${brand.name} - Buy TikTok Followers & Social Media Growth | SMM Panel`;
        const desc = `${brand.name} is a social media growth panel for ${topNames} and more. Followers, likes, views and comments from ¥${cheapest} per 1,000, with automatic delivery and no account password required.`;

        const rows = top.map((p) => `<tr><td><a href="/c/${p.slug}" style="color:#22d3ee">${esc(p.label)}</a></td><td>¥${per1000(p.minPrice)} / 1,000</td><td>${p.count} services</td></tr>`).join('');
        // 英文页的平台内链（linksTo 输出中文名，这里另给一份英文的）
        const enLinks = catalog.platforms.filter((p) => p.label !== 'Other').slice(0, 10)
            .map((p) => `<a href="/c/${p.slug}">${esc(p.label)}</a>`).join('');
        const enLinksHtml = enLinks ? `<div class="seo-links">${enLinks}</div>` : '';

        // 英文 FAQ：给搜索引擎和 AI 一段可直接摘录的答案，不写无法验证的自夸
        const faq = [
            { q: 'How is pricing calculated?', a: `Every service is priced per 1,000 units. Enter the quantity you need and the order page shows the total before you submit. Prices start at ¥${cheapest} per 1,000 and vary by quality and delivery speed.` },
            { q: 'Do you need my account password?', a: 'No. Only a public profile link or username is required. We never ask for login credentials.' },
            { q: 'How does delivery start?', a: 'Orders are processed automatically after submission. We show the live status of each order in your order history, and unfinished orders are refunded.' },
            { q: 'Which platforms are supported?', a: `${topNames} and more. Each platform page lists the available service types and their minimum order quantities.` },
            { q: 'What if an order cannot be completed?', a: 'If an order is cancelled or only partially completed, the corresponding amount is credited back to your balance automatically. You can reuse it for a new order.' },
        ];

        const body = `<div class="seo-wrap">${styleBlock}
<h1>${esc(brand.name)} · Social Media Growth Panel</h1>
<p>${esc(brand.name)} provides followers, likes, views and comments for ${esc(topNames)} and more. Pricing starts at <b>¥${cheapest} per 1,000</b>, delivery is automatic, and no account password is required.</p>
<h2>Platforms and starting prices</h2>
${rows ? `<table class="seo-table"><thead><tr><th>Platform</th><th>Starting price</th><th>Services</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
${enLinksHtml}
<h2>How it works</h2>
<ol><li>Top up your balance.</li><li>Choose a service and paste your public profile link or username.</li><li>Enter the quantity and confirm the total shown before submitting.</li><li>Track delivery in your order history.</li></ol>
<h2>Frequently asked questions</h2>
${faqHtml(faq)}
<a class="seo-cta" href="/order">Start an order →</a>
<div class="seo-foot">${esc(brand.name)} · automatic delivery · pay as you go</div>
</div>`;

        // 英文页用 SoftwareApplication + Organization 双实体，语言标 en
        const ld = [
            { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: brand.name, url: canonical, applicationCategory: 'BusinessApplication', operatingSystem: 'Web Application', inLanguage: 'en', description: desc, offers: { '@type': 'Offer', price: cheapest, priceCurrency: 'CNY' } },
            { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        ].map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');

        const shell = readTemplate('en');
        if (!shell) return next();     // en.html 还没构建 → 静态兜底
        const html = injectIntoShell(shell, {
            head: headOf({
                brand, title, desc, canonical, ld,
                locale: 'en_US',
                ogImageAlt: `${brand.name} social media growth panel`,
                hreflangs: [
                    { lang: 'zh-CN', href: `${base}/` },
                    { lang: 'en', href: `${base}/en` },
                    { lang: 'x-default', href: `${base}/` },
                ],
            }),
            body,
        });
        res.type('text/html; charset=utf-8').set('Cache-Control', 'public, max-age=300').send(html);
    } catch (e) {
        console.error('[seo] /en 首页壳失败', e.message);
        next();
    }
});

// ── /price 全平台价格总览（中/英）────────────────────────────────────────
// 2026-11-08 加。为什么值得单独一页：
//   `smm panel price list` / `cheapest smm panel` / `tiktok followers price per 1000`
//   是高购买意图的商用词，而**多数同行不公开价格**（要注册才看）。
//   我们本来就按「每 1000 个」明码标价，把价格摊开就是天然优势，
//   而且这页的数据全部来自实时目录，价格变了自动跟着变，不会过期。
//   同时给 AI 引擎一段可直接摘录的「价目表 + 计价规则」，这是 GEO 最有效的形态。
const pricePageOf = (brand, catalog, lang) => {
    const en = lang === 'en';
    const base = `https://${brand.host}`;
    const ordered = [...catalog.platforms]
        .filter((p) => p.label !== 'Other' && p.count > 0)
        .sort((a, b) => prefIndex(a.label) - prefIndex(b.label));
    const cheapest = ordered.length ? per1000(Math.min(...ordered.map((p) => p.minPrice))) : '—';
    const total = catalog.totalServices || 0;

    // 全平台价目表：平台 / 起价 / 服务数 / 支持类型
    // ⚠️ 过滤掉类型里的「其他」——上游脏分类的兜底桶，写进价格表既没搜索词也不专业。
    const rows = ordered.map((p) => {
        const types = (p.types || [])
            .filter((t) => t.label && t.label !== '其他' && t.label !== 'Other')
            .slice(0, 6).map((t) => t.label).join(' / ');
        return `<tr><td><a href="/c/${p.slug}" style="color:#22d3ee">${esc(p.label)}</a></td><td>¥${per1000(p.minPrice)}</td><td>${p.count}</td><td>${esc(types)}</td></tr>`;
    }).join('');

    const faq = en
        ? [
            { q: 'What is the cheapest service you offer?', a: `The lowest starting price is ¥${cheapest} per 1,000 units. Prices differ by platform, quality tier and delivery speed; the order page shows the exact total before you submit.` },
            { q: 'Is there a minimum order quantity?', a: 'Yes. Each service has its own minimum, usually between 100 and 1,000 units. The minimum is shown next to each service on the order page.' },
            { q: 'Do prices change?', a: 'This page is generated from the live service catalog, so the figures shown are current. Prices may change as tiers are added or updated.' },
            { q: 'Are there hidden fees?', a: 'No. The price per 1,000 units is the price you pay, and the order page shows the total before you submit. There is no separate service charge.' },
        ]
        : [
            { q: '最便宜的服务是多少钱？', a: `当前最低起价是 ¥${cheapest} / 1000 个。不同平台、不同质量档位、不同速度的价格不同，下单页会在提交前显示准确总价。` },
            { q: '有最低下单数量吗？', a: '有。每个服务有各自的最低数量，通常在 100–1000 个之间，具体数字在下单页该服务旁标注。' },
            { q: '价格会变吗？', a: '本页数据直接来自实时服务目录，显示的就是当前价格。档位新增或调整时价格会随之变化。' },
            { q: '有没有隐藏费用？', a: '没有。标价就是实际单价，下单页会在提交前显示总价，不额外收取服务费。' },
        ];

    const title = en
        ? `${brand.name} Price List - All Platforms from ¥${cheapest} per 1,000`
        : `${brand.name} 价格表 · 全平台 ${cheapest} 元起 / 1000 个`;
    const desc = en
        ? `Full price list for ${brand.name}: starting price per 1,000 units for ${ordered.slice(0, 6).map((p) => p.label).join(', ')} and more. ${total} services in total, prices shown before you order.`
        : `${brand.name} 全平台价格表：${ordered.slice(0, 6).map((p) => PLATFORM_CN[p.label] || p.label).join('、')} 等平台的每 1000 个起价一览，共 ${total} 个服务，下单前即可看到准确总价。`;

    const body = `<div class="seo-wrap">${styleBlock}
<h1>${en ? `${esc(brand.name)} · Price List` : `${esc(brand.name)} · 全平台价格表`}</h1>
<p>${en
            ? `All services are priced per 1,000 units. The lowest starting price is <b>¥${cheapest}</b>. There are currently <b>${total}</b> services across ${ordered.length} platforms. The exact total is shown on the order page before you submit.`
            : `所有服务均按「每 1000 个」计价，最低 <b>${cheapest} 元</b> 起。当前共 <b>${total}</b> 个服务，覆盖 ${ordered.length} 个平台。下单页会在提交前显示准确总价。`}</p>
<h2>${en ? 'Starting price by platform' : '各平台起价一览'}</h2>
<table class="seo-table"><thead><tr>
<th>${en ? 'Platform' : '平台'}</th><th>${en ? 'From (per 1,000)' : '起价 / 1000'}</th><th>${en ? 'Services' : '服务数'}</th><th>${en ? 'Types' : '支持类型'}</th>
</tr></thead><tbody>${rows}</tbody></table>
<h2>${en ? 'How pricing works' : '计价规则'}</h2>
<ol>
<li>${en ? 'Every service is quoted per 1,000 units, so the unit price does not change with quantity.' : '每个服务都按「每 1000 个」报价，单价不随数量变化。'}</li>
<li>${en ? 'Enter the quantity you need; the order page multiplies it by the unit price and shows the total.' : '填入需要的数量，下单页按单价换算并显示总价。'}</li>
<li>${en ? 'Higher quality tiers and faster delivery cost more; the cheapest tier is listed here.' : '质量档位越高、速度越快价格越高；本页列出的是各平台最低档起价。'}</li>
<li>${en ? 'If an order is cancelled or partially completed, the corresponding amount returns to your balance.' : '订单被取消或部分完成时，对应金额自动退回余额。'}</li>
</ol>
${en ? '' : linksTo(brand, catalog.platforms, '')}
<h2>${en ? 'Frequently asked questions' : '常见问题'}</h2>
${faqHtml(faq)}
<a class="seo-cta" href="/order">${en ? 'Start an order →' : '去下单 →'}</a>
<div class="seo-foot">${esc(brand.name)} · ${en ? 'automatic delivery · pay as you go' : '自动交付 · 在线充值即用'}</div>
</div>`;

    const canonical = `${base}/price`;
    const zh = `${base}/price`;
    const enUrl = `${base}/en/price`;
    const ld = [
        {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: en ? `${brand.name} price list` : `${brand.name} 价格表`,
            numberOfItems: ordered.length,
            itemListElement: ordered.slice(0, 20).map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: `${p.label} - ¥${per1000(p.minPrice)} / 1000`,
                url: `${base}/c/${p.slug}`,
            })),
        },
        {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        },
    ].map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');

    return {
        title, desc, body, canonical, ld,
        hreflangs: [
            { lang: 'zh-CN', href: zh },
            { lang: 'en', href: enUrl },
            { lang: 'x-default', href: zh },
        ],
    };
};

router.get('/price', async (req, res, next) => {
    try {
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        const page = pricePageOf(brand, catalog, 'zh');
        const shell = readTemplate(brand.isSubsite ? 'site' : 'main');
        if (!shell) return next();
        const html = injectIntoShell(shell, {
            head: headOf({ brand, title: page.title, desc: page.desc, canonical: page.canonical, ld: page.ld, hreflangs: page.hreflangs }),
            body: page.body,
        });
        res.type('text/html; charset=utf-8').set('Cache-Control', 'public, max-age=300').send(html);
    } catch (e) {
        console.error('[seo] /price 失败', e.message);
        next();
    }
});

router.get('/en/price', async (req, res, next) => {
    try {
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        if (brand.isSubsite) return next();
        const page = pricePageOf(brand, catalog, 'en');
        const shell = readTemplate('en');
        if (!shell) return next();
        const html = injectIntoShell(shell, {
            head: headOf({ brand, title: page.title, desc: page.desc, canonical: page.canonical, ld: page.ld, locale: 'en_US', ogImageAlt: `${brand.name} price list`, hreflangs: page.hreflangs }),
            body: page.body,
        });
        res.type('text/html; charset=utf-8').set('Cache-Control', 'public, max-age=300').send(html);
    } catch (e) {
        console.error('[seo] /en/price 失败', e.message);
        next();
    }
});

// ── 多语种落地页（id / pt，2026-11-08）───────────────────────────────────
// 为什么做：`jasa follower tiktok`（印尼）、`comprar seguidores tiktok`（巴西）
// 这类本地语言搜索词，竞争几乎为零 —— 全球 SMM 站绝大多数只做英文。
// 这是唯一「站内就能完成、且几周内可能见效」的获客路径。
//
// 结构：/{lang}  首页、/{lang}/price 价格表、/{lang}/c/{slug} 平台页。
// 渲染逻辑与中文/英文版**共用同一份** loadCatalog / headOf / injectIntoShell，
// 文案差异全部落在 utils/langCopy.js，这里只做组装，避免又多两份重复代码。
const langPathOf = (lang, suffix = '') => `${LANGS[lang].path}${suffix}`;

/** 各语种的完整 hreflang 集合（所有语言互指，x-default 指向中文首页） */
const hreflangsFor = (base, suffix = '') => LANG_ORDER.map((l) => ({
    lang: LANGS[l].code, href: `${base}${LANGS[l].path}${suffix}`,
})).concat([{ lang: 'x-default', href: `${base}/` }]);

/** 把 SSR 出来的 <html> 开标签改成目标语种，并按需加 dir="rtl" */
const setHtmlLang = (html, code, dir = 'ltr') => {
    // ⚠️ 直接替换整个 <html ...> 开标签，不要用「往 lang 前面插 dir」的正则 ——
    //    index.html 里是 <html lang="zh-CN">，没有别的属性，那种正则匹配不到，
    //    结果 dir 静默丢失、阿拉伯语按 LTR 排版（第一版就踩了这个坑）。
    return html.replace(/<html\b[^>]*>/i, () => `<html lang="${code}"${dir === 'rtl' ? ' dir="rtl"' : ''}>`);
};

/** 语言切换器：放在正文尾部，方便用户和爬虫发现其它语种版本 */
const langSwitcher = (base, suffix = '') => {
    const items = LANG_ORDER.map((l) => {
        const name = {
            zh: '中文', en: 'English', id: 'Bahasa Indonesia', pt: 'Português',
            vi: 'Tiếng Việt', ar: 'العربية', ru: 'Русский',
        }[l];
        return `<a href="${base}${LANGS[l].path}${suffix}" hreflang="${LANGS[l].code}">${name}</a>`;
    }).join(' · ');
    return `<div class="seo-links">${items}</div>`;
};

/** 生成某语种的「首页」正文 */
const langHomeBody = (lang, brand, catalog, base) => {
    const c = copyOfLang(lang).home;
    const ordered = [...catalog.platforms].filter((p) => p.label !== 'Other' && p.count > 0)
        .sort((a, b) => prefIndex(a.label) - prefIndex(b.label));
    const top = ordered.slice(0, 8);
    const names = top.map((p) => p.label).join(', ');
    const cheapest = ordered.length ? per1000(Math.min(...ordered.map((p) => p.minPrice))) : '—';
    const total = catalog.totalServices || 0;
    const rows = top.map((p) => `<tr><td><a href="${langPathOf(lang, `/c/${p.slug}`)}" style="color:#22d3ee">${esc(p.label)}</a></td><td>¥${per1000(p.minPrice)}</td><td>${p.count}</td></tr>`).join('');
    const faq = c.faq(cheapest, total);
    const body = `<div class="seo-wrap">${styleBlock}
<h1>${esc(c.h1(brand.name))}</h1>
<p>${c.lede(esc(brand.name), esc(names), cheapest)}</p>
<h2>${esc(c.platformsHead)}</h2>
<table class="seo-table"><thead><tr><th>${esc(c.thPlatform)}</th><th>${esc(c.thFrom)}</th><th>${esc(c.thServices)}</th></tr></thead><tbody>${rows}</tbody></table>
<h2>${esc(c.faqHead)}</h2>
${faqHtml(faq)}
${langSwitcher(base)}
<a class="seo-cta" href="/order">${esc(c.cta)}</a>
<div class="seo-foot">${esc(c.foot(brand.name))}</div>
</div>`;
    const ld = [
        { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: brand.name, url: `${base}${langPathOf(lang)}`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web Application', inLanguage: LANGS[lang].code, description: c.lede(brand.name, names, cheapest).replace(/<[^>]*>/g, '') },
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ].map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');
    return {
        title: c.title(brand.name), desc: c.lede(brand.name, names, cheapest).replace(/<[^>]*>/g, ''), body, ld,
        canonical: `${base}${langPathOf(lang)}`,
    };
};

/** 生成某语种的「价格表」正文 */
const langPriceBody = (lang, brand, catalog, base) => {
    const c = copyOfLang(lang).price;
    const ordered = [...catalog.platforms].filter((p) => p.label !== 'Other' && p.count > 0)
        .sort((a, b) => prefIndex(a.label) - prefIndex(b.label));
    const cheapest = ordered.length ? per1000(Math.min(...ordered.map((p) => p.minPrice))) : '—';
    const total = catalog.totalServices || 0;
    const rows = ordered.map((p) => {
        const types = (p.types || []).filter((t) => t.label && t.label !== '其他' && t.label !== 'Other')
            .slice(0, 6).map((t) => typeLabelOf(lang, t.label)).join(' / ');
        return `<tr><td><a href="${langPathOf(lang, `/c/${p.slug}`)}" style="color:#22d3ee">${esc(p.label)}</a></td><td>¥${per1000(p.minPrice)}</td><td>${p.count}</td><td>${esc(types)}</td></tr>`;
    }).join('');
    const body = `<div class="seo-wrap">${styleBlock}
<h1>${esc(c.h1(brand.name))}</h1>
<p>${c.lede(esc(brand.name), cheapest, total, ordered.length)}</p>
<h2>${esc(c.tableHead)}</h2>
<table class="seo-table"><thead><tr><th>${esc(c.thPlatform)}</th><th>${esc(c.thFrom)}</th><th>${esc(c.thServices)}</th><th>${esc(c.thTypes)}</th></tr></thead><tbody>${rows}</tbody></table>
<h2>${esc(c.rulesHead)}</h2>
<ol>${c.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
${langSwitcher(base, '/price')}
<a class="seo-cta" href="/order">${esc(c.cta)}</a>
<div class="seo-foot">${esc(c.foot(brand.name))}</div>
</div>`;
    const ld = [
        { '@context': 'https://schema.org', '@type': 'ItemList', name: c.h1(brand.name), numberOfItems: ordered.length, itemListElement: ordered.slice(0, 20).map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: `${p.label} - ¥${per1000(p.minPrice)} / 1000`, url: `${base}${langPathOf(lang, `/c/${p.slug}`)}` })) },
    ].map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');
    return {
        title: c.title(brand.name, cheapest),
        desc: c.lede(brand.name, cheapest, total, ordered.length).replace(/<[^>]*>/g, ''),
        body, ld, canonical: `${base}${langPathOf(lang)}/price`,
    };
};

/** 生成某语种的「平台页」正文 */
const langPlatBody = (lang, brand, catalog, plat, base) => {
    const c = copyOfLang(lang).plat;
    const syn = copyOfLang(lang).synonyms || {};
    const cheapest = per1000(plat.minPrice);
    const typeRows = (plat.types || []).filter((t) => t.label !== '其他' && t.label !== 'Other').map((t) => {
        const qty = (t.minQty > 0 && isFinite(t.minQty)) ? `${t.minQty}` : '—';
        return `<tr><td>${esc(typeLabelOf(lang, t.label))}</td><td>¥${per1000(t.minPrice)}</td><td>${t.count}</td><td>${esc(qty)}</td></tr>`;
    }).join('');
    const faq = copyOfLang(lang).home.faq(cheapest, catalog.totalServices || 0).slice(0, 4);
    const otherLinks = catalog.platforms.filter((p) => p.label !== 'Other' && p.slug !== plat.slug)
        .slice(0, 10).map((p) => `<a href="${langPathOf(lang, `/c/${p.slug}`)}">${esc(p.label)}</a>`).join('');

    // 同义词区块（2026-11-08）：各语种用户对同一服务的叫法差别很大，
    // 标题只放最主流的两个，其余靠这一节承接长尾搜索。
    // 按类型分组列出，读者能对号入座，搜索引擎也能匹配到具体词。
    const SYN_LABEL = {
        id: { head: 'Istilah lain yang sering dipakai', intro: (p) => `Orang menyebut layanan ${p} ini dengan banyak cara. Semuanya merujuk ke hal yang sama:` , typeNames: null },
        pt: { head: 'Outros nomes para os mesmos serviços', intro: (p) => `As pessoas chamam esses serviços de ${p} de várias formas. Todos significam a mesma coisa:` },
        vi: { head: 'Các cách gọi khác của cùng dịch vụ', intro: (p) => `Mọi người gọi các dịch vụ ${p} này theo nhiều cách. Tất cả đều là cùng một loại:` },
        ar: { head: 'أسماء أخرى لنفس الخدمات', intro: (p) => `يسمي الناس خدمات ${p} هذه بأشكال مختلفة. كلها تعني الشيء نفسه:` },
        ru: { head: 'Другие названия этих услуг', intro: (p) => `Эти услуги для ${p} называют по-разному. Всё это означает одно и то же:` },
    };
    const sl = SYN_LABEL[lang];
    let synBlock = '';
    if (sl && Object.keys(syn).length) {
        const KEYMAP = { '订阅': 'subscribers', '粉丝': 'fans', '点赞': 'likes', '播放': 'views', '评论': 'comments', '分享': 'shares', '直播': 'live', '流量': 'traffic' };
        const items = [];
        for (const t of plat.types || []) {
            const k = KEYMAP[String(t.label || '').trim()];
            const words = k && syn[k];
            if (!words || !words.length) continue;
            items.push(`<li><b>${esc(typeLabelOf(lang, t.label))}</b>: ${words.map((w) => esc(w)).join(' · ')}</li>`);
        }
        if (items.length) {
            synBlock = `<h2>${esc(sl.head)}</h2>
<p>${esc(sl.intro(plat.label))}</p>
<ul>${items.join('')}</ul>`;
        }
    }

    const body = `<div class="seo-wrap">${styleBlock}
<h1>${esc(c.h1(brand.name, plat.label))}</h1>
<p>${c.lede(esc(brand.name), esc(plat.label), plat.count, cheapest)}</p>
<h2>${esc(c.typeTable)}</h2>
<table class="seo-table"><thead><tr><th>${esc(c.typeHead)}</th><th>${esc(c.fromHead)}</th><th>${esc(c.thCount)}</th><th>${esc(c.thMinQty)}</th></tr></thead><tbody>${typeRows}</tbody></table>
${synBlock}
<h2>${esc(c.howToChoose(plat.label))}</h2>
<p>${esc(c.howToChooseText)}</p>
<h2>${esc(c.faqHead)}</h2>
${faqHtml(faq)}
<h2>${esc(c.otherHead)}</h2>
<div class="seo-links">${otherLinks}</div>
${langSwitcher(base, `/c/${plat.slug}`)}
<a class="seo-cta" href="/order">${esc(c.cta)}</a>
<div class="seo-foot">${esc(c.foot(brand.name))}</div>
</div>`;
    const ld = [
        { '@context': 'https://schema.org', '@type': 'Service', name: `${plat.label} growth services`, provider: { '@type': 'Organization', name: brand.name, url: `${base}/` }, areaServed: 'Worldwide', offers: { '@type': 'Offer', price: cheapest, priceCurrency: 'CNY' } },
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ].map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');
    return {
        title: c.title(brand.name, plat.label, cheapest),
        desc: c.lede(brand.name, plat.label, plat.count, cheapest).replace(/<[^>]*>/g, ''),
        body, ld, canonical: `${base}${langPathOf(lang)}/c/${plat.slug}`,
    };
};

/** 统一的语种页渲染出口 */
const renderLangPage = async (req, res, next, lang, kind, slug) => {
    try {
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        if (brand.isSubsite) return next();          // 分站不出多语种页，避免串站
        const base = `https://${brand.host}`;
        let page;
        if (kind === 'home') page = langHomeBody(lang, brand, catalog, base);
        else if (kind === 'price') page = langPriceBody(lang, brand, catalog, base);
        else {
            const label = labelOfSlug(slug);
            const plat = label ? catalog.platforms.find((p) => p.label === label) : null;
            if (!plat || !plat.count) return res.status(404).type('text/plain').send('Not found');
            page = langPlatBody(lang, brand, catalog, plat, base);
        }
        const shell = readTemplate('main');
        if (!shell) return res.status(503).type('text/plain').send('building');
        const html = setHtmlLang(injectIntoShell(shell, {
            head: headOf({
                brand, title: page.title, desc: page.desc, canonical: page.canonical, ld: page.ld,
                locale: LANGS[lang].locale,
                ogImageAlt: `${brand.name}`,
                hreflangs: hreflangsFor(base, kind === 'price' ? '/price' : kind === 'plat' ? `/c/${slug}` : ''),
            }),
            body: page.body,
        }), LANGS[lang].code, LANGS[lang].dir);
        res.type('text/html; charset=utf-8').set('Cache-Control', 'public, max-age=600').send(html);
    } catch (e) {
        console.error(`[seo] /${lang} ${kind} 失败`, e.message);
        next();
    }
};

// 印尼语
router.get('/id', (req, res, next) => renderLangPage(req, res, next, 'id', 'home'));
router.get('/id/price', (req, res, next) => renderLangPage(req, res, next, 'id', 'price'));
router.get('/id/c/:slug', (req, res, next) => renderLangPage(req, res, next, 'id', 'plat', req.params.slug));
// 巴西葡语
router.get('/pt', (req, res, next) => renderLangPage(req, res, next, 'pt', 'home'));
router.get('/pt/price', (req, res, next) => renderLangPage(req, res, next, 'pt', 'price'));
router.get('/pt/c/:slug', (req, res, next) => renderLangPage(req, res, next, 'pt', 'plat', req.params.slug));
// 越南语
router.get('/vi', (req, res, next) => renderLangPage(req, res, next, 'vi', 'home'));
router.get('/vi/price', (req, res, next) => renderLangPage(req, res, next, 'vi', 'price'));
router.get('/vi/c/:slug', (req, res, next) => renderLangPage(req, res, next, 'vi', 'plat', req.params.slug));
// 阿拉伯语（RTL）
router.get('/ar', (req, res, next) => renderLangPage(req, res, next, 'ar', 'home'));
router.get('/ar/price', (req, res, next) => renderLangPage(req, res, next, 'ar', 'price'));
router.get('/ar/c/:slug', (req, res, next) => renderLangPage(req, res, next, 'ar', 'plat', req.params.slug));
// 俄语
router.get('/ru', (req, res, next) => renderLangPage(req, res, next, 'ru', 'home'));
router.get('/ru/price', (req, res, next) => renderLangPage(req, res, next, 'ru', 'price'));
router.get('/ru/c/:slug', (req, res, next) => renderLangPage(req, res, next, 'ru', 'plat', req.params.slug));
// 英文平台页（2026-11-08）：之前 /en/c/:slug 是 404，但 hreflang 簇里要指它，
// 且英文用户搜 "tiktok followers" 时应落到平台页。复用同一套渲染器。
router.get('/en/c/:slug', async (req, res, next) => {
    try {
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        if (brand.isSubsite) return next();
        const label = labelOfSlug(req.params.slug);
        const plat = label ? catalog.platforms.find((p) => p.label === label) : null;
        if (!plat || !plat.count) return next();      // 没有就走静态兜底 → 404
        const base = `https://${brand.host}`;
        const cheapest = per1000(plat.minPrice);
        const typeRows = (plat.types || []).filter((t) => t.label !== '其他' && t.label !== 'Other').map((t) => {
            const qty = (t.minQty > 0 && isFinite(t.minQty)) ? `${t.minQty}` : '—';
            return `<tr><td>${esc(t.label)}</td><td>¥${per1000(t.minPrice)}</td><td>${t.count}</td><td>${esc(qty)}</td></tr>`;
        }).join('');
        const faqs = [
            { q: `How much do ${plat.label} services cost?`, a: `Prices start at ¥${cheapest} per 1,000 units. There are currently ${plat.count} ${plat.label} services available, and the exact total is shown on the order page before you submit.` },
            { q: `Do I need to provide my ${plat.label} password?`, a: 'No. Only a public profile link or username is required. We never ask for login credentials.' },
            { q: 'How fast does delivery start?', a: 'Orders are processed automatically after submission. You can track each order in your order history.' },
            { q: 'What happens if an order is not completed?', a: 'If an order is cancelled or only partially completed, the corresponding amount is credited back to your balance automatically.' },
        ];
        const otherLinks = catalog.platforms.filter((p) => p.label !== 'Other' && p.slug !== plat.slug)
            .slice(0, 10).map((p) => `<a href="/en/c/${p.slug}">${esc(p.label)}</a>`).join('');
        const body = `<div class="seo-wrap">${styleBlock}
<h1>Buy ${esc(plat.label)} Followers, Likes &amp; Views · ${esc(brand.name)}</h1>
<p>${esc(brand.name)} has <b>${plat.count}</b> ${esc(plat.label)} services: followers, likes, views, comments and more. Priced per 1,000 units from <b>¥${cheapest}</b>, processed automatically after you submit.</p>
<h2>Service types</h2>
<table class="seo-table"><thead><tr><th>Type</th><th>From</th><th>Options</th><th>Minimum</th></tr></thead><tbody>${typeRows}</tbody></table>
<h2>How to choose ${esc(plat.label)} services</h2>
<p>Choose by volume and quality tier: for large volume with fast results, take a higher-priced tier; test a small quantity before scaling up. The order page shows the total as you type the quantity.</p>
<h2>Frequently asked questions</h2>
${faqHtml(faqs)}
<h2>Other platforms</h2>
<div class="seo-links">${otherLinks}</div>
<a class="seo-cta" href="/order">Start an order →</a>
<div class="seo-foot">${esc(brand.name)} · automatic delivery</div>
</div>`;
        const canonical = `${base}/en/c/${plat.slug}`;
        const ld = [
            { '@context': 'https://schema.org', '@type': 'Service', name: `${plat.label} growth services`, provider: { '@type': 'Organization', name: brand.name, url: `${base}/` }, areaServed: 'Worldwide', offers: { '@type': 'Offer', price: cheapest, priceCurrency: 'CNY' } },
            { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        ].map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');
        const shell = readTemplate('en');
        if (!shell) return next();
        const html = injectIntoShell(shell, {
            head: headOf({
                // 🔑 英文用户搜的是「buy tiktok followers」「tiktok smm panel」，
                //   不是「TikTok Growth Services」。标题以 Buy 开头 + 带 SMM Panel。
                brand, title: `Buy ${plat.label} Followers & Likes from ¥${cheapest} | SMM Panel · ${brand.name}`,
                desc: `Buy ${plat.label} followers, likes, views and comments from ¥${cheapest} per 1,000. ${plat.count} services, automatic delivery, no password required. Cheapest SMM panel pricing, published openly.`,
                canonical, ld, locale: 'en_US', ogImageAlt: `${brand.name} ${plat.label}`,
                hreflangs: [
                    { lang: 'zh-CN', href: `${base}/c/${plat.slug}` },
                    { lang: 'en', href: `${base}/en/c/${plat.slug}` },
                    { lang: 'id', href: `${base}/id/c/${plat.slug}` },
                    { lang: 'pt-BR', href: `${base}/pt/c/${plat.slug}` },
                    { lang: 'x-default', href: `${base}/c/${plat.slug}` },
                ],
            }),
            body,
        });
        res.type('text/html; charset=utf-8').set('Cache-Control', 'public, max-age=600').send(html);
    } catch (e) {
        console.error('[seo] /en/c 失败', e.message);
        next();
    }
});

export default router;
