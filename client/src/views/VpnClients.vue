<template>
  <div class="min-h-full text-white space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl md:text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-teal-400 to-cyan-500">{{ appStore.lang === 'zh' ? '我的节点' : 'My Nodes' }}</h1>
      <router-link to="/vpn" class="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-sm hover:bg-emerald-500/30 transition">{{ appStore.lang === 'zh' ? '选购节点' : 'Get Node' }}</router-link>
    </div>

    <div v-if="loading" class="flex justify-center py-20"><div class="animate-spin rounded-full h-10 w-10 border-2 border-emerald-400 border-t-transparent"></div></div>

    <div v-else-if="clients.length === 0 && !demoMode" class="text-center py-20">
      <div class="text-5xl mb-4">🛡️</div>
      <p class="text-slate-500 text-lg mb-4">{{ appStore.lang === 'zh' ? '暂无节点，去选购一个吧' : 'No active nodes.' }}</p>
      <router-link to="/vpn" class="inline-block px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold transition">{{ appStore.lang === 'zh' ? '选购节点' : 'Get a Node' }}</router-link>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div v-for="c in clients" :key="c.id" class="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 hover:border-emerald-500/40 transition shadow-lg group">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="flex items-center space-x-2">
              <h3 class="text-white font-bold group-hover:text-emerald-300 transition text-sm font-mono truncate max-w-[180px]">{{ c.email }}</h3>
              <button @click="copy(c.email)" class="text-slate-600 hover:text-emerald-400 transition flex-shrink-0" :title="appStore.lang === 'zh' ? '复制' : 'Copy'"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></button>
            </div>
            <span v-if="c.vps_location" class="text-xs text-slate-500">{{ c.flag_emoji }} {{ c.vps_location }}</span>
          </div>
          <span :class="['text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0', isExpired(c) ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30']">{{ isExpired(c) ? (appStore.lang === 'zh' ? '已过期' : 'Expired') : (appStore.lang === 'zh' ? '运行中' : 'Active') }}</span>
        </div>

        <!-- Traffic Bar -->
        <div class="mb-3">
          <div class="flex justify-between text-xs mb-1">
            <span class="text-slate-500">{{ appStore.lang === 'zh' ? '流量使用' : 'Traffic Used' }}</span>
            <span class="text-slate-400 font-mono">{{ formatTrafficUsed(c) }} / {{ c.traffic_gb }}GB</span>
          </div>
          <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div :class="['h-full rounded-full transition-all', trafficPercent(c) > 90 ? 'bg-red-500' : trafficPercent(c) > 70 ? 'bg-amber-500' : 'bg-emerald-500']" :style="{ width: Math.min(trafficPercent(c), 100) + '%' }"></div>
          </div>
        </div>

        <div class="flex items-center justify-between text-xs mb-4">
          <span class="text-slate-500">{{ appStore.lang === 'zh' ? '到期' : 'Expires' }}: {{ formatExpiry(c.expiry_time) }}</span>
          <span v-if="c.uuid" class="text-slate-600 font-mono text-[10px]">UUID: {{ c.uuid.substring(0, 8) }}...</span>
        </div>

        <div class="flex items-center space-x-2">
          <button @click="showDetail(c)" class="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition">{{ appStore.lang === 'zh' ? '连接信息' : 'Connect Info' }}</button>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="detail" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" @click.self="detail = null">
      <div class="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-[0_0_60px_rgba(16,185,129,0.15)]">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-white">{{ appStore.lang === 'zh' ? '连接信息' : 'Connection Info' }}</h3>
          <button @click="detail = null" class="text-slate-400 hover:text-white text-xl">&times;</button>
        </div>

        <!-- Status -->
        <div class="text-center py-2">
          <span :class="['inline-block px-4 py-1.5 rounded-full text-sm font-bold', isExpired(detail) ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400']">{{ isExpired(detail) ? (appStore.lang === 'zh' ? '⚠️ 已过期' : '⚠️ Expired') : (appStore.lang === 'zh' ? '🟢 运行中' : '🟢 Active') }}</span>
        </div>

        <!-- Info rows -->
        <div class="space-y-1.5 bg-slate-800/60 rounded-2xl p-4">
          <div v-for="row in detailRows" :key="row.label" class="flex items-center justify-between py-1.5 border-b border-slate-700/50 last:border-0">
            <span class="text-xs text-slate-500 flex-shrink-0">{{ row.label }}</span>
            <div class="flex items-center space-x-1.5 max-w-[220px]">
              <span class="text-xs text-white font-mono truncate" :title="row.value">{{ row.value }}</span>
              <button v-if="row.copy" @click="copy(row.value)" class="text-slate-600 hover:text-emerald-400 flex-shrink-0"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></button>
            </div>
          </div>
        </div>

        <!-- QR Code -->
        <div v-if="detail.subscription_url" class="flex flex-col items-center py-2">
          <img :src="qrcodeUrl(detail.subscription_url)" class="w-48 h-48 rounded-2xl bg-white p-2" alt="QR Code" />
          <p class="text-[10px] text-slate-500 mt-2">{{ appStore.lang === 'zh' ? '使用小火箭 / V2Ray / Sing-Box 扫码导入' : 'Scan with Shadowrocket / V2Ray / Sing-Box' }}</p>
        </div>

        <!-- Subscription URL Box -->
        <div v-if="detail.subscription_url" class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
          <div class="text-xs text-emerald-400 font-bold mb-2">{{ appStore.lang === 'zh' ? '📡 订阅链接' : '📡 Subscription Link' }}</div>
          <div class="flex items-center space-x-2">
            <code class="flex-1 text-xs text-white break-all font-mono bg-slate-800 rounded-lg p-2">{{ detail.subscription_url }}</code>
            <button @click="copy(detail.subscription_url)" class="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-xs flex-shrink-0 transition">{{ copied === detail.subscription_url ? '✓' : (appStore.lang === 'zh' ? '复制' : 'Copy') }}</button>
          </div>
          <p class="text-[10px] text-slate-500 mt-2">{{ appStore.lang === 'zh' ? '将此链接导入 V2Ray / Clash / Sing-Box 等客户端即可使用' : 'Import this link into V2Ray / Clash / Sing-Box clients' }}</p>
        </div>

        <button @click="detail = null" class="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition">{{ appStore.lang === 'zh' ? '关闭' : 'Close' }}</button>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-bold z-[10001] shadow-lg">{{ toast }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from '../stores/app';
