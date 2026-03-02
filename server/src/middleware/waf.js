import { Config } from '../models/index.js';

let cachedBlacklist = [];
let lastUpdate = 0;

export const wafMiddleware = async (req, res, next) => {
    try {
        // 每 30 秒动态刷新一次缓存，极大节约数据库开销
        if (Date.now() - lastUpdate > 30000) {
            const conf = await Config.findOne({ where: { key: 'ip_blacklist' } });
            if (conf && conf.value) {
                cachedBlacklist = conf.value.split('\n').map(ip => ip.trim()).filter(ip => ip);
            } else {
                cachedBlacklist = [];
            }
            lastUpdate = Date.now();
        }

        let clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || req.connection.remoteAddress;
        if (clientIp && clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim();
        if (clientIp && clientIp.startsWith('::ffff:')) clientIp = clientIp.replace('::ffff:', '');

        if (cachedBlacklist.includes(clientIp)) {
            return res.status(403).send(`
                <div style="text-align:center; padding: 100px 20px; font-family: 'Helvetica Neue', sans-serif; background: #0f172a; color: #ef4444; height: 100vh; box-sizing: border-box;">
                    <div style="max-width: 600px; margin: 0 auto; background: #1e293b; padding: 40px; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(239,68,68,0.2);">
                        <div style="font-size: 80px; margin-bottom: 20px; animation: pulse 2s infinite;">🛑</div>
                        <h1 style="font-size: 32px; font-weight: 900; letter-spacing: 2px; margin-bottom: 10px;">403 FORBIDDEN</h1>
                        <h2 style="font-size: 18px; color: #f8fafc; margin-bottom: 20px;">ACCESS DENIED BY WAF</h2>
                        <p style="color: #94a3b8; line-height: 1.6; margin-bottom: 30px;">
                            Your IP Address (<b style="color:#fbbf24;">${clientIp}</b>) has been permanently blocked by the system security center due to suspicious activities.
                        </p>
                    </div>
                </div>
            `);
        }
        next();
    } catch (e) {
        next();
    }
};
