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
  // 🔴 2026-11-11 关键修正：cancel 返回「工单已受理」**不等于已取消**。
  //    实测服务 29920（立即启动类）：连续两次取消都拿到工单号（112932/112935），
  //    但轮询 60 秒状态始终 Processing，上游余额还在掉。
  //    旧代码把 accepted 当成功 → 标记「已自动取消」→ sweep 不再扫这单 →
  //    **永远不重试**，上游一直跑、成本一直扣。
  //
  //    所以这里分三种标记：
  //      confirmed（已确认取消）  → 标「上游单已自动取消」，sweep 停止跟踪
  //      accepted（工单已受理）   → 标「取消已提交待生效」，sweep 继续查
  //      failed                   → 标「取消失败:原因」，sweep 继续重试
  let confirmed = false;
  if (result.ok && !result.already) {
    // 受理后给上游一点时间，再查一次状态确认
    await new Promise((r) => setTimeout(r, 2500));
    const q = await queryUpstreamStatus(order.upstream_order_id);
    confirmed = !!(q.ok && /cancel/i.test(String(q.status || '')));
  } else if (result.ok && result.already) {
    confirmed = true;
  }

  let tag;
  if (confirmed) {
    tag = '上游单已自动取消';
  } else if (result.ok) {
    const ticket = result.ticket ? `#${result.ticket}` : '';
    tag = `上游单取消已提交${ticket}待生效`;
  } else {
    tag = `上游单取消失败:${String(result.reason || '').slice(0, 60)}`;
  }
  let note = String(order.admin_note || '').trim();
  // 幂等写入：成功了就把旧的「失败」标记替换掉（否则定时兜底会永远重扫这一单），
  // 失败了就更新最后一次原因，但保留「曾失败」的事实供人工排查。
  note = note.replace(/\[上游单[^\]]*\]/g, '').trim();
  order.admin_note = (note ? note + ' ' : '') + `[${tag}]`;
  try { await order.save(); } catch (e) { /* 备注写不进去不影响退款主流程 */ }

  if (confirmed) {
    console.log(`✅ [cancelAfterRefund] order=${order.order_no} up=${order.upstream_order_id} 已确认取消`);
  } else if (result.ok) {
    console.log(
      `⏳ [cancelAfterRefund] order=${order.order_no} up=${order.upstream_order_id} ` +
      `取消已受理${result.ticket ? '(工单 ' + result.ticket + ')' : ''}，等待上游生效 —— sweep 会继续跟踪`
    );
  } else {
    console.warn(
      `⚠️ [cancelAfterRefund] 上游单取消失败 order=${order.order_no} up=${order.upstream_order_id} ` +
      `service=${order.service_id} allowCancel=${allowed} reason=${result.reason}`
    );
    // 失败也**不抛**：钱已经退了，抛出去只会让接口 500，客户以为退款失败。
    // 由 sweepPendingCancellations() 定期重试，或管理员在备注里看到后手动处理。
  }
  // 把 confirmed 带给调用方，让 sweep 知道该不该继续跟
  return { ...result, confirmed };
}

/**
 * 定时兜底：扫描「本站已退款但上游单可能还在跑」的订单，重试取消。
 * 判定条件：is_refunded=true 且 admin_note 里没有「已自动取消」标记。
 * 由 app.js 的定时器每分钟调用；单轮最多处理 20 条，避免一次打爆上游。
 */
export async function sweepPendingCancellations(limit = 20) {
  const { Op } = await import('sequelize');
  const { sendTgMessage } = await import('./tgBot.js');

  // 只扫最近 7 天：太老的单上游早清理了，全量重扫会打爆上游还可能限流
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await Order.findAll({
    where: {
      is_refunded: true,
      upstream_order_id: { [Op.not]: null },
      updated_at: { [Op.gte]: since },
      // 还没「已确认取消」也没标记「需人工」的，都要继续跟
      [Op.and]: [
        {
          [Op.or]: [
            { admin_note: null },
            { admin_note: '' },
            { admin_note: { [Op.notLike]: '%上游单已自动取消%' } },
          ],
        },
        {
          [Op.or]: [
            { admin_note: null },
            { admin_note: '' },
            { admin_note: { [Op.notLike]: '%需人工核对上游退款%' } },
          ],
        },
      ],
    },
    order: [['updated_at', 'DESC']],
    limit,
  });

  let confirmed = 0;
  let pending = 0;
  let failed = 0;
  let escalated = 0;

  for (const o of rows) {
    // ① 先查状态 —— 退款是异步的，上游可能已经把单取消了但我们还不知道
    const q = await queryUpstreamStatus(o.upstream_order_id);
    if (q.ok && /cancel/i.test(String(q.status || ''))) {
      let note = String(o.admin_note || '').trim();
      note = note.replace(/\[上游单[^\]]*\]/g, '').trim();
      o.admin_note = (note ? note + ' ' : '') + '[上游单已自动取消]';
      try { await o.save(); } catch { /* 忽略 */ }
      confirmed++;
      continue;
    }

    // ② 还没取消 —— 看看这笔退款多久了。退款反应慢是常态，
    //    但超过 6 小时还纹丝不动，基本就是上游没执行，得人去后台点。
    const refundAgeH = (Date.now() - new Date(o.updated_at).getTime()) / 3600000;
    if (q.ok && refundAgeH > 6) {
      let note = String(o.admin_note || '').trim();
      const tries = (note.match(/\[取消尝试 (\d+) 次\]/) || [])[1];
      const n = (parseInt(tries, 10) || 0) + 1;
      note = note.replace(/\[取消尝试 \d+ 次\]/g, '').trim();
      if (n >= 3) {
        note = note.replace(/\[上游单[^\]]*\]/g, '').trim();
        o.admin_note = (note ? note + ' ' : '') + `[需人工核对上游退款] 退款已 ${refundAgeH.toFixed(1)} 小时，上游状态仍是 ${q.status}`;
        try { await o.save(); } catch { /* 忽略 */ }
        escalated++;
        try {
          await sendTgMessage(
            `⚠️ <b>退款已过 ${refundAgeH.toFixed(1)} 小时，上游仍未取消</b>\n` +
            `订单：<code>${o.order_no}</code>\n上游单：<code>${o.upstream_order_id}</code>\n` +
            `状态：<b>${q.status}</b>\n金额：¥${parseFloat(o.charge || 0).toFixed(2)}\n` +
            `👉 请到上游后台「订单 → 退款」页面核对这笔`
          );
        } catch { /* TG 失败不影响主流程 */ }
        continue;
      }
      o.admin_note = (note ? note + ' ' : '') + `[取消尝试 ${n} 次]`;
      try { await o.save(); } catch { /* 忽略 */ }
    }

    // ③ 继续尝试取消
    const r = await cancelUpstreamAfterRefund(o);
    if (r && r.confirmed) confirmed++;
    else if (r && r.ok) pending++;
    else failed++;
  }

  if (rows.length) {
    console.log(`[cancelSweep] 本轮 ${rows.length} 条 → 确认取消 ${confirmed}、待生效 ${pending}、失败 ${failed}、转人工 ${escalated}`);
  }
  return { total: rows.length, confirmed, pending, failed, escalated };
}

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
