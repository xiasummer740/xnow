# 深链复审 + 验证码落库（2026-11-09）

> 起点：祥哥连报 6 个问题 —— 「用户开至尊代理说页面打不开」「首页现在正常不」
> 「文章里不能显示价格」「没有上游信息吧，这个很重要」「再次复审找 bug」
> 「验证码失败还是怎么回事」「只能填 QQ 邮箱吗」。

## 这一天的性质

接 11-08 全球获客工程。全是「祥哥截图 → 我查 → 发现是我自己弄坏的」循环。
**6 个问题里 3 个是我前一晚连续部署造成的生产故障。**

必须先记住这个：**改动完要扫全站，不能抽测；只 curl 不看浏览器等于没验证。**

---

## 🔴 故障一：首页被降级成静态页

**现象**（祥哥：「首页现在正常不」）

客户打开首页：
```
正文 795 字符 / 按钮 0 个 / 卡片 0 个 / 登录链接 0 个
h1 = "XNOW PRO · 社媒增长服务"（SSR 文案，不是 Home.vue 的）
```
登录/注册入口、7 个平台卡片全没了。

**根因**

11-08 为了让 SSR 落地页不被 Vue 抹掉内容，给 `#app` 打 `data-ssr="1"`，
`main.ts` 见到就不挂载 Vue。但 `injectIntoShell` **无条件**加这个标记，
首页也被打了。

**修法**

`injectIntoShell` 加 `ssrOnly` 参数，**默认 false（保持原行为 = 照常挂载 Vue）**，
只给纯内容页显式传 true。逐个核对 11 个调用点：

| 挂载 Vue（必须） | 不挂载（内容页） |
|---|---|
| `/` `/en` `/vpn` `/login` `/showcase` `/order` `/vip` 等全部 SPA 页 | `/c/:slug` `/c/:slug/:type` `/price` `/en/price` `/en/c/:slug` `/guide*` 和 5 个语种页 |

修后实测：首页 1446 字符 / 7 个按钮 / 23 张卡片 / h1「让你的社交媒体 火速出圈」。

**教训**

影响全局渲染行为的开关，**默认值必须保持原行为**。默认开再逐个豁免，
漏一个就是把首页变成静态页，而且 curl 看 HTTP 200、正文 795 字符、
h1 也在 —— **从接口层面完全看不出来**，只有打开浏览器数按钮才发现。

---

## 🔴 故障二：105 个平台页全部 500

给平台页加多语种 hreflang 时用 `${base}` 拼 URL，但 `/c/:slug` 这个路由
作用域里**没有 base 变量**（该路由一律用 `brand.host`）。
ReferenceError 被 catch 吞掉 → 500 纯文本。

影响：15 个平台 × 7 语种 = **105 个页面**。

抽测 `/c/tiktok` 时刚好撞上 600 秒缓存拿到旧响应，差点漏掉。

修：路由内先 `const siteBase = \`https://${brand.host}\``，全部改用它。
修完扫全站 199 条确认 0 异常。

**这还暴露了原有一个缺陷**：平台页 hreflang 一条都没有，
而同内容的 `/en/c/:slug` 声明了互指 —— 7 个语言版本互相不认，
Google 会当重复内容。一并补了 8 条（zh-CN/en/id/pt-BR/vi/ar/ru/x-default）。

---

## 🔴 故障三：老用户白屏（重新构建删了旧 chunk）

**现象**（祥哥：「用户开至尊代理说页面打不开」）

`assets` 缓存策略是 `max-age=31536000, immutable`，但部署用
`mv dist dist.old && mv dist.new dist` 把旧 hash 的 chunk 全删了。

用户浏览器缓存着旧 `index.html`（引用 `index-Dr7ETwc3.js`、
`Vip-D0eUpDrH.js`），加载时 404 —— 点进 Vip 页面要加载 `Vip-*.js`，
旧文件名已不存在。

**修法**

从 `/root/xnow-dist-backup-*` 把旧 chunk 补回 dist（hash 不同不冲突），
assets 29 → 52 个。之后每次部署都执行 `cp -n dist/assets/* dist.new/assets/`。

---

## 🔴 故障四：验证码存内存，pm2 重启全丢

**现象**（客户截图：「验证码不存在或已过期，请重新获取」）

`auth.js` 原来是：
```js
if (!global.verificationCodes) global.verificationCodes = new Map();
global.verificationCodes.set(email, { code, expires: ... });
```

`global.*` 是**进程内存**，`pm2 restart` 就清空。

11-08 深夜我连续部署重启了 5-6 次 pm2，那段时间注册的用户全卡在验证码这步。

