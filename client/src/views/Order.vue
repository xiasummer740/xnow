<template>
  <div class="max-w-5xl mx-auto space-y-4 md:space-y-6 pb-20 relative">
    
    <!-- 📢 公告为空时整块不显示：只留一个「系统公告」标题的空框，客户会以为站还没做完 -->
    <div v-if="sysAnnouncement && String(sysAnnouncement).trim()" class="site-card bg-slate-800/80 p-4 md:p-5 rounded-2xl border border-slate-700 flex items-start space-x-3 md:space-x-4 shadow-xl">
      <div class="text-pink-500 mt-1 text-xl md:text-2xl">📢</div>
      <div class="w-full overflow-hidden">
        <h3 class="font-bold text-white mb-1 text-sm md:text-base">{{ appStore.t('sys_notice') }}</h3>
        <!-- 🔒 公告已后端白名单净化后入库，此处 v-html 渲染富文本排版（脚本/事件已在服务端剥离） -->
        <div class="announcement-body text-slate-300 text-xs md:text-sm leading-relaxed" v-html="sysAnnouncement"></div>
      </div>
    </div>
    
    <div class="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
      <div v-for="p in platformList" :key="p.name" @click="selectPlatform(p.name)"
           :class="['p-2 md:p-4 rounded-xl md:rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 transform', activePlatform === p.name ? 'bg-amber-400 text-slate-900 shadow-[0_5px_15px_rgba(251,191,36,0.4)] scale-105 font-black' : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white hover:-translate-y-1']">
        <div class="h-9 w-9 md:h-11 md:w-11 mb-1 md:mb-2 flex items-center justify-center">
          <svg v-if="p.brand && BRANDS[p.brand]" viewBox="0 0 24 24" :style="{ fill: BRANDS[p.brand].color }" class="w-full h-full drop-shadow-md" v-html="BRANDS[p.brand].svg"></svg>
          <span v-else class="text-3xl md:text-4xl filter drop-shadow-md">{{ p.icon }}</span>
        </div>
        <div class="text-[10px] md:text-xs leading-tight w-full text-center font-medium whitespace-normal break-words px-1">{{ p.name }}</div>
      </div>
    </div>

    <div class="site-card bg-slate-800/80 p-5 md:p-10 rounded-2xl md:rounded-3xl border border-slate-700 shadow-2xl space-y-6 md:space-y-8 relative">
      <div class="space-y-5 md:space-y-6">
        
        <!-- 🔍 全局搜索：按服务 ID / 名称 直接定位（对齐源头站的体验，2855 个服务不用翻下拉） -->
        <div class="relative">
          <label class="block text-xs md:text-sm font-bold text-slate-300 mb-2 md:mb-3">
            🔍 搜索服务
            <span class="text-[10px] text-slate-500 ml-2 font-normal">输入服务 ID 或名称关键词，{{ appStore.isSubsite ? '全部服务里筛选' : '全平台筛选' }}</span>
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
            <div class="font-bold text-xs md:text-sm whitespace-normal break-words flex-grow leading-snug">
              <!-- 74 期：服务名常常是「ID:30094 | 🔥🎉【千粉2-3小时完成】TikTok 真人粉 | 高质量真实用户 | …」
                   这么一长串，手机上能把整张卡撑成 5 行。手机只显示提炼后的短名，电脑端照旧显示全称。 -->
              <span class="md:hidden line-clamp-2">{{ shortServiceName(activeService.name) }}</span>
              <span class="hidden md:inline">{{ activeService.name }}</span>
            </div>
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

        <button @click="submitOrder" :disabled="isSubmitting || !activeServiceId" class="site-btn w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-black text-lg md:text-xl py-4 md:py-5 rounded-xl md:rounded-2xl transition-all transform hover:-translate-y-1 shadow-[0_5px_15px_rgba(251,191,36,0.3)] disabled:opacity-50 disabled:hover:translate-y-0">
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

// 🧩 平台按钮不再手写死列表 —— 由"实际有服务的分类"推导（见下方 platformList）。
//    手写死列表的教训（2026-10-24 祥哥发现）：platformKeywords 支持 Line/Shopee/WhatsApp，
//    但按钮里没有它们 → 这些平台下的服务除「全部」外根本进不去；同时上游没有的平台本站却显示。
//    这里的 PLATFORM_META 只负责「图标 + 展示顺序」，是否显示由数据决定。
const PLATFORM_META = [
  { name: '全部',     icon: '☰' },
  { name: 'TikTok',   icon: '🎵', brand: 'TikTok' },
  { name: 'Telegram', icon: '✈️', brand: 'Telegram' },
  { name: 'Facebook', icon: '📘', brand: 'Facebook' },
  { name: 'Instagram',icon: '📸', brand: 'Instagram' },
  { name: 'Twitter',  icon: '🐦', brand: 'Twitter' },
  { name: 'Line',     icon: '💬', brand: 'Line' },
  { name: 'Shopee',   icon: '🛍️', brand: 'Shopee' },
  { name: 'WhatsApp', icon: '💚', brand: 'WhatsApp' },
  { name: 'Traffic',  icon: '🌐' }
];

