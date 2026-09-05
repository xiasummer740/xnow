import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Config } from '../models/index.js';
import { sendTgMessage, sendTgDocument } from './tgBot.js';

const BACKUP_DIR = path.resolve('/var/www/xnow/backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// 🔒 备份/恢复统一用 bash -o pipefail：任一步骤失败（如 mysqldump 连不上库）
// 都会让整条管道以非 0 退出，杜绝「gzip 收尾吞错 → 空备份却报成功」的静默失败。
// 密码走 MYSQL_PWD 环境变量，避免 -p 出现在命令行/进程列表 & 特殊字符转义坑。
const MYSQL_ENV = () => {
    const { DB_PASS } = process.env;
    return { ...process.env, MYSQL_PWD: DB_PASS || '' };
};

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

            const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql.gz')).sort().reverse();
            if (files.length > 24) {
                for (let i = 24; i < files.length; i++) fs.unlinkSync(path.join(BACKUP_DIR, files[i]));
            }
            sendTgMessage(`💾 <b>[系统自检] 自动化容灾备份完成</b>\n📦 文件名: <code>${backup.filename}</code>\n📊 文件大小: ${(backup.size/1024).toFixed(2)} KB\n⏳ 频率策略: 每 ${intervalHours} 小时一次`);

            // TG 每日只发一份异地存档（日期标记文件，pm2 重启也不重发；本地仍每12h滚动24份）
            const shanghaiDate = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
            const sentFlag = path.join(BACKUP_DIR, `.tg_sent_${shanghaiDate}`);
            if (!fs.existsSync(sentFlag)) {
                sendTgDocument(backup.filepath, `💾 <b>异地容灾备份</b>\n📦 ${backup.filename}\n📊 ${(backup.size/1024).toFixed(2)} KB`);
                fs.writeFileSync(sentFlag, backup.filename);
            }
        }
    } catch (e) {
        console.error('Auto Backup Error:', e);
        // 🔒 备份失败也要让祥哥知道（数据安全），不再静默吞掉
        sendTgMessage('🚨 <b>自动备份失败</b>\n' + ((e && e.message) || String(e)));
    }
};
