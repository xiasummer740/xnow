# nginx 临时缓冲目录属主错位 → 全站大响应被腰斩

> 2026-09-21 · 祥哥报障驱动（「打开书签，服务不能正常加载」）· 已修复并实测验证

## 一句话

`/var/lib/nginx/proxy` 属主是 `nobody:root 0700`，而 nginx worker 跑 `www-data` ——
nginx 落盘缓冲失败后**读到一半放弃上游**，把半截响应当成功发出去，
前端拿到残缺 JSON 报了句极具误导性的「网络异常」。

## 用户看到的现象 vs 真实原因（教训核心）

现象：下单页「服务分类」显示 `⚠️ 服务加载失败`，红框 `网络异常，服务加载失败，请点击重试`。

`Order.vue:242` 的错误分支设计本来是能自解释的：

| 情况 | 代码分支 | 该显示的文案 |
|---|---|---|
| 401 | `res.status === 401` → `'expired'` | 登录状态已失效，请重新登录 |
| 500 | `json.status !== 'success'` → `'failed'` | 服务加载失败，请点击重试或刷新页面 |
| 抛异常 | `catch` → `'network'` | **网络异常，服务加载失败，请点击重试** ← 截图是这条 |

**为什么定不到 401/500：** 响应体压根不是 JSON。
nginx 声明 `Content-Length: 797760`，实际只送出 13~15 万字节 ——
`res.json()` 解析残缺 JSON 抛 `SyntaxError`，被外层 catch 捕获，
**所有真实状态码全被吞掉**，统一落进 `'network'`。
即：前端把「服务端返回了半截数据」误报成「网络不通」，
把人往查网络/查登录的方向带。

## 排查路径（可复用）

1. **先证明服务端活着**：`curl -sI` / 无 token 请求 → 站点 200、`/api/services` 正确返回 401 JSON。
   → 排除"后端挂了"。
2. **验前端包是不是旧的**（本项目老坑）：
   `curl -s https://xnow.taikon.top/assets/index-tUWPgOd3.js | md5sum` 与本地 `client/dist/` 比对
   → md5 一致 `a3546bb225a121c15ee5ef069f35af7f`，**排除"用户跑旧包"**。
3. **复现并量化**：连拉 5 次同一接口 → 5/5 都是 200 + 字节数各不相同 + JSON 全断。
   → 「大小每次不同」是关键信号：**不是数据问题，是被中途切断**。
4. **看声明的 Content-Length**：`797760` vs 实收 `130451` → 少了 80%。
5. **分层对照**（同环境只切一个变量）：
   - VPS 直连后端 `127.0.0.1:3000` → 797760 完整 ✅
   - VPS 经本机 nginx（Host 头，不走 CF）→ 797760 完整 ✅
   - VPS 走 Cloudflare → 断裂 ❌
   → 源站无罪，问题在 CF 回源那段，**但真凶不在 CF**（见下）。
6. **翻 nginx error.log**（决定性一步）：
   ```
   [crit] open() "/var/lib/nginx/proxy/7/55/0000000557" failed
          (13: Permission denied) while reading upstream
          request: "GET /api/services HTTP/2.0", referrer: "https://xnow.taikon.top/order"
   ```
   日志里的 `referrer: .../order` 就是祥哥浏览器真实发出的请求。

> ⚠️ 第 5 步的"经本机 nginx 完整通过"很容易让人误判成"CF 的问题"。
> 实际是**临时文件只在客户端消费速度追不上上游时才需要落盘** ——
> 本机 curl 秒收，全程走内存缓冲不落盘，所以不触发；远端经 CF 的请求才触发。
> **「某条路径不复现」不等于「这条路径没问题」，要看它有没有走到出问题的那段逻辑。**

## 根因与修复

```
/var/lib/nginx/proxy   nobody:root   drwx------ (0700)   ← 应该是 www-data
nginx worker 进程       www-data
```

nginx 给临时文件建二级子目录时，`chown` 目标是**上级目录的属主**。
上级是 `www-data` 时 = 自 chown（成功）；一旦变成 `nobody`，
`www-data` 无权 chown 成别人 → 建目录失败 → `open()` 报 EACCES → 放弃上游。

