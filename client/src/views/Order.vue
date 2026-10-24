<template>
  <div class="max-w-5xl mx-auto space-y-4 md:space-y-6 pb-20 relative">
    
    <div class="bg-slate-800/80 p-4 md:p-5 rounded-2xl border border-slate-700 flex items-start space-x-3 md:space-x-4 shadow-xl">
      <div class="text-pink-500 mt-1 text-xl md:text-2xl">📢</div>
      <div class="w-full overflow-hidden">
        <h3 class="font-bold text-white mb-1 text-sm md:text-base">{{ appStore.t('sys_notice') }}</h3>
        <!-- 🔒 公告已后端白名单净化后入库，此处 v-html 渲染富文本排版（脚本/事件已在服务端剥离） -->
        <div class="announcement-body text-slate-300 text-xs md:text-sm leading-relaxed" v-html="sysAnnouncement"></div>
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
        
        <!-- 🔍 全局搜索：按服务 ID / 名称 直接定位（对齐源头站的体验，2855 个服务不用翻下拉） -->
        <div class="relative">
          <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">
            🔍 搜索服务
            <span class="text-[10px] text-slate-500 ml-2 font-normal">输入服务 ID 或名称关键词，全平台筛选</span>
          </label>
          <input type="text" v-model="searchQuery" @focus="searchOpen = true"
            @keydown.enter="searchResults.length && selectSearchResult(searchResults[0])"
            placeholder="例如 30190 或 自动播放"
            class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none focus:border-amber-400 transition text-base md:text-lg">
          <div v-if="searchOpen" @click="searchOpen = false" class="fixed inset-0 z-40"></div>
          <div v-if="searchOpen && String(searchQuery).trim()" class="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div v-if="searchResults.length === 0" class="px-4 py-3 text-xs text-slate-500">没有匹配的服务，换个关键词试试</div>
            <div v-for="srv in searchResults" :key="'q-' + srv.service" @click="selectSearchResult(srv)"
              class="px-3 py-2 md:py-2.5 border-b border-slate-700/50 hover:bg-slate-700 cursor-pointer transition">
              <div class="text-[11px] md:text-xs text-slate-300 leading-snug break-words">
                <span class="text-amber-400 font-mono">ID:{{ srv.service }}</span> | {{ srv.name }} | {{ appStore.formatMoney(srv.rate) }}
              </div>
            </div>
          </div>
        </div>

        <div class="relative">
          <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">{{ appStore.t('category') }}</label>
          <div @click="catOpen = !catOpen; srvOpen = false" class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white cursor-pointer flex justify-between items-center hover:border-amber-400 transition min-h-[46px]">
            <span class="text-xs md:text-base whitespace-normal break-words pr-2 line-clamp-2">{{ servicesError ? '⚠️ 服务加载失败' : (activeCategory || '此平台下暂无可用分类') }}</span>
            <svg class="w-5 h-5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
          <div v-if="catOpen" @click="catOpen = false" class="fixed inset-0 z-40"></div>
          <div v-if="catOpen && availableCategories.length > 0" class="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] max-h-72 overflow-y-auto custom-scrollbar">
            <div v-for="cat in availableCategories" :key="cat" @click="selectCategory(cat)" class="px-4 py-2.5 border-b border-slate-700/50 hover:bg-slate-700 cursor-pointer text-xs md:text-sm text-slate-300 transition">{{ cat }}</div>
          </div>
        </div>

        <!-- 服务加载失败/登录失效引导 -->
        <div v-if="servicesError" class="flex items-center justify-between gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2 text-xs md:text-sm text-red-300">
          <span>⚠️ {{ servicesErrorText }}</span>
          <button @click="fetchInitData" class="shrink-0 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold px-3 py-1.5 rounded-md text-xs md:text-sm transition">重新加载</button>
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
              <p>✔️ {{ needsUsername ? (appStore.lang === 'zh' ? '示例用户名' : 'Example Username') : (appStore.lang === 'zh' ? '示例链接' : 'Example Link') }} : <span class="text-white bg-blue-900/50 px-1.5 py-0.5 rounded">{{ needsUsername ? '@tiktokuser' : dynamicGuideLink }}</span></p>
              <div class="h-px bg-blue-500/30 my-2 w-full"></div>
              
              <div v-if="activeService && activeService.description" class="text-slate-300 font-sans whitespace-pre-wrap leading-tight">{{ activeService.description }}</div>
              <div v-else class="space-y-1">
                <p class="text-red-300">{{ appStore.t('guide_1') }}</p>
                <p class="text-red-300">{{ appStore.t('guide_2') }}</p>
                <p class="text-slate-500 text-[10px] mt-1.5 font-sans italic">* 该服务暂无特殊说明，请遵循基础规范下单。</p>
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
          <!-- 🔌 按上游类型动态渲染。Subscriptions / Invites 上游不收链接，要的是用户名 -->
          <div v-if="usesLink">
            <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">{{ appStore.t('link') }}</label>
            <input type="text" v-model="form.link" placeholder="..." class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none focus:border-amber-400 transition text-base md:text-lg">
          </div>

          <div v-if="needsUsername">
            <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">
              用户名 <span class="text-red-400">*</span>
              <span class="text-[10px] text-slate-500 ml-2 font-normal">只需要用户名，不要带 @ 或整条链接</span>
            </label>
            <input type="text" v-model="form.username" placeholder="例如 tiktokuser" class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none focus:border-amber-400 transition text-base md:text-lg">
          </div>

          <div v-if="isMentions">
            <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">话题标签 <span class="text-red-400">*</span></label>
            <input type="text" v-model="form.hashtag" placeholder="例如 fyp 或 #fyp" class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none focus:border-amber-400 transition text-base md:text-lg">
          </div>

          <div v-if="isPoll">
            <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">选项编号 <span class="text-red-400">*</span></label>
            <input type="number" v-model="form.answerNumber" placeholder="投票选项的序号，例如 1" class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none focus:border-amber-400 transition text-base md:text-lg">
          </div>

          <div v-if="isPackage" class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">执行次数 runs <span class="text-slate-500 font-normal">（可选）</span></label>
              <input type="number" v-model="form.runs" placeholder="留空 = 1 次" class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none focus:border-amber-400 transition text-base md:text-lg">
            </div>
            <div>
              <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">间隔分钟 interval <span class="text-slate-500 font-normal">（可选）</span></label>
              <input type="number" v-model="form.interval" placeholder="留空 = 0" class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none focus:border-amber-400 transition text-base md:text-lg">
            </div>
          </div>

          <div v-if="isSubscriptions" class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">延迟</label>
              <select v-model="form.delay" class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none focus:border-amber-400 transition text-base md:text-lg">
                <option v-for="d in delayOptions" :key="d" :value="d">{{ d === 0 ? '无延迟' : d + ' 分钟' }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">
                新帖子数量 <span class="text-red-400">*</span>
                <span class="text-[10px] text-slate-500 ml-2 font-normal">每条新帖自动投喂一次，按次数收费</span>
              </label>
              <input type="number" min="1" v-model="form.posts" placeholder="例如 3（= 未来 3 条新帖各投喂一次）" class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none focus:border-amber-400 transition text-base md:text-lg">
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">到期日期 expiry <span class="text-slate-500 font-normal">（可选，格式 日/月/年）</span></label>
              <input type="text" v-model="form.expiry" placeholder="例如 31/12/2026；留空 = 不过期" class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none focus:border-amber-400 transition text-base md:text-lg">
            </div>
          </div>

          <div class="flex flex-col md:flex-row space-y-5 md:space-y-0 md:space-x-8">
            <div class="flex-1">
              <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">
                {{ appStore.t('quantity') }}
                <span v-if="activeService" class="text-[10px] md:text-xs text-amber-500 ml-1 font-normal">({{ activeService.min }} ~ {{ activeService.max }})</span>
                <span v-if="isCustomComments" class="text-[10px] ml-2 px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-normal">受评论行数锁定</span>
                <span v-if="isSubscriptions" class="text-[10px] ml-2 px-1.5 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded font-normal">每帖数量（最少 = 最多）</span>
                <span v-if="isInvites" class="text-[10px] ml-2 px-1.5 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded font-normal">仅用于本站计费</span>
              </label>
              <input type="number" v-model="form.quantity" :readonly="isCustomComments" :class="['w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white outline-none transition text-lg md:text-xl font-mono', isCustomComments ? 'opacity-50 cursor-not-allowed border-slate-700' : 'focus:border-amber-400']">
            </div>
            <div class="w-full md:w-64">
              <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3 md:text-right">{{ appStore.t('total_price') }}</label>
              <div class="w-full bg-slate-900/80 border border-slate-600 rounded-lg md:rounded-xl p-3 md:p-4 text-amber-400 md:text-right font-black text-xl md:text-2xl shadow-inner">
                {{ appStore.formatMoney(rawTotalPrice) }}
              </div>
              <p v-if="isSubscriptions" class="text-[10px] text-slate-500 mt-1.5 md:text-right">
                × {{ billUnits }} 次投喂（每条新帖一次）
              </p>
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

const platforms = { 'TikTok': '🎵', '电报': '✈️', 'Facebook': '📘', 'Instagram': '📸', 'Twitter': '🐦', 'YouTube': '▶️', 'Spotify': '🎧', 'Snapchat': '👻', 'Google': '🔍', 'Discord': '🎮', 'LinkedIn': '💼', 'Reddit': '🤖', 'Traffic': '🌐', '其他': '➕', '全部': '≡' };
const platformKeywords = {
  'TikTok': ['tiktok', 'tk', '抖音'],
  '电报': ['telegram', 'tg', '电报'],
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
    '电报': atob('aHR0cHM6Ly90Lm1lL3VzZXJuYW1l'),
    'Facebook': atob('aHR0cHM6Ly93d3cuZmFjZWJvb2suY29tL3VzZXJuYW1l'),
    'Instagram': atob('aHR0cHM6Ly93d3cuaW5zdGFncmFtLmNvbS91c2VybmFtZQ=='),
    'Twitter': atob('aHR0cHM6Ly90d2l0dGVyLmNvbS91c2VybmFtZQ=='),
    'YouTube': atob('aHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g/dj1YWFhYWFhYWA=='),
    'Snapchat': atob('aHR0cHM6Ly93d3cuc25hcGNoYXQuY29tL2FkZC91c2VybmFtZQ=='),
};

const rawServices = ref([]);
// 服务加载状态：'' 正常 | expired 登录失效 | failed 加载失败 | network 网络异常
const servicesError = ref('');
const servicesErrorText = computed(() => {
  if (servicesError.value === 'expired') return '登录状态已失效，服务无法加载，请重新登录';
  if (servicesError.value === 'network') return '网络异常，服务加载失败，请点击重试';
  return '服务加载失败，请点击重试或刷新页面';
});
const sysAnnouncement = ref(''); const activePlatform = ref('TikTok');
const activeCategory = ref(''); const activeServiceId = ref('');
const form = ref({
  link: '', quantity: 1000, comments: '',
  // 🔌 2026-10-24 特殊类型字段（Subscriptions / Package / Mentions / Invites / Poll）
  username: '', hashtag: '', answerNumber: '', runs: '', interval: '',
  posts: '', expiry: '', delay: 0
});
const isSubmitting = ref(false); const catOpen = ref(false); const srvOpen = ref(false);

// 上游文档里 delay 只允许这几档
const delayOptions = [0, 5, 10, 15, 20, 30, 40, 50, 60, 90, 120, 150, 180, 210, 240, 270, 300, 360, 420, 480, 540, 600];

// 🔌 上游类型判定（DB 里是大写开头，如 Default / Custom Comments / Subscriptions）
const sType = computed(() => String(activeService.value?.type || '').toLowerCase());
const isSubscriptions = computed(() => sType.value.includes('subscriptions'));
const isPackage = computed(() => sType.value.includes('package'));
const isMentions = computed(() => sType.value.includes('mentions'));
const isInvites = computed(() => sType.value.includes('invites'));
const isPoll = computed(() => sType.value.includes('poll'));
const needsUsername = computed(() => isSubscriptions.value || isInvites.value);
// Subscriptions / Invites 上游不收 link
const usesLink = computed(() => !isSubscriptions.value && !isInvites.value);

const dynamicGuideLink = computed(() => platformGuideLinks[activePlatform.value] || atob('aHR0cHM6Ly93d3cuZXhhbXBsZS5jb20vbGluaw=='));
// 🔑 订阅型按"投喂次数"计价（方案 A）：上游为每条新帖投喂一次、每次都扣上游余额
const billUnits = computed(() => {
    if (!isSubscriptions.value) return 1;
    const p = parseInt(form.value.posts);
    return (Number.isInteger(p) && p > 0) ? p : 0;
});
const rawTotalPrice = computed(() => {
    if (!activeService.value || !form.value.quantity) return '0.00';
    if (billUnits.value === 0) return '0.00';
    return ((parseInt(form.value.quantity) / 1000) * parseFloat(activeService.value.rate) * billUnits.value).toFixed(4);
});

// 排他性正则过滤引擎
const isCustomComments = computed(() => {
    if (!activeService.value) return false;
    // 🔌 特殊类型优先判定：否则名字里带"自定义"的订阅型会同时显示评论框
    if (isSubscriptions.value || isInvites.value || isMentions.value || isPoll.value) return false;
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

// 💡 错误提示翻译器：对客户只说"我们"，绝不出现"上游"（客户眼里 XNOW 就是源头）
const translateUpstreamError = (errStr) => {
    if (!errStr) return '未知系统错误，请重试';
    const s = String(errStr).toLowerCase();
    
    if (s.includes('min_quantity')) return '下单被拦截：您提交的数量低于该服务的最低要求';
    if (s.includes('max_quantity')) return '下单被拦截：您提交的数量超出了该服务的最高要求';
    if (s.includes('not enough') || s.includes('balance') || s.includes('funds')) return '系统繁忙，请稍后重试或联系客服';
    if (s.includes('incorrect request')) return '请求错误：参数格式不正确或服务已失效';
    if (s.includes('invalid link') || s.includes('invalid_link')) return '链接无效：请检查目标链接的格式是否正确';
    if (s.includes('service not found')) return '服务失效：该服务已下架，请选择其他服务';
    if (s.includes('comments')) return '评论异常：自定义评论内容不符合规范';
    if (s.includes('duplicate')) return '重复下单：相同的链接请等待上一单完成后再提交';
    if (s.includes('missing username') || s.includes('username')) return '缺少用户名：该服务需要填社交平台用户名（不要带 @ 或链接）';
    if (s.includes('hashtag')) return '缺少话题标签，请填写后重试';
    if (s.includes('delay')) return '延迟参数不正确，请重新选择';
    if (s.includes('missing answer') || s.includes('answer')) return '缺少选项编号，请填写后重试';
    if (s.includes('expiry')) return '到期日期格式不对（应形如 31/12/2026）';
    
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
    if (res.status === 401) {
      // 登录失效：全局拦截器会登出跳登录，这里先给页面标记，避免误显示"暂无分类"
      servicesError.value = 'expired';
    } else {
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.data)) {
        rawServices.value = data.data;
        servicesError.value = '';
      } else {
        servicesError.value = 'failed';
      }
    }
  } catch (error) {
    servicesError.value = 'network';
  } finally { selectPlatform('TikTok'); }
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
// 🔎 从 rawServices 兜底查找：搜索结果跨平台/跨分类选中时也能立刻找到（否则表单会空）
const activeService = computed(() => rawServices.value.find(s => String(s.service) === String(activeServiceId.value)) || null);

// 🔍 全局搜索：按服务 ID / 名称，全平台（对齐源头站体验）
const searchQuery = ref('');
const searchOpen = ref(false);
const searchResults = computed(() => {
    const q = String(searchQuery.value || '').trim().toLowerCase();
    if (!q) return [];
    const hit = rawServices.value.filter(s =>
        String(s.service).includes(q) || String(s.name || '').toLowerCase().includes(q)
    );
    const rank = (id) => String(id) === q ? 0 : (String(id).startsWith(q) ? 1 : 2);
    hit.sort((a, b) => rank(a.service) - rank(b.service) || Number(a.service) - Number(b.service));
    return hit.slice(0, 40);
});
const selectSearchResult = (srv) => {
    searchQuery.value = `ID:${srv.service} ${srv.name}`;
    searchOpen.value = false;
    // 必须把平台 + 分类一起切到该服务所在处，否则分类下拉对不上
    const catStr = String(srv.category || '').toLowerCase();
    let plat = '其他';
    for (const [p, keywords] of Object.entries(platformKeywords)) {
        if (keywords.some(kw => catStr.includes(kw))) { plat = p; break; }
    }
    activePlatform.value = plat;
    if (availableCategories.value.includes(srv.category)) activeCategory.value = srv.category;
    selectService(srv.service);
};

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

    // 换服务就清空输入：否则上一单的链接/用户名会被带到这一单（历史上真踩过）
    form.value.link = '';
    form.value.username = '';
    form.value.hashtag = '';
    form.value.answerNumber = '';
    form.value.runs = '';
    form.value.interval = '';
    form.value.posts = '';
    form.value.expiry = '';
    form.value.delay = 0;

    if (isCustomComments.value) {
        updateQuantityFromComments();
    } else {
        form.value.quantity = activeService.value?.min || 1000;
        form.value.comments = '';
    }
};

