#!/bin/bash
# ============================================================================
# XNOW 分站体系：生产部署脚本（69 期编写，**尚未对生产执行过**）
#
# 用法（祥哥验收通过、说「可以上」之后才跑）：
#   ① 先演练（只读，什么都不改）：
#        ssh xnow-vps 'XNOW_DRY_RUN=1 bash /tmp/deploy-prod.sh'
#   ② 确认无误后正式上线：
#        ssh xnow-vps 'bash /tmp/deploy-prod.sh'
#
# ⚠️ 生产在 main 分支、没有 deploy/ 目录，所以脚本不能"就地跑"，
#    要用 deploy/sites/go-live.sh 把本脚本从分支里取出来再跑（见那个文件）。
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
# pm2 的表格带 Unicode 竖线，直接 awk 取列不可靠 —— 落成 json 再解析
pm2 jlist > /tmp/xnow-pm2.json 2>/dev/null
echo "  pm2 状态: $(python3 - <<'PY' 2>/dev/null
import json
try:
    d = json.load(open('/tmp/xnow-pm2.json'))
    print("  ".join("%s=%s" % (x.get("name"), (x.get("pm2_env") or {}).get("status")) for x in d))
except Exception:
    print("读不到")
PY
)"

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

# 🌐 91 期：自有域名的两处依赖 SERVER_PUBLIC_IP（告诉站长 A 记录指向哪 + DNS 校验比对值）。
#   代码里有兜底（读 configs.server_public_ip），但生产 .env 从来没这个键 ——
#   不补的话上线后站长绑自有域名只能走 TXT 校验，体验差一截。
#   取法用本机路由（不发外网请求，机器不通外网也能取到），并且幂等：已有就不动。
if grep -q '^SERVER_PUBLIC_IP=' "$APP/server/.env" 2>/dev/null; then
  echo "  ✅ server/.env 已有 SERVER_PUBLIC_IP=$(grep '^SERVER_PUBLIC_IP=' "$APP/server/.env" | cut -d= -f2-)"
else
  DETECT_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')
  [ -z "$DETECT_IP" ] && DETECT_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [ "${XNOW_DRY_RUN:-0}" = "1" ]; then
    echo "  [dry-run] 会往 server/.env 追加 SERVER_PUBLIC_IP=${DETECT_IP:-（没取到）}（自有域名解析与校验要用）"
  elif [ -n "$DETECT_IP" ]; then
    printf '\n# 分站自有域名：A 记录目标 + DNS 归属校验（91 期自动补）\nSERVER_PUBLIC_IP=%s\n' "$DETECT_IP" >> "$APP/server/.env"
    echo "  ✅ server/.env 补上 SERVER_PUBLIC_IP=$DETECT_IP"
  else
    echo "  ⚠️ 没取到本机公网 IP —— 自有域名将只能走 TXT 校验（不影响上线）"
  fi
fi

step "2. 拉代码（$BRANCH）"
git fetch origin "$BRANCH" || die "fetch 失败"

# 🔴 81 期：切分支/拉代码最容易被两件事卡死，必须先清理 ——
#   ① 已跟踪文件被手工改过 → git checkout 拒绝（Your local changes would be overwritten）
#   ② 未跟踪文件与分支同名 → git pull 报（untracked working tree files would be overwritten）
#   生产上这两种都真实存在（5 个路由文件 + client/public/usdt-guide.jpg）。
#   做法：先原样备份到 $BAK/preflight/，再清理；备份留着，随时能捡回来。
PREFLIGHT="$BAK/preflight"
CHANGED=$(git diff --name-only)
if [ -n "$CHANGED" ]; then
  echo "  ⚠️ 生产有 $(echo "$CHANGED" | wc -l) 个已跟踪文件被手工改过（备份后还原）："
  echo "$CHANGED" | while read -r f; do
    [ -z "$f" ] && continue
    if [ -f "$f" ]; then
      mkdir -p "$PREFLIGHT/tracked/$(dirname "$f")"
      cp -p "$f" "$PREFLIGHT/tracked/$f"
    fi
    echo "     · $f"
  done
  # 🔍 98 期：把「生产独有、分支没有」的代码行摊开来看。
  #    上线会用分支版本覆盖工作区 —— 万一生产上有**未入库的 hotfix**，
  #    这里就是唯一能提前发现它的地方（89 期演练就靠这个核对了 5 个文件）。
  DIFF_OUT="$PREFLIGHT/prod-vs-branch.diff"
  mkdir -p "$PREFLIGHT"
  # 只看运行时代码（server/src、client/src）——文档/构建产物不构成覆盖风险，
  # 混进来会把真正要看的那几行淹掉（实测 343 行里绝大多数是 README/文档）。
  # 只核对后端运行时代码：前端以构建产物 dist 上线，工作区的 client/src 不参与运行；
  # 混进来会把「分支正常重构」误报成风险（实测 301 行里绝大多数是旧 App.vue）。
  SCOPE="server/src"
  git diff --ignore-cr-at-eol "origin/$BRANCH" -- $SCOPE > "$DIFF_OUT" 2>/dev/null
  ONLY=$(git diff --ignore-cr-at-eol "origin/$BRANCH" -- $SCOPE 2>/dev/null \
        | grep -E "^\+" | grep -v "^++" | grep -vE "^\+\s*(//|\*|$)" | wc -l)
  echo "  🔍 生产独有代码行（分支里没有的）：${ONLY} 行 → 明细 $DIFF_OUT"
  if [ "${ONLY:-0}" -gt 0 ]; then
    echo "     ⚠️ 上线将用分支版本覆盖这些行，务必确认它们已被分支包含（或确实该删）："
    git diff --ignore-cr-at-eol "origin/$BRANCH" -- $SCOPE 2>/dev/null \
      | grep -E "^\+" | grep -v "^++" | grep -vE "^\+\s*(//|\*|$)" \
      | head -6 | sed 's/^/        /'
    echo "        （完整清单见 $DIFF_OUT；逐条核对记录见 deploy/sites/ACCEPTANCE.md §四十一）"
  fi

  # 🔒 98 期：除了 cp 备份，再存成 git stash ——
  #    cp 备份只保留文件内容，stash 能保留「相对 HEAD 的完整差异」，
  #    恢复时一条 `git stash pop` 就能原样回来，不依赖人记得哪个目录。
  if [ "${XNOW_DRY_RUN:-0}" = "1" ]; then
    echo "     [dry-run] 会把上述手工改动存为 git stash（多一层可还原保险），不执行"
  else
    if git -c user.name=xnow-deploy -c user.email=deploy@localhost \
         stash push -q -m "pre-go-live $(date +%F_%H%M%S)" -- . 2>/dev/null; then
      echo "     ✅ 已存为 git stash：$(git stash list | head -1 | cut -c1-60)"
      echo "        （要还原：cd $APP && git stash pop）"
    else
      git checkout -- . || die "还原工作区失败"
    fi
  fi
