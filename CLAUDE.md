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
| 2 | `.claude/TODO.md` | **现在停在哪**、下一步做什么、高危操作提醒 |
| 3 | `.claude/handover/INDEX.md` | 功能级接力笔记索引，按要做的功能挑相关的看 |
| 4 | `.claude/PROGRESS.md` | 跨会话完整时间线（很长，按需搜不要通读） |
| 5 | `ISSUES.md` | 已知未修问题。⚠️ **被 gitignore，因为仓库是 PUBLIC，永远不要 push 它** |

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
  ⚠️ **已知漏网**：`/etc/nginx/sites-enabled/` 下 4 个文件 —— `xnow-http-redirect` /
  `xnow-https` / `xnow-spa` / `xnow-spa-https` —— **不在仓库里、也没有软链**，机器一挂就丢。
  详见 `.claude/handover/2026-10-14-disaster-recovery.md` §6
- ⚠️ **`ISSUES.md` 被 gitignore（仓库是 PUBLIC），永远不要 push 它**
