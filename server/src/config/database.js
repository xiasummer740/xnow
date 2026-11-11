import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false,
    // 🕗 2026-11-11：**必须保持 '+08:00'**。这个值是「数据库里实际存的时区」。
    //    实测证据（同一张表 orders.created_at 的原始串）：
    //      XN17943677522934 → "2026-11-11 11:29:12"  ← 北京时间 ✅
    //      XN179436576494020 → "2026-11-11 10:56:04"  ← 北京时间 ✅
    //      MySQL NOW() 却是 UTC（服务器未设 TZ）—— 说明**写入走的是 Sequelize**，
    //      它按 '+08:00' 把 JS Date 转成北京时间字符串落库。所以库里是北京时间。
    //
    //    ⚠️ 曾误改成 '+00:00'，后果立刻显现：新订单落库变成 "2026-11-11 03:32:04"（UTC），
    //    跟历史数据差 8 小时，前端显示「已下单 -477 分钟」。已改回。
    //
    //    🔴 还有少数订单存的是 UTC（例：XN179433866963214 → "03:24:29"，
    //    实际是北京 11:24 下的），说明存在**绕过 Sequelize 的写入路径**（原生 SQL / 补单）。
    //    这类单算时长为负或偏 8 小时。见 TODO：排查并统一。
    timezone: '+08:00',
    define: {
      timestamps: true,
      underscored: true
    },
    // 连接池：MySQL 意外断开后自动重连，不卡死进程
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    }
  }
);

export default sequelize;
