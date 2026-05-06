<template>
  <div class="min-h-full" style="padding:0 1rem 2rem;max-width:720px;margin:0 auto">
    <div class="flex items-center justify-between mb-5" style="padding-top:0.5rem">
      <h1 style="font-size:1.5rem;font-weight:900;color:var(--xui-text)">{{ appStore.lang === 'zh' ? '我的节点' : 'My Nodes' }}</h1>
      <router-link to="/vpn" class="xui-btn">{{ appStore.lang === 'zh' ? '+ 选购' : '+ Buy' }}</router-link>
    </div>

    <div v-if="loading" class="xui-spinner"></div>

    <div v-else-if="clients.length === 0 && !demoMode" class="xui-empty">
      <div class="xui-empty-icon">🛡️</div>
      <p style="margin-bottom:1rem">{{ appStore.lang === 'zh' ? '暂无节点' : 'No nodes yet' }}</p>
      <router-link to="/vpn" class="xui-btn">{{ appStore.lang === 'zh' ? '选购节点' : 'Get One' }}</router-link>
    </div>

    <div v-else class="space-y-3">
      <div v-for="c in clients" :key="c.id" class="xui-card" style="padding:1.25rem">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2 min-w-0">
            <img :src="getClientFlagUrl(c)" class="xui-plan-flag flex-shrink-0" @error="e=>e.target.style.display='none'" />
            <div class="min-w-0">
              <div class="font-bold text-sm font-mono truncate">{{ c.email }}</div>
              <div class="text-xs" style="color:var(--xui-text-dim)">{{ c.vps_location }}</div>
            </div>
          </div>
          <span class="xui-tag flex-shrink-0" :class="isExpired(c) ? 'xui-tag-red' : 'xui-tag-green'">{{ isExpired(c) ? '已过期' : '运行中' }}</span>
        </div>

        <div class="mb-3">
          <div class="flex justify-between text-xs mb-1"><span style="color:var(--xui-text-dim)">流量</span><span class="font-mono text-xs">{{ formatTrafficUsed(c) }} {{ formatTrafficUnit(c) }} / {{ c.traffic_gb }} GB</span></div>
          <div class="xui-bar"><div class="xui-bar-fill" :class="trafficPercent(c)>90?'crit':trafficPercent(c)>70?'warn':'ok'" :style="{width:trafficPercent(c)+'%'}"></div></div>
        </div>

        <div class="flex items-center justify-between text-xs mb-3" style="color:var(--xui-text-dim)">
          <span>到期 {{ formatExpiry(c.expiry_time) }}</span>
        </div>

        <div class="flex items-center gap-2">
          <button @click="refreshOne(c)" class="xui-btn xui-btn-ghost text-xs" style="padding:0.4rem 0.75rem">🔄</button>
          <button @click="openRenew(c)" class="xui-btn xui-btn-ghost text-xs" style="padding:0.4rem 0.75rem">续费</button>
          <button @click="showDetail(c)" class="xui-btn text-xs flex-1" style="padding:0.4rem 0.75rem">连接信息</button>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="detail" class="xui-overlay" @click.self="detail=null">
      <div class="xui-modal space-y-4">
        <div class="flex items-center justify-between"><h3 style="font-size:1.1rem;font-weight:900">连接信息</h3><button @click="detail=null" style="font-size:1.5rem;color:var(--xui-text-dim);line-height:1">&times;</button></div>
        <div class="text-center"><span class="xui-tag" :class="isExpired(detail)?'xui-tag-red':'xui-tag-green'">{{ isExpired(detail)?'⚠️ 已过期':'🟢 运行中' }}</span></div>
        <div class="space-y-2" style="background:#f8fafb;border-radius:1rem;padding:1rem;font-size:0.85rem">
          <div v-for="row in detailRows" :key="row.label" class="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
            <span style="color:var(--xui-text-dim);font-size:0.75rem;flex-shrink:0">{{ row.label }}</span>
            <div class="flex items-center gap-1 min-w-0">
              <span class="font-mono text-xs truncate" style="max-width:180px" :title="row.value">{{ row.value }}</span>
              <button v-if="row.copy" @click="copy(row.value)" style="color:var(--xui-text-dim);flex-shrink:0"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></button>
            </div>
          </div>
        </div>
        <div v-if="detail.subscription_url" class="flex items-center justify-center gap-4 py-2">
          <div class="flex flex-col items-center cursor-pointer" @click="copy(detail.subscription_url)"><img :src="qrSubDataUri" class="w-36 h-36 bg-white rounded-2xl p-1" alt="QR" /><span class="text-[10px] mt-1 font-bold" style="color:var(--xui-text-dim)">📡 订阅</span></div>
          <div v-if="detail.config_url" class="flex flex-col items-center cursor-pointer" @click="copy(detail.config_url)"><img :src="qrNodeDataUri" class="w-36 h-36 bg-white rounded-2xl p-1" alt="QR" /><span class="text-[10px] mt-1 font-bold" style="color:var(--xui-text-dim)">🔗 节点</span></div>
        </div>
        <p v-if="detail.subscription_url" class="text-[10px] text-center" style="color:var(--xui-text-dim)">点击二维码自动复制</p>
        <button @click="detail=null" class="xui-btn xui-btn-ghost w-full">关闭</button>
      </div>
    </div>

    <!-- Renew Modal -->
    <div v-if="renewModal" class="xui-overlay" @click.self="renewModal=null">
      <div class="xui-modal space-y-4">
        <h3 style="font-size:1.1rem;font-weight:900">续费 {{ renewModal.email }}</h3>
        <div>
          <div style="font-size:0.75rem;color:var(--xui-text-dim);margin-bottom:0.5rem">追加流量 (GB)</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem">
            <button v-for="g in [0,100,200,500]" :key="g" @click="renewForm.traffic=g" class="xui-card" :class="{selected:renewForm.traffic===g}" style="padding:0.5rem;text-align:center;cursor:pointer;font-size:0.8rem;font-weight:700;border:none">{{ g===0?"不追加":g+"GB" }}</button>
          </div>
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--xui-text-dim);margin-bottom:0.5rem">续费时长</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem">
            <button v-for="d in [{d:30,l:"1月"},{d:90,l:"3月·9折"},{d:180,l:"6月·85折"},{d:360,l:"12月·75折"}]" :key="d.d" @click="renewForm.days=d.d" class="xui-card" :class="{selected:renewForm.days===d.d}" style="padding:0.5rem;text-align:center;cursor:pointer;font-size:0.8rem;font-weight:700;border:none">{{ d.l }}</button>
          </div>
        </div>
        <button @click="doRenew" class="xui-btn w-full">确认续费</button>
        <button @click="renewModal=null" class="xui-btn xui-btn-ghost w-full">取消</button>
      </div>
    </div>

    <div v-if="toast" class="fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-bold z-[10001] shadow-lg" style="background:var(--xui-primary);color:#fff">{{ toast }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAppStore } from '../stores/app'; import { useUserStore } from '../stores/user'; import { useUiStore } from '../stores/ui';
