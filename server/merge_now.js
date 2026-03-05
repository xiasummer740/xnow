import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 💡 核心修复：显式加载 .env，确保脚本拥有数据库至高权限
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import { User, Order, Transaction } from './src/models/index.js';

async function runMerge() {
    console.log('🚀 正在连接数据库，准备执行无损数据合并...');
    try {
        const users = await User.findAll();
        const phoneMap = {};

        // 按手机号分组（唯一性最强特征）
        for (const u of users) {
            if (!phoneMap[u.phone]) phoneMap[u.phone] = [];
            phoneMap[u.phone].push(u);
        }

        let mergeCount = 0;

        for (const phone in phoneMap) {
            const group = phoneMap[phone];
            if (group.length > 1) {
                console.log(`\n⚠️ 发现重复手机号: [${phone}]，共 ${group.length} 个账号分身`);
                
                // 按 ID 升序，保留最早注册的作为主账号
                group.sort((a, b) => a.id - b.id);
                const mainUser = group[0];
                const dupes = group.slice(1);

                for (const dupe of dupes) {
                    console.log(`   🔄 正在将分身 [UID: ${dupe.id}] 的资产合并至主账号 [UID: ${mainUser.id}] ...`);

                    // 1. 合并余额与佣金 (确保十进制精度不丢失)
                    mainUser.balance = (parseFloat(mainUser.balance) + parseFloat(dupe.balance)).toFixed(6);
                    mainUser.total_commission = (parseFloat(mainUser.total_commission) + parseFloat(dupe.total_commission)).toFixed(6);

                    // 2. 转移订单记录
                    await Order.update({ user_id: mainUser.id, phone: mainUser.phone }, { where: { user_id: dupe.id } });

                    // 3. 转移资金流水
                    await Transaction.update({ user_id: mainUser.id, phone: mainUser.phone }, { where: { user_id: dupe.id } });

                    // 4. 物理销毁克隆分身
                    await dupe.destroy();
                    console.log(`   ✅ 分身 [UID: ${dupe.id}] 已成功物理销毁！`);
                    mergeCount++;
                }
                // 保存主账号最终状态
                await mainUser.save();
                console.log(`   🏆 主账号 [UID: ${mainUser.id}] 资产合并保存成功！当前总余额: ¥ ${mainUser.balance}`);
            }
        }
        
        if (mergeCount === 0) {
            console.log('\n🎉 扫描完毕，当前数据库非常纯净，没有发现需要合并的重复账号。');
        } else {
            console.log(`\n🎉 伟大的手术完成！共成功清理了 ${mergeCount} 个幽灵分身，所有资产已安全转移！`);
        }
        process.exit(0);
    } catch (e) {
        console.error('\n❌ 合并过程中发生致命错误:', e);
        process.exit(1);
    }
}

runMerge();
