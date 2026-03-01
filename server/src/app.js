import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { sequelize, User, Config } from './models/index.js';
import { autoSyncServices } from './utils/sync.js';
import { autoSyncOrders } from './utils/orderSync.js';

import payRoutes from './routes/pay.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import servicesRoutes from './routes/services.js';
import ordersRoutes from './routes/orders.js';
import transactionsRoutes from './routes/transactions.js';

dotenv.config();
const app = express();

// 💡 核心修复：不再使用 true，只信任第一跳 (Nginx)，彻底消除 Rate Limit 报错
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,    
  frameguard: false                 
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
app.use('/api/user', userRoutes); 
app.use('/api/services', servicesRoutes); 
app.use('/api/orders', ordersRoutes); 
app.use('/api/transactions', transactionsRoutes); 
app.use('/api/pay', payRoutes);
app.use('/api/admin', adminRoutes); 
app.use('/api/public', publicRoutes); 

const initDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    
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
    }
  } catch (error) { console.error('Database Init Error:', error.message); }
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 XNOW API Server running on port ${PORT}`);
  await initDatabase();
  
  setTimeout(autoSyncServices, 3000); 
  setInterval(autoSyncServices, 1000 * 60 * 10); 
  setInterval(autoSyncOrders, 1000 * 60 * 1);
});
