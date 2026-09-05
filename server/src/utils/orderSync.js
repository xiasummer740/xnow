import axios from 'axios';
import { Config, Order, User, Transaction, sequelize } from '../models/index.js';
import { Op } from 'sequelize';

export const autoSyncOrders = async () => {
  try {
    const urlConf = await Config.findOne({ where: { key: 'upstream_url' } });
    const keyConf = await Config.findOne({ where: { key: 'upstream_key' } });
    if (!urlConf?.value || !keyConf?.value) return;

    // 获取所有未完结的订单
    const activeOrders = await Order.findAll({
      where: {
        status: {
          [Op.notIn]: ['已完成', 'Completed', 'Canceled', '已取消', '部分完成', 'Partial']
        }
      }
    });

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
            const statusMap = {
              'Pending': '排队中', 'In progress': '进行中', 'Processing': '处理中',
              'Completed': '已完成', 'Partial': '部分完成', 'Canceled': '已取消'
            };
            let transStatus = statusMap[rawStatus] || rawStatus;

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
                locked.remains = upStatus.remains || locked.remains;

                if (!locked.is_refunded) {
                  const user = await User.findByPk(locked.user_id, { transaction: t });
                  let refundAmount = parseFloat(locked.charge);
                  if (isPartial) {
                    const remainsQty = parseFloat(locked.remains);
                    const totalQty = parseFloat(locked.quantity);
                    refundAmount = (remainsQty > 0 && totalQty > 0) ? (remainsQty / totalQty) * refundAmount : 0;
                  }
                  if (user && refundAmount > 0) {
                    user.balance = parseFloat(user.balance) + refundAmount;
                    await user.save({ transaction: t });
                    await Transaction.create({
                      user_id: user.id, phone: locked.phone, amount: refundAmount,
                      type: '退款入账', description: `${isCancel ? '订单被取消，全额退款' : '订单部分完成，按比例退款'} [单号:${locked.order_no}]`
                    }, { transaction: t });
                  }
                  locked.is_refunded = true;
                }
                await locked.save({ transaction: t });
                await t.commit();
              } catch (e) {
                await t.rollback();
                console.error('❌ [OrderSync] 订单退款事务失败 order=' + order.order_no + ' err=' + ((e && e.message) || e));
              }
            } else {
              order.status = transStatus;
              order.start_count = upStatus.start_count || order.start_count;
              order.remains = upStatus.remains || order.remains;
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
