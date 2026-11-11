# XNOW

> 全局规则见 `xiangge-env/CLAUDE.md`（17条规则 + 验证报告 + 独立复审）
> 新对话自动执行 `pwsh ../xiangge-env/startup.ps1`（推/拉/环境检测/记忆加载）
> 本文件只含项目特有信息，不重复全局规则。

全栈商业级数字资产 SaaS 引擎

## 👋 接手这个仓库的人/AI 先读这里

**如果你手上只有这一个文件夹**（没有同级的 `xiangge-env/`，也没装那套全局配置）：
上面那两行会指向不存在的路径，忽略即可 —— 本仓库自身是自足的。按这个顺序读：

| # | 读物 | 看什么 |
|---|------|--------|
| 1 | `README.md` | 项目是什么、怎么部署、**怎么灾备换机**（第 4、5 节） |
| 2 | `.claude/TODO.md` | **现在停在哪**、下一步做什么、高危操作提醒。⚠️ 这个文件**不在 git 里**（见下方说明），拿整包文件夹才有；只有 git clone 的话直接看下一行的 handover |
| 3 | `.claude/handover/INDEX.md` | 功能级接力笔记索引，按要做的功能挑相关的看 |
| 4 | `.claude/PROGRESS.md` | 跨会话完整时间线（很长，按需搜不要通读） |
| 5 | `ISSUES.md` | 已知未修问题。⚠️ **被 gitignore，因为仓库是 PUBLIC，永远不要 push 它** |

> **为什么 `.claude/TODO.md` 不在 git 里**：`.gitignore:105` 有一条 `.claude/todo.md`，
> 本意是忽略某个工具产物；Windows 大小写不敏感，把大写的 `TODO.md` 一起忽略了
> （Linux 上不会）。**不是有意排除的**。目前维持现状 —— 它含 VPS IP、`/root/` 回滚路径等
> 运维细节，而这个仓库是 PUBLIC。**整包交接文件夹时它在；`git clone` 时不在。**

## 目录

| 目录 | 说明 |
|------|------|
| `client/` | 客户端 |
| `server/` | 服务端 |
| `tools/` | 工具 |

## 部署

```bash
bash install.sh    # 裸机引导部署（环境 + 数据库 + Nginx + SSL）
```

## 项目特有规则

- 双轨 SSL 配置
- 全自动部署流程，首次运行 `install.sh`
- 部署相关见 xiangge-env `CLAUDE.reference.md` 部署清单
- 🔴 **服务器上手工改过的配置，必须同步回 `install.sh` 模板** —— 否则以后重装又退回旧样。
  先例：Cloudflare 真实 IP 还原（22 条 `set_real_ip_from`）就是这么补回去的（提交 `353315bd`）。
  第二例（2026-10-14 整机演练时发现）：模板里的 `try_files` 漏了 `$uri.html`，
  会让 `/finance`、`/vpn`、`/en` 静默塌成 SPA 首页（HTTP 仍 200，只是内容全错）。已补。
  ✅ **nginx 那 4 个文件的漏网已处理**（2026-10-14）：属于本项目的 3 个存档在
  `deploy/nginx/production/`（sha256 与线上逐字节一致）。
  ⚠️ **但第 4 个 `xnow-https` 根本不属于本项目** —— 它转发到 `127.0.0.1:8000` 的 uvicorn，
  属于同机的另一个项目（`xnow-flow`／「XNOW 云控系统」，对外 `tk7188.com`）。
  🔴 **而 `tk7188.com` 正是 xnow 同步数据的「上游」，就在同一台机器上、不在本项目备份范围内。**
  换机后 xnow 会正常启动但上游不存在，服务同步会失败。
  详见 `deploy/nginx/README.md` 与 `.claude/handover/2026-10-14-machine-drill-result.md` §10。
  ✅ **2026-10-15 祥哥定调**：「上游需要备份干嘛，我知道上有信息 你不用操心」——
  **上游的备份与恢复责任不归我们，别再问、也别再提**（已记入 `.claude/TODO.md` 的「不用做」清单）。
- ⚠️ **Cloudflare 的 SSL 模式不要改成 Full (strict)**：源站证书是自签（`CN=IP`），
  靠 CF 接受自签才对外可用，改 strict 会立刻全站 502。
- 🔴 **也绝不要改成 Flexible**（2026-11-03 血的教训）：所有 vhost 的 `:80` 都无条件 301 到 https，
  Flexible 下「CF→源站走 80 → 源站 301 → CF 把 301 回给浏览器 → 浏览器再走 https → 又回 80」**无限跳转**，
  全站打不开（那次瘫了 8 小时，还被 CF 把 301 缓存下来，必须 Purge Everything 才好）。
  正确值**只有一个：Full**。应急脚本 `deploy/sites/fix-cf-flexible-loop.sh`（:80 只要带
  `CF-Connecting-IP` 就本地转发到 `127.0.0.1:443`，真·直连 http 仍 301）。细节见 `ACCEPTANCE.md` 八十九。
  ⚠️ **2026-11-03 二次修正**：判据原本是 `$http_x_forwarded_proto != "https"`，但 **CF 有些边缘节点回源时
  根本不发这个头**，会被误判成「直连访客」→ 418 → 301 → 循环照旧。当天 12:55 访问日志里那条
  `GET /api/services 301`（来源 `104.22.193.130` = CF 网段）就是它，表现为「下单页服务列表加载失败」。
  `CF-Connecting-IP` 是 CF 回源的**必带头**，判它才稳。已同步进 `install.sh`、`deploy/nginx/snippets/xnow-flex-80.conf`、
  `deploy/sites/fix-cf-flexible-loop.sh`、`server/src/utils/siteDomain.js`。
  🧪 **改完 CF 任何开关，立刻用浏览器开一次主站 + 分站**；只看源站 `curl https://127.0.0.1/` 200 是查不出来的。
