import express from 'express';
import { Site, User } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { sendTgMessage } from '../utils/tgBot.js';
import { sanitizeAnnouncement } from '../utils/sanitize.js';

const router = express.Router();

const DEFAULT_AGENT_DISCOUNT = 0.8;

// 🔒 定价护栏：分站倍率与代理折扣会覆盖全局定价，低于成本价等于平台每单倒贴。
// 成交价见 orders.js：代理 = multiplier × agent_discount，其余角色 = multiplier，
// 而上游始终按 service.rate 实扣，所以两者都必须 ≥ 1.0（倍率 1.0 = 上游成本价）。
const pricingError = (multiplier, agentDiscount) => {
  const m = parseFloat(multiplier);
  if (!isFinite(m) || m <= 0) return '分站倍率必须为大于 0 的数字';
  // 祥哥定调：站主可自定义 1~100 倍
  if (m > 100) return `分站倍率上限 100 倍（当前 ${m}）`;
  // 🔒 倍率下界必须单独拦：普通/黄金用户成交价 = 倍率本身（orders.js 里只有 agent 才乘折扣），
  // 所以倍率 < 1 时这些用户每单都让平台倒贴。
  // 不独立拦的话，可拿「倍率 0.05 + 折扣 100」凑出 0.05×100=5 骗过下面的乘积校验。
  if (m < 1) return `定价过低：分站倍率 ${m} 低于成本倍率 1.0，普通用户下单平台每单将亏损`;
  // 🔒 只有「没传」才回落到默认值；传了值就必须合法。
  // 不能把非法值悄悄换成默认值拿去校验 —— 那样校验会通过，而下面落库的仍是原始非法值，
  // 结果是「响应说更新成功、库里存着 NaN/-1」，此后该分站所有代理下单都被 orders.js
  // 的价格护栏拒掉（"价格异常，请联系管理员"），站长却查不出原因。
  let discount = DEFAULT_AGENT_DISCOUNT;
  if (agentDiscount !== undefined && agentDiscount !== null && agentDiscount !== '') {
    const d = parseFloat(agentDiscount);
    if (!isFinite(d) || d <= 0) return '代理折扣必须为大于 0 的数字';
    discount = d;
  }
  if (m * discount < 1) {
    return `定价过低：倍率 ${m} × 代理折扣 ${discount} = ${(m * discount).toFixed(2)}，低于成本倍率 1.0，代理下单平台每单将亏损`;
  }
  return null;
};

// 获取所有分站（管理员看全部，代理看自己的）
router.get('/stats', authenticate, async (req, res) => {
  // 📊 分站收益报表：营收 / 成本 / 毛利，站主与管理员可见
  try {
    const siteId = parseInt(req.query.site_id || 0);
    if (!siteId) return res.json({ status: 'error', message: '缺少 site_id' });

    const site = await Site.findByPk(siteId);
    if (!site) return res.json({ status: 'error', message: '分站不存在' });
    const isStaff2 = ['admin', 'super_admin'].includes(req.user.role);
    if (!isStaff2 && site.owner_id !== req.user.id) {
      return res.status(403).json({ status: 'error', message: '无权查看该分站' });
    }

    const { sequelize } = await import('../models/index.js');
    const [rows] = await sequelize.query(
      `SELECT COUNT(*) AS total_orders,
              COALESCE(SUM(charge), 0) AS revenue,
              COALESCE(SUM(site_cost), 0) AS cost,
              COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END), 0) AS today_orders,
              COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN charge ELSE 0 END), 0) AS today_revenue,
              COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN site_cost ELSE 0 END), 0) AS today_cost
       FROM orders WHERE site_id = ?`,
      { replacements: [siteId] }
    );
    const [userRows] = await sequelize.query(
      'SELECT COUNT(*) AS total_users FROM users WHERE site_id = ?',
      { replacements: [siteId] }
    );

    const r = rows[0] || {};
    const revenue = parseFloat(r.revenue || 0);
    const cost = parseFloat(r.cost || 0);
    const todayRevenue = parseFloat(r.today_revenue || 0);
    const todayCost = parseFloat(r.today_cost || 0);
    res.json({
      status: 'success',
      data: {
        site_id: siteId,
        site_name: site.name,
        domain: site.domain,
        multiplier: site.multiplier,
        total_users: Number(userRows[0]?.total_users || 0),
        total_orders: Number(r.total_orders || 0),
        revenue: revenue.toFixed(4),
        cost: cost.toFixed(4),
        profit: (revenue - cost).toFixed(4),
        today_orders: Number(r.today_orders || 0),
        today_revenue: todayRevenue.toFixed(4),
        today_cost: todayCost.toFixed(4),
        today_profit: (todayRevenue - todayCost).toFixed(4)
      }
    });
  } catch (e) {
    console.error('分站报表失败:', e.message);
    res.status(500).json({ status: 'error', message: '查询报表失败' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    let sites;
    if (['admin', 'super_admin'].includes(req.user.role)) {
      sites = await Site.findAll({ order: [['created_at', 'DESC']] });
    } else {
      sites = await Site.findAll({ where: { owner_id: req.user.id }, order: [['created_at', 'DESC']] });
    }
    res.json({ status: 'success', data: sites });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '查询分站失败' });
  }
});

