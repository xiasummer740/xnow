import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { User, Config } from '../models/index.js';
import { Op } from 'sequelize';
import { sendTgMessage } from '../utils/tgBot.js';

const router = express.Router();
global.verificationCodes = new Map(); 

const getRealIp = (req) => {
  let ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || req.connection.remoteAddress;
  if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
  return ip === '::1' ? '127.0.0.1' : (ip || '未知IP');
};

router.get('/site-logo', async (req, res) => {
  try {
    const conf = await Config.findOne({ where: { key: 'site_logo' } });
    if (conf && conf.value) {
      if (conf.value.startsWith('http')) return res.redirect(conf.value);
      if (conf.value.startsWith('data:image')) {
        const matches = conf.value.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const imgBuffer = Buffer.from(matches[2], 'base64');
          res.writeHead(200, { 'Content-Type': matches[1], 'Content-Length': imgBuffer.length, 'Cache-Control': 'public, max-age=86400' });
          return res.end(imgBuffer);
        }
      }
    }
    res.redirect('/logo.png');
  } catch (e) { res.redirect('/logo.png'); }
});

router.post('/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ status: 'error', message: '请输入接收邮箱' });

  try {
    const configs = await Config.findAll({ where: { key: ['smtp_host', 'smtp_port', 'smtp_email', 'smtp_pass', 'site_name'] } });
    const conf = {}; configs.forEach(c => conf[c.key] = c.value);

    if (!conf.smtp_host || !conf.smtp_email || !conf.smtp_pass) {
      global.verificationCodes.set(email, { code: '123456', expires: Date.now() + 3 * 60 * 1000 });
      return res.json({ status: 'success', message: '系统未配置邮件状态，已发放默认测试验证码: 123456' });
    }

    const transporter = nodemailer.createTransport({
      host: conf.smtp_host, port: parseInt(conf.smtp_port) || 465, secure: (parseInt(conf.smtp_port) === 465),
      auth: { user: conf.smtp_email, pass: conf.smtp_pass }
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    global.verificationCodes.set(email, { code, expires: Date.now() + 3 * 60 * 1000 });

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
      <h2 style="color: #f8fafc; text-align: center; font-weight: 600; letter-spacing: 1px;">安全身份验证</h2>
      <p style="color: #94a3b8; text-align: center; font-size: 14px; line-height: 1.6;">您正在尝试进行注册或登录操作，这是您的专属验证码：</p>
      <div style="background: #1e293b; padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0; border: 1px dashed #475569; box-shadow: inset 0 4px 6px rgba(0,0,0,0.3);">
        <span style="font-size: 40px; font-weight: 900; color: #fbbf24; letter-spacing: 10px;">${code}</span>
      </div>
      <p style="color: #ef4444; text-align: center; font-size: 12px; font-weight: bold;">⚠️ 验证码有效期为 3 分钟，请勿将此码泄露给任何人！</p>
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
      from: `"${conf.site_name || 'XNOW'} System" <${conf.smtp_email}>`,
      to: email, subject: `【${conf.site_name || '系统'}】安全身份验证码`, html: htmlTemplate
    });

    res.json({ status: 'success', message: '验证码已极速送达您的邮箱' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: '邮件服务连接失败，请检查配置参数' });
  }
});

const verifyCode = (email, inputCode) => {
  const record = global.verificationCodes.get(email);
  if (!record) return { valid: false, message: '请先获取验证码' };
  if (Date.now() > record.expires) return { valid: false, message: '验证码已过期，请重新获取' };
  if (String(record.code) !== String(inputCode)) return { valid: false, message: '验证码输入错误' };
  return { valid: true };
};

