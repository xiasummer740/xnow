# 生产部署手册（分站体系）

> 状态：**脚本已就绪，尚未对生产执行**。等祥哥验收完 Beta 并说「可以上」。
> 脚本：`deploy/sites/deploy-prod.sh`　迁移 SQL：`deploy/sites/migrate-sites.sql`

## 一、为什么不能只 `git pull` + 重启

`server/src/app.js:99` 只有一句：

```js
await sequelize.sync({ alter: false });
```

`alter: false` 的含义是：**只创建缺失的表，绝不给已有的表补列**。

而生产库现在的状态（69 期实测对比 Beta 得出）：

| 表 | 生产缺什么 | 后果 |
|---|---|---|
| `sites` | 缺 **43 列**（模板/色系/外观/域名/SMTP/商户/首页模块…） | 新代码一查分站就 `Unknown column` |
| `orders` | 缺 `site_cost` | 分站订单扣成本失败 |
| `transactions` | 缺 `site_id` | 流水归属丢失 |
| `users` / `services` / `configs` | 一致 ✅ | — |

**所以顺序必须是：先迁移数据库，再重启后端。** 反了就是全站 500。

## 二、迁移脚本可信度（已验证）

`migrate-sites.sql` 不是手写的，是从 Beta 库的 `SHOW CREATE TABLE` 里逐列抽取生成：

| 验证项 | 结果 |
|---|---|
| 语句数 | 45 条 `ADD COLUMN IF NOT EXISTS` + 1 条条件建索引 |
| 涉及表 | `sites` / `orders` / `transactions` |
| 在生产**克隆库**上执行 | ✅ 成功（`mysqldump --no-data xnow_db` 建克隆，再灌脚本） |
| 执行后逐表比字段 | ✅ `sites/orders/transactions/users/services/configs` **全部与 Beta 一致** |
| 连跑两遍 | ✅ 两遍都成功，`sites` 列数不变（53）→ **幂等，可重复跑** |
| 是否改数据 | ❌ 不改 —— 纯 DDL，不动任何存量行 |

## 三、执行步骤（脚本会自动做，这里是他心里有数的清单）

```
0. 前置检查（分支/提交/生产分站数/用户订单数/pm2 状态）
1. 备份三样东西 → <备份根目录>/<时间戳>/（默认 `/var/backups/xnow/`）
      xnow_db.sql      整库
      client-dist.tgz  前端
      nginx-sites.tgz  nginx 配置
      server.env       后端环境变量
2. git pull 到 feat/sites
3. 跑迁移 SQL（幂等）
4. npm install ×2 + vite build + prerender + subsites-html
       ↑ 强制校验 dist 里必须有 site.html / index.html，缺了立刻中止
5. pm2 restart xnow-backend → 等 6 秒 → 探 /api/public/config 是否 200
       起不来就打印日志并停，不往下走
6. 自检：首页 + API 状态码、生产分站数、用户/订单数
```

## 四、回滚（四个层次，互不依赖）

| 只回滚… | 命令 |
|---|---|
| 代码 | `cd /var/www/xnow && git checkout <旧提交> && pm2 restart xnow-backend` |
| 数据库 | `mysql -u root xnow_db < <备份根目录>/<时间戳>/xnow_db.sql` |
| 前端 | `tar xzf <备份根目录>/<时间戳>/client-dist.tgz -C /var/www/xnow` |
| nginx | `tar xzf <备份根目录>/<时间戳>/nginx-sites.tgz -C /etc/nginx && nginx -s reload` |

数据库迁移是**向后兼容**的：老代码不认识新列也不受影响（MySQL 忽略多余列），
所以代码回滚时**不需要**回滚数据库 —— 这是故意的，少一步风险。

## 五、上线后必须确认的一件事

分站的免费子域名依赖通配 vhost。Beta 的 `xnow-beta` 配置里有

```
server_name beta.xnow.taikon.top beta.taikon.top *.xnow.taikon.top;
```

那个 `*.xnow.taikon.top` 通配会把**任何没有自己 vhost 的免费子域名**都接到 Beta 实例上
（实测 `zzz-none.xnow.taikon.top` 返回的是 Beta 的平台首页）。
生产分站 vhost 万一生成失败，客户会落到 Beta 库 —— 数据就串了。

**上线时一并把这行通配删掉**（生产 vhost 里则本就不该有这个通配）。现在生产分站数为 0，尚无实际影响。

## 六、上线后要盯着看的三个数

```sql
SELECT COUNT(*) FROM sites;                              -- 分站数
SELECT id, domain, domain_status, cert_mode FROM sites;  -- 域名与证书状态
SELECT COUNT(*) FROM orders WHERE site_id IS NOT NULL;   -- 分站订单数
```
