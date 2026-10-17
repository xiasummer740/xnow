#!/bin/bash
# XNOW 看门狗（2026-10-17 生产事故后加）
#
# 起因：01:44 VPS 重启后 pm2 没有开机自启，后端一直没起来，
#       nginx 照常发静态页 → 首页 200，但所有 /api/* 全是 Connection refused，
#       全站 API 挂了 2 小时 47 分才被祥哥截图发现。
#
# 这个脚本每 2 分钟跑一次（由 xnow-watchdog.timer 驱动）：
#   1. 探 http://127.0.0.1:3000/api/public/config（这一条同时覆盖 后端 + 数据库 + 路由）
#   2. 探不通 → 依次检查 nginx / mysql / pm2 守护 / 进程，缺什么补什么
#   3. 自愈成功 → 记日志 + 推一条 TG（告诉你"它自己好了"，但你知道发生过）
#      自愈失败 → 推 TG 告警（需要人工介入）
#   4. 同一次故障只告警一次（1 小时内不重复刷屏）
#
# 它治的是「机器活着但后端死了」（今天这种）；整机宕机它自己也跑不了 ——
# 那种要靠外部监控（如 UptimeRobot 探 https://xnow.taikon.top/api/public/config）。
set -uo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

APP=xnow-backend
APPDIR=/var/www/xnow/server
HEALTH=http://127.0.0.1:3000/api/public/config
LOG=/var/log/xnow-watchdog.log
STATE=/var/lib/xnow-watchdog.last-alert
ALERT_GAP=3600

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

# 1. 健康检查（同时覆盖 后端 + 数据库）
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$HEALTH" 2>/dev/null)
if [ -z "$CODE" ]; then CODE=000; fi
[ "$CODE" = "200" ] && exit 0

# 2. 告警节流
NOW=$(date +%s)
LAST=$(cat "$STATE" 2>/dev/null || echo 0)
THROTTLED=0
[ $((NOW - LAST)) -lt "$ALERT_GAP" ] && THROTTLED=1

log "检测到异常：$HEALTH -> HTTP $CODE，开始自愈"

# 3. 诊断 + 自愈
REPORT=""
if ! systemctl is-active --quiet nginx; then
    systemctl start nginx && REPORT="${REPORT}nginx 曾停止、已启动；"
    log "nginx 曾停止，已启动"
fi
if ! systemctl is-active --quiet mariadb && ! systemctl is-active --quiet mysql; then
    (systemctl start mariadb || systemctl start mysql) && REPORT="${REPORT}数据库曾停止、已启动；"
    log "数据库曾停止，已启动"
fi
if ! pm2 ping >/dev/null 2>&1; then
    pm2 resurrect >/dev/null 2>&1; REPORT="${REPORT}pm2 守护曾不在、已 resurrect；"
    log "pm2 守护不在，已 resurrect"
fi
if ! pm2 describe "$APP" >/dev/null 2>&1; then
    pm2 start "$APPDIR/src/app.js" --name "$APP" --cwd "$APPDIR" >/dev/null 2>&1
    REPORT="${REPORT}后端进程不存在、已重新拉起；"
    log "后端进程不存在，已拉起"
else
    pm2 restart "$APP" >/dev/null 2>&1
    REPORT="${REPORT}后端进程存在但无响应、已重启；"
    log "后端无响应，已重启"
fi

# 4. 复检
sleep 12
CODE2=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$HEALTH" 2>/dev/null)
if [ -z "$CODE2" ]; then CODE2=000; fi
if [ "$CODE2" = "200" ]; then
    log "自愈成功（HTTP 200）"
    [ "$THROTTLED" = "1" ] && exit 0
    MSG="🛠 <b>后端曾掉线，看门狗已自愈</b>
📋 动作：${REPORT:-（无）}
✅ 复检：HTTP 200，站点已恢复
⏱ 时间：$(date '+%F %T')"
else
    log "自愈失败（HTTP $CODE2）——需要人工介入"
    MSG="🚨 <b>后端掉线且自愈失败</b>
📋 动作：${REPORT:-（无）}
❌ 复检：HTTP $CODE2
🔧 请立刻上机检查：pm2 list / pm2 logs $APP
⏱ 时间：$(date '+%F %T')"
fi

# 5. 推 TG（token/chat 从数据库读，与站点用同一条通知通道）
cd "$APPDIR" || exit 0
DBP=$(grep -E '^DB_PASS=' .env | cut -d= -f2- | tr -d '"')
TOKEN=$(MYSQL_PWD="$DBP" mysql -N -u root -e 'SELECT value FROM xnow_db.configs WHERE `key`="tg_bot_token"' 2>/dev/null)
CHAT=$(MYSQL_PWD="$DBP" mysql -N -u root -e 'SELECT value FROM xnow_db.configs WHERE `key`="tg_chat_id"' 2>/dev/null)
if [ -n "${TOKEN:-}" ] && [ -n "${CHAT:-}" ]; then
    curl -s --max-time 12 "https://api.telegram.org/bot${TOKEN}/sendMessage" \
        -d "chat_id=${CHAT}" -d "parse_mode=HTML" \
        --data-urlencode "text=${MSG}" >/dev/null 2>&1
    echo "$NOW" > "$STATE"
    log "TG 告警已发送"
else
    log "TG 未配置，告警未发送"
fi
