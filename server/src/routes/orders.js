import express from 'express';
import axios from 'axios';
import { Op } from 'sequelize';
import { sequelize, Order, Service, Config, User, Transaction, SiteServicePrice } from '../models/index.js';
import { customerDiscountMultiplier } from '../utils/customerPrice.js';
import { refundOrderFully } from '../utils/orderRefund.js';
import { isAgentActive } from '../utils/agentStatus.js';
import { computeOrderPrice } from '../utils/pricing.js';
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
  // 事务是否已经提交。submit 之后绝不能再 rollback（会抛 "Transaction cannot be rolled back"），
  // 而阶段 B 的补偿退款是另开事务的，不需要这把 t。
  let committed = false;
  // 提到外层：catch 里的补偿逻辑要靠它找到刚建出来的那一单
  let orderNo = null;
  try {
    const service = await Service.findByPk(serviceId, { transaction: t });
    if (!service) { await t.rollback(); return res.json({ status: 'error', message: '商品不存在或已下架' }); }
    // 🚫 sort=999999 是同步任务标记「上游已下架」的哨兵值（见 utils/sync.js）。
    //    这些服务要么已被物理删除，要么因为护栏留在库里 —— 后者仍然能被 findByPk 查到，
    //    不拦的话客户会下一单上游必然拒绝的订单（钱扣了、单失败、还要退款）。
    if (Number(service.sort) === 999999) {
      await t.rollback();
      return res.json({ status: 'error', message: '该服务已下架，请刷新页面重新选择' });
    }

    // 🔌 先按上游类型校验必填字段，再校验数量边界
    const orderType = normType(service.type);
    const qty = (quantity === undefined || quantity === null || quantity === '') ? undefined : parseInt(quantity);
    const postsQty = (posts === undefined || posts === null || posts === '') ? undefined : parseInt(posts);
    const fieldErr = validateForType(service.type, {
      link, quantity: qty, comments: comments || custom_comments,
      username, delay, hashtag, answerNumber, posts: postsQty
    });
    if (fieldErr) { await t.rollback(); return res.json({ status: 'error', message: fieldErr }); }

    // ══════════════════════════════════════════════════════════════════════
    // 🔴 2026-11-06 下单前两道拦截。起因（祥哥反馈）：
    //    客户把 TikTok **视频短链接** tiktok.com/t/xxx 填进了「涨粉」单，
    //    上游必然取消 → 钱扣了又退 → 客户白等一场，还以为是平台不行。
    //    同一链接重复下单也完全没拦（上游描述里明写禁止，会重复计数）。
    //    这两类问题以前都只能等上游退回来才发现，等于让客户替我们试错。
    // ══════════════════════════════════════════════════════════════════════
    const targetForCheck = String(link || username || '').trim();
    if (targetForCheck) {
      const svcName = String(service.name || '');

      // ① 涨粉/粉丝类：要的是「主页」或「用户名」，给视频链接上游一定退
      const isFansSvc = /粉|粉丝|followers?|fans?/i.test(svcName);
      const isVideoUrl = /tiktok\.com\/(t|video)\/|youtube\.com\/(watch|shorts)|instagram\.com\/(p|reel)\//i.test(targetForCheck);
      if (isFansSvc && isVideoUrl) {
        await t.rollback();
        return res.json({
          status: 'error',
          message:
            '这是涨粉服务，要填「主页」或「用户名」，不是视频链接。\n' +
            '正确写法：https://www.tiktok.com/@你的用户名　或　直接填 用户名',
        });
      }

      // ② 同一目标链接，在上一单完成之前不能重复下单
      const normTarget = (x) => String(x || '')
        .trim().toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('?')[0]
        .replace(/\/+$/, '');
      const myActive = await Order.findAll({
        where: {
          user_id: req.user.id,
          status: { [Op.notIn]: ['已完成', '已取消', '已退款', '部分完成', 'Completed', 'Canceled', 'Cancelled', 'Partial'] },
        },
        attributes: ['order_no', 'link', 'status'],
        transaction: t,
      });
      const dup = myActive.find((o) => normTarget(o.link) === normTarget(targetForCheck));
      if (dup) {
        await t.rollback();
        return res.json({
          status: 'error',
          message: `这个链接已经有一单在进行中（单号 ${dup.order_no}），完成前请勿重复下单，否则会重复计数。`,
        });
      }
    }

    if (qty < service.min || qty > service.max) {
      await t.rollback(); return res.json({ status: 'error', message: `数量限制: ${service.min} - ${service.max}` });
    }

    const configs = await Config.findAll({ where: { key: ['global_multiplier', 'agent_discount'] }, transaction: t });
    const conf = {}; configs.forEach(c => conf[c.key] = c.value);

    // 分站定价覆盖
    const baseMultiplier = req.site ? parseFloat(req.site.multiplier) : parseFloat(conf.global_multiplier || 2.0);
    const agentDiscount = req.site ? parseFloat(req.site.agent_discount) : parseFloat(conf.agent_discount || 0.8);

    // 🔒 行锁：余额校验与扣款必须在同一把锁下完成。
    //    不加锁的话，两个并发请求会同时读到「余额够」，各自扣一次 ——
    //    余额被扣成负数，等于平台白送服务。这类问题只在有真实并发时才暴露。
    let user = await User.findByPk(req.user.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user && req.user.role !== 'super_admin') {
        await t.rollback(); return res.json({ status: 'error', message: '账户异常' });
    }
    
    const actualRole = user ? user.role : req.user.role;
    let finalMultiplier = baseMultiplier;

    // 🏬 分站定价权归站长：站上所有客户都按站长定的倍率付款。
    //    买家自己的专属折扣（custom_multiplier）和代理折扣是**面向平台自营**的价格，
    //    套到别人的店里会直接击穿站长成本 —— 例如买家折扣 0.5、站长成本 1.6，
    //    站长每卖一单倒亏 1.1，而且面板上只显示"亏了"，看不出原因。
    if (req.site) {
      finalMultiplier = (actualRole === 'super_admin' || actualRole === 'admin') ? 1.0 : baseMultiplier;
    } else if (actualRole === 'super_admin' || actualRole === 'admin') { 
      finalMultiplier = 1.0; 
    } else if (user && user.custom_multiplier !== null && user.custom_multiplier !== undefined) { 
      finalMultiplier = parseFloat(user.custom_multiplier); 
    } else if (isAgentActive(actualRole, user && user.agent_expire_at)) {
      // 👑 代理 8 折必须"在有效期内"才算（2026-10-30 修：以前只看角色）
      finalMultiplier = baseMultiplier * agentDiscount;
    }

    // 🔑 管理员/至尊管理员按上游原价：custom_rate 是「面向客户的零售价」，
    //    不该套在管理者自己头上（2026-10-24 祥哥反馈"我是管理员，怎么费用跟上游不一样"）
    const isStaff = actualRole === 'super_admin' || actualRole === 'admin';
    const baseRate = (!isStaff && service.custom_rate !== null && service.custom_rate !== undefined)
      ? parseFloat(service.custom_rate)
      : parseFloat(service.rate);
    let sellRate = baseRate * finalMultiplier;
    // 💰 分站定价：① 站长给单个服务单独定的价优先 ② 再叠活动折扣（到期自动失效）③ 成本兜底在下面统一处理
    if (req.site) {
      try {
        const ov = await SiteServicePrice.findOne({
          where: { site_id: req.site.id, service_id: service.service_id }, transaction: t
        });
        if (ov && parseFloat(ov.rate) > 0) sellRate = parseFloat(ov.rate);
      } catch (e) { /* 表还没建/查不到就走默认倍率，不影响下单 */ }
      const dr = parseFloat(req.site.discount_rate);
      const du = parseInt(req.site.discount_until || 0);
      const discountActive = isFinite(dr) && dr > 0 && dr < 1 && !(du > 0 && Math.floor(Date.now() / 1000) > du);
      if (discountActive) sellRate = sellRate * dr;

      // 👥 93 期：客户分组价 / 单个客户单独定价（祥哥要的"不同客户不同价"）
      //    优先级：单独定价 > 分组价 > 不打折；叠完仍会被下面的成本护栏抬平。
      try {
        const gm = await customerDiscountMultiplier(req.site.id, user, { transaction: t });
        if (gm && gm > 0 && gm < 1) sellRate = sellRate * gm;
      } catch (e) { /* 降级：按原价，不影响下单 */ }
    }
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

    // 🏬 分站结算（预存制）：客户按站主定的售价付款，站主按「代理价」付成本。
    //    平台收入 = 代理价 − 上游成本（与主站代理卖货同一口径）；
    //    站主收入 = 售价 − 代理价，钱先进站主余额，不需要平台垫资或分账。
    let siteCost = 0;
    let siteOwner = null;
    let chargeFinal = parseFloat(charge);
    if (req.site) {
      // 💰 110 期：成本按**这个站**的进货折扣算 —— 代理站 0.8，非代理站 1（原价）。
      //    以前这里写死全局 0.8，等于非代理站也能拿代理价，代理资格就白买了。
      const siteAd = parseFloat(req.site.agent_discount);
      const useAd = (isFinite(siteAd) && siteAd > 0) ? siteAd : parseFloat(conf.agent_discount || 0.8);
      const platformMult = parseFloat(conf.global_multiplier || 2.0) * useAd;
      siteCost = parseFloat(((qty / 1000) * parseFloat(baseRate) * platformMult * billUnits).toFixed(6));
      if (!isFinite(siteCost) || siteCost < 0) {
        await t.rollback(); return res.json({ status: 'error', message: '价格异常，请联系站长' });
      }
      // 🛡 兜底护栏：售价无论如何不得低于站长成本（站长不能被系统扣成亏本）
      if (chargeFinal < siteCost) {
        console.warn(`[order] 售价低于分站成本，已抬平：charge=${chargeFinal} siteCost=${siteCost} site=${req.site.id}`);
        chargeFinal = siteCost;
      }
      // 🔒 站长余额同样要加行锁：并发下单时否则会被同时判定"够"而扣成负数
      siteOwner = await User.findByPk(req.site.owner_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!siteOwner) {
        await t.rollback(); return res.json({ status: 'error', message: '本站暂未开放，请联系客服' });
      }
      if (parseFloat(siteOwner.balance) < siteCost) {
        // 客户可见文案：不提平台/上游，也不用「补充库存」这种只有站长看得懂的说法
        // （客户不可能给站长补库存，让他去做这件事只会一脸懵）
        await t.rollback(); return res.json({ status: 'error', message: '本站暂时无法接单，请稍后再试或联系客服' });
      }
    } else {
      // 🔴 2026-11-03：**主站原来没有任何成本地板** —— 只有分站那句 if (req.site) 才抬平。
      //    主站的成本就是 upstream_charge（按上游原价算，含订阅型 billUnits）。
      //    客户被设了 custom_multiplier=0.4（后台可填任意小数）或代理折扣叠加到成本以下时，
      //    charge 就是纯亏 —— 卖一单倒贴一单，而且账面上完全看不出来（只有利润栏是负数）。
      //    这里按"售价不得低于上游成本"无条件抬平，并留日志便于发现是谁被设了倒贴倍率。
      const floorMain = parseFloat(upstream_charge);
      if (isFinite(floorMain) && chargeFinal < floorMain) {
        console.warn(
          `[order] 主站售价低于上游成本，已抬平：charge=${chargeFinal} cost=${floorMain} ` +
          `uid=${req.user.id} service=${service.service_id} mult=${finalMultiplier}`
        );
        chargeFinal = floorMain;
      }
    }

    // 💰 客户余额校验放在"最终售价"确定之后（分站可能抬平到成本以上）
    if (user && parseFloat(user.balance) < chargeFinal) {
      await t.rollback(); return res.json({ status: 'error', message: `余额不足，该订单需要 ¥${chargeFinal.toFixed(4)}` });
    }

    if (user) {
      user.balance = (parseFloat(user.balance) - chargeFinal).toFixed(6);
      await user.save({ transaction: t });
    }

    // 站主成本扣减（与客户扣款同一事务：上游失败会一起回滚）
    if (siteOwner) {
      siteOwner.balance = (parseFloat(siteOwner.balance) - siteCost).toFixed(6);
      await siteOwner.save({ transaction: t });
      await Transaction.create({
        user_id: siteOwner.id, phone: siteOwner.phone, amount: -siteCost, balance: siteOwner.balance,
        type: '分站成本扣款', description: `分站订单成本 服务[ID:${serviceId}] 数量:${qty}`,
      // 72期：流水必须落到分站上。之前写的是 0，站长按分站查自己的成本/收益时
      // 这些单子全被算到"主站"名下 —— 对账差钱，而且很难查。
      site_id: req.site ? Number(req.site.id) : 0
      }, { transaction: t });
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
    
    // ══════════════════════════════════════════════════════════════════════
    // 阶段 A（短事务）：扣款 + 建单 + 落流水，然后**立刻提交**。
    // 原来「扣客户余额 → 调上游 → 建单 → commit」全在同一个事务里，两个后果：
    //   · axios 一调就 15 秒，期间客户那行余额一直被行锁占着 → 并发下单全部排队；
    //   · 上游**已经接了单**、本地 Order.create 若失败 → 整个事务回滚，
    //     上游白服务、平台白送一单，账面上还什么都看不见。
    // 现在先把本地这一单落定（含扣款），再出门调上游；上游失败走补偿退款。
    // ══════════════════════════════════════════════════════════════════════
    // 🏬 订单号前缀：主站沿用 XN；分站不带平台首字母 —— 这个号会出现在客户的历史订单、
    //    邮件和客服对话里，'XN' 三个字母等于在每张单子上盖平台的章。
    orderNo = (req.site ? '' : 'XN') + Date.now() + Math.floor(Math.random()*100);
    // 📦 特殊类型的下单参数必须留痕。
    //    以前 Order.create 只写 link/quantity，订阅型填的「投喂几条新帖」「到期日」
    //    全部丢掉。客户来问「我明明填了 50 条」，系统里查不到任何证据，
    //    只能靠订单金额倒推 —— 服务一旦改价就倒推错了。
    //    现在原样存进 ext_fields，客服对账和订单详情都有据可查。
    const buildExtFields = () => {
      const ext = { type: service.type };
      if (orderType === 'subscriptions') {
        if (username) ext.username = String(username).trim();
        if (postsQty) ext.posts = postsQty;             // 买了几次投喂
        if (expiry) ext.expiry = String(expiry).trim();
        if (delay !== undefined && delay !== null && delay !== '') ext.delay = Number(delay) || 0;
        ext.fed = 0;                                     // 已投喂次数，由 orderSync 更新
      } else if (orderType === 'custom comments') {
        ext.comments = String(comments || custom_comments || '').slice(0, 5000);
      } else if (orderType === 'mentions hashtag') {
        if (hashtag) ext.hashtag = String(hashtag).trim();
      } else if (orderType === 'poll') {
        if (answerNumber !== undefined && answerNumber !== null && answerNumber !== '') ext.answer_number = answerNumber;
      } else if (orderType === 'package') {
        if (runs !== undefined && runs !== '') ext.runs = runs;
        if (interval !== undefined && interval !== '') ext.interval = interval;
      }
      // 只有 type 一项说明是普通服务，没必要占字段
      return Object.keys(ext).length > 1 ? JSON.stringify(ext) : null;
    };

    const pendingOrder = await Order.create({
      order_no: orderNo, user_id: req.user.id, phone: user ? user.phone : 'SuperAdmin',
      site_id: req.site ? Number(req.site.id) : 0,
      site_cost: siteCost,
      upstream_order_id: null, service_id: serviceId,
      service_name: service.name,
      // 🔌 订阅型/邀请型没有 link，用 username 落到 link 列：历史订单里才看得出"下给谁"
      link: link || username, quantity: qty, charge: chargeFinal, upstream_charge,
      ext_fields: buildExtFields(),
      status: '提交中'   // ← 上游单号回来之前停在这里；超时残留由 utils/orderSync.js 清扫退款
    }, { transaction: t });

    if (user) {
      await Transaction.create({
        user_id: user.id, phone: user.phone, amount: -chargeFinal, balance: user.balance,
        type: '订单扣款', description: `购买服务 [ID:${serviceId}] 数量:${quantity}`,
        site_id: req.site ? Number(req.site.id) : 0
      }, { transaction: t });
    }

    await t.commit();
    committed = true;

    // ══════════════════════════════════════════════════════════════════════
    // 阶段 B（无事务、不持任何锁）：真正去上游下单
    // ══════════════════════════════════════════════════════════════════════
    let upRes = null;
    let axiosFailed = false;
    try {
      upRes = await axios.post(urlConf.value, payload.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 });
    } catch (axiosErr) {
      axiosFailed = true;
      console.error(`[order] 上游调用失败 order=${orderNo} uid=${req.user.id}:`, axiosErr && axiosErr.message);
    }

    if (!axiosFailed && upRes.data && upRes.data.order) {
      // 回填上游单号并转正常状态（单子已在阶段 A 落好，这里只做更新）
      await Order.update(
        { upstream_order_id: String(upRes.data.order), status: '排队中' },
        { where: { id: pendingOrder.id } }
      );

      // 💡 核心优化：TG 机器人增加对自定义评论的侦测播报
      const roleName = user ? (user.role === 'super_admin' ? '至尊管理员' : user.role === 'admin' ? '管理员' : user.role === 'agent' ? '👑 至尊代理' : '黄金用户') : '系统神权';
      const commentMark = comments ? `\n💬 <b>评论:</b> 包含 ${comments.split('\n').length} 行自定义内容` : '';

      sendTgMessage(`🛒 <b>用户新订单提交</b>\n🆔 <b>UID:</b> <code>${user ? user.id : '0'}</code>\n📱 <b>账号:</b> <code>${user ? user.phone : '最高管理'}</code>\n📧 <b>邮箱:</b> ${user ? (user.email || '未绑定') : '系统'}\n🔰 <b>等级:</b> ${roleName}\n📦 <b>商品:</b> [ID:${serviceId}] ${service.name}\n🔢 <b>数量:</b> ${quantity}\n💸 <b>扣费:</b> ￥${chargeFinal}\n💰 <b>扣费后余额:</b> ￥${user ? Number(user.balance).toFixed(2) : '—'}\n🔗 <b>目标:</b> <code>${link || username}</code>${commentMark}\n🔖 <b>系统单号:</b> <code>${orderNo}</code>\n📡 <b>上游单号:</b> <code>${upRes.data.order}</code>`);

      res.json({ status: 'success', message: '✅ 订单已秒级提交至全网', order_id: orderNo });
    } else {
      // 🔁 补偿：上游没接单（或调用超时没回），把这一单全额退回客户、退回站长成本，
      //    订单标记为「已退款」。步骤 A 已经提交，所以这里不需要（也不能）rollback 原事务。
      const why = axiosFailed
        ? '上游调用失败或超时'
        : String((upRes && upRes.data && (upRes.data.error || upRes.data.message)) || '上游未返回单号');
      const rf = await refundOrderFully(pendingOrder.id, { reason: '订单未能提交，已全额退款' });
      if (!rf.ok) {
        console.error(`🚨 [order] 补偿退款失败，需人工处理 order=${orderNo} uid=${req.user.id} why=${why}`);
        sendTgMessage(`🚨 <b>补偿退款失败，需人工处理</b>\n🔖 单号: <code>${orderNo}</code>\n🆔 UID: <code>${req.user.id}</code>\n💸 金额: ￥${chargeFinal}\n❗ 原因: ${why}`);
      }
      const rawErr = String(upRes?.data?.error || upRes?.data?.message || (axiosFailed ? 'timeout' : '服务异常，请稍后重试'));
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
    console.error('[order] 下单异常:', e);
    if (!committed) {
      try { await t.rollback(); } catch (_) {}
      return res.json({ status: 'error', message: '系统繁忙，请稍后重试' });
    }
    // 阶段 A 已经提交、后面某一步抛错（回填/TG/网络）→ 这一单必须退回去，
    // 否则客户被扣了钱、订单却停在不完整状态，谁也不知道发生过。
    try {
      const o = await Order.findOne({ where: { order_no: orderNo }, attributes: ['id', 'status'] });
      if (o && o.status === '提交中') {
        const rf = await refundOrderFully(o.id, { reason: '订单未能提交，已全额退款' });
        if (!rf.ok) {
          console.error(`🚨 [order] 异常补偿退款失败，需人工处理 order=${orderNo} uid=${req.user && req.user.id}`);
          sendTgMessage(`🚨 <b>异常补偿退款失败，需人工处理</b>\n🔖 单号: <code>${orderNo}</code>\n🆔 UID: <code>${req.user && req.user.id}</code>`);
        }
      }
    } catch (e2) {
      console.error('[order] 异常补偿失败:', e2);
    }
    return res.json({ status: 'error', message: '系统繁忙，请稍后重试' });
  }
});

