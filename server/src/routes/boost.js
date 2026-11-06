import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { sequelize, Order, Transaction, User, BoostProduct, Config } from '../models/index.js';
import { debitUser, getBalance } from '../utils/balance.js';
import { sendTgMessage } from '../utils/tgBot.js';

// ============================================================================
// 🎯 千川流量业务（2026-11-04）
//
// 与现有「转售上游 API」最大的区别：**这条路完全不碰上游**。
//   · 商品在本地表 boost_products 里，由后台维护，不受 AutoSync 影响
//   · 下单只做三件事：算价 → 扣余额 → 落一条 biz_type='manual' 的订单
//   · 履约是人工的：运营在后台看到「待派单」，复制客户信息去千川后台操作，
//     完成后在后台点「已完成」
//
// 🔴 状态机的红线：manual 单只用 待派单 / 处理中 / 已完成 / 已退款 / 已取消。
//    **绝不能用 '提交中'** —— orderSync 的 sweepStuckSubmitting 会把超 10 分钟
//    仍无 upstream_order_id 的 '提交中' 单当成卡死自动全额退款，
//    而人工派单本来就永远拿不到上游单号。
//
// 💰 成本口径：人工业务没有 API 回报的上游成本，upstream_charge 恒为 0。
//    后台任何「毛利」统计都必须 `WHERE biz_type <> 'manual'`，否则千川单会被算成 100% 毛利。
// ============================================================================

const router = express.Router();

// 分类码 → 客户可见名称（tab 文案）。分类码是稳定的，改文案只改这里。
const CATEGORY_LABEL = {
  play: '普通播放',
  marketing: '营销播放',
  natural: '自然流播放',
  like: '千川点赞',
  scan: '扫码',
  fans: '涨粉',
  liveview: '场观',
  account: '视频号涨粉',
};

const buyLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 3,
  keyGenerator: (req) => String(req.user?.id || 'anon'),
  message: { status: 'error', message: '操作太频繁，请 10 秒后再试' }
});

// ── 计价 ──────────────────────────────────────────────────────────────────────
// tiers 只写 min（不写 max），语义 = 「下单量 ≥ min 就整单享受该档单价」，
// 取满足条件的**最大 min**。好处是没有空档：买 2.5 万落在 {min:10000} 档。
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

/** 权威算价（后端唯一口径；前端算的只是预览，下单时一律用这个函数重算） */
const priceOf = (product, qty) => {
  if (product.pricing_mode === 'flat') return Number(Number(product.flat_price || 0).toFixed(6));
  const tiers = parseTiers(product.tiers);
  let best = null;
  for (const t of tiers) {
    if (qty >= t.min && (!best || t.min > best.min)) best = t;
  }
  if (!best) return null;                       // 低于最低档 → 买不了
  const unitQty = Number(product.unit_qty) || 10000;
  return Number(((qty / unitQty) * best.price).toFixed(6));
};

/** 当前单价（元/unit_qty），用于前端展示「¥8/万」 */
const unitPriceOf = (product, qty) => {
  if (product.pricing_mode === 'flat') return null;
  const tiers = parseTiers(product.tiers);
  let best = null;
  for (const t of tiers) {
    if (qty >= t.min && (!best || t.min > best.min)) best = t;
  }
  return best ? best.price : null;
};

/** 对外暴露的商品结构（客户侧，绝不带任何内部字段） */
const pubProduct = (p) => ({
  id: p.id,
  code: p.code,
  name: p.name,
  subtitle: p.subtitle,
  category: p.category,
  // 平台归属：抖音 / 视频号。前端靠它把两条业务线分开渲染，漏了就会被全判成抖音。
  platform: p.platform || 'douyin',
  pricing_mode: p.pricing_mode,
  unit_qty: p.unit_qty,
  unit_label: p.unit_label,
  // 阶梯表也给前端，用来画「买得多单价低」的对比，但只给换算好的展示值
  tiers: parseTiers(p.tiers).map((t) => ({
    min: t.min,
    price: t.price,
    total: Number(((t.min / (p.unit_qty || 10000)) * t.price).toFixed(2)),
  })),
  flat_price: Number(p.flat_price || 0),
  min_qty: p.min_qty,
  max_qty: p.max_qty,
  qty_step: p.qty_step,
  input_schema: parseSchema(p.input_schema),
  eta_text: p.eta_text,
  notice: p.notice,
  badge: p.badge,
});

