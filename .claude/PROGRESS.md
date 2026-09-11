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

### 待解决（下个对话接力）
- **余额显示** — 确认余额 ¥28.00 等金额展示是否正确

### 三方同步状态
- 本地: `1731803a` ✅
- GitHub: `1731803a` ✅
- VPS: `1731803a` ✅（服务已重启）

## [2026-07-04] 七期-2：右上角角色标识修复

### 完成
1. **右上角角色标识始终可见** — `48760d4`
   - `hidden sm:inline-flex` 改为 `inline-flex`，小屏不再隐藏
   - 角色映射：`user`/`gold`→黄金用户, `agent`→至尊代理, `admin`→管理员, `super_admin`→至尊管理员

### 三方同步状态
- 本地: `48760d4` ✅
- GitHub: `48760d4` ✅

## [2026-07-05] 八期：VPS PM2迁移 + 角色样式统一 + 公告编辑区重构 + 管理员余额改造

### 完成
1. **PM2 接管应用** — `49581f7`
   - 修复 PM2 symlink 断链，停用旧 systemd 服务（`xnow-api.service`），PM2 管理 xnow-app
   - `xnow verify` health check 200 ✅
2. **角色显示统一** — `49581f7` / `a5bcc65`
   - DashboardLayout 右上角、Admin.vue 用户列表、详情弹窗的角色名称统一使用 i18n
   - `admin` →「至尊管理员」，使用 `x-badge badge-admin` CSS 样式（红色脉冲+流光）
3. **公告编辑区重构** — `5dcb6b6`
   - 拆分为「上游公告预览（只读）」和「正式公告编辑器」两个区域
   - 一键拉取上游不再覆盖编辑器内容，需要「填入编辑器」确认
   - sync-announcement 路由不再自动存 DB（由定时任务负责）
4. **管理员余额显示上游余额** — `ceb7319e` / `16c7324` / `ffee917d` / `49ace16`
   - 概览卡片上游余额 < 30 时显示红色 ⚠️ 余额不足
   - 玩家金库汇总、财务负债 SQL 排除管理员账号
   - 右上角头部、用户列表、详情弹窗的管理员余额统一显示上游 API 余额

### 踩坑
- DashboardLayout 变量名 `app`→`appStore` 写错导致 Vue 白屏
- VPS `client/dist/index.html` 有本地改动导致 git pull 被拦，需先 stash
- 上游公告定时间步疑似因 EADDRINUSE 崩溃重启导致重复触发通知

### 三方同步状态
- 本地: `49ace166` ✅
- GitHub: `49ace166` ✅
- VPS: `49ace166` ✅（PM2 运行中，前端 dist 已构建）
- VPS: `48760d4` ✅（服务已重启）

## [2026-07-05] 公告同步误判修复—双重确认机制

### 问题
公告同步每 30 分钟轮询上游，但上游页面每次请求有动态元素（CSS 变量、会话信息等），导致 `stripHtml` 纯文本比对永远判为"变了"，频繁推送 TG 通知。

### 修复内容
- **`server/src/utils/announceSync.js`** — 三重判定逻辑：

| 情况 | 处理 |
|------|------|
| 全文一致 | 啥也不干 |
| 版本号 `【X.X号更新】` 变了 | 更新 + 发 TG 通知 |
| 版本号相同但文本有差异 | MD5 指纹暂存，下次轮询确认一致才发通知 |

### 关键细节
- 版本号变化：立即通知（上游标了版本号的更新）
- 文本变化但版本号没变：用 `announce_pending_hash` Config key 存 MD5 指纹
  - 第一次发现新内容 → 静默更新，记下指纹
  - 30 分钟后第二次检查指纹一致 → 确认是真变更，发通知
  - 指纹不一致 → 动态干扰，继续等稳定
- 上游直接改公告内容不发版号的情况也能正确识别

### 三方同步状态
- 本地: `f4f0f6b9` ✅
- GitHub: `f4f0f6b9` ✅
- VPS: `f4f0f6b9` ✅（PM2 已重启）

## [2026-07-08] 九期：安全节点全面优化（19项，分4批部署6次提交）

### 完成

#### 🔴 Bug修复（6项）
| 改动 | 说明 |
|------|------|
| 续费价格计算 | 纯续时长改为按当前套餐流量计费，不再硬编码10GB |
| 购买/续费限流 | 10s/5s各1次，keyGenerator 兼容 express-rate-limit v8 |
| 流量同步异常 | 失败有日志+错误列表返回 |
| 续费XX-UI失败 | 告警提示，不影响DB更新 |
| 过期二维码 | 灰度+水印，不可复制 |
| 公告重复通知 | 旧代码未部署，VPS git pull + pm2 restart 补上 |

