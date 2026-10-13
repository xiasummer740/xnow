import { exec } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Config } from '../models/index.js';
import { sendTgMessage, sendTgDocument } from './tgBot.js';
import { sendBackupEmail } from './email.js';

const BACKUP_DIR = path.resolve('/var/www/xnow/backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// 什么算一份快照：新格式是**归档包**（`.tar.gz`，里面装着数据库 + 补单记录），
// 老的 `.sql.gz`（只有数据库）**继续认** —— 历史快照库里还躺着 24 份，不能一改格式就还原不了。
// 「列表接口（admin.js）／保留策略（本文件）」两处都走这一个判断，免得各写一遍然后漂移。
export const isBackupFile = (f) => f.endsWith('.tar.gz') || f.endsWith('.sql.gz');

// 📎 数据库之外还有一处数据：**支付补单队列**（`paymentTracker.js` 读写的这个 JSON 文件，
//    记录"客户点了付款但还没跟渠道确认完"的单子，用于回调失败时自动补单）。
//    它**不落在任何一张表里** —— 只备份数据库就会把它整个漏掉，VPS 一没这份补单记录就没了。
//    所以每次备份都把它**打进同一个归档包**送走（2026-10-14 起：从"发两个附件"改成一个包）。
//    路径与 paymentTracker.js 保持一致。
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
        const filename = `xnow_backup_${timestamp}.tar.gz`;
        const filepath = path.join(BACKUP_DIR, filename);
        const { DB_USER, DB_NAME, DB_HOST } = process.env;

        // 先在临时目录里把要装的东西摆好，再一口气打成一个包。
        // 用系统临时目录、不用 BACKUP_DIR：打包的中间产物不该进保留策略的扫描范围。
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xnow-bk-'));
        const cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });

        // 📎 这一步**故意不用管道**：mysqldump 直接重定向进文件，退出码就是它自己的，
        // 不会被身后的 gzip 盖住。老写法必须靠 `bash -o pipefail` 才挡得住
        // 「dump 挂了但 gzip 成功 → 生成一个只有注释的空壳还报成功」—— 2026-09 那 4 个
        // 664 字节的空备份就是这么来的。现在这条路径从根上不存在了。
        const sqlFile = path.join(tmp, 'xnow_db.sql');
        exec(`mysqldump -h ${DB_HOST || '127.0.0.1'} -u${DB_USER} ${DB_NAME} > '${sqlFile}'`, { env: MYSQL_ENV() }, (error, _stdout, stderr) => {
            if (error) {
                cleanup();
                reject(new Error('mysqldump 失败: ' + ((stderr || error.message || '').trim() || '请检查数据库连接/权限')));
                return;
            }
            // 兜底：退出码 0 但导出来是空的，仍然算失败 —— 空壳不能当备份送出去
            if (!fs.existsSync(sqlFile) || fs.statSync(sqlFile).size === 0) {
                cleanup();
                reject(new Error('mysqldump 没导出任何数据（文件为空）'));
                return;
            }

            // 数据库之外的那一份（支付补单队列）。**存在才带** —— 全新装的机器上还没这个文件，
            // 那种情况下不该因为"少一个文件"把整次备份判成失败。
            const hasPending = fs.existsSync(PENDING_FILE);
            if (hasPending) fs.copyFileSync(PENDING_FILE, path.join(tmp, 'pending_payments.json'));

            const members = ['xnow_db.sql', ...(hasPending ? ['pending_payments.json'] : [])]
                .map(m => `'${m}'`).join(' ');
            exec(`tar czf '${filepath}' -C '${tmp}' ${members}`, (err2, _o2, se2) => {
                cleanup();
                if (err2) {
                    reject(new Error('打包失败: ' + ((se2 || err2.message || '').trim() || '未知错误')));
                    return;
                }
                resolve({ filename, filepath, size: fs.statSync(filepath).size, hasPending });
            });
        });
    });
};

export const restoreBackup = (filepath) => {
    return new Promise((resolve, reject) => {
        const { DB_USER, DB_NAME, DB_HOST } = process.env;

        // 老格式（`.sql.gz`）：只有数据库，走原来的老路原样不动。
        if (!filepath.endsWith('.tar.gz')) {
            const cmd = `bash -o pipefail -c "gunzip -c '${filepath}' | mysql -h ${DB_HOST || '127.0.0.1'} -u${DB_USER} ${DB_NAME}"`;
            exec(cmd, { env: MYSQL_ENV() }, (error, _stdout, stderr) => {
                if (error) reject(new Error('恢复失败: ' + ((stderr || error.message || '').trim() || '请检查备份文件/数据库')));
                else resolve(true);
            });
            return;
        }

        // 归档包：先解到临时目录，再把里面的数据库喂给 mysql。
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xnow-rs-'));
        const cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });

        exec(`tar xzf '${filepath}' -C '${tmp}'`, (err, _o, se) => {
            if (err) {
                cleanup();
                reject(new Error('解包失败（文件可能已损坏）: ' + ((se || err.message || '').trim() || '未知错误')));
                return;
            }
            // 解出来没有库文件 = 这包不是本系统产出的，不能拿它去覆盖线上数据
            const sqlFile = path.join(tmp, 'xnow_db.sql');
            if (!fs.existsSync(sqlFile)) {
                cleanup();
                reject(new Error('归档包里没有数据库导出文件 xnow_db.sql'));
                return;
            }
            exec(`mysql -h ${DB_HOST || '127.0.0.1'} -u${DB_USER} ${DB_NAME} < '${sqlFile}'`, { env: MYSQL_ENV() }, (e2, _o2, se2) => {
                if (e2) {
                    cleanup();
                    reject(new Error('恢复失败: ' + ((se2 || e2.message || '').trim() || '请检查备份文件/数据库')));
                    return;
                }
                // 数据库之外的那份（补单记录）：它在任何一张表里都没有，上一步的 mysql 带不回来，
                // 得从包里单独放回原位。包里没有就说明这份备份是在"还没这个文件"的机器上生成的，跳过。
                const pendingInArchive = path.join(tmp, 'pending_payments.json');
                if (fs.existsSync(pendingInArchive)) fs.copyFileSync(pendingInArchive, PENDING_FILE);
                cleanup();
                resolve(true);
            });
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
            const files = fs.readdirSync(BACKUP_DIR).filter(isBackupFile)
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
            // 备份是**一个文件**（归档包里装着数据库 + 补单记录），所以文字和附件仍然是一条消息，
            // 看见消息就一定看见文件。
            const caption = `💾 <b>[系统自检] 自动化容灾备份完成</b>\n📦 <code>${backup.filename}</code>\n📊 ${(backup.size/1024).toFixed(2)} KB\n🗂 内含：数据库全量${backup.hasPending ? ' + 支付补单记录' : ''}\n⏳ 频率策略: 每 ${intervalHours} 小时一次`;

            try {
                await sendTgDocument(backup.filepath, caption);
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
                await sendBackupEmail([backup]);
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
