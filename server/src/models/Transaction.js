import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  phone: { type: DataTypes.STRING(20) },
  amount: { type: DataTypes.DECIMAL(14, 6), allowNull: false }, // 正为入账，负为扣款
  balance: { type: DataTypes.DECIMAL(14, 6) }, // 💡 核心新增：变动后的快照余额
  type: { type: DataTypes.STRING(50) },
  description: { type: DataTypes.STRING(500) },
  // 🏬 这笔流水归属哪个分站（0 = 主站）。
  //    必须记：分站充电的钱进的是**站长**的商户账户，平台一分没收到。
  //    不区分的话，平台营收会把站长的钱算成自己的收入。
  site_id: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
});

export default Transaction;
