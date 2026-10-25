<template>
  <!-- 💳 计费卡（87 期）：代理资格 + 分站月费 + 到期提示 -->
  <div v-if="showAgentCard || sites.length" class="space-y-3 mb-5">
    <!-- 代理资格：只在"需要你动手"时出现（未开通 / 已过期 / 有到期时间）。
         早期代理是长期有效、不计月费的，给他看一张挂着「续费 ¥99」的卡纯属添乱。 -->
    <div v-if="showAgentCard" class="rounded-2xl border p-4"
         :class="isAgent && agentExpired ? 'border-rose-800/60 bg-rose-950/20' : (isAgent ? 'border-emerald-800/60 bg-emerald-950/20' : 'border-amber-700/60 bg-amber-950/20')">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold">至尊代理</span>
            <span v-if="isStaff" class="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">管理员</span>
            <span v-else-if="isAgent && !agentExpired" class="text-[10px] px-2 py-0.5 rounded bg-emerald-800/60 text-emerald-200">已开通</span>
            <span v-else-if="agentExpired" class="text-[10px] px-2 py-0.5 rounded bg-rose-800/60 text-rose-200">已过期</span>
            <span v-else class="text-[10px] px-2 py-0.5 rounded bg-amber-800/60 text-amber-100">未开通</span>
          </div>
          <p v-if="isStaff" class="text-[11px] text-slate-400 mt-1.5">管理员不受计费限制</p>
          <template v-else-if="isAgent && !agent.expire_at">
            <p class="text-[12px] text-slate-300 mt-1.5">
              已开通 <span class="text-emerald-300 font-bold">长期有效</span>（早期代理，不计月费）
            </p>
            <p class="text-[11px] text-slate-500 mt-1">代理资格只影响进货价（8 折），分站另计 ¥{{ plan.site_monthly }}/月</p>
          </template>
          <template v-else-if="isAgent && agentExpireText">
            <p class="text-[12px] text-slate-300 mt-1.5 tabular-nums">
              到期：{{ agentExpireText }}
              <span v-if="agentDaysLeft !== null" class="ml-1"
                    :class="agentDaysLeft <= 3 ? 'text-rose-300 font-bold' : 'text-slate-400'">
                （剩 {{ agentDaysLeft > 0 ? agentDaysLeft : 0 }} 天）
              </span>
            </p>
            <p class="text-[11px] text-slate-500 mt-1">到期只是进货价回到原价，分站照常运营；续费即恢复 8 折</p>
          </template>
          <template v-else>
            <p class="text-[12px] text-slate-300 mt-1.5">
              可选：<b class="text-amber-300">¥{{ plan.agent_monthly }} / 月</b> 让进货价打 8 折
            </p>
            <p class="text-[11px] text-slate-500 mt-1">不开也能开分站；开了只是每单成本低 20%。代理费不含分站，每个分站另外 ¥{{ plan.site_monthly }}/月</p>
          </template>
        </div>
        <button v-if="!isStaff" @click="subscribeAgent" :disabled="busy"
                class="shrink-0 px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap disabled:opacity-50"
                :class="isAgent && !agentExpired ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900'">
          {{ busy ? '处理中…' : (isAgent && !agentExpired ? `续费 ¥${plan.agent_monthly}` : `开通 ¥${plan.agent_monthly}/月`) }}
        </button>
      </div>
    </div>

    <!-- 分站月费 -->
    <div v-if="sites.length" class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="font-bold text-sm">分站月费 <span class="text-slate-500 font-normal">¥{{ plan.site_monthly }}/月 / 站</span></div>
        <div class="text-[11px] text-slate-500 tabular-nums">余额 ¥{{ balanceText }}</div>
      </div>

      <div v-for="s in sites" :key="s.id" class="py-2.5 border-t border-slate-800/70 first:border-t-0">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-semibold truncate">{{ s.name }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded"
                    :class="planBadge(s).cls">{{ planBadge(s).text }}</span>
            </div>
            <a :href="`https://${s.custom_domain || s.domain}`" target="_blank" rel="noopener"
               class="inline-flex items-center gap-1 mt-1 max-w-full text-[13px] font-semibold text-cyan-300 hover:text-cyan-200 underline decoration-cyan-400/40 hover:decoration-cyan-300">
              <span class="truncate">{{ s.custom_domain || s.domain }}</span>
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
            </a>
            <p class="text-[12px] mt-1 tabular-nums" :class="isStopped(s) ? 'text-rose-300 font-bold' : (isTrial(s) ? 'text-amber-300' : 'text-slate-300')">
              {{ statusLine(s) }}
            </p>
          </div>
          <button @click="renewSite(s)" :disabled="busy"
                  class="shrink-0 px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap disabled:opacity-50"
                  :class="isStopped(s) ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white' : 'bg-slate-700 hover:bg-slate-600'">
            {{ busy ? '…' : `续费 ¥${plan.site_monthly}` }}
          </button>
        </div>
      </div>

      <p v-if="balanceShort" class="text-[11px] text-amber-400 mt-2">
        ⚠️ 余额不足 ¥{{ plan.site_monthly }}，请先到「充值」页面充值，否则到期后会停站。
      </p>
    </div>

    <p v-if="msg" class="text-[12px]" :class="msgOk ? 'text-emerald-400' : 'text-rose-400'">{{ msg }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  agentCard: { type: Boolean, default: false },
})
import { useRouter } from 'vue-router'

