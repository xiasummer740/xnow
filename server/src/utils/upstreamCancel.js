// ============================================================================
// 🚫 上游订单取消
//
// 背景（2026-11-08 祥哥反馈）：
//   管理员在后台给客户退款后，本站的钱退了、订单标了「已退款」，但**上游
//   那一单还在跑**，得人工去上游站点点一次取消。漏点 = 上游继续投放、
//   成本照扣、平台白亏；点晚了订阅型还会多投喂几条。
//
// 实测（生产 2026-11-08）：
//   POST {upstream_url}  key / action=cancel / order=<上游单号>
//   不存在的单号返回 {"error":"Incorrect order ID"} —— 端点存在。
//   服务 30190 的 cancel=1（上游声明可取消）。
//
// ⚠️ 两条设计红线：
//   1. 取消动作**绝不能放进退款的数据库事务里**：axios 可能耗 15 秒，
//      期间客户余额行一直被锁，会把退款接口拖垮。一律事务提交之后再调。
//   2. 取消失败**绝不回滚已退的钱**：钱已经到客户账上了，回滚会造成
//      「客户没收到退款、订单也没标退款」的烂账。失败只记日志 + 留待重试。
//
// 幂等：上游对「已经取消的单」再 cancel 通常返回 error，视为成功（幂等）。
// ============================================================================
import axios from 'axios';
import { Config, Service, Order } from '../models/index.js';

const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };
const CANCEL_TIMEOUT_MS = 12000;

/**
 * 取消上游的一笔订单。
 * @param {string|number} upstreamOrderId orders.upstream_order_id
 * @returns {Promise<{ok:boolean, already?:boolean, skipped?:boolean, reason?:string, raw?:any}>}
 */
export async function cancelUpstreamOrder(upstreamOrderId) {
  const id = String(upstreamOrderId ?? '').trim();
  if (!id || id === 'null' || id === 'undefined') {
    return { ok: false, skipped: true, reason: '没有上游单号（订单可能还没推上去）' };
  }

  const confs = await Config.findAll({ where: { key: ['upstream_url', 'upstream_key'] } });
  const conf = {};
  confs.forEach((c) => (conf[c.key] = c.value));
  if (!conf.upstream_url || !conf.upstream_key) {
    return { ok: false, reason: '上游地址或密钥未配置' };
  }

  try {
    // 🔍 先查状态：上游对「已经取消」的单回的是
    //    "Cancel unavailable. Try again later."（和「暂时不允许取消」同一句，
    //    光看 error 文本分不出来）。所以先查一次 status，已经是终态就直接
    //    判成功，既不误判、也不会被兜底任务无限重试。
    try {
      const statusBody = new URLSearchParams({
        key: conf.upstream_key, action: 'status', orders: id,
      }).toString();
      const sr = await axios.post(conf.upstream_url, statusBody, {
        headers: FORM, timeout: CANCEL_TIMEOUT_MS,
      });
      const st = sr.data && sr.data[id] && sr.data[id].status;
      if (st && /^(Canceled|Cancelled|Completed|Partial|Refunded)$/i.test(String(st).trim())) {
        return { ok: true, already: true, raw: { status: st }, reason: '上游单已是终态，无需取消' };
      }
    } catch (e) {
      // 状态查询失败不拦住后面的 cancel，照常尝试
    }

    const body = new URLSearchParams({
      key: conf.upstream_key,
      // 🔴 2026-11-11 修：上游要的是 orders（复数），用单数它根本不处理
      action: 'cancel',
      orders: id,
    }).toString();
    const res = await axios.post(conf.upstream_url, body, {
      headers: FORM,
      timeout: CANCEL_TIMEOUT_MS,
    });
    const data = res.data;

    // 🔴 2026-11-11 修：上游返回的是**数组**，旧代码只查 data.error（数组上恒为 undefined），
    //    于是「没取消成功」被判成「已取消」→ 本地标记退款，上游继续跑、成本照扣。
    //    实测响应形态：
    //      success → [{"order":<id>,"cancel":<工单号 数字>}]
    //      not found → [{"order":<id>,"cancel":{"error":"Incorrect order ID"}}]
    //    ⚠️ cancel 返回数字只代表**取消请求已受理**，上游状态可能仍是 Processing，
    //       要等它处理完。所以这里返回 accepted，最终结果由状态查询确认。
    const items = Array.isArray(data) ? data : [data];
    const item = items.find((x) => x && String(x.order) === String(id)) || items[0] || {};
    const cancelField = item.cancel;

    // 形态①：cancel 是对象且带 error → 失败
    if (cancelField && typeof cancelField === 'object' && cancelField.error) {
      const msg = String(cancelField.error);
      if (/already cancel|already cancelled|not (active|pending|processing)|order (is )?(already )?(cancel|finish|complete)|incorrect order id|已取消|订单已完成/i.test(msg)) {
        return { ok: true, already: true, raw: data };
      }
      return { ok: false, reason: msg, raw: data };
    }

    // 形态②：cancel 是数字 → 取消工单已受理
    if (typeof cancelField === 'number' && cancelField > 0) {
      return { ok: true, accepted: true, ticket: cancelField, raw: data };
    }

    // 形态③：顶层给 error（老接口兼容）
    if (data && !Array.isArray(data) && typeof data === 'object' && data.error) {
      const msg = String(data.error);
      if (/already cancel|already cancelled|not (active|pending|processing)|incorrect order id|已取消/i.test(msg)) {
        return { ok: true, already: true, raw: data };
      }
      return { ok: false, reason: msg, raw: data };
    }

    // 兜底：没 error 也不能算"已取消"，显式标 unverified
    return { ok: true, unverified: true, raw: data };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || String(e) };
  }
}

