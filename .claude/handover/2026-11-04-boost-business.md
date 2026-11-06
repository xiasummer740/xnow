# 千川流量业务线（人工派单）· 上线记录

> 2026-11-04 开工 → 当晚收工。**这条业务线已可开卖**，只差两个商业决策（见文末待办）。
> 代码 `feat/sites` = `main` = 生产 `/var/www/xnow`。

---

## 一句话

在 XNOW 主站新增一条**完全独立于上游 API 的业务线**：抖音播放/点赞/涨粉/场观/扫码 + 视频号 Adq 涨粉，共 8 个业务 23 个商品。**人工派单**——客户网站下单付款 → 加客服微信/TG 报订单号 → 运营后台手动推进状态。

---

## 为什么要单独建表

`boost_products` / `orders.biz_type='manual'` 是**新的一套**，不能塞进 `services`：

```js
// server/src/utils/sync.js:135
Service.destroy({ where: { service_id: willDelete } })
```

AutoSync 每 10 分钟跑一次，凡是不在上游清单里的 `services` 行**会被物理删除**。手工建的服务活不过 10 分钟。

---

## 交付清单

| 模块 | 文件 | 说明 |
|---|---|---|
| 商品表 | `server/src/models/BoostProduct.js` | 含 `cost_flat_price` / `cost_tiers`（成本，客户永远拿不到） |
| 种子数据 | `server/src/utils/seedBoost.js` | 23 个商品，**create-only**（按 code 幂等，不更新已有行） |
| 客户接口 | `server/src/routes/boost.js` | `/catalog` `/customer` `/quote`（公开）+ `/order` `/orders` `/orders/:id/contact`（登录） |
| 后台接口 | `server/src/routes/boostAdmin.js` | 派单 / 退款 / 商品管理 / 批量调价 / 客服配置 / 二维码上传 |
| 客户页面 | `client/src/views/BoostShop.vue` | 表格式价目表，平台 + 业务两级 tab |
| 后台页面 | `client/src/views/BoostAdmin.vue` | 待派单（红点）/ 全部订单 / 商品管理 / 客服设置 |
| 迁移 | `server/src/app.js` | `boost_products` 建表 + `orders` 加 `biz_type`/`boost_product_id`/`ext_fields`/`contact_channel` |

---

## 关键口径（改动前必须知道）

### 1. 阶梯定价语义

`tiers` 只存 `min`。**下单量 ≥ min ⇒ 整单按该单价计费**，取满足条件的最大 min。

```
金额 = (数量 / unit_qty) * price
```

例：若某商品「≥10万档」单价为 P，客户买 10 万 → 付 `10 × P`。
**不是**「前 3 万按 ≥1万档、后 7 万按 ≥3万档」的分段累加。

**已知空档坑**：买得少反而可能更贵 —— 因为买到某个数量才够上更低单价的档位，
差一点点没够到时，整单仍按上一档的高单价算。目前按原样保留，未做"向上取最优档"。

> 📌 具体成本价与本轮定价见后台商品管理（`/admin/boost` → 商品管理）。
> **本文档不记录任何成本数字** —— 仓库是 PUBLIC，成本表推上去等于公开给同行和客户。

### 2. 成本 / 售价分离

| 字段 | 谁能看 |
|---|---|
| `cost_flat_price` / `cost_tiers` | 仅后台 |
| `flat_price` / `tiers` | 客户 |

`pubProduct()` 只挑白名单字段，客户 API `grep -c 'cost_'` = 0（已验）。批量调价 `POST /products/reprice` 以 `cost` 为基准重算，不是在现价上叠乘。

### 3. 状态机（只有这四条合法迁移）

```
待派单 → 处理中 → 已完成
待派单/处理中 → 已取消（走 refundOrderFully，幂等）
```

🔴 **manual 单绝不允许出现 `status='提交中'`** —— `orderSync.js` 的 `sweepStuckSubmitting` 会把超过 10 分钟、没有 `upstream_order_id` 的 `提交中` 单**自动退款**。

### 4. `upstream_charge` 恒为 0

manual 单没有上游成本，任何利润报表都要 `WHERE biz_type <> 'manual'`，否则这部分的毛利会被算成 100%。

### 5. 客户可见文案红线

**永远不出现「上游 / 供应商 / 渠道商 / 进货」**。这些词只允许在 `Admin.vue`、后端日志、代码注释里。

