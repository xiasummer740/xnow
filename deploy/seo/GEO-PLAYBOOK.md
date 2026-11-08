# GEO / SEO 落地手册（2026-11-07，2026-11-08 两轮补充）

> 这是「做到顶级」剩下的那部分 —— **本站代码里能做的已经做完了**，剩下的全是站外动作。
> 阶段一、二已完成并上线（页面 16 → 71），本文件记录：现状基线、已做的技术改动、
> 以及只有人工能做的外链/品牌动作清单。
>
> 🔄 **2026-11-08 第一轮复盘**：祥哥问「全球用户能不能通过周边关键词很容易搜到本站」，
> 实测后补了一处站内短板（`/en` 空壳），见 §二·8。
>
> 🔄 **2026-11-08 第二轮（自动提交 + 多语种）**：语种扩到 **7 个**（zh/en/id/pt/vi/ar/ru），
> 页面 **174 条**；打通 **Google Indexing API**（祥哥授权 AI 浏览器后代走完全部授权流程），
> 现在 **IndexNow 和 Google 两条通道都自动**，见 §二·9–11。
> 品牌词仍 0 命中，**剩余瓶颈全在站外**（§三）。

---

## 一、现状基线（2026-11-08 第二轮实测）

| 项 | 数值 | 评价 |
|---|---|---|
| 可索引页面 | **71**（首页 + /en + 15 平台页 + 44 类型子页 + 知识库 11） | 原 16 |
| sitemap | 72 条（复核时 +1 为 /vpn），含 `/en` 与 `xhtml:link` hreflang 注解 | ✅ |
| robots.txt | AI 爬虫逐个放行 + `Content-Signal: search=yes,ai-train=no,use=reference` | ✅ 分级授权 |
| llms.txt / llms-full.txt | 真实 Markdown，6.2KB / 6.9KB | ✅ 原为假 200 |
| AI 爬虫实测 | GPTBot / OAI-SearchBot / PerplexityBot / ClaudeBot 全部 200 | ✅ |
| 结构化数据 | Organization（含 sameAs/logo/contactPoint）+ WebSite + BreadcrumbList + FAQPage + Service + Offer + Article + ItemList | ✅ 8 类 |
| 软 404 | 已消除（任意未知路径返回真 404 + 品牌页） | ✅ 原为 200+首页 |
| 性能 | TTFB 53–67ms，gzip 65% | ✅ |
| IndexNow | 71 地址已提交，HTTP 200 接受 | ✅ |
| **英文首页 `/en` 正文** | 复盘时实测仅 599 字节、0 个 h1 —— 已修为 5166 字符 + 1 h1 + 3 h2 | ✅ 2026-11-08 补 |
| **品牌词可见度** | 真实搜索「XNOW PRO」返回 X-Nova 插件 / X Pro 智能家居 / EEES XNow Pro 安卓应用 / 美国 xnow.com，**本站 0 命中** | ❌ **最大短板** |
| **外链 / 第三方提及** | 0 | ❌ **最大短板** |

**结论**：技术层已接近满分，天花板在「页面数量 × 外部信号」。页面数量这轮已从 16 推到 71，
外部信号从 0 开始 —— 这是接下来唯一真正决定成败的地方。

> 2026-11-08 用真实搜索复核，品牌词 0 命中被再次证实，且**被同名实体挤压**：
> 美国已有 `xnow.com`（urlscan 有档案）、Google Play 有 `EEES XNow Pro`、
> Chrome 商店有 `X-Nova` 插件。对策见 §3.4（永远用全称 `XNOW PRO`）。

---

## 二、已做的技术改动（都已上线，勿重复）

### 1. 软 404 → 真 404
- `xnow-spa-https` vhost：`location /` 去掉 `/index.html` 兜底，改 `=404`
- 新增 SPA 路由白名单正则（来源 `client/src/router/index.ts`）
- `error_page 404 @xnow_404` → 后端 `/__404` 渲染品牌 404 页
- ⚠️ 坑：named location 里的 `proxy_pass` **不能带 URI**，必须用 `rewrite ^ /__404 break;`

### 2. llms.txt 落地
- 后端 `/llms.txt`（摘要 + 平台页链接 + 关键事实 + 联系）
- `/llms-full.txt`（逐条服务清单，按平台分组）
- nginx 正则转发白名单要加 `llms\.txt|llms-full\.txt`

