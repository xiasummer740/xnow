import fs from 'fs';
import { fileURLToPath } from 'url';

// 🛡️ 抓取防回退自检（SEO / GEO 的看门狗）
//
// 为什么需要它：SEO 的地基**不在我们代码里**，而是散在别人家的三个开关上，任何一个被人
// 或默认值改回去，站点照样 200、日志里一行都不会有，只是从此不再被搜索引擎与 AI 抓到：
//
//   ① Cloudflare「AI 自动程序策略 · 训练」—— 2026-09-15 起 CF 对**新绑域名默认禁止**训练类，
//      GPTBot / ClaudeBot 会被边缘直接 403（`Your request was blocked.`，25 字节）。
//      robots.txt 写着欢迎也没用：门在 CF 那层就关了。
//   ② Cloudflare「自动程序偏好同步」—— 开着它，CF 会往我们 robots.txt 前面塞一坨托管内容
//      （实测 167 行），把我们自己那 37 行规则盖掉，规则自相矛盾。
//   ③ 后端自己 —— robots.txt / sitemap.xml 是 `routes/seo.js` 服务端渲染的，任何一次改动、
//      任何一次 nginx 转发调整，都可能把它们弄坏，而**没人会去看**（爬虫不会投诉）。
//
// 这三类都是**静默失败**，和 2026-10-13 那次「备份连续 13 天静默失效」是同一副面孔：
// 系统在报「一切正常」，实际那条链路早断了。所以这里每 30 分钟从**公网**（走 CF 边缘，
// 不是 localhost —— 我们要的正是「爬虫看到的样子」）验三件事：
//
//   · robots.txt 还是我们自己那份（首行 `# <host>`、含我们的 Content-Signal、行数没被灌水）
//   · GPTBot / ClaudeBot 用各自的 UA 能拿到首页 200（证明 CF 没把门关上）
//   · sitemap.xml 200 且地址数不为 0
//
// 判定原则：**只在状态变化时说话**（好→坏推一条，坏→好也推一条，持续坏 12 小时提醒一次）。
// 告警一旦变吵就会被无视，等于没有 —— 这条在 nginxWatch 里已经吃过一次教训。
//
// ⚠️ 只在**主站实例**上生效：站点清单来自 `.indexnow-hosts`（由 `deploy/sites/rebuild-vhosts.cjs`
//    自动维护，主站 + 每个带域名的分站各一行）。Beta / 本地没有这个文件 → 直接跳过，
//    避免同一件事被两个进程各推一遍。
// 关闭方式：`SEO_GUARD=off`；手动指定站点：`SEO_GUARD_HOSTS=a.com,b.com`。

const TIMEOUT_MS = Number(process.env.SEO_GUARD_TIMEOUT_MS || 15000);
// 持续坏着时的提醒间隔（12 小时）。
const RECHECK_ALERT_MS = 12 * 3600 * 1000;
// 巡检周期：30 分钟。CF 的 robots 边缘缓存是 600 秒，再密也看不出新东西。
export const SEO_GUARD_INTERVAL_MS = Number(process.env.SEO_GUARD_INTERVAL_MIN || 30) * 60 * 1000;
const TEST = process.env.SEO_GUARD_TEST === '1';

// 用真实 UA：CF 的 AI 策略是按 UA / 行为特征分类的，用普通 curl 测不出「GPTBot 被拦」。
const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_GPT = 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)';
const UA_CLAUDE = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 站点清单：环境变量优先（手动排障用），否则读 .indexnow-hosts（自动同步分站增减）
//
// ⚠️ 路径必须**相对本文件**算，不能写死 `/var/www/xnow/.indexnow-hosts`：
//    写死的话 Beta（`/var/www/xnow-beta/`）会读到生产那份清单，于是两个进程各推一遍告警 ——
//    2026-10-30 首次上线就是这个症状（Beta 也跟着「已启动」了）。本文件在
//    `<repo>/server/src/utils/`，往上三级就是仓库根，`.indexnow-hosts` 就在根上。
const DEFAULT_HOSTS_FILE = fileURLToPath(new URL('../../../.indexnow-hosts', import.meta.url));
const HOSTS_FILE = process.env.SEO_GUARD_HOSTS_FILE || DEFAULT_HOSTS_FILE;

