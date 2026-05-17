<template>
  <div class="max-w-7xl mx-auto space-y-6 pb-20 relative z-10">
    <!-- 头部 -->
    <div class="bg-gradient-to-r from-indigo-900/50 via-slate-800/80 to-purple-900/30 p-6 md:p-8 rounded-3xl border border-indigo-500/30 shadow-xl">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 class="text-2xl font-black text-white tracking-wider flex items-center"><span class="text-indigo-400 mr-3 text-3xl">🌐</span> 分站管理中心</h2>
          <p class="text-slate-400 text-sm mt-1">创建独立品牌站点，每个分站拥有独立域名、定价和品牌形象</p>
        </div>
        <button @click="showCreate = true" class="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold px-6 py-3 rounded-xl transition transform hover:-translate-y-1 shadow-[0_8px_25px_rgba(99,102,241,0.4)] whitespace-nowrap">
          + 创建新分站
        </button>
      </div>
    </div>

    <!-- 创建/编辑弹窗 -->
    <div v-if="showCreate || editingSite" class="fixed inset-0 z-[10002] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" @click.self="closeForm">
      <div class="bg-slate-900 border border-slate-700 rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
        <h3 class="text-xl font-black text-white mb-6">{{ editingSite ? '编辑分站' : '创建新分站' }}</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-1.5">站点名称 *</label>
            <input v-model="form.name" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-400 transition" placeholder="如: MySMM Panel">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-1.5">绑定域名 *</label>
            <input v-model="form.domain" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-400 transition font-mono" placeholder="如: mysmm.example.com">
            <p class="text-[10px] text-slate-500 mt-1">将此域名 DNS 解析到服务器 IP，系统自动识别并切换站点</p>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-1.5">Logo URL（可选）</label>
            <input v-model="form.logo" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-400 transition" placeholder="https://...">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-400 mb-1.5">定价倍率</label>
              <input v-model.number="form.multiplier" type="number" step="0.1" min="1" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-400 transition font-mono" placeholder="2.0">
              <p class="text-[10px] text-slate-500 mt-1">上游价格 × 此倍率 = 售价</p>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-400 mb-1.5">代理折扣</label>
              <input v-model.number="form.agent_discount" type="number" step="0.01" min="0.1" max="1" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-400 transition font-mono" placeholder="0.8">
              <p class="text-[10px] text-slate-500 mt-1">代理价格 = 售价 × 折扣</p>
            </div>
          </div>
          <div v-if="isAdmin">
            <label class="block text-xs font-bold text-slate-400 mb-1.5">站长 UID（可选，默认自己）</label>
            <input v-model.number="form.owner_id" type="number" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-400 transition font-mono" placeholder="用户ID">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-1.5">公告（可选）</label>
            <textarea v-model="form.announcement" rows="3" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-400 transition text-sm" placeholder="分站专属公告..."></textarea>
          </div>
        </div>

        <div class="flex space-x-3 mt-6">
          <button @click="closeForm" class="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition">取消</button>
          <button @click="saveSite" :disabled="saving" class="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition disabled:opacity-50">
            {{ saving ? '保存中...' : (editingSite ? '保存修改' : '创建分站') }}
          </button>
        </div>
        <div v-if="editingSite" class="mt-3 text-center">
          <button @click="deleteSite" class="text-red-400 hover:text-red-300 text-xs font-bold transition">删除此分站</button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 text-center">
        <div class="text-indigo-400 text-2xl mb-1 font-black">{{ sites.length }}</div>
        <div class="text-slate-400 text-xs">分站总数</div>
      </div>
      <div class="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 text-center">
        <div class="text-green-400 text-2xl mb-1 font-black">{{ sites.filter(s => s.status === 'active').length }}</div>
        <div class="text-slate-400 text-xs">运行中</div>
      </div>
      <div class="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 text-center">
        <div class="text-amber-400 text-2xl mb-1 font-black">{{ sites.filter(s => s.status === 'suspended').length }}</div>
        <div class="text-slate-400 text-xs">已暂停</div>
      </div>
      <div class="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 text-center">
        <div class="text-blue-400 text-2xl mb-1 font-black">{{ new Set(sites.map(s => s.owner_id)).size }}</div>
        <div class="text-slate-400 text-xs">站长数量</div>
      </div>
    </div>

    <!-- 分站列表 -->
    <div class="bg-slate-800/80 border border-slate-700 rounded-3xl shadow-xl overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center py-20"><div class="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin"></div></div>

      <div v-else-if="sites.length === 0" class="text-center py-20 text-slate-500">
        <div class="text-5xl mb-4 opacity-30">🌐</div>
        <p class="font-bold text-lg">还没有创建任何分站</p>
        <p class="text-sm mt-1">点击上方按钮创建第一个分站</p>
      </div>

      <div v-else class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-900/50 text-xs uppercase text-slate-500 border-b border-slate-700">
            <tr>
              <th class="px-5 py-4">站点信息</th>
              <th class="px-5 py-4">绑定域名</th>
              <th class="px-5 py-4 text-center">定价倍率</th>
              <th class="px-5 py-4 text-center">代理折扣</th>
              <th class="px-5 py-4 text-center">状态</th>
              <th class="px-5 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-700/50 text-slate-300">
            <tr v-for="site in sites" :key="site.id" class="hover:bg-slate-700/30 transition">
              <td class="px-5 py-4">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-lg flex-shrink-0">{{ site.name?.charAt(0) || 'S' }}</div>
                  <div>
                    <div class="font-bold text-white">{{ site.name }}</div>
                    <div class="text-[10px] text-slate-500 font-mono">站长 UID: {{ site.owner_id }}</div>
                  </div>
                </div>
              </td>
              <td class="px-5 py-4 font-mono text-xs">
                <a :href="'https://' + site.domain" target="_blank" class="text-blue-400 hover:text-blue-300 transition">{{ site.domain }}</a>
              </td>
              <td class="px-5 py-4 text-center">
                <span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-mono font-bold">{{ site.multiplier }}x</span>
              </td>
              <td class="px-5 py-4 text-center">
                <span class="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-mono font-bold">{{ (site.agent_discount * 10).toFixed(1) }}折</span>
              </td>
              <td class="px-5 py-4 text-center">
                <span :class="site.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'" class="px-3 py-1 rounded-full text-xs font-bold border">
                  {{ site.status === 'active' ? '运行中' : '已暂停' }}
                </span>
              </td>
              <td class="px-5 py-4 text-right">
                <div class="flex justify-end space-x-2">
                  <button @click="editSite(site)" class="bg-slate-700 hover:bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">编辑</button>
                  <button @click="toggleSiteStatus(site)" class="text-xs font-bold px-3 py-1.5 rounded-lg transition" :class="site.status === 'active' ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-600 hover:text-white' : 'bg-green-500/10 text-green-400 hover:bg-green-600 hover:text-white'">
                    {{ site.status === 'active' ? '暂停' : '启用' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 接入说明 -->
    <div class="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 md:p-8">
      <h3 class="text-lg font-bold text-white mb-4 flex items-center"><span class="text-amber-400 mr-2">📖</span> 分站接入指南</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        <div class="space-y-2">
          <div class="text-amber-400 font-bold text-lg">1.</div>
          <h4 class="text-white font-bold">域名 DNS 解析</h4>
          <p class="text-slate-400">将分站域名的 A 记录指向您的服务器 IP 地址（与主站同一台服务器）。</p>
        </div>
        <div class="space-y-2">
          <div class="text-amber-400 font-bold text-lg">2.</div>
          <h4 class="text-white font-bold">Nginx 反代配置</h4>
          <p class="text-slate-400 font-mono text-xs bg-slate-950 p-3 rounded-lg">server {<br>  server_name 新域名;<br>  ... (与主站相同配置)<br>}</p>
        </div>
        <div class="space-y-2">
          <div class="text-amber-400 font-bold text-lg">3.</div>
          <h4 class="text-white font-bold">自动识别生效</h4>
          <p class="text-slate-400">系统通过请求域名自动匹配分站配置，无需额外设置。<br>用户访问该域名时自动加载该分站的品牌和定价。</p>
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

const sites = ref([]);
const loading = ref(true);
const showCreate = ref(false);
const editingSite = ref(null);
const saving = ref(false);

const isAdmin = computed(() => ['admin', 'super_admin'].includes(userStore.userInfo?.role));

const emptyForm = () => ({ name: '', domain: '', logo: '', multiplier: 2.0, agent_discount: 0.8, owner_id: '', announcement: '' });
const form = ref(emptyForm());

const fetchSites = async () => {
  loading.value = true;
  try {
    const res = await fetch('/api/sites', {
      headers: { 'Authorization': `Bearer ${userStore.token}` }
    });
    const data = await res.json();
    if (data.status === 'success') sites.value = data.data;
  } catch (e) {
    uiStore.showToast('加载分站列表失败', 'error');
  }
  loading.value = false;
};

const closeForm = () => {
  showCreate.value = false;
  editingSite.value = null;
  form.value = emptyForm();
};

const editSite = (site) => {
  editingSite.value = site;
  form.value = {
    name: site.name,
    domain: site.domain,
    logo: site.logo || '',
    multiplier: site.multiplier,
    agent_discount: site.agent_discount,
    owner_id: site.owner_id || '',
    announcement: site.announcement || ''
  };
};

const saveSite = async () => {
  if (!form.value.name || !form.value.domain) {
    return uiStore.showToast('站点名称和域名不能为空', 'error');
  }

  saving.value = true;
  try {
    const isEdit = !!editingSite.value;
    const url = isEdit ? `/api/sites/${editingSite.value.id}` : '/api/sites';
    const method = isEdit ? 'PUT' : 'POST';

    const body = {
      name: form.value.name,
      domain: form.value.domain,
      logo: form.value.logo || null,
      multiplier: parseFloat(form.value.multiplier),
      agent_discount: parseFloat(form.value.agent_discount),
      announcement: form.value.announcement || null
    };
    if (isAdmin.value && form.value.owner_id) body.owner_id = parseInt(form.value.owner_id);

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userStore.token}`
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (data.status === 'success') {
      uiStore.showToast(isEdit ? '分站已更新' : '分站创建成功！记得配置DNS和Nginx', 'success');
      closeForm();
      fetchSites();
    } else {
      uiStore.showAlert(data.message || '操作失败', '错误');
    }
  } catch (e) {
    uiStore.showToast('网络异常', 'error');
  }
  saving.value = false;
};

const toggleSiteStatus = async (site) => {
  const newStatus = site.status === 'active' ? 'suspended' : 'active';
  const action = newStatus === 'active' ? '启用' : '暂停';
  const confirmed = await uiStore.showConfirm(`确认${action}分站「${site.name}」吗？`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/sites/${site.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userStore.token}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.status === 'success') {
      uiStore.showToast(`分站已${action}`, 'success');
      fetchSites();
    } else {
      uiStore.showToast(data.message || '操作失败', 'error');
    }
  } catch (e) {
    uiStore.showToast('网络异常', 'error');
  }
};

const deleteSite = async () => {
  if (!editingSite.value) return;
  const confirmed = await uiStore.showConfirm(`确定要永久删除分站「${editingSite.value.name}」吗？此操作不可恢复！`, '⚠️ 高危操作');
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/sites/${editingSite.value.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${userStore.token}` }
    });
    const data = await res.json();
    if (data.status === 'success') {
      uiStore.showToast('分站已删除', 'success');
      closeForm();
      fetchSites();
    } else {
      uiStore.showToast(data.message || '删除失败', 'error');
    }
  } catch (e) {
    uiStore.showToast('网络异常', 'error');
  }
};

onMounted(() => fetchSites());
</script>

<style>
.custom-scrollbar::-webkit-scrollbar { width: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 4px; }
</style>
