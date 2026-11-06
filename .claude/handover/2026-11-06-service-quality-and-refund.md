# 2026-11-06 取消归因 / 服务描述同步修复 / 退款原因 / 下单拦截

> 用户侧反馈驱动的四件事，全部已上线并实测。
> 关键词：上游改版导致描述全空、客户选错服务被退款、下单零校验。

---

## 1. 取消通知要说清楚「谁取消的」

**用户原话**：「这是用户自己取消的，还是谁取消的要说清楚呀，不然我不知道情况」

### 先说结论（这条以后不用再查）

**服务订单变成「已取消」，只可能来自上游。** 依据（都实地 grep 过）：

| 排查点 | 结果 |
|---|---|
| 客户端有没有取消按钮 | `client/src/**/*.vue` 里带 `@click` 的「取消」只有站点编辑/优惠券弹窗，**没有任何订单取消入口** |
| 服务端有没有取消接口 | `server/src/routes/` 下**没有** `.../cancel` 之类的路由 |
| 管理密室能不能取消 | `admin.js` 只有 `GET /orders/:id/check-status`（查上游状态），**没有改状态/取消的接口** |

也就是说，客户和祥哥**都无法手动取消服务订单**。会走到「已取消」的路径只有：
`utils/orderSync.js` 从上游拉到 `Canceled/Cancelled` → 走退款。

### 原来的播报为什么不合格

只写了一句「（上游同步）」，等于没说。财务对账时也看不出是谁的动作。

### 现在的播报

`server/src/utils/orderSync.js`（退款事务 commit 之后）新增：

```
🚫 订单被上游取消
单号：XN...
商品：...
数量：300　进度：已做 0 / 剩 300
原扣费：￥x
退款：￥x → 客户余额 ￥y
上游结算：￥0.00（上游未收费，这单我们没实际损失）
客户：159****
━━━━━━━━━━━━━━
⏱ 下单 11-06 00:27 → 取消 11-06 01:50，历时 1 小时 23 分
🔍 取消方：上游系统
　 本站没有「取消订单」入口 —— 客户点不了，管理密室也没有这个功能，
　 所以不可能是客户自己取消的，只可能是上游侧动作。
❗ 上游只回了 status=Canceled，没给取消原因，
　 要知道为什么得去上游后台看，或者直接问上游。
```

四个新增信息各自解决一个盲区：

| 新增 | 解决什么 |
|---|---|
| 「取消方：上游系统」+ 为什么排除客户 | 不用每次人工回忆 |
| 「已做 X / 剩 Y」 | 一眼看出有没有开工（原来只写"剩余"，看不出做过多少） |
| 「上游结算：￥0.00」 | 上游收没收费是两件完全不同的事：**收 0 = 没有实际损失**；收了钱说明我们白亏成本 |
| 「下单 → 取消 + 历时」 | 判断是刚接单就退，还是跑了一半才退 |

### 关键 API 事实

上游 status 接口对取消单只返回：

```json
{"5820505": {"charge":"0.00","start_count":"0","status":"Canceled","remains":"300","currency":"CNY"}}
```

**没有 reason 字段**。所以「为什么取消」永远查不到，只能给自查指引，不能编原因。

---

## 2. 服务描述同步彻底失效（本次最大的坑）

### 症状

客户下单页的「服务描述与下单规范」区块，全站 **2803 个服务的 description 全是空的**，只显示前端硬编码的兜底文案。客户照着兜底文案填链接 → 填错 → 上游退单。

### 根因

`utils/sync.js` 原本靠**下载上游 `/services` 整页 HTML（5.3 MB）+ 正则**抠描述：

```js
const regex = /id="service-description-id-\d+-(\d+)"[^>]*>([\s\S]*?)<\/div>/g;
```

实测抓上游页面：**`service-description-id` 出现 0 次**。上游把描述改成了 AJAX 按钮：

```html
<button class="btn btn-actions" data-description-id="30094">查看</button>
```

正则一条都匹配不到 → `descMap` 永远为空 → 每个同步周期把整库描述写成空白。

### 找到的正确接口

翻上游前端 JS（`storage.perfectcdn.com/global/uoha2qfu2jb1161f.js`，98 万字符）里的
`showServiceDescriptionModal`，拿到真实端点：

```
GET {origin}/services/get-service-description/{serviceId}
→ {"description": "示例链接 : https://www.tiktok.com/@username\n示例链接 : username\n\n注意…", "create_order": true}
```

