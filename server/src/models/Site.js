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
  announcement: { type: DataTypes.TEXT, allowNull: true },
  // 🎨 三期主题系统
  template: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'classic' },
  color: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'cyan' },
  accent: { type: DataTypes.STRING(16), allowNull: true },            // 自定义主色 HEX，优先于 color
  footer_text: { type: DataTypes.STRING(255), allowNull: true },       // 页脚版权
  support_url: { type: DataTypes.STRING(255), allowNull: true },       // 客服链接（TG 等）
  home_modules: { type: DataTypes.TEXT, allowNull: true },             // 首页模块 JSON:[{key,enabled,order}]
  // 📧 分站自有发信（不配则回退主站 SMTP，但验证码会露出平台品牌）
  smtp_host: { type: DataTypes.STRING(128), allowNull: true },
  smtp_port: { type: DataTypes.INTEGER, allowNull: true },
  smtp_user: { type: DataTypes.STRING(128), allowNull: true },
  smtp_pass: { type: DataTypes.STRING(255), allowNull: true },
  // 💳 分站自有收款商户（方案②：钱直接进站长账户，平台不碰）
  bufpay_id: { type: DataTypes.STRING(64), allowNull: true },
  bufpay_key: { type: DataTypes.STRING(128), allowNull: true },
  cryptomus_id: { type: DataTypes.STRING(64), allowNull: true },
  cryptomus_key: { type: DataTypes.STRING(160), allowNull: true },
  // 🌐 自有域名开通状态
  domain_status: { type: DataTypes.ENUM('none', 'pending', 'active', 'failed'), allowNull: false, defaultValue: 'none' },
  domain_token: { type: DataTypes.STRING(64), allowNull: true },   // TXT 验证用令牌
  cert_mode: { type: DataTypes.STRING(16), allowNull: true }       // letsencrypt / selfsigned / existing
}, {
  tableName: 'sites',
  timestamps: true,
  underscored: true
});

export default Site;
