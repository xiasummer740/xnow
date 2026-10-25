import express from 'express';
import axios from 'axios';
import https from 'https';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Config, User, Order, Transaction, Service, AuditLog, Notification, PageView, Site, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import { authenticate } from '../middleware/auth.js';
import { resolveGeoMap } from '../utils/geo.js';
import { sendTgMessage } from '../utils/tgBot.js';
import { createBackup, restoreBackup, isBackupFile } from '../utils/backupEngine.js';
import { sanitizeAnnouncement, announcementToText } from '../utils/sanitize.js';
import refundSiteCost from '../utils/siteRefund.js';

const router = express.Router();
const BACKUP_DIR = path.resolve('/var/www/xnow/backups');

// 安全校验：确保文件路径在 BACKUP_DIR 内，防止路径穿越
const safeBackupPath = (filename) => {
  const fullPath = path.resolve(BACKUP_DIR, path.basename(filename));
  if (!fullPath.startsWith(BACKUP_DIR)) return null;
  return fullPath;
};

// 审计日志辅助函数
async function logAudit(req, action, targetType, targetId, details = {}) {
  try {
    await AuditLog.create({
      admin_id: req.user.id,
      admin_phone: req.user.phone || '',
      action,
      target_type: targetType,
      target_id: String(targetId || ''),
      details: JSON.stringify(details),
      ip_address: req.ip || ''
    });
  } catch (e) { /* 审计日志失败不影响主流程 */ }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BACKUP_DIR),
  filename: (req, file, cb) => cb(null, `uploaded_${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

// 🔒 密钥类配置不回传明文（见 /dashboard）。前端会把整个表单原样提交回来，
// 所以 update 必须识别这个掩码并跳过，否则一次保存就把所有密钥覆盖成星号。
// 注：xxui_api_key 属 /vpn 板块，不在本次审计范围内，但它同样存在 Config 表里，
// 且 dashboard 是「全表回传」，不列进来就会明文回吐 VPS 面板密钥 —— 一并掩码。
// （Admin.vue 的表单不含该键，掩掉不影响任何界面；/vpn 面板走 vpn.js 自己的 apikey 端点。）
const SENSITIVE_CONFIG_KEYS = ['upstream_key', 'upstream_login_pass', 'tg_bot_token', 'cryptomus_key', 'bufpay_key', 'smtp_pass', 'xxui_api_key'];
const CONFIG_MASK = '********';

router.post('/config/update', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error', message: '权限不足' });
  const ALLOWED_KEYS = ['global_multiplier', 'agent_discount', 'announcement', 'site_name', 'site_logo',
    'upstream_url', 'upstream_key', 'upstream_login_user', 'upstream_login_pass',
    'tg_bot_token', 'tg_chat_id', 'tg_bot_link',
    'cryptomus_id', 'cryptomus_key', 'bufpay_id', 'bufpay_key',
    'smtp_host', 'smtp_port', 'smtp_email', 'smtp_pass', 'usdt_image_url', 'ip_blacklist',
    // 🧩 订单页显示哪些平台按钮（逗号分隔）。白名单外的平台统一收进「其他」。
    //    新增平台时只改这一个配置，不用改代码/重新部署。
    'display_platforms'];
  try {
    for (const [key, value] of Object.entries(req.body)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      if (value === undefined || value === null) continue;
      // 前端回显的就是掩码 → 说明这一项管理员没动过，保持原值
      if (value === CONFIG_MASK) continue;
      // 🔒 倍率类配置必须为正有限数，防写坏全局定价
      if (key === 'global_multiplier' || key === 'agent_discount') {
        const num = parseFloat(value);
        if (!isFinite(num) || num <= 0) return res.status(400).json({ status: 'error', message: (key === 'global_multiplier' ? '全局倍率' : '代理折扣') + '必须为大于 0 的数字' });
      }
      // 🔒 公告为 HTML 富文本：入库前白名单净化，剥掉 script/事件等危险内容，前端才能安全 v-html
      const cleanValue = key === 'announcement' ? sanitizeAnnouncement(String(value)) : String(value);
      await Config.upsert({ key, value: cleanValue });
    }
    await logAudit(req, 'config_update', 'config', Object.keys(req.body).join(','), { keys: Object.keys(req.body) });
    res.json({ status: 'success', message: '配置已保存' });
  } catch (err) { res.status(500).json({ status: 'error' }); }
});

router.get('/dashboard', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const configs = await Config.findAll();
    const configMap = {}; configs.forEach(c => configMap[c.key] = c.value);

    let upBalance = '等待对接API';
    if (configMap.upstream_url && configMap.upstream_key) {
      try {
        const payload = new URLSearchParams({ key: configMap.upstream_key, action: 'balance' });
        const bRes = await axios.post(configMap.upstream_url, payload.toString());
        if (bRes.data && bRes.data.balance) upBalance = String(bRes.data.balance);
      } catch(e) {}
    }

    // 🔒 密钥类配置对外只回掩码。上方查上游余额用的是 configMap 里的真值，不受影响。
    const safeConfigMap = { ...configMap };
    SENSITIVE_CONFIG_KEYS.forEach(k => { if (safeConfigMap[k]) safeConfigMap[k] = CONFIG_MASK; });

    const users = await User.findAll({ limit: 50, order: [['created_at', 'DESC']], attributes: { exclude: ['password_hash', 'api_key'] } });
    const orders = await Order.findAll({ limit: 50, order: [['created_at', 'DESC']] });
    const txs = await Transaction.findAll({ limit: 50, order: [['created_at', 'DESC']] });
    const totalOrders = await Order.count();

    res.json({ status: 'success', upstreamBalance: { balance: upBalance }, users, orders, transactions: txs, config: safeConfigMap, totalOrders });
  } catch (err) { res.status(500).json({ status: 'error' }); }
});

// 一键同步上游公告（登录后抓取）
router.post('/sync-announcement', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error', message: '权限不足' });
  try {
    const urlConf = await Config.findOne({ where: { key: 'upstream_url' } });
    const loginUser = await Config.findOne({ where: { key: 'upstream_login_user' } });
    const loginPass = await Config.findOne({ where: { key: 'upstream_login_pass' } });

    if (!urlConf || !urlConf.value) return res.json({ status: 'error', message: '请先配置上游API地址' });
    if (!loginUser || !loginPass) return res.json({ status: 'error', message: '请先配置上游登录账号密码' });

    const baseUrl = new URL(urlConf.value).origin;
    const fetchPage = (urlStr, options = {}) => {
      const u = new URL(urlStr);
      return new Promise((resolve) => {
        const req = https.request({
          hostname: u.hostname, path: u.pathname + u.search,
          method: options.method || 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            ...(options.headers || {})
          },
        }, (resp) => {
          let body = '';
          resp.on('data', chunk => body += chunk);
          resp.on('end', () => resolve({ status: resp.statusCode, headers: resp.headers, body }));
        });
        req.on('error', (e) => resolve({ error: e.message }));
        if (options.body) req.write(options.body);
        req.end();
      });
    };

    // Step 1: 获取 CSRF
    const home = await fetchPage(baseUrl);
    if (home.error) return res.json({ status: 'error', message: '上游连接失败: ' + home.error });

    const cookies = (home.headers['set-cookie'] || []).map(c => c.split(';')[0]);
    const csrfMatch = home.body.match(/name="_csrf"[^>]*value="([^"]+)"/);
    if (!csrfMatch) return res.json({ status: 'error', message: '上游登录表单结构变更，无法获取CSRF' });

    // Step 2: 登录
    const loginParams = new URLSearchParams();
    loginParams.append('LoginForm[username]', loginUser.value);
    loginParams.append('LoginForm[password]', loginPass.value);
    loginParams.append('_csrf', csrfMatch[1]);

    const login = await fetchPage(baseUrl, {
      method: 'POST',
      headers: {
        Cookie: cookies.join('; '),
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: baseUrl,
        Referer: baseUrl + '/'
      },
      body: loginParams.toString()
    });

    if (login.status !== 302) return res.json({ status: 'error', message: '上游登录失败，请检查账号密码' });

    // Step 3: 合并 cookies
    const allCookies = [...cookies];
    (login.headers['set-cookie'] || []).forEach(nc => {
      const name = nc.split('=')[0];
      const idx = allCookies.findIndex(c => c.startsWith(name));
      if (idx >= 0) allCookies[idx] = nc.split(';')[0];
      else allCookies.push(nc.split(';')[0]);
    });

    // Step 4: 抓取登录后页面
    const dash = await fetchPage(baseUrl, {
      headers: { Cookie: allCookies.join('; ') }
    });

    // Step 5: 提取公告内容
    const annStart = dash.body.indexOf('刷粉风控期建议');
    if (annStart < 0) return res.json({ status: 'error', message: '上游公告格式已变更，未找到公告内容' });

    const before = dash.body.substring(Math.max(0, annStart - 5000), annStart);
    const blockMatch = before.match(/id="block_(\d+)"/g);
    if (!blockMatch) return res.json({ status: 'error', message: '上游公告区块未找到' });

    const blockId = blockMatch[blockMatch.length - 1].match(/\d+/)[0];
    const blockStartTag = 'id="block_' + blockId + '"';
    const blockStart = dash.body.indexOf(blockStartTag);
    const nextBlockStart = dash.body.indexOf('id="block_', blockStart + blockStartTag.length);
    const blockHtml = dash.body.substring(blockStart, nextBlockStart > 0 ? nextBlockStart : blockStart + 50000);

    const descMatch = blockHtml.match(/<div class="text-block__description">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
    if (!descMatch) return res.json({ status: 'error', message: '公告描述未找到' });

    let announcementHtml = descMatch[1].trim();
    announcementHtml = announcementHtml.replace(/var\(--color-id-\d+\)/g, '#ffffff');

    // 规范化字号，避免上游特大字体
    announcementHtml = announcementHtml.replace(/font-size:\s*\d{2,}px/gi, 'font-size: 17px');
    announcementHtml = announcementHtml.replace(/font-size:\s*2[7-9]px/gi, 'font-size: 17px');

    // 清除上游广告和敏感信息
    announcementHtml = announcementHtml.replace(/<p[^>]*>[\s\S]*?tk7188\.top[\s\S]*?<\/p>/gi, '');
    announcementHtml = announcementHtml.replace(/<p[^>]*>[\s\S]*?tg频道[\s\S]*?<\/p>/gi, '');
    announcementHtml = announcementHtml.replace(/@tk7188\w*/g, '@客服');

    // 替换上游域名
    const siteNameConf = await Config.findOne({ where: { key: 'site_name' } });
    const currentDomain = siteNameConf ? siteNameConf.value : 'XNOW';

    res.json({ status: 'success', data: { announcement: announcementHtml }, message: '公告同步成功' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '同步失败: ' + e.message });
  }
});

router.post("/user/role", authenticate, async (req, res) => {
  if (!["admin", "super_admin"].includes(req.user.role)) return res.status(403).json({ status: "error", message: "权限不足" });
  const { userId, role, addDays } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ status: "error", message: "用户不存在" });
    // 🔒 提权防线：只有 super_admin 能授予/降级 admin/super_admin 身份；普通管理员只能调度 用户/黄金/代理
    const PRIV = ['admin', 'super_admin'];
    const touchesPriv = PRIV.includes(user.role) || PRIV.includes(role);
    if (touchesPriv && req.user.role !== 'super_admin') return res.json({ status: "error", message: "仅至尊管理员可管理管理员身份" });

    const oldRole = user.role; user.role = role;
    if (role === "agent" && addDays > 0) {
      const now = Date.now(); const currentExpire = user.vip_expire_at ? new Date(user.vip_expire_at).getTime() : now;
      user.vip_expire_at = new Date((currentExpire > now ? currentExpire : now) + Number(addDays) * 24 * 60 * 60 * 1000);
    } else if (role !== "agent") { user.vip_expire_at = null; }
    await user.save();

    const roleMap = { 'super_admin':'至尊管理员', 'admin':'管理员', 'agent':'👑 至尊代理', 'user':'黄金用户' };
    await logAudit(req, 'user_role', 'user', userId, { oldRole, newRole: role, addDays });
    sendTgMessage('🛡️ [管理操作] 用户权限调度\n🆔 UID: <code>' + user.id + '</code>\n👤 账号: <code>' + user.phone + '</code>\n🔄 变更: ' + roleMap[oldRole] + ' ➡️ ' + roleMap[role] + '\n⏳ 赠送时长: ' + (addDays > 0 ? addDays + ' 天' : '无'));
    res.json({ status: "success", message: "权限与时长已同步更新" });
  } catch (e) { res.status(500).json({ status: "error", message: "调度失败" }); }
});

router.post('/user/update', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const { userId, type, amount, multiplier } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ status: 'error' });
    if (type === 'fund') {
      user.balance = (parseFloat(user.balance) + parseFloat(amount)).toFixed(6);
      await user.save();
      await Transaction.create({ user_id: user.id, phone: user.phone, amount: parseFloat(amount), balance: user.balance, type: '后台调账', description: '管理员手动调账: ' + (amount > 0 ? '+' : '') + amount });
      await logAudit(req, 'user_fund', 'user', userId, { amount, newBalance: user.balance });
    } else if (type === 'multiplier') {
      // 🔒 倍率只允许正有限数（'default'/空=重置），负数/0/NaN 直接拒，防下单价格被写坏
      if (multiplier !== 'default' && multiplier !== '' && multiplier !== null && multiplier !== undefined) {
        const m = parseFloat(multiplier);
        if (!isFinite(m) || m <= 0) return res.status(400).json({ status: 'error', message: '倍率必须为大于 0 的数字' });
        user.custom_multiplier = m.toFixed(2);
      } else {
        user.custom_multiplier = null;
      }
      await user.save();
    }
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error' }); }
});

router.post('/user/ban', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const { userId, reason } = req.body;
  try {
    const targetUser = await User.findByPk(userId);
    if (String(targetUser.id) === String(req.user.id) || targetUser.role === 'super_admin') return res.status(403).json({ status: 'error', message: '非法越权操作' });
    targetUser.is_banned = !targetUser.is_banned;
    targetUser.ban_reason = targetUser.is_banned ? (reason || '管理员强制封禁') : null;
    await targetUser.save();
    await logAudit(req, 'user_ban', 'user', userId, { banned: targetUser.is_banned, reason: targetUser.ban_reason });
    res.json({ status: 'success', message: '已' + (targetUser.is_banned ? '强制封禁' : '解封') });
  } catch (e) { res.status(500).json({ status: 'error' }); }
});

router.post('/user/delete', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const { userId } = req.body;
  try {
    const targetUser = await User.findByPk(userId);
    if (targetUser.role === 'super_admin') return res.status(403).json({ status: 'error', message: '至尊管理员不可删除' });
    const deletedPhone = targetUser.phone; const deletedRole = targetUser.role;
    await Transaction.destroy({ where: { user_id: targetUser.id } });
    await Order.destroy({ where: { user_id: targetUser.id } });
    await targetUser.destroy();
    await logAudit(req, 'user_delete', 'user', userId, { phone: deletedPhone, role: deletedRole });
    res.json({ status: 'success', message: '已彻底抹除数据' });
  } catch (e) { res.status(500).json({ status: 'error' }); }
});

// ====== 用户运营操作 ======

// 获取用户订单历史
router.get('/users/:id/orders', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const orders = await Order.findAll({
      where: { user_id: req.params.id },
      order: [['created_at', 'DESC']],
      limit: 20
    });
    res.json({ status: 'success', data: orders });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// 获取用户交易流水
router.get('/users/:id/transactions', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const txs = await Transaction.findAll({
      where: { user_id: req.params.id },
      order: [['created_at', 'DESC']],
      limit: 20
    });
    res.json({ status: 'success', data: txs });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// 管理员备注用户
router.post('/users/:id/note', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ status: 'error', message: '用户不存在' });
    user.admin_note = req.body.note || '';
    await user.save();
    await logAudit(req, 'user_note', 'user', req.params.id, { note: req.body.note });
    res.json({ status: 'success', message: '备注已保存' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// 发送站内通知
router.post('/users/:id/notify', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ status: 'error', message: '用户不存在' });
    const { title, content } = req.body;
    await Notification.create({
      user_id: user.id,
      title: title || '系统通知',
      content: content || ''
    });
    await logAudit(req, 'user_notify', 'user', req.params.id, { title });
    sendTgMessage('📢 [管理员发送通知]\n👤 UID: <code>' + user.id + '</code>\n📱 账号: <code>' + user.phone + '</code>\n📌 标题: ' + (title || '系统通知'));
    res.json({ status: 'success', message: '通知已发送' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// 用户全面分析（消费统计 + 服务分布 + 月度趋势）
router.get('/users/:id/analysis', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const sq = Transaction.sequelize;
    const uid = req.params.id;

    const [spending] = await sq.query(`
      SELECT COUNT(*) as total_orders,
        COALESCE(SUM(charge),0) as total_spent,
        COALESCE(SUM(charge-upstream_charge),0) as total_profit,
        COALESCE(AVG(charge),0) as avg_order_value,
        MIN(created_at) as first_order_at,
        MAX(created_at) as last_order_at
      FROM orders WHERE user_id = ?`, { replacements: [uid], type: sq.QueryTypes.SELECT });

    const [depositStats] = await sq.query(`
      SELECT COALESCE(SUM(amount),0) as total_deposit,
        COUNT(*) as deposit_count,
        COALESCE(SUM(CASE WHEN type='推广返佣' THEN amount ELSE 0 END),0) as total_commission
      FROM transactions WHERE user_id=? AND amount>0`, { replacements: [uid], type: sq.QueryTypes.SELECT });

    const serviceBreakdown = await sq.query(`
      SELECT service_id,service_name,COUNT(*) as order_count,
        COALESCE(SUM(charge),0) as revenue
      FROM orders WHERE user_id=?
      GROUP BY service_id,service_name ORDER BY revenue DESC LIMIT 10`,
      { replacements: [uid], type: sq.QueryTypes.SELECT });

    const monthlyTrend = await sq.query(`
      SELECT DATE_FORMAT(created_at,'%Y-%m') as month,
        COALESCE(SUM(charge),0) as spending,COUNT(*) as order_count
      FROM orders WHERE user_id=? AND created_at>=DATE_SUB(CURDATE(),INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at,'%Y-%m') ORDER BY month ASC`,
      { replacements: [uid], type: sq.QueryTypes.SELECT });

    res.json({ status:'success', data:{ spending, depositStats, serviceBreakdown, monthlyTrend } });
  } catch (err) { res.status(500).json({ status:'error', message: err.message }); }
});

// ====== IP 地理位置查询（代理 ip-api.com，避免前端跨域 + 批量 + 内存缓存，防打爆免费限流）======
const geoCache = new Map();        // ip -> {country, city}
const geoCacheTime = new Map();    // ip -> 时间戳
const GEO_TTL = 30 * 60 * 1000;    // 缓存 30 分钟
const isLocalIp = (ip) => !ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';

router.get('/geo/:ip', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const ip = req.params.ip;
  if (isLocalIp(ip)) return res.json({ country: '本地', city: '' });
  const now = Date.now();
  if (geoCache.has(ip) && now - (geoCacheTime.get(ip) || 0) < GEO_TTL) return res.json(geoCache.get(ip));
  try {
    const { data } = await axios.get(`http://ip-api.com/json/${ip}?lang=zh-CN`, { timeout: 3000 });
    const geo = data.status === 'success' ? { country: data.country, city: data.city } : { country: '', city: '' };
    geoCache.set(ip, geo); geoCacheTime.set(ip, now);
    res.json(geo);
  } catch { res.json({ country: '', city: '' }); }
});

