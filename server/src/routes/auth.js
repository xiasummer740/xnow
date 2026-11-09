import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, VerificationCode } from '../models/index.js';
import { sendTgMessage } from '../utils/tgBot.js';
import { sendEmailCode } from '../utils/email.js';
import { Op } from 'sequelize';

const router = express.Router();

const getRealIp = (req) => {
    // 🔒 只认 req.ip：trust proxy=1 时它取 X-Forwarded-For 最右一段，即 nginx 追加的真实客户端 IP。
    // 不能取 XFF 的第一段 —— 那是客户端自填的，注册/登录 IP 可被随意伪造，封号溯源会失效。
    let ip = req.ip || req.socket?.remoteAddress || '';
    if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
    return ip === '::1' ? '127.0.0.1' : (ip || '未知IP');
};

const verifyCodeInline = async (email, code) => {
    // 🔁 2026-11-09：从「进程内存 Map」改成数据库表 verification_codes。
    //    原来验证码存在 global.verificationCodes 里，**每次 pm2 restart 全部丢失** ——
    //    用户点了「获取验证码」、邮件也收到了，期间只要后端重启一次，
    //    填进去就是「验证码不存在或已过期，请重新获取」。
    //    当天连续部署重启 5-6 次，就有一批注册用户卡在这一步。
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return { valid: false, message: '邮箱不能为空' };
    const record = await VerificationCode.findOne({ where: { email: cleanEmail } });
    if (!record) return { valid: false, message: '验证码不存在或已过期，请重新获取' };
    if (String(record.code) !== String(code)) return { valid: false, message: '验证码错误' };
    if (Date.now() > Number(record.expires_at)) {
        await VerificationCode.destroy({ where: { email: cleanEmail } });
        return { valid: false, message: '验证码已过期，请重新获取' };
    }
    return { valid: true };
};

router.post('/register', async (req, res) => {
  const { phone, password, email, code, inviter_id } = req.body;
  const cleanPhone = String(phone || '').trim();
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;

  if (!cleanPhone || !password) return res.status(400).json({ status: 'error', message: '手机号与密码不能为空' });

  const check = await verifyCodeInline(email, code);
  if (!check.valid) return res.status(400).json({ status: 'error', message: check.message });
  
  try {
    const existingPhone = await User.findOne({ where: { phone: cleanPhone } });
    if (existingPhone) return res.status(400).json({ status: 'error', message: '该手机号已被注册，请直接登录' });
    
    if (cleanEmail && cleanEmail !== '') {
        const existingEmail = await User.findOne({ where: { email: cleanEmail } });
        if (existingEmail) return res.status(400).json({ status: 'error', message: '该邮箱已被注册绑定，请更换邮箱' });
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
      id: finalUid, phone: cleanPhone, email: cleanEmail, password_hash, role: assignedRole, balance: initBalance, register_ip: registerIp, inviter_id: finalInviterId,
      // 🏬 在哪个分站域名注册就归属哪个分站；主站注册为 0
      site_id: req.site ? Number(req.site.id) : 0,
      api_key: 'xnow_' + Date.now() + Math.floor(Math.random()*1000)
    });
    
    // 注册成功才删码（数据库）。用 delete 不抛错，码不存在也不影响注册结果。
    await VerificationCode.destroy({ where: { email: String(email || '').trim().toLowerCase() } }).catch(() => {});
    const roleName = assignedRole === 'admin' ? '至尊管理员' : '黄金用户';
    sendTgMessage(`🎉 <b>全站新用户注册</b>\n🆔 <b>UID:</b> <code>${newUser.id}</code>\n📱 <b>账号:</b> <code>${cleanPhone}</code>\n📧 <b>邮箱:</b> ${cleanEmail || '未绑定'}\n🔰 <b>等级:</b> ${roleName}\n🤝 <b>引荐人:</b> ${finalInviterId ? 'UID '+finalInviterId : '无'}\n🌐 <b>IP:</b> <code>${registerIp}</code>`);
    
    res.json({ status: 'success', message: realUserCount === 0 ? '全站首位【至尊管理员】注册成功！' : '注册成功，欢迎加入。' });
  } catch (err) { 
      console.error('Registration Error:', err);
      res.status(500).json({ status: 'error', message: '服务器注册异常，请稍后重试' }); 
  }
});