// 🎨 平台品牌图标（simple-icons 官方矢量路径，内联 SVG，无外链 —— 国内不会加载失败）
//    用各品牌主色填充；非品牌平台（全部/其他/Traffic）继续用字符图标
const BRANDS = {
  'TikTok': { color: '#25F4EE', svg: `<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>` },
  'Telegram': { color: '#26A5E4', svg: `<path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>` },
  'Facebook': { color: '#1877F2', svg: `<path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/>` },
  'Instagram': { color: '#E4405F', svg: `<path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/>` },
  'Twitter': { color: '#1DA1F2', svg: `<path d="M21.543 7.104c.015.211.015.423.015.636 0 6.507-4.954 14.01-14.01 14.01v-.003A13.94 13.94 0 0 1 0 19.539a9.88 9.88 0 0 0 7.287-2.041 4.93 4.93 0 0 1-4.6-3.42 4.916 4.916 0 0 0 2.223-.084A4.926 4.926 0 0 1 .96 9.167v-.062a4.887 4.887 0 0 0 2.235.616A4.928 4.928 0 0 1 1.67 3.148 13.98 13.98 0 0 0 11.82 8.292a4.929 4.929 0 0 1 8.39-4.49 9.868 9.868 0 0 0 3.128-1.196 4.941 4.941 0 0 1-2.165 2.724A9.828 9.828 0 0 0 24 4.555a10.019 10.019 0 0 1-2.457 2.549z"/>` },
  'Line': { color: '#00C300', svg: `<path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>` },
  'Shopee': { color: '#EE4D2D', svg: `<path d="M15.9414 17.9633c.229-1.879-.981-3.077-4.1758-4.0969-1.548-.528-2.277-1.22-2.26-2.1719.065-1.056 1.048-1.825 2.352-1.85a5.2898 5.2898 0 0 1 2.8838.89c.116.072.197.06.263-.039.09-.145.315-.494.39-.62.051-.081.061-.187-.068-.281-.185-.1369-.704-.4149-.983-.5319a6.4697 6.4697 0 0 0-2.5118-.514c-1.909.008-3.4129 1.215-3.5389 2.826-.082 1.1629.494 2.1078 1.73 2.8278.262.152 1.6799.716 2.2438.892 1.774.552 2.695 1.5419 2.478 2.6969-.197 1.047-1.299 1.7239-2.818 1.7439-1.2039-.046-2.2878-.537-3.1278-1.19l-.141-.11c-.104-.08-.218-.075-.287.03-.05.077-.376.547-.458.67-.077.108-.035.168.045.234.35.293.817.613 1.134.775a6.7097 6.7097 0 0 0 2.8289.727 4.9048 4.9048 0 0 0 2.0759-.354c1.095-.465 1.8029-1.394 1.9449-2.554zM11.9986 1.4009c-2.068 0-3.7539 1.95-3.8329 4.3899h7.6657c-.08-2.44-1.765-4.3899-3.8328-4.3899zm7.8516 22.5981-.08.001-15.7843-.002c-1.074-.04-1.863-.91-1.971-1.991l-.01-.195L1.298 6.2858a.459.459 0 0 1 .45-.494h4.9748C6.8448 2.568 9.1607 0 11.9996 0c2.8388 0 5.1537 2.5689 5.2757 5.7898h4.9678a.459.459 0 0 1 .458.483l-.773 15.5883-.007.131c-.094 1.094-.979 1.9769-2.0709 2.0059z"/>` },
  'WhatsApp': { color: '#25D366', svg: `<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>` },
};

// 🧩 显示哪些平台由后台配置 display_platforms 决定（逗号分隔）。
//    白名单外的平台（YouTube/Spotify/…）统一收进「其他」——
//    新增平台时只改后台那行字，不用改代码、不用重新部署。
const platformAllow = ref('TikTok,Telegram,Facebook,Instagram,Twitter,Line,Shopee,WhatsApp,Traffic');
const platformAllowList = computed(() =>
  String(platformAllow.value || '').split(/[,，\s]+/).map(s => s.trim()).filter(Boolean)
);
// 某个分类归属于哪个平台（null = 归不进去，落到「其他」）
const platformOf = (cat) => {
  const lc = String(cat || '').toLowerCase();
  for (const [p, kws] of Object.entries(platformKeywords)) {
    if (kws.some(kw => lc.includes(kw))) return p;
  }
  return null;
};
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

// 🧩 只显示"白名单内 + 确实有服务"的平台；「全部」永远第一，「其他」永远最后
const platformList = computed(() => {
    const allow = platformAllowList.value;
    const has = new Set();
    let hasOther = false;
    for (const cat of new Set(rawServices.value.map(s => s.category))) {
        const p = platformOf(cat);
        if (p && allow.includes(p)) has.add(p);
        else hasOther = true;   // 白名单外的平台 + 归不进去的分类 → 都归「其他」
    }
    const out = PLATFORM_META.filter(m => m.name === '全部' || has.has(m.name));
    if (hasOther) out.push({ name: '其他', icon: '➕' });
    return out;
});

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
// 服务名太长时给手机端提炼一句人话：去掉开头的 ID、去掉表情、只留第一段
const shortServiceName = (n) => {
  let t = String(n || '');
  t = t.replace(/^\s*ID\s*[:：]?\s*\d+\s*[|｜]\s*/i, '');
  t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
  t = t.split(/[|｜]/)[0].trim();
  return t.length > 22 ? t.slice(0, 22) + '…' : t;
};

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
    // 🧩 平台白名单（后台可改，改完刷新即生效，不用重新部署）
    if(confData.status === 'success' && confData.data.display_platforms) platformAllow.value = confData.data.display_platforms;
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
  const allow = platformAllowList.value;
  const cats = new Set();
  for (const s of rawServices.value) {
    if (activePlatform.value === '全部') { cats.add(s.category); continue; }
    const p = platformOf(s.category);
    if (activePlatform.value === '其他') {
      // 白名单外的平台 + 归不进去的分类，全部收进「其他」
      if (!p || !allow.includes(p)) cats.add(s.category);
    } else if (p === activePlatform.value) {
      cats.add(s.category);
    }
  }
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
