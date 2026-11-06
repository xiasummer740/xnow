// 🏬 分站成本退还
// ---------------------------------------------------------------------------
// 分站订单成交时，平台已经从站长余额里扣了 `site_cost`（进货成本）。
// 客户退款时如果只退客户、不退站长，站长每被取消一单就白亏一次成本，
// 而这笔钱会静默变成平台的利润 —— 这正是「站长觉得平台在坑他」的典型来源。
//
// 退款比例与客户侧退款保持一致（全额取消 = 1，部分完成 = 剩余比例）。
// ⚠️ 口径**必须**和客户侧同一套：`ratio = 0`（一分不退）就要保持 0。
//    以前这里写的是 `ratio > 0 ? min(ratio,1) : 1` —— 0 被当成「调用方没给比例」→ 全额退，
//    于是「部分完成、剩余 0」的单子出现「客户一分不退、站长成本全额退回」的净亏空。
// 必须在调用方的事务里执行：余额变动、流水、订单标记要么一起成功要么一起回滚。
import { creditUser } from './balance.js';

const refundSiteCost = async (order, ratio, { transaction, User, Transaction } = {}) => {
  if (!order) return 0;
  const siteId = parseInt(order.site_id || 0);
  const siteCost = parseFloat(order.site_cost || 0);
  if (!siteId || !(siteCost > 0)) return 0;          // 主站订单或没记成本 → 不动

  // 只做「夹取到 [0,1]」；非数字才回落全额（老行为），0 必须原样保留
  const r = Number.isFinite(Number(ratio)) ? Math.min(Math.max(Number(ratio), 0), 1) : 1;
  const amount = parseFloat((siteCost * r).toFixed(6));
  if (!(amount > 0)) return 0;

  const { Site } = await import('../models/index.js');
  const site = await Site.findByPk(siteId, { transaction });
  if (!site || !site.owner_id) return 0;             // 站没了 → 无人可退，不能凭空造钱

  const owner = await User.findByPk(site.owner_id, { transaction });
  if (!owner) return 0;

  // 🔒 原子加余额（见 utils/balance.js）：快照写会被并发的下单/充值覆盖
  const newBalance = await creditUser(owner.id, amount, { transaction });

  await Transaction.create({
    user_id: owner.id,
    phone: owner.phone,
    amount,
    balance: newBalance,
    type: '分站成本退还',
    description: `订单退款，退还分站成本 [单号:${order.order_no}] 比例${(r * 100).toFixed(0)}%`,
    site_id: siteId
  }, { transaction });

  return amount;
};

export default refundSiteCost;
