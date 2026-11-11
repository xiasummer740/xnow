import express from 'express';
import crypto from 'crypto';
import { Config, Transaction, sequelize, User, Site, SiteCollection } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import axios from 'axios';
import { sendTgMessage } from '../utils/tgBot.js';
import { addPendingPayment, markCompleted, markFailed, getPendingPayments, markProcessing, cleanOldPayments, setAoid } from '../utils/paymentTracker.js';
import { resolveChannel, offMessage } from '../utils/payChannel.js';
import { creditUser, creditCommission } from '../utils/balance.js';
import { payOrderMatch, payOrderDescriptionLike } from '../utils/payOrder.js';

const router = express.Router();
const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');
// 同单并发入账锁（单进程内存），防止 /pay/status 轮询与补单引擎同刻双写入账
const creditLock = new Set();

const getDomain = (req) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${protocol}://${host}`;
};

// 🏬 分站自有商户（方案②）：钱直接进站长自己的 BufPay / Cryptomus 账户，平台一分不碰。
//    —— 开票时用「当前访问域名所属分站」的商户；
//    —— 回调时用「付款用户所属分站」的密钥验签（回调里不带站点信息，
//       但都带 order_uid 或含 uid 的 order_id，由用户反查最可靠，也不怕被伪造）。
//    分站没配 → 回退平台商户，行为与改造前完全一致。
const sitePayCreds = async (siteId, kind) => {
  if (!siteId) return null;
  try {
    const site = await Site.findByPk(siteId);
    if (!site) return null;
    if (kind === 'bufpay' && site.bufpay_id && site.bufpay_key) {
      return { id: site.bufpay_id, key: site.bufpay_key, name: site.name, siteId: site.id };
    }
    if (kind === 'cryptomus' && site.cryptomus_id && site.cryptomus_key) {
      return { id: site.cryptomus_id, key: site.cryptomus_key, name: site.name, siteId: site.id };
    }
    return null;
  } catch (e) { return null; }
};

// 由付款用户反查其所属分站的商户密钥（回调验签用）
const ownerSiteIdOfUser = async (uidRaw) => {
  const uid = parseInt(uidRaw || 0);
  if (!uid) return 0;
  const u = await User.findByPk(uid).catch(() => null);
  return u ? Number(u.site_id || 0) : 0;
};

router.post('/rmb/sign', authenticate, async (req, res) => {
    const { pay_type, amount } = req.body;
    if (!['wechat', 'alipay'].includes(pay_type) || !amount || amount <= 0) return res.json({ status: 'error', message: '参数非法' });
    try {
        const configs = await Config.findAll({ where: { key: ['bufpay_id', 'bufpay_key', 'site_name'] } });
        const conf = {}; configs.forEach(c => conf[c.key] = c.value);
        // 🏬 收款通道 A/B（祥哥 2026-10-29 定：两条都要具备、站长自助切换、免审批）
        //    own      → 站长自己的商户，钱进站长账户，平台一分不碰
        //    platform → 主站商户代收，钱进平台账户，必须落「代收台账」site_collections
        //    off      → 明确告诉客户"未开通"（绝不偷偷用平台账户给没开代收的站收款）
        const chan = resolveChannel(req.site, 'bufpay');
        if (req.site && chan.channel === 'off') {
            return res.json({
                status: 'error',
                message: offMessage('bufpay'),
                code: 'NO_SITE_MERCHANT',
                reason: chan.reason,   // 只给站长后台/日志看，前端不展示给客户
            });
        }
        const siteCreds = chan.channel === 'own' ? await sitePayCreds(Number(req.site.id), 'bufpay') : null;
        if (req.site && chan.channel === 'own' && !siteCreds) {
            return res.json({ status: 'error', message: offMessage('bufpay'), code: 'NO_SITE_MERCHANT', reason: 'OWN_MERCHANT_MISSING' });
        }
        // 标记这一笔是平台代收（回调入账时据此写台账）
        req.__platformCollected = !!chan.platformCollected;
        if (siteCreds) { conf.bufpay_id = siteCreds.id; conf.bufpay_key = siteCreds.key; conf.site_name = siteCreds.name; }
        const cleanBufId = (val) => { if (!val) return ''; const match = val.match(/\/(\d+)$/); if (match) return match[1]; return val.replace(/[^0-9]/g, ''); };
        const realBufId = cleanBufId(conf.bufpay_id);
        if (!realBufId || !conf.bufpay_key) {
          // 分站代收场景下，这是"平台侧还没配商户"，对客户说什么都没用 —— 给一句能懂的话
          return res.json(
            req.__platformCollected
              ? { status: 'error', message: '本站在线充值暂未开通，请联系客服处理', code: 'NO_SITE_MERCHANT' }
              : { status: 'error', message: '支付配置缺失' }
          );
        }

        const amountFloat = parseFloat(amount);
        const isFreeFee = amountFloat >= 500;
        const actualPrice = isFreeFee ? amountFloat : amountFloat * 1.05;
        const price = actualPrice.toFixed(2);
        
        const domain = getDomain(req);
        const order_id = `BUF_${pay_type}_${amountFloat.toFixed(2)}_${Date.now()}`;
        const name = `${conf.site_name || 'XNOW'}充值`;
        const order_uid = String(req.user.id);
        const notify_url = `${domain}/api/pay/notify/bufpay`; 
        const return_url = `${domain}/api/pay/return/bufpay`; 
        const feedback_url = '';

        const signStr = name + pay_type + price + order_id + order_uid + notify_url + return_url + feedback_url + conf.bufpay_key;
        const sign = md5(signStr);

    addPendingPayment({ order_id, user_id: req.user.id, amount: amountFloat, pay_type });

        res.json({
            status: 'success', target_url: `https://bufpay.com/api/pay/${realBufId}`, order_id: order_id,
            params: { name, pay_type, price, order_id, order_uid, notify_url, return_url, feedback_url, sign, expire: '300' }
        });
    } catch (e) { res.json({ status: 'error', message: '签名计算失败' }); }
});

