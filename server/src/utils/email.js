import nodemailer from 'nodemailer';
import { Config } from '../models/index.js';

export const sendEmailCode = async (toEmail, code) => {
    try {
        const allConfigs = await Config.findAll();
        const cm = {};
        
        allConfigs.forEach(c => {
            if (c.key) {
                cm[String(c.key).toLowerCase().trim()] = c.value;
            }
        });

        // 精准绑定数据库真实的 smtp_email 键名
        const smtp_host = cm['smtp_host'] || 'smtp.qq.com';
        const smtp_port = parseInt(cm['smtp_port']) || 465;
        const smtp_user = cm['smtp_email'] || cm['smtp_user'] || cm['email_user'];
        const smtp_pass = cm['smtp_pass'];

        if (!smtp_host || !smtp_user || !smtp_pass) {
            throw new Error(`SMTP配置缺失: host=${!!smtp_host}, user=${!!smtp_user}, pass=${!!smtp_pass}`);
        }

        const transporter = nodemailer.createTransport({
            host: smtp_host,
            port: smtp_port,
            secure: smtp_port === 465 || smtp_port === 587,
            auth: {
                user: smtp_user,
                pass: smtp_pass
            }
        });

        const mailOptions = {
            from: `"XNOW PRO 验证中心" <${smtp_user}>`,
            to: toEmail,
            subject: '【XNOW PRO】安全身份验证',
            html: `
            <div style="background-color: #f8fafc; padding: 40px 0; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #e2e8f0;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #1e293b;">
                    
                    <div style="text-align: center; padding: 40px 20px 20px;">
                        <h1 style="color: #fbbf24; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 2px; font-style: italic;">
                            XNOW <span style="border: 1px solid #fbbf24; padding: 2px 8px; border-radius: 8px; font-size: 14px; vertical-align: middle; margin-left: 5px;">PRO</span>
                        </h1>
                        <h2 style="color: #f8fafc; font-size: 22px; margin-top: 25px; font-weight: bold; letter-spacing: 2px;">安全身份验证</h2>
                        <p style="color: #94a3b8; font-size: 14px; margin-top: 15px;">您正在尝试进行注册或登录操作，这是您的专属验证码：</p>
                    </div>

                    <div style="padding: 0 40px;">
                        <div style="background-color: #1e293b; border-radius: 10px; padding: 25px; text-align: center; border: 1px solid #334155; box-shadow: inset 0 2px 10px rgba(0,0,0,0.3);">
                            <span style="font-size: 46px; font-weight: 900; color: #fbbf24; letter-spacing: 16px; font-family: 'Courier New', monospace;">${code}</span>
                        </div>
                        <p style="text-align: center; color: #f59e0b; font-size: 13px; margin-top: 20px; font-weight: bold;">
                            ⚠️ 验证码有效期为 10 分钟，请勿将此码泄露给任何人！
                        </p>
                    </div>

                    <div style="margin: 35px 40px; background-color: #1e293b; border: 1px solid #fbbf24; border-radius: 10px; padding: 25px 30px; box-shadow: 0 0 15px rgba(251,191,36,0.1);">
                        <h3 style="text-align: center; color: #fbbf24; font-size: 18px; margin-top: 0; margin-bottom: 25px; font-weight: bold;">💎 升级至尊代理，解锁三大财富特权！</h3>
                        
                        <div style="margin-bottom: 18px;">
                            <h4 style="color: #f8fafc; margin: 0 0 8px 0; font-size: 15px; display: flex; align-items: center;">📉 1. 极致底价垄断</h4>
                            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0;">突破普通用户价格限制，享受全站千万商品骨折级拿货底价。单单省钱，利润空间彻底释放！</p>
                        </div>

                        <div style="margin-bottom: 18px;">
                            <h4 style="color: #60a5fa; margin: 0 0 8px 0; font-size: 15px; display: flex; align-items: center;">🌐 2. API对接 & 独立建站</h4>
                            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0;">无条件开放开发者 API 权限。无缝对接货源，轻松搭建属于您的独立分站，做自己的庄家！</p>
                        </div>

                        <div>
                            <h4 style="color: #34d399; margin: 0 0 8px 0; font-size: 15px; display: flex; align-items: center;">💸 3. 10% 裂变暴利分润</h4>
                            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0;">普通用户推广仅享5%佣金，升级代理瞬间翻倍至 <span style="color: #34d399; font-weight: bold;">10%</span>！下线充值，佣金全自动秒入您的金库，上不封顶！</p>
                        </div>
                    </div>

                    <div style="text-align: center; padding: 25px; border-top: 1px solid #1e293b; background-color: #0f172a;">
                        <p style="color: #475569; font-size: 12px; margin: 0;">此邮件由系统自动发送，请勿直接回复。</p>
                        <p style="color: #475569; font-size: 12px; margin: 5px 0 0 0;">© ${new Date().getFullYear()} XNOW. All rights reserved.</p>
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

// 📎 备份文件走邮件异地存档（2026-10-14，祥哥：「我需要的是备份的文件」+「发邮箱也行」）
//
// 和 TG 那份**互为冗余**：任一通道把账号封了/墙了，另一条还在。
//
// 2026-10-14 二次改动：参数改成收**一组**附件。因为数据库之外还有一处数据
// （`data/pending_payments.json`，支付补单队列），它不落在任何一张表里，
// 只送数据库就会把它漏掉 —— 得跟着一起走。
//
// ⚠️ **故意不复用上面的 sendEmailCode**：那个写死了验证码模板、不支持附件，而且把错误
// 吞成 `{success:false}` 返回。验证码吞错无所谓（用户会点重发），但备份是**唯一的异地
// 副本**，「到底送到没有」必须让调用方知道 —— 所以这里任何一步失败都往外抛。
//
// @param attachments [{ filepath, filename, size }, ...] 第一个视为主备份
export const sendBackupEmail = async (attachments) => {
    const allConfigs = await Config.findAll();
    const cm = {};
    allConfigs.forEach(c => { if (c.key) cm[String(c.key).toLowerCase().trim()] = c.value; });

    const host = cm['smtp_host'] || 'smtp.qq.com';
    const port = parseInt(cm['smtp_port']) || 465;
    const user = cm['smtp_email'];
    const pass = cm['smtp_pass'];
    if (!user || !pass) throw new Error('SMTP 未配置：smtp_email / smtp_pass 为空');

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465 || port === 587,
        auth: { user, pass }
    });

    const list = attachments
        .map(a => `文件名: ${a.filename}    大小: ${(a.size / 1024).toFixed(2)} KB`)
        .join('\n');

    // 自发自收：文件落到自己的收件箱，VPS 没了它还在
    await transporter.sendMail({
        from: `"XNOW 容灾备份" <${user}>`,
        to: user,
        subject: `【XNOW 容灾备份】${attachments[0].filename}`,
        text: `备份文件见附件。\n\n${list}\n时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n这封邮件是系统自动发送的异地容灾存档 —— VPS 若丢失，凭附件可完整恢复数据。`,
        attachments: attachments.map(a => ({ filename: a.filename, path: a.filepath }))
    });
};
