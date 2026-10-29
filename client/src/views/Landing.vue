<script setup lang="ts">
// 平台落地页（如 /c/tiktok）
// 为什么要这个页面：搜索引擎（和 AI 检索）进来的是服务端渲染的 /c/xxx，
// 但真人点进来后是 SPA 接管的 —— 如果这里没有对应路由，用户会看到一个 404。
// 内容和标题都由服务端那份保持一致（同事也保证了和下单页价格同口径）。
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { platformOf, labelOfSlug, PLATFORM_CN, typeOf, per1000 } from '../utils/platform'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref('')
type Row = { service: number; name: string; category: string; min: number; max: number; sell_price: number }
const rows = ref<Row[]>([])

const slug = computed(() => String(route.params.slug || ''))
const platform = computed(() => labelOfSlug(slug.value))
const platCn = computed(() => (platform.value ? PLATFORM_CN[platform.value] || platform.value : ''))

const mine = computed(() =>
  rows.value
    .filter((r) => platform.value && platformOf(`${r.category || ''} ${r.name || ''}`) === platform.value)
    .sort((a, b) => Number(a.sell_price) - Number(b.sell_price))
)
const groups = computed(() => {
  const m = new Map<string, Row[]>()
  for (const r of mine.value) {
    const t = typeOf(r.name)
    if (!m.has(t)) m.set(t, [])
    m.get(t)!.push(r)
  }
  return [...m.entries()].map(([label, list]) => ({
    label,
    count: list.length,
    min: Math.min(...list.map((x) => Number(x.sell_price) || Infinity)),
    sample: list.slice(0, 3),
  }))
})
const cheapest = computed(() => (mine.value.length ? Math.min(...mine.value.map((r) => Number(r.sell_price) || Infinity)) : 0))

const goOrder = () => router.push('/order')

onMounted(async () => {
  try {
    const r = await fetch('/api/services/public').then((x) => x.json())
    if (r?.status === 'success') rows.value = r.data || []
    else error.value = r?.message || '服务加载失败'
  } catch (e) {
    error.value = '网络异常，请刷新重试'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-200">
    <div class="max-w-3xl mx-auto px-5 py-10">
      <div v-if="!platform" class="text-center py-20">
        <div class="text-2xl font-black mb-3">页面不存在</div>
        <button class="text-cyan-400 underline" @click="router.push('/')">回首页</button>
      </div>

      <template v-else>
        <h1 class="text-2xl md:text-3xl font-black leading-snug">
          {{ platCn }} 增长服务
        </h1>
        <p class="text-slate-400 mt-3 leading-relaxed">
          <template v-if="loading">正在加载服务…</template>
          <template v-else-if="mine.length">
            共 <b class="text-slate-200">{{ mine.length }}</b> 个 {{ platCn }} 服务，价格按每 1000 个计算，
            最低 <b class="text-cyan-300">¥{{ per1000(cheapest) }}</b> 起，提交订单后自动开始处理。
          </template>
          <template v-else>这个平台暂时没有可售服务，看看其他平台？</template>
        </p>

        <div v-if="error" class="mt-4 text-sm text-red-300">{{ error }}</div>

        <div v-if="groups.length" class="mt-6 space-y-3">
          <div v-for="g in groups" :key="g.label" class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div class="flex items-center justify-between gap-3">
              <div class="font-bold text-sm">{{ platCn }} {{ g.label }}</div>
              <div class="text-[11px] text-slate-500">{{ g.count }} 个档位 · ¥{{ per1000(g.min) }} 起 / 1000</div>
            </div>
            <ul class="mt-2 space-y-1">
              <li v-for="s in g.sample" :key="s.service" class="text-[12px] text-slate-400 truncate">
                · {{ s.name }} — <span class="text-cyan-300">¥{{ per1000(Number(s.sell_price)) }}</span> / 1000
                <span class="text-slate-600">（{{ s.min }} 起）</span>
              </li>
            </ul>
          </div>
        </div>

        <button class="mt-7 w-full md:w-auto px-6 py-3 rounded-xl bg-cyan-400 text-slate-950 font-black text-sm"
                @click="goOrder">
          去下单 →
        </button>

        <div class="mt-10 text-[11px] text-slate-600 leading-relaxed">
          提示：先在「我的订单」里确认进度，大批量建议先小量测试。
        </div>
      </template>
    </div>
  </div>
</template>
