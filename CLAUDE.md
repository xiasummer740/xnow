# XNOW

> 全局规则见 `xiangge-env/CLAUDE.md`（17条规则 + 验证报告 + 独立复审）
> 新对话自动执行 `pwsh ../xiangge-env/startup.ps1`（推/拉/环境检测/记忆加载）
> 本文件只含项目特有信息，不重复全局规则。

全栈商业级数字资产 SaaS 引擎

## 👋 接手这个仓库的人/AI 先读这里

**如果你手上只有这一个文件夹**（没有同级的 `xiangge-env/`，也没装那套全局配置）：
上面那两行会指向不存在的路径，忽略即可 —— 本仓库自身是自足的。按这个顺序读：

| # | 读物 | 看什么 |
|---|------|--------|
| 1 | `README.md` | 项目是什么、怎么部署、**怎么灾备换机**（第 4、5 节） |
| 2 | `.claude/TODO.md` | **现在停在哪**、下一步做什么、高危操作提醒。⚠️ 这个文件**不在 git 里**（见下方说明），拿整包文件夹才有；只有 git clone 的话直接看下一行的 handover |
| 3 | `.claude/handover/INDEX.md` | 功能级接力笔记索引，按要做的功能挑相关的看 |
| 4 | `.claude/PROGRESS.md` | 跨会话完整时间线（很长，按需搜不要通读） |
| 5 | `ISSUES.md` | 已知未修问题。⚠️ **被 gitignore，因为仓库是 PUBLIC，永远不要 push 它** |

> **为什么 `.claude/TODO.md` 不在 git 里**：`.gitignore:105` 有一条 `.claude/todo.md`，
> 本意是忽略某个工具产物；Windows 大小写不敏感，把大写的 `TODO.md` 一起忽略了
> （Linux 上不会）。**不是有意排除的**。目前维持现状 —— 它含 VPS IP、`/root/` 回滚路径等
> 运维细节，而这个仓库是 PUBLIC。**整包交接文件夹时它在；`git clone` 时不在。**

## 目录

| 目录 | 说明 |
|------|------|
| `client/` | 客户端 |
| `server/` | 服务端 |
| `tools/` | 工具 |

## 部署

```bash
bash install.sh    # 裸机引导部署（环境 + 数据库 + Nginx + SSL）
```

## 项目特有规则

- 双轨 SSL 配置
- 全自动部署流程，首次运行 `install.sh`
- 部署相关见 xiangge-env `CLAUDE.reference.md` 部署清单
- 🔴 **服务器上手工改过的配置，必须同步回 `install.sh` 模板** —— 否则以后重装又退回旧样。
  先例：Cloudflare 真实 IP 还原（22 条 `set_real_ip_from`）就是这么补回去的（提交 `353315bd`）。
  第二例（2026-10-14 整机演练时发现）：模板里的 `try_files` 漏了 `$uri.html`，
  会让 `/finance`、`/vpn`、`/en` 静默塌成 SPA 首页（HTTP 仍 200，只是内容全错）。已补。
  ✅ **nginx 那 4 个文件的漏网已处理**（2026-10-14）：属于本项目的 3 个存档在
  `deploy/nginx/production/`（sha256 与线上逐字节一致）。
  ⚠️ **但第 4 个 `xnow-https` 根本不属于本项目** —— 它转发到 `127.0.0.1:8000` 的 uvicorn，
  属于同机的另一个项目（`xnow-flow`／「XNOW 云控系统」，对外 `tk7188.com`）。
  🔴 **而 `tk7188.com` 正是 xnow 同步数据的「上游」，就在同一台机器上、不在本项目备份范围内。**
  换机后 xnow 会正常启动但上游不存在，服务同步会失败。
  详见 `deploy/nginx/README.md` 与 `.claude/handover/2026-10-14-machine-drill-result.md` §10。
- ⚠️ **Cloudflare 的 SSL 模式不要改成 Full (strict)**：源站证书是自签（`CN=IP`），
  靠 CF 接受自签才对外可用，改 strict 会立刻全站 502。
- ⚠️ **`ISSUES.md` 被 gitignore（仓库是 PUBLIC），永远不要 push 它**
