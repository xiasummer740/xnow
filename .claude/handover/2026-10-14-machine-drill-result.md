# 整机恢复演练 · 实测结果（2026-10-14）

> **演练目标**：在一台**全新机器**上，只用「备份包 + 那把旧的 `JWT_SECRET`」把站点恢复起来，
> 并证明**老用户不用重新登录**。
>
> **结论**：**灾备的概念成立 —— 老 token 确实免登；但按现在的 `install.sh`，一次都恢复不起来。**
> 脚本上卡着 **4 处必然致命** + 1 处条件致命 + 1 处假告警。修掉之后全自动一次跑通。

---

## 0. 先看结论

| 问题 | 实测答案 |
|------|----------|
| **换机后老用户还要不要重新登录？** | **不用。** 灾难前签发的 token 在新机器上**直接可用**：admin → 200、普通用户 → 200、无 token → 401、伪造签名 → 401，**经 nginx 也是 200**。 |
| **数据能不能完整搬过去？** | **能。** 12 张表逐表一致；唯一差异是备份之后生产上真实新增的那 1 条访问记录。 |
| **照现在的文档跑 `install.sh` 能救回来吗？** | **❌ 不能。** 见 §3，**不管装在哪台机器上（Debian 还是 Ubuntu）都装不出一个能用的站点**。 |
| **修完这 5 处之后呢？** | **✅ 能。** §4 是全自动一次跑通的结果，装完即用，老 token 直接放行。 |

⚠️ 这条最要紧：**文档原来写的"灾备已修好并验证"，验证的是"代码逻辑正确"，
不是"照文档能救回来"。** 两者的差别就是这次演练的全部价值 —— 真要出事那天才发现，就太晚了。

---

## 1. 演练条件

| 项 | 值 |
|---|---|
| 演练机 | `87.83.104.229`（Debian 12 / systemd 252 / **1 核 725MB 内存 4.8G 盘**） |
| 生产 | Ubuntu 20.04 + MySQL + Node **v20.20.2**（`/var/www/xnow` HEAD `3d57a90f`） |
| 用的备份 | `xnow_backup_2026_10_14_12_39_19.tar.gz`（sha256 `22381f98…`，内含 `xnow_db.sql` 768906B + `pending_payments.json`） |
| 密钥 | 从 vault 取出，sha256 `4d0ec885…`，**与生产 `.env` 逐位相同** |
| 喂给脚本的 | `XNOW_JWT_SECRET=<旧密钥>` + `install.sh <备份包>`（都是文档里规定的用法） |

**隔离处理**（这是演练机，不能让它真去外呼上游/发 TG/发短信）：
用 `tools/drill-prepare.sh` 把备份包副本里 8 个键的值清空 ——
`upstream_url` `upstream_key` `upstream_login_user` `upstream_login_pass` `cryptomus_key`
`tg_bot_token` `tg_chat_id` `smtp_pass`，并把 `pending_payments.json` 置为 `[]`，
另在 `/etc/hosts` 加沉洞兜底。**装完回读 8 个键全为空，确认真隔离。**

---

## 2. 核心结论：老 token 免登（实测原始输出）

```
════════ A. .env 里的 JWT_SECRET 指纹 ════════
  演练机: 4d0ec885cd7a3af4f00285c60310293846f38515695470ea793c4a2393c74f14
  生产  : 4d0ec885cd7a3af4f00285c60310293846f38515695470ea793c4a2393c74f14

════════ F. 【核心】老 token 免登实测 ════════
  --- 直连后端 ---
    admin(uid=1)   → HTTP 200
    user(uid=4900) → HTTP 200
    无 token       → HTTP 401
    伪造签名       → HTTP 401
  --- 经 nginx（用户真实路径，自签证书用 -k）---
    admin via nginx → HTTP 200

════════ G. 前端是否真的发出来了 ════════
    http 80  (期望 301 跳 https): HTTP 301
    https 首页 (期望 200):        HTTP 200
    首页里有没有 SPA 挂载点: <script type="module" crossorigin src="/assets/index-Ds8ugSQU.js"
<div id="app">
```

**这就是祥哥最关心的那个问题的答案：换机之后，老用户在自己浏览器里什么都不用做 —— 他们手里的 token 直接用。**

逐表比对（备份包 vs 生产实时）：

| 表 | 演练机（来自备份） | 生产（实时） |
|---|---|---|
| audit_logs | 3 | 3 |
| configs | 27 | 27 |
| coupons | 0 | 0 |
| notifications | 0 | 0 |
| orders | 11 | 11 |
| **page_views** | **284** | **285** ← 差 1，是备份**之后**生产上真实新增的访问 |
| services | 2887 | 2887 |
| sites | 0 | 0 |
| transactions | 15 | 15 |
| users | 4 | 4 |
| vpn_clients | 0 | 0 |
| vpn_products | 0 | 0 |

