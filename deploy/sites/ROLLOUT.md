# 分站体系 · 上线执行方案（Production Rollout）

> 状态：**待祥哥验收后执行**。本文只是方案，未执行任何生产变更。
> 记录时间：2026-10-24 · 分支 `feat/sites`

## 零、上线脚本已在 Beta 完整演练过（2026-10-24）

不是"纸上流程"：`deploy-sites.sh` 已在 Beta 上真跑了一遍全流程。

| 步骤 | 结果 |
|---|---|
| 1 部署前检查（43 个后端文件语法）| ✅ |
| 2 全库备份（体积与表数双校验）| ✅ |
| 3 代码快照（回滚锚点）| ✅ |
| 4 数据库迁移（只加列）| ✅ 幂等：19 个列全部「已存在」，业务数据 users/orders 未变 |
| 5 替换后端代码 | ✅ |
| 6 替换前端产物 | ✅ |
| 7 平滑重启（pm2 reload 不中断连接）| ✅ |
| 8 部署后自检 | ✅ **32 项全绿** |

自检项覆盖：进程状态 / API 端口 / 公开配置 / 分站统计 / 热门服务 / 未登录必须 401 /
主站域名不被识别为分站 / 数据表 14 个关键列是否齐全 / 数据健康（主站订单未被扣分站成本、
无分站占用主站域名）。

**演练过程中发现并修掉的两个真问题：**

1. `deploy-sites.sh` 里数据库口令写死读生产 `.env` —— 带 `--env beta` 演练时读到的是
   生产的口令。眼下两边同机碰巧一样，换机或分库会直接失败。已改为跟随 `APP_DIR`。
2. 自检脚本只检查了前几期的列，后加的 `template / color / hero_variant ·
   services_variant / section_titles / custom_css / favicon_url / advantages /
   bufpay_id / bufpay_key` 都没查 —— 真出"忘跑迁移"时它会照样报绿。已补齐到 32 项。

**一个坑（记下来免得下次踩）：** 这些 `.sh` 必须以 LF 换行上传。用 Windows 换行传上去，
`bash` 会报 `set: pipefail: invalid option name`，自检直接失败。上传前 `tr -d '\r'` 一下。

**演练期间生产侧指纹（证明完全没被波及）：**

| 指标 | 值 |
|---|---|
| users / orders / services | 5 / 31 / 2839（与演练前一致）|
| `sites` 表是否已有分站列 | 0 个（没有）|
| 生产主站 nginx 配置 sha256 | `6c3da1f4b7199270447269c71ddc175ac019e53619e8dbc50acd65ad94cd1258` |

## 零之二、回滚脚本也真跑过（2026-10-24）

只验"能装上"不算数，**"能退回来"才是祥哥最在意的**。所以在 Beta 上真回滚了一次：

| 步骤 | 结果 |
|---|---|
| `rollback-sites.sh --env beta --stamp … --code-only` | ✅ 停服务 → 从代码快照恢复 → 重启 |
| 回滚后数据 | 分站 3 / 用户 6 / 订单 0 —— **一条没少**（`--code-only` 不动数据库）|
| 回滚后自检 | ✅ 32 项全绿 |
| 回滚后再部署一次 | ✅ 成功，代码指纹与回滚前一致（脚本可重复执行）|
| 生产指纹 | users / orders / services = 5 / 31 / 2839；分站列 0 个；nginx sha256 与演练前**完全相同** |

**结论：安装→回滚→再安装 这条往返路径已经跑通，不是纸面流程。**

### 回滚优先级（写在这里免得紧急时想不起来）

| 情况 | 用什么 | 会不会丢数据 |
|---|---|---|
| 代码有 bug、要退回上一版 | `--code-only`（**推荐，99% 的场景用这个**）| 不丢 |
| 数据库被写坏了、必须整库还原 | 不带 `--code-only` | **会丢**部署后新增的订单与用户 |

数据库迁移本身只加列、不动数据，所以正常回滚**根本不需要动数据库**。

### 演练中修掉的第三、第四个问题

