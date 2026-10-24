import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { Site, User, Config, Service, SiteServicePrice } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { sendTgMessage } from '../utils/tgBot.js';
import { sanitizeAnnouncement } from '../utils/sanitize.js';
import { isValidDomain, isDomainForbidden, isBindForbidden, isFreeSubdomain, verifyDomainOwnership, ensureCert, writeVhost, reloadNginx, removeVhost, vhostPath, parkDomain, unparkDomain } from '../utils/siteDomain.js';
import { sendSiteSmtpTest } from '../utils/email.js';
import multer from 'multer';
import fs from 'fs';
import { clearSiteCache } from '../middleware/site.js';

// 站点数据一变就让 Host→站点 的缓存失效，避免「新绑域名 60 秒内仍显示主站」
const bustSiteCache = () => { try { clearSiteCache(); } catch (e) {} };

const router = express.Router();

const DEFAULT_AGENT_DISCOUNT = 0.8;

// 🔒 定价护栏：分站倍率与代理折扣会覆盖全局定价，低于成本价等于平台每单倒贴。
// 成交价见 orders.js：代理 = multiplier × agent_discount，其余角色 = multiplier，
// 而上游始终按 service.rate 实扣，所以两者都必须 ≥ 1.0（倍率 1.0 = 上游成本价）。
//
// 🔴 但站长的"进价"不是 1.0，而是 platformMult = global_multiplier × agent_discount
//    （默认 2.5 × 0.8 = 2.0）。客户付 multiplier × rate，站长被扣 2.0 × rate，
//    所以站长卖 1.25 倍 = 每单倒亏 0.75 倍 —— 而旧代码恰好把 1.25 当成"不亏线"
//    写进提示里，等于手把手教站长亏钱。下限必须按 platformMult 算。
const DEFAULT_GLOBAL_MULTIPLIER = 2.5;

// 全局倍率会变（管理密室可改），所以每次现读；读不到就用默认值
const getGlobalMultiplier = async () => {
  try {
    const row = await Config.findOne({ where: { key: 'global_multiplier' } });
    const v = row ? parseFloat(row.value) : NaN;
    return (isFinite(v) && v > 0) ? v : DEFAULT_GLOBAL_MULTIPLIER;
  } catch (e) {
    return DEFAULT_GLOBAL_MULTIPLIER;
  }
};

// 站长真正的不亏线：他每单被扣 rate × global_multiplier × agent_discount
const siteCostMultiplier = (agentDiscount, globalMult) => {
  const d = (agentDiscount === undefined || agentDiscount === null || agentDiscount === '' || !isFinite(parseFloat(agentDiscount)) || parseFloat(agentDiscount) <= 0)
    ? DEFAULT_AGENT_DISCOUNT
    : parseFloat(agentDiscount);
  const g = (isFinite(parseFloat(globalMult)) && parseFloat(globalMult) > 0) ? parseFloat(globalMult) : DEFAULT_GLOBAL_MULTIPLIER;
  return Math.max(1, Number((g * d).toFixed(2)));
};

const pricingError = (multiplier, agentDiscount, globalMult) => {
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
  // 平台侧：成交价不能低于上游成本
  if (m * discount < 1) {
    const floor = (1 / discount).toFixed(2);
    return `定价过低：你的代理折扣是 ${discount}，最低要卖 ${floor} 倍才不亏（你填的是 ${m} 倍）`;
  }
  // 站长侧：自己的售价不能低于自己的进价，否则每单赔钱，还会被 orders.js 的
  // 安全网"抬平"到成本价 —— 客户看到的价和实际扣的钱对不上，是最伤的体验。
  const costMult = siteCostMultiplier(discount, globalMult);
  if (m < costMult) {
    return `定价过低：你从平台的进价是 ${costMult} 倍（全局 ${(parseFloat(globalMult) > 0 ? parseFloat(globalMult) : DEFAULT_GLOBAL_MULTIPLIER)} × 你的折扣 ${discount}），卖 ${m} 倍每单会亏 ${(costMult - m).toFixed(2)} 倍。最低请设 ${costMult} 倍，建议 ${Math.max(costMult + 0.5, costMult * 1.5).toFixed(2)} 倍起。`;
  }
  return null;
};

