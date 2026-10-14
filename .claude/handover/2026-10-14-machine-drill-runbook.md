# 整机恢复演练 Runbook（2026-10-14）

> 目的：把 `2026-10-14-disaster-recovery.md` §5 第 1 项**做完** —— 那是那份笔记里唯一
> 没做完的事：**从没在一台真·干净机器上完整跑过 `bash install.sh <备份包>`**。
>
> 本文写给下一个接手的人/AI。假定你没有对话上下文。**照着做即可，别临场发挥。**
> ⚠️ 本文件在公开仓库里，**不许写任何口令/密钥/IP**（占位符用 `<...>`）。

---

## 0. 一句话

在**另一台新机器**上，用一份**备份包的副本**，跑一遍恢复，然后证明两件事：
站点能起来、**老用户不用重新登录**。**你现在跑着的生产机器和数据全程不参与。**

---

## 1. 要证明的两条硬指标

| # | 指标 | 达标线 |
|---|------|--------|
| 1 | **能恢复** | 数据一点都不少（逐表行数与生产一致） |
| 2 | **用户无感** | 拿一个**生产刚签发的真 token** 打演练机接口 → **200**（不是 401） |

指标 2 是重点，也是唯一被判据硬的：401 就等于「全体用户被踢下线重登」。

---

## 2. 🔴 红线（违反任何一条都可能伤到生产或客户）

| # | 红线 | 为什么 |
|---|------|--------|
| 1 | **绝不在生产 VPS 上跑 `install.sh`** | 它会 `git pull`（把线上前端 dist 打回旧包，有 3 个文件被强制跟踪）、重写 `.env`、重写 nginx 配置、`pm2 delete` 后端 |
| 2 | **绝不改 DNS / Cloudflare**（别把域名指到演练机） | 那就成了真迁机：客户下单/充值会进演练库，真钱出事 |
| 3 | **演练机的备份包必须是副本，原件留在生产** | 别把唯一一份可用备份拿到演练机上去折腾 |
| 4 | **产出物绝不落在 git 仓库内** | 仓库是 **PUBLIC**，演练包里是**全量真实用户数据**（手机号/邮箱/密码哈希/密钥）。一次 `git add -A` 就是事故。`tools/drill-prepare.sh` 已硬拦这条 |
| 5 | **演练完必须销毁演练机** | 它上面有全量真实用户数据 + 生产第三方密钥 + **同一把 `JWT_SECRET`**（等于能在演练机上签出生产管理员 token） |

---

## 3. 演练机要求

- 一台**全新**的 Linux（**与生产同发行版/同版本**，避免 MySQL 8.0 vs 8.4 之类的差异）
- root 可登录、能给公网出口（`install.sh` 要 `apt`/`npm`/`git`/`acme.sh`）
- **不需要**公网 80/443，也**不要**把域名解析过来
- 建议 2G 内存以上

---

## 4. 需要祥哥准备的 3 样

| # | 东西 | 从哪来 | 注意 |
|---|------|--------|------|
| 1 | 演练机 IP + SSH（root） | 你新开的那台 | **不能是生产那台** |
| 2 | 一份生产备份包 `xnow_backup_*.tar.gz` | 生产 `/var/www/xnow/backups/` 最新那份，或 TG 群里发过的那份 | 只读复制出来 |
| 3 | **一个生产刚签发的真 token** | 浏览器 F12 → `localStorage.getItem('xnow_token')` | 判「用户无感」的决定性证据。**7 天过期，要新鲜的** |

`XNOW_JWT_SECRET` 从 `credentials-vault/projects/xnow/config.md` 取 —— **不用碰生产**。

---

## 5. 步骤

### 5.1 本机：制备「外呼已掐死」的演练包

```bash
# 输入包放到仓库外（例如 D:\drill\），输出也在仓库外
bash tools/drill-prepare.sh /path/outside/repo/xnow_backup_xxx.tar.gz /path/outside/repo/out
```
脚本会：侦测真实配置表名 → 追加隔离段 → 清空副本补单队列 → 重新打包 → 自检 → 打印 `/etc/hosts` 兜底清单。
**它的三道闸门都实测过**（见附录 B）。侦测不到表名它会**大声失败**，不猜。