用户：`uid=1 role=admin`、`4900/6327/7479 role=user` —— 与生产一致。

---

## 3. 按原样的 `install.sh`：卡在哪（问题清单）

跑了 3 轮。第 1、2 轮失败，第 3 轮（修完补丁后）成功。日志留在
`.claude/handover/` 同级之外的本地演练目录，关键片段如下。

### 3.1 缺陷总表

| # | 位置 | 症状 | 根因 | 性质 |
|---|------|------|------|------|
| 1 | `install.sh` `apt update -qq`（原第 41 行） | 第 1 步就停：`E: Could not get lock` | 全新 VPS 开机时 `unattended-upgrades`/`apt-daily` 常在跑并占着 apt 锁，而**这行没有兜底**，`set -e` 直接中止 | 条件致命（实战概率高） |
| 2 | `install.sh` Node 版本（原第 47/64 行，钉 v18.20.8） | 后端**启动即崩**，`pm2 list` 显示 online 但 3000 端口不监听、无限重启 | 仓库 `package-lock.json` 钉的是 `htmlparser2@12`（纯 ESM，engines `node>=20.19.0`）+ `sanitize-html@2.17.7`（`>=22.12.0`）。`sanitize-html` 是 CommonJS，用 `require()` 加载那个 ESM —— **`require(ESM)` 能力 Node 18 没有，20.19+ 才有**。→ `ERR_REQUIRE_ESM` | **必然致命** |
| 3 | `install.sh` 建库段（原第 101–111 行） | ① 灌数据报「数据库还原失败」，改灌后**后端仍然连不上库** ② 但它打印的是 `✓ MySQL` | 三重叠加：**(a)** 原第 103 行拿 **socket** 连接去"验证密码对不对"，而 Debian/MariaDB 的 `root@localhost` 同时挂着 `unix_socket` 插件（`auth_or`），走 socket 时它**无视密码、恒成功** → 误判成"密码已经OK"；**(b)** MySQL 与 MariaDB 设密码语法不同，MariaDB 不认 `IDENTIFIED WITH … BY …`；**(c)** 那句偏偏带 `\|\| true` → 失败被**静默吞掉**。结果 root 密码从来没设上 → **TCP 连不上** → 既灌不进数据，后端也连不上库 | **必然致命**（Debian 12 上 apt 只会装到 mariadb-server） |
| 4 | `install.sh` pm2 软链（原第 76 行） | 第 2 步报 `✗ PM2 安装失败，请手动执行：npm install -g pm2` 后 `exit 1` —— 可 pm2 **其实装好了** | `PM2_BIN="$(npm root -g)/../bin/pm2"` 解析成 `…/lib/bin/pm2`，**少了一级**；pm2 实际在 `…/bin/pm2`。算错 → 不建软链 → 第 80 行 `command -v pm2` 失败 → 退出。上游 `ln -sf …/bin/*` 是在**装 pm2 之前**跑的，桥不上它 | **必然致命** |
| 5 | `install.sh` nginx heredoc 内注释（原第 361 行） | 配置 nginx 时崩：`line 337: remote_addr: unbound variable` | 脚本头是 `set -euo pipefail`（含 `-u`），而 nginx 配置用的是**不带引号**的 `<< NGXEOF` → bash 会在 heredoc 里做变量展开，**连注释也展开**。那条注释里写了个没转义的 `$remote_addr`（同一段里其它变量都规规矩矩写了 `\$`）→ `set -u` 判定未定义 → 退出 | **必然致命** |
| 6 | `install.sh` 健康检查（原第 501 行） | 每次装完都打印 `⚠ Nginx 80 端口未响应` | `curl -sf http://127.0.0.1` **不带 Host 头** → 请求落到**本脚本自己创建**的 ACME 兜底块（`server_name _` + `location / { return 404; }`）→ 404 → `-f` 判失败 | 假告警（不影响功能，但每次都吓人） |

### 3.2 第 1 轮 / 第 2 轮的真实日志片段