// 批量下单
// ============================================================================
// 💰 批量下单预估价（POST /api/orders/batch/quote）
//
// 为什么要有：批量下单一直是「贴进去点提交，直接扣钱，扣多少事先不知道」。
//   客户填 20 行、点一下，余额少了几十块才发现某条写错了服务 ID。
//   单笔下单页有价格预览，批量页写的是「需提交后计算」—— 等于没有。
//
// 这个端点**只算钱**：不扣款、不建单、不写库。计价用的是 utils/pricing.js，
// 和 /batch、/add 是同一份代码，所以预估价和实际扣款永远一致。
// 顺便把「这条为什么下不了」也提前告诉他：服务不存在/已下架/数量超限/
// 涨粉填了视频链接/同链接重复 —— 全在提交之前暴露，不用等退款。
// ============================================================================
router.post('/batch/quote', authenticate, async (req, res) => {
  const { orders: batchOrders } = req.body;
  if (!Array.isArray(batchOrders) || batchOrders.length === 0) {
    return res.json({ status: 'success', data: { total: 0, ok_count: 0, total_charge: 0, balance: 0, enough: true, shortfall: 0, items: [] } });
  }
  if (batchOrders.length > 50) {
    return res.json({ status: 'error', message: '单次批量最多50条，请分批提交' });
  }

  const configs = await Config.findAll({ where: { key: ['global_multiplier', 'agent_discount'] } });
  const conf = {}; configs.forEach(c => (conf[c.key] = c.value));

  const me = await User.findByPk(req.user.id);
  const balance = me ? parseFloat(me.balance) : 0;

  // 预估价也做重复检查：否则预览说「能下」，一提交全被拦，比没有更糟
  const normT = (x) => String(x || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').split('?')[0].replace(/\/+$/, '');
  const FINISHED = ['已完成', '已取消', '已退款', '部分完成', 'Completed', 'Canceled', 'Cancelled', 'Partial'];
  const activeByTarget = new Map();
  try {
    const rows = await Order.findAll({
      where: { user_id: req.user.id, status: { [Op.notIn]: FINISHED } },
      attributes: ['order_no', 'link'],
    });
    for (const o of rows) {
      const k = normT(o.link);
      if (k && !activeByTarget.has(k)) activeByTarget.set(k, o.order_no);
    }
  } catch (e) { /* 查不到就不拦 */ }
  const seenInQuote = new Map();

  const items = [];
  let total = 0;

  for (const item of batchOrders) {
    const { serviceId, link, quantity } = item;
    const qty = parseInt(quantity);
    const base = { serviceId, link, quantity: Number.isFinite(qty) ? qty : 0 };

    if (!serviceId || !link || !Number.isFinite(qty) || qty <= 0) {
      items.push({ ...base, ok: false, message: '参数非法' }); continue;
    }

    const service = await Service.findByPk(serviceId);
    if (!service) { items.push({ ...base, ok: false, message: '商品不存在' }); continue; }
    if (Number(service.sort) === 999999) { items.push({ ...base, ok: false, message: '该服务已下架，请刷新后重选' }); continue; }

    const bType = normType(service.type);
    if (bType !== 'default') {
      items.push({ ...base, ok: false, message: `该服务类型（${service.type}）不支持批量，请到「开始下单」单个提交` });
      continue;
    }
    if (qty < service.min || qty > service.max) {
      items.push({ ...base, ok: false, message: `数量限制 ${service.min}-${service.max}` }); continue;
    }
    if (/粉|粉丝|followers?|fans?/i.test(String(service.name || '')) &&
        /tiktok\.com\/(t|video)\/|youtube\.com\/(watch|shorts)|instagram\.com\/(p|reel)\//i.test(String(link))) {
      items.push({ ...base, ok: false, message: '涨粉服务要填主页链接或用户名，不是视频链接' }); continue;
    }

    const nt = normT(link);
    if (nt) {
      const dupNo = activeByTarget.get(nt);
      if (dupNo) { items.push({ ...base, ok: false, message: `该链接已有一单在进行中（${dupNo}）` }); continue; }
      if (seenInQuote.has(nt)) { items.push({ ...base, ok: false, message: `与第 ${seenInQuote.get(nt)} 条链接重复` }); continue; }
    }

    try {
      const price = await computeOrderPrice({ service, qty, orderType: bType, user: me, site: req.site, conf });
      const charge = Number(price.charge.toFixed(4));
      total += charge;
      if (nt) seenInQuote.set(nt, items.length + 1);
      items.push({ ...base, ok: true, service_name: service.name, charge });
    } catch (e) {
      items.push({ ...base, ok: false, message: '价格计算失败，请联系管理员' });
    }
  }

  const totalCharge = Number(total.toFixed(4));
  res.json({
    status: 'success',
    data: {
      total: items.length,
      ok_count: items.filter(i => i.ok).length,
      total_charge: totalCharge,
      balance: Number(balance.toFixed(4)),
      enough: balance >= totalCharge - 1e-9,
      shortfall: Math.max(0, Number((totalCharge - balance).toFixed(4))),
      items,
    },
  });
});

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

  // 倍率/折扣不用在这里算了 —— 统一由 utils/pricing.js 按 service+user+site 计算，
  // 与 /add 和 /batch/quote 同一份代码。这里只要拿到上游地址和密钥。

  const results = [];
  let totalCharge = 0;
  let reportUser = null; // 循环外捕获真实下单用户（供末尾 TG 播报），修复块级作用域 bug

  // ══════════════════════════════════════════════════════════════════════════
  // 🔁 批量同样要拦「同一链接重复下单」和「涨粉填视频链接」。
  //    /add 早就拦了这两类，批量以前一条都没拦 —— 客户一次贴 4 行相同链接
  //    能全部提交成功、全部扣费，上游判定重复后整批取消退款，客户白等一场，
  //    还以为是平台不稳定。这是批量订单最高频的踩坑，必须在扣钱之前拦。
  //    同时拦三种：库里已有进行中的、本批内重复的、涨粉填了视频链接的。
  // ══════════════════════════════════════════════════════════════════════════
  const normTarget = (x) => String(x || '')
    .trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('?')[0]
    .replace(/\/+$/, '');

  const FINISHED_STATUSES = ['已完成', '已取消', '已退款', '部分完成', 'Completed', 'Canceled', 'Cancelled', 'Partial'];
  const dbActiveByTarget = new Map();  // normTarget → 进行中的单号
  try {
    const myActive = await Order.findAll({
      where: { user_id: req.user.id, status: { [Op.notIn]: FINISHED_STATUSES } },
      attributes: ['order_no', 'link'],
    });
    for (const o of myActive) {
      const k = normTarget(o.link);
      if (k && !dbActiveByTarget.has(k)) dbActiveByTarget.set(k, o.order_no);
    }
  } catch (e) { /* 查不到就不拦，不影响正常下单 */ }

  // 本批内已经**成功提交**的链接 → 第几条。只记成功的：
  // 第一条因余额不足失败时，第二条同链接不该被连坐。
  const submittedInBatch = new Map();

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
      // 同上：sort=999999 = 上游已下架，批量下单也必须拦（否则整批里塞一个失效服务就全批失败）
      if (Number(service.sort) === 999999) {
        await t.rollback();
        results.push({ serviceId, link, quantity, status: 'error', message: '该服务已下架，请刷新后重新选择' });
        continue;
      }

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

      // ── 下单前拦截（与 /add 同口径）────────────────────────────────────
      const targetRaw = String(link || '').trim();
      const svcName = String(service.name || '');

      // ① 涨粉/粉丝类要的是「主页」或「用户名」，填视频链接上游一定退
      if (/粉|粉丝|followers?|fans?/i.test(svcName) &&
          /tiktok\.com\/(t|video)\/|youtube\.com\/(watch|shorts)|instagram\.com\/(p|reel)\//i.test(targetRaw)) {
        await t.rollback();
        results.push({
          serviceId, link, quantity, status: 'error',
          message: '这是涨粉服务，要填「主页链接」或「用户名」，不是视频链接',
        });
        continue;
      }

      // ② 同一链接重复下单（库里进行中的 / 本批内已成功的）
      const nt = normTarget(targetRaw);
      if (nt) {
        const dupNo = dbActiveByTarget.get(nt);
        if (dupNo) {
          await t.rollback();
          results.push({
            serviceId, link, quantity, status: 'error',
            message: `这个链接已有一单在进行中（单号 ${dupNo}），完成前请勿重复下单`,
          });
          continue;
        }
        if (submittedInBatch.has(nt)) {
          await t.rollback();
          results.push({
            serviceId, link, quantity, status: 'error',
            message: `与本次批量第 ${submittedInBatch.get(nt)} 条链接重复，同一链接做完一单再下`,
          });
          continue;
        }
      }

      // 🔒 批量下单同样加行锁，防止并发穿透余额校验
      let user = await User.findByPk(req.user.id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!user && req.user.role !== 'super_admin') { await t.rollback(); results.push({ serviceId, link, quantity, status: 'error', message: '账户异常' }); continue; }
      if (user) reportUser = user;

      const actualRole = user ? user.role : req.user.role;

      // 💰 计价统一走 utils/pricing.js —— 与 /add 是**同一份**逻辑。
      //    以前这里内联了一份精简版，比 /add 少了站点单服务定价、活动折扣、
      //    客户分组价、订阅计费单位，导致同一服务「单笔」和「批量」价格不同，
      //    而且分站客户批量下比单笔更贵。现在两头共用，不可能再漂移。
      const price = await computeOrderPrice({
        service, qty, postsQty: undefined, orderType: bType,
        user, site: req.site, conf, transaction: t,
      });
      let charge = price.charge;
      const upstream_charge = price.upstream_charge;
      let siteCost = price.siteCost;
      let siteOwner = null;

      // 🔒 价格护栏：charge 非正/非法直接拒该条（防负数倍率刷余额）
      if (!isFinite(charge) || charge <= 0) {
        await t.rollback();
        results.push({ serviceId, link, quantity, status: 'error', message: '价格异常，请联系管理员' });
        continue;
      }

      // 🏬 分站：站主必须有余钱付这次成本
      if (req.site) {
        siteOwner = await User.findByPk(req.site.owner_id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!siteOwner) {
          await t.rollback();
          results.push({ serviceId, link, quantity, status: 'error', message: '本站暂未开放，请联系客服' });
          continue;
        }
        if (parseFloat(siteOwner.balance) < siteCost) {
          await t.rollback();
          results.push({ serviceId, link, quantity, status: 'error', message: '本站当前无法接单，请联系客服补充库存' });
          continue;
        }
      }

      // 💰 余额校验放在"最终售价"确定之后
      // 🔴 2026-11-03 修：这里原来是 `parseFloat(user.balance) - totalCharge < charge`。
      //    user 是**每单重新带行锁查出来的**，而且下面第 510 行会立刻把这一单的 charge
      //    从 user.balance 里扣掉 —— 也就是说 user.balance 本来就是「已扣到当前单」的真实余额。
      //    再减一次 totalCharge（累计已扣金额）等于**重复扣**：
      //      余额 100、每单 30 → 第 3 单算成 40-60 = -20 < 30 → 误判"余额不足"，
      //      客户明明还有 40 元，却下不了第三单。批量下单越多越容易撞上。
      if (user && parseFloat(user.balance) < charge) {
        await t.rollback();
        results.push({ serviceId, link, quantity, status: 'error', message: `余额不足，需要 ¥${charge}` });
        continue;
      }

      // ══════════════════════════════════════════════════════════════════════
      // 阶段 A（短事务）：扣款 + 建单 + 流水 → 立刻提交。
      // 与 /add 同口径：axios 绝不能跑在事务里。批量是最高频的下单方式，
      // 每单卡 15 秒的行锁能把整批（最多 50 条）拖成分钟级，而且上游接了单、
      // 本地建单失败就整笔回滚 = 白送。
      // ══════════════════════════════════════════════════════════════════════
      const orderNo = (req.site ? '' : 'XN') + Date.now() + Math.floor(Math.random() * 100);
      const pendingOrder = await Order.create({
        order_no: orderNo, user_id: req.user.id, phone: user ? user.phone : 'SuperAdmin',
        site_id: req.site ? Number(req.site.id) : 0,
        site_cost: siteCost,
        upstream_order_id: null, service_id: serviceId,
        service_name: service.name, link, quantity: qty, charge, upstream_charge,
        status: '提交中'
      }, { transaction: t });

      if (user) {
        totalCharge += parseFloat(charge);
        user.balance = (parseFloat(user.balance) - parseFloat(charge)).toFixed(6);
        await user.save({ transaction: t });

        await Transaction.create({
          user_id: user.id, phone: user.phone, amount: -charge, balance: user.balance,
          type: '批量订单扣款', description: `批量购买 [ID:${serviceId}] ${service.name} 数量:${qty}`,
          site_id: req.site ? Number(req.site.id) : 0
        }, { transaction: t });
      }

      // 🏬 分站主成本扣减（与客户扣款同事务）
      if (siteOwner) {
        siteOwner.balance = (parseFloat(siteOwner.balance) - siteCost).toFixed(6);
        await siteOwner.save({ transaction: t });
        await Transaction.create({
          user_id: siteOwner.id, phone: siteOwner.phone, amount: -siteCost, balance: siteOwner.balance,
          type: '分站成本扣款', description: `分站批量订单成本 ${orderNo} [ID:${serviceId}] 数量:${qty}`,
          site_id: req.site ? Number(req.site.id) : 0
        }, { transaction: t });
      }

      await t.commit();

      // ══════════════════════════════════════════════════════════════════════
      // 阶段 B（无事务、不持锁）：调上游；失败就把这一条单独退回去
      // ══════════════════════════════════════════════════════════════════════
      const payloadObj = { key: conf.upstream_key, action: 'add', service: serviceId, link, quantity: qty };
      const payload = new URLSearchParams(payloadObj);
      let upRes = null;
      let upFailed = false;
      try {
        upRes = await axios.post(conf.upstream_url, payload.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000
        });
      } catch (err) {
        upFailed = true;
        console.error(`[batch] 上游调用失败 service=${serviceId} uid=${req.user.id}:`, err && err.message);
      }

      if (!upFailed && upRes.data && upRes.data.order) {
        await Order.update(
          { upstream_order_id: String(upRes.data.order), status: '排队中' },
          { where: { id: pendingOrder.id } }
        );
        // 记下这条链接，本批后面的同链接行会被拦（只记成功的）
        if (nt) submittedInBatch.set(nt, results.length + 1);
        results.push({ serviceId, link, quantity: qty, status: 'success', order_no: orderNo, charge });
      } else {
        const rf = await refundOrderFully(pendingOrder.id, { reason: '订单未能提交，已全额退款' });
        if (!rf.ok) {
          console.error(`🚨 [batch] 补偿退款失败，需人工处理 order=${orderNo} uid=${req.user.id}`);
          sendTgMessage(`🚨 <b>批量补偿退款失败，需人工处理</b>\n🔖 单号: <code>${orderNo}</code>\n🆔 UID: <code>${req.user.id}</code>\n💸 金额: ￥${charge}`);
        } else {
          totalCharge -= parseFloat(charge);   // 已退回，不计入本批总扣费
        }
        results.push({
          serviceId, link, quantity: qty, status: 'error',
          message: upFailed ? '服务暂不可用，请稍后重试' : ((upRes.data && upRes.data.error) || '服务暂不可用，请稍后重试')
        });
      }
    } catch (e) {
      await t.rollback().catch(() => {});
      // 客户可见的错误里**不能带 e.message**：那是 SQL/上游/约束错误原文，
      // 会把表名、字段名、上游返回体一起糊到客户脸上（也不符合「XNOW 就是服务源头」的对外口径）。
      console.error(`[batch] 下单异常 service=${serviceId} uid=${req.user.id}:`, e);
      results.push({ serviceId, link, quantity, status: 'error', message: '系统繁忙，该条未提交成功，请稍后重试' });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status === 'error').length;

  // TG 播报
  if (reportUser) {
    const roleName = reportUser.role === 'super_admin' ? '至尊管理员' : reportUser.role === 'admin' ? '管理员' : reportUser.role === 'agent' ? '👑 至尊代理' : '黄金用户';
    sendTgMessage(`📦 <b>批量下单完成</b>\n🆔 <b>UID:</b> <code>${reportUser.id}</code>\n📱 <b>账号:</b> <code>${reportUser.phone}</code>\n🔰 <b>等级:</b> ${roleName}\n✅ <b>成功:</b> ${successCount} 单\n❌ <b>失败:</b> ${failCount} 单\n💸 <b>总扣费:</b> ￥${totalCharge.toFixed(2)}\n💰 <b>扣费后余额:</b> ￥${Number(reportUser.balance).toFixed(2)}`);
  }

  res.json({ status: 'success', data: { total: batchOrders.length, success: successCount, fail: failCount, total_charge: totalCharge.toFixed(4), results } });
});

