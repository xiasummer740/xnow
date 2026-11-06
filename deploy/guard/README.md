# 多项目共存作业规约（同机 + 同一 AI 多会话）

> 这份文件存在的唯一原因：**2026-11-03 全站瘫了 8 小时**。
> 根因不是代码 —— 是另一个 AI 会话在同一台机器上，把 `taikon.top` 这个 Cloudflare zone 的
> SSL 模式从 **Full** 改成了 **Flexible**。它改的是「zone 级全局开关」，动一下，
> 挂在同一个 zone 下面的**所有子域名一起坏**。
> 那台机器上还跑着 `xnow-flow`（`tk7188.com`，uvicorn:8000）、`xnow-beta`(:3001) —— 它们也在同一个 zone 里。

## 一、先说清楚：这台机器上有什么在共用

| 共享物 | 谁在用 | 出事后果 |
|---|---|---|
| `/etc/nginx/conf.d/` | **全机所有站点**（http 级，一改全改） | nginx 起不来 → 全站 502 |
| `/etc/nginx/sites-enabled/` | xnow 主站 + 分站 + beta + `tk7188.com` | Host 匹配错 → 串站/串库 |
| `443 default_server` | 只有一个，全机兜底 | 改错 → 陌生域名落到别人家 |
| pm2（root 的） | xnow-backend / xnow-beta / 别的项目 | 误 restart → 别人掉线 |
| MySQL 单实例 | `xnow_db` / `xnow_beta` / `rh89test` | 误 DDL/DML → 别人数据没了 |
| Cloudflare zone `taikon.top` | 主站 + 全部分站 + beta + code | 改 zone 级设置 → 全 zone 一起坏 |
| 物理资源 | 2.4G 内存 / 44G 磁盘 | OOM → 随机杀进程 |

## 二、红线（任何会话、任何人，动手前先看这一条）

```
🔴 Cloudflare 的 SSL 模式，taikon.top 这个 zone 只允许 Full。
   · 改 Full(strict) → 源站自签证书不被接受 → 立刻全站 502
   · 改 Flexible     → :80 301 ↔ https 无限跳转 → 全站打不开（11-03 就是这么瘫的）
   · 需要动它之前，先在浏览器开一次主站 + 一个分站 + tk7188.com，改完再开一次

🔴 /etc/nginx/conf.d/ 是 http 级共享目录。
   新增文件必须带项目前缀（本项目：00-gzip.conf 是全站通用的压缩，可以；
   任何 xnow 专属的东西一律写进 /etc/nginx/snippets/ 再由自己的 vhost include）。

🔴 不要在 sites-enabled 里新增 default_server。全机只允许一个 443 default_server，
   它现在在 xnow-catchall 里，负责把「未知域名」兜成中性 404。

🔴 服务器上手工改的配置，必须同一天同步回仓库模板（install.sh / deploy/nginx/）。
   否则下次重装退回旧样 —— 这是本项目踩过两次的坑。
```

## 三、日常作业流程（每个 AI 会话都照这个走）

```bash
# 1. 开工前：确认要改的东西在本项目范围内
bash deploy/guard/scope-check.sh

# 2. 改完、部署前：先备份（服务器上）
ssh xnow-vps 'TS=$(date +%Y%m%d-%H%M%S); mkdir -p /root/xnow-rollback; \
  cd /var/www/xnow && tar czf /root/xnow-rollback/server-$TS.tar.gz server/src; \
  tar czf /root/xnow-rollback/client-$TS.tar.gz client/dist; \
  tar czf /root/xnow-rollback/nginx-$TS.tar.gz /etc/nginx/sites-enabled /etc/nginx/snippets /etc/nginx/conf.d'

# 3. 部署（scp + pm2 restart）

# 4. 部署后：nginx 语法 + 全机回归（包括同机其它项目的域名）
ssh xnow-vps 'nginx -t'
bash deploy/guard/post-deploy-verify.sh
```

`post-deploy-verify.sh` 里刻意列了 `tk7188.com` 和 `code.taikon.top` ——
**只看自己项目 200 是不够的**。11-03 改 nginx 的 :80 判据时，受影响最大的恰恰是邻居项目的 Host 匹配。

## 四、同一个 AI 开多个对话时，怎么不互相踩

### 4.1 会话开场就说清楚作用域

给每个会话的第一句话里带上项目名和目录，例如：

> 「这个会话只碰 `F:\summer\vs-code\xnow`。同机还有 `xnow-flow`（tk7188.com）和 `xnow-beta`，它们的目录、vhost、pm2 进程、数据库一律不改；需要改的时候先告诉我。」

