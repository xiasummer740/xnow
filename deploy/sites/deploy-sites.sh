#!/bin/bash
# ============================================================================
# 分站体系 · 部署脚本（上线时用）
# ----------------------------------------------------------------------------
# 用法：
#   bash deploy-sites.sh --env beta          # 部署到 Beta（演练/验收）
#   bash deploy-sites.sh --env prod          # 部署到生产（正式上线）
#   bash deploy-sites.sh --env prod --check  # 只做部署前检查，不改任何东西
#
# 设计原则（针对祥哥最在意的两点：不能搞坏主站、出事必须能退）
#   1. 部署前强制全库备份 → 备份文件大小与表数量都会校验，备份不成功直接退出
#   2. 迁移脚本只加列不动数据，且内置 MIGRATE_TARGET 校验，打错库会自己退出
#   3. 任何一步失败 → 立刻打印回滚命令，绝不在半成品状态继续往下走
#   4. 部署后自动跑自检；自检失败同样打印回滚命令
# ============================================================================
set -uo pipefail

# 🔑 脚本自身绝对路径：中途会 cd 到项目目录，绝不能用相对路径找兄弟脚本
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ENV=""; CHECK_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --env) ENV="$2"; shift 2 ;;
    --check) CHECK_ONLY=1; shift ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

case "$ENV" in
  beta)
    APP_DIR=/var/www/xnow-beta
    DB_NAME_T=xnow_beta
    PM2_APP=xnow-beta
    PROD_DB=xnow_beta
    ;;
  prod)
    APP_DIR=/var/www/xnow
    DB_NAME_T=xnow_db
    PM2_APP=xnow-backend
    PROD_DB=xnow_db
    ;;
  *) echo "必须指定 --env beta 或 --env prod"; exit 1 ;;
esac

SRC_DIR="${SRC_DIR:-/tmp/sites-deploy}"      # 代码已上传到这里
BACKUP_DIR=/root/backups
STAMP=$(date +%Y%m%d-%H%M%S)
DBP=$(grep '^DB_PASS=' /var/www/xnow/server/.env | cut -d= -f2-)

say() { echo -e "\n\033[1;36m$*\033[0m"; }
ok()  { echo "  ✅ $*"; }
bad() { echo "  ❌ $*"; }
die() { echo -e "\n\033[1;31m✗ $*\033[0m"; echo -e "\033[1;33m回滚命令：bash $SCRIPT_DIR/rollback-sites.sh --env $ENV --stamp $STAMP\033[0m"; exit 1; }

say "=== 0. 目标确认 ==="
echo "  环境     : $ENV"
echo "  目录     : $APP_DIR"
echo "  数据库   : $DB_NAME_T"
echo "  pm2 进程 : $PM2_APP"
echo "  SRC      : $SRC_DIR"
if [ ! -d "$APP_DIR" ]; then bad "目录不存在：$APP_DIR"; exit 1; fi
if [ ! -d "$SRC_DIR/server" ]; then bad "源码目录不完整：$SRC_DIR/server"; exit 1; fi

say "=== 1. 部署前检查 ==="
# 语法检查：坏代码绝不进机房
for f in $(cd "$SRC_DIR/server" && find src scripts -name '*.js'); do
  node --check "$SRC_DIR/server/$f" >/dev/null 2>&1 || { bad "语法错误: $f"; node --check "$SRC_DIR/server/$f"; exit 1; }
done
ok "后端 JS 语法全部通过 ($(cd "$SRC_DIR/server" && find src scripts -name '*.js' | wc -l) 个文件)"
[ -d "$SRC_DIR/client/dist/assets" ] && ok "前端产物存在" || { bad "前端 dist 缺失"; exit 1; }
[ -f "$SRC_DIR/server/scripts/migrate-site-id.js" ] && ok "迁移脚本存在" || { bad "迁移脚本缺失"; exit 1; }

