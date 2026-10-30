// ============================================================================
// 👑 代理资格判定（2026-10-30 补）
// ----------------------------------------------------------------------------
// 为什么单独一个文件：以前「是不是代理」只看 users.role —— 只要角色是 agent 就永远
// 按 8 折算，**根本不看 agent_expire_at**。后果是两条：
//   ① 密室把某个用户改成「至尊代理」却没给天数 → 永久 8 折，平台每单少收 20%；
//   ② 代理到期本来靠 siteBilling 每 10 分钟把 role 降回 user，可一旦那次巡检
//      漏了（进程重启、任务异常），降级就永远不发生，折扣跟着永久留着。
//
// 现在统一成一条判定：**角色是 agent 且到期时间在未来**。
// 所有「给不给折扣」的地方都走这里，避免以后又冒出第三处只看 role 的写法。
//
// ⚠️ 与 110 期定调保持一致：代理到期**不停站**，只是进货价回落到原价。
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 到期时间归一化：兼容毫秒时间戳 / 秒级时间戳 / Date / 数字字符串。
 * 0 或非法值一律返回 0（= 没有有效期）。
 */
export const expiryMs = (v) => {
    if (!v) return 0;
    if (v instanceof Date) {
        const t = v.getTime();
        return Number.isFinite(t) && t > 0 ? t : 0;
    }
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return 0;
    // 10 位是秒，13 位是毫秒；用 1e12 分界（1e12 ms ≈ 2001 年，1e12 s ≈ 33658 年）
    return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
};

/**
 * 代理资格是否有效（决定能不能拿折扣）
 * @param {string} role      用户角色（'agent' 才有资格）
 * @param {*} expireAt       users.agent_expire_at
 * @param {number} [now]     便于测试注入
 * @returns {boolean}
 */
export const isAgentActive = (role, expireAt, now = Date.now()) => {
    if (role !== 'agent') return false;
    const exp = expiryMs(expireAt);
    // 没有到期时间 = 没有真正开通（不是"永久"）。这是刻意的：
    // 让「随手把角色改成代理」不再等于「永久 8 折」。
    return exp > now;
};

/** 代理还剩多少天（给后台/界面展示用；无有效期返回 0） */
export const agentDaysLeft = (expireAt, now = Date.now()) => {
    const exp = expiryMs(expireAt);
    if (!exp || exp <= now) return 0;
    return Math.ceil((exp - now) / DAY_MS);
};

export { DAY_MS };
