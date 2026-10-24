import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// 👥 分站「客户分组价」：站长可以把自己的客户分几组（普通/VIP/老客户…），
//    每组一个折扣倍率（0.30~1.00 = 3 折~原价），客户登录后看到和支付的价自动按组算。
//
//    祥哥 2026-10-25：「对不同的用户可以设置不同的价格，可以自定义可以百分比」
//      · 百分比 → 这里的 multiplier（0.95 = 95 折）
//      · 自定义 → 单个客户还能在 users.custom_multiplier 上单独给一个倍率（优先级更高）
//
//    🔒 红线不变：任何组折扣叠完之后，成交价仍不得低于站长成本价（下单链路统一抬平）。
const SiteCustomerGroup = sequelize.define('SiteCustomerGroup', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  site_id: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(40), allowNull: false },
  // 折扣倍率：0.30 ~ 1.00（1.00 = 不打折）
  multiplier: { type: DataTypes.DECIMAL(5, 3), allowNull: false, defaultValue: 1 },
  note: { type: DataTypes.STRING(120), allowNull: true },
}, {
  tableName: 'site_customer_groups',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['site_id'] }],
});

export default SiteCustomerGroup;