#### 📈 功能增强（5项）
| 改动 | 说明 |
|------|------|
| 节点测速 | 后端ping + 前端延迟标签（绿/黄/红） |
| 连接教程 | Clash/Sing-Box/Shadowrocket/v2rayN 四端教程 |
| 搜索过滤 | 节点名称/位置搜索 + 区域筛选 |
| 信任背书 | 已服务人数/节点数/支付方式/客服 badge |
| 首页引导 | 3个使用场景卡片直链到商城 |

#### 🎟️ 商业化功能（4项）
| 改动 | 说明 |
|------|------|
| 管理员统计看板 | 6格指标卡 + 30天订单趋势柱状图 + 各节点用量条 + 近30天收入 |
| 优惠码系统 | Coupon模型 + 前后端CRUD + 购买时输入验证 |
| 流量预警 | 每小时检查90%用量，TG通知管理员 |
| 自动归档 | 过期30天自动标记archived |

#### 🚀 获客功能（4项）
| 改动 | 说明 |
|------|------|
| 免费试用 | 新用户100MB/3天，管理员可配置开关和流量 |
| 多协议切换 | 节点自定义协议列表（可编辑），前端按节点显示 |
| 节点详情面板 | 购买前展示协议数/容量/线路/延迟 |
| 使用案例引导 | Home.vue 三个场景卡片直链安全节点 |

#### 🛠️ 技术债务（5项）
| 改动 | 说明 |
|------|------|
| flag映射表合并 | VpnShop EMOJI_MAP+NAME_MAP 替代 FC+ETOC |
| 节点列表缓存 | 30秒内存缓存 |
| 轮询优化 | VpnClients 5s→15s |
| ALTER TABLE 修复 | 表名 `VpnProducts`→`vpn_products`（underscored命名） |
| rateLimit v8兼容 | keyGenerator 不用 `req.ip` |

### 踩坑
- express-rate-limit v8.x 在构建 rateLimiter 时校验 keyGenerator 源码，引用 `req.ip` 直接抛 `ERR_ERL_KEY_GEN_IPV6` 阻止模块加载，导致 `/products` 等无关接口也挂掉
- Sequelize `underscored: true` 下表名是 `vpn_products` 而非 `VpnProducts`，ALTER TABLE 需对应
- VPS 前端 dist 有本地 변경사항，需 `vite build` 后 scp 上传（不能用 git 管理 dist）

### 待办（下个对话接力）
- 购买流程幂等性保障（需建表存请求指纹）
- VpnAdmin 样式统一（xui旧样式→tailwind）
- 内容营销 / KOL合作 / SEO落地页（需祥哥给方向）

### 三方同步状态
- 本地: `1507ca05` ✅
- GitHub: `1507ca05` ✅
- VPS: `1507ca05` ✅（代码已拉取 + PM2已重启 + 前端dist已上传）
- express-rate-limit v8 兼容修复已生效
- 数据库 protocols 列已手动添加成功

## [2026-09-05] 资金/支付/公告安全加固批次（9项，含安全审查8高危全修）

### 完成
1. **管理员加款/扣款后即时刷新余额** + 校验后端响应防假报成功（`bcfdf79f`）
2. **用户列表 IP 旁显示地区**（广东深圳/美国洛杉矶，后端批量 geo + 缓存防限流）（`22d6e2c9`）
3. **AutoAnnounce 公告抓取崩溃修复** + 下单页加载失败/登录失效明确引导（`48b35d7e`）
4. **安全审查 8 项全修**（`734131da`）：支付伪造补单 / 负倍率刷余额 / 权限提升 / v-html XSS / 充值iframe origin / 空数组同步清空数据 / 退款·备份静默失败 / 缺路由角色守卫
5. **支付入账失败不再误标完成**（防真实付款被跳过资金静默丢失）+ 金额 NaN 护栏（`e6cd73a0`）
6. **移除硬编码超管离线口令** `super-admin-offline-token`（`c824db8b`）
7. **Cryptomus USDT 回调修复**——原为空 handler 导致 USDT 付款不到账：验签入账 + 服务端签名对账兜底 + 下单即登记待支付单，补单引擎支持 USDT（1小时发票不按5次重试判死）（`b2c61af5`）
8. **系统公告恢复富文本排版**——上轮 XSS 修复把公告 v-html 降级纯文本导致 HTML 源码裸露：后端 sanitize-html 白名单净化入库（announceSync / config/update 双入口），前端安全 v-html，站内通知推送转纯文本（`b895f651`）
9. **公告字号/行距统一收敛**——内联 font-size 在净化时剥离，字号归前端 CSS 一处控制可整体调节（`da939a6d`）

