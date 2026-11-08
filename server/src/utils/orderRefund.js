// 订单整单退款（共用）
// ---------------------------------------------------------------------------
// 为什么单独抽出来（2026-11-03）：
//   下单流程原来把「扣钱」和「调上游」塞在同一个数据库事务里 —— axios 一调 15 秒，
//   期间客户那行余额一直被行锁着；更糟的是**上游已经接单、本地 create 失败 → 回滚**，
//   等于平台白送一单。改成两阶段（先扣款建单、提交后再调上游）之后，
//   上游那一步失败就必须能把这一单干净地退回去 —— 这个函数就是那个补偿动作。
//   另外「提交中」状态如果因为进程崩在两步之间而残留，也靠它清理（见 utils/orderSync.js）。
//
// 幂等：以 orders.is_refunded 为准，同一单重复调用只会退一次。
import { sequelize, Order, User, Transaction } from '../models/index.js';
import { creditUser } from './balance.js';
import refundSiteCost from './siteRefund.js';

/**
 * 整单退款：客户全额 + 分站站长成本全额，同一事务内完成。
 * @param {number|string} orderId orders.id
 * @param {{reason?: string, customerReason?: string}} opts
 *        reason         写进流水描述（客户在流水里能看到，别写内部原因）
 *        customerReason 写进 orders.refund_reason，展示在订单卡片上
 * @returns {Promise<{ok:boolean, skipped?:boolean, amount?:number, error?:any}>}
 */
export async function refundOrderFully(orderId, { reason = '订单未提交成功，已全额退款', customerReason = '' } = {}) {
  const t = await sequelize.transaction();
  try {
    const o = await Order.findByPk(orderId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!o) { await t.rollback(); return { ok: false, error: new Error('訂單不存在') }; }
    if (o.is_refunded) { await t.commit(); return { ok: true, skipped: true }; }

    const amount = Number(parseFloat(o.charge || 0).toFixed(6));
    if (amount > 0) {
      const user = await User.findByPk(o.user_id, { transaction: t });
      if (user) {
        // 原子加余额：绝不能用「读到的旧值 + 退款额」再 save() 覆盖
        const newBalance = await creditUser(user.id, amount, { transaction: t });
        await Transaction.create({
          user_id: user.id, phone: o.phone, amount, balance: newBalance,
          type: '退款入账', description: `${reason} [单号:${o.order_no}]`,
          site_id: parseInt(o.site_id || 0),
        }, { transaction: t });
      }
    }

    // 分站订单：站长已付的进货成本必须同步退回，否则每失败一单站长白亏一次
    try {
      await refundSiteCost(o, 1, { transaction: t, User, Transaction });
    } catch (e) {
      console.error('❌ [refundOrderFully] 分站成本退还失败 order=' + o.order_no + ' err=' + ((e && e.message) || e));
      throw e; // 同一事务：客户退、站长也退，要么都成
    }

    o.is_refunded = true;
    o.status = '已退款';
    // 客户可见的原因：没有单独给就用流水描述那句（两者都必须是客户能看懂的人话）
    if (customerReason || reason) o.refund_reason = String(customerReason || reason).slice(0, 255);
    await o.save({ transaction: t });
    await t.commit();

    // 🚫 事务提交之后再取消上游单：放在事务内会让 axios 的 15 秒
    //    一直锁着客户余额行；取消失败也不回滚（钱已退，回滚就是烂账）。
    //    覆盖所有走本函数的自动退款：下单失败补偿、僵尸单清扫等。
    try {
      const { cancelUpstreamAfterRefund } = await import('./upstreamCancel.js');
      await cancelUpstreamAfterRefund(o);
    } catch (e) {
      console.warn(`[refundOrderFully] 上游取消步骤异常（不影响退款）order=${o.order_no}:`, (e && e.message) || e);
    }

    return { ok: true, amount };
  } catch (e) {
    await t.rollback().catch(() => {});
    console.error('❌ [refundOrderFully] 退款失败 orderId=' + orderId + ' err=' + ((e && e.message) || e));
    return { ok: false, error: e };
  }
}

export default refundOrderFully;
