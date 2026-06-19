import express from 'express';
import axios from 'axios';
import https from 'https';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Config, User, Order, Transaction, Service } from '../models/index.js';
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

    await Config.upsert({ key: 'announcement', value: announcementHtml });

    sendTgMessage('📢 公告已从上游自动同步【' + (announcementHtml.match(/【([^】]+)】/) || ['', '最新'])[1] + '】，长度: ' + announcementHtml.length + ' 字符');

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
    res.json({ status: 'success', message: '已' + (targetUser.is_banned ? '强制封禁' : '解封') });
  } catch (e) { res.status(500).json({ status: 'error' }); }
});

router.post('/user/delete', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  const { userId } = req.body;
  try {
    const targetUser = await User.findByPk(userId);
    if (targetUser.role === 'super_admin') return res.status(403).json({ status: 'error', message: '至尊管理员不可删除' });
    await Transaction.destroy({ where: { user_id: targetUser.id } });
    await Order.destroy({ where: { user_id: targetUser.id } });
    await targetUser.destroy();
    res.json({ status: 'success', message: '已彻底抹除数据' });
  } catch (e) { res.status(500).json({ status: 'error' }); }
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
    res.json({ status: 'success', message: '冷冻级快照创建成功' });
  } catch (e) { res.status(500).json({ status: 'error', message: '数据库备份失败' }); }
});

router.post('/backup/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  if (!req.file) return res.status(400).json({ status: 'error', message: '请选择文件' });
  try {
    await restoreBackup(req.file.path);
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

export default router;
