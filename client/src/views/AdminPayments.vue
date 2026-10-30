<script setup>
// 💳 密室 · 补单队列
// 背景：补单记录存在服务器 server/data/pending_payments.json 里，后台每 2 分钟自动查一次，
// 但以前没有任何界面 —— 客户说「我付了没到账」，只能 ssh 上去看文件。
// 这个页面把队列摊开：谁的单、多少钱、卡了多久、为什么判死，还能当场重查/判死。
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui';

const userStore = useUserStore();
const ui = useUiStore();

const items = ref([]);
const summary = ref({ total: 0, open: 0, failed: 0, completed: 0, suspicious: 0 });
const loading = ref(false);
const busyId = ref('');
const autoRefresh = ref(true);
let timer = null;

const headers = () => ({ 'Authorization': `Bearer ${userStore.token}` });

const load = async (silent = false) => {
    if (!silent) loading.value = true;
    try {
        const res = await fetch('/api/admin/payments', { headers: headers() });
        const json = await res.json();
        if (json.status === 'success') {
            items.value = json.data.items || [];
            summary.value = json.data.summary || summary.value;
        } else if (!silent) {
            ui.showToast(json.message || '读取失败', 'error');
        }
    } catch (e) {
        if (!silent) ui.showToast('网络异常，读取补单队列失败', 'error');
    } finally { loading.value = false; }
};

const recheck = async (it) => {
    busyId.value = it.order_id;
    try {
        const res = await fetch('/api/admin/payments/recheck', {
            method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: it.order_id }),
        });
        const json = await res.json();
        ui.showToast(json.message || (json.status === 'success' ? '已重查' : '重查失败'), json.status === 'success' ? 'success' : 'error');
        await load(true);
    } catch (e) { ui.showToast('重查请求失败', 'error'); } finally { busyId.value = ''; }
};

const dismiss = async (it) => {
    const ok = await ui.showConfirm(`确认把 ${it.order_id} 判死？\n判死后这笔不再自动查证（钱不会退，也不会入账）`);
    if (!ok) return;
    busyId.value = it.order_id;
    try {
        const res = await fetch('/api/admin/payments/dismiss', {
            method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: it.order_id, reason: '管理员手动判死' }),
        });
        const json = await res.json();
        ui.showToast(json.message || '已判死', json.status === 'success' ? 'success' : 'error');
        await load(true);
    } catch (e) { ui.showToast('判死失败', 'error'); } finally { busyId.value = ''; }
};

const cleanOld = async () => {
    const ok = await ui.showConfirm('把队列里 7 天前的老单统一判死，并清掉过期记录？\n（7 天前的支付订单在网关侧早已过期，不可能再付款成功）');
    if (!ok) return;
    loading.value = true;
    try {
        const res = await fetch('/api/admin/payments/clean', { method: 'POST', headers: headers() });
        const json = await res.json();
        ui.showToast(json.message || '已清理', json.status === 'success' ? 'success' : 'error');
        await load(true);
    } catch (e) { ui.showToast('清理失败', 'error'); } finally { loading.value = false; }
};

const statusClass = (s) => ({
    pending: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    processing: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
    completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    failed: 'bg-slate-600/20 text-slate-400 border-slate-600/50',
}[s] || 'bg-slate-700/30 text-slate-300 border-slate-600');

const isOpen = (s) => s === 'pending' || s === 'processing';

const dur = (min) => {
    if (min === null || min === undefined) return '—';
    if (min < 1) return '刚刚';
    if (min < 60) return `${min} 分钟前`;
    if (min < 1440) return `${Math.floor(min / 60)} 小时前`;
    return `${Math.floor(min / 1440)} 天前`;
};

const suspicious = computed(() => summary.value.suspicious > 0);

