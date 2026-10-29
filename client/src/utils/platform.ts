// 平台 / 服务类型归类（前端用）
// ⚠️ 与 server/src/utils/platform.js 保持同一套规则 —— 落地页（服务端渲染）和
//    这个页面（客户端渲染）必须给出同样的平台分组，否则用户从搜索引擎点进来
//    看到的分类和站内不一致。
const PLATFORM_RULES: Array<[string, RegExp]> = [
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
]

export const platformOf = (text: string): string => {
  const t = String(text || '')
  for (const [label, re] of PLATFORM_RULES) if (re.test(t)) return label
  return 'Other'
}

export const slugOf = (label: string): string =>
  label === 'Other' ? 'other' : String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const labelOfSlug = (slug: string): string | null => {
  const s = String(slug || '').toLowerCase()
  for (const [label] of PLATFORM_RULES) if (slugOf(label) === s) return label
  return 'other' === s ? 'Other' : null
}

export const PLATFORM_CN: Record<string, string> = {
  TikTok: 'TikTok', Instagram: 'Instagram', YouTube: 'YouTube', Telegram: 'Telegram',
  Facebook: 'Facebook', Twitter: 'X（Twitter）', Spotify: 'Spotify', 'Apple Music': 'Apple Music',
  SoundCloud: 'SoundCloud', Shopee: 'Shopee', Line: 'LINE', WhatsApp: 'WhatsApp',
  Discord: 'Discord', Twitch: 'Twitch', Traffic: '网站流量', Other: '其他社媒',
}

const TYPE_RULES: Array<[string, RegExp]> = [
  ['订阅', /subscriber|订阅/i],
  ['粉丝', /follower|fans?\b|涨粉|成员|\bmember/i],
  ['点赞', /\blike/i],
  ['播放', /\bview|views?|play|stream|播放|浏览|观看/i],
  ['评论', /comment|评论/i],
  ['分享', /share|分享|repost|转发/i],
  ['直播', /\blive\b|直播/i],
  ['流量', /traffic|visit|impression|流量/i],
]

export const typeOf = (name: string): string => {
  const t = String(name || '')
  for (const [label, re] of TYPE_RULES) if (re.test(t)) return label
  return '其他'
}

export const per1000 = (v: number): string => {
  const n = Number(v || 0)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)
}
