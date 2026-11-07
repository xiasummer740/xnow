// ============================================================================
// 🚫 上游痕迹清洗
//
// 背景（2026-11-07 祥哥在生产上抓到）：
//   某个 TikTok 服务的「服务描述」里带着一行
//     取消自动化订单👉https://tk7188.com/subscriptions
//   这段描述是从上游 API 原样同步下来、又原样渲染给客户的。
//   客户看到的不只是别人的品牌名，还有一个**能直接点过去下单的链接** ——
//   等于把客源亲手送回上游。
//
//   而原有的清洗只有两处，都只针对「公告」：
//     · utils/announceSync.js  getCleanAnnouncement()
//     · routes/admin.js        站长手动编辑公告时
//   而且两处只认 `tk7188.top`，而服务描述里写的是 `tk7188.com`，一个都没拦住。
//
// 所以清洗逻辑收到这里一处，谁要往客户面前送文本，就先过一遍。
// 用在：服务描述同步落库（utils/sync.js）、服务列表返回（routes/services.js）。
//
// ⚠️ 原则：**不能简单删空**。
//   「取消自动化订单👉<链接>」这行的引导语是有用的（它告诉客户怎么取消），
//   只删链接会留下一句悬空的话。所以含上游域名的整行替换成中性引导语。
// ============================================================================

// 上游站点（可能带子域、可能换 TLD）
const UPSTREAM_HOST_RE = /(?:[a-z0-9-]+\.)*tk7188\.[a-z]{2,}(?:\/[^\s<>"'\u3000-\u303f]*)?/gi;
// 判断"这一行有没有上游域名"（不带 g，避免 lastIndex 状态污染）
const LINE_HAS_UPSTREAM = /(?:[a-z0-9-]+\.)*tk7188\.[a-z]{2,}/i;
// 裸品牌词
const BRAND_RE = /tk7188/gi;
// 纯数字品牌（只在作为独立词出现时删，避免误伤价格/数量里的 7188）
const BARE_BRAND_RE = /(?<![0-9A-Za-z])7188(?![0-9A-Za-z])/g;
// @品牌名 形式（上游客服账号）
const AT_HANDLE_RE = /@tk7188[\w]*/gi;

const NEUTRAL_LINE = '如需取消或修改订单，请联系在线客服';

/**
 * 清洗任意要展示给客户的文本，抹掉上游品牌与地址。
 * @param {string} raw
 * @param {{ lineReplace?: string }} [opts] lineReplace = 含上游域名的那一行替换成什么
 * @returns {string}
 */
export const stripUpstream = (raw, opts = {}) => {
  if (raw === null || raw === undefined) return '';
  let text = String(raw);
  if (!text.trim()) return '';

  const neutral = opts.lineReplace || NEUTRAL_LINE;

  // ① 含上游域名的整行 → 中性引导语（保留"可以取消/联系客服"这个有用信息）
  text = text
    .split('\n')
    .map((line) => (LINE_HAS_UPSTREAM.test(line) ? neutral : line))
    .join('\n');

  // ② 行内残留的域名（比如混在句子中间的，上面整行替换没覆盖到的）
  text = text.replace(UPSTREAM_HOST_RE, '');

  // ③ @品牌账号 → 客服
  text = text.replace(AT_HANDLE_RE, '@客服');

  // ④ 裸品牌词与数字品牌
  text = text.replace(BRAND_RE, '');
  text = text.replace(BARE_BRAND_RE, '');

  // ⑤ 收拾残局：多余空格、连续空行、悬空的箭头/标点
  text = text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/[👉➡→]+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
};

/**
 * 给服务描述用的包装：上游描述里常有 `\n` 转义成字面量的情况，先还原再清洗。
 * @param {string} raw
 * @returns {string}
 */
export const sanitizeServiceDescription = (raw) => {
  if (raw === null || raw === undefined) return '';
  let text = String(raw);
  // 上游有些服务的描述把换行写成了字面量 "\n"，前端渲染时会连成一行，顺手还原
  if (text.includes('\\n') && !text.includes('\n')) {
    text = text.replace(/\\n/g, '\n');
  }
  return stripUpstream(text);
};

export default stripUpstream;
