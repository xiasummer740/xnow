import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sequelize, Order, Transaction, User, BoostProduct, Config } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { debitUser, creditUser } from '../utils/balance.js';
import { refundOrderFully } from '../utils/orderRefund.js';
import { sendTgMessage } from '../utils/tgBot.js';

// ============================================================================
// 🎯 千川流量 · 后台（2026-11-04）
//
// 运营每天真正会用到的只有三件事：
//   ① 打开「待派单」看有没有新单（红点）
//   ② 点「复制话术」，把订单信息贴给客户
//   ③ 干完了点「已完成」
// 商品管理是低频的，放在第二个 tab。
//
// 🔴 状态机（只有这四条合法的迁移，其余一律拒绝）：
//      待派单 → 处理中 → 已完成
//      待派单/处理中 → 已退款（走 refundOrderFully，幂等）
//    '提交中' 不允许出现在 manual 单上，原因见 routes/boost.js 文件头。
// ============================================================================

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!['admin', 'super_admin'].includes(req.user?.role)) {
    return res.status(403).json({ status: 'error', message: '无权限' });
  }
  next();
}

const parseTiers = (raw) => {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr)
      ? arr.map((t) => ({ min: Number(t.min), price: Number(t.price) }))
          .filter((t) => Number.isFinite(t.min) && Number.isFinite(t.price))
          .sort((a, b) => a.min - b.min)
      : [];
  } catch { return []; }
};

const parseSchema = (raw) => {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr.filter((f) => f && f.key) : [];
  } catch { return []; }
};

const priceOf = (p, qty) => {
  if (p.pricing_mode === 'flat') return Number(Number(p.flat_price || 0).toFixed(6));
  const tiers = parseTiers(p.tiers);
  let best = null;
  for (const t of tiers) if (qty >= t.min && (!best || t.min > best.min)) best = t;
  if (!best) return null;
  return Number(((qty / (Number(p.unit_qty) || 10000)) * best.price).toFixed(6));
};

const fullProduct = (p) => ({
  id: p.id, code: p.code, name: p.name, subtitle: p.subtitle,
  category: p.category, platform: p.platform,
  pricing_mode: p.pricing_mode, unit_qty: p.unit_qty, unit_label: p.unit_label,
  tiers: parseTiers(p.tiers), flat_price: Number(p.flat_price || 0),
  // 成本（仅后台可见；客户侧 pubProduct 不返回这两个字段）
  cost_tiers: parseTiers(p.cost_tiers), cost_flat_price: Number(p.cost_flat_price || 0),
  min_qty: p.min_qty, max_qty: p.max_qty, qty_step: p.qty_step,
  input_schema: parseSchema(p.input_schema),
  eta_text: p.eta_text, notice: p.notice, badge: p.badge,
  active: p.active, sort: p.sort,
});

// ── 批量调价：按成本 × 倍率重算所有售价 ──────────────────────────────────────
// 放在 /products/:id 之前定义，避免被 :id 吃掉。
router.post('/products/reprice', authenticate, requireAdmin, async (req, res) => {
  try {
    const m = Number(req.body?.multiplier);
    const basis = req.body?.basis === 'current' ? 'current' : 'cost';
    if (!Number.isFinite(m) || m <= 0) return res.json({ status: 'error', message: '倍率必须是大于 0 的数字' });

    const rows = await BoostProduct.findAll();
    let updated = 0;
    const preview = [];
    for (const p of rows) {
      const patch = {};
      if (p.pricing_mode === 'flat') {
        const base = basis === 'cost' ? Number(p.cost_flat_price || 0) : Number(p.flat_price || 0);
        if (base > 0) patch.flat_price = Number((base * m).toFixed(2));
        if (patch.flat_price != null) preview.push({ code: p.code, name: p.name, from: base, to: patch.flat_price });
      } else {
        const src = basis === 'cost' ? parseTiers(p.cost_tiers) : parseTiers(p.tiers);
        if (src.length) {
          const out = src.map((t) => ({ min: t.min, price: Number((t.price * m).toFixed(2)) }));
          patch.tiers = JSON.stringify(out);
          preview.push({ code: p.code, name: p.name, from: src[0].price, to: out[0].price });
        }
      }
      if (Object.keys(patch).length) { await p.update(patch); updated += 1; }
    }
    res.json({ status: 'success', message: `已按${basis === 'cost' ? '成本' : '当前售价'} × ${m} 重算，更新 ${updated} 个商品`, data: { updated, multiplier: m, basis, preview } });
  } catch (e) {
    console.error('[boost-admin/reprice] 失败:', e);
    res.status(500).json({ status: 'error', message: '调价失败' });
  }
});

