<template>
  <div class="max-w-7xl mx-auto space-y-5 pb-24 relative z-10">
    <!-- 头部 -->
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h1 class="text-xl font-black text-white flex items-center gap-2">
          🏬 分站客户总览
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30">密室</span>
        </h1>
        <p class="text-[11px] text-slate-500 mt-1">
          每个分站名下有多少客户、花了多少钱、什么时候来的 —— 全在这张表里。
          <span class="text-slate-600">（客户充值的钱进站长自己的商户，平台不计入营收）</span>
        </p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <button @click="load()" :disabled="loading"
                class="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold disabled:opacity-50">
          {{ loading ? '读取中…' : '刷新' }}
        </button>
        <button @click="exportCsv"
                class="px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-600/40 text-xs font-bold">
          导出 CSV
        </button>
        <router-link to="/admin/backup"
                     class="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">
          去备份 →
        </router-link>
        <router-link to="/admin" class="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">返回密室</router-link>
      </div>
    </div>

    <!-- 统计卡 -->
    <div class="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
      <div v-for="c in cards" :key="c.k" class="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        <div class="text-[10px] text-slate-500">{{ c.k }}</div>
        <div class="text-lg font-black mt-1" :class="c.c">{{ c.v }}</div>
        <div class="text-[10px] text-slate-600 mt-0.5">{{ c.d }}</div>
      </div>
    </div>

    <!-- 分站维度 -->
    <div class="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
        <span class="text-sm font-bold text-white">按分站看</span>
        <span class="text-[10px] text-slate-500">{{ sites.length }} 个站，按营收排序</span>
        <button @click="siteFilter = 0"
                v-if="siteFilter" class="ml-auto text-[10px] px-2 py-1 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
          清除筛选：站点 #{{ siteFilter }} ✕
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-[11px] whitespace-nowrap">
          <thead class="text-slate-500 bg-slate-950/60">
            <tr>
              <th class="text-left px-3 py-2 font-medium">分站</th>
              <th class="text-left px-3 py-2 font-medium">域名</th>
              <th class="text-left px-3 py-2 font-medium">站长</th>
              <th class="text-right px-3 py-2 font-medium">客户</th>
              <th class="text-right px-3 py-2 font-medium">7日活跃</th>
              <th class="text-right px-3 py-2 font-medium">订单</th>
              <th class="text-right px-3 py-2 font-medium">客户消费</th>
              <th class="text-right px-3 py-2 font-medium">站长毛利</th>
              <th class="text-right px-3 py-2 font-medium">客户余额</th>
              <th class="text-left px-3 py-2 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sites" :key="s.id"
                class="border-t border-slate-800/70 hover:bg-slate-800/40 cursor-pointer"
                :class="siteFilter === s.id ? 'bg-amber-400/5' : ''"
                @click="siteFilter = siteFilter === s.id ? 0 : s.id; page = 1; load()">
              <td class="px-3 py-2 text-slate-200 font-bold">#{{ s.id }} {{ s.name }}</td>
              <td class="px-3 py-2 text-slate-400">{{ s.domain || '—' }}</td>
              <td class="px-3 py-2 text-slate-400">{{ s.owner_phone || '—' }}</td>
              <td class="px-3 py-2 text-right text-slate-200">{{ s.customers }}</td>
              <td class="px-3 py-2 text-right" :class="Number(s.active7d) > 0 ? 'text-emerald-400' : 'text-slate-600'">{{ s.active7d }}</td>
              <td class="px-3 py-2 text-right text-slate-300">{{ s.orders }}</td>
              <td class="px-3 py-2 text-right text-amber-300">¥{{ money(s.gmv) }}</td>
              <td class="px-3 py-2 text-right text-emerald-400">¥{{ money(s.profit) }}</td>
              <td class="px-3 py-2 text-right text-slate-400">¥{{ money(s.customer_balance) }}</td>
              <td class="px-3 py-2">
                <span class="text-[10px] px-1.5 py-0.5 rounded-full"
                      :class="s.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/60 text-slate-400'">
                  {{ s.status === 'active' ? '运营中' : s.status }}
                </span>
              </td>
            </tr>
            <tr v-if="!sites.length"><td colspan="10" class="px-3 py-6 text-center text-slate-600">还没有分站</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 客户明细 -->
    <div class="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center gap-2">
        <span class="text-sm font-bold text-white">客户明细</span>
        <span class="text-[10px] text-slate-500">共 {{ total }} 人</span>
        <input v-model="search" @keyup.enter="page = 1; load()" placeholder="手机号 / 邮箱 / UID"
               class="ml-auto w-40 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px]" />
        <select v-model="only" @change="page = 1; load()"
                class="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px]">
          <option value="">全部客户</option>
          <option value="active7d">7 日活跃</option>
          <option value="banned">已封禁</option>
        </select>
        <select v-model="sort" @change="page = 1; load()"
                class="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px]">
          <option value="new">最新注册</option>
          <option value="spend">消费最多</option>
          <option value="orders">订单最多</option>
          <option value="balance">余额最高</option>
          <option value="active">最近活跃</option>
        </select>
        <button @click="page = 1; load()" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-bold">查询</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-[11px] whitespace-nowrap">
          <thead class="text-slate-500 bg-slate-950/60">
            <tr>
              <th class="text-left px-3 py-2 font-medium">UID</th>
              <th class="text-left px-3 py-2 font-medium">账号</th>
              <th class="text-left px-3 py-2 font-medium">所属分站</th>
              <th class="text-right px-3 py-2 font-medium">余额</th>
              <th class="text-right px-3 py-2 font-medium">充值</th>
              <th class="text-right px-3 py-2 font-medium">订单</th>
              <th class="text-right px-3 py-2 font-medium">消费</th>
              <th class="text-left px-3 py-2 font-medium">注册</th>
              <th class="text-left px-3 py-2 font-medium">最后登录</th>
              <th class="text-left px-3 py-2 font-medium">最后下单</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in items" :key="u.id" class="border-t border-slate-800/70 hover:bg-slate-800/40">
              <td class="px-3 py-2 text-slate-500">{{ u.id }}</td>
              <td class="px-3 py-2">
                <span class="text-slate-200">{{ u.phone || u.email || '—' }}</span>
                <span v-if="u.is_banned" class="ml-1 text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400">封禁</span>
              </td>
              <td class="px-3 py-2 text-slate-400">#{{ u.site_id }} {{ u.site_name || '—' }}</td>
              <td class="px-3 py-2 text-right text-slate-300">¥{{ money(u.balance) }}</td>
              <td class="px-3 py-2 text-right text-slate-400">¥{{ money(u.recharged) }}</td>
              <td class="px-3 py-2 text-right text-slate-300">{{ u.orders }}</td>
              <td class="px-3 py-2 text-right text-amber-300">¥{{ money(u.spend) }}</td>
              <td class="px-3 py-2 text-slate-500">{{ fmt(u.created_at) }}</td>
              <td class="px-3 py-2" :class="isRecent(u.last_login_at) ? 'text-emerald-400' : 'text-slate-500'">{{ fmt(u.last_login_at) }}</td>
              <td class="px-3 py-2 text-slate-500">{{ fmt(u.last_order_at) }}</td>
            </tr>
            <tr v-if="!items.length"><td colspan="10" class="px-3 py-6 text-center text-slate-600">没有符合条件的客户</td></tr>
          </tbody>
        </table>
      </div>
      <div class="px-3 py-2.5 border-t border-slate-800 flex items-center gap-2 text-[11px]">
        <span class="text-slate-500">第 {{ page }} / {{ pages }} 页</span>
        <button @click="go(page - 1)" :disabled="page <= 1"
                class="ml-auto px-2.5 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40">上一页</button>
        <button @click="go(page + 1)" :disabled="page >= pages"
                class="px-2.5 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40">下一页</button>
      </div>
    </div>

    <p class="text-[10px] text-slate-600 leading-relaxed">
      备份覆盖范围：数据库（含客户账号、余额、订单、流水）+ 站长上传的图片 + 分站 nginx 配置。
      换服务器后先还原备份；若分站自有域名打不开，再跑
      <code class="text-slate-400">node deploy/sites/rebuild-vhosts.cjs</code> 重建。
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const items = ref([])
const sites = ref([])
const summary = ref({})
const total = ref(0)
const page = ref(1)
const limit = 20
const search = ref('')
const sort = ref('new')
const only = ref('')
const siteFilter = ref(0)

