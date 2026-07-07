<template>
  <div class="max-w-4xl mx-auto pb-12 space-y-6">
    <!-- Hero -->
    <div class="text-center pt-6 pb-4 space-y-5">
      <div class="inline-block px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-bold tracking-widest uppercase">专为 TikTok / IG / YouTube 创作者打造</div>
      <h1 class="text-3xl md:text-5xl font-black text-white tracking-wider leading-tight">
        {{ appStore.lang === 'zh' ? '账号在哪，IP就在哪' : 'Your IP, Where Your Audience Is' }}
      </h1>
      <p class="text-slate-400 text-sm max-w-2xl mx-auto leading-relaxed">
        {{ appStore.lang === 'zh' ? 'TikTok限流？账号莫名其妙被标记？直播卡顿掉帧？做跨境自媒体，IP纯净度决定账号生死。我们专为海外社媒玩家定制——原生住宅IP，TLS+Reality伪装，让你的流量真正"像当地人"。' : 'Shadow ban on TikTok? IP flagged? Laggy streams? For cross-border creators, IP purity is everything. Residential IPs with TLS+Reality obfuscation — make your traffic look 100% local.' }}
      </p>

      <!-- Pain point cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
        <div class="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 hover:border-emerald-500/30 transition">
          <div class="text-2xl mb-2">🎯</div>
          <h4 class="text-white font-bold text-sm mb-1">{{ appStore.lang==='zh'?'精准定位':'Geo-Targeting' }}</h4>
          <p class="text-slate-500 text-xs leading-relaxed">{{ appStore.lang==='zh'?'原生住宅IP，TikTok算法识别为本地用户，推流权重翻倍。' : 'Residential IPs. TikTok algorithm sees you as local. Double your reach.' }}</p>
        </div>
        <div class="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 hover:border-emerald-500/30 transition">
          <div class="text-2xl mb-2">🛡️</div>
          <h4 class="text-white font-bold text-sm mb-1">{{ appStore.lang==='zh'?'防封防标记':'Anti-Ban' }}</h4>
          <p class="text-slate-500 text-xs leading-relaxed">{{ appStore.lang==='zh'?'TLS指纹伪装为普通浏览器流量，平台无法识别你用了代理。' : 'TLS fingerprinting masks proxy traffic as regular browsing. Undetectable.' }}</p>
        </div>
        <div class="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 hover:border-emerald-500/30 transition">
          <div class="text-2xl mb-2">⚡</div>
          <h4 class="text-white font-bold text-sm mb-1">{{ appStore.lang==='zh'?'直播不卡顿':'Zero Lag' }}</h4>
          <p class="text-slate-500 text-xs leading-relaxed">{{ appStore.lang==='zh'?'CN2 GIA / CMIN2 优化线路，直播推流低延迟不掉帧。' : 'Premium bandwidth. Smooth live streaming without frame drops.' }}</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="flex justify-center gap-8 text-center pt-2">
        <div><div class="text-xl font-black text-white">{{ nodes.length || '—' }}</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{{ appStore.lang==='zh'?'全球节点':'Nodes' }}</div></div>
        <div><div class="text-xl font-black text-emerald-400">99.9%</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{{ appStore.lang==='zh'?'在线率':'Uptime' }}</div></div>
        <div><div class="text-xl font-black text-white">Reality</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">协议伪装</div></div>
        <div><div class="text-xl font-black text-emerald-400">秒开</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">自动部署</div></div>
      </div>
    </div>

    <!-- Trust signals -->
    <div class="flex flex-wrap justify-center gap-4 text-[11px]">
      <span class="text-slate-500 bg-slate-800/40 border border-slate-700/50 rounded-full px-3 py-1.5">🎉 已服务 <span class="text-emerald-400 font-bold">1,200+</span> 位创作者</span>
      <span class="text-slate-500 bg-slate-800/40 border border-slate-700/50 rounded-full px-3 py-1.5">🌐 <span class="text-emerald-400 font-bold">{{ nodes.length || '—' }}</span> 个全球节点</span>
      <span class="text-slate-500 bg-slate-800/40 border border-slate-700/50 rounded-full px-3 py-1.5">⏱️ 平均响应 <span class="text-emerald-400 font-bold">&lt;180ms</span></span>
      <span class="text-slate-500 bg-slate-800/40 border border-slate-700/50 rounded-full px-3 py-1.5">💳 支付宝 / 微信 / USDT</span>
      <span class="text-slate-500 bg-slate-800/40 border border-slate-700/50 rounded-full px-3 py-1.5">👥 7×12h 客服在线</span>
    </div>

    <!-- Protocol bar -->
    <div class="flex justify-center gap-3 flex-wrap">
      <span v-for="p in ['VLESS + Reality','VMess + WS','Trojan + TLS','Shadowsocks','Hysteria2']" :key="p" class="text-[11px] font-bold text-slate-500 bg-slate-800/60 border border-slate-700 rounded-full px-3 py-1">{{ p }}</span>
    </div>

    <!-- Why VPN matters -->
    <div class="bg-slate-800/30 border border-slate-700/50 rounded-3xl p-6 max-w-3xl mx-auto">
      <h3 class="text-sm font-black text-white text-center mb-5">🤔 {{ appStore.lang === 'zh' ? '为什么TikTok玩家都在用专属节点？' : 'Why TikTok creators use dedicated nodes?' }}</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div class="flex gap-3">
          <span class="text-emerald-400 flex-shrink-0 mt-0.5">✅</span>
          <div><span class="text-white font-bold">账号限流？</span><span class="text-slate-400"> 公用机场IP被万人用，TikTok早就标记了。独享原生IP才是解药。</span></div>
        </div>
        <div class="flex gap-3">
          <span class="text-emerald-400 flex-shrink-0 mt-0.5">✅</span>
          <div><span class="text-white font-bold">0播放/Shadow Ban？</span><span class="text-slate-400"> IP不干净，内容再好也推不出去。纯净住宅IP，算法信任从第一帧开始。</span></div>
        </div>
        <div class="flex gap-3">
          <span class="text-emerald-400 flex-shrink-0 mt-0.5">✅</span>
          <div><span class="text-white font-bold">直播卡顿掉帧？</span><span class="text-slate-400"> 普通线路晚高峰拥堵。CMIN2优化线路，跨国直播也能稳60帧。</span></div>
        </div>
        <div class="flex gap-3">
          <span class="text-emerald-400 flex-shrink-0 mt-0.5">✅</span>
          <div><span class="text-white font-bold">多账号矩阵被封？</span><span class="text-slate-400"> 同IP登录多个账号 = 批量送死。每号独立IP，矩阵稳如磐石。</span></div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12"><div class="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin"></div></div>

    <template v-else>
      <!-- Step 1: Select node -->
      <div>
        <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">① {{ appStore.lang === 'zh' ? '选择节点位置' : 'Select Location' }}</p>
        <!-- Search + Filter -->
        <div class="flex gap-2 mb-3">
          <input v-model="searchQuery" type="text" :placeholder="appStore.lang==='zh'?'🔍 搜索节点...':'🔍 Search...'"
            class="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-emerald-500/50 transition" />
          <select v-model="regionFilter" class="bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-emerald-500/50 transition">
            <option value="">{{ appStore.lang==='zh'?'全部区域':'All' }}</option>
            <option value="asia">{{ appStore.lang==='zh'?'亚洲':'Asia' }}</option>
            <option value="americas">{{ appStore.lang==='zh'?'美洲':'Americas' }}</option>
            <option value="europe">{{ appStore.lang==='zh'?'欧洲':'Europe' }}</option>
            <option value="oceania">{{ appStore.lang==='zh'?'大洋洲':'Oceania' }}</option>
            <option value="middle-east">{{ appStore.lang==='zh'?'中东':'Middle East' }}</option>
          </select>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="n in filteredNodes" :key="n.id" @click="selectNode(n)"
            :class="['p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3', selectedNode?.id === n.id ? 'bg-emerald-500/10 border-emerald-400/50 ring-1 ring-emerald-400/30' : 'bg-slate-800/60 border-slate-700 hover:border-slate-600 hover:bg-slate-800']">
            <img :src="getFlagUrl(n)" class="w-8 h-6 object-cover rounded flex-shrink-0" @error="e=>e.target.style.display='none'" />
            <div class="min-w-0 flex-1">
              <div class="font-bold text-white text-sm flex items-center gap-1.5">{{ n.name }}
                <span v-if="latencyMap[n.id] !== undefined" :class="['text-[10px] font-bold px-1.5 py-0.5 rounded-full', latencyMap[n.id] < 100 ? 'bg-emerald-500/10 text-emerald-400' : latencyMap[n.id] < 250 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400']">{{ latencyMap[n.id] }}ms</span>
                <span v-else-if="latencyMap[n.id] === null" class="text-[10px] text-slate-600">···</span>
              </div>
              <div class="text-xs text-slate-500">¥{{ parseFloat(n.price_per_gb).toFixed(2) }}/GB · 上限{{ n.max_traffic_gb }}GB</div>
            </div>
            <div v-if="selectedNode?.id === n.id" class="w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center text-slate-900 text-xs font-black flex-shrink-0">✓</div>
          </div>
          <div v-if="filteredNodes.length===0" class="col-span-full text-center py-12 text-slate-500">
            <div class="text-4xl mb-3">🔍</div><p>{{ appStore.lang==='zh'?'没有匹配的节点':'No nodes found' }}</p>
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

