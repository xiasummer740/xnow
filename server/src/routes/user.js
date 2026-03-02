import express from 'express';
import { User, Transaction, Order, Config } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { sendTgMessage } from '../utils/tgBot.js';

const router = express.Router();

// 内存级验证码缓存 (生产环境建议后续升级为 Redis，目前内存已足够安全)
global.profileCodes = global.profileCodes || {};

router.get('/status', authenticate, async (req, res) => {
  if (req.user.role === 'super_admin') {
    return res.json({ status: 'success', balance: '999999.00', role: 'super_admin', api_key: 'super_admin_key', phone: req.user.phone, email: req.user.email });
  }
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ status: 'error', message: '用户不存在' });
  res.json({ status: 'success', balance: user.balance, role: user.role, vip_expire_at: user.vip_expire_at, api_key: user.api_key, phone: user.phone, email: user.email });
});

router.post('/regenerate-key', authenticate, async (req, res) => {
  if (req.user.role === 'super_admin') return res.json({ status: 'success', api_key: 'super_admin_key_fixed' });
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ status: 'error' });
  user.api_key = 'xnow_' + crypto.randomBytes(16).toString('hex');
  await user.save();
  res.json({ status: 'success', api_key: user.api_key });
});

// 💡 极密安全：发送验证邮件接口
router.post('/send-profile-code', authenticate, async (req, res) => {
  const { new_email } = req.body;
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: '用户异常' });

    // 风控校验：如果有绑定的老邮箱，强制发到老邮箱；如果没有，发到用户提供的新邮箱
    const targetEmail = user.email ? user.email : new_email;
    if (!targetEmail) return res.json({ status: 'error', message: '未找到可接收验证码的邮箱地址' });

    const configs = await Config.findAll({ where: { key: ['smtp_host', 'smtp_port', 'smtp_email', 'smtp_pass', 'site_name'] } });
    const conf = {}; configs.forEach(c => conf[c.key] = c.value);

    if (!conf.smtp_host || !conf.smtp_email || !conf.smtp_pass) {
      return res.json({ status: 'error', message: '系统未配置邮件发送服务器，请联系管理员' });
    }

    const transporter = nodemailer.createTransport({
      host: conf.smtp_host,
      port: parseInt(conf.smtp_port) || 465,
      secure: (parseInt(conf.smtp_port) === 465),
      auth: { user: conf.smtp_email, pass: conf.smtp_pass }
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    global.profileCodes[user.id] = { code, expire: Date.now() + 5 * 60000 };

    await transporter.sendMail({
      from: `"${conf.site_name || 'XNOW'}" <${conf.smtp_email}>`,
      to: targetEmail,
      subject: 'XNOW 安全验证中心 - 操作验证码',
      text: `尊敬的用户:\n\n您的安全验证码是: ${code}\n该验证码用于敏感资料修改，有效期为 5 分钟。\n\n如非本人操作，请立刻修改密码！`
    });

    res.json({ status: 'success', message: '验证码已发送，请查收邮箱' });
  } catch (error) {
    res.json({ status: 'error', message: '邮件发送失败，请检查 SMTP 配置' });
  }
});

// 💡 极密安全：双重验证更新资料接口
router.post('/update-profile', authenticate, async (req, res) => {
  const { current_password, email_code, phone, email, new_password } = req.body;
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: '用户不存在' });

    // 1. 验证当前密码
    if (!current_password) return res.json({ status: 'error', message: '必须输入当前密码验证身份' });
    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) return res.json({ status: 'error', message: '当前密码错误，拒绝操作' });

    // 2. 验证邮箱验证码
    if (!email_code) return res.json({ status: 'error', message: '必须输入邮箱验证码' });
    const cached = global.profileCodes[user.id];
    if (!cached || cached.code !== email_code || Date.now() > cached.expire) {
      return res.json({ status: 'error', message: '邮箱验证码错误或已过期' });
    }

    let updateMsg = [];
    if (phone && phone !== user.phone) {
      const existPhone = await User.findOne({ where: { phone } });
      if (existPhone) return res.json({ status: 'error', message: '该新手机号已被占用' });
      updateMsg.push(`手机: ${user.phone} -> ${phone}`);
      user.phone = phone;
    }
    
    if (email !== undefined && email !== user.email && email !== '') {
      const existEmail = await User.findOne({ where: { email } });
      if (existEmail) return res.json({ status: 'error', message: '该新邮箱已被占用' });
      updateMsg.push(`邮箱: ${user.email || '无'} -> ${email}`);
      user.email = email;
    }

    if (new_password) {
      user.password_hash = await bcrypt.hash(new_password, 10);
      updateMsg.push('重置了账户密码');
    }

    if (updateMsg.length > 0) {
      await user.save();
      delete global.profileCodes[user.id]; // 验证码阅后即焚
      sendTgMessage(`📝 <b>[用户自助] 修改高敏资料通过</b>\n🆔 <b>UID:</b> <code>${user.id}</code>\n变更内容:\n- ${updateMsg.join('\n- ')}`);
    }

    res.json({ status: 'success', message: '资料已通过双重验证并更新' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '服务器异常' });
  }
});

// 💡 极密安全：自助注销接口
router.post('/delete-account', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: '用户不存在' });
    
    if (['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ status: 'error', message: '系统级管理员禁止自助注销，请联系上级' });
    }

    const ghostInfo = `🆔 UID: ${user.id} | 📱 手机: ${user.phone} | 💰 余额: ${user.balance}`;
    await Transaction.destroy({ where: { user_id: user.id } });
    await Order.destroy({ where: { user_id: user.id } });
    await user.destroy();

    sendTgMessage(`💥 <b>[用户自助] 账号永久注销</b>\n该用户已选择自行抹除所有数据：\n${ghostInfo}`);
    res.json({ status: 'success', message: '账号及所有关联数据已永久销毁' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '注销失败，服务器异常' });
  }
});

export default router;
