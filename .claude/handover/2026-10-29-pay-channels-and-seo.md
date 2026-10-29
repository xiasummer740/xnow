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

## 三、⚠️ 下一步卡在祥哥手上

Cloudflare → 域名 `taikon.top` → **Security → Settings** → 筛 **Bot traffic** →
**Configure AI bot policies** → 关掉 **Enable Bot Preference Sync** → Save。

原因：CF 会在我们 robots.txt 前面注入一段托管内容，里面有 `User-agent: GPTBot / Disallow: /`。
同一个 UA 两段冲突规则，AI 爬虫宁可当成禁止 —— 关掉后只剩我们自己那份（放行检索型 AI）。

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