- ⚠️ **`ISSUES.md` 被 gitignore（仓库是 PUBLIC），永远不要 push 它**
- 🔑 **新装机器会自动创建初始管理员 `admin` / `admin123`**（`install.sh` 收尾，仅在 `users` 表为空时）。
  这是 2026-10-15 补的"冷启动"：此前新装机器是**死锁** —— 注册要邮箱验证码 → 要配 SMTP → SMTP 存在数据库里 →
  库里是空的 → 没账号进不去后台。历史上靠两个硬编码口子绕过（万能验证码 `666888`、影子账户 `admin/admin123`
  直接发超管令牌），2026 年初的安全加固**正确地把它们删了**（`40892dac` / `c824db8b`），但删完没补替代。
  现在的做法**不留代码后门**：只在空库时建一个真实数据库账号，改密码即失效，可用 `XNOW_INITIAL_ADMIN_PASS` 覆盖。
  ⚠️ 默认值写在公开仓库里，装完必须立刻改。
- 🏷️ **客户界面永远不出现「上游 / 供应商 / 渠道商 / 进货」字样** —— 在客户眼里 XNOW 就是服务源头。
  这类词只允许出现在 `Admin.vue`（管理密室，仅有管理员登录后才加载）、后端日志与代码注释里。
  写任何客户可见文案前先自问："客户看到这句会不会觉得我们是二道贩子？"
  （2026-10-24 祥哥定调；当时 `Order.vue` 的"上游为每条新帖投喂一次"被他当场指出。
  已清理客户侧 8 处，并同步清掉 `dist/assets` 里 144 个含旧文案的历史 bundle。
  代码注释里的"上游"不用删 —— 会被压缩器剥掉，且 `Admin-*.js` 之外的产物已验证 0 命中。）

- 🔴🔴 **绝不能用真实客户账号测试**（2026-11-11 违反过一次，祥哥当面纠正）。
  用管理员账号（UID 1）或专用测试账号。测试产生的**订单和交易流水必须删干净** ——
  扣款记录的 `description` **不含订单号**（只有「购买服务 [ID:x] 数量:y」），
  按订单号 LIKE 删不掉，要按 `user_id + created_at + amount + balance` 精确匹配；
  删前 `mysqldump` 备份到 `/root/`，删后验证余额序列首尾相接（例：15.3284 → +10 → 25.3284 → -8.125 → 17.2034）。
  上游成本损失（「立即启动」类服务取消不了）要在提交信息里写明金额，不能装作没发生。
  详见 `.claude/TODO.md` 的「测试铁律」。

## 🔴 同机多项目共存（每个新会话开工前必读）

> 完整版：`deploy/guard/README.md`。**这一节存在的唯一原因：2026-11-03 全站瘫了 8 小时。**
> 根因不是代码 —— 是另一个 AI 会话在同一台机器上，把 `taikon.top` 这个 Cloudflare zone 的
> SSL 模式从 **Full** 改成了 **Flexible**。它改的是「zone 级全局开关」，动一下，
> 挂在同一个 zone 下面**所有子域名一起坏**。

**这台机器上还跑着：** `xnow-flow`（`tk7188.com`，uvicorn `:8000`）、`xnow-beta`（`:3001`）、
`cloudflared`、`xray`、`netdata`、MySQL 单实例（`xnow_db` / `xnow_beta` / `rh89test`）。

### 共享层 = 禁区（改前必须备份 + 验证邻居项目）

| 共享物 | 为什么危险 |
|---|---|
| `/etc/nginx/conf.d/` | http 级，**全机所有站点**一起受影响；新增文件必须带项目前缀 |
| `/etc/nginx/sites-enabled/` | 主站 + 分站 + beta + `tk7188.com` 都在这里，Host 匹配错就串站串库 |
| `443 default_server` | **全机只允许一个**，现在是 `xnow-catchall` 里的中性 404 兜底块 |
| pm2（root 的） | 🔴 **永不 `pm2 restart all` / `delete all`**，只重启自己的进程名 |
| MySQL | 一个项目一个库一个账号，账号只 `GRANT` 自己的库 |
| CF zone `taikon.top` | SSL/TLS、Speed、Caching、Page Rules **全是 zone 级**，没有「只对这个子域生效」 |

### 每个会话的固定动作

```bash
bash deploy/guard/scope-check.sh          # 开工前：改动是否越界 / 落在禁区
ssh xnow-vps 'nginx -t'                   # 部署前：语法
bash deploy/guard/post-deploy-verify.sh   # 部署后：全机回归（含 tk7188.com / code.taikon.top）
```

`post-deploy-verify.sh` 里刻意列了**邻居项目的域名** —— 只看自己 200 是不够的。
11-03 改 nginx 的 `:80` 判据时，受影响最大的恰恰是邻居的 Host 匹配。

### 会话开场就声明作用域

AI 看不到旁边有什么项目，只看到你给的路径。**你不说，它默认整台机器都是你的。**
每个会话第一句话带上：「这个会话只碰 `F:\summer\vs-code\xnow`，同机的 `xnow-flow` /
`xnow-beta` 不改；服务器是 `xnow-vps`。」

### 已落地

| 文件 | 作用 |
|---|---|
| `deploy/guard/scope-check.sh` | 越界 / 禁区检查 |
| `deploy/guard/post-deploy-verify.sh` | 部署后全机回归 |
| `deploy/guard/README.md` | 完整规约 + 排障顺序 |
| `/usr/local/bin/xnow-db-backup.sh` + cron `10 4 * * *` | 每日 `mysqldump`，留 14 天，落 `/var/backups/xnow-db/` |
