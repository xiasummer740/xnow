import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { Site, User } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { sendTgMessage } from '../utils/tgBot.js';
import { sanitizeAnnouncement } from '../utils/sanitize.js';
import { isValidDomain, isDomainForbidden, isBindForbidden, verifyDomainOwnership, ensureCert, writeVhost, reloadNginx, removeVhost, vhostPath } from '../utils/siteDomain.js';
import { sendSiteSmtpTest } from '../utils/email.js';
import { clearSiteCache } from '../middleware/site.js';

// 站点数据一变就让 Host→站点 的缓存失效，避免「新绑域名 60 秒内仍显示主站」
const bustSiteCache = () => { try { clearSiteCache(); } catch (e) {} };

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
    // 说人话：告诉他"最低能卖多少倍"，而不是甩一个数学不等式
    const floor = (1 / discount).toFixed(2);
    return `定价过低：你的代理折扣是 ${discount}，最低要卖 ${floor} 倍才不亏（你填的是 ${m} 倍）`;
  }
  return null;
};

// 该站当前允许的最低售价倍率（由代理折扣决定），供前端提示用
const minMultiplier = (agentDiscount) => {
  const d = (agentDiscount === undefined || agentDiscount === null || agentDiscount === '' || !isFinite(parseFloat(agentDiscount)) || parseFloat(agentDiscount) <= 0)
    ? DEFAULT_AGENT_DISCOUNT
    : parseFloat(agentDiscount);
  return Math.max(1, Number((1 / d).toFixed(2)));
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

// 👥 分站的客户列表（站主与管理员可见，手机/邮箱做脱敏，只给他看自己站的客户）
router.get('/customers', authenticate, async (req, res) => {
  try {
    const siteId = parseInt(req.query.site_id || 0);
    if (!siteId) return res.json({ status: 'error', message: '缺少 site_id' });
    const site = await Site.findByPk(siteId);
    if (!site) return res.json({ status: 'error', message: '分站不存在' });
    if (!['admin', 'super_admin'].includes(req.user.role) && site.owner_id !== req.user.id) {
      return res.status(403).json({ status: 'error', message: '无权查看该分站' });
    }

    const limit = Math.min(parseInt(req.query.limit || 30) || 30, 100);
    const offset = Math.max(parseInt(req.query.offset || 0) || 0, 0);
    const { sequelize } = await import('../models/index.js');
    const [rows] = await sequelize.query(
      `SELECT u.id, u.phone, u.email, u.role, u.balance, u.created_at,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.site_id = ?) AS order_count,
              (SELECT COALESCE(SUM(o.charge),0) FROM orders o WHERE o.user_id = u.id AND o.site_id = ?) AS total_spent
         FROM users u WHERE u.site_id = ?
         ORDER BY u.id DESC LIMIT ? OFFSET ?`,
      { replacements: [siteId, siteId, siteId, limit, offset] }
    );
    const [cnt] = await sequelize.query('SELECT COUNT(*) AS n FROM users WHERE site_id = ?', { replacements: [siteId] });

    // 🔒 脱敏：站主要联系客户，但不需要看到完整号码/邮箱
    const maskPhone = (p) => (p ? String(p).replace(/^(\d{3})\d+(\d{2})$/, '$1****$2') : '');
    const maskEmail = (e) => (e ? String(e).replace(/^(.{2})[^@]*@/, '$1***@') : '');

    res.json({
      status: 'success',
      data: rows.map(r => ({
        id: r.id,
        phone: maskPhone(r.phone),
        email: maskEmail(r.email),
        role: r.role,
        balance: parseFloat(r.balance || 0).toFixed(2),
        orders: Number(r.order_count || 0),
        spent: parseFloat(r.total_spent || 0).toFixed(4),
        joined: r.created_at
      })),
      total: Number(cnt[0]?.n || 0)
    });
  } catch (e) {
    console.error('分站客户列表失败:', e.message);
    res.status(500).json({ status: 'error', message: '查询失败' });
  }
});

// 🧾 分站的订单明细（含该单毛利 = charge − site_cost）
router.get('/orders', authenticate, async (req, res) => {
  try {
    const siteId = parseInt(req.query.site_id || 0);
    if (!siteId) return res.json({ status: 'error', message: '缺少 site_id' });
    const site = await Site.findByPk(siteId);
    if (!site) return res.json({ status: 'error', message: '分站不存在' });
    if (!['admin', 'super_admin'].includes(req.user.role) && site.owner_id !== req.user.id) {
      return res.status(403).json({ status: 'error', message: '无权查看该分站' });
    }

    const limit = Math.min(parseInt(req.query.limit || 30) || 30, 100);
    const offset = Math.max(parseInt(req.query.offset || 0) || 0, 0);
    const { sequelize } = await import('../models/index.js');
    const [rows] = await sequelize.query(
      `SELECT o.id, o.order_no, o.service_id, o.link, o.quantity, o.charge, o.site_cost,
              o.status, o.created_at, s.name AS service_name
         FROM orders o LEFT JOIN services s ON s.service_id = o.service_id
        WHERE o.site_id = ?
        ORDER BY o.id DESC LIMIT ? OFFSET ?`,
      { replacements: [siteId, limit, offset] }
    );
    const [cnt] = await sequelize.query('SELECT COUNT(*) AS n FROM orders WHERE site_id = ?', { replacements: [siteId] });

    res.json({
      status: 'success',
      data: rows.map(r => ({
        id: r.id,
        order_no: r.order_no,
        service_id: r.service_id,
        service_name: r.service_name,
        link: r.link,
        quantity: r.quantity,
        charge: parseFloat(r.charge || 0).toFixed(4),
        site_cost: parseFloat(r.site_cost || 0).toFixed(4),
        profit: (parseFloat(r.charge || 0) - parseFloat(r.site_cost || 0)).toFixed(4),
        status: r.status,
        created_at: r.created_at
      })),
      total: Number(cnt[0]?.n || 0)
    });
  } catch (e) {
    console.error('分站订单列表失败:', e.message);
    res.status(500).json({ status: 'error', message: '查询失败' });
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
    // 🔒 不把 SMTP 密码吐给前端：只回一个占位符，站长要改才填新的
    const safe = (rows) => rows.map(r => {
      const o = r.toJSON();
      o.smtp_pass = o.smtp_pass ? '******' : null;
      o.bufpay_key = o.bufpay_key ? '******' : null;
      o.cryptomus_key = o.cryptomus_key ? '******' : null;
      // 前端据此提示「最低可售价」，避免站长填 1 倍被拒还不知道为什么
      o.min_multiplier = minMultiplier(o.agent_discount);
      return o;
    });
    res.json({ status: 'success', data: safe(sites) });
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
      return res.status(403).json({ status: 'error', message: '仅至尊代理可创建分站，请先升级为至尊代理' });
    }
  }

  const { domain, name, logo, multiplier } = req.body;
  if (!domain || !name) {
    return res.json({ status: 'error', message: '域名和站点名称不能为空' });
  }

  const cleanDomain = String(domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\/.*$/, '');

  // 🔒 建站时也必须过域名校验 —— 这条以前漏了（只有"绑定域名"那条走了校验）。
  //    漏掉的后果极严重：代理开站时把域名填成 xnow.taikon.top，
  //    主站域名就会被识别成他的分站身份 → 主站价格被改、用户被错误隔离。
  if (!isValidDomain(cleanDomain)) {
    return res.json({ status: 'error', message: '域名格式不正确（不要带 http:// 和路径）' });
  }
  if (isDomainForbidden(cleanDomain)) {
    return res.json({ status: 'error', message: '该域名不可使用' });
  }

  const multiplierValue = (multiplier === undefined || multiplier === null || multiplier === '') ? 2.0 : parseFloat(multiplier);
  const priceErr = pricingError(multiplierValue, null);
  if (priceErr) {
    return res.json({ status: 'error', message: priceErr });
  }

  try {
    // 子域名与自有域名两个字段都要查重，避免两个站抢同一个域名
    const exists = await Site.findOne({ where: { domain: cleanDomain } });
    const existsCustom = await Site.findOne({ where: { custom_domain: cleanDomain } });
    if (exists || existsCustom) {
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
    bustSiteCache();

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
            template, color, accent, footer_text, support_url, home_modules,
            smtp_host, smtp_port, smtp_user, smtp_pass,
            bufpay_id, bufpay_key, cryptomus_id, cryptomus_key } = req.body;
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

    // 📧 分站自有 SMTP（客户收到的验证码用站长自己的品牌发出）
    if (smtp_host !== undefined) site.smtp_host = String(smtp_host || '').trim() || null;
    if (smtp_port !== undefined) {
      const p = parseInt(smtp_port);
      site.smtp_port = (Number.isFinite(p) && p > 0 && p < 65536) ? p : null;
    }
    if (smtp_user !== undefined) site.smtp_user = String(smtp_user || '').trim() || null;
    if (smtp_pass !== undefined && smtp_pass !== '******') {
      // 前端回传脱敏占位符时保留原值，避免「只改别的字段却把密码清空」
      site.smtp_pass = String(smtp_pass || '') || null;
    }

    // 💳 分站自有收款商户（方案②）。传 '******' 视为「不修改」，避免回显脱敏值时清空密钥。
    if (bufpay_id !== undefined) site.bufpay_id = String(bufpay_id || '').trim() || null;
    if (bufpay_key !== undefined && bufpay_key !== '******') site.bufpay_key = String(bufpay_key || '') || null;
    if (cryptomus_id !== undefined) site.cryptomus_id = String(cryptomus_id || '').trim() || null;
    if (cryptomus_key !== undefined && cryptomus_key !== '******') site.cryptomus_key = String(cryptomus_key || '') || null;

    await site.save();
    bustSiteCache();
    res.json({ status: 'success', message: '分站更新成功', data: site });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '更新失败' });
  }
});