3. `rollback-sites.sh` 同样写死读生产 `.env`，且回滚后用**主站域名 + 3000 端口**探活 ——
   `--env beta` 演练时会拿主站去验证 Beta，看起来"通过"其实探的不是这台环境。
   已改为跟随 `--env`。
4. 部署时记录的"代码锚点"在 Beta 上是 `unknown`（该目录不是 git 仓库）。
   实际回滚走的是部署时打的代码快照（tar），所以不影响可用性；但如果哪天快照丢了，
   锚点也救不回来 —— **备份目录 `CODE_BK` 别清理**。

## 一、上线前必须由「人」完成的两件事

这两件我做不了（需要你的账号 / 需要改动系统环境），但**缺了就无法对外营业**：

| # | 事项 | 谁做 | 不做的后果 |
|---|---|---|---|
| 1 | Cloudflare 添加 `*.xnow.taikon.top` → A 记录指向服务器 IP | 你（Cloudflare 后台） | 站长开出来的免费子域名**外网打不开**，只有服务器内部能访问 |
| 2 | 安装 Let's Encrypt（`apt install certbot python3-certbot-nginx`） | 授权后我执行 | 自有域名只能用自签证书，浏览器提示"不安全" |

> 说明：第 2 项要往系统里装软件包，属于改动服务器环境。按你的规矩我没有擅自做。
> 现在 Beta 用的是自签证书兜底，功能验证不受影响，但**不能拿这个去卖给客户**。

## 二、生产变更清单（改什么、不改什么）

### 会改（结构与代码）
| 对象 | 变更 | 风险 |
|---|---|---|
| `sites` 表 | 新建（含分站全部配置字段） | 无（新表） |
| `transactions` 表 | 加列 `site_id` + 索引 | 低（只加列，默认 0） |
| `orders` 表 | 加列 `site_cost` | 低（只加列，默认 0） |
| `services` / `users` | 不加列（已有 `custom_rate`、`custom_multiplier`） | 无 |
| 后端代码 | `server/src` 全量更新 | 由回滚快照兜底 |
| 前端产物 | `client/dist` 重新构建部署 | 由旧的 `dist` 备份兜底 |
| nginx | 新增分站 server 块（端口 3001 分流） | 中（配置错误会 502，已备回滚） |

### 不会改（数据）
- `users` / `orders` / `services` / `transactions` 的**现有行数**（部署脚本会对比，一变就中止）
- 任何现有订单、余额、配置值
- 主站 `xnow_db` 的既有业务数据

### 部署后的行为差异（只对主站）
1. 主站页面**外观与文案零变化**（不设置 `data-template` / `data-color`，主题 CSS 不生效）
2. 主站价格不变（`orders.js` 里 `req.site` 为空时走原逻辑）
3. 主站多出两个能力：至尊代理可以开分站；管理员后台多一个"分站管理"入口

### 谁能开分站（祥哥 2026-10-24 定）
| 身份 | 能否开分站 | 能开几个 |
|------|-----------|---------|
| 主站普通客户（`user`） | ❌ 接口直接 403 | 0 |
| 站长（`agent` / 至尊代理） | ✅ 能给自己开 | **默认 1 个** |
| 平台管理员（`admin` / `super_admin`） | ✅ | 不限（方便自建测试站） |
| 站长的客户 | ❌ 403 | 0（永远不可能有下级分站） |

"1 个"是代码默认值，可在线调整、无需改代码重新部署：

```sql
-- 放宽到 3 个
INSERT INTO configs (`key`, value, description, created_at, updated_at)
VALUES ('max_sites_per_agent','3','每位站长最多几个分站，0=不限',NOW(),NOW())
ON DUPLICATE KEY UPDATE value='3';
```

超额时返回的提示：`每位站长最多开 N 个分站（你现在已有 M 个）。如需增开请联系平台。`

## 三、执行步骤

```bash
# 0) 只读预检（不改任何东西，可随时跑）
bash deploy/sites/deploy-sites.sh --env prod --check

# 1) 正式部署（自动：备份 → 迁移 → 换代码 → 平滑重启 → 20 项自检）
bash deploy/sites/deploy-sites.sh --env prod

# 2) 单独复核（只读）
bash deploy/sites/verify-sites.sh --env prod
```

