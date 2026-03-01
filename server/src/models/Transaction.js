import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  phone: { type: DataTypes.STRING(20) },
  amount: { type: DataTypes.DECIMAL(14, 6), allowNull: false }, // 正为入账，负为扣款
  balance: { type: DataTypes.DECIMAL(14, 6) }, // 💡 核心新增：变动后的快照余额
  type: { type: DataTypes.STRING(50) },
  description: { type: DataTypes.STRING(500) }
});

export default Transaction;
