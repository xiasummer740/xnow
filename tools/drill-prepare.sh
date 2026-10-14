#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# 演练包制备器 —— 把一份【生产备份包】变成「外呼已掐死」的【演练包】
#
# 为什么需要它：备份包里是生产的真实数据 + 真实第三方凭证。演练机后端一启动
# （install.sh 灌完数据后立刻 `pm2 start`，中间没有钩子），这些定时任务就会
# 拿着真凭证往外打：
#     启动 3 秒  → autoSyncServices      打上游 API（upstream_url + upstream_key）
#     启动 30 秒 → autoSyncAnnouncement  【真登录】上游面板（login_user/pass）
#     启动 60 秒 → autoSyncOrders        打上游 API 查订单
#     启动 2 分钟→ reconcilePayments     打 bufpay.com（**无需密钥**，清配置挡不住）
#     启动 5 分钟→ nginxWatch            往真实 TG 群推告警
# 3 秒就开始，抢不过来 —— 所以隔离必须**在数据落地那一刻就已经写进数据里**。
# 本脚本的做法：在备份包 SQL 的副本**末尾追加一段显式 UPDATE**，导入时自然生效。
#
# 用法：bash drill-prepare.sh <生产备份包.tar.gz> <输出目录（必须在仓库外）>
#
# ⚠️ 本脚本**不连接任何服务器**，只读写本地文件。但它产出的是**全量真实用户数据**，
#    所以输出目录**硬性禁止落在 git 仓库内**（仓库是 PUBLIC，一次 `git add -A` 就是事故）。
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

fail() { echo "  ✗ $*" >&2; exit 1; }
warn() { echo "  ⚠ $*" >&2; }
ok()   { echo "  ✓ $*"; }

SRC="${1:-}"
OUTDIR="${2:-}"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SELF_DIR")"

[ -n "$SRC" ] || fail "用法: bash drill-prepare.sh <生产备份包.tar.gz> <输出目录（仓库外）>"
[ -n "$OUTDIR" ] || fail "必须显式指定输出目录，且必须在 git 仓库之外"
[ -f "$SRC" ] || fail "找不到备份包: $SRC"

ABS_SRC="$(readlink -f "$SRC")"
mkdir -p "$OUTDIR"
ABS_OUT="$(cd "$OUTDIR" && pwd)"

# ── 🚦 闸门 1：绝不碰生产路径 ───────────────────────────────────────────────
#    2026-10-14 的教训：彩排时 sed 漏替换一处，脚本写到了**真实生产路径**（那次靠运气没出事）。
#    所以这次不靠"记得替换"，靠一条硬拦。
case "$ABS_SRC" in
  /var/www/xnow/backups/*) fail "输入就在生产的备份目录里 —— 先 scp 到本机，别在原地改";;
esac
case "$ABS_OUT" in
  /var/www/xnow*)
    fail "输出目录指向生产路径：$ABS_OUT";;
esac

# ── 🚦 闸门 2：产出物绝不落在 git 仓库内（仓库 PUBLIC，里面是全量真实用户数据）──
case "$ABS_OUT" in
  "$REPO_ROOT"|"$REPO_ROOT"/*)
    fail "输出目录在 git 仓库内（$REPO_ROOT）！演练包含全量真实用户数据，必须放在仓库外";;
esac
case "$ABS_SRC" in
  "$REPO_ROOT"/*) fail "输入备份包在 git 仓库内 —— 立刻把它移出去（有被 push 的风险）";;
esac

echo ""
echo "════════ 演练包制备 ════════"
echo "  输入: $ABS_SRC"
echo "  输出: $ABS_OUT"
SRC_SHA="$(sha256sum "$ABS_SRC" | awk '{print $1}')"
ok "原件 sha256 = $SRC_SHA  （收尾时拿它核对原件没被动过）"

# ── 1. 拆包 ─────────────────────────────────────────────────────────────────
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
tar xzf "$ABS_SRC" -C "$TMP"
[ -f "$TMP/xnow_db.sql" ] || fail "包里没有 xnow_db.sql —— 不是本系统产出的备份"

echo ""
echo "── 包内容 ──"
SQL="$TMP/xnow_db.sql"
TABLES=$(grep -c '^CREATE TABLE' "$SQL" || true)
ok "xnow_db.sql  $(stat -c%s "$SQL") 字节  /  CREATE TABLE ×$TABLES"
HAS_PENDING=0
if [ -f "$TMP/pending_payments.json" ]; then
  HAS_PENDING=1
  PEND_N=$(grep -o '"order_id"' "$TMP/pending_payments.json" | wc -l | tr -d ' ')
  PEND_SHA="$(sha256sum "$TMP/pending_payments.json" | awk '{print $1}')"
  ok "pending_payments.json  补单 $PEND_N 条  sha256=${PEND_SHA:0:16}…（原件，收尾时核对）"
else
  warn "包里没有 pending_payments.json（那次备份时补单队列为空，属正常）"
fi

# ── 2. 侦测「配置表」的真实表名 ──────────────────────────────────────────────
#    ⚠️ 不能硬编码：Config 走 Sequelize 默认复数（Configs），而 sites/notifications
#    是显式小写表名。Linux MySQL 表名**大小写敏感**，猜错 = 隔离语句打在空气上、
#    还不报任何错 —— 那正是最危险的形态（演练机照样外呼，我们却以为隔离好了）。
CFG_TABLE="$(awk '
  /^INSERT INTO `/ { match($0, /`[^`]+`/); cur = substr($0, RSTART+1, RLENGTH-2) }
  index($0, "upstream_url") { if (cur != "") { print cur; exit } }
' "$SQL")"
[ -n "$CFG_TABLE" ] || fail "在备份包里找不到含 upstream_url 的表 —— 拒绝产出一个没隔离的包（不猜表名）"
ok "配置表真实表名侦测到 = 【$CFG_TABLE】"

# ── 3. 从包里取出上游主机名（给演练机 /etc/hosts 兜底）──────────────────────
#    在 mysqldump 里那行长这样：('upstream_url','https://host/api','说明')
UP_HOST="$(grep -oE "'upstream_url','https?://[^/']+" "$SQL" | head -1 | sed -E 's#.*//##' || true)"
if [ -n "$UP_HOST" ]; then ok "上游主机名 = $UP_HOST（演练机 /etc/hosts 要把它指到 127.0.0.1）"
else warn "没能从包里认出上游主机名 —— 演练机上请手动确认"; fi

