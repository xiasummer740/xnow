import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Config } from '../models/index.js';
import { sendTgMessage, sendTgDocument } from './tgBot.js';
import { sendBackupEmail } from './email.js';

const BACKUP_DIR = path.resolve('/var/www/xnow/backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// 📎 数据库之外还有一处数据：**支付补单队列**（`paymentTracker.js` 读写的这个 JSON 文件，
//    记录"客户点了付款但还没跟渠道确认完"的单子，用于回调失败时自动补单）。
//    它**不落在任何一张表里** —— 只备份数据库就会把它整个漏掉，VPS 一没这份补单记录就没了。
//    所以每次备份**顺带把它一起送出去**。
//    直接从原位读、**不往备份目录拷副本**：省得再给保留策略添一种文件类型，
//    也不用动 `.sql.gz` 那套恢复路径。路径与 paymentTracker.js 保持一致。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PENDING_FILE = path.join(__dirname, '../../data/pending_payments.json');

// 🔒 备份/恢复统一用 bash -o pipefail：任一步骤失败（如 mysqldump 连不上库）
// 都会让整条管道以非 0 退出，杜绝「gzip 收尾吞错 → 空备份却报成功」的静默失败。
// 密码走 MYSQL_PWD 环境变量，避免 -p 出现在命令行/进程列表 & 特殊字符转义坑。
const MYSQL_ENV = () => {
    const { DB_PASS } = process.env;
    return { ...process.env, MYSQL_PWD: DB_PASS || '' };
};

// 错误信息要塞进 Telegram 的 HTML 消息里，含 < & > 会把告警本身弄成 400（发不出去还没人知道）
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const createBackup = () => {
    return new Promise((resolve, reject) => {
        const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace(/[\/\s:]/g, '_');
        const filename = `xnow_backup_${timestamp}.sql.gz`;
        const filepath = path.join(BACKUP_DIR, filename);
        const { DB_USER, DB_NAME, DB_HOST } = process.env;

        const cmd = `bash -o pipefail -c "mysqldump -h ${DB_HOST || '127.0.0.1'} -u${DB_USER} ${DB_NAME} | gzip > '${filepath}'"`;
        exec(cmd, { env: MYSQL_ENV() }, (error, _stdout, stderr) => {
            if (error) reject(new Error('mysqldump 失败: ' + ((stderr || error.message || '').trim() || '请检查数据库连接/权限')));
            else resolve({ filename, filepath, size: fs.statSync(filepath).size });
        });
    });
};

export const restoreBackup = (filepath) => {
    return new Promise((resolve, reject) => {
        const { DB_USER, DB_NAME, DB_HOST } = process.env;
        const cmd = `bash -o pipefail -c "gunzip -c '${filepath}' | mysql -h ${DB_HOST || '127.0.0.1'} -u${DB_USER} ${DB_NAME}"`;
        exec(cmd, { env: MYSQL_ENV() }, (error, _stdout, stderr) => {
            if (error) reject(new Error('恢复失败: ' + ((stderr || error.message || '').trim() || '请检查备份文件/数据库')));
            else resolve(true);
        });
    });
};

let lastBackupTime = Date.now();
export const autoBackupTask = async () => {
    try {
        const conf = await Config.findOne({ where: { key: 'auto_backup_interval' } });
        const intervalHours = conf && conf.value ? parseFloat(conf.value) : 0; 
        if (intervalHours <= 0) return;

        const msInterval = intervalHours * 60 * 60 * 1000;
        if (Date.now() - lastBackupTime >= msInterval) {
            const backup = await createBackup();
            lastBackupTime = Date.now();

            // ⚠️ 保留策略**按文件修改时间**排序，不能按文件名 —— 文件名的时间戳是
            // `2026_10_13` 这种**不补零**格式，字典序里 '1' < '9'，于是 10 月的名字排到
            // 所有 9 月文件之后，reverse() 后落在**队尾** = 正是下面循环要 unlink 的那一头：
            // **每次新建的备份当场被自己删掉**。2026-10-01 → 10-13 本地滚动备份因此
            // 静默失效 13 天（`ISSUES.md` 🟡）。用 mtime 就不依赖文件名格式。
            const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql.gz'))
                .map(f => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
                .sort((a, b) => b.t - a.t)   // 新的在前
                .map(x => x.f);
            if (files.length > 24) {
                for (let i = 24; i < files.length; i++) fs.unlinkSync(path.join(BACKUP_DIR, files[i]));
            }
            // 📎 **文字和文件必须一起走**（2026-10-13 复审反例①，祥哥截图坐实）：
            // 原来文字**每次无条件发**、文件按 `.tg_sent_<日期>` **每天只发一次** —— 同一天
            // 第二次跑就只发文字、不发文件，而那个观感与「坏了 13 天」**一模一样**（他在
            // 截图的 5:06 / 17:06 两条正是如此）。用户没法从 TG 上分辨"设计上今天不发"和
            // "又坏了"。现在合并成**一条**：看见消息就一定看见文件。
            const caption = `💾 <b>[系统自检] 自动化容灾备份完成</b>\n📦 <code>${backup.filename}</code>\n📊 ${(backup.size/1024).toFixed(2)} KB\n⏳ 频率策略: 每 ${intervalHours} 小时一次`;
            // 数据库之外的那份数据（支付补单队列）。**存在才带** —— 全新装的机器上还没这个文件，
            // 那种情况下不该因为"少一个文件"把整次备份判成失败。
            const pending = fs.existsSync(PENDING_FILE)
                ? { filepath: PENDING_FILE, filename: 'pending_payments.json', size: fs.statSync(PENDING_FILE).size }
                : null;
            const pendingCaption = pending
                ? `💾 <b>[系统自检] 支付补单记录</b>（数据库之外的另一份数据）\n📦 <code>pending_payments.json</code>\n📊 ${(pending.size/1024).toFixed(2)} KB`
                : '';

            try {
                await sendTgDocument(backup.filepath, caption);
                if (pending) await sendTgDocument(pending.filepath, pendingCaption);
            } catch (e) {
                // 说清是哪一半坏了：本地这份是好的，坏的是云端那份。下次跑（12h 后）自动重试。
                // e.message 是任意文本，塞进 HTML 消息前必须转义，否则含 < & 时告警本身会被 400 拒掉。
                console.error('[Backup] 异地存档发送失败:', e.message);
                sendTgMessage(`🚨 <b>异地容灾备份发送失败</b>\n本地备份正常（${backup.filename}），但<b>云端那份没送到</b>：\n<code>${esc(e.message)}</code>\n12 小时后的下一次会自动重试。`);
            }

            // 📧 邮件那份异地存档。和 TG **各自独立 try/catch** —— 一条通道挂了不能连累另一条，
            // 也不能因为 TG 发失败就跳过邮件（反之亦然）。
            // 收件人取 smtp_email 自发自收：后台「邮件服务 (SMTP)」那四个框就是祥哥要的
            // 「能自己改邮箱」的地方，换邮箱时 host / email / 授权码 一起改（SMTP 的固有语义）。
            try {
                await sendBackupEmail(pending ? [backup, pending] : [backup]);
            } catch (e) {
                console.error('[Backup] 邮件存档发送失败:', e.message);
                sendTgMessage(`🚨 <b>邮件异地存档发送失败</b>\n本地备份正常（${backup.filename}），但<b>邮件那份没送到</b>：\n<code>${esc(e.message)}</code>\n12 小时后的下一次会自动重试。`);
            }
        }
    } catch (e) {
        console.error('Auto Backup Error:', e);
        // 🔒 备份失败也要让祥哥知道（数据安全），不再静默吞掉
        sendTgMessage('🚨 <b>自动备份失败</b>\n' + ((e && e.message) || String(e)));
    }
};
