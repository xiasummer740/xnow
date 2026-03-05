import nodemailer from 'nodemailer';
import { Config } from '../models/index.js';

export const sendEmailCode = async (toEmail, code) => {
    try {
        // 💡 上帝视角：全量拉取数据库配置，不遗漏任何变异的键名
        const allConfigs = await Config.findAll();
        const cm = {};
        const rawKeys = [];
        
        allConfigs.forEach(c => {
            if (c.key) {
                // 统一转小写，去除空格，实现绝对兼容
                cm[String(c.key).toLowerCase().trim()] = c.value;
                rawKeys.push(c.key);
            }
        });

        // 💡 全维度模糊匹配：覆盖前端可能发来的各种命名习惯
        const smtp_host = cm['smtp_host'] || cm['smtphost'] || cm['email_host'] || cm['smtp_server'] || cm['host'];
        const smtp_port = cm['smtp_port'] || cm['smtpport'] || cm['email_port'] || cm['port'];
        const smtp_user = cm['smtp_user'] || cm['smtpuser'] || cm['email_user'] || cm['smtp_email'] || cm['email'];
        const smtp_pass = cm['smtp_pass'] || cm['smtppass'] || cm['email_pass'] || cm['smtp_password'] || cm['email_password'] || cm['password'];

        if (!smtp_host || !smtp_user || !smtp_pass) {
            // 将数据库里真实存在的所有 Key 打印出来，彻底拒绝盲猜
            console.error(`[SMTP Error] 拦截！配置缺失。数据库中实际存在的配置键有: [${rawKeys.join(', ')}]`);
            throw new Error('SMTP配置不完整，请先在后台管理密室配置并保存');
        }

        const transporter = nodemailer.createTransport({
            host: smtp_host,
            port: parseInt(smtp_port) || 465,
            secure: parseInt(smtp_port) === 465 || parseInt(smtp_port) === 587,
            auth: {
                user: smtp_user,
                pass: smtp_pass
            }
        });

        // 💡 极致黑金风 HTML 邮件模板
        const mailOptions = {
            from: `"XNOW PRO 验证中心" <${smtp_user}>`,
            to: toEmail,
            subject: '【XNOW PRO】您的安全验证码',
            html: `
            <div style="background-color: #0f172a; color: #e2e8f0; padding: 40px; font-family: 'Courier New', Courier, monospace; border-radius: 10px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b; box-shadow: 0 0 20px rgba(0,0,0,0.5);">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #fbbf24; margin: 0; font-size: 28px; text-shadow: 0 0 10px rgba(251,191,36,0.3);">XNOW <span style="color: #cbd5e1;">PRO</span></h1>
                    <p style="color: #64748b; font-size: 12px; margin-top: 5px;">SECURE AUTHENTICATION SYSTEM</p>
                </div>
                <div style="background-color: #1e293b; padding: 25px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                    <p style="margin-top: 0; font-size: 16px;">您好，</p>
                    <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">您正在尝试进行身份验证或注册操作。请使用以下验证码完成验证。此验证码在 <strong style="color: #fbbf24;">10分钟</strong> 内有效。</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="display: inline-block; font-size: 36px; font-weight: bold; color: #38bdf8; background-color: #0f172a; padding: 15px 30px; border-radius: 12px; letter-spacing: 8px; border: 1px solid #334155; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);">${code}</span>
                    </div>
                    <p style="color: #ef4444; font-size: 12px; margin-bottom: 0; text-align: center;">⚠️ 警告：请勿将此验证码泄露给任何人！如非本人操作，请忽略此邮件。</p>
                </div>
                <div style="text-align: center; margin-top: 30px; border-top: 1px solid #334155; padding-top: 20px;">
                    <p style="color: #475569; font-size: 10px; margin: 0;">System Auto-Generated Email. Do not reply.</p>
                    <p style="color: #475569; font-size: 10px; margin: 5px 0 0 0;">© ${new Date().getFullYear()} XNOW PRO Security. All rights reserved.</p>
                </div>
            </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('Email Send Error:', error);
        return { success: false, message: error.message };
    }
};