import QRCode from 'qrcode';
import { formatTrafficUsed, formatTrafficUnit, formatExpiry, isExpired, trafficPercent } from '../utils/format.js';
const appStore = useAppStore(); const userStore = useUserStore(); const uiStore = useUiStore();
const clients = ref([]); const loading = ref(true); const detail = ref(null); const copied = ref(''); const toast = ref(''); const demoMode = ref(false);
const qrSubDataUri = ref(''); const qrNodeDataUri = ref('');

const FC2 = { hk:'hk',jp:'jp',kr:'kr',tw:'tw',sg:'sg',th:'th',vn:'vn',my:'my',ph:'ph',id:'id',in:'in',ae:'ae',us:'us',ca:'ca',uk:'gb',gb:'gb',de:'de',nl:'nl',fr:'fr',ru:'ru',au:'au',br:'br',ar:'ar',za:'za',mx:'mx' };
const getClientFlagUrl = (c) => { const f=(c.flag_emoji||'').toLowerCase().trim(); const code=FC2[f]||FC2[(c.vps_location||'').toLowerCase()]||FC2[(c.vps_location||'').toLowerCase().split(' ')[0]]; return code?`https://flagcdn.com/w80/${code}.png`:''; };

const renewModal = ref(null); const renewForm = ref({ traffic: 0, days: 30 });
const openRenew = (c) => { renewModal.value = c; renewForm.value = { traffic: 0, days: 30 }; };
const doRenew = async () => {
  const c = renewModal.value; if (!c) return;
  try {
    const r = await fetch(`/api/vpn/client/${c.id}/renew`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${userStore.token}`}, body:JSON.stringify({traffic_gb:renewForm.value.traffic,duration_days:renewForm.value.days}) });
    const d = await r.json();
    if (d.status==='success') { c.traffic_gb=d.data.traffic_gb; c.expiry_time=d.data.expiry_time; if(d.data.balance)userStore.updateUserInfo({balance:d.data.balance}); uiStore.showToast('续费成功','success'); renewModal.value=null; }
    else uiStore.showToast(d.message||'Failed','error');
  } catch(e) { uiStore.showToast('Network error','error'); }
};
const refreshOne = async (c) => { try { const r = await fetch(`/api/vpn/client/${c.id}`,{headers:{'Authorization':`Bearer ${userStore.token}`}}); const d=await r.json(); if(d.status==='success'&&d.data?.liveTraffic){c.traffic_used_up=d.data.liveTraffic.up;c.traffic_used_down=d.data.liveTraffic.down;} } catch(e){} };
const showDetail = async (c) => { detail.value=c; qrSubDataUri.value='';qrNodeDataUri.value=''; if(c.subscription_url)try{qrSubDataUri.value=await QRCode.toDataURL(c.subscription_url,{width:150,margin:1})}catch(e){}; if(c.config_url)try{qrNodeDataUri.value=await QRCode.toDataURL(c.config_url,{width:150,margin:1})}catch(e){}; };
const detailRows = computed(() => { if(!detail.value)return[]; const r=[{label:'📧 账号',value:detail.value.email,copy:true}]; if(detail.value.uuid)r.push({label:'🔑 UUID',value:detail.value.uuid,copy:true}); if(detail.value.vps_location)r.push({label:'📍 节点',value:detail.value.vps_location,copy:false}); r.push({label:'📦 流量',value:`${formatTrafficUsed(detail.value)} / ${detail.value.traffic_gb} GB`,copy:false}); r.push({label:'📅 到期',value:formatExpiry(detail.value.expiry_time),copy:false}); return r; });
const copy = async (text) => { try{await navigator.clipboard.writeText(text);copied.value=text;toast.value='已复制';setTimeout(()=>{toast.value='';copied.value=''},1500);}catch(e){} };

let refreshTimer = null;
const startAutoRefresh = () => { if(demoMode.value)return; clearInterval(refreshTimer); refreshTimer=setInterval(()=>{clients.value.forEach(c=>{if(!c._demo)refreshOne(c)})},5000); };
onUnmounted(()=>{clearInterval(refreshTimer)});

onMounted(async () => {
  if(!userStore.token){loading.value=false;return}
  try{const res=await fetch('/api/vpn/clients',{headers:{'Authorization':`Bearer ${userStore.token}`}});const data=await res.json();if(data.status==='success')clients.value=data.data;if(clients.value.length===0)demoMode.value=true}catch(e){demoMode.value=true}
  if(demoMode.value){const now=Date.now();clients.value=[{id:1,email:'demo@vpn',uuid:'a1b2c3d4-e5f6-7890-abcd-ef1234567890',config_url:'vless://demo@us.example.com:443?encryption=none&type=tcp#demo',traffic_gb:200,traffic_used_up:32e9,traffic_used_down:8e9,expiry_time:now+86400*75*1000,vps_location:'洛杉矶',flag_emoji:'🇺🇸',subscription_url:'https://panel.example.com:2096/sub/demo',_demo:true}]}
  loading.value=false;startAutoRefresh()
});
</script>
