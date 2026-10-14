#!/bin/bash
set -euo pipefail

echo ""
echo "============================================"
echo "  XNOW 全自动部署脚本"
echo "============================================"
echo ""

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
ok()  { echo -e "  ${GREEN}✓${NC} $1"; }
warn(){ echo -e "  ${YELLOW}⚠${NC} $1"; }
fail(){ echo -e "  ${RED}✗${NC} $1"; }

read -p "域名 (如 xnow.example.com): " DOMAIN
read -p "MySQL 密码: " DB_PASS

# 🔄 可选参数：备份包路径。**换机灾备**时用 —— 装完直接把数据灌进去。
#    不传这个参数 = 全新空站，行为和以前完全一样。
#
#    为什么需要它：新装好的机器是个**死锁** ——
#      要进【数据灾备中心】上传备份 → 得先是管理员；
#      要当管理员 → 得是第一个注册的账号（空库时自动成为管理员）；
#      要注册 → 得有邮箱验证码；
#      要发验证码 → 得先在后台配好 SMTP；
#      而 SMTP 配置本身**存在数据库里**，新机器的库是空的。
#      于是：登不进、也注册不了，备份包明明在手上却没有任何入口能倒进去。
#      ✅ 2026-10-15 已解开：脚本收尾时会检测 users 表为空 → 自动建初始管理员
#         admin / admin123（不留代码后门，登录后改密码即失效）。详见文件末尾「冷启动」一节。
#    用法：bash install.sh /path/to/xnow_backup_xxx.tar.gz
BACKUP_ARCHIVE="${1:-}"
if [ -n "$BACKUP_ARCHIVE" ] && [ ! -f "$BACKUP_ARCHIVE" ]; then
  fail "找不到备份包: $BACKUP_ARCHIVE"
  exit 1
fi

# ── 系统依赖 ──────────────────────────────────────────
echo "[1/6] 安装系统依赖..."
# ⚠️ 全新 VPS 一开机 unattended-upgrades / apt-daily 往往正在跑并占着 apt 锁。不等待的话
#    `apt update` 会直接失败，而它下面没有兜底 → set -e 让脚本停在第 1 步，报错还是
#    "Could not get lock" 这种与真实原因无关的信息。2026-10-14 演练实测：那台机器上有个
#    8/20 起就卡死的 apt-daily 一直占锁，脚本正是死在这里。
APT_OPTS="-o DPkg::Lock::Timeout=600"
apt $APT_OPTS update -qq
DEBIAN_FRONTEND=noninteractive apt $APT_OPTS install -y curl wget git nginx mysql-server > /dev/null 2>&1 || \
  DEBIAN_FRONTEND=noninteractive apt $APT_OPTS install -y curl wget git nginx mariadb-server > /dev/null 2>&1
ok "完成"

# ── Node.js（阿里云镜像，国内快）───────────────────────
# ⚠️ 版本下限是 20.19，**不要退回 18**：依赖树里的 htmlparser2@12 是纯 ESM 包，
#    而 sanitize-html 是 CommonJS，它用 require() 去加载那个 ESM —— 「require(ESM)」
#    这个能力 Node 18 没有，20.19+ 才有（22.12+ 默认开启，20.19 回移了同一特性）。
#    Node 18 上的后果不是"告警"而是后端启动即崩：ERR_REQUIRE_ESM，全站不可用。
#    2026-10-14 整机恢复演练实测（同一份 node_modules，只换 Node）：
#      v18.20.8 → 崩，3000 端口不监听；v20.20.2 → 正常启动（与生产同版）。
NODE_FULL="20.20.2"
NODE_MAJOR="20"
echo "[2/6] 安装 Node.js ${NODE_MAJOR}..."
ARCH=$(uname -m)
NODE_ARCH=""
[ "$ARCH" = "x86_64" ] && NODE_ARCH="x64"
[ "$ARCH" = "aarch64" ] && NODE_ARCH="arm64"

if command -v node &> /dev/null; then
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -lt "$NODE_MAJOR" ]; then
    warn "当前 Node.js v$(node -v | cut -d'v' -f2) 低于 v${NODE_MAJOR}，后端可能因 require(ESM) 缺失而起不来"
  fi
  ok "Node.js $(node -v)"