预期：退出码 0，自检 20/20 全绿。

## 四、回滚触发条件与操作

出现以下任一情况**立刻回滚**，不要试图在生产上现场改：

- 主站首页非 200，或页面内容异常
- 主站下单失败 / 扣款金额不对
- `users` / `orders` 行数与部署前不一致
- 自检出现任何 FAIL

```bash
bash deploy/sites/rollback-sites.sh --env prod --list                 # 看备份
bash deploy/sites/rollback-sites.sh --env prod --stamp XXX --code-only  # 先只回滚代码（多数够用）
bash deploy/sites/rollback-sites.sh --env prod --stamp XXX              # 最后手段：连库还原
```

## 五、上线当天的建议顺序

1. **你验收 Beta**（预览地址 + 管理员账号），把不满意的点列出来 → 我改
2. 你完成 Cloudflare 泛域名解析
3. 我装 certbot，把 Beta 的自签证书换成真证书，验证 `https://t1.xnow.taikon.top` 绿锁
4. 你确认后，我执行生产部署（约 3~5 分钟）
5. 部署后立刻自检 + 主站下单实测（1 单最小金额）
6. 观察 24 小时，无异常再对外宣布

## 六、已知未验证项（上线前请知情）

| 项 | 状态 | 影响 |
|---|---|---|
| 真实 Let's Encrypt 证书 | ❌ 未验（certbot 未装） | 自有域名目前自签 |
| Cloudflare 泛域名解析 | ❌ 未验（记录未加） | 免费子域名外网不可达 |
| 浏览器里的实际视觉效果 | ❌ 未验（无浏览器） | 模板/主题已静态核实存在并接线，但"看着好不好"只能你看 |
| 上游真实取消触发的退款 | ⚠️ 半验 | 用受控响应驱动真实代码路径已验证取消/部分完成两种，真实上游触发未遇到 |

> 这张表的意义：这四项都**不是代码问题**，而是"环境或人类判断"的问题。
> 我能保证的是代码逻辑与账务正确；不能保证的是"它看起来够不够像一个独立的站"。

## 七、生产现状勘验（2026-10-24 只读核查）

上线前必须知道的三件事，全部为只读核查结果：

### 1. 分站的「骨架」在生产上早已存在（2026-08-28 建表）

| 事实 | 值 |
|---|---|
| `sites` 表创建时间 | 2026-08-28 16:55 |
| `sites` 表行数 | 0 |
| `users.site_id <> 0` 的用户 | 0 |
| 生产 `server/src/routes/sites.js` | 存在（旧版，7818 字节），已挂载 `/api/sites` |
| 生产旧接口 | `GET /`、`GET /current`、`POST /`（管理员与 agent 可建站）、`PUT /:id`、`DELETE /:id` |
| 生产前端 | **无**分站页面产物（`SiteAdmin` 未构建） |

结论：生产有一个**从未启用**的分站骨架 —— 数据库空表、后端旧接口在、前端没有页面。
本次上线是把这套骨架**升级为完整体系**（域名/主题/支付/SMTP/预存扣费），不是从零加功能。
副作用提示：现在若有 `agent` 角色用户直接调 `POST /api/sites`，能建出一条空分站记录（无界面、无域名、无支付），属于已存在的老行为。

### 2. 生产代码与仓库 `main` 的关系（是否会被部署覆盖）

生产不是 git 仓库，逐个文件核对结果：

| 文件 | 与 `main` 对比 |
|---|---|
| `app.js`、`routes/sites.js`、`routes/public.js`、`routes/admin.js`、`routes/orderSync.js`、`models/Site.js`、`models/Transaction.js`、`middleware/site.js` | **字节完全一致** |
| `routes/orders.js`、`routes/pay.js`、`routes/services.js` | 字节不同，但**逐行内容差异 0 行**（纯空白/缩进差异） |

结论：**生产没有任何未入库的功能性热修** → 部署不会覆盖掉别人手工做的修复。
（曾担心这点，因为文件修改时间就在今天；核查后确认内容与 `main` 等价。）

### 3. 我的分站代码从未写入生产（可验证）

