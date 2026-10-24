import express from 'express';
import axios from 'axios';
import { sequelize, Order, Service, Config, User, Transaction } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { sendTgMessage } from '../utils/tgBot.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// 🔌 上游类型契约（2026-10-24 照上游公开 API 文档 /api 逐字抄录）
//   Default             : key, action, service, link, quantity
//   Package             : key, action, service, link, quantity, runs?, interval?
//   Custom Comments     : key, action, service, link, comments
//   Mentions Hashtag    : key, action, service, link, quantity, hashtag
//   Invites from Groups : key, action, service, username          ← 没有 link、没有 quantity
//   Subscriptions       : key, action, service, username, min, max, delay, posts?, old_posts?, expiry?(d/m/Y)
//   Poll                : key, action, service, link, quantity, answer_number
//
// 📕 事故复盘：此前这里无条件只发 {link, quantity} —— 订阅型服务（全站 42 个）每次都被上游
// 回 `Missing username`，用户看到"下单失败"；Package/Mentions/Invites/Poll 共 45 个同理。
// 根因不是"参数写错"，是**从来没按类型组装过载荷**。改动见 buildUpstreamPayload()。
// ─────────────────────────────────────────────────────────────────────────────
const normType = (t) => String(t || '').toLowerCase().replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();

// 这些类型的计费基准是"数量"；Invites 上游不收 quantity，但本站仍需一个数量来算钱
const BILLED_BY_QUANTITY = new Set(['default', 'custom comments', 'package', 'mentions hashtag', 'poll', 'subscriptions']);

const FIELD_LABELS = {
  link: '目标链接', quantity: '数量', comments: '评论内容',
  username: '用户名', delay: '延迟', hashtag: '话题标签', answerNumber: '选项编号',
  posts: '新帖子数量'
};

const TYPE_REQUIRED = {
  'default': ['link', 'quantity'],
  'custom comments': ['link', 'comments'],
  'package': ['link', 'quantity'],
  'mentions hashtag': ['link', 'quantity', 'hashtag'],
  'invites from groups': ['username', 'quantity'],
  // 🆕 posts 必填：订阅型上游按"每条新帖投喂一次"持续下单，本站只收一次钱，
  //    所以必须让客户明确"买几次投喂"，否则成本无上限（方案 A，2026-10-24 祥哥拍板）
  'subscriptions': ['username', 'quantity', 'delay', 'posts'],
  'poll': ['link', 'quantity', 'answerNumber']
};

// 返回中文错误文案；null = 通过
const validateForType = (type, f) => {
  const t = normType(type);
  const req = TYPE_REQUIRED[t];
  if (!req) return `该服务类型（${type || '未知'}）暂不支持下单，请联系客服`;
  for (const k of req) {
    const v = f[k];
    if (v === undefined || v === null || String(v).trim() === '') return `请填写${FIELD_LABELS[k] || k}`;
  }
  if (BILLED_BY_QUANTITY.has(t)) {
    const n = Number(f.quantity);
    if (!Number.isInteger(n) || n <= 0) return '数量必须是正整数';
  }
  if (t === 'subscriptions') {
    const p = Number(f.posts);
    if (!Number.isInteger(p) || p <= 0) return '新帖子数量必须是正整数（每条新帖投喂一次，按次数收费）';
    if (p > 10000) return '新帖子数量过大（最多 10000 条）';
  }
  if (t === 'poll' && !/^\d+$/.test(String(f.answerNumber))) return '选项编号必须是数字';
  return null;
};

// 按类型组装上游载荷。字段名必须与上游文档逐字一致，少一个就是 Missing xxx
const buildUpstreamPayload = (service, b) => {
  const t = normType(service.type);
  const p = { key: b.key, action: 'add', service: b.serviceId };

  if (t === 'subscriptions') {
    p.username = b.username;
    p.min = b.quantity;
    p.max = b.quantity;
    p.delay = (b.delay === undefined || b.delay === null || b.delay === '') ? 0 : b.delay;
    const posts = Number(b.posts);
    if (b.posts !== undefined && b.posts !== null && b.posts !== '' && posts > 0) p.posts = posts;
    const oldPosts = Number(b.oldPosts);
    if (b.oldPosts !== undefined && b.oldPosts !== null && b.oldPosts !== '' && oldPosts > 0) p.old_posts = oldPosts;
    if (b.expiry) p.expiry = b.expiry;
    return p;
  }
  if (t === 'invites from groups') { p.username = b.username; return p; }

  p.link = b.link;
  p.quantity = b.quantity;
  if (t === 'custom comments') p.comments = b.comments;
  else if (t === 'mentions hashtag') p.hashtag = b.hashtag;
  else if (t === 'poll') p.answer_number = b.answerNumber;
  else if (t === 'package') {
    if (b.runs !== undefined && b.runs !== null && b.runs !== '') p.runs = b.runs;
    if (b.interval !== undefined && b.interval !== null && b.interval !== '') p.interval = b.interval;
  }
  return p;
};


