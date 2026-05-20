<template>
  <div class="max-w-7xl mx-auto pb-20 relative z-10 space-y-4">
    <div class="bg-gradient-to-r from-slate-800/80 to-indigo-900/30 p-6 rounded-3xl border border-indigo-500/20 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl font-black text-white tracking-wider flex items-center"><span class="text-indigo-400 mr-3 text-3xl">💲</span> 分站调价中心</h2>
        <p class="text-slate-400 text-sm mt-1">自定义每个服务的售价，留空则使用上游价格 × <span class="text-amber-400 font-bold">{{ globalMultiplier }}x</span> 倍率</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button @click="toggleOnlyCustom" :class="onlyCustom ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300'" class="font-bold px-4 py-2 rounded-xl text-sm transition">仅看已调价</button>
        <select v-model="filterCategory" @change="fetchData" class="bg-slate-700 text-white text-sm rounded-xl px-3 py-2 outline-none border border-slate-600">
          <option value="">全部分类</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
        <input v-model="searchQuery" @keyup.enter="fetchData" placeholder="搜索ID/名称/分类..." class="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-indigo-400 w-48">
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <span class="text-slate-400 text-xs font-bold">⚡ 批量调价：</span>
      <button @click="batchMarkup(0.1)" class="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg transition">选中 +10%</button>
      <button @click="batchMarkup(0.2)" class="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg transition">选中 +20%</button>
      <button @click="batchMarkup(0.5)" class="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg transition">选中 +50%</button>
      <button @click="batchMarkup(-0.1)" class="bg-slate-700 hover:bg-red-600 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg transition">选中 -10%</button>
      <button @click="batchReset" class="bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white text-xs font-bold px-3 py-1.5 rounded-lg transition border border-red-500/30">重置选中为上游价</button>
      <span class="text-slate-500 text-[10px] ml-auto">勾选服务后操作</span>
    </div>

    <!-- 表格 -->
    <div class="bg-slate-800/80 border border-slate-700 rounded-3xl shadow-xl overflow-hidden">
      <div v-if="loading" class="flex justify-center py-20"><div class="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin"></div></div>

      <div v-else class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-900/50 text-xs uppercase text-slate-500 border-b border-slate-700">
            <tr>
              <th class="px-4 py-3 w-10"><input type="checkbox" @change="toggleAll" v-model="allChecked" class="accent-amber-400"></th>
              <th class="px-4 py-3">ID</th>
              <th class="px-4 py-3">服务名称</th>
              <th class="px-4 py-3">上游价(¥/千)</th>
              <th class="px-4 py-3">自定义价(¥/千)</th>
              <th class="px-4 py-3">最终售价</th>
              <th class="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-700/50 text-slate-300">
            <tr v-for="item in items" :key="item.id" :class="['hover:bg-slate-700/30 transition', item.custom_rate !== null ? 'bg-indigo-500/5' : '']">
              <td class="px-4 py-2.5"><input type="checkbox" v-model="item._checked" class="accent-amber-400"></td>
              <td class="px-4 py-2.5 font-mono text-xs text-amber-400">{{ item.id }}</td>
              <td class="px-4 py-2.5 max-w-[300px] truncate text-xs" :title="item.name">{{ item.name }}</td>
              <td class="px-4 py-2.5 font-mono text-xs text-slate-500">¥{{ item.upstream_rate.toFixed(4) }}</td>
              <td class="px-4 py-2.5">
                <input v-model.number="item._custom_rate" type="number" step="0.0001"
                  class="w-24 bg-slate-900 border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-indigo-400 transition"
                  :class="item._custom_rate !== null ? 'border-indigo-500/50 text-indigo-400' : 'border-slate-600 text-slate-500'"
                  :placeholder="item.upstream_rate.toFixed(4)">
              </td>
              <td class="px-4 py-2.5 font-mono font-bold text-sm" :class="item.custom_rate !== null ? 'text-indigo-400' : 'text-slate-300'">
                ¥{{ item.sell_price.toFixed(4) }}
              </td>
              <td class="px-4 py-2.5 text-right">
                <button @click="saveOne(item)" class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg transition">保存</button>
                <button v-if="item.custom_rate !== null" @click="resetOne(item)" class="text-xs bg-slate-700 hover:bg-red-600 text-slate-400 hover:text-white ml-1 px-2 py-1.5 rounded-lg transition">重置</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div class="flex justify-between items-center px-6 py-4 border-t border-slate-700">
        <span class="text-xs text-slate-500">共 {{ total }} 条 | 已调价 {{ customCount }} 条 | 倍率 {{ globalMultiplier }}x</span>
        <div class="flex gap-2">
          <button @click="page > 1 && page-- && fetchData()" :disabled="page === 1" class="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">上一页</button>
          <span class="text-xs text-slate-400 py-1.5">{{ page }}/{{ Math.ceil(total / pageSize) || 1 }}</span>
          <button @click="page < Math.ceil(total / pageSize) && page++ && fetchData()" :disabled="page >= Math.ceil(total / pageSize)" class="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui';

