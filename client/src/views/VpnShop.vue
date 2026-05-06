<template>
  <div class="vpn-page min-h-full">
    <section class="xui-hero">
      <div class="xui-hero-badge">Xray Core · VLESS/Trojan/VMess · 余额支付 · 秒级开通</div>
      <h1 class="xui-hero-title">{{ appStore.lang === 'zh' ? '全球高速网络，一键连接' : 'Borderless Internet' }}</h1>
      <p class="xui-hero-sub">{{ appStore.lang === 'zh' ? '选择节点位置，配置流量和时长，余额支付后即刻获取加密隧道。' : 'Pick a location, configure traffic, pay with balance, get connected.' }}</p>
    </section>

    <div v-if="loading" class="xui-spinner"></div>

    <template v-else>
      <div style="max-width:880px;margin:0 auto;padding:0 1rem 3rem">
        <!-- Step 1: Location -->
        <div style="margin-bottom:1.5rem">
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--xui-text-dim);margin-bottom:0.75rem">{{ appStore.lang === 'zh' ? '① 选择节点位置' : '① Select Location' }}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.625rem">
            <div v-for="n in nodes" :key="n.id" @click="selectNode(n)" class="xui-card" :class="{ selected: selectedNode?.id === n.id }" style="padding:0.875rem 1rem;cursor:pointer;display:flex;align-items:center;gap:0.625rem">
              <img :src="getFlagUrl(n)" class="xui-plan-flag" style="flex-shrink:0" @error="e=>e.target.style.display='none'" />
              <div class="min-w-0">
                <div style="font-weight:700;font-size:0.875rem">{{ n.name }}</div>
                <div style="font-size:0.65rem;color:var(--xui-text-dim)">¥{{ parseFloat(n.price_per_gb).toFixed(2) }}/GB · 上限{{ n.max_traffic_gb }}GB</div>
              </div>
              <div v-if="selectedNode?.id === n.id" class="xui-plan-check" style="margin-left:auto;flex-shrink:0">✓</div>
            </div>
            <div v-if="nodes.length===0" class="xui-empty" style="grid-column:1/-1"><div class="xui-empty-icon">🖥️</div><p>暂无可用节点</p></div>
          </div>
        </div>

        <!-- Step 2+3: Traffic + Duration (only when node selected) -->
        <template v-if="selectedNode">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem">
            <div>
              <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--xui-text-dim);margin-bottom:0.75rem">② {{ appStore.lang === 'zh' ? '流量配额' : 'Traffic' }}</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem">
                <button v-for="g in trafficOptions.filter(t=>t<=(selectedNode?.max_traffic_gb||2000))" :key="g" @click="selectedTraffic=g" class="xui-card" :class="{ selected: selectedTraffic===g }" style="padding:0.75rem;text-align:center;cursor:pointer;font-weight:700;font-size:0.875rem;border:none">
                  {{ g>=1000?(g/1000).toFixed(1)+'TB':g+'GB' }}
                </button>
              </div>
            </div>
            <div>
              <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--xui-text-dim);margin-bottom:0.75rem">③ {{ appStore.lang === 'zh' ? '使用时长' : 'Duration' }}</div>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.5rem">
                <button v-for="d in durationOptions" :key="d.days" @click="selectedDuration=d" class="xui-card" :class="{ selected: selectedDuration?.days===d.days }" style="padding:0.75rem;text-align:center;cursor:pointer;border:none">
                  <div style="font-weight:700;font-size:0.875rem">{{ d.label }}</div>
                  <div v-if="d.discount<1" style="font-size:0.6rem;color:var(--xui-primary);margin-top:0.15rem">{{Math.round((1-d.discount)*100)}}% OFF</div>
                </button>
              </div>
            </div>
          </div>

          <!-- Price + Buy -->
          <div class="xui-card" style="padding:1.25rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
            <div>
              <div style="font-size:0.75rem;color:var(--xui-text-dim)">{{ selectedNode.name }} · {{ selectedTraffic }}GB · {{ selectedDuration?.label }}</div>
              <div style="font-size:1.75rem;font-weight:900;color:var(--xui-primary);margin-top:0.25rem">¥{{ finalPrice.toFixed(2) }}</div>
              <div style="font-size:0.7rem;margin-top:0.15rem" :class="balanceOk ? 'xui-tag-green' : 'xui-tag-red'" class="xui-tag">
                {{ appStore.lang === 'zh' ? '余额' : 'Bal' }} ¥{{ parseFloat(userStore.userInfo?.balance||0).toFixed(2) }}
                <span v-if="!balanceOk"> ⚠️ 不足</span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.5rem">
              <button @click="buy" :disabled="buying" class="xui-btn" style="padding:0.75rem 2rem;font-size:1rem">{{ buying?'...':(appStore.lang==='zh'?'立即购买':'Buy Now') }}</button>
              <router-link v-if="!balanceOk" to="/recharge" style="font-size:0.7rem;color:var(--xui-warning)">💳 余额不足？点击充值</router-link>
            </div>
          </div>
        </template>
      </div>

      <!-- Success Modal -->
      <div v-if="showSuccess" class="xui-overlay" @click.self="showSuccess=false">
        <div class="xui-modal text-center space-y-4">
          <div style="font-size:3rem">✅</div>
          <h2 style="font-size:1.2rem;font-weight:900">购买成功</h2>
          <p v-if="purchaseResult?.email" style="font-size:0.8rem;color:var(--xui-text-dim);font-family:monospace;background:#f5f7f9;border-radius:0.5rem;padding:0.4rem 0.8rem;display:inline-block">{{ purchaseResult.email }}</p>
          <button @click="goToClients" class="xui-btn w-full">查看我的节点</button>
          <button @click="showSuccess=false" class="xui-btn xui-btn-ghost w-full">继续选购</button>
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