// 批量查询（用户列表一次拿一页的 IP → 走 ip-api /batch，1 次请求即可，回填各行地区）
router.post('/geo/batch', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const ips = Array.isArray(req.body?.ips) ? [...new Set(req.body.ips.filter((x) => !isLocalIp(x)))] : [];
  const result = {};
  const now = Date.now();
  const missing = ips.filter((ip) => {
    if (geoCache.has(ip) && now - (geoCacheTime.get(ip) || 0) < GEO_TTL) { result[ip] = geoCache.get(ip); return false; }
    return true;
  });
  if (missing.length) {
    try {
      const { data } = await axios.post(`http://ip-api.com/batch?lang=zh-CN`, missing, { timeout: 6000 });
      if (Array.isArray(data)) {
        data.forEach((g, i) => {
          const ip = missing[i];
          const geo = g && g.status === 'success' ? { country: g.country, city: g.city } : { country: '', city: '' };
          geoCache.set(ip, geo); geoCacheTime.set(ip, now);
          result[ip] = geo;
        });
      }
    } catch { /* 外呼失败：缺失 IP 下面统一补空，不崩 */ }
  }
  ips.forEach((ip) => { if (!result[ip]) result[ip] = { country: '', city: '' }; });
  res.json({ status: 'success', data: result });
});

