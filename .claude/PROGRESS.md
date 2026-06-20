# XNOW 项目进度日志

## [2026-06-20] 项目清理 + VPS GitHub SSH key + 权限白名单

### 完成
1. **项目根目录散落记忆文件清理** — 23 个记忆 `.md` 文件从项目根移到 `memory/` 目录，更新 `MEMORY.md` 索引路径
2. **VPS GitHub SSH key 配置** — 生成 `ed25519` 密钥，添加为 xnow 仓库 deploy key（读写权限），remote 切换为 SSH 地址 (`git@github.com:xiasummer740/xnow.git`)，`git pull` 验证通过
3. **删除多余文件** — 项目根 `package-lock.json`（无对应 package.json）
4. **权限白名单全局化** — `~/.claude/settings.json` 添加 `permissions.allow`（`git *`, `ssh *`, `npx eslint/prettier *`, `python3 *`, `chmod *` 等），项目 `.claude/settings.local.json` 精简

### 三方同步状态
- 本地: `8865a099` ✅
- GitHub: `8865a099` ✅

## [2026-06-20] 公告同步静默失效修复（第2轮）

### 问题
上次修复后公告同步依然每 30 分钟推送一次相同的"6.19号更新"消息，6 小时内重复推送 12 次。

### 根因
`announceSync.js:119` 使用 `newContent !== existingClean` 对比**完整 HTML**，上游页面每次请求返回的 HTML 可能有细微动态差异（属性顺序、空白、CSS 值等），导致始终判定为"有变化"。

### 修复内容
- **`server/src/utils/announceSync.js`** — 加入 `stripHtml()` 函数，剥离所有 HTML 标签后只比纯文本内容
- 上游纯文本没变 → 不打日志 + 不发通知
- 上游纯文本变了 → 正常更新 + 通知

### 部署
- Commit: `2c15fc9c`，已推送 GitHub ✅
- VPS 已 git pull + pm2 restart ✅
- SSH 配置修复：启用 `PubkeyAuthentication yes`，添加 `xnow-vps` Host 别名

### 三方同步状态
- 本地: `2c0056d9` ✅
- GitHub: `2c0056d9` ✅
- VPS: `2c0056d9` ✅（服务已重启）

## [2025-06-20] 公告同步静默优化

### 问题
上游公告同步每 30 分钟执行一次，但无论公告是否变化都输出日志 `📢 [AutoAnnounce] 开始检查上游公告...`，造成日志噪音。

### 目标效果
| 情况 | 效果 |
|------|------|
| 上游公告没变 | 不打日志 + 不发通知，完全安静 |
| 上游公告更新了 | 更新公告 + 打一行日志 + 发一条 Telegram |

### 修改内容
- **`server/src/utils/announceSync.js`**
  - 移除第 42 行 `console.log("📢 [AutoAnnounce] 开始检查上游公告...");`
  - 修复 `sendTgMessage` 字符串拼接格式（`\`续行 → `\n`）
  - 添加注释说明静默行为
  - 对齐缩进

### 操作记录
1. 本地移除日志行 → 提交 `1cfb97d5`
2. 发现服务器已有相同修复 + 额外格式优化
3. 以服务器版本为准，合并格式优化
4. 本地完整提交 `6fe74c56` → 推送 GitHub
5. VPS git pull 遇到冲突（注释有 ✅ 表情差异）
6. 解决冲突，VPS reset 对齐 `6fe74c56`
7. PM2 重启服务生效

### 三方同步状态
- 本地: `40892dac` ✅
- GitHub: `40892dac` ✅
- VPS: `40892dac` ✅（服务已重启）

### 待办
- [ ] VPS 配置 GitHub SSH key 以便服务器直接推送

## [2025-06-20] PM2 开机自启配置

### 操作
- 在服务器执行 `npx pm2 save` 保存进程列表
- `npx pm2 startup` 创建 systemd 服务 `pm2-root.service`
- 已 `enable`，服务器重启后自动恢复 xnow-app 进程

## [2025-06-20] 安全加固修复（4项）

### 问题
安全全面审查发现以下问题：

| 严重度 | 问题 | 文件 |
|--------|------|------|
| HIGH | 硬编码万能验证码 `666888`，绕过邮箱注册验证 | `auth.js:19` |
| HIGH | 备份文件下载/删除/还原存在路径穿越，可读写系统任意文件 | `admin.js` |
| MEDIUM | SSL 证书验证关闭（`rejectUnauthorized: false`） | `announceSync.js`, `admin.js` |
| LOW | postMessage 使用通配符 `*` 目标域 | `pay.js:112` |

### 修改内容
1. **`auth.js`** — 移除 `if (code === '666888')` 万能验证码
2. **`admin.js`** — 添加 `safeBackupPath()` 校验函数，所有备份操作路径必须限制在 `BACKUP_DIR` 内
3. **`announceSync.js`**、**`admin.js`** — 移除 `rejectUnauthorized: false`，恢复 SSL 证书验证
4. **`pay.js`** — `postMessage` 目标域从 `'*'` 改为 `window.location.origin`

### 影响评估
- 不影响网站正常运行
- 后台备份操作与之前完全一致
- 注册流程必须经过邮箱验证（不能再填 666888 跳过）

### 三方同步状态
- Commit `40892dac`，已部署至 VPS，PM2 已重启生效

## [2025-06-20] 前端 JS 文件 hash 不匹配修复

### 问题
`client/dist/index.html` 引用的 JS hash 与实际构建产物不一致，nginx SPA 兜底返回 `index.html`，浏览器报 MIME 类型错误（`Expected a JavaScript module script but served with MIME type "text/html"`）。

### 根因
`index.html` 被更新（Jun 19 16:04）但 JS 资源未重新构建（Jun 16 12:24），hash 对不上。

### 修复
- 在服务器执行 `cd /var/www/xnow/client && npm run build` 重新构建前端
- 重建后 hash 一致，页面正常访问

## [2025-06-07] 项目初始化
- 初始部署
