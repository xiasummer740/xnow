import BoostProduct from '../models/BoostProduct.js';

// ============================================================================
// 🎯 千川流量业务 · 商品初始化（2026-11-04）
//
// 数据来源：祥哥提供的上游价目表（2026-11-04 版）。
// 🔴 只做**幂等插入**：按 code 判断，已存在就完全不动。
//    这样管理员在后台改过的价格，重启/重新部署都不会被覆盖。
//
// 📐 阶梯价的写法：tiers 只写 min，语义 = 「下单量 ≥ min 就整单享受该档单价」。
//    例：普通播放 { min: 30000, price: 15 } → 买 3 万～10 万之间都是 15 元/万。
//
// ⚠️ 客户侧永不出现上游工作室名称。商品名统一挂 XNOW 前缀。
// ============================================================================

// 下单要采集的字段模板
// 🔴 每条都要能「唯一定位到客户的账号」，否则运营拿到单子没法开跑：
//    链接错了投不出去、账号错了投到别人家，两种都是直接赔钱。

// 抖音号：只认抖音号本体（字母/数字/_/-/.）或抖音主页链接。
// 不收昵称 —— 昵称会重名、会改，运营搜出来可能不是同一个人。
const F_DOUYIN = [{
  key: 'douyin_id',
  label: '抖音号',
  type: 'text',
  required: true,
  placeholder: '例如：xnow888（在抖音「我」页面点开头像可见）',
  // 抖音号实际规则：4–24 位，字母/数字/下划线/点（不能有中文昵称、不能太短）
  pattern: '^(?:[A-Za-z0-9_.\\-]{4,24}|https?://(?:v|www)\\.douyin\\.com/\\S+)$',
  patternHint: '请填抖音号本身（字母/数字，如 xnow888），不要填昵称。很多人会填错，抖音号在「我」→ 点头像 → 抖音号 里能复制',
}];

// 视频号：微信生态，采集视频号名称或 ID，绝不能用「抖音号」字段，
// 否则运营在后台看到「抖音号」会去搜抖音，客户填的却是视频号，两头对不上。
const F_VIDEO_ACCOUNT = [{
  key: 'account_id',
  label: '视频号名称 / 视频号 ID',
  type: 'text',
  required: true,
  placeholder: '例如：XNOW官方 或 sphXXXXXX',
  pattern: '^[\\u4e00-\\u9fa5A-Za-z0-9_.\\-]{2,40}$',
  patternHint: '填视频号名称或 ID（在微信「发现」→「视频号」→ 右上角人像 → 我的视频号 里查看）',
}];

// 视频/作品链接：必须是抖音链接，否则一定投不出去
const F_LINK = [{
  key: 'link',
  label: '视频/作品链接',
  type: 'url',
  required: true,
  placeholder: '例如：https://v.douyin.com/xxxxxxx/',
  pattern: 'https?://\\S*douyin\\.com/\\S+',
  patternHint: '必须是抖音链接（在视频右下角「分享」→「复制链接」拿到的那个），多条用空格隔开',
  multiple: true,
}];

const F_REMARK = [{ key: 'remark', label: '备注要求（选填）', type: 'textarea', required: false, placeholder: '有特殊要求请写清楚，例如指定视频、投放节奏' }];

