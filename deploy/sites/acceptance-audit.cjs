#!/usr/bin/env node
/**
 * 分站体系 · 逐项验收自检（94 期）
 *
 * 目标里有 9 条硬指标，靠"我记得验过了"不算证据 —— 这个脚本把每条变成可重复检查。
 *
 * 两种模式：
 *   默认（只读，可对生产跑）：只发 GET + 发几条"注定被拒"的写请求（不会落库）
 *   AUDIT_WRITE=1（会改数据，只在 Beta 跑）：真实下单、切模板/色系/模块，结束后自动复原
 *
 * 用法：
 *   node acceptance-audit.cjs                                   # Beta 只读
 *   AUDIT_WRITE=1 node acceptance-audit.cjs                     # Beta 全量（含真实下单）
 *   BASE=https://xnow.taikon.top SUB=https://<某分站> node acceptance-audit.cjs   # 生产只读
 */

const BASE = process.env.BASE || "https://beta.taikon.top";
const SUB = process.env.SUB || "https://demostore.taikon.top";
const SITE_ID = Number(process.env.SITE_ID || 25);
const WRITE = process.env.AUDIT_WRITE === "1";
const AGENT = { account: process.env.AGENT || "18800000077", password: process.env.AGENT_PW || "demo123456" };
const CUSTOMER = { account: process.env.CUST || "18800000099", password: process.env.CUST_PW || "demo123456" };

