import axios from 'axios';
import { Config, Order, User, Transaction } from '../models/index.js';
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

            order.status = transStatus;
            order.start_count = upStatus.start_count || order.start_count;
            order.remains = upStatus.remains || order.remains;

            // ⚠️ 核心商业逻辑：全自动售后退款系统
            if (transStatus === '已取消' && !order.is_refunded) {
              const user = await User.findByPk(order.user_id);
              if (user) {
                user.balance = parseFloat(user.balance) + parseFloat(order.charge);
                await user.save();
                await Transaction.create({
                  user_id: user.id, phone: order.phone, amount: parseFloat(order.charge),
                  type: '退款入账', description: `订单被取消，全额退款 [单号:${order.order_no}]`
                });
              }
              order.is_refunded = true;
            } else if (transStatus === '部分完成' && !order.is_refunded) {
              const remainsQty = parseFloat(order.remains);
              const totalQty = parseFloat(order.quantity);
              if (remainsQty > 0 && totalQty > 0) {
                // 计算部分退款金额：(未完成数量 / 总数量) * 总扣费
                const refundAmount = (remainsQty / totalQty) * parseFloat(order.charge);
                const user = await User.findByPk(order.user_id);
                if (user) {
                  user.balance = parseFloat(user.balance) + refundAmount;
                  await user.save();
                  await Transaction.create({
                    user_id: user.id, phone: order.phone, amount: refundAmount,
                    type: '退款入账', description: `订单部分完成，按比例退款 [单号:${order.order_no}]`
                  });
                }
              }
              order.is_refunded = true;
            }

            await order.save();
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ [OrderSync] 同步状态失败:', err.message);
  }
};
