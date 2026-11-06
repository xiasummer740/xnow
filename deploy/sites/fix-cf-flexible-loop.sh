#!/bin/bash
# ============================================================================
# 2026-11-03 应急：Cloudflare 被切成 Flexible（CF→源站走 80）后，
# 「:80 无条件 301 到 https」与「浏览器 → CF 走 https」形成无限跳转 → 全站打不开。
#
# 做法：:80 收到「原始访客是 https」的请求（CF 会带 X-Forwarded-Proto: https）时，
#       本地转发给 127.0.0.1:443（完整配置都在那边），内容原样返回；
#       直连 http 的访客照旧 301（行为不变）。
#
# 顺带保住真实客户端 IP：:80 先用 CF 网段白名单还原真实 IP，再把还原结果通过
# CF-Connecting-IP 传给本地 443；443 侧信任 127.0.0.1（新增一行）。
#
# 正式修法仍是：Cloudflare → SSL/TLS → Overview → 改回 Full。改回后本补丁无害。
# ============================================================================
set -euo pipefail
NG=/etc/nginx
STAMP=$(date +%Y%m%d-%H%M%S)
BK=/root/xnow-rollback-cf-flexible-$STAMP

echo "== 1) 备份 =="
mkdir -p "$BK/sites-enabled" "$BK/snippets"
cp -a $NG/sites-enabled/. "$BK/sites-enabled/"
cp -a $NG/snippets/. "$BK/snippets/" 2>/dev/null || true
nginx -T > "$BK/nginx-T.txt" 2>&1 || true
echo "   备份目录: $BK"

echo "== 2) 写 CF 真实 IP 片段（给 80 段用）=="
cat > $NG/snippets/xnow-cf-realip.conf <<'EOF'
# Cloudflare 真实客户端 IP 还原（80 段专用，配 xnow-cf-flex-serve 使用）
# 2026-11-03 新增：CF 若以 Flexible 模式回源，连接走 80，没有这段的话
# $remote_addr 全是 CF 边缘 IP，注册限流/黑名单/日志会一起失真。
set_real_ip_from 127.0.0.1;
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
EOF
echo "   已写 $NG/snippets/xnow-cf-realip.conf"

echo "== 3) 给所有「80 端口 301」的 vhost 打补丁 =="
python3 - "$BK" <<'PY'
import os, re, sys, glob
bk = sys.argv[1]
OLD = """    location / {
        return 301 https://$host$request_uri;
    }"""
NEW = """    # 🔴 2026-11-03 应急（CF 切成 Flexible 后 301 死循环）：
    #    带 CF-Connecting-IP（= 一定是 CF 回源）→ 本地转发到 443 拿真实内容；
    #    真·直连 http 的访客 → 仍然 301（行为不变）。
    #    ⚠️ 判据别写成 X-Forwarded-Proto：CF 有些边缘回源时不发这个头，
    #       会误判成直连访客又走 301，循环照旧（12:55 日志里那条 301 就是）。
    #    正式修法：Cloudflare → SSL/TLS → Overview → 改回 Full。
    location / {
        if ($http_cf_connecting_ip = "") {
            return 418;
        }
        proxy_pass https://127.0.0.1:443;
        proxy_ssl_server_name on;
        proxy_ssl_verify off;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection "";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        # 把本段还原出的真实客户端 IP 传给本地 443（443 侧信任 127.0.0.1）
        proxy_set_header CF-Connecting-IP $remote_addr;
        proxy_read_timeout 300s;
    }
    error_page 418 = @xnow_force_https;
    location @xnow_force_https {
        return 301 https://$host$request_uri;
    }"""