**不需要 API key**，返回纯 JSON。

### 改法：不在同步里全量抓

上游这个端点**单次 5–6 秒**（实测）。2803 个 × 5.6s / 8 并发 ≈ **33 分钟**，同步周期（10 分钟）根本装不下。第一次按全量抓改完，跑了 10 分钟没跑完，SSH 还断了，库里依旧全空。

最终改成**按需补抓 + 入库缓存**（`server/src/routes/services.js` 的 `GET /detail/:serviceId`）：

```
客户点开某条服务
  → 库里没描述？实时向上游抓（6 秒超时）
  → 抓到写回 services.description
  → 下次所有人直接读库
```

实测：

| 请求 | 耗时 |
|---|---|
| 第一次（实时抓上游） | 3.38 s |
| 第二次（读库） | 0.054 s |

`sync.js` 里同时保留一个**慢速补抓**：每轮只补「库里还没有描述」的前 200 个，闲时把冷门服务补齐，不挤占同步主流程。

### 两个必须记住的护栏

1. **抓失败不能把库里已有描述清空**。`bulkCreate` 的 `updateOnDuplicate` 会整列覆盖，一次上游抖动就能把 2803 条说明洗白。现在先读出现有 `description` 当兜底，三级降级：`新抓到的 > 上游 API 字段 > 库里原值 > 空`。
2. **同步条数骤降护栏仍然有效**（`< existing.length * 0.5` 整轮跳过）。这次同步后服务从 2809 → 2803，是上游真下架了 6 个，正常。

### 前端配套改动

- **有真实描述时不再显示硬编码的「示例链接」那一行**。上游描述里自带「示例链接 : … / 示例链接 : username」，两行叠着显示重复，而且硬编码那行只给一种格式 —— 正是客户照着填错的原因之一。订阅类（`needsUsername`）例外保留。
- **兜底文案 `guide_2` 是错的**：原来是「⚠️ 2. 确保账号为公开状态。」—— **上游从来没说过这句**，是我们自己编的。已按上游原文改成「⚠️ 2. 请使用正确的链接格式。」（中英文都改）。

---

## 3. 退款原因 + 下单拦截（客户选错服务的正解）

### 病根：下单时零校验

原代码里 `link` 填什么都能提交，等上游退回来才知道错。实测对比（祥哥截图里的真实订单）：

| 链接 | 结果 |
|---|---|
| `tiktok.com/t/ZTPerg7xN/` | **被退**（视频短链接，涨粉要的是主页） |
| `tiktok.com/@badger_es_lily` | 成功（主页链接） |

而且有客户用**同一个链接连开两单**（XN179385982840667 / XN179385949664547），上游描述里明写「请勿再次使用同一链接订购」，我们此前完全没拦。

### 拦截一：涨粉类不接受视频链接

`server/src/routes/orders.js`，在 `validateForType` 之后、数量校验之前：

```js
const isFansSvc = /粉|粉丝|followers?|fans?/i.test(svcName);
const isVideoUrl = /tiktok\.com\/(t|video)\/|youtube\.com\/(watch|shorts)|instagram\.com\/(p|reel)\//i.test(target);
if (isFansSvc && isVideoUrl) → 拒绝，并回正确写法
```

返回给客户的话：

```
这是涨粉服务，要填「主页」或「用户名」，不是视频链接。
正确写法：https://www.tiktok.com/@你的用户名　或　直接填 用户名
```

### 拦截二：同一链接不能重复下单

归一化后比较（大小写 / `www.` / 协议 / 尾斜杠 / 查询串都不影响）：

```js
const normTarget = (x) => String(x||'').trim().toLowerCase()
  .replace(/^https?:\/\//, '').replace(/^www\./, '')
  .split('?')[0].replace(/\/+$/, '');
```

只查该用户**未完成**的订单（`已完成/已取消/已退款/部分完成/Completed/Canceled/Cancelled/Partial` 之外）。命中就拒绝并告诉他哪一单在进行中。

### 实测（四个用例全过）

| 用例 | 结果 |
|---|---|
| 涨粉 + `tiktok.com/t/xxx` | ✅ 拦住 |
| 涨粉 + `@username` | ✅ 放行 |
| 同链接再下一单 | ✅ 拦住 |
| `WWW.TikTok.com/@user/`（大小写+尾斜杠） | ✅ 仍然拦住 |

