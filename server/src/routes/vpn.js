import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { VpnProduct, VpnClient, Config, Transaction, User, sequelize } from '../models/index.js';
import { createXXUIClient, newClientEmail, newClientUUID, getXXUIClient, updateXXUIClient } from '../utils/xxui.js';
import { sendTgMessage } from '../utils/tgBot.js';
import crypto from 'crypto';
import axios from 'axios';

const router = express.Router();

// 购买限流：同一用户每10秒最多1次
const buyLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 1,
  keyGenerator: (req) => String(req.user?.id || req.ip),
  message: { status: 'error', message: '操作太频繁，请10秒后再试' }
});
const renewLimiter = rateLimit({
  windowMs: 5 * 1000,
  max: 1,
  keyGenerator: (req) => String(req.user?.id || req.ip),
  message: { status: 'error', message: '操作太频繁，请5秒后再试' }
});

// Traffic presets users can choose from (GB)
const TRAFFIC_OPTIONS = [100, 200, 500, 1000, 2000];
// Duration presets (days)
const DURATION_OPTIONS = [
  { days: 30, label: '1个月', discount: 0 },
  { days: 90, label: '3个月', discount: 0.90 },
  { days: 180, label: '6个月', discount: 0.85 },
  { days: 360, label: '12个月', discount: 0.75 },
];

// Admin role middleware
function requireAdmin(req, res, next) {
  if (!['admin', 'super_admin'].includes(req.user?.role)) return res.json({ status: 'error', message: '无权限' });
  next();
}

// Get config value by key
async function getConfig(key) {
  const c = await Config.findOne({ where: { key } });
  return c ? c.value : '';
}

// 简单内存缓存
let productsCache = { data: null, time: 0 };
const CACHE_TTL = 30 * 1000; // 30秒

// List available VPS nodes
router.get('/products', async (req, res) => {
  try {
    if (Date.now() - productsCache.time < CACHE_TTL && productsCache.data) {
      return res.json({ status: 'success', data: productsCache.data });
    }
    const products = await VpnProduct.findAll({ where: { active: true }, order: [['sort', 'ASC']] });
    productsCache.data = {
      nodes: products,
      trafficOptions: TRAFFIC_OPTIONS,
      durationOptions: DURATION_OPTIONS,
    };
    productsCache.time = Date.now();
    res.json({ status: 'success', data: productsCache.data });
  } catch (e) {
    res.json({ status: 'error', message: 'Failed to load products' });
  }
});

// Ping a node to measure latency (ms)
router.get('/ping', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.json({ status: 'error', message: 'Missing node id' });
    const product = await VpnProduct.findByPk(id);
    if (!product?.xxui_url) return res.json({ status: 'error', message: 'Node not found or no URL' });

    const start = Date.now();
    await axios.get(product.xxui_url, { timeout: 5000 });
    const latency = Date.now() - start;

    res.json({ status: 'success', data: { id: Number(id), latency } });
  } catch (e) {
    res.json({ status: 'success', data: { id: Number(req.query.id), latency: null, error: 'timeout' } });
  }
});