router.get('/', authenticate, async (req, res) => {
  try {
    // 🔒 只返回客户该看的字段。
    //    原来直接 `findAll` 返回整行，把 `upstream_charge`（平台进货成本）
    //    和 `site_cost`（站长进货价）一起吐给了客户 —— 任何人打开接口
    //    就能算出"平台每一单赚我多少"。这类数字一旦外泄，
    //    客户立刻明白自己头上压着几层加价。
    const orders = await Order.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      attributes: [
        'id', 'order_no', 'service_id', 'service_name', 'link', 'quantity',
        'charge', 'status', 'remains', 'start_count', 'is_refunded', 'created_at',
        // 💬 退款原因：客户看到「已退款」却没有原因，会默认是平台不行
        'refund_reason',
        // 📦 特殊类型的下单参数（订阅型的投喂次数/到期日/已投喂数）。
        //    这里放的都是客户自己填的东西，不涉及成本，可以下发。
        'ext_fields'
      ]
    });

    // 🏷 服务类型：orders 表本身不存 type，历史订单也没有 ext_fields，
    //    界面要区分「订阅型」和普通服务就得补这一层，否则老订单一律按普通单渲染。
    const svcIds = [...new Set(orders.map(o => o.service_id).filter(Boolean))];
    if (svcIds.length) {
      try {
        const svcs = await Service.findAll({
          where: { service_id: svcIds },
          attributes: ['service_id', 'type'],
        });
        const typeMap = new Map(svcs.map(s => [String(s.service_id), s.type]));
        for (const o of orders) {
          o.dataValues.service_type = typeMap.get(String(o.service_id)) || null;
        }
      } catch (e) {
        // 查不到就靠 ext_fields.type 兜底，不影响订单列表
        console.warn('[orders] 补充服务类型失败:', (e && e.message) || e);
      }
    }
    // 🌐 状态兜底汉化：上游偶尔回 Canceled / Cancelled / Fail 这类原文，
    //    orderSync 那边映射漏一个，客户界面就会直接露出英文（2026-11-06 截图里的
    //    「Cancelled」就是这么来的）。这里出库前统一过滤一遍。
    const STATUS_ZH = {
      'Pending': '排队中', 'In progress': '进行中', 'Processing': '处理中',
      'Completed': '已完成', 'Partial': '部分完成',
      'Canceled': '已取消', 'Cancelled': '已取消', 'Fail': '已取消', 'Failed': '已取消',
    };
    for (const o of orders) {
      const zh = STATUS_ZH[String(o.status || '').trim()];
      if (zh) o.status = zh;
    }
    res.json({ status: 'success', data: orders });
  } catch(e) {
    res.json({ status: 'error' });
  }
});
export default router;
