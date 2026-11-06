/**
 * 只把 seedBoost 里的 input_schema 推给已存在的商品（按 code 匹配）。
 *
 * 为什么需要它：seedBoost.js 是 create-only —— 商品建过一次就再也不更新，
 * 所以改了字段模板（比如播放类补「抖音号」、给字段加 format 校验）之后，
 * 线上那批老商品的 input_schema 还是旧的。
 *
 * 🔒 只碰 input_schema 一列。名称、价格、阶梯、上下架状态一概不动 ——
 *    那些是运营在后台调过的，脚本一覆盖就是灾难。
 *
 * 用法：cd /var/www/xnow/server && node scripts/sync-boost-schema.mjs
 */
import { sequelize, BoostProduct } from '../src/models/index.js';
import { BOOST_SEED_PRODUCTS } from '../src/utils/seedBoost.js';

const run = async () => {
  const rows = await BoostProduct.findAll({ attributes: ['id', 'code', 'input_schema'] });
  const byCode = new Map(rows.map((r) => [r.code, r]));

  let updated = 0, same = 0, missing = 0;
  for (const p of BOOST_SEED_PRODUCTS) {
    const row = byCode.get(p.code);
    if (!row) { missing++; continue; }
    const next = JSON.stringify(p.input_schema);
    if (row.input_schema === next) { same++; continue; }
    await BoostProduct.update({ input_schema: next }, { where: { code: p.code } });
    updated++;
    const keys = p.input_schema.map((f) => f.key).join(' + ');
    console.log(`  ✅ ${p.code.padEnd(22)} → ${keys}`);
  }

  console.log(`\n更新 ${updated} 条，已是最新 ${same} 条，seed 里有但库里没有 ${missing} 条`);
  await sequelize.close();
};

run().catch((e) => { console.error('失败:', e); process.exit(1); });