本轮清理过：上游工作室的内部黑话「包来客」「排广」——查证**不是行业术语**（无权威定义），已从全部客户可见名称中移除，DB 里 0 命中。

---

## 本轮修掉的真 bug

### 🔴 支付对账「查证」从来没工作过（资金风险）

```js
// 旧代码
axios.get('https://bufpay.com/api/query?order_id=' + pay.order_id)
```

**两处错**：路径该是 `/api/query/{aoid}`（路径参数），参数该是 **aoid**（BufPay 平台单号）不是我们的 `order_id`。实测该 URL 返回 **404**。

后果：所有 BufPay 单在回调丢失后**无从查证**，30 分钟一到一律标 `callback timeout` 判死。用户真付了钱、只是收款手机没电/App 被杀 → 钱进来但余额不加。

修复：
- `paymentTracker.js` 记录新增 `aoid` 字段 + `setAoid()`；回调 `/notify/bufpay` 和跳转 `/return/bufpay` 都落盘
- 查证改用 `GET /api/query/{aoid}`，按官方状态码语义判定
- **没有 aoid 绝不判死**，改标「无法自动查证（缺支付平台单号），需人工核对」并发 TG
- `fee_error`（我方手续费余额不足）单独识别，不再误判成用户没付

⚠️ **遗留**：前端用 iframe 表单 POST 到 BufPay，**拿不到 aoid**。彻底解决要把支付改成 `format=json` 模式（前端拿 JSON 里的 aoid 回传后端，二维码自己渲染）。目前只能在回调/跳转时补存。

### 🔴 「客服设置」tab 不加载数据，会把配置清空

`@click="tab = t.key"` 只改变量，从不拉数据。切到该 tab 表单是空白 → 运营以为没保存 → 再点保存 → 空表单覆盖库里配置。

修复三道：tab 切换调 `loadSettings()`；未加载成功时禁用保存并显示红框警告；后端拒绝全空提交。

### 其它

| 问题 | 修法 |
|---|---|
| `product_name` 列不存在导致运维 SQL 静默失败 | 正确列名是 `service_name` |
| 后台全用原生 `confirm()/alert()` | 全部换成 `ui.showConfirm/showToast`（App.vue 已有全局暗色弹窗渲染器，只是没接） |
| 订单唯一「视频链接」不收抖音号 | 播放/点赞补 `douyin_id`，且**格式校验**（见下） |
| 抖音号校验正则 `{2,30}` 太松，填 `12` 能下单 | 改 `{4,24}`（抖音号真实规则） |

---

## 下单字段校验（前后端同一份规则）

规则由后端 `input_schema` 的 `pattern` / `patternHint` 下发，前端 `submit()` 和后端 `/order` 用**同一个正则**，不会出现前端放过、后端拒绝。

| 字段 | 规则 |
|---|---|
| 抖音号 `douyin_id` | `^[A-Za-z0-9_.\-]{4,24}$` 或 `https://(v|www).douyin.com/...` |
| 视频链接 `link` | 必须含 `douyin.com`；`multiple: true`，空格分隔**逐条**校验 |
| 视频号 `account_id` | `^[\u4e00-\u9fa5A-Za-z0-9_.\-]{2,40}$`（允许中文名） |

后端在**扣款之前**校验，失败不扣钱（已实测余额不变）。

---

## 客户侧配置（运营要填的）

### 菜单入口标记

`DashboardLayout.vue` 里「千川流量」右侧挂了两个 badge：

```
🎯  千川流量        [国内] [新]
```

- `国内`（青色 `.nav-badge-cn`）：**区域属性**。主站有 `/en` 英文页和 USDT 支付，看着不像纯国内站，
  但抖音/视频号只服务国内账号 —— 海外客户误买必然退款，这个标记在点进去之前就筛掉一批。
- `新`（琥珀色 `.nav-badge`）：上架状态，沿用原有样式。
- 一个菜单项挂多个 badge 时用 `.nav-badges` 容器负责 `margin-left:auto`，内层 `.nav-badge` 取消顶边距；
  单独一个 badge 的老写法（如 `¥99/月`）不受影响。

📌 祥哥定：
- ✅ 菜单加 `国内` 标记就够了
- ❌ 页面内不再加额外区域提示

`/admin/boost` → 客服设置：

