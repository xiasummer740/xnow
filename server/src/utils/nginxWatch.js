import fs from 'fs';
import { execFileSync } from 'child_process';
import { sendTgMessage } from './tgBot.js';

// 🛡️ nginx 巡检 —— 补「没人看日志」和「没人守属主」这两个盲区
//
// 为什么需要它（2026-09-21 真实事故）：nginx 临时缓冲目录属主错位（nobody vs www-data），
// 落盘失败后 nginx **读到一半放弃上游**，只把已缓冲的一小截当成功发出去 ——
// 客户端收到 HTTP 200，Content-Length 还报着完整的 797760，实际只有十几万字节。
// 前端解析残缺 JSON 失败，只能报「网络异常」，代码里 401/500 的分支全被吞掉。
// 整个故障**不写业务日志、不报警**，只在 nginx error.log 留一行 [crit]，
// 结果硬是坏了 27 小时才由祥哥肉眼发现。
// 这里做两件事：① 属主被改坏就当场抢修（根因自愈）② error.log 出严重错误就告警（兜底）。

// ============================================================
// ① 属主自愈：nginx 启动时会把这些目录重建为「启动时那个用户」所有
// ============================================================
// 一旦有人用不带 `user` 指令的 main 配置起过 nginx（典型是 `nginx -c <站点配置>`——
// 站点配置是 site 级，`-c` 换掉的却是 main 级配置，里面没有 user www-data），
// nginx 编译默认用户 nobody 就会把这些目录重建成 nobody:root 0700。
// 此后 worker(www-data) 建临时文件必失败 → 大响应被腰斩。
const TEMP_DIRS = [
  '/var/lib/nginx/proxy', '/var/lib/nginx/body', '/var/lib/nginx/fastcgi',
  '/var/lib/nginx/uwsgi', '/var/lib/nginx/scgi',
];
const OWNER = 'www-data';

// 从 /etc/passwd 取 uid，避免 spawn 一个 `id -u`
const ownerUid = () => {
  try {
    const line = fs.readFileSync('/etc/passwd', 'utf8').split('\n').find(l => l.startsWith(OWNER + ':'));
    return line ? parseInt(line.split(':')[2], 10) : null;
  } catch (e) { return null; }
};

export const checkNginxTempDirs = async () => {
  const uid = ownerUid();
  if (uid === null) return; // 不是 Linux / 没有 www-data（本地开发机）→ 静默

  const bad = TEMP_DIRS.filter((d) => {
    try { return fs.statSync(d).uid !== uid; } catch (e) { return false; } // 目录不存在 = 不归我们管
  });
  if (!bad.length) return;

  console.error(`🚨 [NginxWatch] nginx 临时目录属主被改坏，自动抢修: ${bad.join(' ')}`);
  try {
    execFileSync('chown', ['-R', `${OWNER}:${OWNER}`, ...bad]);
  } catch (e) {
    console.error('[NginxWatch] 抢修失败:', e.message);
    // 抢修失败说明进程没权限 —— 这种情况必须喊人，因为腰斩会立刻开始
    await sendTgMessage(`🚨 <b>nginx 临时目录属主被改坏，且自动抢修失败</b>\n<pre>${bad.join('\n')}</pre>\n手动执行：chown -R www-data:www-data ${bad.join(' ')}`);
    return;
  }
  // 报警带「谁把它弄坏的」时间点：这是唯一能把误操作逮现行的信号
  await sendTgMessage(`⚠️ <b>nginx 临时目录属主被改坏，已自动抢修</b>\n<pre>${bad.join('\n')}</pre>\n多为「用不带 user 指令的配置起过 nginx」所致，请回看当时的操作。`);
};

// ============================================================
// ② error.log 巡检：严重错误不声不响，这里把它喊出来
// ============================================================
const LOG_PATH = process.env.NGINX_ERROR_LOG || '/var/log/nginx/error.log';

// 只看这三档：warn/notice/info 噪声太大，[crit] 起才是真出事
const LEVELS = /\[(emerg|alert|crit)\]/;

// 已知噪声，不是本站故障，不打扰（告警一旦变吵就会被无视，等于没有）：
//  · SSL_do_handshake 是互联网扫描器撞 443 的握手失败，天天都有
//  · conflicting server name 是历史遗留的重复站点配置（见 .claude/TODO.md）
const NOISE = /SSL_do_handshake\(\) failed|conflicting server name/;

// 游标存「上次报到最后一行」的内容而不是行号：日志轮转后行号会整体错位，内容比对天然抗轮转
let lastAlerted = '';

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const checkNginxErrors = async () => {
  let lines;
  try {
    lines = fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(l => LEVELS.test(l) && !NOISE.test(l));
  } catch (e) {
    return; // 文件不存在 / 没权限（本地开发机就是这种）—— 静默退出，不刷屏
  }

  if (!lines.length) { lastAlerted = ''; return; }

  // 首次运行只建基线：否则会把日志里的历史故障当成「刚刚发生」推一遍
  if (!lastAlerted) { lastAlerted = lines[lines.length - 1]; return; }

  const idx = lines.lastIndexOf(lastAlerted);
  // 基线找不到 = 日志已轮转，当前文件里的全部是新的 → 全部上报
  const fresh = idx === -1 ? lines : lines.slice(idx + 1);
  lastAlerted = lines[lines.length - 1];
  if (!fresh.length) return;

  const shown = fresh.slice(0, 5).join('\n');
  const more = fresh.length > 5 ? `\n…另有 ${fresh.length - 5} 条` : '';
  console.error(`🚨 [NginxWatch] nginx 新增 ${fresh.length} 条严重错误`);
  await sendTgMessage(`🚨 <b>nginx 出现 ${fresh.length} 条严重错误</b>\n<pre>${escapeHtml((shown + more).substring(0, 1500))}</pre>`);
};