// ====== 公告推送 ======

// 推送公告给所有用户
router.post('/announcement/push', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const { title, content } = req.body;
    const allUsers = await User.findAll({ attributes: ['id'], where: { is_banned: false } });
    // 🔒 通知为纯文本展示位：公告 HTML 转纯文本存，避免前端露标签源码，也杜绝 XSS
    const plainContent = announcementToText(content);
    const notifications = allUsers.map(u => ({
      user_id: u.id, title: title || '系统公告', content: plainContent
    }));
    // 批量插入，每次 100 条避免过大
    for (let i = 0; i < notifications.length; i += 100) {
      await Notification.bulkCreate(notifications.slice(i, i + 100));
    }
    await logAudit(req, 'announcement_push', 'announcement', 'all', { title, userCount: allUsers.length });
    sendTgMessage('📢 [全局公告推送]\n📌 标题: ' + (title || '系统公告') + '\n👥 推送人数: ' + allUsers.length);
    res.json({ status: 'success', message: '公告已推送给 ' + allUsers.length + ' 位用户', userCount: allUsers.length });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// 灾备引擎 API
router.get('/backups', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error', message: '仅管理员有权访问灾备中心' });
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const files = fs.readdirSync(BACKUP_DIR).filter(isBackupFile).map(f => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, size: stats.size, time: stats.mtimeMs };
    }).sort((a, b) => b.time - a.time);
    res.json({ status: 'success', backups: files });
  } catch (e) { res.status(500).json({ status: 'error' }); }
});

router.post('/backup/create', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    await createBackup();
    await logAudit(req, 'backup_create', 'backup', 'manual');
    res.json({ status: 'success', message: '冷冻级快照创建成功' });
  } catch (e) { res.status(500).json({ status: 'error', message: '数据库备份失败' }); }
});

router.post('/backup/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  if (!req.file) return res.status(400).json({ status: 'error', message: '请选择文件' });
  try {
    await restoreBackup(req.file.path);
    await logAudit(req, 'backup_restore', 'backup', req.file.originalname, { method: 'upload' });
    sendTgMessage('🚨 [灾难级数据恢复] 上传还原成功\n执行官: <code>UID ' + req.user.id + '</code>\n数据包: <code>' + req.file.originalname + '</code>');
    res.json({ status: 'success', message: '上传数据已成功覆盖并唤醒全站！' });
  } catch (e) { res.status(500).json({ status: 'error', message: '数据包损坏或恢复失败' }); }
});

