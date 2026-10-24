#!/bin/bash
# ============================================================================
# 74 期：让「自有域名首次签证书」真的能过
# ----------------------------------------------------------------------------
# 问题（实测发现的）：
#   所有 vhost（含全局默认）的 80 段都是无条件 `return 301 https://...`。
#   而一个新域名刚绑上来时只有自签证书，Let's Encrypt 的 HTTP-01 校验去取
#   http://域名/.well-known/acme-challenge/xxx → 被 301 到 HTTPS → 自签证书
#   → 校验失败 → 证书签不下来 → 退回自签 → 站长看到"浏览器不安全"。
#
# 这个脚本做两件事（可重复执行）：
#   ① 建一个专用 ACME webroot：/var/www/acme-challenge（与 install.sh 同名）
#   ② 把全局默认的 80 段改成"先放行 /.well-known/acme-challenge/，其余才跳转"
#      —— 注意 nginx 的坑：写在 server 层的 return 在 rewrite 阶段就执行了，
#         location 里的例外轮不到，所以跳转必须放进 location /。
#
# 用法：bash deploy/sites/fix-acme-webroot.sh
# 安全：改动前备份；nginx -t 不过自动还原；只动 xnow-http-redirect 这一个文件。
# ============================================================================
set -uo pipefail

NGX=/etc/nginx/sites-enabled
TARGET="$NGX/xnow-http-redirect"
ACME=/var/www/acme-challenge
TS=$(date +%Y%m%d-%H%M%S)
BAK=${XNOW_BACKUP_DIR:-/var/backups/xnow}/nginx-$TS

mkdir -p "$BAK" || { echo "❌ 备份目录建不出来"; exit 1; }

echo "──── 1. 专用 ACME webroot ────"
mkdir -p "$ACME/.well-known/acme-challenge" || { echo "❌ 建不了 $ACME"; exit 1; }
chmod 755 "$ACME" "$ACME/.well-known" "$ACME/.well-known/acme-challenge"
echo "  ✅ $ACME/.well-known/acme-challenge"

echo ""
echo "──── 2. 全局默认 80 段 ────"
if [ -f "$TARGET" ]; then
  cp "$TARGET" "$BAK/xnow-http-redirect.before" && echo "  已备份 → $BAK/xnow-http-redirect.before"
else
  echo "  ⚠️ 没有 $TARGET，将新建一个"
fi

if grep -q "root $ACME;" "$TARGET" 2>/dev/null && grep -q 'default_server' "$TARGET" 2>/dev/null; then
  echo "  已经指向 $ACME 且是默认 server，跳过改写（幂等）"
  CHANGED=0
else
  cat > "$TARGET" <<'CONF'
# 由 deploy/sites/fix-acme-webroot.sh 写入（74 期）
# 默认 server：只放行证书挑战，其余一律跳 HTTPS。
# ⚠️ 跳转必须是 location / 而不是 server 层 return —— 否则挑战请求会被先 301 走，
#    新域名（此时只有自签证书）永远签不下正式证书。
server {
    listen 80 default_server;
    server_name _;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/acme-challenge;
        try_files $uri =404;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
CONF
  echo "  已改写 → $TARGET"
  CHANGED=1
fi

echo ""
echo "──── 3. 校验并重载 ────"
if nginx -t >/dev/null 2>&1; then
  echo "  ✅ nginx -t 通过"
  nginx -s reload && echo "  ✅ 已 reload" || echo "  ⚠️ reload 失败"
else
  echo "  ❌ nginx -t 不通过，正在还原"
  nginx -t 2>&1 | tail -3 | sed 's/^/     /'
  [ -f "$BAK/xnow-http-redirect.before" ] && cp "$BAK/xnow-http-redirect.before" "$TARGET"
  exit 1
fi

echo ""
echo "──── 4. 自检（挑战路径应通、普通路径应跳转）────"
echo "  挑战路径（不存在时应是 404，绝不能是 301）: $(curl -o /dev/null -sS -w '%{http_code}' --max-time 8 -H 'Host: some-new-domain.test' http://127.0.0.1/.well-known/acme-challenge/__probe 2>/dev/null)"
echo "  普通路径（应是 301）: $(curl -o /dev/null -sS -w '%{http_code}' --max-time 8 -H 'Host: some-new-domain.test' http://127.0.0.1/ 2>/dev/null)"
echo "  主站（不受影响，应是 200）: $(curl -o /dev/null -sS -w '%{http_code}' --max-time 15 https://xnow.taikon.top/ 2>/dev/null)"
echo ""
echo "备份在 $BAK"
