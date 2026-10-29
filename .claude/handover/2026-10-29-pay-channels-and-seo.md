# 2026-10-29 · A/B 双收款通道 + 分站 SEO/GEO 底座（接力）

> 逐条实现与实测数据见 `deploy/sites/ACCEPTANCE.md` 八十五。
> 上一站：`2026-10-26-sites-feedback-round1.md`。

## 一、当前状态

| 项 | 值 |
|---|---|
| 代码 | `feat/sites` = `main`，功能提交见 `git log`（收款 + SEO 两批） |
| 生产 | 主站 200 / 分站 `7h2d5u.taikon.top` 200；数据 6 用户 / 31 单 / 1 分站 |
| 收款 | 站 #1 已开平台代收（`pay_mode=auto`），站长可在后台三选一切换 |
| SEO | 主站与分站：sitemap 17 条、JSON-LD、落地页 `/c/<平台>`、SSR 首页 |

## 二、代码地图（改这块先看这三个文件）

| 文件 | 作用 |
|---|---|
| `server/src/utils/payChannel.js` | **收款通道唯一判定处**（auto/own/platform）。改通道规则只改这里 |
| `server/src/routes/seo.js` | 服务端渲染 robots / sitemap / `/c/<平台>` / 首页壳读 `dist/site.html` 与 `index.html` |
| `server/src/utils/platform.js` | 平台与服务类型归一化（前端 `client/src/utils/platform.ts` 必须同步改） |

nginx 侧：`server/src/utils/siteDomain.js`（分站模板）、`install.sh`（主站模板）、
`deploy/nginx/production/xnow-spa-https`（生产存档，改完线上要 scp 回来）。

## 三、✅ Cloudflare 已改完（2026-10-29 23:35）

在祥哥浏览器里直接点的（他自己开了 Cloudflare 后台让我操作）：
**安全性 → 设置 → 搜「AI」→ 配置 AI 自动程序策略**：`训练` 由「禁止」改「允许」、
`启用自动程序偏好同步` 关掉 → 保存；再用 **缓存 → 自定义清除（按 URL）** 清掉 5 条
robots/sitemap（边缘缓存了 430 秒）。

实测：GPTBot / ClaudeBot / PerplexityBot / Bytespider 抓主站与分站全部 200，
`robots.txt` 37 行、`sitemap.xml` 19 行。

⚠️ **注意**：Cloudflare 2026-09-15 起对新域名默认「训练类禁止」，
以后新绑域名要记得同样处理（`Security → Settings → Configure AI bot policies`）。

下面这份是当时的诊断记录，留作对照。

**实测证据**（不是推测）：`curl -A "GPTBot/1.0" https://xnow.taikon.top/` → **403**（25 字节
`Your request was blocked.`），ClaudeBot 同样 403；PerplexityBot、普通浏览器、curl 都是 200。
即：robots.txt 写着欢迎，Cloudflare 在门口拦掉了 OpenAI 与 Anthropic 的抓取。

Cloudflare 后台 → 域名 `taikon.top` → **Security → Settings**
（<https://dash.cloudflare.com/?to=/:account/:zone/security/settings>）：

1. **Configure AI bot policies**：`Search` / `Agent` / `Training` 全设 **Allow**
2. **Enable Bot Preference Sync** → **关掉**（关掉后 robots.txt 从 167 行变回我们自己的 37 行）

改完自检：GPTBot UA 抓首页应 200，`robots.txt` 应 37 行。

## 四、已知取舍（别再重复讨论）

1. **平台代收免审批**：站长自助开关（祥哥 2026-10-29 定），平台承担拒付/垫付风险
2. **新站默认开平台代收**：为了零配置能卖；站长可以关
3. **`auto` 下自有商户优先**：站长配了自己的商户，钱就直接进他账户，平台不介入
4. 三件「不用改」的（测试账号 / `is_test` / 历史加款原因）仍然不动

## 五、如果以后要扩 SEO

- 服务级落地页（`/s/<service_id>`）目前**没做**：容易变成 2839 个薄页面，Google 会当垃圾。
  要做就按「平台 × 服务类型」聚合（`/c/tiktok-fans` 这种），每页 300 字以上、有真实数据
- 主站与分站内容高度雷同是站群风险：目前靠「站名 + 价格 + 文案」差异化，
  真出现十几个分站同城化，要给站长开放 FAQ/介绍的自定义编辑
- 提交 GSC 需要站长自己做（我们没有他的 Search Console 权限），后台可提供 sitemap 复制入口

## 六、二轮：平台页内容加深（2026-10-29 深夜）

第一版 `/c/<平台>` 15 个页面内容雷同（只有名字和价格不同），属于「模板薄页面」。
新增 `server/src/utils/platformCopy.js`：每个平台一份**专属**内容
（一句话结论 + 4 项指标口径 + 4 条场景 + 3 条常见坑 + 选购建议 + 2 条专属问答）。

- 正文：766 字 → **1106~1554 字**；其中 1300 字以上是别页没有的
- FAQPage 结构化数据：4 问 → **6 问**
- 写作自律：不承诺「保证不掉/必上热门」；客户可见文案不出现行业内部词

**以后加平台**：在 `platformCopy.js` 里加一项即可，缺内容时落地页自动退回简短版
（不会报错、不会空白）。
