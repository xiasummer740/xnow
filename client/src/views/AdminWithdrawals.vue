<template>
  <div class="max-w-6xl mx-auto space-y-4 pb-24 relative z-10">
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[10px] font-black px-2 py-0.5 rounded bg-violet-500 text-white">分站管理</span>
      <router-link to="/admin/sites" class="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300">站点</router-link>
      <router-link to="/admin/site-customers" class="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300">客户</router-link>
      <router-link to="/admin/site-withdrawals"
                   class="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-200 border border-amber-500/50">提现
        <span v-if="pendingCount > 0"
              class="ml-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black leading-none">
          {{ pendingCount > 99 ? '99+' : pendingCount }}
        </span>
      </router-link>
      <router-link to="/admin" class="ml-auto text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400">返回密室</router-link>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <div>
        <h1 class="text-xl font-black text-white">💸 分站提现</h1>
        <p class="text-[11px] text-slate-500 mt-1">
          站长用主站商户代收的钱在这里结算：看收款码 → 扫码转账 → 点「已转账确认」清账。
        </p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <select v-model="status" @change="load" class="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px]">
          <option value="pending">待处理</option>
          <option value="paid">已转账</option>
          <option value="rejected">已驳回</option>
          <option value="all">全部</option>
        </select>
        <button @click="load" :disabled="loading"
                class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-bold disabled:opacity-50">
          {{ loading ? '读取中…' : '刷新' }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2.5">
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        <div class="text-[10px] text-slate-500">待处理申请</div>
        <div class="text-lg font-black text-amber-300">{{ summary.pending_cnt }} 笔</div>
      </div>
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        <div class="text-[10px] text-slate-500">待转账金额</div>
        <div class="text-lg font-black text-amber-300">¥{{ money(summary.pending_sum) }}</div>
      </div>
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        <div class="text-[10px] text-slate-500">全站未结算代收</div>
        <div class="text-lg font-black text-emerald-300">¥{{ money(summary.unsettled_all) }}</div>
      </div>
    </div>

    <div class="space-y-3">
      <div v-for="it in items" :key="it.id"
           class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div class="flex flex-wrap items-start gap-3">
          <img v-if="it.qr" :src="it.qr" alt="收款码"
               class="w-28 h-28 object-contain bg-white rounded-xl border border-slate-700" />
          <div v-else class="w-28 h-28 rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-600">无收款码</div>
          <div class="flex-1 min-w-[220px]">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-black text-white">¥{{ money(it.amount) }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full"
                    :class="it.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400' : it.status === 'rejected' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-300'">
                {{ it.status === 'paid' ? '已转账' : it.status === 'rejected' ? '已驳回' : '待处理' }}
              </span>
              <span class="text-[11px] text-slate-400">{{ it.site_name }}（#{{ it.site_id }}）</span>
              <span class="text-[11px] text-slate-500">站长 {{ it.owner_phone }}</span>
            </div>
            <div class="text-[11px] text-slate-500 mt-1">
              申请时间 {{ when(it.created_at) }}
              <span v-if="it.note"> · 备注：{{ it.note }}</span>
              <span v-if="it.paid_at"> · 转账时间 {{ when(it.paid_at) }}</span>
              <span v-if="it.admin_note"> · 管理员备注：{{ it.admin_note }}</span>
            </div>
            <div class="text-[10px] text-slate-600 mt-1">该站还有未结算代收 ¥{{ money(it.unsettled) }}（含本笔）</div>

            <div v-if="it.status === 'pending'" class="flex flex-wrap items-center gap-2 mt-2">
              <input v-model="noteOf[it.id]" placeholder="转账备注（如：已微信扫码）"
                     class="flex-1 min-w-[140px] bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px]" />
              <button @click="confirmWd(it)" :disabled="busy === it.id"
                      class="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-900 text-[11px] font-black disabled:opacity-50">
                已转账确认
              </button>
              <button @click="rejectWd(it)" :disabled="busy === it.id"
                      class="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 border border-red-600/40 text-[11px] font-bold disabled:opacity-50">
                驳回
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!items.length && !loading" class="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-10 text-center text-[12px] text-slate-600">
        没有{{ status === 'pending' ? '待处理' : '' }}的提现申请
      </div>
    </div>
  </div>
</template>

<script setup>
import { useUiStore } from '../stores/ui'

import { useWithdrawBadge } from '../composables/useWithdrawBadge.js'
const { pendingCount, refreshWithdrawBadge } = useWithdrawBadge()

import { ref, reactive, onMounted } from 'vue'
const uiStore = useUiStore()

const loading = ref(false)
const busy = ref(0)
const status = ref('pending')
const items = ref([])
const summary = ref({ pending_cnt: 0, pending_sum: 0, unsettled_all: 0 })
const noteOf = reactive({})

const money = (v) => Number(v || 0).toFixed(2)
const when = (s) => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('xnow_token') || ''}` })
const headersJson = () => ({ ...headers(), 'Content-Type': 'application/json' })

const load = async () => {
  loading.value = true
  try {
    const r = await fetch(`/api/admin/site-withdrawals?status=${status.value}`, { headers: headers() }).then(x => x.json())
    if (r.status === 'success') {
      items.value = r.data.items || []
      summary.value = r.data.summary || summary.value
      refreshWithdrawBadge()
    }
  } catch (e) { console.warn('[withdrawals]', e.message) }
  finally { loading.value = false }
}

const confirmWd = async (it) => {
  if (!await uiStore.confirm(`确认已经给「${it.site_name}」转账 ¥${money(it.amount)}？确认后台账会清掉，不可撤销。`)) return
  busy.value = it.id
  try {
    const r = await fetch(`/api/admin/site-withdrawals/${it.id}/confirm`, {
      method: 'POST', headers: headersJson(), body: JSON.stringify({ note: noteOf[it.id] || '' }),
    }).then(x => x.json())
    uiStore.notify(r.message || (r.status === 'success' ? '已清账' : '失败'))
    await load()
    refreshWithdrawBadge()
  } finally { busy.value = 0 }
}

const rejectWd = async (it) => {
  const note = await uiStore.prompt('驳回原因（会显示给站长）：', { defaultValue: '收款码不清晰，请重新上传' })
  if (note === null) return
  busy.value = it.id
  try {
    const r = await fetch(`/api/admin/site-withdrawals/${it.id}/reject`, {
      method: 'POST', headers: headersJson(), body: JSON.stringify({ note }),
    }).then(x => x.json())
    uiStore.notify(r.message || (r.status === 'success' ? '已驳回' : '失败'))
    await load()
    refreshWithdrawBadge()
  } finally { busy.value = 0 }
}

onMounted(load)
</script>
