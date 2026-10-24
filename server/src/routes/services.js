import express from 'express';
import { Service, Config, User, SiteServicePrice } from '../models/index.js';
import { customerDiscountMultiplier } from '../utils/customerPrice.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// 公开：未登录也能浏览服务（下单时才要求登录）
router.get('/public', async (req, res) => {
  try {
    const configs = await Config.findAll({ where: { key: ['global_multiplier'] } });
    const conf = {}; configs.forEach(c => conf[c.key] = c.value);
    // 🏬 分站：首页展示的必须是**站长定的售价**，不能用平台倍率
    const multiplier = req.site ? parseFloat(req.site.multiplier) : parseFloat(conf.global_multiplier || 2.0);

    // 💰 分站的「单服务定价」与「活动折扣」也要反映到列表价上，
    //    否则客户看到的价和下单实扣的价对不上（历史上就吃过这个亏）。
    let overrideMap = new Map();
    let siteDiscount = 1;
    if (req.site) {
      try {
        const rows = await SiteServicePrice.findAll({ where: { site_id: req.site.id } });
        overrideMap = new Map(rows.map(r => [Number(r.service_id), parseFloat(r.rate)]));
      } catch (e) { overrideMap = new Map(); }
      const dr = parseFloat(req.site.discount_rate);
      const du = parseInt(req.site.discount_until || 0);
      const active = isFinite(dr) && dr > 0 && dr < 1 && !(du > 0 && Math.floor(Date.now() / 1000) > du);
      siteDiscount = active ? dr : 1;
    }

    const services = await Service.findAll({ order: [['sort', 'ASC']] });
    const formatted = services.map(s => {
      // 🔌 与下单扣费口径保持一致：custom_rate 优先（订单路由本来就是这么算的，
      //    此前这里只读 rate，导致"页面显示 0.33、实际扣 0.99"这种不一致）
      const baseRate = (s.custom_rate !== null && s.custom_rate !== undefined) ? parseFloat(s.custom_rate) : parseFloat(s.rate);
      // 站长单价优先，其次总倍率；最后统一乘活动折扣
      const listPrice = overrideMap.has(Number(s.service_id))
        ? overrideMap.get(Number(s.service_id))
        : baseRate * multiplier;
      const finalPrice = Number((listPrice * siteDiscount).toFixed(4));
      return {
        service: s.service_id, name: s.name, type: s.type, category: s.category,
        // 🔒 不再下发 `rate`（成本基价）：这是平台/站长的进货底价，
        //    公开接口把它吐出去，等于把「你赚多少」摊开给客户看。
        //    前端只用到 sell_price（已核实 Home.vue 唯一消费点）。
        min: s.min, max: s.max,
        sell_price: finalPrice,
        description: s.description
      };
    });
    res.json({ status: 'success', data: formatted });
  } catch (err) {
    res.status(500).json({ status: 'error', message: '加载失败' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const configs = await Config.findAll({ where: { key: ['global_multiplier', 'agent_discount'] } });
    const conf = {}; configs.forEach(c => conf[c.key] = c.value);

    const baseMultiplier = parseFloat(conf.global_multiplier || 2.0);
    const agentDiscount = parseFloat(conf.agent_discount || 0.8);

    // 🏬 分站：列表价必须与下单扣款同口径（站长倍率），否则客户会看到
    //    「标价 0.05、扣款 0.33」—— 这种不一致会直接被投诉成"骗人"。
    //    注意这里只影响"显示"，下单时的权威计算仍在 orders.js。
    const siteMultiplier = req.site ? parseFloat(req.site.multiplier) : 0;

    // 💡 核心修复：永远信任数据库中的最新角色，而不是 JWT 缓存的角色
    const user = await User.findByPk(req.user.id);
    const actualRole = user ? user.role : req.user.role;
    
    let finalMultiplier = baseMultiplier;
    
    if (req.site) {
      // 分站定价权归站长（管理员本人仍按原价，便于对账）
      finalMultiplier = (actualRole === 'super_admin' || actualRole === 'admin') ? 1.0 : siteMultiplier;
    } else if (actualRole === 'super_admin' || actualRole === 'admin') {
      finalMultiplier = 1.0;
    } else if (user && user.custom_multiplier !== null && user.custom_multiplier !== undefined) {
      finalMultiplier = parseFloat(user.custom_multiplier);
    } else if (actualRole === 'agent') {
      finalMultiplier = baseMultiplier * agentDiscount;
    }

    // 🏷 93 期（顺带修）：站点「活动折扣」以前只在扣费时算，列表价没算 ——
    //    客户看到的价和真正扣的价不一致（显示 62.5 / 实扣 56.25）。
    //    现在显示链路补齐这一步，与 orders.js 的乘算顺序完全一致：
    //      站长倍率 → 站点活动折扣 → 客户分组价/单独定价 → 成本下限
    if (req.site) {
      const dr0 = parseFloat(req.site.discount_rate);
      const du0 = parseInt(req.site.discount_until || 0);
      const discountActive = isFinite(dr0) && dr0 > 0 && dr0 < 1 && !(du0 > 0 && Math.floor(Date.now() / 1000) > du0);
      if (discountActive) finalMultiplier = finalMultiplier * dr0;
    }

    // 👥 93 期：客户分组价（显示价必须与 orders.js 的扣费口径一致）
    let customerMult = 1;
    if (req.site && user) {
      try { customerMult = await customerDiscountMultiplier(req.site.id, user) || 1; } catch (e) { customerMult = 1; }
    }
    if (customerMult > 0 && customerMult < 1) finalMultiplier = finalMultiplier * customerMult;

    // 🛡 与 orders.js 的兜底护栏一致：列表价也不得低于站长成本
    let costMultiplier = 0;
    if (req.site) {
      costMultiplier = baseMultiplier * agentDiscount;
    }

    const services = await Service.findAll({ order: [['sort', 'ASC']] });

    // 🔑 管理员看上游原价（custom_rate 只面向客户）—— 与 orders.js 扣费口径完全一致
    const isStaff = actualRole === 'super_admin' || actualRole === 'admin';

    const formatted = services.map(s => {
      const baseRate = (!isStaff && s.custom_rate !== null && s.custom_rate !== undefined)
        ? parseFloat(s.custom_rate)
        : parseFloat(s.rate);
      // 分站：售价不得低于站长成本（与下单护栏同口径，避免"买得起卖不起"）
      let shown = baseRate * finalMultiplier;
      if (req.site && costMultiplier > 0) {
        const floor = baseRate * costMultiplier;
        if (shown < floor) shown = floor;
      }
      return {
        service: s.service_id,
        name: s.name,
        type: s.type,
        category: s.category,
        rate: shown.toFixed(4),
        min: s.min,
        max: s.max,
        refill: s.refill,
        cancel: s.cancel,
        description: s.description
      };
    });

    res.json({ status: 'success', data: formatted });
  } catch (err) {
    res.status(500).json({ status: 'error', message: '拉取商品库失败' });
  }
});
export default router;