// ── 统计（顶部红点 / 概览卡片）──────────────────────────────────────────────
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const [[row]] = await sequelize.query(`
      SELECT
        SUM(status = '待派单') AS pending,
        SUM(status = '处理中') AS processing,
        SUM(status = '已完成') AS done,
        SUM(DATE(created_at) = CURDATE()) AS today_cnt,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN charge ELSE 0 END), 0) AS today_amount
      FROM orders WHERE biz_type = 'manual'
    `);
    res.json({
      status: 'success',
      data: {
        pending: Number(row.pending || 0),
        processing: Number(row.processing || 0),
        done: Number(row.done || 0),
        today_count: Number(row.today_cnt || 0),
        today_amount: Number(row.today_amount || 0),
      },
    });
  } catch (e) {
    console.error('[boost-admin/stats] 失败:', e);
    res.status(500).json({ status: 'error', message: '统计失败' });
  }
});

// ── 订单队列 ──────────────────────────────────────────────────────────────────
router.get('/orders', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status = '', keyword = '', limit = 100, offset = 0 } = req.query;
    const where = { biz_type: 'manual' };
    if (status) where.status = status;

    const { Op } = await import('sequelize');
    if (keyword) {
      where[Op.or] = [
        { order_no: { [Op.like]: `%${keyword}%` } },
        { service_name: { [Op.like]: `%${keyword}%` } },
        { link: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } },
      ];
    }

    const { rows, count } = await Order.findAndCountAll({
      where,
      order: [['id', 'DESC']],
      limit: Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500),
      offset: Math.max(parseInt(offset, 10) || 0, 0),
    });

    res.json({
      status: 'success',
      data: {
        total: count,
        items: rows.map((o) => ({
          id: o.id, order_no: o.order_no, user_id: o.user_id, phone: o.phone,
          product_name: o.service_name, boost_product_id: o.boost_product_id,
          link: o.link, quantity: o.quantity, charge: Number(o.charge),
          status: o.status, contact_channel: o.contact_channel,
          ext_fields: (() => { try { return JSON.parse(o.ext_fields || '{}'); } catch { return {}; } })(),
          admin_note: o.admin_note, is_refunded: o.is_refunded,
          created_at: o.createdAt,
        })),
      },
    });
  } catch (e) {
    console.error('[boost-admin/orders] 失败:', e);
    res.status(500).json({ status: 'error', message: '加载失败' });
  }
});

// ── 状态流转 ──────────────────────────────────────────────────────────────────
const LEGAL = {
  '待派单': ['处理中', '已取消'],
  '处理中': ['已完成', '已取消'],
  '已完成': [],
  '已取消': [],
  '已退款': [],
};

router.post('/orders/:id/status', authenticate, requireAdmin, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { status, note, contact_channel } = req.body || {};
    const o = await Order.findOne({ where: { id: Number(req.params.id), biz_type: 'manual' }, transaction: t, lock: t.LOCK.UPDATE });
    if (!o) { await t.rollback(); return res.status(404).json({ status: 'error', message: '订单不存在' }); }

    // 只改备注时 status === 当前值，跳过迁移校验；真正流转才检查合法性
    if (status !== o.status) {
      if (!LEGAL[o.status] || !LEGAL[o.status].includes(status)) {
        await t.rollback();
        return res.json({ status: 'error', message: `不能从「${o.status}」改成「${status}」` });
      }
    }

    // 🔴 o.update() 会把实例上的 o.status 一起改掉，所以旧状态必须先存下来，
    //    否则下面「状态变了才播报」的判断永远为 false（踩过一次）
    const before = o.status;
    const patch = { status };
    if (note != null) patch.admin_note = String(note).slice(0, 2000);
    if (contact_channel && ['wechat', 'tg', 'none'].includes(contact_channel)) patch.contact_channel = contact_channel;
    await o.update(patch, { transaction: t });
    await t.commit();

    // 📣 状态一变就播报 —— 尤其是「已取消」。
    //    以前后台点取消毫无声音，客户跑来问"我的单呢"才发现已经被关掉了。
    //    note 单独改（status 没动）不播报，否则改个备注就刷一条消息。
    if (status !== before) {
      const icon = { '处理中': '🛠️', '已完成': '✅', '已取消': '🚫', '已退款': '💸' }[status] || '🔄';
      const ext = (() => { try { return JSON.parse(o.ext_fields || '{}'); } catch { return {}; } })();
      const tail = status === '已取消'
        ? `\n⚠️ <b>已取消</b> —— 记得确认退款是否已到客户账上`
        : status === '已完成'
          ? `\n🎉 客户可确认收货`
          : '';
      sendTgMessage(
        `${icon} <b>千川订单状态变更</b>\n` +
        `订单号：<code>${o.order_no}</code>\n` +
        `商品：${o.service_name || o.product_name || ''}\n` +
        `数量：${o.quantity}　金额：<b>¥${Number(o.charge).toFixed(2)}</b>\n` +
        `原状态：${before} → 新状态：${status}\n` +
        `客户：${o.phone || o.user_id}\n` +
        (ext.douyin_id ? `抖音号：${ext.douyin_id}\n` : '') +
        (note ? `备注：${String(note).slice(0, 60)}\n` : '') +
        tail
      ).catch((e) => console.error('[boost-admin/status] TG 播报失败:', e && e.message));
    }

    res.json({ status: 'success', data: { id: o.id, status } });
  } catch (e) {
    try { await t.rollback(); } catch {}
    console.error('[boost-admin/status] 失败:', e);
    res.status(500).json({ status: 'error', message: '操作失败' });
  }
});

