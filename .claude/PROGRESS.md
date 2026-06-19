# XNOW 项目进度日志

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
- 本地: `d318b723` ✅
- GitHub: `d318b723` ✅
- VPS: `d318b723` ✅（服务已重启）

### 待办
- [ ] VPS 配置 GitHub SSH key 以便服务器直接推送
- [ ] PM2 启用开机自启（`pm2 save` + `pm2 startup`）

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
