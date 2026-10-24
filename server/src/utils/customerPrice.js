import { SiteCustomerGroup } from '../models/index.js';

/**
 * 👥 该客户在该分站适用的折扣倍率（1 = 不打折，0.95 = 95 折）
 *
 * 祥哥 2026-10-25：「对不同的用户可以设置不同的价格，可以自定义可以百分比」
 *   ① 单个客户单独定价（users.custom_multiplier）= 自定义，优先级最高
 *   ② 客户分组价（site_customer_groups.multiplier）= 百分比
 *   ③ 都没设 = 1，按站长全场倍率
 *
 * 🔒 红线：这里只返回倍率，成交价最终仍由下单链路与站长成本价取大，
 *    组折扣打得再狠也不会让站长亏钱。
 */
export async function customerDiscountMultiplier(siteId, user, opts = {}) {
  const sid = parseInt(siteId || 0);
  if (!sid || !user) return 1;

  // ① 单个客户自定义倍率（只认 0<倍率<1，>1 视为加价不在此处处理）
  const cm = user.custom_multiplier;
  if (cm !== null && cm !== undefined && cm !== '') {
    const m = parseFloat(cm);
    if (isFinite(m) && m > 0 && m < 1) return m;
  }

  // ② 分组价
  const gid = parseInt(user.site_group_id || 0);
  if (!gid) return 1;
  try {
    const g = await SiteCustomerGroup.findOne({
      where: { id: gid, site_id: sid },
      ...(opts.transaction ? { transaction: opts.transaction } : {}),
    });
    if (!g) return 1;
    const m = parseFloat(g.multiplier);
    return (isFinite(m) && m > 0 && m < 1) ? m : 1;
  } catch (e) {
    return 1;   // 表还没建好也不影响下单
  }
}

/** 校验范围：分组折扣只允许 0.30 ~ 1.00（3 折到原价），避免站长手滑写 0.05 */
export function normalizeGroupMultiplier(input) {
  const m = parseFloat(input);
  if (!isFinite(m)) return null;
  if (m < 0.3) return null;
  if (m > 1) return 1;
  return Math.round(m * 1000) / 1000;
}
