#!/usr/bin/env bash
# 每天向 Bing 提交 URL（配额 100/天，按优先级提交，已提交的跳过）
# 日志：/var/log/xnow-bing.log
cd /var/www/xnow || exit 1
LOG=/var/log/xnow-bing.log
[ -f "$LOG" ] && [ $(stat -c%s "$LOG") -gt 2097152 ] && mv "$LOG" "$LOG.1"
echo "===== $(date '+%Y-%m-%d %H:%M:%S') =====" >> "$LOG"
node scripts/bing-urlsubmit.mjs >> "$LOG" 2>&1