import { useUserStore } from '../stores/user';

const appStore = useAppStore(); const userStore = useUserStore();
const clients = ref([]); const loading = ref(true); const detail = ref(null);
const copied = ref(''); const toast = ref('');
const demoMode = ref(false);

onMounted(async () => {
  if (!userStore.token) { loading.value = false; return; }
  try {
    const res = await fetch('/api/vpn/clients', { headers: { 'Authorization': `Bearer ${userStore.token}` } });
    const data = await res.json();
    if (data.status === 'success') clients.value = data.data;
    if (clients.value.length === 0) demoMode.value = true;
  } catch (e) { demoMode.value = true; }
  if (demoMode.value) {
    const now = Math.floor(Date.now() / 1000);
    clients.value = [
      { id: 1, email: 'u1_p1_a3f8c2@vpn', uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', traffic_gb: 200, traffic_used_up: 32_000_000_000, traffic_used_down: 8_000_000_000, expiry_time: now + 86400 * 75, vps_location: '洛杉矶', flag_emoji: '🇺🇸', subscription_url: 'https://panel.example.com/sub/abc123', _demo: true },
      { id: 2, email: 'u1_p2_b7e1d9@vpn', uuid: 'f9e8d7c6-b5a4-3210-fedc-ba9876543210', traffic_gb: 500, traffic_used_up: 0, traffic_used_down: 0, expiry_time: now + 86400 * 10, vps_location: '伦敦', flag_emoji: '🇬🇧', subscription_url: '', _demo: true },
    ];
  }
  loading.value = false;
});

const isExpired = (c) => !c.expiry_time || (Date.now() / 1000) > c.expiry_time;
const formatExpiry = (ts) => ts ? new Date(ts * 1000).toLocaleDateString('zh-CN') : '--';
const formatTrafficUsed = (c) => {
  const used = (parseInt(c.traffic_used_up || 0) + parseInt(c.traffic_used_down || 0));
  const usedGB = (used / 1073741824).toFixed(2);
  return usedGB;
};
const trafficPercent = (c) => {
  const used = parseInt(c.traffic_used_up || 0) + parseInt(c.traffic_used_down || 0);
  const total = (c.traffic_gb || 1) * 1073741824;
  return Math.round((used / total) * 100);
};

const showDetail = (c) => { detail.value = c; };
const qrcodeUrl = (url) => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

const detailRows = computed(() => {
  if (!detail.value) return [];
  const rows = [
    { label: appStore.lang === 'zh' ? '📧 账号' : '📧 Email', value: detail.value.email, copy: true },
  ];
  if (detail.value.uuid) rows.push({ label: '🔑 UUID', value: detail.value.uuid, copy: true });
  if (detail.value.vps_location) rows.push({ label: appStore.lang === 'zh' ? '📍 节点' : '📍 Node', value: detail.value.vps_location, copy: false });
  rows.push({ label: appStore.lang === 'zh' ? '📦 流量' : '📦 Traffic', value: `${formatTrafficUsed(detail.value)} / ${detail.value.traffic_gb} GB`, copy: false });
  rows.push({ label: appStore.lang === 'zh' ? '📅 到期' : '📅 Expiry', value: formatExpiry(detail.value.expiry_time), copy: false });
  return rows;
});

const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = text;
    toast.value = appStore.lang === 'zh' ? '已复制' : 'Copied!';
    setTimeout(() => { toast.value = ''; copied.value = ''; }, 1500);
  } catch (e) { /* */ }
};
</script>