else
  if [ -z "$NODE_ARCH" ]; then
    fail "不支持的架构: $ARCH"
    exit 1
  fi
  curl -fsSL "https://mirrors.aliyun.com/nodejs-release/v${NODE_FULL}/node-v${NODE_FULL}-linux-${NODE_ARCH}.tar.xz" -o /tmp/node.tar.xz
  tar -xf /tmp/node.tar.xz -C /usr/local/
  ln -sf /usr/local/node-v${NODE_FULL}-linux-${NODE_ARCH}/bin/* /usr/local/bin/
  rm -f /tmp/node.tar.xz
  ok "Node.js v${NODE_FULL}"
fi

# 安装 / 确保 PM2 可用
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2 2>&1 | tail -1 || true
  # 如果 pm2 还没在 PATH 里，创建软链接
  if ! command -v pm2 &> /dev/null; then
    PM2_BIN="$(npm root -g 2>/dev/null)/../../bin/pm2"
    [ -f "$PM2_BIN" ] && ln -sf "$PM2_BIN" /usr/local/bin/pm2
  fi
fi
if command -v pm2 &> /dev/null; then
  ok "PM2 $(pm2 -v 2>/dev/null)"
else
  fail "PM2 安装失败，请手动执行：npm install -g pm2"
  exit 1
fi

# ── MySQL ──────────────────────────────────────────────
echo "[3/6] 配置 MySQL..."
# 尝试不同服务名启动
for svc in mysql mariadb mysqld; do
  if systemctl is-enabled "$svc" &>/dev/null; then
    systemctl start "$svc" 2>/dev/null || true
    break
  fi
done
# 如果没有服务被启用，尝试第一个存在的
systemctl list-units --type=service --all 2>/dev/null | grep -qE 'mysql|mariadb' && \
  systemctl start $(systemctl list-units --type=service --all 2>/dev/null | grep -oE 'mysql|mariadb' | head -1) 2>/dev/null || true
systemctl enable mysql 2>/dev/null || systemctl enable mariadb 2>/dev/null || true

# ── 建库 + 设置 root 密码 ──────────────────────────────
# ⚠️ 这里有两个坑，2026-10-14 整机恢复演练实测踩过，别再踩：
#  ① 不能拿 socket 连接去"验证密码对不对"：Debian/MariaDB 的 root@localhost 同时挂着
#     unix_socket 插件（auth_or），走 socket 时它**无视密码、恒成功**。拿它当判据会误判成
#     "密码已经OK"，于是真正设密码的语句永远不执行。
#  ② MySQL 与 MariaDB 设密码语法不同，MariaDB 不认 `IDENTIFIED WITH … BY …`。生产是
#     Ubuntu+MySQL 所以没暴露；新机器 apt 装到的是 mariadb-server，必然暴露。若这句再带
#     `|| true`，失败会被**静默**吞掉，最后表现为"还原失败""后端连不上库"，排查方向被彻底带偏
#     （真因是密码压根没设上）。
#  验证必须用**后端真正会走的那条路**：TCP(127.0.0.1) + 密码。socket 能过 ≠ 后端能连。
DB_OK=0
if mysql -u root -e "SELECT 1" &>/dev/null; then
  mysql -u root -e "CREATE DATABASE IF NOT EXISTS xnow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  if mysql -u root -e "SELECT VERSION();" 2>/dev/null | grep -qi mariadb; then
    mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('$DB_PASS'); FLUSH PRIVILEGES;"
  else
    mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASS'; FLUSH PRIVILEGES;"
  fi
elif mysql -u root -p"$DB_PASS" -e "SELECT 1" &>/dev/null; then
  mysql -u root -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS xnow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
fi

# 用 TCP + 密码验证 —— 后端就是这么连库的，这才是有意义的判据
if mysql -h 127.0.0.1 -u root -p"$DB_PASS" xnow_db -e "SELECT 1" &>/dev/null; then
  DB_OK=1
fi

if [ "$DB_OK" -eq 1 ]; then
  ok "MySQL"
else
  fail "MySQL 配置失败：TCP 连不上库（后端走的也是这条，必须先修好）"
  warn "自查：mysql -h 127.0.0.1 -u root -p<密码> xnow_db -e 'SELECT 1'"
  exit 1
fi

# ── 拉取源码 ──────────────────────────────────────────
echo "[4/6] 拉取源码..."
mkdir -p /var/www
if [ -d "/var/www/xnow/.git" ]; then
  cd /var/www/xnow && git pull
  ok "已更新"
elif [ -d "/var/www/xnow" ]; then
  warn "/var/www/xnow 已存在但不是 git 仓库，备份后重新克隆"
  mv /var/www/xnow "/var/www/xnow.bak.$(date +%s)"
  git clone https://github.com/xiasummer740/xnow.git /var/www/xnow
  ok "已克隆（旧目录已备份）"
else
  git clone https://github.com/xiasummer740/xnow.git /var/www/xnow
  ok "已克隆"
fi

# ── 后端 ──────────────────────────────────────────────
echo "[5/6] 构建后端..."
cd /var/www/xnow/server

# .env 文件管理：保留上次的 JWT_SECRET，避免 token 失效
if [ -f .env ]; then
  OLD_JWT=$(grep ^JWT_SECRET= .env | cut -d'=' -f2-)
  # 备份旧的 .env
  cp .env ".env.bak.$(date +%s)"
fi

# 🔑 换机恢复**必须把原来那把 JWT_SECRET 带过来**。
#    它是全部登录凭证的签名密钥：换一把 = 已发出的 token 全部作废 = 全体用户被踢下线重登。
#    上面那个 `if [ -f .env ]` 只在本机重跑时救得了命；**新机器上没有旧 .env**（.env 被
#    .gitignore 挡在仓库外），所以只能从外面喂进来，不喂就会随机生成新的一把。
#    优先级：命令行给的值 > 本机遗留 .env 里的值 > 随机生成。
#    用法：XNOW_JWT_SECRET=<旧密钥> bash install.sh
JWT_VALUE="${XNOW_JWT_SECRET:-${OLD_JWT:-}}"
if [ -z "$JWT_VALUE" ]; then
  JWT_VALUE=$(openssl rand -hex 32)
  warn "已生成全新的 JWT_SECRET。若是换机恢复，请改用 XNOW_JWT_SECRET=<旧密钥> bash install.sh 重跑 —— 否则全部用户需要重新登录"
fi

cat > .env << ENVEOF
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=$DB_PASS
DB_NAME=xnow_db
JWT_SECRET=$JWT_VALUE
PORT=3000
ENVEOF

# ── 可选：装完即恢复 ──────────────────────────────────
# 放在这里（.env 已写好、后端还没启动）是有意的：后端第一次起来时
# `sequelize.sync({ alter: false })` 会补建缺的表/配置项，但它看到表已存在就只做增量，
# 不会去动我们刚灌进去的数据。反过来若先启动后端，空库会先被建出一套空表。
if [ -n "$BACKUP_ARCHIVE" ]; then
  echo "[5.5/6] 灌入备份数据..."

  # 🚦 闸门：**只在空库时**才自动灌。本脚本可以重复执行，重跑时库里可能已经有真实数据，
  #    无脑覆盖 = 把数据抹掉且不可逆 —— 这是整个脚本唯一会毁数据的地方，必须挡死。
  TABLE_COUNT=$(mysql -h 127.0.0.1 -u root -p"$DB_PASS" -N -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='xnow_db';" \
    2>/dev/null | tr -d '[:space:]' || true)
  if [ -z "$TABLE_COUNT" ]; then TABLE_COUNT=0; fi

  if [ "$TABLE_COUNT" != "0" ]; then
    fail "xnow_db 里已有 $TABLE_COUNT 张表，拒绝自动灌入（防止覆盖现有数据）"
    warn "已跳过恢复。装完后请在网页【数据灾备中心】里上传还原。"
  else
    RS_TMP=$(mktemp -d)
    if tar xzf "$BACKUP_ARCHIVE" -C "$RS_TMP" 2>/dev/null && [ -f "$RS_TMP/xnow_db.sql" ]; then
      if mysql -h 127.0.0.1 -u root -p"$DB_PASS" xnow_db < "$RS_TMP/xnow_db.sql" 2>/dev/null; then
        ok "数据库已还原 —— 用你**原来的账号密码**登录即可，不需要注册"
      else
        fail "数据库还原失败。网站会以空库启动，请改用网页【数据灾备中心】重新上传。"
      fi
      # 补单记录不落在任何一张表里，上面那条 mysql 带不回来，得单独放回原位
      # （新机器上 server/data/ 还不存在，必须自己建目录）
      if [ -f "$RS_TMP/pending_payments.json" ]; then
        mkdir -p /var/www/xnow/server/data
        cp "$RS_TMP/pending_payments.json" /var/www/xnow/server/data/pending_payments.json
        ok "支付补单记录已还原"
      fi
    else
      fail "解包失败、或包里没有 xnow_db.sql —— 不是本系统产出的备份，已跳过恢复"
    fi
    rm -rf "$RS_TMP"
  fi
fi

npm install

# 启动/重启后端
pm2 delete xnow-backend 2>/dev/null || true
pm2 start src/app.js --name xnow-backend
pm2 save
pm2 startup systemd -u root 2>/dev/null || true
ok "后端就绪"

# ── 前端 ──────────────────────────────────────────────
echo "[6/6] 构建前端..."
cd /var/www/xnow/client
npm install
if npm run build; then
  ok "前端编译完成"
else
  fail "前端编译失败，请检查错误日志"
  exit 1
fi

# ── 全局 ACME 验证配置 ──────────────────────────
# 如果当前 nginx 没有全局 ACME 验证路径，自动添加
# 这样后续安装其他项目（如 XX-UI）可以直接用 webroot 模式签证书
if command -v nginx &>/dev/null; then
  ACME_CONF="/etc/nginx/conf.d/00-acme-challenge.conf"
  ACME_ROOT="/var/www/acme-challenge"
  if [ ! -f "$ACME_CONF" ]; then
    mkdir -p "$ACME_ROOT"
    cat > "$ACME_CONF" << 'EOF'
server {
    listen 80;
    server_name _;
    location /.well-known/acme-challenge/ {
        alias /var/www/acme-challenge/;
    }
    location / { return 404; }
}
EOF
    nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
    ok "全局 ACME 验证已配置"
  fi
fi

# ══════════════════════════════════════════════════════
# SSL 证书
# ══════════════════════════════════════════════════════
echo ""
echo "配置 SSL 证书..."

CERT_DIR="/root/cert/$DOMAIN"
mkdir -p "$CERT_DIR"

sign_ssl() {
  local CA="$1"
  ~/.acme.sh/acme.sh --set-default-ca --server "$CA" --force 2>/dev/null

  WEBROOT="/var/www/xnow/client/dist"
  mkdir -p "$WEBROOT/.well-known/acme-challenge"

  if ~/.acme.sh/acme.sh --issue -d "$DOMAIN" --webroot "$WEBROOT" --force 2>/dev/null; then
    ~/.acme.sh/acme.sh --installcert -d "$DOMAIN" \
      --key-file "$CERT_DIR/privkey.pem" \
      --fullchain-file "$CERT_DIR/fullchain.pem" \
      --reloadcmd "systemctl reload nginx 2>/dev/null || true" 2>/dev/null
    if [ -f "$CERT_DIR/fullchain.pem" ]; then
      echo "  ✓ Let's Encrypt 证书签发成功"
      return 0
    fi
  fi
  return 1
}

CERT_OK=0

# 尝试复用已有证书
if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
  # 检查证书是否过期
  openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -checkend 864000 2>/dev/null && CERT_OK=1
  if [ "$CERT_OK" -eq 1 ]; then
    ok "发现有效证书: $CERT_DIR"
  else
    warn "证书已过期或即将过期，重新签发"
  fi
fi

# 若证书无效，用 acme.sh 签发
if [ "$CERT_OK" -eq 0 ]; then
  if command -v ~/.acme.sh/acme.sh &>/dev/null; then
    echo "  检测到 acme.sh，尝试签发证书..."
    sign_ssl letsencrypt || { warn "Let's Encrypt 签发失败，降级为自签证书"; }
  else
    echo "  安装 acme.sh..."
    curl -s https://get.acme.sh | sh >/dev/null 2>&1 && chmod +x ~/.acme.sh/acme.sh || true
    if command -v ~/.acme.sh/acme.sh &>/dev/null; then
      sign_ssl letsencrypt || { warn "Let's Encrypt 签发失败，降级为自签证书"; }
    else
      warn "acme.sh 安装失败，降级为自签证书"
    fi
  fi

  # 检查最终证书状态
  if [ -f "$CERT_DIR/fullchain.pem" ] && openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -checkend 864000 2>/dev/null; then
    CERT_OK=1
  fi
fi

# 降级：自签证书
if [ "$CERT_OK" -eq 0 ]; then
  mkdir -p /etc/nginx/ssl
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$CERT_DIR/privkey.pem" -out "$CERT_DIR/fullchain.pem" \
    -subj "/CN=$DOMAIN" 2>/dev/null
  ok "已生成自签证书（建议稍后手动配置 Let's Encrypt）"
fi

# 启用 acme.sh 自动续期
if [ "$CERT_OK" -eq 1 ] && command -v ~/.acme.sh/acme.sh &>/dev/null; then
  ~/.acme.sh/acme.sh --upgrade --auto-upgrade 2>/dev/null
  ok "自动续期已启用"
fi

# ══════════════════════════════════════════════════════
# Nginx 配置
# ══════════════════════════════════════════════════════
echo ""
echo "配置 Nginx..."

mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

# 生成 xnow 站点配置
cat > /etc/nginx/sites-available/xnow << NGXEOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/xnow/client/dist;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;

    client_max_body_size 100M;

    # ══ Cloudflare 真实客户端 IP 还原 ══════════════════════════════════
    # 站点挂在 Cloudflare 后面时必配。少了这段，\$remote_addr 拿到的是 CF 边缘 IP：
    # 按 IP 拉黑会误封整片用户、注册/登录 IP 全是机房地址、限流配额被整条边缘共享。
    # set_real_ip_from 是白名单：只有【从 CF 机房来的连接】才采信它给的客户端 IP，
    # 其他人直连源站伪造 CF-Connecting-IP 头不生效（已实测验证）。
    # 来源 https://www.cloudflare.com/ips-v4 与 /ips-v6，取于 2026-09-20。
    # CF 网段极稳定；万一漏了新段，后果只是那部分用户退回成 CF 机房 IP，站点不会挂。
    # 不用 Cloudflare 的部署可以整段删掉，不影响功能。
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 131.0.72.0/22;
    set_real_ip_from 2400:cb00::/32;
    set_real_ip_from 2606:4700::/32;
    set_real_ip_from 2803:f800::/32;
    set_real_ip_from 2405:b500::/32;
    set_real_ip_from 2405:8100::/32;
    set_real_ip_from 2a06:98c0::/29;
    set_real_ip_from 2c0f:f248::/32;
    real_ip_header CF-Connecting-IP;
    real_ip_recursive on;

    root /var/www/xnow/client/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # 构建产物带内容哈希：内容一变文件名就变，可以放心长缓存
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        # HTML 必须每次校验：否则发版后浏览器拿缓存里的旧页面，
        # 而旧页面指向旧代码包 —— 表现为「服务器上是新包，用户端毫无变化」。
        # no-cache 不是不缓存，是「用之前先问服务器有没有变」，没变回 304，变了回 200。
        add_header Cache-Control "no-cache";
        # ⚠️ 中间这个 \$uri.html 不能省！client/public/ 下除 index.html 外还有
        # 404.html / finance.html（以及必须补进 public 的 vpn.html / en.html / Google 验证文件），
        # Vite 会把它们原样拷进 dist/，靠 \$uri.html 才能让 /finance、/vpn、/en 命中各自页面。
        # 少了它，这些路径会静默塌成 SPA 首页 —— HTTP 仍 200，但页面内容全错（实测过）。
        try_files \$uri \$uri.html \$uri/ /index.html;
    }
}
NGXEOF

ln -sf /etc/nginx/sites-available/xnow /etc/nginx/sites-enabled/xnow

# 只在 default 确实是 nginx 自带欢迎页时才删除
if [ -L /etc/nginx/sites-enabled/default ]; then
  DEFAULT_TARGET=$(readlink -f /etc/nginx/sites-enabled/default)
  [ "$DEFAULT_TARGET" = "/etc/nginx/sites-available/default" ] && rm -f /etc/nginx/sites-enabled/default
fi

# nginx 临时缓冲目录必须归 worker 用户所有，否则大响应会被腰斩：
# 属主不对时 nginx 落盘缓冲失败 → 读上游半途放弃 → 只发出已缓冲的一小截，
# 而 Content-Length 仍是完整值（前端拿到残缺 JSON，报"网络异常"）。
# 2026-09-20 全站下单页服务加载失败 27 小时即此因（以 root 解析过一份不带 user 指令的
# main 配置 —— 实测连 `nginx -t` 这种"只是测一下配置"的解析都会改属主，不必启动、不必 reload）。
chown -R www-data:www-data /var/lib/nginx/proxy /var/lib/nginx/body \
  /var/lib/nginx/fastcgi /var/lib/nginx/uwsgi /var/lib/nginx/scgi 2>/dev/null || true

# 光靠上面的 chown 只能治一次；真正 杜绝 的是这条：让 nginx 压根不用临时文件。
# 缓冲落盘失败时 nginx 会「读到一半放弃上游」，只把已发出的一小截当成功返回，
# 而 Content-Length 仍是完整值 —— 客户端拿到残缺数据、HTTP 却还是 200，
# 前端只能猜成"网络异常"（2026-09-21 全站下单页坏了 27 小时就是这形态）。
# 设 0 = 整个响应同步透传：客户端读得慢，nginx 就少读上游（背压），
# **"nginx 因临时文件落盘失败而腰斩"这条路径彻底消失**（属主再错也腰斩不了）。
# 注意别读成"任何形式的响应截断都不可能了"—— 上游自己发到一半死掉同样能得到
# 200 + Content-Length 完整 + body 残缺这组签名，那是另一码事（见 ISSUES.md）。
# 代价是大响应遇上慢客户端会多占用一会儿上游连接，本项目被代理的最大也就 1.5MB，可接受。
cat > /etc/nginx/conf.d/00-proxy-buffer.conf << 'EOF'
# 由 xnow install.sh 生成：禁止 nginx 为大响应创建临时文件，防止响应被静默腰斩
proxy_max_temp_file_size 0;
EOF

systemctl enable nginx 2>/dev/null || true
nginx -t && (systemctl reload nginx 2>/dev/null || systemctl start nginx 2>/dev/null)
ok "Nginx 已启动"

# ══════════════════════════════════════════════════════
# 健康检查
# ══════════════════════════════════════════════════════
echo ""
echo "执行健康检查..."
sleep 2

# 检查后端（接受任意 HTTP 状态码，有响应即视为存活）
BACKEND_HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ 2>/dev/null || echo "000")
if [ "$BACKEND_HTTP" != "000" ]; then
  ok "后端 API 响应正常 (HTTP $BACKEND_HTTP)"
else
  warn "后端未响应，请手动检查：pm2 logs xnow-backend"
fi

# 检查 Nginx
# ⚠️ 别用 `curl -sf http://127.0.0.1` 直接探：不带 Host 头时请求会落到本脚本自己创建的
#    ACME 兜底块（server_name _ + location / { return 404; }），404 会被 -f 判成失败，
#    于是每次装完都打印一条 "Nginx 80 端口未响应" 的假告警。带上 Host 并按"有响应即算活"
#    判断，与上面后端那条保持一致口径（301 跳转也是正常活着的表现）。
NGINX_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: $DOMAIN" "http://127.0.0.1" 2>/dev/null || echo "000")
if [ "$NGINX_HTTP" != "000" ]; then
  ok "Nginx 80 端口正常 (HTTP $NGINX_HTTP)"
else
  warn "Nginx 80 端口未响应"
fi

# ══════════════════════════════════════════════════════
# 🔑 冷启动：空库时创建初始管理员（账号 admin / 密码 admin123）
# ══════════════════════════════════════════════════════
# 为什么必须补这一步：新装的机器本来是个**死锁** ——
#   注册必须过邮箱验证码 → 发验证码要先配 SMTP → 而 SMTP 配置**存在数据库里**，
#   新库是空的 → 没账号就进不去后台配它。于是：登不进、也注册不了，
#   备份包明明在手上，却没有任何入口能倒进去。
#
# 历史上这里有过两个硬编码口子：万能验证码 666888、以及影子账户 admin/admin123
# 直接签发超管令牌。2026 年初的安全加固把它们删了（提交 40892dac / c824db8b）——
# **删得对**：本仓库是 PUBLIC，硬编码的超管口令等于任何"还没被认领"的实例，
# 谁先看到代码谁就能拿最高权限。但删完没补替代，死锁就回来了。
#
# 这里补的是**不留代码后门**的版本：只在 users 表真的为空时，建一个**真实的数据库账号**。
# 它不是代码里的万能口令，只是一台机器上的初始凭据 —— 登录后改掉密码即彻底失效。
# 想换初始密码（推荐）：XNOW_INITIAL_ADMIN_PASS=你的密码 bash install.sh
INITIAL_ADMIN_PASS=""
_seed_users=$(mysql -h 127.0.0.1 -u root -p"$DB_PASS" -N -e "SELECT COUNT(*) FROM xnow_db.users;" 2>/dev/null | tr -d '[:space:]' || true)
if [ -z "$_seed_users" ]; then
  warn "读不到 users 表（后端可能还没把表建出来），跳过初始管理员创建"
elif [ "$_seed_users" != "0" ]; then
  ok "库里已有 $_seed_users 个账号，跳过初始管理员创建"
else
  _seed_pass="${XNOW_INITIAL_ADMIN_PASS:-admin123}"
  _seed_hash=$(cd /var/www/xnow/server && XNOW_SEED_PASS="$_seed_pass" node -e \
    "import('bcryptjs').then(async b=>{process.stdout.write(await b.default.hash(process.env.XNOW_SEED_PASS,10))})" 2>/dev/null)
  if [ -z "$_seed_hash" ]; then
    warn "bcryptjs 不可用，初始管理员未创建 —— 请手工执行（见 README 灾备一节）"
  elif mysql -h 127.0.0.1 -u root -p"$DB_PASS" xnow_db -e \
    "INSERT INTO users (id, phone, role, balance, password_hash, api_key, created_at, updated_at) VALUES (1,'admin','super_admin',99999,'$_seed_hash','xnow_init_$(date +%s)',NOW(),NOW());" 2>/dev/null; then
    INITIAL_ADMIN_PASS="$_seed_pass"
    printf '%s\n' "XNOW 初始管理员   账号=admin   密码=$INITIAL_ADMIN_PASS   （登录后请立刻改密码）" > /root/xnow-initial-admin.txt
    chmod 600 /root/xnow-initial-admin.txt
    ok "初始管理员已创建：账号 admin / 密码 $INITIAL_ADMIN_PASS"
  else
    warn "初始管理员创建失败，请手工执行（见 README 灾备一节）"
  fi
fi

echo ""
echo "============================================"
echo "  部署完成！"
echo "  https://$DOMAIN"
echo ""
if [ "$CERT_OK" -eq 1 ]; then
  echo "  SSL: Let's Encrypt (自动续期)"
else
  echo "  SSL: 自签证书"
fi
if [ -n "$INITIAL_ADMIN_PASS" ]; then
  echo ""
  echo "  🔑 初始管理员:  账号 admin   密码 $INITIAL_ADMIN_PASS"
  echo "     ⚠️ 请登录后立刻改密码。默认值 admin123 写在公开代码里，"
  echo "        改掉之前，任何知道这个默认值的人都能进你的后台。"
  echo "     （同样内容已存一份在 /root/xnow-initial-admin.txt）"
fi
echo "  后端进程: pm2 list"
echo "  查看日志: pm2 logs xnow-backend"
echo "============================================"