// Purchase — user selects VPS + traffic + duration
router.post('/buy', authenticate, buyLimiter, async (req, res) => {
  const { product_id, traffic_gb, duration_days } = req.body;
  if (!product_id || !traffic_gb || !duration_days) {
    return res.json({ status: 'error', message: 'Missing required parameters' });
  }
  if (!TRAFFIC_OPTIONS.includes(Number(traffic_gb))) {
    return res.json({ status: 'error', message: 'Invalid traffic option' });
  }
  const dur = DURATION_OPTIONS.find(d => d.days === Number(duration_days));
  if (!dur) return res.json({ status: 'error', message: 'Invalid duration option' });

  const t = await sequelize.transaction();
  try {
    const product = await VpnProduct.findByPk(product_id, { transaction: t });
    if (!product) { await t.rollback(); return res.json({ status: 'error', message: '节点不存在' }); }
    if (!product.active) { await t.rollback(); return res.json({ status: 'error', message: '节点暂不可用' }); }

    const now = Date.now();

    // Check node total capacity: sum of all active clients' traffic must not exceed max_traffic_gb
    const activeClients = await VpnClient.findAll({
      where: { product_id: product.id, expiry_time: { [sequelize.Sequelize.Op.gt]: now } },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    const usedTraffic = activeClients.reduce((sum, c) => sum + (c.traffic_gb || 0), 0);
    if (usedTraffic + Number(traffic_gb) > product.max_traffic_gb) {
      await t.rollback();
      return res.json({ status: 'error', message: `该节点总流量上限 ${product.max_traffic_gb}GB，已售 ${usedTraffic}GB，剩余 ${product.max_traffic_gb - usedTraffic}GB，无法购买 ${traffic_gb}GB。请联系客服扩容。` });
    }

    // Calculate price: price_per_gb * traffic * duration_discount
    const pricePerGb = parseFloat(product.price_per_gb || 0.5);
    let basePrice = pricePerGb * Number(traffic_gb);
    const durationMonths = dur.days / 30;
    basePrice = basePrice * durationMonths;
    let finalPrice = parseFloat((basePrice * dur.discount).toFixed(2));
    if (finalPrice < 10) finalPrice = 10; // min 10 CNY

    // Check balance
    const user = await User.findByPk(req.user.id, { transaction: t });
    if (!user) { await t.rollback(); return res.json({ status: 'error', message: '用户不存在，请重新登录' }); }
    const userBalance = parseFloat(user.balance || 0);
    if (userBalance < finalPrice) {
      await t.rollback();
      return res.json({ status: 'error', message: `余额不足，需 ¥${finalPrice.toFixed(2)}，当前 ¥${userBalance.toFixed(2)}。请先充值。` });
    }

    // Deduct
    user.balance = (userBalance - finalPrice).toFixed(6);
    await user.save({ transaction: t });

    await Transaction.create({
      user_id: user.id, phone: user.phone, amount: -finalPrice, balance: user.balance,
      type: 'VPN购买',
      description: `VPN: ${product.name} ${traffic_gb}GB/${dur.label}`
    }, { transaction: t });

    // Create client on XX-UI (XX-UI uses milliseconds timestamps)
    const expiryTime = now + (Number(duration_days) * 86400 * 1000);
    const email = newClientEmail(product.id, user.id);
    const uuid = newClientUUID();
    // Use per-node API key if set, otherwise fall back to global
    const apiKey = product.xxui_api_key || await getConfig('xxui_api_key');

    if (!product.xxui_url || !product.xxui_inbound_id || !apiKey) {
      await t.rollback();
      return res.json({ status: 'error', message: '节点未完成配置，请联系管理员' });
    }

    // Generate subId (retry on collision)
    let subId, clientCreated = false;
    for (let retry = 0; retry < 3; retry++) {
      subId = crypto.randomBytes(8).toString('hex');
      try {
        await createXXUIClient(product.xxui_url, apiKey, product.xxui_inbound_id, email, uuid, subId, Number(traffic_gb), expiryTime);
        clientCreated = true;
        break;
      } catch (e) {
        if (e.message?.includes('Duplicate') || e.message?.includes('duplicate')) continue;
        throw e;
      }
    }
    if (!clientCreated) throw new Error('Failed to create client after retries');

    // Build subscription URL
    const panelParsed = new URL((product.xxui_url || '').replace(/\/+$/, ''));
    const panelHost = panelParsed.hostname;
    const subProto = panelParsed.protocol || 'https:';
    const subPath = (product.sub_path || '/sub/').replace(/\/+$/, '');
    const subUrl = `${subProto}//${panelHost}:${product.sub_port || 2096}${subPath}/${subId}`;

    // Get the real node connection URL from XX-UI
    let nodeUrl = '';
    try {
      const baseUrl = (product.xxui_url || '').replace(/\/+$/, '');
      const cr = await axios.get(`${baseUrl}/panel/remote/client/${encodeURIComponent(email)}/connect`, {
        headers: { 'X-API-Key': apiKey }, timeout: 10000
      });
      if (cr.data?.success && cr.data.obj?.url) nodeUrl = cr.data.obj.url;
    } catch (e) { console.error('VPN connect URL fetch failed:', e.message); }

    await VpnClient.create({
      user_id: user.id, product_id: product.id,
      email, uuid, sub_id: subId,
      subscription_url: subUrl,
      config_url: nodeUrl,
      traffic_gb: Number(traffic_gb),
      expiry_time: expiryTime,
      vps_location: product.vps_location,
      flag_emoji: product.flag_emoji || ''
    }, { transaction: t });

    await t.commit();
    sendTgMessage(
      `🛜 <b>VPN 新订单</b>\n🆔 UID: <code>${user.id}</code>\n📍 ${product.name}\n📦 ${traffic_gb}GB / ${dur.label}\n💰 ¥${finalPrice.toFixed(2)}\n📎 <code>${subUrl}</code>`
    );

    res.json({
      status: 'success',
      data: { email, uuid, subscription_url: subUrl, config_url: nodeUrl, expiry_time: expiryTime, traffic_gb: Number(traffic_gb), vps_location: product.vps_location, flag_emoji: product.flag_emoji || '', price: finalPrice, balance: user.balance }
    });
  } catch (e) {
    await t.rollback();
    console.error('VPN purchase error:', e.message);
    res.json({ status: 'error', message: '购买失败，请联系管理员' });
  }
});

// Get user's clients
router.get('/clients', authenticate, async (req, res) => {
  try {
    const clients = await VpnClient.findAll({ where: { user_id: req.user.id }, order: [['id', 'DESC']] });
    res.json({ status: 'success', data: clients });
  } catch (e) {
    res.json({ status: 'error', message: 'Failed to load clients' });
  }
});

// Get single client with live traffic from XX-UI
router.get('/client/:id', authenticate, async (req, res) => {
  try {
    const client = await VpnClient.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!client) return res.json({ status: 'error', message: 'Client not found' });

    let liveTraffic = null;
    try {
      const product = await VpnProduct.findByPk(client.product_id);
      if (product?.xxui_url) {
        const apiKey = product?.xxui_api_key || await getConfig('xxui_api_key');
        if (apiKey) {
          const traffic = await getXXUIClient(product.xxui_url, apiKey, client.email);
          if (traffic) liveTraffic = { up: traffic.up || 0, down: traffic.down || 0, total: traffic.total || 0 };
        }
      }
    } catch (e) { /* */ }

    res.json({ status: 'success', data: { ...client.toJSON(), liveTraffic } });
  } catch (e) {
    res.json({ status: 'error', message: 'Failed to load client' });
  }
});


// Renew/extend a client
router.post("/client/:id/renew", authenticate, renewLimiter, async (req, res) => {
  const { traffic_gb, duration_days } = req.body;
  if (!traffic_gb && !duration_days) return res.json({ status: "error", message: "请选择续费流量或时长" });
  const client = await VpnClient.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!client) return res.json({ status: "error", message: "节点不存在" });
  const product = await VpnProduct.findByPk(client.product_id);
  if (!product) return res.json({ status: "error", message: "节点配置丢失" });
  const addTraffic = Number(traffic_gb || 0);
  const addDays = Number(duration_days || 0);
  const pricePerGb = parseFloat(product.price_per_gb || 0.5);
  const months = addDays > 0 ? (addDays / 30) : 1;
  let totalPrice;
  if (addTraffic > 0) {
    // 追加流量：按新增流量 * 时长计费
    totalPrice = pricePerGb * addTraffic * months;
  } else if (addDays > 0) {
    // 仅续时长：按当前套餐流量 * 时长计费，最低10GB基数
    const baseTraffic = Math.max(client.traffic_gb || 10, 10);
    totalPrice = pricePerGb * baseTraffic * months;
  } else {
    totalPrice = 0;
  }
  if (totalPrice > 0 && totalPrice < 10) totalPrice = 10; // 最低消费10元
  const user = await User.findByPk(req.user.id);
  const userBalance = parseFloat(user.balance || 0);
  if (userBalance < totalPrice) return res.json({ status: "error", message: "余额不足" });
  if (addTraffic > 0) {
    const now = Date.now();
    const active = await VpnClient.findAll({ where: { product_id: client.product_id, expiry_time: { [sequelize.Sequelize.Op.gt]: now } } });
    const used = active.reduce((s, c) => s + (c.id === client.id ? 0 : c.traffic_gb || 0), 0);
    if (used + (client.traffic_gb || 0) + addTraffic > product.max_traffic_gb) return res.json({ status: "error", message: "节点容量不足" });
  }
  const t = await sequelize.transaction();
  try {
    user.balance = (userBalance - totalPrice).toFixed(6);
    await user.save({ transaction: t });
    await Transaction.create({ user_id: user.id, phone: user.phone, amount: -totalPrice, balance: user.balance, type: "VPN续费", description: "VPN续费: " + client.email }, { transaction: t });
    if (addTraffic > 0) client.traffic_gb = (client.traffic_gb || 0) + addTraffic;
    if (addDays > 0) client.expiry_time = Math.max(client.expiry_time || Date.now(), Date.now()) + addDays * 86400 * 1000;
    let xxuiWarning = false;
    try {
      const ak = product.xxui_api_key || await getConfig("xxui_api_key");
      if (product.xxui_url && ak) await updateXXUIClient(product.xxui_url, ak, client.email, client.traffic_gb, client.expiry_time, true);
    } catch (e) {
      xxuiWarning = true;
      console.error(`[VPN Renew] XX-UI 更新失败: ${client.email} - ${e.message}`);
    }
    await client.save({ transaction: t });
    await t.commit();
    const renewData = { traffic_gb: client.traffic_gb, expiry_time: client.expiry_time, price: totalPrice, balance: user.balance };
    if (xxuiWarning) renewData.xxui_warning = true;
    res.json({ status: "success", data: renewData });
  } catch (e) { await t.rollback(); res.json({ status: "error", message: "续费失败" }); }
});
// Check if VPN shop is enabled
router.get('/status', async (req, res) => {
  const val = await getConfig('vpn_shop_enabled');
  res.json({ status: 'success', enabled: val !== 'false' });
});

