<template>
  <div class="max-w-4xl mx-auto pb-12 space-y-6">
    <!-- Hero -->
    <div class="text-center pt-6 pb-4">
      <div class="inline-block mb-4 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-bold tracking-widest uppercase">Xray Core · VLESS / VMess / Trojan · 余额支付 · 秒开通</div>
      <h1 class="text-3xl md:text-4xl font-black text-white tracking-wider mb-3">{{ appStore.lang === 'zh' ? '全球高速网络，一键连接' : 'Borderless Internet' }}</h1>
      <p class="text-slate-400 text-sm max-w-xl mx-auto">{{ appStore.lang === 'zh' ? '选择节点，配置流量和时长，余额支付后即刻获取加密隧道。' : 'Pick a location, configure traffic, pay with balance, get connected.' }}</p>
      <div class="flex justify-center gap-6 mt-6 text-center">
        <div><div class="text-2xl font-black text-white">{{ nodes.length || '—' }}</div><div class="text-xs text-slate-500 mt-1">{{ appStore.lang==='zh'?'全球节点':'Nodes' }}</div></div>
        <div><div class="text-2xl font-black text-emerald-400">99.9%</div><div class="text-xs text-slate-500 mt-1">{{ appStore.lang==='zh'?'在线率':'Uptime' }}</div></div>
        <div><div class="text-2xl font-black text-white">24/7</div><div class="text-xs text-slate-500 mt-1">{{ appStore.lang==='zh'?'技术支持':'Support' }}</div></div>
        <div><div class="text-2xl font-black text-emerald-400">TLS</div><div class="text-xs text-slate-500 mt-1">+Reality</div></div>
      </div>
    </div>

    <!-- Protocol bar -->
    <div class="flex justify-center gap-3 flex-wrap">
      <span v-for="p in ['VLESS','VMess','Trojan','Shadowsocks','Hysteria']" :key="p" class="text-[11px] font-bold text-slate-500 bg-slate-800/60 border border-slate-700 rounded-full px-3 py-1">{{ p }}</span>
    </div>

    <div v-if="loading" class="flex justify-center py-12"><div class="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin"></div></div>

    <template v-else>
      <!-- Step 1: Select node -->
      <div>
        <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">① {{ appStore.lang === 'zh' ? '选择节点位置' : 'Select Location' }}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="n in nodes" :key="n.id" @click="selectNode(n)"
            :class="['p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3', selectedNode?.id === n.id ? 'bg-emerald-500/10 border-emerald-400/50 ring-1 ring-emerald-400/30' : 'bg-slate-800/60 border-slate-700 hover:border-slate-600 hover:bg-slate-800']">
            <img :src="getFlagUrl(n)" class="w-8 h-6 object-cover rounded flex-shrink-0" @error="e=>e.target.style.display='none'" />
            <div class="min-w-0 flex-1">
              <div class="font-bold text-white text-sm">{{ n.name }}</div>
              <div class="text-xs text-slate-500">¥{{ parseFloat(n.price_per_gb).toFixed(2) }}/GB · 上限{{ n.max_traffic_gb }}GB</div>
            </div>
            <div v-if="selectedNode?.id === n.id" class="w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center text-slate-900 text-xs font-black flex-shrink-0">✓</div>
          </div>
          <div v-if="nodes.length===0" class="col-span-full text-center py-12 text-slate-500">
            <div class="text-4xl mb-3">🖥️</div><p>暂无可用节点</p>
          </div>
        </div>
      </div>

      <!-- Step 2+3: Traffic + Duration -->
      <template v-if="selectedNode">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">② {{ appStore.lang === 'zh' ? '流量配额' : 'Traffic' }}</p>
            <div class="grid grid-cols-3 gap-2">
              <template v-if="trafficOptions.filter(t=>t<=(selectedNode?.max_traffic_gb||2000)).length>0">
                <button v-for="g in trafficOptions.filter(t=>t<=(selectedNode?.max_traffic_gb||2000))" :key="g" @click="selectedTraffic=g"
                  :class="['py-3 rounded-xl text-center font-bold text-sm transition border', selectedTraffic===g ? 'bg-emerald-500/10 border-emerald-400/50 text-emerald-400' : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600']">
                  {{ g>=1000?(g/1000).toFixed(1)+'TB':g+'GB' }}
                </button>
              </template>
              <div v-else class="col-span-3 text-sm text-amber-400 text-center py-4">此节点已达容量上限</div>
            </div>
          </div>
          <div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">③ {{ appStore.lang === 'zh' ? '使用时长' : 'Duration' }}</p>
            <div class="grid grid-cols-2 gap-2">
              <button v-for="d in durationOptions" :key="d.days" @click="selectedDuration=d"
                :class="['py-3 rounded-xl text-center font-bold text-sm transition border relative', selectedDuration?.days===d.days ? 'bg-emerald-500/10 border-emerald-400/50 text-emerald-400' : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600']">
                <span v-if="d.discount<=0.75" class="absolute -top-2 -right-2 bg-amber-500 text-slate-900 text-[10px] font-black px-1.5 py-0.5 rounded-full">最划算</span>
                <div>{{ d.label }}</div>
                <div v-if="d.discount<1" class="text-[11px] text-emerald-500 mt-0.5">{{Math.round((1-d.discount)*100)}}% OFF</div>
              </button>
            </div>
          </div>
        </div>

        <!-- Price + Buy -->
        <div class="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div class="text-sm text-slate-400">{{ selectedNode.name }} · {{ selectedTraffic }}GB · {{ selectedDuration?.label }}</div>
            <div class="text-3xl font-black text-emerald-400 mt-1">¥{{ finalPrice.toFixed(2) }}</div>
            <div :class="['inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-1.5', balanceOk ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30']">
              余额 ¥{{ parseFloat(userStore.userInfo?.balance||0).toFixed(2) }}
              <span v-if="!balanceOk"> ⚠️ 不足</span>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2 w-full sm:w-auto">
            <button @click="buy" :disabled="buying" class="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-lg px-8 py-3.5 rounded-xl transition transform hover:-translate-y-0.5 shadow-[0_8px_25px_rgba(16,185,129,0.3)] disabled:opacity-50">
              {{ buying?'处理中...':(appStore.lang==='zh'?'立即购买':'Buy Now') }}
            </button>
            <router-link v-if="!balanceOk" to="/recharge" class="text-xs text-amber-400 hover:text-amber-300">💳 余额不足？点击充值</router-link>
          </div>
        </div>
      </template>

      <!-- Success Modal -->
      <div v-if="showSuccess" class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" @click.self="showSuccess=false">
        <div class="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] space-y-4">
          <div class="text-5xl">✅</div>
          <h2 class="text-xl font-black text-white">购买成功</h2>
          <p v-if="purchaseResult?.email" class="text-sm font-mono text-emerald-400 bg-slate-800 rounded-lg py-2 px-4 inline-block">{{ purchaseResult.email }}</p>
          <div class="flex flex-col gap-2 pt-2">
            <button @click="goToClients" class="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-3 rounded-xl transition">查看我的节点</button>
            <button @click="showSuccess=false" class="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl transition">继续选购</button>
          </div>
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

