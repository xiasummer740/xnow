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

### 清理时新发现（未处理）
- 🔴 **GSC 验证文件是 VPS 孤本** — `google9e165c63d6e32363.html` 本地磁盘没有、git 从未跟踪、历史提交里也没有，**只存在于 VPS 的 dist 目录**里（靠部署流程不用 `--delete` 才活到今天）。风险：VPS 重装 / 谁改用 `--delete` 全量部署 / dist 清空重建，**Google 所有权验证就失效**。建议从 VPS 抓回该文件放进 `client/public/`，随构建自动带上，不再依赖线上孤本
  > 已确认非本次清理误删：`git show --stat HEAD` 只动 4 个文件，未触碰它

### 三方同步状态
- 本地: 本次提交　GitHub: 本次推送　VPS: 无改动（纯本地清理，未触碰部署）

## [2026-09-11] 全站审计 + ISSUES.md 登记 + 第一批 5 项安全修复

祥哥指令：「全面分析这个网站项目，还有什么问题（**安全节点版块排除**）」→「登记 ISSUES.md 并修第一批」。

### 审计方式
4 路并行审计（后端安全 / 资金链路 / 前端 / 部署运维），**每条高危结论都由我逐行读代码复核**，不采信子代理结论。

### 审计中的三次自我纠错（记录以免重犯）
1. **子代理结论冲突 → 回代码裁决**：前端那路说「公告 `v-html` 的两条写路径都已净化」，后端那路指 `sites.js:103` 是第三条未净化路径。我读 `sites.js:103` 裁决：**后端那路对**，前端只查了 Config 公告的两条路径。教训：多路审计冲突时以代码为准，不以「多数」为准
2. **避免一次误报**：曾怀疑限流器挂载路径（`/api/login`）与路由定义（`/api/auth/login`）对不上=限流失效，grep 后确认 `router.post('/login')` 就挂在 `/api` 下 → 限流是真的，没报出去
3. **假设被证据推翻**：曾怀疑 `merge_now.js` 会把所有 `phone` 为 null 的用户合并到一起，读 `User.js` 发现 `phone` 是 `allowNull: false`，该路径不存在 → 删掉该推测

### 登记
新增根目录 `ISSUES.md`，**50 条**：🔴 致命 8 / 🟡 中危 25 / 🟢 低危 15 + 待拍板 2。状态列用 `待修/已修待验`，`xnow release` 门禁可正常识别（已实测 grep 匹配 50 行）。

⚠️ **`ISSUES.md` 已加入 `.gitignore`，不进公开仓库**：仓库是 PUBLIC（`gh repo view` 确认），文件内容精确到行号与复现路径，推上去等于给所有部署这个开源项目的人发攻击攻略。修复部署后再决定是否公开。

### 第一批修复（6 个文件，**均未部署**）
| 文件 | 改动 |
|------|------|
| `middleware/auth.js` | 每请求回查 `User`：查不到→401、`is_banned`→403、role 取库值（原本只验签不回查+滑动续签=权限撤销永久失效）；**DB 故障→503 而非 401**；顺带补 `phone`——审计日志一直读 `req.user.phone` 而 JWT 里从没这个字段，`admin_phone` 长期为空 |
| `middleware/site.js` | `x-forwarded-host` → `req.get('host')`（注意**不能用 `req.hostname`**，trust proxy 下它同样读 XFH） |
| `middleware/waf.js` | 客户端 IP 取 `req.ip`（trust proxy=1 → XFF 最右段 = nginx 追加的真实 IP） |
| `routes/auth.js` | `getRealIp` 同根因修复（注册/登录 IP 溯源） |
| `routes/sites.js` | 定价下限护栏 `multiplier × agent_discount ≥ 1.0`（PUT 按改后组合校验，防单字段绕过）；公告入库前过 `sanitizeAnnouncement` |
| `routes/admin.js` | dashboard 密钥回掩码（上游余额调用仍用真值）、用户列表排除 `password_hash`/`api_key`；`config/update` **跳过掩码值** |

**掩码方案的关键约束**：`Admin.vue:232` 把 dashboard 返回的每个 config key 灌进表单，`saveConfig` 又把**整个表单**提交回来。所以只加掩码不加「跳过掩码」会把所有密钥刷成 `********` —— 两者必须同时存在（已用测试反向验证：回传掩码时 `upserted` 里不含该 key，而真改了值的 `cryptomus_key` 正常写入）。

**副作用（已登记待拍板）**：管理员面板不再显示已存密钥明文，改密码得重新粘贴覆盖，**无法再把密钥抄走**。

### 验证（真启动，非「编译过」）
自建 harness：**真启动 Express + 真中间件 + 真 JWT**，只对数据层打桩（本机无 MySQL），33 项断言全绿。关键点：
- 封禁→403 且带原因 / 删号→401 / 乱码 Token→401 / **DB 故障→503（不是 401）** / Token 自称 admin 但库中 role=user→403 / 真管理员仍 200
- `Host: evil.com` 能命中分站（id=9）而 `X-Forwarded-Host: evil.com` 不再命中 → 修复有效且未误伤
- WAF：黑名单 198.51.100.7，请求头 `X-Forwarded-For: 9.9.9.9, 198.51.100.7`（模拟 nginx 拼接）→ 403，且 403 页面回显算出的 IP = `198.51.100.7`（**直接坐实 `req.ip` 取的是最右段**，非自填的 9.9.9.9）
- 定价护栏：0.5 / 0.0001 / `'abc'` 全拒；2.0 与「不传」正常；只改折扣 0.5(×2.0=1.0) 放行、0.4 拒绝
- 公告 `onerror`+`<script>` 被剥离、`<p>` 保留
- 上游余额调用仍收到真 key（掩码不破坏功能）

