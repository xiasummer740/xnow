// 🏬 分站自有域名自动开通（六期）
//
// 站长绑自己的域名（如 shop.hisbrand.com）→ 系统验证归属 → 申请证书 → 写 nginx vhost → 重载。
//
// 三道安全闸门：
//   ① 域名黑名单：主站域名及其子域、上游域名一律不许绑（防止分站把生产域名抢走）
//   ② 归属验证：DNS A 记录必须指向本机，**或** 存在 TXT 记录 xnow-verify=<token>
//      （后者是为了兼容 Cloudflare 代理模式 —— 开了橙云之后 A 记录解析出来是 CF 的 IP，
//        永远等不到本机 IP，没有 TXT 兜底站长就永远绑不上）
//   ③ 证书：优先 Let's Encrypt；机器上没有 certbot 时退回自签证书保证能用，
//      并把状态标成 insecure 让站长知道"能用但不被浏览器信任"

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dns from 'dns/promises';
import { Site } from '../models/index.js';

const NGINX_DIR = '/etc/nginx/sites-enabled';
const SSL_DIR = '/etc/nginx/ssl';

// 我们的主域名（免费子域名的母域）与上游域名
const OUR_APEX = ['xnow.taikon.top', 'taikon.top'];
const UPSTREAM = ['tk7188.com'];

// 🚫 平台自用的子域名，绝不能给站长当分站用。
//    例：站长把分站取名叫 beta.xnow.taikon.top，而 Beta 测试环境正好也是这个名字 ——
//    两份 nginx 配置抢同一个 server_name，谁生效取决于加载顺序，极难排查。
//    六十六期补：Beta 环境正式落到 beta.xnow.taikon.top，所以必须先把这批名字锁住。
const RESERVED_LABELS = [
  'www', 'api', 'admin', 'beta', 'demo', 'test', 'dev', 'staging', 'pre',
  'mail', 'smtp', 'imap', 'pop', 'ftp', 'ns', 'ns1', 'ns2', 'dns',
  'cdn', 'static', 'img', 'assets', 'download', 'status', 'monitor',
  'panel', 'console', 'dashboard', 'pay', 'payment', 'support', 'help'
];

// 免费子域名：xxx.xnow.taikon.top —— 这是**合法且鼓励**的建站域名
export const isFreeSubdomain = (domain) => {
  const d = String(domain || '').toLowerCase();
  return OUR_APEX.some(a => d.endsWith('.' + a));
};

// 是否落在"平台保留名"里（只看免费子域名的第一段）
export const isReservedSubdomain = (domain) => {
  const d = String(domain || '').toLowerCase();
  for (const apex of OUR_APEX) {
    if (!d.endsWith('.' + apex)) continue;
    const label = d.slice(0, -(apex.length + 1));
    if (!label) return true;
    return RESERVED_LABELS.includes(label.split('.')[0]);
  }
  return false;
};

// 主站/上游域名本体及其子域：任何情况下都不许被分站占用
export const isForbiddenApex = (domain) => {
  const d = String(domain || '').toLowerCase();
  if (OUR_APEX.includes(d) || UPSTREAM.includes(d)) return true;
  if (isReservedSubdomain(d)) return true;
  return UPSTREAM.some(u => d.endsWith('.' + u));
};

// 建站时用：允许免费子域名、允许自己的域名、禁止主站与上游
export const isDomainForbidden = (domain) => isForbiddenApex(domain);

// 绑定自有域名时用：主站/上游禁止；免费子域名也没必要绑（本来就有）
export const isBindForbidden = (domain) => {
  const d = String(domain || '').toLowerCase();
  return isForbiddenApex(d) || isFreeSubdomain(d);
};

export const isValidDomain = (domain) => {
  const d = String(domain || '').toLowerCase();
  // 只允许标准主机名：标签 1~63、总长 ≤253，且必须至少两级
  if (d.length > 253 || d.length < 4) return false;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return false;
  // 纯 IPv4 不算域名（曾经漏判，导致直接把服务器 IP 当域名建站也能过）
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(d)) return false;
  return d.includes('.');
};

export const vhostPath = (siteId, domain) =>
  path.join(NGINX_DIR, `xnow-site-${siteId}-${String(domain).replace(/[^a-z0-9.-]/gi, '')}`);

