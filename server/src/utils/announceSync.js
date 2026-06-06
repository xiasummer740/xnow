import https from 'https';
import { Config } from '../models/index.js';
import { sendTgMessage } from './tgBot.js';

const fetchPage = (urlStr, options = {}) => {
  const u = new URL(urlStr);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        ...(options.headers || {})
      },
      rejectUnauthorized: false
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', (e) => resolve({ error: e.message }));
    if (options.body) req.write(options.body);
    req.end();
  });
};

const getCleanAnnouncement = (raw) => {
  let html = raw.trim();
  html = html.replace(/var\(--color-id-\d+\)/g, '#ffffff');
  html = html.replace(/font-size:\s*\d{2,}px/gi, 'font-size: 17px');
  html = html.replace(/font-size:\s*2[7-9]px/gi, 'font-size: 17px');
  html = html.replace(/<p[^>]*>[\s\S]*?tk7188\.top[\s\S]*?<\/p>/gi, '');
  html = html.replace(/@tk7188\w*/g, '@客服');
  return html;
};

export const autoSyncAnnouncement = async () => {
  console.log("📢 [AutoAnnounce] 开始检查上游公告...");
  try {
    const urlConf = await Config.findOne({ where: { key: 'upstream_url' } });
    const loginUser = await Config.findOne({ where: { key: 'upstream_login_user' } });
    const loginPass = await Config.findOne({ where: { key: 'upstream_login_pass' } });

    if (!urlConf?.value || !loginUser?.value || !loginPass?.value) return;

    const baseUrl = new URL(urlConf.value).origin;

    // 登录
    const home = await fetchPage(baseUrl);
    if (home.error) return;

    const cookies = (home.headers['set-cookie'] || []).map(c => c.split(';')[0]);
    const csrfMatch = home.body.match(/name="_csrf"[^>]*value="([^"]+)"/);
    if (!csrfMatch) return;

    const params = new URLSearchParams();
    params.append('LoginForm[username]', loginUser.value);
    params.append('LoginForm[password]', loginPass.value);
    params.append('_csrf', csrfMatch[1]);

    const login = await fetchPage(baseUrl, {
      method: 'POST',
      headers: { Cookie: cookies.join('; '), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const allCookies = [...cookies];
    (login.headers['set-cookie'] || []).forEach(nc => {
      const name = nc.split('=')[0];
      const idx = allCookies.findIndex(c => c.startsWith(name));
      if (idx >= 0) allCookies[idx] = nc.split(';')[0];
      else allCookies.push(nc.split(';')[0]);
    });

    const dash = await fetchPage(baseUrl, { headers: { Cookie: allCookies.join('; ') } });

    // 提取公告
    const annStart = dash.body.indexOf('刷粉风控期建议');
    if (annStart < 0) return;

    const before = dash.body.substring(Math.max(0, annStart - 5000), annStart);
    const blockMatch = before.match(/id="block_(\d+)"/g);
    if (!blockMatch) return;

    const blockId = blockMatch[blockMatch.length - 1].match(/\d+/)[0];
    const blockStartTag = 'id="block_' + blockId + '"';
    const blockStart = dash.body.indexOf(blockStartTag);
    const nextBlockStart = dash.body.indexOf('id="block_', blockStart + blockStartTag.length);
    const blockHtml = dash.body.substring(blockStart, nextBlockStart > 0 ? nextBlockStart : blockStart + 50000);

    const descMatch = blockHtml.match(/<div class="text-block__description">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
    if (!descMatch) return;

    const newContent = getCleanAnnouncement(descMatch[1]);

    // 对比现有公告，不同则更新
    const existing = await Config.findOne({ where: { key: 'announcement' } });
    const existingClean = existing?.value ? existing.value.replace(/var\(--color-id-\d+\)/g, '#ffffff').trim() : '';

    if (newContent !== existingClean) {
      await Config.upsert({ key: 'announcement', value: newContent });
      const dateMatch = newContent.match(/【([^】]+)】/);
      const version = dateMatch ? dateMatch[1] : '最新';
      console.log('📢 [AutoAnnounce] 公告已自动更新为: ' + version);
        sendTgMessage('📢 <b>公告已自动同步</b>\
版本: ' + version);
    }
  } catch (e) {
    console.error('[AutoAnnounce] 同步失败:', e.message);
  }
};