// 该站当前允许的最低售价倍率（= 站长的进价倍率），供前端提示用
const minMultiplier = siteCostMultiplier;

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
    // 💰 退款/取消必须从收益里扣掉，否则站长看着"赚了"，实际钱已经退回去了。
    //    退款金额直接读流水（客户退款 + 站长成本退还），都带 site_id，
    //    所以部分退款（按比例）也能算准，不依赖订单行的 remains。
    const [rows] = await sequelize.query(
      `SELECT COUNT(*) AS total_orders,
              COALESCE(SUM(charge), 0) AS revenue_gross,
              COALESCE(SUM(site_cost), 0) AS cost_gross,
              COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END), 0) AS today_orders,
              COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN charge ELSE 0 END), 0) AS today_revenue_gross,
              COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN site_cost ELSE 0 END), 0) AS today_cost_gross
       FROM orders WHERE site_id = ?`,
      { replacements: [siteId] }
    );
    const [refundRows] = await sequelize.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = '退款入账' THEN amount ELSE 0 END), 0) AS refunded_revenue,
         COALESCE(SUM(CASE WHEN type = '分站成本退还' THEN amount ELSE 0 END), 0) AS refunded_cost,
         COALESCE(SUM(CASE WHEN type = '退款入账' AND DATE(created_at) = CURDATE() THEN amount ELSE 0 END), 0) AS today_refunded_revenue,
         COALESCE(SUM(CASE WHEN type = '分站成本退还' AND DATE(created_at) = CURDATE() THEN amount ELSE 0 END), 0) AS today_refunded_cost
       FROM transactions WHERE site_id = ?`,
      { replacements: [siteId] }
    );
    const [userRows] = await sequelize.query(
      'SELECT COUNT(*) AS total_users FROM users WHERE site_id = ?',
      { replacements: [siteId] }
    );

    const r = rows[0] || {};
    const rf = refundRows[0] || {};
    const revenue = parseFloat(r.revenue_gross || 0) - parseFloat(rf.refunded_revenue || 0);
    const cost = parseFloat(r.cost_gross || 0) - parseFloat(rf.refunded_cost || 0);
    const todayRevenue = parseFloat(r.today_revenue_gross || 0) - parseFloat(rf.today_refunded_revenue || 0);
    const todayCost = parseFloat(r.today_cost_gross || 0) - parseFloat(rf.today_refunded_cost || 0);
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
        refunded: (parseFloat(rf.refunded_revenue || 0)).toFixed(4),
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
    // 🔒 分站只属于「至尊代理」这一个角色。普通客户连入口都不该拿到，
    //    否则他会从 200 响应里推断出"这套系统支持开分站"，进而去问站长。
    const isStaff = ['admin', 'super_admin'].includes(req.user.role);
    if (!isStaff && req.user.role !== 'agent') {
      return res.status(403).json({ status: 'error', message: '仅至尊代理可使用分站功能' });
    }
    let sites;
    if (isStaff) {
      sites = await Site.findAll({ order: [['created_at', 'DESC']] });
    } else {
      sites = await Site.findAll({ where: { owner_id: req.user.id }, order: [['created_at', 'DESC']] });
    }
    // 🔒 不把 SMTP 密码吐给前端：只回一个占位符，站长要改才填新的
    const gMult = await getGlobalMultiplier();
    const safe = (rows) => rows.map(r => {
      const o = r.toJSON();
      o.smtp_pass = o.smtp_pass ? '******' : null;
      o.bufpay_key = o.bufpay_key ? '******' : null;
      o.cryptomus_key = o.cryptomus_key ? '******' : null;
      // 前端据此提示「最低可售价」（= 站长的真实进价倍率，不是 1/折扣）
      o.min_multiplier = minMultiplier(o.agent_discount, gMult);
      // 🧭 六十五期：自有域名要填的 A 记录目标地址。
      //    这个值来自环境变量 SERVER_PUBLIC_IP（不进代码库，仓库是 PUBLIC）。
      //    没配就留空 —— 前端会变成"问平台要地址"，不会指一个错的 IP 让站长白折腾。
      o.dns_target_ip = String(process.env.SERVER_PUBLIC_IP || '').trim();
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

  const multiplierValue = (multiplier === undefined || multiplier === null || multiplier === '') ? 3.0 : parseFloat(multiplier);
  const priceErr = pricingError(multiplierValue, null, await getGlobalMultiplier());
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

  // 🔢 每位站长能开几个站。
  //    ⚠️ 默认值 = 1：每位站长只能开 1 个分站（祥哥 2026-10-24 定）。
  //    想放宽：把 configs.max_sites_per_agent 设成 2 / 3 / …；显式设 0 表示不限。
  //    做成配置项是因为这属于经营策略，改规则不该每次都改代码重新部署。
  //    平台管理员（admin/super_admin）不受限制，方便自己做测试站。
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    let maxSites = 1;
    try {
      const cfg = await Config.findOne({ where: { key: 'max_sites_per_agent' } });
      if (cfg && cfg.value !== '' && cfg.value !== null) {
        const n = parseInt(cfg.value, 10);
        // 显式配置优先：0 = 不限；正数 = 上限
        if (Number.isFinite(n) && n >= 0) maxSites = n;
      }
    } catch (e) { /* 读不到配置就用默认值 1：不能因为配置表异常让人无限开站 */ }
    if (maxSites > 0) {
      const owned = await Site.count({ where: { owner_id: ownerId } });
      if (owned >= maxSites) {
        return res.json({
          status: 'error',
          message: `每位站长最多开 ${maxSites} 个分站（你现在已有 ${owned} 个）。如需增开请联系平台。`
        });
      }
    }
  }

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

    // 🏬 二十九期：免费子域名也走「各自独立 vhost」，不用泛域名。
    //    原因（2026-10-24 实测）：Cloudflare 免费通用证书只覆盖一级子域名，
    //    *.xnow.taikon.top 这种两级域名会证书失败；而 *.taikon.top 又是通配，
    //    会把同机其它项目的子域名一起抢过来。所以给每个分站单独写一个 server 块。
    //
    // 🔧 六十五期修正：原来只有「免费子域名」建站时才顺手发证书 + 写 vhost，
    //    站长用**自有域名**建站时什么都不发生（domain_status 一直是 none），
    //    页面上也没有提示 —— 相当于"建了站但线上打不开"，而且他根本不知道卡在哪。
    //    现在两种域名都同样发证书 + 写 vhost：
    //      · 免费子域名：本机 DNS 已就绪，签发成功率接近 100%
    //      · 自有域名：DNS 还没指过来时，先用自签证书把站点配好；
    //        等他改完 DNS 点「修复域名」，就会换成正式证书（代码里已优先 certbot）
    let publishNote = '';
    {
      try {
        const cert = await ensureCert(cleanDomain, process.env.SITE_DIST_ROOT || path.resolve(process.cwd(), '..', 'client', 'dist'));
        const backendPort = parseInt(process.env.PORT) || 3000;
        const distRoot = process.env.SITE_DIST_ROOT || path.resolve(process.cwd(), '..', 'client', 'dist');
        writeVhost({ siteId: site.id, domain: cleanDomain, backendPort, distRoot, cert });
        reloadNginx();
        site.domain_status = 'active';
        site.cert_mode = cert.mode;
        await site.save();
        bustSiteCache();
        if (cert.mode === 'letsencrypt') {
          publishNote = '（已签发正式证书）';
        } else if (isFreeSubdomain(cleanDomain)) {
          publishNote = '（当前为自签证书，浏览器可能提示不安全）';
        } else {
          publishNote = '（自有域名已配置：请把 DNS 的 A 记录指向本机，生效后到「我的分站」点一次「修复域名」换正式证书）';
        }
      } catch (e) {
        // 建站本身不能因为"域名没发出去"而失败 —— 站长可稍后点「修复域名」
        publishNote = '（域名尚未生效，可稍后点「修复域名」重试）';
        console.error(`[site] vhost 生成失败 ${cleanDomain}: ${e.message}`);
      }
    }

    sendTgMessage(`🏗️ <b>新分站创建</b>\n🌐 <b>域名:</b> <code>${cleanDomain}</code>\n📛 <b>名称:</b> ${name}\n👤 <b>站长UID:</b> <code>${ownerId}</code>\n💹 <b>倍率:</b> ${multiplierValue}`);

    res.json({ status: 'success', message: `分站创建成功${publishNote}`, data: site });
  } catch (e) {
    res.status(500).json({ status: 'error', message: `创建失败: ${e.message}` });
  }
});

// 更新分站
// ============================================================
// 💰 服务定价：站长给自己的客户定价（不设就走站点总倍率）
//    GET  /api/sites/:id/prices?q=关键词   —— 列出服务 + 该站售价 + 成本下限
//    PUT  /api/sites/:id/prices           —— 批量保存 [{service_id, rate}]，rate=null 恢复默认
//    红线：任何价格乘上折扣后都不得低于站长进货价（baseRate × 平台倍率 × 代理折扣）。
// ============================================================
const effectiveDiscount = (site) => {
  const rate = parseFloat(site.discount_rate);
  const until = parseInt(site.discount_until || 0);
  if (!isFinite(rate) || rate <= 0 || rate >= 1) return 1;
  if (until > 0 && Math.floor(Date.now() / 1000) > until) return 1;  // 过期自动失效
  return rate;
};

router.get('/:id/prices', authenticate, async (req, res) => {
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) return res.status(404).json({ status: 'error', message: '分站不存在' });
    const isStaff = ['admin', 'super_admin'].includes(req.user.role);
    if (!isStaff && site.owner_id !== req.user.id) {
      return res.status(403).json({ status: 'error', message: '无权查看此分站' });
    }

    const globalMult = await getGlobalMultiplier();
    const costMult = siteCostMultiplier(site.agent_discount, globalMult);
    const siteMult = parseFloat(site.multiplier) || costMult;
    const discount = effectiveDiscount(site);

    const q = String(req.query.q || '').trim();
    // services 表没有 status 列（全表都是在上架的服务），只按关键词过滤
    const where = {};
    const { Op } = (await import('sequelize')).default;
    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { category: { [Op.like]: `%${q}%` } },
        { type: { [Op.like]: `%${q}%` } },
      ];
    }
    const services = await Service.findAll({
      where,
      order: [['category', 'ASC'], ['service_id', 'ASC']],
      limit: 80,
    });

    const ids = services.map(sv => sv.service_id);
    const overrides = ids.length
      ? await SiteServicePrice.findAll({ where: { site_id: site.id, service_id: ids } })
      : [];
    const ovMap = new Map(overrides.map(o => [Number(o.service_id), parseFloat(o.rate)]));

    const rows = services.map(sv => {
      const baseRate = (sv.custom_rate !== null && sv.custom_rate !== undefined)
        ? parseFloat(sv.custom_rate) : parseFloat(sv.rate);
      const cost = baseRate * costMult;                     // 站长进货价（每 1000）
      const listPrice = ovMap.has(Number(sv.service_id))
        ? ovMap.get(Number(sv.service_id))                   // 站长给这个服务单独定的价
        : baseRate * siteMult;                               // 没单设定价 = 总倍率
      const sellPrice = listPrice * discount;                // 再叠加折扣
      return {
        service_id: sv.service_id,
        name: sv.name,
        category: sv.category,
        type: sv.type,
        min: sv.min,
        max: sv.max,
        // 🔒 不返回 base_rate（平台的上游底价）：站长只需要知道自己的成本线，
        //    知道上游多少钱等于把平台的进货价摊在桌面上。
        cost_per_1k: Number(cost.toFixed(4)),
        list_price: Number(listPrice.toFixed(4)),
        sell_price: Number(sellPrice.toFixed(4)),
        override: ovMap.has(Number(sv.service_id)) ? Number(ovMap.get(Number(sv.service_id)).toFixed(6)) : null,
        margin_percent: sellPrice > 0 ? Number((((sellPrice - cost) / sellPrice) * 100).toFixed(1)) : 0,
        below_cost: sellPrice < cost - 0.0001,
      };
    });

    res.json({
      status: 'success',
      data: {
        site_id: site.id,
        multiplier: siteMult,
        discount_rate: discount,
        discount_label: site.discount_label || '',
        discount_until: parseInt(site.discount_until || 0),
        cost_multiplier: costMult,
        items: rows,
      }
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '读取定价失败：' + (e.message || e) });
  }
});

router.put('/:id/prices', authenticate, async (req, res) => {
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) return res.status(404).json({ status: 'error', message: '分站不存在' });
    const isStaff = ['admin', 'super_admin'].includes(req.user.role);
    if (!isStaff && site.owner_id !== req.user.id) {
      return res.status(403).json({ status: 'error', message: '无权修改此分站' });
    }

    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.json({ status: 'error', message: '没有要保存的定价' });

    const globalMult = await getGlobalMultiplier();
    const costMult = siteCostMultiplier(site.agent_discount, globalMult);
    const discount = effectiveDiscount(site);

    const ids = items.map(i => parseInt(i.service_id)).filter(Boolean);
    const services = await Service.findAll({ where: { service_id: ids } });
    const svMap = new Map(services.map(sv => [Number(sv.service_id), sv]));

    const toUpsert = [];
    const toDelete = [];
    for (const it of items) {
      const sid = parseInt(it.service_id);
      const sv = svMap.get(sid);
      if (!sv) return res.json({ status: 'error', message: `服务 ${it.service_id} 不存在` });

      const raw = it.rate;
      if (raw === null || raw === undefined || raw === '') { toDelete.push(sid); continue; }

      const rate = parseFloat(raw);
      if (!isFinite(rate) || rate <= 0) return res.json({ status: 'error', message: `服务 ${sid} 的价格必须大于 0` });

      // 🔒 成本保护：站长即使想亏本也亏不了 —— 实收（含折扣）不得低于进货价
      const baseRate = (sv.custom_rate !== null && sv.custom_rate !== undefined)
        ? parseFloat(sv.custom_rate) : parseFloat(sv.rate);
      const floor = Number((baseRate * costMult / discount).toFixed(6)); // 折算回"标价"的下界
      if (rate < floor - 0.000001) {
        return res.json({
          status: 'error',
          message: `「${sv.name}」定价过低：${rate} 低于成本线 ${floor}（每 1000 个进货 ${(baseRate * costMult).toFixed(4)}）。站长可自定义，但不能亏本卖。`
        });
      }
      toUpsert.push({ site_id: site.id, service_id: sid, rate });
    }

    if (toDelete.length) await SiteServicePrice.destroy({ where: { site_id: site.id, service_id: toDelete } });
    if (toUpsert.length) {
      await SiteServicePrice.bulkCreate(toUpsert, { updateOnDuplicate: ['rate', 'updated_at'] });
    }
    res.json({ status: 'success', message: `已保存 ${toUpsert.length} 项定价${toDelete.length ? `，恢复默认 ${toDelete.length} 项` : ''}` });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '保存定价失败：' + (e.message || e) });
  }
});

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
            hero_badge, hero_title, hero_subtitle, hero_desc,
            hero_btn1_text, hero_btn1_url, hero_btn2_text, hero_btn2_url, hero_bg_url,
            bufpay_id, bufpay_key, cryptomus_id, cryptomus_key,
            discount_rate, discount_label, discount_until,
    bg_color, bg_image, font_scale } = req.body;
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
    // 🎨 背景色：只接受 #RRGGBB 或三套内置渐变（grad1/grad2/grad3），其余一律拒绝
  if (bg_color !== undefined) {
    const v = String(bg_color || '').trim();
    const GRADS = ['grad1', 'grad2', 'grad3'];
    if (v && !/^#[0-9a-fA-F]{6}$/.test(v) && !GRADS.includes(v)) {
      return res.json({ status: 'error', message: '背景色格式不支持' });
    }
    site.bg_color = v || null;
  }
  // 🎨 背景图：只接受本站上传目录里的相对路径
  if (bg_image !== undefined) {
    const v = String(bg_image || '').trim();
    if (v && !/^\/uploads\/[A-Za-z0-9._-]+$/.test(v)) {
      return res.json({ status: 'error', message: '背景图地址不合法' });
    }
    site.bg_image = v || null;
  }
  if (footer_text !== undefined) site.footer_text = String(footer_text || '').slice(0, 255);
    // 🎨 二十七期：风格细分维度。空字符串 = 用模板默认，非法值直接拒绝（不静默改默认）。
    const STYLE_FIELDS = {
      ui_radius: ['square', 'soft', 'round', 'pill'],
      ui_density: ['compact', 'normal', 'relaxed'],
      card_style: ['outline', 'glass', 'solid'],
      font_style: ['sans', 'rounded', 'serif', 'mono'],
      btn_shape: ['pill', 'rounded', 'square'],
      hero_layout: ['center', 'split', 'banner'],
      // 🎨 四十一期：结构级 DIY（换版式，不只是换色）
      hero_variant: ['center', 'split', 'editorial', 'terminal'],
      services_variant: ['cards', 'table', 'ranked'],
      // 🎨 六十三期：可视化编辑器的字号档位（不给 px，只给小 / 标准 / 大）
      font_scale: ['sm', 'md', 'lg']
    };
    for (const [field, allowed] of Object.entries(STYLE_FIELDS)) {
      const raw = req.body[field];
      if (raw === undefined) continue;
      const v = String(raw || '').trim();
      if (!v) { site[field] = null; continue; }
      if (!allowed.includes(v)) return res.json({ status: 'error', message: `${field} 取值不合法` });
      site[field] = v;
    }
    if (support_url !== undefined) {
      const u = String(support_url || '').trim();
      // 🔒 只允许 http(s)，防止 javascript: 伪协议挂在客服按钮上
      if (u && !/^https?:\/\//i.test(u)) return res.json({ status: 'error', message: '客服链接必须以 http(s):// 开头' });
      site.support_url = u || null;
    }
    // ✍️ 首页文案：站长自己写的话。留空 = 用主站默认文案。
    const textFields = {
      hero_badge: 120, hero_title: 120, hero_subtitle: 255, hero_desc: 255,
      hero_btn1_text: 40, hero_btn2_text: 40
    };
    for (const [k, max] of Object.entries(textFields)) {
      const v = req.body[k];
      if (v !== undefined) site[k] = String(v || '').trim().slice(0, max) || null;
    }
    // 🔒 链接类只允许 http(s) 或站内相对路径，防止 javascript: 伪协议
    for (const k of ['hero_btn1_url', 'hero_btn2_url', 'hero_bg_url']) {
      const v = req.body[k];
      if (v === undefined) continue;
      const u = String(v || '').trim();
      if (u && !/^(https?:\/\/|\/)/i.test(u)) {
        return res.json({ status: 'error', message: '链接必须是以 http(s):// 或 / 开头的地址' });
      }
      // 🔒 图片/链接会被写进 CSS 的 url("...") 里，引号、括号、空白可破坏样式表结构
      if (u && /["'()<>\s\\]/.test(u)) {
        return res.json({ status: 'error', message: '链接里不能包含引号、括号或空格' });
      }
      site[k] = u ? u.slice(0, 512) : null;
    }

    if (home_modules !== undefined) {
      let mods = home_modules;
      if (typeof mods === 'string') { try { mods = JSON.parse(mods); } catch { return res.json({ status: 'error', message: '首页模块格式错误' }); } }
      if (!Array.isArray(mods)) return res.json({ status: 'error', message: '首页模块必须是数组' });
      // 🧩 二十八期：白名单必须与 Home.vue 里真实存在的区块一致，
      //    否则站长在后台配了「谁在用 / 三步开始 / 优势 / 底部号召」也会被这里丢掉
      //    （表现为：后台勾了、首页没变 —— 这类静默丢弃最难查）。
      //    旧键（announce/stats/vip/affiliate）保留，避免已保存的配置失效。
      const ALLOWED = ['audience', 'steps', 'advantages', 'hot_services', 'faq', 'cta',
                       'announce', 'stats', 'vip', 'affiliate'];
      const clean = mods
        .filter(m => m && ALLOWED.includes(m.key))
        .map((m, i) => ({ key: m.key, enabled: m.enabled !== false, order: Number.isFinite(+m.order) ? +m.order : i }))
        .sort((a, b) => a.order - b.order);
      site.home_modules = JSON.stringify(clean.slice(0, 12));
    }

    // 🧱 五十一期：优势三卡片内容（站长可改图标/标题/正文）
    //    祥哥定调「站长要能全方位 DIY」→ 原来这三张卡只有标题能改，正文是平台写死的。
    //    限制：固定 3 张、图标最多 2 个字符（emoji）、标题 30、正文 80，防止把版面撑爆。
    if (req.body.advantages !== undefined) {
      let adv = req.body.advantages;
      if (typeof adv === 'string') {
        try { adv = adv ? JSON.parse(adv) : []; } catch { return res.json({ status: 'error', message: '优势卡片格式错误' }); }
      }
      if (adv && !Array.isArray(adv)) return res.json({ status: 'error', message: '优势卡片必须是数组' });
      const cleanAdv = (Array.isArray(adv) ? adv : [])
        .slice(0, 3)
        .map((it) => ({
          // 图标只保留可见字符：尖括号/引号一律清掉，
          // 否则填 <img 会被截成半截标签，在卡片上显示成 "<img" 很奇怪
          icon: String((it && it.icon) || '').replace(/[<>"'`]/g, '').trim().slice(0, 4),
          title: String((it && it.title) || '').trim().slice(0, 30),
          body: String((it && it.body) || '').trim().slice(0, 80)
        }))
        .filter((it) => it.title || it.body);
      site.advantages = cleanAdv.length ? JSON.stringify(cleanAdv) : null;
    }

    // 📝 四十一期：每个首页区块的标题/副标题（站长逐块改文案）
    //    只接受已知区块键，长度截断，防止把超长 HTML 塞进标题把版面撑爆。
    if (req.body.section_titles !== undefined) {
      let st = req.body.section_titles;
      if (typeof st === 'string') {
        try { st = st ? JSON.parse(st) : {}; } catch { return res.json({ status: 'error', message: '区块文案格式错误' }); }
      }
      if (st && typeof st !== 'object') return res.json({ status: 'error', message: '区块文案格式错误' });
      const KEYS = ['audience', 'steps', 'advantages', 'hot_services', 'faq', 'cta'];
      const cleanSt = {};
      for (const k of KEYS) {
        const v = st && st[k];
        if (!v || typeof v !== 'object') continue;
        const title = String(v.title || '').slice(0, 60).trim();
        const sub = String(v.sub || '').slice(0, 80).trim();
        if (title || sub) cleanSt[k] = { title, sub };
      }
      site.section_titles = Object.keys(cleanSt).length ? JSON.stringify(cleanSt) : null;
    }

    // 💅 四十一期：站长自己的 CSS（高级功能）
    //    CSS 只能影响他自己的分站，风险可控；但仍过滤掉能引入外部资源的写法：
    //    @import 可以外联别人的样式表（顺便把你的访客 IP 送出去）、expression() 是远古 IE 脚本口子，
    //    尖括号一律删掉，避免有人试图在这里拼标签闭合出去。
    if (req.body.custom_css !== undefined) {
      let css = String(req.body.custom_css || '');
      if (css.length > 8000) return res.json({ status: 'error', message: '自定义 CSS 不能超过 8000 字符' });
      css = css
        .replace(/<\/?[a-zA-Z][^>]*>/g, '')
        .replace(/@import[^;]*;?/gi, '')
        .replace(/expression\s*\(/gi, '')
        .replace(/javascript:/gi, '');
      site.custom_css = css.trim() ? css : null;
    }

    // 🖼 站点图标（浏览器标签上的小图标）
    if (req.body.favicon_url !== undefined) {
      const fav = String(req.body.favicon_url || '').trim();
      if (fav && !/^https?:\/\//i.test(fav) && !fav.startsWith('/')) {
        return res.json({ status: 'error', message: '图标地址必须是 http(s):// 开头或站内路径' });
      }
      site.favicon_url = fav ? fav.slice(0, 512) : null;
    }

    // 🔒 两个价格字段可单独修改，但必须按"改完之后"的组合校验，
    // 否则可先压低倍率、再压低折扣绕过单字段检查。
    if (multiplier !== undefined || agent_discount !== undefined) {
      const nextMultiplier = multiplier !== undefined ? parseFloat(multiplier) : parseFloat(site.multiplier);
      const nextDiscount = agent_discount !== undefined ? parseFloat(agent_discount) : parseFloat(site.agent_discount);
      const priceErr = pricingError(nextMultiplier, nextDiscount, await getGlobalMultiplier());
      if (priceErr) {
        return res.json({ status: 'error', message: priceErr });
      }
      if (multiplier !== undefined) site.multiplier = nextMultiplier;
      if (agent_discount !== undefined) site.agent_discount = nextDiscount;
    }

    // 🎫 折扣促销：站长给自己的客户打折（限时/长期）
    //    🔒 与倍率联立校验：倍率 × 折扣 不得低于站长进货倍率，否则每单倒亏。
    if (discount_rate !== undefined || discount_label !== undefined || discount_until !== undefined) {
      const nextMult = multiplier !== undefined ? parseFloat(multiplier) : parseFloat(site.multiplier);
      const nextRate = discount_rate !== undefined ? parseFloat(discount_rate) : parseFloat(site.discount_rate);
      const costMult = siteCostMultiplier(site.agent_discount, await getGlobalMultiplier());

      if (discount_rate !== undefined) {
        if (!isFinite(nextRate) || nextRate <= 0) return res.json({ status: 'error', message: '折扣必须大于 0' });
        if (nextRate > 1) return res.json({ status: 'error', message: '折扣不能大于 1（1 = 不打折，0.85 = 八五折）' });
        const floorRate = Number((costMult / nextMult).toFixed(4));
        if (nextRate < floorRate - 0.0001) {
          return res.json({
            status: 'error',
            message: `折扣太深：你的倍率 ${nextMult} × 折扣 ${nextRate} = ${(nextMult * nextRate).toFixed(2)}，低于进货倍率 ${costMult}，每单会倒亏。最低只能打到 ${floorRate}（约 ${(floorRate * 10).toFixed(1)} 折）。`
          });
        }
        site.discount_rate = nextRate;
      }
      if (discount_label !== undefined) site.discount_label = String(discount_label || '').trim().slice(0, 40) || null;
      if (discount_until !== undefined) {
        let until = discount_until;
        if (typeof until === 'string' && !/^\d+$/.test(until.trim())) {
          const dt = Date.parse(until);
          until = isFinite(dt) ? Math.floor(dt / 1000) : 0;
        }
        until = parseInt(until) || 0;
        site.discount_until = until > 0 ? until : 0;
      }
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
    const cert = await ensureCert(domain, process.env.SITE_DIST_ROOT || path.resolve(process.cwd(), '..', 'client', 'dist'));
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
    const goneDomain = site.custom_domain;
    removeVhost(site.id, goneDomain);
    try { reloadNginx(); } catch (e) {}
    // 🧹 74 期：解绑时把证书也一起清掉。
    //    之前只删 vhost，Let's Encrypt 的证书目录会一直留着 ——
    //    站长换域名换几次，/etc/letsencrypt/live 里就堆一堆废证书，
    //    而 LE 对「同一组域名重复签发」有每周 5 张的限制，堆到后面会签不下来。
    //    删证书是尽力而为：失败也不该让解绑整体失败。
    if (goneDomain) {
      try {
        const safeDom = String(goneDomain).replace(/[^a-z0-9.-]/gi, '');
        if (/^[a-z0-9.-]+$/i.test(safeDom)) {
          const { execSync } = await import('child_process');
          const fsmod = await import('fs');
          if (fsmod.existsSync(`/etc/letsencrypt/live/${safeDom}`)) {
            execSync(`certbot delete --cert-name ${safeDom} --non-interactive`, { stdio: 'pipe', timeout: 30000 });
          }
          for (const ext of ['crt', 'key']) {
            const p = `/etc/nginx/ssl/${safeDom}.${ext}`;
            if (fsmod.existsSync(p)) fsmod.unlinkSync(p);
          }
        }
      } catch (e) { /* 清不掉就算了，不影响解绑 */ }
    }
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
// 🖼️ 三十七期：站长上传 Logo / 首页背景图。
//    之前只能填「图片地址」，非技术站长根本没法把图片传到网上 —— 想要个头像都做不到。
//    这里收 3MB 以内的常见图片，存到 dist 之外的独立目录（重新部署不会把图冲掉）。
const UPLOAD_DIR = process.env.SITE_UPLOAD_DIR || '/var/www/xnow-uploads';
const siteUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype || '');
    cb(ok ? null : new Error('只支持 PNG / JPG / WEBP / GIF 图片'), ok);
  }
});