// ── 目录 ──────────────────────────────────────────────────────────────────────
// 公开：这是营销页，登录前要能看到商品和价格（转化漏斗的入口）
router.get('/catalog', async (req, res) => {
  try {
    const rows = await BoostProduct.findAll({
      where: { active: true },
      order: [['sort', 'ASC'], ['id', 'ASC']],
    });
    const products = rows.map(pubProduct);

    // 分类按数据里实际出现的顺序聚合，前端直接渲染 tab
    // 🔴 带 platform 一起返回：抖音和视频号是两套完全不同的业务，
    //    前端必须能按平台分段，否则客户会把「视频号涨粉」当成抖音的业务。
    const catMap = new Map();
    for (const p of products) {
      if (!catMap.has(p.category)) {
        catMap.set(p.category, {
          key: p.category,
          platform: p.platform || 'douyin',
          count: 0,
          // 取该分类第一个商品名的「·」后部分做 tab 名太脆，这里用分类码映射
          label: CATEGORY_LABEL[p.category] || p.category,
          items: [],
        });
      }
      const c = catMap.get(p.category);
      c.count += 1;
      c.items.push(p);
    }

    const categories = [...catMap.values()];
    // 平台顺序固定：抖音优先，视频号收尾
    categories.sort((a, b) => {
      const rank = (x) => (x.platform === 'wechat' ? 1 : 0);
      return rank(a) - rank(b);
    });

    res.json({ status: 'success', data: { categories, total: products.length } });
  } catch (e) {
    console.error('[boost/catalog] 失败:', e);
    res.status(500).json({ status: 'error', message: '商品加载失败，请稍后重试' });
  }
});

// ── 客服联系方式（后台可改，前端不写死微信号）────────────────────────────────
router.get('/customer', async (req, res) => {
  try {
    const rows = await Config.findAll({
      where: { key: ['boost_wechat_id', 'boost_wechat_qr', 'boost_tg', 'boost_tg_url', 'boost_service_hint'] },
    });
    const m = {};
    for (const r of rows) m[r.key] = r.value;
    res.json({
      status: 'success',
      data: {
        wechat_id: m.boost_wechat_id || '',
        wechat_qr: m.boost_wechat_qr || '',
        tg: m.boost_tg || '',
        tg_url: m.boost_tg_url || '',
        hint: m.boost_service_hint || '下单后请添加客服确认链接，客服 24 小时在线',
      },
    });
  } catch (e) {
    res.json({ status: 'success', data: { wechat_id: '', wechat_qr: '', tg: '', tg_url: '', hint: '' } });
  }
});

// ── 试算（前端预览用；下单时后端会用同一函数重算，前端算错不影响金额）──────
router.post('/quote', async (req, res) => {
  try {
    const { product_id, quantity } = req.body || {};
    const p = await BoostProduct.findOne({ where: { id: Number(product_id), active: true } });
    if (!p) return res.status(404).json({ status: 'error', message: '商品不存在或已下架' });

    const qty = p.pricing_mode === 'flat' ? Number(p.min_qty) : Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return res.json({ status: 'error', message: '数量不合法' });
    if (qty < Number(p.min_qty)) return res.json({ status: 'error', message: `最少 ${p.min_qty} 起` });

    const price = priceOf(p, qty);
    if (price === null) return res.json({ status: 'error', message: `最少 ${p.min_qty} 起` });
    res.json({ status: 'success', data: { quantity: qty, charge: price, unit_price: unitPriceOf(p, qty) } });
  } catch (e) {
    console.error('[boost/quote] 失败:', e);
    res.status(500).json({ status: 'error', message: '试算失败' });
  }
});

