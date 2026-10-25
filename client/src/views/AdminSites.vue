<template>
  <div class="max-w-7xl mx-auto space-y-5 pb-24 relative z-10">
    <!-- 密室 → 分站管理：站点 / 客户 两个子页 -->
    <div class="flex items-center gap-2">
      <span class="text-[10px] font-black px-2 py-0.5 rounded bg-violet-500 text-white">分站管理</span>
      <router-link to="/admin/sites"
                   class="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-violet-500/15 text-violet-200 border border-violet-500/40">
        站点
      </router-link>
      <router-link to="/admin/site-customers"
                   class="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300">
        客户
      </router-link>
      <router-link to="/admin/site-withdrawals" class="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300">提现
        <span v-if="pendingCount > 0"
              class="ml-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black leading-none">
          {{ pendingCount > 99 ? '99+' : pendingCount }}
        </span>
      </router-link>
      <router-link to="/admin" class="ml-auto text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400">返回密室</router-link>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h1 class="text-xl font-black text-white flex items-center gap-2">
          🏬 分站管理
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/40">主站管理员</span>
        </h1>
        <p class="text-[11px] text-slate-500 mt-1">
          全部站点与它们的经营数据。<b class="text-slate-400">这里只看不改</b> ——
          装修、定价、收款、邮件、域名都是站长自己的事，主站不代改。
        </p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <button @click="load()" :disabled="loading"
                class="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold disabled:opacity-50">
          {{ loading ? '读取中…' : '刷新' }}
        </button>
        <router-link to="/admin/site-customers"
                     class="px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-600/40 text-xs font-bold">
          🏬 分站客户 →
        </router-link>
        <router-link to="/admin" class="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">返回密室</router-link>
      </div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
      <div v-for="c in cards" :key="c.k" class="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        <div class="text-[10px] text-slate-500">{{ c.k }}</div>
        <div class="text-lg font-black mt-1" :class="c.c">{{ c.v }}</div>
        <div class="text-[10px] text-slate-600 mt-0.5">{{ c.d }}</div>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
        <span class="text-sm font-bold text-white">全部站点</span>
        <span class="text-[10px] text-slate-500">{{ sites.length }} 个</span>
        <span class="ml-auto text-[10px] text-slate-600">按客户消费排序</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-[11px] whitespace-nowrap">
          <thead class="text-slate-500 bg-slate-950/60">
            <tr>
              <th class="text-left px-3 py-2 font-medium">#</th>
              <th class="text-left px-3 py-2 font-medium">站点</th>
              <th class="text-left px-3 py-2 font-medium">域名</th>
              <th class="text-left px-3 py-2 font-medium">站长</th>
              <th class="text-left px-3 py-2 font-medium">状态</th>
              <th class="text-left px-3 py-2 font-medium">到期</th>
              <th class="text-right px-3 py-2 font-medium">客户</th>
              <th class="text-right px-3 py-2 font-medium">订单</th>
              <th class="text-right px-3 py-2 font-medium">客户消费</th>
              <th class="text-right px-3 py-2 font-medium">站长毛利</th>
              <th class="text-right px-3 py-2 font-medium">客户余额</th>
              <th class="text-right px-3 py-2 font-medium">最后下单</th>
              <th class="text-left px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sites" :key="s.id" class="border-t border-slate-800/70 hover:bg-slate-800/30">
              <td class="px-3 py-2 text-slate-500">{{ s.id }}</td>
              <td class="px-3 py-2 text-slate-200 font-bold">{{ s.name }}</td>
              <td class="px-3 py-2">
                <a :href="'https://' + s.domain" target="_blank" rel="noopener"
                   class="text-sky-400 hover:underline">{{ s.domain || '—' }} ↗</a>
              </td>
              <td class="px-3 py-2 text-slate-400">{{ s.owner_phone || '—' }}</td>
              <td class="px-3 py-2">
                <span class="text-[10px] px-1.5 py-0.5 rounded-full"
                      :class="s.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'">
                  {{ s.status === 'active' ? '运营中' : (s.status === 'expired' ? '已停站' : s.status) }}
                </span>
              </td>
              <td class="px-3 py-2" :class="expireClass(s)">
                {{ s.expire_at ? fmtDate(s.expire_at) : '不计费' }}
              </td>
              <td class="px-3 py-2 text-right" :class="Number(s.customers) > 0 ? 'text-slate-200' : 'text-slate-600'">{{ s.customers }}</td>
              <td class="px-3 py-2 text-right text-slate-300">{{ s.orders }}</td>
              <td class="px-3 py-2 text-right text-amber-300">¥{{ money(s.gmv) }}</td>
              <td class="px-3 py-2 text-right text-emerald-400">¥{{ money(s.profit) }}</td>
              <td class="px-3 py-2 text-right text-slate-400">¥{{ money(s.customer_balance) }}</td>
              <td class="px-3 py-2 text-right text-slate-500">{{ s.last_order_at ? fmtDate(s.last_order_at) : '—' }}</td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-1">
                  <button @click="act(s, 'extend')" :disabled="busy === s.id"
                          class="text-[10px] px-1.5 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40">+30天</button>
                  <button v-if="s.status === 'active'" @click="act(s, 'stop')" :disabled="busy === s.id"
                          class="text-[10px] px-1.5 py-1 rounded bg-red-500/15 text-red-300 border border-red-600/40 disabled:opacity-40">停站</button>
                  <button v-else @click="act(s, 'resume')" :disabled="busy === s.id"
                          class="text-[10px] px-1.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-600/40 disabled:opacity-40">恢复</button>
                  <button v-if="supportLeft(s) > 0" @click="enterSite(s)"
                          class="text-[10px] px-1.5 py-1 rounded bg-amber-400/20 text-amber-200 border border-amber-400/50">
                    代管中 {{ supportLeft(s) }}h
                  </button>
                  <span v-else class="text-[10px] text-slate-600">未授权代管</span>
                  <button @click="act(s, 'delete')" :disabled="busy === s.id"
                          class="text-[10px] px-1.5 py-1 rounded bg-slate-800 text-slate-500 disabled:opacity-40">删</button>
                </div>
              </td>
            </tr>
            <tr v-if="!sites.length"><td colspan="12" class="px-3 py-8 text-center text-slate-600">还没有分站</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
      <div class="text-[11px] font-bold text-slate-300 mb-1">主站管理员的边界</div>
      <ul class="text-[10px] text-slate-500 space-y-0.5 leading-relaxed">
        <li>✅ 能看：站点、站长、域名、状态、到期时间、客户数、订单、营收、毛利、客户余额</li>
        <li>✅ 能管：客户账号（封禁/加余额）、分站客户总览、备份与还原、全站配置</li>
        <li>🚫 不代改：装修模板、价格、收款商户、发信邮箱、自有域名 —— 这些是站长自己的后台（<code class="text-slate-400">/my-site</code>），
          主站管理员没有那个入口</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { useUiStore } from '../stores/ui'

