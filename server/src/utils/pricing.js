import { SiteServicePrice } from '../models/index.js';
import { customerDiscountMultiplier } from './customerPrice.js';
import { isAgentActive } from './agentStatus.js';

// ============================================================================
// 💰 订单计价的唯一实现
//
// 为什么要有这个文件：
//   下单原本有三处各写一份价格算法 —— /add（单笔）、/batch（批量），
//   而且两份**并不一样**：
//     · /batch 没有站点单服务定价（SiteServicePrice）
//     · /batch 没有站点活动折扣（discount_rate / discount_until）
//     · /batch 没有客户分组价 / 单独定价（customerDiscountMultiplier）
//     · /batch 没有订阅型计费单位（billUnits）
//   结果：同一个服务、同一个数量，走「开始下单」和走「批量下单」价格不同，
//   分站客户批量下比单笔贵，订阅型服务批量下少收 N 倍。而且两边都不报错。
//   现在统一到这里，/add、/batch、预估接口三处共用，改一次全生效。
//
// 口径（与 /add 完全一致，勿轻易改动）：
//   售价 charge        = (qty/1000) × sellRate × billUnits
//   上游成本 up_charge = (qty/1000) × service.rate × billUnits
//   站主成本 siteCost  = (qty/1000) × baseRate × (global_multiplier × 本站进货折扣) × billUnits
//   最终售价取 max(charge, 成本地板)：主站地板 = 上游成本，分站地板 = 站主成本
// ============================================================================

const num = (v, d = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

/**
 * 计算一笔订单的最终价格。只算钱，不扣款、不建单、不改库。
 *
 * @param {object}  p
 * @param {object}  p.service       Service 实例（需要 rate / custom_rate / service_id）
 * @param {number}  p.qty           数量
 * @param {number} [p.postsQty]     订阅型的新帖数（billUnits 的来源）
 * @param {string} [p.orderType]    normType(service.type) 的结果
 * @param {object} [p.user]         下单用户（null = 超管走不过库的路径）
 * @param {object} [p.site]         分站（req.site），主站传 null
 * @param {object} [p.conf]         { global_multiplier, agent_discount }
 * @param {object} [p.transaction]  事务（预估时可不传）
 * @returns {Promise<{charge:number, upstream_charge:number, siteCost:number,
 *                    sellRate:number, baseRate:number, baseMultiplier:number,
 *                    finalMultiplier:number, billUnits:number}>}
 */
export const computeOrderPrice = async ({
  service,
  qty,
  postsQty,
  orderType,
  user,
  site,
  conf = {},
  transaction,
}) => {
  const q = num(qty);
  const baseMultiplier = site ? num(site.multiplier, 2.0) : num(conf.global_multiplier, 2.0);
  const agentDiscount = site ? num(site.agent_discount, 0.8) : num(conf.agent_discount, 0.8);

  const actualRole = user ? user.role : 'user';
  const isStaff = actualRole === 'super_admin' || actualRole === 'admin';

  // 分站定价权归站长：站上所有客户都按站长定的倍率付款。
  // 买家自己的 custom_multiplier / 代理折扣是「平台自营」的价，套到别人的店会击穿站长成本。
  let finalMultiplier = baseMultiplier;
  if (site) {
    finalMultiplier = isStaff ? 1.0 : baseMultiplier;
  } else if (isStaff) {
    finalMultiplier = 1.0;
  } else if (user && user.custom_multiplier !== null && user.custom_multiplier !== undefined) {
    finalMultiplier = num(user.custom_multiplier, baseMultiplier);
  } else if (isAgentActive(actualRole, user && user.agent_expire_at)) {
    finalMultiplier = baseMultiplier * agentDiscount;
  }

  // 管理员/至尊管理员按上游原价：custom_rate 是「面向客户的零售价」，不该套在管理者头上
  const baseRate = (!isStaff && service.custom_rate !== null && service.custom_rate !== undefined)
    ? num(service.custom_rate, num(service.rate))
    : num(service.rate);

  let sellRate = baseRate * finalMultiplier;

  if (site) {
    // ① 站长给单个服务单独定的价优先
    try {
      const ov = await SiteServicePrice.findOne({
        where: { site_id: site.id, service_id: service.service_id },
        transaction,
      });
      if (ov && num(ov.rate) > 0) sellRate = num(ov.rate);
    } catch (e) { /* 表还没建/查不到就走默认倍率，不影响下单 */ }

    // ② 再叠活动折扣（到期自动失效）
    const dr = num(site.discount_rate);
    const du = parseInt(site.discount_until || 0, 10);
    const discountActive = dr > 0 && dr < 1 && !(du > 0 && Math.floor(Date.now() / 1000) > du);
    if (discountActive) sellRate = sellRate * dr;

    // ③ 客户分组价 / 单个客户单独定价
    try {
      const gm = await customerDiscountMultiplier(site.id, user, { transaction });
      if (gm && gm > 0 && gm < 1) sellRate = sellRate * gm;
    } catch (e) { /* 降级：按原价，不影响下单 */ }
  }

  // 订阅型按「投喂次数」计价：上游为每条新帖各投喂一次，本站若只收一次，客户发帖越多亏越多
  const billUnits = orderType === 'subscriptions' ? num(postsQty, 1) : 1;

  const chargeRaw = (q / 1000) * sellRate * billUnits;
  const upstream_charge = num(((q / 1000) * num(service.rate) * billUnits).toFixed(4));

  let siteCost = 0;
  let charge = num(chargeRaw.toFixed(4));

  if (site) {
    // 成本按**这个站**的进货折扣算：代理站 0.8，非代理站 1（原价）
    const siteAd = num(site.agent_discount);
    const useAd = siteAd > 0 ? siteAd : num(conf.agent_discount, 0.8);
    const platformMult = num(conf.global_multiplier, 2.0) * useAd;
    siteCost = num(((q / 1000) * baseRate * platformMult * billUnits).toFixed(6));
    // 兜底护栏：售价无论如何不得低于站主成本
    if (charge < siteCost) charge = siteCost;
  } else {
    // 主站地板 = 上游成本。客户被设了倒贴倍率时，卖一单倒贴一单，账面上只有利润栏是负数
    if (charge < upstream_charge) charge = upstream_charge;
  }

  return {
    charge,
    upstream_charge,
    siteCost,
    sellRate,
    baseRate,
    baseMultiplier,
    finalMultiplier,
    billUnits,
  };
};
