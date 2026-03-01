import express from 'express';
import { User } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

router.get('/status', authenticate, async (req, res) => {
  if (req.user.role === 'super_admin') {
    return res.json({ status: 'success', balance: '999999.00', role: 'super_admin', api_key: 'super_admin_key' });
  }
  const user = await User.findByPk(req.user.id);
  res.json({ status: 'success', balance: user.balance, role: user.role, vip_expire_at: user.vip_expire_at, api_key: user.api_key });
});

router.post('/regenerate-key', authenticate, async (req, res) => {
  if (req.user.role === 'super_admin') return res.json({ status: 'success', api_key: 'super_admin_key_fixed' });
  const user = await User.findByPk(req.user.id);
  user.api_key = 'xnow_' + crypto.randomBytes(16).toString('hex');
  await user.save();
  res.json({ status: 'success', api_key: user.api_key });
});

export default router;
