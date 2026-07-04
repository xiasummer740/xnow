# XNOW 项目进度日志

## [2026-06-20] 项目清理 + VPS GitHub SSH key + 权限白名单

### 完成
1. **项目根目录散落记忆文件清理** — 23 个记忆 `.md` 文件从项目根移到 `memory/` 目录，更新 `MEMORY.md` 索引路径
2. **VPS GitHub SSH key 配置** — 生成 `ed25519` 密钥，添加为 xnow 仓库 deploy key（读写权限），remote 切换为 SSH 地址 (`git@github.com:xiasummer740/xnow.git`)，`git pull` 验证通过
3. **删除多余文件** — 项目根 `package-lock.json`（无对应 package.json）
4. **权限白名单全局化** — `~/.claude/settings.json` 添加 `permissions.allow`（`git *`, `ssh *`, `npx eslint/prettier *`, `python3 *`, `chmod *` 等），项目 `.claude/settings.local.json` 精简

### 三方同步状态
- 本地: `8865a099` ✅
- GitHub: `8865a099` ✅

## [2026-06-20] 公告同步静默失效修复（第2轮）

### 问题
上次修复后公告同步依然每 30 分钟推送一次相同的"6.19号更新"消息，6 小时内重复推送 12 次。

### 根因
`announceSync.js:119` 使用 `newContent !== existingClean` 对比**完整 HTML**，上游页面每次请求返回的 HTML 可能有细微动态差异（属性顺序、空白、CSS 值等），导致始终判定为"有变化"。

### 修复内容
- **`server/src/utils/announceSync.js`** — 加入 `stripHtml()` 函数，剥离所有 HTML 标签后只比纯文本内容
- 上游纯文本没变 → 不打日志 + 不发通知
- 上游纯文本变了 → 正常更新 + 通知

### 部署
- Commit: `2c15fc9c`，已推送 GitHub ✅
- VPS 已 git pull + pm2 restart ✅
- SSH 配置修复：启用 `PubkeyAuthentication yes`，添加 `xnow-vps` Host 别名

### 三方同步状态
- 本地: `2c0056d9` ✅
- GitHub: `2c0056d9` ✅
- VPS: `2c0056d9` ✅（服务已重启）

## [2025-06-20] 公告同步静默优化

### 问题
上游公告同步每 30 分钟执行一次，但无论公告是否变化都输出日志 `📢 [AutoAnnounce] 开始检查上游公告...`，造成日志噪音。

### 目标效果
| 情况 | 效果 |
|------|------|
| 上游公告没变 | 不打日志 + 不发通知，完全安静 |
| 上游公告更新了 | 更新公告 + 打一行日志 + 发一条 Telegram |

