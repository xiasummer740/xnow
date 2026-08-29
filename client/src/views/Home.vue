<template>
  <div class="min-h-screen bg-transparent text-white font-sans selection:bg-amber-400 selection:text-slate-900 relative overflow-hidden z-10">
    <header class="relative z-20 flex items-center justify-between px-6 py-4 md:px-12 lg:py-6 max-w-7xl mx-auto">
      <div class="flex items-center space-x-3">
        <img :src="appStore.siteLogo || '/logo.png'" onerror="this.onerror=null; this.src='/logo.png';" class="h-10 w-10 md:h-12 md:w-12 object-contain drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" alt="Logo">
        <span class="text-2xl md:text-3xl font-black italic tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">{{ appStore.siteName || 'XNOW' }}</span>
      </div>
      <div class="flex items-center space-x-4 md:space-x-6">
        <button @click="appStore.toggleLang" class="text-slate-300 hover:text-white font-bold transition text-sm md:text-base select-none">{{ appStore.lang === 'zh' ? 'EN' : '中' }}</button>
        <router-link v-if="userStore.token" to="/order" class="bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-900 font-black px-5 py-2 md:px-8 md:py-2.5 rounded-full transition transform hover:scale-105 shadow-[0_0_20px_rgba(251,191,36,0.4)]">{{ appStore.t('console') || '控制台' }}</router-link>
        <router-link v-else to="/login" class="bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-900 font-black px-5 py-2 md:px-8 md:py-2.5 rounded-full transition transform hover:scale-105 shadow-[0_0_20px_rgba(251,191,36,0.4)]">{{ appStore.lang === 'zh' ? '登录 / 注册' : 'Login / Register' }}</router-link>
      </div>
    </header>

    <main class="relative z-20 flex flex-col items-center justify-center text-center px-4 pt-16 md:pt-24 lg:pt-32 max-w-5xl mx-auto">
      <div class="inline-block mb-6 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs md:text-sm font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(251,191,36,0.2)] backdrop-blur-md">{{ appStore.lang === 'zh' ? '🚀 TikTok / IG / YouTube / Telegram 涨粉涨量平台' : '🚀 SMM Panel for TikTok / IG / YT / TG' }}</div>
      <h1 class="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight mb-6 drop-shadow-2xl">
        {{ appStore.lang === 'zh' ? '让你的社交媒体' : 'Make Your' }}<br/>
        <span class="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-500 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]">{{ appStore.lang === 'zh' ? '🔥 火速出圈' : 'Social Media Explode' }}</span>
      </h1>
      <p class="text-slate-300 text-base md:text-lg max-w-xl mx-auto mb-4 leading-relaxed">
        {{ appStore.lang === 'zh' ? '粉丝、点赞、播放量、评论、转发 —— TikTok/IG/YT/TG/FB/X 全平台覆盖' : 'Followers, Likes, Views, Comments, Shares across TikTok/IG/YT/TG/FB/X' }}
      </p>
      <p class="text-slate-500 text-sm max-w-lg mx-auto mb-10 leading-relaxed">
        {{ appStore.lang === 'zh' ? '极速自动交付 · 全网底价 · 无需账号密码 · 注册即用' : 'Instant delivery · Wholesale prices · No password needed · Sign up and go' }}
      </p>

      <!-- Platform quick preview -->
      <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3 mb-10 max-w-2xl">
        <div v-for="p in platforms" :key="p.name" class="flex flex-col items-center gap-1.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-3 hover:border-amber-500/30 transition cursor-default">
          <span class="text-2xl">{{ p.icon }}</span>
          <span class="text-[11px] text-slate-400 font-bold">{{ p.name }}</span>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
        <router-link to="/login" class="w-full sm:w-auto px-10 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-lg transition transform hover:-translate-y-1 shadow-[0_10px_30px_rgba(251,191,36,0.3)] flex items-center justify-center">
          {{ appStore.lang === 'zh' ? '⚡ 立即注册体验' : '⚡ Get Started Now' }}
        </router-link>
        <router-link to="/vpn" class="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-400 font-bold text-base transition flex items-center justify-center">
          {{ appStore.lang === 'zh' ? '🛡️ 安全节点' : '🛡️ VPN' }}
        </router-link>
      </div>
    </main>

    <!-- Use cases -->
    <section class="relative z-20 max-w-5xl mx-auto px-6 py-16">
      <h2 class="text-center text-2xl font-black text-white mb-10 tracking-wider">{{ appStore.lang === 'zh' ? '🎯 他们都在用安全节点' : '🎯 Who Uses Secure Nodes' }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <router-link to="/vpn" class="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-6 hover:border-emerald-500/40 transition group block">
          <div class="text-3xl mb-3">🎬</div>
          <h3 class="text-white font-black mb-1">{{ appStore.lang==='zh'?'TikTok创作者':'TikTok Creators' }}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">{{ appStore.lang==='zh'?'0播放、限流、Shadow Ban？独享原生IP，让算法认为你是本地用户。' : 'Zero views? Shadow ban? Dedicated residential IPs make the algorithm see you as local.' }}</p>
        </router-link>
        <router-link to="/vpn" class="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-6 hover:border-emerald-500/40 transition group block">
          <div class="text-3xl mb-3">📺</div>
          <h3 class="text-white font-black mb-1">{{ appStore.lang==='zh'?'直播带货':'Live Streamers' }}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">{{ appStore.lang==='zh'?'直播卡顿掉帧丢单？CN2 GIA/CMIN2优化线路，跨国直播稳60帧。' : 'Laggy streams losing sales? Premium routes for stable 60fps cross-border streaming.' }}</p>
        </router-link>
        <router-link to="/vpn" class="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-6 hover:border-emerald-500/40 transition group block">
          <div class="text-3xl mb-3">👥</div>
          <h3 class="text-white font-black mb-1">{{ appStore.lang==='zh'?'矩阵运营':'Multi-Account' }}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">{{ appStore.lang==='zh'?'多号同IP=批量送死。每号独立IP，矩阵稳如磐石。' : 'Same IP for multiple accounts = mass ban. Dedicated IP per account.' }}</p>
        </router-link>
      </div>
    </section>

    <!-- How it works -->
    <section class="relative z-20 max-w-4xl mx-auto px-6 py-8">
      <h2 class="text-center text-2xl font-black text-white mb-10 tracking-wider">{{ appStore.lang === 'zh' ? '📋 三步开始' : '📋 How It Works' }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 text-center hover:border-amber-500/30 transition group">
          <div class="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-5 group-hover:scale-110 transition">1</div>
          <h3 class="text-white font-black text-lg mb-2">{{ appStore.lang === 'zh' ? '注册账号' : 'Sign Up' }}</h3>
          <p class="text-slate-500 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? '手机号注册，无需实名，30秒完成。注册即享全网底价。' : 'Sign up with phone number in 30 seconds. Instant access to wholesale pricing.' }}</p>
        </div>
        <div class="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 text-center hover:border-amber-500/30 transition group">
          <div class="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-5 group-hover:scale-110 transition">2</div>
          <h3 class="text-white font-black text-lg mb-2">{{ appStore.lang === 'zh' ? '充值下单' : 'Top Up & Order' }}</h3>
          <p class="text-slate-500 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? '微信/支付宝/USDT 充值，选服务填链接，一键提交。系统全自动处理。' : 'Top up via WeChat/Alipay/USDT. Pick a service, paste your link, submit. Fully automated.' }}</p>
        </div>
        <div class="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 text-center hover:border-amber-500/30 transition group">
          <div class="w-14 h-14 bg-green-500/10 text-green-400 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-5 group-hover:scale-110 transition">3</div>
          <h3 class="text-white font-black text-lg mb-2">{{ appStore.lang === 'zh' ? '坐等效果' : 'Watch It Grow' }}</h3>
          <p class="text-slate-500 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? '秒级启动，几分钟到几小时完成。随时查看订单进度，掉了自动补。' : 'Starts in seconds. Track progress anytime. Auto-refill on drops.' }}</p>
        </div>
      </div>
    </section>

    <!-- Why us -->
    <section class="relative z-20 bg-slate-900/30 border-t border-slate-800/50 py-20">
      <div class="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="bg-slate-800/40 p-8 rounded-3xl border border-slate-700/50 hover:border-amber-500/30 transition group">
          <div class="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">⚡</div>
          <h3 class="text-xl font-bold text-white mb-3">{{ appStore.lang === 'zh' ? '秒级自动交付' : 'Instant Auto-Delivery' }}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? '系统全自动API对接，订单秒级响应，无需人工等待。' : 'Fully automated API. Orders processed in milliseconds.' }}</p>
        </div>
        <div class="bg-slate-800/40 p-8 rounded-3xl border border-slate-700/50 hover:border-amber-500/30 transition group">
          <div class="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">💎</div>
          <h3 class="text-xl font-bold text-white mb-3">{{ appStore.lang === 'zh' ? '全网最低价' : 'Wholesale Pricing' }}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? '直连源头渠道，无中间商加价。TikTok千粉最低 ¥6.5起。' : 'Direct to source. TikTok followers from ¥6.5/1K.' }}</p>
        </div>
        <div class="bg-slate-800/40 p-8 rounded-3xl border border-slate-700/50 hover:border-amber-500/30 transition group">
          <div class="w-14 h-14 bg-green-500/10 text-green-400 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">🔒</div>
          <h3 class="text-xl font-bold text-white mb-3">{{ appStore.lang === 'zh' ? '安全无需密码' : 'No Password Needed' }}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? '只要目标链接，不需要提供账号密码，100%保障你的隐私安全。' : 'Only need the target link. No account password required. 100% privacy.' }}</p>
        </div>
      </div>
    </section>

    <!-- Service Preview -->
    <section class="relative z-20 max-w-5xl mx-auto px-6 py-16">
      <h2 class="text-center text-2xl font-black text-white mb-2 tracking-wider">📊 {{ appStore.lang === 'zh' ? '热门服务预览' : 'Popular Services' }}</h2>
      <p class="text-center text-slate-500 text-sm mb-8">{{ appStore.lang === 'zh' ? '登录后可查看全部服务与实时价格' : 'Login to browse all services' }}</p>
      <div v-if="previewLoading" class="flex justify-center py-8"><div class="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div></div>
      <div v-else class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div v-for="s in previewServices" :key="s.service"
          class="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 hover:border-amber-500/20 transition text-center">
          <div class="text-xs text-amber-400 font-bold mb-1">{{ s._label }}</div>
          <div class="text-[11px] text-slate-400 leading-snug mb-3 line-clamp-2" :title="s.name">{{ s.name?.substring(0, 30) }}</div>
          <div class="text-lg font-black text-amber-400">¥{{ s.sell_price?.toFixed(2) }}<span class="text-[10px] text-slate-600 font-normal"> /千</span></div>
        </div>
      </div>
      <div class="text-center mt-8">
        <router-link to="/login" class="inline-block bg-amber-400 hover:bg-amber-300 text-slate-900 font-black px-8 py-3 rounded-xl transition transform hover:-translate-y-1 shadow-[0_8px_20px_rgba(251,191,36,0.3)]">{{ appStore.lang === 'zh' ? '🔓 登录查看全部服务' : '🔓 Login to see all services' }}</router-link>
      </div>
    </section>

    <!-- FAQ -->
    <section class="relative z-20 max-w-2xl mx-auto px-6 py-16">
      <h2 class="text-center text-2xl font-black text-white mb-10 tracking-wider">{{ appStore.lang === 'zh' ? '❓ 常见问题' : '❓ FAQ' }}</h2>
      <div class="space-y-3">
        <div v-for="(faq, i) in faqs" :key="i" class="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
          <button @click="faq.open = !faq.open" class="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-800/30 transition">
            <span class="text-white font-bold text-sm">{{ faq.q }}</span>
            <span :class="['text-amber-400 transition-transform', faq.open ? 'rotate-45' : '']">+</span>
          </button>
          <div v-show="faq.open" class="px-5 pb-4 text-slate-400 text-sm leading-relaxed">{{ faq.a }}</div>
        </div>
      </div>
    </section>

    <!-- Footer CTA -->
    <section class="relative z-20 text-center py-12 pb-20">
      <h2 class="text-2xl font-black text-white mb-4">{{ appStore.lang === 'zh' ? '准备好让你的社媒炸裂了吗？' : 'Ready to explode your social media?' }}</h2>
      <p class="text-slate-500 mb-8">{{ appStore.lang === 'zh' ? '注册只需30秒，即刻拥有全网最低价涨粉服务。' : 'Sign up in 30 seconds. Instant access to wholesale SMM services.' }}</p>
      <router-link to="/login" class="inline-block px-12 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-lg transition transform hover:-translate-y-1 shadow-[0_10px_30px_rgba(251,191,36,0.4)]">{{ appStore.lang === 'zh' ? '🚀 免费注册' : '🚀 Sign Up Free' }}</router-link>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useAppStore } from '../stores/app';
