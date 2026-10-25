#!/usr/bin/env node
/**
 * 🏗️ 建表脚本：110 期分站结算相关的两张新表
 *
 * 为什么单独写：`migrate-columns.cjs` 只给**已存在**的表补列，表不存在时它只打印一行
 * 「表不存在，跳过」。生产库从来没有这两张表，所以上线时必须在迁移前先把表建出来，
 * 否则「站长提现」一打开就是 500。
 *
 * 幂等：全部 IF NOT EXISTS，可重复执行。已存在但缺 used_amount 的老库会自动补列。
 *
 * 用法：
 *   node deploy/sites/create-tables.cjs                # 用 .env 里的库
 *   node deploy/sites/create-tables.cjs --dry          # 只报告不执行
 *   DB_NAME=xnow_test node deploy/sites/create-tables.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DRY = process.argv.some((a) => a === '--dry' || a === '--dry-run');
const envFile = process.env.ENV_FILE || path.join(ROOT, 'server', '.env');

const loadEnv = () => {
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
};

const TABLES = [
  {
    name: 'site_collections',
    label: '平台代收台账',
    ddl: `CREATE TABLE IF NOT EXISTS \`site_collections\` (
  \`id\` INT(11) NOT NULL AUTO_INCREMENT,
  \`site_id\` INT(11) NOT NULL,
  \`user_id\` INT(11) NOT NULL,
  \`order_id\` VARCHAR(120) NOT NULL,
  \`amount\` DECIMAL(14,6) NOT NULL,
  \`used_amount\` DECIMAL(14,6) NOT NULL DEFAULT 0.000000,
  \`withdrawal_id\` INT(11) DEFAULT NULL,
  \`created_at\` DATETIME NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_site_collections_order\` (\`order_id\`),
  KEY \`idx_site_collections_site\` (\`site_id\`),
  KEY \`idx_site_collections_withdrawal\` (\`withdrawal_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
  {
    name: 'site_withdrawals',
    label: '站长提现申请',
    ddl: `CREATE TABLE IF NOT EXISTS \`site_withdrawals\` (
  \`id\` INT(11) NOT NULL AUTO_INCREMENT,
  \`site_id\` INT(11) NOT NULL,
  \`owner_id\` INT(11) NOT NULL,
  \`amount\` DECIMAL(14,6) NOT NULL,
  \`qr_path\` VARCHAR(255) DEFAULT NULL,
  \`note\` VARCHAR(255) DEFAULT NULL,
  \`status\` ENUM('pending','paid','rejected') NOT NULL DEFAULT 'pending',
  \`admin_note\` VARCHAR(255) DEFAULT NULL,
  \`admin_id\` INT(11) DEFAULT NULL,
  \`paid_at\` DATETIME DEFAULT NULL,
  \`created_at\` DATETIME NOT NULL,
  \`updated_at\` DATETIME NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_site_withdrawals_site\` (\`site_id\`),
  KEY \`idx_site_withdrawals_status\` (\`status\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
];

// 老库补列（表已存在但缺 used_amount 的情况）
const COLUMN_PATCHES = [
  { table: 'site_collections', column: 'used_amount', ddl: 'ALTER TABLE `site_collections` ADD COLUMN `used_amount` DECIMAL(14,6) NOT NULL DEFAULT 0.000000 AFTER `amount`' },
];

(async () => {
  loadEnv();
  const cfg = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
  if (!cfg.user || !cfg.database) {
    console.error('❌ 缺少 DB_USER / DB_NAME，检查 server/.env');
    process.exit(1);
  }

  const mysql = require(path.join(ROOT, 'server', 'node_modules', 'mysql2', 'promise'));
  const conn = await mysql.createConnection(cfg);
  console.log(`🏗️  目标库：${cfg.database} @ ${cfg.host}${DRY ? '（dry-run，只报告）' : ''}\n`);

  const [rows] = await conn.query('SHOW TABLES');
  const have = new Set(rows.map((r) => Object.values(r)[0]));

  for (const t of TABLES) {
    if (have.has(t.name)) {
      console.log(`  ✅ ${t.name}（${t.label}）已存在`);
    } else if (DRY) {
      console.log(`  ➕ ${t.name}（${t.label}）缺失 —— 正式执行会创建`);
    } else {
      await conn.query(t.ddl);
      console.log(`  ➕ ${t.name}（${t.label}）已创建`);
    }
  }

  // 补列
  for (const p of COLUMN_PATCHES) {
    if (!have.has(p.table)) continue;
    const [cols] = await conn.query(`SHOW COLUMNS FROM \`${p.table}\``);
    if (cols.some((c) => c.Field === p.column)) {
      console.log(`  ✅ ${p.table}.${p.column} 已存在`);
      continue;
    }
    if (DRY) {
      console.log(`  ➕ ${p.table}.${p.column} 缺失 —— 正式执行会补列`);
    } else {
      await conn.query(p.ddl);
      console.log(`  ➕ ${p.table}.${p.column} 已补`);
    }
  }

  await conn.end();
  console.log('\n完成。');
})().catch((e) => {
  console.error('❌ 建表失败：' + e.message);
  process.exit(1);
});
