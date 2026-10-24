<template>
  <!-- 🏬 分站首页模块：只有分站才渲染（主站 homeModules 为空 → 整块不出现）
       ⚠️ 102 期：这里**不能**再套一层自己的容器。
       原来本组件有一个 max-w-5xl 的外壳，而热门服务 / FAQ / 优势 / CTA 在 Home.vue 里，
       两者不在同一个父元素下 —— CSS 的 order 只在同一父容器的兄弟之间生效，
       于是站长把「热门服务」拖到最上面根本没反应（实测确认，改完等 70 秒越过缓存也一样）。
       现在每块都直接作为 Home 根容器的子元素（外面套一层只为对齐宽度），order 才真正生效。 -->
  <template v-if="isSubsite">
    <template v-for="m in ordered" :key="m.key">
      <!-- 公告条 -->
      <div v-if="m.key === 'announce' && announcement" class="relative z-20 w-full max-w-5xl mx-auto px-6" :style="{ order: m.order }">
        <div class="site-card mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
          <p class="text-amber-200 text-sm leading-relaxed" v-html="announcement"></p>
        </div>
      </div>

      <!-- 数据统计 -->
      <div v-else-if="m.key === 'stats'" class="relative z-20 w-full max-w-5xl mx-auto px-6" :style="{ order: m.order }">
        <div class="mb-10 grid grid-cols-3 gap-3">
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
      </div>

      <!-- 热门服务（实际由 Home.vue 渲染，这里保留兜底） -->
      <div v-else-if="m.key === 'hot_services' && hot.length" class="relative z-20 w-full max-w-5xl mx-auto px-6 site-section mb-12" :style="{ order: m.order }">
        <h2 class="text-center text-xl font-black text-white mb-6 tracking-wider">{{ zh ? '🔥 热门服务' : '🔥 Popular' }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <router-link v-for="s in hot" :key="s.id" to="/order"
            class="site-card bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 hover:border-amber-500/40 transition block">
            <p class="text-white text-sm font-bold line-clamp-2">{{ s.name }}</p>
            <div class="flex items-baseline justify-between mt-3">
              <span class="text-amber-400 font-black">¥{{ s.pricePerK }}<span class="text-[10px] text-slate-500 font-normal">/千</span></span>
              <!-- 新站还没有成交时后台会返回"平台在售"的兜底列表，销量是 0：
                   显示「已售 0」比不显示更像坏了一角，所以 0 就不显示 -->
              <span v-if="Number(s.sold) > 0" class="text-[10px] text-slate-500">{{ zh ? '已售' : 'Sold' }} {{ number(s.sold) }}</span>
            </div>
          </router-link>
        </div>
      </div>

      <!-- 教程 FAQ（实际由 Home.vue 渲染，这里保留兜底） -->
      <div v-else-if="m.key === 'faq'" class="relative z-20 w-full max-w-5xl mx-auto px-6 site-section mb-12" :style="{ order: m.order }">
        <h2 class="text-center text-xl font-black text-white mb-6 tracking-wider">{{ zh ? '❓ 常见问题' : '❓ FAQ' }}</h2>
        <div class="space-y-2">
          <details v-for="(f, i) in faqs" :key="i" class="site-card bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
            <summary class="text-white text-sm font-bold cursor-pointer">{{ f.q }}</summary>
            <p class="text-slate-400 text-xs leading-relaxed mt-2">{{ f.a }}</p>
          </details>
        </div>
      </div>

      <!-- VIP 入口 -->
      <div v-else-if="m.key === 'vip'" class="relative z-20 w-full max-w-5xl mx-auto px-6" :style="{ order: m.order }">
        <router-link to="/vip"
          class="site-card mb-6 block rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 hover:border-emerald-400/60 transition">
          <p class="text-emerald-300 font-black text-sm">{{ zh ? '💎 开通 VIP，享受专属折扣与优先队列' : '💎 Go VIP for discounts & priority' }}</p>
        </router-link>
      </div>

      <!-- 返佣横幅 -->
      <div v-else-if="m.key === 'affiliate'" class="relative z-20 w-full max-w-5xl mx-auto px-6" :style="{ order: m.order }">
        <router-link to="/affiliate"
          class="site-card mb-10 block rounded-2xl border border-sky-500/30 bg-sky-500/10 px-5 py-4 hover:border-sky-400/60 transition">
          <p class="text-sky-300 font-black text-sm">{{ zh ? '💰 推荐好友下单，赚取持续返佣' : '💰 Refer friends and earn ongoing commission' }}</p>
        </router-link>
      </div>
    </template>
  </template>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
const zh = computed(() => appStore.lang === 'zh')
const stats = ref({ services: 0, orders: 0, users: 0 })
const hot = ref([])
const announcement = computed(() => appStore.announcement || '')

const isSubsite = computed(() => !!appStore.themeTemplate)

// ⚠️ 这里要排除 Home.vue 已经负责的模块（faq / hot_services）：
//    两处都渲染会出现"两个常见问题区块"，站长在后台关掉一个，另一个还在 ——
//    他会以为开关坏了。同一模块只能有一个渲染方：
//    · faq / hot_services 归 Home.vue（它有卡片/表格/榜单三种版式）
//    · announce / stats / vip / affiliate 归本组件
//    · vip（至尊代理）在分站上一律不渲染：那是平台招代理的入口，
//      出现在站长店里等于替平台拉代理、还暴露"站长是二级代理"。
const OWNED_BY_HOME = ['faq', 'hot_services']

const ordered = computed(() => {
  const mods = (appStore.homeModules || [])
    .filter(m => m && m.enabled !== false && !OWNED_BY_HOME.includes(m.key))
    .filter(m => !(appStore.isSubsite && m.key === 'vip'))
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

// 📊 96 期修：以前这里是「onMounted 里先判 isSubsite，不是分站就直接 return」。
//    isSubsite 来自 appStore.themeTemplate，而配置是异步拉的 ——
//    组件挂载时配置还没回来，就把请求整段跳过了，
//    结果所有分站首页固定显示「0 在售服务 / 0 累计订单 / 0 服务用户」，
//    看起来像站点坏了（实测 demostore 与自有域名都是 0）。
//    现在：挂载就拉，配置到位后再补拉一次（配置为分站时才补）。
const loadSiteStats = async () => {
  try {
    const r1 = await fetch('/api/public/site-stats')
    const d1 = await r1.json()
    if (d1.status === 'success' && d1.data) stats.value = d1.data
  } catch (e) {}
}
const loadHot = async () => {
  try {
    const r2 = await fetch('/api/public/hot-services')
    const d2 = await r2.json()
    if (d2.status === 'success' && Array.isArray(d2.data)) hot.value = d2.data
  } catch (e) {}
}

onMounted(() => { loadSiteStats(); loadHot(); })

// 配置到位后如果确认是分站、且统计还是空的，再补一次（覆盖慢网/慢接口的情况）
watch(isSubsite, (v) => {
  if (!v) return
  if (!stats.value || !stats.value.services) loadSiteStats()
  if (!hot.value.length) loadHot()
})
</script>
