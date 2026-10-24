<template>
  <div class="flex flex-col min-h-screen bg-transparent text-white font-sans selection:bg-amber-400 selection:text-slate-900 relative overflow-hidden z-10">
    <header :class="['relative z-20 flex items-center justify-between px-6 py-4 md:px-12 lg:py-6 max-w-7xl mx-auto', appStore.isSubsite ? 'w-full' : '']">
      <div class="flex items-center space-x-3">
        <img v-if="!appStore.isSubsite || (appStore.siteLogo && appStore.siteLogo !== '/logo.png')" :src="appStore.siteLogo || '/logo.png'" onerror="this.onerror=null; this.src='/logo.png';" class="h-10 w-10 md:h-12 md:w-12 object-contain drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" alt="Logo">
        <div v-else class="h-10 w-10 md:h-12 md:w-12 object-contain drop-shadow-[0_0_10px_rgba(251,191,36,0.5)] rounded-xl grid place-items-center font-black text-lg" style="background:rgba(148,163,184,.14);color:#e2e8f0">{{ (appStore.siteName || '·').trim().charAt(0) }}</div>
        <span class="text-2xl md:text-3xl font-black italic tracking-widest site-brand-text">{{ appStore.siteName || 'XNOW' }}</span>
      </div>
      <div class="flex items-center space-x-4 md:space-x-6">
        <button @click="toggleLangRoute" class="text-slate-300 hover:text-white font-bold transition text-sm md:text-base select-none">{{ appStore.lang === 'zh' ? 'EN' : '中' }}</button>
        <router-link v-if="userStore.token" to="/order" class="site-btn bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-900 font-black px-5 py-2 md:px-8 md:py-2.5 rounded-full transition transform hover:scale-105 shadow-[0_0_20px_rgba(251,191,36,0.4)]">{{ appStore.t('console') || '控制台' }}</router-link>
        <router-link v-else to="/login" class="site-btn bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-900 font-black px-5 py-2 md:px-8 md:py-2.5 rounded-full transition transform hover:scale-105 shadow-[0_0_20px_rgba(251,191,36,0.4)]">{{ appStore.lang === 'zh' ? '登录 / 注册' : 'Login / Register' }}</router-link>
      </div>
    </header>

    <!-- 🎭 分站首屏：按模板走四套不同版式（主站仍用下面原来那段，一行没改） -->
    <SubsiteHero v-if="appStore.isSubsite" :style="heroBgStyle" :variant="appStore.heroVariant || layout.hero" :hero="hero"
      :platforms="platforms" :services="previewServices" :lang="appStore.lang" :site-name="appStore.siteName" />

    <main v-else :style="heroBgStyle" class="hero-wrap site-section relative z-20 flex flex-col items-center justify-center text-center px-4 pt-16 md:pt-24 lg:pt-32 max-w-5xl mx-auto">
      <div class="hero-copy flex flex-col items-center">
      <div class="inline-block mb-6 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs md:text-sm font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(251,191,36,0.2)] backdrop-blur-md">{{ hero.badge }}</div>
      <h1 v-if="hero.title" class="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight mb-6 drop-shadow-2xl">
        <span class="site-brand-text text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-500 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]">{{ hero.title }}</span>
      </h1>
      <h1 v-else class="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight mb-6 drop-shadow-2xl">
        {{ appStore.lang === 'zh' ? '让你的社交媒体' : 'Make Your' }}<br/>
        <span class="site-brand-text text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-500 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]">{{ appStore.lang === 'zh' ? '🔥 火速出圈' : 'Social Media Explode' }}</span>
      </h1>
      <p class="text-slate-300 text-base md:text-lg max-w-2xl mx-auto mb-4 leading-relaxed">
        {{ hero.subtitle }}
      </p>
      <p class="text-slate-500 text-sm max-w-lg mx-auto mb-10 leading-relaxed">
        {{ hero.desc }}
      </p>
      </div>

      <!-- 左文右图布局的右侧视觉块（其它布局下不显示） -->
      <div class="hero-visual hidden" aria-hidden="true">
        <div class="site-card rounded-3xl p-6 bg-slate-900/60 border border-slate-700/40">
          <div class="text-xs text-slate-400 mb-3">{{ appStore.lang === 'zh' ? '实时交付' : 'Live delivery' }}</div>
          <div class="h-2 rounded-full bg-amber-400/80 mb-3 w-4/5"></div>
          <div class="h-2 rounded-full bg-slate-700 mb-3 w-3/5"></div>
          <div class="h-2 rounded-full bg-slate-700 mb-6 w-2/5"></div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div><div class="text-lg font-black text-amber-400">24/7</div><div class="text-[10px] text-slate-500">在线</div></div>
            <div><div class="text-lg font-black text-amber-400">0.3s</div><div class="text-[10px] text-slate-500">起送</div></div>
            <div><div class="text-lg font-black text-amber-400">99%</div><div class="text-[10px] text-slate-500">完成率</div></div>
          </div>
        </div>
      </div>

      <!-- Platform quick preview -->
      <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3 mb-10 max-w-2xl">
        <div v-for="p in platforms" :key="p.name" class="site-card flex flex-col items-center gap-1.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-3 hover:border-amber-500/30 transition cursor-default">
          <span class="text-2xl">{{ p.icon }}</span>
          <span class="text-[11px] text-slate-400 font-bold">{{ p.name[appStore.lang] || p.name }}</span>
        </div>
      </div>

      <div class="hero-actions flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
        <router-link v-if="hero.btn1Url" :to="hero.btn1Url" class="w-full sm:w-auto site-btn px-10 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-lg transition transform hover:-translate-y-1 shadow-[0_10px_30px_rgba(251,191,36,0.3)] flex items-center justify-center">
          {{ hero.btn1Text }}
        </router-link>
        <router-link v-else to="/login" class="w-full sm:w-auto site-btn px-10 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-lg transition transform hover:-translate-y-1 shadow-[0_10px_30px_rgba(251,191,36,0.3)] flex items-center justify-center">
          {{ appStore.lang === 'zh' ? '⚡ 立即注册体验' : '⚡ Get Started Now' }}
        </router-link>
        <router-link v-if="hero.btn2Url" :to="hero.btn2Url" class="w-full sm:w-auto site-btn px-8 py-4 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-400 font-bold text-base transition flex items-center justify-center">
          {{ hero.btn2Text }}
        </router-link>
        <router-link v-else to="/vpn" class="w-full sm:w-auto site-btn px-8 py-4 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-400 font-bold text-base transition flex items-center justify-center">
          {{ appStore.lang === 'zh' ? '🛡️ 安全节点' : '🛡️ VPN' }}
        </router-link>
      </div>
    </main>

    <!-- 🏬 分站首页模块（公告 / 统计 / 热门服务 / FAQ / VIP / 返佣）
         只在分站渲染，主站 homeModules 为空 → 这块完全不出现 -->
    <SiteModules />

    <!-- Use cases -->
    <section v-if="appStore.moduleEnabled('audience')" :style="{ order: appStore.moduleOrder('audience') }" class="site-section relative z-20 max-w-5xl mx-auto px-6 py-16">
      <h2 class="text-center text-2xl font-black text-white mb-10 tracking-wider">{{ appStore.sectionTitle('audience') || (appStore.lang === 'zh' ? '🎯 谁在用 ' + (appStore.siteName || '我们') : '🎯 Who It’s For') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <router-link :to="appStore.isSubsite ? '/order' : '/vpn'" class="site-card bg-slate-800/40 border border-slate-700/50 rounded-3xl p-6 hover:border-emerald-500/40 transition group block">
          <div class="text-3xl mb-3">🎬</div>
          <h3 class="text-white font-black mb-1">{{ appStore.lang==='zh'?'TikTok创作者':'TikTok Creators' }}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">{{ appStore.lang==='zh'?'0播放、限流、Shadow Ban？独享原生IP，让算法认为你是本地用户。' : 'Zero views? Shadow ban? Dedicated residential IPs make the algorithm see you as local.' }}</p>
        </router-link>
        <router-link :to="appStore.isSubsite ? '/order' : '/vpn'" class="site-card bg-slate-800/40 border border-slate-700/50 rounded-3xl p-6 hover:border-emerald-500/40 transition group block">
          <div class="text-3xl mb-3">📺</div>
          <h3 class="text-white font-black mb-1">{{ appStore.lang==='zh'?'直播带货':'Live Streamers' }}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">{{ appStore.lang==='zh'?'直播卡顿掉帧丢单？CN2 GIA/CMIN2优化线路，跨国直播稳60帧。' : 'Laggy streams losing sales? Premium routes for stable 60fps cross-border streaming.' }}</p>
        </router-link>
        <router-link :to="appStore.isSubsite ? '/order' : '/vpn'" class="site-card bg-slate-800/40 border border-slate-700/50 rounded-3xl p-6 hover:border-emerald-500/40 transition group block">
          <div class="text-3xl mb-3">👥</div>
          <h3 class="text-white font-black mb-1">{{ appStore.lang==='zh'?'矩阵运营':'Multi-Account' }}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">{{ appStore.lang==='zh'?'多号同IP=批量送死。每号独立IP，矩阵稳如磐石。' : 'Same IP for multiple accounts = mass ban. Dedicated IP per account.' }}</p>
        </router-link>
      </div>
    </section>

    <!-- How it works -->
    <section v-if="appStore.moduleEnabled('steps')" :style="{ order: appStore.moduleOrder('steps') }" class="site-section relative z-20 max-w-4xl mx-auto px-6 py-8">
      <h2 class="text-center text-2xl font-black text-white mb-10 tracking-wider">{{ appStore.sectionTitle('steps') || (appStore.lang === 'zh' ? '📋 三步开始' : '📋 How It Works') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="site-card bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 text-center hover:border-amber-500/30 transition group">
          <div class="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-5 group-hover:scale-110 transition">1</div>
          <h3 class="text-white font-black text-lg mb-2">{{ appStore.lang === 'zh' ? '注册账号' : 'Sign Up' }}</h3>
          <p class="text-slate-500 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? '手机号注册，无需实名，30秒完成。注册即享会员价。' : 'Sign up with phone number in 30 seconds. Instant access to wholesale pricing.' }}</p>
        </div>
        <div class="site-card bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 text-center hover:border-amber-500/30 transition group">
          <div class="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-5 group-hover:scale-110 transition">2</div>
          <h3 class="text-white font-black text-lg mb-2">{{ appStore.lang === 'zh' ? '充值下单' : 'Top Up & Order' }}</h3>
          <p class="text-slate-500 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? '微信/支付宝/USDT 充值，选服务填链接，一键提交。系统全自动处理。' : 'Top up via WeChat/Alipay/USDT. Pick a service, paste your link, submit. Fully automated.' }}</p>
        </div>
        <div class="site-card bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 text-center hover:border-amber-500/30 transition group">
          <div class="w-14 h-14 bg-green-500/10 text-green-400 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-5 group-hover:scale-110 transition">3</div>
          <h3 class="text-white font-black text-lg mb-2">{{ appStore.lang === 'zh' ? '坐等效果' : 'Watch It Grow' }}</h3>
          <p class="text-slate-500 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? '秒级启动，几分钟到几小时完成。随时查看订单进度，掉了自动补。' : 'Starts in seconds. Track progress anytime. Auto-refill on drops.' }}</p>
        </div>
      </div>
    </section>

    <!-- Why us -->
    <section v-if="appStore.moduleEnabled('advantages')" :style="{ order: appStore.moduleOrder('advantages') }" class="site-section relative z-20 bg-slate-900/30 border-t border-slate-800/50 py-20">
      <div class="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- 🧱 分站自定义的三张卡（站长在后台改图标/标题/正文；没填就用下面的默认文案） -->
        <template v-if="appStore.isSubsite && appStore.advantages.length">
          <div v-for="(a, i) in appStore.advantages" :key="i" class="site-card bg-slate-800/40 p-8 rounded-3xl border border-slate-700/50 hover:border-amber-500/30 transition group">
            <div class="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">{{ a.icon || advFallbackIcon(i) }}</div>
            <h3 class="text-xl font-bold text-white mb-3">{{ a.title }}</h3>
            <p class="text-slate-400 text-sm leading-relaxed">{{ a.body }}</p>
          </div>
        </template>
        <template v-else>
        <div class="site-card bg-slate-800/40 p-8 rounded-3xl border border-slate-700/50 hover:border-amber-500/30 transition group">
          <div class="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">⚡</div>
          <h3 class="text-xl font-bold text-white mb-3">{{ appStore.lang === 'zh' ? '秒级自动交付' : 'Instant Auto-Delivery' }}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? '系统全自动API对接，订单秒级响应，无需人工等待。' : 'Fully automated API. Orders processed in milliseconds.' }}</p>
        </div>
        <div class="site-card bg-slate-800/40 p-8 rounded-3xl border border-slate-700/50 hover:border-amber-500/30 transition group">
          <div class="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">💎</div>
          <h3 class="text-xl font-bold text-white mb-3">{{ appStore.lang === 'zh' ? (appStore.isSubsite ? '超值价格' : '全网最低价') : 'Wholesale Pricing' }}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? (appStore.isSubsite ? '下单即自动处理，进度随时可查，价格以下单页为准。' : '直连源头渠道，无中间商加价。TikTok千粉最低 ¥6.5起。') : 'Direct to source. TikTok followers from ¥6.5/1K.' }}</p>
        </div>
        <div class="site-card bg-slate-800/40 p-8 rounded-3xl border border-slate-700/50 hover:border-amber-500/30 transition group">
          <div class="w-14 h-14 bg-green-500/10 text-green-400 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">🔒</div>
          <h3 class="text-xl font-bold text-white mb-3">{{ appStore.lang === 'zh' ? '安全无需密码' : 'No Password Needed' }}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? '只要目标链接，不需要提供账号密码，100%保障你的隐私安全。' : 'Only need the target link. No account password required. 100% privacy.' }}</p>
        </div>
        </template>
      </div>
    </section>

    <!-- Service Preview -->
    <!-- 🎭 分站热门服务：三种结构不同的版式（表格 / 榜单 / 卡片） -->
    <section v-if="appStore.isSubsite && appStore.moduleEnabled('hot_services')"
      :style="{ order: appStore.moduleOrder('hot_services') }"
      class="site-section relative z-20 mx-auto max-w-5xl px-6 py-16">
      <div class="mb-7 flex items-end justify-between">
        <div>
          <h2 class="text-2xl font-black tracking-tight">{{ appStore.lang === 'zh' ? '热门服务' : 'Popular Services' }}</h2>
          <p class="mt-1 text-xs opacity-45">{{ appStore.lang === 'zh' ? '登录后可查看全部服务与实时价格' : 'Login to browse all services' }}</p>
        </div>
        <router-link to="/login" class="text-[11px] font-bold underline underline-offset-4 opacity-55">{{ appStore.lang === 'zh' ? '全部服务 →' : 'All services →' }}</router-link>
      </div>
      <SubsiteServices :variant="appStore.servicesVariant || layout.services" :services="previewServices" :loading="previewLoading" :lang="appStore.lang" />
    </section>

    <section v-else-if="appStore.moduleEnabled('hot_services')" :style="{ order: appStore.moduleOrder('hot_services') }" class="site-section relative z-20 max-w-5xl mx-auto px-6 py-16">
      <h2 class="text-center text-2xl font-black text-white mb-2 tracking-wider">📊 {{ appStore.sectionTitle('hot_services') || (appStore.lang === 'zh' ? '热门服务预览' : 'Popular Services') }}</h2>
      <p class="text-center text-slate-500 text-sm mb-8">{{ appStore.lang === 'zh' ? '登录后可查看全部服务与实时价格' : 'Login to browse all services' }}</p>
      <div v-if="previewLoading" class="flex justify-center py-8"><div class="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div></div>
      <div v-else class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div v-for="s in previewServices" :key="s.service"
          class="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 hover:border-amber-500/20 transition text-center">
          <div class="text-xs text-amber-400 font-bold mb-1">{{ appStore.lang === 'zh' ? s._label : s._labelEn }}</div>
          <div v-if="appStore.lang === 'zh'" class="text-[11px] text-slate-400 leading-snug mb-3 line-clamp-2" :title="s.name">{{ s.name?.substring(0, 30) }}</div>
          <div v-else class="text-[11px] text-slate-500 mb-3">Auto delivery · No password · Refill</div>
          <div class="text-lg font-black text-amber-400">¥{{ s.sell_price?.toFixed(2) }}<span class="text-[10px] text-slate-600 font-normal"> /千</span></div>
        </div>
      </div>
      <div class="text-center mt-8">
        <router-link to="/login" class="inline-block bg-amber-400 hover:bg-amber-300 text-slate-900 font-black px-8 py-3 rounded-xl transition transform hover:-translate-y-1 shadow-[0_8px_20px_rgba(251,191,36,0.3)]">{{ appStore.lang === 'zh' ? '🔓 登录查看全部服务' : '🔓 Login to see all services' }}</router-link>
      </div>
    </section>

    <!-- FAQ -->
    <section v-if="appStore.moduleEnabled('faq')" :style="{ order: appStore.moduleOrder('faq') }" class="site-section relative z-20 max-w-2xl mx-auto px-6 py-16">
      <h2 class="text-center text-2xl font-black text-white mb-10 tracking-wider">{{ appStore.sectionTitle('faq') || (appStore.lang === 'zh' ? '❓ 常见问题' : '❓ FAQ') }}</h2>
      <div class="space-y-3">
        <div v-for="(faq, i) in visibleFaqs" :key="i" class="site-card bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
          <button @click="faq.open = !faq.open" class="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-800/30 transition">
            <span class="text-white font-bold text-sm">{{ faq[appStore.lang].q }}</span>
            <span :class="['text-amber-400 transition-transform', faq.open ? 'rotate-45' : '']">+</span>
          </button>
          <div v-show="faq.open" class="px-5 pb-4 text-slate-400 text-sm leading-relaxed">{{ faq[appStore.lang].a }}</div>
        </div>
      </div>
    </section>

    <!-- Footer CTA -->
    <section v-if="appStore.moduleEnabled('cta')" :style="{ order: appStore.moduleOrder('cta') }" class="site-section relative z-20 text-center py-12 pb-20">
      <h2 class="text-2xl font-black text-white mb-4">{{ appStore.sectionTitle('cta') || (appStore.lang === 'zh' ? '准备好让你的社媒炸裂了吗？' : 'Ready to explode your social media?') }}</h2>
      <p class="text-slate-500 mb-8">{{ appStore.lang === 'zh' ? (appStore.isSubsite ? '注册只需 30 秒，马上就能下单。' : '注册只需30秒，即刻拥有全网最低价涨粉服务。') : 'Sign up in 30 seconds. Instant access to wholesale SMM services.' }}</p>
      <router-link to="/login" class="inline-block px-12 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-lg transition transform hover:-translate-y-1 shadow-[0_10px_30px_rgba(251,191,36,0.4)]">{{ appStore.lang === 'zh' ? '🚀 免费注册' : '🚀 Sign Up Free' }}</router-link>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '../stores/app';