在生产这 3 个文件里检索本轮专属标记，全部为 **0 处**：
`paySiteId`、`resolveBufpayKey`、`sitePayCreds`、`siteCost`、`chargeFinal`、`req.site`、`site_id`。

数据侧同样未变：`users 5 / orders 31 / services 2839 / sites 0`，
`orders.site_cost`、`transactions.site_id`、`sites.custom_domain / smtp_host / template` 等新列**均不存在**。

### 4. 一个仍需知情的异常

生产 `orders.js` 的修改时间（13:46:45 +0100）与 `xnow-backend` 进程创建时间（12:46:45Z）**完全一致**，
说明今天曾有"改文件 + 重启服务"的动作。核查后**内容与 `main` 逐行一致**、服务健康、数据未变，
因此**未造成任何功能变化**；但这次动作不是本会话所为（本会话只写 `/var/www/xnow-beta`），
也无法归因到具体人或进程。如实记录，供你判断是否需要排查其他会话/自动化脚本。

## 八、本轮（二十六期）主题静态核验

| 检查 | 结果 |
|---|---|
| 6 套模板在**线上实际加载的 CSS** 中 | 全部存在（classic/saas/minimal/neon/magazine/glass）|
| 6 个色系 | 全部存在（cyan/purple/green/red/orange/blue）|
| 8 个主题变量（`--brand` 等） | 全部定义 |
| 运行时是否真的写到 `<html>` | ✅ `applyTheme()` 设置 `document.documentElement.dataset.template/color` |
| 预览端口引用的 CSS 是否含主题规则 | ✅ 命中 |

作用：排除"模板名打错 → 站长选了看着没反应"这类静默失效。

## 九、上线前联调演练结果（2026-10-24 实测，全部只读、生产零改动）

### 1. 真实上线脚本的生产「只读预检」通过

用与上线**完全同构**的部署包（`server/src` 44 文件 + `client/dist` 30 文件 + 迁移脚本 + nginx 模板），
执行 `deploy-sites.sh --env prod --check`：

```
✅ 后端 JS 语法全部通过 (43 个文件)
✅ 前端产物存在
✅ 迁移脚本存在
✅ 当前数据快照：users=5 orders=31
仅检查模式，未做任何改动        退出码 0
```

预检前后对照：数据 `users=5 orders=31 services=2839 sites=0 tx=39` 完全一致、
`xnow-spa-https` 的 sha256 未变、首页与 `/api/public/config` 均 200。

### 2. 迁移脚本在「生产真实表结构」上演练通过

把生产库**结构**（12 张表）导出到临时库 `xnow_dry_*`，在临时库上跑真实迁移：

| 检查 | 结果 |
|---|---|
| 迁移前关键列 | `orders.site_cost` 0、`transactions.site_id` 0、`sites.custom_domain/smtp_host/hero_layout` 0（`orders.site_id` 已存在，属旧骨架） |
| 迁移执行 | ✅ 完成，共 **36 项变更**，退出码 0 |
| 迁移后新列总数 | 36 项齐全 |
| 幂等性（再跑一次）| ✅「无需变更（已是最新）」，不报错 |
| 目标库保护 | ✅ 故意传 `MIGRATE_TARGET=xnow_db` 被拒绝并中止 |
| 生产列数 | 演练后 `orders.site_cost` 仍为 **0**（确认没误伤生产）|
| 临时库清理 | ✅ 已删除 |
| 生产最终快照 | `users=5 orders=31 services=2839 sites=0 tx=39` 一字未变 |

**结论**：迁移在生产表结构上不会失败、可重复执行、且打错库会被自身拦住。
这三条是上线当天最可能出事的点，现在都有实测证据。

### 3. 免费子域名已端到端跑通（公网可访问）

Cloudflare 加 `*.taikon.top` 之后实测发现两个约束：
- 免费通用证书只覆盖**一级**子域名；`t1.xnow.taikon.top`（两级）解析不到 / 证书不覆盖
- 直接用泛域名接 nginx 会抢走同机其它项目的子域名

因此改为**每个分站自动生成独立 vhost**（与自有域名同一机制）：

