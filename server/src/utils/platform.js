// ============================================================================
// 平台归类 + 服务类型归类（服务端唯一来源）
// ----------------------------------------------------------------------------
// 为什么单独抽出来：
//   1. 分站 SEO 落地页要按「平台」分页（/c/tiktok），不能让上游那种
//      「TikTok - 粉丝【推荐👉27802、目前不掉】」的脏分类名直接当 URL 或标题 ——
//      那既泄露内部编号，也没法被搜到。
//   2. 主站订单页、分站服务页、SEO 页必须用**同一套**归类，否则客户在落地页
//      看到的价格区间和下单页对不上。
// ============================================================================

export const PLATFORM_RULES = [
    ['TikTok', /tiktok/i],
    ['Instagram', /instagram|\big\b/i],
    ['YouTube', /youtube|yt\b/i],
    ['Telegram', /telegram/i],
    ['Facebook', /facebook/i],
    ['Twitter', /twitter|\bx\/twitter/i],
    ['Spotify', /spotify/i],
    ['Apple Music', /apple\s*music/i],
    ['SoundCloud', /soundcloud/i],
    ['Shopee', /shopee/i],
    ['Line', /\bline\b/i],
    ['WhatsApp', /whatsapp/i],
    ['Discord', /discord/i],
    ['Twitch', /twitch/i],
    ['Traffic', /traffic|website\s*visit|网站流量|流量/i],
];

export const PLATFORM_LABELS = PLATFORM_RULES.map(([label]) => label).concat(['Other']);

// 归类：分类名 + 服务名一起看（分类名常常缺平台名）
export const platformOf = (text) => {
    const t = String(text || '');
    for (const [label, re] of PLATFORM_RULES) if (re.test(t)) return label;
    return 'Other';
};

export const slugOf = (label) =>
    label === 'Other' ? 'other' : String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const labelOfSlug = (slug) => {
    const s = String(slug || '').toLowerCase();
    for (const label of PLATFORM_LABELS) if (slugOf(label) === s) return label;
    return null;
};

// 平台的中文说法（给客户看的标题/正文用，避免整页英文）
export const PLATFORM_CN = {
    TikTok: 'TikTok',
    Instagram: 'Instagram',
    YouTube: 'YouTube',
    Telegram: 'Telegram',
    Facebook: 'Facebook',
    Twitter: 'X（Twitter）',
    Spotify: 'Spotify',
    'Apple Music': 'Apple Music',
    SoundCloud: 'SoundCloud',
    Shopee: 'Shopee',
    Line: 'LINE',
    WhatsApp: 'WhatsApp',
    Discord: 'Discord',
    Twitch: 'Twitch',
    Traffic: '网站流量',
    Other: '其他社媒',
};

// 服务类型（客户看得懂的中文标签）
const TYPE_RULES = [
    ['订阅', /subscriber|订阅/i],
    ['粉丝', /follower|fans?\b|涨粉|成员|\bmember/i],
    ['点赞', /\blike/i],
    ['播放', /\bview|play|stream|播放/i],
    ['评论', /comment|评论/i],
    ['分享', /share|分享|repost|转发/i],
    ['直播', /\blive\b|直播/i],
    ['流量', /traffic|visit|impression|流量/i],
];

export const typeOf = (name) => {
    const t = String(name || '');
    for (const [label, re] of TYPE_RULES) if (re.test(t)) return label;
    return '其他';
};

// 价格展示：我们的 rate 是「每 1000 个」的单价
export const per1000 = (v) => {
    const n = Number(v || 0);
    if (!isFinite(n) || n <= 0) return '—';
    return n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
};
