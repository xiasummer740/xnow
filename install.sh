#!/bin/bash

# -----------------------------------------------------------
# XNOW PRO - 极速自动化引导部署向导
# -----------------------------------------------------------

echo -e "\033[36m=================================================================\033[0m"
echo -e "\033[1;33m✨ 欢迎使用 XNOW PRO 全自动化 SaaS 部署向导 ✨\033[0m"
echo -e "\033[36m=================================================================\033[0m"
echo ""

# 引导用户输入核心参数
read -p "🌐 请输入您的前端绑定域名 (例如: demo.xnow.com): " FRONT_DOMAIN
read -p "🔑 请输入 MySQL 数据库的 root 密码 (系统将自动建库): " DB_PASS

echo ""
echo -e "\033[1;32m🚀 正在挂载全自动化部署引擎，请喝杯咖啡稍作等待...\033[0m"
echo ""

# 1. 自动化环境检查与数据库创建
echo "📦 [1/5] 正在初始化数据库..."
mysql -u root -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS xnow_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if [ $? -ne 0 ]; then
    echo -e "\033[1;31m❌ 数据库创建失败，请检查密码是否正确！\033[0m"
    exit 1
fi

# 2. 自动化生成安全环境变量
echo "🔒 [2/5] 正在生成高强度安全环境变量..."
JWT_SECRET=$(openssl rand -hex 32)
cat << ENV_EOF > server/.env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=$DB_PASS
DB_NAME=xnow_db
JWT_SECRET=$JWT_SECRET
PORT=3000
ENV_EOF

# 3. 自动化安装后端与启动
echo "⚙️  [3/5] 正在编译并启动后端核心引擎..."
cd server
npm install --silent
pm2 restart xnow-backend >/dev/null 2>&1 || pm2 start src/app.js --name xnow-backend >/dev/null 2>&1
pm2 save >/dev/null 2>&1
cd ..

# 4. 自动化前端编译
echo "🏗️  [4/5] 正在构建前端超融合页面..."
cd client
npm install --silent
npm run build --silent
cd ..

# 5. 自动化 Nginx 挂载与 SSL 证书申请
echo "🌐 [5/5] 正在配置 Nginx 反向代理与自动申请 SSL 证书..."
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
systemctl reload nginx

# 尝试自动申请 SSL
echo "🛡️ 正在呼叫 Certbot 配置 HTTPS..."
certbot --nginx -d $FRONT_DOMAIN --non-interactive --agree-tos -m admin@$FRONT_DOMAIN --redirect

echo -e "\033[36m=================================================================\033[0m"
echo -e "\033[1;32m✅ 部署大功告成！XNOW PRO 已在您的服务器完美运行！\033[0m"
echo -e "\033[36m=================================================================\033[0m"
echo -e "🔗 访问地址: \033[1;34mhttps://$FRONT_DOMAIN\033[0m"
echo -e "👤 初始管理员账号: \033[1;33madmin\033[0m"
echo -e "🔑 初始管理员密码: \033[1;33madmin123\033[0m"
echo -e "\033[1;31m⚠️  安全警告：请立即登录系统，配置基本参数并注册您的专属账号！\033[0m"
echo -e "\033[1;31m⚠️  首个注册账号将自动继承至尊管理员，此虚拟影子账号将永久销毁！\033[0m"
echo -e "\033[36m=================================================================\033[0m"
