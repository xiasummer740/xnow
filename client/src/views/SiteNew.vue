<template>
  <div class="max-w-5xl mx-auto pb-28 lg:pb-8">
    <!-- 顶部 -->
    <div class="flex items-center gap-2 mb-4">
      <button @click="$router.push('/my-site/overview')"
              class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs">← 返回</button>
      <span class="text-[11px] text-slate-500">开分站</span>
    </div>

    <!-- ══ ① HERO：左文案 + 右产品预览 ══ -->
    <section class="hero-wrap relative overflow-hidden rounded-3xl border border-amber-500/20 px-5 py-8 sm:px-8 sm:py-10">
      <div class="pointer-events-none absolute inset-0 hero-glow"></div>
      <div class="pointer-events-none absolute inset-0 hero-dots opacity-30"></div>

      <div class="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div class="text-center lg:text-left">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-[11px] font-bold text-amber-200">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 hero-pulse"></span>开自己的分站
          </span>
          <h1 class="mt-4 text-[30px] sm:text-[40px] font-black leading-[1.12] tracking-tight">
            <span class="hero-title bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-transparent">你出客户，<br />剩下的系统全包</span>
          </h1>
          <p class="mt-3 text-sm sm:text-[15px] text-slate-300 leading-relaxed">
            商品、定价、下单、自动交付、对账 —— 全部自动。<br />
            <span class="text-slate-400">你只管把人带来，收钱的事系统替你做。</span>
          </p>

          <div class="mt-5 flex items-stretch rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden">
            <div v-for="(n, i) in heroStats" :key="n.d" class="flex-1 px-2 py-2.5" :class="i ? 'border-l border-slate-800' : ''">
              <div class="text-base sm:text-lg font-black leading-none" :class="n.c">{{ n.k }}</div>
              <div class="text-[10px] text-slate-500 mt-1">{{ n.d }}</div>
            </div>
          </div>

          <div class="mt-5 flex flex-col sm:flex-row gap-2">
            <button @click="jumpToForm" class="hero-cta relative overflow-hidden px-8 py-3.5 rounded-2xl font-black text-[15px] text-slate-900
                     bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500
                     shadow-[0_10px_40px_-8px_rgba(245,158,11,0.65)] ring-1 ring-amber-200/50 active:scale-[0.99] transition">
              <span class="relative z-10">开通我的分站 · ¥{{ plan.site_monthly }}/月 →</span>
            </button>
            <button @click="jumpToForm" class="hidden sm:inline-flex px-5 py-3.5 rounded-2xl text-[13px] font-bold text-slate-300 bg-slate-800/70 border border-slate-700">
              只填三样就够
            </button>
          </div>
        </div>

        <!-- 产品预览 -->
        <div class="mx-auto w-full max-w-[330px] lg:max-w-none">
          <div class="rounded-2xl border border-slate-700/70 bg-slate-950/85 overflow-hidden shadow-2xl shadow-black/60 hero-tilt">
            <div class="flex items-center gap-1.5 px-3 py-2 bg-slate-900/90 border-b border-slate-800">
              <span class="w-2 h-2 rounded-full bg-rose-500/70"></span>
              <span class="w-2 h-2 rounded-full bg-amber-500/70"></span>
              <span class="w-2 h-2 rounded-full bg-emerald-500/70"></span>
              <span class="ml-2 flex-1 truncate text-[9px] text-slate-500">your-brand.com</span>
            </div>
            <div class="px-3 py-3">
              <div class="flex items-center gap-1.5">
                <span class="w-4 h-4 rounded-md bg-gradient-to-br from-amber-400 to-orange-500"></span>
                <span class="text-[10px] font-bold text-slate-200">你的站名</span>
                <span class="ml-auto text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">营业中</span>
              </div>
              <div class="mt-2.5 space-y-1.5">
                <div v-for="row in previewRows" :key="row.n" class="flex items-center justify-between rounded-lg bg-slate-900/80 border border-slate-800 px-2 py-2">
                  <span class="flex items-center gap-1.5 min-w-0">
                    <span class="w-1.5 h-1.5 rounded-full" :class="row.dot"></span>
                    <span class="text-[9px] text-slate-300 truncate">{{ row.n }}</span>
                  </span>
                  <span class="text-[10px] font-bold text-amber-300 shrink-0">¥{{ row.p }}</span>
                </div>
              </div>
              <div class="mt-2.5 flex items-center justify-between rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-2 py-2">
                <span class="text-[9px] font-black text-slate-900">立即下单</span>
                <span class="text-[8px] font-bold text-slate-900/70">自动交付</span>
              </div>
              <div class="mt-2 flex items-center justify-between text-[8px] text-slate-500">
                <span>今天的订单 3 笔</span><span class="text-emerald-400">已到账 ¥293</span>
              </div>
            </div>
          </div>
          <p class="mt-2.5 text-center text-[10px] text-slate-500">客户看到的就是这样：你的站名、你定的价</p>

          <!-- 回本小卡：右下角空着就浪费了 -->
          <div class="mt-3 rounded-2xl border border-emerald-800/40 bg-emerald-950/25 px-4 py-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-[11px] text-slate-400">月费 ¥{{ plan.site_monthly }} 怎么回本</div>
                <div class="text-[13px] font-bold text-emerald-300 mt-0.5">卖 5 单就回本，第 6 单开始纯赚</div>
              </div>
              <div class="text-right shrink-0 ml-3">
                <div class="text-xl font-black text-emerald-400 leading-none">5<span class="text-[11px] font-bold text-slate-500 ml-0.5">单</span></div>
                <div class="text-[9px] text-slate-500 mt-1">按每单赚 ¥20</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══ ② 卖点 + 算账 ══ -->
    <section class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="f in features" :key="f.t" class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <span class="inline-grid place-items-center w-9 h-9 rounded-xl text-lg ring-1 ring-inset ring-white/5" :class="f.bg">{{ f.i }}</span>
        <div class="mt-2.5 text-sm font-bold text-slate-100">{{ f.t }}</div>
        <div class="text-[11px] text-slate-500 leading-relaxed mt-1">{{ f.d }}</div>
      </div>
      <div class="rounded-2xl border border-emerald-800/40 bg-emerald-950/25 p-4 sm:col-span-2 lg:col-span-4">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div class="text-sm font-bold text-emerald-300 shrink-0">一单能赚多少</div>
          <div class="flex-1 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-xl bg-slate-950/70 border border-slate-800 py-2">
              <div class="text-[10px] text-slate-500">拿货价</div>
              <div class="text-sm font-black text-slate-300">¥25.00</div>
            </div>
            <div class="rounded-xl bg-slate-950/70 border border-slate-800 py-2">
              <div class="text-[10px] text-slate-500">你卖</div>
              <div class="text-sm font-black text-slate-100">¥45.00</div>
            </div>
            <div class="rounded-xl bg-emerald-500/15 border border-emerald-600/40 py-2">
              <div class="text-[10px] text-emerald-400/80">净赚</div>
              <div class="text-sm font-black text-emerald-400">¥20.00</div>
            </div>
          </div>
          <p class="text-[11px] text-slate-400 leading-relaxed sm:max-w-[230px]">
            一天 5 单就把 ¥{{ plan.site_monthly }} 月费赚回来。价格你定（0%～1900%），系统会拦住亏本设置。
          </p>
        </div>
      </div>
    </section>

    <!-- ══ ③ 三步 + 表单：左右并排 ══ -->
    <section ref="formEl" class="mt-4 grid gap-3 lg:grid-cols-2">
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 class="text-sm font-bold text-white mb-3">三步开张</h2>
        <div class="space-y-3">
          <div v-for="(s, i) in steps" :key="s.t" class="flex gap-3">
            <span class="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-900 text-[11px] font-black grid place-items-center">{{ i + 1 }}</span>
            <div>
              <div class="text-[13px] font-bold text-slate-100">{{ s.t }}</div>
              <div class="text-[11px] text-slate-500 leading-relaxed">{{ s.d }}</div>
            </div>
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-800">
          <div class="text-[11px] text-slate-500 mb-1.5">适合谁</div>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="w in who" :key="w" class="text-[10px] px-2 py-1 rounded-full bg-slate-800/70 text-slate-300">{{ w }}</span>
          </div>
        </div>

        <!-- 开站后立刻能用（填满左栏高度，也顺手回答了"开了能干嘛"） -->
        <div class="mt-4 pt-3 border-t border-slate-800">
          <div class="text-[11px] text-slate-500 mb-1.5">开通后立刻能用</div>
          <ul class="space-y-1.5">
            <li v-for="g in gains" :key="g" class="flex gap-2 text-[11px] text-slate-300 leading-relaxed">
              <span class="text-emerald-400 shrink-0">✓</span><span>{{ g }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 class="text-sm font-bold text-white mb-3">填三样就能开</h2>
        <div class="space-y-3">
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">站点名称 <span class="text-red-400">*</span></label>
            <input v-model="form.name" maxlength="20" placeholder="例：星辰增长工作室"
                   class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">域名 <span class="text-slate-500">（留空自动分配免费子域名）</span></label>
            <input v-model="form.domain" placeholder="之后也能换成自己的域名"
                   class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">加价率 <span class="text-slate-500">（填 80 = 客户价 × 1.8）</span></label>
            <div class="flex items-center gap-2">
              <input v-model.number="form.markup_pct" type="number" step="10" min="0" max="1900" inputmode="numeric"
                     class="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-right" />
              <span class="text-xs text-slate-400">%</span>
              <span class="text-[10px] text-amber-500/80">开通后随时能改</span>
            </div>
          </div>
        </div>

        <div class="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 space-y-1">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-slate-500">当前余额</span><span class="text-slate-300">¥{{ balance.toFixed(2) }}</span>
          </div>
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-slate-500">本次扣费</span><span class="text-amber-300 font-bold">¥{{ plan.site_monthly }}</span>
          </div>
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-slate-500">开通后余额</span>
            <span :class="enough ? 'text-slate-300' : 'text-red-400'">
              {{ enough ? '¥' + (balance - plan.site_monthly).toFixed(2) : '还差 ¥' + (plan.site_monthly - balance).toFixed(2) }}
            </span>
          </div>
        </div>

        <button v-if="!enough" @click="$router.push('/recharge')"
                class="mt-3 w-full py-3 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold">先去充值</button>
        <button v-else @click="create" :disabled="busy"
                class="hero-cta relative overflow-hidden mt-3 w-full py-3.5 rounded-xl font-black text-sm text-slate-900
                       bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500
                       shadow-[0_10px_30px_-10px_rgba(245,158,11,0.7)] disabled:opacity-50">
          <span class="relative z-10">{{ busy ? '开通中…' : '开通我的分站 · ¥' + plan.site_monthly + '/月' }}</span>
        </button>
        <p v-if="msg" class="text-[11px] mt-2 text-center" :class="msgOk ? 'text-emerald-400' : 'text-red-400'">{{ msg }}</p>
        <p class="mt-2 text-[10px] text-slate-500 text-center">有效期 {{ plan.renew_days }} 天 · 到期未续费站点下线，数据保留</p>
      </div>
    </section>

    <!-- ══ ④ FAQ：两列 ══ -->
    <section class="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 class="text-sm font-bold text-white mb-3">常见问题</h2>
      <div class="grid gap-x-6 sm:grid-cols-2">
        <details v-for="q in faq" :key="q.q" class="border-b border-slate-800 py-2">
          <summary class="text-[11px] font-bold text-slate-200 cursor-pointer list-none flex items-start gap-2">
            <span class="text-amber-500 shrink-0">＋</span><span>{{ q.q }}</span>
          </summary>
          <p class="text-[11px] text-slate-400 leading-relaxed mt-1.5 pl-5">{{ q.a }}</p>
        </details>
      </div>
    </section>

    <!-- 手机端吸底（桌面已有表单内的按钮，不重复出现） -->
    <div class="lg:hidden sticky bottom-0 z-30 -mx-4 px-4 py-3 mt-4 rounded-t-2xl border-t border-slate-800 bg-slate-950/95 backdrop-blur">
      <div class="flex items-center justify-between text-[10px] mb-1.5 pr-24">
        <span class="text-slate-500">余额 ¥{{ balance.toFixed(2) }}</span>
        <span :class="enough ? 'text-slate-400' : 'text-red-400'">
          {{ enough ? '开通后剩 ¥' + (balance - plan.site_monthly).toFixed(2) : '余额不够，还差 ¥' + (plan.site_monthly - balance).toFixed(2) }}
        </span>
      </div>
      <button v-if="!enough" @click="$router.push('/recharge')"
              class="w-full py-3 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold">先去充值</button>
      <button v-else @click="create" :disabled="busy"
              class="w-full py-3 rounded-xl font-black text-sm bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 disabled:opacity-50">
        {{ busy ? '开通中…' : '开通我的分站 · ¥' + plan.site_monthly + '/月' }}
      </button>
      <p v-if="msg" class="text-[10px] mt-1.5 text-center" :class="msgOk ? 'text-emerald-400' : 'text-red-400'">{{ msg }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const busy = ref(false)
const msg = ref('')
const msgOk = ref(true)
const formEl = ref(null)

const plan = ref({ site_monthly: 99, renew_days: 30 })
const balance = ref(0)
const form = ref({ name: '', domain: '', markup_pct: 80 })

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('xnow_token') || ''}`, 'Content-Type': 'application/json' })
const enough = computed(() => balance.value >= Number(plan.value.site_monthly || 99))

const heroStats = [
  { k: '¥99', d: '每月 / 每站', c: 'text-amber-300' },
  { k: '10 分钟', d: '开完就能卖', c: 'text-emerald-400' },
  { k: '不抽成', d: '全归你', c: 'text-slate-100' },
]

const previewRows = [
  { n: 'TikTok 千粉', p: '45', dot: 'bg-pink-400' },
  { n: 'IG 万粉', p: '180', dot: 'bg-violet-400' },
  { n: 'YouTube 播放', p: '68', dot: 'bg-sky-400' },
]

const features = [
  { i: '🎨', t: '你的品牌', d: '站名、域名、模板、配色都是你的，客户看不出背后是谁。', bg: 'bg-pink-500/15 text-pink-300' },
  { i: '💳', t: '钱进你账户', d: '配自己的收款商户，客户充值的钱直接到手。', bg: 'bg-sky-500/15 text-sky-300' },
  { i: '⚡', t: '自动交付', d: '下单即发、状态自动同步，不用盯不用手工。', bg: 'bg-amber-500/15 text-amber-300' },
  { i: '📈', t: '价格你定', d: '整站加价、按分类调、单服务单独定。', bg: 'bg-violet-500/15 text-violet-300' },
]

const steps = [
  { t: '开通（1 分钟）', d: '填个站名就开；没想好域名先给免费子域名。' },
  { t: '装修（10 分钟）', d: '6 套模板 × 12 配色，文案、模块、背景都能改。' },
  { t: '配收款 → 开卖', d: '填自己的支付商户即可在线收款；不配也能手动加余额。' },
]

const who = ['有社媒/出海客户', '做投放代运营', '想长期接单', '想换个顺手后台']

const gains = [
  '6 套模板 + 12 种配色，一分钟换完风格',
  '首页模块开关和排序，文案自己改',
  '整站/分类/单服务三级定价，客户分组还能再打折',
  '客户、订单、收益、对账全在一个后台',
  '可绑自己的域名，证书自动签发',
]

const faq = [
  { q: '需要懂技术吗？', a: '不用。开站、装修、上架全是点选，没有一处要写代码。' },
  { q: '能用自己的域名吗？', a: '能。域名解析过来绑定即可，证书自动签发，不用配服务器。' },
  { q: '客户充值的钱进谁的口袋？', a: '进你的。你在分站里配自己的收款商户，钱不经过平台。' },
  { q: '卖不动怎么办？', a: '每月固定 ¥99，不抽成、不按单收费。不想做了到期不续费，数据保留。' },
  { q: '能开几个分站？', a: '想开几个开几个，每个 ¥99/月，定价、客户、收款各自独立。' },
  { q: '客户会不会看到平台？', a: '不会。页面、域名、邮件都是你的品牌。' },
]

const jumpToForm = () => {
  formEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const load = async () => {
  try {
    const [p, st] = await Promise.all([
      fetch('/api/billing/plan').then(r => r.json()),
      fetch('/api/billing/status', { headers: headers() }).then(r => r.json()),
    ])
    if (p.status === 'success') plan.value = { ...plan.value, ...p.data }
    if (st.status === 'success') balance.value = Number(st.data?.user?.balance || 0)
  } catch (e) { /* 静默 */ }
}

const create = async () => {
  if (busy.value) return
  if (!form.value.name.trim()) { msgOk.value = false; msg.value = '先给分站起个名字'; formEl.value?.scrollIntoView({ behavior: 'smooth' }); return }
  busy.value = true; msg.value = ''
  try {
    const r = await fetch('/api/sites', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        name: form.value.name.trim(),
        domain: form.value.domain.trim(),
        markup_pct: Number(form.value.markup_pct),
      }),
    }).then(x => x.json())
    if (r.status === 'success') {
      msgOk.value = true; msg.value = '✅ ' + (r.message || '开通成功')
      const id = r.data?.id
      if (id) localStorage.setItem('xnow_site_current', String(id))
      setTimeout(() => router.push('/my-site/overview'), 900)
    } else {
      msgOk.value = false
      msg.value = '❌ ' + (r.message || '开通失败')
      if (String(r.message || '').includes('余额不足')) setTimeout(() => router.push('/recharge'), 1200)
    }
  } catch (e) { msgOk.value = false; msg.value = '❌ ' + e.message }
  finally { busy.value = false }
}

onMounted(load)
</script>

<style scoped>
/* 与「我的分站」hero 同一套视觉语言 */
.hero-wrap {
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(245, 158, 11, 0.11) 0%, rgba(15, 23, 42, 0) 55%),
    radial-gradient(80% 60% at 50% 100%, rgba(16, 185, 129, 0.09) 0%, rgba(15, 23, 42, 0) 60%),
    #0b1220;
}
.hero-glow {
  background: radial-gradient(60% 40% at 50% 12%, rgba(251, 191, 36, 0.15), transparent 70%);
  animation: heroBreathe 7s ease-in-out infinite;
}
.hero-dots {
  background-image: radial-gradient(rgba(148, 163, 184, 0.35) 1px, transparent 1px);
  background-size: 16px 16px;
  mask-image: radial-gradient(70% 60% at 50% 40%, #000 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(70% 60% at 50% 40%, #000 30%, transparent 75%);
}
.hero-title { filter: drop-shadow(0 0 26px rgba(245, 158, 11, 0.3)); }
.hero-pulse { animation: heroPulse 2s ease-in-out infinite; }
.hero-tilt { transform: perspective(900px) rotateX(4deg); transition: transform .5s ease; }
.hero-tilt:hover { transform: perspective(900px) rotateX(0) translateY(-2px); }
.hero-cta::after {
  content: ''; position: absolute; top: 0; bottom: 0; width: 40%; left: -60%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.55), transparent);
  transform: skewX(-18deg); animation: heroShine 3.6s ease-in-out infinite;
}
@keyframes heroBreathe { 0%,100% { opacity: .75 } 50% { opacity: 1 } }
@keyframes heroPulse { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: .45; transform: scale(.85) } }
@keyframes heroShine { 0% { left: -60% } 55% { left: 130% } 100% { left: 130% } }
@media (prefers-reduced-motion: reduce) {
  .hero-glow, .hero-pulse, .hero-cta::after { animation: none !important; }
  .hero-tilt { transform: none; }
}
</style>