import { useUserStore } from '../stores/user';

const appStore = useAppStore();
const userStore = useUserStore();
const vpnShopEnabled = ref(true);
const previewServices = ref([]);
const previewLoading = ref(true);

// 加载公开服务预览
const loadPreview = async () => {
  try {
    const r = await fetch('/api/services/public');
    const d = await r.json();
    if (d.status === 'success' && Array.isArray(d.data)) {
      // 筛选热门平台 + 低价服务（过滤天价指南类）
      const targets = [
        { kw: 'tiktok - 刷粉', label: 'TikTok 涨粉' },
        { kw: 'instagram - 粉丝', label: 'Instagram 涨粉' },
        { kw: 'youtube 订阅', label: 'YouTube 订阅' },
        { kw: 'telegram - 群组', label: 'Telegram 群成员' },
        { kw: 'facebook粉丝', label: 'Facebook 涨粉' },
        { kw: 'tiktok - 视频播放', label: 'TikTok 播放' },
        { kw: 'website traffic', label: '网站流量' },
        { kw: 'tiktok - 视频点赞', label: 'TikTok 点赞' },
      ];
      previewServices.value = [];
      for (const t of targets) {
        const candidates = d.data.filter(s => {
          const cat = (s.category || '').toLowerCase();
          return cat.includes(t.kw) && parseFloat(s.rate) > 0 && parseFloat(s.rate) < 100;
        });
        if (candidates.length > 0) {
          candidates.sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
          previewServices.value.push({ ...candidates[0], _label: t.label });
        }
        if (previewServices.value.length >= 8) break;
      }
    }
  } catch (e) {}
  previewLoading.value = false;
};