⚠️ 测试用的放行单**真的提交到上游了**，事后已物理删除订单 + 流水、余额复原。
以后测这个接口要么用不存在的服务，要么记得清理。

### 退款原因：新字段 `orders.refund_reason`

```sql
ALTER TABLE orders ADD COLUMN refund_reason VARCHAR(255) NULL;
```

- 模型：`server/src/models/Order.js`
- 写入：`utils/orderRefund.js` 的 `refundOrderFully(orderId, { reason, customerReason })`
- 上游取消路径：`utils/orderSync.js` 里按 `isCancel` 写不同文案
- 返回：`GET /api/orders` 的 `attributes` 里加了 `refund_reason`

客户在历史订单看到的：

```
已取消    💸 已全额退回余额
投放未能完成，已全额退款。常见原因：链接不符合要求
（涨粉类需填主页链接或用户名，不能用视频链接）、
或同一链接重复下单。修正后可直接重新下单。
```

**用词红线**：全句没有「上游 / 供应商 / 渠道商」，只说「投放未能完成」。

### 状态不再露英文

祥哥截图里有一单显示 `Cancelled`。原因是上游有两种拼法，`statusMap` 只写了 `Canceled`。已修：

- `orderSync.js` 的 `statusMap` 补 `Cancelled` / `Fail` / `Failed`
- `GET /api/orders` **出库前再统一映射一遍**（`STATUS_ZH`），以后上游换任何拼法都不会漏到客户界面
- 库里那 1 条英文状态已 `UPDATE` 改正

---

## 4. 热门落地页中文化

祥哥：「这个能中文吗，英文我看不懂」。

`client/src/views/Admin.vue` 的流量看板，新增 `PAGE_LABELS` 映射 + `pageLabel()`：

```
/order → 开始下单    /history → 历史订单    /boost → 千川流量
/admin → 管理密室    /mass-order → 批量下单  /recharge → 资金充值
```

- 中文大字为主，**原始路径用灰色小字附在后面**（排查时还要用）
- 表里没有的**不瞎编**，原样显示路径 —— 编错比不编更容易误导
- 带参数的按前缀认：`/c/*` → 分站落地页，`/my-site*` → 我的分站，`/admin*` → 管理密室（子页面）

---

## 5. dist 清理 + 一次部署事故（教训）

### 事故

清理 `client/dist` 的历史 bundle 时把 tar 层级写错了：

```bash
tar -xzf d21.tar.gz --strip-components=1 -C client/dist   # ❌ 解成了 client/dist/dist/
```

**全站 404/500 约 1 分钟**。已 `mv` 备份回滚。邻居 `tk7188.com` / `code.taikon.top` 全程 200，未受影响。

### 现在的部署姿势（照这个来，别再手搓）

```bash
# 本地：包顶层必须是 client/dist/
tar -czf d.tar.gz -C . client/dist

# 服务器：先验证结构，再备份，再换，最后回归；任一非 200 自动回滚
tar -tzf d.tar.gz | head -2          # 必须看到 client/dist/
rm -rf /tmp/dist_backup_ok && mv client/dist /tmp/dist_backup_ok
tar -xzf d.tar.gz -C /var/www/xnow
# 跑 9 个页面 + 入口 JS，fail=1 就 mv 回来
```

### 顺手清掉的历史包袱

`client/dist` 原本 **511 个文件**（历次解压覆盖累积，其中 94 个是历史 `Admin-*.js`）。旧 bundle 不只是占空间 —— 浏览器可能缓存到旧文案，之前清理「上游」字样时就专门删过一轮。现在 **44 个**，只留当前版本引用的。

---

## 6. 未做：服务筛选方案（祥哥说「先不动」）

用户提的问题：**上游 2803 个服务太多，客户不知道选哪个；有的卡住/慢/不通，客户看不出来，选错就浪费时间。**

已给方案，等祥哥拍板，**尚未动工**。方案要点（完整版在对话里）：

### 数据现状（决定了不能做纯自动评分）

| 指标 | 数值 |
|---|---|
| 在售服务 | 2803 |
| 有订单记录的服务 | **14 个** |
| 总订单 | **37 单** |

平均每服务 0.013 单 → 自动评分对 99.5% 的服务无数据可用。

### 但有两个免费信号源

**① 服务名里已经写满答案（544 个服务）**

```
🇧🇷 TikTok关注者[巴西][补充：30天][最大：50K][开始时间：1小时][速度：10K/天]
```