router.post('/add', authenticate, async (req, res) => {
  // 💡 解除参数封锁：除 comments / custom_comments 外，再放行特殊类型所需字段
  const {
    serviceId, link, quantity, comments, custom_comments,
    username, posts, delay, expiry, hashtag, runs, interval
  } = req.body;
  const oldPosts = req.body.old_posts !== undefined ? req.body.old_posts : req.body.oldPosts;
  const answerNumber = req.body.answer_number !== undefined ? req.body.answer_number : req.body.answerNumber;
  // ⚠️ 不能在这里就要求 link —— Subscriptions / Invites 类型上游根本不收 link
  if (!serviceId) return res.json({ status: 'error', message: '参数非法' });

  const t = await sequelize.transaction();
  try {
    const service = await Service.findByPk(serviceId, { transaction: t });
    if (!service) { await t.rollback(); return res.json({ status: 'error', message: '商品不存在或已下架' }); }

    // 🔌 先按上游类型校验必填字段，再校验数量边界
    const orderType = normType(service.type);
    const qty = (quantity === undefined || quantity === null || quantity === '') ? undefined : parseInt(quantity);
    const postsQty = (posts === undefined || posts === null || posts === '') ? undefined : parseInt(posts);
    const fieldErr = validateForType(service.type, {
      link, quantity: qty, comments: comments || custom_comments,
      username, delay, hashtag, answerNumber, posts: postsQty
    });
    if (fieldErr) { await t.rollback(); return res.json({ status: 'error', message: fieldErr }); }

    if (qty < service.min || qty > service.max) {
      await t.rollback(); return res.json({ status: 'error', message: `数量限制: ${service.min} - ${service.max}` });
    }

    const configs = await Config.findAll({ where: { key: ['global_multiplier', 'agent_discount'] }, transaction: t });
    const conf = {}; configs.forEach(c => conf[c.key] = c.value);

    // 分站定价覆盖
    const baseMultiplier = req.site ? parseFloat(req.site.multiplier) : parseFloat(conf.global_multiplier || 2.0);
    const agentDiscount = req.site ? parseFloat(req.site.agent_discount) : parseFloat(conf.agent_discount || 0.8);

    let user = await User.findByPk(req.user.id, { transaction: t });
    if (!user && req.user.role !== 'super_admin') {
        await t.rollback(); return res.json({ status: 'error', message: '账户异常' });
    }
    
    const actualRole = user ? user.role : req.user.role;
    let finalMultiplier = baseMultiplier;

    if (actualRole === 'super_admin' || actualRole === 'admin') { 
      finalMultiplier = 1.0; 
    } else if (user && user.custom_multiplier !== null && user.custom_multiplier !== undefined) { 
      finalMultiplier = parseFloat(user.custom_multiplier); 
    } else if (actualRole === 'agent') { 
      finalMultiplier = baseMultiplier * agentDiscount; 
    }

    // 🔑 管理员/至尊管理员按上游原价：custom_rate 是「面向客户的零售价」，
    //    不该套在管理者自己头上（2026-10-24 祥哥反馈"我是管理员，怎么费用跟上游不一样"）
    const isStaff = actualRole === 'super_admin' || actualRole === 'admin';
    const baseRate = (!isStaff && service.custom_rate !== null && service.custom_rate !== undefined)
      ? parseFloat(service.custom_rate)
      : parseFloat(service.rate);
    const sellRate = baseRate * finalMultiplier;
    // 🔑 方案 A（2026-10-24 祥哥拍板）：订阅型按"投喂次数"计价。
    //    上游会为客户的每一条新帖各投喂一次、每次单独扣上游余额；
    //    本站若只按一次收费，客户发帖越多亏得越多 → 按 posts 次数乘算。
    const billUnits = orderType === 'subscriptions' ? postsQty : 1;
    const charge = ((qty / 1000) * sellRate * billUnits).toFixed(4);
    const upstream_charge = ((qty / 1000) * parseFloat(service.rate) * billUnits).toFixed(4);

    // 🔒 价格护栏：倍率被写成负数/0/NaN 时 charge 非法，拒绝下单（防负扣款刷余额）
    if (!isFinite(parseFloat(charge)) || parseFloat(charge) <= 0) {
      await t.rollback(); return res.json({ status: 'error', message: '价格异常，请联系管理员' });
    }

    if (user && parseFloat(user.balance) < parseFloat(charge)) {
      await t.rollback(); return res.json({ status: 'error', message: `余额不足，该订单需要 ¥${charge}` });
    }

    if (user) {
      user.balance = (parseFloat(user.balance) - parseFloat(charge)).toFixed(6);
      await user.save({ transaction: t });
    }

    const urlConf = await Config.findOne({where:{key:'upstream_url'}, transaction: t});
    const keyConf = await Config.findOne({where:{key:'upstream_key'}, transaction: t});
    
    if (!urlConf?.value || !keyConf?.value) {
      await t.rollback(); return res.json({ status: 'error', message: '服务配置异常，请联系管理员' });
    }

    // 🔌 按类型组装上游载荷（字段名逐字对齐上游文档；见文件顶部契约表）
    const payloadObj = buildUpstreamPayload(service, {
      key: keyConf.value, serviceId, link, quantity: qty,
      comments: comments || custom_comments,
      username, posts, oldPosts, delay, expiry, hashtag, runs, interval, answerNumber
    });
    const payload = new URLSearchParams(payloadObj);
    
    let upRes;
    try {
      upRes = await axios.post(urlConf.value, payload.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 });
    } catch (axiosErr) {
      await t.rollback();
      return res.json({ status: 'error', message: '服务暂不可用，请稍后重试' });
    }
    
    if (upRes.data && upRes.data.order) {
      const orderNo = 'XN' + Date.now() + Math.floor(Math.random()*100);
      const newOrder = await Order.create({
        order_no: orderNo, user_id: req.user.id, phone: user ? user.phone : 'SuperAdmin',
        upstream_order_id: String(upRes.data.order), service_id: serviceId,
        // 🔌 订阅型/邀请型没有 link，用 username 落到 link 列：历史订单里才看得出"下给谁"
        service_name: service.name, link: link || username, quantity: qty, charge, upstream_charge, status: '排队中'
      }, { transaction: t });
      
      if (user) {
        await Transaction.create({
          user_id: user.id, phone: user.phone, amount: -charge, balance: user.balance, 
          type: '订单扣款', description: `购买服务 [ID:${serviceId}] 数量:${quantity}`
        }, { transaction: t });
      }
      
      await t.commit(); 

      // 💡 核心优化：TG 机器人增加对自定义评论的侦测播报
      const roleName = user ? (user.role === 'super_admin' ? '至尊管理员' : user.role === 'admin' ? '管理员' : user.role === 'agent' ? '👑 至尊代理' : '黄金用户') : '系统神权';
      const commentMark = comments ? `\n💬 <b>评论:</b> 包含 ${comments.split('\n').length} 行自定义内容` : '';
      
      sendTgMessage(`🛒 <b>用户新订单提交</b>\n🆔 <b>UID:</b> <code>${user ? user.id : '0'}</code>\n📱 <b>账号:</b> <code>${user ? user.phone : '最高管理'}</code>\n📧 <b>邮箱:</b> ${user ? (user.email || '未绑定') : '系统'}\n🔰 <b>等级:</b> ${roleName}\n📦 <b>商品:</b> [ID:${serviceId}] ${service.name}\n🔢 <b>数量:</b> ${quantity}\n💸 <b>扣费:</b> ￥${charge}\n🔗 <b>目标:</b> <code>${link || username}</code>${commentMark}\n🔖 <b>系统单号:</b> <code>${newOrder.order_no}</code>\n📡 <b>上游单号:</b> <code>${upRes.data.order}</code>`);

      res.json({ status: 'success', message: '✅ 订单已秒级提交至全网', order_id: newOrder.order_no });
    } else {
      await t.rollback();
      const rawErr = String(upRes.data?.error || upRes.data?.message || '服务异常，请稍后重试');
      const errMap = {
        'not enough funds': '服务暂不可用，充值补货中，请稍后再试',
        'incorrect request': '请求参数有误，请检查链接格式或服务是否有效',
        'invalid link': '目标链接无效，请检查链接格式',
        'service not found': '该服务已下架或暂停，请选择其他服务',
        'min_quantity': '数量低于该服务最低要求',
        'max_quantity': '数量超过该服务最高限制',
        'duplicate': '请勿重复提交相同链接的订单',
        'comments': '自定义评论内容不符合规范，请修改后重试',
        // 🔌 特殊类型（2026-10-24 补）：上游这些报错以前原样抛给用户，等于没提示
        'missing username': '缺少用户名：该服务需要填社交平台用户名（不要带 @ 或链接）',
        'invalid username': '用户名无效：请检查用户名是否正确',
        'username': '用户名无效：请不要带 @、空格或链接',
        'missing min': '缺少数量下限',
        'missing max': '缺少数量上限',
        'missing delay': '缺少延迟参数',
        'missing posts': '缺少新帖子数量',
        'missing hashtag': '缺少话题标签',
        'missing answer': '缺少选项编号',
        'hashtag': '话题标签无效，请检查格式',
        'answer_number': '选项编号无效',
        'expiry': '到期日期格式不对（应形如 31/12/2026）',
        'exists': '该账号不存在或为私密账号，无法下单'
      };
      let friendlyMsg = rawErr;
      for (const [key, val] of Object.entries(errMap)) {
        if (rawErr.toLowerCase().includes(key)) { friendlyMsg = val; break; }
      }
      res.json({ status: 'error', message: friendlyMsg });
    }
  } catch (e) {
    await t.rollback();
    res.json({ status: 'error', message: '系统繁忙，请稍后重试' });
  }
});