import SiteModules from '../components/SiteModules.vue';
import SubsiteHero from '../components/site/SubsiteHero.vue';
import SubsiteServices from '../components/site/SubsiteServices.vue';
import { useUserStore } from '../stores/user';

const appStore = useAppStore();
const userStore = useUserStore();
const route = useRoute();
const router = useRouter();
const vpnShopEnabled = ref(true);
// ✍️ 首页文案：站长填了就用自己的，没填就用主站默认 —— 主站/未配置分站的外观一字不变
// 🎭 版式映射：模板 → 结构（不是换色，是换版式）
//   祥哥反馈「分站还是跟我的一模一样」—— 根因是以前 6 套模板只换 CSS 变量，
//   DOM 结构完全相同。这里按模板给出**不同的首屏结构与服务列表结构**，
//   让分站从骨架上就不是同一个站。
// 🧱 优势卡没填图标时给个默认（与平台默认三张卡一致的符号顺序）
const ADV_ICONS = ['⚡', '💎', '🔒']
const advFallbackIcon = (i) => ADV_ICONS[i % ADV_ICONS.length]

const TEMPLATE_LAYOUT = {
  classic:  { hero: 'center',    services: 'cards' },
  saas:     { hero: 'split',     services: 'cards' },
  minimal:  { hero: 'editorial', services: 'table' },
  neon:     { hero: 'terminal',  services: 'table' },
  magazine: { hero: 'editorial', services: 'ranked' },
  glass:    { hero: 'split',     services: 'ranked' },
};
const layout = computed(() => TEMPLATE_LAYOUT[appStore.themeTemplate] || TEMPLATE_LAYOUT.classic);

