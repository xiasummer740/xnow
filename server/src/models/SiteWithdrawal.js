import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * 💸 站长提现申请（110 期）
 *
 * 祥哥 2026-10-25 定的流程：
 *   站长一周一次申请 → 上传自己的收款码 → 主站管理员手动扫码转账 → 点「已转账确认」→ 台账清账。
 *
 * status:
 *   pending  等主站打款
 *   paid     已打款（清账，相关 site_collections 挂上 withdrawal_id）
 *   rejected 驳回（金额退回可提现额度，不动台账）
 */
const SiteWithdrawal = sequelize.define('SiteWithdrawal', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  site_id: { type: DataTypes.INTEGER, allowNull: false },
  owner_id: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DECIMAL(14, 6), allowNull: false },
  qr_path: { type: DataTypes.STRING(512), allowNull: false },   // 站长上传的收款码图片相对路径
  note: { type: DataTypes.STRING(255), allowNull: true },
  status: { type: DataTypes.ENUM('pending', 'paid', 'rejected'), allowNull: false, defaultValue: 'pending' },
  admin_note: { type: DataTypes.STRING(255), allowNull: true },
  admin_id: { type: DataTypes.INTEGER, allowNull: true },
  paid_at: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'site_withdrawals',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['site_id'] }, { fields: ['status'] }],
});

export default SiteWithdrawal;
