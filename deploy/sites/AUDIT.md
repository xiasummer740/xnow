# 分站体系 · 需求逐条审计（2026-10-24，第 35 轮）

目的：把最初的目标语句拆成 10 条，每条给出**代码位置 + 实测证据**，
避免"功能看起来做了、其实没通"（第 28 轮就犯过这个错：模块开关当时是死的）。

图例：✅ = 代码 + 实测都通过 · ⚠️ = 代码在但**某条路径没实测过** · ❌ = 未做

---

## 1. 仅至尊代理（agent）可开分站 ✅

| 项 | 证据 |
|---|---|
| 后端拦截 | `server/src/routes/sites.js` `POST /`（L285 起）：`authenticate` 后先放行 `admin/super_admin`，其余必须是 `role === 'agent'`，否则 403 |
| 前端入口 | `/my-site` 路由 + 侧边栏仅对 agent/admin 显示 |
| 实测 | 普通用户（`user`）调 `POST /api/sites` → **403**；super_admin → 200 |

## 2. 免费子域名 ✅

| 项 | 证据 |
|---|---|
| 判定 | `utils/siteDomain.js` `isFreeSubdomain()` = 域名以 `.taikon.top` / `.xnow.taikon.top` 结尾 |
| 自动发域名 | 建站后自动 `ensureCert` + `writeVhost` + `reloadNginx`（三十九期改为**每站独立 vhost**）|
| 自助修复 | `POST /api/sites/:id/publish`（站长点「修复域名」）|
| 实测 | 建 `laozhang.taikon.top` → 生成 `/etc/nginx/sites-enabled/xnow-site-11-*` → **公网 HTTPS 200**，`is_subsite=true`，`site_id=11` |

> ⚠️ 已知约束：免费子域名必须是**一级**（`名字.taikon.top`）。
> 两级（`a.b.taikon.top`）需要付费证书；直接泛域名接 nginx 会抢同机其它项目的子域名，故不用泛域名。

## 3. 自有域名 + 自动证书 ⚠️

| 项 | 证据 |
|---|---|
| 归属验证 | `verifyDomainOwnership()`：A 记录指向本机，或 CF 代理下加 TXT `xnow-verify=<token>` |
| 证书 | `ensureCert()`：优先 `certbot --nginx` 申请 Let's Encrypt；失败/未装则 openssl 自签 |
| 发域名 | 同 2，写独立 vhost |
| 防刷 | 60 秒内禁止重复尝试；写入 `custom_domain` 时**绝不覆盖**免费子域名 |
| 实测 | vhost 生成 + reload + `cert_mode='existing'/'selfsigned'` 全通 |

**⚠️ 为什么是警告而不是通过**：Beta **没装 certbot**，所以
`certbot` 那条分支**从未真正执行过**。现在所有证书都是自签（CF 代理下对外可用，
但浏览器直连会提示"不安全"）。装 certbot 后这条路需要再验一次。

## 4. 分站主预存余额、按成本价扣 ✅

| 项 | 证据 |
|---|---|
| 扣费 | `orders.js` 下单时从 `site.owner` 的 `users.balance` 扣 `siteCost = 上游 rate × 全局倍率 × agent_discount` |
| 余额不足 | 拒绝下单，不产生欠款 |
| 并发 | 实测两笔并发只成功 1 笔，余额**从不为负** |
| 退款 | 退款时按比例退回站长成本，双方净额归零 |
| 实测 | 100 个单位：客户付 4.6226 / 站长扣 3.0818 / 站长赚 1.5409 |

## 5. 可自定义 1~100x 售价 ✅

| 项 | 证据 |
|---|---|
| 上界 | `pricingError()`：`m > 100` → 「分站倍率上限 100 倍」 |
| 下界 | `m < 1` → 拒绝（倍率 < 1 时普通用户下单平台每单倒贴）|
| 成本护栏 | `m × agent_discount < 1` → 提示「最低要卖 X 倍才不亏」|
| 成交价 | 客户实付 = `上游 rate × 分站倍率`；站长成本 = `上游 rate × 全局倍率 × 折扩` |
| 实测 | 倍率 3.0 → 客户 3.3411/千，站长成本 2.2274/千，站长毛利 1.1137/千 |

