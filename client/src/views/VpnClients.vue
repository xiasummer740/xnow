<template>
  <div class="min-h-full space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl md:text-2xl font-black tracking-tight shop-title">{{ appStore.lang === 'zh' ? '我的节点' : 'My Nodes' }}</h1>
      <router-link to="/vpn" class="vpn-btn text-sm px-4 py-2">{{ appStore.lang === 'zh' ? '+ 选购节点' : '+ Get Node' }}</router-link>
    </div>

    <div v-if="loading" class="flex justify-center py-20"><div class="shop-spinner"></div></div>

    <div v-else-if="clients.length === 0 && !demoMode" class="shop-panel text-center py-16 opacity-50">
      <div class="text-5xl mb-4">🛡️</div>
      <p class="text-base mb-4">{{ appStore.lang === 'zh' ? '暂无节点，去选购一个吧' : 'No active nodes.' }}</p>
      <router-link to="/vpn" class="vpn-btn inline-block">{{ appStore.lang === 'zh' ? '选购节点' : 'Get a Node' }}</router-link>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="c in clients" :key="c.id" class="shop-panel group">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2 min-w-0">
            <img :src="getClientFlagUrl(c)" class="vpn-flag flex-shrink-0" @error="e=>e.target.style.display='none'" />
            <div class="min-w-0">
              <h3 class="font-bold text-sm font-mono truncate">{{ c.email }}</h3>
              <span v-if="c.vps_location" class="text-xs opacity-50">{{ c.vps_location }}</span>
            </div>
          </div>
          <span class="vpn-tag flex-shrink-0" :class="isExpired(c) ? 'expired' : 'active'">{{ isExpired(c) ? (appStore.lang === 'zh' ? '已过期' : 'Expired') : (appStore.lang === 'zh' ? '运行中' : 'Active') }}</span>
        </div>

        <div class="mb-3">
          <div class="flex justify-between text-xs mb-1"><span class="opacity-50">{{ appStore.lang === 'zh' ? '流量使用' : 'Used' }}</span><span class="font-mono text-xs">{{ formatTrafficUsed(c) }} / {{ c.traffic_gb }}GB</span></div>
          <div class="vpn-traffic-bar"><div class="vpn-traffic-bar-fill" :class="trafficPercent(c) > 90 ? 'crit' : trafficPercent(c) > 70 ? 'warn' : 'good'" :style="{ width: trafficPercent(c) + '%' }"></div></div>
        </div>

        <div class="flex items-center justify-between text-xs mb-3 opacity-50">
          <span>{{ appStore.lang === 'zh' ? '到期' : 'Expires' }}: {{ formatExpiry(c.expiry_time) }}</span>
        </div>

        <div class="flex items-center gap-2">
          <button @click="refreshOne(c)" class="vpn-btn vpn-btn-ghost text-xs py-1.5 px-3">🔄</button>
          <button @click="renewClient(c)" class="vpn-btn vpn-btn-ghost text-xs py-1.5 px-3">{{ appStore.lang === 'zh' ? '续费' : 'Renew' }}</button>
          <button @click="showDetail(c)" class="vpn-btn text-xs py-1.5 px-4 flex-1">{{ appStore.lang === 'zh' ? '连接信息' : 'Connect' }}</button>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="detail" class="vpn-modal-overlay" @click.self="detail = null">
      <div class="vpn-modal space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold">{{ appStore.lang === 'zh' ? '连接信息' : 'Connection' }}</h3>
          <button @click="detail = null" class="text-2xl opacity-50 hover:opacity-100">&times;</button>
        </div>
        <div class="text-center">
          <span class="vpn-tag" :class="isExpired(detail) ? 'expired' : 'active'">{{ isExpired(detail) ? '⚠️ ' + (appStore.lang === 'zh' ? '已过期' : 'Expired') : '🟢 ' + (appStore.lang === 'zh' ? '运行中' : 'Active') }}</span>
        </div>

        <div class="space-y-2 bg-white/3 rounded-2xl p-4 text-sm">
          <div v-for="row in detailRows" :key="row.label" class="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
            <span class="opacity-50 text-xs flex-shrink-0">{{ row.label }}</span>
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="font-mono text-xs truncate max-w-[180px]" :title="row.value">{{ row.value }}</span>
              <button v-if="row.copy" @click="copy(row.value)" class="opacity-40 hover:opacity-100 flex-shrink-0"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></button>
            </div>
          </div>
        </div>

        <div v-if="detail.subscription_url" class="flex items-center justify-center gap-4 py-2">
          <div class="flex flex-col items-center cursor-pointer" @click="copy(detail.subscription_url)">
            <img :src="qrSubDataUri" class="w-36 h-36 bg-white rounded-2xl p-1" alt="QR" />
            <span class="text-[10px] opacity-50 mt-1 font-bold">📡 {{ appStore.lang === 'zh' ? '订阅' : 'Sub' }}</span>
          </div>
          <div v-if="detail.config_url" class="flex flex-col items-center cursor-pointer" @click="copy(detail.config_url)">
            <img :src="qrNodeDataUri" class="w-36 h-36 bg-white rounded-2xl p-1" alt="QR" />
            <span class="text-[10px] opacity-50 mt-1 font-bold">🔗 {{ appStore.lang === 'zh' ? '节点' : 'Node' }}</span>
          </div>
        </div>
        <p v-if="detail.subscription_url" class="text-[10px] text-center opacity-40">{{ appStore.lang === 'zh' ? '点击二维码自动复制链接' : 'Tap QR to copy' }}</p>
        <button @click="detail = null" class="vpn-btn vpn-btn-ghost w-full">{{ appStore.lang === 'zh' ? '关闭' : 'Close' }}</button>
      </div>
    </div>

    <div v-if="toast" class="fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-bold z-[10001] shadow-lg" style="background:var(--vpn-accent);color:#fff">{{ toast }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAppStore } from '../stores/app'; import { useUserStore } from '../stores/user'; import { useUiStore } from '../stores/ui';