### 修改内容
- **`server/src/utils/announceSync.js`**
  - 移除第 42 行 `console.log("📢 [AutoAnnounce] 开始检查上游公告...");`
  - 修复 `sendTgMessage` 字符串拼接格式（`\`续行 → `\n`）
  - 添加注释说明静默行为
  - 对齐缩进

### 操作记录
1. 本地移除日志行 → 提交 `1cfb97d5`
2. 发现服务器已有相同修复 + 额外格式优化
3. 以服务器版本为准，合并格式优化
4. 本地完整提交 `6fe74c56` → 推送 GitHub
5. VPS git pull 遇到冲突（注释有 ✅ 表情差异）
6. 解决冲突，VPS reset 对齐 `6fe74c56`
7. PM2 重启服务生效

### 三方同步状态
- 本地: `40892dac` ✅
- GitHub: `40892dac` ✅
- VPS: `40892dac` ✅（服务已重启）

### 待办
- [ ] VPS 配置 GitHub SSH key 以便服务器直接推送

## [2025-06-20] PM2 开机自启配置

### 操作
- 在服务器执行 `npx pm2 save` 保存进程列表
- `npx pm2 startup` 创建 systemd 服务 `pm2-root.service`
- 已 `enable`，服务器重启后自动恢复 xnow-app 进程

## [2025-06-20] 安全加固修复（4项）

### 问题
安全全面审查发现以下问题：

| 严重度 | 问题 | 文件 |
|--------|------|------|
| HIGH | 硬编码万能验证码 `666888`，绕过邮箱注册验证 | `auth.js:19` |
| HIGH | 备份文件下载/删除/还原存在路径穿越，可读写系统任意文件 | `admin.js` |
| MEDIUM | SSL 证书验证关闭（`rejectUnauthorized: false`） | `announceSync.js`, `admin.js` |
| LOW | postMessage 使用通配符 `*` 目标域 | `pay.js:112` |

### 修改内容
1. **`auth.js`** — 移除 `if (code === '666888')` 万能验证码
2. **`admin.js`** — 添加 `safeBackupPath()` 校验函数，所有备份操作路径必须限制在 `BACKUP_DIR` 内
3. **`announceSync.js`**、**`admin.js`** — 移除 `rejectUnauthorized: false`，恢复 SSL 证书验证
4. **`pay.js`** — `postMessage` 目标域从 `'*'` 改为 `window.location.origin`

### 影响评估
- 不影响网站正常运行
- 后台备份操作与之前完全一致
- 注册流程必须经过邮箱验证（不能再填 666888 跳过）

### 三方同步状态
- Commit `40892dac`，已部署至 VPS，PM2 已重启生效

## [2025-06-20] 前端 JS 文件 hash 不匹配修复

### 问题
`client/dist/index.html` 引用的 JS hash 与实际构建产物不一致，nginx SPA 兜底返回 `index.html`，浏览器报 MIME 类型错误（`Expected a JavaScript module script but served with MIME type "text/html"`）。

### 根因
`index.html` 被更新（Jun 19 16:04）但 JS 资源未重新构建（Jun 16 12:24），hash 对不上。

### 修复
- 在服务器执行 `cd /var/www/xnow/client && npm run build` 重新构建前端
- 重建后 hash 一致，页面正常访问

## [2026-07-04] 第一期：Admin 面板数据基建（4项）

### 完成
1. **ECharts 图表集成** — 安装 echarts+vue-echarts，扩展 finance API（topServices/topUsers/registrationTrend/orderStatusDist），Admin 面板新增 4 个 ECharts 图表（收入趋势折线图、支付渠道饼图、服务排行柱状图、每日注册柱状图）
2. **服务端分页 + 筛选** — 新增 `/api/admin/{users,orders,transactions}` 三个分页查询接口，支持 search/status/role/type/date range 筛选；Admin.vue 三张表改为服务端分页 + 筛选控件
3. **CSV 导出** — 新增 `/api/admin/{users,orders,transactions}/export` 三个导出接口，前端每张表标题栏加 📥 导出 CSV 按钮
4. **审计日志** — 新建 `AuditLog` 模型（audit_logs 表），admin 路由 7 处注入审计点（config/role/fund/ban/delete/backup），Admin 面板加 📋 操作日志查看区块

### 踩坑
- VPS 构建缺 `VpnAdmin-kkDSGsT6.js` chunk 导致页面白屏，最后本地构建上传解决
- 全局 CLAUDE.md 加规则 13「自证完成」— 改完必须我亲自验证通过再交作业

### 三方同步状态
- 本地: `3232a8b0` ✅
- GitHub: `3232a8b0` ✅
- VPS: `3232a8b0` ✅（服务已重启，前端 dist 已上传）

## [2026-07-04] 二~五期：Admin 面板全面增强 + Nginx 缓存 + 数据库迁移修复

### 完成
1. **二~五期 Admin 面板增强** — `65cc93c1`
   - 二期: Admin 面板 Tab 化重构（概览/用户/订单/流水/财务/配置/日志 7 Tab）
   - 三期: 订单运营增强（退款/状态刷新/详情弹窗/管理员备注）
   - 四期: 用户运营增强（用户详情弹窗/订单流水历史/备注标签/站内通知）
   - 五期: 营销工具（CSV 导出加备注列/全局公告推送/通知铃铛 UI）
2. **修复 `admin_note` 缺列崩溃** — `Order.js`/`User.js` 模型加了 `admin_note` 字段但数据库没同步，导致所有查询报错 `Unknown column`，页面白屏。已为 `users`/`orders` 表补加列
3. **Nginx 缓存策略** — HTML 设为 `no-store` 不缓存，assets 设为 `immutable` 永久缓存（文件名带 hash），防止更新后浏览器加载旧 JS 导致白屏
4. **从备份恢复 System Core 配置** — dashboard 因缺列报错导致表单加载失败，用户保存时空值覆盖了数据库。从 `7月1日备份` 恢复全部配置（Telegram/Cryptomus/BufPay/SMTP/Logo 等）
5. **credentials-vault 同步** — 更新 `config.md` 日期到 2026-07-04

### 踩坑
- 数据库模型加字段但没跑 migration → 整站崩溃，以后改模型必须同步加列
- 表单加载失败时"保存系统配置"会覆写数据库空值 → 考虑加空值保护
- credentials-vault 已有完整配置，以后凭证直接存那里

### 三方同步状态
- 本地: `65cc93c1` ✅
- GitHub: `65cc93c1` ✅
- VPS: `65cc93c1` ✅（admin_note 列已补，nginx 已 reload，配置已恢复）

## [2026-07-04] 六期：Admin 面板三增强 — 用户分析/服务排行/财务大盘

### 完成
1. **用户详情分析面板** — `4ff41786`
   - 新增 `/api/admin/users/:id/analysis` 接口（消费总览/充值统计/服务分布/月度趋势）
   - 用户详情弹窗新增消费分析卡片（总消费/订单/均单价/充值/佣金/活跃周期）+ 服务使用分布列表
2. **TOP 服务收入排行优化**
   - SQL 联表 `LEFT JOIN services` 拿到 `description`（简介）
   - 图表 Y 轴显示 `ID:xxx 服务名`，tooltip 悬浮显示完整简介 + 收入/利润/订单数
   - 新增服务排行详情文字列表（ID/名称/简介/收入/利润全显示）
3. **财务大盘数据增强**
   - 新增指标卡：ARPU（人均充值）、本月环比上月增长率、用户总数/近30日新增、今日订单/已完成
   - 新增订单状态分布饼图（已完成/进行中/排队中等）
   - 新增 TOP 消费用户排行列表
   - 新增退款率、环比增长率等汇总指标

### 三方同步状态
- 本地: `4ff41786` ✅
- GitHub: `4ff41786` ✅
- VPS: `4ff41786` ✅（服务已重启，前端 dist 已构建）
- 初始部署

## [2026-07-04] 七期：用户详情修复 + IP地理位置 + 角色中文显示

### 完成
1. **用户详情加载失败修复** — `56563ed8`
   - `Promise.all` 捆绑 3 个 API（订单/交易/分析）改为独立 try/catch，单个失败不拖累其他
   - 只有三个全跪才弹 toast，否则部分数据正常展示
2. **角色中文显示** — `595e203b`
   - 用户详情弹窗角色栏从原始值 `user` 改为显示"黄金用户"等中文
3. **IP 地理位置** — `b87d3715`
   - 新增 `/api/admin/geo/:ip` 代理 ip-api.com 查询
   - 用户详情注册IP/最后登录IP后显示 `(国家 城市)`
4. **修复 fetchGeo 401 登出** — `1731803a`
   - `fetchGeo` 未带 Authorization header 导致请求被拦，触发全站登出

### 踩坑
- VPS PM2 重启后仍跑旧进程（`EADDRINUSE`），需 `killall -9 node` 或 `fuser -k 3000/tcp` 清理
- dist 文件在 VPS 上有本地变更，每次 git pull 需先 stash
- IP 地理查询依赖 ip-api.com 免费服务（45次/分钟限制），内网 IP 直接跳过

### 待解决
- **网站右上角角色标识** — 当前使用 `hidden sm:inline-flex` 在小屏不可见，且需确认是否按 `用户`/`gold`/`agent`/`admin`/`super_admin` 正确显示中文
- **余额显示** — 确认余额 ¥28.00 等金额展示是否正确

### 三方同步状态
- 本地: `1731803a` ✅
- GitHub: `1731803a` ✅
- VPS: `1731803a` ✅（服务已重启）
