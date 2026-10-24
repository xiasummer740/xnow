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

    // 分站覆盖：使用分站专属配置
    if (req.site) {
      data.site_name = req.site.name || data.site_name;
      data.site_logo = req.site.logo || data.site_logo;
      data.agent_discount = String(req.site.agent_discount || data.agent_discount);
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
//   新站没有成交记录 → 返回空数组，前端整块隐藏（不展示假数据）
router.get('/hot-services', async (req, res) => {
  try {
    const { sequelize } = await import('../models/index.js');
    const siteId = req.site ? Number(req.site.id) : 0;
    const multiplier = req.site ? Number(req.site.multiplier) || 1 : 1;
    const [rows] = await sequelize.query(
      `SELECT s.service_id, s.name, s.type, s.rate, s.custom_rate, COUNT(o.id) AS cnt
         FROM orders o JOIN services s ON s.service_id = o.service_id
        WHERE o.site_id = ?
        GROUP BY s.service_id, s.name, s.type, s.rate, s.custom_rate
        ORDER BY cnt DESC LIMIT 6`,
      { replacements: [siteId] }
    );
    const data = rows.map(r => {
      const base = parseFloat(r.custom_rate != null && r.custom_rate !== '' ? r.custom_rate : r.rate) || 0;
      return {
        id: Number(r.service_id),
        name: r.name,
        type: r.type,
        sold: Number(r.cnt || 0),
        pricePerK: Number((base * multiplier).toFixed(4))
      };
    });
    res.json({ status: 'success', data });
  } catch (e) {
    res.json({ status: 'error', message: '查询失败' });
  }
});

export default router;
