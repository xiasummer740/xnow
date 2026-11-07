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
import { ARTICLES, articleOf } from '../utils/guideCopy.js';

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
    const file = path.join(DIST, kind === 'site' ? 'site.html' : 'index.html');
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
        out = out.replace(/(<div id=["']app["'][^>]*>)([\s\S]*?)(<\/div>)/i, (m, a, _b, c) => a + body + c);
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

const headOf = ({ brand, title, desc, canonical, ld, hreflangs }) => `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${esc(canonical)}" />
${(hreflangs || []).map((h) => `<link rel="alternate" hreflang="${esc(h.lang)}" href="${esc(h.href)}" />`).join('\n')}
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:site_name" content="${esc(brand.name)}" />
<meta property="og:image" content="https://${esc(brand.host)}/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(brand.name)} · 社媒增长服务" />
<meta property="og:locale" content="zh_CN" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://${esc(brand.host)}/og.png" />
${ld}`;

const styleBlock = `<style>
.seo-wrap{max-width:820px;margin:0 auto;padding:28px 20px 60px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#e2e8f0;line-height:1.75}
.seo-wrap h1{font-size:26px;line-height:1.35;margin:0 0 12px;font-weight:800}
.seo-wrap h2{font-size:17px;margin:26px 0 8px;font-weight:700}
.seo-wrap p{margin:8px 0;color:#cbd5e1}
.seo-wrap ul{margin:8px 0 8px 20px;color:#cbd5e1}
.seo-wrap li{margin:4px 0}
.seo-wrap dl{margin:10px 0}
.seo-wrap dt{font-weight:700;color:#e2e8f0;margin-top:12px}
.seo-wrap dd{margin:2px 0 0;color:#cbd5e1}
.seo-table{width:100%;border-collapse:collapse;margin:10px 0;font-size:14px}
.seo-table th,.seo-table td{border-bottom:1px solid #334155;padding:8px 6px;text-align:left}
.seo-table th{color:#94a3b8;font-weight:600;font-size:13px}
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
        // 语言互指（hreflang）：主站的首页和中英文页互为 alternate。
        // 之前完全不声明，导致 /en 做了内容却永远进不了英文索引。
        const ALT_ZH_EN = [
            { lang: 'zh-CN', href: `${base}/` },
            { lang: 'en', href: `${base}/en` },
            { lang: 'x-default', href: `${base}/` },
        ];
        const urls = brand.isSubsite
            ? [{ loc: `${base}/`, pri: '1.0' }]
            : [
                { loc: `${base}/`, pri: '1.0', alt: ALT_ZH_EN },
                { loc: `${base}/en`, pri: '0.9', alt: ALT_ZH_EN },
            ];
        const ordered = [...catalog.platforms].sort((a, b) => prefIndex(a.label) - prefIndex(b.label));
        for (const p of ordered) {
            if (!p.count) continue;
            // 「其他」是兜底分类（上游脏分类全归到这里），不是真平台：
            // 拿它做落地页既没有搜索词，内容也杂，不放进 sitemap。
            if (p.label === 'Other') continue;
            urls.push({ loc: `${base}/c/${p.slug}`, pri: p === ordered[0] ? '0.9' : '0.8' });
            // 类型子页（平台 × 服务类型）。档位太少的不进 sitemap —— 内容撑不起来。
            for (const t of p.types) {
                const tc = typeCopyOf(t.label);
                if (tc && t.count >= 3) {
                    urls.push({ loc: `${base}/c/${p.slug}/${tc.slug}`, pri: '0.7' });
                }
            }
        }
        // 知识库：拿问答词，页面数 +1 列表 +N 篇
        urls.push({ loc: `${base}/guide`, pri: '0.8' });
        for (const a of ARTICLES) {
            urls.push({ loc: `${base}/guide/${a.slug}`, pri: '0.7' });
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
        L.push(`- [英文版](${base}/en)：English version`);
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
        const title = `${platCn} ${tc.name}服务 ${cheapest} 元起 · ${brand.name}`;
        const desc = `${brand.name} 的 ${platCn} ${tc.name}服务：${t.count} 个档位可选，${cheapest} 元起 / 1000 个。${t.minQty > 0 ? `单次 ${t.minQty}–${t.maxQty} 个，` : ''}提交订单后自动开始处理，不需要账号密码。`;
        const pc = copyOf(plat.label);

        const qty = t.minQty > 0 ? `${t.minQty}–${t.maxQty}` : '按需';
        const rows = `<table class="seo-table"><thead><tr><th>档位</th><th>起价 / 1000 个</th><th>服务数</th></tr></thead>
<tbody><tr><td>${esc(platCn)} ${esc(tc.name)}</td><td>¥${cheapest}</td><td>${t.count} 个</td></tr></tbody></table>`;

        const body = `<div class="seo-wrap">${styleBlock}
<nav style="font-size:13px;color:#94a3b8;margin-bottom:10px">
<a href="/" style="color:#22d3ee">首页</a> › <a href="/c/${plat.slug}" style="color:#22d3ee">${esc(platCn)}</a> › ${esc(tc.name)}
</nav>
<h1>${esc(platCn)} ${esc(tc.name)}服务 · ${esc(brand.name)}</h1>
<p>${esc(tc.intro)}</p>
<p>${esc(brand.name)} 现有 <b>${t.count}</b> 个 ${esc(platCn)} ${esc(tc.name)}档位，最低 <b>${cheapest} 元</b> / 1000 个，单次数量 ${esc(qty)}，提交订单后系统自动开始处理。</p>
${rows}
<h2>${esc(tc.name)}类指标分别是什么意思</h2>
<dl>${tc.metrics.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
<h2>什么情况下需要${esc(tc.name)}</h2>
<ul>${tc.scenes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<h2>最容易踩的坑</h2>
<ul>${tc.pitfalls.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
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
const mdInline = (s) => esc(s).replace(/`([^`]+)`/g, '<code style="background:#152036;padding:1px 5px;border-radius:4px;font-size:.92em">$1</code>');

const guideBody = (a) => a.body.map(([h, p]) => `<h2>${esc(h)}</h2>\n<p>${mdInline(p)}</p>`).join('\n');

// 正文本身就是「小标题 + 说明」，前两段直接做成 FAQ 结构化数据
const guideFaqLd = (a) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: a.body.slice(0, 4).map(([h, p]) => ({
        '@type': 'Question',
        name: h,
        acceptedAnswer: { '@type': 'Answer', text: p.replace(/`/g, '') },
    })),
});

