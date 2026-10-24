#!/bin/bash
# ============================================================================
# XNOW 分站体系：生产部署脚本（69 期编写，**尚未对生产执行过**）
#
# 用法（祥哥验收通过、说「可以上」之后才跑）：
#   ssh xnow-vps 'bash /tmp/deploy-prod.sh'
#
# 设计原则：
#   1. 每一步都可单步回滚，失败立刻停，不留半成品状态；
#   2. 动生产之前先把"三样东西"备份好：数据库 / 前端 dist / nginx 配置；
#   3. 数据库先迁移再重启 —— 顺序反了会因为 Unknown column 直接 500。
# ============================================================================
set -uo pipefail

APP=/var/www/xnow
BETA=/var/www/xnow-beta
BRANCH=feat/sites
TS=$(date +%Y%m%d-%H%M%S)
BAK=${XNOW_BACKUP_DIR:-/var/backups/xnow}/$TS

cd "$APP" || { echo "❌ 找不到 $APP"; exit 1; }
DBP=$(grep '^DB_PASS=' "$APP/server/.env" | cut -d= -f2-)

step() { echo ""; echo "──── $* ────"; }
die()  { echo "❌ $*"; echo "   备份在 $BAK（可从那里恢复）"; exit 1; }

step "0. 前置检查"
echo "  当前分支: $(git rev-parse --abbrev-ref HEAD)"
echo "  当前提交: $(git log --oneline -1)"
echo "  生产分站数: $(MYSQL_PWD="$DBP" mysql -N -u root xnow_db -e 'SELECT COUNT(*) FROM sites' 2>/dev/null)"
echo "  生产用户/订单: $(MYSQL_PWD="$DBP" mysql -N -u root xnow_db -e 'SELECT CONCAT((SELECT COUNT(*) FROM users)," / ",(SELECT COUNT(*) FROM orders))' 2>/dev/null)"
echo "  pm2 状态: $(pm2 jlist 2>/dev/null | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
    print(", ".join(f"{x[\"name\"]}={x[\"pm2_env\"][\"status\"]}" for x in d))
except Exception: print("读不到")' 2>/dev/null)"

step "1. 备份（数据库 + 前端 + nginx + 代码快照）"
mkdir -p "$BAK" || die "备份目录建不出来"
# 🔴 74 期：备份必须有两种命名，缺一不可 ——
#    BAK/<时间戳>/...            人看得懂的目录（祥哥要看也能找到）
#    prod-<时间戳>.sql.gz 等      rollback-sites.sh 认这套名字
# 只产出前一种时，回滚脚本会报"备份文件不存在" —— 最要紧的退路等于断的。
ROLLBACK_BAK="${XNOW_BACKUP_DIR:-/var/backups/xnow}"
STAMP="$TS"   # 与上面备份目录用同一个时间戳，别让两边差一秒对不上
MYSQL_PWD="$DBP" mysqldump -u root --single-transaction --routines xnow_db > "$BAK/xnow_db.sql" 2>/dev/null \
  || die "数据库备份失败（不要继续）"
gzip -c "$BAK/xnow_db.sql" > "$ROLLBACK_BAK/prod-$STAMP.sql.gz" \
  || die "数据库备份压缩失败（不要继续）"
git rev-parse HEAD > "$ROLLBACK_BAK/prod-$STAMP.head" 2>/dev/null
echo "  ✅ 数据库 → $BAK/xnow_db.sql"
echo "  ✅ 回滚脚本可用 → $ROLLBACK_BAK/prod-$STAMP.sql.gz（锚点 $(cat "$ROLLBACK_BAK/prod-$STAMP.head" 2>/dev/null | cut -c1-8)）"
# 代码快照（生产目录不是 git 仓库的可能性要兜住；有快照就一定能回滚）
# 快照里必须带上 client/dist —— 前端炸掉是最常见的失败形态之一，
# 回滚脚本只会展开这个 tar，不把 dist 放进去，回滚完页面还是坏的。
tar czf "$ROLLBACK_BAK/prod-$STAMP-code.tar.gz" -C "$APP" server/src server/scripts client/dist 2>/dev/null \
  && echo "  ✅ 代码+前端快照 → $ROLLBACK_BAK/prod-$STAMP-code.tar.gz ($(du -h "$ROLLBACK_BAK/prod-$STAMP-code.tar.gz" | cut -f1))"
tar czf "$BAK/client-dist.tgz" -C "$APP" client/dist 2>/dev/null && echo "  ✅ 前端 dist → $BAK/client-dist.tgz"
tar czf "$BAK/nginx-sites.tgz" -C /etc/nginx sites-enabled 2>/dev/null && echo "  ✅ nginx 配置 → $BAK/nginx-sites.tgz"
cp "$APP/server/.env" "$BAK/server.env" 2>/dev/null && echo "  ✅ server/.env → $BAK/server.env"

step "2. 拉代码（$BRANCH）"
git fetch origin "$BRANCH" || die "fetch 失败"
git checkout "$BRANCH" || die "切分支失败"
git pull --ff-only origin "$BRANCH" || die "拉代码失败"
echo "  现在提交: $(git log --oneline -1)"

