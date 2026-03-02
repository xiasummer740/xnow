<template>
  <div class="max-w-6xl mx-auto space-y-12 pb-24 relative z-10 px-4 sm:px-0">
    <div class="relative w-full rounded-[3rem] overflow-hidden bg-slate-900 border border-amber-500/30 shadow-[0_30px_100px_rgba(245,158,11,0.15)] flex flex-col items-center text-center p-12 md:p-24 mt-4 md:mt-8">
      <div class="absolute -top-40 -left-40 w-[500px] h-[500px] bg-amber-500/20 rounded-full mix-blend-screen filter blur-[120px] animate-pulse"></div>
      <div class="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-yellow-600/20 rounded-full mix-blend-screen filter blur-[120px] animate-pulse" style="animation-delay: 2s;"></div>
      
      <div class="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-slate-800 to-black border-4 border-amber-400 rounded-full flex items-center justify-center text-5xl md:text-6xl shadow-[0_0_50px_rgba(251,191,36,0.6)] mb-8 relative z-10">👑</div>
      <h1 class="text-4xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 mb-6 tracking-widest relative z-10 drop-shadow-lg">
        {{ appStore.lang === 'zh' ? '至尊代理特权' : 'Supreme Agent Privileges' }}
      </h1>
      <p class="text-slate-300 text-base md:text-2xl max-w-4xl leading-relaxed tracking-widest font-light relative z-10">
        {{ appStore.lang === 'zh' ? '尊贵身份 · 财富引擎 · 掌控全局' : 'Noble Identity · Wealth Engine · Total Control' }}
      </p>
    </div>

    <div class="bg-gradient-to-r from-slate-800 to-slate-900 backdrop-blur-2xl p-6 md:p-8 rounded-3xl border border-slate-700 flex flex-col md:flex-row items-center justify-between shadow-2xl relative overflow-hidden group hover:border-amber-500/50 transition-all duration-500">
      <div class="absolute left-0 top-0 w-1.5 md:w-2 h-full bg-gradient-to-b from-amber-300 to-amber-600 shadow-[0_0_20px_rgba(251,191,36,1)]"></div>
      
      <div class="flex flex-col text-center md:text-left w-full md:w-auto mb-8 md:mb-0 pl-2 md:pl-4">
        <p class="text-slate-400 font-bold mb-2 tracking-widest uppercase text-xs md:text-sm">CURRENT STATUS / 当前身份</p>
        <h3 class="text-white font-black text-xl md:text-4xl tracking-wider">
          <span v-if="['admin', 'super_admin'].includes(userStore.userInfo?.role)" class="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-600 drop-shadow-[0_0_15px_rgba(248,113,113,0.8)]">
            {{ appStore.lang === 'zh' ? '至尊管理员 (最高权限)' : 'Supreme Admin' }}
          </span>
          <span v-else-if="userStore.userInfo?.role === 'agent'" class="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]">
            {{ appStore.lang === 'zh' ? '👑 至尊代理 (生效中)' : '👑 Supreme Agent (Active)' }}
          </span>
          <span v-else class="text-slate-300">{{ appStore.lang === 'zh' ? '黄金用户' : 'Gold User' }}</span>
        </h3>
        <p v-if="userStore.userInfo?.role === 'agent' && userStore.userInfo?.vip_expire_at" class="text-xs md:text-sm text-amber-500 mt-4 font-mono bg-amber-500/10 inline-flex items-center px-4 py-1.5 rounded-full border border-amber-500/30 w-max mx-auto md:mx-0">
          <span class="w-2 h-2 bg-amber-500 rounded-full animate-pulse mr-2"></span> 
          {{ appStore.lang === 'zh' ? '护航有效期至:' : 'Valid until:' }} {{ new Date(userStore.userInfo.vip_expire_at).toLocaleDateString() }}
        </p>
      </div>

      <div v-if="!['admin', 'super_admin'].includes(userStore.userInfo?.role)" class="w-full md:w-auto flex flex-col items-center mt-2 md:mt-0">
        <button @click="handleUpgrade" :disabled="isProcessing" class="w-full md:w-auto flex-shrink-0 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:from-amber-300 hover:to-yellow-400 text-slate-900 font-black text-lg md:text-xl px-8 md:px-12 py-4 md:py-5 rounded-2xl transition-all duration-300 shadow-[0_0_40px_rgba(245,158,11,0.5)] transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 whitespace-nowrap border-2 border-yellow-300/50">
          {{ isProcessing 
              ? (appStore.lang === 'zh' ? '安全加密升级中...' : 'Securely Upgrading...') 
              : (userStore.userInfo?.role === 'agent' 
                  ? (appStore.lang === 'zh' ? '💎 ¥99/月 立即续费' : '💎 Renew for ¥99/mo') 
                  : (appStore.lang === 'zh' ? '💎 消耗 ¥99/月 立即升级' : '💎 Upgrade for ¥99/mo')) 
          }}
        </button>
        <div class="text-[11px] md:text-xs text-slate-400 mt-3 font-mono tracking-wider bg-slate-900/80 px-3 py-1 rounded-lg border border-slate-700">
          {{ appStore.lang === 'zh' ? '⚠️ 代理按月计费 (¥99 / 30天)' : '⚠️ Billed Monthly (¥99 / 30 Days)' }}
        </div>
      </div>
    </div>

    <div class="text-center pt-8 md:pt-12">
        <h2 class="text-2xl md:text-3xl font-black text-white tracking-widest mb-2">
          {{ appStore.lang === 'zh' ? '三大核心垄断特权' : 'Three Core Monopolies' }}
        </h2>
        <div class="w-24 h-1 bg-amber-500 mx-auto rounded-full shadow-[0_0_10px_rgba(251,191,36,0.8)]"></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="relative group bg-gradient-to-b from-slate-800/80 to-slate-900/90 rounded-[2rem] p-1.5 border border-slate-700 hover:border-amber-500/50 transition-all duration-500 overflow-hidden shadow-xl hover:shadow-[0_0_50px_rgba(251,191,36,0.2)]">
        <div class="absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"></div>
        <div class="h-full bg-slate-900 rounded-[1.8rem] p-8 relative z-10 flex flex-col items-center text-center">
          <div class="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(245,158,11,0.5)] mb-6 transform group-hover:scale-110 transition-transform duration-500">📉</div>
          <h3 class="text-2xl font-black text-white mb-2 tracking-wide">{{ appStore.lang === 'zh' ? '极致底价垄断' : 'Absolute Floor Price' }}</h3>
          <div class="text-amber-400 font-black text-6xl my-6 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]">{{ displayDiscount }} <span class="text-2xl font-bold">{{ appStore.lang === 'zh' ? '折起' : 'X' }}</span></div>
          <p class="text-slate-400 text-sm leading-relaxed">
            {{ appStore.lang === 'zh' ? `突破普通用户价格限制，享受全站千万商品骨折级拿货底价。单单省钱，单单赚钱，利润空间彻底释放，你就是源头！` : 'Break through regular pricing limits and enjoy extreme wholesale prices. Maximize your profit margins instantly!' }}
          </p>
        </div>
      </div>

      <div class="relative group bg-gradient-to-b from-slate-800/80 to-slate-900/90 rounded-[2rem] p-1.5 border border-slate-700 hover:border-blue-500/50 transition-all duration-500 overflow-hidden shadow-xl hover:shadow-[0_0_50px_rgba(59,130,246,0.2)] transform md:-translate-y-4">
        <div class="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"></div>
        <div class="absolute -top-4 -right-4 bg-blue-500 text-white text-xs font-black px-6 py-2 rounded-bl-3xl rounded-tr-xl shadow-lg rotate-12 z-20">
          {{ appStore.lang === 'zh' ? '最强赋能' : 'Ultimate Power' }}
        </div>
        <div class="h-full bg-slate-900 rounded-[1.8rem] p-8 relative z-10 flex flex-col items-center text-center">
          <div class="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(59,130,246,0.5)] mb-6 transform group-hover:scale-110 transition-transform duration-500">🌐</div>
          <h3 class="text-2xl font-black text-white mb-2 tracking-wide">{{ appStore.lang === 'zh' ? 'API对接 & 独立建站' : 'API & Sub-site' }}</h3>
          <div class="text-blue-400 font-black text-xl md:text-2xl my-6 tracking-widest border-y border-blue-500/30 py-3 w-full bg-blue-500/5">
            {{ appStore.lang === 'zh' ? '做自己的庄家' : 'Be The Boss' }}
          </div>
          <p class="text-slate-400 text-sm leading-relaxed">
            {{ appStore.lang === 'zh' ? '无条件开放开发者 API 权限，无缝对接全站优质货源。帮助您轻松搭建属于自己的独立分站，自定高价，坐收渔利！' : 'Unconditional API access to all premium products. Easily build your own independent website, set high prices, and earn passive income!' }}
          </p>
        </div>
      </div>

      <div class="relative group bg-gradient-to-b from-slate-800/80 to-slate-900/90 rounded-[2rem] p-1.5 border border-slate-700 hover:border-emerald-500/50 transition-all duration-500 overflow-hidden shadow-xl hover:shadow-[0_0_50px_rgba(16,185,129,0.2)]">
        <div class="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"></div>
        <div class="absolute -top-4 -right-4 bg-emerald-500 text-slate-900 text-xs font-black px-6 py-2 rounded-bl-3xl rounded-tr-xl shadow-lg rotate-12 z-20">
          {{ appStore.lang === 'zh' ? '全自动赚钱' : 'Passive Income' }}
        </div>
        <div class="h-full bg-slate-900 rounded-[1.8rem] p-8 relative z-10 flex flex-col items-center text-center">
          <div class="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(16,185,129,0.5)] mb-6 transform group-hover:scale-110 transition-transform duration-500">💸</div>
          <h3 class="text-2xl font-black text-white mb-2 tracking-wide">{{ appStore.lang === 'zh' ? '裂变暴利分润' : '10% Commission' }}</h3>
          <div class="text-emerald-400 font-black text-4xl md:text-5xl my-6 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]">
            10<span class="text-2xl font-bold">%</span>
          </div>
          <p class="text-slate-400 text-sm leading-relaxed">
            {{ appStore.lang === 'zh' ? '普通用户推广仅享 5% 佣金，升级代理瞬间翻倍至 10%！只要您的下线充值，佣金全自动秒入您的金库，上不封顶！' : 'Upgrade to agent and double your referral commission from 5% to 10%! Enjoy automatic passive income every time your downlines top up.' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui';
import { useAppStore } from '../stores/app';
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const uiStore = useUiStore();
const appStore = useAppStore();
const router = useRouter();
const isProcessing = ref(false);

const dynamicDiscount = ref(0.8); 

const displayDiscount = computed(() => {
    const discountStr = (dynamicDiscount.value * 10).toFixed(1);
    return discountStr.replace(/\.0$/, '');
});

onMounted(async () => {
    try {
        const res = await fetch(`/api/public/config?_t=${Date.now()}`);
        const json = await res.json();
        if (json.status === 'success' && json.data && json.data.agent_discount) {
            dynamicDiscount.value = parseFloat(json.data.agent_discount);
        }
    } catch (e) {
        console.error("Failed to fetch dynamic discount", e);
    }
});

const handleUpgrade = async () => {
  if (parseFloat(userStore.userInfo?.balance || 0) < 99) {
    uiStore.showToast(appStore.lang === 'zh' ? '余额不足，请先充值' : 'Insufficient balance', 'error');
    setTimeout(() => { router.push('/recharge'); }, 1500); return;
  }
  
  const confirmMsg = appStore.lang === 'zh' ? '确认消耗 ¥99 开通/续费 1 个月至尊代理特权吗？' : 'Confirm spending ¥99 for 1-month Supreme Agent privilege?';
  const confirm = await uiStore.showConfirm(confirmMsg); if (!confirm) return;

  isProcessing.value = true;
  try {
    const res = await fetch('/api/upgrade-vip', { method: 'POST', headers: { 'Authorization': `Bearer ${userStore.token}` } });
    const data = await res.json();
    if (data.status === 'success') {
        uiStore.showToast(data.message, 'success');
        userStore.updateUserInfo({ balance: data.balance, role: data.role, vip_expire_at: data.vip_expire_at });
    } else {
        uiStore.showToast(data.message, 'error');
    }
  } catch(e) {
      uiStore.showToast(appStore.lang === 'zh' ? '网络请求异常' : 'Network error', 'error');
  }
  isProcessing.value = false;
};
</script>
