#!/bin/bash
# ============================================================================
# XNOW 上线演练 · 深度版：在生产数据形态上**真下一单**（84 期）
#
# rehearse.sh 只做只读检查；本脚本更进一步，把两条下单链路真正跑通：
#   ① 主站客户下单        → 校验 charge / upstream_charge / site_cost=0 / site_id=0
#   ② 分站客户下单        → 校验 site_id=1、站长成本按「成本倍率」扣、买卖双方余额
#
# 安全边界（很重要）：
#   · 用生产库的**副本**，全程不写生产
#   · 上游指向本地假服务器 127.0.0.1:4001，绝不碰真实上游
#   · 演练库里的 TG 配置被清空，不会给祥哥发假订单通知
#   · 跑完自动停进程 + 删演练库
#
# 用法：bash rehearse-order.sh
# ============================================================================
set -uo pipefail

APP=/var/www/xnow-rehearsal
PORT=3002
MOCK=4001
DB=xnow_rehearsal
LOG=/tmp/rehearsal-order.log
MOCKLOG=/tmp/mock-upstream.log

step() { echo ""; echo "──── $* ────"; }
die()  { echo "❌ $*"; exit 1; }
PASS=0; FAIL=0
chk() { # chk "说明" "实际" "期望"
  if [ "$2" = "$3" ]; then echo "  ✅ $1: $2"; PASS=$((PASS+1));
  else echo "  ❌ $1: 实际=$2 期望=$3"; FAIL=$((FAIL+1)); fi
}

PROD_ENV=/var/www/xnow/server/.env
[ -f "$PROD_ENV" ] || die "找不到 $PROD_ENV"
PP=$(grep '^DB_PASS=' "$PROD_ENV" | cut -d= -f2-)

cleanup() {
  step "清理"
  for p in "$PORT" "$MOCK"; do
    PID=$(ss -tlnp 2>/dev/null | grep ":$p" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1)
    [ -n "${PID:-}" ] && kill -9 "$PID" 2>/dev/null
  done
  MYSQL_PWD="$PP" mysql -u root -e "DROP DATABASE IF EXISTS $DB" 2>/dev/null
  echo "  已停进程、删除演练库。日志：$LOG / $MOCKLOG"
}
trap cleanup EXIT

step "1. 准备演练库（生产库副本）"
for p in "$PORT" "$MOCK"; do
  PID=$(ss -tlnp 2>/dev/null | grep ":$p" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1)
  [ -n "${PID:-}" ] && kill -9 "$PID" 2>/dev/null
done
sleep 1
MYSQL_PWD="$PP" mysql -u root -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4;" || die "建库失败"
MYSQL_PWD="$PP" mysqldump -u root --single-transaction --routines xnow_db 2>/dev/null \
  | MYSQL_PWD="$PP" mysql -u root "$DB" || die "导入失败"
echo "  生产数据：$(MYSQL_PWD="$PP" mysql -N -u root "$DB" -e \
  "SELECT CONCAT('用户 ',(SELECT COUNT(*) FROM users),' / 订单 ',(SELECT COUNT(*) FROM orders),' / 服务 ',(SELECT COUNT(*) FROM services))" 2>/dev/null)"

[ -d "$APP/server" ] || die "$APP 不存在，请先跑 rehearse.sh"

