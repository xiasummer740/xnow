import express from 'express';
import axios from 'axios';
import { Op } from 'sequelize';
import { Service, Config, User, SiteServicePrice } from '../models/index.js';
import { customerDiscountMultiplier } from '../utils/customerPrice.js';
import { isAgentActive } from '../utils/agentStatus.js';
import { stripUpstream } from '../utils/sanitizeText.js';
import { authenticate } from '../middleware/auth.js';

// 🚫 下架哨兵：utils/sync.js 会把「上游已不存在」的服务 sort 置成 999999。
//    以前那批是被物理删除的，所以列表里天然看不到；现在改为「先标记、按护栏再删」，
//    列表查询就必须显式排除，否则客户会看到一堆点了必然下单失败的服务。
const NOT_DELISTED = { sort: { [Op.ne]: 999999 } };

const router = express.Router();

// ⏱ 进程内短缓存（60 秒）：服务清单是全站最重的接口 —— 生产上 2809 条服务、
//    未压缩 714KB、TTFB 1.44 秒（实测 2026-11-03）。而这 1.44 秒里几乎全是
//    `Service.findAll` 全表查询 + 逐条算价，跟网络没关系。
//    清单只在「后台改价 / 手动同步」时变化，60 秒内算一次绰绰有余：
//    首屏从 1.4 秒压到几毫秒，数据库也不再被每次刷新各捶一遍。
//    ⚠️ 只缓存**公开版**（不依赖登录身份）；带身份的 /api/services 不缓存，避免串价。
//    想绕过：请求带 `?nocache=1`（改完价立刻核对时用）。
const LIST_TTL_MS = 60 * 1000;
const listCache = new Map();
const cacheGet = (k) => {
  const v = listCache.get(k);
  if (v && Date.now() - v.at < LIST_TTL_MS) return v.payload;
  if (v) listCache.delete(k);
  return null;
};
const cacheSet = (k, payload) => {
  if (listCache.size > 300) listCache.clear(); // 防无界增长（多分站域名场景）
  listCache.set(k, { at: Date.now(), payload });
};

