# 功能接力笔记索引

> 新对话启动时先看这里，按本次要做的功能**只加载相关文件**。

| 日期 | 文件 | 一句话 |
|------|------|--------|
| 2026-10-29 | [pay-channels-and-seo.md](2026-10-29-pay-channels-and-seo.md) | **A/B 双收款通道 + 分站 SEO/GEO**：`payChannel.js` 统一判定（auto/own/platform，自有商户的钱绝不落平台台账）；`seo.js` 服务端渲染 robots/sitemap/`/c/<平台>`/首页壳（分站可见文字 6→2089 字）；⚠️ 待祥哥关掉 CF 的 Bot Preference Sync，AI 爬虫才真放行 |
| 2026-10-26 | [sites-feedback-round1.md](2026-10-26-sites-feedback-round1.md) | **分站上线后第一轮反馈修完的接力起点**：6 个提交（分配分站 / 证书顺序 / 减天数 / 填天数 / 按钮冒泡 / 账面拆分）；祥哥明确「不建测试号、不标测试单、不补历史原因」；三个坑（dist/index.html 被 checkout 回退、先立 vhost 再签证书、行内按钮必须 .stop）|
| 2026-10-14 | [machine-drill-result.md](2026-10-14-machine-drill-result.md) | 🔴 **整机演练已实做（结果）**：老 token 免登**成立**（admin/普通用户都 200、伪造签名 401、经 nginx 也 200；12 张表逐表一致）。**但按原样 `install.sh` 一次都恢复不起来** —— 4 处必然致命（Node 18 导致 `ERR_REQUIRE_ESM` 后端起不来 / MariaDB 密码静默没设上 / pm2 软链少一级 / nginx heredoc 里 `$remote_addr` 触发 `set -u`）+ 1 处条件致命 + 1 处假告警。§10 还挖出**换机就丢**的东西：`try_files` 漏 `$uri.html`（`/finance` `/vpn` `/en` 会塌成首页）、3 个页面只在服务器 `dist/` 里、生产 nginx 配置不在仓库；**并发现这台机器上跑着两个项目，而 xnow 的上游 `tk7188.com` 就在同一台机器上、不在本项目备份范围内**（2026-10-15 祥哥定调：上游的备份与恢复责任不归我们，**别再问、别再提**）。补丁均已提交推送 |
| 2026-10-14 | [machine-drill-runbook.md](2026-10-14-machine-drill-runbook.md) | **整机演练 Runbook（照着做即可）**：在另一台新机器上用备份包副本跑一遍恢复，证明「数据不少 + 老用户不用重登」。含 5 条红线、验收表、预期偏差、收尾销毁。配套 `tools/drill-prepare.sh`（**已用合成包实测**，三道闸门会拦住"把真实用户数据写进公开仓库"这类事故）|
| 2026-10-14 | [disaster-recovery.md](2026-10-14-disaster-recovery.md) | **整机灾备**：换机会把全体用户踢下线（`JWT_SECRET` 被随机换掉）+ 新机器是个**死锁**（注册要验证码→验证码要 SMTP→SMTP 在空库里，导致网页「一键还原」够不着）。两处都已修并各自验证；**真实整机演练已于 10-14 做完**（结果见上两行）。**2026-10-15 更新（§3.3）**：死锁**根治** —— 历史上靠万能验证码 `666888` + 影子账户 `admin/admin123` 绕过，2026 年初的安全加固正确删除了它们却**没补替代**；现改为 `install.sh` 在空库时建一个**真实数据库账号** `admin`/`admin123`（无代码后门、可 `XNOW_INITIAL_ADMIN_PASS` 覆盖、有数据时跳过）。⚠️ 默认值写在公开仓库里，新站装完必须立刻改密码 |
| 2026-09-21 | [nginx-truncated-response.md](2026-09-21-nginx-truncated-response.md) | 下单页「服务加载失败/网络异常」真凶是 **nginx 临时目录属主错位**（`nobody` vs `www-data`）→ 大响应被腰斩成半截 200。祥哥确认恢复后**已杜绝**：结构层 `proxy_max_temp_file_size 0`（腰斩不可能）+ 属主自愈巡检 + error.log 告警。实测故障态下 3/3 完整（原 5/5 断裂） |
| 2026-09-19 | [login-401-flapping.md](2026-09-19-login-401-flapping.md) | 登录态反复弹窗：根因**已复现**（缓存里的旧令牌覆盖刚登录的新令牌）+ 修复 `index-tUWPgOd3.js` 已上线，祥哥真机确认 + 连续 3 小时零复发。**已结案** |
| 2026-09-11 | [security-audit-batch1.md](2026-09-11-security-audit-batch1.md) | 全站安全审计 + 第一批 6 项后端修复。**已于 09-20 全部上线**（曾被「生产走 CF 未配 real_ip」卡住，real_ip 已补） |
