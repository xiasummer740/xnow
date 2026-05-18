import express from 'express';
import axios from 'axios';
import { sequelize, Order, Service, Config, User, Transaction } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { sendTgMessage } from '../utils/tgBot.js';

const router = express.Router();

router.post('/add', authenticate, async (req, res) => {
  // 💡 核心修复 1：解除参数封锁，放行 comments 和 custom_comments
  const { serviceId, link, quantity, comments, custom_comments } = req.body;
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

    // 分站定价覆盖
    const baseMultiplier = req.site ? parseFloat(req.site.multiplier) : parseFloat(conf.global_multiplier || 2.0);
    const agentDiscount = req.site ? parseFloat(req.site.agent_discount) : parseFloat(conf.agent_discount || 0.8);

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

    // 💡 核心修复 2：动态组装上游 API 载荷，绝不漏掉评论数据
    const payloadObj = { key: keyConf.value, action: 'add', service: serviceId, link, quantity };
    if (comments) payloadObj.comments = comments;
    if (custom_comments) payloadObj.custom_comments = custom_comments;
    const payload = new URLSearchParams(payloadObj);
    
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

      // 💡 核心优化：TG 机器人增加对自定义评论的侦测播报
      const roleName = user ? (user.role === 'super_admin' ? '至尊管理员' : user.role === 'admin' ? '管理员' : user.role === 'agent' ? '👑 至尊代理' : '黄金用户') : '系统神权';
      const commentMark = comments ? `\n💬 <b>评论:</b> 包含 ${comments.split('\n').length} 行自定义内容` : '';
      
      sendTgMessage(`🛒 <b>用户新订单提交</b>\n🆔 <b>UID:</b> <code>${user ? user.id : '0'}</code>\n📱 <b>账号:</b> <code>${user ? user.phone : '最高管理'}</code>\n📧 <b>邮箱:</b> ${user ? (user.email || '未绑定') : '系统'}\n🔰 <b>等级:</b> ${roleName}\n📦 <b>商品:</b> [ID:${serviceId}] ${service.name}\n🔢 <b>数量:</b> ${quantity}\n💸 <b>扣费:</b> ￥${charge}\n🔗 <b>目标:</b> <code>${link}</code>${commentMark}\n🔖 <b>系统单号:</b> <code>${newOrder.order_no}</code>\n📡 <b>上游单号:</b> <code>${upRes.data.order}</code>`);

      res.json({ status: 'success', message: '✅ 订单已秒级提交至全网', order_id: newOrder.order_no });
    } else {
      await t.rollback();
      const rawErr = String(upRes.data?.error || upRes.data?.message || '上游返回异常状态');
      const errMap = {
        'not enough funds': '上游账户余额不足，请联系管理员充值',
        'incorrect request': '请求参数有误，请检查链接格式或服务是否有效',
        'invalid link': '目标链接无效，请检查链接格式',
        'service not found': '该服务已下架或暂停，请选择其他服务',
        'min_quantity': '数量低于该服务最低要求',
        'max_quantity': '数量超过该服务最高限制',
        'duplicate': '请勿重复提交相同链接的订单',
        'comments': '自定义评论内容不符合规范，请修改后重试',
      };
      let friendlyMsg = rawErr;
      for (const [key, val] of Object.entries(errMap)) {
        if (rawErr.toLowerCase().includes(key)) { friendlyMsg = val; break; }
      }
      res.json({ status: 'error', message: friendlyMsg });
    }
  } catch (e) {
    await t.rollback();
    res.json({ status: 'error', message: '系统繁忙，请稍后重试' });
  }
});

