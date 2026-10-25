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

// 🔑 74 期：ACME 挑战必须有一个**独立**的 webroot。
//    原来把 client/dist 当 webroot，靠的是"80 端口能直接取到那个文件"——
//    可我们所有 vhost（含全局默认）都是无条件 301 跳 HTTPS，
//    而新域名此时只有自签证书，Let's Encrypt 跟到 HTTPS 就校验失败 →
//    首次签发永远失败，只能退回自签，站长看到的就是"浏览器不安全"。
//    现在把挑战文件放进 /var/www/certbot，并在每个 vhost 的 80 段里
//    用 location ^~ 把它**放在跳转之前**，首次签发才真的能过。
// 目录名与 install.sh 里那段全局 ACME 配置保持一致，别搞出两个挑战目录
const ACME_ROOT = process.env.ACME_WEBROOT || '/var/www/acme-challenge';

const ensureAcmeRoot = () => {
  try {
    fs.mkdirSync(path.join(ACME_ROOT, '.well-known', 'acme-challenge'), { recursive: true });
    return ACME_ROOT;
  } catch (e) {
    return null;
  }
};

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

// 🔀 100 期：跨环境域名冲突保护
//    背景：Beta 与生产在**同一台机器**上，共用 /etc/nginx/sites-enabled 和 *.taikon.top 泛解析，
//    但两边数据库是分开的。只用「查自己库里的 sites 表」挡不住冲突：
//    生产若建了一个 Beta 已占用的域名（比如都叫 demostore），两份 vhost 会抢同一个 server_name，
//    nginx 只认先加载的那份 —— 客户可能被送进另一个环境的库，看到别人的数据。
//    做法：查 nginx 目录里有没有「同一个域名、但不是本站在用」的 vhost 文件。
export const domainVhostOwner = (domain, selfSiteId = 0) => {
  const d = String(domain || '').toLowerCase().replace(/[^a-z0-9.-]/g, '');
  if (!d) return null;
  try {
    for (const f of fs.readdirSync(NGINX_DIR)) {
      if (!f.startsWith('xnow-site-')) continue;
      if (!f.toLowerCase().endsWith('-' + d)) continue;
      const m = f.match(/^xnow-site-(\d+)-/);
      const sid = m ? Number(m[1]) : 0;
      if (selfSiteId && sid === Number(selfSiteId)) continue;   // 自己的 vhost，放行
      return { file: f, site_id: sid };
    }
  } catch (e) {}
  return null;
};

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

// 🌐 91 期：本机公网 IP —— 「自有域名」的两处要用到它
//   ① verifyDomainOwnership：拿 DNS 的 A 记录跟它比对，判断域名是否已指向本机
//   ② /api/sites 返回 dns_target_ip：站长照着这个 IP 去配 A 记录
// 取值顺序：环境变量 SERVER_PUBLIC_IP → configs.server_public_ip（运维可在后台写）→ 空。
// 之所以不写死在源码里：本仓库是 PUBLIC，公网 IP 不能进代码。
// 之所以两级兜底：deploy-prod.sh 上线时会自动补环境变量，万一漏了/换机了，
// 后台改一行配置也能救回来，不用重启进程。（取不到就返回空 —— 前端会提示"问平台要地址"，
// 绝不编一个 IP 让站长白折腾，也不会因为空值把 TXT 校验这条路堵掉。）
export const getPublicIp = async () => {
  const fromEnv = String(process.env.SERVER_PUBLIC_IP || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const { Config } = await import('../models/index.js');
    const row = await Config.findOne({ where: { key: 'server_public_ip' } });
    return String((row && row.value) || '').trim();
  } catch (e) {
    return '';
  }
};