// Admin routes

// Toggle VPN shop on/off (super_admin only)
router.post('/admin/toggle-shop', authenticate, requireAdmin, async (req, res) => {
  const enabled = req.body.enabled !== false;
  const [row] = await Config.findOrCreate({ where: { key: 'vpn_shop_enabled' }, defaults: { key: 'vpn_shop_enabled', value: String(enabled) } });
  if (row) { row.value = String(enabled); await row.save(); }
  res.json({ status: 'success', enabled });
});

// Test connection to an XX-UI panel
router.post('/admin/test-connection', authenticate, requireAdmin, async (req, res) => {
  const { xxui_url, api_key, inbound_id } = req.body;
  if (!xxui_url) return res.json({ status: 'error', message: '缺少面板地址' });
  const baseUrl = (xxui_url || '').replace(/\/+$/, '');
  const key = api_key || await getConfig('xxui_api_key');
  if (!key) return res.json({ status: 'error', message: '未配置 API Key' });

  try {
    // Try to list inbounds (tests connectivity + key)
    const r = await axios.get(`${baseUrl}/panel/remote/inbounds`, {
      headers: { 'X-API-Key': key }, timeout: 10000
    });
    if (!r.data?.success) return res.json({ status: 'error', message: 'API Key 无效或面板无响应' });

    const inbounds = r.data.obj || [];
    if (inbound_id) {
      const found = inbounds.find(i => i.id === Number(inbound_id));
      if (!found) return res.json({ status: 'error', message: `入站 ${inbound_id} 不存在或未开启允许远程管理` });
      res.json({ status: 'success', message: `✓ 连接成功! 入站 ${inbound_id} (${found.protocol || '?'}:${found.port}) 已就绪`, protocol: found.protocol, port: found.port });
    } else {
      const ready = inbounds.filter(i => i.port);
      res.json({ status: 'success', message: `✓ 连接成功! 发现 ${inbounds.length} 个入站，${ready.length} 个可用`, count: inbounds.length });
    }
  } catch (e) {
    const msg = e.code === 'ECONNREFUSED' ? '无法连接面板，地址或端口错误' :
                e.code === 'ETIMEDOUT' || e.code === 'ECONNABORTED' ? '连接超时，请检查地址和网络' :
                e.response?.status === 403 ? 'API Key 无效' :
                e.response?.status === 401 ? 'API Key 未配置或无效' :
                `连接失败: ${e.message}`;
    res.json({ status: 'error', message: msg });
  }
});

