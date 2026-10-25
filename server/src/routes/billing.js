// ============================================================================
// 💳 计费接口（87 期）
//   GET  /api/billing/plan                —— 价格与试用规则（前台展示用）
//   GET  /api/billing/status              —— 我的代理/分站到期情况
//   POST /api/billing/agent/subscribe     —— 开通/续费至尊代理 ¥99/月
//   POST /api/billing/site/:id/renew      —— 续费某个分站 ¥99/月（并恢复停站）
// 钱一律从主站余额扣，写 Transaction 流水（site_id=0 记平台收入）。
// ============================================================================

import express from 'express';
import { sequelize, Site, User, Config } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { clearSiteCache } from '../middleware/site.js';
import {
  getBillingConfig, chargeBalance, renewSite, restoreSiteDomain, fmt,
} from '../utils/siteBilling.js';

const router = express.Router();
const DAY = 86400e3;
// 💰 至尊代理的进货折扣（8 折）。代理到期后名下站点回落到 1（原价），续费再回来。
const AGENT_DISCOUNT = 0.8;

const publicUser = (u) => ({
  id: u.id, phone: u.phone, role: u.role, balance: u.balance,
  agent_expire_at: Number(u.agent_expire_at || 0),
});

// ── 价格与规则 ──────────────────────────────────────────────────────────────
router.get('/plan', async (req, res) => {
  try {
    const cfg = await getBillingConfig();
    res.json({
      status: 'success',
      data: {
        agent_monthly: cfg.agentMonthly,
        site_monthly: cfg.siteMonthly,
        // ⛔ 110 期取消 1 天体验：这里恒为 0，任何客户端都不该再拿它当"免费时长"
      trial_hours: 0,
        renew_days: cfg.renewDays,
        rules: {
          agent_includes_site: false,          // 代理费不含分站
          no_grace_period: true,               // 到期就停，无宽限
          remind_days: [7, 3, 1],              // 提前提醒
          trial_remind_hours: [],              // 试用已取消，不再有试用提醒
          data_kept_after_expire: true,        // 停站不删数据
        },
      },
    });
  } catch (e) {
    res.json({ status: 'error', message: e.message });
  }
});

// ── 我的到期情况 ────────────────────────────────────────────────────────────
router.get('/status', authenticate, async (req, res) => {
  try {
    const me = await User.findByPk(req.user.id);
    const sites = await Site.findAll({ where: { owner_id: me.id }, order: [['id', 'ASC']] });
    const now = Date.now();
    res.json({
      status: 'success',
      data: {
        user: publicUser(me),
        agent: {
          active: me.role === 'agent' || ['admin', 'super_admin'].includes(me.role),
          expire_at: Number(me.agent_expire_at || 0),
          expire_text: fmt(me.agent_expire_at),
          days_left: me.agent_expire_at ? Math.floor((Number(me.agent_expire_at) - now) / DAY) : null,
        },
        sites: sites.map(s => ({
          id: s.id, name: s.name, domain: s.custom_domain || s.domain, status: s.status, plan: s.plan,
        stop_reason: s.stop_reason || null,
          expire_at: Number(s.expire_at || 0),
          expire_text: fmt(s.expire_at),
          days_left: s.expire_at ? Math.floor((Number(s.expire_at) - now) / DAY) : null,
          needs_payment: s.expire_at > 0 && Number(s.expire_at) <= now,
        })),
      },
    });
  } catch (e) {
    res.json({ status: 'error', message: e.message });
  }
});