⚠️ **harness 自身踩的坑（值得记住）**：第一版用 `fetch` 发请求，**undici 把 `Host` 当禁用头静默丢弃** → 「伪造 Host」用例其实是假通过（`req.hostname` 恒为 `127.0.0.1:3999`）。改用 `node:http` 才能设 Host。另：WAF 黑名单有 30 秒缓存，测中途改环境变量不生效。验证脚本跑完已删（未入库）。

🔁 **自己改出的回归，自己抓回来（重要）**：第一版 `authenticate` 把所有异常都当「登录失效」返回 401。自审时发现 `client/src/main.ts:24-28` 收到 401 会**直接 `logout()` + `alert()` + 跳登录页** → 那么只要 MySQL 抖一下，**全体在线用户会被集体踢下线**。已改成：JWT 校验失败→401、DB 报错→503、续签失败只记日志不拦请求（顺带堵住「异步 handler 抛错在 Express 4 下无人 catch，请求会挂住」的坑）。教训：**给鉴权中间件加失败分支前，先看前端拿到该状态码会做什么**。

### 待祥哥拍板（记在 ISSUES.md 文末）
- **是否在 nginx 加 CF 真实 IP 还原**（🔴 首行修法，**建议优先**——它决定 WAF/限流/IP 溯源三样能不能用）：选项是①硬编码 CF 回源段 vs 定时拉取；②是否同时收紧源站 443 防火墙。**我没自行动 `install.sh`**，因为段列表配错会导致误封一片用户，属方向性决策
- 分站建站是否改**审核制** + 强制域名不与主站重叠（🔴 第 2 行「分站可注册主站域名劫持全站配置」**本次未修**，因为 `install.sh` 只把域名写进 nginx、从没进 `.env`，后端根本不知道「主站是谁」，需要先定策略）
- 后台密钥掩码的副作用是否接受（见上）
- 公告是否允许带图片（`sanitize.js` 的 `allowedAttributes` 宣称支持 `img` 但 `allowedTags` 不含它 → 主站分站公告图片都被静默删掉）
- 全局 `global_multiplier`/`agent_discount` 的成本护栏要不要补（**UI 拖一下滑杆就能触发亏损**，不只是接口）——这条我按"范围蔓延防守"登记未修，你点头我就顺手补

### 顺带发现（已补登记进 ISSUES.md）
写分站护栏时对照发现：全局侧是**同一个缺口**——`admin.js:58-61` 对 `global_multiplier`/`agent_discount` 只校验 `> 0` 不校验乘积。⚠️ **后来核对 UI 时把这条改重了**：我原先写"UI 滑杆限死 1-10 所以界面改不出来"，其实 `Admin.vue:604` 的**折扣滑杆 min=0.1** —— 倍率 1 × 折扣 0.1 在**界面上拖一下就是 0.1 倍成本价**。不是理论风险。已把登记改准（仍属范围外未修）。

### 独立复审结果（两路，2026-09-11）

跑了 `code-reviewer`（常规审查）和 `silent-failure-hunter`（静默失败视角），共 10 条，逐条核实后的处置：

| 复审意见 | 核实结果 | 处置 |
|---|---|---|
| 定价护栏可被「折扣 > 1」绕过 | ✅ **属实，真漏洞** | 已修 |
| 我改的护栏「校验一个值、保存另一个值」 | ✅ **属实，我引入的缺陷** | 已修 |
| 两个 401 分支零日志 | ✅ 属实 | 已修 |
| `xxui_api_key` 未掩码 | ✅ 属实（/vpn 板块外但同一处逻辑） | 已修（一行） |
| `authenticate` 把 DB 抖动变 401 | ⚠️ 属实但**读的是旧版** | 复审前我已自行修掉 |
| **生产走 CF → `req.ip` 是 CF 边缘 IP** | ✅ **属实，已实测坐实** | ⚠️ 提级 🔴 + 待拍板（见下） |
| 配置页假回执 / 两个配置项改不动 | ✅ 属实，范围外 | 登记，未修 |
| 封禁原因前端收不到 / 401 文案撒谎 | ✅ 属实，范围外（前端） | 登记，未修 |
| 公告净化静默删图 | ✅ 属实，范围外（含策略选择） | 登记，未修 |
| `site.js`/`waf.js` 静默 `catch` 空吞 | ✅ 属实，范围外 | 登记，未修 |

**① 定价护栏绕过（真漏洞）**：第一版只校验 `multiplier × agent_discount ≥ 1.0`，但 `orders.js:36-44` 里**只有 agent 才乘折扣** —— 普通/黄金用户成交价 = 倍率本身。于是站长设 `multiplier=0.05` + `agent_discount=100` → `0.05×100=5` 骗过乘积校验，普通用户仍按 0.05 成交，**平台每单倒贴 95%**；而 `sites.js:117` 只校验 `owner_id`，站长确实能自己改这两个字段。**修法：倍率下界必须独立拦（`m < 1` 直接拒），不能指望乘积**。教训：写"组合校验"时必须回到消费侧把**每一条分支**都列出来，只验一条分支的组合 = 漏。

**② 我引入的「校验一个值、保存另一个值」**：原写法 `isFinite(d) && d > 0 ? d : DEFAULT_AGENT_DISCOUNT` 把**非法值换成默认值去校验**，落库却仍是原始非法值 → 传 `agent_discount: ""` / `-1` / `"abc"` / `0` **全都校验通过并写入 NaN/-1**。后果不是报错而是**误导**：该分站此后所有代理下单被 `orders.js` 拒掉（"价格异常，请联系管理员"），站长却看到「更新成功」，根本关联不上。已改成"只有没传才回落默认值，传了就必须合法"。教训：**默认值只能用于"缺省"，绝不能用于"兜住非法输入"**。

