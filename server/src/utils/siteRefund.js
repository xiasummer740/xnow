// 🏬 分站成本退还
// ---------------------------------------------------------------------------
// 分站订单成交时，平台已经从站长余额里扣了 `site_cost`（进货成本）。
// 客户退款时如果只退客户、不退站长，站长每被取消一单就白亏一次成本，
// 而这笔钱会静默变成平台的利润 —— 这正是「站长觉得平台在坑他」的典型来源。
//
// 退款比例与客户侧退款保持一致（全额取消 = 1，部分完成 = 剩余比例）。
// 必须在调用方的事务里执行：余额变动、流水、订单标记要么一起成功要么一起回滚。
const refundSiteCost = async (order, ratio, { transaction, User, Transaction } = {}) => {
  if (!order) return 0;
  const siteId = parseInt(order.site_id || 0);
  const siteCost = parseFloat(order.site_cost || 0);
  if (!siteId || !(siteCost > 0)) return 0;          // 主站订单或没记成本 → 不动

  const r = Number.isFinite(ratio) && ratio > 0 ? Math.min(ratio, 1) : 1;
  const amount = parseFloat((siteCost * r).toFixed(6));
  if (!(amount > 0)) return 0;

  const { Site } = await import('../models/index.js');
  const site = await Site.findByPk(siteId, { transaction });
  if (!site || !site.owner_id) return 0;             // 站没了 → 无人可退，不能凭空造钱

  const owner = await User.findByPk(site.owner_id, { transaction });
  if (!owner) return 0;

  owner.balance = (parseFloat(owner.balance) + amount).toFixed(6);
  await owner.save({ transaction });

  await Transaction.create({
    user_id: owner.id,
    phone: owner.phone,
    amount,
    balance: owner.balance,
    type: '分站成本退还',
    description: `订单退款，退还分站成本 [单号:${order.order_no}] 比例${(r * 100).toFixed(0)}%`
  }, { transaction });

  return amount;
};

export default refundSiteCost;