const submitOrder = async () => {
  if(!activeServiceId.value) return uiStore.showToast('请选择服务！', 'error');
  // 🔌 按类型校验必填项（Subscriptions/Invites 没有链接，校验用户名）
  if (usesLink.value && !form.value.link) return uiStore.showToast('请输入目标链接！', 'error');
  if (needsUsername.value && !String(form.value.username).trim()) return uiStore.showToast('请输入用户名（不要带 @ 或链接）！', 'error');
  if (isMentions.value && !String(form.value.hashtag).trim()) return uiStore.showToast('请输入话题标签！', 'error');
  if (isPoll.value && !String(form.value.answerNumber).trim()) return uiStore.showToast('请输入选项编号！', 'error');
  // 🔑 方案 A：订阅型必须填投喂次数，否则成本无上限
  if (isSubscriptions.value) {
      const p = parseInt(form.value.posts);
      if (!Number.isInteger(p) || p <= 0) return uiStore.showToast('请填写新帖子数量（未来要投喂几条新帖）！', 'error');
      if (p > 10000) return uiStore.showToast('新帖子数量过大（最多 10000 条）', 'error');
  }
  
  const currentQty = Number(form.value.quantity);
  const minQty = Number(activeService.value?.min || 1);
  const maxQty = Number(activeService.value?.max || 10000000);

  if(isCustomComments.value && parsedLinesCount.value === 0) {
      return uiStore.showToast('自定义服务必须输入评论内容！', 'error');
  }

  // 💡 强力前端防呆：提交前严格拦截数量边界，节省无效网络请求
  if (!Number.isInteger(currentQty) || currentQty <= 0) {
      return uiStore.showToast('数量必须是正整数', 'error');
  }
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
      // 🔌 按类型组装载荷：只发当前类型需要的字段（服务端还会再校验一次）
      const payload = { 
          serviceId: activeServiceId.value, 
          serviceName: activeService.value.name, 
          link: usesLink.value ? form.value.link : undefined,
          username: needsUsername.value ? String(form.value.username).trim() : undefined,
          quantity: currentQty,
          comments: isCustomComments.value ? form.value.comments : undefined,
          custom_comments: isCustomComments.value ? form.value.comments : undefined,
          hashtag: isMentions.value ? String(form.value.hashtag).trim() : undefined,
          answerNumber: isPoll.value ? form.value.answerNumber : undefined,
          runs: isPackage.value && form.value.runs !== '' ? form.value.runs : undefined,
          interval: isPackage.value && form.value.interval !== '' ? form.value.interval : undefined,
          delay: isSubscriptions.value ? form.value.delay : undefined,
          posts: isSubscriptions.value && form.value.posts !== '' ? form.value.posts : undefined,
          expiry: isSubscriptions.value && form.value.expiry ? String(form.value.expiry).trim() : undefined
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
          form.value.username = '';
          form.value.hashtag = '';
          form.value.answerNumber = '';
          form.value.posts = '';
          form.value.expiry = '';
          form.value.runs = '';
          form.value.interval = '';
          form.value.delay = 0;
          if (isCustomComments.value) updateQuantityFromComments();
          
          const uRes = await fetch('/api/user/status', {headers: { 'Authorization': `Bearer ${userStore.token}` }});
          const uData = await uRes.json();
          if(uData.status === 'success') { userStore.userInfo.balance = uData.balance; }
      } else { 
          // 💡 接管并翻译错误提示
          const friendlyError = translateUpstreamError(data.message || '下单失败，系统繁忙请稍后重试');
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

/* 系统公告富文本排版：内容已由后端白名单净化，v-html 安全。
   内联 font-size 已在服务端剥离 → 字号全部在此一处控制，祥哥要调大调小只改下面字号值即可 */
.announcement-body { line-height: 1.6; word-break: break-word; }
.announcement-body h1, .announcement-body h2, .announcement-body h3,
.announcement-body h4, .announcement-body h5, .announcement-body h6 {
  font-weight: 700; color: #fff; margin: 0.45em 0 0.25em; line-height: 1.45;
}
.announcement-body h1 { font-size: 1.3em; }
.announcement-body h2 { font-size: 1.2em; }
.announcement-body h3 { font-size: 1.12em; }
.announcement-body h4, .announcement-body h5, .announcement-body h6 { font-size: 1.04em; }
.announcement-body p { margin: 0.35em 0; }
.announcement-body ul, .announcement-body ol { margin: 0.35em 0; padding-left: 1.6em; }
.announcement-body li { margin: 0.2em 0; }
.announcement-body a { color: #7dd3fc; text-decoration: underline; }
.announcement-body del, .announcement-body s { text-decoration: line-through; color: #94a3b8; }
.announcement-body blockquote { border-left: 3px solid rgba(255,255,255,0.25); padding-left: 0.8em; margin: 0.4em 0; }
</style>
