<template>
  <div class="max-w-2xl mx-auto pb-28">
    <!-- ── 顶部 ── -->
    <div class="flex items-center gap-2 mb-4">
      <button @click="$router.push('/my-site/overview')"
              class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs">← 返回</button>
      <span class="text-[11px] text-slate-500">开分站</span>
    </div>

    <!-- ── Hero：一句话说清"你出客户，系统出货" ── -->
    <section class="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-slate-900 to-slate-900 p-5 mb-4">
      <div class="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-amber-400/10 blur-2xl"></div>
      <p class="text-[11px] font-bold text-amber-300 tracking-wide mb-1.5">开自己的分站</p>
      <h1 class="text-2xl font-black text-white leading-tight mb-2">你出客户，剩下的系统全包</h1>
      <p class="text-xs text-slate-300 leading-relaxed">
        商品、定价、下单、自动交付、对账 —— 全自动。<br />
        你只管把人带来，收钱的事系统替你做。
      </p>

      <div class="grid grid-cols-3 gap-2 mt-4">
        <div class="rounded-xl bg-slate-950/60 border border-slate-800 px-2 py-2 text-center">
          <div class="text-[15px] font-black text-amber-300">¥{{ plan.site_monthly }}</div>
          <div class="text-[9px] text-slate-500 mt-0.5">每月 / 每站</div>
        </div>
        <div class="rounded-xl bg-slate-950/60 border border-slate-800 px-2 py-2 text-center">
          <div class="text-[15px] font-black text-emerald-400">10 分钟</div>
          <div class="text-[9px] text-slate-500 mt-0.5">开完就能卖</div>
        </div>
        <div class="rounded-xl bg-slate-950/60 border border-slate-800 px-2 py-2 text-center">
          <div class="text-[15px] font-black text-slate-100">不抽成</div>
          <div class="text-[9px] text-slate-500 mt-0.5">卖多少都是你的</div>
        </div>
      </div>
    </section>

    <!-- ── 四个卖点 ── -->
    <section class="grid grid-cols-2 gap-2.5 mb-4">
      <div v-for="f in features" :key="f.t"
           class="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
        <div class="text-lg mb-1">{{ f.i }}</div>
        <div class="text-xs font-bold text-slate-100 mb-1">{{ f.t }}</div>
        <div class="text-[10px] text-slate-500 leading-relaxed">{{ f.d }}</div>
      </div>
    </section>

    <!-- ── 算一笔账 ── -->
    <section class="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-4 mb-4">
      <h2 class="text-sm font-bold text-emerald-300 mb-2">一单能赚多少，直接算给你看</h2>
      <div class="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-1.5">
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-slate-400">TikTok 千粉 · 你的拿货价</span>
          <span class="text-slate-300 font-bold">¥25.00</span>
        </div>
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-slate-400">你卖给客户</span>
          <span class="text-slate-100 font-bold">¥45.00</span>
        </div>
        <div class="h-px bg-slate-800 my-1"></div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-emerald-300 font-bold">你净赚</span>
          <span class="text-emerald-400 font-black">¥20.00 / 单</span>
        </div>
      </div>
      <p class="text-[10px] text-slate-400 mt-2 leading-relaxed">
        一天卖 5 单就把 ¥{{ plan.site_monthly }} 的月费赚回来了。<br />
        价格全由你定（拿货价上加 0% ～ 1900%），系统会拦住会让你亏本的设置。
      </p>
    </section>

    <!-- ── 三步开店 ── -->
    <section class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 mb-4">
      <h2 class="text-sm font-bold text-white mb-3">三步开张</h2>
      <div class="space-y-2.5">
        <div v-for="(s, i) in steps" :key="s.t" class="flex gap-2.5">
          <span class="shrink-0 w-5 h-5 rounded-full bg-amber-500 text-slate-900 text-[10px] font-black grid place-items-center">{{ i + 1 }}</span>
          <div>
            <div class="text-xs font-bold text-slate-100">{{ s.t }}</div>
            <div class="text-[10px] text-slate-500 leading-relaxed">{{ s.d }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 适合谁 ── -->
    <section class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 mb-4">
      <h2 class="text-sm font-bold text-white mb-2">适合谁</h2>
      <ul class="space-y-1.5">
        <li v-for="w in who" :key="w" class="flex gap-2 text-[11px] text-slate-300 leading-relaxed">
          <span class="text-emerald-400 shrink-0">✓</span><span>{{ w }}</span>
        </li>
      </ul>
    </section>

    <!-- ── 表单 ── -->
    <section class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 mb-4">
      <h2 class="text-sm font-bold text-white mb-3">填三样就能开</h2>

      <div class="space-y-3">
        <div>
          <label class="block text-xs text-slate-400 mb-1">站点名称 <span class="text-red-400">*</span></label>
          <input v-model="form.name" maxlength="20" placeholder="例：星辰增长工作室"
                 class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          <p class="text-[10px] text-slate-500 mt-1">客户看到的就是这个名字。</p>
        </div>

        <div>
          <label class="block text-xs text-slate-400 mb-1">域名 <span class="text-slate-500">（可不填，留空自动分配免费子域名）</span></label>
          <input v-model="form.domain" placeholder="留空即可，之后也能换成自己的域名"
                 class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
        </div>

        <div>
          <label class="block text-xs text-slate-400 mb-1">加价率</label>
          <div class="flex items-center gap-2">
            <input v-model.number="form.markup_pct" type="number" step="10" min="0" max="1900" inputmode="numeric"
                   class="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-right" />
            <span class="text-xs text-slate-400">%</span>
            <span class="text-[11px] text-slate-500">填 80 = 客户价是拿货价 × 1.8</span>
          </div>
          <p class="text-[10px] text-amber-500/80 mt-1">开通后随时能改，也能给单个服务单独定价。</p>
        </div>
      </div>
    </section>

    <!-- ── FAQ ── -->
    <section class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 mb-4">
      <h2 class="text-sm font-bold text-white mb-2">常见问题</h2>
      <details v-for="q in faq" :key="q.q" class="border-b border-slate-800 last:border-0 py-2">
        <summary class="text-[11px] font-bold text-slate-200 cursor-pointer list-none flex items-center justify-between gap-2">
          <span>{{ q.q }}</span><span class="text-slate-600 shrink-0">＋</span>
        </summary>
        <p class="text-[10px] text-slate-400 leading-relaxed mt-1.5">{{ q.a }}</p>
      </details>
    </section>

    <!-- ── 底部 CTA ── -->
    <div class="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-slate-950/95 backdrop-blur px-4 py-3">
      <div class="max-w-2xl mx-auto pr-14">
        <div class="flex items-center justify-between text-[10px] mb-1.5">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const busy = ref(false)
const msg = ref('')
const msgOk = ref(true)

const plan = ref({ site_monthly: 99, renew_days: 30 })
const balance = ref(0)
const form = ref({ name: '', domain: '', markup_pct: 80 })

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('xnow_token') || ''}`, 'Content-Type': 'application/json' })
const enough = computed(() => balance.value >= Number(plan.value.site_monthly || 99))

const features = [
  { i: '🎨', t: '你的品牌', d: '自己的站名、域名、模板、配色。客户看到的是你，不是别人。' },
  { i: '💳', t: '钱进你账户', d: '配你自己的收款商户，客户充值的钱直接到手，不用等结算。' },
  { i: '⚡', t: '全自动交付', d: '客户下单 → 系统自动发货 → 订单状态自动同步，不用盯、不用手工。' },
  { i: '📈', t: '价格你说了算', d: '整站加价、按分类调、单个服务单独定，客户还能分组打折。' },
]

const steps = [
  { t: '开通（1 分钟）', d: '填个站名就开。没想好域名？先分配免费子域名，之后随时换。' },
  { t: '装修（10 分钟）', d: '6 套模板 × 12 种配色，首页文案、模块开关、背景图都能自己改。' },
  { t: '配收款 → 开卖', d: '填上自己的支付商户，客户就能在线充值；不配也能手动给客户加余额。' },
]

const who = [
  '手上已经有社媒 / 出海客户，想多一层变现的人',
  '做投放、做代运营，想给客户一个"自己的下单站"',
  '想把零散接单做成长期生意，不想天天手工报价',
  '已经有站但嫌后台难用，想换一套顺手的人',
]

const faq = [
  { q: '需要懂技术吗？', a: '不用。开站、装修、上架全是点选，没有一处要写代码。' },
  { q: '能用自己的域名吗？', a: '能。在「域名」页把域名解析过来，绑定后证书自动签发，全程不用你配服务器。' },
  { q: '客户充值的钱进谁的口袋？', a: '进你的。你在分站里配自己的收款商户，钱不经过平台，也不用找人提现。' },
  { q: '卖不动怎么办？', a: '每月固定 ¥99，不抽成、不按单收费。卖一单就把月费赚回来；不想做了到期不续费即可，数据保留。' },
  { q: '能开几个分站？', a: '想开几个开几个，每个 ¥99/月，定价、客户、收款各自独立。' },
  { q: '客户会不会看到平台？', a: '不会。分站的页面、域名、邮件都是你的品牌，平台不会出现在客户眼前。' },
]

const load = async () => {
  try {
    const [p, st] = await Promise.all([
      fetch('/api/billing/plan').then(r => r.json()),
      fetch('/api/billing/status', { headers: headers() }).then(r => r.json()),
    ])
    if (p.status === 'success') plan.value = { ...plan.value, ...p.data }
    if (st.status === 'success') balance.value = Number(st.data?.user?.balance || 0)
  } catch (e) { /* 静默：拿不到就用默认价 */ }
}

const create = async () => {
  if (busy.value) return
  if (!form.value.name.trim()) { msgOk.value = false; msg.value = '先给分站起个名字'; return }
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