router.post('/backup/restore', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const { filename } = req.body;
  try {
    const filepath = safeBackupPath(filename);
    if (!filepath || !fs.existsSync(filepath)) return res.status(404).json({ status: 'error', message: '备份文件不存在' });
    await restoreBackup(filepath);
    await logAudit(req, 'backup_restore', 'backup', filename, { method: 'named_restore' });
    sendTgMessage('🚨 [灾难级数据恢复] 历史快照重置成功\n执行官: <code>UID ' + req.user.id + '</code>\n快照名: <code>' + filename + '</code>');
    res.json({ status: 'success', message: '历史快照已成功注入！' });
  } catch (e) { res.status(500).json({ status: 'error', message: '快照恢复失败' }); }
});

router.get('/backup/download', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).send('Forbidden');
  const { filename } = req.query;
  const filepath = safeBackupPath(filename);
  if (filepath && fs.existsSync(filepath)) res.download(filepath);
  else res.status(404).send('File not found');
});

router.post('/backup/delete', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const { filename } = req.body;
  try {
    const filepath = safeBackupPath(filename);
    if (filepath && fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        await logAudit(req, 'backup_delete', 'backup', filename);
        res.json({ status: 'success', message: '快照文件已从服务器物理移除' });
    } else {
        res.status(404).json({ status: 'error', message: '未找到该快照文件' });
    }
  } catch (e) { res.status(500).json({ status: 'error', message: '删除失败' }); }
});

