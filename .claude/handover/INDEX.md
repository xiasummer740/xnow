# 功能接力笔记索引

> 新对话启动时先看这里，按本次要做的功能**只加载相关文件**。

| 日期 | 文件 | 一句话 |
|------|------|--------|
| 2026-09-11 | [security-audit-batch1.md](2026-09-11-security-audit-batch1.md) | 全站安全审计 + 第一批 5 项修复已提交推送，**但没上 VPS** —— 卡在「生产走 Cloudflare 未配 real_ip」等祥哥拍板 4 件事 |

| 2026-09-19 | [login-401-flapping.md](2026-09-19-login-401-flapping.md) | 登录态反复弹窗根因**已复现**（缓存旧令牌覆盖新登录）+ 修复上线 `index-tUWPgOd3.js`；⚠️ 生产 auth.js 还有临时诊断待撤 |