结构化后：`巴西 TikTok 粉丝 · ⚡1小时内启动 · 🚀10K/天 · 🔄30天补单 · 上限 50K`
（**提取不到就不显示，绝不猜** —— 标签错了比没标签更糟）

**② 真实履约数据（14 个服务，但结论很硬）**

| 服务 | 单 | 完成 | 取消 | 取消率 |
|---|---|---|---|---|
| TikTok浏览-即时 1-5M/天 | 11 | 10 | 1 | 9% |
| 【千粉2-3小时】TikTok 真人粉 | 5 | 1 | 3 | **60%** |
| 【目前不掉】TikTok浏览 100M | 4 | 4 | 0 | 0% |

那个取消率 60% 的真人粉**现在还在被客户反复选** —— 昨天投诉退款的客户就是撞在它上面。

### 四层方案

| 层 | 做什么 | 成本 | 我的建议 |
|---|---|---|---|
| 一 | 服务名解析成标签 + 筛选器 | 0 | 做 |
| 二 | 真实数据打信任徽章（≥5 单才评级） | 0 | 做 |
| 三 | **人工精选推荐位 + 默认折叠** | 0 | **先做这个**，今天就能缓解 |
| 四 | 小样探测（Top 50 每周测最小量，约 ¥25/月） | 花钱 | 先不做 |

### 等祥哥拍板的 4 个问题

1. 默认只显示推荐（15–20 个）还是全显示但排序？
2. 每个分类推荐几个（3 / 5）？
3. 「取消率高」的红标要不要给客户看见？（倾向 C：显示但换说法，比如「近期不稳定」，不暴露具体数字）
4. 小样探测做不做？

---

## 涉及文件

| 文件 | 改动 |
|---|---|
| `server/src/utils/orderSync.js` | 取消播报加取消方/时间线/进度/上游结算；`statusMap` 补 `Cancelled/Fail/Failed`；写 `refund_reason` |
| `server/src/utils/sync.js` | **删除**抓 5.3MB 页面 + 正则；改 `get-service-description` 端点，每轮补 200 个；描述三级兜底 |
| `server/src/routes/services.js` | `GET /detail/:serviceId` 加按需补抓 + 入库；`import axios` |
| `server/src/routes/orders.js` | 下单拦截（视频链接/重复下单）；`import { Op }`；`GET /` 加 `refund_reason` + `STATUS_ZH` 兜底映射 |
| `server/src/utils/orderRefund.js` | `refundOrderFully` 新增 `customerReason`，写 `refund_reason` |
| `server/src/models/Order.js` | 新增 `refund_reason` 字段 |
| `client/src/views/Order.vue` | 有真实描述时隐藏硬编码示例行 |
| `client/src/stores/app.ts` | `guide_2` 文案改正（中英文） |
| `client/src/views/History.vue` | 桌面表格 + 手机卡片都显示 `refund_reason`；「已执行智能退款」→「已全额退回余额」 |
| `client/src/views/Admin.vue` | `PAGE_LABELS` + `pageLabel()`，热门落地页中文化 |

## 实测验收（全部真机跑过，不是"应该可以"）

- 描述按需抓取：3.38 s → 0.054 s，内容与上游逐字一致
- 下单拦截四用例：视频链接拦住 / 主页放行 / 重复拦住 / 归一化后仍拦住
- 订单列表：`status` 全中文，`refund_reason` 正常返回
- 部署回归：9 个页面 + 入口 JS 全 200；邻居 `tk7188.com`、`code.taikon.top` 全 200
- 测试残留已清：订单 `XN17939385581733` 物理删除、流水删除、余额复原

---

## 7. 追加（同日深夜）：分站首页 404 事故 + 部署流程改成脚本

### 事故：所有分站首页 404，是我删的

祥哥收到 SeoGuard 告警：

```
🚨 抓取链路异常（SEO/AI 收录会静默失效）
· 7h2d5u.taikon.top ai-gptbot：GPTBot 抓首页被拒：HTTP 404
· 7h2d5u.taikon.top ai-claudebot：ClaudeBot 抓首页被拒：HTTP 404
```

一查不是 SEO 问题，是**任何浏览器打开分站都是 404**。分站 vhost 配的是
`index site.html`，而 `site.html` **不在 git 里、是构建时生成的**。

**根因：我的构建流程只跑了三步中的第一步。**

```bash
npx vite build                 # ← 我只跑这个
node scripts/prerender.mjs     # ← 漏了（生成 en.html / vpn.html）
node scripts/subsites-html.mjs # ← 漏了（生成 site.html = 分站首页入口）
```

