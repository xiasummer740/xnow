#!/usr/bin/env node
/**
 * IndexNow 主动提交（Bing / Yandex / Seznam / Naver 等共用协议）
 *
 * 为什么需要它：sitemap 只是"告诉搜索引擎这有东西"，什么时候来抓是它说了算。
 * IndexNow 是"我现在就告诉你哪几页变了"，通常几小时内就索引，而自然抓取要几天到几周。
 * ⚠️ Google 不支持 IndexNow，它只认 Search Console（要祥哥的 Google 账号）。
 *
 * 用法：
 *   node scripts/indexnow-submit.mjs                       # 提交主站全部地址
 *   node scripts/indexnow-submit.mjs https://7h2d5u.taikon.top
 *   node scripts/indexnow-submit.mjs https://xnow.taikon.top https://xnow.taikon.top/c/tiktok
 *
 * 退出码：0 成功（含 200/202），1 失败（便于 cron 报警）
 */

const FALLBACK_KEY = '9750e61ef15e5367ff27f64bf3767673';

const readSitemap = async (host) => {
    const res = await fetch(`${host}/sitemap.xml`, { headers: { 'user-agent': 'xnow-indexnow/1.0' } });
    if (!res.ok) throw new Error(`取 sitemap 失败：${res.status}`);
    const xml = await res.text();
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
};

const main = async () => {
    const args = process.argv.slice(2);
    const host = (args[0] || 'https://xnow.taikon.top').replace(/\/$/, '');
    const key = process.env.INDEXNOW_KEY || FALLBACK_KEY;
    const list = args.length > 1 ? args.slice(1) : await readSitemap(host);

    const body = {
        host: new URL(host).host,
        key,
        keyLocation: `${host}/${key}.txt`,
        urlList: list,
    };

    console.log(`提交 ${body.urlList.length} 个地址 → ${body.host}`);
    const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    // 200 = 已接受；202 = 已接受但密钥校验中（都算成功）
    console.log(`  HTTP ${res.status} ${text.slice(0, 200)}`);
    if (res.status === 200 || res.status === 202) {
        console.log('  ✅ 已接受');
        process.exit(0);
    }
    console.log('  ❌ 未接受，检查 keyLocation 是否可访问');
    process.exit(1);
};

main().catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
});
