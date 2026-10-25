import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * 💰 平台代收台账（110 期）
 *
 * 祥哥 2026-10-25 定：站长没配自己的商户时，可以「用主站收款」。
 * 那样客户充值的钱进的是**平台**商户，这笔钱是站长的，平台只是代收。
 * 每一笔都要落一行，站长申请提现时按未结算金额核销 —— 不落账 = 迟早对不上账。
 *
 * 核销方式：used_amount 记录这行已经被结算掉多少钱（支持部分核销），
 * withdrawal_id 记录最近一次核销它的提现单（只作溯源，金额一律以 used_amount 为准）。
 *
 * ⚠️ 必须支持部分核销：提现 ¥100、台账是 ¥88.88 + ¥31.12 时，
 *    若按整行标记"已结算"，站长只拿到 100 却丢了 20 —— 那是吞钱。
 */
const SiteCollection = sequelize.define('SiteCollection', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  site_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  order_id: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  amount: { type: DataTypes.DECIMAL(14, 6), allowNull: false },
  // 已经结算掉多少（DECIMAL 与 amount 同精度，避免浮点误差）
  used_amount: { type: DataTypes.DECIMAL(14, 6), allowNull: false, defaultValue: 0 },
  withdrawal_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'site_collections',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['site_id'] }, { fields: ['withdrawal_id'] }],
});

export default SiteCollection;
