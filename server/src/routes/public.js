import express from 'express';
import { Config } from '../models/index.js';

const router = express.Router();

router.get('/config', async (req, res) => {
  try {
    // 🔒 `global_multiplier`（平台倍率）绝不下发：
    //    代理知道自己的报价，再知道平台倍率，一除就能倒推出平台的进货成本。
    //    祥哥定调：站长只能看到他自己的价格，绝对不能看到平台成本。
    //    `agent_discount` 可以留着 —— 它是公开的营销折扣，且主站零售价本来就公开，
    //    单凭它推不出成本（还需要那个被藏起来的倍率）。
    const configs = await Config.findAll({
      where: {
        key: ['site_name', 'site_logo', 'tg_bot_link', 'announcement', 'agent_discount', 'usdt_image_url', 'display_platforms']
      }
    });

    const data = {};
    configs.forEach(c => data[c.key] = c.value);

    // 🌐 主站地址（站长推广链接要用）。服务端下发而不是前端取 window.location.origin：
    //    万一站长在自己的分站域名下打开了「我的分站」，取 origin 会生成一个分站链接，
    //    拉来的人就成了分站的客户，返佣也就落不到主站体系里。
    data.main_origin = process.env.MAIN_ORIGIN || 'https://xnow.taikon.top';

    // 分站覆盖：使用分站专属配置
    if (req.site) {
      data.site_name = req.site.name || data.site_name;
      // 站长没传 logo 就留空，让前端显示站名首字（不要回落到平台的 /logo.png）
      data.site_logo = req.site.logo || '';
      // 🔒 分站上不要下发 agent_discount：主站那边它是"公开营销折扣"没问题，
      //    但在站长的店里，它等于把「平台给代理打 8 折」这条分销关系摊给客户看 ——
      //    客户一算就明白站长是二级代理。分站零售价与它无关，前端也不消费它。
      delete data.agent_discount;
      data.announcement = req.site.announcement || data.announcement;
      data.site_id = String(req.site.id);
      data.is_subsite = 'true';
      // 🎨 三期：分站主题（模板 / 色系 / 页脚 / 客服 / 首页模块）
      data.theme_template = req.site.template || 'classic';
      data.theme_color = req.site.color || 'cyan';
      data.theme_accent = req.site.accent || '';
      data.footer_text = req.site.footer_text || '';
      data.support_url = req.site.support_url || '';
      data.home_modules = req.site.home_modules || '';
      // 🧱 五十一期：优势三卡片（站长可改图标/标题/正文；空则回落平台默认文案）
      data.advantages = req.site.advantages || '';
      // 🎨 二十七期：风格细分维度（圆角/间距/卡片/字体/按钮/英雄布局）
      data.ui_radius = req.site.ui_radius || '';
      data.ui_density = req.site.ui_density || '';
      data.card_style = req.site.card_style || '';
      data.font_style = req.site.font_style || '';
      data.btn_shape = req.site.btn_shape || '';
      data.hero_layout = req.site.hero_layout || '';
      // 🎨 六十三期：可视化编辑器的外观三板斧（背景色 / 背景图 / 字号档位）
      data.bg_color = req.site.bg_color || '';
      data.bg_image = req.site.bg_image || '';
      data.font_scale = req.site.font_scale || '';
      // ✍️ 十九期：首页文案自定义（空则前端回落到主站默认文案）
      data.logo_url = req.site.logo || '';
      data.hero_badge = req.site.hero_badge || '';
      data.hero_title = req.site.hero_title || '';
      data.hero_subtitle = req.site.hero_subtitle || '';
      data.hero_desc = req.site.hero_desc || '';
      data.hero_btn1_text = req.site.hero_btn1_text || '';
      data.hero_btn1_url = req.site.hero_btn1_url || '';
      data.hero_btn2_text = req.site.hero_btn2_text || '';
      data.hero_btn2_url = req.site.hero_btn2_url || '';
      data.hero_bg_url = req.site.hero_bg_url || '';
      // 🎨 四十一期：全方位 DIY（结构级版式 + 逐区块文案 + 自定义 CSS + 站点图标）
      data.hero_variant = req.site.hero_variant || '';
      data.services_variant = req.site.services_variant || '';
      data.section_titles = req.site.section_titles || '';
      data.custom_css = req.site.custom_css || '';
      data.favicon_url = req.site.favicon_url || '';
    }

    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: '获取配置失败' });
  }
});

// 🏬 三/八期：分站首页模块的数据源（只读公开数据，不含任何业务敏感信息）
//   没有分站（主站访问）→ 返回主站口径的汇总，模块组件在分站才渲染
router.get('/site-stats', async (req, res) => {
  try {
    const { sequelize } = await import('../models/index.js');
    const siteId = req.site ? Number(req.site.id) : 0;
    const [svc] = await sequelize.query('SELECT COUNT(*) AS n FROM services');
    const [ord] = await sequelize.query('SELECT COUNT(*) AS n FROM orders WHERE site_id = ?', { replacements: [siteId] });
    const [usr] = await sequelize.query('SELECT COUNT(*) AS n FROM users WHERE site_id = ?', { replacements: [siteId] });
    res.json({
      status: 'success',
      data: {
        services: Number(svc[0]?.n || 0),
        orders: Number(ord[0]?.n || 0),
        users: Number(usr[0]?.n || 0)
      }
    });
  } catch (e) {
    res.json({ status: 'error', message: '统计失败' });
  }
});

// 🏬 分站首页「热门服务」：按该站真实成交单数取前 6，价格按该站倍率换算
//   新站没有成交记录 → 退回「平台在售、按排序靠前」的 6 个，价格仍按该站倍率算。
//   为什么不返回空：空数组会让新站长的首页「热门服务」区块整块消失/空白，
//   开站第一天看起来像坏了一半。退回来的都是真实在售商品，只是热度来源不同。
router.get('/hot-services', async (req, res) => {
  try {
    const { sequelize } = await import('../models/index.js');
    const siteId = req.site ? Number(req.site.id) : 0;
    const multiplier = req.site ? Number(req.site.multiplier) || 1 : 1;
    const toRow = (r) => {
      const base = parseFloat(r.custom_rate != null && r.custom_rate !== '' ? r.custom_rate : r.rate) || 0;
      return {
        id: Number(r.service_id),
        name: r.name,
        type: r.type,
        sold: Number(r.cnt || 0),
        pricePerK: Number((base * multiplier).toFixed(4))
      };
    };
    const [rows] = await sequelize.query(
      `SELECT s.service_id, s.name, s.type, s.rate, s.custom_rate, COUNT(o.id) AS cnt
         FROM orders o JOIN services s ON s.service_id = o.service_id
        WHERE o.site_id = ?
        GROUP BY s.service_id, s.name, s.type, s.rate, s.custom_rate
        ORDER BY cnt DESC LIMIT 6`,
      { replacements: [siteId] }
    );
    if (rows.length > 0) {
      return res.json({ status: 'success', data: rows.map(toRow) });
    }
    // 还没成交：拿排序靠前的在售服务兜底（sold=0，前端不会显示假销量）
    const [fallback] = await sequelize.query(
      `SELECT service_id, name, type, rate, custom_rate
         FROM services ORDER BY sort ASC LIMIT 6`
    );
    res.json({ status: 'success', data: fallback.map(toRow), fallback: true });
  } catch (e) {
    res.json({ status: 'error', message: '查询失败' });
  }
});

export default router;