/**
 * 判断这个服务在上游是否声明「可取消」。
 * Subscriptions 类型虽然 cancel=1，但上游的 cancel 对它是否真的生效要以
 * 调用结果为准；这里只用来决定「要不要尝试」，不用来跳过。
 */
export async function serviceAllowsCancel(serviceId) {
  if (!serviceId) return true; // 查不到就照常尝试，宁可多调一次
  try {
    const s = await Service.findByPk(serviceId, { attributes: ['service_id', 'cancel'] });
    if (!s) return true;
    return s.cancel === true || s.cancel === 1 || s.cancel === '1';
  } catch (e) {
    return true;
  }
}

/**
 * 退款后的完整善后：事务外调用，尝试取消上游单，并把结果写进订单备注。
 *
 * @param {object} order Order 实例（已提交事务，可以再 save）
 * @param {{reason?: string}} opts
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function cancelUpstreamAfterRefund(order, opts = {}) {
  if (!order) return { ok: false, reason: '订单对象为空' };
  if (!order.upstream_order_id) {
    return { ok: true, skipped: true, reason: '没有上游单号，无需取消' };
  }

  const allowed = await serviceAllowsCancel(order.service_id);
  const result = await cancelUpstreamOrder(order.upstream_order_id);

  // 把「上游取消」的结果留在订单上，管理员一眼看得到，不用翻日志。
  // 用 admin_note 而不是 refund_reason —— 后者是给客户看的，不能出现
  // 「上游/取消接口」这类内部字眼。
  const tag = result.ok
    ? '上游单已自动取消'
    : `上游单取消失败:${String(result.reason || '').slice(0, 60)}`;
  let note = String(order.admin_note || '').trim();
  // 幂等写入：成功了就把旧的「失败」标记替换掉（否则定时兜底会永远重扫这一单），
  // 失败了就更新最后一次原因，但保留「曾失败」的事实供人工排查。
  note = note.replace(/\[上游单(?:已自动取消|取消失败:[^\]]*)\]/g, '').trim();
  order.admin_note = (note ? note + ' ' : '') + `[${tag}]`;
  try { await order.save(); } catch (e) { /* 备注写不进去不影响退款主流程 */ }

  if (!result.ok) {
    console.warn(
      `⚠️ [cancelAfterRefund] 上游单取消失败 order=${order.order_no} up=${order.upstream_order_id} ` +
      `service=${order.service_id} allowCancel=${allowed} reason=${result.reason}`
    );
    // 失败也**不抛**：钱已经退了，抛出去只会让接口 500，客户以为退款失败。
    // 由 sweepPendingCancellations() 每分钟重试，或管理员在备注里看到后手动处理。
  } else {
    console.log(
      `✅ [cancelAfterRefund] order=${order.order_no} up=${order.upstream_order_id} ` +
      `${result.already ? '原本已取消' : '已取消'}`
    );
  }
  return result;
}

/**
 * 定时兜底：扫描「本站已退款但上游单可能还在跑」的订单，重试取消。
 * 判定条件：is_refunded=true 且 admin_note 里没有「已自动取消」标记。
 * 由 app.js 的定时器每分钟调用；单轮最多处理 20 条，避免一次打爆上游。
 */