const hero = computed(() => {
  const zh = appStore.lang !== 'en'
  const s = appStore.hero || {}
  return {
    badge: s.hero_badge || (zh ? (appStore.isSubsite ? '🚀 涨粉 · 涨量 · 一键下单' : '🚀 TikTok / IG / YouTube / Telegram 涨粉涨量平台') : '🚀 SMM Panel for TikTok / IG / YT / TG'),
    title: s.hero_title || '',
    subtitle: s.hero_subtitle || (zh
      ? (appStore.isSubsite ? 'TikTok 涨粉、IG 粉丝、YouTube 订阅、Telegram 群成员、Facebook / X 涨粉、网站流量 —— 多平台增长，一站下单' : 'TikTok 涨粉、IG 粉丝、YouTube 订阅、Telegram 群成员、Facebook / X 涨粉、网站流量 —— 全平台社媒增长一次搞定')
      : 'Buy TikTok followers, Instagram likes, YouTube subscribers, Telegram members, Facebook & X followers, website traffic — all platforms in one SMM panel'),
    desc: s.hero_desc || (zh ? '极速自动交付 · 超值价格 · 无需账号密码 · 注册即用' : 'Instant delivery · Great prices · No password needed · Sign up and go'),
    btn1Text: s.hero_btn1_text || (zh ? '⚡ 立即注册体验' : '⚡ Get Started Now'),
    btn1Url: s.hero_btn1_url || '',
    // ⚠️ 分站没有「安全节点」这个业务：站长没自定义就干脆不显示
    btn2Text: s.hero_btn2_text || (appStore.isSubsite ? '' : (zh ? '🛡️ 安全节点' : '🛡️ VPN')),
    btn2Url: s.hero_btn2_url || '',
    bgUrl: s.hero_bg_url || ''
  }
})

