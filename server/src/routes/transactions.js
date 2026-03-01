import express from 'express';
import { Transaction } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const txs = await Transaction.findAll({ where: { user_id: req.user.id }, order: [['created_at', 'DESC']], limit: 50 });
  res.json({ status: 'success', data: txs });
});
export default router;
