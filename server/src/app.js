import { autoBackupTask } from './utils/backupEngine.js';
import { wafMiddleware } from './middleware/waf.js';
import { siteMiddleware } from './middleware/site.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { sequelize, User, Config } from './models/index.js';
import { autoSyncServices } from './utils/sync.js';
import { autoSyncOrders } from './utils/orderSync.js';
import { autoSyncAnnouncement } from './utils/announceSync.js';
import billingRoutes from './routes/billing.js';
import { runSiteBillingCheck } from './utils/siteBilling.js';
import { autoTrafficWarning } from './routes/vpn.js';
import { checkNginxErrors, checkNginxTempDirs } from './utils/nginxWatch.js';

import payRoutes from './routes/pay.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import servicesRoutes from './routes/services.js';
import ordersRoutes from './routes/orders.js';
import transactionsRoutes from './routes/transactions.js';
import sitesRoutes from './routes/sites.js';
import vpnRoutes from './routes/vpn.js';
import analyticsRoutes from './routes/analytics.js';
import { reconcilePayments } from './routes/pay.js';

dotenv.config();

// ============================================================
// 🛡️ 进程级崩溃防护 — 任何未捕获的错误都不会让进程静默退出
// ============================================================
process.on('unhandledRejection', (reason) => {
  console.error('❌ [Process] 未捕获的 Promise 拒绝:', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ [Process] 未捕获的异常:', err.message);
  // 不退出进程 —— 让 systemd 托管的服务继续运行
});

const app = express();
app.use(wafMiddleware);

// 💡 核心修复：不再使用 true，只信任第一跳 (Nginx)，彻底消除 Rate Limit 报错
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,    
  frameguard: false                 
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(siteMiddleware);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { status: 'error', message: '系统触发防 CC 保护，请求过于频繁，请稍后再试' }
});
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { status: 'error', message: '操作过于频繁，系统已触发防爆破与防刷单护盾' }
});
app.use('/api/login', authLimiter);
app.use('/api/send-code', authLimiter);
app.use('/api/register', authLimiter);

app.use('/api', authRoutes);