const cryptomusSign = (data, apiKey) => {
    const jsonStr = JSON.stringify(data);
    const base64Str = Buffer.from(jsonStr).toString('base64');
    return md5(base64Str + apiKey);
};

// 读取本站 Cryptomus 商户参数（下单与回调查证共用，避免重复查表）
const loadCryptomusConf = async () => {
    const configs = await Config.findAll({ where: { key: ['cryptomus_id', 'cryptomus_key'] } });
    const conf = {}; configs.forEach(c => conf[c.key] = c.value);
    if (!conf.cryptomus_id || !conf.cryptomus_key) return null;
    return { id: conf.cryptomus_id, key: conf.cryptomus_key };
};

// 回调验签：sign = md5(base64(去掉 sign 后的 JSON) + paymentKey)
// PHP 默认转义 '/'，Node 不转义 → 同一载荷两种序列化各算一次都放行
const cryptomusVerify = (data, apiKey) => {
    try {
        if (!data || !apiKey) return false;
        const { sign, ...rest } = data;
        if (!sign) return false;
        const plain = JSON.stringify(rest);
        const escaped = plain.replace(/\//g, '\\/');
        return [plain, escaped].some(jsonStr =>
            md5(Buffer.from(jsonStr).toString('base64') + apiKey) === sign
        );
    } catch { return false; }
};

// 服务端签名向 Cryptomus 查证某单是否真付（不信回调明文，防伪造回调直接写余额）
const cryptomusCheckPaid = async (orderId) => {
    const conf = await loadCryptomusConf();
    if (!conf) throw new Error('cryptomus 商户参数未配置，无法对账');
    const payload = { order_id: orderId };
    const sign = cryptomusSign(payload, conf.key);
    const resp = await axios.post('https://api.cryptomus.com/v1/payment/info', payload, {
        headers: { 'merchant': conf.id, 'sign': sign, 'Content-Type': 'application/json' },
        timeout: 8000
    });
    const st = resp.data?.result?.status;
    return st === 'paid' || st === 'paid_over';
};

router.post('/usd', authenticate, async (req, res) => {
    const { amount } = req.body;
    try {
        const configs = await Config.findAll({ where: { key: ['cryptomus_id', 'cryptomus_key'] } });
        const conf = {}; configs.forEach(c => conf[c.key] = c.value);
        // 🏬 分站自有 Cryptomus 优先
        const chanUsd = resolveChannel(req.site, 'cryptomus');
        if (req.site && chanUsd.channel === 'off') {
            return res.json({ status: 'error', message: offMessage('cryptomus'), code: 'NO_SITE_MERCHANT', reason: chanUsd.reason });
        }
        const siteCredsUsd = chanUsd.channel === 'own' ? await sitePayCreds(Number(req.site.id), 'cryptomus') : null;
        if (req.site && chanUsd.channel === 'own' && !siteCredsUsd) {
            return res.json({ status: 'error', message: offMessage('cryptomus'), code: 'NO_SITE_MERCHANT', reason: 'OWN_MERCHANT_MISSING' });
        }
        if (siteCredsUsd) { conf.cryptomus_id = siteCredsUsd.id; conf.cryptomus_key = siteCredsUsd.key; }
        if (!conf.cryptomus_id || !conf.cryptomus_key) return res.json({ status: 'error', message: 'USDT商户参数未配置' });

        const domain = getDomain(req);
        const amountFloat = parseFloat(amount);
        // 🔒 金额护栏：非正/NaN 一律拒绝，防负数/NaN 单进队列
        if (!(amountFloat > 0) || !isFinite(amountFloat)) return res.json({ status: 'error', message: '金额非法' });
        const safeAmountStr = amountFloat.toFixed(2).replace('.', 'd');
        const order_id = `USDT_${safeAmountStr}_${Date.now()}`;

        const payload = { amount: String(amount), currency: 'USD', order_id: order_id, url_return: `${domain}/recharge`, url_callback: `${domain}/api/pay/notify/cryptomus`, is_payment_multiple: true, lifetime: 3600, to_currency: 'USDT' };
        const sign = cryptomusSign(payload, conf.cryptomus_key);

        const response = await axios.post('https://api.cryptomus.com/v1/payment', payload, { headers: { 'merchant': conf.cryptomus_id, 'sign': sign, 'Content-Type': 'application/json' } });

        if (response.data?.result?.url) {
            // 下单成功 → 登记本站待支付单，补单引擎才能接手（回调查不到也不丢）
            addPendingPayment({ order_id, user_id: req.user.id, amount: amountFloat, pay_type: 'USDT' });
            res.json({ status: 'success', url: response.data.result.url });
        }
        else {
            // 🔴 Cryptomus 常以 HTTP 200 + {state:0,message} 的形式报参数/密钥错误，必须落日志
            console.error(`❌ [Cryptomus] 开票被拒 order=${order_id} 返回=${JSON.stringify(response.data).slice(0, 300)}`);
            res.json({ status: 'error', message: '网关未返回支付链接' });
        }
    } catch (e) {
        // 🔴 这里曾把真实错误完全吞掉（只剩"网关阻断"），导致"USDT 充值全坏"长期无人发现。
        //    常见根因：Cryptomus 的 Payment API Key 与商户号不属于同一账户 / 密钥被重置。
        const detail = e?.response
            ? `HTTP ${e.response.status} ${JSON.stringify(e.response.data).slice(0, 300)}`
            : (e?.code || e?.message || String(e));
        console.error(`❌ [Cryptomus] 开票失败：${detail}`);
        res.json({ status: 'error', message: `网关阻断，请联系管理员` });
    }
});

// 🔒 支付状态轮询：只读 + 按【本站登记、属于当前用户】的待支付单补查。
// 不信任前端传的 aoid/amount —— 金额一律以后端登记值为准，杜绝伪造补单入账。
router.get('/status', authenticate, async (req, res) => {
    const { order_id } = req.query;
    if (!order_id) return res.json({ status: 'wait' });
    try {
        // 该用户该单已入账 → 成功
        // （同样要转义 LIKE 通配符：`BUF_1723_9.9_x` 里的 `_` 会命中别人的单号，见 utils/payOrder.js）
        const exist = await Transaction.findOne({ where: payOrderMatch(order_id, req.user.id) });
        if (exist) return res.json({ status: 'success' });

        // 只允许补查本站登记过、且归属当前用户的待支付单（补单金额以后端登记额为准）
        const pending = getPendingPayments().find(p => p.order_id === order_id && String(p.user_id) === String(req.user.id));
        if (pending && Date.now() - new Date(pending.created_at).getTime() >= 180000) {
            try {
                let paid = false;
                if (pending.pay_type === 'USDT') {
                    // USDT 走服务端签名向 Cryptomus 查证（bufpay 查询接口管不了 USDT 单）
                    paid = await cryptomusCheckPaid(order_id);
                } else {
                    const response = await axios.get(`https://bufpay.com/api/query?order_id=${encodeURIComponent(order_id)}`, { timeout: 3000 });
                    paid = !!(response.data && (response.data.status === 'success' || response.data.status === 'payed'));
                }
                if (paid) {
                    const ok = await handleSuccessPay(order_id, req.user.id, pending.amount, pending.pay_type === 'USDT' ? 'Cryptomus补单' : 'BufPay补单');
                    if (ok) {
                        markCompleted(order_id);
                        return res.json({ status: 'success' });
                    }
                    // 失败/在途：不标完成、不回 success，保持 wait 让客户端续轮询/引擎重试
                }
            } catch (ignore) {}
        }
        res.json({ status: 'wait' });
    } catch (e) { res.json({ status: 'error' }); }
});

// 回调验签用：按付款用户所属分站取 BufPay 密钥，取不到回退平台
const resolveBufpayKey = async (orderUid) => {
    const sid = await ownerSiteIdOfUser(orderUid);
    const sc = await sitePayCreds(sid, 'bufpay');
    if (sc) return sc.key;
    const conf = await Config.findOne({ where: { key: 'bufpay_key' } });
    return conf ? conf.value : null;
};

router.get('/return/bufpay', async (req, res) => {
    const { aoid, order_id, order_uid, price, pay_price, sign } = req.query;
    // 🔴 先把平台单号存下来 —— 这是补单引擎唯一能查证的钥匙，
    //    放过这一处，以后这单回调丢了就再也查不回来了。
    if (aoid && order_id) setAoid(order_id, aoid);
    try {
        const key = await resolveBufpayKey(order_uid);
        if (key) {
            const localSign = md5(aoid + order_id + order_uid + price + pay_price + key);
            if (localSign === sign) {
              const ok = await handleSuccessPay(order_id, order_uid, pay_price, 'BufPay返回');
              if (ok) markCompleted(order_id); // 失败不标完成，补单引擎会接手重试
            }
        }
    } catch (e) {}
    res.send(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>支付成功</title><style>body { background: #0f172a; color: #34d399; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }</style></head><body><h2>支付成功，正在自动跳转...</h2><script>if(window.parent!==window){window.parent.postMessage({type:'pay_success'},window.location.origin);}else{window.location.href='/recharge';}</script></body></html>`);
});

router.post('/notify/bufpay', express.urlencoded({ extended: true }), async (req, res) => {
    const { aoid, order_id, order_uid, price, pay_price, sign } = req.body;
    // 回调里带了 aoid，落盘备查（即使后面签名校验不过，单号本身是网关给的，先留着）
    if (aoid && order_id) setAoid(order_id, aoid);
    try {
        // 🔒 先做参数完整性检查：这是公开端点，任何人（含扫描器）都能打。
        //    缺字段时若直接往下走，会在解析 order_uid / 查商户配置时抛异常，
        //    被 catch 兜成 500 —— 网关会把 500 当"我方故障"并持续重试，
        //    既污染日志，也可能让支付平台判定回调异常。缺参数就该明确 400。
        if (!aoid || !order_id || !order_uid || price === undefined || pay_price === undefined || !sign) {
            return res.status(400).send('Bad Request');
        }
        const key = await resolveBufpayKey(order_uid);
        if (!key) return res.status(500).send('No Config');
        const localSign = md5(aoid + order_id + order_uid + price + pay_price + key);
        if (localSign !== sign) return res.status(400).send('Sign Error');
        const ok = await handleSuccessPay(order_id, order_uid, pay_price, 'BufPay异步回调');
        if (!ok) return res.status(500).send('入账失败，请网关稍后重试'); // 保持 pending，等网关/补单引擎重试
        markCompleted(order_id);
        res.status(200).send('ok');
    } catch (e) { res.status(500).send('Error'); }
});

// 💳 Cryptomus (USDT) 异步回调 —— 真实入账入口。
// 验签通过 → 直接入账；验签失败（merchant 与 payment key 可能不同）→ 不信任回调明文，
// 改由服务端签名向 Cryptomus 查证后再入账，杜绝伪造回调直接写余额。
router.post('/notify/cryptomus', async (req, res) => {
    const data = req.body || {};
    const orderId = data.order_id;
    const status = data.status;
    const pending = orderId && getPendingPayments().find(p => p.order_id === orderId && p.pay_type === 'USDT');
    // 未知/非本站单 → 一律 200 停掉网关重试（该停的停，别让网关连环轰炸）
    if (!pending) return res.status(200).send('OK');
    // 失败终态 → 标记失败，交由人工/补单审视。文案必须让看表的人一眼知道是谁的原因。
    const CRYPTO_FAIL_ZH = {
        fail: '支付失败（用户银行卡/余额不足或被拒绝）',
        cancel: '用户在支付页取消了付款',
        system_fail: '支付系统故障，交易未完成（网关侧问题）',
        refund_fail: '退款失败，需人工处理',
    };
    if (['fail', 'cancel', 'system_fail', 'refund_fail'].includes(status)) {
        markFailed(orderId, CRYPTO_FAIL_ZH[status] || ('支付未完成（' + status + '）'));
        return res.status(200).send('OK');
    }
    // 仅对「付款成功」态入账
    if (status === 'paid' || status === 'paid_over') {
        const conf = (await sitePayCreds(await ownerSiteIdOfUser(pending.user_id), 'cryptomus')) || await loadCryptomusConf();
        if (conf && cryptomusVerify(data, conf.key)) {
            const ok = await handleSuccessPay(orderId, pending.user_id, pending.amount, 'Cryptomus回调');
            if (ok) markCompleted(orderId);
            return res.status(200).send('OK');
        }
        // 验签失败/无法验签：不信回调明文，改服务端查证。查证成功才入账；查证失败保持 pending，
        // 交给补单引擎每2分钟重查，直到 1 小时发票超时。始终回 200 停网关重试。
        try {
            if (await cryptomusCheckPaid(orderId)) {
                const ok = await handleSuccessPay(orderId, pending.user_id, pending.amount, 'Cryptomus对账');
                if (ok) markCompleted(orderId);
            }
        } catch (e) {
            console.error('💥 [Cryptomus] 回调对账失败 order=' + orderId + ' err=' + (e && e.message || e));
        }
    }
    res.status(200).send('OK');
});

// 返回 true = 已成功入账/本单已处理完；返回 false = 入账失败或在途，
// 调用方收到 false 时【不得 markCompleted】，须保持 pending 交给补单引擎重试，防资金静默丢失。
async function handleSuccessPay(orderId, userId, bufPayPrice, sourceDesc) {
    // 🔒 同单并发入账锁：轮询 /pay/status 与补单引擎同刻触发时只入账一次
    if (creditLock.has(orderId)) return false;
    creditLock.add(orderId);
    const t = await sequelize.transaction();
    try {
        // 🔴 2026-11-03 重写幂等判定（详见 utils/payOrder.js 的注释）：
        //    原来 `description LIKE '%${orderId}%'` 里的 `_` 是 LIKE 通配符，
        //    会命中**别的单号** → 把该入账的充值判成"已处理"直接吞掉；而且没带 user_id。
        const exist = await Transaction.findOne({
          where: payOrderMatch(orderId, userId),
          transaction: t,
        });
        if (exist) { await t.commit(); return true; }

        let prefix = '在线充值';
        if (orderId.includes('_wechat_')) prefix = '微信充值';
        else if (orderId.includes('_alipay_')) prefix = '支付宝充值';
        else if (orderId.startsWith('USDT')) prefix = 'USDT充值';

        let realAddAmount = parseFloat(bufPayPrice);
        const parts = orderId.split('_');
        if (orderId.startsWith('BUF_') && parts.length >= 4) {
            realAddAmount = parseFloat(parts[2]); 
        } else if (orderId.startsWith('USDT_') && parts.length >= 3) {
            realAddAmount = parseFloat(parts[1].replace('d', '.'));
        }

        // 🔒 金额护栏：非正/NaN 一律拒绝入账（走 catch→返回 false 保持 pending），防余额被写成 NaN/负数
        if (!(realAddAmount > 0)) throw new Error('入账金额非法 order=' + orderId);

        const user = await User.findByPk(userId, { transaction: t });
        if (user) {
          const paySiteId = parseInt(user.site_id || 0);
          // 🔒 原子入账：以前是「读到 balance → 加 → save()」，
          //    与下单事务（持行锁）并发时，这条 UPDATE 会拿旧快照覆盖掉刚扣的钱
          const newBalance = await creditUser(user.id, realAddAmount, { transaction: t });

          await Transaction.create({
            user_id: user.id, phone: user.phone, amount: realAddAmount, balance: newBalance,
            type: prefix, description: `${prefix} - ${sourceDesc} [单号:${orderId}]`,
            site_id: paySiteId
          }, { transaction: t });

            // 💰 平台代收台账：分站客户的钱进了平台商户时，必须记一行"平台欠站长"，
            //    否则站长申请提现时无从核销（不落账 = 平台吞钱）。
            if (paySiteId > 0) {
              try {
                const paySite = await Site.findByPk(paySiteId, { transaction: t });
                const isUsdt = orderId.startsWith('USDT');
                // 通道必须和开票时一致地重算：只有真正走了「平台代收」的那一笔才落台账。
                // 站长中途改了收款方式也不会把历史账记错（自己的商户收到的钱平台没收到，落了台账就是凭空负债）。
                const chan = resolveChannel(paySite, isUsdt ? 'cryptomus' : 'bufpay');
                if (paySite && chan.channel === 'platform') {
                  await SiteCollection.findOrCreate({
                    where: { order_id: orderId },
                    defaults: { site_id: paySiteId, user_id: user.id, order_id: orderId, amount: realAddAmount },
                    transaction: t,
                  });
                }
              } catch (e) { console.error('[代收台账写入失败]', orderId, e.message); }
            }

            const roleName = user.role === 'super_admin' ? '至尊管理员' : user.role === 'admin' ? '管理员' : user.role === 'agent' ? '👑 至尊代理' : '黄金用户';
            sendTgMessage(`💰 <b>充值成功入账</b>\n🆔 <b>UID:</b> <code>${user.id}</code>\n📱 <b>账号:</b> <code>${user.phone}</code>\n💵 <b>金额:</b> ￥${realAddAmount.toFixed(2)}\n🏦 <b>渠道:</b> ${prefix}\n💳 <b>当前余额:</b> ￥${parseFloat(newBalance).toFixed(2)}\n🔗 <b>追踪单号:</b> <code>${orderId}</code>`);

            // 💡 裂变引擎：阶梯式全自动提成计算
            // 🏬 分站客户的充值**不发平台返佣**：那笔钱进的是站长自己的商户账户，
            //    平台一分没收到。照发等于平台凭空掏钱补贴站长的客户 —— 充得越多亏得越多。
            // 🔒 自己邀自己不发：`inviter_id` 是注册时请求体自填的，不判就成了
            //    「每次充值白拿 5~10% 余额」的无限套利口子（付 500 得 500 + 25）。
            if (user.inviter_id && paySiteId === 0 && Number(user.inviter_id) !== Number(user.id)) {
                const inviter = await User.findByPk(user.inviter_id, { transaction: t });
                if (inviter) {
                    // 判断上级身份，agent/admin 享受 10%，否则 5%
                    const rate = ['agent', 'admin', 'super_admin'].includes(inviter.role) ? 0.10 : 0.05;
                    let commission = parseFloat((realAddAmount * rate).toFixed(2));

                    // 🔒 单笔返佣封顶（2026-11-03）：配置项 `commission_cap_per_tx`，单位元。
                    //    不配 = 0 = 不封顶（保持原有行为，不擅自改业务规则）。
                    //    为什么要这个开关：返佣是按**充值**发的，而退款不会冲回。
                    //    有人可以「充值 → 拿返佣 → 申请退款/走提现」把返佣套出来，
                    //    一次充 10 万就是白拿 5 千~1 万。有了这个上限，单笔最多亏到上限为止。
                    //    真正的根治是「按消费返佣」或「退款时冲回返佣」—— 那是产品决策，需要祥哥拍板。
                    try {
                        const capConf = await Config.findOne({ where: { key: 'commission_cap_per_tx' }, transaction: t });
                        const cap = parseFloat(capConf && capConf.value);
                        if (isFinite(cap) && cap > 0 && commission > cap) {
                            console.warn(`[commission] 单笔返佣被封顶：原 ${commission} → ${cap} (上级 ${inviter.id}，下级 ${user.id})`);
                            commission = cap;
                        }
                    } catch (_) { /* 读配置失败不影响正常发放 */ }

                    if (commission > 0) {
                        // 🔒 余额与累计返佣一起原子累加（并发充值不会丢更新）
                        const got = await creditCommission(inviter.id, commission, { transaction: t });

                        await Transaction.create({
                            user_id: inviter.id, phone: inviter.phone, amount: commission, balance: got.balance,
                            type: '推广返佣', description: `下级(UID:${user.id})充值返佣`
                        }, { transaction: t });

                        sendTgMessage(`🎁 <b>推广返佣已发放</b>\n🆔 <b>上级 UID:</b> <code>${inviter.id}</code> (身份: ${inviter.role})\n💸 <b>入账金额:</b> ￥${commission.toFixed(2)} (级别红利 ${rate*100}%)\n🔗 <b>来源:</b> UID <code>${user.id}</code>`);
                    }
                }
            }
        }
        await t.commit();
        return !!user; // 用户不存在 → 不标完成，让补单引擎重试到上限后 TG 告警
    } catch (e) {
        await t.rollback();
        console.error('💥 [支付入账] 失败 order=' + orderId + ' err=' + (e && e.message || e));
        return false;
    } finally {
        creditLock.delete(orderId);
    }
}
export default router;


// ============================================================
// 支付补单引擎 - 每2分钟自动执行，处理回调失败的单子
// ============================================================
/**
 * 对「一条待支付记录」做一次查证：流水里已经有就当完成；否则问网关有没有付；
 * 付了就直接入账。补单引擎（每 2 分钟）和密室「立即重查」（人工点）共用这一份逻辑 ——
 * 两边各写一遍迟早会跑偏，钱的事不能有两套口径。
 *
 * @returns {Promise<{state:'done'|'pending'|'error', paid?:boolean, note?:string, queryErr?:any}>}
 */
export async function reconcileOne(pay) {
  const isUsdt = pay.pay_type === 'USDT'
  // ① 流水里已经有这单 → 说明回调/补单已经入过账，只是记录没标完成
  //    ⚠️ 这里必须带 user_id：待补单记录里有 user_id（addPendingPayment 写入的），
  //    少了它就会去全表比，`_` 又会当通配符 —— 一旦误命中，这笔就永远标完成、再也不补了。
  const exist = await Transaction.findOne({ where: payOrderMatch(pay.order_id, pay.user_id) })
  if (exist) { markCompleted(pay.order_id); return { state: 'done', paid: true, note: '流水里已有这单，标记完成' } }

  // ② 问网关
  let paid = false
  let queryErr = null
  let queryStatus = ''      // BufPay 原始状态，用于中文归因
  try {
    if (isUsdt) {
      // USDT：服务端签名向 Cryptomus 查证，不信回调明文
      paid = await cryptomusCheckPaid(pay.order_id)
    } else {
      // 🔴 2026-11-04 修：BufPay 只支持按 aoid（平台单号）查，没有按 order_id 查的接口。
      //    官方文档：GET https://bufpay.com/api/query/{aoid}
      //    以前这里写的是 `/api/query?order_id=xxx` —— 实测返回 404，
      //    等于**从来没有成功查证过任何一笔 BufPay 单**，30 分钟后一律判死。
      //    后果：用户真付了钱、只是回调没到（收款手机没电/App 被杀），也会被当成没付，等于吞钱。
      const aoid = pay.aoid
      if (!aoid) {
        // 没有平台单号 = 无从查证。绝不能当"用户没付"处理。
        return { state: 'pending', paid: false, noAoid: true, queryStatus: 'no_aoid' }
      }
      const url = 'https://bufpay.com/api/query/' + encodeURIComponent(aoid)
      const resp = await axios.get(url, { timeout: 8000 })
      queryStatus = String((resp.data && resp.data.status) || '')
      paid = (queryStatus === 'success' || queryStatus === 'payed')
    }
  } catch (e) { queryErr = e }

  // ③ 付了就入账
  if (paid) {
    const ok = await handleSuccessPay(pay.order_id, pay.user_id, pay.amount, isUsdt ? 'Cryptomus补单' : 'BufPay auto')
    if (ok) { markCompleted(pay.order_id); return { state: 'done', paid: true, note: '网关确认已付，已入账' } }
    // 入账失败：不标完成，下一轮自动重试
    return { state: 'error', paid: true, note: '网关说已付，但入账失败（下一轮会重试）' }
  }
  return { state: 'pending', paid: false, queryErr, queryStatus }
}

export async function reconcilePayments() {
  const list = getPendingPayments()
  const now = Date.now()
  // 🛒 本轮「确认是用户自己没付」而关掉的单，收集起来最后汇总一条推 TG。
  //    逐条推会刷屏（一天几十笔放弃支付很正常），但完全不推又看不出"下单不付款"的比例。
  const gaveUp = []
  for (const pay of list) {
    // 🔴 2026-10-30 修：卡在 processing 的单子以前永远不会再被检查 ——
    //    补单引擎把状态改成 processing 后如果进程重启/查证中途抛错，这条单就
    //    "用户可能已付款、网关回调丢了、引擎也不再看它"，只能等客户投诉。
    //    现在把 last_check 超过 10 分钟的 processing 当作锁已失效，重新纳入检查。
    if (pay.status === 'processing') {
      const stale = now - new Date(pay.last_check || pay.created_at).getTime() > 10 * 60 * 1000
      if (!stale) continue
    } else if (pay.status !== 'pending') {
      continue
    }
    const age = now - new Date(pay.created_at).getTime()
    if (age < 180000) continue
    // 🧹 太老的单直接静默判死：BufPay 订单 5 分钟过期、Cryptomus 发票 1 小时，
    //    放了 7 天还没人付款的单不可能再付款成功。以前这类单会一直重试、并在
    //    每轮把 "Payment callback missing" 推给祥哥 —— 真出事的告警就被淹掉了。
    if (age > 7 * 24 * 60 * 60 * 1000) { markFailed(pay.order_id, '超过 7 天未付款，自动关闭'); continue }
    const isUsdt = pay.pay_type === 'USDT'
    // 🔒 BufPay 约 5 次重试(≈10分钟)判死重来；USDT 发票 1 小时有效，绝不能提前判死，否则用户正付款就被杀单
    if (!isUsdt && pay.retry_count >= 5) {
      markFailed(pay.order_id, '多次查证均未确认付款，已关闭');
      // 查了 5 次（≈10 分钟）都没付 —— 用户放弃了
      if (!pay.noAoid) gaveUp.push({ ...pay, reason: '查证 5 次未付款（约 10 分钟）' });
      continue;
    }
    markProcessing(pay.order_id)
    try {
      const r = await reconcileOne(pay)
      if (r.state === 'done' || r.state === 'error') continue
      // 还没付：按年龄判死（BufPay 约 30 分钟，USDT 发票 1 小时 + 缓冲）
      const failAge = isUsdt ? 3900000 : 1800000
      if (age > failAge) {
        // 🔴 失败原因一律写中文，并且必须说清楚「是谁的问题」——
        //    以前统一写 callback timeout，看表的人根本分不清是用户没付还是我们漏单。
        if (isUsdt) {
          const reason = r.queryErr
            ? '查证失败（Cryptomus 无响应），需人工核对'
            : '用户未付款（USDT 发票 1 小时过期）'
          markFailed(pay.order_id, reason)
          // 查证抛错 = 无法确认是否真付了，资金可能悬空 → TG 告警人工核对；干净未付(用户放弃)则汇总播报
          if (r.queryErr) {
            sendTgMessage('⚠️ <b>USDT 支付单无法向 Cryptomus 确认，已置失败待人工核对</b>\n🔗 <code>' + pay.order_id + '</code>\n👤 user:' + pay.user_id + '\n💵 amount:' + pay.amount + '\n❌ ' + (r.queryErr.message || r.queryErr))
          } else {
            gaveUp.push({ ...pay, reason })
          }
        } else {
          // BufPay：按查证结果给出准确的中文归因
          let reason
          if (r.noAoid || !pay.aoid) {
            reason = '无法自动查证（缺支付平台单号），需人工核对'
          } else if (r.queryErr) {
            reason = '查证失败（支付网关无响应），需人工核对'
          } else if (r.queryStatus === 'fee_error') {
            reason = '我方手续费余额不足，订单未入账，需充值后补单'
          } else if (r.queryStatus === 'expire' || r.queryStatus === 'new' || r.queryStatus === 'not_exist') {
            reason = '用户未付款（支付码超时关闭）'
          } else {
            reason = '用户未付款（超时未完成支付）'
          }
          markFailed(pay.order_id, reason)
          // 只有「确实确认用户没付」才归到放弃支付汇总；查不了 / 我们这边出问题的，必须单独叫人
          if (r.noAoid || r.queryErr || r.queryStatus === 'fee_error') {
            // 📎 2026-11-11：告警里补一句「这之后用户有没有用别的渠道付成功」。
            //    实测祥哥收到过一条「挂起待人工核对」，去查才发现用户 95 秒后就改用
            //    支付宝付成功了，那单（微信）是他自己取消的 —— 白查一趟。
            //    判定逻辑不动（缺 aoid 就叫人核对，宁可多问也不吞钱），
            //    只是把判断依据直接写进消息，看到就知道要不要管。
            let hint = ''
            try {
              const after = new Date(pay.created_at).getTime()
              const [later] = await sequelize.query(
                `SELECT amount, type, created_at FROM transactions
                 WHERE user_id = ? AND amount > 0 AND created_at > ?
                 ORDER BY id ASC LIMIT 1`,
                { replacements: [pay.user_id, new Date(after)] }
              )
              if (later && later.length) {
                const t = later[0]
                const mins = Math.round((new Date(t.created_at).getTime() - after) / 60000)
                // ⏱ 间隔长短决定怎么理解：
                //    几十秒到几分钟 → 用户当场换了个渠道
                //    几小时以上     → 他当时没付成，隔了很久才回来付
                //    这两种情况处理方式不同，别写成一句话。
                const when = mins < 60
                  ? `${mins} 分钟后`
                  : mins < 24 * 60
                    ? `${(mins / 60).toFixed(1)} 小时后`
                    : `${Math.round(mins / 1440)} 天后`
                const guess = mins <= 15
                  ? '很可能是他自己取消后立刻换了渠道 —— 确认一下即可，不用补单。'
                  : '当时那单应该是没付成，他后来才回来付的。这单大概率不用管，但建议顺手看一眼支付平台后台。'
                hint = `\n\n✅ <b>该用户 ${when}已成功充值 ¥${parseFloat(t.amount).toFixed(2)}（${t.type}）</b>\n${guess}`
              } else {
                hint = `\n\n⚠️ 该用户之后没有其他成功充值记录，<b>可能真的付了但回调丢了</b>，建议去支付平台后台核对。`
              }
            } catch { /* 查不到就不加提示，不影响主告警 */ }
            sendTgMessage('⚠️ <b>BufPay 单无法确认已付款，已挂起待人工核对</b>\n🔗 <code>' + pay.order_id + '</code>\n👤 user:' + pay.user_id + '\n💵 amount:' + pay.amount + '\n❌ ' + reason + hint)
          } else {
            gaveUp.push({ ...pay, reason })
          }
        }
      }
    } catch(e) {
      console.error('reconcile error', pay.order_id, e.message)
    }
  }

  // 🛒 放弃支付汇总：一轮扫下来关掉了几笔，合并成一条，不逐条刷屏
  if (gaveUp.length) {
    const total = gaveUp.reduce((s, p) => s + Number(p.amount || 0), 0)
    const lines = gaveUp.slice(0, 10).map((p) =>
      `· ¥${Number(p.amount || 0).toFixed(2)} · ${p.pay_type || '充值'} · 用户 ${p.user_id} · ${p.reason}`
    )
    if (gaveUp.length > 10) lines.push(`· …另有 ${gaveUp.length - 10} 笔`)
    sendTgMessage(
      `🛒 <b>${gaveUp.length} 笔充值单未付款，已自动关闭</b>\n` +
      `合计：<b>¥${total.toFixed(2)}</b>（这笔钱没进账）\n` +
      lines.join('\n') +
      `\n💡 客户下了单但没付钱 —— 可能是嫌麻烦、不会用支付方式，或者只是比价`
    )
  }
  cleanOldPayments()
}
