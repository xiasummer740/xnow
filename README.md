# 🚀 XNOW - 全栈商业级数字资产 SaaS 引擎

> "We build systems not just to write code, but to engineer automated wealth."

## 📂 核心目录结构及详细释义 (Project Structure)

~~~text
/xnow/
├── install.sh              # 🟢 【入口】裸机引导部署引擎 (全自动装环境、建库、编译、Nginx、双轨SSL)
├── README.md               # 项目部署与架构说明书 (You are here)
│
├── tools/                  # 🧰 运维工具箱
│   └── xnow_db_manager.sh  # 🔄 数据库灾备与恢复引擎 (CLI 面板：一键冷冻备份/灾难覆盖还原)
│
├── client/                 # 🔵 前端 Vue3 + Vite 项目目录 (基于 Composition API)
│   ├── src/
│   │   ├── assets/         # 静态资源 (Logo, 自定义字体, CSS 量子背景样式)
│   │   ├── components/     # 全局复用组件库
│   │   ├── router/         # Vue Router 路由配置表 (含全局流量锁客守卫)
│   │   ├── stores/         # Pinia 状态管理中心 (app:全局配置, ui:弹窗控制, user:鉴权信息)
│   │   ├── views/          # 核心页面视图库
│   │   │   ├── Admin.vue   # 【管理密室】全局参数、用户等级调度、WAF护城河、流水大盘
│   │   │   ├── AdminBackup.vue # 【灾备中心】可视化的全自动数据备份、手动物理删除与极致覆盖还原 GUI 面板
│   │   │   ├── Login.vue   # 【认证入口】登录注册、找回密码 (SaaS 影子账户冷启动识别)
│   │   │   ├── Recharge.vue# 【资金中心】多渠道充值、USDT 灯箱教程、脱敏资金追踪表
│   │   │   ├── Affiliate.vue#【全民躺赚】裂变分销大厅 (全自动 10% 佣金推广引擎)
│   │   │   ├── Vip.vue     # 【特权营销】至尊代理升级大厅 (纯 CSS 黑金炫酷组件)
│   │   │   └── ...         # 其他前台业务视图
│   │   ├── App.vue         # 前端根组件 (包含 3D 卡哇伊互动客服组件、量子公式漂浮背景)
│   │   └── main.js         # 前端应用入口文件、i18n 多语言架构挂载点
│   ├── index.html          # HTML 渲染骨架模板
│   ├── package.json        # 前端依赖配置
│   └── vite.config.js      # Vite 构建引擎与反向代理配置
│
└── server/                 # 🔴 后端 Node.js + Express 项目目录 (ES6 Modules)
    ├── src/
    │   ├── config/
    │   │   └── database.js # MySQL 数据库连接池与 Sequelize 引擎初始化
    │   ├── middleware/
    │   │   ├── auth.js     # JWT 安全鉴权与身份拦截中间件 (兼容 Header 与 URL Query 下载通道)
    │   │   └── waf.js      # 🛡️ WAF 护城河中间件 (恶意 IP 全局 403 物理拦截)
    │   ├── models/         # 数据库 ORM 数据模型
    │   │   ├── index.js    # 模型关联与统一导出机制
    │   │   ├── User.js     # 用户架构 (UID, Hash密码, 余额, is_banned 风控状态)
    │   │   ├── Order.js    # 历史订单监控模型 (自带联合 B-Tree 索引)
    │   │   ├── Transaction.js # 军工级资金流水追踪表 (带最新 balance 快照)
    │   │   └── Config.js   # 全站系统参数无级配置表 (KV 结构)
    │   ├── routes/         # 核心业务 API 路由出口
    │   │   ├── admin.js    # 管理员特权控制台 (一键封禁、可视化灾备恢复/物理删除接口)
    │   │   ├── auth.js     # 身份验证集群 (动态 Logo 邮件模板、高级防 CC 爆破)
    │   │   ├── orders.js   # 订单流转中心 (计算折上折、对接上游接口、事务防扣空)
    │   │   ├── pay.js      # 支付回调大脑 (BufPay 验签、阶梯式 5%/10% 佣金自动结算)
    │   │   ├── public.js   # 免鉴权公共资源出口 (供前端拉取站点配置与教程图)
    │   │   ├── services.js # 上游商品价格同步接口
    │   │   └── transactions.js # 个人账单查询接口
    │   ├── utils/          # 全局工具箱
    │   │   ├── tgBot.js    # Telegram 机器人极速异步推送引擎
    │   │   ├── sync.js     # 原生正则全网爬虫，商品服务全量化同步
    │   │   ├── backupEngine.js # 自动化定时压缩备份与文件流还原引擎核心
    │   │   └── orderSync.js# 异步缓冲队列定时任务：平滑检查上游订单，防 OOM
    │   └── app.js          # 后端心脏入口 (挂载 Helmet, 真实 IP 限流锁, WAF拦截墙)
    ├── .env.example        # 环境变量脱敏示例模板
    └── package.json        # 后端依赖配置
