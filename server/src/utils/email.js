import nodemailer from 'nodemailer';
import { Config } from '../models/index.js';

export const sendEmailCode = async (toEmail, code) => {
    try {
        const allConfigs = await Config.findAll();
        const cm = {};
        const rawKeys = [];
        
        allConfigs.forEach(c => {
            if (c.key) {
                cm[String(c.key).toLowerCase().trim()] = c.value;
                rawKeys.push(c.key);
            }
        });

        const smtp_host = cm['smtp_host'] || cm['smtphost'] || cm['email_host'] || cm['smtp_server'] || cm['host'];
        const smtp_port = cm['smtp_port'] || cm['smtpport'] || cm['email_port'] || cm['port'];
        const smtp_user = cm['smtp_user'] || cm['smtpuser'] || cm['email_user'] || cm['smtp_email'] || cm['email'];
        const smtp_pass = cm['smtp_pass'] || cm['smtppass'] || cm['email_pass'] || cm['smtp_password'] || cm['email_password'] || cm['password'];

        if (!smtp_host || !smtp_user || !smtp_pass) {
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

        // 💡 核心复原：v2.13.11 版本的经典亮色企业级白底蓝标模板
        const mailOptions = {
            from: `"XNOW 验证中心" <${smtp_user}>`,
            to: toEmail,
            subject: '【XNOW】您的安全验证码',
            html: `
            <div style="background-color: #f3f4f6; padding: 40px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <div style="background-color: #3b82f6; padding: 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">XNOW 安全验证</h1>
                    </div>
                    <div style="padding: 40px 30px;">
                        <p style="color: #374151; font-size: 16px; margin-top: 0;">尊敬的用户，您好：</p>
                        <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">您正在执行敏感操作（如注册或修改密码）。您的专属动态验证码为：</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <span style="display: inline-block; font-size: 32px; font-weight: bold; color: #1d4ed8; background-color: #eff6ff; padding: 15px 40px; border-radius: 6px; border: 1px dashed #93c5fd; letter-spacing: 4px;">${code}</span>
                        </div>
                        <p style="color: #ef4444; font-size: 13px; text-align: center; margin-bottom: 0;">⚠️ 验证码在 10 分钟内有效。打死也不能告诉别人哦！</p>
                    </div>
                    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">这是一封系统自动发送的邮件，请勿直接回复。</p>
                        <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">© ${new Date().getFullYear()} XNOW. All rights reserved.</p>
                    </div>
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