router.get('/guide', async (req, res) => {
    try {
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        const base = `https://${brand.host}`;
        const canonical = `${base}/guide`;
        const title = `社媒增长知识库 · 下单前必看的 ${ARTICLES.length} 个问题 · ${brand.name}`;
        const desc = `涨粉会不会掉、为什么必须填主页链接、档位怎么选、直播间场观和在线人数有什么区别 —— ${ARTICLES.length} 篇实操说明，下单前先看一遍能避开大部分失败原因。`;

        const cards = ARTICLES.map((a) => `<li style="margin:14px 0">
<a href="/guide/${a.slug}" style="color:#22d3ee;font-weight:700;font-size:16px">${esc(a.title)}</a>
<div style="color:#94a3b8;font-size:14px;margin-top:4px">${esc(a.desc)}</div>
<div style="color:#64748b;font-size:12px;margin-top:4px">${esc(a.tag)} · 更新于 ${esc(a.updated)}</div>
</li>`).join('');

        const body = `<div class="seo-wrap">${styleBlock}
<h1>社媒增长知识库</h1>
<p>下单前先看这几篇。都是实际遇到的问题 —— 填错链接、重复下单、档位选错、预期不符，看完能避开大部分。</p>
<ul style="list-style:none;padding:0">${cards}</ul>
<a class="seo-cta" href="/order">去下单 →</a>
<div class="seo-foot">${esc(brand.name)} · 自动交付 · 在线充值</div>
</div>`;

        const ld = [
            {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: title,
                description: desc,
                url: canonical,
                inLanguage: 'zh-CN',
            },
            {
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                itemListElement: ARTICLES.map((a, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    name: a.title,
                    url: `${base}/guide/${a.slug}`,
                })),
            },
        ].map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');

        const shell = readTemplate(brand.isSubsite ? 'site' : 'main');
        if (!shell) return res.status(503).type('text/plain').send('building');
        res.type('text/html; charset=utf-8')
            .set('Cache-Control', 'public, max-age=1800')
            .send(injectIntoShell(shell, { head: headOf({ brand, title, desc, canonical, ld }), body }));
    } catch (e) {
        console.error('[seo] 知识库列表失败', e.message);
        res.status(500).type('text/plain').send('error');
    }
});