const PRODUCTS = [
  // ── 1. 普通播放 ─────────────────────────────────────────────────────────────
  {
    code: 'dy_play_normal',
    name: 'XNOW 抖音播放 · 普通',
    subtitle: '无互动 / 无点赞，走量快，适合拉曝光',
    category: 'play',
    pricing_mode: 'tier',
    unit_qty: 10000, unit_label: '万',
    tiers: [
      { min: 10000, price: 18 },
      { min: 30000, price: 15 },
      { min: 100000, price: 8 },
      { min: 500000, price: 7 },
      { min: 1000000, price: 5 },
    ],
    min_qty: 10000, max_qty: 100000000, qty_step: 10000,
    input_schema: [...F_DOUYIN, ...F_LINK, ...F_REMARK],
    eta_text: '24 小时内授权开跑',
    notice: '不带互动、不带点赞。下单后请务必添加客服确认链接，链接有误会导致投放失败。',
    badge: '热销', sort: 10,
  },

  // ── 2. 营销播放（包来客）───────────────────────────────────────────────────
  {
    code: 'dy_play_marketing',
    name: 'XNOW 抖音营销播放',
    subtitle: '带互动 + 带点赞，能带来真实访客和关注',
    category: 'marketing',
    pricing_mode: 'tier',
    unit_qty: 10000, unit_label: '万',
    tiers: [
      { min: 10000, price: 20 },
      { min: 100000, price: 14 },
      { min: 500000, price: 13 },
    ],
    min_qty: 10000, max_qty: 100000000, qty_step: 10000,
    input_schema: [...F_DOUYIN, ...F_LINK, ...F_REMARK],
    eta_text: '24 小时内授权开跑',
    notice: '带真实互动与点赞，包来客（可用于千川广告投放）。下单后请加客服确认链接。',
    badge: '推荐', sort: 20,
  },

  // ── 3. 排广自然流播放 ──────────────────────────────────────────────────────
  {
    code: 'dy_play_natural',
    name: 'XNOW 自然流播放',
    subtitle: '纯自然推荐流量，不带广告标识，包中位数',
    category: 'natural',
    pricing_mode: 'tier',
    unit_qty: 10000, unit_label: '万',
    tiers: [{ min: 100000, price: 14 }],
    min_qty: 100000, max_qty: 100000000, qty_step: 10000,
    input_schema: [...F_DOUYIN, ...F_LINK, ...F_REMARK],
    eta_text: '24 小时内授权开跑',
    notice: '10 万起售。走自然推荐流，带互动数据并包中位数。',
    sort: 30,
  },

  // ── 4. 千川点赞 ────────────────────────────────────────────────────────────
  //    价目表原样：1千*90 / 1万*650 / 5万*600。
  //    统一折算成「元/千」才有一套口径：90 → 65 → 60，阶梯递减自洽。
  {
    code: 'dy_like_qc',
    name: 'XNOW 千川点赞',
    subtitle: '真实点赞，1 千起做，量大单价更低',
    category: 'like',
    pricing_mode: 'tier',
    unit_qty: 1000, unit_label: '千',
    tiers: [
      { min: 1000, price: 90 },
      { min: 10000, price: 65 },
      { min: 50000, price: 60 },
    ],
    min_qty: 1000, max_qty: 10000000, qty_step: 1000,
    input_schema: [...F_DOUYIN, ...F_LINK, ...F_REMARK],
    eta_text: '24 小时内授权开跑',
    notice: '真实账号点赞。下单后请加客服确认视频链接。',
    sort: 40,
  },

  // ── 5. 抖加扫码配合（固定总价 SKU）─────────────────────────────────────────
  {
    code: 'dy_scan_200', name: 'XNOW 抖加扫码 · 200 有效',
    subtitle: '到店/扫码互动 200 次有效', category: 'scan',
    pricing_mode: 'flat', flat_price: 75, min_qty: 200, max_qty: 200, qty_step: 200,
    input_schema: [...F_DOUYIN, ...F_REMARK],
    eta_text: '扫码配合 · 需客户及时在线',
    notice: '扫码配合要求客户**及时在线**，客服会跟您约时间。未在线会导致无法完成。',
    sort: 50,
  },
  {
    code: 'dy_scan_500', name: 'XNOW 抖加扫码 · 500 有效',
    subtitle: '到店/扫码互动 500 次有效', category: 'scan',
    pricing_mode: 'flat', flat_price: 120, min_qty: 500, max_qty: 500, qty_step: 500,
    input_schema: [...F_DOUYIN, ...F_REMARK],
    eta_text: '扫码配合 · 需客户及时在线',
    notice: '扫码配合要求客户**及时在线**，客服会跟您约时间。',
    sort: 51,
  },
  {
    code: 'dy_scan_1000_500', name: 'XNOW 抖加扫码 · 1000 包 500 有效',
    subtitle: '拍 1000，保底 500 有效', category: 'scan',
    pricing_mode: 'flat', flat_price: 165, min_qty: 1000, max_qty: 1000, qty_step: 1000,
    input_schema: [...F_DOUYIN, ...F_REMARK],
    eta_text: '扫码配合 · 需客户及时在线',
    notice: '拍 1000 保底 500 有效。要求客户及时在线配合。',
    sort: 52,
  },
  {
    code: 'dy_scan_1000_200', name: 'XNOW 抖加扫码 · 1000 包 200 有效',
    subtitle: '拍 1000，保底 200 有效', category: 'scan',
    pricing_mode: 'flat', flat_price: 165, min_qty: 1000, max_qty: 1000, qty_step: 1000,
    input_schema: [...F_DOUYIN, ...F_REMARK],
    eta_text: '扫码配合 · 需客户及时在线',
    notice: '拍 1000 保底 200 有效。要求客户及时在线配合。',
    sort: 53,
  },
  {
    code: 'dy_scan_1000_full', name: 'XNOW 抖加扫码 · 1000 包有效',
    subtitle: '拍 1000，1000 全保有效', category: 'scan',
    pricing_mode: 'flat', flat_price: 220, min_qty: 1000, max_qty: 1000, qty_step: 1000,
    input_schema: [...F_DOUYIN, ...F_REMARK],
    eta_text: '扫码配合 · 需客户及时在线',
    notice: '拍 1000 全保有效（原价目表：扫码1000包有效）。要求客户及时在线配合。',
    badge: '保真', sort: 54,
  },

  // ── 6. 千川不开播涨粉（固定总价 SKU，仅限已授权账号）───────────────────────
  //    ⚠️ 上游注明「稳定 24-48 小时左右清除」，必须在客户须知里写清楚
  ...[
    { code: 'fans_500_no', name: 'XNOW 千川不开播涨粉 · 500（不包有效）', price: 90, qty: 500 },
    { code: 'fans_1k_no', name: 'XNOW 千川不开播涨粉 · 1000（不包有效）', price: 110, qty: 1000 },
    { code: 'fans_10k_no', name: 'XNOW 千川不开播涨粉 · 1 万（不包有效）', price: 800, qty: 10000 },
    { code: 'fans_200_200', name: 'XNOW 千川不开播涨粉 · 200（包 200 有效）', price: 65, qty: 200 },
    { code: 'fans_500_200', name: 'XNOW 千川不开播涨粉 · 拍 500 包 200 有效', price: 95, qty: 500 },
    { code: 'fans_500_500', name: 'XNOW 千川不开播涨粉 · 500（包 500 有效）', price: 110, qty: 500 },
    { code: 'fans_1k_200', name: 'XNOW 千川不开播涨粉 · 1000（包 200 有效）', price: 120, qty: 1000 },
    { code: 'fans_1k_500', name: 'XNOW 千川不开播涨粉 · 1000（包 500 有效）', price: 120, qty: 1000 },
    { code: 'fans_1k_1000', name: 'XNOW 千川不开播涨粉 · 1000（包 1000 有效）', price: 180, qty: 1000 },
  ].map((x, i) => ({
    code: x.code,
    name: x.name,
    subtitle: x.name.includes('不包') ? '速度优先，不承诺留存' : '保有效数量',
    category: 'fans',
    pricing_mode: 'flat',
    flat_price: x.price,
    min_qty: x.qty, max_qty: x.qty, qty_step: x.qty,
    input_schema: [...F_DOUYIN, ...F_REMARK],
    eta_text: '24h 内授权 · 24–48h 清',
    notice: '仅限已授权的千川账号下单，未授权无法开跑。涨粉数据稳定期约 24–48 小时，之后可能回清，'
          + (x.name.includes('不包') ? '本档不承诺留存数量。' : '本档按标注数量保有效。'),
    sort: 60 + i,
  })),

  // ── 7. 千川场观 ────────────────────────────────────────────────────────────
  //    🔴 原价目表里这一项价格是「/」（未给价）。**必须让它出现在页面上** ——
  //       客户看不到会以为我们不接场观。做法：上架 + flat_price=0，前端显示「询价」，
  //       下单接口本身也会因为 charge 不 > 0 而拒绝，不存在 0 元买走。
  {
    code: 'dy_liveview_10k', name: 'XNOW 千川场观 · 1 万',
    subtitle: '直播间场观 1 万', category: 'liveview',
    pricing_mode: 'flat', flat_price: 0, min_qty: 10000, max_qty: 10000, qty_step: 10000,
    input_schema: [...F_DOUYIN, ...F_REMARK],
    eta_text: '价格待定 · 联系客服报价',
    notice: '仅限已授权的账号下单。该项价格待定，请先加客服报价，报价确认后再拍。',
    badge: '需授权', sort: 70,
  },

  // ── 8. 视频号 Adq ──────────────────────────────────────────────────────────
  //    ⚠️ 这是**微信视频号**（微信生态），不是抖音。价格表原图写的是「视频号Adq」。
  ...[
    { code: 'adq_100', qty: 100, price: 40 },
    { code: 'adq_200', qty: 200, price: 60 },
    { code: 'adq_500', qty: 500, price: 110 },
    { code: 'adq_1000', qty: 1000, price: 180 },
  ].map((x, i) => ({
    code: x.code,
    name: `XNOW 视频号 Adq 涨粉 · ${x.qty}`,
    subtitle: `视频号涨粉 ${x.qty} 个粉丝`,
    category: 'account',
    platform: 'wechat',
    pricing_mode: 'flat',
    flat_price: x.price,
    min_qty: x.qty, max_qty: x.qty, qty_step: x.qty,
    input_schema: [...F_VIDEO_ACCOUNT, ...F_REMARK],
    eta_text: '24 小时内授权',
    // 🔴 视频号 Adq 与涨粉一样，**必须客户账号已授权**才能跑 —— 未授权下单只能退。
    notice: '仅限已授权的视频号下单，未授权无法开跑。下单后请务必加客服确认视频号名称 / ID。',
    badge: '需授权',
    sort: 80 + i,
  })),
];