# ── 4. 追加隔离段 ───────────────────────────────────────────────────────────
cat >> "$SQL" << SQLEOF

-- ══════════════════════════════════════════════════════════════════════════
-- 【演练专用 · 外呼隔离】本段由 tools/drill-prepare.sh 追加，**不是生产备份内容**。
-- 作用：把「对外拨号的号码」全部清空。代码里这些键为空时会**早退，不发起任何请求**：
--   utils/sync.js:9          upstream_url 空 → return（不查服务列表）
--   utils/orderSync.js:9     upstream_url 空 → return（不查订单状态）
--   utils/announceSync.js:52 upstream_url 空 → return（**不登录上游面板**）
--   utils/tgBot.js:11        tg_chat_id 空   → return（不往生产告警群发消息）
--   utils/email.js:21        smtp_pass 空    → 抛「SMTP配置缺失」（邮件发不出去）
-- 想还原成与生产逐字节一致的备份：把本段整段删掉即可。
-- ══════════════════════════════════════════════════════════════════════════
UPDATE \`$CFG_TABLE\` SET \`value\` = '' WHERE \`key\` IN (
  'upstream_url',         -- 一次掐死 3 条上游外呼
  'upstream_key',         -- 上游 API key
  'upstream_login_user',  -- 上游面板登录名（announceSync 会拿它做真实登录）
  'upstream_login_pass',  -- 上游面板登录密码
  'cryptomus_key',        -- USDT 查证
  'tg_bot_token',         -- TG 机器人钥匙（与 chat_id 一起空 = 绝不外发）
  'tg_chat_id',           -- 生产告警群
  'smtp_pass'             -- 邮件口令（验证码 / 备份邮件）
);
SQLEOF
ok "隔离段已追加（8 个配置键）"

# ── 5. 补单队列：清空副本 ───────────────────────────────────────────────────
#    reconcilePayments 会拿每条 pending 单去打 bufpay.com/api/query?order_id=xxx ——
#    那个接口**不需要密钥**，清配置挡不住它。所以把副本里的队列清空。
#    原件那份已另存，收尾时用 sha256 核对「没丢」。
if [ "$HAS_PENDING" = "1" ]; then
  mkdir -p "$OUTDIR/original"
  cp "$TMP/pending_payments.json" "$OUTDIR/original/pending_payments.json.orig"
  echo '[]' > "$TMP/pending_payments.json"
  ok "副本补单队列已清空为 []（原件另存 original/pending_payments.json.orig）"
fi

# ── 6. 重新打包 ─────────────────────────────────────────────────────────────
BASE="$(basename "$ABS_SRC" .tar.gz)"
DST="$OUTDIR/${BASE}.drill.tar.gz"
[ ! -e "$DST" ] || fail "输出已存在，先删或改名：$DST"
if [ "$HAS_PENDING" = "1" ]; then MEMBERS="xnow_db.sql pending_payments.json"; else MEMBERS="xnow_db.sql"; fi
( cd "$TMP" && tar czf "$DST" $MEMBERS )
ok "演练包已生成: $DST  ($(stat -c%s "$DST") 字节)"

# ── 7. 自检：隔离段真的在包里吗 ─────────────────────────────────────────────
if tar xzOf "$DST" xnow_db.sql | grep -q '演练专用 · 外呼隔离'; then
  ok "自检通过：隔离段确实在演练包内"
else
  fail "自检失败：演练包里没有隔离段 —— 别用这个包"
fi

# ── 8. 生成回读脚本（装完在演练机上跑，坐实隔离生效）────────────────────────
VERIFY="$OUTDIR/verify-isolation.sql"
printf 'SELECT `key`, LEFT(`value`,20) AS value_prefix FROM `%s`\nWHERE `key` IN (%s);\n' \
  "$CFG_TABLE" "'upstream_url','upstream_key','upstream_login_user','upstream_login_pass','cryptomus_key','tg_bot_token','tg_chat_id','smtp_pass'" > "$VERIFY"
ok "回读脚本已生成: $VERIFY"

cat << REPORT

──────── 演练机上要做的两条兜底（在跑 install.sh 之前）────────
① DNS 层再掐一道（不依赖 SQL 隔离是否生效 —— 纵深防御）：
     cat >> /etc/hosts <<'EOF'
     127.0.0.1 ${UP_HOST:-<请手动填上游主机名>}
     127.0.0.1 api.telegram.org
     127.0.0.1 bufpay.com
     127.0.0.1 api.cryptomus.com
     EOF
② 装完立刻回读，坐实隔离真的生效（不生效就地 pm2 stop xnow-backend）：
     mysql -N xnow_db < verify-isolation.sql
     期望：8 行的 value_prefix 全部为空

原件 sha256（收尾核对，确认原件没被动过）：
     $SRC_SHA
REPORT
