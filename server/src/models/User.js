import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  phone: { type: DataTypes.STRING(20), unique: true, allowNull: false },
  email: { type: DataTypes.STRING(100), unique: true, allowNull: true },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('user', 'gold', 'agent', 'admin', 'super_admin'), defaultValue: 'user' },
  balance: { type: DataTypes.DECIMAL(14, 6), defaultValue: 0.000000 },
  custom_multiplier: { type: DataTypes.DECIMAL(4, 2), allowNull: true, defaultValue: null }, 
  api_key: { type: DataTypes.STRING(64), unique: true, allowNull: true },
  vip_expire_at: { type: DataTypes.DATE, allowNull: true },
  register_ip: { type: DataTypes.STRING(45), allowNull: true },
  last_login_ip: { type: DataTypes.STRING(45), allowNull: true },
  // 💡 核心加法：新增最后登录时间字段
  last_login_at: { type: DataTypes.DATE, allowNull: true },
  inviter_id: { type: DataTypes.INTEGER, allowNull: true },
  // 🏬 分站归属：0 = 主站，>0 = sites.id。
  //    分站注册的用户只能在那个分站域名登录（超管、管理员、该分站主本人例外）。
  site_id: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_commission: { type: DataTypes.DECIMAL(14, 6), defaultValue: 0.000000 },
  is_banned: { type: DataTypes.BOOLEAN, defaultValue: false },
  ban_reason: { type: DataTypes.STRING(255), allowNull: true },
  admin_note: { type: DataTypes.TEXT, defaultValue: '' }
});
export default User;