// Get/set API key
router.get('/admin/apikey', authenticate, requireAdmin, async (req, res) => {
  const val = await getConfig('xxui_api_key');
  res.json({ status: 'success', data: val });
});
router.post('/admin/apikey', authenticate, requireAdmin, async (req, res) => {
  const { apiKey } = req.body;
  if (apiKey === undefined) return res.json({ status: 'error', message: 'Missing apiKey' });
  await Config.upsert({ key: 'xxui_api_key', value: apiKey });
  res.json({ status: 'success' });
});

// List all servers (admin)
router.get('/admin/servers', authenticate, requireAdmin, async (req, res) => {
  const servers = await VpnProduct.findAll({ order: [['sort', 'ASC']] });
  res.json({ status: 'success', data: servers });
});

// Create/update server (admin)
router.post('/admin/server', authenticate, requireAdmin, async (req, res) => {
  const { id, name, vps_location, flag_emoji, xxui_url, xxui_inbound_id, sub_port, sub_path, xxui_api_key, max_traffic_gb, price_per_gb, active, description } = req.body;
  try {
    if (id) {
      await VpnProduct.update({ name, vps_location, flag_emoji, xxui_url, xxui_inbound_id, sub_port, sub_path, xxui_api_key, max_traffic_gb, price_per_gb, active, description }, { where: { id } });
    } else {
      await VpnProduct.create({ name, vps_location, flag_emoji, xxui_url, xxui_inbound_id, sub_port: sub_port || 2096, sub_path: sub_path || '/sub/', xxui_api_key: xxui_api_key || '', max_traffic_gb: max_traffic_gb || 2000, price_per_gb: price_per_gb || 0.5, active, description });
    }
    res.json({ status: 'success' });
  } catch (e) {
    res.json({ status: 'error', message: '保存失败' });
  }
});