**同一类问题还有第二处**：`user.js` 的改邮箱/改密码验证码
（`global.profileCodes`）。

**修法：落库**

新建 `models/VerificationCode.js` → 表 `verification_codes`
（id / email / code / expires_at BIGINT / ip / created_at / updated_at，
email 唯一 + expires_at 索引）

- 注册码：email 存真实邮箱
- 改资料码：email 存 `profile:{uid}` 做命名空间，两套不覆盖
- 发送时先删旧码再写新码（重复点「获取验证码」旧的立即失效）
- 每次发送顺手清过期记录，表不会无限增长
- 注册/改资料成功后才删码
- 表由 `sequelize.sync({ alter: false })` 启动时自动建，无需手工迁移

**实测**：发送 → **重启后端** → 验证码仍在 → 注册成功 → 码被消耗。跑了两轮。

**教训**

**任何需要跨请求存活的数据都不能放 `global.*` 或模块级变量。**
pm2 restart、崩溃重启、多实例部署都会让它消失。
这次是验证码，下次可能是限流计数、任务队列、缓存。

---

## 🔴 上游痕迹清理

祥哥：「没有上游信息吧？这个很重要。」

### 查出的问题一：`/finance` 公开可访问

`client/public/finance.html` 是孤儿文件（全项目零引用），但生产上
`https://xnow.taikon.top/finance` 返回 **200**，任何人打开都能看到：

```
上游余额 (API)      1,250.50
总成本（上游进货）
毛利润（订单差价）
利润率 40.0%
```

数据是硬编码假数，**泄露的不是真实财务，是商业模式** ——
等于告诉外界「这个站有上游、加价约 40%」。

处置：`git rm` + 生产彻底删除（含 dist.old / dist.new / 所有备份目录），
验证 `/finance` 和 `/finance.html` 均 404。

### 查出的问题二：站长后台 16 处「进货价」

`SiteBilling.vue`(4) + `SitePricing.vue`(12)：
```
客户看到的价格 = 你的进货价 ×（1 + 加价率）
0 = 按进货价卖（不赚不亏）
低于你的进货价会直接拦住
```

站长开分站就是为了显得像独立品牌，后台写着「进货价」截图发出去
等于暴露自己是二道贩子。全部改成「结算价」（B2B 标准说法）。

3 个历史版本的 SiteAdmin chunk 里还有 19 次，直接 `sed` 等长替换
（进货价 3 字 → 结算价 3 字，不破坏代码），文件仍 200，老用户不白屏。

### 审查结论（全部实测）

| 检查面 | 结果 |
|---|---|
| assets 里的上游域名 | ✅ 0 个文件 |
| 静态 HTML 6 个 | ✅ 全干净 |
| 199 条 sitemap 页面 | ✅ 0 条命中 |
| 数据库 services 表 | ✅ 0 条 |
| 客户 API（4 个端点 + services/public 2798 条） | ✅ 0 命中 |
| `configs.upstream_url` | 存在，但 `public.js` 只返回 7 个白名单 key，不含它 |
| 上游/进货 | 只剩 Admin-* / BoostAdmin-* 两个管理密室 chunk（规则允许） |

---

## 复审修的 4 个真问题

### ① 英文平台页内容只有中文的一半

```
中文 /c/tiktok     8 个 h2
英文 /en/c/tiktok  4 个 h2
```

上一轮给中文和 5 个外语种都做了同义词，**唯独漏了英文** —— 全球最大市场。
英文用户搜 `buy tiktok followers` 这类动作词时，标题只覆盖最主流两个，长尾全丢。

补 8 类英文同义词（buy/get/purchase/cheap/real followers、
live viewers、website traffic…），加「Other names for the same services」区块。
正文 2500 → **6315 字符（+152%）**。

### ② 所有分站的价格表都是 404

```
绕过 nginx 直连后端   200 (12012 字节)
通过 nginx 访问       404
```

`server/src/utils/siteDomain.js` 生成分站 nginx 时只转发 `/` `/c/` `/guide`
和 SEO 文件，**漏了 `/price`** → 掉进 SPA 兜底 → dist 里没有 price.html → 404。

站长把价格表链接发给客户会直接打不开。
修：生成器补 `location ^~ /price`，修正线上已有配置 + reload。

### ③ 列表接口白传 348KB 无用数据

`/api/services/public` 返回 940KB，`description` 占 348KB。
但 `Order.vue` 早就是走 `/api/services/detail/:id` 按需拉（带 descCache）。