### 验证
- 每项 node --check / client build 通过后部署；线上 health=db connected、首页 200、日志零新增报错
- 存量公告数据已两次净化迁移（剥危险内容 + 剥内联字号）
- 新增服务端依赖 `sanitize-html`（`server/src/utils/sanitize.js`）

### 三方同步状态
- 本地: `da939a6d` ✅
- GitHub: `da939a6d` ✅
- VPS: `da939a6d` ✅（pull + pm2 restart + client 重建均已执行）

## [2026-09-09] SEO 地基一期 + Google Search Console 验证（暴露率提升）

### 完成
1. **SEO 全面诊断** — 结论：面向海外（域名未备案+美服，放弃国内百度），S2/SaaS 页只有 2 个公开页（`/`、`/vpn`）值得被收录，其余功能页全部 noindex
2. **每路由独立 SEO tags**（`client/src/utils/seo.ts`）— 公开页独立 title/description/canonical；功能页统一 title + noindex + 移除 canonical（`aa595df1`）
3. **自建访问统计 + Admin 流量看板** — 不依赖第三方：localStorage uuid UV + sendBeacon 埋点 → 后端 `page_views` 表 30s 节流 + ip-api.com 批量 geo（30min 缓存）→ Admin「🌐 流量」Tab 展示 7/30/90 天 PV/UV 趋势 + TOP 页面 + 来源 + 国家饼图（`aa595df1`）
4. **sitemap.xml / robots.txt 瘦身** — 只留 2 个公开 URL；robots 拦掉全部功能/登录/API 路径防无效抓取（`aa595df1`）
5. **修复 geo.js 漏 export 致生产崩溃** — `isLocalIp` 未导出致 analytics ESM 加载即崩服（health 000），真实 `import` 实测拦截（`653007f8`）
6. **Google Search Console 域名所有权验证（最终走通）** — 路径：Cloudflare `xnow.taikon.top` 子域加 TXT → Google 提示"找不到令牌"（令牌不匹配）→ 改**网址前缀 + HTML 文件验证**一次通过：服务器放 `google9e165c63d6e32363.html`（`server /var/www/xnow/client/dist/`），公网 HTTP 200 → GSC「已完成所有权验证」
7. **GSC 提交 sitemap.xml** — 状态成功，发现 2 个网页（`/` + `/vpn`）

### 关键决策与坑
- **验证令牌不匹配坑**：GSC「网域」方式每个资源有专属 DNS 令牌，从 Cloudflare 根域抄的 `-yVziX...` 对不上 xnow.taikon.top 子域资源的令牌 → 验证失败多次。换 HTML 文件验证（不依赖 DNS 令牌）一次通过
- **浏览器自动化 daemon 坑**：browser-use CLI 在 Windows 上 daemon 端口动态分配，残留 state.json 骗 CLI 连死 daemon 致 60-90s 超时——手动拉干净 daemon + close 清状态即可恢复，工具本身没坏
- **服务器验证文件必须保留**（Google 要求，删了掉验证状态）；文件未入库 dist 属运行时产物

### 遗留
- 之前用「网域」方式添加失败的 `xnow.taikon.top` 资源是失败残留，可忽略/删除，不影响新的网址前缀资源
- 预渲染/内容建设（阶段二）未做，等量起来再说

### 三方同步状态
- 本地: `653007f8` ✅
- GitHub: `653007f8` ✅
- VPS: `653007f8` ✅（pull + pm2 restart + client 重建 + 验证文件放置均已完成）

## [2026-09-09] SEO 二期：首页中英双语 `/en` 镜像 + 全平台关键词内容布排

