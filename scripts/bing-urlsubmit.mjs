#!/usr/bin/env node
/**
 * Bing Webmaster URL Submission API 批量提交
 *
 * 为什么还要这条（IndexNow 已经在跑了）：
 *   · IndexNow 是「通知协议」，Bing 收到后会排队；URL Submission API 是
 *     Bing 自家的**优先抓取队列**，对 Copilot / ChatGPT 检索用的 Bing 索引更快。
 *   · 两者都发不冲突，Bing 官方也建议 IndexNow 为主、API 为辅。
 *
 * 凭据：/var/www/xnow/server/.bing-api-key.txt（chmod 600，已 gitignore）
 *       格式：纯文本一行 32 位十六进制，来自 Bing Webmaster → 设置 → API 访问
 *
 * 配额（**实测，不是文档数字**）：
 *   Bing URL Submission API 是**每个站点每天 100 条**。
 *   2026-11-08 实测报错：`You have exceeded your daily url submission quota : 100`
 *   （官方博客提过 10,000 条/天，那是早期或企业额度，普通账号就是 100。）
 *   主站 sitemap 174 条 → 需要 2 天才能全量覆盖，所以：
 *     · 默认按优先级排序（首页 > 价格表 > 主力平台页 > 其余），
 *       撞到配额就停，第二天 cron 接着提交（已提交的会跳过，见 .bing-submitted）
 *     · 全量兜底靠 IndexNow（不限量）+ sitemap（Bing 自己爬）
 *
 * 用法：
 *   node scripts/bing-urlsubmit.mjs                # 按优先级提交，默认上限 95 条
 *   node scripts/bing-urlsubmit.mjs <url> [<url>…] # 指定 URL
 *   node scripts/bing-urlsubmit.mjs --limit 50     # 自定义上限
 *   node scripts/bing-urlsubmit.mjs --all          # 忽略已提交记录，重推全部
 *
 * 退出码：0 全成功 / 1 有失败（便于 cron 报警）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const KEY_CANDIDATES = [
    path.join(ROOT, 'server', '.bing-api-key.txt'),
    path.join(ROOT, '.secrets', 'bing-api-key.txt'),
    '/var/www/xnow/server/.bing-api-key.txt',
];
const SITE = process.env.BING_SITE || 'https://xnow.taikon.top/';
const BATCH_MAX = 500;
const DAILY_QUOTA = 100;
const DEFAULT_LIMIT = 95;                       // 留 5 条余量，别把配额刚好撞满
const SUBMITTED_FILE = path.join(ROOT, '.bing-submitted');

/**
 * 优先级打分：数字小的先提交。
 * 配额只有 100/天，必须把「最可能带来自然流量 + 商业价值最高」的排在前面。
 *
 * 2026-11-08 调整：知识库文章（/guide/）提到第 3 档。
 * 产品页吃的是现成的品牌搜索，而新写的运营指南拿的是「新号怎么涨粉」
 * 「店铺怎么引流」这类搜索量更大的词 —— 越早进索引越值。
 */
function priority(url) {
    const p = url.replace(/^https?:\/\/[^/]+/, '');
    if (p === '/' || p === '') return 0;              // 各语种首页
    if (p === '/price' || /^\/(en|id|pt|vi|ar|ru)$/.test(p)) return 1;
    if (p.endsWith('/price')) return 2;               // 各语种价格表
    if (/^\/guide\/[^/]+$/.test(p)) return 3;         // 知识库文章（新内容优先）
    if (/^\/c\/[^/]+$/.test(p)) return 4;             // 平台页
    if (/^\/(en|id|pt|vi|ar|ru)\/c\/[^/]+$/.test(p)) return 5;
    if (p === '/guide') return 5;                     // 知识库首页
    if (/^\/c\/[^/]+\/[^/]+$/.test(p)) return 6;      // 类型子页
    return 7;
}

function readKey() {
    for (const p of KEY_CANDIDATES) {
        if (existsSync(p)) return readFileSync(p, 'utf8').trim();
    }
    throw new Error('找不到 Bing API key（server/.bing-api-key.txt）');
}