### 3. 多语言打通
- sitemap 加 `/en`，并给首页与 `/en` 加 `xhtml:link` 三向 hreflang
- 首页 `<link rel="alternate">` 补 zh-CN / en / x-default

### 4. 实体信号
- Organization 补 `alternateName` / `logo` / `sameAs`（TG）/ `contactPoint`
- `brandMeta` 从 Config 读 `boost_tg` / `boost_tg_url` / `boost_wechat_id`

### 5. 类型子页（页面数主要增量）
- 路由 `/c/:slug/:type`（如 `/c/tiktok/fans`）
- 文案库 `server/src/utils/typeCopy.js`：8 种类型 × (intro/metrics/scenes/pitfalls/choose/faq)
- 只给「有硬内容且档位 ≥3」的类型出页面，「其他」这类杂类不做
- 平台页加子页内链（`按XX服务类型查看`）

### 6. 知识库
- `/guide` 列表 + `/guide/:slug` 详情
- 文案库 `server/src/utils/guideCopy.js`：10 篇实证型文章
- 每篇带 Article + BreadcrumbList + FAQPage 结构化数据

### 7. 模板同步（易漏）
- `install.sh` 的 nginx heredoc
- `deploy/nginx/production/xnow-spa-https`（线上存档）
- `server/src/utils/siteDomain.js` 的分站 vhost 生成器
- 三处都改了白名单 + 真 404 + llms/guide 转发

### 8. `/en` 从空壳改为服务端渲染（2026-11-08 复盘补做）

**实测发现**：`/en` 的 `<head>` 很完整（title / description / canonical /
三向 hreflang / og / SoftwareApplication JSON-LD），但**正文只有空 `<div id="app">`**，
去标签后约 599 字节、**0 个 h1/h2**。搜索引擎抓到的是「标题漂亮、内容全空」的壳。
中文首页 `/` 有 3556 字节正文，因为它走 `location = /` → 后端 SSR；
而 `/en` 落到通用 `location /` → `try_files $uri.html` → 静态 `en.html`，
**根本没走到后端**。

改动三处：
- `server/src/routes/seo.js`：新增 `GET /en` SSR，复用同一份实时目录数据，
  输出英文正文（平台起价表 / 四步下单 / 5 条 FAQ），
  SoftwareApplication + FAQPage 双 JSON-LD，`og:locale=en_US`。
  分站 `return next()` 不生成（避免串站）。
- nginx 主站两处模板（`install.sh`、`deploy/nginx/production/xnow-spa-https`）
  加 `location = /en` → `proxy_pass :3000/en`，后端挂了回落静态 `en.html`。
  **`siteDomain.js` 是分站生成器，不动**（实测分站 `/en` 返回 404，未串主站）。
- `llms.txt` 里 `/en` 那行从「English version」改成能体现实质内容的描述。

**结果**：8526 字节 / 正文 5166 字符 / 1 h1 / 3 h2 / 2 块 JSON-LD。
中文首页、6 类页面、4 个分站/邻居项目全 200，sitemap 仍 72 条，`/en` 仍在其中。

> ⚠️ 教训：**prerender 只做 `<head>` 不算做完 SEO**。
> 加了 hreflang / sitemap / meta 之后必须实测「去标签后的正文字节数」，
> 否则英文页会长期以空壳形态进索引，且从 HTTP 200 上完全看不出来。

### 9. 多语种落地页扩到 7 个（2026-11-08 第二轮）

语种：`zh / en / id / pt / vi / ar / ru`，每个语种 **首页 + 价格表 + 15 个平台页**。

| 语种 | 路径 | 市场理由 |
|---|---|---|
| 印尼 | `/id` | 东南亚最大增量，TikTok 用户量全球前列，本地语言几乎无同质站 |
| 巴西葡语 | `/pt` | 拉美最大市场 |
| 越南 | `/vi` | 东南亚第二大增量 |
| 阿拉伯 | `/ar` | 中东购买力高，同行普遍不做阿语 |
| 俄语 | `/ru` | 独联体，TikTok/IG 使用量大 |