**③ 生产走 Cloudflare（本轮最重的一条）**：复审实测 `Server: cloudflare` + `CF-RAY`，我独立复核确认（客户端全走同源 `/api/`，nginx 又是 `$proxy_add_x_forwarded_for` 追加 `$remote_addr`，而源站没配 `real_ip`）→ **`req.ip` 的最右段在生产 = CF 边缘 IP**。三个后果：WAF 黑名单永不命中（管理员拉黑一个攻击者完全无效，且无日志）、管理员照 CF IP 拉黑会**误封一整片用户**、`register_ip`/`last_login_ip`/`/geo/:ip` 全部记成 CF 机房地址；顺带 `authLimiter`（30 次/15 分）变成"整条 CF 边缘共享 30 次登录配额"。
**这条直接动摇了我第 1 批里 WAF/getRealIp 修复的生产有效性** —— 代码取"最右段"这个方向是对的，但生产的最右段现在是错的值。修法在 nginx 一层（`set_real_ip_from <CF 回源段>` + `real_ip_header CF-Connecting-IP`），配好后 `req.ip`/限流/审计 IP 同时全对，后端零改动。⚠️ **我没自行动 `install.sh`**：改错段列表的后果是 IP 判断出错→可能误封一片用户，且要配套决定"是否收紧源站防火墙"，属方向性决策 → 已写进 ISSUES 待拍板。

**④ `xxui_api_key`**：确认它同样存在 Config 表、dashboard 全表回传即明文吐出面板密钥。已加进 `SENSITIVE_CONFIG_KEYS`。加之前核实过三件事确保零副作用：`Admin.vue` 的表单不含该键（掩码不改任何界面）、`ALLOWED_KEYS` 也不含它（`config/update` 本就写不了它）、`/vpn` 面板走自己的 `vpn.js:477` 端点取密钥（不受影响）。⚠️ 它属 /vpn 板块，若你不想动，删掉 `SENSITIVE_CONFIG_KEYS` 里那一个元素即可回退。

**⑤ 两个 401 分支零日志**：已补 —— 非 `TokenExpiredError` 才 warn（正常过期不刷屏），"用户不存在"单独 warn。这样"全体用户突然被登出"时，运维能从日志区分「正常 7 天到期」和「JWT_SECRET 被改/连错库」。**⑥ DB 抖动 401**：复审指出得没错，但读的是我改之前的版本（它跑了 582 秒，我在这期间已自行修掉）。

### 验证证据（第三轮，41 项断言全绿）

两轮复审改完后重建 harness 重跑，**真启动 Express + 真中间件 + 真 JWT**，仅数据层打桩（无 MySQL）：
- **A 定价护栏 17 项**：`0.05+折扣100` 绕过式被拒 / 单独压倍率 / 0.999 / `2×0.4=0.8` 各被拒 / `2×0.8=1.6` 与 `1.0+折扣1.0` 放行 / `1.0 但折扣仍 0.8` 被拒 / **折扣传 `""`/`-1`/`"abc"`/`0` 四种非法值全部被拒，且断言落库值未被污染** / **遗留 `multiplier=0.5` 的分站只改公告不被误拦** / 建站同规则
- **F 鉴权 11 项**：401/403/已删除→401/DB抖动→503/200，外加 **F2b 伪造 token 有告警留痕、F3b 正常过期不刷屏、F5b 用户不存在有留痕**（验证日志"该记的记、不该刷的不刷"）
- B 公告净化、C Host 伪造、E 密钥掩码（含 `xxui_api_key`）各回归通过
- ⚠️ D（WAF）3 项只证明"取的是最右段"这个**语义**，**不等于生产正确** —— 生产的最右段是 CF 边缘 IP，必须等 nginx 那条修完才算数。这条我在 harness 输出里也打了警示，防止后人误读成"WAF 已验证"。

⚠️ 我自己也写错过一条断言：A6 原写「倍率 1.0 应放行」，实际被拒 —— 因为 site 9 的 `agent_discount=0.8` 仍在生效，代理按 `1×0.8` 成交照样倒贴，**拒绝才是对的**；是我的断言漏算了折扣。已改成断言拒绝并补 A6b（`1.0+折扣1.0`）验证真正的成本价放行。

### 三方同步状态
- 本地: 本次提交　GitHub: 本次推送（`ISSUES.md` 被 gitignore 不推送）　VPS: **无改动，修复未部署**

---

## [2026-09-19] 线上报障修复：401「连环弹窗」+ 多标签互清凭证

**缘起**：祥哥线上报障——「点左侧菜单一直弹 登录状态已失效，您已超过7天未活跃」，追加一句「不动也会一直弹」，再追问又给了关键一条「我刚登录过 / 重新登录后还弹」。**最后这句直接推翻了「就是 7 天到期」的初始假设**，是整轮排查的转折点。

### 根因（同一处代码，四种形态叠加）

`client/src/main.ts` 的全局 fetch 拦截器，对**任何** 401 一律 `logout() + alert() + router.push('/login')`：

1. **连环弹窗**：单页并发 3~5 个接口，凭证失效时它们同时拿到 401 → 逐个弹。线上实测并发 3 个：`/api/user/status`、`/api/user/notifications`、`/api/services`。且 `alert` 阻塞主线程，控制台时间戳 488ms→4804ms 证明被卡了约 4.3 秒。
2. **跳转会被打断**：`router.push` 是 SPA 导航，用户连点菜单产生的并发导航会让它**静默失败**，页面卡在原地；`Admin.vue` 的 10 秒轮询随后持续 401 → 就是「不动也会一直弹」。
3. **多标签互清凭证（最坑的一条）**：`localStorage` 是全浏览器共享的，Pinia store 却是**每个标签页一份内存副本**（`stores/user.ts:4` 只在初始化时读一次）。旧标签页的 401 调 `logout()`（`stores/user.ts:11` 清的就是共享 localStorage），会把另一个标签页刚登录的新凭证一并删掉 → 「重新登录后还弹」。
4. **文案撒谎**：任何 401 都报「超过 7 天未活跃」，而 401 有三种成因（正常过期 / 用户不存在 / JWT_SECRET 被改），后两种这么说都是假的。