const FC = { hk:'hk',hongkong:'hk',jp:'jp',japan:'jp',kr:'kr',korea:'kr',tw:'tw',taiwan:'tw',sg:'sg',singapore:'sg',th:'th',thailand:'th',vn:'vn',vietnam:'vn',my:'my',malaysia:'my',ph:'ph',philippines:'ph',id:'id',indonesia:'id',in:'in',india:'in',ae:'ae',uae:'ae',us:'us',usa:'us',ca:'ca',canada:'ca',uk:'gb',gb:'gb',de:'de',germany:'de',nl:'nl',netherlands:'nl',fr:'fr',france:'fr',ru:'ru',russia:'ru',au:'au',australia:'au',br:'br',brazil:'br',ar:'ar',argentina:'ar',za:'za',southafrica:'za',mx:'mx',mexico:'mx' };
const ETOC = { '🇭🇰':'hk','🇯🇵':'jp','🇰🇷':'kr','🇹🇼':'tw','🇸🇬':'sg','🇹🇭':'th','🇻🇳':'vn','🇲🇾':'my','🇵🇭':'ph','🇮🇩':'id','🇮🇳':'in','🇦🇪':'ae','🇺🇸':'us','🇨🇦':'ca','🇬🇧':'gb','🇩🇪':'de','🇳🇱':'nl','🇫🇷':'fr','🇷🇺':'ru','🇦🇺':'au','🇧🇷':'br','🇦🇷':'ar','🇿🇦':'za','🇲🇽':'mx' };
const getFlagCode = (n) => { const r=(n.flag_emoji||'').toLowerCase().trim(); if(FC[r]&&r.length<=4)return FC[r]; if(ETOC[n.flag_emoji||''])return ETOC[n.flag_emoji]; for(const[k,v]of Object.entries(FC)){if(k.length>2&&(n.vps_location||'').toLowerCase().startsWith(k))return v;} return null; };
const getFlagUrl = (n) => { const c=getFlagCode(n); return c?`https://flagcdn.com/w80/${c}.png`:''; };

const nodes = ref([]); const trafficOptions = ref([100,200,500,1000,2000]);
const durationOptions = ref([{days:30,label:'1个月',discount:1},{days:90,label:'3个月',discount:.9},{days:180,label:'6个月',discount:.85},{days:360,label:'12个月',discount:.75}]);
const loading = ref(true); const buying = ref(false); const showSuccess = ref(false); const purchaseResult = ref(null);
const selectedNode = ref(null); const selectedTraffic = ref(200); const selectedDuration = ref(durationOptions.value[0]);

const basePrice = computed(() => { if(!selectedNode.value)return 0; const ppg=parseFloat(selectedNode.value.price_per_gb||.5); const m=(selectedDuration.value?.days||30)/30; return parseFloat((ppg*selectedTraffic.value*m).toFixed(2)); });
const finalPrice = computed(() => { const raw=parseFloat((basePrice.value*(selectedDuration.value?.discount||1)).toFixed(2)); return raw<10?10:raw; });
const balanceOk = computed(() => parseFloat(userStore.userInfo?.balance||0) >= finalPrice.value);

onMounted(async () => {
  try{const r=await fetch('/api/vpn/products');const d=await r.json();if(d.status==='success'){nodes.value=d.data.nodes||[];if(d.data.trafficOptions)trafficOptions.value=d.data.trafficOptions;if(d.data.durationOptions)durationOptions.value=d.data.durationOptions;if(nodes.value.length>0)selectedNode.value=nodes.value[0];}}catch(e){}
  if(nodes.value.length===0){nodes.value=[{id:1,name:'美国洛杉矶',flag_emoji:'🇺🇸',vps_location:'洛杉矶·CN2 GIA',price_per_gb:.3,max_traffic_gb:2000,_demo:true},{id:2,name:'英国伦敦',flag_emoji:'🇬🇧',vps_location:'伦敦·9929',price_per_gb:.35,max_traffic_gb:1000,_demo:true}];selectedNode.value=nodes.value[0]}
  loading.value=false;
});

const selectNode = (n) => { selectedNode.value = n; };
const buy = async () => {
  if(!selectedNode.value)return; const nd=selectedNode.value;
  if(nd._demo)return uiStore.showToast('演示模式','error');
  if(!userStore.token)return uiStore.showToast('请先登录','error');
  if(!await uiStore.showConfirm(`确认购买 ${nd.name} · ${selectedTraffic.value}GB · ${selectedDuration.value.label}？¥${finalPrice.value.toFixed(2)}`,'确认订单'))return;
  buying.value=true;
  try{const r=await fetch('/api/vpn/buy',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${userStore.token}`},body:JSON.stringify({product_id:nd.id,traffic_gb:selectedTraffic.value,duration_days:selectedDuration.value.days})});const d=await r.json();if(d.status==='success'){if(d.data?.balance)userStore.updateUserInfo({balance:d.data.balance});purchaseResult.value=d.data;showSuccess.value=true}else uiStore.showToast(d.message||'Failed','error')}catch(e){uiStore.showToast('Network error','error')}
  buying.value=false;
};
const goToClients = () => { showSuccess.value=false; router.push('/vpn/clients'); };
</script>