### 完成
1. **关键词地图**（中英 × 全平台）→ 新增 `.claude/seo-2-keywords.md`：意图分级 T1~T5、TikTok/IG/YT/TG/FB/X + 泛站矩阵、每块落到页面何处的布排表
2. **`/en` 英文镜像路由** — 复用 Home.vue 按路径强制英文（首帧即对），路由公开白名单加入 `/en`（原守卫会把无登录访客/爬虫弹去登录页）
3. **seo.ts 双语化** — `/en` 独立英文 title/desc；按语言设 `html lang`；`/` ↔ `/en` 互发 hreflang（zh-CN / en / x-default），canonical 各自正确
4. **Home.vue 全面真双语** — 平台名/FAQ/服务预览 EN 补齐（原 EN 模式夹中文）；H1 下植入全平台关键词导语；顶栏语言按钮改为 `/` 与 `/en` 间路由跳转
5. **VPN 区弱化** — 区名「他们都在用安全节点」→「谁在用 XNOW / Who It's For」，卡片与 `/vpn` 链接保留（祥哥定：保留不宣传）
6. **sitemap 收录 `/en`**（2→3 URL）

### 关键决策
- **中英双覆盖结构**：单 URL 只能被 Google 当一个语言收录 → 加 `/en` 镜像 + hreflang 互指（中文主版 `/`、英文 `/en`）
- **写词避雷落地**：上会话中文大段涨粉词枚举触发 400 Content Exists Risk → 本次关键词表分块小段、中英间隔写入文件，会话内不整段回贴，全流程零拦截

### 验证（浏览器实测）
- 本地 build 通过（720 模块零报错）；dev 实测中英两版 title/html lang/hreflang/FAQ/语言跳转全过
- **生产 VPS（xnow-vps=192.129.210.52）scp dist 整包上传**：线上 `/` 与 `/en` 均 200，title/canonical/hreflang 正确，EN FAQ/导语在线渲染
- 线上 sitemap 含 3 URL、robots 放行、**Google 验证文件 google9e165c63d6e32363.html 保留**（只覆盖未删）

### 坑
- `tools/deploy-vps.py` 是**旧机残留**（154.9.238.163 已 2026-08-28 跑路）含死口令 + pm2 名错（`xnow`≠`xnow-backend`）——连接超时误导排查，建议删除（待祥哥确认）

### 遗留/下步
- ✅ GSC 手动重提 sitemap 完成（祥哥 2026-09-09 在浏览器操作）：线上 `/sitemap.xml` 状态「成功」，**已发现网页 2→3**，`/en` 已被 Google 读取，待其自然收录
- 收录后用 GSC 搜索分析校准关键词；若量起来再考虑 TikTok 等细分落地页
- 页面 title 短于某品牌已有 SEO 一期规则，本次沿用
- GSC 界面左侧菜单中英重叠为 Google 官方显示毛病（非本站问题），不影响功能，用「直达链接 + 主区域操作」绕过即可

### 三方同步状态
- 本地: `7ca6d4d` ✅　GitHub: `7ca6d4d` ✅　VPS: 前端 dist 已更新至 `7ca6d4d`（后端未动，无需重启）

### 补充批：og 分享卡 + FAQ 结构化 + index 静态 meta 收敛（同日）
1. **og:image 分享图** — 截线上首页 1200×630 → `client/public/og-image.png`（143KB 真图，vite 自动入 dist）
2. **og/twitter 随语言走** — seo.ts 对可收录页写入 og:locale(zh_CN/en_US)/title/desc/url/image + twitter:card，`/en` 分享出英文卡
3. **FAQPage JSON-LD** — Home.vue 从 faqs 单一数据源生成 6 问 FAQPage schema，语言切换自动重建
4. **index.html 静态 meta 对齐** — 标题/描述对齐 seo.ts `/` 首页词，去陈旧 spam keywords 标签

### 补充批验证
- 本地 build 过；dev 实测 `/`(zh)与 `/en` 两版 og:locale/title/FAQ 正确
- 生产 VPS scp 部署：`/en` 线上 og en_US + FAQPage×6，og-image.png `/` `/en` 全 200，Google 验证文件完好
- 遗留：FAQ 富摘要现仅对权威站展示，schema 属低成本无害加分项

### 三方同步状态（补充批）
- VPS 前端 dist 已更新（`index-BqS-zoTp.js`）；代码待本批提交推送

## [2026-09-10] SEO 三期：构建期静态预渲染 + 新 logo/favicon 上线

### 问题
二期做的「随语言 og」依赖客户端 JS 改 head——但 Facebook / Twitter / Discord / Telegram 的爬虫**不执行 JS**，分享任何页面出去的卡片都是同一张中文卡；Google 也要跑完 JS 才看到正确 meta，收录更慢。实测部署前三 URL（`/` `/en` `/vpn`）返回**完全相同的 2939 字节 SPA 壳**，静态 HTML 里连 canonical / hreflang 都没有。