### 修复内容（只动 `client/src/main.ts` 一个文件）

- `logout()` 前先比对 `localStorage` 与 store 的凭证：**不一致 = 别的标签页有更新的凭证 → 跟随它，绝不登出**
- 进拦截器时先记下本次请求实际携带的凭证 `tokenAtRequest`，只有「当前凭证 === 发起时凭证」才判定为真失效 —— 挡掉并发中旧凭证的迟到 401，也挡掉滑动续签后才到达的旧 401
- `authExpiredHandled` 模块级去重，兜住登出/跳转完成前新发出的请求
- `router.push('/login')` → `window.location.replace('/login')`：整页跳转不会被并发导航打断
- 文案去掉「超过 7 天未活跃」

### 踩到的坑（这条最值得记）

**第一版修复是错的，而且我差点把它当成功交了。** 第一版只加了「去重」+「多标签比对」，用**单次打桩 401** 测出「弹窗 0 次」就以为过了。换到**并发 3 个 401** 才暴露：第 1 个把 store 同步成新凭证之后，第 2、3 个到达时 `sharedToken === store.token` 已成立 → 照样落进「真过期」分支，照样弹、照样把新凭证清掉。

**教训 → 拿单个请求去验证一个「并发」缺陷 = 没验证。** 缺陷的成因是并发，就必须用并发去测。另外第一版对照拿的是「线上包 vs 本地 dev」，**环境不同、变量不止一个，结论其实立不住**；重做成「同一 dev server 只切 `main.ts` 一个变量」才作数。

### 验证证据（同环境 A/B）

同一 dev server，只切换 `main.ts` 一个变量；仪表统一为「把 `alert` 换成计数器并落 `sessionStorage`」（只替换弹窗实现，不碰被测逻辑）：

| 场景 | 弹窗 | 最终 URL | localStorage 凭证 |
|---|---|---|---|
| 多标签（本页持旧凭证收到 401）· **修复前** | 1 | `/login` | **null —— 新凭证被清掉** |
| 多标签（同上）· **修复后** | **0** | **`/order`** | **完整保留** |
| 真过期（无可跟随的新凭证）· 修复后 | **1** | `/login` | 清空（符合预期） |

第三行是**反向断言**：证明修复没有把真过期的弹窗一起吞掉 —— 祥哥的要求是「真过期可以弹一次，输入之后不要再弹」。

构建：`npx vite build` ✓ built in 5.60s。

⚠️ 本机无后端（`/api` 代理到 127.0.0.1:3000 全部 ECONNREFUSED），故 A/B 用 Playwright 打桩 `/api/**` 做受控实验，另配合线上真机复现观察真实并发数，两者结合。

### 部署（2026-09-19，祥哥说「部署到 VPS」后执行）

⚠️ **差点踩的坑**：正式构建脚本是 `vite build && node scripts/prerender.mjs`，我第一次只跑了 `npx vite build` 就准备上传 —— 那份产物**缺 `en.html` / `vpn.html` 两个预渲染页**，覆盖上去等于把 SEO 三期的静态化打回原形。是上传前比对线上/本地目录清单才发现的。
**教训：上传前先比对两端文件清单，别信「构建成功」四个字。**

部署方式沿用本项目既有做法（**本地构建 → 上传 dist**，不是服务器上 `git pull`）：

1. `npm run build`（含预渲染，输出「3 个路由已静态化」）
2. 线上先 `cp -a dist dist.bak-20260919-134423` 备份（85 个文件）
3. `tar czf - -C dist . | ssh xnow-vps 'tar xzf - -C /var/www/xnow/client/dist'`
4. 线上核对：GSC 孤本 `google9e165c63d6e32363.html` 仍在、`index.html` 已指向新 bundle、新文案在、旧误导文案已消失
5. **线上真机实测**（Playwright 打真站点；`/api` 拦截只在本地浏览器生效，不碰服务器）：加载 bundle=`index-CQNmdSEQ.js`、**弹窗 0 次**、停留 `/order`、共享凭证保留 ✅

### 第二轮补丁（⑤ `tokenAtRequest` + ⑥ 空凭证不判失效）与复部署

第一轮上传后，又把两处漏掉的形态补上并**重新构建、重新部署**（备份 `dist.bak2-20260919-135150`），线上 bundle 更新为 `index-CGH9YTTQ.js`：

- **⑤ 编码期发现**：并发 401 里第 1 个同步了 store 之后，第 2、3 个（带旧凭证飞出去的）到达时会被误判成「当前失效」→ 记 `tokenAtRequest` 挡掉（详见「踩到的坑」）。
- **⑥ 复核退出路径时发现**：`DashboardLayout.vue:191,206` 的退出用 `setTimeout(…, 1500/1000)` 延迟跳转，而 `Admin.vue:528` 的 10 秒轮询**不判 token** —— 这 1~1.5 秒窗口里后台请求带**空凭证**打接口，收到 401 后被旧逻辑判成「登录失效」再弹一次。加 `tokenAtRequest &&` 后，无凭证的 401 只说明该接口要登录，不弹。

**线上 A/B 复测**（`https://xnow.taikon.top`，同一打桩仪表，与本地同环境结果逐项一致）：

| 场景 | 弹窗 | 最终 URL | 凭证 | 401 数 |
|---|---|---|---|---|
| S1 多标签（本页旧凭证收 401） | **0** | `/order` | `FRESH_TOK` 保留 | 4 |
| S2 真过期（无可跟随凭证） | **1** | `/login` | 清空 | 6 |
| S3 空凭证 401（注销窗口） | **0** | `/` | null | 4 |

S2 是**反向断言**，证明①⑤⑥ 没把「真过期要弹一次」一起吞掉。

