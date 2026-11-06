// ============================================================================
// 💳 分站计费（87 期）—— 祥哥 2026-10-25 定的规则
//
//   1. 至尊代理 ¥99/月 只是**资格**，不含分站；
//   2. 每开一个分站再 ¥99/月（想开几个就买几个）；
//   3. 新开站给 **1 天试用**，到期未付费即停站；
//   4. **没有宽限期**：到期就停，只在提前 7/3/1 天（试用是 6/1 小时）提醒；
//   5. 停站 = 域名打 410 墓碑、数据一条不删，续费立刻恢复。
//
// 钱从**主站余额**扣（走 Transaction 流水，site_id 记为 0 = 平台收入）。
// ⚠️ 绝不能用分站自己的支付商户去扣月费 —— 那钱进的是站长自己的口袋。
// ============================================================================

import path from 'path';
import { Site, User, Config, Transaction } from '../models/index.js';
import { Op } from 'sequelize';
import { sendTgMessage } from './tgBot.js';
import { clearSiteCache } from '../middleware/site.js';
import { debitUser, getBalance } from './balance.js';
import { parkDomain, unparkDomain, writeVhost, removeVhost, reloadNginx, ensureCert, domainVhostOwner, resolveDistRoot } from './siteDomain.js';

export const DEFAULTS = {
  siteMonthly: 99,      // 分站 ¥99/月
  agentMonthly: 99,     // 至尊代理 ¥99/月
  trialHours: 0,        // ⛔ 110 期起取消试用（新站直接付费）；保留字段只为兼容历史 trial 站
  renewDays: 30,        // 一次续费 30 天
};

const DAY = 86400e3;
const HOUR = 3600e3;

// 读配置（configs 表，管理员可随时改价，不用改代码）
export const getBillingConfig = async () => {
  const out = { ...DEFAULTS };
  try {
    const rows = await Config.findAll({
      where: { key: ['site_monthly_price', 'agent_monthly_price', 'site_trial_hours'] }
    });
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const num = (v, d) => {
      const n = parseFloat(v);
      return Number.isFinite(n) && n >= 0 ? n : d;
    };
    out.siteMonthly = num(map.site_monthly_price, out.siteMonthly);
    out.agentMonthly = num(map.agent_monthly_price, out.agentMonthly);
    out.trialHours = num(map.site_trial_hours, out.trialHours);
  } catch (e) {
    // 读不到配置就用默认价：不能因为配置表抖动让用户免费开站
  }
  return out;
};

// 生成一个没被占用的免费子域名（*.taikon.top 是泛解析，写条 vhost 就能用）
export const genSubdomain = async () => {
  const suffix = (process.env.SITE_DNS_SUFFIX || 'taikon.top').replace(/^\./, '');
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'; // 去掉易混的 l/o/0/1
  const banned = new Set(['www', 'api', 'admin', 'mail', 'smtp', 'ftp', 'xnow', 'app', 'test', 'beta', 'cdn', 'img', 'static']);
  for (let attempt = 0; attempt < 30; attempt++) {
    let head = '';
    for (let i = 0; i < 6; i++) head += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (banned.has(head)) continue;
    const domain = `${head}.${suffix}`;
    const [a, b] = await Promise.all([
      Site.findOne({ where: { domain } }),
      Site.findOne({ where: { custom_domain: domain } }),
    ]);
    // 🔀 100 期：本机 nginx 里已有这个域名的 vhost（可能是另一环境/已删站残留）也不能用，
    //    否则新站会把别人的 server_name 抢走或反过来被抢。
    if (!a && !b && !domainVhostOwner(domain)) return domain;
  }
  throw new Error('子域名分配失败，请稍后重试');
};

// 扣款并写流水（主站余额）。返回 { ok, balance } 或 { ok:false, message }
// 🔒 走 debitUser（单条 `balance = balance - n WHERE balance >= n`）：
//    以前是「读快照 → 算 → save()」，与另一笔资金动作并发时会互相覆盖。
//    注意**不要**再用 `user.balance = …` 赋值 —— 调用方随后可能 `save()` 整个实例，
//    会把内存里的旧余额写回去。这里用 setDataValue 只同步内存显示、不标脏。
export const chargeBalance = async (user, amount, type, description, transaction) => {
  let balance;
  try {
    balance = await debitUser(user.id, amount, { transaction });
  } catch (e) {
    if (e && e.code === 'INSUFFICIENT_BALANCE') {
      const now = await getBalance(user.id, { transaction });
      const cur = Number(now === null ? 0 : now);
      return { ok: false, message: `余额不足：需要 ¥${Number(amount).toFixed(2)}，当前余额 ¥${cur.toFixed(2)}。请先充值。` };
    }
    throw e;
  }
  const before = Number((Number(balance) + Number(amount)).toFixed(6));
  try { user.setDataValue('balance', balance); } catch (e) { /* 非模型实例则忽略 */ }
  await Transaction.create({
    user_id: user.id,
    phone: user.phone,
    amount: -amount,
    balance,
    type,
    description,
    site_id: 0, // 平台收入，不属于任何分站
  }, { transaction });
  return { ok: true, balance, before };
};