import { useWithdrawBadge } from '../composables/useWithdrawBadge.js'
const { pendingCount } = useWithdrawBadge()

import { ref, computed, onMounted } from 'vue'
const uiStore = useUiStore()

const loading = ref(false)
const sites = ref([])

const money = (v) => Number(v || 0).toFixed(2)
const fmtDate = (s) => {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const daysLeft = (s) => {
  if (!s.expire_at) return null
  const d = new Date(s.expire_at).getTime()
  if (Number.isNaN(d)) return null
  return Math.ceil((d - Date.now()) / 86400000)
}
const expireClass = (s) => {
  const n = daysLeft(s)
  if (n === null) return 'text-slate-500'
  if (n < 0) return 'text-red-400 font-bold'
  if (n <= 3) return 'text-amber-300 font-bold'
  return 'text-slate-400'
}

const cards = computed(() => {
  const active = sites.value.filter(s => s.status === 'active').length
  const expired = sites.value.filter(s => s.status !== 'active').length
  const soon = sites.value.filter(s => { const n = daysLeft(s); return n !== null && n >= 0 && n <= 7 }).length
  const gmv = sites.value.reduce((a, s) => a + Number(s.gmv || 0), 0)
  const customers = sites.value.reduce((a, s) => a + Number(s.customers || 0), 0)
  return [
    { k: '站点总数', v: sites.value.length, d: `运营中 ${active}`, c: 'text-slate-100' },
    { k: '已停站', v: expired, d: '月费到期未续', c: expired ? 'text-red-400' : 'text-slate-500' },
    { k: '7 天内到期', v: soon, d: '要提醒站长续费', c: soon ? 'text-amber-300' : 'text-slate-500' },
    { k: '全站客户消费', v: '¥' + money(gmv), d: `${customers} 个客户`, c: 'text-amber-300' },
    { k: '客单价', v: '¥' + money(customers ? gmv / customers : 0), d: '消费 / 客户数', c: 'text-violet-300' },
  ]
})

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('xnow_token') || ''}` })

const busy = ref(0)
const supportLeft = (s) => {
  const until = Number(s.admin_access_until || 0)
  if (!until || until <= Date.now()) return 0
  return Math.round((until - Date.now()) / 3600000 * 10) / 10
}
// 代管入口：只有站长开过协助窗口才有（窗口到期自动消失）
const enterSite = (s) => {
  localStorage.setItem('xnow_site_current', String(s.id))
  window.location.href = '/my-site/overview'
}
const act = async (s, action) => {
  if (action === 'delete') {
    const typed = await uiStore.prompt(`删除站点会连同它的域名配置一起删掉，且不可恢复。\n要删除「${s.name}」，请输入站点名确认：`)
    if (typed === null) return
    if (String(typed).trim() !== String(s.name).trim()) return uiStore.notify('名称不匹配，已取消')
  }
  if (action === 'stop' && !await uiStore.confirm(`停站后这个域名会立刻显示下线页，确定停「${s.name}」？`)) return
  busy.value = s.id
  try {
    const r = await fetch(`/api/admin/sites/${s.id}/action`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, days: 30, confirm: action === 'delete' ? s.name : undefined }),
    }).then(x => x.json())
    if (r.status === 'success') { uiStore.notify(r.message || '完成'); await load() }
    else uiStore.notify(r.message || '操作失败')
  } catch (e) { uiStore.notify('网络异常：' + e.message) }
  finally { busy.value = 0 }
}

const load = async () => {
  loading.value = true
  try {
    const r = await fetch('/api/admin/site-customers?limit=1', { headers: headers() }).then(x => x.json())
    if (r.status === 'success') sites.value = r.data.sites || []
  } catch (e) { console.warn('[admin-sites]', e.message) }
  finally { loading.value = false }
}

onMounted(load)
</script>