**真实链路探针**（不打桩，走真后端）：干净访客访问 `/`、`/en`、`/vpn`、`/login`、`/order` 五页 —— **0 弹窗、0 个 401**，`/order` 未登录正确跳 `/login` ✅

⚠️ **我特意没做的事**：VPS 的 git 落后 `origin/main` **6 个提交**，其中 `8a39af62 第一批安全修复` 是**服务端**改动（还牵着一个没拍板的前置决策：Cloudflare 真实 IP 还原）。`git pull` 会把它们一并带上并需要重启 pm2 —— **这超出「部署这次 401 修复」的授权范围，我没做，留给祥哥单独拍板。**

### 未做

- **403 分支仍未处理**（同一处代码）：封禁用户拿的是 403，而前端全仓没有 403 处理 → 精心拼的 `账号已被封禁：原因` 永远送不到用户眼前，用户只感觉「站点忽然处处不响应」。属范围外，仍登记在 ISSUES.md 第 28 行。
- **VPS 的 git 仍落后 6 个提交**，第一批服务端安全修复仍未上线（原因见上）。
- **独立复审没做成**：按规矩 auth 类改动要过对抗性复审，`adversarial-reviewer` 子代理连试 2 次都返回 `API Error: 400 Content Exists Risk`、零输出，按 3 次止损线停手 —— **本轮结论全部来自我自己的实测，没有第二双眼睛**，可信度以实测证据为准，别当「已复审」用。

### 三方同步状态
- 本地: 本次提交　GitHub: 本次推送（`ISSUES.md` 被 gitignore 不推送）　VPS: **前端产物已部署（含第二轮补丁，bundle=`index-CGH9YTTQ.js`）+ 线上 A/B 复测与真实链路探针全过**；服务端 0 改动、git 未 pull
---

## [2026-09-19 续] 401 修复**没生效**的真正原因：旧标签页会删掉新令牌

祥哥反馈「重新登录后还弹、不动也一直弹」。第二轮补丁部署后仍未解决 → **说明根因没找对，继续查**。

### 根因（放大器）：`logout()` 会删掉别的标签页刚写入的新令牌

`client/src/stores/user.ts` 的 `logout()` 执行 `localStorage.removeItem('xnow_token')`，
而 **localStorage 是全浏览器所有标签页共享的**，Pinia store 却是每个标签页各自的内存副本。

死循环链条：
1. 旧标签页内存里是**已过期令牌**（开了一周没刷新，store 只在页面加载时读一次 localStorage，之后永不重读）
2. 祥哥在另一个标签页**重新登录成功** → 新令牌写入 localStorage
3. 旧标签页下一次轮询（`Admin.vue:528` 每 10 秒 / `DashboardLayout.vue:273` 每 30 秒）带着**它内存里的过期令牌**打接口 → 401
4. 旧包（祥哥浏览器实际在跑的）收到 401 → `logout()` → **把 localStorage 里祥哥刚写的新令牌 `removeItem` 删掉**
5. ⇒ 祥哥等于刚登录就被踢；他再登录 → 再被删 → **无限循环 + 每轮一个弹窗**

**这解释了「重新登录后还弹」的字面意思**——不是弹窗没修好，是登录本身被旧标签页持续摧毁。
也解释了 nginx 日志里同一 4 秒窗口内 `/order` 用新令牌 200、`/admin` 用过期令牌 401 的现象（两个标签页两把令牌）。

### 修复（`client/src/main.ts`，共 2 处）

**① 登出时只清「与本次失败相同」的那把令牌** —— `logout()` 换成守卫式删除：
```ts
if (localStorage.getItem('xnow_token') === userStore.token) {
  localStorage.removeItem('xnow_token');
  localStorage.removeItem('xnow_user');
}
```
令牌不一样 = 别的标签页刚写的，绝不能碰。

**② 补上跨标签页同步：`storage` 事件** —— 浏览器原生广播，任一标签页写 localStorage，其余标签页立刻收到：
```ts
window.addEventListener('storage', (e) => {
  if (e.key === 'xnow_token' && e.newValue && e.newValue !== useUserStore(pinia).token) {
    authExpiredHandled = false;          // 新凭证到手，重置「已处理」标志
    useUserStore(pinia).setToken(e.newValue);
  }
});
```
**这是从源头消除过期标签页**：不必等它先撞一次 401，另一页一登录它就跟上。
`authExpiredHandled = false` 是必需的——否则一次误判后该标签页永远静默，真过期也不提示。

### 验证：多标签页时序 A/B（线上真站点 + 真后端）

**测试设计（关键）**：用同一个浏览器上下文开两个标签页（共享 localStorage、真实 `storage` 事件）。
用 `page.route` 把标签页1 的 API 响应**卡住 3 秒**，让「标签页2 登录成功」发生在「标签页1 收到 401」**之前** —— 这正是祥哥的处境。
唯一变量 = HTML 里引用的 bundle 名。计数写 `sessionStorage`（新包会整页跳转，只存 window 变量会被洗掉 → 假绿）。

| 指标 | 修复前（旧包 DQ45yU1y） | 修复后（新包 DMI9f2Xw） |
|---|---|---|
| 过期标签页弹窗次数 | 1 | **0** |
| 过期标签页最终位置 | 被踢到 `/login` | **留在 `/admin`** |
| 祥哥新登录的令牌 | **✗ 被删光** | **✅ 完好幸存** |
| 鉴权请求 | 200 = 0，401 = 6 | **200 = 6**，401 = 6 |

**可视化复跑**（`headless:false`，真实窗口 + 弹窗停 2.5 秒 + 页面大字结论板）：逐项与无头一致。

**冒烟**：8 个侧边栏页面（`/order /admin /profile /wallet /recharge /vpn /services /dashboard`）带真实 7 天令牌访问 —— **0 弹窗、0 个 401、令牌完好**；撤回服务端诊断后 API 直连复测 200。

