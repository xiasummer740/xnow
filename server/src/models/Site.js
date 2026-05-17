import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Site = sequelize.define('Site', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  owner_id: { type: DataTypes.INTEGER, allowNull: false },
  domain: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(128), allowNull: false, defaultValue: 'XNOW' },
  logo: { type: DataTypes.STRING(512), allowNull: true },
  multiplier: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 2.0 },
  agent_discount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.8 },
  status: { type: DataTypes.ENUM('active', 'suspended'), defaultValue: 'active' },
  announcement: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'sites',
  timestamps: true,
  underscored: true
});

export default Site;
