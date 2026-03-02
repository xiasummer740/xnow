import express from 'express';
import axios from 'axios';
import { Config, User, Order, Transaction } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { sendTgMessage } from '../utils/tgBot.js';

const router = express.Router();

router.post('/config/update', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error', message: '权限不足' });
  try {
    for (const [key, value] of Object.entries(req.body)) {
      if (value !== undefined && value !== null) await Config.upsert({ key, value: String(value) });
    }
    res.json({ status: 'success', message: '配置已保存' });
  } catch (err) { res.status(500).json({ status: 'error' }); }
});

router.get('/dashboard', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const configs = await Config.findAll();
    const configMap = {};
    configs.forEach(c => configMap[c.key] = c.value);

    let upBalance = '等待对接API';
    if (configMap.upstream_url && configMap.upstream_key) {
      try {
        const payload = new URLSearchParams({ key: configMap.upstream_key, action: 'balance' });
        const bRes = await axios.post(configMap.upstream_url, payload.toString());
        if (bRes.data && bRes.data.balance) upBalance = String(bRes.data.balance);
      } catch(e) {}
    }

    // findAll 会自动携带包括 is_banned 等所有新增字段
    const users = await User.findAll({ limit: 50, order: [['created_at', 'DESC']] });
    const orders = await Order.findAll({ limit: 50, order: [['created_at', 'DESC']] });
    const txs = await Transaction.findAll({ limit: 50, order: [['created_at', 'DESC']] });
    const totalOrders = await Order.count();

    res.json({ status: 'success', upstreamBalance: { balance: upBalance }, users, orders, transactions: txs, config: configMap, totalOrders });
  } catch (err) { res.status(500).json({ status: 'error' }); }
});

router.post("/user/role", authenticate, async (req, res) => {
  if (!["admin", "super_admin"].includes(req.user.role)) return res.status(403).json({ status: "error", message: "权限不足" });
  const { userId, role, addDays } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ status: "error", message: "用户不存在" });
    if (user.role === "super_admin" && req.user.role !== "super_admin") return res.json({ status: "error", message: "无法越权修改至尊管理员" });
    
    const oldRole = user.role;
    user.role = role;
    if (role === "agent" && addDays > 0) {
      const now = Date.now();
      const currentExpire = user.vip_expire_at ? new Date(user.vip_expire_at).getTime() : now;
      const baseTime = currentExpire > now ? currentExpire : now;
      user.vip_expire_at = new Date(baseTime + Number(addDays) * 24 * 60 * 60 * 1000);
    } else if (role !== "agent") {
      user.vip_expire_at = null;
    }
    await user.save();
    
    const roleNameEn = oldRole === 'super_admin' ? '至尊管理员' : oldRole === 'admin' ? '管理员' : oldRole === 'agent' ? '👑 至尊代理' : '黄金用户';
    const roleNameNew = role === 'super_admin' ? '至尊管理员' : role === 'admin' ? '管理员' : role === 'agent' ? '👑 至尊代理' : '黄金用户';

    sendTgMessage(`🛡️ <b>[管理操作] 用户权限调度</b>\n🆔 <b>UID:</b> <code>${user.id}</code>\n👤 <b>账号:</b> <code>${user.phone}</code>\n📧 <b>邮箱:</b> ${user.email || '未绑定'}\n🔄 <b>变更:</b> ${roleNameEn} ➡️ ${roleNameNew}\n⏳ <b>赠送时长:</b> ${addDays > 0 ? addDays + ' 天' : '无'}`);

    res.json({ status: "success", message: "权限与时长已同步更新" });
  } catch (e) {
    res.status(500).json({ status: "error", message: "调度失败" });
  }
});

