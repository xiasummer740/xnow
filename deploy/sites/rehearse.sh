#!/bin/bash
# ============================================================================
# XNOW 上线演练脚本（83 期）—— 用**生产数据库的副本**跑一遍新代码
#
# 为什么必须有这一步：
#   Beta 的数据库是空的，`sites`/`orders` 表是 sequelize.sync 从零建的，字段天生齐全。
#   生产不一样：`sites` 表是早期版本只有 11 列，`orders` 没有 site_cost 列。
#   83 期演练第一次跑就发现：新代码在生产形态的库上会缺 44 列，
#   其中 orders.site_cost 会让**全站下单直接失败**。修完再演练才是绿的。
#
# 它做什么（全程不碰生产）：
#   1. 把生产库 dump 成 xnow_rehearsal（只读复制）
#   2. 在 /var/www/xnow-rehearsal 拉一遍 feat/sites 代码
#   3. 用 3002 端口启动，检查：补列日志 / 列数 / 启动有无报错
#   4. 只读验证：公开配置、2839 个服务、订单历史、分站列表
#   5. 跑完自动停进程、删演练库（日志留在 /tmp/rehearsal.log）
#
# 用法：bash rehearse.sh
# ============================================================================
set -uo pipefail

APP=/var/www/xnow-rehearsal
BRANCH=feat/sites
PORT=3002
DB=xnow_rehearsal
LOG=/tmp/rehearsal.log

step() { echo ""; echo "──── $* ────"; }
die()  { echo "❌ $*"; exit 1; }

PROD_ENV=/var/www/xnow/server/.env
[ -f "$PROD_ENV" ] || die "找不到 $PROD_ENV"
PP=$(grep '^DB_PASS=' "$PROD_ENV" | cut -d= -f2-)

step "0. 清理上一次的演练环境"
OLDPID=$(ss -tlnp 2>/dev/null | grep ":$PORT" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1)
if [ -n "${OLDPID:-}" ]; then
  echo "  停掉占用 $PORT 的旧进程 $OLDPID"
  kill -9 "$OLDPID" 2>/dev/null || true
  sleep 2
fi

step "1. 复制生产库 → $DB（只读，不改生产）"
MYSQL_PWD="$PP" mysql -u root -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4;" || die "建库失败"
MYSQL_PWD="$PP" mysqldump -u root --single-transaction --routines xnow_db 2>/dev/null \
  | MYSQL_PWD="$PP" mysql -u root "$DB" || die "导入失败"
echo "  生产数据: $(MYSQL_PWD="$PP" mysql -N -u root "$DB" -e \
  "SELECT CONCAT('用户 ', (SELECT COUNT(*) FROM users), ' / 订单 ', (SELECT COUNT(*) FROM orders), \
  ' / 服务 ', (SELECT COUNT(*) FROM services), ' / sites 列数 ', \
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='$DB' AND table_name='sites'))" 2>/dev/null)"

step "2. 拉代码到 $APP"
rm -rf "$APP"
git clone -q --branch "$BRANCH" --depth 20 https://github.com/xiasummer740/xnow.git "$APP" || die "clone 失败"
echo "  提交: $(cd "$APP" && git log --oneline -1)"
cp -r /var/www/xnow-beta/server/node_modules "$APP/server/" 2>/dev/null && echo "  复用 Beta 的 node_modules"
sed -e "s/^DB_NAME=.*/DB_NAME=$DB/" -e "s/^PORT=.*/PORT=$PORT/" \
  /var/www/xnow-beta/server/.env > "$APP/server/.env"

step "3. 启动新代码（端口 $PORT）"
cd "$APP/server" || die "目录不存在"
nohup node src/app.js > "$LOG" 2>&1 &
for i in $(seq 1 60); do
  grep -q "running on port" "$LOG" 2>/dev/null && { echo "  ✅ 第 ${i} 秒启动成功"; break; }
  sleep 1
done
grep -q "running on port" "$LOG" || { echo "  ❌ 起不来，日志尾部："; tail -12 "$LOG" | sed 's/^/     /'; }

