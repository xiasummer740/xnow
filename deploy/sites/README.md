# 分站体系 · 部署工具

上线时用这三个脚本，配套演练记录见 `.claude` 之外的验收文档。

## 用法

```bash
# 0) 部署前检查（只读，不改任何东西）
bash deploy/sites/deploy-sites.sh --env prod --check

# 1) 正式部署（自动备份 → 迁移 → 换代码 → 平滑重启 → 自检）
bash deploy/sites/deploy-sites.sh --env prod

# 2) 只看自检结果（随时可跑，只读）
bash deploy/sites/verify-sites.sh --env prod

# 3) 出问题时回滚
bash deploy/sites/rollback-sites.sh --env prod --list                    # 看有哪些备份
bash deploy/sites/rollback-sites.sh --env prod --stamp XXX --code-only   # 只回滚代码（多数情况够）
bash deploy/sites/rollback-sites.sh --env prod --stamp XXX               # 连数据库一起还原（最后手段）
```

## 三条设计约束

1. **备份不成功就不部署**：备份文件会校验体积与表数量，异常直接退出。
2. **迁移只加列、不动数据**：脚本会对比迁移前后的 `users`/`orders` 行数，一旦变化立即中止。
3. **回滚不依赖 git**：生产的 `/var/www/xnow` 不是 git 仓库（演练时确认），
   所以部署时会把 `server/src`、`server/scripts` 打成 tar 快照，回滚直接解包。

## 演练记录（Beta，2026-10-24）

| 步骤 | 结果 |
|---|---|
| 部署前检查 | 42 个后端文件语法全过 ✅ |
| 真实部署 | 退出码 0，自检 20/20 全绿 ✅ |
| 备份可还原性 | 还原到临时库，users/orders/sites 与原始完全一致 ✅ |
| 回滚演练 | 从代码快照恢复 + 重启，首页/API 200 ✅ |
| 回滚后自检 | 20/20 全绿 ✅ |
| 生产 | 首页 200，users 5 / orders 31 / sites 0 全程未变 ✅ |
