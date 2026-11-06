#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# XNOW 快速部署（2026-11-06）
#
# 为什么有这个脚本：
#   `deploy-prod.sh` 是「从 git 拉代码」的正式发布流程，它要 `git checkout` +
#   `git pull`。但日常改 bug 的节奏是「本地改 → 传上去」，而且本仓库是 PUBLIC，
#   不 commit / 不 push 是常态。为了走 deploy-prod.sh 而先 push，反而扩大事故面。
#
#   于是把它**验证用**的部分抽出来单独成这个脚本：同样的四文件强制检查、
#   同样的回归验证、失败自动回滚，但不依赖 git。
#
# 2026-11-06 的教训（本脚本就是为它写的）：
#   手工 tar 部署时漏跑 `node scripts/subsites-html.mjs`，dist 里没有 site.html，
#   所有分站首页 404 —— 而 vhost 配的是 `index site.html`。同步里那条
#   `vite build` 只生成主站入口，分站入口和预渲染页在另外两个脚本里。
#   deploy-prod.sh 本来就有 `[ -f site.html ] || die` 这条闸门，手工部署绕过了它。
#
# 🔒 安全边界（这台机器上还跑着 xnow-flow / xnow-beta / tk7188.com）：
#      · 不写 /etc/nginx/**，不 reload nginx，不碰 conf.d / sites-enabled
#      · 不碰 Cloudflare 任何开关（zone 级，动了会连累所有子域名）
#      · `pm2 restart` 只带进程名 xnow-backend —— 永不 `restart all`
#      · 数据库只读不写（本脚本不执行任何迁移；迁移属于 deploy-prod.sh）
#      · 只替换 $APP/client/dist 一个目录
#
# 用法：
#   本地构建（顺序不能少）：
#       cd client && npx vite build
#       node scripts/prerender.mjs
#       node scripts/subsites-html.mjs
#       tar -czf dist.tar.gz -C .. client/dist     # 注意：包顶层必须是 client/dist/
#   上传并部署：
#       scp dist.tar.gz xnow-vps:/tmp/
#       ssh xnow-vps 'bash /var/www/xnow/deploy/quick-deploy.sh /tmp/dist.tar.gz'
#
# 退出码：0 = 上线成功；非 0 = 已回滚（生产保持部署前状态）
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

APP=/var/www/xnow
DIST="$APP/client/dist"
STAMP=$(date +%Y%m%d-%H%M%S)
PKG="${1:-}"

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }
step() { printf '\n\033[36m▶ %s\033[0m\n' "$*"; }
die()  { red "❌ $*"; exit 1; }

[ -n "$PKG" ] || die "用法: bash deploy/quick-deploy.sh <dist.tar.gz>"
[ -f "$PKG" ] || die "包不存在: $PKG"

step "0. 前置检查"
[ -d "$APP" ] || die "$APP 不存在"
[ -d "$DIST" ] || die "$DIST 不存在（生产目录结构异常，先人工确认）"
# 只允许重启这一个进程；确认它确实存在，避免把别人的进程名打错
pm2 jlist 2>/dev/null | grep -q '"name":"xnow-backend"' || die "pm2 里找不到 xnow-backend，停止"
echo "  ✅ $APP / $DIST / xnow-backend 均在位"

step "1. 解包并验证结构"
TMPD=$(mktemp -d /tmp/xnow-deploy.XXXXXX)
trap 'rm -rf "$TMPD"' EXIT
tar -xzf "$PKG" -C "$TMPD" || die "解包失败（包损坏？）"
[ -d "$TMPD/client/dist" ] || die "包结构不对：顶层必须是 client/dist/（tar -czf x.tar.gz -C . client/dist）"
NEW="$TMPD/client/dist"
echo "  ✅ 结构正确，包内文件数: $(find "$NEW" -type f | wc -l)"

step "2. 四个入口文件强制检查（少一个就是分站/多语言站空白）"
MISSING=0
for f in site.html index.html en.html vpn.html; do
  if [ -f "$NEW/$f" ]; then
    echo "  ✅ $f"
  else
    red "  ❌ $f 缺失"
    MISSING=1
  fi
done
[ "$MISSING" = "0" ] || die "入口文件不全，中止部署（生产未改动）。
    最常见原因：只跑了 vite build，漏了
      node scripts/prerender.mjs      → en.html / vpn.html
      node scripts/subsites-html.mjs  → site.html（分站首页）"

step "3. 备份当前 dist"
BK="/var/backups/xnow-dist/$STAMP"
mkdir -p "$BK"
cp -a "$DIST" "$BK/dist" || die "备份失败，中止（生产未改动）"
echo "  ✅ 备份 → $BK/dist"
# 只留最近 3 份，避免把磁盘塞满（曾经 dist 累积到 511 个文件）
ls -1dt /var/backups/xnow-dist/*/ 2>/dev/null | tail -n +4 | while read -r old; do
  rm -rf "$old" && echo "  🧹 清理旧备份 $old"
done

step "4. 替换 dist"
if ! rm -rf "$DIST" && mkdir -p "$DIST"; then
  cp -a "$BK/dist" "$DIST" 2>/dev/null
  die "替换失败，已恢复备份"
fi
cp -a "$NEW/." "$DIST/" || { rm -rf "$DIST"; cp -a "$BK/dist" "$DIST"; die "复制失败，已恢复备份"; }
echo "  ✅ 新 dist 文件数: $(find "$DIST" -type f | wc -l)"

step "5. 重启后端（只这一个进程）"
pm2 restart xnow-backend --update-env >/dev/null 2>&1 || {
  ylw "  重启失败 → 回滚 dist"
  rm -rf "$DIST" && cp -a "$BK/dist" "$DIST"
  pm2 restart xnow-backend >/dev/null 2>&1
  die "重启失败，已回滚"
}
sleep 8
pm2 jlist 2>/dev/null | grep -q '"name":"xnow-backend".*"status":"online"' \
  || { ylw "  进程不在 online → 回看日志"; pm2 logs xnow-backend --lines 20 --nostream 2>/dev/null | tail -20; }
echo "  ✅ xnow-backend 已重启"

step "6. 全机回归（含同机其它项目）"
VERIFY=$(bash "$APP/deploy/guard/post-deploy-verify.sh" 2>&1)
echo "$VERIFY" | sed 's/^/  /'
if echo "$VERIFY" | grep -q "全部符合预期"; then
  echo
  grn "✅ 部署成功 · $STAMP"
  echo "  回滚： rm -rf $DIST && cp -a $BK/dist $DIST && pm2 restart xnow-backend"
  exit 0
fi

echo
ylw "⚠️ 回归未全过 → 自动回滚"
rm -rf "$DIST" && cp -a "$BK/dist" "$DIST"
pm2 restart xnow-backend >/dev/null 2>&1
sleep 6
echo "  回滚后复测:"
bash "$APP/deploy/guard/post-deploy-verify.sh" 2>&1 | tail -12 | sed 's/^/  /'
red "❌ 已回滚到部署前状态（$BK/dist）"
exit 1
