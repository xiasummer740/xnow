#!/bin/bash
# ============================================================================
# XNOW 分站体系：一键上线引导脚本（81 期）
#
# 为什么需要它：
#   生产在 main 分支，deploy/ 目录是 feat/sites 才有的 ——
#   所以"直接 ssh 上去跑 deploy-prod.sh"这个计划本身跑不起来（文件不存在）。
#   本脚本先用 git 把部署脚本从分支里取出来，再交给它执行。
#
# 用法：
#   ① 演练（只读，不改任何东西）：
#        ssh xnow-vps 'bash /tmp/go-live.sh --dry-run'
#   ② 正式上线（祥哥说「可以上」之后）：
#        ssh xnow-vps 'bash /tmp/go-live.sh'
#
# 传参方式：把本文件 scp 到 /tmp/go-live.sh 再执行，或者一行命令取出来跑：
#   ssh xnow-vps 'cd /var/www/xnow && git fetch origin feat/sites -q && \
#     git show origin/feat/sites:deploy/sites/go-live.sh > /tmp/go-live.sh && \
#     bash /tmp/go-live.sh --dry-run'
# ============================================================================
set -uo pipefail

APP=/var/www/xnow
BRANCH=feat/sites

cd "$APP" || { echo "❌ 找不到 $APP"; exit 1; }

echo "════ 上线引导 ════"
echo "  目标仓库: $APP"
echo "  目标分支: $BRANCH"
echo "  当前提交: $(git log --oneline -1)"

case "${1:-}" in
  --dry-run) MODE=dry; echo "  模式: 演练（只读，不会改动任何文件）" ;;
  "")        MODE=real; echo "  模式: 正式上线" ;;
  *)         echo "❌ 未知参数 $1（只支持 --dry-run 或不传）"; exit 1 ;;
esac

git fetch origin "$BRANCH" -q || { echo "❌ fetch 失败（网络或权限）"; exit 1; }

TMP=/tmp/xnow-deploy-$(date +%H%M%S)
mkdir -p "$TMP" || exit 1
if ! git show "origin/$BRANCH:deploy/sites/deploy-prod.sh" > "$TMP/deploy-prod.sh" 2>/dev/null; then
  echo "❌ 取不到分支里的 deploy/sites/deploy-prod.sh"
  exit 1
fi
echo "  ✅ 已从分支取出部署脚本 → $TMP/deploy-prod.sh（$(wc -l < "$TMP/deploy-prod.sh") 行）"
echo ""

if [ "$MODE" = "dry" ]; then
  XNOW_DRY_RUN=1 bash "$TMP/deploy-prod.sh"
else
  bash "$TMP/deploy-prod.sh"
fi
