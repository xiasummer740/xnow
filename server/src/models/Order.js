import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Order = sequelize.define('Order', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_no: { type: DataTypes.STRING(50), unique: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  phone: { type: DataTypes.STRING(20) }, 
  upstream_order_id: { type: DataTypes.STRING(50) },
  service_id: { type: DataTypes.INTEGER },
  service_name: { type: DataTypes.STRING(1000) },
  link: { type: DataTypes.TEXT, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  charge: { type: DataTypes.DECIMAL(14, 6), defaultValue: 0.000000 }, 
  upstream_charge: { type: DataTypes.DECIMAL(14, 6), defaultValue: 0.000000 }, 
  start_count: { type: DataTypes.STRING(50), defaultValue: '0' },
  status: { type: DataTypes.STRING(50), defaultValue: '排队中' },
  remains: { type: DataTypes.STRING(50), defaultValue: '0' },
  // 核心加法：智能退款标记，防止重复退款
  is_refunded: { type: DataTypes.BOOLEAN, defaultValue: false }
});

export default Order;