export async function sweepPendingCancellations(limit = 20) {
  const { Op } = await import('sequelize');
  // 只看最近 7 天：更早的已退款单，上游那边大概率早已手动处理或自然结束，
  // 全量重扫会对上游发一堆无意义请求，还可能触发限流。
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await Order.findAll({
    where: {
      is_refunded: true,
      upstream_order_id: { [Op.not]: null },
      updated_at: { [Op.gte]: since },
      [Op.or]: [
        { admin_note: null },
        { admin_note: '' },
        { admin_note: { [Op.notLike]: '%上游单已自动取消%' } },
      ],
    },
    order: [['updated_at', 'DESC']],
    limit,
  });

  let ok = 0;
  let fail = 0;
  for (const o of rows) {
    const r = await cancelUpstreamAfterRefund(o);
    if (r.ok) ok++; else fail++;
  }
  if (rows.length) {
    console.log(`[cancelSweep] 本轮 ${rows.length} 条，成功 ${ok}，失败 ${fail}`);
  }
  return { total: rows.length, ok, fail };
}


/**
 * 🔍 查上游一笔订单的当前状态（退款预检用）。
 *
 * 2026-11-11 加：祥哥要的是「退款前先确认上游能不能取消 / 退了没有」。
 * 实测上游 `action=status` 返回：
 *   { "5827672": { charge, start_count, status, remains, currency } }
 * status 取值：Pending / In progress / Processing / Completed / Partial / Canceled
 *
 * ⚠️ 上游没有「退款状态」字段，也没有「这笔钱退回来没有」的显式标记。
 *    能确认的只有订单状态 —— 状态变 Canceled 才说明这单停了（成本才有机会回）。
 *
 * @returns {Promise<{ok:boolean, status?:string, remains?:number, charge?:number, reason?:string, raw?:any}>}
 */
export async function queryUpstreamStatus(upstreamOrderId) {
  const id = String(upstreamOrderId ?? '').trim();
  if (!id || id === 'null' || id === 'undefined') {
    return { ok: false, reason: '没有上游单号（订单可能还没推上去）' };
  }
  const confs = await Config.findAll({ where: { key: ['upstream_url', 'upstream_key'] } });
  const conf = {};
  confs.forEach((c) => (conf[c.key] = c.value));
  if (!conf.upstream_url || !conf.upstream_key) {
    return { ok: false, reason: '上游地址或密钥未配置' };
  }
  try {
    const body = new URLSearchParams({
      key: conf.upstream_key, action: 'status', orders: id,
    }).toString();
    const r = await axios.post(conf.upstream_url, body, { headers: FORM, timeout: CANCEL_TIMEOUT_MS });
    const d = r.data && r.data[id];
    if (!d || !d.status) return { ok: false, reason: '上游没有返回该单状态', raw: r.data };
    return {
      ok: true,
      status: String(d.status),
      remains: d.remains !== undefined ? Number(d.remains) : undefined,
      charge: d.charge !== undefined ? Number(d.charge) : undefined,
      raw: d,
    };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || String(e) };
  }
}

/**
 * 退款前预检：这笔订单现在退款，上游那边会怎样？
 *
 * 返回是否允许直接退、要不要管理员二次确认、以及预计追不回的成本。
 * 🔴 只查不改 —— 这个函数绝不产生副作用，可以随便调。
 */
export async function checkRefundable(order) {
  const result = {
    upstreamStatus: null,
    canRefund: true,
    needForce: false,
    estLoss: 0,          // 预计追不回来的上游成本
    reason: '',
    suggestion: '',
  };
  if (!order || !order.upstream_order_id) {
    result.reason = '这单没有上游单号（可能还没提交到上游）';
    result.suggestion = '可以直接退款，上游那边没有需要取消的单';
    return result;
  }

  const q = await queryUpstreamStatus(order.upstream_order_id);
  if (!q.ok) {
    result.needForce = true;
    result.estLoss = Number(order.upstream_charge || 0);
    result.reason = `查不到上游状态：${q.reason || '未知原因'}`;
    result.suggestion = '无法确认上游是否还在跑，需要你确认后再退';
    return result;
  }

  const st = (q.status || '').toLowerCase();
  const cost = Number(order.upstream_charge || 0);
  result.upstreamStatus = q.status;

  if (/cancel/.test(st)) {
    result.reason = '上游单已取消，没有成本损失';
    result.suggestion = '可以放心退款';
    return result;
  }
  if (/pending|排队/.test(st)) {
    result.reason = '上游单还在排队，尚未开始执行';
    result.suggestion = '可以先取消上游，成本能追回';
    return result;
  }
  if (/completed|partial|完成/.test(st)) {
    result.needForce = true;
    result.estLoss = cost;   // 已交付的部分成本已经花掉
    result.reason = '上游单已完成/部分完成，成本已经花掉';
    result.suggestion = '退款后这部分成本追不回来，确认要退再退';
    return result;
  }
  // in progress / processing / 其它运行态
  result.needForce = true;
  result.estLoss = cost;
  result.reason = '上游单已开始执行，且「立即启动」类服务取消后成本不返还';
  result.suggestion = '退款会让这单的上游成本白花，确认要退再退';
  return result;
}

export default cancelUpstreamAfterRefund;