// ── 退款（复用主站那套幂等退款）──────────────────────────────────────────────
router.post('/orders/:id/refund', authenticate, requireAdmin, async (req, res) => {
  try {
    const o = await Order.findOne({ where: { id: Number(req.params.id), biz_type: 'manual' } });
    if (!o) return res.status(404).json({ status: 'error', message: '订单不存在' });
    if (o.is_refunded) return res.json({ status: 'error', message: '该单已退款，不要重复操作' });

    const r = await refundOrderFully(o.id, { reason: req.body?.reason || '千川业务人工退款' });
    if (!r || r.ok === false) {
      console.error('[boost-admin/refund] 退款失败:', r && r.error);
      return res.json({ status: 'error', message: '退款失败，请查看后端日志' });
    }

    // 📣 退款必须播报 —— 这是直接动钱的操作，事后要有痕迹可查
    if (!r.skipped) {
      sendTgMessage(
        `💸 <b>千川订单已退款</b>\n` +
        `订单号：<code>${o.order_no}</code>\n` +
        `商品：${o.service_name || o.product_name || ''}\n` +
        `数量：${o.quantity}\n` +
        `退款：<b>¥${Number(o.charge).toFixed(2)}</b>（已入客户站内余额）\n` +
        `客户：${o.phone || o.user_id}\n` +
        `当前状态：${o.status}\n` +
        `原因：${req.body?.reason || '人工退款'}\n` +
        `⚠️ 站内余额需客户自行消费，系统不做原路退回`
      ).catch((e) => console.error('[boost-admin/refund] TG 播报失败:', e && e.message));
    }

    res.json({ status: 'success', message: r.skipped ? '该单此前已退款（幂等跳过）' : '已退款' });
  } catch (e) {
    console.error('[boost-admin/refund] 失败:', e);
    res.status(500).json({ status: 'error', message: '退款失败' });
  }
});

