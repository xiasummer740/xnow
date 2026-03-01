import express from 'express';
import axios from 'axios';
import { sequelize, Order, Service, Config, User, Transaction } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { sendTgMessage } from '../utils/tgBot.js';

const router = express.Router();

router.post('/add', authenticate, async (req, res) => {
  const { serviceId, link, quantity } = req.body;
  if (!serviceId || !link || !quantity || quantity <= 0) return res.json({ status: 'error', message: '参数非法' });

  const t = await sequelize.transaction();
  try {
    const service = await Service.findByPk(serviceId, { transaction: t });
    if (!service) { await t.rollback(); return res.json({ status: 'error', message: '商品不存在或已下架' }); }

    if (quantity < service.min || quantity > service.max) {
      await t.rollback(); return res.json({ status: 'error', message: `数量限制: ${service.min} - ${service.max}` });
    }

    const configs = await Config.findAll({ where: { key: ['global_multiplier', 'agent_discount'] }, transaction: t });
    const conf = {}; configs.forEach(c => conf[c.key] = c.value);
    
    const baseMultiplier = parseFloat(conf.global_multiplier || 2.0);
    const agentDiscount = parseFloat(conf.agent_discount || 0.8);

    let user = await User.findByPk(req.user.id, { transaction: t });
    if (!user && req.user.role !== 'super_admin') {
        await t.rollback(); return res.json({ status: 'error', message: '账户异常' });
    }
    
    const actualRole = user ? user.role : req.user.role;
    let finalMultiplier = baseMultiplier;

    if (actualRole === 'super_admin' || actualRole === 'admin') { 
      finalMultiplier = 1.0; 
    } else if (user && user.custom_multiplier !== null && user.custom_multiplier !== undefined) { 
      finalMultiplier = parseFloat(user.custom_multiplier); 
    } else if (actualRole === 'agent') { 
      finalMultiplier = baseMultiplier * agentDiscount; 
    }

    const sellRate = parseFloat(service.rate) * finalMultiplier;
    const charge = ((parseInt(quantity) / 1000) * sellRate).toFixed(4);
    const upstream_charge = ((parseInt(quantity) / 1000) * parseFloat(service.rate)).toFixed(4);

    if (user && parseFloat(user.balance) < parseFloat(charge)) {
      await t.rollback(); return res.json({ status: 'error', message: `余额不足，该订单需要 ¥${charge}` });
    }

    if (user) {
      user.balance = (parseFloat(user.balance) - parseFloat(charge)).toFixed(6);
      await user.save({ transaction: t });
    }

    const urlConf = await Config.findOne({where:{key:'upstream_url'}, transaction: t});
    const keyConf = await Config.findOne({where:{key:'upstream_key'}, transaction: t});
    
    if (!urlConf?.value || !keyConf?.value) {
      await t.rollback(); return res.json({ status: 'error', message: '系统尚未配置上游API密钥' });
    }

    const payload = new URLSearchParams({ key: keyConf.value, action: 'add', service: serviceId, link, quantity });
    
    let upRes;
    try {
      upRes = await axios.post(urlConf.value, payload.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 });
    } catch (axiosErr) {
      await t.rollback();
      return res.json({ status: 'error', message: '网络异常，上游接口未响应，订单已阻断扣款' });
    }
    
    if (upRes.data && upRes.data.order) {
      const orderNo = 'XN' + Date.now() + Math.floor(Math.random()*100);
      const newOrder = await Order.create({
        order_no: orderNo, user_id: req.user.id, phone: user ? user.phone : 'SuperAdmin',
        upstream_order_id: String(upRes.data.order), service_id: serviceId,
        service_name: service.name, link, quantity, charge, upstream_charge, status: '排队中'
      }, { transaction: t });
      
      if (user) {
        await Transaction.create({
          user_id: user.id, phone: user.phone, amount: -charge, balance: user.balance, 
          type: '订单扣款', description: `购买服务 [ID:${serviceId}] 数量:${quantity}`
        }, { transaction: t });
      }
      
      await t.commit(); 

      // 💡 核心强化：TG 增加详尽的用户画像
      const roleName = user ? (user.role === 'super_admin' ? '至尊管理员' : user.role === 'admin' ? '管理员' : user.role === 'agent' ? '👑 至尊代理' : '黄金用户') : '系统神权';
      sendTgMessage(`🛒 <b>用户新订单提交</b>\n🆔 <b>UID:</b> <code>${user ? user.id : '0'}</code>\n📱 <b>账号:</b> <code>${user ? user.phone : '最高管理'}</code>\n📧 <b>邮箱:</b> ${user ? (user.email || '未绑定') : '系统'}\n🔰 <b>等级:</b> ${roleName}\n📦 <b>商品:</b> [ID:${serviceId}] ${service.name}\n🔢 <b>数量:</b> ${quantity}\n💸 <b>扣费:</b> ￥${charge}\n🔗 <b>目标:</b> <code>${link}</code>\n🔖 <b>系统单号:</b> <code>${newOrder.order_no}</code>\n📡 <b>上游单号:</b> <code>${upRes.data.order}</code>`);

      res.json({ status: 'success', message: '✅ 订单已秒级提交至全网', order_id: newOrder.order_no });
    } else {
      await t.rollback();
      res.json({ status: 'error', message: upRes.data.error || '上游返回异常状态，已阻断扣款' });
    }
  } catch (e) {
    await t.rollback();
    res.json({ status: 'error', message: `内部错误: ${e.message}` });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const orders = await Order.findAll({ where: { user_id: req.user.id }, order: [['created_at', 'DESC']] });
    res.json({ status: 'success', data: orders });
  } catch(e) {
    res.json({ status: 'error' });
  }
});
export default router;
