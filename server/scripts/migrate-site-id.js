// 分站体系 · 一期迁移：给 users / orders 加 site_id 列
// 幂等：重复执行安全。不改任何既有行的语义（老数据默认归主站 0）。
//
// 🔴 强制目标库校验（血泪教训）：
//    dotenv 不会覆盖已存在的环境变量，所以「source 了生产 .env 再跑本脚本」
//    会让迁移落到生产库上。必须显式指定目标库，库名不符直接中止。
//
// 用法：
//   MIGRATE_TARGET=xnow_beta DB_NAME=xnow_beta node scripts/migrate-site-id.js
import sequelize from '../src/config/database.js';

const TABLES = ['users', 'orders'];

const [dbRows] = await sequelize.query('SELECT DATABASE() AS db');
const dbName = dbRows[0].db;
const target = process.env.MIGRATE_TARGET;

console.log(`🎯 目标库: ${dbName}`);
if (!target) {
  console.error('❌ 必须显式指定 MIGRATE_TARGET=<库名>，防止误改其他库');
  await sequelize.close();
  process.exit(1);
}
if (target !== dbName) {
  console.error(`❌ 目标库不符：MIGRATE_TARGET=${target}，实际连到 ${dbName}，已中止`);
  await sequelize.close();
  process.exit(1);
}

const columnExists = async (table, column) => {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    { replacements: [table, column] }
  );
  return Number(rows[0].n) > 0;
};

const indexExists = async (table, indexName) => {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS n FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    { replacements: [table, indexName] }
  );
  return Number(rows[0].n) > 0;
};

const run = async () => {
  let changed = 0;
  for (const table of TABLES) {
    if (await columnExists(table, 'site_id')) {
      console.log(`  ⏭  ${table}.site_id 已存在`);
    } else {
      await sequelize.query(
        `ALTER TABLE \`${table}\` ADD COLUMN site_id INT NOT NULL DEFAULT 0`
      );
      console.log(`  ✅ ${table}.site_id 已添加（老数据 = 0 主站）`);
      changed++;
    }

    const idx = `idx_${table}_site_id`;
    if (await indexExists(table, idx)) {
      console.log(`  ⏭  ${table} 索引 ${idx} 已存在`);
    } else {
      await sequelize.query(`ALTER TABLE \`${table}\` ADD INDEX \`${idx}\` (site_id)`);
      console.log(`  ✅ ${table} 索引 ${idx} 已建立`);
      changed++;
    }
  }

  // 结果自查
  for (const table of TABLES) {
    const [rows] = await sequelize.query(
      `SELECT COUNT(*) AS total, SUM(site_id = 0) AS main_site FROM \`${table}\``
    );
    const r = rows[0];
    console.log(`  📊 ${table}: 共 ${r.total} 行，主站(site_id=0) ${r.main_site} 行`);
  }

  console.log(changed === 0 ? '\n无需变更（已是最新）' : `\n完成，共 ${changed} 项变更`);
  await sequelize.close();
};

run().catch(async (e) => {
  console.error('❌ 迁移失败:', e.message);
  await sequelize.close();
  process.exit(1);
});