onMounted(() => {
    load();
    timer = setInterval(() => { if (autoRefresh.value) load(true); }, 20000);
});
onUnmounted(() => { if (timer) clearInterval(timer); });
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-6 pb-20 relative z-10">

    <!-- 头部 -->
    <div class="relative w-full rounded-3xl overflow-hidden bg-slate-900 border border-amber-500/30 shadow-[0_20px_60px_rgba(245,158,11,0.12)] p-8 md:p-10">
      <div class="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full mix-blend-screen filter blur-[100px] animate-pulse"></div>
      <div class="relative z-10 flex flex-wrap items-center gap-4 mb-6">
        <div class="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(245,158,11,0.4)]">💳</div>
        <div class="flex-1 min-w-[240px]">
          <h1 class="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-500 tracking-widest">补单队列</h1>
          <p class="text-slate-400 text-sm mt-1">支付回调丢了也不丢钱 · 后台每 2 分钟自动查证一次</p>
        </div>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input type="checkbox" v-model="autoRefresh" class="accent-amber-400">
            自动刷新
          </label>
          <button @click="load()" :disabled="loading" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold rounded-xl transition">🔄 刷新</button>
          <button @click="cleanOld" :disabled="loading" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold rounded-xl transition">🧹 清理老单</button>
        </div>
      </div>

      <!-- 统计 -->
      <div class="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-slate-800/70 border border-slate-700 rounded-2xl p-4">
          <div class="text-[11px] text-slate-400 mb-1">队列总数</div>
          <div class="text-2xl font-black font-mono text-slate-100">{{ summary.total }}</div>
        </div>
        <div class="bg-slate-800/70 border border-amber-500/30 rounded-2xl p-4">
          <div class="text-[11px] text-amber-300 mb-1">还在查证</div>
          <div class="text-2xl font-black font-mono text-amber-300">{{ summary.open }}</div>
        </div>
        <div class="bg-slate-800/70 border border-emerald-500/30 rounded-2xl p-4">
          <div class="text-[11px] text-emerald-300 mb-1">已入账</div>
          <div class="text-2xl font-black font-mono text-emerald-300">{{ summary.completed }}</div>
        </div>
        <div class="bg-slate-800/70 border border-slate-600 rounded-2xl p-4">
          <div class="text-[11px] text-slate-400 mb-1">已判死</div>
          <div class="text-2xl font-black font-mono text-slate-300">{{ summary.failed }}</div>
        </div>
      </div>

      <div v-if="suspicious" class="relative z-10 mt-4 bg-red-500/10 border border-red-500/40 rounded-2xl px-4 py-3 text-xs text-red-300">
        ⚠️ 有 <b class="font-black">{{ summary.suspicious }}</b> 笔「队列里还没完成、但流水里已经有」的记录 ——
        说明钱其实到账了，只是队列状态没跟上。点「立即重查」会自动标记完成。
      </div>
    </div>

    <!-- 列表 -->
    <div class="bg-slate-800/80 border border-slate-700 rounded-3xl shadow-xl overflow-hidden relative">
      <div v-if="loading" class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div class="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <div class="p-6 border-b border-slate-700 flex items-center justify-between">
        <h3 class="text-lg font-bold text-white flex items-center"><span class="text-amber-400 mr-2">📋</span> 待查证 / 历史记录</h3>
        <span class="text-[11px] text-slate-500">数据源：server/data/pending_payments.json</span>
      </div>
      <div class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead class="bg-slate-900/50 text-xs uppercase text-slate-400">
            <tr>
              <th class="px-5 py-4">单号 / 发起</th>
              <th class="px-5 py-4">用户</th>
              <th class="px-5 py-4">金额</th>
              <th class="px-5 py-4">通道</th>
              <th class="px-5 py-4">状态</th>
              <th class="px-5 py-4">末次查证</th>
              <th class="px-5 py-4">原因 / 备注</th>
              <th class="px-5 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-700/50 text-slate-200">
            <tr v-for="it in items" :key="it.order_id" class="hover:bg-slate-700/30 transition">
              <td class="px-5 py-3">
                <div class="font-mono text-[11px] text-slate-300">{{ it.order_id }}</div>
                <div class="text-[10px] text-slate-500 mt-0.5">
                  {{ it.created_at ? new Date(it.created_at).toLocaleString() : '—' }}
                  <span class="text-amber-400/80 font-bold">（{{ dur(it.age_min) }}）</span>
                </div>
              </td>
              <td class="px-5 py-3 text-xs">
                <div class="text-slate-200 font-mono">UID {{ it.user_id }}</div>
                <div class="text-[10px] text-slate-500 font-mono">{{ it.phone || '—' }}</div>
              </td>
              <td class="px-5 py-3 font-mono font-bold" :class="it.pay_type === 'USDT' ? 'text-emerald-400' : 'text-amber-400'">
                {{ it.pay_type === 'USDT' ? '$' : '¥' }}{{ it.amount }}
              </td>
              <td class="px-5 py-3 text-xs text-slate-300">{{ it.pay_text }}</td>
              <td class="px-5 py-3">
                <span class="inline-flex items-center px-2 py-1 rounded-lg border text-[10px] font-black" :class="statusClass(it.status)">
                  {{ it.status_text }}
                </span>
                <div v-if="it.credited" class="text-[10px] text-emerald-400 mt-1">✔ 流水已有</div>
                <div v-else-if="it.retry_count" class="text-[10px] text-slate-500 mt-1">重试 {{ it.retry_count }} 次</div>
              </td>
              <td class="px-5 py-3 text-[11px] text-slate-400">{{ dur(it.last_min) }}</td>
              <td class="px-5 py-3 text-[11px] text-slate-400 max-w-[220px] truncate" :title="it.fail_reason">{{ it.fail_reason || '—' }}</td>
              <td class="px-5 py-3 text-right space-x-2">
                <!-- 已入账的没得查；pending/processing 可重查+判死；failed 留一个「重新查证」——
                     真实场景：自动判死之后客户说"我确实付了"，这时要能把它捞回来 -->
                <template v-if="it.status !== 'completed'">
                  <button @click="recheck(it)" :disabled="busyId === it.order_id"
                    class="text-xs bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded transition font-bold disabled:opacity-40">
                    {{ busyId === it.order_id ? '查证中…' : (isOpen(it.status) ? '🔍 立即重查' : '🔍 重新查证') }}
                  </button>
                  <button v-if="isOpen(it.status)" @click="dismiss(it)" :disabled="busyId === it.order_id"
                    class="text-xs bg-slate-700/40 hover:bg-red-500/30 text-slate-300 hover:text-red-300 border border-slate-600 px-3 py-1.5 rounded transition font-bold disabled:opacity-40">判死</button>
                </template>
                <span v-else class="text-[11px] text-slate-500">—</span>
              </td>
            </tr>
            <tr v-if="items.length === 0">
              <td colspan="8" class="text-center py-12 text-slate-500">
                队列是空的 —— 没有待补的支付记录（这是好事）
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="px-6 py-4 border-t border-slate-700/60 text-[11px] text-slate-500 leading-relaxed">
        说明：队列里的单子由后台每 2 分钟自动查一次（BufPay 30 分钟 / USDT 65 分钟后仍未付款即判死）。
        「立即重查」走的是补单引擎同一份逻辑，<b class="text-slate-400">网关确认已付就会直接入账</b>；
        这里不提供手动入账 —— 真要补钱请走「用户管理 → 后台调账」并写明原因。
      </div>
    </div>
  </div>
</template>
