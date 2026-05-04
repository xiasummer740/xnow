import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const VpnClient = sequelize.define('VpnClient', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  product_id: { type: DataTypes.INTEGER },
  email: { type: DataTypes.STRING(200), allowNull: false },
  uuid: { type: DataTypes.STRING(100) },
  sub_id: { type: DataTypes.STRING(100) },
  subscription_url: { type: DataTypes.STRING(500) },
  config_url: { type: DataTypes.STRING(500) },
  qrcode: { type: DataTypes.TEXT },
  traffic_gb: { type: DataTypes.INTEGER },
  traffic_used_up: { type: DataTypes.BIGINT, defaultValue: 0 },
  traffic_used_down: { type: DataTypes.BIGINT, defaultValue: 0 },
  expiry_time: { type: DataTypes.BIGINT },
  vps_location: { type: DataTypes.STRING(100) },
  status: { type: DataTypes.STRING(20), defaultValue: 'active' }
});

export default VpnClient;
