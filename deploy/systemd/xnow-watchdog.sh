#!/bin/bash
# XNOW 看门狗（2026-10-17 生产事故后加）
#
# 起因：01:44 VPS 重启后 pm2 没有开机自启，后端一直没起来，
#       nginx 照常发静态页 → 首页 200，但所有 /api/* 全是 Connection refused，
#       全站 API 挂了 2 小时 47 分才被祥哥截图发现。静态页 200 ≠ 站点正常。
#
# 每 2 分钟跑一次（由 xnow-watchdog.timer 驱动）：
#   1. 探 http://127.0.0.1:3000/api/public/config（一条请求同时覆盖 后端 + 数据库 + 路由）
#   2. 探不通 → 依次检查 nginx / mysql / pm2 守护 / 进程，缺什么补什么
#   3. 自愈成功 → 记日志 + 推 TG **和** 邮件（让你知道"它自己好了，但发生过"）
#      自愈失败 → 推 TG + 邮件（需要人工介入）
#   4. 同一次故障 1 小时内不重复刷屏
#
# 它治的是「机器活着但后端死了」；整机宕机时它自己也跑不了 ——
# 那种要靠外部监控（如 UptimeRobot 探 https://xnow.taikon.top/api/public/config）。
set -uo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

APP=xnow-backend
APPDIR=/var/www/xnow/server
HEALTH=http://127.0.0.1:3000/api/public/config
HEALTH_PUBLIC=https://xnow.taikon.top/api/public/config
LOG=/var/log/xnow-watchdog.log
STATE=/var/lib/xnow-watchdog.last-alert
ALERT_TO=464844409@qq.com
ALERT_GAP=3600

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

q() {  # q <configs.key> —— 从数据库读配置（不打印值）
    MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT value FROM xnow_db.configs WHERE \`key\`=\"$1\"" 2>/dev/null
}

# ---- 告警：TG + 邮件，双通道 ----
send_alerts() {
    local subj="$1" html="$2" text="$3"
    [ -f "$APPDIR/.env" ] || { log "找不到 .env，跳过告警"; return 0; }
    DBP=$(grep -E '^DB_PASS=' "$APPDIR/.env" | cut -d= -f2- | tr -d '"')

    local TOKEN CHAT
    TOKEN=$(q tg_bot_token); CHAT=$(q tg_chat_id)
    if [ -n "${TOKEN:-}" ] && [ -n "${CHAT:-}" ]; then
        if curl -sf --max-time 12 "https://api.telegram.org/bot${TOKEN}/sendMessage" \
               -d "chat_id=${CHAT}" -d "parse_mode=HTML" \
               --data-urlencode "text=${html}" >/dev/null 2>&1; then
            log "TG 告警已发送"
        else
            log "TG 告警发送失败"
        fi
    else
        log "TG 未配置，跳过"
    fi

    local H P U W
    H=$(q smtp_host); P=$(q smtp_port); U=$(q smtp_email); W=$(q smtp_pass)
    if [ -n "${U:-}" ] && [ -n "${W:-}" ]; then
        if NODE_PATH="$APPDIR/node_modules" \
           SMTP_HOST="${H:-smtp.qq.com}" SMTP_PORT="${P:-465}" \
           SMTP_USER="$U" SMTP_PASS="$W" ALERT_TO="$ALERT_TO" \
           node /usr/local/bin/xnow-alert-mail.cjs "$subj" "$text" >>"$LOG" 2>&1; then
            log "邮件告警已发送 -> $ALERT_TO"
        else
            log "邮件告警发送失败 -> $ALERT_TO"
        fi
    else
        log "SMTP 未配置，跳过邮件"
    fi
}

# 0. 自检模式：只测告警通道（TG + 邮件），完全不动站点
#    用法：WATCHDOG_TEST=1 /usr/local/bin/xnow-watchdog.sh
if [ "${WATCHDOG_TEST:-0}" = "1" ]; then
    log "TEST_MODE：只自检告警通道，不做任何自愈动作"
    TS=$(date '+%F %T')
    send_alerts \
        "[自检] XNOW 看门狗告警通道正常（$TS）" \
        "[自检] <b>看门狗告警通道正常</b>\n这是手动自检消息 —— 你收到就说明报警能到你手上。\n⏱ ${TS}" \
        "这是看门狗告警通道的自检消息 —— 你收到就说明报警能到你手上。\n时间：${TS}"
    exit 0
fi

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

# 4. 复检（本地 + 外网，外网那条才算"用户真的能访问"）
sleep 12
CODE2=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$HEALTH" 2>/dev/null)
if [ -z "$CODE2" ]; then CODE2=000; fi
CODE3=$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "$HEALTH_PUBLIC" 2>/dev/null)
if [ -z "$CODE3" ]; then CODE3=000; fi

TS=$(date '+%F %T')
if [ "$CODE2" = "200" ]; then
    log "自愈成功（本地 $CODE2 / 外网 $CODE3）"
    [ "$THROTTLED" = "1" ] && exit 0
    SUBJ="🛠 XNOW 后端曾掉线，看门狗已自愈（$TS）"
    HTML="🛠 <b>后端曾掉线，看门狗已自愈</b>
📋 动作：${REPORT:-（无）}
✅ 复检：本地 HTTP ${CODE2} / 外网 HTTP ${CODE3}
⏱ 时间：${TS}"
    TEXT="后端曾掉线，看门狗已自愈。

动作：${REPORT:-（无）}
复检：本地 HTTP ${CODE2} / 外网 HTTP ${CODE3}
时间：${TS}

如果你没收到这条消息的 TG 版本，请检查 @Xnow001Bot 是否正常。"
else
    log "自愈失败（本地 $CODE2 / 外网 $CODE3）—— 需要人工介入"
    SUBJ="🚨 XNOW 后端掉线且自愈失败（$TS）"
    HTML="🚨 <b>后端掉线且自愈失败</b>
📋 动作：${REPORT:-（无）}
❌ 复检：本地 HTTP ${CODE2} / 外网 ${CODE3}
🔧 请立刻上机：<code>pm2 list</code> / <code>pm2 logs ${APP}</code>
⏱ 时间：${TS}"
    TEXT="后端掉线且自愈失败，需要人工介入。

动作：${REPORT:-（无）}
复检：本地 HTTP ${CODE2} / 外网 HTTP ${CODE3}
请立刻上机检查：pm2 list ; pm2 logs ${APP}
时间：${TS}"
fi

# 5. 发送告警（双通道）
send_alerts "$SUBJ" "$HTML" "$TEXT"
echo "$NOW" > "$STATE"
