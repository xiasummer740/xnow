<template>
  <div class="max-w-2xl mx-auto space-y-4 pb-24">
    <!-- 顶部 -->
    <div class="flex items-center gap-2">
      <button @click="$router.push('/my-site/overview')"
              class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs">← 返回</button>
      <h1 class="text-lg font-black text-white">开通新分站</h1>
    </div>

    <div v-if="loading" class="text-center py-16 text-slate-500 text-sm">读取中…</div>

    <template v-else>
      <!-- 🔒 不是代理 -->
      <section v-if="!isAgent" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-center">
        <div class="text-3xl mb-2">🔒</div>
        <h2 class="font-bold mb-2 text-white">还不能开分站</h2>
        <p class="text-xs text-slate-400 leading-relaxed">
          开分站需要先有至尊代理资格（¥{{ plan.agent_monthly }}/月）。<br />
          <span v-if="agentExpired" class="text-amber-400">你的代理已到期，续费后就能开站。</span>
        </p>
        <button @click="$router.push('/my-site/overview')"
                class="mt-4 px-4 py-2 rounded-xl bg-amber-500 text-slate-900 text-sm font-bold">去开通代理</button>
      </section>

      <template v-else>
        <!-- 💳 价格 -->
        <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <h2 class="font-bold text-sm text-white mb-3">价格</h2>
          <div class="rounded-xl bg-slate-950/70 border border-slate-800 divide-y divide-slate-800">
            <div class="flex items-center justify-between px-3 py-2.5">
              <span class="text-xs text-slate-300">至尊代理资格</span>
              <span class="text-xs text-slate-400">¥{{ plan.agent_monthly }} / 月<span class="text-slate-600">（不含分站）</span></span>
            </div>
            <div class="flex items-center justify-between px-3 py-2.5">
              <span class="text-xs text-slate-300 font-bold">每个分站</span>
              <span class="text-xs text-amber-300 font-bold">¥{{ plan.site_monthly }} / 月</span>
            </div>
            <div class="px-3 py-2.5 text-[11px] text-slate-400 leading-relaxed">
              想开几个开几个，每个站单独计费，互不影响。<br />
              <span class="text-emerald-400">名下第 1 个站送 {{ plan.trial_hours }} 小时试用</span>；
              第 2 个起立即扣 ¥{{ plan.site_monthly }}，有效期 {{ plan.renew_days }} 天。<br />
              到期未续费 → 停站，<b class="text-slate-300">数据保留</b>，续费立即恢复。
            </div>
          </div>
        </section>

        <!-- 💰 你的情况 -->
        <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <h2 class="font-bold text-sm text-white mb-3">这次开通</h2>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2.5">
              <div class="text-[10px] text-slate-500 mb-0.5">当前余额</div>
              <div class="text-base font-black text-slate-100">¥{{ balance.toFixed(2) }}</div>
            </div>
            <div class="rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2.5">
              <div class="text-[10px] text-slate-500 mb-0.5">{{ isFirst ? '本次费用' : '本次扣费' }}</div>
              <div class="text-base font-black" :class="isFirst ? 'text-emerald-400' : 'text-amber-300'">
                {{ isFirst ? '免费试用' : '¥' + plan.site_monthly }}
              </div>
            </div>
          </div>
          <p class="text-[11px] mt-2.5 leading-relaxed" :class="enough ? 'text-slate-400' : 'text-red-400'">
            <template v-if="isFirst">
              你还没有分站 → 这一个是 <b class="text-emerald-400">{{ plan.trial_hours }} 小时免费试用</b>，到期前续费 ¥{{ plan.site_monthly }} 用 {{ plan.renew_days }} 天。
            </template>
            <template v-else-if="enough">
              开通后余额 <b class="text-slate-200">¥{{ (balance - plan.site_monthly).toFixed(2) }}</b>。
              不够的话先去充值，别开完站没钱给客户发货。
            </template>
            <template v-else>
              余额不够（还差 ¥{{ (plan.site_monthly - balance).toFixed(2) }}），先充值再开通。
            </template>
          </p>
        </section>

        <!-- ✍️ 填信息 -->
        <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h2 class="font-bold text-sm text-white">分站信息</h2>

          <div>
            <label class="block text-xs text-slate-400 mb-1">站点名称 <span class="text-red-400">*</span></label>
            <input v-model="form.name" maxlength="20" placeholder="例：星辰增长工作室"
                   class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
            <p class="text-[10px] text-slate-500 mt-1">客户看到的就是这个名字，别写平台名。</p>
          </div>

          <div>
            <label class="block text-xs text-slate-400 mb-1">
              域名 <span class="text-slate-500">（可不填 —— 留空自动分配一个免费子域名）</span>
            </label>
            <input v-model="form.domain" placeholder="留空即可，之后也能换成自己的域名"
                   class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
            <p class="text-[10px] text-slate-500 mt-1">用自己的域名要另外在「域名」页绑定证书，没弄好之前先用免费子域名开卖。</p>
          </div>

          <div>
            <label class="block text-xs text-slate-400 mb-1">加价率</label>
            <div class="flex items-center gap-2">
              <input v-model.number="form.markup_pct" type="number" step="10" min="0" max="2000" inputmode="numeric"
                     class="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-right" />
              <span class="text-xs text-slate-400">%</span>
              <span class="text-[11px] text-slate-500">越高客户付得越多、你赚得越多</span>
            </div>
            <p class="text-[10px] text-amber-500/80 mt-1">
              填 <b>50</b> = 客户看到的价格是成本价 × 1.5。低于成本会被系统拦下。开通后可以随时改。
            </p>
          </div>
        </section>

        <!-- 提示 -->
        <p v-if="msg" class="text-xs px-1" :class="msgOk ? 'text-emerald-400' : 'text-red-400'">{{ msg }}</p>

        <div class="flex gap-2">
          <button v-if="!enough && !isFirst" @click="$router.push('/recharge')"
                  class="flex-1 py-3 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold">先去充值</button>
          <button @click="create" :disabled="busy || (!enough && !isFirst)"
                  class="flex-[2] py-3 rounded-xl font-black text-sm bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 disabled:opacity-40">
            {{ busy ? '开通中…' : (isFirst ? '领取 ' + plan.trial_hours + ' 小时试用' : '开通并扣 ¥' + plan.site_monthly) }}
          </button>
        </div>

        <p class="text-[10px] text-slate-500 leading-relaxed text-center">
          开通后去「我的分站」切换管理。<br />
          分站靠预存余额自动发货：客户下单 → 扣客户余额 + 按成本价扣你的余额，差额是你的利润；余额不足会自动拒单，不会欠款。
        </p>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(true)