// 获取当前站点配置（公开，用于前端渲染）
router.get('/current', async (req, res) => {
  try {
    if (req.site) {
      res.json({
        status: 'success',
        data: {
          site_name: req.site.name,
          site_logo: req.site.logo || '/logo.png',
          site_id: req.site.id,
          is_subsite: true
        }
      });
    } else {
      res.json({ status: 'success', data: { is_subsite: false } });
    }
  } catch (e) {
    res.json({ status: 'success', data: { is_subsite: false } });
  }
});

// 创建分站
router.post('/', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    // 代理也可以创建，但需要是 agent 角色
    if (req.user.role !== 'agent') {
      return res.status(403).json({ status: 'error', message: '仅管理员和代理可创建分站' });
    }
  }

  const { domain, name, logo, multiplier } = req.body;
  if (!domain || !name) {
    return res.json({ status: 'error', message: '域名和站点名称不能为空' });
  }

  const cleanDomain = String(domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

  const multiplierValue = (multiplier === undefined || multiplier === null || multiplier === '') ? 2.0 : parseFloat(multiplier);
  const priceErr = pricingError(multiplierValue, null);
  if (priceErr) {
    return res.json({ status: 'error', message: priceErr });
  }

  try {
    const exists = await Site.findOne({ where: { domain: cleanDomain } });
    if (exists) {
      return res.json({ status: 'error', message: '该域名已被占用' });
    }

    const ownerId = ['admin', 'super_admin'].includes(req.user.role) && req.body.owner_id
      ? parseInt(req.body.owner_id)
      : req.user.id;

    const site = await Site.create({
      owner_id: ownerId,
      domain: cleanDomain,
      name: String(name).trim(),
      logo: logo || null,
      multiplier: multiplierValue,
      announcement: null,
      status: 'active'
    });

    sendTgMessage(`🏗️ <b>新分站创建</b>\n🌐 <b>域名:</b> <code>${cleanDomain}</code>\n📛 <b>名称:</b> ${name}\n👤 <b>站长UID:</b> <code>${ownerId}</code>\n💹 <b>倍率:</b> ${multiplierValue}`);

    res.json({ status: 'success', message: '分站创建成功', data: site });
  } catch (e) {
    res.status(500).json({ status: 'error', message: `创建失败: ${e.message}` });
  }
});

