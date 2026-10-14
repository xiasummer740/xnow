# xnow 的 Nginx 层：生产实况存档

> 为什么这个目录存在：CLAUDE.md 里那条「**服务器上手工改过的配置必须同步回仓库**」。
> 生产的 nginx 配置**不在仓库里、也没有软链**，机器一挂就丢。
> 2026-10-14 整机演练时把它们逐字取回来存这里，作为**生产实况的记录**。

## 1. 文件对照

| 文件 | 监听 | `server_name` | 作用 |
|------|------|---------------|------|
| `production/xnow-http-redirect` | `:80` | `_`（**default_server**） | 全站 http → https 301 |
| `production/xnow-spa` | `127.0.0.1:8080` | `localhost` | 本机回环入口：`client/dist` 静态 + `/api/` → `127.0.0.1:3000`。**目前没有任何东西请求它**（access.log 零命中），疑似闲置，保留原样存档 |
| `production/xnow-spa-https` | `:443` | **`xnow.taikon.top`** | **对外正式入口**：CF 真实 IP 还原（22 条 `set_real_ip_from`）+ `client/dist` + `/api/` → `127.0.0.1:3000` |

⚠️ **`xnow-https` 故意没有收进来** —— 它**不属于本项目**，见下节。

## 2. 这台机器上跑着两个项目（重要）

2026-10-14 实测确认：

| | 本项目 | 同机的另一个项目 |
|---|---|---|
| 名字 | **XNOW PRO**（本仓库） | **XNOW 云控系统**（`xnow-flow`） |
| 对外域名 | `xnow.taikon.top` | `tk7188.com`，以及裸 IP `192.129.210.52` |
| 首页 title | `XNOW PRO - TikTok涨粉/IG涨粉/YouTube订阅 全网底价社媒增长平台` | `XNOW 云控系统` |
| 技术栈 | Node/Express + Vue，pm2 应用名 `xnow-backend`，端口 **3000** | Python `uvicorn`，端口 **8000**，代码在 `/opt/xnow-flow/`（`auth.py` / `Config.plist` / `crypto.py`，是个 iOS IPA 签名分发服务）|
| 进程管理 | pm2 | systemd 单元 `xnow-backend.service`（描述「XNOW Flow Backend」）**⚠️ 与 pm2 应用名撞车，排查时极易混淆** |
| nginx 配置 | `xnow-spa` + `xnow-spa-https` + `xnow-http-redirect` | **`xnow-https`** |

**所以 `xnow-https` 是另一个项目的配置，不该进本仓库。** 它当前是 `:443` 的 **default server**
（按 `sites-enabled/` 的字母序，它是第一个 `listen 443`），因此 `tk7188.com`、
裸 IP、以及任何未知 Host 打过来的 443 请求都落到它 → 转发到 8000。

### 🔴 由此暴露的灾备缺口（比 nginx 文件本身严重）

**`tk7188.com` 正是本项目同步数据的「上游」**（备份包里的 `configs.upstream_url` 就是它）。
而它和本项目**跑在同一台机器上**，却**不在本仓库、也不在本项目的备份包里**。后果：

> 照着 `install.sh` + 备份包把 xnow 恢复起来之后，xnow 会**正常启动**，
> 但它的上游（`tk7188.com` / 8000 端口那个服务）**不存在** → 服务同步会失败。

**换机前先问祥哥：上游那个项目（`/opt/xnow-flow`）谁来恢复？它的备份在哪？**
本仓库的灾备只覆盖 xnow 自己。

## 3. 证书的真实情况

`xnow-https` 和 `xnow-spa-https` 都用 `/etc/nginx/ssl/xnow.crt`，实测那是
**自签证书，`CN=192.129.210.52`，issuer 也是它自己**（有效期 2026-07-25 ~ 2036-07-22）。

自签证书能对外服务，是因为**站点挂在 Cloudflare 后面**：公开域名的 TLS 由 CF 终止，
CF 回源时才用这张自签证书 —— 所以 CF 的 SSL 模式必须是 **Full** 或 **Full (strict) 之外**
的「接受自签」档位。**如果有人把 CF 的 SSL 模式改成 Full (strict)，源站会立刻握手失败、全站 502。**

## 4. `install.sh` 生成的是另一套（不是这些文件）