router.get('/guide/:slug', async (req, res) => {
    try {
        const a = articleOf(req.params.slug);
        if (!a) {
            return res.status(404).type('text/html; charset=utf-8').send(
                `<!doctype html><meta charset="utf-8"><title>页面不存在</title><meta name="robots" content="noindex"><div style="font:16px system-ui;padding:40px">没有找到这篇。 <a href="/guide">回知识库</a></div>`
            );
        }
        const catalog = await loadCatalog(req.site);
        const brand = brandOf(req, catalog);
        const base = `https://${brand.host}`;
        const canonical = `${base}/guide/${a.slug}`;
        const related = ARTICLES.filter((x) => x.slug !== a.slug).slice(0, 4);

        const body = `<div class="seo-wrap">${styleBlock}
<nav style="font-size:13px;color:#94a3b8;margin-bottom:10px">
<a href="/" style="color:#22d3ee">首页</a> › <a href="/guide" style="color:#22d3ee">知识库</a> › ${esc(a.tag)}
</nav>
<h1>${esc(a.title)}</h1>
<p style="color:#cbd5e1">${esc(a.desc)}</p>
<div style="color:#64748b;font-size:12px;margin:8px 0 18px">${esc(a.tag)} · 更新于 ${esc(a.updated)}</div>
${guideBody(a)}
<h2>相关阅读</h2>
<ul>${related.map((x) => `<li><a href="/guide/${x.slug}" style="color:#22d3ee">${esc(x.title)}</a></li>`).join('')}</ul>
<h2>下一步</h2>
<p>看完了就可以去下单。不确定选哪个档位，先在对应平台页看各类型服务的起价和档位说明。</p>
<ul>${[...catalog.platforms].filter((p) => p.count && p.label !== 'Other').slice(0, 6)
                .map((p) => `<li><a href="/c/${p.slug}" style="color:#22d3ee">${esc(PLATFORM_CN[p.label] || p.label)} 增长服务</a></li>`).join('')}</ul>
<a class="seo-cta" href="/order">去下单 →</a>
<div class="seo-foot">${esc(brand.name)} · 自动交付 · 在线充值</div>
</div>`;

        const ld = [
            {
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: a.title,
                description: a.desc,
                datePublished: a.updated,
                dateModified: a.updated,
                inLanguage: 'zh-CN',
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
                    { '@type': 'ListItem', position: 2, name: '知识库', item: `${base}/guide` },
                    { '@type': 'ListItem', position: 3, name: a.title, item: canonical },
                ],
            },
            guideFaqLd(a),
        ].map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');

        const shell = readTemplate(brand.isSubsite ? 'site' : 'main');
        if (!shell) return res.status(503).type('text/plain').send('building');
        res.type('text/html; charset=utf-8')
            .set('Cache-Control', 'public, max-age=1800')
            .send(injectIntoShell(shell, {
                head: headOf({ brand, title: `${a.title} · ${brand.name}`, desc: a.desc, canonical, ld }),
                body,
            }));
    } catch (e) {
        console.error('[seo] 知识库详情失败', e.message);
        res.status(500).type('text/plain').send('error');
    }
});

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
        const title = `${platCn} 增长服务 ${cheapest} 元起 · ${brand.name}`;
        const desc = `${brand.name} 提供 ${plat.count} 个 ${platCn} 增长服务：粉丝、点赞、播放、评论等，${cheapest} 元起 / 1000 个，自动交付，登录即可下单。`;
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
<h1>${esc(platCn)} 增长服务 · ${esc(brand.name)}</h1>
${extra ? `<p>${esc(extra.intro)}</p>` : ''}
<p>${esc(brand.name)} 现有 <b>${plat.count}</b> 个 ${esc(platCn)} 相关服务，价格按每 1000 个计算，最低 <b>${cheapest} 元</b> 起，提交订单后系统自动开始处理。</p>
${typeTable(platCn, plat.types)}
${(() => {
            const subs = plat.types
                .filter((x) => x.label !== 'Other' && typeCopyOf(x.label) && x.count >= 3)
                .map((x) => {
                    const xtc = typeCopyOf(x.label);
                    return `<li><a href="/c/${plat.slug}/${xtc.slug}" style="color:#22d3ee">${esc(platCn)} ${esc(xtc.name)}服务</a>（${x.count} 个档位，${per1000(x.minPrice)} 元起）</li>`;
                });
            return subs.length ? `<h2>按${esc(platCn)}服务类型查看</h2>\n<ul>${subs.join('')}</ul>` : '';
        })()}
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

export default router;