### 部署与清理
- 前端：`client/dist` → VPS `/var/www/xnow/client/dist`，bundle = **`index-DMI9f2Xw.js`**（旧包文件保留在服务器上供 A/B 对照，**未删**——祥哥开着的标签页还在按哈希名加载旧 chunk，删了会白屏）
- 服务端：临时 401 诊断**已撤回**（`auth.js.bak-diag` 恢复后删除该备份，`grep -c 401诊断` = 0），pm2 `xnow-backend` 已重启
- 临时令牌文件（`G:/Temp/xnow-tok-*.txt`）+ 服务端 `/tmp/tk_*` 副本**已全部删除**

### 遗留（仍待办）
- ⚠️ **祥哥已经开着的那些旧标签页，必须各自整页刷新一次才能拿到新代码。** 这是浏览器机制：已经跑在标签页里的 JS，服务端改什么都换不掉它。新包自带自愈（首个 401 整页跳转 `location.replace`），所以**任何一页刷新过之后就不会再复发**。
- **403 分支仍未处理**：封禁用户的 `账号已被封禁：原因` 送不到前端（ISSUES.md 第 28 行）。
- **VPS git 仍落后 `origin/main` 6 个提交**，第一批服务端安全修复未上线（未授权，等祥哥拍板）。
- **独立复审仍未做成**（`adversarial-reviewer` 两次 `API Error: 400 Content Exists Risk`）；本轮结论全部来自实测。

---

## [2026-09-19 续二] 401 根因**复现成功** + 修复上线（令牌只升不降）

### 祥哥的报障原话
> 「关掉后重开还是弹」

这句推翻了我上一轮「刷新一下就好」的交付说法，只能推倒从头再查。

### 第一步：先搞清楚他到底在跑哪个包

从 VPS nginx 日志按 UA 捞（`Chrome/153` = 祥哥浏览器；`HeadlessChrome` = 我的探针）：

| 时间（服务器时区） | 他加载的入口包 |
|---|---|
| 13:13:27 ~ 13:14:22 | `index-DQ45yU1y.js` |
| 13:44:54、13:45:50 | `index-CQNmdSEQ.js` |
| **13:45 之后至今** | **无** |

我的两个修复包落盘时间：`index-DMI9f2Xw.js` 14:32、`index-tUWPgOd3.js` 15:30 —— **全在他最后一次加载之后**。
他 15:20:39 还有一次 `/api/track/visit`，但那是 SPA 内部跳转（`router.afterEach` 埋点），**不触发页面重载**。

⇒ **祥哥一次都没跑到过修复版。** 他 13:44「关掉重开」时拿到的 `CQNmdSEQ` 是**当时最新的包**，那个包里还没有修复。
所以「重开也弹」和「修复没生效」是两件事，前者**不构成对后者的否证**。

### 第二步：根因（这次真复现了）

**机制**：接口响应会被浏览器缓存，缓存里的响应头会连带**数天前签发的那把 `x-new-token`** 一起被交回页面。
旧代码对续签令牌是**无条件** `setToken()`：

```ts
const newToken = response.headers.get('x-new-token');
if (newToken) userStore.setToken(newToken);   // ← 旧包：不做任何检查
```

于是刚登录的新令牌当场被这把旧令牌覆盖 → 下一个接口 401 → 又弹一次。
表现就是「登录了还是弹、**关掉重开还是弹**」。

**修复**：采纳任何令牌之前先比 `exp`，只接受「过期时间更晚」的那把。

```ts
const adoptToken = (t: string | null): boolean => {
  if (!t) return false
  const userStore = useUserStore(pinia)
  if (tokenExp(t) <= tokenExp(userStore.token)) return false   // ← 只升不降
  userStore.setToken(t)
  return true
}
```

**为什么按 exp 比、而不是去堵某一条路径**：旧令牌具体从哪进来（浏览器缓存重放 / 304 响应头合并 / 别的标签页广播）不好穷举，
但「服务端签发的令牌 exp 一定随时间递增」是恒定的 —— 拿这条不变量做闸门，不需要知道它从哪来。

三个采纳点全部换用 `adoptToken`：① 401 分支读 `localStorage` ② 续签响应头 ③ `storage` 跨标签页事件。

### 第三步：A/B 对照（唯一变量 = bundle 名，其余全同）

**测试方法**（`G:/Temp/xnow-fix-proof.cjs`）：向**每一个** `/api` 响应注入一把**已过期 2 小时**的 `x-new-token`，
冒充「缓存里翻出来的旧响应头」。

前两版测试都栽在时序上，这里踩了两个坑，记下来：
- **坑1**：注入必须等页面用新令牌**正常跑起来之后**再开。第一次没等，`/login` 页当场被毒 → 两个包都被污染 → 假绿。
- **坑2**：开了注入还必须让页面**真的发一次接口请求**，否则注入根本没被碰到，两个包都"干净" → 又是假绿。

| 指标 | 旧包 `DQ45yU1y`（祥哥在跑的） | 新包 `tUWPgOd3`（本次修复） |
|---|---|---|
| 注入后令牌 | **★ 被过期令牌覆盖** | 守住了 ✅ |
| 新登录令牌是否幸存 | **✗ 丢了** | ✅ 幸存 |
| 最终位置 | **`/login`（被踢出）** | `/order` |
| 弹窗次数 | **1** | **0** |
| 弹窗文案 | **「登录状态已失效，您已超过 7 天未活跃，请重新登录！」** | —— |

**旧包那句弹窗文案，和祥哥报的一字不差。** 这是整条因果链第一次闭合。

服务端 401 探针同步留痕（`/tmp/xnow-401.log`），8 条全部来自本次实验：
```
{"sha":"15b4c61d","err":"TokenExpiredError: jwt expired","left":-7979,"path":"/api/user/status","ua":"其他"}
```
`ua:"其他"` = **祥哥本人一条都没有**。