step "2. 造假上游（127.0.0.1:$MOCK）"
cat > /tmp/mock-upstream.mjs <<'JS'
import http from 'node:http';
http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    console.log(`[mock] ${req.method} ${req.url} ${body.slice(0, 100)}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ order: 987654321 }));
  });
}).listen(4001, '127.0.0.1', () => console.log('[mock] ready :4001'));
JS
nohup node /tmp/mock-upstream.mjs > "$MOCKLOG" 2>&1 &
sleep 2
chk "假上游就绪" "$(curl -sS -m 3 -o /dev/null -w '%{http_code}' -X POST -d 'k=1' http://127.0.0.1:$MOCK/api/v2)" "200"

step "3. 先启动一次让迁移跑完（生产形态的库要补 44 列）"
cd "$APP/server" || die "目录不存在"
nohup node src/app.js > "$LOG" 2>&1 &
for i in $(seq 1 60); do grep -q "running on port" "$LOG" 2>/dev/null && break; sleep 1; done
grep -q "running on port" "$LOG" || { tail -10 "$LOG" | sed 's/^/  /'; die "启动失败"; }
grep -E "\[migrate\] 自动补列完成" "$LOG" | sed 's/^/  /'

step "3.5 造分站、客户、上游配置（必须在补列之后，否则 sites 还没有 template 列）"
MYSQL_PWD="$PP" mysql -u root "$DB" -e "
UPDATE configs SET value='' WHERE \`key\` IN ('tg_bot_token','tg_chat_id');
DELETE FROM configs WHERE \`key\` IN ('upstream_url','upstream_key');
INSERT INTO configs (\`key\`, \`value\`, created_at, updated_at) VALUES
  ('upstream_url','http://127.0.0.1:$MOCK/api/v2',NOW(),NOW()),
  ('upstream_key','mock-key-84',NOW(),NOW());
DELETE FROM sites;
INSERT INTO sites (id, owner_id, domain, name, multiplier, agent_discount, status, template, color,
                   support_url, discount_rate, discount_until, created_at, updated_at)
VALUES (1, 1, 'rs.local', '演练分站', 5, 0.8, 'active', 'minimal', 'purple',
        'https://t.me/test_support', 0.9, 0, NOW(), NOW());
DELETE FROM users WHERE id=99;
INSERT INTO users (id, phone, password_hash, role, balance, created_at, updated_at)
VALUES (99, '13900000084', 'x', 'user', 50, NOW(), NOW());
UPDATE users SET balance='100.000000' WHERE id=1;
" 2>&1 | sed 's/^/  /'
chk "分站已入库" "$(MYSQL_PWD="$PP" mysql -N -u root "$DB" -e "SELECT COUNT(*) FROM sites WHERE id=1" 2>/dev/null)" "1"
chk "客户已入库" "$(MYSQL_PWD="$PP" mysql -N -u root "$DB" -e "SELECT COUNT(*) FROM users WHERE id=99" 2>/dev/null)" "1"

step "3.6 重启一次（分站缓存 TTL 60 秒，直连改库不清缓存）"
PID=$(ss -tlnp 2>/dev/null | grep ":$PORT" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1)
[ -n "${PID:-}" ] && kill -9 "$PID" 2>/dev/null
sleep 2
nohup node src/app.js > "$LOG" 2>&1 &
for i in $(seq 1 60); do grep -q "running on port" "$LOG" 2>/dev/null && break; sleep 1; done
grep -q "running on port" "$LOG" || { tail -10 "$LOG" | sed 's/^/  /'; die "重启失败"; }
echo "  已重启，分站缓存已刷新"

step "4. 签发令牌（管理员 uid=1 / 分站客户 uid=99）"
cat > mk-token-rehearse.mjs <<'JS'
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import { User } from './src/models/index.js';
const env = fs.readFileSync(new URL('./.env', import.meta.url), 'utf8');
const secret = (env.match(/^JWT_SECRET=(.*)$/m) || [])[1].trim();
for (const [id, out] of [[1, '/tmp/tok-admin.txt'], [99, '/tmp/tok-cust.txt']]) {
  const u = await User.findByPk(id);
  if (u) fs.writeFileSync(out, jwt.sign({ id: u.id, role: u.role }, secret, { expiresIn: '1h' }));
}
console.log('  令牌已签发');
process.exit(0);
JS
node mk-token-rehearse.mjs 2>&1 | head -2; rm -f mk-token-rehearse.mjs
TOKA=$(cat /tmp/tok-admin.txt); TOKC=$(cat /tmp/tok-cust.txt)
B="http://127.0.0.1:$PORT"

step "5. 选服务（挑一个最小 100、价格便宜的）"
curl -sS -m 25 "$B/api/services/public" -o /tmp/r-svc.json
read SID SPRICE <<< "$(python3 -c "
import json
rows = json.load(open('/tmp/r-svc.json')).get('data') or []
c = [r for r in rows if (r.get('min') or 0) <= 100 and 0 < (r.get('sell_price') or 0) < 5] or rows
r = c[0]
print(r['service'], r['sell_price'])
")"
chk "主站列表价 > 0" "$(python3 -c "print(1 if $SPRICE > 0 else 0)")" "1"

step "6. ① 主站下单"
R1=$(curl -sS -m 25 -H "Authorization: Bearer $TOKA" -H 'Content-Type: application/json' \
  -X POST --data "{\"serviceId\":$SID,\"link\":\"https://instagram.com/rehearse_main\",\"quantity\":100}" \
  "$B/api/orders/add")
echo "  响应: $(echo "$R1" | head -c 90)"
chk "主站下单成交" "$(echo "$R1" | python3 -c "import sys,json;print(json.load(sys.stdin).get('status'))" 2>/dev/null)" "success"

step "7. ② 分站下单（Host: rs.local，倍率 5 × 9 折）"
R2=$(curl -sS -m 25 -H "Host: rs.local" -H "Authorization: Bearer $TOKC" -H 'Content-Type: application/json' \
  -X POST --data "{\"serviceId\":$SID,\"link\":\"https://instagram.com/rehearse_site\",\"quantity\":100}" \
  "$B/api/orders/add")
echo "  响应: $(echo "$R2" | head -c 90)"
chk "分站下单成交" "$(echo "$R2" | python3 -c "import sys,json;print(json.load(sys.stdin).get('status'))" 2>/dev/null)" "success"

step "8. 结算核对（数学必须自洽）"
read SITE_CHARGE SITE_UP SITE_COST SITE_ID MAIN_CHARGE MAIN_COST MAIN_ID <<< "$(MYSQL_PWD="$PP" mysql -N -u root "$DB" -e "
SELECT charge, upstream_charge, site_cost, site_id,
       (SELECT charge FROM orders WHERE site_id=0 ORDER BY id DESC LIMIT 1),
       (SELECT site_cost FROM orders WHERE site_id=0 ORDER BY id DESC LIMIT 1),
       (SELECT site_id FROM orders WHERE site_id=0 ORDER BY id DESC LIMIT 1)
FROM orders WHERE site_id=1 ORDER BY id DESC LIMIT 1" 2>/dev/null)"
chk "分站订单 site_id" "$SITE_ID" "1"
chk "主站订单 site_id" "$MAIN_ID" "0"
chk "主站订单 site_cost（应为 0）" "$(python3 -c "print(f'{float(\"$MAIN_COST\"):.4f}')")" "0.0000"
chk "分站订单 site_cost > 0" "$(python3 -c "print(1 if float('$SITE_COST')>0 else 0)")" "1"
# 客户看到的价 = 上游成本 × 分站倍率 × 折扣（与管理员的 1 倍无关）
chk "分站客户付款 = 上游成本 × 5 倍 × 9 折" "$(python3 -c "print(1 if abs(float('$SITE_CHARGE') - float('$SITE_UP')*5*0.9) < 1e-3 else 0)")" "1"
chk "站长成本 = 上游成本 × 2.0" "$(python3 -c "print(1 if abs(float('$SITE_COST') - float('$SITE_UP')*2.0) < 1e-4 else 0)")" "1"

BAL_C=$(MYSQL_PWD="$PP" mysql -N -u root "$DB" -e "SELECT balance FROM users WHERE id=99" 2>/dev/null)
BAL_O=$(MYSQL_PWD="$PP" mysql -N -u root "$DB" -e "SELECT balance FROM users WHERE id=1" 2>/dev/null)
echo "  客户余额 $BAL_C（50 起，扣 $SITE_CHARGE）"
echo "  站长余额 $BAL_O（100 起，扣主站单 $MAIN_CHARGE + 分站成本 $SITE_COST）"
chk "客户余额扣款正确" "$(python3 -c "print(1 if abs(float('$BAL_C') - (50-float('$SITE_CHARGE'))) < 1e-4 else 0)")" "1"
# 站长（uid1 既是管理员也是分站主）要扣两笔：自己下的主站单 + 分站这单的成本
chk "站长余额扣款正确" "$(python3 -c "print(1 if abs(float('$BAL_O') - (100-float('$MAIN_CHARGE')-float('$SITE_COST'))) < 1e-3 else 0)")" "1"

step "9. 上游真的被调到了吗"
grep -c "action=add" "$MOCKLOG" 2>/dev/null | sed 's/^/  假上游收到 action=add 次数: /'
chk "上游收到 2 次下单" "$(grep -c 'action=add' "$MOCKLOG" 2>/dev/null || echo 0)" "2"

step "10. SQL 报错"
N=$(grep -icE "unknown column|ER_BAD_FIELD" "$LOG" 2>/dev/null || true)
chk "SQL 报错数" "${N:-0}" "0"

step "结论"
echo "  通过 $PASS 项，失败 $FAIL 项"
[ "$FAIL" = "0" ] && echo "  ✅ 两条下单链路在生产数据形态上都能跑通 —— 可以上线" \
                   || echo "  ❌ 有失败项，先别上线"
