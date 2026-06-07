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

# ── 系统依赖 ──────────────────────────────────────────
echo "[1/6] 安装系统依赖..."
apt update -qq
DEBIAN_FRONTEND=noninteractive apt install -y curl wget git nginx mysql-server > /dev/null 2>&1 || \
  DEBIAN_FRONTEND=noninteractive apt install -y curl wget git nginx mariadb-server > /dev/null 2>&1
ok "完成"

# ── Node.js（阿里云镜像，国内快）───────────────────────
echo "[2/6] 安装 Node.js 18..."
ARCH=$(uname -m)
NODE_ARCH=""
[ "$ARCH" = "x86_64" ] && NODE_ARCH="x64"
[ "$ARCH" = "aarch64" ] && NODE_ARCH="arm64"

if command -v node &> /dev/null; then
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -ne 18 ]; then
    warn "当前 Node.js v$(node -v | cut -d'v' -f2)，建议 v18，继续使用"
  fi
  ok "Node.js $(node -v)"
else
  if [ -z "$NODE_ARCH" ]; then
    fail "不支持的架构: $ARCH"
    exit 1
  fi
  curl -fsSL "https://mirrors.aliyun.com/nodejs-release/v18.20.8/node-v18.20.8-linux-${NODE_ARCH}.tar.xz" -o /tmp/node.tar.xz
  tar -xf /tmp/node.tar.xz -C /usr/local/
  ln -sf /usr/local/node-v18.20.8-linux-${NODE_ARCH}/bin/* /usr/local/bin/
  rm -f /tmp/node.tar.xz
  ok "Node.js v18.20.8"
fi

# 安装 / 确保 PM2 可用
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2 2>&1 | tail -1 || true
  # 如果 pm2 还没在 PATH 里，创建软链接
  if ! command -v pm2 &> /dev/null; then
    PM2_BIN="$(npm root -g 2>/dev/null)/../bin/pm2"
    [ -f "$PM2_BIN" ] && ln -sf "$PM2_BIN" /usr/local/bin/pm2
  fi
fi
command -v pm2 &> /dev/null && ok "PM2 $(pm2 -v 2>/dev/null)" || warn "PM2 未安装，将用 npx 降级"

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

# 建库（先用密码试，失败再用无密码；双保险）
DB_OK=0
if mysql -u root -p"$DB_PASS" -e "SELECT 1" &>/dev/null; then
  mysql -u root -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS xnow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  mysql -u root -p"$DB_PASS" -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASS'; FLUSH PRIVILEGES;" 2>/dev/null || true
  DB_OK=1
elif mysql -u root -e "SELECT 1" &>/dev/null; then
  mysql -u root -e "CREATE DATABASE IF NOT EXISTS xnow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASS'; FLUSH PRIVILEGES;"
  DB_OK=1
fi

if [ "$DB_OK" -eq 1 ]; then
  ok "MySQL"
else
  fail "MySQL 配置失败，请检查服务状态后重试"
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

cat > .env << ENVEOF
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=$DB_PASS
DB_NAME=xnow_db
JWT_SECRET=${OLD_JWT:-$(openssl rand -hex 32)}
PORT=3000
ENVEOF

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

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGXEOF

ln -sf /etc/nginx/sites-available/xnow /etc/nginx/sites-enabled/xnow

# 只在 default 确实是 nginx 自带欢迎页时才删除
if [ -L /etc/nginx/sites-enabled/default ]; then
  DEFAULT_TARGET=$(readlink -f /etc/nginx/sites-enabled/default)
  [ "$DEFAULT_TARGET" = "/etc/nginx/sites-available/default" ] && rm -f /etc/nginx/sites-enabled/default
fi

systemctl enable nginx 2>/dev/null || true
nginx -t && (systemctl reload nginx 2>/dev/null || systemctl start nginx 2>/dev/null)
ok "Nginx 已启动"

# ══════════════════════════════════════════════════════
# 健康检查
# ══════════════════════════════════════════════════════
echo ""
echo "执行健康检查..."
sleep 2

# 检查后端
if curl -sf http://127.0.0.1:3000/api/ > /dev/null 2>&1; then
  ok "后端 API 响应正常"
else
  warn "后端未响应，请手动检查：pm2 logs xnow-backend"
fi

# 检查 Nginx
if curl -sf -o /dev/null "http://127.0.0.1" 2>/dev/null; then
  ok "Nginx 80 端口正常"
else
  warn "Nginx 80 端口未响应"
fi

echo ""
echo "============================================"
echo "  部署完成！"
echo "  https://$DOMAIN"
echo ""
echo "  SSL: $( [ "$CERT_OK" -eq 1 ] && echo 'Let's Encrypt (自动续期)' || echo '自签证书' )"
echo "  后端进程: pm2 list"
echo "  查看日志: pm2 logs xnow-backend"
echo "============================================"