// 🖼 站长上传的首页背景图：压一层深色遮罩，保证文字始终看得清。
//    不压遮罩的话，白色标题压在白底图上会直接看不见 —— 页面上最重要的字。
const heroBgStyle = computed(() => {
  const u = hero.value.bgUrl
  if (!u) return {}
  return {
    backgroundImage: `linear-gradient(rgba(2,6,23,.82), rgba(2,6,23,.94)), url("${u}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    borderRadius: '28px'
  }
})
const previewServices = ref([]);
const previewLoading = ref(true);

// 语言随路径：`/`=中文主版，`/en`=英文镜像。首帧即设，避免英文页先闪中文。
appStore.lang = route.path === '/en' ? 'en' : 'zh';
watch(() => route.path, p => { appStore.lang = p === '/en' ? 'en' : 'zh'; });
// 顶栏语言按钮 = 在中文页与英文镜像间跳转（复用组件会触发 watch 切语言）
const toggleLangRoute = () => router.push(route.path === '/en' ? '/' : '/en');

// 加载公开服务预览
const loadPreview = async () => {
  try {
    const r = await fetch('/api/services/public');
    const d = await r.json();
    if (d.status === 'success' && Array.isArray(d.data)) {
      // 筛选热门平台 + 低价服务（过滤天价指南类）
      const targets = [
        { kw: 'tiktok - 刷粉', label: 'TikTok 涨粉', labelEn: 'TikTok Followers' },
        { kw: 'instagram - 粉丝', label: 'Instagram 涨粉', labelEn: 'Instagram Followers' },
        { kw: 'youtube 订阅', label: 'YouTube 订阅', labelEn: 'YouTube Subscribers' },
        { kw: 'telegram - 群组', label: 'Telegram 群成员', labelEn: 'Telegram Members' },
        { kw: 'facebook粉丝', label: 'Facebook 涨粉', labelEn: 'Facebook Followers' },
        { kw: 'tiktok - 视频播放', label: 'TikTok 播放', labelEn: 'TikTok Views' },
        { kw: 'website traffic', label: '网站流量', labelEn: 'Website Traffic' },
        { kw: 'tiktok - 视频点赞', label: 'TikTok 点赞', labelEn: 'TikTok Likes' },
      ];
      previewServices.value = [];
      for (const t of targets) {
        // ⚠️ 老逻辑按 s.rate 过滤，但 /api/services/public 根本不返回 rate 字段
        //    → parseFloat(undefined)=NaN → 一条都筛不出来 → 热门服务区块永远是空的。
        //    这里**只对分站**改用 sell_price 兜底（主站保持原行为，验收前不动主站）。
        // 公开接口给的是 sell_price（没有 rate）；旧代码只看 rate → 永远筛不出东西。
        // 这里统一用 sell_price 兜底 rate。注意：previewServices 只被分站组件消费，
        // 主站的首页区块不看它，所以这个改动不会影响主站外观。
        const priceOf = (s) => parseFloat(s.sell_price ?? s.rate);
        const candidates = d.data.filter(s => {
          const cat = (s.category || '').toLowerCase();
          const p = priceOf(s);
          return cat.includes(t.kw) && p > 0 && p < 100;
        });
        if (candidates.length > 0) {
          candidates.sort((a, b) => priceOf(a) - priceOf(b));
          previewServices.value.push({ ...candidates[0], _label: t.label, _labelEn: t.labelEn });
        }
        if (previewServices.value.length >= 8) break;
      }
      // 分站兜底：关键词一个都没命中时（服务分类名千奇百怪），
      // 直接取最便宜的 8 条 —— 空白区块比"看起来不精准"更伤。
      if (previewServices.value.length === 0) {
        const priceOf2 = (s) => parseFloat(s.sell_price ?? s.rate);
        previewServices.value = d.data
          .filter(s => priceOf2(s) > 0)
          .sort((a, b) => priceOf2(a) - priceOf2(b))
          .slice(0, 8)
          .map((s, i) => ({ ...s, _label: s.category || ('服务 ' + (i + 1)), _labelEn: s.category || ('Service ' + (i + 1)) }));
      }
    }
  } catch (e) {}
  previewLoading.value = false;
};

const platforms = [
  { name: { zh: 'TikTok', en: 'TikTok' }, icon: '🎵' },
  { name: { zh: 'Instagram', en: 'Instagram' }, icon: '📸' },
  { name: { zh: 'YouTube', en: 'YouTube' }, icon: '▶️' },
  { name: { zh: 'Telegram', en: 'Telegram' }, icon: '✈️' },
  { name: { zh: 'Facebook', en: 'Facebook' }, icon: '📘' },
  { name: { zh: 'X/Twitter', en: 'X/Twitter' }, icon: '🐦' },
  { name: { zh: 'Shopee', en: 'Shopee' }, icon: '🛍️' },
];

const faqs = reactive([
  { zh: { q: '注册需要提供什么？', a: '只需要手机号和邮箱。不需要实名，不需要绑卡。30 秒完成注册。' }, en: { q: 'What do I need to sign up?', a: 'Just a phone number and email. No real-name ID, no card binding. Registration takes 30 seconds.' }, open: false },
  { zh: { q: '下单需要提供账号密码吗？', a: '完全不需要！你只需要提供目标链接（如 TikTok 主页链接），系统会自动处理。我们不会、也不能访问你的社交账号。' }, en: { q: 'Do you need my account password?', a: 'No. You only provide a public link (e.g. your TikTok profile). The system handles delivery automatically — we never see or access your account.' }, open: false },
  { zh: { q: '多久能看到效果？', a: '大部分服务下单后几秒到几分钟内启动。TikTok 千粉最快 10 分钟完成，具体速度取决于所选服务。' }, en: { q: 'How fast will I see results?', a: 'Most orders start within seconds to a few minutes. A TikTok 1K followers order can complete in ~10 minutes; speed depends on the service.' }, open: false },
  { zh: { q: '会掉粉吗？会被封号吗？', a: '部分服务标注了"30天可补"，掉粉可自动补充。关于封号——我们运营多年，从未有客户因此被封。平台无法判断是谁购买了服务。' }, en: { q: 'Will followers drop? Is it safe from bans?', a: 'Services marked "30-day refill" auto-refill any drops. On safety — we have operated for years without a customer being banned for using us.' }, open: false },
  { zh: { q: '怎么付款？', a: '支持微信支付、支付宝、USDT(TRC20) 三种方式。单次充值 500 元以上免手续费。' }, en: { q: 'What payment methods do you accept?', a: 'We accept WeChat Pay, Alipay and USDT (TRC20). Top-ups over ¥500 are fee-free.' }, open: false },
  // 🚫 这条只在平台主站展示：在分站上教客户「搭自己的站、自己定价转卖」，等于帮站长培养竞争对手。
  { subsiteHidden: true, zh: { q: '可以自己定价转卖吗？', a: '可以！升级至尊代理(¥99/月)后享受更优价格，同时开放 API 接口，你可以搭建自己的站点，自己定价转卖。' }, en: { q: 'Can I resell at my own price?', a: 'Yes! Become an agent (from ¥99/month) for wholesale rates plus API access to build and price your own SMM site.' }, open: false },
]);

// 分站不展示会挖站长墙角的 FAQ 条目（如「你也可以开站转卖」）
const visibleFaqs = computed(() => (appStore.isSubsite ? faqs.filter((f) => !f.subsiteHidden) : faqs));


// FAQPage 结构化数据：与 faqs 同一数据源，随语言切换重建（/ 中文、/en 英文）
function updateFaqSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: visibleFaqs.value.map((f) => ({
      '@type': 'Question',
      name: f[appStore.lang].q,
      acceptedAnswer: { '@type': 'Answer', text: f[appStore.lang].a },
    })),
  };
  const el = document.getElementById('xn-faq-schema');
  if (el) { el.textContent = JSON.stringify(schema); return; }
  const s = document.createElement('script');
  s.id = 'xn-faq-schema';
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(schema);
  document.head.appendChild(s);
}
watch(() => appStore.lang, updateFaqSchema);

onMounted(async () => {
  updateFaqSchema();
  appStore.fetchConfig();
  loadPreview();
  try { const r = await fetch('/api/vpn/status'); const d = await r.json(); vpnShopEnabled.value = d.enabled; } catch (e) {}
});
</script>
