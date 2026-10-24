import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// 🏬 分站「单服务定价」：站长可以对某个服务单独定售价，不设就走站点总倍率。
//    rate 是「每 1000 个」的单价（与 services.sell_price 同口径），
//    目的：站长想把某个爆款服务压低引流、或把冷门服务标高，不用动全场倍率。
const SiteServicePrice = sequelize.define('SiteServicePrice', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  site_id: { type: DataTypes.INTEGER, allowNull: false },
  service_id: { type: DataTypes.INTEGER, allowNull: false },
  rate: { type: DataTypes.DECIMAL(14, 6), allowNull: false },
}, {
  tableName: 'site_service_prices',
  timestamps: true,
  underscored: true,
  indexes: [{ unique: true, fields: ['site_id', 'service_id'] }],
});

export default SiteServicePrice;