const fmtDate = (ms) => {
  if (!ms) return '—';
  const d = new Date(Number(ms));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// 到期时间（毫秒）→ 剩余天数（向下取整，越小越紧迫）
const daysLeft = (ms, now = Date.now()) => Math.floor((Number(ms) - now) / DAY);
const hoursLeft = (ms, now = Date.now()) => Math.floor((Number(ms) - now) / HOUR);

const hasKey = (keys, k) => String(keys || '').split(',').filter(Boolean).includes(k);
const addKey = (keys, k) => {
  const set = new Set(String(keys || '').split(',').filter(Boolean));
  set.add(k);
  return [...set].join(',').slice(0, 40);
};

/**
 * 定时体检：过期停站 + 提前提醒。建议每 10 分钟跑一次。
 */
export const runSiteBillingCheck = async () => {
  const now = Date.now();
  const report = { expiredSites: 0, expiredAgents: 0, reminded: 0 };

  try {
    // ── ① 分站到期 → 停站（无宽限）──
    const sites = await Site.findAll();
    for (const site of sites) {
      const exp = Number(site.expire_at || 0);
      if (!exp) continue; // 0 = 老数据/不计费，永不过期

      const owner = await User.findByPk(site.owner_id);
      if (!owner) continue;

      if (now >= exp) {
        if (site.status !== 'expired') {
          // 🔒 先做**条件式原子更新**，再动 nginx。
          //    以前的写法是无条件 `site.save()`（整行回写），而 `sites` 是遍历开始时的一次性快照：
          //    站长在这个窗口里付钱续费（expire_at 推到 30 天后、status='active'），
          //    随后这次 save() 会把 expire_at/status 又写回过期 → 「钱付了、站被停，
          //    域名还进了 410 墓碑」。代价是毫秒级窗口，但它正好落在「过期后点续费」的主流程上。
          const [stopped] = await Site.update(
            { status: 'expired', stop_reason: 'plan', domain_status: 'none' },
            { where: { id: site.id, expire_at: { [Op.lte]: now }, status: { [Op.ne]: 'expired' } } }
          );
          if (!stopped) continue;      // 这一瞬间已被续费 / 已被别的轮次停过 → 完全不碰 vhost

          // 二次确认：更新之后再看一眼最新行，防止「刚续费」被我们抢在前面写成了过期
          const fresh = await Site.findByPk(site.id);
          if (!fresh || Number(fresh.expire_at || 0) > now) {
            await Site.update({ status: 'active', stop_reason: null }, { where: { id: site.id } }).catch(() => {});
            report.reverted = (report.reverted || 0) + 1;
            continue;
          }

          // 停站 = 先拆掉真实 vhost（否则同名 server 会和墓碑打架、谁先加载谁生效），
          //        再立 410 墓碑（域名仍归他，别人抢不走，访客看到「站点已下线」而不是平台首页）
          for (const d of [site.domain, site.custom_domain].filter(Boolean)) {
            try { removeVhost(site.id, d); } catch (e) {}
            try { parkDomain(d); } catch (e) {}
          }
          try { reloadNginx(); } catch (e) {}
          // 96 期：停站同样要清缓存，否则这 60 秒内域名还能按分站解析到后端
          try { clearSiteCache(); } catch (e) {}
          report.expiredSites++;
          await sendTgMessage(
            `⏰ <b>分站已到期停站</b>\n🏬 ${site.name}\n🌐 <code>${site.domain}</code>\n` +
            `👤 站长: ${owner.phone}\n💡 数据全部保留，续费 ¥${(await getBillingConfig()).siteMonthly}/月 即可恢复`
          );
        }
        continue;
      }

      // 未到期 → 按档位提醒（只提醒一次）
      const isTrial = site.plan === 'trial';
      const buckets = isTrial ? [6, 1] : [7, 3, 1];
      let keys = site.remind_keys || '';
      for (const b of buckets) {
        const key = isTrial ? `t${b}` : String(b);
        if (hasKey(keys, key)) continue;
        const left = isTrial ? hoursLeft(exp, now) : daysLeft(exp, now);
        if (left > b) continue;
        if (left < 0) continue;
        keys = addKey(keys, key);
        site.remind_keys = keys;
        await site.save();
        report.reminded++;
        const when = isTrial ? `${b} 小时` : `${b} 天`;
        await sendTgMessage(
          `🔔 <b>分站${isTrial ? '试用' : '月费'}即将到期（剩 ${when}）</b>\n` +
          `🏬 ${site.name}\n🌐 <code>${site.domain}</code>\n👤 站长: ${owner.phone}\n` +
          `⏳ 到期时间: ${fmtDate(exp)}\n` +
          `⚠️ 到期即停站（无宽限期），数据保留，续费即可恢复`
        );
        break;
      }
    }

    // ── ② 代理到期 → 降级 + 停他的站 ──
    const agents = await User.findAll();
    for (const u of agents) {
      const exp = Number(u.agent_expire_at || 0);
      if (!exp) continue;
      const isAgent = u.role === 'agent';

      if (now >= exp) {
        if (isAgent) {
          // 💰 110 期（祥哥定调）：**代理到期不停站**，分站照常运营。
          //    代理资格只值"进货价 8 折"，到期就把名下各站的进货折扣调回原价（1.0），
          //    站长继续卖、继续赚，只是每单成本高 25%。想回到 8 折续费代理即可。
          // 🔒 条件式原子降级：同一理由（快照 + 无条件 save 会覆盖并发续费）。
          //    只有「此刻仍是 agent 且确实到期」的行才会被改成 user。
          const [downgraded] = await User.update(
            { role: 'user' },
            { where: { id: u.id, role: 'agent', agent_expire_at: { [Op.lte]: now } } }
          );
          if (!downgraded) continue;      // 刚刚续费了 → 别动他的折扣

          report.expiredAgents++;
          const mine = await Site.findAll({ where: { owner_id: u.id } });
          // 折扣一次性改回原价，只更新这一列（公式化，不会碰其他字段）
          await Site.update({ agent_discount: 1 }, { where: { owner_id: u.id, agent_discount: { [Op.ne]: 1 } } });
          let changed = 0;
          for (const s of mine) { if (Number(s.agent_discount) !== 1) changed++; }
          await sendTgMessage(
            `⏰ <b>至尊代理已到期</b>\n👤 ${u.phone}\n` +
            `💡 名下 ${mine.length} 个分站<b>继续正常运营</b>，进货价已回到原价（${changed} 个站受影响）；续费代理即恢复 8 折`
          );
        }
        continue;
      }

      if (!isAgent) continue;
      let keys = u.agent_remind_keys || '';
      for (const b of [7, 3, 1]) {
        if (hasKey(keys, String(b))) continue;
        const left = daysLeft(exp, now);
        if (left > b || left < 0) continue;
        keys = addKey(keys, String(b));
        u.agent_remind_keys = keys;
        await u.save();
        report.reminded++;
        await sendTgMessage(
          `🔔 <b>至尊代理即将到期（剩 ${b} 天）</b>\n👤 ${u.phone}\n⏳ ${fmtDate(exp)}\n` +
          `⚠️ 到期后进货价回到原价（分站照常运营，不受影响）`
        );
        break;
      }
    }
  } catch (e) {
    console.error('[billing] 到期体检失败:', e.message);
  }

  if (report.expiredSites || report.expiredAgents || report.reminded) {
    console.log(`[billing] 停站 ${report.expiredSites} 个 / 代理降级 ${report.expiredAgents} 个 / 提醒 ${report.reminded} 条`);
  }
  return report;
};

// 续费/开通分站一个月（同时恢复被停的站）
export const renewSite = async (site, user) => {
  const cfg = await getBillingConfig();
  const amount = cfg.siteMonthly;
  const now = Date.now();
  const base = Math.max(now, Number(site.expire_at || 0));
  const next = base + cfg.renewDays * DAY;

  return { amount, next, cfg };
};

export const restoreSiteDomain = async (site) => {
  try {
    if (site.domain) unparkDomain(site.domain);
    if (site.custom_domain) unparkDomain(site.custom_domain);
    const target = site.custom_domain || site.domain;
    if (target) {
      // ⚠️ 必须用绝对路径：写成相对路径 client/dist 时，nginx 会按自己的前缀解析成
      //    /etc/nginx/client/dist → 首页 500（还伴随 rewrite cycle 报错）。实测踩到过。
      const distRoot = resolveDistRoot();
      const cert = await ensureCert(target, distRoot);
      const backendPort = parseInt(process.env.PORT) || 3000;
      writeVhost({ siteId: site.id, domain: target, backendPort, distRoot, cert });
      site.cert_mode = cert.mode;
      site.domain_status = 'active';
    }
    reloadNginx();
  } catch (e) {
    console.error('[billing] 恢复域名失败:', e.message);
  }
};

export const fmt = fmtDate;