const busy = ref(false)
const msg = ref('')
const msgOk = ref(true)

const plan = ref({ agent_monthly: 99, site_monthly: 99, trial_hours: 24, renew_days: 30 })
const balance = ref(0)
const mySiteCount = ref(0)
const isAgent = ref(false)
const agentExpired = ref(false)

const form = ref({ name: '', domain: '', markup_pct: 50 })

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('xnow_token') || ''}`, 'Content-Type': 'application/json' })

const isFirst = computed(() => mySiteCount.value === 0)
const enough = computed(() => balance.value >= Number(plan.value.site_monthly || 99))

const load = async () => {
  loading.value = true
  try {
    const [p, st] = await Promise.all([
      fetch('/api/billing/plan').then(r => r.json()),
      fetch('/api/billing/status', { headers: headers() }).then(r => r.json()),
    ])
    if (p.status === 'success') plan.value = { ...plan.value, ...p.data }
    if (st.status === 'success') {
      const d = st.data || {}
      balance.value = Number(d.user?.balance || 0)
      isAgent.value = ['agent', 'admin', 'super_admin'].includes(d.user?.role)
      mySiteCount.value = (d.sites || []).length
      const exp = Number(d.agent?.expire_at || d.user?.agent_expire_at || 0)
      agentExpired.value = !!exp && Date.now() >= exp
    }
  } catch (e) { /* 静默 */ }
  finally { loading.value = false }
}

const create = async () => {
  if (busy.value) return
  if (!form.value.name.trim()) { msg.value = '先给分站起个名字'; msgOk.value = false; return }
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
      msgOk.value = true
      msg.value = '✅ ' + (r.message || '开通成功')
      const id = r.data?.id || r.data?.site?.id
      if (id) localStorage.setItem('xnow_site_current', String(id))
      setTimeout(() => router.push('/my-site/overview'), 800)
    } else {
      msgOk.value = false
      msg.value = '❌ ' + (r.message || '开通失败')
    }
  } catch (e) {
    msgOk.value = false; msg.value = '❌ 开通失败：' + e.message
  } finally { busy.value = false }
}

onMounted(load)
</script>
