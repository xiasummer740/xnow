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
  // 🏠 2026-11-09：是不是站长自己的访问（管理员登录态 / 自有 IP）。
  //    统计时默认排除，否则「访问趋势」里全是自己刷的（实测占 58%）。
  is_owner: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
  // 👤 2026-11-11：这条访问对应的登录用户（NULL = 未登录的匿名访客）。
  //    前端埋点已经在上报 token（当初为判断 is_owner 加的），后端顺手解出 user_id 存下来，
  //    就能在后台区分「已成交 / 注册未成交 / 未注册」三类人，看出转化漏斗。
  //    ⚠️ 历史数据（2026-11-11 之前）这一列全是 NULL，分不了类 —— 只能从这天起算。
  user_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
});

export default PageView;

