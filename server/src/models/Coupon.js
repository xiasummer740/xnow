import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Coupon = sequelize.define('Coupon', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  type: { type: DataTypes.ENUM('percent', 'fixed'), defaultValue: 'percent' },
  value: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, // 百分比/固定金额
  min_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  max_uses: { type: DataTypes.INTEGER, defaultValue: 0 }, // 0 = 不限
  used_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  expires_at: { type: DataTypes.BIGINT, defaultValue: 0 }, // 0 = 永不过期
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  description: { type: DataTypes.STRING(200), defaultValue: '' },
});

export default Coupon;