const emit = defineEmits(['changed', 'status'])
const router = useRouter()

const plan = ref({ agent_monthly: 99, site_monthly: 99, trial_hours: 24 })
const me = ref({ role: 'user', balance: 0 })
const agent = ref({ active: false, expire_at: 0, expire_text: '', days_left: null })
const sites = ref([])
const busy = ref(false)
const msg = ref('')
const msgOk = ref(false)

const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('xnow_token') || ''}`,
})

const isStaff = computed(() => ['admin', 'super_admin'].includes(me.value.role))
const isAgent = computed(() => me.value.role === 'agent')
// 🚫 110 期（祥哥定调）：「分站没必要放代理」——
//    代理跟分站是两件事（代理只管进货价 8 折），要开通/续费代理去侧边栏「至尊代理」页，
//    这里只留分站月费。所以代理卡默认不显示，只有显式传 agent-card 才显示。
const showAgentCard = computed(() => {
  if (!props.agentCard) return false                 // 默认整页不出现代理卡
  if (isStaff.value) return false
  if (!isAgent.value) return false                   // 不再把「未开通」当成开通入口塞在这里
  return agentExpired.value || Number(agent.value.expire_at || 0) > 0
})
const agentExpired = computed(() => isAgent.value && agent.value.expire_at > 0 && agent.value.expire_at <= Date.now())
const agentExpireText = computed(() => agent.value.expire_text || '')
const agentDaysLeft = computed(() => (agent.value.expire_at ? agent.value.days_left : null))
const balanceText = computed(() => Number(me.value.balance || 0).toFixed(2))
const balanceShort = computed(() => Number(me.value.balance || 0) < Number(plan.value.site_monthly || 99))

const isTrial = (s) => s.plan === 'trial'
const isStopped = (s) => s.status === 'expired' || s.needs_payment
const planBadge = (s) => {
  if (s.status === 'expired') return { text: '已停站', cls: 'bg-rose-800/60 text-rose-200' }
  if (s.plan === 'trial') return { text: '试用中', cls: 'bg-amber-800/60 text-amber-100' }
  if (s.plan === 'paid') return { text: '已付费', cls: 'bg-emerald-800/60 text-emerald-200' }
  return { text: '老站·不计费', cls: 'bg-slate-700 text-slate-300' }
}
const statusLine = (s) => {
  if (s.status === 'expired') return '⛔ 已停站（数据保留，续费立即恢复）'
  if (!s.expire_at) return '永不过期'
  if (s.plan === 'trial') {
    const leftMs = s.expire_at - Date.now()
    const h = Math.max(0, Math.floor(leftMs / 3600e3))
    return `🎁 试用剩 ${h} 小时 —— 到期即停站，续费 ¥${plan.value.site_monthly} 用 30 天`
  }
  return `到期：${s.expire_text}（剩 ${Math.max(0, s.days_left ?? 0)} 天）`
}

const load = async () => {
  try {
    const [p, st] = await Promise.all([
      fetch('/api/billing/plan').then(r => r.json()),
      fetch('/api/billing/status', { headers: headers() }).then(r => r.json()),
    ])
    if (p.status === 'success') plan.value = p.data
    if (st.status === 'success') {
      me.value = st.data.user || me.value
      agent.value = st.data.agent || agent.value
      sites.value = st.data.sites || []
      emit('status', {
        role: me.value.role,
        isAgent: ['agent', 'admin', 'super_admin'].includes(me.value.role),
        isStaff: ['admin', 'super_admin'].includes(me.value.role),
        balance: Number(me.value.balance || 0),
        monthly: Number(plan.value.site_monthly || 99),
      })
    }
  } catch (e) { /* 静默：计费卡不影响主功能 */ }
}

const subscribeAgent = async () => {
  if (busy.value) return
  busy.value = true; msg.value = ''
  try {
    const r = await fetch('/api/billing/agent/subscribe', { method: 'POST', headers: headers() }).then(x => x.json())
    msgOk.value = r.status === 'success'
    msg.value = r.status === 'success' ? `✅ ${r.message}` : `❌ ${r.message}`
    if (r.status === 'success') { await load(); emit('changed') }
    else if (String(r.message || '').includes('余额不足')) router.push('/recharge')
  } finally { busy.value = false }
}

const renewSite = async (s) => {
  if (busy.value) return
  busy.value = true; msg.value = ''
  try {
    const r = await fetch(`/api/billing/site/${s.id}/renew`, { method: 'POST', headers: headers() }).then(x => x.json())
    msgOk.value = r.status === 'success'
    msg.value = r.status === 'success' ? `✅ ${r.message}` : `❌ ${r.message}`
    if (r.status === 'success') { await load(); emit('changed') }
    else if (String(r.message || '').includes('余额不足')) router.push('/recharge')
  } finally { busy.value = false }
}

onMounted(load)
defineExpose({ load })
</script>
