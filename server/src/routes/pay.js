import express from 'express';
import crypto from 'crypto';
import { Config, Transaction, sequelize, User } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import axios from 'axios';
import { sendTgMessage } from '../utils/tgBot.js';

const router = express.Router();
const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');

const getDomain = (req) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${protocol}://${host}`;
};

router.post('/rmb/sign', authenticate, async (req, res) => {
    const { pay_type, amount } = req.body;
    if (!['wechat', 'alipay'].includes(pay_type) || !amount || amount <= 0) return res.json({ status: 'error', message: '参数非法' });

    try {
        const configs = await Config.findAll({ where: { key: ['bufpay_id', 'bufpay_key', 'site_name'] } });
        const conf = {}; configs.forEach(c => conf[c.key] = c.value);

        const cleanBufId = (val) => { if (!val) return ''; const match = val.match(/\/(\d+)$/); if (match) return match[1]; return val.replace(/[^0-9]/g, ''); };
        const realBufId = cleanBufId(conf.bufpay_id);
        if (!realBufId || !conf.bufpay_key) return res.json({ status: 'error', message: '支付配置缺失' });

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

router.post('/usd', authenticate, async (req, res) => {
    const { amount } = req.body;
    try {
        const configs = await Config.findAll({ where: { key: ['cryptomus_id', 'cryptomus_key'] } });
        const conf = {}; configs.forEach(c => conf[c.key] = c.value);
        if (!conf.cryptomus_id) return res.json({ status: 'error', message: 'USDT Config Missing' });

        const domain = getDomain(req);
        const amountFloat = parseFloat(amount);
        const order_id = `USDT_${amountFloat.toFixed(2)}_${Date.now()}`;
        
        const payload = { amount: String(amount), currency: 'USD', order_id: order_id, url_return: `${domain}/recharge`, url_callback: `${domain}/api/pay/notify/cryptomus`, is_payment_multiple: true, lifetime: 3600, to_currency: 'USDT' };
        const sign = cryptomusSign(payload, conf.cryptomus_key);
        const response = await axios.post('https://api.cryptomus.com/v1/payment', payload, { headers: { 'merchant': conf.cryptomus_id, 'sign': sign, 'Content-Type': 'application/json' } });
        if (response.data?.result?.url) res.json({ status: 'success', url: response.data.result.url });
        else res.json({ status: 'error', message: 'Failed' });
    } catch (e) { res.json({ status: 'error', message: 'Cryptomus Error' }); }
});

router.get('/status', authenticate, async (req, res) => {
    const { aoid, order_id, amount } = req.query;
    if (!order_id) return res.json({ status: 'wait' });
    try {
        const exist = await Transaction.findOne({ where: { description: { [sequelize.Sequelize.Op.like]: `%${order_id}%` } } });
        if (exist) return res.json({ status: 'success' });
        if (aoid && aoid !== 'undefined' && aoid !== '') {
            try {
                const response = await axios.get(`https://bufpay.com/api/query/${aoid}`, { timeout: 3000 });
                if (response.data.status === 'success' || response.data.status === 'payed') {
                    await handleSuccessPay(order_id, req.user.id, amount, 'BufPay补单');
                    return res.json({ status: 'success' });
                }
            } catch(ignore) {}
        }
        res.json({ status: 'wait' });
    } catch (e) { res.json({ status: 'error' }); }
});

router.get('/return/bufpay', async (req, res) => {
    const { aoid, order_id, order_uid, price, pay_price, sign } = req.query;
    try {
        const conf = await Config.findOne({ where: { key: 'bufpay_key' } });
        if (conf) {
            const localSign = md5(aoid + order_id + order_uid + price + pay_price + conf.value);
            if (localSign === sign) await handleSuccessPay(order_id, order_uid, pay_price, 'BufPay返回');
        }
    } catch (e) {}
    res.send(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>支付成功</title><style>body { background: #0f172a; color: #34d399; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }</style></head><body><div style="text-align: center;"><svg style="width: 60px; height: 60px; margin: 0 auto 10px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><h2>支付成功，正在自动跳转...</h2></div><script>if (window.parent && window.parent !== window) { window.parent.postMessage({ type: 'pay_success' }, '*'); } else { window.location.href = '/recharge'; }</script></body></html>`);
});

router.post('/notify/bufpay', express.urlencoded({ extended: true }), async (req, res) => {
    const { aoid, order_id, order_uid, price, pay_price, sign } = req.body;
    try {
        const conf = await Config.findOne({ where: { key: 'bufpay_key' } });
        if (!conf) return res.status(500).send('No Config');
        const localSign = md5(aoid + order_id + order_uid + price + pay_price + conf.value);
        if (localSign !== sign) return res.status(400).send('Sign Error');
        await handleSuccessPay(order_id, order_uid, pay_price, 'BufPay异步回调');
        res.status(200).send('ok');
    } catch (e) { res.status(500).send('Error'); }
});

router.post('/notify/cryptomus', async (req, res) => { res.status(200).send('ok'); });

async function handleSuccessPay(orderId, userId, bufPayPrice, sourceDesc) {
    const t = await sequelize.transaction();
    try {
        const exist = await Transaction.findOne({ where: { description: { [sequelize.Sequelize.Op.like]: `%${orderId}%` } }, transaction: t });
        if (exist) { await t.commit(); return; } 
        
        let prefix = '在线充值';
        if (orderId.includes('_wechat_')) prefix = '微信充值';
        else if (orderId.includes('_alipay_')) prefix = '支付宝充值';
        else if (orderId.startsWith('USDT')) prefix = 'USDT充值';

        let realAddAmount = parseFloat(bufPayPrice);
        const parts = orderId.split('_');
        if (orderId.startsWith('BUF_') && parts.length >= 4) {
            realAddAmount = parseFloat(parts[2]); 
        } else if (orderId.startsWith('USDT_') && parts.length >= 3) {
            realAddAmount = parseFloat(parts[1]);
        }
        
        const user = await User.findByPk(userId, { transaction: t });
        if (user) {
            user.balance = (parseFloat(user.balance) + realAddAmount).toFixed(6);
            await user.save({ transaction: t });
            
            await Transaction.create({
                user_id: user.id, phone: user.phone, amount: realAddAmount, balance: user.balance,
                type: prefix, description: `${prefix} - ${sourceDesc} [单号:${orderId}]`
            }, { transaction: t });

            // 💡 核心强化：TG 增加详尽的用户画像
            const roleName = user.role === 'super_admin' ? '至尊管理员' : user.role === 'admin' ? '管理员' : user.role === 'agent' ? '👑 至尊代理' : '黄金用户';
            sendTgMessage(`💰 <b>充值成功入账</b>\n🆔 <b>UID:</b> <code>${user.id}</code>\n📱 <b>账号:</b> <code>${user.phone}</code>\n📧 <b>邮箱:</b> ${user.email || '未绑定'}\n🔰 <b>等级:</b> ${roleName}\n💵 <b>金额:</b> ￥${realAddAmount.toFixed(2)}\n🏦 <b>渠道:</b> ${prefix}\n💳 <b>当前余额:</b> ￥${parseFloat(user.balance).toFixed(2)}\n🔗 <b>追踪单号:</b> <code>${orderId}</code>`);
        }
        await t.commit();
    } catch (e) { await t.rollback(); }
}
export default router;
