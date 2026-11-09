// ============================================================================
// 收件邮箱校验（2026-11-09）
// ----------------------------------------------------------------------------
// 为什么需要：发信走 QQ 邮箱 SMTP，如果客户把邮箱打错（gmai.com、gmail.con、
// qq.co …），会出现一条谁都看不见的失败链：
//
//   后端返回「验证码已发送」→ 客户以为发了 → 收不到 → 反复点获取
//   → 退信全部进站长的 QQ 邮箱 → 客户投诉「你们系统坏了」
//
// 2026-11-09 实测踩到：我自己用 example.com 做测试，QQ 邮箱立刻回了一封
// 「No Mx Record Found」退信。真实客户填错域名是完全一样的结果，
// 只是他永远不知道发生了什么。
//
// 三道检查：
//   ① 字面格式（缺 @、有空格、TLD 是纯数字）
//   ② 常见邮箱域名拼写错误（gmai.com / gmail.con / qq.co 这类）
//   ③ DNS MX 记录（域名到底存不存在、能不能收信）
//
// 关键取舍：**DNS 查询本身失败时放行**。ETIMEOUT / ESERVFAIL 是 DNS 服务
// 抖动，不能因为解析超时就把正常客户挡在注册门外。
// ============================================================================

import dns from 'dns/promises';

const MX_TTL = 10 * 60 * 1000;
const mxCache = new Map();   // domain → { ok, message, ts }

// 高频邮箱域名：客户打错时绝大多数是这几个的近邻
const COMMON_DOMAINS = [
    'gmail.com', 'qq.com', '163.com', '126.com', 'outlook.com',
    'hotmail.com', 'yahoo.com', 'icloud.com', 'foxmail.com', 'sina.com',
];

// Levenshtein 编辑距离（域名都很短，O(n*m) 完全够用）
const editDistance = (a, b) => {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 99;      // 长度差太多，不用算
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
            cur[j] = Math.min(
                prev[j] + 1,
                cur[j - 1] + 1,
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }
        prev = cur;
    }
    return prev[n];
};

/**
 * 检查邮箱能不能收信。
 * @returns {{ok: boolean, message?: string}}
 */
export const checkEmailDeliverable = async (email) => {
    const addr = String(email || '').trim().toLowerCase();

    // ① 基本格式：local@domain.tld，每段不能以连字符开头/结尾
    const m = addr.match(/^([^\s@]+)@([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+)$/i);
    if (!m) return { ok: false, message: '邮箱格式不正确，请检查是否有空格或缺少 @' };
    const domain = m[2];

    // 顶级域全是数字 → 一定写错了
    if (/\.[0-9]+$/.test(domain)) return { ok: false, message: '邮箱域名不正确，请检查' };

    // ② 保留域名（RFC 2606）：永远不会真的送信
    if (/^(example\.(com|org|net)|test\.(com|org)|invalid|localhost)$/i.test(domain)) {
        return { ok: false, message: '这是一个示例邮箱域名，请填写真实可用的邮箱' };
    }

    // ③ 常见域名拼写错误
    //    注意 gmai.com / gmail.con 这类域名**真实存在**（有人抢注），
    //    光靠 MX 记录查不出来，所以必须按编辑距离判断。
    if (!COMMON_DOMAINS.includes(domain)) {
        for (const good of COMMON_DOMAINS) {
            const d = editDistance(domain, good);
            // 距离 1 基本可以确定是手滑（少一个字母 / 多一个字母 / 相邻字母颠倒）
            if (d === 1) {
                return {
                    ok: false,
                    message: `邮箱域名「${domain}」可能是「${good}」的拼写错误，请确认后再试`,
                };
            }
        }
    }

    // ④ MX 记录（带缓存）
    const hit = mxCache.get(domain);
    if (hit && Date.now() - hit.ts < MX_TTL) {
        return hit.ok ? { ok: true } : { ok: false, message: hit.message };
    }

    let ok = true;
    let message = '';
    try {
        const mx = await dns.resolveMx(domain);
        if (!mx || !mx.length) {
            // 少数域名没有 MX 但靠 A/AAAA 记录兜底收信
            let reachable = false;
            try { const a = await dns.resolve4(domain); reachable = !!(a && a.length); } catch { /* ignore */ }
            if (!reachable) {
                try { const a6 = await dns.resolve6(domain); reachable = !!(a6 && a6.length); } catch { /* ignore */ }
            }
            if (!reachable) {
                ok = false;
                message = `邮箱域名「${domain}」没有邮件服务记录，无法接收验证码，请检查拼写`;
            }
        }
    } catch (e) {
        if (e.code === 'ENOTFOUND' || e.code === 'ENODATA') {
            ok = false;
            message = '该邮箱域名不存在，请检查是否把 gmail / qq / 163 之类拼错了';
        } else {
            // ETIMEOUT / ESERVFAIL / ECONNREFUSED：DNS 服务的问题，放行
            ok = true;
            message = '';
        }
    }

    mxCache.set(domain, { ok, message, ts: Date.now() });
    if (mxCache.size > 500) {
        const now = Date.now();
        for (const [k, v] of mxCache) if (now - v.ts > MX_TTL) mxCache.delete(k);
    }

    return ok ? { ok: true } : { ok: false, message };
};
