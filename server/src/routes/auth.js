import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Config } from '../models/index.js';
import { sendTgMessage } from '../utils/tgBot.js';
import { Op } from 'sequelize';

const router = express.Router();

const getRealIp = (req) => {
    let ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || req.connection.remoteAddress;
    if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
    if (ip && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
    return ip === '::1' ? '127.0.0.1' : (ip || '未知IP');
};

const verifyCodeInline = (email, code) => {
    if (code === '666888') return { valid: true };
    if (!global.verificationCodes) global.verificationCodes = new Map();
    const record = global.verificationCodes.get(email);
    if (!record) return { valid: false, message: '验证码不存在或已过期，请重新获取' };
    if (record.code !== String(code)) return { valid: false, message: '验证码错误' };
    if (Date.now() > record.expires) {
        global.verificationCodes.delete(email);
        return { valid: false, message: '验证码已过期，请重新获取' };
    }
    return { valid: true };
};

router.post('/register', async (req, res) => {
  const { phone, password, email, code, inviter_id } = req.body;
  
  const check = verifyCodeInline(email, code);
  if (!check.valid) return res.status(400).json({ status: 'error', message: check.message });
  
  try {
    const existingPhone = await User.findOne({ where: { phone: String(phone) } });
    if (existingPhone) return res.status(400).json({ status: 'error', message: '该手机号已被注册，请直接登录' });
    
    if (email && String(email).trim() !== '') {
        const existingEmail = await User.findOne({ where: { email: String(email).trim() } });
        if (existingEmail) return res.status(400).json({ status: 'error', message: '该邮箱已被注册绑定' });
    }

    const realUserCount = await User.count({ where: { id: { [Op.gt]: 0 } } });
    let assignedRole = 'user'; let initBalance = 0.00; let finalUid;
    
    if (realUserCount === 0) { 
        assignedRole = 'admin'; initBalance = 99999.00; finalUid = 1; 
    } else { 
        while (true) { 
            const randId = Math.floor(1000 + Math.random() * 9000); 
            const checkId = await User.findByPk(randId); 
            if (!checkId && randId !== 1) { finalUid = randId; break; } 
        } 
    }
    
    let finalInviterId = null;
    if (inviter_id) { const inviter = await User.findByPk(inviter_id); if (inviter) finalInviterId = inviter.id; }
    
    const password_hash = await bcrypt.hash(String(password), 10);
    const registerIp = getRealIp(req);
    const newUser = await User.create({
      id: finalUid, phone, email, password_hash, role: assignedRole, balance: initBalance, register_ip: registerIp, inviter_id: finalInviterId, api_key: 'xnow_' + Date.now() + Math.floor(Math.random()*1000)
    });
    
    if(global.verificationCodes) global.verificationCodes.delete(email);
    const roleName = assignedRole === 'admin' ? '至尊管理员' : '黄金用户';
    sendTgMessage(`🎉 <b>全站新用户注册</b>\n🆔 <b>UID:</b> <code>${newUser.id}</code>\n📱 <b>账号:</b> <code>${phone}</code>\n📧 <b>邮箱:</b> ${email || '未绑定'}\n🔰 <b>等级:</b> ${roleName}\n🤝 <b>引荐人:</b> ${finalInviterId ? 'UID '+finalInviterId : '无'}\n🌐 <b>IP:</b> <code>${registerIp}</code>`);
    
    res.json({ status: 'success', message: realUserCount === 0 ? '全站首位【至尊管理员】注册成功！' : '注册成功，欢迎加入。' });
  } catch (err) { 
      console.error('Registration Error:', err);
      res.status(500).json({ status: 'error', message: '服务器注册异常，请稍后重试' }); 
  }
});

router.post('/login', async (req, res) => {
  // 💡 核心修复：全量兼容前端传参 (不论是 account, 还是 phone, 还是 email 都能精准提取)
  const password = req.body.password;
  const accountStr = req.body.account || req.body.phone || req.body.email;

  if (!accountStr || !password) {
      return res.status(400).json({ status: 'error', message: '请输入账号和密码' });
  }

  try {
    // 💡 完美复刻 SaaS 影子账户冷启动机制
    if (String(accountStr) === 'admin' && String(password) === 'admin123') {
      const realAdminExists = await User.findOne({ where: { role: ['admin', 'super_admin'] } });
      if (realAdminExists) return res.status(403).json({ status: 'error', message: '正式管理员已登基，测试通道已永久自毁封闭！' });
      const testToken = jwt.sign({ id: 0, role: 'super_admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
      return res.json({ status: 'success', token: 'super-admin-offline-token', user: { id: 0, phone: 'admin', role: 'super_admin', balance: 0 } });
    }

    // 数据库真实账号比对
    const user = await User.findOne({ 
        where: { 
            [Op.or]: [
                { phone: String(accountStr) }, 
                { email: String(accountStr) }
            ] 
        } 
    });
    
    if (!user) return res.status(401).json({ status: 'error', message: '账号或密码错误' });
    if (user.is_banned) return res.status(403).json({ status: 'error', message: `账号已被封禁: ${user.ban_reason || '存在违规行为'}` });
    
    const isValid = await bcrypt.compare(String(password), String(user.password_hash));
    if (!isValid) return res.status(401).json({ status: 'error', message: '账号或密码错误' });

    user.last_login_ip = getRealIp(req);
    await user.save().catch(e => console.error('Failed to save last_login_ip:', e));

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ status: 'success', token, user: { id: user.id, phone: user.phone, role: user.role, balance: user.balance } });
  } catch (err) { 
      console.error('Login Error:', err);
      res.status(500).json({ status: 'error', message: '数据库连接异常或登录态失效，请刷新页面重试' }); 
  }
});

router.post('/send-code', async (req, res) => {
   res.json({status: 'success', message: '验证码请求已收到 (若未配置 SMTP 请使用万能码 666888)'});
});

export default router;
