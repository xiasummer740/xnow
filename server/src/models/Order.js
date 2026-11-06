import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Order = sequelize.define('Order', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_no: { type: DataTypes.STRING(50), unique: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  // 🏬 分站归属：0 = 主站，>0 = sites.id。分站主的结算与统计全靠这一列。
  site_id: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  phone: { type: DataTypes.STRING(20) }, 
  upstream_order_id: { type: DataTypes.STRING(50) },
  service_id: { type: DataTypes.INTEGER },
  service_name: { type: DataTypes.STRING(1000) },
  link: { type: DataTypes.TEXT, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  charge: { type: DataTypes.DECIMAL(14, 6), defaultValue: 0.000000 }, 
  upstream_charge: { type: DataTypes.DECIMAL(14, 6), defaultValue: 0.000000 }, 
  // 🏬 分站主这单付给平台的成本（0 = 主站订单）。站主毛利 = charge − site_cost。
  site_cost: { type: DataTypes.DECIMAL(14, 6), defaultValue: 0.000000 },
  start_count: { type: DataTypes.STRING(50), defaultValue: '0' },
  status: { type: DataTypes.STRING(50), defaultValue: '排队中' },
  remains: { type: DataTypes.STRING(50), defaultValue: '0' },
  // 核心加法：智能退款标记，防止重复退款
  is_refunded: { type: DataTypes.BOOLEAN, defaultValue: false },
  // 💬 客户可见的退款/取消原因。
  //    以前退款后客户只看到「已退款」两个字，不知道是自己链接填错、
  //    还是平台掉链子 —— 客户会默认是平台不行，然后跑去别家。
  //    这个字段只放**给客户看的**话术，内部原因仍写 admin_note。
  refund_reason: { type: DataTypes.STRING(255), defaultValue: null },
  admin_note: { type: DataTypes.TEXT, defaultValue: '' },

  // ── 🎯 千川流量业务（2026-11-04）──────────────────────────────────────────
  // 订单复用本表，靠 biz_type 区分两类完全不同的履约方式：
  //   'upstream'（默认，历史数据全是这个）= 转发上游 API，由 autoSyncOrders 跟踪进度
  //   'manual'                          = 千川业务，人工派单，status 走 待派单→处理中→已完成
  // 🔴 manual 单**绝不能**用 '提交中' 这个 status：orderSync 的 sweepStuckSubmitting
  //    会把超 10 分钟仍无 upstream_order_id 的 '提交中' 单当成卡死自动全额退款 ——
  //    人工派单本来就拿不到上游单号，一进补偿窗口钱就被退掉了。
  biz_type: { type: DataTypes.STRING(20), defaultValue: 'upstream' },
  boost_product_id: { type: DataTypes.INTEGER },
  // 千川单的客户填写内容（链接/抖音号/备注要求），JSON 字符串
  ext_fields: { type: DataTypes.TEXT },
  // 客户最终从哪个渠道加了客服（wechat / tg / none），运营标记，用于渠道统计
  contact_channel: { type: DataTypes.STRING(20) }
});

export default Order;
