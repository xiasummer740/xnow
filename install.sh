#!/bin/bash

# -----------------------------------------------------------
# XNOW Ultimate Automated Deployment Engine
# Compatible with Cloudflare (Orange Cloud) & Multi-Panels
# Built-in Bulletproof MySQL Initialization & Clean Restart
# -----------------------------------------------------------

echo -e "\n🚀 欢迎使用 XNOW 全自动裸机部署引擎\n"
read -p "👉 请输入您的网站域名 (如 xnow.example.com): " DOMAIN
read -p "👉 请设置一个安全的 MySQL 数据库密码: " DB_PASS

echo "⏳ 正在初始化环境，这可能需要几分钟..."
apt update >/dev/null 2>&1
apt install -y curl wget git nginx certbot python3-certbot-nginx mysql-server >/dev/null 2>&1

echo "📦 正在部署 Node.js 与 PM2 进程守护..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash - >/dev/null 2>&1
apt install -y nodejs >/dev/null 2>&1
npm install -g pm2 >/dev/null 2>&1

echo "🗄️ 正在装配 MySQL 数据库引擎..."
systemctl start mysql

# 💡 核心防线：双重容错注入机制。涵盖首次纯净部署与二次覆盖部署
sudo mysql -e "CREATE DATABASE IF NOT EXISTS xnow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || mysql -u root -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS xnow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASS'; FLUSH PRIVILEGES;" 2>/dev/null || mysql -u root -p"$DB_PASS" -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASS'; FLUSH PRIVILEGES;" 2>/dev/null

echo "⚙️ 正在构建后端服务基石..."
cd /var/www/xnow/server
cat << ENV_EOF > .env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=$DB_PASS
DB_NAME=xnow_db
JWT_SECRET=$(openssl rand -hex 32)
PORT=3000
ENV_EOF
npm install >/dev/null 2>&1
pm2 start src/app.js --name xnow-backend >/dev/null 2>&1
pm2 save >/dev/null 2>&1
pm2 startup >/dev/null 2>&1

echo "🎨 正在触发 Vite 极速超融合前端编译..."
cd /var/www/xnow/client
npm install >/dev/null 2>&1
npm run build >/dev/null 2>&1

echo "🛡️ 正在配置混合型双轨 SSL 证书防御体系..."
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/$DOMAIN.key -out /etc/nginx/ssl/$DOMAIN.crt \
  -subj "/C=US/ST=CA/L=City/O=XNOW/CN=$DOMAIN" 2>/dev/null

cat << NGINX_TMP > /etc/nginx/sites-available/$DOMAIN
server { listen 80; server_name $DOMAIN; root /var/www/xnow/client/dist; }
NGINX_TMP
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# 💡 核心修复：重载 systemd 守护进程，消除警告
systemctl daemon-reload
systemctl restart nginx

certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN 2>/dev/null

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    SSL_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    SSL_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
else
    SSL_CERT="/etc/nginx/ssl/$DOMAIN.crt"
    SSL_KEY="/etc/nginx/ssl/$DOMAIN.key"
fi

cat << NGINX_FINAL > /etc/nginx/sites-available/$DOMAIN
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;

    client_max_body_size 100M;

    location / {
        root /var/www/xnow/client/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_FINAL

# 💡 核心修复：重载 systemd 守护进程，消除警告
systemctl daemon-reload
systemctl restart nginx

echo -e "\n🎉 XNOW 系统部署完毕！"
echo "------------------------------------------------------"
echo "🌐 访问地址: https://$DOMAIN"
echo "⚠️  若您在 Cloudflare 开启了小黄云(Proxy)，请确保其 SSL/TLS 加密模式设置为 【Full (完全)】，切勿使用 Strict(严格)！"
echo "------------------------------------------------------"
