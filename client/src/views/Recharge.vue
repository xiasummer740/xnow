<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui'; 
import { useAppStore } from '../stores/app';

const userStore = useUserStore();
const ui = useUiStore();
const app = useAppStore();

const payType = ref('wechat');
const amount = ref(10);
const loading = ref(false);
const txs = ref([]);

const isRMB = computed(() => payType.value === 'wechat' || payType.value === 'alipay');

const showPayModal = ref(false);
const currentOrderId = ref('');
const currentAoid = ref('');
const payUrl = ref('');
const payParams = ref({});
let pollTimer = null;

// 💡 核心新增：USDT 教程图相关状态
const usdtImageUrl = ref('');
const showLightbox = ref(false);

const fetchPublicConfig = async () => {
    try {
        const res = await fetch(`/api/public/config?_t=${Date.now()}`);
        const json = await res.json();
        if (json.status === 'success' && json.data) {
            usdtImageUrl.value = json.data.usdt_image_url || '';
        }
    } catch (e) {}
};

const fetchTransactions = async () => {
    try {
        const res = await fetch(`/api/transactions?_t=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${userStore.token}` }
        });
        const json = await res.json();
        if (json.status === 'success') txs.value = json.data;
    } catch (e) {}
};

const handleIframeMessage = async (event) => {
    if (event.data && event.data.type === 'pay_success') {
        closeModal();
        const userRes = await fetch('/api/user/status', { headers: { 'Authorization': `Bearer ${userStore.token}` } });
        const userJson = await userRes.json();
        if (userJson.status === 'success') {
            userStore.updateUserInfo({ balance: userJson.balance });
        }
        fetchTransactions();
        ui.showToast('充值成功，资金已到账！', 'success');
    }
};

onMounted(() => {
    fetchTransactions();
    fetchPublicConfig(); // 💡 独立拉取公开配置
    window.addEventListener('message', handleIframeMessage);
});

onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer);
    window.removeEventListener('message', handleIframeMessage);
});

const closeModal = () => {
    showPayModal.value = false;
    if (pollTimer) clearInterval(pollTimer);
    fetchTransactions(); 
};

const checkStatus = async () => {
    if (!currentOrderId.value) return;
    try {
        const res = await fetch(`/api/pay/status?aoid=${currentAoid.value || ''}&order_id=${currentOrderId.value}&amount=${amount.value}`, {
            headers: { 'Authorization': `Bearer ${userStore.token}` }
        });
        const json = await res.json();
        
        if (json.status === 'success') {
            closeModal();
            const userRes = await fetch('/api/user/status', { headers: { 'Authorization': `Bearer ${userStore.token}` } });
            const userJson = await userRes.json();
            if (userJson.status === 'success') {
                userStore.updateUserInfo({ balance: userJson.balance });
            }
            fetchTransactions();
            ui.showToast('充值成功，资金已到账！', 'success');
        }
    } catch (e) {}
};

const handlePay = async () => {
    if (amount.value <= 0) return ui.showToast('充值金额无效', 'error');
    loading.value = true;

    try {
        if (isRMB.value) {
            const signRes = await fetch('/api/pay/rmb/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
                body: JSON.stringify({ pay_type: payType.value, amount: amount.value })
            });
            const signData = await signRes.json();
            if (signData.status !== 'success') {
                loading.value = false;
                return ui.showToast(signData.message || '获取签名失败', 'error');
            }
            currentOrderId.value = signData.order_id;
            currentAoid.value = ''; 
            payUrl.value = signData.target_url;
            payParams.value = signData.params;
            showPayModal.value = true;
            nextTick(() => { const form = document.getElementById('bufpay_form'); if (form) form.submit(); });
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = setInterval(checkStatus, 3000); 

        } else {
            const res = await fetch('/api/pay/usd', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
                body: JSON.stringify({ amount: amount.value })
            });
            const json = await res.json();
            if (json.status === 'success' && json.url) {
                ui.showToast('正在前往 Cryptomus...', 'success');
                setTimeout(() => window.location.href = json.url, 1000);
            } else {
                ui.showAlert(json.message || 'Error', '系统提示');
            }
        }
    } catch (e) {
        ui.showAlert('网络请求异常', '系统提示');
    }
    loading.value = false;
};