// Delete server (admin)
router.delete('/admin/server/:id', authenticate, requireAdmin, async (req, res) => {
  await VpnProduct.destroy({ where: { id: req.params.id } });
  res.json({ status: 'success' });
});

// Get all clients (admin overview)
router.get('/admin/clients', authenticate, requireAdmin, async (req, res) => {
  const clients = await VpnClient.findAll({ order: [['id', 'DESC']], limit: 100 });
  res.json({ status: 'success', data: clients });
});

// Delete client (admin) - also deletes from XX-UI
router.delete('/admin/client/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const client = await VpnClient.findByPk(req.params.id);
    if (!client) return res.json({ status: 'error', message: '订单不存在' });

    // Try to delete from XX-UI
    try {
      const product = await VpnProduct.findByPk(client.product_id);
      const apiKey = product?.xxui_api_key || await getConfig('xxui_api_key');
      if (product?.xxui_url && apiKey) {
        const url = `${(product.xxui_url || '').replace(/\/+$/, '')}/panel/remote/client/${encodeURIComponent(client.email)}/delete`;
        await axios.post(url, {}, { headers: { 'X-API-Key': apiKey }, timeout: 10000 });
      }
    } catch (e) { console.error(`XX-UI delete failed for ${client.email}: ${e.response?.status || e.message}`); }

    // Mark related transactions as refunded
    try {
      await Transaction.update(
        { description: sequelize.literal("CONCAT(description, ' [已删除退款]')") },
        { where: { user_id: client.user_id, description: { [sequelize.Sequelize.Op.like]: '%' + client.email + '%' } } }
      );
    } catch (e) {}

    await client.destroy();
    res.json({ status: 'success' });
  } catch (e) {
    res.json({ status: 'error', message: '删除失败' });
  }
});