// ── 开通/续费至尊代理 ───────────────────────────────────────────────────────
router.post('/agent/subscribe', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const cfg = await getBillingConfig();
    const me = await User.findByPk(req.user.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!me) { await t.rollback(); return res.status(404).json({ status: 'error', message: '用户不存在' }); }

    const pay = await chargeBalance(me, cfg.agentMonthly, '代理月费',
      `至尊代理月费 ¥${cfg.agentMonthly}（${cfg.renewDays} 天）`, t);
    if (!pay.ok) { await t.rollback(); return res.json({ status: 'error', message: pay.message }); }

    const base = Math.max(Date.now(), Number(me.agent_expire_at || 0));
    me.agent_expire_at = base + cfg.renewDays * DAY;
    me.agent_remind_keys = '';
    if (!['admin', 'super_admin'].includes(me.role)) me.role = 'agent';
    await me.save({ transaction: t });

    // 💰 110 期：代理到期不停站（站一直正常运营），只是进货价回落到原价。
    //    那么代理一续上，名下各站的进货折扣要**立刻恢复 8 折** ——
    //    否则站长交了钱拿货还是原价，等于白交。
    let discounted = 0;
    try {
      const mine = await Site.findAll({ where: { owner_id: me.id }, transaction: t });
      for (const site of mine) {
        if (Number(site.agent_discount) !== AGENT_DISCOUNT) {
          site.agent_discount = AGENT_DISCOUNT;
          await site.save({ transaction: t });
          discounted++;
        }
      }
    } catch (e) {
      console.error('[billing] 恢复名下分站 8 折失败:', e.message);
    }

    await t.commit();
    res.json({
      status: 'success',
      message: discounted
        ? `至尊代理已开通 ${cfg.renewDays} 天（扣 ¥${cfg.agentMonthly}）｜名下 ${discounted} 个分站进货价已回到 8 折`
        : `至尊代理已开通 ${cfg.renewDays} 天（扣 ¥${cfg.agentMonthly}）`,
      data: {
        user: publicUser(me),
        expire_at: Number(me.agent_expire_at),
        expire_text: fmt(me.agent_expire_at),
        discounted_sites: discounted,
      },
    });
  } catch (e) {
    try { await t.rollback(); } catch (_) {}
    res.status(500).json({ status: 'error', message: '开通失败: ' + e.message });
  }
});

// ── 续费分站 ────────────────────────────────────────────────────────────────
router.post('/site/:id/renew', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const site = await Site.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!site) { await t.rollback(); return res.status(404).json({ status: 'error', message: '分站不存在' }); }
    const isStaff = ['admin', 'super_admin'].includes(req.user.role);
    if (!isStaff && site.owner_id !== req.user.id) {
      await t.rollback();
      return res.status(403).json({ status: 'error', message: '无权操作此分站' });
    }

    const me = await User.findByPk(site.owner_id, { transaction: t, lock: t.LOCK.UPDATE });
    const cfg = await getBillingConfig();
    const { amount, next } = await renewSite(site, me);

    const pay = await chargeBalance(me, amount, '分站月费',
      `分站「${site.name}」月费 ¥${amount}（${site.domain}，${cfg.renewDays} 天）`, t);
    if (!pay.ok) { await t.rollback(); return res.json({ status: 'error', message: pay.message }); }

    site.expire_at = next;
    site.plan = 'paid';
    site.remind_keys = '';
    if (site.status === 'expired') {
      site.status = 'active';
      site.stop_reason = null;
    }
    await site.save({ transaction: t });
    await t.commit();

    // 停过的站要把域名恢复回来（写 vhost / 拆墓碑），失败不影响续费本身
    if (site.status === 'active') {
      restoreSiteDomain(site).catch(() => {});
    }
    // 🔴 96 期：续费后必须立刻清域名缓存。
    //    否则最长 60 秒内这个域名仍被当成"没有站点"→ 按主站返回品牌与价格，
    //    客户会看到平台的名字（实测 site_name=XNOW，红线）。
    try { clearSiteCache(); } catch (e) {}

    res.json({
      status: 'success',
      message: `分站已续费 ${cfg.renewDays} 天（扣 ¥${amount}）`,
      data: {
        site: { id: site.id, status: site.status, plan: site.plan, expire_at: Number(site.expire_at), expire_text: fmt(site.expire_at) },
        balance: pay.balance,
      },
    });
  } catch (e) {
    try { await t.rollback(); } catch (_) {}
    res.status(500).json({ status: 'error', message: '续费失败: ' + e.message });
  }
});

export default router;
