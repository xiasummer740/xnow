<template>
  <div class="max-w-5xl mx-auto space-y-6 pb-20 relative z-10">
    <div class="bg-slate-800/80 p-5 md:p-8 rounded-3xl border border-slate-700 shadow-xl">
      <div class="mb-6 space-y-2">
        <h2 class="text-xl font-bold text-white flex items-center"><span class="mr-2">📑</span> 批量下单</h2>
        <p class="text-slate-400 text-sm">每行一个订单，格式：<span class="text-amber-400 font-mono">服务ID | 链接 | 数量</span></p>
        <div class="bg-slate-900/80 p-3 rounded-lg border border-slate-700 font-mono text-sm text-slate-300">
          示例：<br>
          <span class="text-green-400">30101 | https://www.tiktok.com/@username | 1000</span><br>
          <span class="text-green-400">28513 | https://www.tiktok.com/@username/video/123 | 500</span>
        </div>
      </div>

      <textarea v-model="massData" rows="14" placeholder="服务ID | 链接 | 数量&#10;如：&#10;30101 | https://www.tiktok.com/@xxx | 1000&#10;28513 | https://www.tiktok.com/@yyy/video/123 | 500"
        class="w-full bg-slate-900/80 border border-slate-600 rounded-xl p-5 text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition font-mono text-sm resize-y"></textarea>

      <div class="flex items-center justify-between mt-4 mb-2">
        <span class="text-xs text-slate-500">已解析 <span class="text-amber-400 font-bold">{{ parsedOrders.length }}</span> 条有效订单</span>
        <span v-if="parsedOrders.length > 0" class="text-xs text-slate-500">预估总消费: <span class="text-amber-400 font-bold font-mono">{{ estimatedTotalText }}</span></span>
      </div>

      <div v-if="parseErrors.length > 0" class="bg-red-900/20 border border-red-500/30 rounded-xl p-3 mb-3">
        <p class="text-red-400 text-xs font-bold mb-1">格式错误行：</p>
        <p v-for="(err, i) in parseErrors" :key="i" class="text-red-300 text-xs font-mono">{{ err }}</p>
      </div>

      <button @click="submitBatch" :disabled="isSubmitting || parsedOrders.length === 0"
        class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-lg py-4 rounded-xl mt-4 transition transform hover:-translate-y-1 shadow-[0_10px_30px_rgba(37,99,235,0.3)] disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed">
        {{ isSubmitting ? `提交中... ${submitProgress}` : `提交 ${parsedOrders.length} 条批量订单` }}
      </button>

      <!-- 结果面板 -->
      <div v-if="batchResult" class="mt-6 bg-slate-900/80 border rounded-2xl p-5" :class="batchResult.fail > 0 ? 'border-amber-500/50' : 'border-green-500/50'">
        <div class="flex items-center space-x-3 mb-4">
          <div class="text-2xl">{{ batchResult.fail > 0 ? '⚠️' : '✅' }}</div>
          <div>
            <h3 class="text-white font-bold text-lg">批量提交完成</h3>
            <p class="text-slate-400 text-sm">共 {{ batchResult.total }} 条，成功 <span class="text-green-400 font-bold">{{ batchResult.success }}</span> 条<span v-if="batchResult.fail > 0">，失败 <span class="text-red-400 font-bold">{{ batchResult.fail }}</span> 条</span> | 总扣费: <span class="text-amber-400 font-bold font-mono">¥{{ batchResult.total_charge }}</span></p>
          </div>
        </div>
        <div v-if="batchResult.fail > 0" class="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
          <div v-for="(r, i) in batchResult.results" :key="i">
            <div v-if="r.status === 'error'" class="bg-red-900/20 border border-red-500/20 rounded-lg p-3 text-xs">
              <span class="text-red-400 font-mono">ID:{{ r.serviceId }} | {{ r.link }}</span>
              <span class="text-red-300 ml-2">→ {{ r.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-slate-800/60 p-6 rounded-2xl border border-slate-700 text-center">
        <div class="text-amber-400 text-3xl mb-3">⚡</div>
        <h4 class="text-white font-bold mb-2">批量极速处理</h4>
        <p class="text-sm text-slate-400">逐条提交上游，失败自动回滚扣款，安全可靠。</p>
      </div>
      <div class="bg-slate-800/60 p-6 rounded-2xl border border-slate-700 text-center">
        <div class="text-blue-400 text-3xl mb-3">🛡️</div>
        <h4 class="text-white font-bold mb-2">事务级安全</h4>
        <p class="text-sm text-slate-400">每条订单独立事务处理，一条失败不影响其他。</p>
      </div>
      <div class="bg-slate-800/60 p-6 rounded-2xl border border-slate-700 text-center">
        <div class="text-green-400 text-3xl mb-3">📋</div>
        <h4 class="text-white font-bold mb-2">结果明细</h4>
        <p class="text-sm text-slate-400">提交后展示每条结果，失败原因一目了然。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui';
import { useAppStore } from '../stores/app';

const userStore = useUserStore();
const uiStore = useUiStore();
const appStore = useAppStore();

const massData = ref('');
const isSubmitting = ref(false);
const submitProgress = ref('');
const batchResult = ref(null);

const parseErrors = ref([]);

const parsedOrders = computed(() => {
  parseErrors.value = [];
  if (!massData.value.trim()) return [];

  const lines = massData.value.split('\n').filter(l => l.trim());
  const valid = [];

  lines.forEach((line, idx) => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length < 3) {
      parseErrors.value.push(`第 ${idx + 1} 行: 缺少参数（需要: 服务ID | 链接 | 数量）`);
      return;
    }
    const serviceId = parts[0];
    const link = parts[1];
    const quantity = parseInt(parts[2]);

    if (!serviceId || isNaN(parseInt(serviceId))) {
      parseErrors.value.push(`第 ${idx + 1} 行: 服务ID无效`);
      return;
    }
    if (!link || !link.startsWith('http')) {
      parseErrors.value.push(`第 ${idx + 1} 行: 链接格式无效`);
      return;
    }
    if (isNaN(quantity) || quantity <= 0) {
      parseErrors.value.push(`第 ${idx + 1} 行: 数量无效`);
      return;
    }
    valid.push({ serviceId, link, quantity });
  });

  return valid;
});