router.post('/:id/upload', authenticate, (req, res) => {
  siteUpload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ status: 'error', message: err.message || '上传失败' });
    try {
      const site = await Site.findByPk(req.params.id);
      if (!site) return res.status(404).json({ status: 'error', message: '分站不存在' });
      const isStaffU = ['admin', 'super_admin'].includes(req.user.role);
      if (!isStaffU && site.owner_id !== req.user.id) return res.status(403).json({ status: 'error', message: '无权操作' });
      if (!req.file || !req.file.buffer) return res.status(400).json({ status: 'error', message: '没有收到文件' });

      const ext = ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' })[req.file.mimetype] || '.png';
      const name = `site-${site.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, name), req.file.buffer);

      res.json({ status: 'success', message: '上传成功', data: { url: `/uploads/${name}` } });
    } catch (e) {
      res.status(500).json({ status: 'error', message: '上传失败: ' + e.message });
    }
  });
});
// 🔧 「修复域名」：重新生成 vhost + 重载 nginx。
//    典型场景：建站时 nginx 恰好不可用、或站长改过 DNS 后要重试。
router.post('/:id/publish', authenticate, async (req, res) => {
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) return res.status(404).json({ status: 'error', message: '分站不存在' });
    const isStaff = ['admin', 'super_admin'].includes(req.user.role);
    if (!isStaff && site.owner_id !== req.user.id) return res.status(403).json({ status: 'error', message: '无权操作' });
    if (!isFreeSubdomain(site.domain)) {
      return res.json({ status: 'error', message: '自有域名请用「绑定域名」功能' });
    }
    const cert = await ensureCert(site.domain, process.env.SITE_DIST_ROOT || path.resolve(process.cwd(), '..', 'client', 'dist'));
    const backendPort = parseInt(process.env.PORT) || 3000;
    const distRoot = process.env.SITE_DIST_ROOT || path.resolve(process.cwd(), '..', 'client', 'dist');
    writeVhost({ siteId: site.id, domain: site.domain, backendPort, distRoot, cert });
    reloadNginx();
    site.domain_status = 'active';
    site.cert_mode = cert.mode;
    await site.save();
    bustSiteCache();
    res.json({
      status: 'success',
      message: cert.mode === 'letsencrypt' ? '域名已生效（正式证书）' : '域名已生效（自签证书，浏览器可能提示不安全）',
      data: { domain: site.domain, cert_mode: cert.mode }
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '发布失败: ' + e.message });
  }
});
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
    // ⚠️ 免费子域名走的是 site.domain，不是 custom_domain ——
    //    只清 custom_domain 会留下"已删除的店"的 vhost 继续对外服务，
    //    而站点记录已没了 → 访客会看到主站首页（等于暴露平台）。
    //    所以两个字段都要清，最后统一 reload 一次。
    let needReload = false;
    for (const d of [site.custom_domain, site.domain]) {
      if (!d) continue;
      try {
        if (removeVhost(site.id, d, { keepCert: true })) needReload = true;
        // 🪦 立墓碑：410 Gone。
        //    不立的话，vhost 一删该域名就落到 nginx 默认 server（= 主站首页）——
        //    已删除的店域名还能打开、还显示平台的样子，等于把平台暴露给对方。
        if (parkDomain(d)) needReload = true;
      } catch (e) {}
    }
    if (needReload) { try { reloadNginx(); } catch (e) {} }

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
