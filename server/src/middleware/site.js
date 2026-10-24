import { Site } from '../models/index.js';

const siteCache = new Map();
let cacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1分钟缓存

// 站点增删改（尤其是新绑域名）后必须立刻失效缓存，
// 否则最长 60 秒内新域名仍被当成主站 —— 表现为「域名刚开通却看不到分站内容」。
export const clearSiteCache = () => {
  siteCache.clear();
  cacheTime = 0;
};

export const siteMiddleware = async (req, res, next) => {
  try {
    // 🔒 只认 nginx 透传的 Host（install.sh 里 `proxy_set_header Host $host`）。
    // 绝不能用 x-forwarded-host：nginx 未覆盖该头，任何客户端都能自填，
    // 而 req.site 直接决定 orders.js 的成交倍率 —— 等于让用户自己定价。
    // 注：也不能用 req.hostname，trust proxy 开启时它同样会读 X-Forwarded-Host。
    const host = req.get('host') || '';
    const cleanHost = host.split(':')[0].toLowerCase();

    if (!cleanHost) {
      req.site = null;
      return next();
    }

    // 刷新缓存
    if (Date.now() - cacheTime > CACHE_TTL) {
      siteCache.clear();
      const allSites = await Site.findAll({ where: { status: 'active' } });
      allSites.forEach(s => {
        if (s.domain) siteCache.set(s.domain.toLowerCase(), s.toJSON());
      });
      cacheTime = Date.now();
    }

    // 精确匹配
    let site = siteCache.get(cleanHost);
    // 子域名匹配：只认「该分站自己域名的下级」（如 www.shop.com → shop.com）。
    // 🔴 绝不能用「公共后缀」兜底（曾经写成取域名最后两段）——
    //    那样任何 xxx.base.com 都会被判成第一个分站，
    //    后果是主站域名被盗用成某个分站的身份，价格倍率与用户隔离全部错位。
    if (!site) {
      for (const [domain, s] of siteCache) {
        if (cleanHost.endsWith('.' + domain)) {
          site = s;
          break;
        }
      }
    }

    req.site = site || null;
    next();
  } catch (e) {
    req.site = null;
    next();
  }
};