const estimatedTotalText = computed(() => '需提交后计算');

const submitBatch = async () => {
  if (parsedOrders.value.length === 0) {
    return uiStore.showToast('没有可提交的有效订单', 'error');
  }
  if (parsedOrders.value.length > 50) {
    return uiStore.showAlert('单次最多50条，请分批提交（当前' + parsedOrders.value.length + '条）', '批量限制');
  }

  const confirmed = await uiStore.showConfirm(`确认提交 ${parsedOrders.value.length} 条批量订单吗？\n系统将逐条处理并扣费。`);
  if (!confirmed) return;

  isSubmitting.value = true;
  batchResult.value = null;
  submitProgress.value = '';

  try {
    submitProgress.value = '正在提交...';
    const res = await fetch('/api/orders/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userStore.token}`
      },
      body: JSON.stringify({ orders: parsedOrders.value })
    });
    const data = await res.json();

    if (data.status === 'success') {
      batchResult.value = data.data;
      massData.value = '';

      // 刷新余额
      try {
        const uRes = await fetch('/api/user/status', { headers: { 'Authorization': `Bearer ${userStore.token}` } });
        const uData = await uRes.json();
        if (uData.status === 'success') userStore.userInfo.balance = uData.balance;
      } catch {}

      if (data.data.fail > 0) {
        uiStore.showToast(`批量完成: ${data.data.success} 成功, ${data.data.fail} 失败`, 'error');
      } else {
        uiStore.showToast(`${data.data.success} 条订单全部提交成功！`, 'success');
      }
    } else {
      uiStore.showAlert(data.message || '批量提交失败', '系统提示');
    }
  } catch (e) {
    uiStore.showAlert('网络连接失败，请重试', '系统警告');
  }
  isSubmitting.value = false;
  submitProgress.value = '';
};
</script>

<style>
.custom-scrollbar::-webkit-scrollbar { width: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.3); border-radius: 4px; }
</style>
