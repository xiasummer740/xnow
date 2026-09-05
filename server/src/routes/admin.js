import express from 'express';
import axios from 'axios';
import https from 'https';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Config, User, Order, Transaction, Service, AuditLog, Notification } from '../models/index.js';
import { Op } from 'sequelize';
import { authenticate } from '../middleware/auth.js';
import { sendTgMessage } from '../utils/tgBot.js';
import { createBackup, restoreBackup } from '../utils/backupEngine.js';

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

router.post('/config/update', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error', message: '权限不足' });
  const ALLOWED_KEYS = ['global_multiplier', 'agent_discount', 'announcement', 'site_name', 'site_logo',
    'upstream_url', 'upstream_key', 'upstream_login_user', 'upstream_login_pass',
    'tg_bot_token', 'tg_chat_id', 'tg_bot_link',
    'cryptomus_id', 'cryptomus_key', 'bufpay_id', 'bufpay_key',
    'smtp_host', 'smtp_port', 'smtp_email', 'smtp_pass', 'usdt_image_url', 'ip_blacklist'];
  try {
    for (const [key, value] of Object.entries(req.body)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      if (value !== undefined && value !== null) await Config.upsert({ key, value: String(value) });
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

    const users = await User.findAll({ limit: 50, order: [['created_at', 'DESC']] });
    const orders = await Order.findAll({ limit: 50, order: [['created_at', 'DESC']] });
    const txs = await Transaction.findAll({ limit: 50, order: [['created_at', 'DESC']] });
    const totalOrders = await Order.count();

    res.json({ status: 'success', upstreamBalance: { balance: upBalance }, users, orders, transactions: txs, config: configMap, totalOrders });
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
    if (user.role === "super_admin" && req.user.role !== "super_admin") return res.json({ status: "error", message: "无法越权修改至尊管理员" });

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
      user.custom_multiplier = (multiplier === 'default' || !multiplier) ? null : parseFloat(multiplier).toFixed(2);
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
    const notifications = allUsers.map(u => ({
      user_id: u.id, title: title || '系统公告', content: content || ''
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
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql.gz')).map(f => {
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
    const { count, rows } = await User.findAndCountAll({ where, order: [['created_at', 'DESC']], limit, offset });
    res.json({ status: 'success', data: { items: rows, total: count, page, pageSize: limit } });
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
  try {
    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ status: 'error', message: '订单不存在' });
    if (order.is_refunded) return res.json({ status: 'error', message: '该订单已退款，禁止重复操作' });

    const user = await User.findByPk(order.user_id);
    if (!user) return res.status(404).json({ status: 'error', message: '用户不存在' });

    // 计算退款金额（按剩余比例或全额）
    const qty = parseInt(order.quantity) || 1;
    const remains = parseInt(order.remains) || 0;
    const refundRatio = remains > 0 && remains < qty ? remains / qty : 1;
    const refundAmount = parseFloat((parseFloat(order.charge) * refundRatio).toFixed(4));

    // 执行退款
    user.balance = (parseFloat(user.balance) + refundAmount).toFixed(6);
    await user.save();

    await Transaction.create({
      user_id: user.id, phone: user.phone, amount: refundAmount, balance: user.balance,
      type: '退款入账', description: `管理员退款: 订单 ${order.order_no} 退还 ¥${refundAmount}`
    });

    order.is_refunded = true;
    await order.save();

    await logAudit(req, 'order_refund', 'order', orderId, { order_no: order.order_no, amount: refundAmount });
    sendTgMessage('💳 [管理员退款]\n📦 订单: <code>' + order.order_no + '</code>\n👤 UID: <code>' + user.id + '</code>\n💵 金额: ¥' + refundAmount);

    res.json({ status: 'success', message: '退款成功', data: { amount: refundAmount } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
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
    const [deposit] = await sq.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type IN ('在线充值','微信充值','支付宝充值','USDT充值') THEN amount ELSE 0 END), 0) as total_deposit,
        COALESCE(SUM(CASE WHEN type IN ('在线充值','微信充值','支付宝充值','USDT充值') AND DATE(created_at) = CURDATE() THEN amount ELSE 0 END), 0) as today_deposit,
        COALESCE(SUM(CASE WHEN type IN ('在线充值','微信充值','支付宝充值','USDT充值') AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN amount ELSE 0 END), 0) as month_deposit,
        COALESCE(SUM(CASE WHEN type = '微信充值' THEN amount ELSE 0 END), 0) as wechat_deposit,
        COALESCE(SUM(CASE WHEN type = '支付宝充值' THEN amount ELSE 0 END), 0) as alipay_deposit,
        COALESCE(SUM(CASE WHEN type = 'USDT充值' THEN amount ELSE 0 END), 0) as usdt_deposit
      FROM transactions
    `, { type: sq.QueryTypes.SELECT });

    // 2. 订单利润统计
    const [orderStats] = await sq.query(`
      SELECT
        COALESCE(SUM(charge), 0) as total_charge,
        COALESCE(SUM(upstream_charge), 0) as total_upstream_charge,
        COALESCE(SUM(charge - upstream_charge), 0) as total_profit,
        COUNT(*) as total_orders
      FROM orders
    `, { type: sq.QueryTypes.SELECT });

    // 3. 退款统计
    const [refund] = await sq.query(`
      SELECT COALESCE(SUM(amount), 0) as total_refund
      FROM transactions WHERE type = '退款入账'
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

export default router;
