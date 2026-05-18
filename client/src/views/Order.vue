<template>
  <div class="max-w-5xl mx-auto space-y-4 md:space-y-6 pb-20 relative">
    
    <div class="bg-slate-800/80 p-4 md:p-5 rounded-2xl border border-slate-700 flex items-start space-x-3 md:space-x-4 shadow-xl">
      <div class="text-pink-500 mt-1 text-xl md:text-2xl">📢</div>
      <div class="w-full overflow-hidden">
        <h3 class="font-bold text-white mb-1 text-sm md:text-base">{{ appStore.t('sys_notice') }}</h3>
        <div class="text-slate-300 text-xs md:text-sm leading-relaxed" v-html="sysAnnouncement"></div>
      </div>
    </div>
    
    <div class="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
      <div v-for="(icon, name) in platforms" :key="name" @click="selectPlatform(name)"
           :class="['p-2 md:p-4 rounded-xl md:rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 transform', activePlatform === name ? 'bg-amber-400 text-slate-900 shadow-[0_5px_15px_rgba(251,191,36,0.4)] scale-105 font-black' : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white hover:-translate-y-1']">
        <div class="text-3xl md:text-4xl mb-1 md:mb-2 filter drop-shadow-md">{{ icon }}</div>
        <div class="text-[10px] md:text-xs leading-tight w-full text-center font-medium whitespace-normal break-words px-1">{{ name }}</div>
      </div>
    </div>

    <div class="bg-slate-800/80 p-5 md:p-10 rounded-2xl md:rounded-3xl border border-slate-700 shadow-2xl space-y-6 md:space-y-8 relative">
      <div class="space-y-5 md:space-y-6">
        
        <div class="relative">
          <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">{{ appStore.t('category') }}</label>
          <div @click="catOpen = !catOpen; srvOpen = false" class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white cursor-pointer flex justify-between items-center hover:border-amber-400 transition min-h-[46px]">
            <span class="text-xs md:text-base whitespace-normal break-words pr-2 line-clamp-2">{{ activeCategory || '此平台下暂无可用分类' }}</span>
            <svg class="w-5 h-5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
          <div v-if="catOpen" @click="catOpen = false" class="fixed inset-0 z-40"></div>
          <div v-if="catOpen && availableCategories.length > 0" class="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] max-h-72 overflow-y-auto custom-scrollbar">
            <div v-for="cat in availableCategories" :key="cat" @click="selectCategory(cat)" class="px-4 py-2.5 border-b border-slate-700/50 hover:bg-slate-700 cursor-pointer text-xs md:text-sm text-slate-300 transition">{{ cat }}</div>
          </div>
        </div>

        <div class="relative">
          <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">{{ appStore.t('service') }}</label>
          <div @click="srvOpen = !srvOpen; catOpen = false" class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white cursor-pointer flex justify-between items-center hover:border-amber-400 transition min-h-[46px]">
            <span class="text-xs md:text-sm whitespace-normal break-words pr-2 leading-snug line-clamp-3">
              {{ activeService ? `ID:${activeService.service} | ${activeService.name} | ${appStore.formatMoney(activeService.rate)}` : appStore.t('select_cat_first') }}
            </span>
            <svg class="w-5 h-5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
          <div v-if="srvOpen" @click="srvOpen = false" class="fixed inset-0 z-40"></div>
          <div v-if="srvOpen && availableServices.length > 0" class="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-[0_10px_50px_rgba(0,0,0,0.7)] max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div v-for="srv in availableServices" :key="srv.service" @click="selectService(srv.service)" class="px-3 py-2 md:py-2.5 border-b border-slate-700/50 hover:bg-slate-700 cursor-pointer transition">
              <div class="text-[11px] md:text-xs text-slate-300 leading-snug whitespace-normal break-words">ID:{{ srv.service }} | {{ srv.name }} | {{ appStore.formatMoney(srv.rate) }}</div>
            </div>
          </div>
        </div>

        <div v-if="activeService" class="bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl md:rounded-2xl p-4 md:p-5 flex items-center justify-between text-slate-900 shadow-[0_5px_15px_rgba(251,191,36,0.3)]">
          <div class="flex items-start md:items-center space-x-3 md:space-x-4 w-full mr-2">
            <div class="bg-slate-900 text-amber-400 font-black px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base flex-shrink-0 mt-0.5 md:mt-0">ID: {{ activeService.service }}</div>
            <div class="font-bold text-xs md:text-sm whitespace-normal break-words flex-grow leading-snug">{{ activeService.name }}</div>
          </div>
          <div class="text-xl md:text-2xl font-black whitespace-nowrap flex-shrink-0">{{ appStore.formatMoney(activeService.rate) }}</div>
        </div>

        <div class="bg-blue-900/20 border-l-4 border-blue-500 rounded-r-lg md:rounded-r-xl flex flex-col overflow-hidden shadow-inner">
          <div class="font-bold text-blue-400 flex items-center text-xs md:text-sm bg-slate-900/70 p-3 md:p-4 border-b border-blue-500/30">
            <span class="mr-2">💡</span> 服务描述与下单规范
          </div>
          
          <div class="p-3 md:p-4 text-[11px] md:text-xs text-blue-200 font-mono leading-snug max-h-48 overflow-y-auto custom-scrollbar">
            <div class="space-y-1.5 break-all">
              <p>✔️ {{ appStore.lang === 'zh' ? '示例链接' : 'Example Link' }} : <span class="text-white bg-blue-900/50 px-1.5 py-0.5 rounded">{{ dynamicGuideLink }}</span></p>
              <div class="h-px bg-blue-500/30 my-2 w-full"></div>
              
              <div v-if="activeService && activeService.description" class="text-slate-300 font-sans whitespace-pre-wrap leading-tight" v-html="activeService.description"></div>
              <div v-else class="space-y-1">
                <p class="text-red-300">{{ appStore.t('guide_1') }}</p>
                <p class="text-red-300">{{ appStore.t('guide_2') }}</p>
                <p class="text-slate-500 text-[10px] mt-1.5 font-sans italic">* 此服务上游未提供特殊说明，请遵循基础规范下单。</p>
              </div>
            </div>
          </div>
        </div>

        <transition name="fade-slide">
          <div v-if="isCustomComments" class="bg-indigo-900/10 border border-indigo-500/30 rounded-xl md:rounded-2xl p-4 md:p-5 shadow-inner">
            <label class="block text-xs md:text-sm font-bold text-amber-400 mb-2 md:mb-3 flex items-center">
              <span class="mr-2">📝</span> 自定义评论内容（每行1条）
            </label>
            <textarea v-model="form.comments" @input="updateQuantityFromComments" rows="6"
              class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none focus:border-amber-400 transition text-sm md:text-base custom-scrollbar placeholder:text-slate-600 leading-relaxed"
              placeholder="请输入自定义内容...&#10;一行代表一条记录&#10;下单数量将根据您的行数自动演算保护"></textarea>
            <div class="flex justify-between items-center mt-3">
              <span class="text-[10px] text-indigo-300 font-mono">* 已开启数量强制同步锁定机制</span>
              <div class="text-xs text-slate-400 font-bold">
                已输入内容: <span class="text-amber-400 text-sm ml-1">{{ parsedLinesCount }}</span> 行
              </div>
            </div>
          </div>
        </transition>

        <div class="space-y-5 md:space-y-6">
          <div>
            <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">{{ appStore.t('link') }}</label>
            <input type="text" v-model="form.link" placeholder="..." class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none focus:border-amber-400 transition text-base md:text-lg">
          </div>
          <div class="flex flex-col md:flex-row space-y-5 md:space-y-0 md:space-x-8">
            <div class="flex-1">
              <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">
                {{ appStore.t('quantity') }} 
                <span v-if="activeService" class="text-[10px] md:text-xs text-amber-500 ml-1 font-normal">({{ activeService.min }} ~ {{ activeService.max }})</span>
                <span v-if="isCustomComments" class="text-[10px] ml-2 px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-normal">受评论行数锁定</span>
              </label>
              <input type="number" v-model="form.quantity" :readonly="isCustomComments" :class="['w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none transition text-lg md:text-xl font-mono', isCustomComments ? 'opacity-50 cursor-not-allowed border-slate-700' : 'focus:border-amber-400']">
            </div>
            <div class="w-full md:w-64">
              <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3 md:text-right">{{ appStore.t('total_price') }}</label>
              <div class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-amber-400 md:text-right font-black text-xl md:text-2xl shadow-inner">
                {{ appStore.formatMoney(rawTotalPrice) }}
              </div>
            </div>
          </div>
        </div>

        <button @click="submitOrder" :disabled="isSubmitting || !activeServiceId" class="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-black text-lg md:text-xl py-4 md:py-5 rounded-xl md:rounded-2xl transition-all transform hover:-translate-y-1 shadow-[0_5px_15px_rgba(251,191,36,0.3)] disabled:opacity-50 disabled:hover:translate-y-0">
          {{ isSubmitting ? '系统高并发处理中...' : appStore.t('submit_order') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui';
import { useAppStore } from '../stores/app';

const userStore = useUserStore(); const uiStore = useUiStore(); const appStore = useAppStore();

const platforms = { 'TikTok': '🎵', 'Telegram': '✈️', 'Facebook': '📘', 'Instagram': '📸', 'Twitter': '🐦', 'YouTube': '▶️', 'Spotify': '🎧', 'Snapchat': '👻', 'Google': '🔍', 'Discord': '🎮', 'LinkedIn': '💼', 'Reddit': '🤖', 'Traffic': '🌐', '其他': '➕', '全部': '≡' };
const platformKeywords = {
  'TikTok': ['tiktok', 'tk', '抖音'],
  'Telegram': ['telegram', 'tg', '电报'],
  'Facebook': ['facebook', 'fb', '脸书'],
  'Instagram': ['instagram', 'ig', 'ins', '照片'],
  'Twitter': ['twitter', 'x', '推特'],
  'YouTube': ['youtube', 'yt'],
  'Spotify': ['spotify'],
  'Snapchat': ['snapchat', 'snap'],
  'Google': ['google maps', 'google real', 'google knowledge'],
  'Discord': ['discord'],
  'LinkedIn': ['linkedin'],
  'Reddit': ['reddit'],
  'Line': ['line', '连我'],
  'Shopee': ['shopee', '虾皮'],
  'WhatsApp': ['whatsapp', 'wa'],
  'Traffic': ['traffic', 'website', 'seo', '流量', '网站']
};

const platformGuideLinks = {
    'TikTok': atob('aHR0cHM6Ly93d3cudGlrdG9rLmNvbS9AdXNlcm5hbWU='),
    'Telegram': atob('aHR0cHM6Ly90Lm1lL3VzZXJuYW1l'),
    'Facebook': atob('aHR0cHM6Ly93d3cuZmFjZWJvb2suY29tL3VzZXJuYW1l'),
    'Instagram': atob('aHR0cHM6Ly93d3cuaW5zdGFncmFtLmNvbS91c2VybmFtZQ=='),
    'Twitter': atob('aHR0cHM6Ly90d2l0dGVyLmNvbS91c2VybmFtZQ=='),
    'YouTube': atob('aHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g/dj1YWFhYWFhYWA=='),
    'Snapchat': atob('aHR0cHM6Ly93d3cuc25hcGNoYXQuY29tL2FkZC91c2VybmFtZQ=='),
};

const rawServices = ref([]);
const sysAnnouncement = ref(''); const activePlatform = ref('TikTok');
const activeCategory = ref(''); const activeServiceId = ref('');
const form = ref({ link: '', quantity: 1000, comments: '' });
const isSubmitting = ref(false); const catOpen = ref(false); const srvOpen = ref(false);

const dynamicGuideLink = computed(() => platformGuideLinks[activePlatform.value] || atob('aHR0cHM6Ly93d3cuZXhhbXBsZS5jb20vbGluaw=='));
const rawTotalPrice = computed(() => {
    if (!activeService.value || !form.value.quantity) return '0.00';
    return ((parseInt(form.value.quantity) / 1000) * parseFloat(activeService.value.rate)).toFixed(4);
});

// 排他性正则过滤引擎
const isCustomComments = computed(() => {
    if (!activeService.value) return false;
    const sType = String(activeService.value.type || '').toLowerCase();
    const sName = String(activeService.value.name || '').toLowerCase();

    if (sName.includes('随机') || sType.includes('random') || sName.includes('自动')) {
        return false;
    }
    return sType.includes('custom comments') || 
           sType.includes('custom_comments') || 
           sName.includes('自定义');
});

const parsedLinesCount = computed(() => {
    if (!form.value.comments) return 0;
    return form.value.comments.split('\n').filter(line => line.trim() !== '').length;
});

const updateQuantityFromComments = () => {
    if (!isCustomComments.value) return;
    const count = parsedLinesCount.value;
    form.value.quantity = count === 0 ? (activeService.value?.min || 1) : count;
};

// 💡 核心注入：上游错误码全境中文翻译器
const translateUpstreamError = (errStr) => {
    if (!errStr) return '未知系统错误，请重试';
    const s = String(errStr).toLowerCase();
    
    if (s.includes('min_quantity')) return '下单被拦截：您提交的数量低于该服务的最低要求';
    if (s.includes('max_quantity')) return '下单被拦截：您提交的数量超出了该服务的最高要求';
    if (s.includes('not enough') || s.includes('balance') || s.includes('funds')) return '系统错误：上游通道余额不足，请联系客服处理';
    if (s.includes('incorrect request')) return '请求错误：参数格式不正确或服务已失效';
    if (s.includes('invalid link') || s.includes('invalid_link')) return '链接无效：请检查目标链接的格式是否正确';
    if (s.includes('service not found')) return '服务失效：该服务已被上游移除或下架';
    if (s.includes('comments')) return '评论异常：自定义评论内容不符合上游接口规范';
    if (s.includes('duplicate')) return '重复下单：相同的链接请等待上一单完成后再提交';
    
    // 如果没有命中上述规则，返回原文
    return errStr; 
};

const fetchInitData = async () => {
  try {
    const confRes = await fetch('/api/public/config');
    const confData = await confRes.json();
    if(confData.status === 'success' && confData.data.announcement) sysAnnouncement.value = confData.data.announcement;
  } catch(e) {}
  
  try {
    const res = await fetch('/api/services', { headers: { 'Authorization': `Bearer ${userStore.token}` } });
    const data = await res.json();
    if (data.status === 'success' && Array.isArray(data.data)) {
      rawServices.value = data.data; 
    }
  } catch (error) {} finally { selectPlatform('TikTok'); }
};

const availableCategories = computed(() => {
  if (activePlatform.value === '全部') return [...new Set(rawServices.value.map(s => s.category))];
  
  let cats = new Set();
  rawServices.value.forEach(s => {
    const catStr = String(s.category).toLowerCase();
    let matched = false;
    for (const [plat, keywords] of Object.entries(platformKeywords)) {
      if (keywords.some(kw => catStr.includes(kw))) {
        matched = true;
        if (plat === activePlatform.value) cats.add(s.category);
        break;
      }
    }
    if (!matched && activePlatform.value === '其他') {
      cats.add(s.category);
    }
  });
  return [...cats];
});

const availableServices = computed(() => rawServices.value.filter(s => s.category === activeCategory.value));
const activeService = computed(() => availableServices.value.find(s => String(s.service) === String(activeServiceId.value)) || null);

const selectPlatform = (platform) => { 
  activePlatform.value = platform; 
  if (availableCategories.value.length > 0) { 
    selectCategory(availableCategories.value[0]);
  } else { 
    activeCategory.value = ''; activeServiceId.value = ''; 
  } 
};

const selectCategory = (cat) => { 
  activeCategory.value = cat;
  catOpen.value = false; 
  if (availableServices.value.length > 0) { 
    selectService(availableServices.value[0].service); 
  } else { 
    activeServiceId.value = ''; 
  } 
};

const selectService = (id) => { 
    activeServiceId.value = String(id); 
    srvOpen.value = false; 
    
    if (isCustomComments.value) {
        updateQuantityFromComments();
    } else {
        form.value.quantity = activeService.value?.min || 1000;
        form.value.comments = '';
    }
};

const submitOrder = async () => {
  if(!form.value.link) return uiStore.showToast('请输入目标链接！', 'error');
  if(!activeServiceId.value) return uiStore.showToast('请选择服务！', 'error');
  
  const currentQty = Number(form.value.quantity);
  const minQty = Number(activeService.value?.min || 1);
  const maxQty = Number(activeService.value?.max || 10000000);

  if(isCustomComments.value && parsedLinesCount.value === 0) {
      return uiStore.showToast('自定义服务必须输入评论内容！', 'error');
  }

  // 💡 强力前端防呆：提交前严格拦截数量边界，节省无效网络请求
  if (currentQty < minQty) {
      return uiStore.showToast(`拦截：当前数量 ${currentQty} 低于服务要求最低限制 ${minQty}`, 'error');
  }
  if (currentQty > maxQty) {
      return uiStore.showToast(`拦截：当前数量 ${currentQty} 超出服务最高限制 ${maxQty}`, 'error');
  }

  const confirm = await uiStore.showConfirm(`确认消费 ${appStore.formatMoney(rawTotalPrice.value)} 提交该订单吗？`);
  if (!confirm) return;
  
  isSubmitting.value = true;
  try {
      // 💡 冗余双轨载荷：同时发送 comments 和 custom_comments
      const payload = { 
          serviceId: activeServiceId.value, 
          serviceName: activeService.value.name, 
          link: form.value.link, 
          quantity: currentQty,
          comments: isCustomComments.value ? form.value.comments : undefined,
          custom_comments: isCustomComments.value ? form.value.comments : undefined
      };
      
      const res = await fetch('/api/orders/add', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` }, 
          body: JSON.stringify(payload) 
      });
      const data = await res.json();
      
      // 这里的 status 由后端控制，如果 res.ok 且 status 为 success 则代表真实成功
      if (res.ok && data.status === 'success') {
          uiStore.showToast(data.message || '订单提交成功', 'success');
          form.value.link = '';
          form.value.comments = '';
          if (isCustomComments.value) updateQuantityFromComments();
          
          const uRes = await fetch('/api/user/status', {headers: { 'Authorization': `Bearer ${userStore.token}` }});
          const uData = await uRes.json();
          if(uData.status === 'success') { userStore.userInfo.balance = uData.balance; }
      } else { 
          // 💡 接管并翻译错误提示
          const friendlyError = translateUpstreamError(data.message || '下单失败，上游通道异常');
          uiStore.showToast(friendlyError, 'error');
      }
  } catch(e) { uiStore.showToast('提交失败，网络传输中断', 'error'); }
  isSubmitting.value = false;
};

onMounted(() => fetchInitData());
</script>

<style>
.custom-scrollbar::-webkit-scrollbar { width: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.3); border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59, 130, 246, 0.6); }

.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.fade-slide-enter-from, .fade-slide-leave-to { opacity: 0; transform: translateY(-10px) scale(0.98); }
</style>
