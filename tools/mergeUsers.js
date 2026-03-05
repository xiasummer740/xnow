import { Sequelize, Op } from 'sequelize';
import { User, Order, Transaction } from '../server/src/models/index.js';

const mergeDuplicates = async () => {
  try {
    console.log('⏳ 开始扫描并合并重复的邮箱/手机号账户...');
    
    // 找出重复的邮箱
    const users = await User.findAll();
    const emailGroups = {};
    const phoneGroups = {};

    users.forEach(u => {
      if (u.email) { emailGroups[u.email] = emailGroups[u.email] || []; emailGroups[u.email].push(u); }
      if (u.phone) { phoneGroups[u.phone] = phoneGroups[u.phone] || []; phoneGroups[u.phone].push(u); }
    });

    const processMerge = async (groups) => {
      for (const key in groups) {
        if (groups[key].length > 1) {
          // 按照注册时间排序，保留最早的 (主账号)
          const sorted = groups[key].sort((a, b) => a.id - b.id);
          const mainUser = sorted[0];
          const duplicates = sorted.slice(1);

          for (const dupe of duplicates) {
            console.log(`🔄 正在合并 UID [${dupe.id}] 到主账号 UID [${mainUser.id}] ...`);
            
            // 资产转移累加
            mainUser.balance = (parseFloat(mainUser.balance) + parseFloat(dupe.balance)).toFixed(6);
            mainUser.total_commission = (parseFloat(mainUser.total_commission) + parseFloat(dupe.total_commission)).toFixed(6);
            await mainUser.save();

            // 订单归属权转移
            await Order.update({ user_id: mainUser.id, phone: mainUser.phone }, { where: { user_id: dupe.id } });
            
            // 交易流水归属权转移
            await Transaction.update({ user_id: mainUser.id, phone: mainUser.phone }, { where: { user_id: dupe.id } });

            // 物理销毁克隆分身
            await dupe.destroy();
            console.log(`✅ 克隆分身 UID [${dupe.id}] 已成功销毁，资产已转移！`);
          }
        }
      }
    };

    await processMerge(emailGroups);
    await processMerge(phoneGroups);
    
    console.log('🎉 存量数据清洗与合并完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 合并失败:', error);
    process.exit(1);
  }
};

mergeDuplicates();
