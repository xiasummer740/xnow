#!/usr/bin/env bash
# 分站 · 正式证书（Let's Encrypt）安装脚本
#
# 用途：让「自有域名」从自签证书（浏览器警告）升级为正式证书（绿锁）。
# 特点：幂等、带前置检查、失败不影响现有站点（现有自签证书继续可用）。
#
# 用法：
#   sudo bash deploy/sites/install-certbot.sh              # 安装并给所有已绑定域名签发
#   sudo bash deploy/sites/install-certbot.sh --check      # 只检查，不安装
#
# ⚠️ 需要祥哥批准后由我执行。这是系统级改动（apt 安装），不自行运行。

set -uo pipefail

CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

ok()   { echo "  ✅ $*"; }
warn() { echo "  ⚠️  $*"; }
die()  { echo "  ❌ $*"; exit 1; }

echo "══════ 0. 环境确认 ══════"
[ "$(id -u)" = "0" ] || die "需要 root（请用 sudo）"
command -v apt-get >/dev/null 2>&1 || die "本机不是 Debian/Ubuntu 系，请改用对应包管理器安装 certbot"
command -v nginx   >/dev/null 2>&1 || die "没找到 nginx"
ok "root / apt-get / nginx 均就绪"

echo
echo "══════ 1. 现状检查 ══════"
if command -v certbot >/dev/null 2>&1; then
  ok "certbot 已安装：$(certbot --version 2>&1 | head -1)"
  HAVE=1
else
  warn "certbot 未安装"
  HAVE=0
fi
if [ -d /etc/letsencrypt/live ] && [ -n "$(ls -A /etc/letsencrypt/live 2>/dev/null)" ]; then
  echo "  已有证书目录："
  ls /etc/letsencrypt/live | sed 's/^/    /'
else
  echo "  尚无 Let's Encrypt 证书"
fi

if [ "$CHECK_ONLY" = "1" ]; then
  echo
  echo "仅检查模式，未做任何改动。"
  exit 0
fi

echo
echo "══════ 2. 安装 certbot ══════"
if [ "$HAVE" = "1" ]; then
  ok "已安装，跳过"
else
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq || die "apt-get update 失败"
  apt-get install -y -qq certbot python3-certbot-nginx || die "安装失败"
  command -v certbot >/dev/null 2>&1 || die "装完仍找不到 certbot"
  ok "certbot 安装完成：$(certbot --version 2>&1 | head -1)"
fi

echo
echo "══════ 3. 找出所有需要证书的域名 ══════"
# 从自动生成的 vhost 里抓域名：文件名形如 xnow-site-<id>-<domain>
DOMAINS=""
for f in /etc/nginx/sites-enabled/xnow-site-*; do
  [ -e "$f" ] || continue
  d=$(basename "$f" | sed 's/^xnow-site-[0-9]*-//')
  DOMAINS="$DOMAINS $d"
done
# 也把 xnow.taikon.top 这种主站域名算进去（已有证书的会被 certbot 跳过）
DOMAINS="$DOMAINS xnow.taikon.top"

DOMAINS=$(echo "$DOMAINS" | tr ' ' '\n' | grep -v '^$' | sort -u)
if [ -z "$DOMAINS" ]; then
  warn "没有找到任何分站域名，只处理主站"
else
  echo "  待处理域名："
  echo "$DOMAINS" | sed 's/^/    /'
fi

echo
echo "══════ 4. 逐个签发（失败不影响其它域名）══════"
FAILED=""
for d in $DOMAINS; do
  echo "  ── $d"
  if [ -f "/etc/letsencrypt/live/$d/fullchain.pem" ]; then
    ok "已有证书，跳过"
    continue
  fi
  # --nginx 用 HTTP-01 验证；Cloudflare 橙云也能通过（CF 会把 /.well-known 回源）
  if certbot certonly --nginx -d "$d" --non-interactive --agree-tos \
       --register-unsafely-without-email --keep-until-expiring >/tmp/certbot-$d.log 2>&1; then
    ok "签发成功"
  else
    warn "签发失败，详见 /tmp/certbot-$d.log（已是自签的站点不受影响）"
    tail -3 "/tmp/certbot-$d.log" 2>/dev/null | sed 's/^/       /'
    FAILED="$FAILED $d"
  fi
done

echo
echo "══════ 5. 让分站改用新证书 ══════"
# 分站后端 ensureCert 会优先找 /etc/letsencrypt/live/<domain>/fullchain.pem，
# 所以只要重新触发一次「修复域名」即可切换。这里直接调接口更稳妥：
# 若无从调用，则提示在后台点「修复域名」。
echo "  提示：certbot --nginx 会自行改写 nginx 配置；若要分站 vhost 也指向新证书，"
echo "        请在站长后台点一次「修复域名」，或调用 POST /api/sites/:id/publish"

echo
echo "══════ 6. 自动续期 ══════"
if systemctl list-timers 2>/dev/null | grep -q certbot; then
  ok "certbot 续期定时器已启用（systemd timer）"
else
  warn "未检测到 certbot 定时器，请手工确认：systemctl list-timers | grep certbot"
fi

echo
echo "══════ 结果 ══════"
if [ -z "$FAILED" ]; then
  ok "全部域名已处理完成"
else
  warn "以下域名未成功：$FAILED"
  echo "      常见原因：域名未解析到本机 / Cloudflare 开了「仅HTTPS」导致验证请求被跳转 / 该域名已有其他证书"
fi
echo
echo "验证方法（在任意机器上）："
echo '  echo | openssl s_client -connect <域名>:443 -servername <域名> 2>/dev/null | openssl x509 -noout -issuer -dates'
echo "  签发方显示 Let's Encrypt 即为成功。"