// 归属验证：返回 { ok, reason, detail }
export const verifyDomainOwnership = async (domain, token) => {
  // 🔒 六十五期：这里原来写死了 VPS 公网 IP 作为兜底值 —— 本仓库是 PUBLIC，
  //    公网 IP 不该出现在源码里。改成只认环境变量 SERVER_PUBLIC_IP；
  //    没配时不做 IP 比对，只走 TXT 令牌校验（令牌是每个站点随机的，同样能证明归属）。
  const expectedIp = String(process.env.SERVER_PUBLIC_IP || '').trim();
  let aRecords = [];
  try { aRecords = await dns.resolve4(domain); } catch (e) { aRecords = []; }
  if (expectedIp && aRecords.includes(expectedIp)) {
    return { ok: true, reason: 'A 记录指向本机', detail: aRecords.join(',') };
  }
  // Cloudflare 橙云兜底：查 TXT
  let txt = [];
  try {
    const rows = await dns.resolveTxt(domain);
    txt = rows.map(r => r.join(''));
  } catch (e) { txt = []; }
  if (token && txt.some(t => t.trim() === `xnow-verify=${token}`)) {
    return { ok: true, reason: 'TXT 记录验证通过（Cloudflare 代理模式）', detail: `a=${aRecords.join(',') || '无'}` };
  }
  return {
    ok: false,
    reason: '域名尚未指向本机',
    detail: `A 记录: ${aRecords.join(',') || '无'}；也未找到 TXT xnow-verify=${token || '(未生成)'}`
  };
};

// 证书：有 certbot 就用 LE，没有就自签（保证能用，但标 insecure）
export const ensureCert = async (domain) => {
  const safe = String(domain).replace(/[^a-z0-9.-]/gi, '');
  const crt = path.join(SSL_DIR, `${safe}.crt`);
  const key = path.join(SSL_DIR, `${safe}.key`);

  // 已有 Let's Encrypt 证书
  const le = path.join('/etc/letsencrypt/live', safe, 'fullchain.pem');
  if (fs.existsSync(le)) {
    return { crt: le, key: path.join('/etc/letsencrypt/live', safe, 'privkey.pem'), mode: 'letsencrypt' };
  }
  if (fs.existsSync(crt) && fs.existsSync(key)) {
    return { crt, key, mode: 'existing' };
  }

  // 尝试 certbot
  let hasCertbot = false;
  try { execSync('command -v certbot', { stdio: 'ignore' }); hasCertbot = true; } catch (e) { hasCertbot = false; }

  if (hasCertbot) {
    try {
      execSync(
        `certbot certonly --nginx -d ${safe} --non-interactive --agree-tos ` +
        `--register-unsafely-without-email --keep-until-expiring`,
        { stdio: 'pipe', timeout: 180000 }
      );
      if (fs.existsSync(path.join('/etc/letsencrypt/live', safe, 'fullchain.pem'))) {
        return { crt: path.join('/etc/letsencrypt/live', safe, 'fullchain.pem'), key: path.join('/etc/letsencrypt/live', safe, 'privkey.pem'), mode: 'letsencrypt' };
      }
    } catch (e) {
      // 落到自签
    }
  }

  // 自签兜底（openssl 在绝大多数镜像里都有）
  execSync(
    `openssl req -x509 -nodes -newkey rsa:2048 -days 3650 ` +
    `-keyout ${key} -out ${crt} -subj "/CN=${safe}"`,
    { stdio: 'pipe', timeout: 60000 }
  );
  return { crt, key, mode: 'selfsigned' };
};