const EMOJI_MAP = { '🇭🇰':'hk','🇯🇵':'jp','🇰🇷':'kr','🇹🇼':'tw','🇸🇬':'sg','🇹🇭':'th','🇻🇳':'vn','🇲🇾':'my','🇵🇭':'ph','🇮🇩':'id','🇮🇳':'in','🇦🇪':'ae','🇺🇸':'us','🇨🇦':'ca','🇬🇧':'gb','🇩🇪':'de','🇳🇱':'nl','🇫🇷':'fr','🇷🇺':'ru','🇦🇺':'au','🇧🇷':'br','🇦🇷':'ar','🇿🇦':'za','🇲🇽':'mx' };
const NAME_MAP = { hk:'hk',hongkong:'hk',jp:'jp',japan:'jp',kr:'kr',korea:'kr',tw:'tw',taiwan:'tw',sg:'sg',singapore:'sg',th:'th',thailand:'th',vn:'vn',vietnam:'vn',my:'my',malaysia:'my',ph:'ph',philippines:'ph',id:'id',indonesia:'id',in:'in',india:'in',ae:'ae',uae:'ae',us:'us',usa:'us',ca:'ca',canada:'ca',uk:'gb',gb:'gb',de:'de',germany:'de',nl:'nl',netherlands:'nl',fr:'fr',france:'fr',ru:'ru',russia:'ru',au:'au',australia:'au',br:'br',brazil:'br',ar:'ar',argentina:'ar',za:'za',southafrica:'za',mx:'mx',mexico:'mx' };
const getFlagCode = (n) => {
  const emoji = n.flag_emoji || '';
  if (EMOJI_MAP[emoji]) return EMOJI_MAP[emoji];
  const lower = emoji.toLowerCase().trim();
  if (NAME_MAP[lower] && lower.length <= 4) return NAME_MAP[lower];
  const loc = (n.vps_location || '').toLowerCase();
  for (const [k, v] of Object.entries(NAME_MAP)) if (k.length > 2 && loc.startsWith(k)) return v;
  return null;
};
const getFlagUrl = (n) => { const c=getFlagCode(n); return c?`https://flagcdn.com/w80/${c}.png`:''; };

