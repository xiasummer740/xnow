#!/usr/bin/env node
/**
 * 表结构自愈脚本 —— 让数据库追上 Sequelize 模型（只加列/加索引，永不改、不删数据）
 *
 * 为什么需要它：
 *   分站功能一路加了不少列（icon_style / section_styles / bg_mode …），其中一部分只在
 *   Beta 上手工 ALTER 过。换机器、重建库、把 Beta 结构搬到生产时，缺一列的表现不是报错，
 *   而是「装修页保存提示成功但设置全没了」「背景图怎么传都不显示」——极难查，
 *   因为 Sequelize 对模型里没有的列会静默忽略。
 *
 * 怎么保证清单不会漏/不会错：
 *   **DDL 由模型自己推导**（`rawAttributes[x].type.toSql()`），不再手抄。
 *   （手抄版本曾经凭空"补"了 4 个模型里根本不存在的列 —— 那种脚本比没有更危险。）
 *
 * 用法：
 *   node deploy/sites/migrate-columns.cjs              # 用 server/.env
 *   node deploy/sites/migrate-columns.cjs --dry-run    # 只报告，不动库
 */
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..", "..");
const MODELS_DIR = path.join(ROOT, "server", "src", "models");
const DRY = process.argv.includes("--dry-run");

// ── 读 server/.env（脏活，但比引入 dotenv 少一个依赖）──
function loadEnv() {
  const candidates = [path.join(ROOT, "server", ".env"), path.join(process.cwd(), "server", ".env")];
  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let v = m[2].trim();
      if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
    return f;
  }
  return null;
}

// ── Sequelize 类型 → SQL（ENUM 之类需要额外参数，单独兜一下）──
function typeToSql(attr, name) {
  const t = attr.type;
  try {
    if (t.toSql) {
      const sql = t.toSql();
      if (sql) return sql;
    }
  } catch (e) { /* 下面兜底 */ }
  const key = String(t.key || t).toUpperCase();
  if (key === "ENUM") return "VARCHAR(32)";
  const MAP = {
    STRING: "VARCHAR(255)", TEXT: "TEXT", INTEGER: "INT(11)", BIGINT: "BIGINT",
    FLOAT: "FLOAT", DOUBLE: "DOUBLE", DECIMAL: "DECIMAL(14,6)", BOOLEAN: "TINYINT(1)",
    DATE: "DATETIME", JSON: "TEXT",
  };
  if (MAP[key]) return MAP[key];
  console.log(`  ⚠️  ${name}: 类型 ${key} 拿不到 SQL 定义，跳过（宁可漏也不要写错）`);
  return null;
}

function defaultLiteral(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
  return null; // DataTypes.NOW 等一律不给默认值
}

const COLUMN_ORDER = ["_id", "id"];

(async () => {
  const envFile = loadEnv();
  const cfg = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  };
  if (!cfg.user || !cfg.database) {
    console.error("❌ 缺 DB_USER / DB_NAME。确认 server/.env 在，或用环境变量传。");
    process.exit(1);
  }

  const mysql = require(path.join(ROOT, "server", "node_modules", "mysql2", "promise"));
  const conn = await mysql.createConnection(cfg);
  console.log(`🩺 目标库：${cfg.database} @ ${cfg.host}${DRY ? "（dry-run，只报告）" : ""}`);
  console.log(`   配置来源：${envFile || "环境变量"}\n`);

  const [tables] = await conn.query("SHOW TABLES");
  const tableSet = new Set(tables.map((r) => Object.values(r)[0]));

  const files = fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith(".js") && f !== "index.js").sort();
  let added = 0;
  let skipped = 0;
  let missingTables = 0;

  for (const f of files) {
    let Model;
    try {
      const mod = await import(pathToFileURL(path.join(MODELS_DIR, f)).href);
      Model = mod.default;
    } catch (e) {
      console.log(`  ⚠️  ${f} 加载失败：${e.message.slice(0, 80)}`);
      continue;
    }
    if (!Model || !Model.rawAttributes) continue;

    const table = typeof Model.getTableName === "function" ? Model.getTableName() : Model.tableName;
    if (typeof table !== "string") continue; // 有 schema 前缀的跳过

    if (!tableSet.has(table)) {
      console.log(`  ⚠️  表 ${table} 不存在（模型 ${f}）—— 这个库还没建这张表，跳过`);
      missingTables++;
      continue;
    }

    const names = Object.keys(Model.rawAttributes)
      .filter((n) => !["createdAt", "updatedAt"].includes(n))
      .sort((a, b) => {
        const ai = COLUMN_ORDER.indexOf(a); const bi = COLUMN_ORDER.indexOf(b);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      });

    const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
    const have = new Set(cols.map((c) => c.Field));

    for (const n of names) {
      if (have.has(n)) { skipped++; continue; }
      const attr = Model.rawAttributes[n];
      const sqlType = typeToSql(attr, `${table}.${n}`);
      if (!sqlType) continue;

      const nullable = attr.allowNull !== false;
      const def = defaultLiteral(attr.defaultValue);
      let ddl = `\`${n}\` ${sqlType}`;
      if (!nullable && def !== null) ddl += ` NOT NULL DEFAULT ${def}`;
      else if (!nullable && def === null) {
        // 表里已有数据时，NOT NULL 又没默认值加不上去 —— 先建成可空，避免卡住
        ddl += " NULL";
        console.log(`  ⚠️  ${table}.${n} 模型要求 NOT NULL 但没有默认值，先建成可空（业务侧必须自己兜底）`);
      } else ddl += " NULL";

      if (DRY) {
        console.log(`  ➕ 待补 ${table}.${n} → ${ddl}`);
      } else {
        await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
        console.log(`  ✅ ${table}.${n} 已补上`);
      }
      added++;
    }

    // 索引：只补分站功能真正依赖的那几个（列不建索引，站多了会全表扫）
    const IDX = {
      sites: [["idx_sites_owner", "owner_id"], ["idx_sites_domain", "domain"]],
      transactions: [["idx_tx_site", "site_id"]],
      orders: [["idx_orders_site", "site_id"]],
      users: [["idx_users_site", "site_id"]],
    };
    for (const [name, col] of IDX[table] || []) {
      if (!have.has(col)) continue; // 列都不在就别建索引
      const [rows] = await conn.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [name]);
      if (rows.length) { skipped++; continue; }
      if (DRY) { console.log(`  ➕ 待补索引 ${table}.${name}(${col})`); added++; continue; }
      await conn.query(`ALTER TABLE \`${table}\` ADD INDEX \`${name}\` (\`${col}\`)`);
      console.log(`  ✅ 索引 ${table}.${name} 已补上`);
      added++;
    }
  }

  await conn.end();
  console.log(`\n完成：${DRY ? "待补" : "补了"} ${added} 项，跳过 ${skipped} 项（本来就一致）。`);
  if (missingTables) console.log(`⚠️  有 ${missingTables} 张表在库里不存在（新库请先跑 install.sh / 建表流程）。`);
  console.log(added === 0 ? "✅ 表结构和模型是一致的。" : "✅ 表结构已对齐模型。");
})().catch((e) => {
  console.error("❌ 失败：", e.message);
  process.exit(1);
});
