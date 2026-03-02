import express from 'express';
import { User, Transaction, Order, Config } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { sendTgMessage } from '../utils/tgBot.js';

const router = express.Router();
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

router.post('/send-profile-code', authenticate, async (req, res) => {
  const { new_email } = req.body;
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: '用户异常' });
    const targetEmail = user.email ? user.email : new_email;
    if (!targetEmail) return res.json({ status: 'error', message: '未找到可接收验证码的邮箱地址' });

    const configs = await Config.findAll({ where: { key: ['smtp_host', 'smtp_port', 'smtp_email', 'smtp_pass', 'site_name'] } });
    const conf = {}; configs.forEach(c => conf[c.key] = c.value);

    if (!conf.smtp_host || !conf.smtp_email || !conf.smtp_pass) {
      return res.json({ status: 'error', message: '系统未配置邮件发送服务器' });
    }

    const transporter = nodemailer.createTransport({
      host: conf.smtp_host, port: parseInt(conf.smtp_port) || 465, secure: (parseInt(conf.smtp_port) === 465),
      auth: { user: conf.smtp_email, pass: conf.smtp_pass }
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    global.profileCodes[user.id] = { code, expire: Date.now() + 5 * 60000 };

    const cssLogo = `
      <div style="text-align: center; margin-bottom: 35px;">
        <div style="display: inline-block; padding: 3px; background: linear-gradient(135deg, #fbbf24, #d97706); border-radius: 14px; box-shadow: 0 10px 25px rgba(245, 158, 11, 0.3);">
          <div style="background-color: #0f172a; padding: 12px 28px; border-radius: 11px; border: 1px solid #334155;">
            <h1 style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center;">
              <span style="color: #ffffff; font-size: 32px; font-weight: 900; font-style: italic; letter-spacing: 3px;">${conf.site_name || 'XNOW'}</span>
              <span style="background-color: #fbbf24; color: #000000; font-size: 13px; font-weight: 900; padding: 3px 8px; border-radius: 6px; margin-left: 10px; position: relative; top: -2px;">PRO</span>
            </h1>
          </div>
        </div>
      </div>
    `;

    const htmlTemplate = `
    <div style="max-width: 600px; margin: 0 auto; background: #0f172a; padding: 40px; border-radius: 16px; border: 1px solid #334155; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      
      ${cssLogo}

      <h2 style="color: #f8fafc; text-align: center; font-weight: 600; letter-spacing: 1px;">资料变更安全验证</h2>
      <p style="color: #94a3b8; text-align: center; font-size: 14px; line-height: 1.6;">您正在尝试修改关键资产信息，这是您的验证码：</p>
      
      <div style="background: #1e293b; padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0; border: 1px dashed #475569; box-shadow: inset 0 4px 6px rgba(0,0,0,0.3);">
        <span style="font-size: 40px; font-weight: 900; color: #fbbf24; letter-spacing: 10px;">${code}</span>
      </div>
      <p style="color: #ef4444; text-align: center; font-size: 12px; font-weight: bold;">⚠️ 验证码有效期为 5 分钟，如非本人操作请立刻修改密码！</p>
      
      <div style="background: linear-gradient(145deg, rgba(251,191,36,0.1), rgba(245,158,11,0.02)); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 25px; margin-top: 40px;">
        <h3 style="color: #fbbf24; text-align: center; margin-top: 0; margin-bottom: 20px; font-size: 18px; letter-spacing: 1px;">💎 升级至尊代理，解锁三大财富特权！</h3>
        <div style="margin-bottom: 16px;">
          <strong style="color: #f8fafc; font-size: 15px; display: block; margin-bottom: 4px;">📉 1. 极致底价垄断</strong>
          <span style="color: #cbd5e1; font-size: 13px; line-height: 1.5; display: block;">突破普通用户价格限制，享受全站千万商品骨折级拿货底价。单单省钱，利润空间彻底释放！</span>
        </div>
        <div style="margin-bottom: 16px;">
          <strong style="color: #f8fafc; font-size: 15px; display: block; margin-bottom: 4px;">🌐 2. API对接 & 独立建站</strong>
          <span style="color: #cbd5e1; font-size: 13px; line-height: 1.5; display: block;">无条件开放开发者 API 权限。无缝对接货源，轻松搭建属于您的独立分站，做自己的庄家！</span>
        </div>
        <div>
          <strong style="color: #10b981; font-size: 15px; display: block; margin-bottom: 4px;">💸 3. 10% 裂变暴利分润</strong>
          <span style="color: #cbd5e1; font-size: 13px; line-height: 1.5; display: block;">普通用户推广仅享5%佣金，升级代理瞬间翻倍至 <strong style="color:#34d399; font-size: 14px;">10%</strong>！下线充值，佣金全自动秒入您的金库，上不封顶！</span>
        </div>
      </div>

      <hr style="border: 0; border-top: 1px solid #334155; margin: 30px 0;" />
      <p style="color: #64748b; font-size: 11px; text-align: center; line-height: 1.5;">此邮件由系统自动发送，请勿直接回复。<br/>&copy; ${new Date().getFullYear()} ${conf.site_name || 'System'}. All rights reserved.</p>
    </div>`;

    await transporter.sendMail({
      from: `"${conf.site_name || 'XNOW'}" <${conf.smtp_email}>`,
      to: targetEmail, subject: `【${conf.site_name || '系统'}】关键资料变更验证码`,
      html: htmlTemplate
    });

    res.json({ status: 'success', message: '验证码已发送' });
  } catch (error) { res.json({ status: 'error', message: '邮件发送失败' }); }
});

