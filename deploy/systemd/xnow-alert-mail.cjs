#!/usr/bin/env node
// XNOW 看门狗 —— 邮件告警发送器（2026-10-17）
//
// 为什么独立成一个文件：**站点挂掉的时候，正是最需要发信的时候**。
// 所以它不 import 站点代码、不连数据库（SMTP 参数由看门狗从库里读好后经环境变量传进来），
// 只依赖 nodemailer（通过 NODE_PATH 指向站点的 node_modules）。
//
// 用法：
//   NODE_PATH=/var/www/xnow/server/node_modules \
//   SMTP_HOST=smtp.qq.com SMTP_PORT=465 SMTP_USER=... SMTP_PASS=... \
//   ALERT_TO=464844409@qq.com \
//   node xnow-alert-mail.cjs "主题" "正文（纯文本，换行用 \n）"
//
// 退出码：0 成功；1 发送失败；2 参数缺失
const nodemailer = require('nodemailer');

const subject = process.argv[2] || 'XNOW 告警';
const body = process.argv[3] || '';
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_TO } = process.env;

if (!SMTP_USER || !SMTP_PASS || !ALERT_TO) {
  console.error('MAIL_SKIP 缺 SMTP_USER / SMTP_PASS / ALERT_TO');
  process.exit(2);
}

const port = parseInt(SMTP_PORT || '465', 10);
const transporter = nodemailer.createTransport({
  host: SMTP_HOST || 'smtp.qq.com',
  port,
  secure: port === 465 || port === 587,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const html = `<div style="font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;max-width:660px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;border:1px solid #1e293b">
  <div style="padding:20px 26px;border-bottom:1px solid #1e293b;background:#111c31">
    <strong style="color:#fbbf24;font-size:18px;letter-spacing:1px">XNOW PRO 监控中心</strong>
  </div>
  <div style="padding:24px 26px;line-height:1.75;font-size:14px">${esc(body).replace(/\n/g, '<br>')}</div>
  <div style="padding:14px 26px;border-top:1px solid #1e293b;color:#64748b;font-size:12px">
    此邮件由服务器看门狗自动发送 · ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
  </div>
</div>`;

transporter.sendMail({
  from: `"XNOW 监控中心" <${SMTP_USER}>`,
  to: ALERT_TO,
  subject,
  text: body,
  html,
}).then(() => {
  console.log('MAIL_OK');
}).catch((e) => {
  console.error('MAIL_FAIL ' + e.message);
  process.exit(1);
});
