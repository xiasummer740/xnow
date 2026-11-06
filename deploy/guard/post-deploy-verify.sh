#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# 部署后全机回归（2026-11-03）
#
# 为什么要有：判断一次部署有没有「祸及邻居」的唯一可靠办法，
# 就是把同机所有对外域名的探活全部跑一遍。只看自己项目 200 是不够的 ——
# 今天改 nginx 的 80 端口判据，受影响最大的是同机其它项目的 Host 匹配。
#
# 用法：bash deploy/guard/post-deploy-verify.sh
# 退出码：0 = 全部 200/301/401/404（都属于预期）；1 = 有 5xx 或连接失败
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

# 格式：URL|期望状态码（逗号分隔）
TARGETS=(
  "https://xnow.taikon.top/|200"
  "https://xnow.taikon.top/api/services/public|200"
  "https://xnow.taikon.top/api/services|401"
  "https://7h2d5u.taikon.top/|200"
  "https://demostore.taikon.top/|200"
  "https://beta.taikon.top/|200"
  # ↓ 同机其它项目的域名：本项目的改动不应该影响它们，必须一起验
  "https://tk7188.com/|200"
  "https://code.taikon.top/|200"
)

FAIL=0
printf "%-48s %-6s %s\n" "URL" "状态" "结果"
printf "%-48s %-6s %s\n" "---" "----" "----"
for t in "${TARGETS[@]}"; do
  url="${t%%|*}"
  want="${t##*|}"
  code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 20 "$url" 2>/dev/null)
  hit=0
  IFS=',' read -ra WANT <<< "$want"
  for w in "${WANT[@]}"; do [ "$code" = "$w" ] && hit=1; done
  if [ $hit -eq 1 ]; then
    printf "%-48s %-6s %s\n" "$url" "$code" "✅"
  else
    printf "%-48s %-6s %s\n" "$url" "$code" "❌ 期望 $want"
    FAIL=$((FAIL+1))
  fi
done

echo ""
if [ $FAIL -eq 0 ]; then
  echo "✅ 全部符合预期（含同机其它项目）"
  exit 0
else
  echo "❌ $FAIL 个不符合预期 —— 先回滚，不要继续"
  echo "   回滚：tar xzf /root/xnow-rollback/<最近的时间戳>/... && nginx -t && nginx -s reload && pm2 restart xnow-backend"
  exit 1
fi