// 删除分站
// 🌐 绑定/开通自有域名（六期）
//  第一步：站长把域名的 A 记录指向本机（或加一条 TXT xnow-verify=<token>，用于 CF 橙云）
//  第二步：调本接口 → 验证归属 → 申请证书 → 写 nginx vhost → 重载
router.post('/:id/domain', authenticate, async (req, res) => {
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) return res.status(404).json({ status: 'error', message: '分站不存在' });
    if (!['admin', 'super_admin'].includes(req.user.role) && site.owner_id !== req.user.id) {
      return res.status(403).json({ status: 'error', message: '无权操作此分站' });
    }

    const domain = String(req.body?.domain || '').trim().toLowerCase();
    if (!isValidDomain(domain)) return res.json({ status: 'error', message: '域名格式不正确' });
    // 🔒 黑名单：主站域名与上游域名绝不允许被分站接管
    if (isBindForbidden(domain)) {
      return res.json({
        status: 'error',
        message: isDomainForbidden(domain) ? '该域名不可绑定' : '免费子域名无需绑定，请填写你自己的域名'
      });
    }

    // 已被别的分站占用（子域名与自有域名都要查，否则会出现两个站抢同一个域名）
    const other = await Site.findOne({ where: { domain } });
    const otherCustom = await Site.findOne({ where: { custom_domain: domain } });
    if ((other && other.id !== site.id) || (otherCustom && otherCustom.id !== site.id)) {
      return res.json({ status: 'error', message: '该域名已被其他分站使用' });
    }

    // 防刷：60 秒内不允许重复尝试（每次都会打 DNS / 可能触发 certbot 申请）
    if (site.domain_status !== 'active' && site.updatedAt && Date.now() - new Date(site.updatedAt).getTime() < 60000) {
      return res.json({ status: 'error', message: '操作过于频繁，请 60 秒后再试' });
    }

    if (!site.domain_token) site.domain_token = crypto.randomBytes(16).toString('hex');
    // ⚠️ 注意：写入的是 custom_domain，**绝不覆盖 domain**。
    //    否则验证失败时站长原来的免费子域名会一起失效，站直接失联。
    site.custom_domain = domain;

    // ① 归属验证
    const dns = await verifyDomainOwnership(domain, site.domain_token);
    if (!dns.ok) {
      site.domain_status = 'pending';
      await site.save();
      bustSiteCache();
      return res.json({
        status: 'pending',
        message: dns.reason,
        detail: dns.detail,
        hint: `请把 ${domain} 的 A 记录指向本机 IP；若域名走 Cloudflare 代理（橙云），
请在 DNS 里加一条 TXT 记录：xnow-verify=${site.domain_token}`,
        token: site.domain_token
      });
    }

    // ② 证书 + ③ vhost
    const cert = await ensureCert(domain);
    const backendPort = parseInt(process.env.PORT) || 3000;
    const distRoot = process.env.SITE_DIST_ROOT || path.resolve(process.cwd(), '..', 'client', 'dist');
    writeVhost({ siteId: site.id, domain, backendPort, distRoot, cert });
    reloadNginx();

    site.domain_status = 'active';
    site.cert_mode = cert.mode;
    await site.save();
    bustSiteCache();

    sendTgMessage(
      `🌐 <b>分站自有域名已开通</b>\n🏬 ${site.name}\n🔗 <code>${domain}</code>\n` +
      `🔐 证书: ${cert.mode === 'letsencrypt' ? 'Let\'s Encrypt ✅' : cert.mode === 'selfsigned' ? '自签 ⚠️ 浏览器会提示不安全' : '已存在'}`
    );

    res.json({
      status: 'success',
      message: cert.mode === 'letsencrypt'
        ? '域名已开通，证书已自动签发 ✅'
        : cert.mode === 'selfsigned'
          ? '域名已开通，但本机未装 certbot，暂用自签证书（浏览器会提示不安全）'
          : '域名已开通 ✅',
      data: { domain, status: site.domain_status, cert_mode: site.cert_mode, vhost: vhostPath(site.id, domain) }
    });
  } catch (e) {
    console.error('[sites] 域名开通失败:', e.message);
    try {
      const s = await Site.findByPk(req.params.id);
      if (s) { s.domain_status = 'failed'; await s.save(); }
    } catch (_) {}
    res.status(500).json({ status: 'error', message: `开通失败：${e.message}` });
  }
});