而 `deploy/sites/deploy-prod.sh:211` 本来就有闸门：

```bash
[ -f "$APP/client/dist/site.html" ] || die "dist 里没有 site.html —— 直接上线会让所有分站空白，已中止"
```

**手工 tar 部署绕过了它。**

为什么到 11-06 才暴露：前面几次是「解压覆盖」，旧文件没删，`site.html` 侥幸留着。
今天为了清理 511 个历史 bundle 第一次 `rm -rf client/dist` 全删重建 —— 它才真正消失。

### 修复

补跑完整三步构建 → dist 里 45 个文件、`site.html` 14xx 字节 →
分站 `/` `/robots.txt` `/sitemap.xml` 在 普通/GPTBot/ClaudeBot 三种 UA 下**全部 200**。

### 部署流程：新增 `deploy/quick-deploy.sh`

**为什么不用 `deploy-prod.sh`**：那个脚本 L184–185 是 `git checkout` + `git pull --ff-only`，
依赖先 push。但本仓库是 PUBLIC，日常改 bug 不 commit / 不 push 是常态，
为了走它而先 push 反而扩大事故面（而且它还会 npm install + SQL 迁移，重）。

把它的**验证部分**抽出来单独成 `deploy/quick-deploy.sh`（本文件已入库）：

| 步骤 | 内容 |
|---|---|
| 0 | 前置检查：`$APP` / `$DIST` 存在，`pm2` 里必须有 `xnow-backend` |
| 1 | 解包到临时目录，**验证顶层必须是 `client/dist/`** |
| 2 | **四文件强制检查**：`site.html` `index.html` `en.html` `vpn.html`，少一个就中止（并打印漏跑的两个脚本名） |
| 3 | 备份当前 dist → `/var/backups/xnow-dist/<时间戳>/`，**只留最近 3 份**（防磁盘被塞满） |
| 4 | 替换 dist（失败自动从备份恢复） |
| 5 | `pm2 restart xnow-backend`（**只这一个**），然后确认状态是 online |
| 6 | 跑 `deploy/guard/post-deploy-verify.sh`（含 `tk7188.com` / `code.taikon.top` 等邻居），**任一不符自动回滚 + 复测** |

### 🔒 隔离性（这台机器上还跑着别的项目，逐条验过）

```
grep 排除注释后 → ✅ 无 pm2 restart all / 无 nginx -s reload / 无 CF / 无写库
脚本里所有 pm2 命令都带进程名 xnow-backend
```

- 不写 `/etc/nginx/**`，不 reload nginx，不碰 `conf.d` / `sites-enabled`
- 不碰 Cloudflare 任何开关（zone 级，动了连累所有子域名 —— 11-03 瘫 8 小时就是它）
- 不执行任何数据库写（迁移属于 deploy-prod.sh）
- 只替换 `$APP/client/dist` 一个目录

### 实测

| 用例 | 结果 |
|---|---|
| 给缺 `site.html` 的包 | ✅ 第 2 步拦住，**退出码 1**，生产零改动 |
| 给合法包 | ✅ 备份 → 替换 → 重启 → 8 项回归全过 |

全机回归结果（含邻居）：

```
xnow 主站 200 · /api/services/public 200 · /api/services 401
7h2d5u 分站 200 · demostore 200 · beta 200
tk7188.com 200 · code.taikon.top 200     ← 邻居未受影响
```

### 遗留：3 个孤儿 vhost（未处理，等祥哥定）

服务器 5 个 `xnow-site-*` 配置，数据库只有 1 个真分站：

| vhost | 状态 |
|---|---|
| `7h2d5u.taikon.top` | ✅ 真分站（星辰增长，site 1） |
| `t1.xnow.taikon.top` | ✅ 同一分站的备用域名 |
| `laozhang.taikon.top` | ❌ 孤儿（site 11 已删） |
| `demostore.taikon.top` | ❌ 孤儿（site 25 已删） |
| `2srjev.taikon.top` | ❌ 孤儿（site 45 已删） |

好消息：SeoGuard 只查 `.indexnow-hosts` 里两个真域名，**孤儿不会引起误报**。
但 `post-deploy-verify.sh` 里还检查着 `demostore`，删 vhost 时要同步改那一行。
清理需要 `nginx -t` + reload，属于共享层操作，**动之前要单独确认**。
