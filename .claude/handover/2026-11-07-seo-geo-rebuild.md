# SEO / GEO 全链路重做（2026-11-07）

> 一句话：**页面 16 → 71，技术债清零，剩下的短板全在站外。**
> 落地手册（含外链清单、衡量指标）在 `deploy/seo/GEO-PLAYBOOK.md`。

---

## 一、起因与实测基线

祥哥问「SEO GEO 做得怎么样，推广效果要做到顶级」。先实测量了一遍，结论分层：

| 层 | 分数 | 依据 |
|---|---|---|
| 技术基建 | 85 | robots 分级授权、AI 爬虫全 200、平台页 8642 字符 + 6 个 h2 问答结构、5 块 JSON-LD、TTFB 53–67ms、gzip 65% |
| 内容广度 | 40 | 只有 16 个可索引页面 |
| 外部信号 | 10 | Bing 搜「XNOW PRO 社媒增长」命中 **0** |

**技术不是瓶颈，内容和外链才是。**

---

## 二、三个「让优化白费」的问题（本次修的就是这些）

### 🔴 1. 软 404 泛滥

```
/no-such-page               → 200  (3441 字节, title=首页)
/blog /guide /faq /docs     → 全部 200（都是假页面）
/random/garbage/path        → 200
```

只有 `/c/*` 和 `/api/*` 有真 404。根因在 `xnow-spa-https`：

```nginx
location / {
    try_files $uri $uri.html $uri/ /index.html;   # 最后那个兜底
}
```

搜索引擎把抓取预算浪费在空页面上并判 soft 404；AI 引擎抓 `/blog` 拿到首页 HTML。

### 🔴 2. `/llms.txt` 是假 200

同样原因 —— 拿到 3441 字节 HTML，AI 解析直接失败。**这个功能写了等于没写。**

### 🔴 3. `/en` 完全没进索引体系

```
sitemap 含 /en: 0 条      sitemap hreflang 注解: 0 处
首页 hreflang: 0 条       （/en 自己有 3 条，但单向不通）
```

中英文两个版本互不知道对方存在，英文流量等于零。

附带：`Organization` 结构化数据只有 `name/url/description`，
缺 `sameAs`/`logo`/`contactPoint` —— AI 判断品牌可信度时看这些。

---

## 三、阶段一：技术债（已上线）

| 改动 | 做法 |
|---|---|
| 软 404 → 真 404 | `location /` 去掉 `/index.html` 兜底改 `=404`；新增 SPA 白名单正则（**来源 `client/src/router/index.ts`**）；`error_page 404 @xnow_404` → 后端 `/__404` 渲染品牌 404 页（HTTP 保持 404） |
| llms.txt 落地 | 后端生成 `/llms.txt`（摘要 + 平台页链接 + 关键事实 + 联系）与 `/llms-full.txt`（逐条服务清单） |
| 多语言打通 | sitemap 加 `/en` + `xhtml:link` 三向 hreflang；首页补 zh-CN/en/x-default 三条 |
| 实体信号 | `Organization` 补 `alternateName`/`logo`/`sameAs`(TG)/`contactPoint`；新增 `brandMeta` 从 Config 读 `boost_tg`/`boost_tg_url`/`boost_wechat_id` |

### ⚠️ 必记的坑

**named location 里的 `proxy_pass` 不允许带 URI**：

```nginx
location @xnow_404 {
    proxy_pass http://127.0.0.1:3000/__404;   # ❌ nginx: [emerg] cannot have URI part
}
```

正确写法：

```nginx
location @xnow_404 {
    rewrite ^ /__404 break;                    # ✅ 先改写 URI
    proxy_pass http://127.0.0.1:3000;
}
```

第一次改完 `nginx -t` 直接报错，脚本自带回滚，**生产零改动**。

另外 `/llms.txt` 一开始仍 404 —— 因为 nginx 的转发白名单正则只列了
`robots.txt|sitemap.xml|sitemap.xsl`，`llms.txt` 走 `location /` 被当静态文件。
**新增服务端路由时，别忘了同步 nginx 转发白名单。**

---

## 四、阶段二：内容扩张（页面 16 → 71）

### 4.1 类型子页 `/c/:slug/:type`

客户真实搜的是「TikTok 涨粉」这种「平台 + 动作」组合词，不是「TikTok 增长服务」。

