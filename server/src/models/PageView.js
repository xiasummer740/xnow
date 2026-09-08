import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// 访问埋点表：SEO/流量统计。uv 口径 = 前端 localStorage 一次性 uuid → visitor_id
// country/city 入库时不实时解析(防 ip-api 限流)，由管理端聚合查询时按需批量补全。
const PageView = sequelize.define('PageView', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  visitor_id: { type: DataTypes.STRING(64), allowNull: false, defaultValue: '' }, // 匿名访客标识
  ip: { type: DataTypes.STRING(45), allowNull: false, defaultValue: '' },
  path: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '/' },
  referrer: { type: DataTypes.STRING(600), allowNull: false, defaultValue: '' }, // 来源页完整 URL
  country: { type: DataTypes.STRING(60), allowNull: false, defaultValue: '' },
  city: { type: DataTypes.STRING(80), allowNull: false, defaultValue: '' },
  ts: { type: DataTypes.BIGINT, allowNull: false, defaultValue: () => Date.now() }, // 毫秒时间戳
});

export default PageView;
