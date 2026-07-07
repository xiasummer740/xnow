<template>
  <div class="max-w-2xl mx-auto pb-12">
    <div class="flex items-center justify-between mb-6 pt-2">
      <h1 class="text-2xl font-black text-white tracking-wide">{{ appStore.lang === 'zh' ? '我的节点' : 'My Nodes' }}</h1>
      <router-link to="/vpn" class="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-5 py-2.5 rounded-xl transition text-sm">{{ appStore.lang === 'zh' ? '+ 选购' : '+ Buy' }}</router-link>
    </div>

    <div v-if="loading" class="flex justify-center py-20"><div class="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin"></div></div>

    <div v-else-if="clients.length === 0" class="text-center py-20">
      <div class="text-5xl mb-4 opacity-30">🛡️</div>
      <p class="text-slate-400 mb-6">{{ appStore.lang === 'zh' ? '暂无节点，去选购一个吧' : 'No nodes yet' }}</p>
      <router-link to="/vpn" class="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-6 py-3 rounded-xl transition">{{ appStore.lang === 'zh' ? '选购节点' : 'Get One' }}</router-link>
    </div>

    <div v-else class="space-y-3">
      <div v-for="c in clients" :key="c.id" class="bg-slate-800/80 border border-slate-700 rounded-2xl p-5">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2 min-w-0">
            <img :src="getClientFlagUrl(c)" class="w-6 h-4 object-cover rounded flex-shrink-0" @error="e=>e.target.style.display='none'" />
            <div class="min-w-0">
              <div class="font-bold text-sm text-white font-mono truncate">{{ c.email }}</div>
              <div class="text-xs text-slate-500">{{ c.vps_location }}</div>
            </div>
          </div>
          <span :class="['text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0', isExpired(c) ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30']">{{ isExpired(c) ? '已过期' : '运行中' }}</span>
        </div>

        <div class="mb-3">
          <div class="flex justify-between text-xs mb-1.5"><span class="text-slate-500">流量</span><span class="font-mono text-slate-300">{{ formatTrafficUsed(c) }} {{ formatTrafficUnit(c) }} / {{ c.traffic_gb }} GB</span></div>
          <div class="h-2 bg-slate-700 rounded-full overflow-hidden"><div :class="['h-full rounded-full transition', trafficPercent(c)>90?'bg-red-500':trafficPercent(c)>70?'bg-amber-500':'bg-emerald-500']" :style="{width:trafficPercent(c)+'%'}"></div></div>
        </div>

        <div class="text-xs text-slate-500 mb-3">到期 {{ formatExpiry(c.expiry_time) }}</div>

        <div class="flex items-center gap-2">
          <button @click="refreshOne(c)" class="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold px-3 py-2 rounded-lg transition text-xs">🔄</button>
          <button @click="openRenew(c)" class="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold px-3 py-2 rounded-lg transition text-xs">续费</button>
          <button @click="showDetail(c)" class="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-4 py-2 rounded-lg transition text-xs flex-1">连接信息</button>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="detail" class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" @click.self="detail=null">
      <div class="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-[0_20px_60px_rgba(0,0,0,0.8)] space-y-4">
        <div class="flex items-center justify-between"><h3 class="text-lg font-black text-white">连接信息</h3><button @click="detail=null" class="text-slate-400 hover:text-white text-2xl">&times;</button></div>
        <div class="text-center"><span :class="['text-xs font-bold px-3 py-1 rounded-full border', isExpired(detail)?'bg-red-500/10 text-red-400 border-red-500/30':'bg-emerald-500/10 text-emerald-400 border-emerald-500/30']">{{ isExpired(detail)?'⚠️ 已过期':'🟢 运行中' }}</span></div>
        <div class="bg-slate-800 rounded-2xl p-4 space-y-1.5">
          <div v-for="row in detailRows" :key="row.label" class="flex items-center justify-between py-1.5 border-b border-slate-700/50 last:border-0">
            <span class="text-xs text-slate-500 flex-shrink-0">{{ row.label }}</span>
            <div class="flex items-center gap-1 min-w-0">
              <span class="font-mono text-xs text-slate-300 truncate max-w-[180px]" :title="row.value">{{ row.value }}</span>
              <button v-if="row.copy" @click="copy(row.value)" class="text-slate-500 hover:text-white flex-shrink-0"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button>
            </div>
          </div>
        </div>
        <div v-if="detail.subscription_url" class="flex justify-center gap-8 py-2">
          <div v-if="!isExpired(detail)" class="flex flex-col items-center cursor-pointer" @click="copy(detail.subscription_url)"><img :src="qrSubDataUri" class="w-32 h-32 bg-white rounded-2xl p-1" alt="QR" /><span class="text-[10px] text-slate-500 mt-1 font-bold">📡 订阅</span></div>
          <div v-if="isExpired(detail)" class="flex flex-col items-center opacity-40 relative"><img :src="qrSubDataUri" class="w-32 h-32 bg-white rounded-2xl p-1 grayscale" alt="QR" /><span class="absolute inset-0 flex items-center justify-center text-red-400 text-xs font-black bg-black/40 rounded-2xl">已过期</span><span class="text-[10px] text-slate-600 mt-1 font-bold">📡 订阅</span></div>
          <div v-if="detail.config_url && !isExpired(detail)" class="flex flex-col items-center cursor-pointer" @click="copy(detail.config_url)"><img :src="qrNodeDataUri" class="w-32 h-32 bg-white rounded-2xl p-1" alt="QR" /><span class="text-[10px] text-slate-500 mt-1 font-bold">🔗 节点</span></div>
          <div v-if="detail.config_url && isExpired(detail)" class="flex flex-col items-center opacity-40 relative"><img :src="qrNodeDataUri" class="w-32 h-32 bg-white rounded-2xl p-1 grayscale" alt="QR" /><span class="absolute inset-0 flex items-center justify-center text-red-400 text-xs font-black bg-black/40 rounded-2xl">已过期</span><span class="text-[10px] text-slate-600 mt-1 font-bold">🔗 节点</span></div>
        </div>
        <p v-if="detail.subscription_url && !isExpired(detail)" class="text-[10px] text-slate-500 text-center">点击二维码自动复制</p>
        <details class="bg-slate-800/60 rounded-xl">
          <summary class="text-xs font-bold text-slate-400 cursor-pointer px-4 py-2.5 select-none hover:text-white transition">📖 使用教程（点击展开）</summary>
          <div class="px-4 pb-4 space-y-3 text-xs text-slate-300">
            <div>
              <p class="font-bold text-emerald-400 mb-1">Clash Meta / 小火箭</p>
              <p class="text-slate-500">复制订阅链接 → 打开客户端 → 添加订阅 → 粘贴链接 → 完成</p>
            </div>
            <div>
              <p class="font-bold text-emerald-400 mb-1">Sing-Box</p>
              <p class="text-slate-500">复制节点链接 → 打开 Sing-Box → 导入配置 → 选择节点 → 启动</p>
            </div>
            <div>
              <p class="font-bold text-emerald-400 mb-1">Shadowrocket</p>
              <p class="text-slate-500">复制订阅链接 → 打开 Shadowrocket → "+" → "Subscribe" → 粘贴链接 → 保存</p>
            </div>
            <div>
              <p class="font-bold text-emerald-400 mb-1">v2rayN (Windows)</p>
              <p class="text-slate-500">复制订阅链接 → v2rayN → 订阅设置 → 粘贴 → 更新订阅 → 右键启用</p>
            </div>
            <p class="text-slate-600 pt-1">⚠️ 如遇问题请联系客服</p>
          </div>
        </details>
        <button @click="detail=null" class="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl transition">关闭</button>
      </div>
    </div>

    <!-- Renew Modal -->
    <div v-if="renewModal" class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" @click.self="renewModal=null">
      <div class="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-[0_20px_60px_rgba(0,0,0,0.8)] space-y-4">
        <h3 class="text-lg font-black text-white">续费 {{ renewModal.email }}</h3>
        <div>
          <div class="text-xs text-slate-500 mb-2 font-bold">追加流量 (GB)</div>
          <div class="grid grid-cols-4 gap-2">
            <button v-for="g in [0,100,200,500]" :key="g" @click="renewForm.traffic=g"
              :class="['py-2.5 rounded-xl text-center font-bold text-sm transition border', renewForm.traffic===g ? 'bg-emerald-500/10 border-emerald-400/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-300']">{{ g===0?"不追加":g+"GB" }}</button>
          </div>
        </div>
        <div>
          <div class="text-xs text-slate-500 mb-2 font-bold">续费时长</div>
          <div class="grid grid-cols-4 gap-2">
            <button v-for="d in renewOptions" :key="d.d" @click="renewForm.days=d.d"
              :class="['py-2.5 rounded-xl text-center font-bold text-sm transition border', renewForm.days===d.d ? 'bg-emerald-500/10 border-emerald-400/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-300']">{{ d.l }}</button>
          </div>
        </div>
        <button @click="doRenew" class="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-3 rounded-xl transition">确认续费</button>
        <button @click="renewModal=null" class="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl transition">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAppStore } from '../stores/app'; import { useUserStore } from '../stores/user'; import { useUiStore } from '../stores/ui';
