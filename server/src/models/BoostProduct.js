import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// ============================================================================
// 🎯 千川流量业务商品表（独立业务线，2026-11-04）
//
// 🔴 为什么不放进现成的 `services` 表：
//    `services` 是「上游同步」的产物，`utils/sync.js` 每 10 分钟拉一次上游清单，
//    把「本地有、上游没有」的服务**物理删除**：
//        await Service.destroy({ where: { service_id: willDelete } });
//    手工建的商品一进去，下一轮同步就被删光。
//    这条业务线与现有「按 1000 计数下单 → 转发上游 API」完全是两套模型：
//      · services：单价 = rate（元/1000），下单走 axios.post(upstream_url)
//      · 本表：阶梯价（元/万、元/千）或固定总价，下单**纯人工派单**，不碰任何 API
//
// 📐 计价模型（pricing_mode）：
//    'tier' 阶梯价 —— tiers 是 [{ min, price }] 数组，**只写 min 不写 max**。
//           语义 = 「下单量 ≥ min 就整单享受该档单价」，取满足条件的最大 min。
//           这样天然没有空档：买 2.5 万落在 {min:10000} 档，不会出现「2-3 万没定义」。
//           最终金额 = (qty / unit_qty) × price
//    'flat' 固定总价 —— 每个 SKU 就是一个价，qty 只是「包内交付量」（如「1000包500有效」）。
//
// ⚠️ 客户侧任何字段都不能出现上游品牌名（仓库 PUBLIC + 商业红线）。
// ============================================================================

const BoostProduct = sequelize.define('BoostProduct', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  // 稳定标识，初始化脚本靠它做幂等（重复执行不会重复插入）
  code: { type: DataTypes.STRING(60), allowNull: false, unique: true },

  name: { type: DataTypes.STRING(200), allowNull: false },
  subtitle: { type: DataTypes.STRING(300) },

  // 分类（前端 tab）：play / marketing / natural / like / scan / fans / liveview / account
  category: { type: DataTypes.STRING(40), allowNull: false },
  platform: { type: DataTypes.STRING(30), defaultValue: 'douyin' },

  // tier = 阶梯价 | flat = 固定总价
  pricing_mode: { type: DataTypes.STRING(20), defaultValue: 'tier' },

  // 计价基数：10000 = 价格是「元/万」，1000 = 「元/千」，1 = 「元/个」
  unit_qty: { type: DataTypes.INTEGER, defaultValue: 10000 },
  unit_label: { type: DataTypes.STRING(20), defaultValue: '万' },

  // JSON: [{ min: 10000, price: 18 }, ...]（只写 min，见文件头说明）
  tiers: { type: DataTypes.TEXT },

  // ── 成本价 vs 售价（2026-11-04）──────────────────────────────────────────
  // 🔴 上线时录进来的数字都是**进货成本**，绝不能直接当售价给客户看 ——
  //    那等于把底价贴在门口。所以两套价格分开存：
  //       cost_*  = 成本（只在后台可见，客户侧接口不返回）
  //       flat_price / tiers = 售价（客户看到、下单按它算钱）
  //    后台支持「按成本 × 倍率」批量重算售价，改价不用一个个填。
  cost_flat_price: { type: DataTypes.DECIMAL(14, 4), defaultValue: 0 },
  cost_tiers: { type: DataTypes.TEXT },

  // pricing_mode = 'flat' 时用
  flat_price: { type: DataTypes.DECIMAL(14, 4), defaultValue: 0 },

  min_qty: { type: DataTypes.INTEGER, defaultValue: 1000 },
  max_qty: { type: DataTypes.INTEGER, defaultValue: 100000000 },
  qty_step: { type: DataTypes.INTEGER, defaultValue: 1000 },

  // JSON: 下单要采集的字段 [{ key, label, type, required, placeholder, hint }]
  // 默认 [link, remark]；涨粉/观号号类需要 douyin_id
  input_schema: { type: DataTypes.TEXT },

  // 客户可见文案
  eta_text: { type: DataTypes.STRING(100) },   // '24 小时内授权'
  notice: { type: DataTypes.TEXT },            // 客户须知（包有效/不包有效、清除时效）
  badge: { type: DataTypes.STRING(40) },       // '热门' / '新品'

  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  sort: { type: DataTypes.INTEGER, defaultValue: 0 }
});

export default BoostProduct;
