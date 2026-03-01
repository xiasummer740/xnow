import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Config = sequelize.define('Config', {
  key: { type: DataTypes.STRING(50), primaryKey: true },
  value: { type: DataTypes.TEXT('long'), allowNull: true }, // 核心修复：升级为 LONGTEXT
  description: { type: DataTypes.STRING, allowNull: true }
});

export default Config;
