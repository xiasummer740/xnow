import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(200), defaultValue: '' },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  is_read: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
  tableName: 'notifications',
  underscored: true,
  timestamps: true,
  updatedAt: false
});

export default Notification;