修复（**不用 reload，立即生效**）：

```bash
chown -R www-data:www-data /var/lib/nginx/proxy /var/lib/nginx/body \
  /var/lib/nginx/fastcgi /var/lib/nginx/uwsgi /var/lib/nginx/scgi
```

## 实测对照（同环境，只切「目录属主」一个变量）

| | 本机 → CF → 源站 | VPS → CF → 源站 |
|---|---|---|
| 修复前 | 5/5 断裂，130451~155027 字节，curl rc=18，JSON 全挂 | 3/3 断裂 |
| 修复后 | **3/3 完整 797760 字节，rc=0，JSON 全过** | **3/3 完整，rc=0，JSON 全过** |

error.log 修复后零新增 crit（计数 17 停住，最后一条 05:54:07 是修复前那次复现留下的）。

## 影响面与时间线

- **约 27 小时**：`2026-09-20 02:18:06` → `2026-09-21 05:55`
- 受害站点不止一个：同机另一个站（XNOW-Flow，上游 `127.0.0.1:8000`）的 `assets/index.js`
  同样被腰斩 —— 这是 **nginx 层故障，跨站**。修复后该站 `index.js` 1.5MB 完整加载。
- 起始点：`nginx-backup-20260920-021106`（9/20 02:11 动 nginx）后 **7 分钟**出现第一条 crit。

## 诱因推断（未 100% 坐实，但机制自洽）

**用不带 `user` 指令的 main 配置启动过 nginx** —— nginx 编译默认用户是 `nobody`，
启动时会把这些临时目录**重建**成 `nobody:root 0700`。
`nginx -c <站点配置>` 正是这种用法：**站点配置是 site 级，而 `-c` 替换的是 main 级配置**，
换进去的配置里没有 `user www-data;`。

⚠️ 未坐实的部分：没找到 9/20 当天执行该命令的痕迹。
但「9/20 02:11 动 nginx → 02:18 开始报 crit」的时间相关性 + 属主形态完全吻合，
且**这条路径能独立复现该形态**，故按此立规。

## 已做的防复发动作

- `install.sh`：加 `chown -R www-data:www-data /var/lib/nginx/{...}` 防线（放在 `systemctl enable nginx` 之前）。
- `.claude/project-checks.md`（本机活页）：「排查方法」加一条 —— 大响应被腰斩先查临时目录属主，附一行定位命令。
- `ISSUES.md`：登记为「已验证」。

## 决策副作用 / 代价

- **`chown -R` 会把历史遗留的陈旧临时文件一并改属主。** 本次无害（nginx 自己会清理），
  但如果哪天要审计"谁在什么时候往临时目录写过"这类时间线，这次 chown 抹掉了属主这维线索。
- **没有加自动巡检。** 这次的故障形态是「静默半截 200」，不报警、不写业务日志，
  只在 nginx error.log 里留 `[crit]`。**没人看日志 = 还会再中一次**。
  加一个定时 grep error.log 的告警（或 `xnow` 里的健康检查项）成本很低，
  但属新增功能，**未做，等祥哥拍板**。
- **诱因那半截仍是推断**。真要说 100% 堵死，应禁止用 `nginx -c` 跑 site 配置，
  并考虑把源站 443 只放 CF 回源段；这两条都未动手。

## 遗留 / 下一步

1. **让祥哥刷新页面确认真机恢复** —— 前端零改动（无缓存问题），接口已实测完整，理论上刷新即好。
   要拿**用户侧证据**的话：看他刷新后 nginx access log 里 `/api/services` 是否为 200 + 797760。
2. `ISSUES.md` 里本条状态已置「已验证」；若祥哥真机确认，可标注真机已验。
3. TODO 里那条 **nginx 杂散配置 `xnow-spa-https.bak-cache`** 的优先级应**上调**：
   它既报 `conflicting server name`，又是「用站点配置当 main 配置跑」这类误操作的现成诱饵。
4. 是否加 error.log 定时巡检告警 → 等祥哥拍板。
