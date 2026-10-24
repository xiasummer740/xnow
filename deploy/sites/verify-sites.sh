#!/bin/bash
# ============================================================================
# 分站体系 · 部署后自检（只读，不改任何东西，可随时安全重跑）
# 用法：bash verify-sites.sh --env beta | --env prod
# ============================================================================
set -uo pipefail

ENV=""
while [ $# -gt 0 ]; do
  case "$1" in
    --env) ENV="$2"; shift 2 ;;
    *) shift ;;
  esac
done

case "$ENV" in
  beta) DB_NAME_T=xnow_beta; API=3001; PM2_APP=xnow-beta ;;
  prod) DB_NAME_T=xnow_db;   API=3000; PM2_APP=xnow-backend ;;
  *) echo "必须指定 --env beta 或 --env prod"; exit 1 ;;
esac

DBP=$(grep '^DB_PASS=' /var/www/xnow/server/.env | cut -d= -f2-)
PASS=0; FAIL=0; PENDING=0
chk() { # chk "名称" "期望" "实际"
  if [ "$2" = "$3" ]; then echo "  ✅ $1（$3）"; PASS=$((PASS+1));
  else echo "  ❌ $1（期望 $2，实际 $3）"; FAIL=$((FAIL+1)); fi
}
code() { curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$@" 2>/dev/null; }

echo "=== 自检：$ENV ==="

# ── 进程与服务 ──
ST=$(pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const a=JSON.parse(s);const p=a.find(x=>x.name==='$PM2_APP');console.log(p?p.pm2_env.status:'missing')}catch(e){console.log('err')}});")
chk "pm2 进程状态" "online" "$ST"
chk "API 端口存活" "200" "$(code "http://127.0.0.1:$API/api/public/config")"

# ── 公开接口（部署后应当全部可用）──
chk "公开配置接口"      "200" "$(code "http://127.0.0.1:$API/api/public/config")"
chk "分站统计接口"      "200" "$(code "http://127.0.0.1:$API/api/public/site-stats")"
chk "热门服务接口"      "200" "$(code "http://127.0.0.1:$API/api/public/hot-services")"
chk "服务列表接口存活" "alive" "$(S=$(code "http://127.0.0.1:$API/api/services"); [ "$S" = "200" ] || [ "$S" = "401" ] && echo alive || echo "$S")"

# ── 权限边界 ──
chk "未登录访问分站列表应 401" "401" "$(code "http://127.0.0.1:$API/api/sites")"
chk "未登录访问分站订单应 401" "401" "$(code "http://127.0.0.1:$API/api/sites/orders?site_id=1")"

# ── 主站身份未被污染 ──
MAIN_SUB=$(curl -s --max-time 10 -H "Host: xnow.taikon.top" "http://127.0.0.1:$API/api/public/config" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const d=JSON.parse(s).data;console.log(String(d.is_subsite||'false'))}catch(e){console.log('err')}});")
chk "主站域名不被识别为分站" "false" "$MAIN_SUB"

# ── 数据库结构 ──
has_col() { MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='$DB_NAME_T' AND table_name='$1' AND column_name='$2'" 2>/dev/null; }
chk "users.site_id 列"        "1" "$(has_col users site_id)"
chk "orders.site_id 列"       "1" "$(has_col orders site_id)"
chk "orders.site_cost 列"     "1" "$(has_col orders site_cost)"
chk "sites 表存在"            "1" "$(MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME_T' AND table_name='sites'" 2>/dev/null)"
chk "sites.custom_domain 列"  "1" "$(has_col sites custom_domain)"
chk "sites.home_modules 列"   "1" "$(has_col sites home_modules)"
chk "sites.smtp_host 列"      "1" "$(has_col sites smtp_host)"
# 🧱 后续几期新增的列：忘跑迁移时这里会红，而不是等站长保存外观时才报 500
chk "sites.template 列"         "1" "$(has_col sites template)"
chk "sites.color 列"            "1" "$(has_col sites color)"
chk "sites.multiplier 列"       "1" "$(has_col sites multiplier)"
chk "sites.agent_discount 列"   "1" "$(has_col sites agent_discount)"
chk "sites.hero_variant 列"     "1" "$(has_col sites hero_variant)"
chk "sites.services_variant 列" "1" "$(has_col sites services_variant)"
chk "sites.section_titles 列"   "1" "$(has_col sites section_titles)"
chk "sites.custom_css 列"       "1" "$(has_col sites custom_css)"
chk "sites.favicon_url 列"      "1" "$(has_col sites favicon_url)"
chk "sites.advantages 列"       "1" "$(has_col sites advantages)"
chk "sites.bufpay_id 列"        "1" "$(has_col sites bufpay_id)"
chk "sites.bufpay_key 列"       "1" "$(has_col sites bufpay_key)"

