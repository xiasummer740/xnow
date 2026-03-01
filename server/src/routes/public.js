import express from 'express';
import { Config } from '../models/index.js';

const router = express.Router();

router.get('/config', async (req, res) => {
  try {
    const configs = await Config.findAll({
      where: {
        // 💡 核心注入：允许前端读取 usdt_image_url
        key: ['site_name', 'site_logo', 'tg_bot_link', 'announcement', 'agent_discount', 'global_multiplier', 'usdt_image_url'] 
      }
    });
    
    const data = {};
    configs.forEach(c => data[c.key] = c.value);

    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: '获取配置失败' });
  }
});

export default router;