// ====== 分站调价管理 ======
router.get('/pricing', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = 50;
    const search = req.query.search || '';
    const onlyCustom = req.query.only_custom === 'true';
    const category = req.query.category || '';

    const where = {};
    if (search) {
      where[Op.or] = [
        { service_id: isNaN(search) ? 0 : parseInt(search) },
        { name: { [Op.like]: '%' + search + '%' } },
        { category: { [Op.like]: '%' + search + '%' } }
      ];
    }
    if (onlyCustom) where.custom_rate = { [Op.ne]: null };
    if (category) where.category = category;

    const { count, rows } = await Service.findAndCountAll({
      where,
      order: [['sort', 'ASC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      attributes: ['service_id', 'name', 'category', 'rate', 'custom_rate', 'min', 'max']
    });

    // 获取全局倍率
    const multiplier = await Config.findOne({ where: { key: 'global_multiplier' } });
    const mult = parseFloat(multiplier?.value || 2.0);

    res.json({
      status: 'success',
      data: {
        items: rows.map(r => ({
          id: r.service_id,
          name: r.name,
          category: r.category,
          upstream_rate: parseFloat(r.rate),
          custom_rate: r.custom_rate !== null ? parseFloat(r.custom_rate) : null,
          sell_price: parseFloat(((r.custom_rate !== null ? parseFloat(r.custom_rate) : parseFloat(r.rate)) * mult).toFixed(4)),
          min: r.min,
          max: r.max
        })),
        total: count,
        page,
        pageSize,
        global_multiplier: mult
      }
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 批量更新自定义价格 (body: { prices: [{id, custom_rate}] })
router.post('/pricing', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const { prices } = req.body;
    if (!Array.isArray(prices)) return res.json({ status: 'error', message: '参数格式错误' });

    let updated = 0;
    for (const item of prices) {
      if (!item.id) continue;
      await Service.update(
        { custom_rate: item.custom_rate === null || item.custom_rate === '' ? null : parseFloat(item.custom_rate) },
        { where: { service_id: item.id } }
      );
      updated++;
    }

    res.json({ status: 'success', message: '已更新 ' + updated + ' 个服务定价' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ====== CSV 导出 ======
const csvEscape = (v) => { const s = String(v ?? ''); return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const sendCSV = (res, rows, headers, filename) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}_${new Date().toISOString().slice(0,10)}.csv"`);
  res.write('﻿' + headers.join(',') + '\n');
  rows.forEach(r => res.write(r.join(',') + '\n'));
  res.end();
};

router.get('/users/export', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const { search, role, date_from, date_to } = req.query;
    const where = {};
    if (search) where[Op.or] = [{ phone: { [Op.like]: '%' + search + '%' } }, { email: { [Op.like]: '%' + search + '%' } }, { id: isNaN(search) ? 0 : parseInt(search) }];
    if (role && ['user', 'gold', 'agent', 'admin', 'super_admin'].includes(role)) where.role = role;
    if (date_from) where.created_at = { ...where.created_at, [Op.gte]: new Date(date_from) };
    if (date_to) where.created_at = { ...where.created_at, [Op.lte]: new Date(date_to + 'T23:59:59') };
    const users = await User.findAll({ where, order: [['created_at', 'DESC']] });
    const headers = ['UID', '手机号', '邮箱', '角色', '余额', '总佣金', '注册IP', '最后登录IP', '最后登录', '是否封禁', '注册时间', '管理员备注'];
    sendCSV(res, users.map(u => [u.id, csvEscape(u.phone), csvEscape(u.email||''), u.role, u.balance, u.total_commission||0, csvEscape(u.register_ip||''), csvEscape(u.last_login_ip||''), u.last_login_at||'', u.is_banned ? '是' : '否', u.created_at, csvEscape(u.admin_note||'')]), headers, 'users');
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.get('/orders/export', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const { search, status, date_from, date_to } = req.query;
    const where = {};
    if (search) where[Op.or] = [{ order_no: { [Op.like]: '%' + search + '%' } }, { service_name: { [Op.like]: '%' + search + '%' } }, { phone: { [Op.like]: '%' + search + '%' } }, { user_id: isNaN(search) ? 0 : parseInt(search) }];
    if (status) where.status = status;
    if (date_from) where.created_at = { ...where.created_at, [Op.gte]: new Date(date_from) };
    if (date_to) where.created_at = { ...where.created_at, [Op.lte]: new Date(date_to + 'T23:59:59') };
    const orders = await Order.findAll({ where, order: [['created_at', 'DESC']] });
    const headers = ['订单号', 'UID', '手机号', '服务ID', '服务名', '链接', '数量', '收费', '上游收费', '利润', '状态', '已退款', '下单时间', '管理员备注'];
    sendCSV(res, orders.map(o => [o.order_no, o.user_id, csvEscape(o.phone||''), o.service_id||'', csvEscape(o.service_name||''), csvEscape(o.link), o.quantity, o.charge, o.upstream_charge, (parseFloat(o.charge)-parseFloat(o.upstream_charge)).toFixed(2), o.status, o.is_refunded ? '是' : '否', o.created_at, csvEscape(o.admin_note||'')]), headers, 'orders');
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.get('/transactions/export', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const { search, type, date_from, date_to } = req.query;
    const where = {};
    if (search) where[Op.or] = [{ phone: { [Op.like]: '%' + search + '%' } }, { description: { [Op.like]: '%' + search + '%' } }, { user_id: isNaN(search) ? 0 : parseInt(search) }];
    if (type) where.type = type;
    if (date_from) where.created_at = { ...where.created_at, [Op.gte]: new Date(date_from) };
    if (date_to) where.created_at = { ...where.created_at, [Op.lte]: new Date(date_to + 'T23:59:59') };
    const txs = await Transaction.findAll({ where, order: [['created_at', 'DESC']] });
    const headers = ['ID', 'UID', '手机号', '金额', '余额快照', '类型', '描述', '时间'];
    sendCSV(res, txs.map(t => [t.id, t.user_id, csvEscape(t.phone||''), t.amount, t.balance||'', t.type, csvEscape(t.description||''), t.created_at]), headers, 'transactions');
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ====== 审计日志查询 ======
router.get('/audit-logs', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const limit = Math.min(200, parseInt(req.query.limit) || 50);
    const logs = await AuditLog.findAll({ order: [['created_at', 'DESC']], limit });
    res.json({ status: 'success', data: logs });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// 获取分类列表
router.get('/categories', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const cats = await Service.findAll({
      attributes: ['category'],
      group: ['category'],
      order: [['category', 'ASC']]
    });
    res.json({ status: 'success', data: cats.map(c => c.category) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ====== 服务端分页查询 ======
router.get('/users', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { search, role, date_from, date_to } = req.query;
    const where = {};
    if (search) where[Op.or] = [
      { phone: { [Op.like]: '%' + search + '%' } },
      { email: { [Op.like]: '%' + search + '%' } },
      { id: isNaN(search) ? 0 : parseInt(search) }
    ];
    if (role && ['user', 'gold', 'agent', 'admin', 'super_admin'].includes(role)) where.role = role;
    if (date_from) where.created_at = { ...where.created_at, [Op.gte]: new Date(date_from) };
    if (date_to) where.created_at = { ...where.created_at, [Op.lte]: new Date(date_to + 'T23:59:59') };
    // 🔒 用户列表不需要密码哈希与 API 密钥，回传等于把全站撞库弹药送出去
    const { count, rows } = await User.findAndCountAll({
      where, order: [['created_at', 'DESC']], limit, offset,
      attributes: { exclude: ['password_hash', 'api_key'] }
    });
    // 🏬 110 期：列表里带上「这个人有没有分站」—— 密室要能直接给用户分配/续费分站，
    //    不然管理员得先跑去分站管理页搜手机号，再回来操作。
    let items = rows.map((r) => (typeof r.toJSON === 'function' ? r.toJSON() : r));
    try {
      const ids = items.map((u) => u.id);
      if (ids.length) {
        const sites = await Site.findAll({ where: { owner_id: ids }, order: [['id', 'ASC']] });
        const byOwner = new Map();
        for (const st of sites) {
          const key = String(st.owner_id);
          if (!byOwner.has(key)) byOwner.set(key, []);
          byOwner.get(key).push({
            id: st.id,
            name: st.name,
            domain: st.custom_domain || st.domain,
            status: st.status,
            expire_at: Number(st.expire_at) || 0,
          });
        }
        items = items.map((u) => ({ ...u, sites: byOwner.get(String(u.id)) || [] }));
      }
    } catch (e) { /* 分站查询失败不该拖垮用户列表 */ }

    res.json({ status: 'success', data: { items, total: count, page, pageSize: limit } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.get('/orders', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { search, status, date_from, date_to } = req.query;
    const where = {};
    if (search) where[Op.or] = [
      { order_no: { [Op.like]: '%' + search + '%' } },
      { service_name: { [Op.like]: '%' + search + '%' } },
      { phone: { [Op.like]: '%' + search + '%' } },
      { user_id: isNaN(search) ? 0 : parseInt(search) }
    ];
    if (status) where.status = status;
    if (date_from) where.created_at = { ...where.created_at, [Op.gte]: new Date(date_from) };
    if (date_to) where.created_at = { ...where.created_at, [Op.lte]: new Date(date_to + 'T23:59:59') };
    const { count, rows } = await Order.findAndCountAll({ where, order: [['created_at', 'DESC']], limit, offset });
    res.json({ status: 'success', data: { items: rows, total: count, page, pageSize: limit } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.get('/transactions', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { search, type, date_from, date_to, user_id } = req.query;
    const where = {};
    if (search) where[Op.or] = [
      { phone: { [Op.like]: '%' + search + '%' } },
      { description: { [Op.like]: '%' + search + '%' } },
      { user_id: isNaN(search) ? 0 : parseInt(search) }
    ];
    if (type) where.type = type;
    if (user_id) where.user_id = parseInt(user_id);
    if (date_from) where.created_at = { ...where.created_at, [Op.gte]: new Date(date_from) };
    if (date_to) where.created_at = { ...where.created_at, [Op.lte]: new Date(date_to + 'T23:59:59') };
    const { count, rows } = await Transaction.findAndCountAll({ where, order: [['created_at', 'DESC']], limit, offset });
    res.json({ status: 'success', data: { items: rows, total: count, page, pageSize: limit } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ====== 订单运营操作 ======

// 订单退款
router.post('/orders/refund', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const { orderId } = req.body;
  const t = await sequelize.transaction();
  try {
    // 🔒 事务 + 行锁：中途出错(500)或并发双击也不会「钱退了标记没写」导致重复退款
    const order = await Order.findByPk(orderId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!order) { await t.rollback(); return res.status(404).json({ status: 'error', message: '订单不存在' }); }
    if (order.is_refunded) { await t.rollback(); return res.json({ status: 'error', message: '该订单已退款，禁止重复操作' }); }

    const user = await User.findByPk(order.user_id, { transaction: t });
    if (!user) { await t.rollback(); return res.status(404).json({ status: 'error', message: '用户不存在' }); }

    // 计算退款金额（按剩余比例或全额）
    const qty = parseInt(order.quantity) || 1;
    const remains = parseInt(order.remains) || 0;
    const refundRatio = remains > 0 && remains < qty ? remains / qty : 1;
    const refundAmount = parseFloat((parseFloat(order.charge) * refundRatio).toFixed(4));

    // 执行退款
    user.balance = (parseFloat(user.balance) + refundAmount).toFixed(6);
    await user.save({ transaction: t });

    await Transaction.create({
      user_id: user.id, phone: user.phone, amount: refundAmount, balance: user.balance,
      type: '退款入账', description: `管理员退款: 订单 ${order.order_no} 退还 ¥${refundAmount}`,
      site_id: parseInt(order.site_id || 0)   // 分站订单的退款不能冲减平台营收
    }, { transaction: t });

    order.is_refunded = true;
    await order.save({ transaction: t });

    // 🏬 分站订单：站长已付的进货成本同步退还（同一事务，避免只退一半）
    let siteRefunded = 0;
    try {
      siteRefunded = await refundSiteCost(order, refundRatio, { transaction: t, User, Transaction });
    } catch (e) {
      await t.rollback().catch(() => {});
      return res.status(500).json({ status: 'error', message: '退款失败（分站成本退还出错）：' + ((e && e.message) || e) });
    }

    await t.commit();

    await logAudit(req, 'order_refund', 'order', orderId, { order_no: order.order_no, amount: refundAmount, site_refunded: siteRefunded });
    sendTgMessage('💳 [管理员退款]\n📦 订单: <code>' + order.order_no + '</code>\n👤 UID: <code>' + user.id + '</code>\n💵 金额: ¥' + refundAmount + (siteRefunded > 0 ? '\n🏬 站长成本已退: ¥' + siteRefunded : ''));

    res.json({ status: 'success', message: '退款成功', data: { amount: refundAmount, site_refunded: siteRefunded } });
  } catch (e) { await t.rollback().catch(() => {}); res.status(500).json({ status: 'error', message: e.message }); }
});

// 手动检查单笔订单状态
router.get('/orders/:id/check-status', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ status: 'error', message: '订单不存在' });
    if (!order.upstream_order_id) return res.json({ status: 'error', message: '无上游订单ID，无法查询' });

    const urlConf = await Config.findOne({ where: { key: 'upstream_url' } });
    const keyConf = await Config.findOne({ where: { key: 'upstream_key' } });
    if (!urlConf?.value || !keyConf?.value) return res.json({ status: 'error', message: '上游配置不完整' });

    const payload = new URLSearchParams({ key: keyConf.value, action: 'status', order: order.upstream_order_id });
    const upRes = await axios.post(urlConf.value, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000
    });

    if (upRes.data) {
      const up = upRes.data;
      if (up.status) order.status = up.status;
      if (up.remains) order.remains = String(up.remains);
      if (up.start_count) order.start_count = String(up.start_count);
      await order.save();
    }

    res.json({ status: 'success', data: { order_no: order.order_no, status: order.status, remains: order.remains, start_count: order.start_count } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// 管理员备注
router.post('/orders/:id/note', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ status: 'error', message: '订单不存在' });
    order.admin_note = req.body.note || '';
    await order.save();
    res.json({ status: 'success', message: '备注已保存' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ====== 财务聚合分析 ======
router.get('/finance', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const sq = Transaction.sequelize;

    // 1. 充值统计（按渠道分）
    // 🏬 只算**平台实收**：分站充值的钱进的是站长自己的商户账户，平台一分没收到。
    //    不排除的话，平台营收会虚高成站长的营业额 —— 老板会据此误判自己的收入。
    //    分站部分单独出 `subsite_deposit`，需要时可以对照。
    const [deposit] = await sq.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type IN ('在线充值','微信充值','支付宝充值','USDT充值') AND site_id = 0 THEN amount ELSE 0 END), 0) as total_deposit,
        COALESCE(SUM(CASE WHEN type IN ('在线充值','微信充值','支付宝充值','USDT充值') AND site_id = 0 AND DATE(created_at) = CURDATE() THEN amount ELSE 0 END), 0) as today_deposit,
        COALESCE(SUM(CASE WHEN type IN ('在线充值','微信充值','支付宝充值','USDT充值') AND site_id = 0 AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN amount ELSE 0 END), 0) as month_deposit,
        COALESCE(SUM(CASE WHEN type = '微信充值' AND site_id = 0 THEN amount ELSE 0 END), 0) as wechat_deposit,
        COALESCE(SUM(CASE WHEN type = '支付宝充值' AND site_id = 0 THEN amount ELSE 0 END), 0) as alipay_deposit,
        COALESCE(SUM(CASE WHEN type = 'USDT充值' AND site_id = 0 THEN amount ELSE 0 END), 0) as usdt_deposit,
        COALESCE(SUM(CASE WHEN type IN ('在线充值','微信充值','支付宝充值','USDT充值') AND site_id > 0 THEN amount ELSE 0 END), 0) as subsite_deposit
      FROM transactions
    `, { type: sq.QueryTypes.SELECT });

    // 2. 订单利润统计
    // 🏬 口径修正：分站订单的钱进的是**站长**账户，平台只拿「代理价（site_cost）」，
    //    不是客户付的 charge。原来一律 SUM(charge) 会把站长的营业额算成平台营收。
    //    退款也要扣：订单被退款后服务没交付，这笔收入事实上不存在。
    const [orderStats] = await sq.query(`
      SELECT
        COALESCE(SUM(CASE WHEN is_refunded = 0 THEN (CASE WHEN site_id = 0 THEN charge ELSE site_cost END) ELSE 0 END), 0) as total_charge,
        COALESCE(SUM(CASE WHEN is_refunded = 0 THEN upstream_charge ELSE 0 END), 0) as total_upstream_charge,
        COALESCE(SUM(CASE WHEN is_refunded = 0 THEN ((CASE WHEN site_id = 0 THEN charge ELSE site_cost END) - upstream_charge) ELSE 0 END), 0) as total_profit,
        COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN site_id > 0 THEN charge ELSE 0 END), 0) as subsite_gmv
      FROM orders
    `, { type: sq.QueryTypes.SELECT });
    // 退款冲减：**只看流水做对账展示**，不再参与毛利计算。
    //   已退款订单整单排除（保守口径：宁可少算，不能虚报平台赚了）。
    //   分站订单的退款由站长承担，平台实际掏的是「分站成本退还」。
    const [orderRefundAdj] = await sq.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type = '退款入账' AND site_id = 0 THEN amount ELSE 0 END), 0) as main_refund,
        COALESCE(SUM(CASE WHEN type = '分站成本退还' THEN amount ELSE 0 END), 0) as subsite_refund
      FROM transactions
      WHERE type IN ('退款入账', '分站成本退还')
    `, { type: sq.QueryTypes.SELECT });

    // 3. 退款统计（只看平台自己的单：分站订单的退款由站长承担，不该冲减平台营收）
    const [refund] = await sq.query(`
      SELECT COALESCE(SUM(amount), 0) as total_refund
      FROM transactions WHERE type = '退款入账' AND site_id = 0
    `, { type: sq.QueryTypes.SELECT });

    // 4. 佣金总支出
    const [commission] = await sq.query(`
      SELECT COALESCE(SUM(amount), 0) as total_commission
      FROM transactions WHERE type = '推广返佣' AND amount > 0
    `, { type: sq.QueryTypes.SELECT });

    // 5. 用户余额总负债
    const [balance] = await sq.query(`
      SELECT COALESCE(SUM(balance), 0) as total_balance
      FROM users
      WHERE role NOT IN ('admin', 'super_admin')
    `, { type: sq.QueryTypes.SELECT });

    // 5a. 用户总数（用于 ARPU 等指标）
    const [userCount] = await sq.query(`
      SELECT COUNT(*) as total_users,
        COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END), 0) as new_users_30d
      FROM users`, { type: sq.QueryTypes.SELECT });

    // 5b. 上月充值对比
    const [prevMonth] = await sq.query(`
      SELECT COALESCE(SUM(amount), 0) as prev_month_deposit
      FROM transactions
      WHERE amount>0 AND type IN ('在线充值','微信充值','支付宝充值','USDT充值')
        AND YEAR(created_at)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH))
        AND MONTH(created_at)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH))
    `, { type: sq.QueryTypes.SELECT });

    // 5c. 今日订单统计
    const [todayOrders] = await sq.query(`
      SELECT COUNT(*) as today_orders,
        COALESCE(SUM(charge),0) as today_revenue,
        COALESCE(SUM(CASE WHEN status='已完成' THEN 1 ELSE 0 END),0) as today_completed
      FROM orders WHERE DATE(created_at)=CURDATE()
    `, { type: sq.QueryTypes.SELECT });
    const dailyTrend = await sq.query(`
      SELECT
        DATE(created_at) as date,
        COALESCE(SUM(CASE WHEN type IN ('在线充值','微信充值','支付宝充值','USDT充值') THEN amount ELSE 0 END), 0) as deposit,
        COALESCE(SUM(CASE WHEN amount < 0 AND type IN ('订单扣款','批量订单扣款','VPN购买','VPN续费') THEN ABS(amount) ELSE 0 END), 0) as spending
      FROM transactions
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, { type: sq.QueryTypes.SELECT });

    // 7. Top 10 服务收入排行（含简介描述）
    const topServices = await sq.query(`
      SELECT o.service_id, o.service_name, s.description,
        COUNT(*) as order_count,
        COALESCE(SUM(o.charge),0) as revenue,
        COALESCE(SUM(o.charge-o.upstream_charge),0) as profit
      FROM orders o LEFT JOIN services s ON o.service_id=s.service_id
      GROUP BY o.service_id,o.service_name,s.description ORDER BY revenue DESC LIMIT 10
    `, { type: sq.QueryTypes.SELECT });

    // 8. Top 10 消费用户排行
    const topUsers = await sq.query(`
      SELECT u.id, u.phone, COALESCE(SUM(o.charge), 0) as total_spent, COUNT(o.id) as order_count
      FROM users u INNER JOIN orders o ON u.id = o.user_id
      GROUP BY u.id, u.phone ORDER BY total_spent DESC LIMIT 10
    `, { type: sq.QueryTypes.SELECT });

    // 9. 每日新注册数（近30天）
    const registrationTrend = await sq.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at) ORDER BY date ASC
    `, { type: sq.QueryTypes.SELECT });

    // 10. 订单状态分布
    const orderStatusDist = await sq.query(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(charge), 0) as total_charge
      FROM orders GROUP BY status ORDER BY count DESC
    `, { type: sq.QueryTypes.SELECT });

    // 11. 总览汇总（利润模型）
    // 沿用上面的口径：total_charge 已是"平台实收"（主站 charge / 分站 site_cost），
    // 且已排除退款订单，所以毛利直接相减即可，不再二次冲减（否则会重复扣）。
    const grossProfit = parseFloat(orderStats.total_charge) - parseFloat(orderStats.total_upstream_charge);
    const netIncome = parseFloat(deposit.total_deposit) - parseFloat(refund.total_refund) - parseFloat(commission.total_commission);
    const profitRate = parseFloat(orderStats.total_charge) > 0
      ? (grossProfit / parseFloat(orderStats.total_charge) * 100).toFixed(1)
      : '0.0';

    res.json({
      status: 'success',
      data: {
        deposit: deposit,
        orders: orderStats,
        refund: refund,
        commission: commission,
        userBalance: balance,
        dailyTrend,
        topServices,
        topUsers,
        registrationTrend,
        orderStatusDist,
        userCount,
        prevMonth: prevMonth || { prev_month_deposit: 0 },
        todayOrders: todayOrders || { today_orders: 0, today_revenue: 0, today_completed: 0 },
        summary: {
          grossProfit: grossProfit.toFixed(2),
          profitRate,
          netIncome: netIncome.toFixed(2),
          totalBalance: balance.total_balance,
          refundRate: parseFloat(orderStats.total_charge) > 0
            ? (parseFloat(refund.total_refund) / parseFloat(orderStats.total_charge) * 100).toFixed(2)
            : '0.00',
          arpu: parseFloat(userCount.total_users) > 0
            ? (parseFloat(deposit.total_deposit) / parseFloat(userCount.total_users)).toFixed(2)
            : '0.00',
          growth: parseFloat(prevMonth.prev_month_deposit) > 0
            ? (((parseFloat(deposit.month_deposit) - parseFloat(prevMonth.prev_month_deposit)) / parseFloat(prevMonth.prev_month_deposit)) * 100).toFixed(1)
            : 'N/A',
          totalUsers: userCount.total_users,
          newUsers30d: userCount.new_users_30d
        }
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ====== 流量统计看板（SEO/访问埋点聚合）====== 访客=visitor_id(uuid)；pv=页面浏览量；国家按 top IP 批量 geo 解析
router.get('/stats/traffic', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const fmtDate = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
    const from = Date.now() - days * 86400000;
    const rows = await PageView.findAll({
      attributes: ['visitor_id', 'ip', 'path', 'referrer', 'ts'],
      where: { ts: { [Op.gte]: from } },
      raw: true,
      limit: 20000,
      order: [['id', 'DESC']],
    });

    const total_pv = rows.length;
    const total_uv = new Set(rows.map((r) => r.visitor_id || r.ip).filter(Boolean)).size;

    // 按天趋势
    const trendMap = new Map();
    const daySeen = new Map();
    for (const r of rows) {
      const d = fmtDate(Number(r.ts) || from);
      if (!trendMap.has(d)) trendMap.set(d, { pv: 0, uv: 0 });
      trendMap.get(d).pv++;
      if (!daySeen.has(d)) daySeen.set(d, new Set());
      daySeen.get(d).add(r.visitor_id || r.ip);
    }
    for (const [d, set] of daySeen) trendMap.get(d).uv = set.size;
    const trend = [...trendMap.entries()].map(([date, v]) => ({ date: date.slice(5), pv: v.pv, uv: v.uv }));

    // 热门页面
    const pageMap = new Map();
    for (const r of rows) pageMap.set(r.path, (pageMap.get(r.path) || 0) + 1);
    const pages = [...pageMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, pv]) => ({ path, pv }));

    // 来源域名（外链效果追踪）
    const srcMap = new Map();
    for (const r of rows) {
      const host = (r.referrer || '').match(/^https?:\/\/([^/]+)/i)?.[1] || '直接/无来源';
      srcMap.set(host, (srcMap.get(host) || 0) + 1);
    }
    const sources = [...srcMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([source, pv]) => ({ source, pv }));

    // 国家：取频次 top50 IP 批量 geo(内存缓存，防限流)，按 pv 归国
    const ipCount = new Map();
    for (const r of rows) if (r.ip) ipCount.set(r.ip, (ipCount.get(r.ip) || 0) + 1);
    const topIps = [...ipCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50).map(([ip]) => ip);
    const geoMap = await resolveGeoMap(topIps);
    const ctryMap = new Map();
    for (const ip of topIps) {
      const c = (geoMap[ip] && geoMap[ip].country) || '未知';
      ctryMap.set(c, (ctryMap.get(c) || 0) + ipCount.get(ip));
    }
    const countries = [...ctryMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([country, pv]) => ({ country, pv }));

    res.json({ status: 'success', data: { total_pv, total_uv, days, trend, pages, sources, countries } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ======================================================================
// 🏬 分站客户总览（110 期，祥哥：「站长分站的用户所有的全面信息，
//    密室要单独做一个页面记录和统计分析，备份也要一起」）
//
// 口径说明：
//   · 「分站客户」= users.site_id > 0 的账号（在哪开的站就归哪个站）
//   · 消费 = orders.charge 之和；成本 = orders.site_cost；毛利 = 两者差
//   · 充值 = transactions 里正数流水之和（分站客户充值进的是站长商户，
//     平台一分没收到，所以这里只做客户画像，不计入平台营收）
// ======================================================================
const SITE_CUSTOMER_SORTS = {
  new: 'u.created_at DESC',
  spend: 'spend DESC',
  orders: 'orders DESC',
  balance: 'u.balance DESC',
  active: 'u.last_login_at DESC',
};

router.get('/site-customers', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { search, site_id, sort, only } = req.query;

    const where = ['u.site_id > 0'];
    const params = [];
    if (site_id && Number(site_id) > 0) { where.push('u.site_id = ?'); params.push(Number(site_id)); }
    if (only === 'active7d') where.push('u.last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    if (only === 'banned') where.push('u.is_banned = 1');
    if (search) {
      where.push('(u.phone LIKE ? OR u.email LIKE ? OR CAST(u.id AS CHAR) = ?)');
      params.push('%' + search + '%', '%' + search + '%', String(search));
    }
    const whereSql = 'WHERE ' + where.join(' AND ');
    // 排序只认白名单，绝不把请求参数拼进 SQL
    const orderSql = SITE_CUSTOMER_SORTS[sort] || SITE_CUSTOMER_SORTS.new;

    const [items] = await sequelize.query(`
      SELECT u.id, u.phone, u.email, u.balance, u.site_id, u.is_banned, u.role,
             u.created_at, u.last_login_at, u.last_login_ip, u.register_ip,
             u.inviter_id, u.admin_note, u.total_commission,
             s.name AS site_name,
             COALESCE(NULLIF(s.custom_domain, ''), s.domain) AS site_domain,
             s.status AS site_status, s.expire_at AS site_expire_at,
             (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders,
             (SELECT COALESCE(SUM(o.charge), 0) FROM orders o WHERE o.user_id = u.id) AS spend,
             (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = u.id) AS last_order_at,
             (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.user_id = u.id AND t.amount > 0) AS recharged
      FROM users u
      LEFT JOIN sites s ON s.id = u.site_id
      ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ? OFFSET ?
    `, { replacements: [...params, limit, offset] });

    const [[{ total }]] = await sequelize.query(
      `SELECT COUNT(*) AS total FROM users u ${whereSql}`, { replacements: params });

    // 全量汇总（不受筛选影响，做"这个盘子有多大"的判断）
    const [[summary]] = await sequelize.query(`
      SELECT COUNT(*) AS customers,
             SUM(CASE WHEN u.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS new7d,
             SUM(CASE WHEN u.last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS active7d,
             SUM(CASE WHEN u.is_banned = 1 THEN 1 ELSE 0 END) AS banned,
             COALESCE(SUM(u.balance), 0) AS customer_balance
      FROM users u WHERE u.site_id > 0
    `);
    const [[orderAgg]] = await sequelize.query(`
      SELECT COUNT(*) AS orders,
             COUNT(DISTINCT o.user_id) AS buyers,
             COALESCE(SUM(o.charge), 0) AS gmv,
             COALESCE(SUM(o.site_cost), 0) AS cost,
             COALESCE(SUM(o.charge - o.site_cost), 0) AS profit
      FROM orders o WHERE o.site_id > 0
    `);
    const [[rechargeAgg]] = await sequelize.query(`
      SELECT COALESCE(SUM(t.amount), 0) AS recharged, COUNT(*) AS times
      FROM transactions t WHERE t.amount > 0 AND t.site_id > 0
    `);

    // 每个分站一行：客户数 / 订单 / 营收 / 毛利 / 客户余额
    const [sites] = await sequelize.query(`
      SELECT s.id, s.name, s.status, s.plan, s.expire_at, s.created_at, s.admin_access_until,
             COALESCE(NULLIF(s.custom_domain, ''), s.domain) AS domain,
             s.agent_discount,
             u.phone AS owner_phone, u.balance AS owner_balance,
             (SELECT COUNT(*) FROM users cu WHERE cu.site_id = s.id) AS customers,
             (SELECT COUNT(*) FROM users cu WHERE cu.site_id = s.id AND cu.last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS active7d,
             (SELECT COUNT(*) FROM orders o WHERE o.site_id = s.id) AS orders,
             (SELECT COALESCE(SUM(o.charge), 0) FROM orders o WHERE o.site_id = s.id) AS gmv,
             (SELECT COALESCE(SUM(o.site_cost), 0) FROM orders o WHERE o.site_id = s.id) AS cost,
             (SELECT COALESCE(SUM(o.charge - o.site_cost), 0) FROM orders o WHERE o.site_id = s.id) AS profit,
             (SELECT COALESCE(SUM(cu.balance), 0) FROM users cu WHERE cu.site_id = s.id) AS customer_balance,
             (SELECT MAX(o.created_at) FROM orders o WHERE o.site_id = s.id) AS last_order_at
      FROM sites s
      LEFT JOIN users u ON u.id = s.owner_id
      ORDER BY gmv DESC, s.id ASC
    `);

    res.json({
      status: 'success',
      data: {
        items, total, page, pageSize: limit,
        summary: {
          ...summary,
          orders: Number(orderAgg.orders || 0),
          buyers: Number(orderAgg.buyers || 0),
          gmv: Number(orderAgg.gmv || 0),
          cost: Number(orderAgg.cost || 0),
          profit: Number(orderAgg.profit || 0),
          recharged: Number(rechargeAgg.recharged || 0),
          recharge_times: Number(rechargeAgg.times || 0),
        },
        sites,
      },
    });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// 导出 CSV：换服务器/对账/给财务留档都用得上，且不依赖界面
// 🛠️ 主站管理员对分站的运维动作（110 期祥哥定调：能看 + 能运维，但**改不了装修和价格**）
//    stop    强制停站     → status='expired'，stop_reason='admin'
//    resume  恢复运营     → status='active'，清 stop_reason，重建自有域名 vhost
//    extend  延期 N 天    → expire_at 往后推（平台赠送时长，不动站长余额）
//    delete  删除站点     → 只在 body.confirm 等于站名时执行，防误点
router.post('/sites/:id/action', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) return res.status(404).json({ status: 'error', message: '站点不存在' });
    const action = String(req.body?.action || '');

    if (action === 'stop') {
      // 停站必须动 nginx：先拆真实 vhost，再立 410 墓碑。
      // 只改数据库是不够的 —— 域名还会按旧 vhost 继续正常打开（实测过）。
      const { removeVhost, parkDomain, reloadNginx } = await import('../utils/siteDomain.js');
      for (const d of [site.domain, site.custom_domain].filter(Boolean)) {
        try { removeVhost(site.id, d); } catch (e) { /* 拆不掉也要继续 */ }
        try { parkDomain(d); } catch (e) { /* 墓碑立不上就只改库，至少别再对外服务 */ }
      }
      try { reloadNginx(); } catch (e) { /* nginx 重载失败不影响入库 */ }
      site.status = 'expired';
      site.stop_reason = 'admin';
      await site.save();
      try {
        const { clearSiteCache } = await import('../utils/siteDomain.js');
        clearSiteCache();
      } catch (e) { /* 老版本没有缓存清理，忽略 */ }
      return res.json({ status: 'success', message: `已停站：${site.name}（域名现在是下线页）` });
    }

    if (action === 'resume') {
      site.status = 'active';
      site.stop_reason = null;
      await site.save();
      // 自有域名可能已被摘掉，这里按数据库重建一次（失败不阻塞）
      let vhost = 'skipped';
      try {
        const { restoreSiteDomain } = await import('../utils/siteBilling.js');
        await restoreSiteDomain(site);
        vhost = 'ok';
      } catch (e) {
        vhost = 'failed: ' + e.message;
      }
      return res.json({ status: 'success', message: `已恢复运营：${site.name}`, data: { vhost } });
    }

    if (action === 'extend') {
      // 🔧 110 期：支持**负数**（扣减天数）。之前 Math.max(1, ...) 会把 -30 变成 +1 天，
      //    管理员想撤销误加的时间根本做不到。现在 ±365 天，且扣减下限是"现在"——
      //    不会扣成一张负数到期时间的乱账。
      const raw = Number(req.body?.days);
      const days = Number.isFinite(raw) && Math.trunc(raw) !== 0 ? Math.trunc(raw) : 30;
      if (Math.abs(days) > 365) {
        return res.status(400).json({ status: 'error', message: '一次最多增减 365 天' });
      }
      const now = Date.now();
      const cur = Math.max(now, Number(site.expire_at) || 0);
      const next = Math.max(now, cur + days * 86400 * 1000);
      site.expire_at = next;
      if (site.status !== 'active') { site.status = 'active'; site.stop_reason = null; }
      await site.save();
      return res.json({
        status: 'success',
        message: days > 0
          ? `已延期 ${days} 天：${site.name}`
          : `已扣减 ${-days} 天：${site.name}（现在到 ${new Date(next).toLocaleDateString('zh-CN')}）`,
        data: { expire_at: Number(next) },
      });
    }

    if (action === 'delete') {
      if (String(req.body?.confirm || '').trim() !== String(site.name).trim()) {
        return res.status(400).json({ status: 'error', message: '确认名称不匹配，已取消删除' });
      }
      const { removeVhost, parkDomain, reloadNginx } = await import('../utils/siteDomain.js');
      const domains = [site.custom_domain, site.domain].filter(Boolean);
      const removed = [];
      let needReload = false;
      for (const d of domains) {
        try { if (removeVhost(site.id, d)) { removed.push(d); needReload = true; } } catch (e) { /* 摘不掉也继续删数据 */ }
        // 立 410 墓碑：域名不会回落到默认 server 显示主站首页
        try { if (parkDomain(d)) needReload = true; } catch (e) {}
      }
      if (needReload) { try { reloadNginx(); } catch (e) {} }
      await site.destroy();
      return res.json({
        status: 'success',
        message: `已删除站点：${site.name}`,
        data: { removed_domains: removed, parked: domains },
      });
    }

    return res.status(400).json({ status: 'error', message: '未知动作：' + action });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.get('/site-customers/export', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const [rows] = await sequelize.query(`
      SELECT u.id, u.phone, u.email, u.balance, u.site_id, u.is_banned,
             u.created_at, u.last_login_at, u.last_login_ip,
             s.name AS site_name, COALESCE(NULLIF(s.custom_domain, ''), s.domain) AS site_domain,
             (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders,
             (SELECT COALESCE(SUM(o.charge), 0) FROM orders o WHERE o.user_id = u.id) AS spend,
             (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = u.id) AS last_order_at,
             (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.user_id = u.id AND t.amount > 0) AS recharged
      FROM users u LEFT JOIN sites s ON s.id = u.site_id
      WHERE u.site_id > 0 ORDER BY u.site_id ASC, u.id ASC LIMIT 50000
    `);
    const head = ['客户ID', '手机号', '邮箱', '余额', '分站ID', '分站名', '分站域名', '是否封禁',
      '注册时间', '最后登录', '最后登录IP', '订单数', '消费总额', '最后下单', '充值总额'];
    const esc = (v) => {
      const t = v == null ? '' : String(v);
      return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    const lines = [head.join(',')];
    for (const r of rows) {
      lines.push([
        r.id, r.phone, r.email, r.balance, r.site_id, r.site_name, r.site_domain, r.is_banned ? '已封禁' : '正常',
        r.created_at ? new Date(r.created_at).toISOString() : '',
        r.last_login_at ? new Date(r.last_login_at).toISOString() : '',
        r.last_login_ip, r.orders, r.spend,
        r.last_order_at ? new Date(r.last_order_at).toISOString() : '', r.recharged,
      ].map(esc).join(','));
    }
    const csv = '\ufeff' + lines.join('\r\n');
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="site-customers-${stamp}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

export default router;