router.post('/update-profile', authenticate, async (req, res) => {
  const { current_password, email_code, phone, email, new_password } = req.body;
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ status: 'error' });
    if (!current_password) return res.json({ status: 'error', message: '必须输入当前密码验证身份' });
    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) return res.json({ status: 'error', message: '当前密码错误' });
    if (!email_code) return res.json({ status: 'error', message: '必须输入邮箱验证码' });
    
    const cached = global.profileCodes[user.id];
    if (!cached || cached.code !== email_code || Date.now() > cached.expire) {
      return res.json({ status: 'error', message: '验证码错误或过期' });
    }

    let updateMsg = [];
    if (phone && phone !== user.phone) {
      const existPhone = await User.findOne({ where: { phone } });
      if (existPhone) return res.json({ status: 'error', message: '手机号被占用' });
      updateMsg.push(`手机: ${user.phone} -> ${phone}`);
      user.phone = phone;
    }
    if (email !== undefined && email !== user.email && email !== '') {
      const existEmail = await User.findOne({ where: { email } });
      if (existEmail) return res.json({ status: 'error', message: '邮箱被占用' });
      updateMsg.push(`邮箱: ${user.email || '无'} -> ${email}`);
      user.email = email;
    }
    if (new_password) {
      user.password_hash = await bcrypt.hash(new_password, 10);
      updateMsg.push('重置了密码');
    }
    if (updateMsg.length > 0) {
      await user.save();
      delete global.profileCodes[user.id]; 
      sendTgMessage(`📝 <b>[用户自助] 修改资料</b>\n🆔 <b>UID:</b> <code>${user.id}</code>\n- ${updateMsg.join('\n- ')}`);
    }
    res.json({ status: 'success', message: '资料已更新' });
  } catch (error) { res.status(500).json({ status: 'error' }); }
});

router.post('/delete-account', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ status: 'error' });
    if (['admin', 'super_admin'].includes(user.role)) return res.status(403).json({ status: 'error', message: '管理员不可注销' });
    
    await Transaction.destroy({ where: { user_id: user.id } });
    await Order.destroy({ where: { user_id: user.id } });
    await user.destroy();
    sendTgMessage(`💥 <b>[用户自助] 账号永久注销</b>\nUID: ${user.id} | 手机: ${user.phone}`);
    res.json({ status: 'success', message: '账号已抹除' });
  } catch (error) { res.status(500).json({ status: 'error' }); }
});

router.get('/affiliate-stats', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: '核心身份丢失' });
    
    const rate = ['agent', 'admin', 'super_admin'].includes(user.role) ? 0.10 : 0.05;

    const rawInvitees = await User.findAll({ where: { inviter_id: user.id } });
    
    const formattedInvitees = rawInvitees.map(i => {
        let displayUid = i.id;
        if (user.role !== 'super_admin') {
            const idStr = String(i.id);
            displayUid = idStr.length > 2 ? `${idStr.slice(0, 1)}***${idStr.slice(-1)}` : '***';
        }
        return {
            uid: displayUid, 
            phone: i.phone ? i.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '未知账号', 
            time: i.created_at || i.createdAt || Date.now() 
        };
    }).sort((a, b) => new Date(b.time) - new Date(a.time));

    const commissions = await Transaction.findAll({ 
        where: { user_id: user.id, type: '推广返佣' }
    });
    
    const formattedCommissions = commissions.sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));

    res.json({ 
        status: 'success', rate: rate, total_commission: user.total_commission || 0,
        invitees: formattedInvitees, commissions: formattedCommissions 
    });
  } catch (error) { 
    res.status(500).json({ status: 'error', message: '大盘渲染异常' }); 
  }
});

export default router;