export async function seedBoostProducts() {
  let created = 0;
  let skipped = 0;
  for (const p of PRODUCTS) {
    const exist = await BoostProduct.findOne({ where: { code: p.code } });
    if (exist) { skipped += 1; continue; }   // 已存在 → 一个字段都不改（保护后台改过的价格）
    await BoostProduct.create({
      platform: 'douyin',
      unit_qty: 10000,
      unit_label: '万',
      qty_step: 1000,
      max_qty: 100000000,
      active: true,
      sort: 0,
      ...p,
      // ↓ 这三个必须写在 ...p 之后：p 里存的是数组/可能缺省，落库要字符串和默认值
      tiers: p.tiers ? JSON.stringify(p.tiers) : null,
      input_schema: JSON.stringify(p.input_schema || []),
      flat_price: p.flat_price != null ? p.flat_price : 0,
    });
    created += 1;
  }
  if (created) console.log(`🎯 [Boost] 已初始化 ${created} 个千川商品（已有 ${skipped} 个跳过，未改动）`);
  return { created, skipped };
}

export default seedBoostProducts;
// 供「只同步 input_schema」这类补丁脚本按 code 取字段定义（seed 本身是 create-only，
// 改了字段模板不会影响已存在的商品，要另外推一次）
export { PRODUCTS as BOOST_SEED_PRODUCTS };