// 公开：未登录也能浏览服务（下单时才要求登录）
router.get('/public', async (req, res) => {
  try {
    // 价格只跟「域名 → 分站」和站长折扣有关，用它做缓存键；换域名/改折扣立刻换键
    const cacheKey = `pub|${req.headers.host || ''}|${req.site ? req.site.id : 0}` +
      `|${req.site ? req.site.discount_rate : ''}|${req.site ? req.site.discount_until : ''}`;
    const bypass = String(req.query.nocache || '') === '1';
    if (!bypass) {
      const hit = cacheGet(cacheKey);
      if (hit) {
        // 浏览器也缓存 2 分钟：客户来回切页面时不再重复拉 700KB
        res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
        res.set('Vary', 'Host');
        res.set('X-Services-Cache', 'hit');
        return res.json(hit);
      }
    }

    const configs = await Config.findAll({ where: { key: ['global_multiplier'] } });
    const conf = {}; configs.forEach(c => conf[c.key] = c.value);
    // 🏬 分站：首页展示的必须是**站长定的售价**，不能用平台倍率
    const multiplier = req.site ? parseFloat(req.site.multiplier) : parseFloat(conf.global_multiplier || 2.0);

    // 💰 分站的「单服务定价」与「活动折扣」也要反映到列表价上，
    //    否则客户看到的价和下单实扣的价对不上（历史上就吃过这个亏）。
    let overrideMap = new Map();
    let siteDiscount = 1;
    if (req.site) {
      try {
        const rows = await SiteServicePrice.findAll({ where: { site_id: req.site.id } });
        overrideMap = new Map(rows.map(r => [Number(r.service_id), parseFloat(r.rate)]));
      } catch (e) { overrideMap = new Map(); }
      const dr = parseFloat(req.site.discount_rate);
      const du = parseInt(req.site.discount_until || 0);
      const active = isFinite(dr) && dr > 0 && dr < 1 && !(du > 0 && Math.floor(Date.now() / 1000) > du);
      siteDiscount = active ? dr : 1;
    }

    const services = await Service.findAll({ where: NOT_DELISTED, order: [['sort', 'ASC']] });
    const formatted = services.map(s => {
      // 🔌 与下单扣费口径保持一致：custom_rate 优先（订单路由本来就是这么算的，
      //    此前这里只读 rate，导致"页面显示 0.33、实际扣 0.99"这种不一致）
      const baseRate = (s.custom_rate !== null && s.custom_rate !== undefined) ? parseFloat(s.custom_rate) : parseFloat(s.rate);
      // 站长单价优先，其次总倍率；最后统一乘活动折扣
      const listPrice = overrideMap.has(Number(s.service_id))
        ? overrideMap.get(Number(s.service_id))
        : baseRate * multiplier;
      let finalPrice = Number((listPrice * siteDiscount).toFixed(4));
      // 🛡 主站也要"售价不低于成本"：成本就是上游原价 `rate`。
      //    订单侧已经有地板（会把实扣抬到成本），但**列表价没抬** → 客户看到 31.25、
      //    下单实扣 50，又变成"标价和实扣对不上"的投诉（这个坑历史踩过）。
      //    分站走的是 costMultiplier 地板（站长成本 ≠ 上游原价），所以这里只管主站。
      if (!req.site) {
        const costFloor = parseFloat(s.rate);
        if (isFinite(costFloor) && costFloor > 0 && finalPrice < costFloor) {
          finalPrice = Number(costFloor.toFixed(4));
        }
      }
      return {
        service: s.service_id, name: s.name, type: s.type, category: s.category,
        // 🔒 不再下发 `rate`（成本基价）：这是平台/站长的进货底价，
        //    公开接口把它吐出去，等于把「你赚多少」摊开给客户看。
        //    前端只用到 sell_price（已核实 Home.vue 唯一消费点）。
        min: s.min, max: s.max,
        sell_price: finalPrice,
        // 🚀 2026-11-09：列表**不再下发 description**。
        //    实测 2798 条里有描述的 732 条，description 字段全文 348KB，
        //    整个响应 940KB。逐个核实过消费点：
        //      · Order.vue 走独立的 /api/services/detail/:id 按需拉（带 descCache）
        //      · Home.vue / Landing.vue 只用 name/category/sell_price
        //      · Admin.vue 用的是管理端接口，不是这个公开列表
        //    → 公开列表里的 description **前端没有任何地方读**。
        //    ⚠️ 以后若要显示描述，请走 detail 接口，别把它加回来。
      };
    });
    const payload = { status: 'success', data: formatted };
    cacheSet(cacheKey, payload);
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
    res.set('Vary', 'Host');
    res.set('X-Services-Cache', 'miss');
    res.json(payload);
  } catch (err) {
    // 🔴 2026-11-03：这里原来只有一句 res.status(500).json({message:'加载失败'})，
    //    **没有日志**。结果是「拉不到服务」发生后，pm2 里一个字都查不到，只能靠猜。
    //    清单页是全站最高频接口，它挂了等于全站不可用，必须留下可定位的一行。
    console.error(`[services/public] 加载失败 host=${req.headers.host || '-'} site=${req.site ? req.site.id : 0}:`, err);
    res.status(500).json({ status: 'error', message: '加载失败' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const configs = await Config.findAll({ where: { key: ['global_multiplier', 'agent_discount'] } });
    const conf = {}; configs.forEach(c => conf[c.key] = c.value);

    const baseMultiplier = parseFloat(conf.global_multiplier || 2.0);
    const agentDiscount = parseFloat(conf.agent_discount || 0.8);

    // 🏬 分站：列表价必须与下单扣款同口径（站长倍率），否则客户会看到
    //    「标价 0.05、扣款 0.33」—— 这种不一致会直接被投诉成"骗人"。
    //    注意这里只影响"显示"，下单时的权威计算仍在 orders.js。
    const siteMultiplier = req.site ? parseFloat(req.site.multiplier) : 0;

    // 💡 核心修复：永远信任数据库中的最新角色，而不是 JWT 缓存的角色
    const user = await User.findByPk(req.user.id);
    const actualRole = user ? user.role : req.user.role;
    
    let finalMultiplier = baseMultiplier;
    
    if (req.site) {
      // 分站定价权归站长（管理员本人仍按原价，便于对账）
      finalMultiplier = (actualRole === 'super_admin' || actualRole === 'admin') ? 1.0 : siteMultiplier;
    } else if (actualRole === 'super_admin' || actualRole === 'admin') {
      finalMultiplier = 1.0;
    } else if (user && user.custom_multiplier !== null && user.custom_multiplier !== undefined) {
      finalMultiplier = parseFloat(user.custom_multiplier);
    } else if (isAgentActive(actualRole, user && user.agent_expire_at)) {
      // 👑 列表价与扣费同口径：代理 8 折必须在有效期内（2026-10-30 修）
      finalMultiplier = baseMultiplier * agentDiscount;
    }

    // 🏷 93 期（顺带修）：站点「活动折扣」以前只在扣费时算，列表价没算 ——
    //    客户看到的价和真正扣的价不一致（显示 62.5 / 实扣 56.25）。
    //    现在显示链路补齐这一步，与 orders.js 的乘算顺序完全一致：
    //      站长倍率 → 站点活动折扣 → 客户分组价/单独定价 → 成本下限
    if (req.site) {
      const dr0 = parseFloat(req.site.discount_rate);
      const du0 = parseInt(req.site.discount_until || 0);
      const discountActive = isFinite(dr0) && dr0 > 0 && dr0 < 1 && !(du0 > 0 && Math.floor(Date.now() / 1000) > du0);
      if (discountActive) finalMultiplier = finalMultiplier * dr0;
    }

    // 👥 93 期：客户分组价（显示价必须与 orders.js 的扣费口径一致）
    let customerMult = 1;
    if (req.site && user) {
      try { customerMult = await customerDiscountMultiplier(req.site.id, user) || 1; } catch (e) { customerMult = 1; }
    }
    if (customerMult > 0 && customerMult < 1) finalMultiplier = finalMultiplier * customerMult;

    // 🛡 与 orders.js 的兜底护栏一致：列表价也不得低于站长成本
    let costMultiplier = 0;
    if (req.site) {
      costMultiplier = baseMultiplier * agentDiscount;
    }

    const services = await Service.findAll({ where: NOT_DELISTED, order: [['sort', 'ASC']] });

    // 🔑 管理员看上游原价（custom_rate 只面向客户）—— 与 orders.js 扣费口径完全一致
    const isStaff = actualRole === 'super_admin' || actualRole === 'admin';

    const formatted = services.map(s => {
      const baseRate = (!isStaff && s.custom_rate !== null && s.custom_rate !== undefined)
        ? parseFloat(s.custom_rate)
        : parseFloat(s.rate);
      // 分站：售价不得低于站长成本（与下单护栏同口径，避免"买得起卖不起"）
      let shown = baseRate * finalMultiplier;
      if (req.site && costMultiplier > 0) {
        const floor = baseRate * costMultiplier;
        if (shown < floor) shown = floor;
      } else if (!isStaff) {
        // 🛡 主站（客户视角）：售价不得低于上游原价 rate。
        //    orders.js 的订单地板会把实扣抬到成本，这里不抬就出现"显示 31.25、实扣 50"。
        //    管理员不看这条（他们看的 baseRate 本来就是原价，加地板反而掩盖配置问题）。
        const costFloor = parseFloat(s.rate);
        if (isFinite(costFloor) && costFloor > 0 && shown < costFloor) shown = costFloor;
      }
      return {
        service: s.service_id,
        name: s.name,
        type: s.type,
        category: s.category,
        rate: shown.toFixed(4),
        min: s.min,
        max: s.max,
        refill: s.refill,
        cancel: s.cancel,
        // 🔴 2026-11-03：**客户侧列表不再下发 description**。
        //    这是「拉不到服务」的真正体积元凶：2809 条服务、每条描述都是几百字的长文本，
        //    全带进列表能把响应撑到 2MB 上下（对比一下：/public 不带描述就已经是 715KB）。
        //    而页面只在**选中某一条**时才显示描述（Order.vue 唯一消费点）。
        //    现在客户侧选中时调 `/api/services/detail/:id` 懒加载，管理员仍然全量带（他们要批量看简介）。
        description: isStaff ? stripUpstream(s.description) : undefined
      };
    });

    res.json({ status: 'success', data: formatted });
  } catch (err) {
    // 同上：这句是「拉不到服务」四个字的真正出处，必须带上 userId / 分站 id 落日志，
    // 否则永远分不清是数据库炸了、分站倍率炸了，还是客户分组价查询炸了。
    console.error(`[services] 拉取失败 userId=${req.user ? req.user.id : '-'} site=${req.site ? req.site.id : 0}:`, err);
    res.status(500).json({ status: 'error', message: '拉取商品库失败' });
  }
});

// 📄 单条服务详情（懒加载描述用）
//   列表接口为了体积不再下发 description，页面选中某条服务时来这里取一次。
//     · 只返回展示需要的字段，几个字节 → 秒回
//     · 不参与定价，所以不查分组价 / 分站单价，也不受缓存影响
//     · 前端自己缓存，同一服务在一个会话里只会请求一次
//
// 🔴 2026-11-06 加「描述缺失时向上游补抓」。
//    背景：上游 /services 页面改版后，同步里的老正则一条都匹配不到，
//    全站 2803 个服务的 description 全是空的 —— 客户看不到下单规范，
//    链接格式写错、同一链接重复下单，投诉一路涨。
//    现在改为**按需补抓**：客户点开哪个服务就抓哪个，抓到立刻入库，
//    下次直接读库。比在同步里全量抓 2800 个（每个 5–6 秒，30 多分钟）现实得多。
const DESC_TIMEOUT_MS = 6000;
const descFetching = new Set();   // 同一服务并发只抓一次

async function fetchDescFromUpstream(sid) {
  if (descFetching.has(sid)) return '';
  descFetching.add(sid);
  try {
    const urlConf = await Config.findOne({ where: { key: 'upstream_url' } });
    if (!urlConf?.value) return '';
    const origin = new URL(urlConf.value).origin;
    const r = await axios.get(`${origin}/services/get-service-description/${sid}`, {
      timeout: DESC_TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const d = r.data && r.data.description;
    return d && String(d).trim() ? String(d).trim() : '';
  } catch {
    // 上游慢/挂了都不能影响下单页 —— 拿不到就返回空，前端显示基础规范
    return '';
  } finally {
    descFetching.delete(sid);
  }
}

router.get('/detail/:serviceId', authenticate, async (req, res) => {
  try {
    const sid = parseInt(req.params.serviceId, 10);
    if (!Number.isFinite(sid)) return res.status(400).json({ status: 'error', message: '参数非法' });
    const s = await Service.findOne({ where: { service_id: sid, ...NOT_DELISTED }, attributes: ['service_id', 'name', 'description', 'type', 'min', 'max'] });
    if (!s) return res.status(404).json({ status: 'error', message: '商品不存在或已下架' });

    let desc = stripUpstream(s.description || '');
    if (!desc.trim()) {
      const fetched = await fetchDescFromUpstream(sid);
      if (fetched) {
        // 🚫 这里抓到的是上游原文，可能带 tk7188.com 之类的品牌和下单链接。
        //    入库前必须洗掉，否则谁先点开这个服务，脏数据就永久写进库里了。
        desc = stripUpstream(fetched);
        // 入库存下来，后面所有人直接读库；失败也不影响本次返回
        Service.update({ description: desc }, { where: { service_id: sid } })
          .catch((e) => console.error(`[services/detail] 描述入库失败 service=${sid}:`, e.message));
      }
    }

    res.json({
      status: 'success',
      data: {
        service: s.service_id, name: s.name, type: s.type, min: s.min, max: s.max,
        // 兜底：库里历史脏数据经过上面那层已洗过，这里返回的是干净文本
        description: stripUpstream(desc)
      }
    });
  } catch (err) {
    console.error(`[services/detail] 失败 service=${req.params.serviceId} uid=${req.user ? req.user.id : '-'}:`, err);
    res.status(500).json({ status: 'error', message: '加载商品详情失败' });
  }
});
export default router;