const manualJump = () => {
    const form = document.getElementById('bufpay_form');
    if (form) {
        const originalTarget = form.target;
        form.target = '_blank';
        form.submit();
        form.target = originalTarget;
    }
};

const formatTime = (isoString) => {
    if (!isoString) return '--';
    try {
        return new Date(isoString).toLocaleString('zh-CN', { 
            year: 'numeric', month: '2-digit', day: '2-digit', 
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false, timeZone: 'Asia/Shanghai' 
        });
    } catch (e) { return isoString; }
};

const cleanDescription = (t) => {
    if (t.type === '后台调账') return t.amount > 0 ? '全站活动/签到福利系统赠送' : '系统合规扣除';
    if (t.type && t.type.includes('充值')) return `${t.type}成功`;
    if (t.description) return t.description.replace(/\[单号:[^\]]+\]/g, '').trim() || t.type;
    return t.type;
};
</script>

<template>
    <div class="max-w-6xl mx-auto pb-20 relative z-10">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
                <h2 class="text-2xl font-black text-white flex items-center tracking-wide">
                    <span class="mr-3 text-blue-400">💎</span> {{ app.t('recharge_title') }}
                </h2>
                <p class="text-slate-400 text-sm mt-1">{{ app.t('recharge_desc') }}</p>
            </div>
            <div class="mt-4 md:mt-0 bg-slate-800/80 border border-slate-700 p-3 rounded-xl shadow-lg backdrop-blur-sm text-right">
                <div class="text-[10px] text-slate-500 font-bold mb-0.5 uppercase tracking-wider">Exchange Rate</div>
                <div class="text-amber-400 font-black font-mono tracking-tight">1 USD ≈ {{ app.exchangeRate }} CNY</div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div class="lg:col-span-2 bg-slate-800/80 p-6 md:p-8 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden">
                <div class="space-y-8">
                    <div>
                        <label class="block text-sm font-bold text-slate-300 mb-4">{{ app.t('select_pay') }}</label>
                        <div class="grid grid-cols-3 gap-3 md:gap-4">
                            <button @click="payType = 'wechat'" :class="['py-4 rounded-xl md:rounded-2xl border-2 flex flex-col items-center justify-center transition transform', payType === 'wechat' ? 'border-green-500 bg-green-500/10 scale-105 shadow-[0_0_20px_rgba(34,197,94,0.2)]' : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:bg-slate-800']"><svg class="w-6 h-6 md:w-8 h-8 mb-2" :class="payType === 'wechat' ? 'text-green-500' : 'text-slate-500'" fill="currentColor" viewBox="0 0 24 24"><path d="M8.5 13.5c-1.9 0-3.5-1.3-3.5-3s1.6-3 3.5-3 3.5 1.3 3.5 3-1.6 3-3.5 3zm7 1.5c-1.4 0-2.5-1-2.5-2.2s1.1-2.2 2.5-2.2 2.5 1 2.5 2.2-1.1 2.2-2.5 2.2zM12 2C6.5 2 2 5.6 2 10c0 2.4 1.3 4.5 3.4 5.9L4 18.5l2.6-1.3c1.6.7 3.4 1.1 5.4 1.1 5.5 0 10-3.6 10-8S17.5 2 12 2z"/></svg><span class="text-xs md:text-sm font-bold" :class="payType === 'wechat' ? 'text-green-500' : ''">{{ app.t('wechat') }}</span></button>
                            <button @click="payType = 'alipay'" :class="['py-4 rounded-xl md:rounded-2xl border-2 flex flex-col items-center justify-center transition transform', payType === 'alipay' ? 'border-blue-500 bg-blue-500/10 scale-105 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:bg-slate-800']"><svg class="w-6 h-6 md:w-8 h-8 mb-2" :class="payType === 'alipay' ? 'text-blue-500' : 'text-slate-500'" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg><span class="text-xs md:text-sm font-bold" :class="payType === 'alipay' ? 'text-blue-500' : ''">{{ app.t('alipay') }}</span></button>
                            <button @click="payType = 'usdt'" :class="['py-4 rounded-xl md:rounded-2xl border-2 flex flex-col items-center justify-center transition transform', payType === 'usdt' ? 'border-amber-400 bg-amber-400/10 scale-105 shadow-[0_0_20px_rgba(251,191,36,0.2)]' : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:bg-slate-800']"><svg class="w-6 h-6 md:w-8 h-8 mb-2" :class="payType === 'usdt' ? 'text-amber-400' : 'text-slate-500'" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 16v-2.5h-3v-2h3v-2h3V7h2v2.5h3v2h-3v2h3v2h-3V18h-2z"/></svg><span class="text-xs md:text-sm font-bold" :class="payType === 'usdt' ? 'text-amber-400' : ''">{{ app.t('usdt') }}</span></button>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-slate-300 mb-3">{{ app.t('recharge_amount') }} ({{ isRMB ? 'CNY' : 'USD' }})</label>
                        <input type="number" v-model="amount" class="w-full bg-slate-900/80 border border-slate-600 rounded-xl p-4 text-white font-mono text-xl outline-none focus:border-amber-400 transition">
                    </div>

                    <div class="flex items-center justify-between bg-slate-900/50 p-5 rounded-2xl border border-slate-700/50">
                        <div>
                            <div class="text-xs text-slate-500 mb-1">{{ app.t('actual_pay') }}</div>
                            <div class="text-lg md:text-2xl font-black text-red-400">
                                <span v-if="isRMB && amount >= 500"><span class="line-through text-slate-500 text-sm mr-2">¥ {{ (amount * 1.05).toFixed(2) }}</span>¥ {{ parseFloat(amount).toFixed(2) }}</span>
                                <span v-else-if="isRMB && amount < 500">¥ {{ (amount * 1.05).toFixed(2) }}</span>
                                <span v-else>$ {{ parseFloat(amount).toFixed(2) }}</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-slate-500 mb-1">{{ app.t('actual_get') }}</div>
                            <div class="text-lg md:text-2xl font-black text-green-400">
                                <span v-if="isRMB">¥ {{ parseFloat(amount).toFixed(2) }}</span>
                                <span v-else>¥ {{ (amount * app.exchangeRate).toFixed(2) }}</span>
                            </div>
                        </div>
                    </div>

                    <button @click="handlePay" :disabled="loading" class="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-black text-xl py-5 rounded-2xl transition transform hover:-translate-y-1 shadow-[0_10px_30px_rgba(251,191,36,0.3)] disabled:opacity-50">
                        {{ loading ? '正在连接收银台...' : app.t('pay_btn') }}
                    </button>
                </div>
            </div>

            <div class="space-y-6">
                <div v-if="isRMB" class="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 shadow-xl backdrop-blur-sm">
                    <h3 class="text-white font-bold mb-4 flex items-center"><span class="text-blue-400 mr-2">ℹ️</span> {{ app.t('rmb_desc_title') }}</h3>
                    <p class="text-xs leading-relaxed text-slate-300 mb-4 text-justify">
                        {{ app.t('rmb_desc_1') }}<strong class="text-red-400">{{ app.t('rmb_desc_2') }}</strong>{{ app.t('rmb_desc_3') }}<strong class="text-green-400">{{ app.t('rmb_desc_4') }}</strong>{{ app.t('rmb_desc_5') }}
                    </p>
                    <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-400 font-medium">{{ app.t('rmb_tip') }}</div>
                </div>
                <div v-else class="bg-slate-800/80 border border-amber-500/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(251,191,36,0.1)] backdrop-blur-sm">
                    <h3 class="text-white font-bold mb-4 flex items-center"><span class="text-amber-400 mr-2">⚡</span> {{ app.t('usd_desc_title') }}</h3>
                    <p class="text-xs leading-relaxed text-slate-300 mb-4">
                        {{ app.t('usd_desc_1') }}<strong class="text-amber-400">{{ app.t('usd_desc_2') }}</strong>{{ app.t('usd_desc_3') }}
                    </p>
                    <a href="https://www.trxyes.com/" target="_blank" class="block bg-slate-900 border border-amber-500 text-amber-400 text-xs font-bold py-3 text-center rounded-xl hover:bg-amber-500 hover:text-black transition mb-4">{{ app.t('usd_btn') }}</a>
                    
                    <div v-if="usdtImageUrl" class="mt-6 relative group cursor-zoom-in overflow-hidden rounded-xl border border-slate-700 shadow-lg" @click="showLightbox = true">
                        <img :src="usdtImageUrl" class="w-full h-auto object-cover transition duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100" />
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center backdrop-blur-[2px]">
                            <span class="text-white text-3xl drop-shadow-lg animate-pulse">🔍</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
            <h3 class="text-xl font-bold text-white mb-6 flex items-center"><span class="text-blue-400 mr-2">🧾</span> 资金明细追踪表</h3>
            <div class="overflow-x-auto custom-scrollbar">
                <table class="w-full text-left text-sm whitespace-nowrap">
                    <thead class="bg-slate-900/50 text-xs uppercase text-slate-400">
                        <tr><th class="px-6 py-4">时间</th><th class="px-6 py-4">类型</th><th class="px-6 py-4">变动金额</th><th class="px-6 py-4">当前余额</th><th class="px-6 py-4">摘要</th></tr>
                    </thead>
                    <tbody class="divide-y divide-slate-700/50 text-slate-200">
                        <tr v-for="t in txs" :key="t.id" class="hover:bg-slate-700/30 transition">
                            <td class="px-6 py-4 font-mono text-xs text-slate-400">{{ formatTime(t.createdAt || t.created_at) }}</td>
                            <td class="px-6 py-4">
                                <span v-if="t.type === '后台调账' && t.amount > 0" class="px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold">系统赠送</span>
                                <span v-else-if="t.type === '后台调账' && t.amount < 0" class="px-2 py-1 rounded bg-pink-500/20 text-pink-400 border border-pink-500/30 text-[10px] font-bold">系统扣除</span>
                                <span v-else-if="t.amount > 0" class="px-2 py-1 rounded bg-green-500/20 text-green-400 text-[10px] font-bold">{{ t.type && t.type.includes('充值') ? t.type : '资金入账' }}</span>
                                <span v-else class="px-2 py-1 rounded bg-red-500/20 text-red-400 text-[10px] font-bold">{{ t.type || '资金扣除' }}</span>
                            </td>
                            <td class="px-6 py-4 font-mono font-bold" :class="t.amount > 0 ? 'text-green-400' : 'text-red-400'">{{ t.amount > 0 ? '+' : '' }}{{ t.amount }}</td>
                            <td class="px-6 py-4 font-mono text-amber-400 font-bold">{{ t.balance !== null ? app.formatMoney(t.balance) : '--' }}</td>
                            <td class="px-6 py-4 text-xs text-slate-300 max-w-[300px] truncate" :title="cleanDescription(t)">{{ cleanDescription(t) }}</td>
                        </tr>
                        <tr v-if="txs.length === 0"><td colspan="5" class="text-center py-10 text-slate-500">暂无资金变动记录</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div v-if="showPayModal" class="fixed inset-0 bg-black/80 z-[10005] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"><div class="bg-slate-900/90 border border-slate-700 rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] max-w-lg w-full relative flex flex-col h-[80vh] md:h-[600px]"><div class="bg-slate-900 p-4 border-b border-slate-700 flex justify-between items-center shrink-0"><div class="text-white font-bold flex items-center"><span class="mr-2 animate-pulse text-green-400">●</span> 安全支付收银台</div><button @click="closeModal" class="text-slate-400 hover:text-white transition bg-slate-800 p-1.5 rounded-lg"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div><div class="flex-grow bg-white relative"><iframe name="pay_frame" id="pay_frame" class="w-full h-full border-0 absolute inset-0" allowtransparency="true"></iframe><form id="bufpay_form" :action="payUrl" method="POST" target="pay_frame" class="hidden"><input v-for="(val, key) in payParams" :key="key" :name="key" :value="val" type="hidden"></form></div><div class="bg-slate-900 p-3 border-t border-slate-700 flex justify-between items-center text-xs shrink-0"><div class="text-slate-500">如果未自动关闭，可手动点左侧刷新</div><button @click="manualJump" class="text-blue-400 hover:text-blue-300 hover:underline">无法加载二维码？点击跳转支付</button></div></div></div>
        
        <div v-if="showLightbox" @click="showLightbox = false" class="fixed inset-0 z-[10010] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in backdrop-blur-sm">
            <img :src="usdtImageUrl" class="max-w-full max-h-[90vh] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)]" @click.stop />
            <div class="absolute top-6 right-6 text-slate-400 hover:text-white transition bg-slate-800/50 p-2 rounded-full cursor-pointer">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </div>
        </div>

    </div>
</template>
