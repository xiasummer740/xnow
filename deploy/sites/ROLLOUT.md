# 分站体系 · 上线执行方案（Production Rollout）

> 状态：**待祥哥验收后执行**。本文只是方案，未执行任何生产变更。
> 记录时间：2026-10-24 · 分支 `feat/sites`（25 个提交）

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
