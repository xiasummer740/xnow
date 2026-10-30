// 纯逻辑自测：node scripts/agent-status-selftest.mjs
// 不连数据库、不联网，专门验「代理资格」这条判定 —— 它是给不给 8 折的唯一开关。
import { isAgentActive, expiryMs, agentDaysLeft } from '../server/src/utils/agentStatus.js';

const now = Date.now();
const DAY = 86400000;
let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? '✅' : '❌'} ${name} → ${JSON.stringify(got)}${ok ? '' : `（期望 ${JSON.stringify(want)}）`}`);
};

t('角色 user，有未来到期时间 → 无效', isAgentActive('user', now + DAY), false);
t('角色 agent + 未来 30 天 → 有效', isAgentActive('agent', now + 30 * DAY), true);
t('角色 agent + 已过期 1 秒 → 无效', isAgentActive('agent', now - 1000), false);
t('角色 agent + 到期时间 0（手工授予没给天数）→ 无效', isAgentActive('agent', 0), false);
t('角色 agent + 到期时间 null → 无效', isAgentActive('agent', null), false);
t('角色 admin → 无效（管理员走原价，另一条分支）', isAgentActive('admin', now + DAY), false);
t('秒级时间戳也能认（10 位）', isAgentActive('agent', Math.floor((now + 5 * DAY) / 1000)), true);
t('Date 对象也能认', isAgentActive('agent', new Date(now + 3 * DAY)), true);
t('字符串毫秒时间戳也能认', isAgentActive('agent', String(now + 2 * DAY)), true);
t('expiryMs(0) = 0', expiryMs(0), 0);
t('expiryMs(非法) = 0', expiryMs('abc'), 0);
t('剩余天数：未来 30 天 → 30', agentDaysLeft(now + 30 * DAY, now), 30);
t('剩余天数：已过期 → 0', agentDaysLeft(now - DAY, now), 0);

console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
