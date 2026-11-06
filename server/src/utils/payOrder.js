// 支付单号 → 交易流水幂等匹配条件
// ---------------------------------------------------------------------------
// 为什么需要单独一个工具（2026-11-03）：
//   充值入账的幂等判定原来写的是
//       Transaction.findOne({ where: { description: { [Op.like]: `%${orderId}%` } } })
//   这里有两个真实的丢钱路径：
//     ① **orderId 里的 `_` 是 LIKE 的单字符通配符**（`%` 也是）。我们的单号长这样：
//          BUF_1723456789012_9.90_abc123
//        `_` 全部被当成"任意一个字符"，于是这条 LIKE 会命中**别的单号**，
//        本该入账的充值被判成"已处理"直接 return → 钱进了商户、余额没加、补单队列还标了完成。
//     ② 有的调用点根本没带 user_id，直接拿全表比对。
//
//   另外 LOAD 全表 LIKE 也没法走索引。
//
// 现在的口径：流水描述的写入格式固定是 `… [单号:<orderId>]`（pay.js 里所有充值入口都这么写），
//   所以这里用「转义后 + 以 `<orderId>]` 结尾」做精确匹配，既不会串单，也仍能匹配历史数据。
import { Op } from 'sequelize';

export const escapeLike = (s) => String(s).replace(/[\\%_]/g, (m) => '\\' + m);

export const payOrderDescriptionLike = (orderId) => ({
  [Op.like]: `%${escapeLike(orderId)}]`,
});

// 便捷版：直接给 where 片段（带上用户维度，避免跨用户误判）
export const payOrderMatch = (orderId, userId) => ({
  ...(userId === undefined || userId === null ? {} : { user_id: userId }),
  description: payOrderDescriptionLike(orderId),
});
