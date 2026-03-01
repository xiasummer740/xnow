import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Service = sequelize.define('Service', {
  service_id: { type: DataTypes.INTEGER, primaryKey: true },
  name: { type: DataTypes.STRING(1000), allowNull: false },
  type: { type: DataTypes.STRING(50) },
  category: { type: DataTypes.STRING(255) },
  rate: { type: DataTypes.DECIMAL(30, 6), defaultValue: 0.000000 },
  min: { type: DataTypes.INTEGER, defaultValue: 100 },
  max: { type: DataTypes.INTEGER, defaultValue: 10000 },
  refill: { type: DataTypes.BOOLEAN, defaultValue: false },
  cancel: { type: DataTypes.BOOLEAN, defaultValue: false },
  // 核心修复：使用 Sequelize 官方的 TEXT('long') 完美支持长篇大论的描述和Emoji
  description: { type: DataTypes.TEXT('long'), allowNull: true }, 
  sort: { type: DataTypes.INTEGER, defaultValue: 0 }
});

export default Service;
