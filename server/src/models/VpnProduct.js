import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// VpnProduct represents a physical VPS node that can serve VPN clients.
// Each VPS runs an XX-UI panel instance with one or more inbounds.
const VpnProduct = sequelize.define('VpnProduct', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT },
  vps_location: { type: DataTypes.STRING(100) },
  flag_emoji: { type: DataTypes.STRING(10) },
  xxui_url: { type: DataTypes.STRING(500) },
  xxui_inbound_id: { type: DataTypes.INTEGER },
  max_traffic_gb: { type: DataTypes.INTEGER, defaultValue: 2000 },
  price_per_gb: { type: DataTypes.DECIMAL(10, 4), defaultValue: 0.5000 },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  sort: { type: DataTypes.INTEGER, defaultValue: 0 }
});

export default VpnProduct;