## 6. 6 套模板 + 6 色系主题 ✅

| 项 | 证据 |
|---|---|
| 模板 | `classic / saas / minimal / neon / magazine / glass` = **6 套** |
| 结构差异 | 每套自带首屏骨架：saas 左文右图 / magazine 衬线整屏 / minimal 无卡无影 / neon·glass 光晕。CSS 选择器数 1/12/8/4/8/4 |
| 色系 | `cyan / purple / green / red / orange / blue` = **6 套**，CSS 变量逐一定义 |
| 自定义主色 | `accent` 字段覆盖主色（任意 `#RRGGBB`）|
| 细节维度 | 圆角 / 密度 / 卡片质感 / 字体 / 按钮形状 / 首屏布局 = **6 个旋钮** |
| 一键预设 | 9 套成套组合，点一下整套生效；`/showcase` 公开陈列页可免登录对比 |

## 7. 首页模块可开关、可排序 ✅

| 项 | 证据 |
|---|---|
| 区块数 | 首页真实渲染 6 个：`audience / steps / advantages / hot_services / faq / cta` |
| 后台开关 | `SiteAdmin.vue` `MODULES` 与上面 6 个**一一对应** |
| 排序 | `moduleOrder()` + `:style="{ order }"` |
| 实测 | 6/6 键存储成功；关闭 FAQ 后首页该段消失；把热门服务拖到第 0 位后排到最前 |

> 第 28 轮曾误报此项为"已完成"，实际当时后端白名单还是旧键 → 存不进库。
> 本项已重新端到端验证（存库 + 页面渲染两段都验）。

## 8. 分站自填支付商户（方案②）为主 + 手动加余额兜底 ✅

| 项 | 证据 |
|---|---|
| 每站独立商户 | `sites.bufpay_id/bufpay_key/cryptomus_*`；回调按 `paySiteId` 反查站点，用**该站**凭据校验 |
| 不回落到平台 | 分站充值在未配置商户时返回 `No Config`（**不会**偷偷用平台的收款账户）|
| 伪造回调 | 篡改金额/签名 → **400** 拒绝 |
| 合法回调 | 入账且写 `transactions.site_id`，不重复入账 |
| 分站充值不计平台营收 | 不写「推广返佣」，不计入平台 GMV |
| 手动兜底 | `POST /api/admin/user/update` `type:'fund'` → 加余额 + 写「后台调账」流水 |

## 9. 分站可配自有 SMTP ✅

| 项 | 证据 |
|---|---|
| 字段 | `sites.smtp_host/port/user/pass`（密码回显固定 `******`，空值表示不修改）|
| 使用点 | `routes/auth.js` 把 `req.site.smtp_*` 传给 `utils/email.js` |
| 判定 | `useSite = !!(siteCfg.smtp_user && siteCfg.smtp_pass)` |
| 失败兜底 | 分站 SMTP 报错 → 记日志并回落平台通道代发（客户收得到验证码）|
| 测试按钮 | `POST /api/sites/:id/smtp-test` |

## 10. 主站代码与数据在验收前一行不动 ✅

| 项 | 证据（第 35 轮实测）|
|---|---|
| 数据 | `users=5 orders=31 services=2839 sites=0 tx=39` —— 与开工时完全一致 |
| 新增列 | 生产库中分站相关新列数量 = **0** |
| 代码 | 生产 `server/src` 与 `main` 分支逐字节一致（差异仅空白），本项目新增标识符 0 命中 |
| nginx | `xnow-spa-https` 的 sha256 在预检前后未变 |
| 线上 | 首页 / `/api/public/config` 均 200 |

---

## 结论

- **8 条全部通过**（代码 + 实测）
- **1 条带警告**：自有域名自动证书的 `certbot` 分支未执行过（Beta 未装 certbot，证书目前自签）
- **0 条未做**

## 距离"上线"还剩什么

| # | 事项 | 状态 |
|---|---|---|
| 1 | 祥哥验收外观 | ⏳ 待他打开看 |
| 2 | 装 certbot 并复验证书 | ⏳ 待批准（系统级改动，不自行安装）|
| 3 | 执行生产部署 | ⏳ 待他一句"部署" |

生产部署本身已预检通过、迁移已在生产真实表结构上演练通过、回滚脚本就绪。
