<template>
  <div class="vpn-page min-h-full">
    <!-- Hero -->
    <section class="xui-hero">
      <div class="xui-hero-badge">{{ appStore.lang === 'zh' ? 'Xray 核心 · 全协议 · 秒级开通' : 'Xray Core · All Protocols · Instant' }}</div>
      <h1 class="xui-hero-title">{{ appStore.lang === 'zh' ? '全球高速网络，一键连接' : 'Borderless Internet, One Tap Away' }}</h1>
      <p class="xui-hero-sub">{{ appStore.lang === 'zh' ? '选择节点和流量套餐，用余额支付，即刻获取加密隧道连接。' : 'Pick a node and plan, pay with balance, get your encrypted tunnel instantly.' }}</p>
    </section>

    <!-- Loading -->
    <div v-if="loading" class="xui-spinner"></div>

    <!-- Main Content -->
    <template v-else>
      <!-- Plan Cards -->
      <div class="xui-plan-grid">
        <div v-for="plan in plans" :key="plan.key" class="xui-card xui-plan" :class="{ selected: selectedPlan?.key === plan.key }" @click="selectPlan(plan)">
          <div class="xui-plan-header">
            <img :src="getFlagUrl(plan.node)" class="xui-plan-flag" @error="e=>e.target.style.display='none'" />
            <div>
              <div class="xui-plan-name">{{ plan.node.name }}</div>
              <div class="xui-plan-loc">{{ plan.node.vps_location }}</div>
            </div>
            <div v-if="plan.recommended" class="xui-tag xui-tag-green" style="margin-left:auto">推荐</div>
          </div>
          <div class="xui-plan-specs">
            <div class="xui-plan-spec"><div class="xui-plan-spec-val">{{ plan.traffic >= 1000 ? (plan.traffic/1000).toFixed(1)+'TB' : plan.traffic+'GB' }}</div><div class="xui-plan-spec-lbl">流量</div></div>
            <div class="xui-plan-spec"><div class="xui-plan-spec-val">{{ plan.durationLabel }}</div><div class="xui-plan-spec-lbl">时长</div></div>
            <div class="xui-plan-spec"><div class="xui-plan-spec-val">¥{{ plan.pricePerGB }}</div><div class="xui-plan-spec-lbl">/GB</div></div>
          </div>
          <div class="xui-plan-bottom">
            <div>
              <div class="xui-plan-price">¥{{ plan.totalPrice }}</div>
              <div class="xui-plan-price-unit" v-if="plan.discount < 1">省 {{ Math.round((1-plan.discount)*100) }}%</div>
            </div>
            <div v-if="selectedPlan?.key === plan.key" class="xui-plan-check">✓</div>
          </div>
        </div>

        <!-- Empty -->
        <div v-if="plans.length === 0" class="xui-empty" style="grid-column:1/-1">
          <div class="xui-empty-icon">🖥️</div>
          <p>{{ appStore.lang === 'zh' ? '暂无可用节点和套餐' : 'No plans available' }}</p>
        </div>
      </div>

      <!-- Buy Bar (sticky bottom) -->
      <div v-if="selectedPlan" class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div class="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div class="flex items-center gap-2 min-w-0">
            <img :src="getFlagUrl(selectedPlan.node)" class="xui-plan-flag flex-shrink-0" />
            <span class="font-bold text-sm truncate">{{ selectedPlan.node.name }} · {{ selectedPlan.traffic }}GB · {{ selectedPlan.durationLabel }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs" :class="(parseFloat(userStore.userInfo?.balance||0) < selectedPlan.totalPrice) ? 'text-red-500' : 'text-gray-400'">
              {{ appStore.lang === 'zh' ? '余额' : 'Bal' }} ¥{{ parseFloat(userStore.userInfo?.balance||0).toFixed(2) }}
            </span>
            <span class="font-black text-lg" style="color:var(--xui-primary)">¥{{ selectedPlan.totalPrice }}</span>
            <button @click="buy" :disabled="buying" class="xui-btn px-6">{{ buying ? '...' : (appStore.lang === 'zh' ? '立即购买' : 'Buy') }}</button>
          </div>
        </div>
      </div>

      <!-- Success Modal -->
      <div v-if="showSuccess" class="xui-overlay" @click.self="showSuccess=false">
        <div class="xui-modal text-center space-y-4">
          <div style="font-size:3rem">✅</div>
          <h2 style="font-size:1.25rem;font-weight:900">{{ appStore.lang === 'zh' ? '购买成功' : 'Purchased' }}</h2>
          <p v-if="purchaseResult?.email" style="font-size:0.8rem;color:var(--xui-text-dim);font-family:monospace;background:#f5f7f9;border-radius:0.5rem;padding:0.4rem 0.8rem;display:inline-block">{{ purchaseResult.email }}</p>
          <button @click="goToClients" class="xui-btn w-full">{{ appStore.lang === 'zh' ? '查看我的节点' : 'View My Nodes' }}</button>
          <button @click="showSuccess=false" class="xui-btn xui-btn-ghost w-full">{{ appStore.lang === 'zh' ? '继续选购' : 'Continue' }}</button>
        </div>
      </div>
    </template>
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

const FC = { hk:'hk',hongkong:'hk',jp:'jp',japan:'jp',kr:'kr',korea:'kr',tw:'tw',taiwan:'tw',cn:'cn',china:'cn',sg:'sg',singapore:'sg',th:'th',thailand:'th',vn:'vn',vietnam:'vn',my:'my',malaysia:'my',ph:'ph',philippines:'ph',id:'id',indonesia:'id',in:'in',india:'in',ae:'ae',uae:'ae',sa:'sa',tr:'tr',us:'us',usa:'us',ca:'ca',canada:'ca',uk:'gb',gb:'gb',de:'de',germany:'de',nl:'nl',netherlands:'nl',fr:'fr',france:'fr',ru:'ru',russia:'ru',se:'se',sweden:'se',ch:'ch',switzerland:'ch',it:'it',italy:'it',es:'es',spain:'es',pl:'pl',poland:'pl',au:'au',australia:'au',br:'br',brazil:'br',ar:'ar',argentina:'ar',za:'za',southafrica:'za',mx:'mx',mexico:'mx' };
const ETOC = { '🇭🇰':'hk','🇯🇵':'jp','🇰🇷':'kr','🇹🇼':'tw','🇨🇳':'cn','🇸🇬':'sg','🇹🇭':'th','🇻🇳':'vn','🇲🇾':'my','🇵🇭':'ph','🇮🇩':'id','🇮🇳':'in','🇦🇪':'ae','🇸🇦':'sa','🇹🇷':'tr','🇺🇸':'us','🇨🇦':'ca','🇬🇧':'gb','🇩🇪':'de','🇳🇱':'nl','🇫🇷':'fr','🇷🇺':'ru','🇸🇪':'se','🇨🇭':'ch','🇮🇹':'it','🇪🇸':'es','🇵🇱':'pl','🇦🇺':'au','🇧🇷':'br','🇦🇷':'ar','🇿🇦':'za','🇲🇽':'mx' };
const getFlagCode = (node) => {
  const raw = (node.flag_emoji || '').toLowerCase().trim();
  if (FC[raw] && raw.length <= 4) return FC[raw];
  if (ETOC[node.flag_emoji || '']) return ETOC[node.flag_emoji];
  for (const [k, v] of Object.entries(FC)) { if (k.length > 2 && (node.vps_location||'').toLowerCase().startsWith(k)) return v; }
  return null;
};
const getFlagUrl = (node) => { const c = getFlagCode(node); return c ? `https://flagcdn.com/w80/${c}.png` : ''; };

const plans = ref([]); const loading = ref(true); const selectedPlan = ref(null);
const buying = ref(false); const showSuccess = ref(false); const purchaseResult = ref(null);

const PRESETS = [
  { traffic: 100, days: 30, label: '1个月', discount: 1, recommended: false },
  { traffic: 200, days: 90, label: '3个月', discount: 0.90, recommended: true },
  { traffic: 500, days: 180, label: '6个月', discount: 0.85, recommended: false },
  { traffic: 1000, days: 360, label: '12个月', discount: 0.75, recommended: false },
];

onMounted(async () => {
  try {
    const res = await fetch('/api/vpn/products'); const data = await res.json();
    if (data.status === 'success' && data.data.nodes?.length > 0) {
      const all = [];
      data.data.nodes.forEach(node => {
        PRESETS.filter(p => p.traffic <= (node.max_traffic_gb || 2000)).forEach(p => {
          const ppm = parseFloat(node.price_per_gb || 0.5);
          const base = parseFloat((ppm * p.traffic * (p.days / 30)).toFixed(2));
          const total = Math.max(10, parseFloat((base * p.discount).toFixed(2)));
          all.push({ node, traffic: p.traffic, days: p.days, durationLabel: p.label, discount: p.discount, recommended: p.recommended, pricePerGB: ppm.toFixed(2), totalPrice: total, key: `${node.id}-${p.traffic}-${p.days}` });
        });
      });
      plans.value = all;
    }
  } catch (e) {}
  if (plans.value.length === 0) {
    const demoNode = { id: 1, name: '美国洛杉矶', flag_emoji: '🇺🇸', vps_location: '洛杉矶 · CN2 GIA', price_per_gb: 0.30, max_traffic_gb: 2000, _demo: true };
    PRESETS.filter(p => p.traffic <= 2000).forEach(p => {
      const base = parseFloat((0.30 * p.traffic * (p.days/30)).toFixed(2));
      const total = Math.max(10, parseFloat((base * p.discount).toFixed(2)));
      plans.value.push({ node: demoNode, traffic: p.traffic, days: p.days, durationLabel: p.label, discount: p.discount, recommended: p.recommended, pricePerGB: '0.30', totalPrice: total, key: `demo-${p.traffic}-${p.days}` });
    });
  }
  loading.value = false;
});

const selectPlan = (plan) => { selectedPlan.value = selectedPlan.value?.key === plan.key ? null : plan; };

const buy = async () => {
  if (!selectedPlan.value) return;
  const p = selectedPlan.value;
  if (p.node._demo) return uiStore.showToast(appStore.lang === 'zh' ? '演示模式' : 'Demo', 'error');
  if (!userStore.token) return uiStore.showToast(appStore.lang === 'zh' ? '请先登录' : 'Login', 'error');
  if (!await uiStore.showConfirm(`确认购买 ${p.node.name} · ${p.traffic}GB · ${p.durationLabel}？¥${p.totalPrice}`, appStore.lang === 'zh' ? '确认订单' : 'Confirm')) return;
  buying.value = true;
  try {
    const res = await fetch('/api/vpn/buy', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` }, body: JSON.stringify({ product_id: p.node.id, traffic_gb: p.traffic, duration_days: p.days }) });
    const data = await res.json();
    if (data.status === 'success') { if (data.data?.balance) userStore.updateUserInfo({ balance: data.data.balance }); purchaseResult.value = data.data; showSuccess.value = true; }
    else uiStore.showToast(data.message || 'Failed', 'error');
  } catch (e) { uiStore.showToast('Network error', 'error'); }
  buying.value = false;
};
const goToClients = () => { showSuccess.value = false; router.push('/vpn/clients'); };
</script>
