<template>
  <div class="max-w-7xl mx-auto space-y-6 pb-20 relative z-10">
    <div class="bg-slate-800/80 border border-slate-700 p-6 md:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
      <div class="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>
      
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 space-y-4 md:space-y-0 relative z-10">
        <div>
          <h2 class="text-2xl font-black text-white tracking-widest flex items-center"><span class="text-blue-400 mr-3 text-3xl">🧾</span> 历史订单轨迹</h2>
          <p class="text-slate-400 text-sm mt-1">实时追踪订单进度，全自动化异常退款</p>
        </div>
        <div class="flex space-x-3 w-full md:w-auto">
          <input type="text" v-model="searchQuery" placeholder="搜索订单号 / 链接" class="w-full md:w-64 bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-amber-400 transition">
          <button @click="fetchOrders" :disabled="isLoading" class="bg-slate-700 hover:bg-slate-600 text-white font-bold p-2.5 rounded-xl transition shadow disabled:opacity-50" title="强刷状态">
            <svg :class="['w-5 h-5 text-amber-400', isLoading ? 'animate-spin' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
        </div>
      </div>

      <div class="overflow-x-auto custom-scrollbar relative z-10 rounded-xl border border-slate-700/50 bg-slate-900/50">
        <table class="w-full text-left whitespace-nowrap">
          <thead class="bg-slate-800/80 text-xs uppercase text-slate-400 font-bold border-b border-slate-700">
            <tr>
              <th class="px-5 py-4">系统单号 / 时间</th>
              <th class="px-5 py-4">目标链接 (Link)</th>
              <th class="px-5 py-4">服务名称 (Service)</th>
              <th class="px-5 py-4 text-center">初始 / 数量 / 剩余</th>
              <th class="px-5 py-4 text-right">消费金额</th>
              <th class="px-5 py-4 text-right">当前状态</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-700/50 text-slate-300 text-sm">
            <tr v-for="order in paginatedOrders" :key="order.id" class="hover:bg-slate-800/50 transition">
              <td class="px-5 py-4">
                <div class="font-mono text-amber-400 font-bold text-xs">{{ order.order_no }}</div>
                <div class="text-[10px] text-slate-500 mt-1 font-mono">{{ formatTime(order.createdAt || order.created_at) }}</div>
              </td>
              <td class="px-5 py-4">
                <div class="max-w-[150px] md:max-w-xs truncate text-xs"><a :href="order.link" target="_blank" class="text-blue-400 hover:text-blue-300 hover:underline transition" :title="order.link">{{ order.link }}</a></div>
              </td>
              <td class="px-5 py-4">
                <div class="max-w-[200px] md:max-w-md whitespace-normal break-words leading-tight text-xs">
                  <span class="text-amber-500 font-bold mr-1">[ID:{{ order.service_id }}]</span>{{ order.service_name }}
                </div>
              </td>
              <td class="px-5 py-4 text-center">
                <div class="flex items-center justify-center space-x-2 text-xs font-mono">
                  <span class="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 tooltip" title="初试计数">{{ order.start_count }}</span>
                  <span class="text-slate-500">/</span>
                  <span class="font-bold text-white tooltip" title="下单数量">{{ order.quantity }}</span>
                  <span class="text-slate-500">/</span>
                  <span class="bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded tooltip" title="剩余数量">{{ order.remains }}</span>
                </div>
              </td>
              <td class="px-5 py-4 text-right font-mono font-bold text-emerald-400 text-xs">
                {{ appStore.formatMoney(order.charge) }}
              </td>
              <td class="px-5 py-4 text-right">
                <span :class="['px-3 py-1 rounded-full text-[10px] font-black tracking-wider border', statusClass(order.status)]">
                  {{ order.status }}
                </span>
                <div v-if="order.is_refunded" class="text-[9px] text-emerald-500 mt-1.5 flex justify-end items-center"><svg class="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>已执行智能退款</div>
              </td>
            </tr>
            <tr v-if="filteredOrders.length === 0">
              <td colspan="6" class="text-center py-16 text-slate-500">
                <div class="text-4xl mb-3 opacity-20">📭</div>
                <p>空空如也，您还没有下过单哦</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-between items-center mt-6">
        <span class="text-xs text-slate-500">共找到 {{ filteredOrders.length }} 条记录</span>
        <div class="flex space-x-2">
          <button @click="page > 1 && page--" :disabled="page === 1" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs disabled:opacity-50 transition border border-slate-700">上一页</button>
          <span class="px-4 py-2 text-xs text-slate-400 font-mono">{{ page }} / {{ totalPages || 1 }}</span>
          <button @click="page < totalPages && page++" :disabled="page === totalPages || totalPages === 0" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs disabled:opacity-50 transition border border-slate-700">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '../stores/user';
import { useAppStore } from '../stores/app';

const userStore = useUserStore(); const appStore = useAppStore();
const orders = ref([]);
const isLoading = ref(false);
const searchQuery = ref('');
const page = ref(1);
const itemsPerPage = 20;

// 💡 核心注入：搬运自管理后台的鲁棒性极强的时间格式化函数
const formatTime = (isoString) => {
    if (!isoString) return '--';
    try {
        return new Date(isoString).toLocaleString('zh-CN', { 
            year: 'numeric', month: '2-digit', day: '2-digit', 
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false,
            timeZone: 'Asia/Shanghai' 
        });
    } catch (e) {
        return isoString;
    }
};

const fetchOrders = async () => {
  isLoading.value = true;
  try {
    const res = await fetch('/api/orders', { headers: { 'Authorization': `Bearer ${userStore.token}` } });
    const data = await res.json();
    if (data.status === 'success') { orders.value = data.data; }
    // 强刷状态后，顺便更新一下余额，因为可能触发了退款
    const uRes = await fetch('/api/user/status', {headers: { 'Authorization': `Bearer ${userStore.token}` }});
    const uData = await uRes.json();
    if(uData.status === 'success') userStore.userInfo.balance = uData.balance;
  } catch (error) {}
  setTimeout(() => { isLoading.value = false; }, 500);
};

const filteredOrders = computed(() => {
  if (!searchQuery.value) return orders.value;
  const q = searchQuery.value.toLowerCase();
  return orders.value.filter(o => 
    String(o.order_no).toLowerCase().includes(q) || 
    String(o.link).toLowerCase().includes(q) ||
    String(o.service_name).toLowerCase().includes(q)
  );
});

const totalPages = computed(() => Math.ceil(filteredOrders.value.length / itemsPerPage));
const paginatedOrders = computed(() => {
  const start = (page.value - 1) * itemsPerPage;
  return filteredOrders.value.slice(start, start + itemsPerPage);
});

const statusClass = (status) => {
  switch (status) {
    case '已完成': return 'bg-green-500/10 text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]';
    case '进行中': return 'bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse';
    case '处理中': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case '部分完成': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    case '已取消': return 'bg-red-500/10 text-red-400 border-red-500/30';
    case '排队中': return 'bg-slate-700/50 text-slate-300 border-slate-600';
    default: return 'bg-slate-700/50 text-slate-300 border-slate-600';
  }
};

onMounted(() => fetchOrders());
</script>