// 批量下单
router.post('/batch', authenticate, async (req, res) => {
  const { orders: batchOrders } = req.body;
  if (!Array.isArray(batchOrders) || batchOrders.length === 0) {
    return res.json({ status: 'error', message: '请提供有效的批量订单数据' });
  }
  if (batchOrders.length > 50) {
    return res.json({ status: 'error', message: '单次批量最多50条，请分批提交' });
  }

  const configs = await Config.findAll({ where: { key: ['global_multiplier', 'agent_discount', 'upstream_url', 'upstream_key'] } });
  const conf = {}; configs.forEach(c => conf[c.key] = c.value);
  if (!conf.upstream_url || !conf.upstream_key) {
    return res.json({ status: 'error', message: '系统尚未配置上游API密钥' });
  }

  const baseMultiplier = req.site ? parseFloat(req.site.multiplier) : parseFloat(conf.global_multiplier || 2.0);
  const agentDiscount = req.site ? parseFloat(req.site.agent_discount) : parseFloat(conf.agent_discount || 0.8);

  const results = [];
  let totalCharge = 0;

  for (const item of batchOrders) {
    const { serviceId, link, quantity } = item;
    if (!serviceId || !link || !quantity || parseInt(quantity) <= 0) {
      results.push({ serviceId, link, quantity, status: 'error', message: '参数非法' });
      continue;
    }

    const t = await sequelize.transaction();
    try {
      const service = await Service.findByPk(serviceId, { transaction: t });
      if (!service) { await t.rollback(); results.push({ serviceId, link, quantity, status: 'error', message: '商品不存在' }); continue; }

      const qty = parseInt(quantity);
      if (qty < service.min || qty > service.max) {
        await t.rollback();
        results.push({ serviceId, link, quantity, status: 'error', message: `数量限制: ${service.min}-${service.max}` });
        continue;
      }

      let user = await User.findByPk(req.user.id, { transaction: t });
      if (!user && req.user.role !== 'super_admin') { await t.rollback(); results.push({ serviceId, link, quantity, status: 'error', message: '账户异常' }); continue; }

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
      const charge = parseFloat(((qty / 1000) * sellRate).toFixed(4));
      const upstream_charge = parseFloat(((qty / 1000) * parseFloat(service.rate)).toFixed(4));

      if (user && parseFloat(user.balance) - totalCharge < parseFloat(charge)) {
        await t.rollback();
        results.push({ serviceId, link, quantity, status: 'error', message: `余额不足，需要 ¥${charge}` });
        continue;
      }

      const payloadObj = { key: conf.upstream_key, action: 'add', service: serviceId, link, quantity: qty };
      const payload = new URLSearchParams(payloadObj);
      const upRes = await axios.post(conf.upstream_url, payload.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000
      });

      if (upRes.data && upRes.data.order) {
        const orderNo = 'XN' + Date.now() + Math.floor(Math.random() * 100);
        const newOrder = await Order.create({
          order_no: orderNo, user_id: req.user.id, phone: user ? user.phone : 'SuperAdmin',
          upstream_order_id: String(upRes.data.order), service_id: serviceId,
          service_name: service.name, link, quantity: qty, charge, upstream_charge, status: '排队中'
        }, { transaction: t });

        if (user) {
          totalCharge += parseFloat(charge);
          user.balance = (parseFloat(user.balance) - parseFloat(charge)).toFixed(6);
          await user.save({ transaction: t });

          await Transaction.create({
            user_id: user.id, phone: user.phone, amount: -charge, balance: user.balance,
            type: '批量订单扣款', description: `批量购买 [ID:${serviceId}] ${service.name} 数量:${qty}`
          }, { transaction: t });
        }

        await t.commit();
        results.push({ serviceId, link, quantity: qty, status: 'success', order_no: orderNo, charge });
      } else {
        await t.rollback();
        results.push({ serviceId, link, quantity, status: 'error', message: upRes.data?.error || '上游异常' });
      }
    } catch (e) {
      await t.rollback().catch(() => {});
      results.push({ serviceId, link, quantity, status: 'error', message: `系统错误: ${e.message}` });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status === 'error').length;

  // TG 播报
  if (user) {
    const roleName = user.role === 'super_admin' ? '至尊管理员' : user.role === 'admin' ? '管理员' : user.role === 'agent' ? '👑 至尊代理' : '黄金用户';
    sendTgMessage(`📦 <b>批量下单完成</b>\n🆔 <b>UID:</b> <code>${user.id}</code>\n📱 <b>账号:</b> <code>${user.phone}</code>\n🔰 <b>等级:</b> ${roleName}\n✅ <b>成功:</b> ${successCount} 单\n❌ <b>失败:</b> ${failCount} 单\n💸 <b>总扣费:</b> ￥${totalCharge.toFixed(2)}`);
  }

  res.json({ status: 'success', data: { total: batchOrders.length, success: successCount, fail: failCount, total_charge: totalCharge.toFixed(4), results } });
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