~~~

## ✨ 核心特性 (Core Features)

* **🛡️ SaaS 级无痕冷启动**：首次部署后，输入 `admin` / `admin123` 虚空登入系统。首位真实注册用户自动加冕为「管理员」并彻底自毁后门。
* **🚀 裸机级一键部署引擎**：小白专属 `install.sh`。自带 CF 小黄云无敌态双轨 SSL 容灾策略。脚本自动装配 Node、MySQL、Nginx 并申请证书，解放双手。
* **🤖 全场景 Telegram 超强引擎**：异步非阻塞式推送。新用户注册、资金入账、上下级返佣、违规封禁、自动灾备完成等全链路实时监控。
* **💸 暴利裂变分销中枢**：内置全局流量锁客系统与阶梯式（普通5% / 代理10%）佣金自动结算大脑，自带抗拦截 CSS 极客邮件营销模板。
* **💳 多通道极速支付网关**：内置 BufPay 与 Cryptomus 聚合支付。智能计算 5% 通道费并实现隐写本金入账。
* **🎨 顶级交互体验**：纯 CSS 手绘 3D 卡哇伊客服交互气泡、USDT 充值全屏响应式 Lightbox（灯箱）、完美适配移动端 100dvh 吸顶毛玻璃导航栏。
* **🔒 企业级安全 WAF 铠甲**：深度集成 Helmet、防 XSS 注入、基于真实穿透 IP 的 15分钟/30次 CC 限流锁，以及后台可视化数字护城河（IP 物理拦截）与账号一键封杀系统。
* **📦 可视化自动化数据灾备系统**：支持在前端可视化设置定时备份频率（如每 0.5 小时），防失联下载，支持后台一键物理清理历史快照，且支持新部署时直接上传历史备份包实现秒级强制复活！

## 🛠️ 小白专属：一键裸机安装向导 (Ultimate Quick Start)

忘掉繁琐的环境配置，仅需两行命令，在全新的 Ubuntu/Debian 服务器上直接执行：

### 1. 克隆代码
~~~bash
git clone https://github.com/xiasummer740/xnow.git
cd xnow
~~~

### 2. 运行一键安装魔法
~~~bash
bash install.sh
~~~
按照屏幕提示输入您的 **网站域名** 和自定义的 **数据库密码**。 ☕ 接下来去喝杯咖啡，脚本会自动为您完成：
* 安装 `Node.js`、`PM2`、`Nginx`、`Certbot`、`MySQL`。
* 自动创建数据库、生成安全密钥。
* 自动编译前端 Vite 代码、配置 Nginx 域名绑定与反向代理（突破 100M 上传限制）。
* 自动向 Let's Encrypt 申请 HTTPS 证书（自带自签证书容灾机制，支持任意 CDN 代理）。

### 3. 💡 SaaS 影子冷启动 (系统初始化)
部署完成后，请在浏览器打开您的域名：
1.  账号：`admin`，密码：`admin123` 登录系统。
2.  进入【管理密室】，配置您的全局参数、支付网关、TG 机器人等。
3.  **退出系统**，来到前台注册页面，使用您的手机号完成首次真实注册。
4.  ⚡️ **系统判定机制生效**：您的新账号将被永久赋权。此时，`admin` 影子后门瞬间永久物理销毁，保证系统绝对纯净安全！

### 4. 🔄 数据灾备与满血复活 (Disaster Recovery)
本系统提供两种方式管理数据库：

**方式一：前端可视化控制台 (推荐)**
直接登录管理员账号，点击侧边栏的 **【数据灾备中心】**。您可以可视化地：
* 设置自动化备份频率（如 0.5 小时一次），可精准回显配置。
* 随时手动创建快照、物理删除历史快照、一键下载。
* 重装服务器后，直接上传历史 `.sql.gz` 快照包，一键还原覆盖全站数据！

**方式二：服务器 CLI 工具 (极端情况使用)**
如果您无法登录前端，可直接在服务器终端运行：
~~~bash
bash /var/www/xnow/tools/xnow_db_manager.sh
~~~

## ⚖️ 免责声明
本项目开源仅供代码学习与交流使用。使用者请严格遵守当地法律法规，禁止用于任何非法用途，开发者不对使用本软件产生的任何纠纷或损失负责。
