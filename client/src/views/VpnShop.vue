<template>
  <div class="vpn-shop min-h-full">
    <!-- Hero -->
    <section class="shop-hero text-center py-14 md:py-20 relative overflow-hidden">
      <div class="shop-hero-glow"></div>
      <div class="relative z-10 max-w-3xl mx-auto px-4">
        <div class="shop-badge mb-4">{{ appStore.lang === 'zh' ? '企业级加密隧道 · 即买即用' : 'Enterprise Tunnels · Instant Setup' }}</div>
        <h1 class="shop-title text-3xl md:text-5xl font-black mb-3">
          {{ appStore.lang === 'zh' ? '全球高速网络，一键连接' : 'Borderless Internet, One Tap Away' }}
        </h1>
        <p class="shop-subtitle text-sm md:text-base max-w-xl mx-auto">
          {{ appStore.lang === 'zh' ? 'Xray 核心驱动，VLESS/VLESS/VMess/Trojan 全协议支持。多节点覆盖，流量灵活选配，余额支付秒级开通。' : 'Powered by Xray Core. Full protocol support. Flexible traffic plans. Pay with balance, activate instantly.' }}
        </p>
      </div>
    </section>

    <!-- Main Layout -->
    <section class="max-w-5xl mx-auto px-4 pb-20">
      <div v-if="loading" class="flex justify-center py-20"><div class="shop-spinner"></div></div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Left: Node selector -->
        <div class="lg:col-span-5 space-y-3">
          <div class="shop-section-label">{{ appStore.lang === 'zh' ? '选择节点' : 'Select Node' }}</div>
          <div v-for="n in nodes" :key="n.id" @click="selectedNode = n" class="shop-node-card" :class="{ 'is-selected': selectedNode?.id === n.id }">
            <div class="flex items-center gap-3">
              <img :src="getFlagUrl(n)" class="vpn-flag" @error="e=>e.target.style.display='none'" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <h3 class="font-bold text-[15px] truncate">{{ n.name }}</h3>
                  <span v-if="selectedNode?.id === n.id" class="shop-check">✓</span>
                </div>
                <p class="text-xs opacity-60 truncate">{{ n.vps_location }}</p>
              </div>
            </div>
            <div class="flex justify-between items-center mt-2 text-xs opacity-50">
              <span>¥{{ parseFloat(n.price_per_gb).toFixed(2) }}/GB</span>
              <span>上限 {{ n.max_traffic_gb }}GB</span>
            </div>
          </div>
          <div v-if="nodes.length === 0" class="shop-node-card text-center py-8 opacity-50">
            <div class="text-2xl mb-2">🖥️</div>
            <p>{{ appStore.lang === 'zh' ? '暂无可用节点' : 'No nodes available' }}</p>
          </div>
        </div>

        <!-- Right: Config -->
        <div class="lg:col-span-7 space-y-5">
          <template v-if="!selectedNode">
            <div class="shop-panel text-center py-16 opacity-40">
              <div class="text-4xl mb-3">👈</div>
              <p>{{ appStore.lang === 'zh' ? '请先从左侧选择一个节点' : 'Select a node to continue' }}</p>
            </div>
          </template>
          <template v-else>
            <!-- Traffic -->
            <div class="shop-panel">
              <div class="shop-section-label">{{ appStore.lang === 'zh' ? '流量配额' : 'Traffic' }}</div>
              <div class="grid grid-cols-3 md:grid-cols-5 gap-2">
                <button v-for="g in trafficOptions.filter(t => t <= (selectedNode?.max_traffic_gb || 2000))" :key="g" @click="selectedTraffic = g" class="shop-option" :class="{ 'is-active': selectedTraffic === g }">
                  {{ g >= 1000 ? (g/1000).toFixed(1)+'TB' : g+'GB' }}
                </button>
              </div>
            </div>

            <!-- Duration -->
            <div class="shop-panel">
              <div class="shop-section-label">{{ appStore.lang === 'zh' ? '使用时长' : 'Duration' }}</div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button v-for="d in durationOptions" :key="d.days" @click="selectedDuration = d" class="shop-option text-center" :class="{ 'is-active': selectedDuration?.days === d.days }">
                  <div class="font-bold">{{ d.label }}</div>
                  <div v-if="d.discount < 1" class="text-[10px] opacity-60">{{ Math.round((1-d.discount)*100) }}% OFF</div>
                </button>
              </div>
            </div>

            <!-- Price + Buy -->
            <div class="shop-panel">
              <div class="flex justify-between items-baseline mb-4">
                <div class="text-sm opacity-60">{{ selectedNode.name }} · {{ selectedTraffic }}GB · {{ selectedDuration?.label }}</div>
                <div v-if="selectedDuration?.discount < 1" class="text-xs" style="color:var(--vpn-accent)">{{ Math.round((1-selectedDuration.discount)*100) }}% {{ appStore.lang === 'zh' ? '折扣' : 'OFF' }}</div>
              </div>
              <div class="flex items-baseline justify-between mb-4">
                <span class="text-sm opacity-50">{{ appStore.lang === 'zh' ? '应付金额' : 'Total' }}</span>
                <span class="vpn-price text-3xl">¥{{ finalPrice.toFixed(2) }}</span>
              </div>
              <div class="flex items-center justify-between text-xs mb-4" :class="parseFloat(userStore.userInfo?.balance || 0) < finalPrice ? 'shop-balance-low' : 'shop-balance-ok'">
                <span>{{ appStore.lang === 'zh' ? '账户余额' : 'Balance' }}: ¥{{ parseFloat(userStore.userInfo?.balance || 0).toFixed(2) }}</span>
                <span v-if="parseFloat(userStore.userInfo?.balance || 0) < finalPrice">⚠️ {{ appStore.lang === 'zh' ? '余额不足' : 'Insufficient' }}</span>
              </div>
              <router-link v-if="parseFloat(userStore.userInfo?.balance || 0) < finalPrice" to="/recharge" class="shop-recharge-link">
                💳 {{ appStore.lang === 'zh' ? '点击充值' : 'Recharge Now' }} →
              </router-link>
              <button @click="buy" :disabled="buying" class="vpn-btn w-full py-3 text-base">
                {{ buying ? '...' : (appStore.lang === 'zh' ? '立即购买' : 'Buy Now') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </section>

    <!-- Success -->
    <div v-if="showSuccess" class="vpn-modal-overlay" @click.self="showSuccess = false">
      <div class="vpn-modal text-center space-y-4">
        <div class="text-5xl">✅</div>
        <h2 class="text-xl font-black">{{ appStore.lang === 'zh' ? '购买成功！' : 'Purchase Successful!' }}</h2>
        <p v-if="purchaseResult?.email" class="text-xs opacity-60 font-mono bg-white/5 rounded-lg px-3 py-1.5 mx-auto inline-block">{{ purchaseResult.email }}</p>
        <p class="text-sm opacity-60">{{ appStore.lang === 'zh' ? '节点已创建，在「我的节点」查看连接信息' : 'Your node is ready.' }}</p>
        <button @click="goToClients" class="vpn-btn w-full">{{ appStore.lang === 'zh' ? '查看我的节点' : 'View My Nodes' }}</button>
        <button @click="showSuccess = false" class="vpn-btn vpn-btn-ghost w-full">{{ appStore.lang === 'zh' ? '继续选购' : 'Continue Shopping' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/app';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui';

const router = useRouter();
const appStore = useAppStore(); const userStore = useUserStore(); const uiStore = useUiStore();

const FLAG_CODE = { hk:'hk',hongkong:'hk',jp:'jp',japan:'jp',kr:'kr',korea:'kr',tw:'tw',taiwan:'tw',cn:'cn',china:'cn',sg:'sg',singapore:'sg',th:'th',thailand:'th',vn:'vn',vietnam:'vn',my:'my',malaysia:'my',ph:'ph',philippines:'ph',id:'id',indonesia:'id',in:'in',india:'in',ae:'ae',uae:'ae',sa:'sa',tr:'tr',us:'us',usa:'us',ca:'ca',canada:'ca',uk:'gb',gb:'gb',de:'de',germany:'de',nl:'nl',netherlands:'nl',fr:'fr',france:'fr',ru:'ru',russia:'ru',se:'se',sweden:'se',ch:'ch',switzerland:'ch',it:'it',italy:'it',es:'es',spain:'es',pl:'pl',poland:'pl',au:'au',australia:'au',br:'br',brazil:'br',ar:'ar',argentina:'ar',za:'za',southafrica:'za',mx:'mx',mexico:'mx' };
const EMOJI_TO_CODE = { '🇭🇰':'hk','🇯🇵':'jp','🇰🇷':'kr','🇹🇼':'tw','🇨🇳':'cn','🇸🇬':'sg','🇹🇭':'th','🇻🇳':'vn','🇲🇾':'my','🇵🇭':'ph','🇮🇩':'id','🇮🇳':'in','🇦🇪':'ae','🇸🇦':'sa','🇹🇷':'tr','🇺🇸':'us','🇨🇦':'ca','🇬🇧':'gb','🇩🇪':'de','🇳🇱':'nl','🇫🇷':'fr','🇷🇺':'ru','🇸🇪':'se','🇨🇭':'ch','🇮🇹':'it','🇪🇸':'es','🇵🇱':'pl','🇦🇺':'au','🇧🇷':'br','🇦🇷':'ar','🇿🇦':'za','🇲🇽':'mx' };
const getFlagCode = (node) => {
  const raw = (node.flag_emoji || '').toLowerCase().trim();
  if (FLAG_CODE[raw] && raw.length <= 4) return FLAG_CODE[raw];
  if (EMOJI_TO_CODE[node.flag_emoji || '']) return EMOJI_TO_CODE[node.flag_emoji];
  const loc = (node.vps_location || '').toLowerCase();
  for (const [k, v] of Object.entries(FLAG_CODE)) {
    if (k.length > 2 && loc.startsWith(k)) return v;
  }
  return null;
};
const getFlagUrl = (node) => {
  const code = getFlagCode(node);
  return code ? `https://flagcdn.com/w80/${code}.png` : '';
};

const nodes = ref([]);
const trafficOptions = ref([100, 200, 500, 1000, 2000]);
const durationOptions = ref([
  { days: 30, label: '1个月', discount: 1 },
  { days: 90, label: '3个月', discount: 0.90 },
  { days: 180, label: '6个月', discount: 0.85 },
  { days: 360, label: '12个月', discount: 0.75 },
]);
const loading = ref(true); const buying = ref(false); const showSuccess = ref(false); const purchaseResult = ref(null);
const selectedNode = ref(null); const selectedTraffic = ref(200); const selectedDuration = ref(durationOptions.value[0]);
const basePrice = computed(() => {
  if (!selectedNode.value) return 0;
  const gb = selectedTraffic.value;
  const ppg = parseFloat(selectedNode.value.price_per_gb || 0.5);
  const months = (selectedDuration.value?.days || 30) / 30;
  return parseFloat((ppg * gb * months).toFixed(2));
});
const finalPrice = computed(() => {
  const disc = selectedDuration.value?.discount || 1;
  const raw = parseFloat((basePrice.value * disc).toFixed(2));
  return raw < 10 ? 10 : raw;
});

onMounted(async () => {
  try {
    const res = await fetch('/api/vpn/products'); const data = await res.json();
    if (data.status === 'success') { nodes.value = data.data.nodes || []; if (data.data.trafficOptions) trafficOptions.value = data.data.trafficOptions; if (data.data.durationOptions) durationOptions.value = data.data.durationOptions; if (nodes.value.length > 0) selectedNode.value = nodes.value[0]; }
  } catch (e) {}
  if (nodes.value.length === 0) {
    nodes.value = [{ id: 1, name: '美国洛杉矶', flag_emoji: '🇺🇸', vps_location: '美国洛杉矶 · CN2 GIA', price_per_gb: 0.30, max_traffic_gb: 2000, _demo: true },{ id: 2, name: '英国伦敦', flag_emoji: '🇬🇧', vps_location: '英国伦敦 · 9929', price_per_gb: 0.35, max_traffic_gb: 1000, _demo: true }];
    if (nodes.value.length > 0) selectedNode.value = nodes.value[0];
  }
  loading.value = false;
});

const buy = async () => {
  if (!selectedNode.value) return;
  if (selectedNode.value._demo) return uiStore.showToast(appStore.lang === 'zh' ? '演示模式，部署后端后可购买' : 'Demo mode', 'error');
  if (!userStore.token) return uiStore.showToast(appStore.lang === 'zh' ? '请先登录' : 'Please login', 'error');
  const nd = selectedNode.value;
  const msg = appStore.lang === 'zh' ? `确认购买 ${nd.name} · ${selectedTraffic.value}GB · ${selectedDuration.value.label}？¥${finalPrice.value.toFixed(2)}` : `Confirm ${nd.name} · ${selectedTraffic.value}GB · ${selectedDuration.value.label}? ¥${finalPrice.value.toFixed(2)}`;
  if (!await uiStore.showConfirm(msg, appStore.lang === 'zh' ? '确认订单' : 'Confirm')) return;
  buying.value = true;
  try {
    const res = await fetch('/api/vpn/buy', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` }, body: JSON.stringify({ product_id: nd.id, traffic_gb: selectedTraffic.value, duration_days: selectedDuration.value.days }) });
    const data = await res.json();
    if (data.status === 'success') { if (data.data?.balance) userStore.updateUserInfo({ balance: data.data.balance }); purchaseResult.value = data.data; showSuccess.value = true; }
    else { uiStore.showToast(data.message || (appStore.lang === 'zh' ? '购买失败' : 'Failed'), 'error'); }
  } catch (e) { uiStore.showToast(appStore.lang === 'zh' ? '网络异常' : 'Network error', 'error'); }
  buying.value = false;
};
const goToClients = () => { showSuccess.value = false; router.push('/vpn/clients'); };
</script>

<style scoped>
.shop-hero {
  background: linear-gradient(180deg, rgba(0,135,113,0.08) 0%, transparent 60%);
  border-bottom: 1px solid rgba(44,57,80,0.3);
}
.shop-hero-glow {
  position: absolute; top: -30%; left: 50%; transform: translateX(-50%);
  width: 600px; height: 400px;
  background: radial-gradient(ellipse, rgba(0,135,113,0.1) 0%, transparent 70%);
  pointer-events: none;
}
.shop-badge {
  display: inline-block;
  padding: 0.3rem 1rem;
  border-radius: 9999px;
  background: rgba(0,135,113,0.1);
  border: 1px solid rgba(0,135,113,0.2);
  color: var(--vpn-accent);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.shop-title {
  background: linear-gradient(135deg, #e0f0ee 0%, #a0d8cc 50%, #5ec4b0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.shop-subtitle { color: rgba(255,255,255,0.5); }
.shop-spinner {
  width: 32px; height: 32px;
  border: 3px solid rgba(0,135,113,0.2);
  border-top-color: var(--vpn-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.shop-section-label {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: rgba(255,255,255,0.4); margin-bottom: 0.5rem;
}
.shop-node-card {
  background: var(--vpn-surface); border: 1px solid var(--vpn-border);
  border-radius: var(--vpn-radius); padding: 1rem;
  cursor: pointer; transition: all 0.2s;
}
.shop-node-card:hover { border-color: rgba(0,135,113,0.4); }
.shop-node-card.is-selected { border-color: var(--vpn-accent); background: rgba(0,135,113,0.06); }
.shop-check {
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--vpn-accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0;
}
.shop-panel {
  background: var(--vpn-surface); border: 1px solid var(--vpn-border);
  border-radius: var(--vpn-radius); padding: 1.25rem;
}
.shop-option {
  background: var(--vpn-surface2); border: 1px solid var(--vpn-border);
  border-radius: var(--vpn-radius-sm); padding: 0.625rem;
  color: var(--vpn-text); font-size: 0.875rem; font-weight: 600;
  transition: all 0.15s; cursor: pointer;
}
.shop-option:hover { border-color: rgba(0,135,113,0.3); }
.shop-option.is-active { background: var(--vpn-accent); border-color: var(--vpn-accent); color: #fff; }
.shop-balance-ok { color: rgba(255,255,255,0.4); }
.shop-balance-low { color: var(--vpn-warning); }
.shop-recharge-link {
  display: block; text-align: center; font-size: 0.75rem;
  color: var(--vpn-warning); padding: 0.5rem; border-radius: var(--vpn-radius-sm);
  background: rgba(243,123,36,0.08); margin-bottom: 0.5rem;
}
.shop-recharge-link:hover { background: rgba(243,123,36,0.15); }
</style>