// 写 vhost：HTTP 跳 HTTPS + HTTPS 反代到分站后端端口，静态根指向分站 dist
export const writeVhost = ({ siteId, domain, backendPort, distRoot, cert }) => {
  // 写真实 vhost 前先拆掉该域名的墓碑（410），否则同域名出现两份配置
  try { unparkDomain(domain); } catch (e) {}
  const safe = String(domain).replace(/[^a-z0-9.-]/gi, '');
  const file = vhostPath(siteId, safe);
  const conf = `# 自动生成：分站 ${siteId} 自有域名 ${safe}
# 由 server/src/utils/siteDomain.js 写入，请勿手工编辑
server {
    listen 80;
    server_name ${safe};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${safe};

    ssl_certificate     ${cert.crt};
    ssl_certificate_key ${cert.key};
    ssl_protocols       TLSv1.2 TLSv1.3;

    root ${distRoot};
    # ⚠️ 分站的默认首页必须是 site.html（构建时生成的中性入口）。
    #    用 index.html 的话，首页源码里带着平台的 title / description / og 图，
    #    分享出去的预览卡片和爬虫看到的第一屏全是 XNOW。
    index site.html;

    location /api/ {
        proxy_pass http://127.0.0.1:${backendPort};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # 🖼️ 站长上传的 Logo / 首页背景图。
    #    必须写在这里：分站用自己域名访问时走的就是这份 vhost，
    #    漏了这段的话图片请求会掉进下面的 SPA 兜底，返回 HTML（图片显示不出来，
    #    而且 HTTP 状态还是 200，非常难查 —— 三十七期实测踩到过）。
    location /uploads/ {
        alias ${process.env.SITE_UPLOAD_DIR || '/var/www/xnow-uploads'}/;
        expires 7d;
        add_header Cache-Control "public";
        try_files $uri =404;
    }

    # 🚫 平台的营销页 / SEO 文件在分站上一律 404。
    #    三十八期实测：分站的回退规则里带上 $uri.html 后，访问 /vpn 会直接
    #    命中 dist/vpn.html —— 站长的顾客在涨粉店里看到「XNOW 全球安全节点」，
    #    /finance 看到「XNOW 财务大盘预览」，/en 看到 XNOW PRO 英文站。
    #    这些文件属于平台自己的业务线，绝不能在分站露出。
    location ~* ^/(en|finance|vpn|404|google[0-9a-f]+)(\.html)?$ {
        return 404;
    }

    # 🖼️ 平台的品牌图（logo / 分享图 / 图标）在分站上不许直接取。
    #    五十九期实测：这几个文件与主站 sha256 完全相同 —— 站长域名下能直接
    #    下载到平台的 logo 和 og 分享图，等于把进货来源挂在门牌上。
    #    分站自己的图标由站长上传（favicon_url），前端已确保不回落平台 logo。
    location ~* ^/(og-image|apple-touch-icon|favicon-32|favicon|logo)\.(png|ico|jpg|svg)$ {
        return 404;
    }

    # 🤖 分站自己的 robots.txt：中性内容，允许收录（站长要靠它被搜到）
    location = /robots.txt {
        default_type text/plain;
        return 200 "User-agent: *\nAllow: /\n";
    }

    # 📄 站点声明 / 清单这类平台文件对分站无意义，别让它们回落成网页
    location ~* ^/(sitemap\.xml|manifest\.json|site\.webmanifest|ads\.txt|security\.txt)$ {
        return 404;
    }

    location / {
        # ⚠️ 不能用 /index.html：那份带平台 SEO 元信息（title/description/og 全是 XNOW）。
        #    /site.html 是构建时生成的中性入口（同一份 JS，只是元信息中性）。
        try_files $uri $uri/ /site.html;
    }
}
`;
  fs.writeFileSync(file, conf, 'utf8');
  return file;
};

export const reloadNginx = () => {
  // -s reload 是原子的：配置有错时保留旧进程继续服务，不会像 restart 那样中断
  execSync('nginx -s reload', { stdio: 'pipe', timeout: 30000 });
};

// 🧹 删站要连证书一起清：
//    只删 vhost、留下 /etc/nginx/ssl/<域名>.crt|key，删一百个站就攒一百对废证书；
//    更要紧的是 —— 删的若是站点当前用的配置，残留配置会让"已删除的店"继续对外可访问，
//    而站点记录已不存在 → 访客会看到主站首页，等于把平台暴露出去。
export const removeVhost = (siteId, domain, opts = {}) => {
  let removed = false;
  const file = vhostPath(siteId, domain);
  try { if (fs.existsSync(file)) { fs.unlinkSync(file); removed = true; } } catch (e) {}
  if (opts.keepCert) return removed;
  const safe = String(domain).replace(/[^a-z0-9.-]/gi, '');
  for (const ext of ['.crt', '.key']) {
    const p = path.join(SSL_DIR, `${safe}${ext}`);
    try { if (fs.existsSync(p)) { fs.unlinkSync(p); removed = true; } } catch (e) {}
  }
  return removed;
};

// 🪦 已释放的域名要立"墓碑"：
//    直接删掉 vhost 会让该域名落到 nginx 的默认 server（= 主站首页），
//    已删除的店域名仍能打开、还显示平台的样子 —— 等于把平台暴露出去。
//    所以删站后写一个 return 410 的占位 vhost：域名不会被别人抢去，
//    访客看到的是"该站点已下线"，而不是平台首页。
export const gonePath = (domain) =>
  path.join(NGINX_DIR, `xnow-gone-${String(domain).replace(/[^a-z0-9.-]/gi, '')}`);

export const parkDomain = (domain) => {
  const safe = String(domain).replace(/[^a-z0-9.-]/gi, '');
  if (!safe) return false;
  const body = `# 自动生成：域名 ${safe} 已释放（原分站已删除）
# 由 server/src/utils/siteDomain.js 写入，请勿手工编辑
server {
    listen 80;
    server_name ${safe};
    return 410;
}

server {
    listen 443 ssl http2;
    server_name ${safe};
    ssl_certificate     /etc/nginx/ssl/${safe}.crt;
    ssl_certificate_key /etc/nginx/ssl/${safe}.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    return 410;
}
`;
  try { fs.writeFileSync(gonePath(domain), body); return true; } catch (e) { return false; }
};

export const unparkDomain = (domain) => {
  try {
    const p = gonePath(domain);
    if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
  } catch (e) {}
  return false;
};