CUR_USERS=$(MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM $DB_NAME_T.users" 2>/dev/null)
CUR_ORDERS=$(MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM $DB_NAME_T.orders" 2>/dev/null)
ok "当前数据快照：users=$CUR_USERS orders=$CUR_ORDERS"

if [ "$CHECK_ONLY" = "1" ]; then say "仅检查模式，未做任何改动"; exit 0; fi

say "=== 2. 全库备份（部署前强制） ==="
mkdir -p "$BACKUP_DIR"
BK="$BACKUP_DIR/${ENV}-${STAMP}.sql.gz"
MYSQL_PWD="$DBP" mysqldump -u root --single-transaction --quick "$DB_NAME_T" 2>/dev/null | gzip > "$BK"
if [ ! -s "$BK" ]; then bad "备份失败或为空"; exit 1; fi
BK_SIZE=$(stat -c%s "$BK")
TABLE_CNT=$(zcat "$BK" | grep -c '^CREATE TABLE')
ok "备份完成：$BK（$((BK_SIZE/1024)) KB，$TABLE_CNT 张表）"
if [ "$BK_SIZE" -lt 1024 ] || [ "$TABLE_CNT" -lt 5 ]; then
  bad "备份内容异常（体积或表数不足），为安全计中止"; exit 1
fi

say "=== 3. 记录当前版本（回滚锚点）==="
# 代码快照：生产目录不是 git 仓库，回滚只能靠这个 tar（这是演练时发现的，别删）
CODE_BK="$BACKUP_DIR/${ENV}-${STAMP}-code.tar.gz"
tar czf "$CODE_BK" -C "$APP_DIR" server/src server/scripts 2>/dev/null
if [ -s "$CODE_BK" ]; then ok "代码快照：$CODE_BK（$(stat -c%s "$CODE_BK") 字节）"; else bad "代码快照失败，为安全计中止"; exit 1; fi
cd "$APP_DIR/server" || die "进入目录失败"
CUR_HEAD=$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
echo "$CUR_HEAD" > "$BACKUP_DIR/${ENV}-${STAMP}.head"
ok "当前 HEAD: ${CUR_HEAD:0:12}"

say "=== 4. 数据库迁移（只加列，不动数据） ==="
DB_NAME="$DB_NAME_T" MIGRATE_TARGET="$DB_NAME_T" node scripts/migrate-site-id.js 2>&1 | sed 's/^/    /'
MIG_RC=${PIPESTATUS[0]}
[ "$MIG_RC" != "0" ] && die "迁移失败（退出码 $MIG_RC）"
ok "迁移完成"

NEW_USERS=$(MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM $DB_NAME_T.users" 2>/dev/null)
NEW_ORDERS=$(MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM $DB_NAME_T.orders" 2>/dev/null)
if [ "$NEW_USERS" != "$CUR_USERS" ] || [ "$NEW_ORDERS" != "$CUR_ORDERS" ]; then
  bad "迁移改动了业务数据（users $CUR_USERS→$NEW_USERS, orders $CUR_ORDERS→$NEW_ORDERS）"; die "数据被改动，立即回滚"
fi
ok "业务数据未被改动：users=$NEW_USERS orders=$NEW_ORDERS"

say "=== 5. 替换后端代码 ==="
cp -r "$SRC_DIR/server/src/."   "$APP_DIR/server/src/"   || die "后端源码替换失败"
cp -r "$SRC_DIR/server/scripts/." "$APP_DIR/server/scripts/" || die "脚本替换失败"
ok "后端代码已更新"

say "=== 6. 替换前端产物 ==="
rsync -a --delete "$SRC_DIR/client/dist/" "$APP_DIR/client/dist/" || die "前端替换失败"
ok "前端产物已更新（$(ls -1 "$APP_DIR/client/dist" | wc -l) 项）"

say "=== 7. 重启（reload 平滑重启，不中断连接） ==="
pm2 reload "$PM2_APP" --update-env >/dev/null 2>&1 || pm2 restart "$PM2_APP" >/dev/null 2>&1
sleep 8
pm2 list | grep -E "$PM2_APP" | sed 's/^/    /'
ok "已重启"

say "=== 8. 部署后自检 ==="
if bash "$SCRIPT_DIR/verify-sites.sh" --env "$ENV"; then
  ok "自检全部通过"
  echo
  echo -e "\033[1;32m✔ 部署成功\033[0m"
  echo "  数据库备份: $BK"
  echo "  代码快照  : $CODE_BK"
  echo "  回滚      : bash $SCRIPT_DIR/rollback-sites.sh --env $ENV --stamp $STAMP"
else
  bad "自检未通过"
  die "自检失败"
fi
