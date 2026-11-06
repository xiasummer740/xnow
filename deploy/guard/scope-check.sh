#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# XNOW 部署范围守卫（2026-11-03）
#
# 解决的问题：同一台机器上跑着多个项目，同一个 AI 的不同会话会同时改东西，
# 一旦某个会话改了「共享层」（nginx 全局配置、Cloudflare zone 级设置、pm2、MySQL），
# 另一个项目就会跟着坏 —— 今天 06:04 那个「CF 的 SSL 从 Full 改成 Flexible」就是
# 活例子：改的是 taikon.top 这个 zone 的全局开关，结果整个 xnow 全站瘫了 8 小时。
#
# 用法：
#   bash deploy/guard/scope-check.sh                 # 检查工作区里改动过的文件是否越界
#   bash deploy/guard/scope-check.sh --files a b c   # 检查指定文件
#
# 退出码：0 = 全部在本项目范围内；1 = 有越界文件（部署前必须人工确认）
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

# 本项目允许改动的路径（相对仓库根）。不在列表里的一律要求人工确认。
ALLOWED_PREFIXES=(
  "client/"            # 前端源码
  "server/"            # 后端源码
  "deploy/nginx/"      # 只有本项目的 snippet / conf.d 模板
  "deploy/guard/"      # 守卫脚本自身
  "install.sh"         # 部署模板（必须与线上同步）
  "scripts/"
  "README.md"
  "ACCEPTANCE.md"
  ".gitignore"         # 防 PUBLIC 泄漏的关键文件，本项目可以改
)

# 明确禁止改动 / 部署到服务器的共享层（这些一改就影响邻居项目）
FORBIDDEN_PATTERNS=(
  "^/etc/nginx/nginx.conf$"                 # 全局 nginx 主配置
  "^/etc/nginx/conf\.d/"                    # conf.d 是 http 级全局，影响同机所有站点
  "^/etc/nginx/sites-enabled/xnow-spa-https$"   # 主站 vhost（改前必须备份 + nginx -t）
  "^/etc/mysql/"
  "^/etc/cloudflared/"
)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

if [ "${1:-}" = "--files" ]; then
  shift
  FILES=("$@")
else
  mapfile -t FILES < <(git status --porcelain 2>/dev/null | awk '{print $2}')
fi

if [ ${#FILES[@]} -eq 0 ]; then
  echo "✅ 没有待检查的改动"
  exit 0
fi

BAD=0
for f in "${FILES[@]}"; do
  [ -z "$f" ] && continue
  [ "$f" = ".tmpbuild/" ] && continue
  case "$f" in
    .tmpbuild*|.tmp-build*|*node_modules*|client/dist/*) continue ;;
    # 应用内自动备份产物：已在 .gitignore 里（仓库是 PUBLIC，不能进版本库），
    # 但部署目录上可能残留为未跟踪状态，这里直接跳过。
    backups/*|*/backups/*) continue ;;
  esac

  # 禁改清单
  for pat in "${FORBIDDEN_PATTERNS[@]}"; do
    if [[ "$f" =~ $pat ]]; then
      echo "⛔ 禁区: $f   （匹配 $pat —— 这是全机共享层，改了会影响同机其它项目）"
      BAD=$((BAD+1))
      continue 2
    fi
  done

  # 白名单
  ok=0
  for p in "${ALLOWED_PREFIXES[@]}"; do
    case "$f" in
      "$p"*) ok=1; break ;;
    esac
  done
  if [ $ok -eq 0 ]; then
    echo "⚠️  越界: $f   （不在本项目白名单内，请确认后手动加入 ALLOWED_PREFIXES）"
    BAD=$((BAD+1))
  fi
done

echo ""
if [ $BAD -eq 0 ]; then
  echo "✅ ${#FILES[@]} 个改动全部落在本项目范围内"
  exit 0
else
  echo "❌ 有 $BAD 个改动越界/落在禁区，部署前必须人工确认"
  exit 1
fi