// 更新分站
router.put('/:id', authenticate, async (req, res) => {
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) return res.status(404).json({ status: 'error', message: '分站不存在' });

    if (!['admin', 'super_admin'].includes(req.user.role) && site.owner_id !== req.user.id) {
      return res.status(403).json({ status: 'error', message: '无权操作此分站' });
    }

    const { name, logo, multiplier, agent_discount, announcement, status,
            template, color, accent, footer_text, support_url, home_modules } = req.body;
    if (name !== undefined) site.name = String(name).trim();
    if (logo !== undefined) site.logo = logo;

    // 🎨 主题字段（白名单校验，避免写入非法模板名/色系把前端弄坏）
    const TEMPLATES = ['classic', 'saas', 'minimal', 'neon', 'magazine', 'glass'];
    const COLORS = ['cyan', 'purple', 'green', 'red', 'orange', 'blue'];
    if (template !== undefined) {
      if (!TEMPLATES.includes(template)) return res.json({ status: 'error', message: '模板不存在' });
      site.template = template;
    }
    if (color !== undefined) {
      if (!COLORS.includes(color)) return res.json({ status: 'error', message: '色系不存在' });
      site.color = color;
    }
    if (accent !== undefined) {
      const hex = String(accent || '').trim();
      if (hex && !/^#[0-9a-fA-F]{6}$/.test(hex)) return res.json({ status: 'error', message: '自定义主色需为 #RRGGBB 格式' });
      site.accent = hex || null;
    }
    if (footer_text !== undefined) site.footer_text = String(footer_text || '').slice(0, 255);
    if (support_url !== undefined) {
      const u = String(support_url || '').trim();
      // 🔒 只允许 http(s)，防止 javascript: 伪协议挂在客服按钮上
      if (u && !/^https?:\/\//i.test(u)) return res.json({ status: 'error', message: '客服链接必须以 http(s):// 开头' });
      site.support_url = u || null;
    }
    if (home_modules !== undefined) {
      let mods = home_modules;
      if (typeof mods === 'string') { try { mods = JSON.parse(mods); } catch { return res.json({ status: 'error', message: '首页模块格式错误' }); } }
      if (!Array.isArray(mods)) return res.json({ status: 'error', message: '首页模块必须是数组' });
      const ALLOWED = ['announce', 'stats', 'hot_services', 'faq', 'vip', 'affiliate'];
      const clean = mods
        .filter(m => m && ALLOWED.includes(m.key))
        .map((m, i) => ({ key: m.key, enabled: m.enabled !== false, order: Number.isFinite(+m.order) ? +m.order : i }))
        .sort((a, b) => a.order - b.order);
      site.home_modules = JSON.stringify(clean.slice(0, 12));
    }

    // 🔒 两个价格字段可单独修改，但必须按"改完之后"的组合校验，
    // 否则可先压低倍率、再压低折扣绕过单字段检查。
    if (multiplier !== undefined || agent_discount !== undefined) {
      const nextMultiplier = multiplier !== undefined ? parseFloat(multiplier) : parseFloat(site.multiplier);
      const nextDiscount = agent_discount !== undefined ? parseFloat(agent_discount) : parseFloat(site.agent_discount);
      const priceErr = pricingError(nextMultiplier, nextDiscount);
      if (priceErr) {
        return res.json({ status: 'error', message: priceErr });
      }
      if (multiplier !== undefined) site.multiplier = nextMultiplier;
      if (agent_discount !== undefined) site.agent_discount = nextDiscount;
    }

    // 🔒 分站公告会经 public.js 下发给全部访客、前端用 v-html 渲染，
    // 必须和主站公告一样过白名单净化，否则站长可写入 onerror 窃取访客 Token。
    if (announcement !== undefined) site.announcement = sanitizeAnnouncement(announcement);
    if (status !== undefined && ['admin', 'super_admin'].includes(req.user.role)) site.status = status;

    await site.save();
    res.json({ status: 'success', message: '分站更新成功', data: site });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '更新失败' });
  }
});

// 删除分站
router.delete('/:id', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ status: 'error', message: '仅管理员可删除分站' });
  }
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) return res.status(404).json({ status: 'error', message: '分站不存在' });
    await site.destroy();
    sendTgMessage(`🗑️ <b>分站已删除</b>\n🌐 域名: <code>${site.domain}</code>\n📛 名称: ${site.name}`);
    res.json({ status: 'success', message: '分站已删除' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '删除失败' });
  }
});

export default router;