const selectNode = (n) => {
  selectedNode.value = n;
  const valid = trafficOptions.value.filter(t => t <= (n.max_traffic_gb || 2000));
  if (valid.length > 0 && !valid.includes(selectedTraffic.value)) selectedTraffic.value = valid[0];
};
const buy = async () => {
  if(!selectedNode.value)return; const nd=selectedNode.value;
  if(nd._demo)return uiStore.showToast('演示模式','error');
  if(!userStore.token)return uiStore.showToast('请先登录','error');
  if(parseFloat(userStore.userInfo?.balance||0) < finalPrice.value) return uiStore.showToast('余额不足，请先充值','error');
  if(!await uiStore.showConfirm(`确认购买 ${nd.name} · ${selectedTraffic.value}GB · ${selectedDuration.value.label}？¥${finalPrice.value.toFixed(2)}`,'确认订单'))return;
  buying.value=true;
  try{const r=await fetch('/api/vpn/buy',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${userStore.token}`},body:JSON.stringify({product_id:nd.id,traffic_gb:selectedTraffic.value,duration_days:selectedDuration.value.days})});const d=await r.json();if(d.status==='success'){if(d.data?.balance)userStore.updateUserInfo({balance:d.data.balance});purchaseResult.value=d.data;showSuccess.value=true}else uiStore.showToast(d.message||'失败','error')}catch(e){uiStore.showToast('网络错误','error')}
  buying.value=false;
};
const goToClients = () => { showSuccess.value=false; router.push('/vpn/clients'); };
</script>
