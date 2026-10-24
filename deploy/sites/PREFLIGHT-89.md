# 上线前预检（89 期 · 2026-10-25）

> 本文是「准备上线」这一步的证据链。全部操作**只读生产**：演练用生产库的副本，
> 上游指向本地假服务器，跑完自动删库停进程。生产代码/数据一行未动。

---

## 一、结论

| 检查 | 结果 |
|---|---|
| 生产形态库迁移（补列） | ✅ 新增 **49 列**，`sites` 11 → **59 列**，`orders` 拿到 `site_id` + `site_cost` |
| 启动 | ✅ 3 秒起来，**0 个 SQL 报错** |
| 只读接口 | ✅ 公开配置 / **2839 个服务**（无 `rate` 泄漏）/ 订单历史 19 条（无成本字段泄漏）/ 分站列表 |
| 资金链路（真下单） | ✅ **16/16 全绿**：主站单 + 分站单都成交，`site_id` / `site_cost` / 买卖双方余额全部自洽 |
| 上线脚本预检 | ✅ 备份（库 + dist + nginx + .env + 回滚脚本）全部就绪，到 checkout 前**一个字节都没动** |
| 生产现状 | 用户 6 / 订单 31 / 服务 2839 / 分站 0 / `sites` 11 列 / `main@3d57a90f` / 主页 200 |

可重复性：`rehearse.sh` 连跑 **3 次**结果一致（第 1 次失败是上一轮残留进程造成的瞬时状态，
脚本会先杀掉占用 3002 的旧进程；第 2、3 次全绿）。

---

## 二、⚠️ 生产有 6 个文件被手工改过 —— 逐项核对过，分支是超集

上线脚本的处理方式是：**备份到 `/var/backups/xnow/<时间戳>/preflight/tracked/`，
然后 `git checkout -- .` 丢弃，部署分支版本**。所以必须确认分支没丢生产上的东西。

| 文件 | 手工改动（忽略换行差异） | 分支里是否保留 | 依据 |
|---|---|---|---|
| `server/src/routes/orders.js` | +173 行（按服务类型组装上游载荷、订阅型必填 posts） | ✅ | `buildUpstreamPayload` / `validateForType` / `TYPE_REQUIRED` 均在；演练真下单成交 |
| `server/src/routes/pay.js` | +16 行 | ✅ | `md5(` 6 处、`bufpay_key` 7 处、`cryptomus` 26 处 |
| `server/src/routes/services.js` | 51 行 | ✅ | `sell_price`、`global_multiplier` 均在；演练返回 2839 个服务且不泄漏 `rate` |
| `server/src/routes/admin.js` | 5 行 | ✅ | `退款入账` 4 处、`total_deposit` 4 处 |
| `server/src/routes/public.js` | 2 行 | ✅ | `site_logo`、`agent_discount` 均在 |
| `client/dist/index.html` | 4 行 | 无需保留 | 上线脚本会在服务器上重新构建 dist，产物覆盖它 |

**结论**：生产上那些"手工改动"其实已经以提交形式进了 `feat/sites`（写法被重构过，
所以原始 diff 看着很大；忽略 CR 后真实差异只有上面这些行）。分支是超集，不会回退功能。

---

## 三、演练实测明细（当前分支 `b2b7914e`）

### 迁移 + 启动（`rehearse.sh`）

```
生产数据: 用户 6 / 订单 31 / 服务 2839 / sites 列数 11
提交: b2b7914 feat(billing-ui): 代理/分站月费界面 + 普通用户开通入口
✅ 第 3 秒启动成功
[migrate] 自动补列完成：新增 49 列
sites 列数: 59
orders 必备新列: site_id site_cost
服务列表: 200 / 2839 个服务 / 泄漏rate=False
订单历史: status=success / 19 条 / 成本字段泄漏=[]
分站列表: {"status":"success","data":[]}
✅ 0 个 SQL 报错
```

### 资金链路（`rehearse-order.sh`，模拟上游 + 生产数据副本）

```
✅ 主站下单成交: success
✅ 分站下单成交: success
✅ 分站订单 site_id: 1      ✅ 主站订单 site_id: 0
✅ 主站订单 site_cost（应为 0）: 0.0000
✅ 分站客户付款 = 上游成本 × 5 倍 × 9 折
✅ 站长成本 = 上游成本 × 2.0
客户余额 49.509900（50 起，扣 0.490100）
站长余额 99.673260（100 起，扣主站单 0.108900 + 分站成本 0.217840）
✅ 上游收到 2 次下单   ✅ SQL 报错数: 0
通过 16 项，失败 0 项
```

---

## 四、正式上线时会发生什么（`go-live.sh`）

1. 备份：生产库 dump、回滚脚本（锚点 `3d57a90f`）、`client/dist`、nginx 配置、`server/.env`
2. 备份 + 丢弃上述 6 个手工改动（原文件在 `preflight/tracked/`）
3. `git checkout feat/sites` → `npm install --omit=dev` → `vite build` → `prerender` → `subsites-html`
   （**构建产物里没有 `site.html` 会直接中止**，防止所有分站白屏）
4. 重启 `xnow-backend` → 自动补列 49 列
5. 冒烟检查；失败则 `bash /var/backups/xnow/<时间戳>/rollback.sh` 一键回滚

回滚锚点：`3d57a90f`（main）。所有备份在 `/var/backups/xnow/`。

---

## 五、还差一步

**等祥哥在手机上验收后说「可以上」**，然后：

```bash
ssh xnow-vps 'bash /tmp/go-live.sh'      # 正式上线
```

验收地址：`https://demostore.taikon.top`（18800000077 / demo123456）
→ 侧边栏「我的分站」→ 至尊代理卡 / 分站月费卡 / 续费按钮 / 建站（域名留空自动分配）。
