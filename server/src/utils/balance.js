import { sequelize } from '../models/index.js';

// ============================================================================
// 💰 余额原子记账
//
// 为什么需要这个文件：
//   全项目有 7 处改 `users.balance`，只有下单/续费那两处加了 `lock: t.LOCK.UPDATE`。
//   其余全是「快照读 → 加/减 → save()」，而 save() 写的是 `UPDATE users SET balance=快照值`。
//   只要同一用户的另一笔资金动作在下单事务持锁期间完成，这两条 UPDATE 就会互相覆盖：
//     下单扣 100 把余额写成 0 → 充值/退款用**读到的 100** 写成 150 → 服务已交付、钱又回来了。
//   并发 2 个请求就够，不需要压测。
//
// 做法：改成单条 SQL 自增/自减，余额只由数据库算，永远不存在「旧值覆盖新值」。
//   · credit  = `balance = balance + n`（不存在丢更新）
//   · debit   = `balance = balance - n WHERE balance >= n`（不存在扣穿/双花）
//   返回**写完之后**的真实余额，调用方拿它去写流水快照（和旧代码的语义一致）。
//
// ⚠️ 必须在调用方的事务里跑（第二个参数传 transaction），否则回滚时钱不会跟着退。
// ============================================================================

const norm = (v) => Number(Number(v).toFixed(6));

const assertAmount = (amount, kind) => {
  const n = norm(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${kind} 金额非法: ${amount}`);
  return n;
};

const readBalance = async (userId, transaction) => {
  const [[row]] = await sequelize.query(
    'SELECT balance FROM users WHERE id = :id',
    { replacements: { id: Number(userId) }, transaction }
  );
  return row ? row.balance : null;
};

/** 加余额（充值、退款、返佣、分站成本退还）。返回加完之后的余额。 */
export const creditUser = async (userId, amount, { transaction } = {}) => {
  const n = assertAmount(amount, '入账');
  const [res] = await sequelize.query(
    'UPDATE users SET balance = balance + :n WHERE id = :id',
    { replacements: { n, id: Number(userId) }, transaction }
  );
  if (!res || !res.affectedRows) throw new Error(`入账失败，用户不存在: ${userId}`);
  const balance = await readBalance(userId, transaction);
  if (balance === null) throw new Error(`入账后读不到余额: ${userId}`);
  return balance;
};

/** 扣余额（下单、扣成本）。余额不够直接抛 INSUFFICIENT_BALANCE，绝不扣成负数。 */
export const debitUser = async (userId, amount, { transaction } = {}) => {
  const n = assertAmount(amount, '扣款');
  const [res] = await sequelize.query(
    'UPDATE users SET balance = balance - :n WHERE id = :id AND balance >= :n',
    { replacements: { n, id: Number(userId) }, transaction }
  );
  if (!res || !res.affectedRows) {
    const err = new Error('余额不足');
    err.code = 'INSUFFICIENT_BALANCE';
    throw err;
  }
  const balance = await readBalance(userId, transaction);
  if (balance === null) throw new Error(`扣款后读不到余额: ${userId}`);
  return balance;
};

/** 读当前余额（不锁）。只用于展示/报错文案，不要拿它做「够不够」的判断。 */
export const getBalance = async (userId, { transaction } = {}) => readBalance(userId, transaction);

/**
 * 带符号的原子调账（管理员手动调账专用）：`balance = balance + delta`。
 * 与 credit/debit 的区别是**允许结果为负** —— 后台调账历来可以扣成负数，
 * 这里只解决并发覆盖，不改变原有业务语义。
 */
export const applyDelta = async (userId, delta, { transaction } = {}) => {
  const d = Number(Number(delta).toFixed(6));
  if (!Number.isFinite(d) || d === 0) throw new Error(`调账金额非法: ${delta}`);
  const [res] = await sequelize.query(
    'UPDATE users SET balance = balance + :d WHERE id = :id',
    { replacements: { d, id: Number(userId) }, transaction }
  );
  if (!res || !res.affectedRows) throw new Error(`调账失败，用户不存在: ${userId}`);
  const balance = await readBalance(userId, transaction);
  if (balance === null) throw new Error(`调账后读不到余额: ${userId}`);
  return balance;
};

/** 推广返佣：余额与累计返佣一起原子累加，返回 { balance, totalCommission }。 */
export const creditCommission = async (userId, amount, { transaction } = {}) => {
  const n = assertAmount(amount, '返佣');
  const [res] = await sequelize.query(
    `UPDATE users
        SET balance = balance + :n,
            total_commission = COALESCE(total_commission, 0) + :n
      WHERE id = :id`,
    { replacements: { n, id: Number(userId) }, transaction }
  );
  if (!res || !res.affectedRows) throw new Error(`返佣失败，用户不存在: ${userId}`);
  const [[row]] = await sequelize.query(
    'SELECT balance, total_commission FROM users WHERE id = :id',
    { replacements: { id: Number(userId) }, transaction }
  );
  return { balance: row && row.balance, totalCommission: row && row.total_commission };
};

/**
 * 退款比例的唯一口径（三处调用：orderSync 自动退、admin 手工退、siteRefund 站长成本退）。
 *
 * 规则：取消/整单失败 → 1；部分完成 → 剩余比例，**夹取到 [0, 1]**；
 * `remains = 0` 就是 0（一分不退），绝不因为「0 是假值」而当成全额。
 * 历史 bug：siteRefund 写的是 `ratio > 0 ? min(ratio,1) : 1` → 0 被当成 1，客户退 0、站长全退。
 */
export const refundRatioOf = (remains, quantity, isCancel = false) => {
  if (isCancel) return 1;
  const r = Number(remains);
  const q = Number(quantity);
  if (!Number.isFinite(r) || !Number.isFinite(q) || q <= 0) return 0;
  return Math.min(Math.max(r / q, 0), 1);
};

/**
 * 上游回报的「剩余数量」要不要落库。
 *
 * 历史 bug：`locked.remains = upStatus.remains || locked.remains` —— `0` 是假值，
 * 于是「上游说剩 0（全部交付）」永远落不进去，订单一直停在旧值上，退款比例跟着算错。
 * 这里只认 `undefined/null` 为「上游没给」，`0` 是**合法值**。
 */
export const nextRemains = (upValue, prevValue) =>
  (upValue === undefined || upValue === null || upValue === '') ? prevValue : upValue;