### 5.2 演练机：先掐 DNS 兜底，再装

```bash
DRILL=<演练机IP>
scp install.sh out/xnow_backup_xxx.drill.tar.gz root@$DRILL:/root/

ssh root@$DRILL
# ① DNS 层兜底（纵深防御：不依赖 SQL 隔离是否生效）
cat >> /etc/hosts <<'EOF'
127.0.0.1 <上游主机名>          # drill-prepare.sh 会告诉你
127.0.0.1 api.telegram.org
127.0.0.1 bufpay.com
127.0.0.1 api.cryptomus.com
EOF

# ② 装 + 灌（域名用 RFC2606 保留的 .invalid → acme 必然失败 → 自签证书，
#    既不去连生产 IP，也不烧 Let's Encrypt 配额）
cd /root
printf 'drill.invalid\n%s\n' '<演练机自己的MySQL口令>' | \
  XNOW_JWT_SECRET='<vault 里的值>' bash install.sh /root/xnow_backup_xxx.drill.tar.gz
```

> ⚠️ **`install.sh` 灌完数据后立刻 `pm2 start`，中间没有钩子**（见附录 A）。
> 所以隔离**必须已经在数据里** —— 这就是 5.1 必须先做的原因，不是"顺手"。

### 5.3 演练机：立刻回读隔离（不生效就地停）

```bash
mysql -N xnow_db < verify-isolation.sql     # 期望 8 行的 value_prefix 全为空
# 只要有任意一行非空 —— 说明隔离没生效：
pm2 stop xnow-backend
```

### 5.4 验收

```bash
# ① 逐表行数（同一段循环在生产与演练机各跑一次，然后 diff）
for t in $(mysql -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='xnow_db'"); do
  printf '%-24s %s\n' "$t" "$(mysql -N xnow_db -e "SELECT COUNT(*) FROM \`$t\`")"
done | tee /tmp/counts.txt
# 生产侧同一条循环 —— **全是 SELECT，零写入**

# ② 指标 2（决定性断言）
curl -k -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer <生产那个 token>" https://$DRILL/api/user/status
#    200 = 用户无感 ✅        401 = 全体被踢下线 ❌

# ③ 老账号密码能登
curl -k -s -X POST https://$DRILL/api/login -H 'Content-Type: application/json' \
  -d '{"account":"<管理员手机号>","password":"<密码>"}' | head -c 200

# ④ 前端能开（验 nginx 那一层）
curl -k -s -o /dev/null -w '%{http_code}\n' https://$DRILL/

# ⑤ 外呼确实被掐住了
pm2 logs xnow-backend --lines 80     # 不该出现上游请求/登录；TG 也不该有动静
```

---

## 6. 验收表

| # | 断言 | 判据 |
|---|------|------|
| 1 | 表齐全 | 演练机表数 == 生产表数（生产是 12） |
| 2 | 逐表行数一致 | `diff` 两份 counts 输出**零差异** |
| 3 | 补单记录还原到位 | 副本是 `[]`；原件 sha256 与制备时记录的一致 |
| 4 | **老 token 直接可用** | `/api/user/status` → **200** |
| 5 | 老账号密码可登 | `/api/login` 返回 token |
| 6 | 前端可用 | `/` 返回 200，下单页服务分类能加载 |
| 7 | 零外呼 | `pm2 logs` 无上游请求；生产 TG 群**没有**来自演练机的消息 |

---

## 7. ⚠️ 必须预先说明的「预期偏差」（否则会被误判成"数据丢了"）

演练包**故意**改了两处，diff 出这些**不是 bug**：

| 改了什么 | 为什么 |
|---|---|
| `configs` 表里 **8 个键**的值清空（`upstream_url`/`upstream_key`/`upstream_login_user`/`upstream_login_pass`/`cryptomus_key`/`tg_bot_token`/`tg_chat_id`/`smtp_pass`） | 后端一启动就会拿这些真凭证往外打（3 秒就开始，抢不过来）。清空后代码**早退，不发起请求** |
| 副本 `pending_payments.json` → `[]` | `reconcilePayments` 会拿每条单去打 `bufpay.com/api/query`，那个接口**不需要密钥**，清配置挡不住 |
| 表名（如果生产库不是 `Configs`） | 脚本**从备份包里侦测**，不硬编码 —— Linux MySQL 表名大小写敏感 |

