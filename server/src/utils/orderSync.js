import axios from 'axios';
import { Config, Order, User, Transaction, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import refundSiteCost from './siteRefund.js';
import { refundOrderFully } from './orderRefund.js';
import { creditUser, refundRatioOf, nextRemains } from './balance.js';
import { sendTgMessage } from './tgBot.js';

// 🧹 清扫「提交中」僵尸单（2026-11-03 两阶段下单的配套动作）
//   下单被拆成：阶段 A（扣款+建单并提交）→ 阶段 B（调上游回填单号）。
//   如果进程在两步之间被 pm2 重启 / 被 OOM 杀掉，或者上游超时后连接异常退出，
//   订单就会永远停在 status='提交中' 且 upstream_order_id 为空 ——
//   **客户的钱已经扣了，单子却永远不会动，而且没有任何地方会报错**。
//   这里每轮把超过 10 分钟的这种单全额退回（is_refunded 保证只退一次）。
const STUCK_MINUTES = 10;
const sweepStuckSubmitting = async () => {
  try {
    const stuck = await Order.findAll({
      where: {
        status: '提交中',
        upstream_order_id: null,
        createdAt: { [Op.lt]: new Date(Date.now() - STUCK_MINUTES * 60 * 1000) },
      },
      attributes: ['id', 'order_no'],
      limit: 100,
    });
    for (const s of stuck) {
      const r = await refundOrderFully(s.id, { reason: '订单未能提交，已全额退款' });
      console.log(`🧹 [OrderSync] 清扫提交中僵尸单 ${s.order_no} → ${r.ok ? '已退款' : '退款失败(需人工)'}`);
    }
  } catch (e) {
    console.error('❌ [OrderSync] 清扫僵尸单失败:', (e && e.message) || e);
  }
};

export const autoSyncOrders = async () => {
  await sweepStuckSubmitting();
  try {
    const urlConf = await Config.findOne({ where: { key: 'upstream_url' } });
    const keyConf = await Config.findOne({ where: { key: 'upstream_key' } });
    if (!urlConf?.value || !keyConf?.value) return;

    // 获取所有未完结的订单
    // ⚠️ 必须过滤掉 upstream_order_id 为空的：两阶段下单在阶段 A 建的单子上游还没有号，
    //    把它们拼进 `orders=` 查询串会变成 "null"（上游直接报错）或误查别人的单。
    const activeOrders = (await Order.findAll({
      where: {
        status: {
          [Op.notIn]: ['已完成', 'Completed', 'Canceled', '已取消', '部分完成', 'Partial', '已退款']
        }
      }
    })).filter(o => o.upstream_order_id);

    if (activeOrders.length === 0) return;

    // 上游 API 要求最多 100 个 ID 一次查询
    const chunkSize = 100;
    for (let i = 0; i < activeOrders.length; i += chunkSize) {
      const chunk = activeOrders.slice(i, i + chunkSize);
      const orderIds = chunk.map(o => o.upstream_order_id).join(',');

      const payload = new URLSearchParams({ key: keyConf.value, action: 'status', orders: orderIds });
      
      const res = await axios.post(urlConf.value, payload.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const upData = res.data;
      if (upData && typeof upData === 'object' && !upData.error) {
        for (const order of chunk) {
          const upStatus = upData[order.upstream_order_id];
          if (upStatus && !upStatus.error) {
            let rawStatus = upStatus.status;

            // 状态汉化映射
            // ⚠️ 上游的状态词比想象中多，这张表漏一个，客户界面就露一个英文单词。
            //    2026-11-07 生产库里抓到 status='Active' 直接展示给了客户（订单 47），
            //    因为表里只有 In progress / Processing，没有 Active。补上。
            const statusMap = {
              'Pending': '排队中', 'In progress': '进行中', 'Processing': '处理中',
              'Active': '进行中', 'Running': '进行中', 'Queued': '排队中', 'In Progress': '进行中',
              'Completed': '已完成', 'Complete': '已完成', 'Partial': '部分完成',
              // 上游两种拼法都出现过（Canceled / Cancelled），漏一个客户界面就会露英文
              'Canceled': '已取消', 'Cancelled': '已取消', 'Canceled ': '已取消',
              'Fail': '已取消', 'Failed': '已取消', 'Refunded': '已退款'
            };
            let transStatus = statusMap[rawStatus] || rawStatus;

            // ⚠️ 未识别状态**必须原样保留**，绝不能压成「处理中」：
            //    万一上游冒出个新的完成类状态（比如 Finished），压成「处理中」会让订单
            //    永远停在未完结状态，客户的钱一直被占着 —— 那比界面上露个英文单词严重得多。
            //    所以这里的策略是：能映射就映射，映射不了就存原文 + 打日志等人补表。
            if (!statusMap[rawStatus]) {
              console.warn(`[OrderSync] 未识别的上游状态 "${rawStatus}"（order=${order.order_no}），已按原文保存，请补 statusMap`);
            }

            const isCancel = transStatus === '已取消';
            const isPartial = transStatus === '部分完成';

            // 非退款路径：轻量只刷状态（保持热路径开销不变）
            if (!order.is_refunded && (isCancel || isPartial)) {
              // 🔒 退款 = 动钱，必须事务 + 行锁原子化：
              // 余额增加、流水落账、is_refunded 置位在同一事务里提交，
              // 中途崩溃也不会出现「钱退了标记没写 → 下轮重复退」的双重退款。
              const t = await sequelize.transaction();
              try {
                const locked = await Order.findByPk(order.id, { transaction: t, lock: t.LOCK.UPDATE });
                if (!locked) { await t.rollback(); continue; }
                locked.status = transStatus;
                locked.start_count = upStatus.start_count || locked.start_count;
                // `0` 是合法值（上游说「一个都不剩」），不能用 || 短路掉
                locked.remains = nextRemains(upStatus.remains, locked.remains);

                if (!locked.is_refunded) {
                  const user = await User.findByPk(locked.user_id, { transaction: t });
                  // 比例口径统一走 refundRatioOf：部分完成 = 剩余比例，夹取到 [0,1]，
                  // remains=0 就是一分不退（以前这里算出 0，而 siteRefund 把 0 当 1 → 站长成本全额退）
                  const ratio = isCancel ? 1 : refundRatioOf(locked.remains, locked.quantity, false);
                  const refundAmount = Number(((isPartial || isCancel ? ratio : 1) * parseFloat(locked.charge || 0)).toFixed(6));
                  if (user && refundAmount > 0) {
                    // 🔒 原子加余额：绝不能用「读到的旧值 + 退了多少钱」再 save() 覆盖
                    const newBalance = await creditUser(user.id, refundAmount, { transaction: t });
                    await Transaction.create({
                      user_id: user.id, phone: locked.phone, amount: refundAmount, balance: newBalance,
                      type: '退款入账', description: `${isCancel ? '订单被取消，全额退款' : '订单部分完成，按比例退款'} [单号:${locked.order_no}]`,
                      site_id: parseInt(locked.site_id || 0)
                    }, { transaction: t });
                  }
                  // 🏬 分站订单：站长已付的进货成本必须同步退回，
                  //    否则每取消一单站长白亏一次，钱静默变成平台利润。
                  try {
                    await refundSiteCost(locked, ratio, { transaction: t, User, Transaction });
                  } catch (e) {
                    console.error('❌ [OrderSync] 分站成本退还失败 order=' + locked.order_no + ' err=' + ((e && e.message) || e));
                    throw e;   // 同一事务内，回滚以保证「客户退、站长也退」要么都成
                  }
                  locked.is_refunded = true;
                  // 💬 给客户看的原因。上游取消时只回 status=Canceled，**不给具体原因**，
                  //    所以我们只能给「最可能是这几种」的自查指引 —— 但必须写清楚，
                  //    否则客户只看到「已退款」，会认定是平台不行，转头就去别家。
                  //    ⚠️ 客户可见文案里不能出现「上游/供应商/渠道商」。
                  locked.refund_reason = isCancel
                    ? '投放未能完成，已全额退款。常见原因：链接不符合要求（涨粉类需填主页链接或用户名，不能用视频链接）、或同一链接重复下单。修正后可直接重新下单。'
                    : `按未完成数量比例退款 ${Number(refundAmount || 0).toFixed(2)} 元`;
                }
                await locked.save({ transaction: t });
                await t.commit();

                // 📣 上游取消 / 部分完成 = 已经动了客户的钱，必须播报。
                //    以前这些单在后台静默变成「已取消」，客户来问才知道，
                //    财务对账时也看不出是哪一单退的钱。
                //
                // 🔴 2026-11-06 补充「谁取消的」：祥哥收到播报后问「是用户自己取消的，
                //    还是谁取消的」—— 说明只说「上游同步」等于没说。
                //    事实是：本站（客户侧 + 管理密室）**根本没有取消订单的接口和按钮**，
                //    服务订单变成「已取消」只可能来自上游，这一点必须直接写进消息里，
                //    否则每次都要人工回忆一遍。
                try {
                  const amt = Number(locked.charge || 0);
                  const ratio2 = isCancel ? 1 : refundRatioOf(locked.remains, locked.quantity, false);
                  const back = Number(((ratio2 || 0) * amt).toFixed(2));
                  const bal = await User.findByPk(locked.user_id, { attributes: ['balance', 'phone'] });

                  const pad = (n) => String(n).padStart(2, '0');
                  const fmtT = (d) => {
                    const x = new Date(d);
                    return `${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
                  };
                  const durT = (ms) => {
                    const m = Math.max(0, Math.round(ms / 60000));
                    return m < 60 ? `${m} 分钟` : `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
                  };

                  const startAt = locked.created_at;
                  const endAt = new Date();
                  const did = Math.max(0, Number(locked.quantity || 0) - Number(locked.remains || 0));
                  const upCharge = Number(upStatus && upStatus.charge != null ? upStatus.charge : 0);
                  // 上游收了我们多少成本：收 0 = 这单上游也退款了，我们没实际损失
                  const upChargeLine = upCharge > 0
                    ? `上游结算：￥${upCharge.toFixed(2)}（上游已扣成本）`
                    : `上游结算：￥0.00（上游未收费，这单我们没实际损失）`;

                  sendTgMessage(
                    `${isCancel ? '🚫' : '⚠️'} <b>${isCancel ? '订单被上游取消' : '订单部分完成'}</b>\n` +
                    `单号：<code>${locked.order_no}</code>\n` +
                    `商品：${locked.service_name || ''}\n` +
                    `数量：${locked.quantity}　进度：已做 ${did} / 剩 ${locked.remains}\n` +
                    `原扣费：￥${amt.toFixed(2)}\n` +
                    `<b>退款：￥${back.toFixed(2)}</b> → 客户余额 ￥${bal ? Number(bal.balance).toFixed(2) : '—'}\n` +
                    `${upChargeLine}\n` +
                    `客户：${(bal && bal.phone) || locked.user_id}\n` +
                    `━━━━━━━━━━━━━━\n` +
                    `⏱ 下单 ${fmtT(startAt)} → 取消 ${fmtT(endAt)}，历时 ${durT(endAt - new Date(startAt))}\n` +
                    `🔍 <b>取消方：上游系统</b>\n` +
                    `　 本站没有「取消订单」入口 —— 客户点不了，管理密室也没有这个功能，\n` +
                    `　 所以不可能是客户自己取消的，只可能是上游侧动作。\n` +
                    `❗ 上游只回了 <code>status=Canceled</code>，<b>没给取消原因</b>，\n` +
                    `　 要知道为什么得去上游后台看，或者直接问上游。`
                  );
                } catch (e) {
                  console.error('[OrderSync] TG 播报失败:', (e && e.message) || e);
                }
              } catch (e) {
                await t.rollback();
                console.error('❌ [OrderSync] 订单退款事务失败 order=' + order.order_no + ' err=' + ((e && e.message) || e));
              }
            } else {
              order.status = transStatus;
              order.start_count = upStatus.start_count || order.start_count;
              order.remains = nextRemains(upStatus.remains, order.remains);
              await order.save();
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ [OrderSync] 同步状态失败:', err.message);
  }
};
