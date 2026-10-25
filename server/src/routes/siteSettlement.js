import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { Site, User, SiteCollection, SiteWithdrawal, sequelize } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { sendTgMessage } from '../utils/tgBot.js';

const router = express.Router();

// 收款码图片：放在 uploads 下的 qr/ 子目录，这样 nginx 的 /uploads/ alias 能直接读到
const QR_DIR = process.env.SITE_QR_DIR || path.join(process.env.SITE_UPLOAD_DIR || '/var/www/xnow-uploads', 'qr');
try { fs.mkdirSync(QR_DIR, { recursive: true }); } catch (e) {}

const uploadRaw = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, QR_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
      // 随机文件名：收款码是要扫码付钱的图，不能让外人靠自增规律猜别人的
      cb(null, `qr-s${req.params.id}-${crypto.randomBytes(9).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp)$/.test(file.mimetype || '');
    if (ok) return cb(null, true);
    const err = new Error('只收 PNG / JPG / WEBP 图片');
    err.code = 'BAD_TYPE';
    cb(err);
  },
});

// multer 的错误要翻译成人话，不能让它冒到 500
const upload = {
  single: (field) => (req, res, next) =>
    uploadRaw.single(field)(req, res, (err) => {
      if (!err) return next();
      const msg =
        err.code === 'LIMIT_FILE_SIZE' ? '图片超过 4MB，压缩一下再传'
        : err.code === 'BAD_TYPE' ? err.message
        : '上传失败，请重试';
      return res.status(400).json({ status: 'error', message: msg });
    }),
};

// 校验没过时把已经落盘的文件删掉，别在服务器上堆垃圾
const dropUpload = (file) => {
  if (!file || !file.filename) return;
  try { fs.unlinkSync(path.join(QR_DIR, file.filename)); } catch (e) {}
};

const HOUR = 3600 * 1000;
const WEEK = 7 * 24 * HOUR;
const MIN_WITHDRAW = 10;      // 最低提现 ¥10（手续费/汇率不折腾）
const fmt = (v) => Number(Number(v || 0).toFixed(6));

const ownerSite = async (req) => {
  const site = await Site.findByPk(req.params.id);
  if (!site) return { error: [404, '站点不存在'] };
  if (Number(site.owner_id) !== Number(req.user.id)) return { error: [403, '只有站长本人可以操作'] };
  return { site };
};

// 未结算金额 = 台账总额 - 已结算掉的部分 - 正在申请中的提现
const summaryOf = async (siteId) => {
  const [[row]] = await sequelize.query(
    `SELECT COALESCE(SUM(amount - used_amount),0) AS total,
            SUM(CASE WHEN amount - used_amount > 0.000001 THEN 1 ELSE 0 END) AS cnt
       FROM site_collections WHERE site_id = ?`, { replacements: [siteId] });
  const [[used]] = await sequelize.query(
    `SELECT COALESCE(SUM(used_amount),0) AS amount FROM site_collections WHERE site_id = ?`,
    { replacements: [siteId] });
  const [[pending]] = await sequelize.query(
    `SELECT COALESCE(SUM(amount),0) AS amount FROM site_withdrawals WHERE site_id = ? AND status = 'pending'`,
    { replacements: [siteId] });
  const [[paid]] = await sequelize.query(
    `SELECT COALESCE(SUM(amount),0) AS amount FROM site_withdrawals WHERE site_id = ? AND status = 'paid'`,
    { replacements: [siteId] });
  const left = Number(row.total || 0);
  const pendingAmt = Number(pending.amount || 0);
  return {
    collected: fmt(left),                     // 还没结算的代收（可提现的池子）
    collected_count: Number(row.cnt || 0),
    withdrawn: fmt(used.amount),              // 历史已结算金额（= 已转账给站长的代收款）
    pending_withdraw: fmt(pendingAmt),        // 审批中的申请
    available: fmt(Math.max(0, left - pendingAmt)),
    total_paid: fmt(paid.amount),             // 历史已确认转账总额
  };
};

// ── 站长：开关「用主站收款」 ──
router.post('/sites/:id/platform-merchant', authenticate, async (req, res) => {
  try {
    const { site, error } = await ownerSite(req);
    if (error) return res.status(error[0]).json({ status: 'error', message: error[1] });
    const enabled = !!req.body?.enabled;
    site.use_platform_merchant = enabled ? 1 : 0;
    await site.save();
    try {
      const { clearSiteCache } = await import('../middleware/site.js');
      clearSiteCache();
    } catch (e) { /* 老版本没有缓存清理 */ }
    res.json({
      status: 'success',
      message: enabled
        ? '已开启：客户可以在线充值，钱先进主站账户，记你名下待结算'
        : '已关闭：客户只能由你手动加余额',
      data: { use_platform_merchant: enabled ? 1 : 0 },
    });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ── 站长：结算概览 + 提现记录 ──
router.get('/sites/:id/settlement', authenticate, async (req, res) => {
  try {
    const { site, error } = await ownerSite(req);
    if (error) return res.status(error[0]).json({ status: 'error', message: error[1] });
    const sum = await summaryOf(site.id);
    const rows = await SiteWithdrawal.findAll({
      where: { site_id: site.id }, order: [['id', 'DESC']], limit: 20,
    });
    const last = rows.find(r => r.status === 'pending') || rows[0] || null;
    const canRequestAt = last ? new Date(last.created_at).getTime() + WEEK : 0;
    res.json({
      status: 'success',
      data: {
        ...sum,
        use_platform_merchant: Number(site.use_platform_merchant || 0),
        has_own_merchant: !!(site.bufpay_id && site.bufpay_key) || !!(site.cryptomus_id && site.cryptomus_key),
        min_withdraw: MIN_WITHDRAW,
        week_ms: WEEK,
        can_request_at: canRequestAt,
        can_request: Date.now() >= canRequestAt,
        withdrawals: rows.map(r => ({
          id: r.id, amount: fmt(r.amount), status: r.status, note: r.note,
          admin_note: r.admin_note, qr: r.qr_path ? '/api/qr/' + path.basename(r.qr_path) : '',
          created_at: r.created_at, paid_at: r.paid_at,
        })),
      },
    });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ── 站长：申请提现（一周一次 + 上传收款码） ──
router.post('/sites/:id/withdraw', authenticate, upload.single('qr'), async (req, res) => {
  try {
    const { site, error } = await ownerSite(req);
    if (error) { dropUpload(req.file); return res.status(error[0]).json({ status: 'error', message: error[1] }); }
    if (!req.file) return res.status(400).json({ status: 'error', message: '请上传你的收款码图片' });

    const amount = Number(req.body?.amount);
    if (!(amount > 0)) { dropUpload(req.file); return res.status(400).json({ status: 'error', message: '金额不对' }); }
    if (amount < MIN_WITHDRAW) { dropUpload(req.file); return res.status(400).json({ status: 'error', message: `最低提现 ¥${MIN_WITHDRAW}` }); }

    // 一周一次优先判：否则额度被上次申请占满时，站长只会看到「可提现只有 ¥0」，
    // 根本不知道真正的限制是"下周才能再申请"。
    const lastW = await SiteWithdrawal.findOne({ where: { site_id: site.id }, order: [['id', 'DESC']] });
    if (lastW && Date.now() < new Date(lastW.created_at).getTime() + WEEK) {
      dropUpload(req.file);
      const nextAt = new Date(new Date(lastW.created_at).getTime() + WEEK);
      return res.status(429).json({
        status: 'error',
        message: "一周只能申请一次，下次可申请时间：" + nextAt.toLocaleString('zh-CN', { hour12: false }),
      });
    }

    const sum = await summaryOf(site.id);
    if (amount > sum.available + 1e-6) {
      dropUpload(req.file);
      return res.status(400).json({ status: 'error', message: `可提现只有 ¥${sum.available}` });
    }

    const row = await SiteWithdrawal.create({
      site_id: site.id,
      owner_id: Number(req.user.id),
      amount,
      qr_path: req.file.filename,
      note: (req.body?.note || '').slice(0, 200) || null,
      status: 'pending',
    });

    try {
      await sendTgMessage(
        `💸 <b>站长申请提现</b>\n🏬 ${site.name}（#${site.id}）\n👤 站长: ${req.user.phone}\n` +
        `💰 金额: ¥${amount.toFixed(2)}\n📝 备注: ${req.body?.note || '无'}\n` +
        `📲 收款码已上传，去「密室 → 分站提现」扫码转账后点确认`
      );
    } catch (e) { /* TG 挂了不影响申请 */ }

    res.json({ status: 'success', message: '提现申请已提交，主站管理员核实后会扫码转账', data: { id: row.id } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ── 主站管理员：提现列表 ──
router.get('/admin/site-withdrawals', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const status = String(req.query.status || 'pending');
    const where = status === 'all' ? {} : { status };
    const rows = await SiteWithdrawal.findAll({ where, order: [['id', 'DESC']], limit: 100 });
    const siteIds = [...new Set(rows.map(r => r.site_id))];
    // findByPk 不收数组（会报 invalid），批量查询用 findAll
    const siteRows = siteIds.length ? await Site.findAll({ where: { id: siteIds } }) : [];
    const siteMap = new Map(siteRows.map(s => [Number(s.id), s]));
    const owners = new Map();
    for (const s of siteMap.values()) {
      const u = await User.findByPk(s.owner_id).catch(() => null);
      if (u) owners.set(Number(s.owner_id), u);
    }
    const items = await Promise.all(rows.map(async (r) => {
      const s = siteMap.get(Number(r.site_id));
      const u = owners.get(Number(s?.owner_id || 0));
      const sum = await summaryOf(r.site_id);
      return {
        id: r.id, site_id: r.site_id, site_name: s?.name || '-', domain: s?.domain || '',
        owner_phone: u?.phone || '-', owner_balance: fmt(u?.balance || 0),
        amount: fmt(r.amount), status: r.status, note: r.note, admin_note: r.admin_note,
        qr: r.qr_path ? '/api/qr/' + path.basename(r.qr_path) : '',
        created_at: r.created_at, paid_at: r.paid_at,
        unsettled: sum.collected,
      };
    }));
    const [[agg]] = await sequelize.query(
      `SELECT COUNT(*) AS pending_cnt, COALESCE(SUM(amount),0) AS pending_sum FROM site_withdrawals WHERE status='pending'`);
    const [[unsettled]] = await sequelize.query(
      `SELECT COALESCE(SUM(amount),0) AS s FROM site_collections WHERE withdrawal_id IS NULL`);
    res.json({
      status: 'success',
      data: {
        items,
        summary: {
          pending_cnt: Number(agg.pending_cnt || 0),
          pending_sum: fmt(agg.pending_sum),
          unsettled_all: fmt(unsettled.s),
        },
      },
    });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ── 主站管理员：未处理提现角标（密室 tab 上的红点数字，轮询用，必须轻） ──
router.get('/admin/site-withdrawals/badge', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const [[row]] = await sequelize.query(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS sum
         FROM site_withdrawals WHERE status = 'pending'`);
    res.json({
      status: 'success',
      data: {
        pending_cnt: Number(row.cnt || 0),
        pending_sum: Number(Number(row.sum || 0).toFixed(2)),
      },
    });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ── 主站管理员：确认已转账（清账） ──
router.post('/admin/site-withdrawals/:id/confirm', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const row = await SiteWithdrawal.findByPk(req.params.id);
    if (!row) return res.status(404).json({ status: 'error', message: '申请不存在' });
    if (row.status !== 'pending') return res.status(400).json({ status: 'error', message: '这条已经处理过了' });

    // 按时间顺序扣最早的代收记录，**按金额精确扣**（一行可能只被扣掉一部分）
    const [rows] = await sequelize.query(
      `SELECT id, amount, used_amount FROM site_collections
        WHERE site_id = ? AND amount - used_amount > 0.000001 ORDER BY id ASC`,
      { replacements: [row.site_id] });
    let left = Number(row.amount);
    const touched = [];
    for (const c of rows) {
      if (left <= 1e-6) break;
      const rest = Number(c.amount) - Number(c.used_amount || 0);
      if (rest <= 1e-6) continue;
      const take = Math.min(rest, left);
      await sequelize.query(
        `UPDATE site_collections SET used_amount = used_amount + ?, withdrawal_id = ? WHERE id = ?`,
        { replacements: [Number(take.toFixed(6)), row.id, c.id] });
      touched.push(c.id);
      left = Number((left - take).toFixed(6));
    }
    // 台账不够时不能装作没事：钱已经按 receipt 转出去了，但账对不上要让人知道
    const shortfall = Number(left.toFixed(6));
    const used = touched;

    row.status = 'paid';
    row.admin_id = Number(req.user.id);
    row.admin_note = (req.body?.note || '').slice(0, 200) || null;
    row.paid_at = new Date();
    await row.save();

    const site = await Site.findByPk(row.site_id).catch(() => null);
    try {
      await sendTgMessage(
        `✅ <b>提现已确认转账</b>\n🏬 ${site?.name || '#' + row.site_id}\n💰 ¥${fmt(row.amount).toFixed(2)}\n📝 ${row.admin_note || '无备注'}`
      );
    } catch (e) {}

    res.json({
      status: 'success',
      message: shortfall > 1e-6
        ? `已确认转账 ¥${fmt(row.amount).toFixed(2)}，但台账只对得上 ¥${fmt(row.amount - shortfall).toFixed(2)}（差 ¥${fmt(shortfall).toFixed(2)}，请查代收记录）`
        : `已确认转账 ¥${fmt(row.amount).toFixed(2)}，台账已清`,
      warning: shortfall > 1e-6 ? `台账差 ¥${fmt(shortfall).toFixed(2)}` : null,
      data: { settled_rows: used.length, shortfall },
    });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ── 主站管理员：驳回 ──
router.post('/admin/site-withdrawals/:id/reject', authenticate, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ status: 'error' });
  try {
    const row = await SiteWithdrawal.findByPk(req.params.id);
    if (!row) return res.status(404).json({ status: 'error', message: '申请不存在' });
    if (row.status !== 'pending') return res.status(400).json({ status: 'error', message: '这条已经处理过了' });
    row.status = 'rejected';
    row.admin_id = Number(req.user.id);
    row.admin_note = (req.body?.note || '信息不全').slice(0, 200);
    await row.save();
    res.json({ status: 'success', message: '已驳回，站长可重新申请（金额不会丢）' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

export default router;