```
# 第 1 轮（死在第 1 步）
[1/6] 安装系统依赖...
E: Could not get lock /var/lib/apt/lists/lock. It is held by process 3385564 (apt-get)

# 第 2 轮（死在第 2 步，pm2 装不上）
[2/6] 安装 Node.js 18...
  ✓ Node.js v18.20.8
npm error A complete log of this run can be found in: /root/.npm/_logs/…
  ✗ PM2 安装失败，请手动执行：npm install -g pm2

# 第 2 轮（把它手工绕过去之后）
[3/6] ✓ MySQL          ← 假的：密码根本没设上
[5/6] ✗ 数据库还原失败。网站会以空库启动，请改用网页【数据灾备中心】重新上传。
  ✓ 支付补单记录已还原
  ✓ 后端就绪             ← 假的：进程活着但连不上库，且 Node 18 上直接崩
[6/6] ✓ 前端编译完成
配置 Nginx...
/root/drill/install.sh: line 337: remote_addr: unbound variable
```

**这三个 `✓` 里有两个是假的** —— 这正是最危险的地方：脚本对自己撒谎，操作者以为装好了。

### 3.3 关于缺陷 #2 的受控实验（同一份 `node_modules`，只换 Node）

| Node | 结果 |
|---|---|
| **v18.20.8**（`install.sh` 装的） | `ERR_REQUIRE_ESM`、3000 端口**不监听**、崩溃重启循环 |
| **v20.20.2**（与生产同版） | `🚀 XNOW API Server running on port 3000`、端口在听、**0 次重启** |

**一个字节的依赖都没改，只换 Node 版本，后端就从"必崩"变成"正常"。**

> 生产为什么没事：它跑的是 **Node v20.20.2 ≥ 20.19**，恰好满足。所以这个雷**只在换机时炸** ——
> 平时永远看不见。

---

## 4. 修复后的第 3 轮：全自动跑通（无任何人工帮助）

**为了公平，先把演练机彻底清回"全新 VPS"**：删库、删 `/var/www/xnow`、删 Node 与 pm2、
删 nginx 站点配置、把 MariaDB `root@localhost` 认证还原成出厂 `unix_socket`（TCP 不通），
并且**故意用干净 PATH**（不偷偷帮脚本把 node bin 加进去）。

```
[1/6] 安装系统依赖...   ✓ 完成
[2/6] 安装 Node.js 20... ✓ Node.js v20.20.2    ✓ PM2
[3/6] 配置 MySQL...      ✓ MySQL
[4/6] 拉取源码...        ✓ 已克隆
[5/6] 构建后端...
  ✓ 数据库已还原 —— 用你**原来的账号密码**登录即可，不需要注册      ← 关键
  ✓ 支付补单记录已还原
  ✓ 后端就绪
[6/6] 构建前端...  ✓ 前端编译完成（721 modules）
  ✓ 全局 ACME 验证已配置
  ⚠ Let's Encrypt 签发失败，降级为自签证书     ← 预期内（演练用的是假域名 drill.invalid）
  ✓ Nginx 已启动
  ✓ 后端 API 响应正常 (HTTP 404)
  ✓ Nginx 80 端口正常 (HTTP 301)
```

装完的验收：§2 的全部结论 + 后端 **restarts 0** + nginx 听 80/443 + 前端 1.5M dist 正常发出。

---

## 5. 五处补丁（`install.sh`，共 48 增 19 删）

| # | 改什么 | 一句话 |
|---|--------|--------|
| 1 | `apt` → `apt -o DPkg::Lock::Timeout=600` | 抢锁时**等**而不是直接死，并附注为什么 |
| 2 | Node **18.20.8 → 20.20.2**，版本检查 `-ne 18` → `-lt 20` | 与生产同版，满足依赖的 `require(ESM)` 要求；附注**写明不许退回 18**及原因 |
| 3 | 建库段重写：先试 socket 免密 → 按 `SELECT VERSION()` 判 MySQL/MariaDB 分别用对的语法 → **最后用 TCP+密码验证** | 去掉"恒真的假验证"和"静默吞错"，判据改成**后端真正会走的那条路** |
| 4 | `$(npm root -g)/../bin/pm2` → `/../../bin/pm2` | 修少一级目录，软链能建上 |
| 5 | 注释里的 `$remote_addr` → `\$remote_addr` | 消除 `set -u` 下的展开崩溃 |

外加一处假告警：健康检查改成带 `Host: $DOMAIN` 并按"有响应即算活"（与后端那条同口径）。

**位置提示**：补丁全部在仓库工作区，**未提交**。要回退：`git checkout install.sh`。

---

## 6. 遗留问题（本次没动的）