const pages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

const money = (v) => Number(v || 0).toFixed(2)
const fmt = (s) => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const isRecent = (s) => {
  if (!s) return false
  const t = new Date(s).getTime()
  return Number.isFinite(t) && Date.now() - t < 7 * 86400e3
}

const cards = computed(() => [
  { k: '分站客户总数', v: summary.value.customers ?? 0, d: `7 天新增 ${summary.value.new7d ?? 0}`, c: 'text-slate-100' },
  { k: '7 日活跃', v: summary.value.active7d ?? 0, d: '近 7 天登录过', c: 'text-emerald-400' },
  { k: '客户消费', v: '¥' + money(summary.value.gmv), d: `${summary.value.orders ?? 0} 单`, c: 'text-amber-300' },
  { k: '站长毛利', v: '¥' + money(summary.value.profit), d: `平台毛利 ¥${money(Number(summary.value.gmv || 0) - Number(summary.value.profit || 0))}`, c: 'text-emerald-400' },
  { k: '客户充值', v: '¥' + money(summary.value.recharged), d: `${summary.value.recharge_times ?? 0} 笔`, c: 'text-sky-300' },
  { k: '客户余额合计', v: '¥' + money(summary.value.customer_balance), d: '站长欠客户的服务', c: 'text-violet-300' },
])

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('xnow_token') || ''}`,
  'Content-Type': 'application/json',
})

const load = async () => {
  loading.value = true
  try {
    const qs = new URLSearchParams({
      page: String(page.value), limit: String(limit), sort: sort.value,
      ...(search.value ? { search: search.value.trim() } : {}),
      ...(only.value ? { only: only.value } : {}),
      ...(siteFilter.value ? { site_id: String(siteFilter.value) } : {}),
    })
    const r = await fetch(`/api/admin/site-customers?${qs}`, { headers: headers() }).then(x => x.json())
    if (r.status === 'success') {
      items.value = r.data.items || []
      sites.value = r.data.sites || []
      summary.value = r.data.summary || {}
      total.value = r.data.total || 0
    } else if (r.message) {
      console.warn('[site-customers]', r.message)
    }
  } catch (e) { console.warn('[site-customers]', e.message) }
  finally { loading.value = false }
}

const go = (p) => {
  if (p < 1 || p > pages.value) return
  page.value = p
  load()
}

const exportCsv = async () => {
  try {
    const res = await fetch('/api/admin/site-customers/export', { headers: headers() })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `site-customers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch (e) { alert('导出失败：' + e.message) }
}

onMounted(load)
</script>
