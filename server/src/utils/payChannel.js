// ============================================================================
// 分站收款通道解析（A = 平台代收 / B = 站长自有商户）
// ----------------------------------------------------------------------------
// 祥哥 2026-10-29 定：**A 和 B 都要具备**，站长自助切换，不走审批。
//
// 三种偏好（sites.pay_mode）：
//   auto（默认）：配了自己的商户就用自己的；没配就用平台代收（若已开启）
//   own        ：只用自有商户（没配好就报错，绝不偷偷用平台的账户）
//   platform   ：只用平台代收（钱进主站，落 site_collections 台账，站长周结提现）
//
// 🔴 三条铁律
//   1. 客户的钱到底进了谁的账户，必须能从**配置**推出来，不能靠"试试看"。
//   2. 平台代收的每一笔必须落台账（SiteCollection），不落账 = 平台吞钱。
//   3. 自有商户的每一笔**绝不**落平台台账（那钱平台一分没收到）。
// ============================================================================

const OWN_KEYS = {
    bufpay: ['bufpay_id', 'bufpay_key'],
    cryptomus: ['cryptomus_id', 'cryptomus_key'],
};

export const hasOwnMerchant = (site, type = 'bufpay') => {
    if (!site) return false;
    const keys = OWN_KEYS[type] || OWN_KEYS.bufpay;
    return !!(site[keys[0]] && site[keys[1]]);
};

/**
 * @returns {{channel:'main'|'own'|'platform'|'off', platformCollected:boolean, reason?:string, pref:string}}
 *   main     = 主站自己充值（没有分站上下文）
 *   own      = 走站长自己的商户，钱进站长账户
 *   platform = 走平台商户，钱进主站账户，必须落台账
 *   off      = 两条都不通，必须明确告诉客户"未开通"
 */
export const resolveChannel = (site, type = 'bufpay') => {
    if (!site) return { channel: 'main', platformCollected: false, pref: 'auto' };

    const pref = String(site.pay_mode || 'auto');
    const own = hasOwnMerchant(site, type);
    const platformOn = Number(site.use_platform_merchant || 0) === 1;

    if (pref === 'own') {
        return own
            ? { channel: 'own', platformCollected: false, pref }
            : { channel: 'off', platformCollected: false, pref, reason: 'OWN_MERCHANT_MISSING' };
    }
    if (pref === 'platform') {
        return platformOn
            ? { channel: 'platform', platformCollected: true, pref }
            : { channel: 'off', platformCollected: false, pref, reason: 'PLATFORM_NOT_OPEN' };
    }
    // auto：自有优先，其次平台代收
    if (own) return { channel: 'own', platformCollected: false, pref };
    if (platformOn) return { channel: 'platform', platformCollected: true, pref };
    return { channel: 'off', platformCollected: false, pref, reason: 'NO_CHANNEL' };
};

// 客户看到的提示：不能出现"平台/主站/上游"这类词，只说"未开通"
export const offMessage = (type = 'bufpay') =>
    type === 'cryptomus' ? '本站 USDT 充值暂未开通，请联系客服' : '本站在线充值暂未开通，请联系客服处理';

// 站长看到的诊断（只出现在站长后台/日志，客户看不到）
export const reasonText = (reason) => ({
    NO_CHANNEL: '两条通道都没开：可以开启「主站代收」，或填自己的商户',
    OWN_MERCHANT_MISSING: '收款方式选的是「只用自己的商户」，但商户号/密钥没填全',
    PLATFORM_NOT_OPEN: '收款方式选的是「只用主站代收」，但主站代收开关没开',
}[reason] || '未开通');
