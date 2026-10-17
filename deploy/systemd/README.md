# systemd 单元（生产用）

## `xnow-watchdog` —— 后端掉线自愈 + TG 告警（2026-10-17 加）

**为什么要有它**：2026-10-17 01:44 机器重启后，pm2 没有开机自启，后端一直没起来；
nginx 照常发静态页 → **首页 200，但所有 `/api/*` 全是 Connection refused**，
全站 API 挂了 **2 小时 47 分**才被人肉发现。**静态页 200 ≠ 站点正常。**

**它做什么**：每 2 分钟探一次 `http://127.0.0.1:3000/api/public/config`
（这一条同时覆盖 后端 + 数据库 + 路由）；探不通就按 nginx → mysql → pm2 守护 → 进程
的顺序补，补完复检：成功推一条「已自愈」TG，失败推「需要人工介入」TG（1 小时内不重复刷屏）。

**它治不了什么**：整机宕机 / 网络中断 —— 那时它自己也跑不了。
那种情况要靠**外部**监控，建议用 UptimeRobot 之类的免费服务探
`https://xnow.taikon.top/api/public/config`（期望 200）。

## 安装（换机后必做）

```bash
install -m 755 xnow-watchdog.sh    /usr/local/bin/xnow-watchdog.sh
install -m 755 xnow-alert-mail.cjs /usr/local/bin/xnow-alert-mail.cjs
install -m 644 xnow-watchdog.service /etc/systemd/system/
install -m 644 xnow-watchdog.timer   /etc/systemd/system/
touch /var/log/xnow-watchdog.log
systemctl daemon-reload
systemctl enable --now xnow-watchdog.timer
systemctl list-timers xnow-watchdog.timer    # 应看到 2 分钟周期
```

## 告警通道（两条，互为冗余）

| 通道 | 目标 | 配置位置 |
|---|---|---|
| Telegram | `@Xnow001Bot` | 数据库 `configs` 的 `tg_bot_token` / `tg_chat_id`（已在用） |
| 邮件 | `464844409@qq.com` | `xnow-watchdog.sh` 里的 `ALERT_TO`；发信复用 `configs` 的 `smtp_*`（与验证码邮件同一套 SMTP） |

**自检命令**（不动站点，只往两个通道各发一条测试消息）：

```bash
WATCHDOG_TEST=1 /usr/local/bin/xnow-watchdog.sh
tail -5 /var/log/xnow-watchdog.log   # 期望：TG 告警已发送 / MAIL_OK / 邮件告警已发送
```

> 📮 `xnow-alert-mail.cjs` **独立于站点进程**：不 import 站点代码、不连数据库
> （SMTP 参数由看门狗从库里读好后经环境变量传入），用 `NODE_PATH` 复用站点的 `nodemailer`。
> 所以**站点挂了它照样能发信** —— 这正是"告警器不能依赖被监控对象"的实践。

## 它验到什么程度了

| 场景 | 状态 |
|---|---|
| 机器活着、后端死了 | ✅ 2026-10-17 实测：`pm2 stop` → 14 秒自愈 → 200 → TG 告警 |
| 告警能到你手上（TG + 邮件） | ✅ 2026-10-17 实测：`WATCHDOG_TEST=1` → `MAIL_OK` + TG 已发送 |
| **整机宕机 / 断网** | ❌ **它自己也跑不了** → 需要外部监控（UptimeRobot 探 `https://xnow.taikon.top/api/public/config`） |

> ⚠️ 脚本里 **不写死任何凭据**：TG token / chat_id 与 SMTP 参数，运行时从数据库 `configs` 表读，
> 数据库密码取 `/var/www/xnow/server/.env`。所以它和站点走同一条通知通道。

### 故障演练（可随时重做）

```bash
pm2 stop xnow-backend        # 制造故障
xnow-watchdog.sh             # 手动触发（等价于定时器）
# 期望：14 秒内恢复、curl 得 200、TG 与邮件各收到一条「后端曾掉线，看门狗已自愈」
```