// ── 下单 ──────────────────────────────────────────────────────────────────────
router.post('/order', authenticate, buyLimiter, async (req, res) => {
  const { product_id, quantity, fields } = req.body || {};
  const t = await sequelize.transaction();
  try {
    const p = await BoostProduct.findOne({ where: { id: Number(product_id), active: true }, transaction: t });
    if (!p) {
      await t.rollback();
      return res.status(404).json({ status: 'error', message: '商品不存在或已下架' });
    }

    // flat 商品数量由商品定义（如「1000 包 500 有效」），客户不能改
    const qty = p.pricing_mode === 'flat' ? Number(p.min_qty) : Math.floor(Number(quantity));
    if (!Number.isFinite(qty) || qty <= 0) {
      await t.rollback();
      return res.json({ status: 'error', message: '数量不合法' });
    }
    if (p.pricing_mode !== 'flat') {
      if (qty < Number(p.min_qty)) {
        await t.rollback();
        return res.json({ status: 'error', message: `该商品最少 ${p.min_qty} 起` });
      }
      if (qty > Number(p.max_qty)) {
        await t.rollback();
        return res.json({ status: 'error', message: `单笔最多 ${p.max_qty}，需要更多请分批下单` });
      }
    }

    // 动态字段校验（必须按 input_schema 来，不能用固定字段名）
    const schema = parseSchema(p.input_schema);
    const ext = {};
    for (const f of schema) {
      const v = fields && fields[f.key] != null ? String(fields[f.key]).trim() : '';
      if (f.required && !v) {
        await t.rollback();
        return res.json({ status: 'error', message: `请填写${f.label || f.key}` });
      }
      // 🔴 格式校验：运营拿到单子必须能直接开跑。
      //    以前只判必填，客户填「123」「随便」也能下单，最后投不出去只能退款。
      if (v && f.pattern) {
        let re;
        try { re = new RegExp(f.pattern, 'i'); } catch { re = null; }
        if (re) {
          const vals = f.multiple ? v.split(/[\s,，]+/).filter(Boolean) : [v];
          const bad = vals.find((x) => !re.test(x));
          if (bad) {
            await t.rollback();
            return res.json({
              status: 'error',
              message: f.patternHint || `${f.label || f.key} 格式不正确，请检查后重新填写`,
              data: { field: f.key, bad_value: bad.slice(0, 80) },
            });
          }
        }
      }
      if (v) ext[f.key] = v.slice(0, 2000);
    }

    const charge = priceOf(p, qty);
    if (charge === null) {
      await t.rollback();
      return res.json({ status: 'error', message: `该商品最少 ${p.min_qty} 起` });
    }

    // 扣款（原子自减，绝不到负数）
    let balance;
    try {
      balance = await debitUser(req.user.id, charge, { transaction: t });
    } catch (e) {
      await t.rollback();
      const need = charge.toFixed(2);
      const cur = Number(await getBalance(req.user.id)).toFixed(2);
      return res.json({
        status: 'error',
        message: e && e.code === 'INSUFFICIENT_BALANCE'
          ? `余额不足，需 ¥${need}，当前 ¥${cur}，请先充值`
          : '扣款失败，请稍后重试',
      });
    }

    const orderNo = 'XN' + Date.now() + Math.floor(Math.random() * 100);
    const line = ext.link || ext.douyin_id || ext.account || '(见备注)';

    const order = await Order.create({
      order_no: orderNo,
      user_id: req.user.id,
      phone: req.user.phone,
      site_id: req.site ? req.site.id : 0,
      upstream_order_id: null,          // 人工派单：永远没有上游单号
      service_id: 0,
      service_name: p.name,
      link: String(line).slice(0, 2000),
      quantity: qty,
      charge,
      upstream_charge: 0,               // 人工业务无 API 成本，见文件头「成本口径」
      status: '待派单',                  // 🔴 不是「提交中」，否则会被 sweepStuckSubmitting 退款
      biz_type: 'manual',
      boost_product_id: p.id,
      ext_fields: JSON.stringify(ext),
      admin_note: '',
    }, { transaction: t });

    await Transaction.create({
      user_id: req.user.id,
      phone: req.user.phone,
      amount: -charge,
      balance,
      type: '下单扣款',
      description: `${p.name} × ${qty}（订单 ${orderNo}）`,
      site_id: req.site ? req.site.id : 0,
    }, { transaction: t });

    await t.commit();

    // 通知运营（失败不影响下单，用户的钱已经扣成功、单也已经落库）
    try {
      await sendTgMessage(
        `🎯 <b>千川新单（待派单）</b>\n` +
        `订单号：<code>${orderNo}</code>\n` +
        `商品：${p.name}\n` +
        `数量：${qty}　金额：<b>¥${charge.toFixed(2)}</b>\n` +
        `余额：¥${Number(balance).toFixed(2)}（扣费后）\n` +
        `客户：${req.user.phone || req.user.id}\n` +
        Object.entries(ext).map(([k, v]) => `${k}: ${v}`).join('\n') +
        `\n👉 请尽快联系客户确认链接`
      );
    } catch (e) { console.error('[boost/order] TG 通知失败（不影响订单）:', e && e.message); }

    res.json({
      status: 'success',
      message: '下单成功',
      data: {
        id: order.id,
        order_no: orderNo,
        product_name: p.name,
        quantity: qty,
        charge,
        status: '待派单',
        balance,
      },
    });
  } catch (e) {
    try { await t.rollback(); } catch {}
    console.error('[boost/order] 失败:', e);
    res.status(500).json({ status: 'error', message: '下单失败，请稍后重试' });
  }
});

// ── 我的千川订单 ──────────────────────────────────────────────────────────────
router.get('/orders', authenticate, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const rows = await Order.findAll({
      where: { user_id: req.user.id, biz_type: 'manual' },
      order: [['id', 'DESC']],
      limit,
    });
    res.json({
      status: 'success',
      data: rows.map((o) => ({
        id: o.id,
        order_no: o.order_no,
        product_name: o.service_name,
        quantity: o.quantity,
        charge: o.charge,
        status: o.status,
        contact_channel: o.contact_channel,
        ext_fields: (() => { try { return JSON.parse(o.ext_fields || '{}'); } catch { return {}; } })(),
        admin_note: o.admin_note,
        created_at: o.createdAt,
      })),
    });
  } catch (e) {
    console.error('[boost/orders] 失败:', e);
    res.status(500).json({ status: 'error', message: '加载失败' });
  }
});

// ── 客户标记「已加客服」──────────────────────────────────────────────────────
// 只让客户确认渠道，不改任何履约状态（履约状态只能由运营推进）
router.post('/orders/:id/contact', authenticate, async (req, res) => {
  try {
    const channel = ['wechat', 'tg', 'none'].includes(req.body?.channel) ? req.body.channel : 'none';
    const o = await Order.findOne({ where: { id: Number(req.params.id), user_id: req.user.id, biz_type: 'manual' } });
    if (!o) return res.status(404).json({ status: 'error', message: '订单不存在' });
    await o.update({ contact_channel: channel });
    res.json({ status: 'success', data: { channel } });
  } catch (e) {
    console.error('[boost/orders/contact] 失败:', e);
    res.status(500).json({ status: 'error', message: '操作失败' });
  }
});

export default router;