/** 已成功提交过的 URL（避免每天重复占用配额） */
function loadSubmitted() {
    try {
        return new Set(readFileSync(SUBMITTED_FILE, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean));
    } catch { return new Set(); }
}
function saveSubmitted(set) {
    try { writeFileSync(SUBMITTED_FILE, [...set].join('\n') + '\n'); } catch {}
}

async function sitemapUrls() {
    const res = await fetch(`${SITE.replace(/\/$/, '')}/sitemap.xml`, {
        headers: { 'user-agent': 'xnow-bing/1.0' },
    });
    if (!res.ok) throw new Error(`取 sitemap 失败 ${res.status}`);
    const xml = await res.text();
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

/** 批量提交（一次最多 500 条） */
async function submitBatch(key, urls) {
    const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${encodeURIComponent(key)}`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ siteUrl: SITE, urlList: urls }),
    });
    let body = '';
    try { body = (await res.text()).replace(/\s+/g, ' ').slice(0, 200); } catch {}
    return { status: res.status, body };
}

/** 单条提交（批量失败时回退） */
async function submitOne(key, url) {
    const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrl?apikey=${encodeURIComponent(key)}`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ siteUrl: SITE, url }),
    });
    let body = '';
    try { body = (await res.text()).replace(/\s+/g, ' ').slice(0, 160); } catch {}
    return { status: res.status, body };
}

const main = async () => {
    const args = process.argv.slice(2);
    let limit = DEFAULT_LIMIT;
    const li = args.indexOf('--limit');
    if (li >= 0) { limit = parseInt(args[li + 1], 10) || DEFAULT_LIMIT; args.splice(li, 2); }
    const forceAll = args.includes('--all');
    if (forceAll) args.splice(args.indexOf('--all'), 1);

    const key = readKey();
    const submitted = loadSubmitted();

    let targets;
    if (args.length) {
        targets = args;
    } else {
        const all = await sitemapUrls();
        const done = forceAll ? new Set() : submitted;
        targets = all
            .filter((u) => !done.has(u))
            .sort((a, b) => priority(a) - priority(b))   // 高价值优先
            .slice(0, limit);
    }

    console.log(`[bing] 待提交 ${targets.length} 条 → ${SITE}（日配额 ${DAILY_QUOTA}，本次上限 ${limit}）`);
    console.log(`[bing] 历史已提交 ${submitted.size} 条，key 前缀 ${key.slice(0, 6)}…`);

    let ok = 0, fail = 0, quotaHit = false;
    const failures = [];

    for (const url of targets) {
        if (quotaHit) break;                       // 配额已满，后面的明天再提交
        const r = await submitOne(key, url);
        if (r.status === 200) {
            ok++;
            submitted.add(url);
        } else if (/quota/i.test(r.body) || /quota/i.test(String(r.status))) {
            quotaHit = true;
            failures.push(`${url} → 配额已满`);
        } else if (r.status === 400 && /exceeded/i.test(r.body)) {
            quotaHit = true;
            failures.push(`${url} → 配额已满`);
        } else {
            fail++;
            failures.push(`${url} → ${r.status} ${r.body.slice(0, 100)}`);
        }
        await new Promise((res) => setTimeout(res, 120));
    }

    saveSubmitted(submitted);

    console.log(`\n[bing] 完成：成功 ${ok} / 失败 ${fail} / 共 ${targets.length}${quotaHit ? '（撞日配额，剩余留到明天）' : ''}`);
    console.log(`[bing] 累计已提交 ${submitted.size} 条，sitemap 共 ${(await sitemapUrls()).length} 条`);
    if (failures.length) {
        console.log('[bing] 明细（前 5 条）：');
        failures.slice(0, 5).forEach((f) => console.log('  ' + f));
    }
    process.exit(fail > 0 ? 1 : 0);
};

main().catch((e) => { console.error('❌ [bing]', e.message); process.exit(1); });