```
https://laozhang.taikon.top/api/public/config
  → site_id=11  is_subsite=true  site_name=老张涨粉铺   HTTP 200
https://laozhang.taikon.top/                          HTTP 200
xnow.taikon.top / beta.xnow.taikon.top / t1.xnow.taikon.top   全部 200（互不影响）
```

站长侧配套新增接口 `POST /api/sites/:id/publish`（「修复域名」自助重发 vhost）。

## 十一、上线当天操作手册（我执行，你只需点头）

前置：`deploy/sites/deploy-sites.sh` 已预检通过；迁移已在生产真实表结构上演练通过；
回滚脚本就绪。以下每一步都有"看到什么算通过"。

### 上线前 5 分钟（只读）

| # | 动作 | 通过标准 |
|---|---|---|
| 1 | 记录基线：`users / orders / services / sites / transactions` 行数 | 记下数字（预期 5 / 31 / 2839 / 0 / 39）|
| 2 | `curl` 首页与 `/api/public/config` | 均 200，且 config 里**不含** `global_multiplier` |
| 3 | 备份：代码目录打包 + DB 全量 dump | 两个文件都生成且大小合理 |
| 4 | `bash deploy-sites.sh --env prod --check` | 退出码 0、输出"仅检查模式" |

### 正式上线（约 3~5 分钟）

| # | 动作 | 通过标准 | 失败怎么办 |
|---|---|---|---|
| 5 | `bash deploy-sites.sh --env prod` | 备份目录生成、迁移输出 36 项变更、代码替换完成、pm2 重启成功 | 脚本自身会 die，**不会**进入下一步；此时生产仍是旧版 |
| 6 | `bash deploy-sites.sh --env prod --verify` | 首页 200 / 接口 200 / 数据行数不变 | 立刻走「回滚」 |
| 7 | 手工抽查：主站首页外观与价格 | 与上线前**完全一致** | 立刻回滚 |
| 8 | 抽查：主站注册/登录/下单各一次 | 三步都通 | 立刻回滚 |

### 回滚（约 2 分钟）

```bash
bash deploy/deploy-sites.sh --env prod --rollback
```

- 代码：从 `$BACKUP_DIR/<stamp>/` 还原 `server/src` 与 `client/dist`
- nginx：从 `$BACKUP_DIR/prod-<stamp>-nginx/` 还原（本次会新增 wildcard，回滚即还原旧文件）
- 数据库：**不需要回滚**。本次迁移只加列、不改既有列、不动数据；
  旧代码不认识新列，忽略即可。这是刻意选的"可安全回滚"的迁移方式。

### 上线后 24 小时观察点

| 观察项 | 为什么 |
|---|---|
| 主站订单量是否正常 | 上线第一优先是**别影响主站卖货** |
| 有没有 `No Config` 报错 | 分站充值未配商户时的预期行为，但主站不该出现 |
| 数据行数是否只增不减 | 排除误删 |
| `pm2 logs xnow-backend --err` 是否出现 `site` 相关异常 | 多租户识别出错会在这里暴露 |

## 十二、正式证书（可选，不影响上架）

现在自有域名用自签证书：走 Cloudflare 代理时客户访问**正常**，
只有绕过 CF 直连才会看到"不安全"。要绿锁需装 certbot：

```bash
sudo bash deploy/sites/install-certbot.sh --check   # 先看现状（只读）
sudo bash deploy/sites/install-certbot.sh           # 安装 + 给所有域名签发
```

脚本幂等、逐个域名独立处理（单个失败不影响其它）、失败时现有自签证书继续可用。
⚠️ 这是系统级 `apt install`，需祥哥批准后执行。

## 十三、仍需你本人决定/操作的三件事

| # | 事项 | 谁来做 | 影响 |
|---|---|---|---|
| 1 | 看一眼 Beta 并确认"能拿去卖" | 你 | 上线唯一真正前置条件 |
| 2 | 批准装 certbot（`install-certbot.sh` 已就绪）| 你批准我装 | 自有域名从"能用但警告"变成"浏览器绿锁" |
| 3 | 说一句"部署到生产" | 你 | 我来执行，已备好一键脚本与回滚 |