// ── 代下单（私域来的客户不会自己注册，运营代客下单，账目仍进系统）────────────
router.post('/orders/manual', authenticate, requireAdmin, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { user_id, product_id, quantity, fields, note } = req.body || {};
    const p = await BoostProduct.findOne({ where: { id: Number(product_id), active: true }, transaction: t });
    if (!p) { await t.rollback(); return res.status(404).json({ status: 'error', message: '商品不存在或已下架' }); }

    const user = await User.findByPk(Number(user_id), { transaction: t });
    if (!user) { await t.rollback(); return res.json({ status: 'error', message: '客户账号不存在' }); }

    const qty = p.pricing_mode === 'flat' ? Number(p.min_qty) : Math.floor(Number(quantity));
    if (!Number.isFinite(qty) || qty <= 0) { await t.rollback(); return res.json({ status: 'error', message: '数量不合法' }); }

    const charge = priceOf(p, qty);
    if (charge === null) { await t.rollback(); return res.json({ status: 'error', message: `最少 ${p.min_qty} 起` }); }

    const ext = {};
    for (const f of parseSchema(p.input_schema)) {
      const v = fields && fields[f.key] != null ? String(fields[f.key]).trim() : '';
      if (v) ext[f.key] = v.slice(0, 2000);
    }

    let balance;
    try {
      balance = await debitUser(user.id, charge, { transaction: t });
    } catch (e) {
      await t.rollback();
      return res.json({
        status: 'error',
        message: e && e.code === 'INSUFFICIENT_BALANCE' ? `客户余额不足，需 ¥${charge.toFixed(2)}（请先给客户充值或调账）` : '扣款失败',
      });
    }

    const orderNo = 'XN' + Date.now() + Math.floor(Math.random() * 100);
    const line = ext.link || ext.douyin_id || ext.account || '(代下单，见备注)';
    const order = await Order.create({
      order_no: orderNo, user_id: user.id, phone: user.phone,
      site_id: 0, upstream_order_id: null, service_id: 0,
      service_name: p.name, link: String(line).slice(0, 2000),
      quantity: qty, charge, upstream_charge: 0,
      status: '待派单', biz_type: 'manual', boost_product_id: p.id,
      ext_fields: JSON.stringify(ext),
      admin_note: `[代下单 by ${req.user.phone || req.user.id}] ${note || ''}`.slice(0, 2000),
    }, { transaction: t });

    await Transaction.create({
      user_id: user.id, phone: user.phone, amount: -charge, balance,
      type: '下单扣款', description: `${p.name} × ${qty}（代下单 ${orderNo}）`, site_id: 0,
    }, { transaction: t });

    await t.commit();
    res.json({ status: 'success', data: { id: order.id, order_no: orderNo, charge } });
  } catch (e) {
    try { await t.rollback(); } catch {}
    console.error('[boost-admin/manual-order] 失败:', e);
    res.status(500).json({ status: 'error', message: '代下单失败' });
  }
});

// ── 商品管理 ──────────────────────────────────────────────────────────────────
router.get('/products', authenticate, requireAdmin, async (req, res) => {
  try {
    const rows = await BoostProduct.findAll({ order: [['sort', 'ASC'], ['id', 'ASC']] });
    res.json({ status: 'success', data: rows.map(fullProduct) });
  } catch (e) {
    console.error('[boost-admin/products] 失败:', e);
    res.status(500).json({ status: 'error', message: '加载失败' });
  }
});

const pickProductFields = async (body, existing) => {
  const f = {};
  const setStr = (k, max) => { if (body[k] != null) f[k] = String(body[k]).slice(0, max); };
  setStr('name', 200); setStr('subtitle', 300); setStr('category', 40);
  setStr('pricing_mode', 20); setStr('unit_label', 20); setStr('eta_text', 100);
  setStr('badge', 40);
  if (body.notice != null) f.notice = String(body.notice).slice(0, 5000);
  if (body.platform != null) f.platform = String(body.platform).slice(0, 30);

  if (body.tiers != null) {
    if (!Array.isArray(body.tiers)) throw new Error('tiers 必须是数组');
    f.tiers = JSON.stringify(parseTiers(JSON.stringify(body.tiers)));
  }
  if (body.input_schema != null) {
    if (!Array.isArray(body.input_schema)) throw new Error('input_schema 必须是数组');
    f.input_schema = JSON.stringify(parseSchema(JSON.stringify(body.input_schema)));
  }
  for (const k of ['unit_qty', 'min_qty', 'max_qty', 'qty_step', 'sort']) {
    if (body[k] != null) f[k] = Math.max(0, Math.floor(Number(body[k])));
  }
  if (body.flat_price != null) f.flat_price = Number(body.flat_price);
  // 成本价也允许手改（对账时修正进价用）
  if (body.cost_flat_price != null) f.cost_flat_price = Number(body.cost_flat_price);
  if (body.cost_tiers != null) {
    if (!Array.isArray(body.cost_tiers)) throw new Error('cost_tiers 必须是数组');
    f.cost_tiers = JSON.stringify(parseTiers(JSON.stringify(body.cost_tiers)));
  }
  if (body.active != null) f.active = !!body.active;

  // 阶梯价必须有值，否则客户侧列表会出现「买不了」的商品
  const mode = f.pricing_mode || (existing && existing.pricing_mode) || 'tier';
  if (mode === 'tier') {
    const tiers = parseTiers(f.tiers != null ? f.tiers : (existing && existing.tiers));
    if (!tiers.length) throw new Error('阶梯价商品至少要有一档');
  }
  return f;
};

router.post('/products', authenticate, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.code || !body.name || !body.category) {
      return res.json({ status: 'error', message: 'code / name / category 必填' });
    }
    const exists = await BoostProduct.findOne({ where: { code: String(body.code).slice(0, 60) } });
    if (exists) return res.json({ status: 'error', message: 'code 已存在' });

    const f = await pickProductFields(body, null);
    const p = await BoostProduct.create({ code: String(body.code).slice(0, 60), ...f });
    res.json({ status: 'success', data: fullProduct(p) });
  } catch (e) {
    console.error('[boost-admin/products POST] 失败:', e);
    res.json({ status: 'error', message: e.message || '创建失败' });
  }
});

