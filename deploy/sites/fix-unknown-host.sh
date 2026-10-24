#!/bin/bash
# ============================================================================
# XNOW：堵住"未知子域名落到 Beta 实例"的坑（70 期编写，**尚未执行**）
#
# 问题：
#   /etc/nginx/sites-enabled/xnow-beta 里写着
#       server_name beta.xnow.taikon.top beta.taikon.top *.xnow.taikon.top;
#   那个 *.xnow.taikon.top 通配会接住**任何没有自己 vhost 的免费子域名**。
#   实测 zzz-none.xnow.taikon.top 返回的是 Beta 的平台首页（也就是 Beta 的库）。
#   生产分站的 vhost 万一生成失败，客户就会落到 Beta 库上 —— 订单与余额直接串库。
#
# 修法（两步）：
#   ① 把通配从 xnow-beta 的 server_name 里去掉；
#   ② 给 443 补一个 default_server 兜底块：未知域名统一 404，并把连接直接关掉（444），
#      而不是让 nginx 用"加载顺序里的第一个 server 块"（那就是 Beta）。
#
# 安全性：只影响**未知 Host**。所有已有域名（xnow.taikon.top / 各分站自有域名 /
#         beta.xnow.taikon.top 本身）都是精确 server_name，行为完全不变。
#         改前会备份到备份目录，回滚一条命令。
# ============================================================================
set -uo pipefail
TS=$(date +%Y%m%d-%H%M%S)
BAK=${XNOW_BACKUP_DIR:-/var/backups/xnow}/nginx-$TS
BETAFILE=/etc/nginx/sites-enabled/xnow-beta
GUARD=/etc/nginx/sites-enabled/xnow-unknown-host

step() { echo ""; echo "──── $* ────"; }

step "1. 备份 nginx 配置"
mkdir -p "$BAK" || { echo "❌ 备份目录建不出来"; exit 1; }
tar czf "$BAK/sites-enabled.tgz" -C /etc/nginx sites-enabled 2>/dev/null && echo "  ✅ $BAK/sites-enabled.tgz"

step "2. 记录改前行为（用于对比）"
probe() {
  local h=$1
  local code
  code=$(curl -o /tmp/probe.html -sk -w "%{http_code}" --max-time 15 --resolve "$h:443:127.0.0.1" "https://$h/" 2>/dev/null || echo 000)
  local title
  title=$(grep -o '<title>[^<]*' /tmp/probe.html 2>/dev/null | head -1 | sed 's/<title>//')
  echo "  $h → $code ${title:+| $title}"
}
echo "  改前:"
for h in xnow.taikon.top beta.xnow.taikon.top demostore.taikon.top zzz-none.xnow.taikon.top; do probe "$h"; done

step "3. 去掉 xnow-beta 里的通配"
if grep -q '\*\.xnow\.taikon\.top' "$BETAFILE"; then
  sed -i 's/ \*\.xnow\.taikon\.top;//' "$BETAFILE"
  echo "  已改: $(grep -m1 'server_name' "$BETAFILE" | sed 's/^ *//')"
else
  echo "  没有通配，跳过"
fi

step "4. 加 443 的 default_server 兜底（未知域名 404，不让它落到任何真实站点）"
cat > "$GUARD" <<'GUARDCONF'
# 70 期：未知域名兜底。没有这一块时，nginx 会用"加载顺序里第一个 443 server 块"
# 接住未知 Host —— 那正好是 Beta 测试环境的配置，等于把 Beta 库暴露给任何人。
# 这里直接返回 404 并声明 noindex，不暴露任何站点内容。
server {
    listen 443 ssl http2 default_server;
    server_name _;

    ssl_certificate     /etc/nginx/ssl/xnow.crt;
    ssl_certificate_key /etc/nginx/ssl/xnow.key;

    add_header X-Robots-Tag "noindex, nofollow" always;
    return 404;
}
GUARDCONF
echo "  已写 $GUARD"

step "5. 校验 + 重载（失败自动回滚）"
if nginx -t 2>&1 | grep -q successful; then
  nginx -s reload 2>/dev/null && echo "  ✅ 已重载"
else
  echo "  ❌ 配置校验失败，回滚"
  nginx -t 2>&1 | tail -3 | sed 's/^/     /'
  rm -f "$GUARD"
  tar xzf "$BAK/sites-enabled.tgz" -C /etc/nginx
  nginx -s reload 2>/dev/null
  echo "  已恢复到改前状态"
  exit 1
fi

step "6. 改后核对（已有域名必须一个都没变）"
echo "  改后:"
for h in xnow.taikon.top beta.xnow.taikon.top demostore.taikon.top laozhang.taikon.top zzz-none.xnow.taikon.top; do probe "$h"; done

echo ""
echo "  期望：前 4 个与改前完全一致（200 + 原标题）；"
echo "        最后一个（未知子域名）从「200 + 平台首页」变成 404 —— 这就是修复点。"

echo ""
echo "回滚: tar xzf $BAK/sites-enabled.tgz -C /etc/nginx && nginx -s reload"