router.post('/login', async (req, res) => {
  const password = req.body.password;
  const accountStr = req.body.account || req.body.phone || req.body.email;

  if (!accountStr || !password) {
      return res.status(400).json({ status: 'error', message: '请输入账号和密码' });
  }

  const cleanAccount = String(accountStr).trim();

  try {
    const user = await User.findOne({
        where: { 
            [Op.or]: [
                { phone: cleanAccount }, 
                { email: cleanAccount.toLowerCase() }
            ] 
        } 
    });
    
    if (!user) return res.status(401).json({ status: 'error', message: '账号或密码错误' });
    if (user.is_banned) return res.status(403).json({ status: 'error', message: `账号已被封禁: ${user.ban_reason || '存在违规行为'}` });
    
    const isValid = await bcrypt.compare(String(password), String(user.password_hash));
    if (!isValid) return res.status(401).json({ status: 'error', message: '账号或密码错误' });

    // 🏬 分站隔离：密码正确之后再判归属，避免用错误密码探测账号属于哪个站。
    //    例外：平台方（超管/管理员）可跨站登录做客服；分站主本人可登录自己的分站。
    const siteCtx = req.site ? Number(req.site.id) : 0;
    const userSite = Number(user.site_id || 0);
    const isPlatformStaff = user.role === 'super_admin' || user.role === 'admin';
    const isSiteOwner = req.site && Number(req.site.owner_id) === Number(user.id);
    if (!isPlatformStaff && !isSiteOwner && userSite !== siteCtx) {
      return res.status(403).json({
        status: 'error',
        message: userSite === 0
          ? '该账号属于主站，请到主站域名登录'
          : '该账号属于其他分站，请到注册时的站点登录'
      });
    }

    user.last_login_ip = getRealIp(req);
    user.last_login_at = new Date();
    await user.save().catch(e => console.error('Failed to save login info:', e));

    // 💡 恢复 7天 基础生存期
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ status: 'success', token, user: { id: user.id, phone: user.phone, role: user.role, balance: user.balance } });
  } catch (err) { 
      console.error('Login Error:', err);
      res.status(500).json({ status: 'error', message: '数据库连接异常或登录态失效，请刷新页面重试' }); 
  }
});

router.post('/send-code', async (req, res) => {
    let email = req.body.email || req.body.new_email;
    const type = req.body.type || 'register';

    if (!email) return res.status(400).json({ status: 'error', message: '请提供邮箱地址' });
    email = String(email).trim().toLowerCase();

    if (type !== 'reset' && type !== 'login') {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ status: 'error', message: '该邮箱已被注册，请直接登录' });
        }
    }

    // 频率限制：`expires_at - 9 分钟` 之内发过就拦住（一个码 10 分钟有效，
    // 也就是发出去 1 分钟内不许再发）。读数据库，重启不丢。
    const cleanEmailForCode = String(email || '').trim().toLowerCase();
    const existing = await VerificationCode.findOne({ where: { email: cleanEmailForCode } });
    if (existing && Date.now() < Number(existing.expires_at) - 9 * 60 * 1000) {
        return res.status(429).json({ status: 'error', message: '发送过于频繁，请稍后再试' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
        // 🏬 分站自有 SMTP：客户收到的验证码用站长自己的品牌发出，
        //    且不带平台的"升级至尊代理"招商内容（否则等于当面告诉客户站长是中间商）
        const siteCfg = req.site ? {
          name: req.site.name,
          smtp_host: req.site.smtp_host,
          smtp_port: req.site.smtp_port,
          smtp_user: req.site.smtp_user,
          smtp_pass: req.site.smtp_pass
        } : null;
        const result = await sendEmailCode(email, code, siteCfg);
        if (result.success) {
            // 落库（同邮箱只留最新一条）：先删旧码再写新码，
            // 这样用户连续两次点「获取验证码」时旧的立即失效，不会两个码都能用。
            await VerificationCode.destroy({ where: { email: cleanEmailForCode } }).catch(() => {});
            // 顺手清理已过期的历史记录 —— 用户点了码但没注册的会一直留着，
            // 不清的话表会慢慢变大。每次发送时清一次，成本可忽略。
            await VerificationCode.destroy({ where: { expires_at: { [Op.lt]: Date.now() } } }).catch(() => {});
            await VerificationCode.create({
                email: cleanEmailForCode,
                code,
                expires_at: Date.now() + 10 * 60 * 1000,
                ip: getRealIp(req),
            });
            res.json({ status: 'success', message: '验证码已发送，请注意查收邮件(含垃圾箱)' });
        } else {
            console.error('Email Fail:', result.message);
            // 🔒 98 期：这句话是给**客户**看的，不能把内部细节（SMTP / 后台配置）甩出去。
      //    站长要排查配置，走「分站 → 邮件 → 发信自测」，那里有逐项原因。
      res.status(500).json({ status: 'error', message: '验证码发送失败，请稍后再试；多次失败请联系客服' });
        }
    } catch (err) {
        res.status(500).json({ status: 'error', message: '邮件服务器连接异常' });
    }
});

export default router;
