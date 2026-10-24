#!/bin/bash
# ============================================================================
# XNOW：未知子域名兜底（95 期）
#
# 解决什么问题：
#   *.taikon.top 是泛解析。任何没有自己 vhost 的子域名，以前会落到 nginx 的
#   「默认 server」→ 访客看到主站首页。实测 fresh-never-visited-95.taikon.top
#   返回主站，页面里 19 处 XNOW —— 分站改名/过期/被删之后，客户收藏的旧域名
#   会跳到平台主站，等于把平台暴露在分站客户面前（红线）。
#
# 另外一条更危险的老坑（70 期记录、一直没执行）：
#   xnow-beta 的 server_name 里有 *.xnow.taikon.top，未知的 xnow 子域名会落到
#   **Beta 实例**，那是另一个数据库 —— 订单和余额会和生产串库。
#
# 本脚本做三件事（全部只影响「未知 Host」）：
#   ① 安装兜底 vhost：80/443 上 *.taikon.top 与 *.xnow.taikon.top 一律中性 404；
#   ② 去掉 xnow-beta 里的 *.xnow.taikon.top 通配（让兜底生效）；
#   ③ nginx -t + reload，并实测未知域名返回 404、已知域名仍然 200。
#
# 为什么不是 default_server：
#   nginx 匹配优先级 = 精确 > 最长通配 > default_server。
#   用通配只影响没有站点占用的子域名；主站与每个分站的精确 vhost 完全不动。
#
# 回滚（一条命令）：
#   cp -a "$BAK/sites-enabled" /etc/nginx/ && nginx -s reload
# ============================================================================
set -uo pipefail

TS=$(date +%Y%m%d-%H%M%S)
BAK=${XNOW_BACKUP_DIR:-/var/backups/xnow}/nginx-catchall-$TS
SRC=${XNOW_APP_DIR:-/var/www/xnow}
CONF="$SRC/deploy/sites/nginx-catchall.conf"
DEST=/etc/nginx/sites-enabled/xnow-catchall
BETA=/etc/nginx/sites-enabled/xnow-beta

step() { echo ""; echo "──── $* ────"; }
die()  { echo "❌ $*"; echo "   备份在 $BAK（回滚：cp -a \$BAK/sites-enabled /etc/nginx/ && nginx -s reload）"; exit 1; }

step "1. 备份 nginx 配置"
mkdir -p "$BAK" || die "备份目录建不出来"
tar czf "$BAK/sites-enabled.tgz" -C /etc/nginx sites-enabled 2>/dev/null && echo "  ✅ $BAK/sites-enabled.tgz"

step "2. 安装兜底 vhost"
[ -f "$CONF" ] || die "找不到配置文件 $CONF（代码没拉全？）"
cp "$CONF" "$DEST" || die "写入 $DEST 失败"
echo "  ✅ 已写入 $DEST"

step "3. 去掉 Beta 的跨库通配 *.xnow.taikon.top"
if grep -q '\*\.xnow\.taikon\.top' "$BETA" 2>/dev/null; then
  cp "$BETA" "$BAK/xnow-beta.before"
  sed -i 's/[[:space:]]*\*\.xnow\.taikon\.top//g' "$BETA"
  echo "  ✅ 已去掉（Beta 只保留精确的 beta.xnow.taikon.top / beta.taikon.top）"
else
  echo "  ✓ 已经没有这个通配了，跳过"
fi

step "4. 校验 + 重载"
nginx -t 2>&1 | tail -2
nginx -t >/dev/null 2>&1 || die "nginx 配置校验失败，未重载（线上仍是旧配置，没有风险）"
systemctl reload nginx || die "reload 失败"
sleep 2
echo "  ✅ 已重载"

step "5. 实测（未知域名必须 404，已知域名必须 200）"
fail=0
probe() {
  local h=$1 want=$2
  local code title
  code=$(curl -s -o /tmp/catchall-probe.html -k -w "%{http_code}" --max-time 15 \
         --resolve "$h:443:127.0.0.1" "https://$h/" 2>/dev/null)
  title=$(grep -o '<title>[^<]*' /tmp/catchall-probe.html 2>/dev/null | head -1 | sed 's/<title>//')
  printf "  %-40s %s %s\n" "$h" "$code" "${title:+| $title}"
  if [ "$code" != "$want" ]; then echo "     ⚠️ 期望 $want，实际 $code"; fail=1; fi
}
probe "xnow.taikon.top" 200
probe "zz-unknown-$$.taikon.top" 404
probe "zz-unknown-$$.xnow.taikon.top" 404
for d in $(ls /etc/nginx/sites-enabled/ | sed -n 's/^xnow-site-[0-9]*-\(.*\)$/\1/p'); do
  probe "$d" 200
done

echo ""
if [ "$fail" = "0" ]; then
  echo "✅ 未知域名兜底已生效：未分配/已删除的域名返回中性 404，不再暴露主站"
else
  echo "⚠️ 有探测项不符合预期，请人工看一眼（回滚：cp -a $BAK/sites-enabled /etc/nginx/ && nginx -s reload）"
fi