实现要点：
- 文案集中在 `server/src/utils/langCopy.js`，渲染只认 key，**不再往 seo.js 复制第三第四份硬编码**
- RTL：阿拉伯语 `<html lang="ar" dir="rtl">`；CSS 方向性样式改用逻辑属性
  （`margin-inline-start` / `text-align:start`），自动镜像，不用为 RTL 单独写一份
- sitemap 用 `LANG_ORDER` 动态生成，加语种不用改索引逻辑
- 踩坑：RTL 的 `dir` 第一版没生效 —— 原用「往 lang 前面插 dir」的正则，
  但 `index.html` 是 `<html lang="zh-CN">` 无其它属性，正则匹配不到，`dir` 静默丢失。
  必须**替换整个 `<html>` 开标签**。

### 10. 价格表页 `/price`（拿高购买意图商用词）

`smm panel price list` / `cheapest smm panel` 这类词购买意图强，而**多数同行不公开价格**
（要注册才看）。本站本来按每 1000 个明码标价，摊开就是天然优势。
数据全部来自实时目录，价格变了自动跟随。7 个语种各一版。
带 `ItemList` + `FAQPage` 双 JSON-LD —— AI 被问「哪家便宜」时有可直接摘录的价目表。

### 11. 🔑 两条主动提交通道全部自动化（2026-11-08 第二轮核心）

| 通道 | 覆盖 | 状态 |
|---|---|---|
| **IndexNow** | Bing / Yandex / Seznam / Naver | ✅ 174 条已推，cron 每天 3:20 |
| **Google Indexing API** | Google | ✅ 174 条已推，cron 每天 4:00 |

**为什么两条都要**：ChatGPT / Copilot 检索用的是 Bing 索引；Google 是搜索主战场。缺一不可。

Google 这条原来是卡点 —— 需要 Google Cloud 项目 + 服务账号 + GSC 授权，
全是网页操作。2026-11-08 祥哥授权后用桌面 **AI 浏览器（CDP 9222）** 代走完全部流程：

1. 建项目 `xnow-seo`（`abstract-water-514113-h4`），启用 Web Search Indexing API
2. 建服务账号 `xnow-indexer@abstract-water-514113-h4.iam.gserviceaccount.com`，下载 JSON 私钥
3. GSC 里加成「拥有者」（**发现：这个 Google 账号此前从未验证过本站**，
   加站点时提示「已自动完成所有权验证」——之前别的账号留下的验证文件还在）
4. 提交 `sitemap.xml` → Google 显示**已发现 174 个网页**
5. 全量提交 174 条 → **成功 174 / 失败 0**

脚本 `scripts/gsc-indexing.mjs`：**零依赖** —— 用 Node 内置 `crypto` 签 RS256 JWT 换
access_token，不装 `google-auth`（生产机是 Python 3.8 + 系统 pip，装了要污染系统包或上 venv）。

**配额**：Indexing API 默认 **200 条/天**，当前 sitemap 174 条刚好够一轮。
超了返回 429，脚本如实记录不重试到死。别连跑两次（第一次验证时就撞过）。

**安全**：密钥 `chmod 600` 放 `server/` 下（不在 web 根，直接访问 404）；
`.gitignore` 补 `.gsc-service-account.json` 与 `*service-account*.json` ——
仓库是 PUBLIC，私钥提交等于公开，别人能拿它往你的 GSC 提交垃圾 URL。



---

## 三、阶段三：外部信号（只有人工能做）

> 这一层的权重比站内优化更高。AI 引擎判断「这个品牌可不可信」，
> 主要看**别人怎么说它**，而不是它自己怎么介绍自己。

### 3.1 品牌一致性（优先做，成本最低）

目标：让「XNOW PRO」在所有平台上是同一个实体，且互相指向。

| 动作 | 具体做法 |
|---|---|
| 统一简介 | 所有社交账号用同一句简介（与 `og:description` 一致），不要一个说「涨粉平台」一个说「SMM panel」 |
| 互相关联 | 每个账号的简介里放官网；官网 `sameAs` 里加回每个账号（已加 TG，其余补上） |
| 头像统一 | 同一张 logo，尺寸按平台要求裁切 |
| 用户名一致 | 尽量全平台都用 `xnowpro` / `xnow_fans` 这类，别一个平台一个名 |

