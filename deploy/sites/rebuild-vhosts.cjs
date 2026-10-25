#!/usr/bin/env node
/**
 * 🏬 换服务器 / 还原备份之后：把所有分站的自有域名 vhost 重新生成一遍
 *
 * 为什么需要它：
 *   分站的「自有域名」靠 /etc/nginx/sites-enabled/xnow-site-<id>-<域名> 这些文件路由。
 *   换机器后如果只还原了数据库，`sites` 表里有域名、nginx 里却没有对应配置 →
 *   站长花钱绑的域名全部 404，而站点本身（子域名）是好的，很难第一时间发现。
 *
 *   备份包（110 期起）会带 nginx-sites/，但若还原时没有 root、或用的是老备份包，
 *   就只能靠这个脚本按数据库重建。
 *
 * 用法（在 server 目录下，和 pm2 进程用同一份 .env）：
 *   cd /var/www/xnow/server && node ../deploy/sites/rebuild-vhosts.cjs
 *   cd /var/www/xnow/server && node ../deploy/sites/rebuild-vhosts.cjs --dry   # 只看不改
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry');

// 让脚本能 import 到服务端代码（模型、utils、.env 都在 server/ 下）
const SERVER_DIR = path.resolve(__dirname, '../../server');
process.chdir(SERVER_DIR);

const { default: sequelize } = await import(path.join(SERVER_DIR, 'src/config/database.js'));
const { restoreSiteDomain } = await import(path.join(SERVER_DIR, 'src/utils/siteBilling.js'));

const main = async () => {
  const [rows] = await sequelize.query(`
    SELECT s.id, s.name, s.domain, s.custom_domain, s.status, s.custom_domain_status, s.expire_at
    FROM sites s
    WHERE (s.custom_domain IS NOT NULL AND s.custom_domain <> '')
       OR (s.domain IS NOT NULL AND s.domain <> '')
    ORDER BY s.id ASC
  `);
  console.log(`[rebuild-vhosts] 数据库里带域名的分站：${rows.length} 个${DRY ? '（dry-run，不写文件）' : ''}`);

  let ok = 0, skip = 0, fail = 0;
  for (const s of rows) {
    const domain = s.custom_domain || s.domain || '';
    const label = `#${s.id} ${s.name || '(无名)'} → ${domain}`;
    if (s.status === 'expired') { console.log(`  ⏭  跳过（已停站） ${label}`); skip++; continue; }
    if (!domain) { skip++; continue; }
    if (DRY) { console.log(`  ·  会重建 ${label}`); ok++; continue; }
    try {
      await restoreSiteDomain(s);
      console.log(`  ✅ 已重建 ${label}`);
      ok++;
    } catch (e) {
      console.log(`  ❌ 失败 ${label} → ${e.message}`);
      fail++;
    }
  }
  console.log(`[rebuild-vhosts] 完成：成功 ${ok}，跳过 ${skip}，失败 ${fail}`);
  if (fail) console.log('[rebuild-vhosts] 失败项请逐个看 nginx -t 的输出');
  await sequelize.close();
  process.exit(fail ? 1 : 0);
};

main().catch(async (e) => {
  console.error('[rebuild-vhosts] 出错:', e.message);
  try { await sequelize.close(); } catch (e2) { /* ignore */ }
  process.exit(1);
});
