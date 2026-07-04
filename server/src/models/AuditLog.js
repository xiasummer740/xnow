import sequelize from '../config/database.js';
import { DataTypes } from 'sequelize';

const AuditLog = sequelize.define('AuditLog', {
  admin_id: { type: DataTypes.INTEGER, allowNull: false },
  admin_phone: { type: DataTypes.STRING(20), defaultValue: '' },
  action: { type: DataTypes.STRING(50), allowNull: false },
  target_type: { type: DataTypes.STRING(50), defaultValue: '' },
  target_id: { type: DataTypes.STRING(50), defaultValue: '' },
  details: { type: DataTypes.TEXT, defaultValue: '' },
  ip_address: { type: DataTypes.STRING(45), defaultValue: '' }
}, {
  tableName: 'audit_logs',
  underscored: true,
  timestamps: true,
  updatedAt: false
});

export default AuditLog;
