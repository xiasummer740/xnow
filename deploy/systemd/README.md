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
install -m 755 xnow-watchdog.sh /usr/local/bin/xnow-watchdog.sh
install -m 644 xnow-watchdog.service /etc/systemd/system/
install -m 644 xnow-watchdog.timer   /etc/systemd/system/
touch /var/log/xnow-watchdog.log
systemctl daemon-reload
systemctl enable --now xnow-watchdog.timer
systemctl list-timers xnow-watchdog.timer    # 应看到 2 分钟周期
```

> ⚠️ 脚本里 **不写死任何凭据**：TG token / chat_id 运行时从数据库 `configs` 表读，
> 数据库密码取 `/var/www/xnow/server/.env`。所以它和站点走同一条通知通道。

**自检**（2026-10-17 实测过一次，可照做）：

```bash
pm2 stop xnow-backend        # 制造故障
xnow-watchdog.sh             # 手动触发（等价于定时器）
# 期望：14 秒内恢复，curl 得 200，TG 收到「后端曾掉线，看门狗已自愈」
```