### 完成
1. **`client/scripts/prerender.mjs`** — 构建后按路由把 SEO 元信息**静态写进独立 HTML**：`/` → `dist/index.html`、`/en` → `dist/en.html`、`/vpn` → `dist/vpn.html`；找不到 `<!--seo:start/end-->` 标记即报错退出（避免产出无 SEO 页面）
2. **`client/src/utils/seo-config.json`** — 抽出元信息唯一数据源，前端 `seo.ts` 与构建脚本共用，防两处漂移
3. `seo.ts` 改为 import 该配置；`index.html` 加注入标记 + canonical + hreflang ×3；`package.json` build 挂 prerender
4. **新 logo/favicon** — `logo.png` 由 **68 字节占位图**换成真图 256×256；新增 `favicon.ico` / `favicon-32.png` / `apple-touch-icon.png`，`index.html` 去掉 `vite.svg` 引用
5. `finance.html` 加 noindex + robots 拦 `/finance.html`

### 部署（VPS 192.129.210.52）
- **nginx `try_files` 加 `$uri.html` 解析**（`xnow-spa-https` + `xnow-spa` 两处，保持一致防回源路径不确定）——备份 `/root/xnow-spa*.bak-20260910-151656`，`nginx -t` 通过后 reload
- dist 用 `tar` 管道上传（**不用 `--delete`**），Google 验证文件 `google9e165c63d6e32363.html` 完好保留

### 验证（实测证据）
- 线上三 URL 现返回**三份独立静态 HTML**（3441 / 3328 / 2955 字节），不再是同一壳
- `/en`：`<title>Buy TikTok Followers…` + `lang=en` + `canonical /en` + `og:locale en_US` + hreflang ×3；`/vpn` 独立 canonical 且无 hreflang（符合设计）
- 浏览器实测 `/`(zh) `/en`(en) 渲染正常、logo 256×256 加载成功、FAQPage schema 就位、**console 零报错**
- favicon 套件 / logo / og-image / sitemap / 验证文件全部 200

### 关键决策
- **`/en.html` 与 `/en` 并存不重复**：静态壳内 canonical 指向 `/en`，Google 自动合并
- **只改对外那个 nginx（`xnow-spa-https`）不够**：`xnow-spa`(127.0.0.1:8080) 同源同根，回源路径不确定，两处一起改才保证生效

### 新发现（待祥哥拍板）
- 🔴 **sitemap 里的 `/vpn` 是坏 URL**：`router/index.ts:44` 白名单只有 `['/', '/en', '/login']`，`/vpn` 不在其中 → 未登录访客与爬虫访问会被踢去 `/login`。Google 跑 JS 后看到登录页，语义与静态壳冲突。**这是既存问题，非本次引入**。两条路：① 把 `/vpn` 加进白名单（承认它是公开营销页，与 sitemap 意图一致）② 从 sitemap 移除并 robots 拦掉（承认它是功能页）

### 遗留清理项（未动，等祥哥定）
- `client/public/.mcp.json` + `client/public/.claude/` 混进 web 根，会被 vite 拷进 dist（实测线上返回 SPA 首页、**未泄露真文件**，但属构建垃圾）
- 工作产物：根目录 `logo-preview*.png`、`favicon-compare.png`、`.claude/_tmp_services.json`(803KB)、`.claude/logo-src/`

### 三方同步状态
- 本地: `ae24a242` ✅　GitHub: `ae24a242` ✅　VPS: 前端 dist 已部署（后端未动，无需重启）

## [2026-09-10] /vpn 转公开页（A方案）+ 顺带挖出两个安全隐患

祥哥拍板 A：`/vpn` 是 sitemap 里的公开营销页，就该让访客和爬虫看得到。

### 完成
1. **`/vpn` 加入免登录白名单**（`router/index.ts`）— 原先白名单只有 `['/','/en','/login']`，访客/爬虫访问 `/vpn` 被踢去 `/login`，与 sitemap 意图冲突。`/vpn/clients`、`/vpn/admin` 是精确匹配不受影响，仍需登录
2. 🔴 **公开商品接口泄露面板密钥**（`vpn.js`）— `GET /api/vpn/products` 是公开接口，却 `res.json({nodes: products})` 把 Sequelize 对象整个吐出，含 **`xxui_url`（上游面板地址）+ `xxui_api_key`（面板 API 密钥）**。改为只回展示字段（id/name/description/vps_location/flag_emoji/max_traffic_gb/price_per_gb/protocols）。**属"上架即引爆"的定时炸弹**：当前节点数 0 所以没实际泄露，但上架第一个节点就会把 VPS 面板控制权公开发出去
3. 🔴 **回流服务器上的未提交加固**（`app.js`）— VPS 工作区是 `app.listen(PORT,"127.0.0.1")`，仓库里却是 `app.listen(PORT)`（监听 0.0.0.0）。仓库缺这份加固 = 下次谁从仓库部署就把 3000 端口暴露回公网。已补回仓库
4. **未登录 UI 修正**（`VpnLayout.vue`）— 放行后暴露：header 无条件渲染余额/手机号/退出按钮，访客看到「余额 ¥0.00」和"退出"。改为按 `userStore.token` 分支：登录显示余额/退出，未登录显示「登录 / 注册」

