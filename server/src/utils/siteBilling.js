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
import { sendTgMessage } from './tgBot.js';
import { clearSiteCache } from '../middleware/site.js';
import { parkDomain, unparkDomain, writeVhost, removeVhost, reloadNginx, ensureCert, domainVhostOwner, resolveDistRoot } from './siteDomain.js';

export const DEFAULTS = {
  siteMonthly: 99,      // 分站 ¥99/月
  agentMonthly: 99,     // 至尊代理 ¥99/月
  trialHours: 24,       // 新站试用 1 天
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
export const chargeBalance = async (user, amount, type, description, transaction) => {
  const bal = parseFloat(user.balance || 0);
  if (!Number.isFinite(bal) || bal < amount) {
    return { ok: false, message: `余额不足：需要 ¥${amount.toFixed(2)}，当前余额 ¥${bal.toFixed(2)}。请先充值。` };
  }
  const before = bal;
  user.balance = (bal - amount).toFixed(6);
  await user.save({ transaction });
  await Transaction.create({
    user_id: user.id,
    phone: user.phone,
    amount: -amount,
    balance: user.balance,
    type,
    description,
    site_id: 0, // 平台收入，不属于任何分站
  }, { transaction });
  return { ok: true, balance: user.balance, before };
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
          // 停站 = 先拆掉真实 vhost（否则同名 server 会和墓碑打架、谁先加载谁生效），
          //        再立 410 墓碑（域名仍归他，别人抢不走，访客看到「站点已下线」而不是平台首页）
          for (const d of [site.domain, site.custom_domain].filter(Boolean)) {
            try { removeVhost(site.id, d); } catch (e) {}
            try { parkDomain(d); } catch (e) {}
          }
          try { reloadNginx(); } catch (e) {}
          site.status = 'expired';
          site.stop_reason = 'plan';   // 本站月费到期：给这个站续费才能恢复
          site.domain_status = 'none';
          await site.save();
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
          u.role = 'user';
          await u.save();
          report.expiredAgents++;
          const mine = await Site.findAll({ where: { owner_id: u.id } });
          let changed = 0;
          for (const s of mine) {
            if (Number(s.agent_discount) !== 1) {
              s.agent_discount = 1;          // 原价进货
              await s.save();
              changed++;
            }
          }
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
          `⚠️ 到期后代理资格与名下分站都会暂停`
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