### 部署
- 本地构建 → `client/dist`，入口包 = **`index-tUWPgOd3.js`**，已同步到 VPS `/var/www/xnow/client/dist`
- 线上 HTML 已确认指向新包：`curl -s https://xnow.taikon.top/login | grep -o 'index-[A-Za-z0-9_-]*\.js'` → `index-tUWPgOd3.js`
- **VPS 孤本文件 `google9e165c63d6e32363.html`（GSC 验证）部署前后 md5 均为 `abb21a02`，未动**
- 旧包文件**保留在服务器上未删**——祥哥开着的标签页还在按哈希名加载它们，删了会白屏
- 提交推送：`d249f65b`

### ⚠️ 遗留（必须处理）
- **生产 `auth.js` 里还留着我加的临时 401 诊断**（备份 `auth.js.bak-1789828066`）。
  留着是为了抓祥哥的**下一次** 401 做最终确认；**确认后必须立刻还原备份并重启 pm2**。
  这是未提交的生产漂移，别忘。
- **祥哥仍必须整页刷新一次**（或关掉重开）才能拿到新包——13:45 之后他没重载过。
- **403 分支仍未处理**：封禁用户的 `账号已被封禁：原因` 送不到前端（ISSUES.md 第 28 行）。
- **VPS git 仍落后 `origin/main`**（含第一批服务端安全修复 `8a39af62`，未授权，等祥哥拍板）。
- **独立复审仍未做成**（`adversarial-reviewer` 两次 `API Error: 400 Content Exists Risk`）。
- 服务器上 6 个远古入口包（`9NJ2g4Nx`/`BOzrcmmC`/`BqS-zoTp`/`BtjeExlk`/`DQ45yU1y`/`wbFE5h_x`）
  仍被 Cloudflare 以 `immutable, max-age=31536000` 缓存着 200 返回，**服务器上没有 CF API 凭证，无法清边缘缓存**。

### 结局：祥哥真机上确认生效（09-20 01:51）

他按提示**关掉全部标签页重开**后，nginx 日志：

| 时间（BST） | 事件 |
|---|---|
| 01:51:11 | `GET /login` 200 → **加载 `index-tUWPgOd3.js`（他第一次真正拿到修复版）** |
| 01:51:31 | 5 个 401 —— **预期内的那一次**（他存的令牌确实过期 2.4 天） |
| 01:51:33 | 自动整页跳 `/login`（新代码行为） |
| 01:51:36 后 | 他重新登录 |
| **01:51:31 至今** | **零 401** |

**判据**：`/api/admin/dashboard` 从「之前每轮日志必 401」变成 **200**。这个接口一直是钉子户。

顺带查穿了「为什么关掉重开也没用」的最后一环：

- 他那个标签页跑的是 **`index-DQ45yU1y.js`（9月10日）** —— 按弹窗文案逐个包比对，**旧文案「您已超过 7 天未活跃」只存在于 6 个老包里**，他截图里弹的正是旧文案
- 那个 9 天前的版本**没有跨标签页同步**：内存里的过期令牌不会因为他处登录而更新 → 一直 401 → 一直弹
- 浏览器「关掉重开」会把标签页**恢复**回来，恢复的就是那个旧页面；日志证实他 13:45 之后**再没有过一次页面加载请求**

### 收尾（已完成，别再翻旧账）

- ✅ 生产 `auth.js` 临时诊断**已还原**（`diff` 与备份 `auth.js.bak-1789828066` 无差异、`grep -c "DIAG|sha8"` = 0），pm2 已重启
- ✅ 还原后冒烟：三个鉴权接口全 200、`/login` 200
- ✅ **续签滑动窗口未受影响**：剩 5 天令牌 → 返回 `x-new-token`；剩 7 天 → 不返回（符合设计）
- ✅ 祥哥在 `/tmp/xnow-401.log` 的 5 条记录全部早于修复生效

### 由此沉淀的规则（✅ 已落盘 —— 09-20 归位）

> 原计划写进 `xiangge-env/CLAUDE.md` 的全局反借口清单；**09-20 祥哥定调：只在本项目内解决 XNOW 的问题**，故落到项目自己的活页
> **`.claude/project-checks.md`**（该文件此前是没填过的脚手架，占位符还留着，这次一并填实），并由 `merged-checks.md` 镜像。
> 项目 CLAUDE.md 的定位是「只含项目特有信息」，这些恰恰都是 XNOW 特有（SPA+CF+无 migration+强制跟踪的 dist），归位正确。

落进去的条目（每条都是真栽过的坑）：

- **判断「修复有没有生效」前，先用 nginx 日志证明对方跑的是哪个包，别猜** —— 他 13:44 重开拿到的 `CQNmdSEQ` 是**当时最新的包**，只是那个包还不含修复
- 注意 SPA 的 `/api/track/visit` 是 `router.afterEach` 埋点，**不触发页面重载**，不能当成"他刚访问过"的证据
- 动 VPS 前先比对 `client/dist/index.html` 的 md5（dist 被 gitignore 但 3 个文件强制跟踪，pull 会把线上前端打回旧包）
- `git checkout --` 恢复的是 HEAD 不是远端分支
- 改模型字段前先查线上库真有那列（本项目无 migration）
- CF 后面的 IP 逻辑依赖 nginx real_ip 段；后端只认 `req.ip`，绝不取 XFF 第一段

---

## [2026-09-20] 选项 A 两半都完成：Cloudflare 真实 IP 还原 + 后端同步上线

祥哥拍板「A」＝先做真实 IP 还原，再做后端同步。两半都已上线并验证。

### 第一半：Cloudflare 真实 IP 还原（生产 + 模板）

**生产** `/etc/nginx/sites-enabled/xnow-spa-https`：插入 22 条 `set_real_ip_from`（15 个 v4 + 7 个 v6）
+ `real_ip_header CF-Connecting-IP;` + `real_ip_recursive on;`。备份 `/root/nginx-backup-20260920-021106`。

