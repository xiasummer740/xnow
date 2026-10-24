import nodemailer from 'nodemailer';
import { Config } from '../models/index.js';

// 🏬 支持分站自有 SMTP（三期）
//   siteCfg = { name, smtp_host, smtp_port, smtp_user, smtp_pass } 或 null
//   - 有分站 SMTP → 用分站的账号发，发件人/标题/页脚全部是分站品牌，
//     并且**不带平台招商内容**（"升级至尊代理"那段是平台自己的广告，
//     出现在分站客户的邮箱里等于当面告诉客户"你的站长是二道贩子"）
//   - 没有 → 回退到主站 SMTP 与原模板（行为与改造前一致）
export const sendEmailCode = async (toEmail, code, siteCfg = null) => {
    try {
        const allConfigs = await Config.findAll();
        const cm = {};

        allConfigs.forEach(c => {
            if (c.key) {
                cm[String(c.key).toLowerCase().trim()] = c.value;
            }
        });

        const useSite = !!(siteCfg && siteCfg.smtp_user && siteCfg.smtp_pass);
        const smtp_host = useSite ? siteCfg.smtp_host : (cm['smtp_host'] || 'smtp.qq.com');
        const smtp_port = parseInt(useSite ? siteCfg.smtp_port : cm['smtp_port']) || 465;
        const smtp_user = useSite ? siteCfg.smtp_user : (cm['smtp_email'] || cm['smtp_user'] || cm['email_user']);
        const smtp_pass = useSite ? siteCfg.smtp_pass : cm['smtp_pass'];
        const brand = (siteCfg && siteCfg.name) ? String(siteCfg.name) : 'XNOW PRO';

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

        const mailOptions = useSite
          ? {
              from: `"${brand} 验证中心" <${smtp_user}>`,
              to: toEmail,
              subject: `【${brand}】安全身份验证`,
              html: `
              <div style="background:#f1f5f9;padding:36px 0;font-family:'PingFang SC','Microsoft YaHei',sans-serif;">
                <div style="max-width:560px;margin:0 auto;background:#0f172a;border-radius:14px;overflow:hidden;border:1px solid #1e293b;">
                  <div style="text-align:center;padding:34px 20px 16px;">
                    <h1 style="color:#f8fafc;margin:0;font-size:24px;font-weight:800;letter-spacing:1px;">${brand}</h1>
                    <p style="color:#94a3b8;font-size:13px;margin-top:14px;">您正在注册或登录，本次验证码为：</p>
                  </div>
                  <div style="padding:0 32px;">
                    <div style="background:#1e293b;border-radius:10px;padding:22px;text-align:center;border:1px solid #334155;">
                      <span style="font-size:42px;font-weight:900;color:#fbbf24;letter-spacing:14px;font-family:'Courier New',monospace;">${code}</span>
                    </div>
                    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:18px;">验证码 10 分钟内有效，请勿泄露给任何人。</p>
                  </div>
                  <div style="text-align:center;padding:22px;border-top:1px solid #1e293b;margin-top:26px;">
                    <p style="color:#475569;font-size:11px;margin:0;">此邮件由系统自动发送，请勿直接回复。</p>
                    <p style="color:#475569;font-size:11px;margin:6px 0 0 0;">© ${new Date().getFullYear()} ${brand}</p>
                  </div>
                </div>
              </div>`
            }
          : {
              from: `"${brand} 验证中心" <${smtp_user}>`,
              to: toEmail,
              subject: `【${brand}】安全身份验证`,
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

        try {
            await transporter.sendMail(mailOptions);
            return { success: true };
        } catch (sendErr) {
            if (!useSite) throw sendErr;
            // 🏬 分站 SMTP 故障时**不能连累这个站的注册**：
            //    站长配错一个端口，整站客户就收不到验证码、注册不了，
            //    而他只会看到「发送失败」，然后来找平台。
            //    做法：改用平台通道代发，但品牌仍然是他 —— 客户完全看不出换了通道。
            const pUser = cm['smtp_email'] || cm['smtp_user'] || cm['email_user'];
            const pPass = cm['smtp_pass'];
            if (!pUser || !pPass) throw sendErr;
            console.error(`[email] 分站 SMTP 失败(${smtp_host}:${smtp_port}) → 平台通道代发: ${sendErr.message}`);
            const fallbackTransporter = nodemailer.createTransport({
                host: cm['smtp_host'] || 'smtp.qq.com',
                port: parseInt(cm['smtp_port']) || 465,
                secure: true,
                auth: { user: pUser, pass: pPass }
            });
            await fallbackTransporter.sendMail({
                ...mailOptions,
                from: `"${brand} 验证中心" <${pUser}>`
            });
            return { success: true, fallback: true, message: `分站 SMTP 故障，已由系统通道代发（${sendErr.message}）` };
        }
    } catch (error) {
        console.error('Email Send Error:', error);
        return { success: false, message: error.message };
    }
};

// 🧪 站长自查：只用**分站自己的 SMTP** 发一封测试信（故意不回退）
//    这样测出来的结果才是真话 —— 如果这里显示失败，说明他配的账号/端口/授权码有问题，
//    上线后他的客户正是要走这条通道。回退通道只在故障时兜底，不能拿它冒充"测试通过"。
export const sendSiteSmtpTest = async (toEmail, siteCfg) => {
    if (!siteCfg?.smtp_user || !siteCfg?.smtp_pass) {
        return { success: false, message: '还没填 SMTP 账号或授权码' };
    }
    const host = siteCfg.smtp_host;
    const port = parseInt(siteCfg.smtp_port) || 465;
    if (!host) return { success: false, message: '还没填 SMTP 服务器地址' };
    const brand = siteCfg.name ? String(siteCfg.name) : 'XNOW PRO';
    try {
        const transporter = nodemailer.createTransport({
            host, port, secure: port === 465 || port === 587,
            auth: { user: siteCfg.smtp_user, pass: siteCfg.smtp_pass },
            connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 20000
        });
        await transporter.sendMail({
            from: `"${brand} 验证中心" <${siteCfg.smtp_user}>`,
            to: toEmail,
            subject: `【${brand}】SMTP 配置测试成功`,
            text: `这封测试邮件说明你的发信配置是通的。\n\n站点：${brand}\nSMTP：${host}:${port}\n发件账号：${siteCfg.smtp_user}\n\n你的客户注册时收到的验证码，就会从这套配置发出。`
        });
        return { success: true, message: `测试信已发出，请查收 ${toEmail}（也看一下垃圾箱）` };
    } catch (e) {
        return { success: false, message: `发送失败：${e.message}` };
    }
};

//
// 和 TG 那份**互为冗余**：任一通道把账号封了/墙了，另一条还在。
//
// 2026-10-14 二次改动：参数改成收**一组**附件 —— 当时数据库之外还有一处数据
// （`data/pending_payments.json`，支付补单队列）不落在任何一张表里，得跟着一起走。
// 同日再改：数据库和补单记录改由 `backupEngine` **打包进同一个 `.tar.gz`**，
// 所以现在实际只会传进来一个附件。签名保留数组形态不动（调用方和语义都还是"一组文件"）。
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
