import axios from 'axios';
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
