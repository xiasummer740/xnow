import fs from 'fs';
import path from 'path';
import { SiteWithdrawal } from '../models/index.js';

/**
 * 🧹 收款码图片清理（110 期祥哥批准）
 *
 * 站长每次申请提现都会传一张收款码，文件只增不删。留 6 个月够对账了，
 * 再往前的删掉，省磁盘也少一份敏感图片。
 *
 * 规则：
 *   · 只删 180 天前的文件
 *   · 还在审核中（pending）的提现，图一律保留
 *   · 数据库记录不动（历史提现记录要留着对账），只是文件没了
 *
 * 每天跑一次；启动时如果距上次跑超过 24 小时也会跑一次。
 */
const RETENTION_DAYS = Number(process.env.QR_RETENTION_DAYS || 180);
const DAY = 24 * 3600 * 1000;
let lastRun = 0;
let timer = null;

export const runQrCleanup = async (qrDir, { force = false } = {}) => {
  if (!qrDir || !fs.existsSync(qrDir)) return { deleted: 0, kept: 0, skipped: 'no-dir' };
  if (!force && Date.now() - lastRun < 12 * 3600 * 1000) return { deleted: 0, kept: 0, skipped: 'too-soon' };
  lastRun = Date.now();

  // 审核中的图先标记出来，绝对不能删
  const keep = new Set();
  try {
    const pend = await SiteWithdrawal.findAll({ where: { status: 'pending' }, attributes: ['qr_path'] });
    for (const p of pend) if (p.qr_path) keep.add(path.basename(p.qr_path));
  } catch (e) {
    // 查不到 pending 就保守退出，宁可这次不清理
    return { deleted: 0, kept: 0, skipped: 'db-error', error: e.message };
  }

  const cutoff = Date.now() - RETENTION_DAYS * DAY;
  let deleted = 0;
  let kept = 0;
  let files = [];
  try { files = fs.readdirSync(qrDir); } catch (e) { return { deleted: 0, kept: 0, skipped: 'read-error' }; }

  for (const name of files) {
    if (!/^qr-s\d+-[a-f0-9]+\.(png|jpe?g|webp)$/i.test(name)) continue;  // 只碰我们自己生成的文件
    if (keep.has(name)) { kept++; continue; }
    const full = path.join(qrDir, name);
    try {
      const st = fs.statSync(full);
      if (!st.isFile() || st.mtimeMs > cutoff) { kept++; continue; }
      fs.unlinkSync(full);
      deleted++;
    } catch (e) { kept++; }
  }
  if (deleted) console.log(`[qrCleanup] 删除 ${deleted} 张超过 ${RETENTION_DAYS} 天的收款码，保留 ${kept} 张`);
  return { deleted, kept };
};

export const startQrCleanup = (qrDir) => {
  if (timer) return;
  // 启动 3 分钟后再跑，别和启动时的迁移/同步抢 IO
  setTimeout(() => { runQrCleanup(qrDir).catch(() => {}); }, 3 * 60 * 1000);
  timer = setInterval(() => { runQrCleanup(qrDir).catch(() => {}); }, DAY);
  timer.unref?.();
};