**模板** `install.sh` 同步补上同一段（提交 `353315bd`）——否则以后重装又退回旧样。
模板用真实 nginx 生成校验过：`syntax is ok / test is successful`。

| 判据 | 改动前 | 改动后 |
|---|---|---|
| 我请求被记录成 | `104.22.20.253` / `104.22.17.48`（CF 边缘） | **`64.186.242.99`（我的真实公网 IP）** |
| 从 VPS 伪造 `CF-Connecting-IP: 1.2.3.4` | —— | 记录成 `192.129.210.52`（**对端真址，伪造无效**） |

`set_real_ip_from` 是白名单：只有从 CF 机房来的连接才采信它给的头。**这条已被实测证实**，不是照抄文档。

### 第二半：后端同步（bd7af37d → 353315bd，16 个 commit）

实质只有 `8a39af62` 那 6 个后端文件；其余是文档/前端源码（前端产物早已在线上）。

**上线前 6 项预检**（都不是走过场，每项都可能造成事故）：

| 检查 | 结果 | 不查会怎样 |
|---|---|---|
| `users` 表真有 `is_banned`/`ban_reason` 列吗 | ✅ 有 | 缺列 → `findByPk` 抛错 → **503 全站瘫痪** |
| `role` 取值是否合法 | ✅ user×3 / admin×1 | 非法值 → 权限判断错乱 |
| 有没有已封禁账号 | ✅ 0 个 | 有 → 上线瞬间变 403 踢人 |
| `sanitize.js` 在旧版里存在吗 | ✅ 已有（b895f651 引入） | 不存在 → **启动即崩，全站 502** |
| 现有分站定价会被新护栏卡吗 | ✅ 分站表为空 | 有低价站 → 编辑即被拒 |
| 依赖清单有变吗 | ✅ 无 | 有 → 不 `npm install` 就崩 |

**上线前发现并避开的一个坑**：VPS 的 git 里那份 `client/dist/index.html` 指向 **`index-BtjeExlk.js`（含 401 bug 的旧包之一）**，而磁盘上在跑的是修复版 `tUWPgOd3`。**盲目 pull 会把线上打回旧包、弹窗复发。**
先比对确认 `origin/main` 那份与磁盘**字节相同**（md5 `6da73c1a`）才动手。

> ⚠️ **我在这里判断错了一次，记下来**：我原以为 `git checkout -- <file>` 恢复的是 `origin/main` 的版本，写完「md5 应该不变，变了就立刻停」。
> 实际它恢复的是 **HEAD**（当时还是 `bd7af37d`），md5 当场变了（→ `b0bffa31`）。按承诺停下查清：checkout→pull 之间有个几百毫秒窗口磁盘指向旧包；
> 查 nginx 日志确认**该时刻无任何访问**（最后一条真人请求 01:51:38，最后一条 curl 01:53:13），无人受影响。pull 后三份 md5 全同，终点正确。
> **教训：`git checkout --` 的来源是索引/HEAD，不是远端分支。要恢复远端版本得 `git checkout origin/main -- <file>`。**

### 验证证据（全绿）

| 项 | 结果 |
|---|---|
| pm2 重启后 | `online`，`🚀 XNOW API Server running on port 3000` |
| 公开接口 | `/api/services/public` 200 |
| 无令牌 | 401（`未授权的访问`）—— 正确 |
| **带令牌（走新增的「回查数据库」路径）** | `/api/user/status` 200、`/api/user/notifications` 200 |
| **后台 dashboard（曾经的钉子户）** | **200** |
| 6 个密钥回传 | **全部 `********` 掩码** |
| 用户列表 | 已剔除 `password_hash` / `api_key` |
| 上游余额 | `96.1143525` 仍能读到（证明掩码只影响回传，不影响内部取值） |
| 真实 IP 落库 | 我打埋点 → 记录 `64.186.242.99` = 我的真实 IP ✅ |

**掩码往返测试**（这是最不可逆的风险：判断错一次，祥哥点保存就把真密钥写成星号）：

1. 先备份配置表 → `/root/config-backup-1789867126.tsv`
2. 记录 6 个密钥的 **md5 指纹**（全程不打印明文）
3. 模拟前端「整表单原样提交」：6 个密钥发 `********` + `site_name: XNOW`
4. 复查指纹 → **6 项逐一相同**；库里 `value='********'` 的记录数 = **0**；`site_name` 正常写入（证明不是整条被跳过）

**浏览器实测**（真启动跑主流程）：带令牌进 `/admin`，点「配置」标签 → **4 个密码框全部显示 `********`、0 个明文**；后台 8 个接口全 200、无 4xx/5xx。

> 排查中的一个插曲：顶栏一度显示「未登录 / UID: --」，我没放过。查穿了是**我测试方法的假象**——`updateUserInfo` 的实现是 `if (this.userInfo) {...}`，
> 而 `userInfo` 初值取自 `localStorage.xnow_user`；我探针只塞了 `xnow_token` 没塞 `xnow_user`，所以它是空操作。补上后顶栏立刻正常（余额 96.1143525、手机号、角色徽章齐全）。**祥哥走真实登录流程不会碰到。**

### 本次没做 / 仍欠着

- **AutoSync 上游抓取超时**（`❌ [AutoSync] 致命错误: timeout of 30000ms exceeded`）—— 预存问题，与本次改动无关，未处理
- **`admin` 角色徽章显示成「至尊管理员」** —— DB 里是 `admin`，疑似 i18n 文案映射错，本次范围外
- **403 分支**：封禁提示送不到前端（ISSUES.md 第 28 行）
- **sites-enabled 里的 `xnow-spa-https.bak-cache` 杂散副本**（`conflicting server name` 警告，当前无害但是地雷）
- **远古 6 个旧 bundle 仍被 CF 缓存着 200 供着**，无 CF API 凭证清不掉
