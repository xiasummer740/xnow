import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Config } from '../models/index.js';
import { sendTgMessage } from './tgBot.js';

const BACKUP_DIR = path.resolve('/var/www/xnow/backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

export const createBackup = () => {
    return new Promise((resolve, reject) => {
        const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace(/[\/\s:]/g, '_');
        const filename = `xnow_backup_${timestamp}.sql.gz`;
        const filepath = path.join(BACKUP_DIR, filename);
        const { DB_USER, DB_PASS, DB_NAME, DB_HOST } = process.env;

        const cmd = `mysqldump -h ${DB_HOST || '127.0.0.1'} -u${DB_USER} -p${DB_PASS} ${DB_NAME} 2>/dev/null | gzip > ${filepath}`;
        exec(cmd, (error) => {
            if (error) reject(error);
            else resolve({ filename, filepath, size: fs.statSync(filepath).size });
        });
    });
};

export const restoreBackup = (filepath) => {
    return new Promise((resolve, reject) => {
        const { DB_USER, DB_PASS, DB_NAME, DB_HOST } = process.env;
        const cmd = `gunzip -c ${filepath} | mysql -h ${DB_HOST || '127.0.0.1'} -u${DB_USER} -p${DB_PASS} ${DB_NAME} 2>/dev/null`;
        exec(cmd, (error) => {
            if (error) reject(error);
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
        }
    } catch (e) {
        console.error('Auto Backup Error:', e);
    }
};