- 新增 `server/src/utils/typeCopy.js`：8 种类型（粉丝/点赞/播放/评论/直播/分享/订阅/流量）
  各写 `intro` / `metrics` / `scenes` / `pitfalls` / `choose` / `faq`
- 路由只给「`TYPE_COPY` 里有内容 **且档位 ≥3**」的类型出页面
  —— 「其他」这类杂类做成页面就是给搜索引擎喂空页
- 平台页加内链「按XX服务类型查看」（内链结构影响抓取深度和权重）
- 结构化数据：三级 BreadcrumbList + `Service` + `Offer`（含 `UnitPriceSpecification` 每 1000 个）+ FAQPage

### 4.2 知识库 `/guide`

- 新增 `server/src/utils/guideCopy.js`：10 篇实证型文章
- 选题全部来自真实客户问题（不是编的）：
  链接格式 / 掉粉 / 速度与价格 / 安全性 / 新号起步 / 重复下单 /
  档位选择 / 播放与互动 / 直播间数据 / 怎么验证是否执行
- 每篇带 `Article` + `BreadcrumbList` + `FAQPage`

**写文案的两条硬标准**（GEO 能不能被引用就看这个）：

1. **开头 80 字给结论** —— AI 摘录的就是这一段
2. **给可验证的判断标准**（数字、比例、时间），不写「最好/第一」

---

## 五、阶段三：外部信号

- **IndexNow 主动提交**：主站 71 地址 + 分站 70 地址，均 HTTP 200 接受
  （cron 每天 3:20 也跑 `deploy/sites/indexnow-daily.sh`）
- 新增 `deploy/seo/GEO-PLAYBOOK.md`：品牌一致性 / 行业目录收录 / 内容分发 / 品牌词占位 /
  每周衡量指标 / 红线

**这一层是当前最大的短板**：Bing 搜品牌词命中 0，而 `XNow` 在美国已有同名公司实体
（PitchBook、Crunchbase 有档案）会挤压品牌词结果。对策是全平台统一用全称 **`XNOW PRO`**。

---

## 六、模板同步（CLAUDE.md 硬性要求）

线上改的 nginx 必须同步回三处，否则重装/新建分站又退回旧样：

| 文件 | 内容 |
|---|---|
| `install.sh` | nginx heredoc 模板（白名单 + 真 404 + 404 页代理） |
| `deploy/nginx/production/xnow-spa-https` | 从线上拉回来的存档（7.3 KB） |
| `server/src/utils/siteDomain.js` | 分站 vhost 生成器（同样三样 + llms/guide 转发） |

---

## 七、验收（全部实测，含邻居项目）

```
页面总数：主站 71 条 sitemap / 分站 70 条

核心 9 个路径 × 普通/GPTBot/ClaudeBot：
  /  /en  /c/tiktok  /c/tiktok/fans  /guide  /guide/link-format
  /llms.txt  /robots.txt  /sitemap.xml     → 全 200

13 个 SPA 路由（order history admin boost login vip recharge
affiliate clients showcase mass-order api-doc my-site）→ 全 200，0 异常

真 404：/blog /faq /nonexistent /guide/nope /c/tiktok/nope → 全 404
分站：llms.txt 200 · /guide 200 · 未知路径 404

全机回归：tk7188.com / code.taikon.top 均 200 ✅
```

---

## 八、下次可以继续做（不用等外部条件）

1. **类型子页扩平台**：现在只覆盖有硬内容的 8 种类型，Spotify / Twitch / Discord
   等平台补写 `typeCopy` 后再放开
2. **知识库继续加**：从客服真实问询里提炼，每加一篇 = +1 个长尾入口
3. **价格对比页** `/price`：拿「smm panel price」这类词
4. **服务详情页** `/c/:slug/:type/:serviceId`：2805 个服务每个一页 ——
   但内容不能只是参数罗列，否则判低质量页面（这是暂时没做的原因）

## 九、需要祥哥

1. **GSC 手动提交**：新页面走 sitemap 只是「告诉它有东西」，抓不抓由它决定；
   IndexNow 只对 Bing/Yandex 有效。Google 那边要进 Search Console 点「请求编入索引」
2. **补 sameAs**：Twitter / YouTube / Instagram 账号拿到后告诉我，加进 `brandMeta`
3. **外链开始做**：按 `deploy/seo/GEO-PLAYBOOK.md` 第三节，行业目录 + 内容分发
