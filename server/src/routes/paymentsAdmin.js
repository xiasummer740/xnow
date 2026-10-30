// ============================================================================
// 💳 密室 · 补单队列（待付款 / 补单记录）
// ----------------------------------------------------------------------------
// 为什么要有这个页面：补单队列存在 server/data/pending_payments.json 里，后台每 2 分钟
// 自动查一次，但**从来没有界面** —— 客户说「我付了钱没到账」时，只能 ssh 上去看文件。
// 这个页面把那份文件摊开，并且能当场重查 / 判死。
//
// 🔒 三条纪律
//   1. 只有管理员能进（authenticate + 角色白名单）
//   2. 「立即重查」走的是补单引擎**同一份**逻辑（pay.js 的 reconcileOne），不另写一套 ——
//      钱的事两套口径迟早跑偏
//   3. 不提供「手动入账」按钮：真要补钱走后台调账。手动入账点错一次就是记错一笔钱。
// ============================================================================
import express from 'express';
import { sequelize, Transaction, User, AuditLog } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { getPendingPayments, markFailed, markProcessing, cleanOldPayments } from '../utils/paymentTracker.js';
import { reconcileOne } from './pay.js';

const router = express.Router();
const STAFF = ['admin', 'super_admin'];

const guard = (req, res) => {
  if (!STAFF.includes(req.user?.role)) {
    res.status(403).json({ status: 'error', message: '权限不足' });
    return false;
  }
  return true;
};

async function audit(req, action, targetId, details = {}) {
  try {
    await AuditLog.create({
      admin_id: req.user.id,
      admin_phone: req.user.phone || '',
      action, target_type: 'payment', target_id: String(targetId || ''),
      details: JSON.stringify(details), ip_address: req.ip || '',
    });
  } catch (e) { /* 审计失败不影响主流程 */ }
}

const STATUS_TEXT = {
  pending: '待查证',
  processing: '查证中',
  completed: '已入账',
  failed: '已判死',
};

// 这笔单号的流水是否已经存在（有流水 = 钱其实到账了，只是记录没标完成）
async function isCredited(orderId) {
  try {
    const row = await Transaction.findOne({
      attributes: ['id'],
      where: { description: { [sequelize.Sequelize.Op.like]: '%' + orderId + '%' } },
    });
    return !!row;
  } catch (e) { return false; }
}

// ── 列表 ────────────────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const list = getPendingPayments();
    const now = Date.now();

    const uids = [...new Set(list.map((p) => Number(p.user_id)).filter((n) => n > 0))];
    const users = uids.length
      ? await User.findAll({ where: { id: uids }, attributes: ['id', 'phone'] })
      : [];
    const phoneOf = new Map(users.map((u) => [Number(u.id), u.phone]));

    const items = [];
    for (const p of list) {
      const created = new Date(p.created_at).getTime();
      const last = p.last_check ? new Date(p.last_check).getTime() : 0;
      items.push({
        order_id: p.order_id,
        user_id: Number(p.user_id || 0),
        phone: phoneOf.get(Number(p.user_id)) || '',
        amount: Number(p.amount || 0),
        pay_type: p.pay_type || '',
        pay_text: p.pay_type === 'USDT' ? 'USDT' : (p.pay_type === 'alipay' ? '支付宝' : '微信'),
        status: p.status,
        status_text: STATUS_TEXT[p.status] || p.status,
        created_at: p.created_at || null,
        age_min: Number.isFinite(created) ? Math.floor((now - created) / 60000) : null,
        last_check: p.last_check || null,
        last_min: last ? Math.floor((now - last) / 60000) : null,
        retry_count: Number(p.retry_count || 0),
        fail_reason: p.fail_reason || '',
        // 队列说没完成，但流水里已经有这单 → 其实就是到账了
        credited: await isCredited(p.order_id),
      });
    }
    // 还没结束的排前面，再按发起时间倒序
    const open = (s) => s === 'pending' || s === 'processing';
    items.sort((a, b) => {
      const ao = open(a.status) ? 0 : 1; const bo = open(b.status) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });

    res.json({
      status: 'success',
      data: {
        items,
        summary: {
          total: items.length,
          open: items.filter((i) => open(i.status)).length,
          failed: items.filter((i) => i.status === 'failed').length,
          completed: items.filter((i) => i.status === 'completed').length,
          // 队列没标完成、但流水里已有 → 需要人工看一眼
          suspicious: items.filter((i) => open(i.status) && i.credited).length,
        },
      },
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '读取补单队列失败: ' + e.message });
  }
});

// ── 立即重查（走补单引擎同一份逻辑；网关确认已付就会真的入账）────────────────
router.post('/recheck', authenticate, async (req, res) => {
  if (!guard(req, res)) return;
  const orderId = String(req.body?.order_id || '').trim();
  if (!orderId) return res.json({ status: 'error', message: '缺少单号' });
  try {
    const pay = getPendingPayments().find((p) => p.order_id === orderId);
    if (!pay) return res.json({ status: 'error', message: '队列里没有这个单号（可能已被清理）' });

    markProcessing(orderId);
    let result;
    try {
      result = await reconcileOne(pay);
    } catch (e) {
      return res.json({ status: 'error', message: '查证失败: ' + e.message });
    }
    await audit(req, 'payment_recheck', orderId, { result: result.state, paid: !!result.paid });
    // 只回必要字段：AxiosError 整条塞进响应又长又难看，前端只要一句人话
    res.json({
      status: 'success',
      message: result.note || (result.state === 'done' ? '已处理' : '网关未显示已支付'),
      result: {
        state: result.state,
        paid: !!result.paid,
        gateway_error: result.queryErr ? String(result.queryErr.message || result.queryErr).slice(0, 120) : '',
      },
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '重查失败: ' + e.message });
  }
});

// ── 人间判死（确认这笔不会再有转机）──────────────────────────────────────────
router.post('/dismiss', authenticate, async (req, res) => {
  if (!guard(req, res)) return;
  const orderId = String(req.body?.order_id || '').trim();
  const reason = String(req.body?.reason || '').trim().slice(0, 60) || '人工判死';
  if (!orderId) return res.json({ status: 'error', message: '缺少单号' });
  try {
    const pay = getPendingPayments().find((p) => p.order_id === orderId);
    if (!pay) return res.json({ status: 'error', message: '队列里没有这个单号（可能已被清理）' });
    markFailed(orderId, reason);
    await audit(req, 'payment_dismiss', orderId, { reason });
    res.json({ status: 'success', message: '已判死：' + reason });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '判死失败: ' + e.message });
  }
});

// ── 一键清理（7 天前的老单判死 + 清掉过期记录）─────────────────────────────
router.post('/clean', authenticate, async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const now = Date.now();
    let aged = 0;
    for (const p of getPendingPayments()) {
      if (p.status !== 'pending' && p.status !== 'processing') continue;
      if (now - new Date(p.created_at).getTime() > 7 * 24 * 60 * 60 * 1000) {
        markFailed(p.order_id, 'too old (7d)');
        aged++;
      }
    }
    cleanOldPayments();
    const left = getPendingPayments().length;
    await audit(req, 'payment_clean', 'queue', { aged, left });
    res.json({ status: 'success', message: `已判死 ${aged} 条老单，队列剩 ${left} 条`, data: { aged, left } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '清理失败: ' + e.message });
  }
});

export default router;
