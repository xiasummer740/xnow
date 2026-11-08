#!/usr/bin/env node
/**
 * Google Indexing API 批量提交（零依赖 —— 只用 Node 内置 crypto 签 JWT）
 *
 * 为什么不用 python google-auth：
 *   生产机是 Python 3.8 + 系统 pip，装 google-auth 要么污染系统包，
 *   要么需要 venv，维护成本高。Node 内置 crypto 足够完成 RS256 签名，
 *   整个脚本不依赖任何第三方包。
 *
 * 配额（重要）：
 *   Indexing API 默认每天 200 条 URL。主站 sitemap 已 174 条，
 *   刚好够一轮全量。超了会返回 429，脚本会如实记录、不重试到死。
 *
 * 用法：
 *   node scripts/gsc-indexing.mjs                 # 提交 sitemap 全部 URL
 *   node scripts/gsc-indexing.mjs <url> [<url>…]  # 只提交指定 URL
 *   node scripts/gsc-indexing.mjs --limit 50      # 只提交前 50 条（省配额）
 *
 * 凭据：/var/www/xnow/server/.gsc-service-account.json（chmod 600，已 gitignore）
 * 日志：/var/log/xnow-gsc-indexing.log
 */
import { createSign } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const KEY_CANDIDATES = [
    path.join(ROOT, 'server', '.gsc-service-account.json'),
    path.join(ROOT, '.secrets', 'gsc-service-account.json'),
    '/var/www/xnow/server/.gsc-service-account.json',
];
const SITE = process.env.GSC_SITE || 'https://xnow.taikon.top';
const SCOPE = 'https://www.googleapis.com/auth/indexing';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

const b64url = (buf) =>
    Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function findKey() {
    for (const p of KEY_CANDIDATES) if (existsSync(p)) return p;
    throw new Error('找不到服务账号密钥（server/.gsc-service-account.json）');
}

/** 用服务账号私钥签一个 JWT，换 access_token */
async function getAccessToken() {
    const keyPath = findKey();
    const key = JSON.parse(readFileSync(keyPath, 'utf8'));
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
        iss: key.client_email,
        scope: SCOPE,
        aud: TOKEN_URI,
        iat: now,
        exp: now + 3600,
    };
    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    const signature = b64url(signer.sign(key.private_key));
    const assertion = `${signingInput}.${signature}`;

    const res = await fetch(TOKEN_URI, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
        }).toString(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`换 token 失败 HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    return data.access_token;
}

async function sitemapUrls() {
    const res = await fetch(`${SITE}/sitemap.xml`, { headers: { 'user-agent': 'xnow-gsc/1.0' } });
    if (!res.ok) throw new Error(`取 sitemap 失败 ${res.status}`);
    const xml = await res.text();
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

async function submit(token, target) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ url: target, type: 'URL_UPDATED' }),
    });
    let body = '';
    try { body = (await res.text()).replace(/\s+/g, ' ').slice(0, 200); } catch {}
    return { status: res.status, body };
}

const main = async () => {
    const args = process.argv.slice(2);
    let limit = Infinity;
    const li = args.indexOf('--limit');
    if (li >= 0) { limit = parseInt(args[li + 1], 10) || Infinity; args.splice(li, 2); }

    const targets = args.length ? args : (await sitemapUrls()).slice(0, limit);
    console.log(`[gsc] 目标 ${targets.length} 条 → ${SITE}`);

    const token = await getAccessToken();
    console.log('[gsc] 已获取 access token');

    let ok = 0, fail = 0, quota = 0;
    const failures = [];
    for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const r = await submit(token, t);
        if (r.status === 200) { ok++; }
        else if (r.status === 429) { quota++; failures.push(`${t} → 429 配额超限`); }
        else { fail++; failures.push(`${t} → ${r.status} ${r.body}`); }
        if ((i + 1) % 20 === 0) console.log(`  进度 ${i + 1}/${targets.length}  成功 ${ok} 失败 ${fail} 配额 ${quota}`);
        await new Promise((r2) => setTimeout(r2, 250));   // 限速，避免触发 QPS
    }

    console.log(`\n[gsc] 完成：成功 ${ok} / 失败 ${fail} / 配额超限 ${quota} / 共 ${targets.length}`);
    if (failures.length) {
        console.log('[gsc] 失败明细（前 10 条）：');
        failures.slice(0, 10).forEach((f) => console.log('  ' + f));
    }
    process.exit(quota > 0 || fail > 0 ? 1 : 0);
};

main().catch((e) => { console.error('❌ [gsc]', e.message); process.exit(1); });
