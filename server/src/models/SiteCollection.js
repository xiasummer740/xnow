import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * 💰 平台代收台账（110 期）
 *
 * 祥哥 2026-10-25 定：站长没配自己的商户时，可以「用主站收款」。
 * 那样客户充值的钱进的是**平台**商户，这笔钱是站长的，平台只是代收。
 * 每一笔都要落一行，站长申请提现时按未结算金额核销 —— 不落账 = 迟早对不上账。
 *
 * 核销方式：withdrawal_id 指到 site_withdrawals；为 NULL 表示还没结算。
 */
const SiteCollection = sequelize.define('SiteCollection', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  site_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  order_id: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  amount: { type: DataTypes.DECIMAL(14, 6), allowNull: false },
  withdrawal_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'site_collections',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['site_id'] }, { fields: ['withdrawal_id'] }],
});

export default SiteCollection;
