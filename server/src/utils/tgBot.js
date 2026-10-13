import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Config } from '../models/index.js';

export const sendTgMessage = async (message) => {
    try {
        const configs = await Config.findAll({ where: { key: ['tg_bot_token', 'tg_chat_id', 'site_name'] } });
        const conf = {}; configs.forEach(c => conf[c.key] = c.value);

        if (!conf.tg_bot_token || !conf.tg_chat_id) return; // 未配置则静默退出

        const url = `https://api.telegram.org/bot${conf.tg_bot_token}/sendMessage`;
        const siteName = conf.site_name || 'XNOW';
        const finalMessage = `🔔 <b>[${siteName} 监控中心]</b>\n━━━━━━━━━━━━━━\n${message}`;

        // 异步发射，防阻塞
        axios.post(url, {
            chat_id: conf.tg_chat_id,
            text: finalMessage,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        }).catch(e => console.error('[TG Bot Send Error]', e.message));

    } catch (error) {
        console.error('[TG Bot Config Error]', error.message);
    }
};

// 📦 发送备份文件到 TG（异地容灾存档，VPS 丢失也不丢数据）
//
// ⚠️ 它和上面的 sendTgMessage **故意不一样**：sendTgMessage 是"发了就行"的通知，
// 这个却是**唯一的异地副本**，"到底送到没有"必须能让调用方知道。
// 2026-10-13 事故就是这么来的：本地备份被误删 → 这里 readFileSync 抛 ENOENT →
// 被 catch 吞成一行 console.error，而调用方**无条件**盖了"今天已发"的戳 →
// 连续 13 天每天都不重试、没人察觉。所以现在任何一步失败都**抛出去**。
export const sendTgDocument = async (filepath, caption = '') => {
    const configs = await Config.findAll({ where: { key: ['tg_bot_token', 'tg_chat_id'] } });
    const conf = {}; configs.forEach(c => conf[c.key] = c.value);
    if (!conf.tg_bot_token || !conf.tg_chat_id) throw new Error('TG 未配置：tg_bot_token / tg_chat_id 为空');

    const url = `https://api.telegram.org/bot${conf.tg_bot_token}/sendDocument`;
    const form = new FormData();
    form.append('chat_id', conf.tg_chat_id);
    // 文件不存在 / 没权限 → readFileSync 直接抛，不吞（这正是那次事故的现场）
    form.append('document', new Blob([fs.readFileSync(filepath)], { type: 'application/gzip' }), path.basename(filepath));
    form.append('caption', caption);

    const res = await axios.post(url, form, { timeout: 30000 });
    // ⚠️ Telegram 拒收时 HTTP 仍是 200，成败只在 body 的 ok 字段里 —— 不判它 = 静默失败
    if (!res.data || res.data.ok !== true) {
        throw new Error('Telegram 拒收: ' + ((res.data && res.data.description) || JSON.stringify(res.data)));
    }
};