// 批量下单
router.post('/batch', authenticate, async (req, res) => {
  const { orders: batchOrders } = req.body;
  if (!Array.isArray(batchOrders) || batchOrders.length === 0) {
    return res.json({ status: 'error', message: '请提供有效的批量订单数据' });
  }
  if (batchOrders.length > 50) {
    return res.json({ status: 'error', message: '单次批量最多50条，请分批提交' });
  }

  const configs = await Config.findAll({ where: { key: ['global_multiplier', 'agent_discount', 'upstream_url', 'upstream_key'] } });
  const conf = {}; configs.forEach(c => conf[c.key] = c.value);
  if (!conf.upstream_url || !conf.upstream_key) {
    return res.json({ status: 'error', message: '服务配置异常，请联系管理员' });
  }

  const baseMultiplier = req.site ? parseFloat(req.site.multiplier) : parseFloat(conf.global_multiplier || 2.0);
  const agentDiscount = req.site ? parseFloat(req.site.agent_discount) : parseFloat(conf.agent_discount || 0.8);

  const results = [];
  let totalCharge = 0;
  let reportUser = null; // 循环外捕获真实下单用户（供末尾 TG 播报），修复块级作用域 bug

  for (const item of batchOrders) {
    const { serviceId, link, quantity } = item;
    if (!serviceId || !link || !quantity || parseInt(quantity) <= 0) {
      results.push({ serviceId, link, quantity, status: 'error', message: '参数非法' });
      continue;
    }

    const t = await sequelize.transaction();
    try {
      const service = await Service.findByPk(serviceId, { transaction: t });
      if (!service) { await t.rollback(); results.push({ serviceId, link, quantity, status: 'error', message: '商品不存在' }); continue; }

      // 🔌 批量下单只支持 Default 类型。
      //    - Custom Comments：必填字段是"评论内容"（每单不同），一行格式表达不了 → 上游必回 Missing comments
      //    - Subscriptions / Invites / Mentions / Poll：必填用户名、话题、选项…一行也表达不了
      //    这些类型请到「开始下单」逐条提交（上游的批量下单同样不支持它们）。
      const bType = normType(service.type);
      if (bType !== 'default') {
        await t.rollback();
        const why = bType === 'custom comments' ? '需要逐条填写评论内容' : '需要填写用户名/话题/选项等专用字段';
        results.push({ serviceId, link, quantity, status: 'error', message: `该服务类型（${service.type}）${why}，不支持一行一条的批量下单，请到「开始下单」单个提交` });
        continue;
      }

      const qty = parseInt(quantity);
      if (qty < service.min || qty > service.max) {
        await t.rollback();
        results.push({ serviceId, link, quantity, status: 'error', message: `数量限制: ${service.min}-${service.max}` });
        continue;
      }

      let user = await User.findByPk(req.user.id, { transaction: t });
      if (!user && req.user.role !== 'super_admin') { await t.rollback(); results.push({ serviceId, link, quantity, status: 'error', message: '账户异常' }); continue; }
      if (user) reportUser = user;

      const actualRole = user ? user.role : req.user.role;
      let finalMultiplier = baseMultiplier;
      if (actualRole === 'super_admin' || actualRole === 'admin') {
        finalMultiplier = 1.0;
      } else if (user && user.custom_multiplier !== null && user.custom_multiplier !== undefined) {
        finalMultiplier = parseFloat(user.custom_multiplier);
      } else if (actualRole === 'agent') {
        finalMultiplier = baseMultiplier * agentDiscount;
      }

      // 🔑 与单笔下单同口径：管理员按上游原价，不套零售加价
      const isStaff = actualRole === 'super_admin' || actualRole === 'admin';
      const baseRate = (!isStaff && service.custom_rate !== null && service.custom_rate !== undefined)
        ? parseFloat(service.custom_rate)
        : parseFloat(service.rate);
      const sellRate = baseRate * finalMultiplier;
      const charge = parseFloat(((qty / 1000) * sellRate).toFixed(4));
      const upstream_charge = parseFloat(((qty / 1000) * parseFloat(service.rate)).toFixed(4));

      // 🔒 价格护栏：charge 非正/非法直接拒该条（防负数倍率刷余额）
      if (!isFinite(charge) || charge <= 0) {
        await t.rollback();
        results.push({ serviceId, link, quantity, status: 'error', message: '价格异常，请联系管理员' });
        continue;
      }

      if (user && parseFloat(user.balance) - totalCharge < parseFloat(charge)) {
        await t.rollback();
        results.push({ serviceId, link, quantity, status: 'error', message: `余额不足，需要 ¥${charge}` });
        continue;
      }

      const payloadObj = { key: conf.upstream_key, action: 'add', service: serviceId, link, quantity: qty };
      const payload = new URLSearchParams(payloadObj);
      const upRes = await axios.post(conf.upstream_url, payload.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000
      });

      if (upRes.data && upRes.data.order) {
        const orderNo = 'XN' + Date.now() + Math.floor(Math.random() * 100);
        const newOrder = await Order.create({
          order_no: orderNo, user_id: req.user.id, phone: user ? user.phone : 'SuperAdmin',
          upstream_order_id: String(upRes.data.order), service_id: serviceId,
          service_name: service.name, link, quantity: qty, charge, upstream_charge, status: '排队中'
        }, { transaction: t });

        if (user) {
          totalCharge += parseFloat(charge);
          user.balance = (parseFloat(user.balance) - parseFloat(charge)).toFixed(6);
          await user.save({ transaction: t });

          await Transaction.create({
            user_id: user.id, phone: user.phone, amount: -charge, balance: user.balance,
            type: '批量订单扣款', description: `批量购买 [ID:${serviceId}] ${service.name} 数量:${qty}`
          }, { transaction: t });
        }

        await t.commit();
        results.push({ serviceId, link, quantity: qty, status: 'success', order_no: orderNo, charge });
      } else {
        await t.rollback();
        results.push({ serviceId, link, quantity, status: 'error', message: upRes.data?.error || '服务暂不可用，请稍后重试' });
      }
    } catch (e) {
      await t.rollback().catch(() => {});
      results.push({ serviceId, link, quantity, status: 'error', message: `系统错误: ${e.message}` });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status === 'error').length;

  // TG 播报
  if (reportUser) {
    const roleName = reportUser.role === 'super_admin' ? '至尊管理员' : reportUser.role === 'admin' ? '管理员' : reportUser.role === 'agent' ? '👑 至尊代理' : '黄金用户';
    sendTgMessage(`📦 <b>批量下单完成</b>\n🆔 <b>UID:</b> <code>${reportUser.id}</code>\n📱 <b>账号:</b> <code>${reportUser.phone}</code>\n🔰 <b>等级:</b> ${roleName}\n✅ <b>成功:</b> ${successCount} 单\n❌ <b>失败:</b> ${failCount} 单\n💸 <b>总扣费:</b> ￥${totalCharge.toFixed(2)}`);
  }

  res.json({ status: 'success', data: { total: batchOrders.length, success: successCount, fail: failCount, total_charge: totalCharge.toFixed(4), results } });
});

router.get('/', authenticate, async (req, res) => {
  try {
    const orders = await Order.findAll({ where: { user_id: req.user.id }, order: [['created_at', 'DESC']] });
    res.json({ status: 'success', data: orders });
  } catch(e) {
    res.json({ status: 'error' });
  }
});
export default router;