**其余 11 张表的数据必须逐字节一致** —— 这才是"数据一点不少"的证明。
答辩口径：**演练包 = 生产备份 + 一段可读、可删、逐条列出的隔离段**；把那段删掉就是原件。

---

## 8. 收尾（必做）

```bash
# 演练机上
pm2 delete xnow-backend
mysql -e 'DROP DATABASE xnow_db'
rm -f /var/www/xnow/server/.env /var/www/xnow/server/data/pending_payments.json
# 最彻底：整台机器销毁（推荐）
```

再回生产确认**什么都没被动过**：
```bash
ssh xnow-vps 'sha256sum /var/www/xnow/backups/<那个包>; git -C /var/www/xnow status --short; pm2 list'
# sha256 必须 == 制备时打印的那个（证明原件没被动过）
```

---

## 9. 出问题怎么退

| 症状 | 退法 |
|---|---|
| 演练机上任何不对劲 | `pm2 stop xnow-backend`，然后 `ufw default deny outgoing`。**生产不受影响，演练机直接销毁即可** |
| 怀疑外呼真打出去了 | 立刻去上游面板/CF 查登录记录与 IP；TG 群里看有没有演练机的消息 |
| 备份包原件被动了 | 用制备时打印的 `sha256` 核对；对不上就**从 TG 群/邮件里再取一份**（异地存档就是为这个存在的） |

---

## 10. 附录 A：为什么隔离必须做在「数据落地那一刻」

代码事实（`server/src/app.js:123-136`）：

```
app.listen(PORT, ...) →
  setTimeout(autoSyncServices, 3000)        ← 启动 3 秒就打上游
  setInterval(autoSyncOrders, 60s)
  setTimeout(autoSyncAnnouncement, 30000)   ← 30 秒后**真登录上游面板**
  setInterval(reconcilePayments, 120s)
  setInterval(checkNginxTempDirs/Errors, 300s)  ← 往真实 TG 群推
```

而 `install.sh:172-211` 的顺序是：**灌数据（172-205）→ `npm install`（207）→ `pm2 start`（211）**。
**中间没有任何钩子**，`npm install` 在已装好的树上只要几秒 —— 想"启动后立刻停掉再隔离"是**抢不过 3 秒那个定时器**的。

所以方案只能是：**让隔离语句随数据一起导入**（本 Runbook 5.1 的做法），
外加 `/etc/hosts` 做 DNS 层兜底（不依赖 SQL 是否生效）。

**为什么不改 `install.sh` 加钩子**：`install.sh` 是**换机时真正要用的生产脚本**，
为一次演练给它加钩子 = 在唯一的灾备链路上引入新变量。宁可改数据副本，不改灾备脚本。

---

## 11. 附录 B：本次已完成、已实测的部分

`tools/drill-prepare.sh` 已用**合成包**（假数据）在 WSL 里真跑过：

| 验的什么 | 结果 |
|---|---|
| 表名侦测 | 从 dump 里正确认出 `Configs` |
| 隔离段追加 | 落在 SQL 末尾，导入时必然最后生效 |
| 补单清空 + 原件另存 | 副本 `[]`、原件另存可比对 |
| 自检（隔离段真在包里吗） | 通过 |
| 闸门：输出目录在仓库内 | **拒绝**（实测） |
| 闸门：输入包在仓库内 | **拒绝**（实测） |
| 闸门：表名侦测不到 | **拒绝产出**，不留半个包（实测） |

⚠️ **仍未验的**：隔离段 SQL 没在**真 MySQL** 上执行过语法（本机 WSL 无 MySQL 且要 sudo 密码）。
它只是一条 `UPDATE ... WHERE key IN (...)`，风险极低，但**到了演练机上要以 5.3 的回读为准**。