import QRCode from 'qrcode';
import { formatTrafficUsed, formatExpiry, isExpired, trafficPercent } from '../utils/format.js';
const appStore = useAppStore(); const userStore = useUserStore(); const uiStore = useUiStore();
const clients = ref([]); const loading = ref(true); const detail = ref(null); const copied = ref(''); const toast = ref(''); const demoMode = ref(false);
const qrSubDataUri = ref(''); const qrNodeDataUri = ref('');

const FC = { hk:'hk',jp:'jp',kr:'kr',tw:'tw',sg:'sg',th:'th',vn:'vn',my:'my',ph:'ph',id:'id',in:'in',ae:'ae',us:'us',ca:'ca',uk:'gb',gb:'gb',de:'de',nl:'nl',fr:'fr',ru:'ru',au:'au',br:'br',ar:'ar',za:'za',mx:'mx' };
const getClientFlagUrl = (c) => { const f=(c.flag_emoji||'').toLowerCase().trim(); const code=FC[f]||FC[(c.vps_location||'').toLowerCase()]||FC[(c.vps_location||'').toLowerCase().split(' ')[0]]; return code?`https://flagcdn.com/w80/${code}.png`:''; };

const renewClient = async (c) => {
  const addDays = prompt(appStore.lang === 'zh' ? '续费天数 (30/90/180/360):' : 'Days:', '30'); if (!addDays) return;
  const addTraffic = prompt(appStore.lang === 'zh' ? '追加流量 GB (0=不追加):' : 'Traffic GB:', '0'); if (addTraffic === null) return;
  try {
    const r = await fetch(`/api/vpn/client/${c.id}/renew`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${userStore.token}`}, body:JSON.stringify({traffic_gb:parseInt(addTraffic)||0,duration_days:parseInt(addDays)||30}) });
    const d = await r.json();
    if (d.status==='success') { c.traffic_gb=d.data.traffic_gb; c.expiry_time=d.data.expiry_time; if(d.data.balance)userStore.updateUserInfo({balance:d.data.balance}); uiStore.showToast(appStore.lang==='zh'?'续费成功':'Renewed','success'); }
    else uiStore.showToast(d.message||'Failed','error');
  } catch(e) { uiStore.showToast('Network error','error'); }
};
const refreshOne = async (c) => { try { const r = await fetch(`/api/vpn/client/${c.id}`,{headers:{'Authorization':`Bearer ${userStore.token}`}}); const d=await r.json(); if(d.status==='success'&&d.data?.liveTraffic){c.traffic_used_up=d.data.liveTraffic.up;c.traffic_used_down=d.data.liveTraffic.down;} } catch(e){} };
const showDetail = async (c) => { detail.value=c; qrSubDataUri.value='';qrNodeDataUri.value=''; if(c.subscription_url)try{qrSubDataUri.value=await QRCode.toDataURL(c.subscription_url,{width:150,margin:1})}catch(e){}; if(c.config_url)try{qrNodeDataUri.value=await QRCode.toDataURL(c.config_url,{width:150,margin:1})}catch(e){}; };
const detailRows = computed(() => { if(!detail.value)return[]; const r=[{label:appStore.lang==='zh'?'📧 账号':'📧 Email',value:detail.value.email,copy:true}]; if(detail.value.uuid)r.push({label:'🔑 UUID',value:detail.value.uuid,copy:true}); if(detail.value.vps_location)r.push({label:appStore.lang==='zh'?'📍 节点':'📍 Node',value:detail.value.vps_location,copy:false}); r.push({label:appStore.lang==='zh'?'📦 流量':'📦 Traffic',value:`${formatTrafficUsed(detail.value)} / ${detail.value.traffic_gb} GB`,copy:false}); r.push({label:appStore.lang==='zh'?'📅 到期':'📅 Expiry',value:formatExpiry(detail.value.expiry_time),copy:false}); return r; });
const copy = async (text) => { try{await navigator.clipboard.writeText(text);copied.value=text;toast.value=appStore.lang==='zh'?'已复制':'Copied!';setTimeout(()=>{toast.value='';copied.value=''},1500);}catch(e){} };

let refreshTimer = null;
const startAutoRefresh = () => { if(demoMode.value)return; clearInterval(refreshTimer); refreshTimer=setInterval(()=>{clients.value.forEach(c=>{if(!c._demo)refreshOne(c)})},5000); };
onUnmounted(()=>{clearInterval(refreshTimer)});

onMounted(async () => {
  if(!userStore.token){loading.value=false;return}
  try{const res=await fetch('/api/vpn/clients',{headers:{'Authorization':`Bearer ${userStore.token}`}});const data=await res.json();if(data.status==='success')clients.value=data.data;if(clients.value.length===0)demoMode.value=true}catch(e){demoMode.value=true}
  if(demoMode.value){const now=Date.now();clients.value=[{id:1,email:'demo@vpn',uuid:'a1b2c3d4-e5f6-7890-abcd-ef1234567890',config_url:'vless://demo@us.example.com:443?encryption=none&type=tcp#demo',traffic_gb:200,traffic_used_up:32e9,traffic_used_down:8e9,expiry_time:now+86400*75*1000,vps_location:'洛杉矶',flag_emoji:'🇺🇸',subscription_url:'https://panel.example.com:2096/sub/demo',_demo:true},{id:2,email:'demo2@vpn',uuid:'f9e8d7c6-b5a4-3210-fedc-ba9876543210',config_url:'',traffic_gb:500,traffic_used_up:0,traffic_used_down:0,expiry_time:now+86400*10*1000,vps_location:'伦敦',flag_emoji:'🇬🇧',subscription_url:'',_demo:true}]}
  loading.value=false;startAutoRefresh()
});
</script>

<style scoped>
.shop-panel { background:var(--vpn-surface);border:1px solid var(--vpn-border);border-radius:var(--vpn-radius);padding:1.25rem; }
.shop-title { background:linear-gradient(135deg,#e0f0ee 0%,#a0d8cc 50%,#5ec4b0 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.shop-spinner { width:32px;height:32px;border:3px solid rgba(0,135,113,0.2);border-top-color:var(--vpn-accent);border-radius:50%;animation:spin 0.8s linear infinite; }
@keyframes spin { to{transform:rotate(360deg)} }
</style>