const hostsOf = () => {
    const forced = String(process.env.SEO_GUARD_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (forced.length) return [...new Set(forced)];
    try {
        const list = fs.readFileSync(HOSTS_FILE, 'utf8').split('\n')
            .map((l) => l.trim()).filter(Boolean)
            .map((l) => l.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim())
            .filter(Boolean);
        return [...new Set(list)];
    } catch (e) {
        return []; // 没有这个文件 = 不是主站实例（Beta / 本地），交给调用方跳过
    }
};

// 抓一次文本。失败重试一次：一次网络抖动不该被写成「AI 爬虫被抓取被拦了」——
// 那是完全不同的一回事，误报一次这条告警就废了。
const fetchText = async (url, ua) => {
    let lastErr;
    for (let i = 0; i < 2; i++) {
        try {
            const res = await fetch(url, {
                headers: { 'user-agent': ua, accept: '*/*' },
                redirect: 'follow',
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            return { status: res.status, body: await res.text() };
        } catch (e) {
            lastErr = e;
            if (i === 0) await sleep(1000);
        }
    }
    throw lastErr;
};

// ① robots.txt 是不是我们自己那份
const checkRobots = async (host) => {
    const { status, body } = await fetchText(`https://${host}/robots.txt`, UA_BROWSER);
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    if (status !== 200) return { ok: false, detail: `robots.txt 返回 HTTP ${status}` };
    // 首行是我们自己写的那行 `# <host>`。CF 的托管内容会插在前面，首行立刻不是它。
    if (lines[0] !== `# ${host}`) {
        return { ok: false, detail: `robots.txt 首行不是我们自己的（现在是「${lines[0] || '空'}」）—— 多半是 Cloudflare「自动程序偏好同步」被重新打开了` };
    }
    if (!body.includes('Content-Signal:')) {
        return { ok: false, detail: 'robots.txt 里没有我们自己的 Content-Signal 行 —— 内容已被替换' };
    }
    if (!body.includes(`Sitemap: https://${host}/sitemap.xml`)) {
        return { ok: false, detail: `robots.txt 里没有指向 https://${host}/sitemap.xml 的 Sitemap 行` };
    }
    // 我们那份是 35 行左右；CF 托管那份实测 167 行。留足余量只拦「被整块灌进来」。
    if (lines.length > 80) {
        return { ok: false, detail: `robots.txt 有 ${lines.length} 行（我们自己那份约 35 行）—— 疑似 Cloudflare 托管内容又灌回来了` };
    }
    return { ok: true, detail: `robots.txt ${lines.length} 行` };
};

// ② AI 爬虫真的拿得到首页（这一条才是「门有没有关」的实测，不是看开关）
const checkAi = async (host, ua, name) => {
    const { status, body } = await fetchText(`https://${host}/`, ua);
    if (status !== 200) {
        return { ok: false, detail: `${name} 抓首页被拒：HTTP ${status}${status === 403 ? '（Cloudflare 的 AI 爬虫策略多半又被默认拦了：Security → Settings → 配置 AI 自动程序策略 → 训练改「允许」）' : ''}` };
    }
    // 首页 SSR 壳约 5.7KB；只剩几十字节说明拿到的是拦截页 / 空壳
    if (body.length < 500) return { ok: false, detail: `${name} 抓首页只拿到 ${body.length} 字节（正常 5KB 以上）` };
    return { ok: true, detail: `${name} 200 / ${body.length} 字节` };
};

// ③ sitemap 还在、还有地址
const checkSitemap = async (host) => {
    const { status, body } = await fetchText(`https://${host}/sitemap.xml`, UA_BROWSER);
    if (status !== 200) return { ok: false, detail: `sitemap.xml 返回 HTTP ${status}` };
    if (!body.includes('<urlset')) return { ok: false, detail: 'sitemap.xml 不是合法的 urlset（可能落到了 SPA 首页）' };
    const n = (body.match(/<loc>/g) || []).length;
    if (n < 3) return { ok: false, detail: `sitemap.xml 只有 ${n} 条地址` };
    return { ok: true, detail: `sitemap ${n} 条地址` };
};

// 状态机：key = host|check。只在「迁移」时告警（含持续故障每 12 小时提醒一次）。
const state = new Map();

const sendAlert = async (text) => {
    try {
        // 延迟 import：让本模块可以在不连数据库的情况下被单独跑（scripts/seo-guard-check.mjs）
        const { sendTgMessage } = await import('./tgBot.js');
        await sendTgMessage(`${TEST ? '[测试] ' : ''}${text}`);
    } catch (e) {
        console.error('[SeoGuard] 告警发送失败', e.message);
    }
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * 跑一轮自检。
 * @param {{ verbose?: boolean, alert?: boolean }} opts verbose=打印每一项；alert=false 只返回结果不推 TG
 * @returns {Promise<Array<{host:string,check:string,ok:boolean,detail:string}>>}
 */
export const runSeoGuard = async ({ verbose = false, alert = true } = {}) => {
    if (process.env.SEO_GUARD === 'off') {
        if (verbose) console.log('[SeoGuard] SEO_GUARD=off，跳过');
        return [];
    }
    const hosts = hostsOf();
    if (!hosts.length) {
        // 只有第一次才说一句，别每 30 分钟刷一行
        if (verbose) {
            console.log(`[SeoGuard] 未找到 ${HOSTS_FILE}，跳过（抓取自检只在主站实例上跑）`);
        } else if (!runSeoGuard._skippedLogged) {
            console.log(`[SeoGuard] 未找到 ${HOSTS_FILE}，跳过（抓取自检只在主站实例上跑）`);
            runSeoGuard._skippedLogged = true;
        }
        return [];
    }

    const results = [];
    const bad = [];
    const recovered = [];
    const now = Date.now();

    // 起服后的第一轮留一行「我在这里」：否则「巡检没跑」和「巡检跑了且全过」在日志里长得一模一样
    if (!runSeoGuard._started) {
        console.log(`[SeoGuard] 已启动：每 ${Math.round(SEO_GUARD_INTERVAL_MS / 60000)} 分钟自检 ${hosts.join(', ')}（robots / GPTBot / ClaudeBot / sitemap）`);
        runSeoGuard._started = true;
    }

    for (const host of hosts) {
        const checks = [
            ['robots', () => checkRobots(host)],
            ['ai-gptbot', () => checkAi(host, UA_GPT, 'GPTBot')],
            ['ai-claudebot', () => checkAi(host, UA_CLAUDE, 'ClaudeBot')],
            ['sitemap', () => checkSitemap(host)],
        ];
        for (const [name, fn] of checks) {
            let r;
            try {
                r = await fn();
            } catch (e) {
                // 连不上 ≠ 被拦。措辞必须分开，否则运维会去 CF 后台找一个根本不存在的开关。
                r = { ok: false, detail: `请求失败（不是被拦，是我方抓不到）：${e.message}`, network: true };
            }
            results.push({ host, check: name, ...r });
            if (verbose) console.log(`${r.ok ? '✅' : '❌'} ${host} ${name} — ${r.detail}`);

            const key = `${host}|${name}`;
            const prev = state.get(key);
            const changed = !prev || prev.ok !== r.ok;
            const remind = !r.ok && prev && prev.ok === false && now - (prev.lastAlertAt || 0) > RECHECK_ALERT_MS;
            if (!changed && !remind) continue;

            state.set(key, { ok: r.ok, lastAlertAt: r.ok ? 0 : now });
            if (r.ok) {
                // ⚠️ 只有**本来是坏的**才算「恢复」。第一轮全好会被算成「8 项已恢复」并推一条
                //    假告警 —— 2026-10-30 首次上线实测就是这个症状（日志里 8 项已恢复），已修。
                if (prev && prev.ok === false) recovered.push({ host, name, detail: r.detail });
            } else {
                bad.push({ host, name, detail: r.detail });
            }
        }
    }

    if (verbose) {
        const okN = results.filter((r) => r.ok).length;
        console.log(`[SeoGuard] 本轮 ${okN}/${results.length} 项通过（${hosts.join(', ')}）`);
    }

    if (alert && (bad.length || recovered.length)) {
        const lines = [];
        if (bad.length) {
            console.error(`🚨 [SeoGuard] ${bad.length} 项抓取链路异常: ${bad.map((b) => `${b.host}/${b.name}`).join(' ')}`);
            lines.push(`🚨 <b>抓取链路异常（SEO/AI 收录会静默失效）</b>`);
            for (const b of bad) lines.push(`· <b>${esc(b.host)}</b> ${esc(b.name)}：${esc(b.detail)}`);
        }
        if (recovered.length) {
            console.log(`✅ [SeoGuard] ${recovered.length} 项已恢复: ${recovered.map((b) => `${b.host}/${b.name}`).join(' ')}`);
            lines.push(`✅ <b>已恢复</b>`);
            for (const b of recovered) lines.push(`· <b>${esc(b.host)}</b> ${esc(b.name)}：${esc(b.detail)}`);
        }
        await sendAlert(lines.join('\n'));
    }

    return results;
};

/** 供 app.js 挂定时器用：跑一轮并把任何抛错吞成一行日志（绝不让巡检本身把进程带崩） */
export const seoGuardTick = async () => {
    try {
        // 排障开关：`SEO_GUARD_VERBOSE=1` 让每一轮都打印 4 项实测值（默认成功时安静，
        // 否则 48 行/天会把有用日志淹掉）。用它验「定时器真的在跑」最直接。
        await runSeoGuard({ verbose: process.env.SEO_GUARD_VERBOSE === '1' });
    } catch (e) {
        console.error('[SeoGuard] 巡检自身出错', e.message);
    }
};
