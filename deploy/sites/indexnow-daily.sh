#!/usr/bin/env bash
# 每天把 .indexnow-hosts 里的站点全提交一遍（IndexNow 有频率限制，一天一次足够）
#
# .indexnow-hosts 由 deploy/sites/rebuild-vhosts.cjs 自动维护：
#   主站 + 每个带域名的分站一行，增减分站只要重建一次 vhost 就同步。
#
# 安装（生产机已装，换机后要重装一次）：
#   chmod +x /var/www/xnow/deploy/sites/indexnow-daily.sh
#   ( crontab -l 2>/dev/null | grep -v indexnow-daily.sh ; \
#     echo "20 3 * * * /var/www/xnow/deploy/sites/indexnow-daily.sh" ) | crontab -
#
# 日志：/var/log/xnow-indexnow.log
# 背景：Google 不认 IndexNow（只认 Search Console），但 Bing / Yandex / Seznam / Naver
#       都认，而 ChatGPT 检索与 Copilot 用的是 Bing 索引 —— 所以这条对「AI 能搜到我们」
#       是实打实有用的，且不需要任何账号。

cd /var/www/xnow || exit 1
[ -f .indexnow-hosts ] || exit 0
while read -r host; do
    [ -z "$host" ] && continue
    node scripts/indexnow-submit.mjs "$host" >> /var/log/xnow-indexnow.log 2>&1
done < .indexnow-hosts