逐个核实消费点：`Home`/`Landing` 只用 name/category/sell_price，
`Admin` 用管理端接口 —— **公开列表里的 description 前端没有任何地方读**。

（前端 `Order.vue` L506 的注释甚至写着「列表接口不再下发 description」，
说明这是计划过但没实施的优化。）

去掉后 **940KB → 664KB（-29%）**。

### ④ 51 个服务的 `<br>` 显示成字面量

数据库里 51 个服务描述带 `<br>`：
```
链接：…<br>开始时间：0-2小时<br>速度：500-3K/天
```
`Order.vue` 用 `{{ activeDescription }}` 插值 —— Vue 转义 HTML，
客户看到**字面的 `<br>`**，不是换行。

修：`loadServiceDescription` 里把 `<br>` 换成真换行符（模板已有 whitespace-pre-wrap），
顺手剥掉其他标签。**注释里写明不要改 v-html** —— 描述来自外部数据，那是 XSS 口子。

---

## 注册页加邮箱提示

祥哥问：「只能填 QQ 邮箱吗，Gmail 注册不了吗？」

**查清：代码零限制。** 后端 grep `qq.com` / `gmail` / `whitelist` 全空；
前端 `input type="email"` 什么都能填；实测 SMTP 对 gmail/outlook/yahoo/163
全部返回接受。

**问题在投递**：发信走 **QQ 邮箱 SMTP**（`464844409@qq.com` / `smtp.qq.com:465`），
发国际域名没 SPF/DKIM 对齐，极易进垃圾箱或被 Gmail 静默丢弃
（SMTP 层返回成功，实际没送到）。

证据：修好落库后库里有一条 `xiasummer740@gmail.com / 147342` ——
码生成并入库了，只是邮件没进收件箱。

修两处：
1. 发送成功的 toast 原来写死「验证码已发送」，把后端的「(含垃圾箱)」丢了 → 改用后端文案
2. 注册页邮箱框下方加一行（中英双语）：
   > 如果使用 Gmail / Outlook 邮箱，验证码请到「垃圾邮件」文件夹里找一下。

**根上没解决**：QQ 邮箱个人版约 50 封/天。彻底解决要换
Resend / SendGrid / AWS SES（免费 100 封/天，送达率高得多）。

---

## 复审过、确认没问题的

```
后端全部 JS 语法              通过（模板字符串未定义变量扫描 0 个真问题）
12 个 API 端点                无 500，最慢 0.3s
17 类页面浏览器实测            无 JS 错误、无白屏
13 个 SPA 路由                未登录正确跳 /login
移动端 390/768/1440          无横向溢出，FAQ 单双列正确切换
SSR 页面的链接和 CTA          点击正常进 SPA
199 条标题                    全部唯一，无缺描述
21 块 JSON-LD                全部可解析，无 markdown 残留
39 条 hreflang                指向的 16 个目标全部 200
数据库                        2798 服务 / 51 订单 / 卡死订单 0
定时任务                      IndexNow / Google / Bing / DB 备份全在
```

---

## ⚠️ 一个测试陷阱（浪费了两轮排查）

`/vi` 等外文页在中文浏览器里显示中文，是 **Chrome 自动翻译**，不是 bug。

验证方法：
- 看 `document.querySelector('h1').textContent`（原始），不要用 `innerText`（翻译后）
- 检查 `document.documentElement.className` 有没有 `translated-ltr`
- 或者用无痕窗口 / 关掉翻译

---

## 三方同步

本地 `feat/sites` = `4e4406f2` = 生产 `/var/www/xnow`（17 个关键文件 MD5 逐个比对）。
main = `72f8e16a`。
⚠️ 生产 git HEAD 仍停在 `1f49b8bb` —— **历史一贯 scp 部署，不是漂移**，不动它。

---

## 下次开工第一件事

**看 Google / Bing 的实际收录数据。**
11-08 推了 199 条（IndexNow 已全量、Google/Bing 配额满留到 cron）。
推到今天应该能看出：收录了多少、有没有词开始有曝光、哪个语种有动静。

**没有反馈的继续优化容易做无用功。**

## 还没做的（按价值排序）

1. **换专业邮件服务**（Resend / SendGrid）—— 送达率是根上的问题
2. **各语种类型子页** —— 中文 43 个，英文及其余 5 语种 0 个，共 720 页
3. **知识库剩余 17 篇**按第一篇深度重写
4. 73.8% 服务没描述（上游数据本身没有）
5. 外链：SaaSHub / Blogger / Hashnode 三个渠道都卡住，Dev.to 是唯一能自动发的