// 🩺 健康检查 — 用于监控进程是否存活
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', db: 'connected', uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/api/user', userRoutes);
app.use('/api/services', servicesRoutes); 
app.use('/api/orders', ordersRoutes);
app.use('/api/billing', billingRoutes);   // 💳 代理/分站月费（87 期） 
app.use('/api/transactions', transactionsRoutes); 
app.use('/api/pay', payRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/vpn', vpnRoutes);
app.use('/api/track', analyticsRoutes);

const initDatabase = async () => {
  try {
    await sequelize.sync({ alter: false });
    // 数据库迁移：新增字段（产品 protocols）
    try { await sequelize.query("ALTER TABLE vpn_products ADD COLUMN protocols TEXT"); } catch (e) { /* 字段已存在则忽略 */ }
    // 🎫 分站折扣促销（老库补列；sync({alter:false}) 只建表、不给已有表加列）
    try { await sequelize.query("ALTER TABLE sites ADD COLUMN discount_rate FLOAT NOT NULL DEFAULT 1"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE sites ADD COLUMN discount_label VARCHAR(40) DEFAULT NULL"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE sites ADD COLUMN discount_until BIGINT NOT NULL DEFAULT 0"); } catch (e) {}
    // 💳 87 期：分站到期要把 status 置为 'expired'，但老库的 ENUM 只有 active/suspended，
    //    直接写会报 Data truncated for column 'status'（实测踩到）。这里幂等扩一下取值。
    try { await sequelize.query("ALTER TABLE sites MODIFY COLUMN status ENUM('active','suspended','expired') NOT NULL DEFAULT 'active'"); } catch (e) {}

    // 🔧 自动补列（83 期）：上线演练时发现的真问题 ——
    //    生产库的 sites 表是早期版本，只有 11 列；而 sync({alter:false}) 只在**建表**时
    //    按模型建全，对**已存在**的表一列都不会加。结果新代码一查 Site 就
    //    Unknown column 'sites.template' → 站长后台、分站配置全线 500。
    //    这里按「模型定义 vs 真实表结构」做差集，只 ADD 缺失的列（不删不改），
    //    可重复执行；以后模型再加字段也不用记着写 ALTER。
    try {
      const qi = sequelize.getQueryInterface();
      const skipped = [];
      let added = 0;
      for (const model of Object.values(sequelize.models)) {
        const table = typeof model.getTableName() === 'string' ? model.getTableName() : model.getTableName().tableName;
        let desc;
        try {
          desc = await qi.describeTable(table);
        } catch (e) {
          continue; // 表还不存在 —— sync 刚建好，或该模型没启用
        }
        for (const [name, attr] of Object.entries(model.rawAttributes)) {
          const col = attr.field || name;
          if (desc[col]) continue;
          try {
            await qi.addColumn(table, col, { ...attr, field: col });
            added++;
            console.log(`  [migrate] ${table}.${col} 已补上`);
          } catch (e1) {
            // NOT NULL 又没默认值 + 表里已有数据时会失败 → 退一步按可空加，至少不会 500
            try {
              await qi.addColumn(table, col, { ...attr, field: col, allowNull: true });
              added++;
              console.log(`  [migrate] ${table}.${col} 已补上（可空）`);
            } catch (e2) {
              skipped.push(`${table}.${col}(${String(e2.message).slice(0, 60)})`);
            }
          }
        }
      }
      console.log(`[migrate] 自动补列完成：新增 ${added} 列${skipped.length ? '，跳过 ' + skipped.length + ' 个: ' + skipped.join(', ') : ''}`);
    } catch (e) {
      console.warn('[migrate] 自动补列跳过:', e.message);
    }

    const defaultConfigCount = await Config.count();
    if (defaultConfigCount === 0) {
      await Config.bulkCreate([ 
        { key: 'global_multiplier', value: '2.0' }, 
        { key: 'agent_discount', value: '0.8' }, 
        { key: 'site_name', value: 'XNOW' }, 
        { key: 'site_logo', value: '/logo.png' } 
      ]);
    } else {
      const existDiscount = await Config.findOne({ where: { key: 'agent_discount' } });
      if (!existDiscount) await Config.create({ key: 'agent_discount', value: '0.8' });
      const existXXUIKey = await Config.findOne({ where: { key: 'xxui_api_key' } });
      if (!existXXUIKey) await Config.create({ key: 'xxui_api_key', value: '' });
      const existShop = await Config.findOne({ where: { key: 'vpn_shop_enabled' } });
      if (!existShop) await Config.create({ key: 'vpn_shop_enabled', value: 'true' });
    }
  } catch (error) { console.error('Database Init Error:', error.message); }
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, "127.0.0.1", async () => {
  console.log(`🚀 XNOW API Server running on port ${PORT}`);
  await initDatabase();
  
  setTimeout(autoSyncServices, 3000);
  setInterval(autoSyncServices, 1000 * 60 * 10);
  setInterval(autoSyncOrders, 1000 * 60 * 1);
  setInterval(autoBackupTask, 1000 * 60 * 5);
  setTimeout(autoSyncAnnouncement, 30000);
  setInterval(autoSyncAnnouncement, 1000 * 60 * 30);
  setInterval(reconcilePayments, 1000 * 60 * 2);
  // 💳 分站/代理到期体检：停站 + 提前 7/3/1 天（试用 6/1 小时）提醒
  setInterval(runSiteBillingCheck, 1000 * 60 * 10);
  setTimeout(runSiteBillingCheck, 1000 * 60 * 2);
  setInterval(autoTrafficWarning, 1000 * 60 * 60); // 每小时检查流量预警
  setInterval(checkNginxTempDirs, 1000 * 60 * 5);  // nginx 临时目录属主自愈（防大响应被腰斩）
  setInterval(checkNginxErrors, 1000 * 60 * 5);    // nginx 严重错误告警（防静默故障）
});
