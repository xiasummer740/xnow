<script setup>
import { ref, onMounted, computed } from 'vue';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui';

const userStore = useUserStore();
const uiStore = useUiStore();

const loading = ref(true);
const stats = ref({ rate: 0.05, total_commission: 0, invitees: [], commissions: [] });
const activeTab = ref('invitees');
// 💡 核心修复：使用响应式变量安全地存储域名，避免在 template 中直接调用 window 导致渲染崩溃
const currentDomain = ref('');

const fetchStats = async () => {
    try {
        const res = await fetch('/api/user/affiliate-stats', { headers: { 'Authorization': `Bearer ${userStore.token}` } });
        const json = await res.json();
        if (json.status === 'success') { stats.value = json; }
    } catch (e) { uiStore.showToast('无法拉取分销数据', 'error'); }
    loading.value = false;
};

// 💡 安全计算邀请链接
const myInviteLink = computed(() => {
    if (!currentDomain.value) return '';
    return `${currentDomain.value}/?ref=${userStore.userInfo?.id || ''}`;
});

const copyLink = () => {
    if (!myInviteLink.value) return;
    navigator.clipboard.writeText(myInviteLink.value).then(() => {
        uiStore.showToast('推广专属链接已复制，快去发给好友赚钱吧！', 'success');
    }).catch(() => {
        uiStore.showToast('复制失败，请手动全选复制', 'error');
    });
};

const formatDate = (iso) => new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

onMounted(() => {
    // 💡 确保在 DOM 挂载后，window 对象绝对可用时再获取域名
    currentDomain.value = window.location.origin;
    fetchStats();
});
</script>

<template>
    <div class="max-w-5xl mx-auto pb-20 relative z-10 animate-fade-in space-y-6">
        <div class="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-8 md:p-10 shadow-[0_20px_50px_rgba(245,158,11,0.3)] relative overflow-hidden text-slate-900 flex flex-col md:flex-row justify-between items-center gap-8">
            <div class="absolute -right-10 -bottom-10 text-9xl opacity-20 transform -rotate-12 pointer-events-none font-black">💰</div>
            <div class="z-10 text-center md:text-left space-y-2">
                <h2 class="text-3xl md:text-4xl font-black tracking-wider">全民躺赚计划</h2>
                <p class="text-amber-900 font-bold opacity-90">发送专属链接，每笔充值永久享有 <span class="bg-black text-amber-400 px-2 py-0.5 rounded-lg text-xl">{{ stats.rate * 100 }}%</span> 高额提成！</p>
                <div class="mt-6">
                    <p class="text-sm font-bold opacity-80 uppercase tracking-widest mb-1">您的累计净赚佣金</p>
                    <div class="text-5xl md:text-6xl font-black font-mono tracking-tighter drop-shadow-md">
                        <span class="text-2xl mr-1 relative -top-3">¥</span>{{ parseFloat(stats.total_commission).toFixed(2) }}
                    </div>
                </div>
            </div>
            
            <div class="z-10 w-full md:w-auto bg-black/20 backdrop-blur-md border border-white/20 p-5 rounded-2xl shadow-inner">
                <p class="text-sm font-bold text-white mb-2">👇 您的专属财富密码链接</p>
                <div class="flex items-center bg-black/40 rounded-xl p-1 border border-white/10">
                    <input type="text" readonly :value="myInviteLink" class="bg-transparent text-amber-200 font-mono text-sm px-3 py-2 w-full md:w-64 outline-none select-all cursor-text" placeholder="生成中...">
                    <button @click="copyLink" class="bg-amber-400 hover:bg-amber-300 text-slate-900 font-black px-4 py-2 rounded-lg transition transform hover:scale-105 shadow-md">一键复制</button>
                </div>
            </div>
        </div>

        <div class="bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-3xl shadow-xl overflow-hidden min-h-[400px] relative">
            <div v-if="loading" class="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/50"><div class="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div></div>
            
            <div class="flex border-b border-slate-700 bg-slate-900/50">
                <button @click="activeTab = 'invitees'" :class="['flex-1 py-4 font-bold text-sm transition', activeTab === 'invitees' ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-800' : 'text-slate-400 hover:text-slate-300']">👥 我邀请的下线 ({{ stats.invitees.length }}人)</button>
                <button @click="activeTab = 'commissions'" :class="['flex-1 py-4 font-bold text-sm transition', activeTab === 'commissions' ? 'text-green-400 border-b-2 border-green-400 bg-slate-800' : 'text-slate-400 hover:text-slate-300']">💸 佣金入账明细 ({{ stats.commissions.length }}笔)</button>
            </div>

            <div class="p-0 overflow-x-auto custom-scrollbar">
                <table v-if="activeTab === 'invitees'" class="w-full text-left text-sm whitespace-nowrap">
                    <thead class="bg-slate-900/30 text-xs uppercase text-slate-500"><tr><th class="px-6 py-4">注册时间</th><th class="px-6 py-4">下线 UID</th><th class="px-6 py-4">脱敏账号</th></tr></thead>
                    <tbody class="divide-y divide-slate-700/50 text-slate-300">
                        <tr v-for="user in stats.invitees" :key="user.uid" class="hover:bg-slate-700/30 transition">
                            <td class="px-6 py-4 font-mono text-xs text-slate-400">{{ formatDate(user.time) }}</td>
                            <td class="px-6 py-4 font-bold"><span class="bg-slate-700 px-2 py-1 rounded text-xs">UID {{ user.uid }}</span></td>
                            <td class="px-6 py-4 text-blue-400 font-mono">{{ user.phone }}</td>
                        </tr>
                        <tr v-if="stats.invitees.length === 0"><td colspan="3" class="text-center py-16 text-slate-500 font-bold">您还没有邀请任何人，快去推广吧！</td></tr>
                    </tbody>
                </table>

                <table v-if="activeTab === 'commissions'" class="w-full text-left text-sm whitespace-nowrap">
                    <thead class="bg-slate-900/30 text-xs uppercase text-slate-500"><tr><th class="px-6 py-4">入账时间</th><th class="px-6 py-4">收益来源说明</th><th class="px-6 py-4 text-right">佣金金额</th></tr></thead>
                    <tbody class="divide-y divide-slate-700/50 text-slate-300">
                        <tr v-for="tx in stats.commissions" :key="tx.id" class="hover:bg-slate-700/30 transition">
                            <td class="px-6 py-4 font-mono text-xs text-slate-400">{{ formatDate(tx.createdAt) }}</td>
                            <td class="px-6 py-4 text-slate-300">{{ tx.description }}</td>
                            <td class="px-6 py-4 text-right font-black text-green-400 font-mono">+ ￥{{ parseFloat(tx.amount).toFixed(2) }}</td>
                        </tr>
                        <tr v-if="stats.commissions.length === 0"><td colspan="3" class="text-center py-16 text-slate-500 font-bold">暂无佣金入账记录</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