# ── 业务数据健康 ──
U=$(MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM $DB_NAME_T.users" 2>/dev/null)
O=$(MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM $DB_NAME_T.orders" 2>/dev/null)
S=$(MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM $DB_NAME_T.sites" 2>/dev/null)
echo "  ℹ️  数据：users=$U orders=$O sites=$S"
chk "用户数据非空" "ok" "$([ "${U:-0}" -gt 0 ] && echo ok || echo empty)"

# 主站订单不该被扣分站成本（列不存在 → 说明还没部署，跳过而不是判失败）
if [ "$(has_col orders site_cost)" != "1" ]; then
  echo "  ⏭ 跳过「主站订单未被扣分站成本」（site_cost 列尚未部署）"
  echo "  ⏭ 跳过「分站订单均已记账成本」（同上）"
  echo "  ⏭ 跳过「无分站占用主站域名」（custom_domain 列尚未部署）"
  PENDING=$((PENDING+3))
else
  BADCOST=$(MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM $DB_NAME_T.orders WHERE (site_id IS NULL OR site_id=0) AND site_cost>0" 2>/dev/null)
  chk "主站订单未被扣分站成本" "0" "${BADCOST:-ERR}"

  # 分站订单必须有成本（否则等于站长白拿）
  MISSCOST=$(MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM $DB_NAME_T.orders WHERE site_id>0 AND (site_cost IS NULL OR site_cost=0)" 2>/dev/null)
  chk "分站订单均已记账成本" "0" "${MISSCOST:-ERR}"

  # 站点域名不得与主站冲突
  BADDOM=$(MYSQL_PWD="$DBP" mysql -N -u root -e "SELECT COUNT(*) FROM $DB_NAME_T.sites WHERE domain IN ('xnow.taikon.top','taikon.top','tk7188.com') OR custom_domain IN ('xnow.taikon.top','taikon.top','tk7188.com')" 2>/dev/null)
  chk "无分站占用主站域名" "0" "${BADDOM:-ERR}"
fi

# ── 外网可访问 ──
if [ "$ENV" = "prod" ]; then
  chk "生产首页 HTTPS"  "200" "$(curl -sk -o /dev/null -w "%{http_code}" --max-time 12 --resolve xnow.taikon.top:443:127.0.0.1 https://xnow.taikon.top/)"
  NG=$(ls /etc/nginx/sites-enabled/ | wc -l)
  echo "  ℹ️  nginx 启用配置数：$NG"
fi

echo
if [ "$FAIL" = "0" ]; then
  echo "✅ 自检通过：$PASS 项全绿$([ "$PENDING" -gt 0 ] && echo "（另有 $PENDING 项因尚未部署而跳过）")"
  exit 0
else
  echo "❌ 自检失败：$FAIL 项未通过（通过 $PASS 项${PENDING:+, 跳过 $PENDING 项}）"
  echo "   提示：若失败项都是「分站新接口 404 / 新列缺失」，说明代码还没部署到该环境。"
  exit 1
fi