const nodes = ref([]); const trafficOptions = ref([100,200,500,1000,2000]);
const durationOptions = ref([{days:30,label:'1个月',discount:1},{days:90,label:'3个月',discount:.9},{days:180,label:'6个月',discount:.85},{days:360,label:'12个月',discount:.75}]);
const loading = ref(true); const buying = ref(false); const showSuccess = ref(false); const purchaseResult = ref(null);
const selectedNode = ref(null); const selectedTraffic = ref(200); const selectedDuration = ref(durationOptions.value[0]);
const latencyMap = ref({});
const searchQuery = ref('');
const regionFilter = ref('');

const regionMap = { '🇭🇰':'asia','🇯🇵':'asia','🇰🇷':'asia','🇹🇼':'asia','🇸🇬':'asia','🇹🇭':'asia','🇻🇳':'asia','🇲🇾':'asia','🇵🇭':'asia','🇮🇩':'asia','🇮🇳':'asia','🇨🇳':'asia','🇦🇪':'middle-east','🇸🇦':'middle-east','🇹🇷':'middle-east','🇺🇸':'americas','🇨🇦':'americas','🇲🇽':'americas','🇧🇷':'americas','🇦🇷':'americas','🇬🇧':'europe','🇩🇪':'europe','🇳🇱':'europe','🇫🇷':'europe','🇷🇺':'europe','🇸🇪':'europe','🇨🇭':'europe','🇮🇹':'europe','🇪🇸':'europe','🇵🇱':'europe','🇦🇺':'oceania','🇿🇦':'africa' };
const filteredNodes = computed(() => {
  let list = nodes.value;
  if (regionFilter.value) list = list.filter(n => regionMap[n.flag_emoji || ''] === regionFilter.value);
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(n => (n.name||'').toLowerCase().includes(q) || (n.vps_location||'').toLowerCase().includes(q));
  }
  return list;
});