patched = []
for f in glob.glob('/etc/nginx/sites-enabled/*'):
    if not os.path.isfile(f):
        continue
    s = open(f, encoding='utf-8').read()
    if OLD not in s:
        continue
    s2 = s.replace(OLD, NEW)
    # 只在 80 的 server 块里补 include：给每个含 listen 80 的块加上 include（幂等）
    s2 = re.sub(r'(listen 80[^\n]*;\n)(?!\s*include /etc/nginx/snippets/xnow-cf-realip)',
                r'\1    include /etc/nginx/snippets/xnow-cf-realip.conf;\n', s2, count=0)
    open(f, 'w', encoding='utf-8').write(s2)
    patched.append(os.path.basename(f))
print('   已打补丁:', ', '.join(patched) if patched else '(没找到匹配的，检查是否已经打过)')
PY

echo "== 4) 443 侧信任 127.0.0.1（否则本地转发会把真实 IP 丢掉）=="
for f in /etc/nginx/sites-enabled/xnow-spa-https /etc/nginx/sites-enabled/xnow-site-1-7h2d5u.taikon.top; do
  if grep -q "set_real_ip_from 127.0.0.1;" "$f"; then
    echo "   跳过（已有）: $(basename $f)"
  elif grep -q "real_ip_header CF-Connecting-IP;" "$f"; then
    sed -i 's/^\(\s*\)real_ip_header CF-Connecting-IP;/\1set_real_ip_from 127.0.0.1;\n\1real_ip_header CF-Connecting-IP;/' "$f"
    echo "   已插入: $(basename $f)"
  else
    echo "   ⚠️ $(basename $f) 没有 real_ip_header，跳过（IP 会退化成 CF 边缘地址）"
  fi
done

echo "== 5) nginx -t =="
if nginx -t 2>&1 | tail -3; then
  echo "   语法通过"
else
  echo "   ❌ 语法失败，立刻回滚"
  cp -a "$BK/sites-enabled/." $NG/sites-enabled/
  cp -a "$BK/snippets/." $NG/snippets/
  nginx -t 2>&1 | tail -3
  exit 1
fi

echo "== 6) reload =="
systemctl reload nginx
sleep 1
systemctl is-active nginx | sed 's/^/   nginx: /'

echo "== 7) 本机验证 =="
echo -n "   :80 无 XFP（直连 http，应 301）-> "
curl -sk -o /dev/null -m 10 -w '%{http_code}\n' -H 'Host: xnow.taikon.top' http://127.0.0.1/
echo -n "   :80 带 XFP=https（CF 回源，应 200 + 页面）-> "
curl -sk -o /tmp/flexpage.html -m 20 -w '%{http_code} ' -H 'Host: xnow.taikon.top' -H 'X-Forwarded-Proto: https' -H 'CF-Connecting-IP: 203.0.113.9' http://127.0.0.1/
grep -o '<title>[^<]*</title>' /tmp/flexpage.html | head -1
echo -n "   :80 带 XFP=https 取静态资源 -> "
curl -sk -o /dev/null -m 15 -w '%{http_code}\n' -H 'Host: xnow.taikon.top' -H 'X-Forwarded-Proto: https' http://127.0.0.1/assets/index-DQ6nfFrD.js
echo -n "   :80 带 XFP=https 调接口 -> "
curl -sk -o /dev/null -m 15 -w '%{http_code}\n' -H 'Host: xnow.taikon.top' -H 'X-Forwarded-Proto: https' http://127.0.0.1/api/public/config
echo -n "   分站 :80 带 XFP=https -> "
curl -sk -o /tmp/flexsub.html -m 20 -w '%{http_code} ' -H 'Host: 7h2d5u.taikon.top' -H 'X-Forwarded-Proto: https' http://127.0.0.1/
grep -o '<title>[^<]*</title>' /tmp/flexsub.html | head -1
rm -f /tmp/flexpage.html /tmp/flexsub.html
echo
echo "完成。回滚：cp -a $BK/sites-enabled/. $NG/sites-enabled/ && cp -a $BK/snippets/. $NG/snippets/ && nginx -t && systemctl reload nginx"