router.post('/register', async (req, res) => {
  const { phone, password, email, code, inviter_id } = req.body;
  const check = verifyCode(email, code);
  if (!check.valid) return res.status(400).json({ status: 'error', message: check.message });
  try {
    const existing = await User.findOne({ where: { phone } });
    if (existing) return res.status(400).json({ status: 'error', message: '该手机号已注册' });
    const realUserCount = await User.count({ where: { id: { [Op.gt]: 0 } } });
    let assignedRole = 'user'; let initBalance = 0.00; let finalUid;
    if (realUserCount === 0) { assignedRole = 'admin'; initBalance = 99999.00; finalUid = 1; } 
    else { while (true) { const randId = Math.floor(1000 + Math.random() * 9000); const checkId = await User.findByPk(randId); if (!checkId && randId !== 1) { finalUid = randId; break; } } }
    let finalInviterId = null;
    if (inviter_id) { const inviter = await User.findByPk(inviter_id); if (inviter) finalInviterId = inviter.id; }
    const password_hash = await bcrypt.hash(password, 10);
    const registerIp = getRealIp(req);
    const newUser = await User.create({
      id: finalUid, phone, email, password_hash, role: assignedRole, balance: initBalance, register_ip: registerIp, inviter_id: finalInviterId, api_key: 'xnow_' + Date.now() + Math.floor(Math.random()*1000)
    });
    global.verificationCodes.delete(email);
    const roleName = assignedRole === 'admin' ? '至尊管理员' : '黄金用户';
    sendTgMessage(`🎉 <b>全站新用户注册</b>\n🆔 <b>UID:</b> <code>${newUser.id}</code>\n📱 <b>账号:</b> <code>${phone}</code>\n📧 <b>邮箱:</b> ${email || '未绑定'}\n🔰 <b>等级:</b> ${roleName}\n🤝 <b>引荐人:</b> ${finalInviterId ? 'UID '+finalInviterId : '无'}\n🌐 <b>IP:</b> <code>${registerIp}</code>`);
    res.json({ status: 'success', message: realUserCount === 0 ? '全站首位【至尊管理员】注册成功！' : '注册成功，欢迎加入。' });
  } catch (err) { res.status(500).json({ status: 'error', message: '服务器注册异常' }); }
});

router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  try {
    if (phone === 'admin' && password === 'admin123') {
        const realCount = await User.count({ where: { id: { [Op.gt]: 0 } } });
        if (realCount === 0) {
            const token = jwt.sign({ id: 0, role: 'super_admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
            return res.json({ status: 'success', message: '【系统冷启动】临时最高管理员已接入！', token, user: { id: 0, phone: 'admin', role: 'super_admin', balance: '0.00', api_key: 'sys_init_key' } });
        } else { return res.status(403).json({ status: 'error', message: '系统已成功完成初始化，临时影子账号已永久自毁封闭。' }); }
    }
    const user = await User.findOne({ where: { phone } });
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ status: 'error', message: '账号不存在或密码错误' });
    
    // 💡 WAF 核心防御：如果该账号被管理员封禁，直接拒绝登录并上报电报机器人
    if (user.is_banned) {
        sendTgMessage(`⚠️ <b>[WAF 拦截] 封禁账号尝试登录</b>\n🆔 <b>UID:</b> <code>${user.id}</code>\n📱 <b>账号:</b> <code>${user.phone}</code>\n🌐 <b>IP:</b> <code>${getRealIp(req)}</code>\n🛑 <b>封禁原因:</b> ${user.ban_reason || '系统风控拦截'}`);
        return res.status(403).json({ status: 'error', message: `账号已被封禁: ${user.ban_reason || '系统风控拦截'}` });
    }

    user.last_login_ip = getRealIp(req);
    await user.save();
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ status: 'success', message: '登录成功', token, user: { id: user.id, phone: user.phone, role: user.role, balance: user.balance, api_key: user.api_key } });
  } catch (err) { res.status(500).json({ status: 'error', message: '登录解析异常' }); }
});

router.post('/reset', async (req, res) => {
  const { phone, email, password, code } = req.body;
  const check = verifyCode(email, code); 
  if (!check.valid) return res.status(400).json({ status: 'error', message: check.message });
  try {
    const user = await User.findOne({ where: { phone, email } });
    if (!user) return res.status(400).json({ status: 'error', message: '账号与安全邮箱不匹配' });
    user.password_hash = await bcrypt.hash(password, 10);
    await user.save();
    global.verificationCodes.delete(email);
    res.json({ status: 'success', message: '密码已成功重置，请登录' });
  } catch (err) { res.status(500).json({ status: 'error', message: '重置密码失败' }); }
});

export default router;
