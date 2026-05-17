import express from 'express';
import { Config } from '../models/index.js';

const router = express.Router();

router.get('/config', async (req, res) => {
  try {
    const configs = await Config.findAll({
      where: {
        key: ['site_name', 'site_logo', 'tg_bot_link', 'announcement', 'agent_discount', 'global_multiplier', 'usdt_image_url']
      }
    });

    const data = {};
    configs.forEach(c => data[c.key] = c.value);

    // 分站覆盖：使用分站专属配置
    if (req.site) {
      data.site_name = req.site.name || data.site_name;
      data.site_logo = req.site.logo || data.site_logo;
      data.global_multiplier = String(req.site.multiplier || data.global_multiplier);
      data.agent_discount = String(req.site.agent_discount || data.agent_discount);
      data.announcement = req.site.announcement || data.announcement;
      data.site_id = String(req.site.id);
      data.is_subsite = 'true';
    }

    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: '获取配置失败' });
  }
});

export default router;