1. 🔴 **生产上 4 个 nginx 文件不在仓库里、也没有软链** ——
   `/etc/nginx/sites-enabled/` 下的 `xnow-http-redirect` / `xnow-https` / `xnow-spa` / `xnow-spa-https`。
   本次已再次确认它们是**普通文件**（mtime 2026-08-01 ~ 09-20），机器一挂就丢。
   而 `install.sh` 生成的是**另一套**（单文件 `/etc/nginx/sites-available/xnow` + 软链）——
   也就是说**即使脚本跑通，nginx 这层也和现在生产不完全一样**。详见 `2026-10-14-disaster-recovery.md` §6。
2. **生产 `/var/www/xnow` HEAD = `3d57a90f`，与仓库 HEAD 不一致** —— 生产没跟到最新提交。
   要确认是"故意不跟"还是"忘了拉"。
3. **Node 版本漂移**：生产 v20.20.2、脚本原来装 v18。补丁已让脚本装 20.20.2，但**生产是怎么升到 20 的？**
   如果是在机器上手工升的，那正是 CLAUDE.md 里那条"服务器上手工改过的配置必须同步回模板"的情形。
4. **`sanitize-html@2.17.7` 声明要 Node ≥22.12**，而生产跑 20.20.2 —— 实测能跑，
   但属于"低于依赖声明版本运行"。长期建议要么升到 22 LTS，要么把 `sanitize-html` 钉在兼容版本。

---

## 7. 演练机处置

⚠️ 演练机上曾有：**真实生产用户数据** + 生产那把 **`JWT_SECRET`** + 生产备份包。
而那台机器是公网 IP、root 密码登录**一直在被爆破**（`/var/log/btmp` 曾达 **657MB**）。
**已收尾抹除**：删库、`shred` 掉含密钥的 `.env`、删整个应用目录与演练脚本、撤掉 hosts 沉洞、
停掉 pm2/nginx/mariadb、清空 `/tmp/drill-*` 与 `.bash_history`。

👉 **建议祥哥直接在服务商控制台把这台 VPS 销毁**（抹除只是降低风险，销毁才是彻底）。
销毁前不需要再确认 —— 这台机器上已经没有任何本项目需要的东西。

---

## 8. 复现脚本（都在仓库外的本地演练目录，**不进 git**）

| 脚本 | 作用 |
|---|---|
| `tools/drill-prepare.sh` | 把生产备份包转成"隔离版"（清 8 个键 + 清补单），三道闸门防止把真实数据/密钥写进公开仓库 |
| `step0` ~ `step12-*.sh` | 演练全过程的每一步（探机、装依赖、清盘、跑装、验收、收尾），每步都可单独重跑 |
| `drill-ssh.py` | 连演练机的辅助脚本（`run` / `run-file` / `put` / `get`） |
| `out/install-run1/2/3.log` | 三轮 `install.sh` 的完整日志（**失败两轮 + 成功一轮**，是最硬的证据） |

---

## 9. 踩坑备忘录（供后来者，都真实发生过）

| 坑 | 教训 |
|---|---|
| **把脚本传到固定的 `/tmp/drill-step.sh`** | 并发/连续运行时**覆盖掉正在跑的另一个脚本**，bash 中途重读文件 → 语法错 → 脚本静默死掉，还误报"目标进程已结束"。**远端文件名必须按本地文件名唯一化。** |
| **Windows 写的脚本直接在远端 `bash`** | CRLF 会让 bash 报 `$'\r': command not found`。宁可 `scp` 传文件再跑，也别在多层引号里塞内联脚本（本项目今天为此反复翻车）。 |
| **残留的旧 pm2 守护进程活过"清理"** | 它按已删除的 node-v18 路径去 fork 应用 → `MODULE_NOT_FOUND` → 后端崩溃重启 **27 次**，看起来像"后端坏了"。收尾时 `pm2 kill` 不够，还要 `pkill` 漏网的 daemon。 |
| **孤儿 node 进程霸占 3000 端口** | 新后端绑不上端口 → `EADDRINUSE` 崩溃循环，而 `pm2 list` 仍显示 `online`。**验收前必须确认"监听端口的 pid == pm2 管的 pid"。** |
| **机器 IPv6 不通但地址和默认路由都在** | Node 18/20 默认先试 IPv6 → `npm install` **无报错地永久挂起**（`curl` 走 IPv4 所以看起来一切正常）。同一根因还让 `apt-daily` 从 8/20 卡到现在，占着 apt 锁。**排查法**：`node -e "https.get(...)"` 对比 `curl`。 |
| **`ps aux \| grep … \| awk '{print $11}'` 经 PowerShell 传远端** | `$` 被 PowerShell 吃掉 → awk 语法错 → 管道输出**整体消失**，于是"没看到进程"被误读成"没有进程"。**诊断脚本一律写成文件传上去跑。** |
