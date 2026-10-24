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
  status: { type: DataTypes.ENUM('active', 'suspended', 'expired'), defaultValue: 'active' },
  announcement: { type: DataTypes.TEXT, allowNull: true },
  // 🎨 三期主题系统
  template: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'classic' },
  color: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'cyan' },
  accent: { type: DataTypes.STRING(16), allowNull: true },            // 自定义主色 HEX，优先于 color
  footer_text: { type: DataTypes.STRING(255), allowNull: true },       // 页脚版权
  // 🎨 二十七期：把"风格"从 6 个固定模板，扩展成可自由组合的 6 个维度。
  //    全部走 CSS 变量 / data 属性，不改结构也不影响主站。
  ui_radius: { type: DataTypes.STRING(12), allowNull: true },   // square | soft | round | pill
  ui_density: { type: DataTypes.STRING(12), allowNull: true },  // compact | normal | relaxed
  card_style: { type: DataTypes.STRING(12), allowNull: true },  // outline | glass | solid
  font_style: { type: DataTypes.STRING(12), allowNull: true },  // sans | rounded | serif | mono
  btn_shape: { type: DataTypes.STRING(12), allowNull: true },   // pill | rounded | square
  hero_layout: { type: DataTypes.STRING(12), allowNull: true }, // center | split | banner
  // 🎨 四十一期：全方位 DIY —— 首屏版式 / 服务列表版式（结构级，不只是换色）
  hero_variant: { type: DataTypes.STRING(16), allowNull: true },     // center | split | editorial | terminal
  services_variant: { type: DataTypes.STRING(16), allowNull: true }, // cards | table | ranked
  // 📝 每个首页区块的自定义标题/副标题（JSON：{key:{title,sub}}，站长可逐块改文案）
  section_titles: { type: DataTypes.TEXT, allowNull: true },
  // 💅 站长自己的 CSS（高级功能，长度上限 8000，服务端会过滤 @import 与尖括号）
  custom_css: { type: DataTypes.TEXT, allowNull: true },
  favicon_url: { type: DataTypes.STRING(512), allowNull: true },
  // 🎨 六十三期：站长可视化编辑器的"外观三板斧"（祥哥：小白只想选颜色和背景）
  bg_color: { type: DataTypes.STRING(64), allowNull: true },   // #RRGGBB 或 grad1/grad2/grad3
  bg_image: { type: DataTypes.STRING(512), allowNull: true },  // 页面背景图（/uploads/xxx）
  font_scale: { type: DataTypes.STRING(12), allowNull: true }, // sm | md | lg
  support_url: { type: DataTypes.STRING(255), allowNull: true },       // 客服链接（TG 等）
  home_modules: { type: DataTypes.TEXT, allowNull: true },             // 首页模块 JSON:[{key,enabled,order}]
  advantages: { type: DataTypes.TEXT, allowNull: true },               // 优势三卡片 JSON:[{icon,title,body}]
  // ✍️ 首页文案自定义（十九期·祥哥："选好模板之后在哪设计自己的网站？"）
  //    模板决定"骨架长什么样"，这些字段决定"上面写什么话" —— 两者合起来才是"自己的站"。
  //    留空则用主站默认文案，所以主站行为完全不受影响。
  hero_badge: { type: DataTypes.STRING(120), allowNull: true },        // 顶部小标签
  hero_title: { type: DataTypes.STRING(120), allowNull: true },        // 大标题
  hero_subtitle: { type: DataTypes.STRING(255), allowNull: true },     // 副标题
  hero_desc: { type: DataTypes.STRING(255), allowNull: true },         // 灰色小字说明
  hero_btn1_text: { type: DataTypes.STRING(40), allowNull: true },     // 主按钮文字
  hero_btn1_url: { type: DataTypes.STRING(255), allowNull: true },     // 主按钮链接
  hero_btn2_text: { type: DataTypes.STRING(40), allowNull: true },     // 次按钮文字
  hero_btn2_url: { type: DataTypes.STRING(255), allowNull: true },     // 次按钮链接
  hero_bg_url: { type: DataTypes.STRING(512), allowNull: true },       // 首页背景图
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
  cert_mode: { type: DataTypes.STRING(16), allowNull: true },      // letsencrypt / selfsigned / existing
  custom_domain: { type: DataTypes.STRING(255), allowNull: true },  // 站长绑定的自有域名（与免费子域名 domain 分开存）

  // 🎫 分站折扣促销：站长给"自己的客户"打折（1.0 = 不打折，0.5 = 五折）
  //    discount_until 是 Unix 秒，0 = 长期有效 —— 到点自动失效，不用手动关。
  discount_rate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1.0 },
  discount_label: { type: DataTypes.STRING(40), allowNull: true },   // 首页那行小字，如「开业 8 折」
  discount_until: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },

  // 💳 分站月费（87 期）：代理 99/月 只是资格，每开一个分站再 +99/月。
  //    expire_at 用毫秒时间戳（0 = 老数据/未纳入计费，永不过期，避免上线把存量站误停）。
  expire_at: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  plan: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'free' },  // trial / paid / free(老数据)
  // 已发过哪些到期提醒（如 "7,3,1" 或试用的 "t6,t1"），防止同一档位重复轰炸
  remind_keys: { type: DataTypes.STRING(40), allowNull: false, defaultValue: '' },
}, {
  tableName: 'sites',
  timestamps: true,
  underscored: true
});

export default Site;