router.put('/products/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const p = await BoostProduct.findByPk(Number(req.params.id));
    if (!p) return res.status(404).json({ status: 'error', message: '商品不存在' });
    const f = await pickProductFields(req.body || {}, p);
    await p.update(f);
    res.json({ status: 'success', data: fullProduct(p) });
  } catch (e) {
    console.error('[boost-admin/products PUT] 失败:', e);
    res.json({ status: 'error', message: e.message || '保存失败' });
  }
});

// 下架用软删：已经有历史订单引用它，物理删除会让订单详情失去商品名
router.delete('/products/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const p = await BoostProduct.findByPk(Number(req.params.id));
    if (!p) return res.status(404).json({ status: 'error', message: '商品不存在' });
    await p.update({ active: false });
    res.json({ status: 'success', message: '已下架' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '下架失败' });
  }
});

// ── 客服配置 ──────────────────────────────────────────────────────────────────
const SETTING_KEYS = ['boost_wechat_id', 'boost_wechat_qr', 'boost_tg', 'boost_tg_url', 'boost_service_hint'];

// TG 链接统一由账号推出来，后台不用手填 —— 手填迟早会填成 t.me/xxx 或漏掉 https。
const tgUrlFrom = (tg) => {
  const h = String(tg || '').trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '').replace(/\s+/g, '');
  return h ? 'https://t.me/' + h : '';
};

// ── 图片上传（客服二维码）：支持后台直接粘贴截图 ──────────────────────────────
// 存到 SITE_UPLOAD_DIR/boost，走 /api/boost-img/ 对外访问（理由见 app.js）
const BOOST_IMG_DIR = path.join(process.env.SITE_UPLOAD_DIR || '/var/www/xnow-uploads', 'boost');
try { fs.mkdirSync(BOOST_IMG_DIR, { recursive: true }); } catch (e) { /* 权限问题下一层会报 */ }

const IMG_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };

const imgUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, BOOST_IMG_DIR),
    filename: (req, file, cb) => {
      const ext = IMG_EXT[file.mimetype] || '.png';
      // 只用时间戳+随机，绝不用上传者的文件名（防目录穿越 / 同名覆盖）
      cb(null, `boost_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },   // 二维码截图 3MB 足够
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

router.post('/upload', authenticate, requireAdmin, imgUpload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.json({ status: 'error', message: '没有收到图片（请确认格式是 png / jpg / webp）' });
    res.json({ status: 'success', message: '已上传', data: { url: '/api/boost-img/' + req.file.filename } });
  } catch (e) {
    console.error('[boost-admin/upload] 失败:', e);
    res.status(500).json({ status: 'error', message: '上传失败' });
  }
});

router.get('/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const rows = await Config.findAll({ where: { key: SETTING_KEYS } });
    const m = {};
    for (const r of rows) m[r.key] = r.value;
    res.json({ status: 'success', data: m });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '加载失败' });
  }
});

router.put('/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    // 🔴 防误清：真实事故（2026-11-04）—— 后台切到「客服设置」时没去读配置，
    //    表单是空白的，运营以为"没保存"又点了一次保存，差点把微信号/二维码/TG 全清掉。
    //    全空提交一律拒绝；要清空某个字段请单独清，别整表清。
    const allEmpty = SETTING_KEYS.every((k) => body[k] == null || String(body[k]).trim() === '');
    if (allEmpty) {
      return res.status(400).json({ status: 'error', message: '提交的配置全是空的，已拒绝（防止误清空）' });
    }
    // TG 账号一填，链接自动生成；账号清空，链接跟着清空（不给残留旧链接）
    if (body.boost_tg != null) body.boost_tg_url = tgUrlFrom(body.boost_tg);
    for (const k of SETTING_KEYS) {
      if (body[k] == null) continue;
      const v = String(body[k]).slice(0, 2000);
      const [row, created] = await Config.findOrCreate({ where: { key: k }, defaults: { key: k, value: v } });
      if (!created && row.value !== v) await row.update({ value: v });
    }
    res.json({ status: 'success', message: '已保存', data: { tg_url: tgUrlFrom(body.boost_tg) } });
  } catch (e) {
    console.error('[boost-admin/settings] 失败:', e);
    res.status(500).json({ status: 'error', message: '保存失败' });
  }
});

export default router;
