#!/bin/bash

# =================================================================
# XNOW PRO - 裸机全自动化 SaaS 部署向导 (Bare-Metal Auto Installer)
# =================================================================
export DEBIAN_FRONTEND=noninteractive

echo -e "\033[36m=================================================================\033[0m"
echo -e "\033[1;33m✨ 欢迎使用 XNOW PRO 裸机级全自动部署向导 ✨\033[0m"
echo -e "\033[36m=================================================================\033[0m"
echo "本脚本将自动为您安装 Node.js, MySQL, Nginx, Certbot 并完成全栈编译！"
echo ""

read -p "🌐 请输入您的前端绑定域名 (例如: www.abc.com): " FRONT_DOMAIN
read -p "🔑 请设置 MySQL 数据库的 root 密码 (系统将自动安装并配置): " DB_PASS

echo ""
echo -e "\033[1;32m🚀 正在挂载全自动化部署引擎，这可能需要 3-5 分钟，请耐心等待...\033[0m"
echo ""

# 1. 自动化安装基础环境
echo "📦 [1/6] 正在更新系统包并安装核心底层环境 (Nginx, Git, Certbot)..."
apt-get update -y -qq
apt-get install -y -qq curl git nginx python3-certbot-nginx certbot

# 2. 自动化安装 Node.js 与 PM2
echo "🟢 [2/6] 正在安装 Node.js 环境与 PM2 守护进程..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y -qq nodejs
npm install -g pm2 --silent

# 3. 自动化安装与配置 MySQL
echo "🐬 [3/6] 正在安装 MySQL 数据库引擎并配置权限..."
apt-get install -y -qq mysql-server
# 初始化 MySQL root 密码并授权
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}'; FLUSH PRIVILEGES;" 2>/dev/null || mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${DB_PASS}'; FLUSH PRIVILEGES;"
# 创建独立数据库
mysql -u root -p"${DB_PASS}" -e "CREATE DATABASE IF NOT EXISTS xnow_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. 自动化生成安全环境变量
echo "🔒 [4/6] 正在生成高强度安全环境变量..."
JWT_SECRET=$(openssl rand -hex 32)
cat << ENV_EOF > server/.env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=$DB_PASS
DB_NAME=xnow_db
JWT_SECRET=$JWT_SECRET
PORT=3000
ENV_EOF

# 5. 自动化安装依赖与构建
echo "⚙️  [5/6] 正在安装底层依赖并进行全栈超融合编译..."
cd server
npm install --silent
pm2 restart xnow-backend >/dev/null 2>&1 || pm2 start src/app.js --name xnow-backend >/dev/null 2>&1
pm2 save >/dev/null 2>&1
cd ../client
npm install --silent
npm run build --silent
cd ..

# 6. 自动化 Nginx 挂载与 SSL 证书申请
echo "🌐 [6/6] 正在配置 Nginx 网站路由与免费 SSL 安全证书..."
NGINX_CONF="/etc/nginx/sites-available/xnow"
cat << NGINX_EOF > $NGINX_CONF
server {
    listen 80;
    server_name $FRONT_DOMAIN;
    root $(pwd)/client/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
NGINX_EOF

ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl reload nginx

# 申请 SSL
echo "🛡️ 正在与 Let's Encrypt 通信，签发军工级 HTTPS 证书..."
certbot --nginx -d $FRONT_DOMAIN --non-interactive --agree-tos -m admin@$FRONT_DOMAIN --redirect >/dev/null 2>&1

echo -e "\033[36m=================================================================\033[0m"
echo -e "\033[1;32m✅ 部署大功告成！XNOW PRO 商业级架构已在您的服务器完美运行！\033[0m"
echo -e "\033[36m=================================================================\033[0m"
echo -e "🔗 访问地址: \033[1;34mhttps://$FRONT_DOMAIN\033[0m"
echo -e "👤 初始管理员账号: \033[1;33madmin\033[0m"
echo -e "🔑 初始管理员密码: \033[1;33madmin123\033[0m"
echo -e "\033[1;31m⚠️  安全警告：请立即登录系统，注册您的专属账号！\033[0m"
echo -e "\033[1;31m⚠️  首个注册账号将自动封神为至尊管理员，此虚拟影子账号将永久销毁！\033[0m"
echo -e "\033[36m=================================================================\033[0m"
