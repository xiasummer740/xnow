#!/usr/bin/env bash
# 每天把 sitemap 里的地址提交给 Google Indexing API
# 配额：默认 200 条/天，当前 sitemap 174 条，正好够一轮
# 日志：/var/log/xnow-gsc-indexing.log（超过 2MB 自动截断）
cd /var/www/xnow || exit 1
LOG=/var/log/xnow-gsc-indexing.log
[ -f "$LOG" ] && [ $(stat -c%s "$LOG") -gt 2097152 ] && mv "$LOG" "$LOG.1"
echo "===== $(date '+%Y-%m-%d %H:%M:%S') =====" >> "$LOG"
node scripts/gsc-indexing.mjs >> "$LOG" 2>&1
