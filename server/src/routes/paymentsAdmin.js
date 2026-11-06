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
// 单号幂等匹配统一走 payOrder.js：`_` 在 LIKE 里是通配符，裸拼会串单（详见该文件注释）
import { payOrderDescriptionLike } from '../utils/payOrder.js';
import { sendTgMessage } from '../utils/tgBot.js';
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
  failed: '已关闭',
};

// 历史记录里存的是英文原始状态码（callback timeout 之类），给前端翻成中文。
// 新单从 2026-11-04 起直接写中文失败原因，这一段只是兜住旧数据。
const LEGACY_REASON_ZH = {
  'callback timeout': '用户未付款（超时未完成支付）',
  'cryptomus:cancel': '用户在支付页取消了付款',
  'cryptomus:fail': '支付失败（用户银行卡/余额不足或被拒绝）',
  'cryptomus:system_fail': '支付系统故障，交易未完成（网关侧问题）',
  'cryptomus:refund_fail': '退款失败，需人工处理',
  'cryptomus 1h 未支付': '用户未付款（USDT 发票 1 小时过期）',
  'too old (7d)': '超过 7 天未付款，自动关闭',
  'over max retry': '多次查证均未确认付款，已关闭',
};

export function reasonZh(raw) {
  if (!raw) return '';
  if (LEGACY_REASON_ZH[raw]) return LEGACY_REASON_ZH[raw];
  if (raw.startsWith('cryptomus:')) return '支付未完成（' + raw.slice(10) + '）';
  return raw;
}

// 这笔单号的流水是否已经存在（有流水 = 钱其实到账了，只是记录没标完成）
async function isCredited(orderId) {
  try {
    const row = await Transaction.findOne({
      attributes: ['id'],
      // 转义 LIKE 通配符：`BUF_1723_9.9_x` 里的 `_` 会匹配任意字符 → 误判"已入账"，
      // 这笔就永远被标完成、再也不会补单（等于吞掉用户已付的钱）。
      where: { description: payOrderDescriptionLike(orderId) },
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
        fail_reason: reasonZh(p.fail_reason || ''),
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
      return res.json({ status: 'error', message: '查证失败：' + (e.message || '未知错误') });
    }
    // 🔴 对「已关闭」的单点重新查证，如果还是查不到付款，必须退回「已关闭」。
    //    否则 markProcessing 会把它拖回队列，30 分钟后被自动判死一次 ——
    //    白折腾一轮，还会把原来的失败原因冲掉。
    const wasClosed = pay.status === 'failed';
    if (wasClosed && result.state !== 'done' && result.state !== 'error') {
      markFailed(orderId, pay.fail_reason || '用户未付款（超时未完成支付）');
    }
    await audit(req, 'payment_recheck', orderId, { result: result.state, paid: !!result.paid });

    // 点「重新查证」后要给一句人话，说清楚到底查出了什么
    let msg = result.note;
    if (!msg) {
      if (result.noAoid) msg = '这单没有留下支付平台单号，无法向网关查证。请到 BufPay / Cryptomus 后台按时间金额核对。';
      else if (result.queryErr) msg = '向支付网关查证时出错（网关无响应），暂时无法确认。稍后再试或去网关后台核对。';
      else if (result.state === 'done') msg = '已确认付款并完成入账。';
      else if (result.queryStatus === 'payed') msg = '网关显示已付款但尚未回调，正在补账。';
      else if (result.queryStatus === 'fee_error') msg = '网关显示我方手续费余额不足，订单被卡住。请先充值手续费再重查。';
      else if (result.queryStatus === 'expire') msg = '支付码已过期，用户没有完成付款。';
      else if (result.queryStatus === 'not_exist') msg = '网关查不到这个订单号，可能是废弃记录。';
      else msg = '网关仍未显示已付款 —— 用户还在支付中，或最终没有付款。';
    }

    res.json({
      status: 'success',
      message: msg,
      result: {
        state: result.state,
        paid: !!result.paid,
        // 网关原始报错只给短摘要，完整堆栈不进响应
        gateway_error: result.queryErr ? String(result.queryErr.message || result.queryErr).slice(0, 120) : '',
      },
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '重查失败：' + (e.message || '未知错误') });
  }
});

// ── 人间判死（确认这笔不会再有转机）──────────────────────────────────────────
router.post('/dismiss', authenticate, async (req, res) => {
  if (!guard(req, res)) return;
  const orderId = String(req.body?.order_id || '').trim();
  const reason = String(req.body?.reason || '').trim().slice(0, 60) || '人工关闭';
  if (!orderId) return res.json({ status: 'error', message: '缺少单号' });
  try {
    const pay = getPendingPayments().find((p) => p.order_id === orderId);
    if (!pay) return res.json({ status: 'error', message: '队列里没有这个单号（可能已被清理）' });
    markFailed(orderId, reason);
    await audit(req, 'payment_dismiss', orderId, { reason });
    // 📣 人工关单留痕：谁在什么时候把一单关掉了，事后要有据可查
    sendTgMessage(
      `🚫 <b>补单已人工关闭</b>\n` +
      `单号：<code>${orderId}</code>\n` +
      `用户：${pay.user_id}\n` +
      `金额：¥${Number(pay.amount || 0).toFixed(2)}（${pay.pay_type || '充值'}）\n` +
      `原因：${reason}\n` +
      `操作人：${req.user?.phone || req.user?.id || 'admin'}`
    ).catch(() => {});
    res.json({ status: 'success', message: '已关闭：' + reason });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '关闭失败：' + (e.message || '未知错误') });
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
        markFailed(p.order_id, '超过 7 天未付款，自动关闭');
        aged++;
      }
    }
    cleanOldPayments();
    const left = getPendingPayments().length;
    await audit(req, 'payment_clean', 'queue', { aged, left });
    // 📣 批量清理也要留痕，否则队列里的老单「怎么没了」没人说得清
    if (aged > 0) {
      sendTgMessage(`🧹 <b>补单队列批量清理</b>\n关闭 ${aged} 条超过 7 天的未付款单\n队列剩余：${left} 条\n操作人：${req.user?.phone || req.user?.id || 'admin'}`).catch(() => {});
    }
    res.json({ status: 'success', message: `已关闭 ${aged} 条超过 7 天的老单，队列剩余 ${left} 条`, data: { aged, left } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '清理失败：' + (e.message || '未知错误') });
  }
});

export default router;
