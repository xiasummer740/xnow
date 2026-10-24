#!/bin/bash
# ============================================================================
# 分站体系 · 回滚脚本
# ----------------------------------------------------------------------------
# 用法：
#   bash rollback-sites.sh --env prod --stamp 20261024-213000   # 用指定备份回滚
#   bash rollback-sites.sh --env prod --list                     # 列出可用备份
#   bash rollback-sites.sh --env prod --stamp XXX --code-only     # 只回滚代码，不还原库
#
# 说明：数据库迁移是「只加列、不动数据」，所以绝大多数情况下**只需要回滚代码**。
#       还原数据库会丢掉部署后新增的真实订单/用户，是最后手段，需人工确认。
# ============================================================================
set -uo pipefail

ENV=""; STAMP=""; LIST=0; CODE_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --env) ENV="$2"; shift 2 ;;
    --stamp) STAMP="$2"; shift 2 ;;
    --list) LIST=1; shift ;;
    --code-only) CODE_ONLY=1; shift ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

case "$ENV" in
  beta) APP_DIR=/var/www/xnow-beta; DB_NAME_T=xnow_beta; PM2_APP=xnow-beta ;;
  prod) APP_DIR=/var/www/xnow;      DB_NAME_T=xnow_db;   PM2_APP=xnow-backend ;;
  *) echo "必须指定 --env beta 或 --env prod"; exit 1 ;;
esac
BACKUP_DIR=/root/backups
# ⚠️ 口令与"回滚后自检"的目标都必须跟着 --env 走。
#    原来写死生产路径/主站域名/3000 端口：--env beta 演练时会去读生产口令，
#    回滚完还会用主站域名去探活 —— 演练看起来"通过"，其实探的根本不是这台环境。
DBP=$(grep '^DB_PASS=' "$APP_DIR/server/.env" | cut -d= -f2-)
case "$ENV" in
  beta) CHECK_HOST=beta.taikon.top;  CHECK_PORT=3001 ;;
  prod) CHECK_HOST=xnow.taikon.top;  CHECK_PORT=3000 ;;
esac

if [ "$LIST" = "1" ] || [ -z "$STAMP" ]; then
  echo "可用备份（$ENV）："
  ls -lh "$BACKUP_DIR"/${ENV}-*.sql.gz 2>/dev/null | awk '{print "  " $9, $5, $6, $7, $8}' || echo "  （无）"
  [ -z "$STAMP" ] && { echo; echo "用法：--stamp <时间戳>  例：--stamp 20261024-213000"; exit 0; }
fi

BK="$BACKUP_DIR/${ENV}-${STAMP}.sql.gz"
HEADF="$BACKUP_DIR/${ENV}-${STAMP}.head"
if [ "$CODE_ONLY" = "0" ] && [ ! -s "$BK" ]; then
  echo "✗ 备份文件不存在或为空：$BK"; exit 1
fi

echo "=== 回滚目标 ==="
echo "  环境: $ENV | 目录: $APP_DIR | 库: $DB_NAME_T | 备份: $BK"

if [ -f "$HEADF" ]; then
  TARGET_HEAD=$(cat "$HEADF")
  echo "  代码锚点: ${TARGET_HEAD:0:12}"
fi

echo
echo "=== 1. 停服务（避免回滚过程中写入脏数据）==="
pm2 stop "$PM2_APP" >/dev/null 2>&1 && echo "  已停止 $PM2_APP"

if [ "$CODE_ONLY" = "0" ]; then
  echo
  echo "=== 2. 还原数据库（最后手段）==="
  echo "  ⚠️ 部署后新增的订单/用户会丢失，但部署前的数据 100% 恢复"
  MYSQL_PWD="$DBP" mysql -u root -e "DROP DATABASE IF EXISTS ${DB_NAME_T}; CREATE DATABASE ${DB_NAME_T} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" || { echo "✗ 建库失败"; exit 1; }
  zcat "$BK" | MYSQL_PWD="$DBP" mysql -u root "$DB_NAME_T" || { echo "✗ 还原失败"; exit 1; }
  U=$(MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM $DB_NAME_T.users" 2>/dev/null)
  O=$(MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM $DB_NAME_T.orders" 2>/dev/null)
  echo "  ✅ 还原完成：users=$U orders=$O"
fi

echo
echo "=== 3. 回滚代码 ==="
cd "$APP_DIR" || { echo "✗ 目录不存在"; exit 1; }
CODE_BK="$BACKUP_DIR/${ENV}-${STAMP}-code.tar.gz"
if [ -s "$CODE_BK" ]; then
  # 首选：部署时打好的代码快照（生产目录不是 git 仓库，演练时确认过这点）
  tar xzf "$CODE_BK" -C "$APP_DIR" && echo "  ✅ 已从代码快照恢复：$CODE_BK"
elif [ -n "${TARGET_HEAD:-}" ] && git cat-file -e "$TARGET_HEAD" 2>/dev/null; then
  git checkout "$TARGET_HEAD" -- server/src server/scripts 2>/dev/null && echo "  ✅ 代码已回到 ${TARGET_HEAD:0:12}"
else
  echo "  ✗ 既没有代码快照，也没有 git 锚点 —— 代码无法自动回滚，请人工处理"
  echo "    可用备份：$BACKUP_DIR/${ENV}-*-code.tar.gz"
  exit 1
fi

echo
echo "=== 4. 重启并自检 ==="
pm2 restart "$PM2_APP" --update-env >/dev/null 2>&1
sleep 8
pm2 list | grep -E "$PM2_APP" | sed 's/^/    /'
echo
echo -n "  主站首页 -> "; curl -sk -o /dev/null -w "HTTP %{http_code}\n" --max-time 10 -H "Host: $CHECK_HOST" https://127.0.0.1/ --resolve "$CHECK_HOST:443:127.0.0.1"
echo -n "  主站 API -> "; curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 8 "http://127.0.0.1:$CHECK_PORT/api/public/config"
echo
echo "回滚流程执行完毕，请人工确认首页、登录、下单三项。"