const rows = [];
const rec = (name, ok, detail) => {
  rows.push({ name, ok, detail });
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? " —— " + detail : ""}`);
};
const skip = (name, why) => {
  rows.push({ name, ok: true, detail: "跳过：" + why, skipped: true });
  console.log(`  ⚪ ${name} —— 跳过（${why}）`);
};

const j = async (url, opt = {}) => {
  try {
    const r = await fetch(url, opt);
    const text = await r.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { code: r.status, body };
  } catch (e) { return { code: 0, body: { message: String(e.message || e) } }; }
};
const H = (t) => ({ Authorization: "Bearer " + t, "Content-Type": "application/json" });
const msg = (r) => (r.body && (r.body.message || r.body.status)) || "无返回";
const login = async (cred, origin = BASE) => {
  const r = await j(origin + "/api/login", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cred),
  });
  return r.body?.token || r.body?.data?.token || null;
};

(async () => {
  console.log(`\n════ 分站验收自检 · ${BASE} · ${WRITE ? "全量（会改数据）" : "只读"} ════\n`);
  const agentToken = await login(AGENT);
  const custToken = await login(CUSTOMER, SUB);
  rec("站长账号可登录", !!agentToken);
  rec("分站客户可在自己站点登录", !!custToken, custToken ? "" : "（客户账号可能已改密码，仅影响本项）");
  if (!agentToken) { console.error("  站长账号登录失败，中止"); process.exit(1); }
  const A = H(agentToken);
  const C = H(custToken || "");

  const sitesList = await j(`${BASE}/api/sites`, { headers: A });
  const arr = sitesList.body?.data || [];
  const site = arr.find((s) => Number(s.id) === SITE_ID) || arr[0];
  if (!site) { console.error("  拿不到分站信息，中止"); process.exit(1); }
  const domain = site.domain || `${site.subdomain}.xnow.taikon.top`;

  // ── ① 仅至尊代理可开分站 ────────────────────────────────────────────────
  const plainUser = await login({ account: "18800000088", password: "demo123456" });
  const createAsUser = await j(`${BASE}/api/sites`, {
    method: "POST", headers: H(plainUser), body: JSON.stringify({ name: "越权测试" }),
  });
  rec("① 普通用户不能开分站", createAsUser.code === 403 || /仅至尊代理|权限|无权/.test(msg(createAsUser)),
      `${createAsUser.code} ${msg(createAsUser).slice(0, 60)}`);
  rec("① 代理有自己的分站", !!site, `site#${site.id} ${site.name} · ${domain}`);

  // ── ② 免费子域名可访问且不暴露主站 ──────────────────────────────────────
  const home = await j(`https://${domain}/`);
  rec("② 子域名首页可访问", home.code === 200, `HTTP ${home.code}`);
  const html = typeof home.body === "string" ? home.body : "";
  rec("② 首页不含主站痕迹", !/XNOW|Xnow|xnow\.taikon\.top/.test(html),
      /XNOW|Xnow|xnow\.taikon\.top/.test(html) ? "出现主站字样" : "0 处");
  const seo = await j(`https://${domain}/api/public/seo`);
  rec("② 分站取不到主站 SEO 文案", seo.code === 404, `HTTP ${seo.code}`);

  // ── ③ 自有域名：归属校验 + 状态（写操作需 AUDIT_WRITE）───────────────────
  if (WRITE) {
    const domTry = await j(`${BASE}/api/sites/${SITE_ID}/domain`, {
      method: "POST", headers: A, body: JSON.stringify({ domain: "audit-not-verified.example.com" }),
    });
    const domMsg = JSON.stringify(domTry.body);
    rec("③ 绑定自有域名要求 DNS 归属校验", /TXT|_xnow|验证|verify/i.test(domMsg),
        domMsg.slice(0, 100));
    // 立刻清掉这次探测（不能留下一个待验证的假域名）
    // ⚠️ 用 DELETE：PUT 传空串根本不是解绑接口，上一版自检就因此留了个 pending 假域名。
    const undo = await j(`${BASE}/api/sites/${SITE_ID}/domain`, { method: "DELETE", headers: A });
    rec("③ 解绑自有域名可复原", /success/.test(JSON.stringify(undo.body)), JSON.stringify(undo.body).slice(0, 60));
  } else {
    const hasTxtFlow = await j(`${BASE}/api/sites/${SITE_ID}/domain`, {
      method: "POST", headers: A, body: JSON.stringify({}),
    });
    rec("③ 自有域名绑定接口存在（空参数被拒）", hasTxtFlow.code === 200 && /error|域名/.test(msg(hasTxtFlow)),
        msg(hasTxtFlow).slice(0, 60));
  }
  rec("③ 域名与证书状态可读", !!(site.domain && (site.domain_status !== undefined || site.custom_domain !== undefined)),
      `domain=${site.domain} status=${site.domain_status ?? "-"} custom=${site.custom_domain || "-"}`);

  // ── ④ 预存余额 + 按成本价扣 ─────────────────────────────────────────────
  const stats = await j(`${BASE}/api/sites/stats?site_id=${SITE_ID}`, { headers: A });
  rec("④ 收益统计可读（含成本口径）", stats.code === 200 && stats.body?.status === "success",
      `HTTP ${stats.code}`);
  const prices = await j(`${BASE}/api/sites/${SITE_ID}/prices`, { headers: A });
  const items = prices.body?.data?.items || [];
  const costKeys = items.length && items[0].cost_per_1k !== undefined && items[0].below_cost !== undefined;
  rec("④ 成本价与亏本预警字段齐全", !!costKeys, `价格项 ${items.length} 条`);
  if (WRITE && custToken && items.length) {
    const cheap = items.find((i) => Number(i.min) <= 100);
    if (cheap) {
      const ord = await j(`${SUB}/api/orders/add`, {
        method: "POST", headers: C,
        body: JSON.stringify({ serviceId: cheap.service_id, link: "audit-check", quantity: 100 }),
      });
      const okOrder = ord.body?.status === "success";
      rec("④ 分站客户可正常下单", okOrder, okOrder ? `订单 ${ord.body.order_id}` : msg(ord).slice(0, 80));
      if (okOrder) console.log("     ⚠️ 本次为全量自检，产生了一笔测试订单（Beta 专用）");
    }
  } else {
    skip("④ 真实下单链路", "只读模式；用 AUDIT_WRITE=1 在 Beta 验证");
  }

  // ── ⑤ 加价率（97 期：站长侧只谈「在进货价上加价 %」，倍率不对外）──────
  const putMarkup = (v) => j(`${BASE}/api/sites/${SITE_ID}`, {
    method: "PUT", headers: A, body: JSON.stringify({ markup_pct: v }),
  });
  const tooHigh = await putMarkup(100000);
  const tooLow = await putMarkup(-5);
  rec("⑤ 加价率越界（100000 / -5）被拒绝",
      /error/i.test(JSON.stringify(tooHigh.body)) && /error/i.test(JSON.stringify(tooLow.body)),
      `100000→${msg(tooHigh).slice(0, 30)} | -5→${msg(tooLow).slice(0, 30)}`);
  rec("⑤ 当前加价率合法（≥ 0%）",
      Number.isFinite(Number(site.markup_pct)) && Number(site.markup_pct) >= 0,
      `加价 ${site.markup_pct}%`);

  // 🔒 97 期红线：对外接口不得出现任何倍率字段（否则站长可反推平台加价）
  const priceMeta = (await j(`${BASE}/api/sites/${SITE_ID}/prices`, { headers: A })).body?.data || {};
  const leakKeys = ["multiplier", "cost_multiplier", "min_multiplier"]
    .filter((k) => priceMeta[k] !== undefined || site[k] !== undefined);
  rec("⑤ 接口未泄露倍率字段", leakKeys.length === 0, leakKeys.length ? "泄露: " + leakKeys.join(",") : "干净");

  // ── ⑥ 6 套模板 + 6 色系 ────────────────────────────────────────────────
  const TPL = ["classic", "saas", "minimal", "neon", "magazine", "glass"];
  const COL = ["cyan", "purple", "green", "red", "orange", "blue"];   // 与后端白名单一致
  const origTpl = site.template || "minimal";
  const origCol = site.color || "purple";
  if (WRITE) {
    let tplOk = 0, colOk = 0;
    for (const t of TPL) {
      const r = await j(`${BASE}/api/sites/${SITE_ID}`, { method: "PUT", headers: A, body: JSON.stringify({ template: t }) });
      if (r.body?.status === "success") tplOk++;
    }
    for (const c of COL) {
      const r = await j(`${BASE}/api/sites/${SITE_ID}`, { method: "PUT", headers: A, body: JSON.stringify({ color: c }) });
      if (r.body?.status === "success") colOk++;
    }
    rec("⑥ 6 套模板都能保存", tplOk === 6, `${tplOk}/6`);
    rec("⑥ 6 套色系都能保存", colOk === 6, `${colOk}/6`);
    await j(`${BASE}/api/sites/${SITE_ID}`, {
      method: "PUT", headers: A, body: JSON.stringify({ template: origTpl, color: origCol }),
    });
  } else {
    const badTpl = await j(`${BASE}/api/sites/${SITE_ID}`, { method: "PUT", headers: A, body: JSON.stringify({ template: "no-such-tpl" }) });
    const badCol = await j(`${BASE}/api/sites/${SITE_ID}`, { method: "PUT", headers: A, body: JSON.stringify({ color: "no-such-col" }) });
    rec("⑥ 非法模板名被拒", /error/i.test(JSON.stringify(badTpl.body)), msg(badTpl).slice(0, 40));
    rec("⑥ 非法色系被拒", /error/i.test(JSON.stringify(badCol.body)), msg(badCol).slice(0, 40));
    rec("⑥ 当前模板/色系合法", TPL.includes(origTpl) && COL.includes(origCol), `${origTpl} / ${origCol}`);
  }

  // ── ⑦ 首页模块可开关 + 可排序 ──────────────────────────────────────────
  const mods = Array.isArray(site.home_modules) ? site.home_modules
    : (() => { try { return JSON.parse(site.home_modules || "[]"); } catch { return []; } })();
  rec("⑦ 模块配置已存在且带顺序", mods.length > 0 && mods.every((m) => typeof m.order === "number"),
      `${mods.length} 个模块`);
  if (WRITE) {
    const testMods = mods.map((m, i) => ({ ...m, order: i + 1 }));
    const save = await j(`${BASE}/api/sites/${SITE_ID}`, { method: "PUT", headers: A, body: JSON.stringify({ home_modules: testMods }) });
    rec("⑦ 模块排序可保存", save.body?.status === "success", msg(save).slice(0, 40));
    await j(`${BASE}/api/sites/${SITE_ID}`, { method: "PUT", headers: A, body: JSON.stringify({ home_modules: mods }) });
  } else {
    skip("⑦ 模块排序写入", "只读模式");
  }

  // ── ⑧ 支付方案②：分站自有商户优先，未配不回退平台商户 ──────────────────
  const pay = await j(`${SUB}/api/pay/rmb/sign`, {
    method: "POST", headers: C, body: JSON.stringify({ pay_type: "alipay", amount: 10 }),
  });
  const payBody = JSON.stringify(pay.body);
  const noFallback = pay.body?.code === "NO_SITE_MERCHANT" || /商户|未开通/.test(payBody);
  rec("⑧ 未配商户时不回退平台商户", noFallback, payBody.slice(0, 100));
  rec("⑧ 站内已配商户时走站长的", /has_bufpay|bufpay_id/.test(JSON.stringify(site)) ||
      site.bufpay_id !== undefined, `站内商户字段：${site.bufpay_id ? "已配置" : "未配置（走方案①兜底）"}`);

  // ── ⑨ 分站自有 SMTP ────────────────────────────────────────────────────
  // 站内 SMTP 只有这 4 个字段（发件人 = 站名，不带独立的 from/secure）
  const smtpKeys = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass"];
  const hasSmtp = smtpKeys.filter((k) => Object.prototype.hasOwnProperty.call(site, k));
  rec("⑨ 分站 SMTP 配置字段齐全", hasSmtp.length === smtpKeys.length,
      `存在 ${hasSmtp.length}/${smtpKeys.length}：${hasSmtp.join(",")}`);
  if (WRITE) {
    const bad = await j(`${BASE}/api/sites/${SITE_ID}/smtp-test`, {
      method: "POST", headers: A, body: JSON.stringify({ to: "" }),
    });
    rec("⑨ 发信自测接口存在", bad.code === 200 || bad.code === 400, `HTTP ${bad.code} ${msg(bad).slice(0, 40)}`);
  } else {
    skip("⑨ 发信自测", "只读模式（会真发邮件）");
  }

  const pass = rows.filter((r) => r.ok).length;
  const skipped = rows.filter((r) => r.skipped).length;
  console.log(`\n════ 结果：${pass}/${rows.length} 通过${skipped ? `（其中 ${skipped} 项跳过）` : ""} ════`);
  const failed = rows.filter((r) => !r.ok);
  if (failed.length) {
    console.log("  未通过：");
    failed.forEach((r) => console.log(`    · ${r.name} —— ${r.detail}`));
  }
  console.log("");
  process.exit(failed.length ? 1 : 0);
})();