需要补进 `sameAs` 的（拿到账号后告诉我，我加进 `seo.js` 的 `brandMeta`）：
- X（Twitter）、YouTube 频道、Instagram、Telegram 频道（已有）

### 3.2 行业目录收录（拿外链最快的方式）

SMM / 社媒增长行业有固定的目录站生态，同行主要靠这个拿初始外链。
操作方式统一：注册 → 提交站点信息（名称、网址、简介、价格起价）→ 等审核。

关键词搜索方向（自己找当前有效目录，别用固定名单，会过期）：
```
"submit your smm panel" directory
"smm panel list" add site
"smm panel directory" submit
```

提交时的统一文案（保持一致性，不要每个站写得不一样）：

> **XNOW PRO** — Social media growth panel. TikTok, Instagram, YouTube, Telegram,
> Facebook, X (Twitter), Spotify and more. Pay-per-1000 pricing from $0.004,
> automatic delivery, no account password required.

### 3.3 内容分发（GEO 权重最高）

AI 引用的是「可以摘录的答案」。把知识库里那 10 篇改写成问答形式，分发到：

| 平台 | 适合形式 | 注意 |
|---|---|---|
| 知乎 | 回答「买粉丝会不会掉」「TikTok 怎么涨粉」类问题 | 别直接贴广告，先答问题，末尾自然带一句 |
| Reddit（r/NewTubers, r/InstagramMarketing 等） | 经验分享贴 | 硬广会被删，只讲方法和坑 |
| Medium / 独立博客 | 长文（英文） | 对英文 SEO 和 AI 收录都有用 |
| Quora（英文） | 回答英文问题 | AI 引用英文源的比例更高 |

**每篇的固定结构**（照知识库的写法）：
1. 开头 80 字给结论（AI 摘录的就是这段）
2. 给可验证的判断标准（数字、比例、时间）
3. 承认边界（哪些做不到）

### 3.4 品牌词占位（防止被同名公司压住）

`XNow` 在美国已有一家公司（PitchBook / Crunchbase 有档案），会挤压品牌词结果。
对策：**永远用全称 `XNOW PRO`**（带 PRO），并在所有平台保持这个写法，
让搜索引擎把 `XNOW PRO` 识别为独立实体。

---

## 四、效果衡量（每周看一次）

| 指标 | 在哪看 | 达标线（3 个月内） |
|---|---|---|
| 收录页面数 | Google Search Console → 覆盖率 | 71 页中 ≥50 被收录 |
| 索引页数 | Bing Webmaster（IndexNow 提交后快） | ≥60 |
| 品牌词排名 | 搜「XNOW PRO」 | 首页第一屏 |
| 长尾词 | GSC → 效果 → 查询 | 出现「tiktok 涨粉」「youtube 刷播放」类词 |
| AI 引用 | 问 ChatGPT/Perplexity「推荐 smm panel」 | 出现本站 |

⚠️ GSC 需要祥哥的 Google 账号，且**新页面提交后要主动点「请求编入索引」**
（sitemap 只是告诉它"有东西"，抓不抓由它决定；IndexNow 只对 Bing/Yandex 有效）。

---

## 五、随时可以继续做的（不用等外部条件）

1. **类型子页扩平台**：现在只覆盖有硬内容的 8 种类型，其余平台（Spotify / Twitch / Discord 等）
   可以补写 `typeCopy` 后再放开
2. **知识库继续加**：从客服真实问询里提炼新问题，每加一篇就是 +1 个长尾入口
3. **价格对比页**：`/price` 类页面（各平台起价一览），拿「smm panel price」这类词
4. **服务详情页**：`/c/:slug/:type/:serviceId`，2805 个服务每个一页 —— 但要注意内容质量，
   不能只是参数罗列，否则会被判低质量页面（这也是我暂时没做的原因）

---

## 六、红线（写内容时反复检查）

- 客户可见文案**绝不出现**「上游 / 供应商 / 渠道商 / 进货」
- 不写「最好 / 第一 / 顶级」这类无法验证的自夸（AI 不引用，搜索引擎也降权）
- 不承诺具体掉粉率 / 具体时间（不同档位差异大，承诺了就是虚假宣传）
- 分站页面不出现主站品牌名（`site.html` 的中性入口就是为此存在）