router.post('/user/update', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const { userId, type, amount, multiplier, phone } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ status: 'error', message: '用户不存在' });
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') return res.json({ status: 'error', message: '无法修改最高管理员' });

    if (type === 'fund') {
      user.balance = (parseFloat(user.balance) + parseFloat(amount)).toFixed(6);
      await user.save();
      await Transaction.create({
        user_id: user.id, phone: user.phone, amount: parseFloat(amount), balance: user.balance,
        type: '后台调账', description: `管理员手动调账: ${amount > 0 ? '+' : ''}${amount}`
      });
      
      const roleName = user.role === 'super_admin' ? '至尊管理员' : user.role === 'admin' ? '管理员' : user.role === 'agent' ? '👑 至尊代理' : '黄金用户';
      sendTgMessage(`⚠️ <b>[管理操作] 后台强行调账</b>\n🆔 <b>UID:</b> <code>${user.id}</code>\n👤 <b>账号:</b> <code>${user.phone}</code>\n📧 <b>邮箱:</b> ${user.email || '未绑定'}\n🔰 <b>等级:</b> ${roleName}\n💵 <b>操作:</b> ${amount > 0 ? '系统加款' : '系统扣除'} ￥${Math.abs(amount)}\n💳 <b>当前余额:</b> ￥${parseFloat(user.balance).toFixed(2)}`);
      
    } else if (type === 'multiplier') {
      if (multiplier === 'default' || multiplier === null || multiplier === '') {
        user.custom_multiplier = null;
      } else {
        user.custom_multiplier = parseFloat(multiplier).toFixed(2);
      }
      await user.save();
    }
    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ status: 'error' });
  }
});

// 💡 核心风控：管理员控制用户封禁状态
router.post('/user/ban', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error', message: '权限不足' });
  const { userId, reason } = req.body;
  try {
    const targetUser = await User.findByPk(userId);
    if (!targetUser) return res.status(404).json({ status: 'error', message: '目标用户不存在' });

    if (String(targetUser.id) === String(req.user.id)) return res.status(403).json({ status: 'error', message: '操作拒绝：您不能封禁自己！' });
    if (targetUser.role === 'super_admin') return res.status(403).json({ status: 'error', message: '操作拒绝：至尊管理员受到系统底层保护，绝对免疫封禁！' });
    if (['admin', 'super_admin'].includes(targetUser.role) && req.user.role !== 'super_admin') {
       return res.status(403).json({ status: 'error', message: '越权拦截：普通管理员无法封禁同级或高级账号' });
    }

    targetUser.is_banned = !targetUser.is_banned;
    targetUser.ban_reason = targetUser.is_banned ? (reason || '管理员强制封禁') : null;
    await targetUser.save();

    const action = targetUser.is_banned ? '🚫 强制封禁' : '✅ 解除封禁';
    sendTgMessage(`🛡️ <b>[风控中心] 账号状态变更</b>\n执行官: <code>UID ${req.user.id}</code>\n目标用户: <code>UID ${targetUser.id} (${targetUser.phone})</code>\n动作: ${action}\n原因: ${targetUser.ban_reason || '无'}`);

    res.json({ status: 'success', message: `操作成功，该用户已被${targetUser.is_banned ? '强制封禁' : '解封'}` });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '操作失败' });
  }
});

router.post('/user/delete', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error', message: '权限不足' });
  const { userId } = req.body;
  try {
    const targetUser = await User.findByPk(userId);
    if (!targetUser) return res.status(404).json({ status: 'error', message: '目标用户不存在' });
    if (String(targetUser.id) === String(req.user.id)) return res.status(403).json({ status: 'error', message: '操作拒绝：您不能注销自己！' });
    if (['admin', 'super_admin'].includes(targetUser.role) && req.user.role !== 'super_admin') return res.status(403).json({ status: 'error', message: '越权拦截：普通管理员无法删除同级或高级账号' });
    if (targetUser.role === 'super_admin') return res.status(403).json({ status: 'error', message: '极度危险：至尊管理员账号受到底层保护，无法被任何人删除！' });

    const ghostInfo = `🆔 UID: ${targetUser.id} | 📱 手机: ${targetUser.phone} | 💰 余额: ${targetUser.balance}`;
    await Transaction.destroy({ where: { user_id: targetUser.id } });
    await Order.destroy({ where: { user_id: targetUser.id } });
    await targetUser.destroy();
    sendTgMessage(`💥 <b>[管理操作] 执行死刑：账号抹除</b>\n执行官: <code>UID ${req.user.id}</code>\n被抹除的账号信息：\n${ghostInfo}`);
    res.json({ status: 'success', message: '已彻底抹除该用户及其产生的所有数据流水' });
  } catch (e) { res.status(500).json({ status: 'error', message: '删除失败，服务器异常' }); }
});

export default router;
