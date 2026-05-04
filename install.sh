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

# ── Nginx ─────────────────────────────────────────────
echo ""
echo "配置 Nginx..."
rm -rf /etc/nginx/sites-enabled/*
rm -f /etc/nginx/sites-available/xnow

cat > /etc/nginx/sites-available/xnow << NGXEOF
server {
    listen 80;
    server_name $DOMAIN;

    root /var/www/xnow/client/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

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
}
NGXEOF

ln -sf /etc/nginx/sites-available/xnow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl daemon-reload
systemctl restart nginx
echo "  ✓ Nginx 已启动"

echo ""
echo "============================================"
echo "  部署完成！"
echo "  http://$DOMAIN"
echo ""
echo "  Cloudflare SSL 设为 Flexible（灵活）"
echo "============================================"
