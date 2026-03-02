import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  phone: { type: DataTypes.STRING(20), unique: true, allowNull: false },
  email: { type: DataTypes.STRING(100), allowNull: true },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('user', 'gold', 'agent', 'admin', 'super_admin'), defaultValue: 'user' },
  balance: { type: DataTypes.DECIMAL(14, 6), defaultValue: 0.000000 },
  // 💡 核心修复：允许为空且默认值为 null，确保完美继承全局系统倍率
  custom_multiplier: { type: DataTypes.DECIMAL(4, 2), allowNull: true, defaultValue: null }, 
  api_key: { type: DataTypes.STRING(64), unique: true, allowNull: true },
  vip_expire_at: { type: DataTypes.DATE, allowNull: true },
  register_ip: { type: DataTypes.STRING(45), allowNull: true },
  last_login_ip: { type: DataTypes.STRING(45), allowNull: true }
});
export default User;