| 项 | 现值 | 说明 |
|---|---|---|
| 微信号 | `youto7789` | 客户点「显示」才看到 |
| 二维码 | `/api/boost-img/boost_*.jpg` | **后台可直接 Ctrl+V 粘贴截图**上传 |
| TG 账号 | `@xnowfans` | 填账号即可，链接自动生成 `https://t.me/xnowfans` |
| 下单提示文案 | 见下 | 显示在 `/boost` 页头下方琥珀色提示条 |

```
付款后请立即加客服微信或 TG，把订单号发过去，客服确认后马上安排开跑。
涨粉、场观、视频号类需提供账号信息并完成授权。24 小时内未联系的订单，客服会主动联系您。
```

⚠️ 文案**刻意不提「原路退款」**：BufPay 是个人免签收款码（无退款 API）、Cryptomus 只配了 Payment Key（无 Payout 权限），系统**做不到**自动原路退款，只能人工微信/支付宝转账。`refundOrderFully` 退的是**站内余额**，而普通客户**没有提现入口**（提现只给分站站长）。

图片存储：`/var/www/xnow-uploads/boost/`，对外走 **`/api/boost-img/`**。绝不能挂 `/uploads` —— 生产 nginx 只转发 `/api/` 和 `/assets/`，其余落 SPA 兜底，图片看着破但 HTTP 仍 200。

---

## 验收记录（2026-11-04 实测）

| 环节 | 结果 |
|---|---|
| `/api/boost/catalog` | 抖音 7 业务/19 商品，视频号 1/4；`cost_` 泄漏 0 |
| `/api/boost/customer` | 微信/二维码/TG/文案全有 |
| 下单（正确字段） | success，扣 ¥36 |
| 后台待派单 | 可见，`ext_fields` 里抖音号/链接完整 |
| 待派单→处理中→已完成 | 全部成功 |
| 已完成→待派单 | 拒绝：「不能从「已完成」改成「待派单」」 |
| 退款 | ¥99,938.66 → ¥99,974.67 |
| 重复退款 | 拒绝：「该单已退款，不要重复操作」，余额不动 |
| 字段校验 | 中文昵称/`12`/`ab`/B站链接/多条中混假链接 全部拒绝 |
| 页面 | `/` `/boost` `/admin/boost` 全 200；邻居 `tk7188.com` `code.taikon.top` 200 |

测试单已物理删除，流水一并清掉，余额复原 `99974.667800`。

---

## 待办（按优先级）

> ✅ **2026-11-04 收工时祥哥已明确**：售价保持成本 ×2 **不调**；场观**暂不定价**（保持「面议」+ 询价）；
> 菜单加 `国内` 标记即可，**页面内不再加**区域提示。下面 1、2 两条是「以后要不要动」的备忘，不是欠账。

1. **场观没定价** —— `dy_liveview_10k` 的 `flat_price=0`，页面显示「面议」+「询价」按钮。这是唯一不能直接下单的商品。后端仍拒绝 `charge<=0`，所以不会有 0 元单。
2. **售价策略** —— 目前是成本 ×2（毛利 50%）。同行普遍 ×2.5～3。改价用商品管理里的「批量调价」，`basis='cost'`，填 2.5 就是成本×2.5，不是叠乘。
3. **分站是否开放这条业务** —— 代码里 `v-if="!appStore.isSubsite"` 写死只给主站。
4. **支付改 `format=json`** —— 根治 aoid 拿不到的问题（见上文遗留）。
5. **两笔 ¥10 支付宝单待人工核** —— `BUF_alipay_10.00_1793462037540`（10-31 23:53）、`BUF_alipay_10.00_1792844254581`（10-24 20:17）。旧记录的判定不可信，需去 bufpay.com 后台按时间金额核对，若显示「已收款」点后台按钮触发回调补账。
6. 建议开卖前**自己走一遍真单**（充值 → 下单 → 扫二维码 → 点 TG 按钮），这两步自动化验不了。

---

## 回滚

- 代码回滚：`/root/xnow-rollback/20261104-133913-boost/`
- 数据库：`/var/backups/xnow-db/xnow_db-20261104-1338.sql.gz`
- 页面开关：删 `client/src/router/index.ts` 里的 `/boost` 和 `/admin/boost` 路由即可下线（商品表可留着，不影响其它业务）