AI 不会自动知道旁边有别的项目 —— 它只会看到你给的路径。**你不说，它就当整台机器都是你的。**

### 4.2 一个会话 = 一个目录 = 一个 git 仓库

| 做法 | 好处 |
|---|---|
| 每个项目独立目录 + 独立 `.git` | 会话的 `git status` 只显示自己的改动，越界立刻可见 |
| 每个会话 `cd` 到自己项目根 | 相对路径不会飘到邻居项目去 |
| 不要让两个会话同时改同一个仓库 | 最后写入者覆盖前一个，且都不知道 |

### 4.3 把「共享层」从项目里摘出去

真正危险的从来不是项目代码（各在各的目录），而是**共享层**：

- **nginx**：项目自己的 vhost 文件命名固定为 `xnow-<用途>`，谁的文件谁改；
  `conf.d/` 只放全站通用项；改完必须 `nginx -t`。
- **pm2**：用 `pm2 start --name xnow-backend` 这类唯一名字，
  **永远不要 `pm2 restart all` / `pm2 delete all`** —— 那会把邻居项目一起重启。
  只重启自己：`pm2 restart xnow-backend`。
- **MySQL**：一个项目一个库一个账号，账号只 GRANT 自己的库：

  ```sql
  CREATE USER 'xnow'@'localhost' IDENTIFIED BY '...';
  GRANT ALL PRIVILEGES ON xnow_db.* TO 'xnow'@'localhost';   -- 只给自己这个库
  ```

  这样即便某个会话写错库名，也会直接报权限错误，而不是把邻居的表删了。
- **Cloudflare**：zone 级设置（SSL/TLS、Speed、Caching、Page Rules、Transform Rules）
  = **全 zone 生效**。要按域名生效只能用 **Configuration Rules**（可以指定 hostname 条件）。
  任何 zone 级改动，先在浏览器验三个域名：主站、一个分站、邻居项目。

### 4.4 给 AI 一个「不许碰」的清单

比说「小心点」有用一百倍的是**具体的路径清单**。本项目在
`deploy/guard/scope-check.sh` 的 `FORBIDDEN_PATTERNS` 里写死了：

```
/etc/nginx/nginx.conf          ← 全机主配置
/etc/nginx/conf.d/             ← http 级共享
/etc/mysql/                    ← 数据库主配置
/etc/cloudflared/              ← 隧道配置（同机 cloudflared 在跑）
```

会话里只要跑一次 `scope-check.sh`，越界立刻显形，不用靠人盯。

### 4.5 谁改的、什么时候改的，要留痕

服务器上所有「手工改」都该有一条对应记录：

```bash
# 改之前
cp /etc/nginx/sites-enabled/xnow-spa-https /var/backups/xnow-spa-https.bak-$(date +%Y%m%d-%H%M%S)
# 改之后写一行到运维日志
echo "$(date -Is) 改 xnow-spa-https: 去掉 *.xnow.taikon.top 通配（消除 443 重名冲突）" >> /var/log/xnow-ops.log
```

出问题时 `grep` 这个日志，比翻两个 AI 的对话记录快得多。

## 五、已经落地的东西

| 文件 | 作用 |
|---|---|
| `deploy/guard/scope-check.sh` | 检查改动是否越界 / 是否落在禁区 |
| `deploy/guard/post-deploy-verify.sh` | 部署后全机回归，**含邻居项目域名** |
| `deploy/nginx/conf.d/00-gzip.conf` | 全站通用压缩（源站→CF 省 92% 流量） |
| `deploy/nginx/snippets/xnow-flex-80.conf` | CF 被切成 Flexible 时的兜底（判据用 `CF-Connecting-IP`） |
| `/usr/local/bin/xnow-db-backup.sh` + cron 04:10 | 每日 mysqldump，留 14 天，`/var/backups/xnow-db/` |

## 六、排障顺序（不要再从「代码是不是坏了」开始）

```
① 用浏览器开一次，F12 看那条请求的 状态码
   ├─ 301/302  → 先看 Cloudflare SSL 模式 + 源站 :80 的 vhost（不是应用代码）
   ├─ 401      → token / 登录态问题
   ├─ 5xx      → pm2 logs 看后端异常
   └─ (failed) → 连接层：CF 规则 / 证书 / 大响应超时
② curl 源站直连（绕过 CF）：curl -k https://127.0.0.1/api/xxx -H "Host: 域名"
③ 只有①正常②异常才是应用问题；两者都异常基本是 nginx / CF / 网络
```