// 归属验证：返回 { ok, reason, detail }
export const verifyDomainOwnership = async (domain, token) => {
  // 🔒 六十五期：这里原来写死了 VPS 公网 IP 作为兜底值 —— 本仓库是 PUBLIC，
  //    公网 IP 不该出现在源码里。改成只认环境变量 SERVER_PUBLIC_IP；
  //    没配时不做 IP 比对，只走 TXT 令牌校验（令牌是每个站点随机的，同样能证明归属）。
  const expectedIp = await getPublicIp();
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
// 🔧 110 期（2026-10-26 生产事故修复）：建站时**必须先把 vhost 立起来，再去签正式证书**。
//    原因：certbot 的 HTTP-01 挑战要访问 http://<域名>/.well-known/acme-challenge/xxx，
//    而那一刻 nginx 里还没有这个域名的 server 块 —— 请求落到默认站点（主站）→ 404 →
//    签发失败 → 掉进自签兜底。站长看到的就是"临时证书、浏览器不安全"。
//    Beta 上没暴露，是因为演示站的 vhost 早就存在（重签自然成功）。
export const ensureSelfSignedCert = (domain) => {
  const safe = String(domain).replace(/[^a-z0-9.-]/gi, '');
  const crt = path.join(SSL_DIR, `${safe}.crt`);
  const key = path.join(SSL_DIR, `${safe}.key`);
  if (fs.existsSync(crt) && fs.existsSync(key)) return { crt, key, mode: 'existing' };
  fs.mkdirSync(SSL_DIR, { recursive: true });
  execSync(
    `openssl req -x509 -nodes -newkey rsa:2048 -days 3650 ` +
    `-keyout ${key} -out ${crt} -subj "/CN=${safe}"`,
    { stdio: 'pipe', timeout: 60000 }
  );
  return { crt, key, mode: 'selfsigned' };
};

export const ensureCert = async (domain, webroot) => {
  const safe = String(domain).replace(/[^a-z0-9.-]/gi, '');
  const crt = path.join(SSL_DIR, `${safe}.crt`);
  const key = path.join(SSL_DIR, `${safe}.key`);
  const leCrt = path.join('/etc/letsencrypt/live', safe, 'fullchain.pem');
  const leKey = path.join('/etc/letsencrypt/live', safe, 'privkey.pem');

  // ① 已经是正式证书，直接用
  if (fs.existsSync(leCrt)) return { crt: leCrt, key: leKey, mode: 'letsencrypt' };

  // ② 有 certbot 就**先试着签正式证书**
  //    ⚠️ 注意顺序：早期版本先看 /etc/nginx/ssl/<域名>.crt，那里一旦躺着一张自签证书，
  //    就再也不会尝试正式证书 —— 等于自签永久卡位。签过自签的站永远升级不了。
  let hasCertbot = false;
  try { execSync('command -v certbot', { stdio: 'ignore' }); hasCertbot = true; } catch (e) { hasCertbot = false; }

  if (hasCertbot) {
    // 优先用专用 webroot；建不出来才退回调用方给的目录，再不行用 --nginx
    const acme = ensureAcmeRoot();
    // 优先用 webroot：不改 nginx 配置（--nginx 会就地改我们自动生成的 vhost，容易打架）
    const auth = acme
      ? `--webroot -w ${acme}`
      : (webroot && fs.existsSync(webroot) ? `--webroot -w ${webroot}` : '--nginx');
    try {
      execSync(
        `certbot certonly ${auth} -d ${safe} --non-interactive --agree-tos ` +
        `--register-unsafely-without-email --keep-until-expiring`,
        { stdio: 'pipe', timeout: 180000 }
      );
      if (fs.existsSync(leCrt)) return { crt: leCrt, key: leKey, mode: 'letsencrypt' };
    } catch (e) {
      // 签不下来（比如域名没解析到本机）—— 落到自签，站照样能开
    }
  }

  // ③ 已有自签证书：复用
  if (fs.existsSync(crt) && fs.existsSync(key)) return { crt, key, mode: 'existing' };

  // ④ 自签兜底（openssl 在绝大多数镜像里都有）
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

    # 🔑 证书挑战优先于跳转。注意 nginx 的坑：写在 server 层的 return 在 rewrite
    #    阶段就执行了，location 里的例外根本轮不到 —— 所以跳转必须放进 location /。
    location ^~ /.well-known/acme-challenge/ {
        root ${ACME_ROOT};
        try_files $uri =404;
    }

    location / {
        return 301 https://$host$request_uri;
    }
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

// 给墓碑挑一对**真实存在**的证书。找不到就退回平台自签证书 ——
// 之前写死 /etc/nginx/ssl/<域名>.crt，分站用的是 Let's Encrypt（在 /etc/letsencrypt 下），
// 这个文件根本不存在 → nginx -t 失败 → reload 被跳过 → 墓碑压根没生效，站点照样 200。
const pickParkCert = (safe) => {
  const leCrt = `/etc/letsencrypt/live/${safe}/fullchain.pem`;
  const leKey = `/etc/letsencrypt/live/${safe}/privkey.pem`;
  if (fs.existsSync(leCrt) && fs.existsSync(leKey)) return { crt: leCrt, key: leKey };
  const selfCrt = path.join(SSL_DIR, `${safe}.crt`);
  const selfKey = path.join(SSL_DIR, `${safe}.key`);
  if (fs.existsSync(selfCrt) && fs.existsSync(selfKey)) return { crt: selfCrt, key: selfKey };
  // 兜底：平台自己的自签证书（保证 nginx -t 一定过）
  const fallback = String(process.env.SITE_DEFAULT_CERT || '').trim();
  if (fallback && fs.existsSync(`${fallback}.crt`) && fs.existsSync(`${fallback}.key`)) {
    return { crt: `${fallback}.crt`, key: `${fallback}.key` };
  }
  try {
    const cand = fs.readdirSync(SSL_DIR)
      .filter(f => f.endsWith('.crt') && fs.existsSync(path.join(SSL_DIR, f.replace(/\.crt$/, '.key'))));
    if (cand.length) {
      const base = cand[0].replace(/\.crt$/, '');
      return { crt: path.join(SSL_DIR, `${base}.crt`), key: path.join(SSL_DIR, `${base}.key`) };
    }
  } catch (e) {}
  return null;
};


// 📄 96 期：墓碑页的中性正文。
//    以前 `return 410;` 只有状态码，访客看到的是 nginx 自带的英文 "410 Gone" 白页 ——
//    分站到期后客户一脸懵，看着像跑路。现在给一句中文说明，
//    仍然不提平台、不提品牌（红线），也不暗示"还有个上级"。
// 📁 分站静态目录（nginx root）
//    以前四处都写成 path.resolve(process.cwd(), '..', 'client', 'dist') —— 只要进程的工作目录
//    不是 server/（pm2 换 cwd、手工 node -e、cron 里跑脚本都会变），就会解析成 /var/www/client/dist，
//    写进 vhost 后全站 500。2026-10-25 实测试踩到过一次。
//    现在按「先看环境变量 → 再看代码位置 → 再看几种常见 cwd」的顺序找，**必须真有 index.html 才算数**，
//    一个都找不到就抛错（宁可让调用方失败，也不要写出一份坏 vhost）。
import fsx from 'fs';
import { fileURLToPath } from 'url';

const DIST_MARKERS = ['index.html', 'site.html'];

export const resolveDistRoot = () => {
  const here = fileURLToPath(new URL('.', import.meta.url));      // …/server/src/utils/
  const candidates = [
    process.env.SITE_DIST_ROOT,
    path.resolve(here, '../../../client/dist'),                   // 仓库内：server/src/utils → client/dist
    path.resolve(process.cwd(), '../client/dist'),                // cwd = server/
    path.resolve(process.cwd(), 'client/dist'),                   // cwd = 仓库根
    path.resolve(process.cwd(), '../client/dist'),                // cwd = deploy/ 之类
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      if (DIST_MARKERS.some((m) => fsx.existsSync(path.join(c, m)))) return c;
    } catch (e) { /* 没权限就算了，看下一个 */ }
  }
  throw new Error('找不到分站静态目录（client/dist）。请设置 SITE_DIST_ROOT，或确认前端已构建。');
};

const GONE_PAGE = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"><title>站点已下线</title>' +
  '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
  'background:#0f1115;color:#9aa4b2;font-family:system-ui,-apple-system,"PingFang SC",sans-serif}' +
  'div{text-align:center;padding:24px}h1{font-size:20px;margin:0 0 10px;color:#e5e7eb}' +
  'p{font-size:13px;margin:0;line-height:1.8}</style></head><body><div>' +
  '<h1>这个站点已下线</h1><p>如果你是访客：请联系站点的客服，或稍后再来看看。<br>' +
  '如果你是站长：站点数据都还在，续费后即可恢复访问。</p></div></body></html>';

export const parkDomain = (domain) => {
  const safe = String(domain).replace(/[^a-z0-9.-]/gi, '');
  if (!safe) return false;
  const cert = pickParkCert(safe);
  const httpsBlock = cert
    ? `
server {
    listen 443 ssl http2;
    server_name ${safe};
    ssl_certificate     ${cert.crt};
    ssl_certificate_key ${cert.key};
    ssl_protocols       TLSv1.2 TLSv1.3;
    default_type text/html;
    return 410 '${GONE_PAGE}';
}
`
    : ''; // 连一张证书都找不到：只立 80 的墓碑，443 交给默认 server（总比配置报错、整机不重载好）
  const body = `# 自动生成：域名 ${safe} 已释放（原分站已删除/已到期）
# 由 server/src/utils/siteDomain.js 写入，请勿手工编辑
server {
    listen 80;
    server_name ${safe};
    default_type text/html;
    return 410 '${GONE_PAGE}';
}
${httpsBlock}`;
  try { fs.writeFileSync(gonePath(domain), body); return true; } catch (e) { return false; }
};

export const unparkDomain = (domain) => {
  try {
    const p = gonePath(domain);
    if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
  } catch (e) {}
  return false;
};