const platforms = [
  { name: 'TikTok', icon: '🎵' },
  { name: 'Instagram', icon: '📸' },
  { name: 'YouTube', icon: '▶️' },
  { name: '电报', icon: '✈️' },
  { name: 'Facebook', icon: '📘' },
  { name: 'X/Twitter', icon: '🐦' },
  { name: 'Shopee', icon: '🛍️' },
];

const faqs = reactive([
  { q: '注册需要提供什么？', a: '只需要手机号和邮箱。不需要实名，不需要绑卡。30 秒完成注册。', open: false },
  { q: '下单需要提供账号密码吗？', a: '完全不需要！你只需要提供目标链接（如 TikTok 主页链接），系统会自动处理。我们不会、也不能访问你的社交账号。', open: false },
  { q: '多久能看到效果？', a: '大部分服务下单后几秒到几分钟内启动。TikTok 千粉最快 10 分钟完成，具体速度取决于所选服务。', open: false },
  { q: '会掉粉吗？会被封号吗？', a: '部分服务标注了"30天可补"，掉粉可自动补充。关于封号——我们运营多年，从未有客户因此被封。平台无法判断是谁购买了服务。', open: false },
  { q: '怎么付款？', a: '支持微信支付、支付宝、USDT(TRC20) 三种方式。单次充值 500 元以上免手续费。', open: false },
  { q: '可以自己定价转卖吗？', a: '可以！升级至尊代理(¥99/月)后享受底价，同时开放 API 接口，你可以搭建自己的站点，自己定价转卖。', open: false },
]);

onMounted(async () => {
  appStore.fetchConfig();
  loadPreview();
  try { const r = await fetch('/api/vpn/status'); const d = await r.json(); vpnShopEnabled.value = d.enabled; } catch (e) {}
});
</script>
