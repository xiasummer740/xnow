import express from 'express';
import { Site, User } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { sendTgMessage } from '../utils/tgBot.js';

const router = express.Router();

// 获取所有分站（管理员看全部，代理看自己的）
router.get('/', authenticate, async (req, res) => {
  try {
    let sites;
    if (['admin', 'super_admin'].includes(req.user.role)) {
      sites = await Site.findAll({ order: [['created_at', 'DESC']] });
    } else {
      sites = await Site.findAll({ where: { owner_id: req.user.id }, order: [['created_at', 'DESC']] });
    }
    res.json({ status: 'success', data: sites });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '查询分站失败' });
  }
});

// 获取当前站点配置（公开，用于前端渲染）
router.get('/current', async (req, res) => {
  try {
    if (req.site) {
      res.json({
        status: 'success',
        data: {
          site_name: req.site.name,
          site_logo: req.site.logo || '/logo.png',
          site_id: req.site.id,
          is_subsite: true
        }
      });
    } else {
      res.json({ status: 'success', data: { is_subsite: false } });
    }
  } catch (e) {
    res.json({ status: 'success', data: { is_subsite: false } });
  }
});

// 创建分站
router.post('/', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    // 代理也可以创建，但需要是 agent 角色
    if (req.user.role !== 'agent') {
      return res.status(403).json({ status: 'error', message: '仅管理员和代理可创建分站' });
    }
  }

  const { domain, name, logo, multiplier } = req.body;
  if (!domain || !name) {
    return res.json({ status: 'error', message: '域名和站点名称不能为空' });
  }

  const cleanDomain = String(domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

  try {
    const exists = await Site.findOne({ where: { domain: cleanDomain } });
    if (exists) {
      return res.json({ status: 'error', message: '该域名已被占用' });
    }

    const ownerId = ['admin', 'super_admin'].includes(req.user.role) && req.body.owner_id
      ? parseInt(req.body.owner_id)
      : req.user.id;

    const site = await Site.create({
      owner_id: ownerId,
      domain: cleanDomain,
      name: String(name).trim(),
      logo: logo || null,
      multiplier: parseFloat(multiplier) || 2.0,
      announcement: null,
      status: 'active'
    });

    sendTgMessage(`🏗️ <b>新分站创建</b>\n🌐 <b>域名:</b> <code>${cleanDomain}</code>\n📛 <b>名称:</b> ${name}\n👤 <b>站长UID:</b> <code>${ownerId}</code>\n💹 <b>倍率:</b> ${parseFloat(multiplier) || 2.0}`);

    res.json({ status: 'success', message: '分站创建成功', data: site });
  } catch (e) {
    res.status(500).json({ status: 'error', message: `创建失败: ${e.message}` });
  }
});

// 更新分站
router.put('/:id', authenticate, async (req, res) => {
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) return res.status(404).json({ status: 'error', message: '分站不存在' });

    if (!['admin', 'super_admin'].includes(req.user.role) && site.owner_id !== req.user.id) {
      return res.status(403).json({ status: 'error', message: '无权操作此分站' });
    }

    const { name, logo, multiplier, agent_discount, announcement, status } = req.body;
    if (name !== undefined) site.name = String(name).trim();
    if (logo !== undefined) site.logo = logo;
    if (multiplier !== undefined) site.multiplier = parseFloat(multiplier);
    if (agent_discount !== undefined) site.agent_discount = parseFloat(agent_discount);
    if (announcement !== undefined) site.announcement = announcement;
    if (status !== undefined && ['admin', 'super_admin'].includes(req.user.role)) site.status = status;

    await site.save();
    res.json({ status: 'success', message: '分站更新成功', data: site });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '更新失败' });
  }
});

// 删除分站
router.delete('/:id', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ status: 'error', message: '仅管理员可删除分站' });
  }
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) return res.status(404).json({ status: 'error', message: '分站不存在' });
    await site.destroy();
    sendTgMessage(`🗑️ <b>分站已删除</b>\n🌐 域名: <code>${site.domain}</code>\n📛 名称: ${site.name}`);
    res.json({ status: 'success', message: '分站已删除' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: '删除失败' });
  }
});

export default router;
