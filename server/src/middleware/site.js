import { Site } from '../models/index.js';

const siteCache = new Map();
let cacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1分钟缓存

export const siteMiddleware = async (req, res, next) => {
  try {
    const host = req.headers['x-forwarded-host'] || req.get('host') || '';
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
    // 通配符匹配：*.主域名
    if (!site) {
      const parts = cleanHost.split('.');
      if (parts.length >= 3) {
        for (const [domain, s] of siteCache) {
          const domainParts = domain.split('.');
          if (domainParts.length >= 2 && cleanHost.endsWith('.' + domainParts.slice(-2).join('.'))) {
            site = s;
            break;
          }
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
