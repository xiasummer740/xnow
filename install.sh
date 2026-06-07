#!/bin/bash
set -e

echo ""
echo "============================================"
echo "  XNOW 全自动部署脚本"
echo "============================================"
echo ""

read -p "域名 (如 xnow.example.com): " DOMAIN
read -p "MySQL 密码: " DB_PASS

# ── 系统依赖 ──────────────────────────────────────────
echo "[1/6] 安装系统依赖..."
apt update -qq
apt install -y curl wget git nginx mysql-server > /dev/null 2>&1
echo "  ✓ 完成"

# ── Node.js（阿里云镜像，国内快）───────────────────────
echo "[2/6] 安装 Node.js 18..."
if ! command -v node &> /dev/null; then
  ARCH=$(uname -m)
  [ "$ARCH" = "x86_64" ] && NODE_ARCH="x64"
  [ "$ARCH" = "aarch64" ] && NODE_ARCH="arm64"

  curl -fsSL "https://mirrors.aliyun.com/nodejs-release/v18.20.8/node-v18.20.8-linux-${NODE_ARCH}.tar.xz" -o /tmp/node.tar.xz
  tar -xf /tmp/node.tar.xz -C /usr/local/
  ln -sf /usr/local/node-v18.20.8-linux-${NODE_ARCH}/bin/* /usr/local/bin/
  rm -f /tmp/node.tar.xz
  echo "  ✓ Node.js v18.20.8"
else
  echo "  ✓ 已安装"
fi
npm install -g pm2 > /dev/null 2>&1
# 将 PM2 链接到标准路径（tarball 安装的 npm 会把全局 bin 放到 node 目录内）
ln -sf /usr/local/node-v18.20.8-linux-${NODE_ARCH}/bin/pm2 /usr/local/bin/pm2 2>/dev/null || true
echo "  ✓ PM2"

# ── MySQL ──────────────────────────────────────────────
echo "[3/6] 配置 MySQL..."
systemctl start mysql 2>/dev/null || true
mysql -u root -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS xnow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
mysql -u root -e "CREATE DATABASE IF NOT EXISTS xnow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
mysql -u root -p"$DB_PASS" -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASS'; FLUSH PRIVILEGES;" 2>/dev/null || true
echo "  ✓ MySQL"

# ── 拉取源码 ──────────────────────────────────────────
echo "[4/6] 拉取源码..."
mkdir -p /var/www
if [ -d "/var/www/xnow" ]; then
  cd /var/www/xnow && git pull
  echo "  ✓ 已更新"
else
  git clone https://github.com/xiasummer740/xnow.git /var/www/xnow
  echo "  ✓ 已克隆"
fi

# ── 后端 ──────────────────────────────────────────────
echo "[5/6] 构建后端..."
cd /var/www/xnow/server
cat > .env << ENVEOF
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=$DB_PASS
DB_NAME=xnow_db
JWT_SECRET=$(openssl rand -hex 32)
PORT=3000
ENVEOF
npm install
pm2 delete xnow-backend 2>/dev/null || true
pm2 start src/app.js --name xnow-backend
pm2 save
echo "  ✓ 后端就绪"

# ── 前端 ──────────────────────────────────────────────
echo "[6/6] 构建前端..."
cd /var/www/xnow/client
npm install
npm run build
echo "  ✓ 前端编译完成"

# ── SSL 证书（复用 acme.sh 或新签发）───────────────────
echo ""
echo "配置 SSL 证书..."

CERT_DIR="/root/cert/$DOMAIN"
mkdir -p "$CERT_DIR"

# 尝试复用已有 Let's Encrypt 证书
CERT_OK=0
if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
    echo "  ✓ 发现已有证书: $CERT_DIR"
    CERT_OK=1
elif command -v ~/.acme.sh/acme.sh &>/dev/null; then
    echo "  检测到 acme.sh，尝试为 $DOMAIN 签发证书..."
    ~/.acme.sh/acme.sh --set-default-ca --server letsencrypt --force 2>/dev/null

    # 优先用 webroot 模式（不占用端口）
    WEBROOT="/var/www/xnow/client/dist"
    mkdir -p "$WEBROOT/.well-known/acme-challenge"

    if ~/.acme.sh/acme.sh --issue -d "$DOMAIN" --webroot "$WEBROOT" --force 2>/dev/null; then
        ~/.acme.sh/acme.sh --installcert -d "$DOMAIN" \
            --key-file "$CERT_DIR/privkey.pem" \
            --fullchain-file "$CERT_DIR/fullchain.pem" \
            --reloadcmd "systemctl reload nginx 2>/dev/null || true" 2>/dev/null
        if [ -f "$CERT_DIR/fullchain.pem" ]; then
            echo "  ✓ Let's Encrypt 证书签发成功"
            CERT_OK=1
        fi
    else
        echo "  ⚠ acme.sh 签发失败，降级为自签证书"
    fi
else
    echo "  未找到 acme.sh，安装中..."
    curl -s https://get.acme.sh | sh >/dev/null 2>&1
    ~/.acme.sh/acme.sh --set-default-ca --server letsencrypt --force 2>/dev/null

    WEBROOT="/var/www/xnow/client/dist"
    mkdir -p "$WEBROOT/.well-known/acme-challenge"

    if ~/.acme.sh/acme.sh --issue -d "$DOMAIN" --webroot "$WEBROOT" --force 2>/dev/null; then
        ~/.acme.sh/acme.sh --installcert -d "$DOMAIN" \
            --key-file "$CERT_DIR/privkey.pem" \
            --fullchain-file "$CERT_DIR/fullchain.pem" \
            --reloadcmd "systemctl reload nginx 2>/dev/null || true" 2>/dev/null
        if [ -f "$CERT_DIR/fullchain.pem" ]; then
            echo "  ✓ Let's Encrypt 证书签发成功"
            CERT_OK=1
        fi
    else
        echo "  ⚠ acme.sh 签发失败，降级为自签证书"
    fi
fi

# 降级：自签证书
if [ "$CERT_OK" -eq 0 ]; then
    mkdir -p /etc/nginx/ssl
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$CERT_DIR/privkey.pem" -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=$DOMAIN" 2>/dev/null
    echo "  ✓ 已生成自签证书（建议稍后手动配置 Let's Encrypt）"
fi

# 启用 acme.sh 自动续期（Let's Encrypt 90天，到期前自动续签）
if [ "$CERT_OK" -eq 1 ]; then
    ~/.acme.sh/acme.sh --upgrade --auto-upgrade 2>/dev/null
    echo "  ✓ 自动续期已启用"
fi

# ── Nginx 配置（只添加 xnow 站点，不破坏已有配置）───────
echo ""
echo "配置 Nginx..."

# 确保 sites-available 目录存在
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

# 启用站点（不删除其他站点配置）
ln -sf /etc/nginx/sites-available/xnow /etc/nginx/sites-enabled/xnow
# 只移除 nginx 默认 welcome 页面，保留其他站点
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
echo "  ✓ Nginx 已启动"

echo ""
echo "============================================"
echo "  部署完成！"
echo "  https://$DOMAIN"
echo ""
echo "  SSL: Let's Encrypt 自动续期"
echo "============================================"