step "4. 自动补列结果（关键：生产形态的库会补 44 列）"
grep -E "\[migrate\] 自动补列完成" "$LOG" | sed 's/^/  /'
grep -cE "\[migrate\].*已补上" "$LOG" | sed 's/^/  本次补列条数: /'
MYSQL_PWD="$PP" mysql -N -u root "$DB" -e \
  "SELECT CONCAT('  sites 列数: ', COUNT(*)) FROM information_schema.columns WHERE table_schema='$DB' AND table_name='sites'" 2>/dev/null
MYSQL_PWD="$PP" mysql -N -u root "$DB" -e "SHOW COLUMNS FROM orders" 2>/dev/null \
  | awk '{print $1}' | grep -E "^(site_id|site_cost)$" | tr '\n' ' ' | sed 's/^/  orders 必备新列: /'
echo ""

step "5. 只读功能验证"
B="http://127.0.0.1:$PORT"
echo -n "  公开配置: "; curl -sS -m 8 "$B/api/public/config" | head -c 60; echo ""
echo -n "  服务列表: "; curl -sS -m 25 "$B/api/services/public" -o /tmp/r_svc.json -w "%{http_code}"; \
  python3 -c "import json;d=json.load(open('/tmp/r_svc.json'));r=d.get('data',[]);print(f' / {len(r)} 个服务 / 泄漏rate={\"rate\" in (r[0] if r else {})}')" 2>/dev/null || echo ""
cd "$APP/server" || exit 1
cat > /tmp/mk-tok-rehearse.mjs <<'JS'
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import { User } from './src/models/index.js';
const env = fs.readFileSync(new URL('./.env', import.meta.url), 'utf8');
const secret = (env.match(/^JWT_SECRET=(.*)$/m) || [])[1].trim();
const u = await User.findOne({ where: { role: 'admin' } });
if (!u) { console.log('  找不到管理员'); process.exit(0); }
fs.writeFileSync('/tmp/tok-rehearse.txt', jwt.sign({ id: u.id, role: u.role }, secret, { expiresIn: '1h' }));
console.log(`  用生产管理员 uid=${u.id} 签发令牌`);
process.exit(0);
JS
cp /tmp/mk-tok-rehearse.mjs . && node mk-tok-rehearse.mjs && rm -f mk-tok-rehearse.mjs
TOK=$(cat /tmp/tok-rehearse.txt 2>/dev/null || true)
if [ -n "${TOK:-}" ]; then
  echo -n "  订单历史: "; curl -sS -m 10 -H "Authorization: Bearer $TOK" "$B/api/orders" -o /tmp/r_ord.json; \
    python3 -c "
import json;d=json.load(open('/tmp/r_ord.json'));r=d.get('data') or []
leak=[k for k in (r[0] if r else {}) if k in ('upstream_charge','site_cost')]
print(f\"status={d.get('status')} / {len(r)} 条 / 成本字段泄漏={leak}\")" 2>/dev/null
  echo -n "  分站列表: "; curl -sS -m 10 -H "Authorization: Bearer $TOK" "$B/api/sites" | head -c 60; echo ""
fi

step "6. SQL 报错检查"
n=$(grep -icE "unknown column|ER_BAD_FIELD" "$LOG" || true)
if [ "$n" = "0" ]; then echo "  ✅ 0 个 SQL 报错"; else echo "  ❌ 有 $n 个 SQL 报错："; grep -iE "unknown column|ER_BAD_FIELD" "$LOG" | head -5 | sed 's/^/     /'; fi

step "7. 清理（停进程 + 删演练库；日志保留在 $LOG）"
PID=$(ss -tlnp 2>/dev/null | grep ":$PORT" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1)
[ -n "${PID:-}" ] && kill -9 "$PID" 2>/dev/null
MYSQL_PWD="$PP" mysql -u root -e "DROP DATABASE IF EXISTS $DB" 2>/dev/null
echo "  已清理。演练目录 $APP 保留，可重复执行本脚本。"
echo ""
echo "结论：上方「自动补列完成 + 0 个 SQL 报错 + 订单/分站接口正常」= 可以上线。"
