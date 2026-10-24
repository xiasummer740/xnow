<template>
  <!-- 🏬 分站首页模块：只有分站才渲染（主站 homeModules 为空 → 整块不出现） -->
  <div v-if="isSubsite" class="relative z-20 max-w-5xl mx-auto px-6">
    <template v-for="m in ordered" :key="m.key">
      <!-- 公告条 -->
      <div v-if="m.key === 'announce' && announcement" class="site-card mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
        <p class="text-amber-200 text-sm leading-relaxed" v-html="announcement"></p>
      </div>

      <!-- 数据统计 -->
      <div v-else-if="m.key === 'stats'" class="mb-10 grid grid-cols-3 gap-3">
        <div class="site-card bg-slate-800/40 border border-slate-700/50 rounded-2xl py-4 text-center">
          <p class="text-xl font-black text-white">{{ number(stats.services) }}</p>
          <p class="text-[11px] text-slate-400 mt-1">{{ zh ? '在售服务' : 'Services' }}</p>
        </div>
        <div class="site-card bg-slate-800/40 border border-slate-700/50 rounded-2xl py-4 text-center">
          <p class="text-xl font-black text-white">{{ number(stats.orders) }}</p>
          <p class="text-[11px] text-slate-400 mt-1">{{ zh ? '累计订单' : 'Orders' }}</p>
        </div>
        <div class="site-card bg-slate-800/40 border border-slate-700/50 rounded-2xl py-4 text-center">
          <p class="text-xl font-black text-white">{{ number(stats.users) }}</p>
          <p class="text-[11px] text-slate-400 mt-1">{{ zh ? '服务用户' : 'Users' }}</p>
        </div>
      </div>

      <!-- 热门服务 -->
      <div v-else-if="m.key === 'hot_services' && hot.length" class="site-section mb-12">
        <h2 class="text-center text-xl font-black text-white mb-6 tracking-wider">{{ zh ? '🔥 热门服务' : '🔥 Popular' }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <router-link v-for="s in hot" :key="s.id" to="/order"
            class="site-card bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 hover:border-amber-500/40 transition block">
            <p class="text-white text-sm font-bold line-clamp-2">{{ s.name }}</p>
            <div class="flex items-baseline justify-between mt-3">
              <span class="text-amber-400 font-black">¥{{ s.pricePerK }}<span class="text-[10px] text-slate-500 font-normal">/千</span></span>
              <span class="text-[10px] text-slate-500">{{ zh ? '已售' : 'Sold' }} {{ number(s.sold) }}</span>
            </div>
          </router-link>
        </div>
      </div>

      <!-- 教程 FAQ -->
      <div v-else-if="m.key === 'faq'" class="site-section mb-12">
        <h2 class="text-center text-xl font-black text-white mb-6 tracking-wider">{{ zh ? '❓ 常见问题' : '❓ FAQ' }}</h2>
        <div class="space-y-2">
          <details v-for="(f, i) in faqs" :key="i" class="site-card bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <summary class="text-white text-sm font-bold cursor-pointer">{{ f.q }}</summary>
            <p class="text-slate-400 text-xs leading-relaxed mt-2">{{ f.a }}</p>
          </details>
        </div>
      </div>

      <!-- VIP 入口 -->
      <router-link v-else-if="m.key === 'vip'" to="/vip"
        class="site-card mb-6 block rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 hover:border-emerald-400/60 transition">
        <p class="text-emerald-300 font-black text-sm">{{ zh ? '💎 开通 VIP，享受专属折扣与优先队列' : '💎 Go VIP for discounts & priority' }}</p>
      </router-link>

      <!-- 返佣横幅 -->
      <router-link v-else-if="m.key === 'affiliate'" to="/affiliate"
        class="site-card mb-10 block rounded-2xl border border-sky-500/30 bg-sky-500/10 px-5 py-4 hover:border-sky-400/60 transition">
        <p class="text-sky-300 font-black text-sm">{{ zh ? '💰 推荐好友下单，赚取持续返佣' : '💰 Refer friends and earn ongoing commission' }}</p>
      </router-link>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
const zh = computed(() => appStore.lang === 'zh')
const stats = ref({ services: 0, orders: 0, users: 0 })
const hot = ref([])
const announcement = computed(() => appStore.announcement || '')

const isSubsite = computed(() => !!appStore.themeTemplate)

const ordered = computed(() => {
  const mods = (appStore.homeModules || []).filter(m => m && m.enabled !== false)
  return mods.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
})

const number = (n) => {
  const v = Number(n || 0)
  if (v >= 10000) return (v / 10000).toFixed(1) + 'w'
  return v.toLocaleString()
}

const faqs = computed(() => zh.value ? [
  { q: '下单后多久开始？', a: '提交后通常 1~5 分钟内自动开始，高峰期会稍慢，可在「订单记录」查看进度。' },
  { q: '支持哪些链接？', a: '公开可见的链接（视频、主页、帖子）。私密账号、需要登录的内容无法处理。' },
  { q: '会掉量吗？', a: '标注「补量」的服务在保修期内掉量会自动补回，无需另行付费。' },
  { q: '可以退款吗？', a: '未开始执行的订单可取消并退款；已开始执行的订单按实际进度结算。' }
] : [
  { q: 'How fast does it start?', a: 'Usually within 1–5 minutes. Check "Order History" for live progress.' },
  { q: 'Which links work?', a: 'Publicly visible links only. Private accounts and login-walled content cannot be processed.' },
  { q: 'Will it drop?', a: 'Services marked with refill are refilled free of charge within the warranty period.' },
  { q: 'Refunds?', a: 'Unstarted orders can be cancelled and refunded.' }
])

onMounted(async () => {
  if (!isSubsite.value) return
  try {
    const r1 = await fetch('/api/public/site-stats')
    const d1 = await r1.json()
    if (d1.status === 'success') stats.value = d1.data
  } catch (e) {}
  try {
    const r2 = await fetch('/api/public/hot-services')
    const d2 = await r2.json()
    if (d2.status === 'success' && Array.isArray(d2.data)) hot.value = d2.data
  } catch (e) {}
})
</script>
