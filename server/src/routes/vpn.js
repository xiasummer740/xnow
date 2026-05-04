import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { VpnProduct, VpnClient, Config, Transaction, User, sequelize } from '../models/index.js';
import { createXXUIClient, newClientEmail, newClientUUID, getXXUIClient, updateXXUIClient } from '../utils/xxui.js';
import { sendTgMessage } from '../utils/tgBot.js';

const router = express.Router();

// Traffic presets users can choose from (GB)
const TRAFFIC_OPTIONS = [100, 200, 500, 1000, 2000];
// Duration presets (days)
const DURATION_OPTIONS = [
  { days: 30, label: '1个月', discount: 0 },
  { days: 90, label: '3个月', discount: 0.90 },
  { days: 180, label: '6个月', discount: 0.85 },
  { days: 360, label: '12个月', discount: 0.75 },
];

// Get config value by key
async function getConfig(key) {
  const c = await Config.findOne({ where: { key } });
  return c ? c.value : '';
}

// List available VPS nodes
router.get('/products', async (req, res) => {
  try {
    const products = await VpnProduct.findAll({ where: { active: true }, order: [['sort', 'ASC']] });
    res.json({
      status: 'success',
      data: {
        nodes: products,
        trafficOptions: TRAFFIC_OPTIONS,
        durationOptions: DURATION_OPTIONS,
      }
    });
  } catch (e) {
    res.json({ status: 'error', message: 'Failed to load products' });
  }
});

// Purchase — user selects VPS + traffic + duration
router.post('/buy', authenticate, async (req, res) => {
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
    if (traffic_gb > product.max_traffic_gb) {
      await t.rollback();
      return res.json({ status: 'error', message: `该节点单用户流量上限为 ${product.max_traffic_gb}GB` });
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
    const now = Date.now();
    const expiryTime = now + (Number(duration_days) * 86400 * 1000);
    const email = newClientEmail(product.id, user.id);
    const uuid = newClientUUID();
    const apiKey = await getConfig('xxui_api_key');

    if (!product.xxui_url || !product.xxui_inbound_id || !apiKey) {
      await t.rollback();
      return res.json({ status: 'error', message: '节点未完成配置，请联系管理员' });
    }

    await createXXUIClient(product.xxui_url, apiKey, product.xxui_inbound_id, email, uuid, Number(traffic_gb), expiryTime);

    // Build subscription URL
    const baseUrl = (product.xxui_url || '').replace(/\/+$/, '');
    const subB64 = Buffer.from(JSON.stringify({ email, uuid })).toString('base64url');
    const subUrl = `${baseUrl}/sub/${subB64}`;

    await VpnClient.create({
      user_id: user.id, product_id: product.id,
      email, uuid, sub_id: subB64,
      subscription_url: subUrl,
      traffic_gb: Number(traffic_gb),
      expiry_time: expiryTime,
      vps_location: product.vps_location,
      flag_emoji: product.flag_emoji || ''
    }, { transaction: t });

    await t.commit();
    sendTgMessage(`🛜 <b>VPN 新订单</b>\n🆔 UID: <code>${user.id}</code>\n📍 ${product.name}\n📦 ${traffic_gb}GB / ${dur.label}\n💰 ¥${finalPrice.toFixed(2)}`);

    res.json({
      status: 'success',
      data: { email, uuid, subscription_url: subUrl, expiry_time: expiryTime, traffic_gb: Number(traffic_gb), vps_location: product.vps_location, flag_emoji: product.flag_emoji || '', price: finalPrice }
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
        const apiKey = await getConfig('xxui_api_key');
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

// Admin routes

// Get/set API key
router.get('/admin/apikey', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.json({ status: 'error', message: '无权限' });
  const val = await getConfig('xxui_api_key');
  res.json({ status: 'success', data: val });
});
router.post('/admin/apikey', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.json({ status: 'error', message: '无权限' });
  const { apiKey } = req.body;
  if (apiKey === undefined) return res.json({ status: 'error', message: 'Missing apiKey' });
  await Config.upsert({ key: 'xxui_api_key', value: apiKey });
  res.json({ status: 'success' });
});

// List all servers (admin)
router.get('/admin/servers', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.json({ status: 'error', message: '无权限' });
  const servers = await VpnProduct.findAll({ order: [['sort', 'ASC']] });
  res.json({ status: 'success', data: servers });
});

// Create/update server (admin)
router.post('/admin/server', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.json({ status: 'error', message: '无权限' });
  const { id, name, vps_location, flag_emoji, xxui_url, xxui_inbound_id, max_traffic_gb, price_per_gb, active, description } = req.body;
  try {
    if (id) {
      await VpnProduct.update({ name, vps_location, flag_emoji, xxui_url, xxui_inbound_id, max_traffic_gb, price_per_gb, active, description }, { where: { id } });
    } else {
      await VpnProduct.create({ name, vps_location, flag_emoji, xxui_url, xxui_inbound_id, max_traffic_gb: max_traffic_gb || 2000, price_per_gb: price_per_gb || 0.5, active, description });
    }
    res.json({ status: 'success' });
  } catch (e) {
    res.json({ status: 'error', message: '保存失败' });
  }
});

// Delete server (admin)
router.delete('/admin/server/:id', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.json({ status: 'error', message: '无权限' });
  await VpnProduct.destroy({ where: { id: req.params.id } });
  res.json({ status: 'success' });
});

// Get all clients (admin overview)
router.get('/admin/clients', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.json({ status: 'error', message: '无权限' });
  const clients = await VpnClient.findAll({ order: [['id', 'DESC']], limit: 100 });
  res.json({ status: 'success', data: clients });
});

export default router;