### 验证（线上浏览器实测）
- **未登录**访问 `/vpn`：URL 稳在 `/vpn` 不跳转，header = `安全节点控制台 EN 登录 / 注册`，无余额无退出
- **注入假 token 模拟登录**：header = `…余额 ¥88.50 13800000000 EN 退出`，两分支均正确
- `canonical` = `/vpn`，营销文案完整渲染（TikTok限流/原生住宅IP/防封标记），**console 零报错**
- 后端 `3000` 端口实测只绑 `127.0.0.1`；`/api/vpn/products` 返回正常
- VPS 拉取时 `app.js` 报冲突（服务器有本地修改），因该修改已回流到仓库、内容一致，`git checkout` 后拉取安全

### 新发现（未处理，待祥哥定）
- ⚠️ **数据库节点数为 0**（`VpnProduct` 一条记录都没有）→ `/vpn` 商品区是空的，页面靠营销文案撑着。要让 `/vpn` 真正有收录价值，**得先上架节点**
- ⚠️ `POST /api/vpn/coupon/validate` 无鉴权也无频率限制，可被枚举猜优惠码（低危，优惠码本身通常也会公开）

### 遗留清理项（仍未动）
- `client/public/.mcp.json` + `client/public/.claude/` 混进 web 根（会被 vite 拷进 dist，线上未泄露）
- 工作产物：`logo-preview*.png`、`favicon-compare.png`、`.claude/_tmp_services.json`(803KB)、`.claude/logo-src/`

### 三方同步状态
- 本地: `070cd49b` ✅　GitHub: `070cd49b` ✅　VPS: 后端已 pull + pm2 restart，前端 dist 已更新

## [2026-09-11] 工作区清理（上面两批的收尾卫生）

祥哥拍板「清理工作区」——把三期/vpn 留下的工作产物一次性归位。

### 完成
1. **构建垃圾出 web 根** — 删 `client/public/.mcp.json`（MCP **模板**文件误落 public，会被 vite 拷进 dist 公开发布；根目录已有真配置）+ `client/public/.claude/`（启动脚本快照）
2. **临时文件** — 删 `.claude/_tmp_services.json`(788K)
3. **logo 工作产物归档** — 源图 3.2M（`xnow-logo*.png`/`square`/`disc`/`favicon-solid*`）+ 预览 6 件（`logo-preview*.png`/`favicon-compare.png`/`logo-preview.html`）收进 `.claude/logo-src/`，整目录 gitignore。**选归档不选删除**：源文件未进版本控制，删了不可恢复，以后改 logo 还得重找素材
4. **修 .gitignore 路径 bug** — 原规则写的是 `client/.claude/startup-status.json`，而实际垃圾落在 `client/public/.claude/`，路径对不上 → **一直没拦住**。已补正并覆盖两个路径
5. **`.claude/startup-status.json` 停止跟踪**（`git rm --cached`，本地文件保留）— 启动脚本每次重写它，导致每次启动工作区都是脏的

### 待祥哥拍板（既存矛盾，本次未扩大改动）
- ⚠️ `client/dist/` 整个在 .gitignore 里，但 `index.html` / `logo.png` / `usdt_guide.jpg` 这 3 个文件是 **gitignore 生效前就被跟踪**的（gitignore 对已跟踪文件无效）→ 每次本地 build 后 `dist/index.html` 必脏（assets hash 引用变化）。本次按惯例提交了，但长期是噪音。两条路：① `git rm --cached` 这 3 个文件让 dist 完全脱离版本控制（源都在 `client/public/`，不丢东西）② 保持现状，每次 build 后跟着提交

### 三方同步状态
- 本地: 本次提交　GitHub: 本次推送　VPS: 无改动（纯本地清理，未触碰部署）