import QRCode from 'qrcode';
import { formatTrafficUsed, formatTrafficUnit, formatExpiry, isExpired, trafficPercent } from '../utils/format.js';
const appStore = useAppStore(); const userStore = useUserStore(); const uiStore = useUiStore();
const clients = ref([]); const loading = ref(true); const detail = ref(null);
const qrSubDataUri = ref(''); const qrNodeDataUri = ref('');

const FC2 = { hk:'hk',jp:'jp',kr:'kr',tw:'tw',sg:'sg',th:'th',vn:'vn',my:'my',ph:'ph',id:'id',in:'in',ae:'ae',us:'us',ca:'ca',uk:'gb',gb:'gb',de:'de',nl:'nl',fr:'fr',ru:'ru',au:'au',br:'br',ar:'ar',za:'za',mx:'mx' };
const getClientFlagUrl = (c) => { const f=(c.flag_emoji||'').toLowerCase().trim(); const code=FC2[f]||FC2[(c.vps_location||'').toLowerCase()]||FC2[(c.vps_location||'').toLowerCase().split(' ')[0]]; return code?`https://flagcdn.com/w80/${code}.png`:''; };

const renewOptions = [{d:30,l:"1月"},{d:90,l:"3月·9折"},{d:180,l:"6月·85折"},{d:360,l:"12月·75折"}];
const renewModal = ref(null); const renewForm = ref({ traffic: 0, days: 30 });
const openRenew = (c) => { renewModal.value = c; renewForm.value = { traffic: 0, days: 30 }; };
const doRenew = async () => {
  const c = renewModal.value; if (!c) return;
  try {
    const r = await fetch(`/api/vpn/client/${c.id}/renew`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${userStore.token}`}, body:JSON.stringify({traffic_gb:renewForm.value.traffic,duration_days:renewForm.value.days}) });
    const d = await r.json();
    if (d.status==='success') { c.traffic_gb=d.data.traffic_gb; c.expiry_time=d.data.expiry_time; if(d.data.balance)userStore.updateUserInfo({balance:d.data.balance}); uiStore.showToast((d.data.xxui_warning?'⚠️ 续费成功但XX-UI同步失败，请联系管理员':'续费成功'), d.data.xxui_warning?'warning':'success'); renewModal.value=null; }
    else uiStore.showToast(d.message||'失败','error');
  } catch(e) { uiStore.showToast('网络错误','error'); }
};
const refreshOne = async (c) => { try { const r = await fetch(`/api/vpn/client/${c.id}`,{headers:{'Authorization':`Bearer ${userStore.token}`}}); const d=await r.json(); if(d.status==='success'&&d.data?.liveTraffic){c.traffic_used_up=d.data.liveTraffic.up;c.traffic_used_down=d.data.liveTraffic.down;} } catch(e){} };
const showDetail = async (c) => { detail.value=c; qrSubDataUri.value='';qrNodeDataUri.value=''; if(c.subscription_url)try{qrSubDataUri.value=await QRCode.toDataURL(c.subscription_url,{width:150,margin:1})}catch(e){}; if(c.config_url)try{qrNodeDataUri.value=await QRCode.toDataURL(c.config_url,{width:150,margin:1})}catch(e){}; };
const detailRows = computed(() => { if(!detail.value)return[]; const r=[{label:'📧 账号',value:detail.value.email,copy:true}]; if(detail.value.uuid)r.push({label:'🔑 UUID',value:detail.value.uuid,copy:true}); if(detail.value.vps_location)r.push({label:'📍 节点',value:detail.value.vps_location,copy:false}); r.push({label:'📦 流量',value:`${formatTrafficUsed(detail.value)} / ${detail.value.traffic_gb} GB`,copy:false}); r.push({label:'📅 到期',value:formatExpiry(detail.value.expiry_time),copy:false}); return r; });
const copy = async (text) => { try{await navigator.clipboard.writeText(text);}catch(e){} };

let refreshTimer = null;
onUnmounted(()=>{clearInterval(refreshTimer)});

onMounted(async () => {
  if(!userStore.token){loading.value=false;return}
  try{const res=await fetch('/api/vpn/clients',{headers:{'Authorization':`Bearer ${userStore.token}`}});const data=await res.json();if(data.status==='success')clients.value=data.data}catch(e){}
  loading.value=false;
  refreshTimer=setInterval(()=>{clients.value.forEach(c=>{if(!c._demo)refreshOne(c)})},15000);
});
</script>