fi

COLLIDE=$(git ls-files --others --exclude-standard)
if [ -n "$COLLIDE" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    git cat-file -e "origin/$BRANCH:$f" 2>/dev/null || continue   # 只处理"分支里也有"的
    local_sha=$(sha1sum "$f" 2>/dev/null | cut -d' ' -f1)
    branch_sha=$(git cat-file -p "origin/$BRANCH:$f" | sha1sum | cut -d' ' -f1)
    if [ "${XNOW_DRY_RUN:-0}" = "1" ]; then
      if [ "$local_sha" = "$branch_sha" ]; then
        echo "     [dry-run] 会删除未跟踪文件 $f（与分支同内容，无损）"
      else
        echo "     [dry-run] 会备份并删除未跟踪文件 $f（⚠️ 内容与分支不同）"
      fi
      continue
    fi
    mkdir -p "$PREFLIGHT/untracked/$(dirname "$f")"
    cp -p "$f" "$PREFLIGHT/untracked/$f" 2>/dev/null
    rm -f "$f"
    if [ "$local_sha" = "$branch_sha" ]; then
      echo "     🧹 删除未跟踪文件 $f（与分支同内容，无损）"
    else
      echo "     🧹 删除未跟踪文件 $f（⚠️ 内容与分支不同，已备份到 $PREFLIGHT/untracked/$f）"
    fi
  done <<< "$COLLIDE"
fi

if [ "${XNOW_DRY_RUN:-0}" = "1" ]; then
  echo ""
  echo "  [dry-run] 到此处为止：应用目录一个字节都没动（上面第 1 步的备份是新增文件，无害且有用）。"
  echo "  [dry-run] 备份目录（本次未创建）会是：$PREFLIGHT"
  exit 0
fi

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

step "6. 未知子域名兜底（只影响未知 Host，95 期）"
if [ -f "$APP/deploy/sites/deploy-catchall.sh" ]; then
  # 🔑 74 期：让新域名能签下证书。默认 80 段必须"先放行挑战再跳转"，
#    否则站长绑自有域名时证书永远签不下来（只能退回自签，浏览器报警告）。
bash "$APP/deploy/sites/fix-acme-webroot.sh" || echo "  ⚠️ ACME 挑战路径没修好 —— 自有域名的自动证书会签不下来，请人工看一眼"

# 🛡 95 期：未分配 / 已删除的分站域名以前会落到主站（实测 19 处 XNOW），
#    等于把平台暴露给分站客户。现在统一返回中性 404；
#    同时去掉 Beta 的 *.xnow.taikon.top 通配，避免未知域名串到 Beta 的库。
#    ⚠️ 旧脚本 fix-unknown-host.sh（70 期写的、从未执行）已被本步骤取代。
bash "$APP/deploy/sites/deploy-catchall.sh" || echo "  ⚠️ 兜底没装上，主站不受影响，但未知域名仍会显示主站 —— 请人工看一眼"
else
  echo "  跳过：deploy-catchall.sh 不在"
fi

step "7. 上线后自检"
# 未分配域名必须 404（不能是主站）—— 顺带兜住"删站后旧域名暴露平台"的场景
UNK="deploy-probe-$RANDOM.taikon.top"
unkcode=$(curl -o /dev/null -sS -w '%{http_code}' --max-time 20 --resolve "$UNK:443:127.0.0.1" "https://$UNK/" 2>/dev/null)
echo "  未分配域名 $UNK → $unkcode $([ "$unkcode" = 404 ] && echo '✅ 中性 404' || echo '⚠️ 应为 404')"
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