const pingNodes = async () => {
  if (!nodes.value.length) return;
  for (const n of nodes.value) {
    if (n._demo) continue;
    latencyMap.value[n.id] = null;
    try {
      const r = await fetch('/api/vpn/ping?id=' + n.id);
      const d = await r.json();
      if (d.status === 'success') latencyMap.value[n.id] = d.data.latency;
    } catch (e) {}
  }
};

const basePrice = computed(() => { if(!selectedNode.value)return 0; const ppg=parseFloat(selectedNode.value.price_per_gb||.5); const m=(selectedDuration.value?.days||30)/30; return parseFloat((ppg*selectedTraffic.value*m).toFixed(2)); });
const finalPrice = computed(() => { const raw=parseFloat((basePrice.value*(selectedDuration.value?.discount||1)).toFixed(2)); return raw<10?10:raw; });
const balanceOk = computed(() => parseFloat(userStore.userInfo?.balance||0) >= finalPrice.value);

onMounted(async () => {
  try{const r=await fetch('/api/vpn/products');const d=await r.json();if(d.status==='success'){nodes.value=d.data.nodes||[];if(d.data.trafficOptions)trafficOptions.value=d.data.trafficOptions;if(d.data.durationOptions)durationOptions.value=d.data.durationOptions;if(nodes.value.length>0)selectedNode.value=nodes.value[0];}}catch(e){}
  if(nodes.value.length===0){nodes.value=[{id:1,name:'美国洛杉矶',flag_emoji:'🇺🇸',vps_location:'洛杉矶·CN2 GIA',price_per_gb:.3,max_traffic_gb:2000,_demo:true},{id:2,name:'英国伦敦',flag_emoji:'🇬🇧',vps_location:'伦敦·9929',price_per_gb:.35,max_traffic_gb:1000,_demo:true}];selectedNode.value=nodes.value[0]}
  loading.value=false;
  setTimeout(pingNodes, 500);
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
