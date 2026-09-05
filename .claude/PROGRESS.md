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