import express from 'express';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Config, User, Order, Transaction } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { sendTgMessage } from '../utils/tgBot.js';
import { createBackup, restoreBackup } from '../utils/backupEngine.js';

const router = express.Router();
const BACKUP_DIR = path.resolve('/var/www/xnow/backups');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BACKUP_DIR),
  filename: (req, file, cb) => cb(null, `uploaded_${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

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
    const configMap = {}; configs.forEach(c => configMap[c.key] = c.value);

    let upBalance = '等待对接API';
    if (configMap.upstream_url && configMap.upstream_key) {
      try {
        const payload = new URLSearchParams({ key: configMap.upstream_key, action: 'balance' });
        const bRes = await axios.post(configMap.upstream_url, payload.toString());
        if (bRes.data && bRes.data.balance) upBalance = String(bRes.data.balance);
      } catch(e) {}
    }

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
    
    const oldRole = user.role; user.role = role;
    if (role === "agent" && addDays > 0) {
      const now = Date.now(); const currentExpire = user.vip_expire_at ? new Date(user.vip_expire_at).getTime() : now;
      user.vip_expire_at = new Date((currentExpire > now ? currentExpire : now) + Number(addDays) * 24 * 60 * 60 * 1000);
    } else if (role !== "agent") { user.vip_expire_at = null; }
    await user.save();
    
    const roleMap = { 'super_admin':'至尊管理员', 'admin':'管理员', 'agent':'👑 至尊代理', 'user':'黄金用户' };
    sendTgMessage(`🛡️ <b>[管理操作] 用户权限调度</b>\n🆔 <b>UID:</b> <code>${user.id}</code>\n👤 <b>账号:</b> <code>${user.phone}</code>\n🔄 <b>变更:</b> ${roleMap[oldRole]} ➡️ ${roleMap[role]}\n⏳ <b>赠送时长:</b> ${addDays > 0 ? addDays + ' 天' : '无'}`);
    res.json({ status: "success", message: "权限与时长已同步更新" });
  } catch (e) { res.status(500).json({ status: "error", message: "调度失败" }); }
});

router.post('/user/update', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const { userId, type, amount, multiplier } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ status: 'error' });
    if (type === 'fund') {
      user.balance = (parseFloat(user.balance) + parseFloat(amount)).toFixed(6);
      await user.save();
      await Transaction.create({ user_id: user.id, phone: user.phone, amount: parseFloat(amount), balance: user.balance, type: '后台调账', description: `管理员手动调账: ${amount > 0 ? '+' : ''}${amount}` });
    } else if (type === 'multiplier') {
      user.custom_multiplier = (multiplier === 'default' || !multiplier) ? null : parseFloat(multiplier).toFixed(2);
      await user.save();
    }
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error' }); }
});

router.post('/user/ban', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const { userId, reason } = req.body;
  try {
    const targetUser = await User.findByPk(userId);
    if (String(targetUser.id) === String(req.user.id) || targetUser.role === 'super_admin') return res.status(403).json({ status: 'error', message: '非法越权操作' });
    targetUser.is_banned = !targetUser.is_banned;
    targetUser.ban_reason = targetUser.is_banned ? (reason || '管理员强制封禁') : null;
    await targetUser.save();
    res.json({ status: 'success', message: `已${targetUser.is_banned ? '强制封禁' : '解封'}` });
  } catch (e) { res.status(500).json({ status: 'error' }); }
});

router.post('/user/delete', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const { userId } = req.body;
  try {
    const targetUser = await User.findByPk(userId);
    if (targetUser.role === 'super_admin') return res.status(403).json({ status: 'error', message: '至尊管理员不可删除' });
    await Transaction.destroy({ where: { user_id: targetUser.id } });
    await Order.destroy({ where: { user_id: targetUser.id } });
    await targetUser.destroy();
    res.json({ status: 'success', message: '已彻底抹除数据' });
  } catch (e) { res.status(500).json({ status: 'error' }); }
});

// 💡 灾备引擎 API
router.get('/backups', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error', message: '仅管理员有权访问灾备中心' });
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql.gz')).map(f => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, size: stats.size, time: stats.mtimeMs };
    }).sort((a, b) => b.time - a.time);
    res.json({ status: 'success', backups: files });
  } catch (e) { res.status(500).json({ status: 'error' }); }
});

router.post('/backup/create', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    await createBackup();
    res.json({ status: 'success', message: '冷冻级快照创建成功' });
  } catch (e) { res.status(500).json({ status: 'error', message: '数据库备份失败' }); }
});

router.post('/backup/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  if (!req.file) return res.status(400).json({ status: 'error', message: '请选择文件' });
  try {
    await restoreBackup(req.file.path);
    sendTgMessage(`🚨 <b>[灾难级数据恢复] 上传还原成功</b>\n执行官: <code>UID ${req.user.id}</code>\n数据包: <code>${req.file.originalname}</code>`);
    res.json({ status: 'success', message: '上传数据已成功覆盖并唤醒全站！' });
  } catch (e) { res.status(500).json({ status: 'error', message: '数据包损坏或恢复失败' }); }
});

router.post('/backup/restore', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const { filename } = req.body;
  try {
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ status: 'error', message: '备份文件不存在' });
    await restoreBackup(filepath);
    sendTgMessage(`🚨 <b>[灾难级数据恢复] 历史快照重置成功</b>\n执行官: <code>UID ${req.user.id}</code>\n快照名: <code>${filename}</code>`);
    res.json({ status: 'success', message: '历史快照已成功注入！' });
  } catch (e) { res.status(500).json({ status: 'error', message: '快照恢复失败' }); }
});

router.get('/backup/download', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).send('Forbidden');
  const { filename } = req.query;
  const filepath = path.join(BACKUP_DIR, filename);
  if (fs.existsSync(filepath)) res.download(filepath);
  else res.status(404).send('File not found');
});

// 💡 核心修复：增加快照物理删除 API
router.post('/backup/delete', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const { filename } = req.body;
  try {
    const filepath = path.join(BACKUP_DIR, filename);
    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        res.json({ status: 'success', message: '快照文件已从服务器物理移除' });
    } else {
        res.status(404).json({ status: 'error', message: '未找到该快照文件' });
    }
  } catch (e) { res.status(500).json({ status: 'error', message: '删除失败' }); }
});

export default router;