// 解绑自有域名（清理 vhost，避免残留配置抢域名）
router.delete('/:id/domain', authenticate, async (req, res) => {
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) return res.status(404).json({ status: 'error', message: '分站不存在' });
    if (!['admin', 'super_admin'].includes(req.user.role) && site.owner_id !== req.user.id) {
      return res.status(403).json({ status: 'error', message: '无权操作此分站' });
    }
    removeVhost(site.id, site.custom_domain);
    try { reloadNginx(); } catch (e) {}
    site.domain_status = 'none';
    site.cert_mode = null;
    site.custom_domain = null;
    await site.save();
    bustSiteCache();
    res.json({ status: 'success', message: '域名配置已清理' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '解绑失败' });
  }
});

// 🧪 站长自查发信：只用他自己的 SMTP，不回退。
//    站长在正式开卖前应该点一下这个按钮 —— 否则等客户注册收不到验证码才发现就晚了。
router.post('/:id/smtp-test', authenticate, async (req, res) => {
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) return res.status(404).json({ status: 'error', message: '分站不存在' });
    if (!['admin', 'super_admin'].includes(req.user.role) && site.owner_id !== req.user.id) {
      return res.status(403).json({ status: 'error', message: '无权操作该分站' });
    }
    // 收件地址：优先用请求里给的，其次用站长自己的邮箱
    let to = String(req.body.email || '').trim();
    if (!to) {
      const { User } = await import('../models/index.js');
      const owner = await User.findByPk(site.owner_id);
      to = owner?.email || '';
    }
    if (!to) return res.json({ status: 'error', message: '请填写接收测试邮件的地址' });

    const result = await sendSiteSmtpTest(to, site);
    res.json({ status: result.success ? 'success' : 'error', message: result.message });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {  if (!['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ status: 'error', message: '仅管理员可删除分站' });
  }
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) return res.status(404).json({ status: 'error', message: '分站不存在' });

    // 🧹 把该站的用户放回主站。
    //    不处理的话：站点记录没了，但 users.site_id 还指着它 ——
    //    这些用户既不属于任何分站、又带着一个悬空的 site_id，
    //    后续下单与统计都会指向一个不存在的站。这是删除站点必须收尾的事。
    const { User } = await import('../models/index.js');
    const moved = await User.update({ site_id: 0 }, { where: { site_id: site.id } });

    // 域名 vhost 与证书一并清理（先于删记录，删了就找不到域名了）
    if (site.custom_domain) {
      try { removeVhost(site.id, site.custom_domain); reloadNginx(); } catch (e) {}
    }

    await site.destroy();
    bustSiteCache();
    sendTgMessage(`🗑️ <b>分站已删除</b>\n🌐 域名: <code>${site.domain}</code>\n📛 名称: ${site.name}\n👥 归位主站的用户: ${moved?.[0] ?? 0}`);
    res.json({
      status: 'success',
      message: `分站已删除${moved?.[0] ? `，${moved[0]} 个用户已回到主站` : ''}`
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '删除失败' });
  }
});

export default router;
