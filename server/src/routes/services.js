import express from 'express';
import { Service, Config, User } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// 公开：未登录也能浏览服务（下单时才要求登录）
router.get('/public', async (req, res) => {
  try {
    const configs = await Config.findAll({ where: { key: ['global_multiplier'] } });
    const conf = {}; configs.forEach(c => conf[c.key] = c.value);
    const multiplier = parseFloat(conf.global_multiplier || 2.0);

    const services = await Service.findAll({ order: [['sort', 'ASC']] });
    const formatted = services.map(s => ({
      service: s.service_id, name: s.name, type: s.type, category: s.category,
      rate: parseFloat(s.rate), min: s.min, max: s.max,
      sell_price: parseFloat((parseFloat(s.rate) * multiplier).toFixed(4)),
      description: s.description
    }));
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
    
    // 💡 核心修复：永远信任数据库中的最新角色，而不是 JWT 缓存的角色
    const user = await User.findByPk(req.user.id);
    const actualRole = user ? user.role : req.user.role;
    
    let finalMultiplier = baseMultiplier;
    
    if (actualRole === 'super_admin' || actualRole === 'admin') {
      finalMultiplier = 1.0;
    } else if (user && user.custom_multiplier !== null && user.custom_multiplier !== undefined) {
      finalMultiplier = parseFloat(user.custom_multiplier);
    } else if (actualRole === 'agent') {
      finalMultiplier = baseMultiplier * agentDiscount;
    }

    const services = await Service.findAll({ order: [['sort', 'ASC']] });
    
    const formatted = services.map(s => ({
      service: s.service_id,
      name: s.name,
      type: s.type,
      category: s.category,
      rate: (parseFloat(s.rate) * finalMultiplier).toFixed(4),
      min: s.min,
      max: s.max,
      refill: s.refill,
      cancel: s.cancel,
      description: s.description
    }));

    res.json({ status: 'success', data: formatted });
  } catch (err) {
    res.status(500).json({ status: 'error', message: '拉取商品库失败' });
  }
});
export default router;
