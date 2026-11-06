// 带超时 + 有限重试的 fetch 包装
// ---------------------------------------------------------------------------
// 为什么需要它（2026-11-03「拉不到服务」）：
//   服务清单在生产上已经涨到 **2809 条 / 714,777 字节**，实测首字节 1.44 秒、
//   下完整 2.2 秒（桌面宽带）。手机 + 弱网下这个请求要几十秒，而**原生 fetch 没有超时** ——
//   请求就那么挂着，界面表现是「一直转圈 / 拉不到服务」，用户永远等不到一个结论。
//
// 规则：
//   · 超时就 abort，把"慢"变成"明确的失败"，界面才可能给出可操作提示；
//   · 只重试网络错误与 5xx —— 4xx（含 401 登录失效）重试毫无意义，只会把用户多晾 1 秒；
//   · 重试之间退避 600ms / 1200ms，给服务端喘口气（服务清单接口本身就在 1.4 秒量级）。
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 20000,
  retries = 1,
): Promise<Response> {
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(input, { ...init, signal: ctrl.signal });
      clearTimeout(timer);

      if (res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('请求失败');
}
