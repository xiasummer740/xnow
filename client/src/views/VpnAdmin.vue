<template>
  <div class="min-h-full text-white space-y-6">
    <h1 class="text-2xl md:text-3xl font-black tracking-tight text-white">{{ appStore.lang === 'zh' ? '节点管理密室' : 'Node Admin Panel' }}</h1>

    <!-- Global Toggle (super_admin only) -->
    <div v-if="userStore.userInfo?.role === 'super_admin'" class="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 flex items-center justify-between">
      <div>
        <span class="text-white font-bold text-sm">{{ appStore.lang === 'zh' ? '🌐 VPN 节点商城' : '🌐 VPN Shop' }}</span>
        <span :class="['ml-2 text-xs font-bold', shopEnabled ? 'text-emerald-400' : 'text-red-400']">{{ shopEnabled ? (appStore.lang === 'zh' ? '已开启' : 'ON') : (appStore.lang === 'zh' ? '已关闭' : 'OFF') }}</span>
      </div>
      <button @click="toggleShop" class="px-4 py-2 rounded-xl font-bold text-sm transition" :class="shopEnabled ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'">
        {{ shopEnabled ? (appStore.lang === 'zh' ? '关闭商城' : 'Disable Shop') : (appStore.lang === 'zh' ? '开启商城' : 'Enable Shop') }}
      </button>
    </div>

    <!-- API Key Config Card -->
    <div class="bg-slate-900/60 border border-amber-500/40 rounded-2xl p-6">
      <h2 class="text-lg font-bold text-amber-400 mb-1">{{ appStore.lang === 'zh' ? '🔑 XX-UI API 密钥' : '🔑 XX-UI API Key' }}</h2>
      <p class="text-xs text-slate-500 mb-4">{{ appStore.lang === 'zh' ? '全局默认密钥。若多台 VPS 使用相同 API Key，填这里即可。每台 VPS 使用不同 Key 时，在下方节点的「独立 Key」字段单独设定。在 XX-UI 面板 → 设置 → 远程访问 → 生成密钥。' : 'Default key. If all VPS share one key, set it here. For per-VPS keys, fill each node\'s individual key field below.' }}</p>
      <div class="flex space-x-2">
        <input :type="showKey ? 'text' : 'password'" v-model="apiKey" class="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm outline-none focus:border-amber-400 transition" :placeholder="appStore.lang === 'zh' ? '粘贴 XX-UI 生成的 API Key...' : 'Paste XX-UI API Key...'" />
        <button @click="showKey = !showKey" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition text-sm">{{ showKey ? '隐藏' : '显示' }}</button>
        <button @click="saveApiKey" :disabled="savingKey" class="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold transition text-sm disabled:opacity-50">{{ savingKey ? '...' : '保存' }}</button>
      </div>
      <p v-if="keyMsg" :class="['text-xs mt-2', keyMsgOk ? 'text-emerald-400' : 'text-red-400']">{{ keyMsg }}</p>
    </div>

    <!-- Setup Guide (collapsed by default once key is set) -->
    <div v-if="!apiKey" class="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6">
      <h2 class="text-lg font-bold text-white mb-3">{{ appStore.lang === 'zh' ? '📖 首次配置指南' : '📖 First-Time Setup' }}</h2>
      <div class="space-y-2 text-sm text-slate-400">
        <p>1. {{ appStore.lang === 'zh' ? '登录你部署的 XX-UI 面板 → 设置 → "远程访问" Tab → 点击"生成密钥"' : 'Login to XX-UI → Settings → "Remote Access" tab → Generate API Key' }}</p>
        <p>2. {{ appStore.lang === 'zh' ? '复制生成的密钥，粘贴到上方 API 密钥输入框并保存' : 'Copy the key and paste above, then save' }}</p>
        <p>3. {{ appStore.lang === 'zh' ? '在 XX-UI 入站列表中，编辑要售卖的入站，勾选"允许远程管理"（allow_remote）' : 'In XX-UI inbound list, edit the inbound and check "allow_remote"' }}</p>
        <p>4. {{ appStore.lang === 'zh' ? '在下方添加节点，填入该 XX-UI 面板地址和对应的入站 ID' : 'Add nodes below with the XX-UI panel URL and inbound ID' }}</p>
      </div>
    </div>

    <!-- Node List -->
    <div class="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-white">{{ appStore.lang === 'zh' ? '🖥️ 节点列表' : '🖥️ Node List' }}</h2>
        <button @click="editServer(null)" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-sm transition">{{ appStore.lang === 'zh' ? '+ 添加节点' : '+ Add Node' }}</button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-slate-500 text-xs uppercase tracking-wider"><th class="p-3">名称</th><th class="p-3">地址</th><th class="p-3">入站</th><th class="p-3">订阅端口</th><th class="p-3">已售/上限</th><th class="p-3">单价</th><th class="p-3">状态</th><th class="p-3"></th></tr></thead>
          <tbody>
            <tr v-for="s in servers" :key="s.id" class="border-t border-slate-800 hover:bg-slate-800/50 transition">
              <td class="p-3 font-bold text-white whitespace-nowrap">{{ s.flag_emoji }} {{ s.name }}</td>
              <td class="p-3 text-slate-400 font-mono text-xs max-w-[120px] truncate" :title="s.xxui_url">{{ s.xxui_url || '—' }}</td>
              <td class="p-3 text-white">{{ s.xxui_inbound_id || '—' }}</td>
              <td class="p-3 text-white">{{ s.sub_port || 2096 }}</td>
              <td class="p-3"><span :class="(usageMap[s.id] || 0) >= s.max_traffic_gb ? 'text-red-400' : 'text-white'">{{ usageMap[s.id] || 0 }} / {{ s.max_traffic_gb }}GB</span></td>
              <td class="p-3 text-white">¥{{ parseFloat(s.price_per_gb || 0).toFixed(2) }}</td>
              <td class="p-3"><span :class="['px-2 py-0.5 rounded-full text-xs font-bold', s.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500']">{{ s.active ? '启用' : '禁用' }}</span></td>
              <td class="p-3 space-x-2 whitespace-nowrap"><button @click="editServer(s)" class="text-blue-400 hover:text-blue-300 text-xs">编辑</button><button @click="deleteServer(s)" class="text-red-400 hover:text-red-300 text-xs">删除</button></td>
            </tr>
            <tr v-if="servers.length === 0"><td colspan="8" class="p-6 text-center text-slate-500">{{ appStore.lang === 'zh' ? '暂无节点，点击"+ 添加节点"按钮添加' : 'No nodes yet' }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recent Orders -->
    <div class="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-white">{{ appStore.lang === 'zh' ? '📋 最近订单' : '📋 Recent Orders' }}</h2>
        <div class="flex items-center space-x-2">
          <select v-model="syncInterval" @change="startAutoSync" class="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-400 outline-none focus:border-cyan-400">
            <option :value="0">{{ appStore.lang === 'zh' ? '关闭自动' : 'Off' }}</option>
            <option :value="5">5s</option>
            <option :value="10">10s</option>
            <option :value="30">30s</option>
            <option :value="60">60s</option>
          </select>
          <button @click="syncTraffic" :disabled="syncing" class="px-3 py-1.5 rounded-lg text-xs font-bold transition" :class="syncing ? 'bg-slate-800 text-slate-500' : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'">{{ syncing ? '...' : (appStore.lang === 'zh' ? '🔄' : '🔄') }}</button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-slate-500 text-xs uppercase tracking-wider"><th class="p-3">用户ID</th><th class="p-3">Email</th><th class="p-3">已用/总额</th><th class="p-3">位置</th><th class="p-3">到期</th><th class="p-3"></th></tr></thead>
          <tbody>
            <tr v-for="c in clients" :key="c.id" class="border-t border-slate-800 hover:bg-slate-800/50 transition">
              <td class="p-3 text-white">{{ c.user_id }}</td>
              <td class="p-3 text-slate-400 font-mono text-xs">{{ c.email }}</td>
              <td class="p-3 text-white text-xs">{{ formatUsed(c) }} / {{ c.traffic_gb }}GB</td>
              <td class="p-3 text-slate-400">{{ c.vps_location }}</td>
              <td class="p-3" :class="c.expiry_time < Date.now() ? 'text-red-400' : 'text-slate-400'">{{ formatDate(c.expiry_time) }}</td>
              <td class="p-3"><button @click="deleteClient(c)" class="text-red-400 hover:text-red-300 text-xs">删除</button></td>
            </tr>
            <tr v-if="clients.length === 0"><td colspan="5" class="p-6 text-center text-slate-500">{{ appStore.lang === 'zh' ? '暂无订单' : 'No orders yet' }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editMode !== null" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" @click.self="editMode = null">
      <div class="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
        <h2 class="text-lg font-bold text-white">{{ editing.id ? '编辑节点' : '添加节点' }}</h2>
        <div class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-3">
            <div><label class="text-slate-400 text-xs">名称 *</label><input v-model="editing.name" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-400" placeholder="例如: 日本东京"></div>
            <div><label class="text-slate-400 text-xs">旗帜 Emoji</label><input v-model="editing.flag_emoji" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white" placeholder="🇯🇵"></div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="text-slate-400 text-xs">位置描述</label><input v-model="editing.vps_location" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white" placeholder="日本东京 · BGP"></div>
            <div><label class="text-slate-400 text-xs">节点描述</label><input v-model="editing.description" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white" placeholder="BGP 高速线路..."></div>
          </div>
          <div><label class="text-slate-400 text-xs">XX-UI 面板地址 *</label><input v-model="editing.xxui_url" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none focus:border-emerald-400" placeholder="https://panel.yourdomain.com"></div>
          <div class="grid grid-cols-3 gap-3">
            <div><label class="text-slate-400 text-xs">入站 ID *</label><input v-model.number="editing.xxui_inbound_id" type="number" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-400" placeholder="1"></div>
            <div><label class="text-slate-400 text-xs">最大流量(GB)</label><input v-model.number="editing.max_traffic_gb" type="number" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"></div>
            <div><label class="text-slate-400 text-xs">单价(¥/GB)</label><input v-model.number="editing.price_per_gb" type="number" step="0.01" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"></div>
          </div>
          <div><label class="text-slate-400 text-xs">订阅端口 (默认 2096)</label><input v-model.number="editing.sub_port" type="number" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-400"></div>
          <div><label class="text-slate-400 text-xs">节点独立 API Key（可选，留空则用全局密钥）</label><input v-model="editing.xxui_api_key" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none focus:border-emerald-400" placeholder="留空则使用全局 API Key"></div>
          <div class="pt-2">
            <button type="button" @click="testConnection" :disabled="testingConn" class="px-4 py-2 rounded-xl font-bold text-sm transition" :class="connResult && connResult.status === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : connResult ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'">
              {{ testingConn ? '检测中...' : (connResult ? (connResult.status === 'success' ? '✓ ' + connResult.message : '✗ ' + connResult.message) : (appStore.lang === 'zh' ? '🔍 检测连通性' : '🔍 Test Connection')) }}
            </button>
          </div>
          <label class="flex items-center space-x-2 cursor-pointer"><input v-model="editing.active" type="checkbox" class="w-4 h-4 rounded accent-emerald-500"> <span class="text-slate-400">启用此节点</span></label>
        </div>
        <div class="flex space-x-3 pt-2">
          <button @click="saveServer" :disabled="savingNode" class="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold transition disabled:opacity-50">{{ savingNode ? '...' : '保存' }}</button>
          <button @click="editMode = null" class="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition">取消</button>
        </div>
        <p v-if="editErr" class="text-red-400 text-xs">{{ editErr }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useAppStore } from '../stores/app';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui';

const appStore = useAppStore(); const userStore = useUserStore(); const uiStore = useUiStore();
const shopEnabled = ref(true);
const servers = ref([]); const clients = ref([]); const usageMap = ref({});
const editMode = ref(null); const editErr = ref('');
const savingNode = ref(false);
const apiKey = ref(''); const savingKey = ref(false); const showKey = ref(false);
const keyMsg = ref(''); const keyMsgOk = ref(false);
const editing = ref({ id: null, name: '', vps_location: '', flag_emoji: '', xxui_url: '', xxui_inbound_id: 0, max_traffic_gb: 2000, price_per_gb: 0.50, sub_port: 2096, xxui_api_key: '', active: true, description: '' });

onMounted(() => { fetchData(); fetchApiKey(); fetchShopStatus(); });
onUnmounted(() => { clearInterval(syncTimer); });

const apiHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` });
const getHeaders = () => ({ 'Authorization': `Bearer ${userStore.token}` });

const fetchShopStatus = async () => {
  try { const r = await fetch('/api/vpn/status'); const d = await r.json(); shopEnabled.value = d.enabled; } catch (e) {}
};
const toggleShop = async () => {
  const h = apiHeaders();
  const r = await fetch('/api/vpn/admin/toggle-shop', { method: 'POST', headers: h, body: JSON.stringify({ enabled: !shopEnabled.value }) });
  const d = await r.json();
  if (d.status === 'success') shopEnabled.value = d.enabled;
};
const fetchApiKey = async () => {
  try {
    const r = await fetch('/api/vpn/admin/apikey', { headers: getHeaders() });
    const d = await r.json();
    if (d.status === 'success') apiKey.value = d.data || '';
  } catch (e) { /* backend not available */ }
};

const saveApiKey = async () => {
  savingKey.value = true; keyMsg.value = '';
  try {
    const r = await fetch('/api/vpn/admin/apikey', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ apiKey: apiKey.value }) });
    const d = await r.json();
    keyMsgOk.value = d.status === 'success';
    keyMsg.value = keyMsgOk.value ? (appStore.lang === 'zh' ? '密钥已保存' : 'Key saved') : (d.message || '保存失败');
  } catch (e) {
    keyMsgOk.value = false;
    keyMsg.value = appStore.lang === 'zh' ? '后端未部署，无法保存。部署后此功能可用。' : 'Backend not deployed. This will work after deployment.';
  }
  savingKey.value = false;
};

const fetchData = async () => {
  try {
    const r = await fetch('/api/vpn/admin/servers', { headers: getHeaders() });
    const d = await r.json();
    if (d.status === 'success') servers.value = d.data;
  } catch (e) {}
  try {
    const r = await fetch('/api/vpn/admin/clients', { headers: getHeaders() });
    const d = await r.json();
    if (d.status === 'success') {
      clients.value = d.data;
      // Compute per-node usage: sum of traffic_gb for active (non-expired) clients
      const now = Date.now();
      const map = {};
      d.data.forEach(c => {
        if (c.expiry_time && c.expiry_time > now) {
          map[c.product_id] = (map[c.product_id] || 0) + (c.traffic_gb || 0);
        }
      });
      usageMap.value = map;
    }
  } catch (e) {}
};

const editServer = (s) => {
  editErr.value = ''; connResult.value = null;
  editMode.value = true;
  editing.value = s ? { ...s } : { id: null, name: '', vps_location: '', flag_emoji: '', xxui_url: '', xxui_inbound_id: 0, max_traffic_gb: 2000, price_per_gb: 0.50, sub_port: 2096, xxui_api_key: '', active: true, description: '' };
};

const testingConn = ref(false); const connResult = ref(null);
const testConnection = async () => {
  testingConn.value = true; connResult.value = null;
  try {
    const r = await fetch('/api/vpn/admin/test-connection', {
      method: 'POST', headers: apiHeaders(),
      body: JSON.stringify({ xxui_url: editing.value.xxui_url, api_key: editing.value.xxui_api_key, inbound_id: editing.value.xxui_inbound_id })
    });
    connResult.value = await r.json();
  } catch (e) { connResult.value = { status: 'error', message: '网络异常' }; }
  testingConn.value = false;
};
const saveServer = async () => {
  if (!editing.value.name || !editing.value.xxui_inbound_id) {
    editErr.value = appStore.lang === 'zh' ? '名称和入站 ID 为必填项' : 'Name and inbound ID are required';
    return;
  }
  savingNode.value = true; editErr.value = '';
  try {
    const r = await fetch('/api/vpn/admin/server', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(editing.value) });
    const d = await r.json();
    if (d.status === 'success') { editMode.value = null; fetchData(); uiStore.showToast(appStore.lang === 'zh' ? '已保存' : 'Saved', 'success'); }
    else editErr.value = d.message || '保存失败';
  } catch (e) {
    editErr.value = appStore.lang === 'zh' ? '后端未部署，无法保存。部署后此功能可用。' : 'Backend offline. Will work after deployment.';
  }
  savingNode.value = false;
};

const syncing = ref(false); const syncInterval = ref(0); let syncTimer = null;
const doSync = async () => {
  syncing.value = true;
  try {
    const r = await fetch('/api/vpn/admin/sync-traffic', {
      method: 'POST', headers: apiHeaders(),
      body: JSON.stringify({ clients: clients.value.map(c => ({ id: c.id, email: c.email, product_id: c.product_id })) })
    });
    const d = await r.json();
    if (d.status === 'success' && d.data) {
      d.data.forEach(u => {
        const c = clients.value.find(x => x.id === u.id);
        if (c) { c.traffic_used_up = u.up; c.traffic_used_down = u.down; }
      });
    }
  } catch (e) { /* */ }
  syncing.value = false;
};
const syncTraffic = async () => { await doSync(); };
const startAutoSync = () => {
  clearInterval(syncTimer);
  if (syncInterval.value > 0) {
    syncTimer = setInterval(doSync, syncInterval.value * 1000);
  }
};
const deleteClient = async (c) => {
  if (!await uiStore.showConfirm(`确认删除订单「${c.email}」？也会尝试从 XX-UI 删除该客户端。`)) return;
  try {
    await fetch(`/api/vpn/admin/client/${c.id}`, { method: 'DELETE', headers: getHeaders() });
    fetchData();
  } catch (e) { uiStore.showToast('删除失败', 'error'); }
};
const deleteServer = async (s) => {
  if (!await uiStore.showConfirm(`确认删除「${s.name}」？此操作不可恢复。`)) return;
  try {
    await fetch(`/api/vpn/admin/server/${s.id}`, { method: 'DELETE', headers: getHeaders() });
    fetchData();
  } catch (e) { uiStore.showToast(appStore.lang === 'zh' ? '删除失败' : 'Delete failed', 'error'); }
};

const formatDate = (ts) => ts ? new Date(ts).toLocaleDateString('zh-CN') : '--';
const formatUsed = (c) => {
  const bytes = (parseInt(c.traffic_used_up || 0) + parseInt(c.traffic_used_down || 0));
  return bytes > 0 ? (bytes / 1073741824).toFixed(2) + 'GB' : '0';
};
</script>
