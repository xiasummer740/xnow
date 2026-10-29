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
import { Service, SiteServicePrice, Config } from '../models/index.js';
import { platformOf, slugOf, labelOfSlug, PLATFORM_CN, typeOf, per1000, PLATFORM_LABELS } from '../utils/platform.js';
import { copyOf } from '../utils/platformCopy.js';

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
        Config.findAll({ where: { key: ['global_multiplier', 'site_name'] } }),
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
    const ld = [
        {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: brand.name,
            url: `https://${brand.host}/`,
            description: `${brand.name}：社媒增长服务，自动交付。`,
        },
        {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: brand.name,
            url: `https://${brand.host}/`,
            inLanguage: 'zh-CN',
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

const headOf = ({ brand, title, desc, canonical, ld }) => `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${esc(canonical)}" />
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
Disallow: /vpn

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
        const urls = [{ loc: `${base}/`, pri: '1.0' }];
        const ordered = [...catalog.platforms].sort((a, b) => prefIndex(a.label) - prefIndex(b.label));
        for (const p of ordered) {
            if (!p.count) continue;
            // 「其他」是兜底分类（上游脏分类全归到这里），不是真平台：
            // 拿它做落地页既没有搜索词，内容也杂，不放进 sitemap。
            if (p.label === 'Other') continue;
            urls.push({ loc: `${base}/c/${p.slug}`, pri: p === ordered[0] ? '0.9' : '0.8' });
        }
        // ⚠️ 这里**故意不加** <?xml-stylesheet?>：
        //    加了之后浏览器会把 XML 渲染成漂亮表格，但 Chrome 从 2026 起对 XSLT 弹红色警告
        //    （"此网站使用了 XSLT，该功能很快就会从此浏览器中移除"），比原始 XML 树更让人以为坏了。
        //    搜索引擎读的是 XML 原文，加不加样式对收录没有任何影响。
        //    （/sitemap.xsl 路由保留着，将来需要时把上面那行 PI 加回来即可。）
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>${u.pri}</priority></url>`).join('\n')}
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
        const html = injectIntoShell(shell, {
            head: headOf({ brand, title, desc, canonical, ld: jsonLdOf(brand, canonical, null) }),
            body,
        });
        res.type('text/html; charset=utf-8').set('Cache-Control', 'public, max-age=300').send(html);
    } catch (e) {
        console.error('[seo] 首页壳失败', e.message);
        next();
    }
});

export default router;