`install.sh` 自己生成**单文件** `/etc/nginx/sites-available/xnow` + 软链，
并在 `conf.d/00-proxy-buffer.conf` 放 `proxy_max_temp_file_size 0`（治「大响应被静默腰斩」）。

下面是与生产实况的**逐项差异**（2026-10-14 逐条核对过）：

| 项 | 生产实况 | `install.sh` 生成 | 判断 |
|---|---|---|---|
| 文件布局 | `sites-enabled/` 下 3~4 个文件 | 单文件 + 软链 | 无功能差异 |
| 证书 | 自签、`CN=IP`，靠 CF 兜 | Let's Encrypt，失败降级自签 `CN=$DOMAIN` | **install.sh 更好**（真证书），且同样兼容 CF |
| `:80` | `default_server` + 纯 301 | 非 default + 带 `/.well-known/acme-challenge/` 的 301 | **install.sh 更好**：它需要一个能签发证书的验证路径；生产那份没这路径，所以生产只能一直用自签证书 |
| `try_files` | `$uri $uri.html $uri/ /index.html` | 原本漏了 `$uri.html`，**2026-10-14 已补上** | 见 §5，这是真回归 |
| `/api/` 代理 | `proxy_pass http://127.0.0.1:3000` | `.../api/` + 额外带 `Upgrade`/`Connection` 头 | **install.sh 更好**（支持 WebSocket） |
| CF 真实 IP | 22 条 `set_real_ip_from` | 同样 22 条（提交 `353315bd` 补回） | 一致 |
| `/assets/` 长缓存、HTML `no-cache` | 有 | 有（注释更全） | 一致 |
| ACME 全局验证（`conf.d/00-acme-challenge.conf`） | **没有** | 有（`alias /var/www/acme-challenge/`） | 这是**共享设施**，别删 |

**结论：`install.sh` 生成的配置在功能上已经等价或更好，所以没有改成「逐字复制生产那套」** ——
照抄反而会丢掉 ACME 验证路径、把证书降级成自签、并可能影响其它项目的证书签发。
真正的缺口只有一个（`$uri.html`），已补。

## 5. `$uri.html` 为什么不能省（实测证据）

`client/public/` 里除 `index.html` 外还有 `404.html` / `finance.html` / `vpn.html` / `en.html`
和 Google 站点验证文件；Vite 会把 `public/*` 原样拷进 `dist/`。靠 `try_files` 里的
**`$uri.html`** 才能让 `/finance`、`/vpn`、`/en` 命中各自的页面。

带 Host 直连生产 443 实测（2026-10-14）：

```
/finance       HTTP 200  <title>XNOW 财务大盘预览</title>
/vpn           HTTP 200  <title>XNOW 全球安全节点 - 高速稳定线路 · 多协议多端接入</title>
/en            HTTP 200  <title>Buy TikTok Followers &amp; Social Media Growth - XNOW PRO SMM Panel</title>
/404.html      HTTP 200  <title>404 - 页面未找到 | XNOW</title>
```

少了 `$uri.html`，这些路径会**静默塌成 SPA 首页** —— HTTP 仍然是 200，只是内容全错。
`install.sh` 原来正好漏了这个参数（换机即回归），已修。

## 6. 顺带发现：3 个只存在于服务器 `dist/` 的文件

生产 `client/dist/` 里还有 3 个文件**当时不在仓库、也不在 `client/public/`**：

| 文件 | 作用 |
|---|---|
| `vpn.html` | `/vpn` 页面（`XNOW 全球安全节点`）|
| `en.html` | `/en` 英文落地页 |
| `google9e165c63d6e32363.html` | Google Search Console 站点验证 |

因为 `dist/` 被 gitignore，**换机就会丢这 3 个页面和 Google 验证**。
**2026-10-14 已把它们放进 `client/public/`**，从此由构建自动产出。

## 7. 换机时该怎么做（操作口径）

1. 用仓库里现在的 `install.sh` + 备份包恢复 xnow（它生成的 nginx 配置已够用）。
2. **另外安排上游项目（`/opt/xnow-flow`，`tk7188.com`）的恢复** —— 不在本仓库覆盖范围内。
3. 如果那台机器还要继续跑上游，把它自己的 nginx 文件（`xnow-https`）也单独存一份到**那个项目的仓库**里。
4. 确认 Cloudflare 的 SSL 模式仍能接受源站证书（见 §3）。
