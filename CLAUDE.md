# XNOW

> 全局规则见 `xiangge-env/CLAUDE.md`（17条规则 + 验证报告 + 独立复审）
> 新对话自动执行 `pwsh ../xiangge-env/startup.ps1`（推/拉/环境检测/记忆加载）
> 本文件只含项目特有信息，不重复全局规则。

全栈商业级数字资产 SaaS 引擎

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