const userStore = useUserStore();
const uiStore = useUiStore();

const items = ref([]);
const categories = ref([]);
const loading = ref(true);
const searchQuery = ref('');
const filterCategory = ref('');
const onlyCustom = ref(false);
const allChecked = ref(false);
const page = ref(1);
const pageSize = 50;
const total = ref(0);
const globalMultiplier = ref(2.0);

const customCount = computed(() => items.value.filter(i => i.custom_rate !== null).length);

const fetchData = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: page.value, pageSize, search: searchQuery.value, category: filterCategory.value, only_custom: onlyCustom.value });
    const res = await fetch('/api/admin/pricing?' + params, { headers: { 'Authorization': `Bearer ${userStore.token}` } });
    const data = await res.json();
    if (data.status === 'success') {
      items.value = data.data.items.map(i => ({ ...i, _custom_rate: i.custom_rate, _checked: false }));
      total.value = data.data.total;
      globalMultiplier.value = data.data.global_multiplier;
    }
  } catch (e) {}
  loading.value = false;
};

const fetchCategories = async () => {
  try {
    const res = await fetch('/api/admin/categories', { headers: { 'Authorization': `Bearer ${userStore.token}` } });
    const data = await res.json();
    if (data.status === 'success') categories.value = data.data;
  } catch (e) {}
};

const toggleOnlyCustom = () => { onlyCustom.value = !onlyCustom.value; page.value = 1; fetchData(); };
const toggleAll = () => { const val = allChecked.value; items.value.forEach(i => i._checked = val); };

const saveOne = async (item) => {
  const val = item._custom_rate === '' || item._custom_rate === null || item._custom_rate === undefined ? null : parseFloat(item._custom_rate);
  if (val !== null && (isNaN(val) || val <= 0)) return uiStore.showToast('价格必须大于0', 'error');
  try {
    const res = await fetch('/api/admin/pricing', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
      body: JSON.stringify({ prices: [{ id: item.id, custom_rate: val }] })
    });
    const data = await res.json();
    if (data.status === 'success') { item.custom_rate = val; item._custom_rate = val; uiStore.showToast('已保存', 'success'); }
    else uiStore.showToast(data.message, 'error');
  } catch (e) { uiStore.showToast('网络错误', 'error'); }
};

const resetOne = async (item) => {
  await saveOne({ ...item, _custom_rate: null });
};

const batchMarkup = async (ratio) => {
  const checked = items.value.filter(i => i._checked);
  if (checked.length === 0) return uiStore.showToast('请先勾选服务', 'error');
  const prices = checked.map(i => {
    const base = i.custom_rate !== null ? i.custom_rate : i.upstream_rate;
    const newRate = parseFloat((base * (1 + ratio)).toFixed(4));
    i._custom_rate = newRate;
    return { id: i.id, custom_rate: newRate };
  });
  try {
    const res = await fetch('/api/admin/pricing', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
      body: JSON.stringify({ prices })
    });
    const data = await res.json();
    if (data.status === 'success') { prices.forEach(p => { const it = items.value.find(i => i.id === p.id); if (it) it.custom_rate = p.custom_rate; }); uiStore.showToast('批量调价成功', 'success'); }
    else uiStore.showToast(data.message, 'error');
  } catch (e) { uiStore.showToast('网络错误', 'error'); }
};

const batchReset = async () => {
  const checked = items.value.filter(i => i._checked);
  if (checked.length === 0) return uiStore.showToast('请先勾选服务', 'error');
  const prices = checked.map(i => { i._custom_rate = null; return { id: i.id, custom_rate: null }; });
  try {
    const res = await fetch('/api/admin/pricing', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
      body: JSON.stringify({ prices })
    });
    const data = await res.json();
    if (data.status === 'success') { prices.forEach(p => { const it = items.value.find(i => i.id === p.id); if (it) it.custom_rate = null; }); uiStore.showToast('已重置', 'success'); }
    else uiStore.showToast(data.message, 'error');
  } catch (e) { uiStore.showToast('网络错误', 'error'); }
};

onMounted(() => { fetchData(); fetchCategories(); });
</script>

<style>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 4px; }
</style>