step "3. 数据库迁移（必须在重启之前）"
# ⚠️ migrate-sites.sql 被 .gitignore 的 *.sql 忽略，git pull 不会带过来。
#    真正兜底的是 server/src/app.js 里那几条 try/catch 的 ALTER TABLE（每次启动都会补列）。
#    所以这里文件不存在时只提示、不算失败。
if [ ! -f "$APP/deploy/sites/migrate-sites.sql" ]; then
  echo "  迁移文件不存在（被 gitignore），跳过 SQL 迁移 —— 由 app.js 启动时自动补列"
elif MYSQL_PWD="$DBP" mysql -u root xnow_db < "$APP/deploy/sites/migrate-sites.sql" 2>/tmp/migrate-prod.err; then
  echo "  ✅ 迁移成功（可重复执行，本次是幂等的）"
else
  echo "  迁移报错，详见 /tmp/migrate-prod.err:"
  head -5 /tmp/migrate-prod.err | sed 's/^/     /'
  echo "  ⚠️ 注意：ADD COLUMN 是幂等的，报错通常只是个别语句；先确认字段是否已补齐再决定是否继续"
  MYSQL_PWD="$DBP" mysql -N -u root xnow_db -e "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='xnow_db' AND TABLE_NAME='sites'" | sed 's/^/     sites 现有列数: /'
  die "迁移未干净完成，人工确认后再继续"
fi

step "4. 依赖 + 前端构建"
cd "$APP/server" && npm install --omit=dev --no-audit --no-fund >/tmp/npm-server.log 2>&1 || die "server npm install 失败"
echo "  ✅ 后端依赖"
cd "$APP/client" && npm install --no-audit --no-fund >/tmp/npm-client.log 2>&1 || die "client npm install 失败"
npx vite build >/tmp/vite-prod.log 2>&1 || die "前端构建失败"
node scripts/prerender.mjs >>/tmp/vite-prod.log 2>&1 || die "预渲染失败"
node scripts/subsites-html.mjs >>/tmp/vite-prod.log 2>&1 || die "分站 HTML 生成失败"
[ -f "$APP/client/dist/site.html" ] || die "dist 里没有 site.html —— 直接上线会让所有分站空白，已中止"
[ -f "$APP/client/dist/index.html" ] || die "dist 里没有 index.html，已中止"
echo "  ✅ 构建完成（site.html / index.html 都在）"

step "5. 重启后端"
pm2 restart xnow-backend --update-env >/dev/null 2>&1 || die "重启失败"
sleep 6
if curl -sS -o /dev/null -w '%{http_code}' --max-time 20 https://127.0.0.1/api/public/config -k 2>/dev/null | grep -q 200; then
  echo "  ✅ 后端起来了（/api/public/config 返回 200）"
else
  echo "  ❌ 后端没起来，看日志："
  pm2 logs xnow-backend --lines 20 --nostream 2>/dev/null | tail -20 | sed 's/^/     /'
  echo "  回滚方式：git checkout 上一个提交 && pm2 restart xnow-backend"
  echo "  或者整库还原：mysql xnow_db < $BAK/xnow_db.sql"
  die "后端启动失败"
fi

step "6. 堵住「未知子域名落到 Beta 实例」的坑（只影响未知 Host）"
if [ -f "$APP/deploy/sites/fix-unknown-host.sh" ]; then
  # 🔑 74 期：让新域名能签下证书。默认 80 段必须"先放行挑战再跳转"，
#    否则站长绑自有域名时证书永远签不下来（只能退回自签，浏览器报警告）。
bash "$APP/deploy/sites/fix-acme-webroot.sh" || echo "  ⚠️ ACME 挑战路径没修好 —— 自有域名的自动证书会签不下来，请人工看一眼"

bash "$APP/deploy/sites/fix-unknown-host.sh" || echo "  ⚠️ 这一步没成功，主站不受影响，但要人工看一眼（回滚见脚本末尾提示）"
else
  echo "  跳过：脚本不在"
fi

step "7. 上线后自检"
for u in https://xnow.taikon.top/ https://xnow.taikon.top/api/public/config; do
  code=$(curl -o /dev/null -sS -w '%{http_code}' --max-time 25 "$u" 2>/dev/null)
  echo "  $u → $code"
  [ "$code" = "200" ] || echo "     ⚠️ 非 200，需要看 pm2 日志"
done
echo "  生产分站数: $(MYSQL_PWD="$DBP" mysql -N -u root xnow_db -e 'SELECT COUNT(*) FROM sites' 2>/dev/null)"
echo "  生产用户/订单: $(MYSQL_PWD="$DBP" mysql -N -u root xnow_db -e 'SELECT CONCAT((SELECT COUNT(*) FROM users)," / ",(SELECT COUNT(*) FROM orders))' 2>/dev/null)"

echo ""
echo "════════════════════════════════════════"
echo "✅ 部署完成。备份: $BAK"
echo ""
echo "最省事的回滚（推荐，脚本已就绪）:"
echo "  bash $APP/deploy/sites/rollback-sites.sh --env prod --stamp $STAMP"
echo ""
echo "手动回滚办法（四选一，都在 $BAK 里）:"
echo "  1) 只回滚代码:  cd $APP && git checkout <上一个提交> && pm2 restart xnow-backend"
echo "  2) 回滚数据库:  MYSQL_PWD=... mysql -u root xnow_db < $BAK/xnow_db.sql"
echo "  3) 回滚前端:    tar xzf $BAK/client-dist.tgz -C $APP"
echo "  4) 回滚 nginx:  tar xzf $BAK/nginx-sites.tgz -C /etc/nginx && nginx -s reload"
echo "════════════════════════════════════════"