// Sync live traffic from XX-UI for one client
router.post('/admin/sync-traffic', authenticate, requireAdmin, async (req, res) => {
  try {
    const updated = [];
    const errors = [];
    for (const c of req.body.clients || []) {
      try {
        const product = await VpnProduct.findByPk(c.product_id);
        const apiKey = product?.xxui_api_key || await getConfig('xxui_api_key');
        if (!product?.xxui_url || !apiKey) {
          errors.push({ id: c.id, email: c.email, reason: '节点未配置' });
          continue;
        }
        const traffic = await getXXUIClient(product.xxui_url, apiKey, c.email);
        if (traffic) {
          await VpnClient.update(
            { traffic_used_up: traffic.up || 0, traffic_used_down: traffic.down || 0 },
            { where: { id: c.id } }
          );
          updated.push({ id: c.id, up: traffic.up || 0, down: traffic.down || 0 });
        }
      } catch (e) {
        errors.push({ id: c.id, email: c.email, reason: e.message || 'XX-UI 无响应' });
      }
    }
    if (errors.length > 0) {
      console.error(`[VPN Sync] ${errors.length}/${req.body.clients?.length || 0} 个客户端同步失败:`, errors.map(e => e.email + ':' + e.reason).join(', '));
    }
    res.json({ status: 'success', data: updated, errors: errors.length > 0 ? errors : undefined });
  } catch (e) {
    console.error('[VPN Sync] 批量同步异常:', e.message);
    res.json({ status: 'error', message: '同步失败' });
  }
});

// 流量预警检查（定时任务用）
export async function autoTrafficWarning() {
  try {
    const now = Date.now();
    const clients = await VpnClient.findAll({ where: { expiry_time: { [sequelize.Sequelize.Op.gt]: now } } });
    const warnings = [];
    for (const c of clients) {
      const total = c.traffic_gb || 1;
      const usedGB = ((c.traffic_used_up || 0) + (c.traffic_used_down || 0)) / 1073741824;
      const pct = (usedGB / total) * 100;
      if (pct >= 90) {
        warnings.push(`UID:${c.user_id} ${c.email} 已用 ${pct.toFixed(0)}% (${usedGB.toFixed(1)}/${total}GB)`);
      }
      if (c.expiry_time && c.expiry_time < now - 30 * 86400 * 1000 && c.status !== 'archived') {
        c.status = 'archived';
        await c.save();
      }
    }
    if (warnings.length > 0) {
      console.log('📊 [VPN Traffic] 流量预警 ' + warnings.length + ' 条:\n' + warnings.join('\n'));
      try { const { sendTgMessage } = await import('../utils/tgBot.js'); sendTgMessage('📊 <b>VPN 流量预警</b>\n' + warnings.map(w => '⚠️ ' + w).join('\n').substring(0, 1000)); } catch (e) {}
    }
  } catch (e) { console.error('[VPN Traffic] 预警检查失败:', e.message); }
}

export default router;
