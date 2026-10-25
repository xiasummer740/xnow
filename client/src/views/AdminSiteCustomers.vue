<template>
  <div class="max-w-7xl mx-auto space-y-5 pb-24 relative z-10">
    <!-- 头部 -->
    <div class="flex items-center gap-2">
      <span class="text-[10px] font-black px-2 py-0.5 rounded bg-violet-500 text-white">分站管理</span>
      <router-link to="/admin/sites" class="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300">站点</router-link>
      <router-link to="/admin/site-customers"
                   class="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-violet-500/15 text-violet-200 border border-violet-500/40">客户</router-link>
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
          🏬 分站客户
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30">密室</span>
        </h1>
        <p class="text-[11px] text-slate-500 mt-1">
          每个分站名下有多少客户、花了多少钱、什么时候来的、从哪个 IP 来的 —— 点「详情」看全部。
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
        <router-link to="/admin/backup" class="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">去备份 →</router-link>
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
        <button v-if="siteFilter" @click="siteFilter = 0; page = 1; load()"
                class="ml-auto text-[10px] px-2 py-1 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
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

    <!-- 客户明细：卡片行，信息量与密室「用户」页一致 -->
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

      <div class="divide-y divide-slate-800/70">
        <div v-for="u in items" :key="u.id"
             class="px-3 sm:px-4 py-3 hover:bg-slate-800/30 grid gap-3 lg:grid-cols-[1.5fr_1.2fr_auto] lg:items-center">
          <!-- 左：身份 + 注册信息 -->
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">UID {{ u.id }}</span>
              <span class="text-sm font-bold text-slate-100">{{ u.phone || '—' }}</span>
              <button @click="openDetail(u)"
                      class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-600/40">详情</button>
              <span v-if="u.is_banned" class="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400">封禁</span>
            </div>
            <div class="mt-1 text-[10px] text-slate-500 truncate">✉️ {{ u.email || '未绑定邮箱' }}</div>
            <div class="mt-0.5 text-[10px] text-slate-600 truncate">
              注册 IP：{{ u.register_ip || '—' }}<span v-if="u.registerLoc" class="text-slate-500"> · {{ u.registerLoc }}</span>
              <span class="text-slate-700">｜</span>{{ fmtFull(u.created_at) }}
            </div>
            <div class="mt-0.5 text-[10px] text-slate-500 truncate">
              所属分站：<span class="text-slate-300">#{{ u.site_id }} {{ u.site_name || '—' }}</span>
              <span v-if="u.site_domain" class="text-slate-600"> · {{ u.site_domain }}</span>
            </div>
          </div>

          <!-- 中：最后登录 + 消费口径 -->
          <div class="min-w-0">
            <div class="text-[11px] text-slate-300 truncate">
              <span class="text-slate-500 text-[10px]">最后登录 IP：</span>{{ u.last_login_ip || '—' }}
              <span v-if="u.loginLoc" class="text-slate-500">（{{ u.loginLoc }}）</span>
            </div>
            <div class="text-[10px] text-slate-600 mt-0.5">
              🕐 {{ fmtFull(u.last_login_at) }}
              <span v-if="u.last_order_at" class="ml-2 text-slate-500">最后下单 {{ fmt(u.last_order_at) }}</span>
            </div>
            <div class="text-[10px] text-slate-600 mt-0.5">
              订单 {{ u.orders }} 笔 · 充值 ¥{{ money(u.recharged) }} · 消费 ¥{{ money(u.spend) }}
            </div>
          </div>

          <!-- 右：等级 + 余额 -->
          <div class="flex lg:flex-col items-center lg:items-end gap-2 lg:gap-1">
            <span class="text-[10px] font-bold px-2 py-1 rounded-lg border" :class="roleStyle(u.role).cls">
              {{ roleStyle(u.role).label }}
            </span>
            <div class="text-right">
              <div class="text-sm font-black" :class="Number(u.balance) > 0 ? 'text-amber-300' : 'text-slate-600'">¥{{ money(u.balance) }}</div>
              <div class="text-[9px] text-slate-600">当前余额</div>
            </div>
          </div>
        </div>
        <div v-if="!items.length" class="px-3 py-10 text-center text-[11px] text-slate-600">没有符合条件的客户</div>
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

    <!-- ══ 客户详情抽屉 ══ -->
    <div v-if="d.show" class="fixed inset-0 z-[10004] flex items-start justify-end bg-black/70 backdrop-blur-sm sm:p-3"
         @click.self="d.show = false">
      <div class="w-full sm:max-w-2xl h-full overflow-y-auto bg-slate-900 border-l border-slate-700 sm:rounded-2xl">
        <div class="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-slate-900/95 backdrop-blur border-b border-slate-700">
          <span class="text-sm font-black text-white">👤 客户详情</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">UID {{ d.data?.id }}</span>
          <button @click="d.show = false" class="ml-auto px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs">关闭 ✕</button>
        </div>

        <div class="p-4 space-y-4">
          <!-- 基本信息 -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div v-for="f in dFields" :key="f.k" class="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
              <div class="text-[10px] text-slate-500">{{ f.k }}</div>
              <div class="text-[12px] font-bold mt-0.5 break-all" :class="f.c || 'text-slate-200'">{{ f.v }}</div>
            </div>
          </div>

          <!-- 消费分析 -->
          <div>
            <div class="text-[11px] font-bold text-slate-300 mb-1.5">📊 消费分析</div>
            <div v-if="d.loading" class="text-[11px] text-slate-500 py-3">读取中…</div>
            <div v-else-if="d.analysis" class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div v-for="a in analysisCards" :key="a.k" class="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                <div class="text-[10px] text-slate-500">{{ a.k }}</div>
                <div class="text-[13px] font-black mt-0.5" :class="a.c">{{ a.v }}</div>
              </div>
            </div>
            <div v-else class="text-[11px] text-slate-600 py-2">暂无数据</div>

            <div v-if="d.analysis?.serviceBreakdown?.length" class="mt-2">
              <div class="text-[10px] text-slate-500 mb-1">常买服务</div>
              <div v-for="s in d.analysis.serviceBreakdown.slice(0, 5)" :key="s.service_id"
                   class="flex items-center justify-between text-[10px] py-1 border-b border-slate-800/60">
                <span class="text-slate-300 truncate pr-2">{{ s.service_name }}</span>
                <span class="text-slate-500 shrink-0">{{ s.order_count }} 单 · ¥{{ money(s.revenue) }}</span>
              </div>
            </div>
          </div>

          <!-- 管理员备注 -->
          <div>
            <div class="text-[11px] font-bold text-slate-300 mb-1.5">📝 管理员备注</div>
            <div class="flex gap-2">
              <input v-model="d.note" placeholder="输入备注（仅管理员可见）"
                     class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[11px]" />
              <button @click="saveNote" class="px-3 py-2 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">保存</button>
            </div>
          </div>

          <!-- 站内通知 -->
          <div>
            <div class="text-[11px] font-bold text-slate-300 mb-1.5">📢 发送站内通知</div>
            <div class="flex flex-col sm:flex-row gap-2">
              <input v-model="d.title" placeholder="通知标题" class="sm:w-40 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[11px]" />
              <input v-model="d.content" placeholder="通知内容" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[11px]" />
              <button @click="sendNotify" class="px-3 py-2 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-600/40 text-[11px] font-bold">发送</button>
            </div>
          </div>

          <!-- 最近订单 -->
          <div>
            <div class="text-[11px] font-bold text-slate-300 mb-1.5">📦 最近订单（{{ d.orders.length }}）</div>
            <div v-if="d.orders.length" class="space-y-1">
              <div v-for="o in d.orders.slice(0, 10)" :key="o.id"
                   class="rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 py-1.5 text-[10px]">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-slate-300 truncate">{{ o.service_name }}</span>
                  <span class="text-amber-300 shrink-0">¥{{ money(o.charge) }}</span>
                </div>
                <div class="text-slate-600 mt-0.5">{{ o.order_no }} · {{ o.status }} · {{ fmtFull(o.created_at || o.createdAt) }}</div>
              </div>
            </div>
            <div v-else class="text-[11px] text-slate-600">暂无订单</div>
          </div>

          <!-- 最近流水 -->
          <div>
            <div class="text-[11px] font-bold text-slate-300 mb-1.5">💰 最近流水（{{ d.transactions.length }}）</div>
            <div v-if="d.transactions.length" class="space-y-1">
              <div v-for="t in d.transactions.slice(0, 10)" :key="t.id"
                   class="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 py-1.5 text-[10px]">
                <span class="text-slate-400 truncate">{{ t.type }} · {{ t.description }}</span>
                <span class="shrink-0" :class="Number(t.amount) >= 0 ? 'text-emerald-400' : 'text-red-400'">
                  {{ Number(t.amount) >= 0 ? '+' : '' }}{{ money(t.amount) }}
                </span>
              </div>
            </div>
            <div v-else class="text-[11px] text-slate-600">暂无流水</div>
          </div>
        </div>
      </div>
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

const d = ref({ show: false, data: null, orders: [], transactions: [], analysis: null, loading: false, note: '', title: '', content: '' })

const pages = computed(() => Math.max(1, Math.ceil(total.value / limit)))
const money = (v) => Number(v || 0).toFixed(2)

const fmt = (s) => {
  if (!s) return '—'
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return '—'
  return `${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}
const fmtFull = (s) => {
  if (!s) return '—'
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Shanghai',
  })
}

const ROLE_MAP = {
  user: { label: '普通用户', cls: 'bg-slate-700/50 text-slate-300 border-slate-600/50' },
  gold: { label: '黄金用户', cls: 'bg-amber-400/15 text-amber-300 border-amber-500/40' },
  agent: { label: '至尊代理', cls: 'bg-amber-400/20 text-amber-200 border-amber-400/50' },
  admin: { label: '管理员', cls: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
  super_admin: { label: '超管', cls: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40' },
}
const roleStyle = (r) => ROLE_MAP[r] || ROLE_MAP.user

const cards = computed(() => [
  { k: '分站客户总数', v: summary.value.customers ?? 0, d: `7 天新增 ${summary.value.new7d ?? 0}`, c: 'text-slate-100' },
  { k: '7 日活跃', v: summary.value.active7d ?? 0, d: '近 7 天登录过', c: 'text-emerald-400' },
  { k: '客户消费', v: '¥' + money(summary.value.gmv), d: `${summary.value.orders ?? 0} 单`, c: 'text-amber-300' },
  { k: '站长毛利', v: '¥' + money(summary.value.profit), d: `平台毛利 ¥${money(Number(summary.value.gmv || 0) - Number(summary.value.profit || 0))}`, c: 'text-emerald-400' },
  { k: '客户充值', v: '¥' + money(summary.value.recharged), d: `${summary.value.recharge_times ?? 0} 笔`, c: 'text-sky-300' },
  { k: '客户余额合计', v: '¥' + money(summary.value.customer_balance), d: '站长欠客户的服务', c: 'text-violet-300' },
])

const dFields = computed(() => {
  const u = d.value.data || {}
  return [
    { k: '手机号', v: u.phone || '—' },
    { k: '邮箱', v: u.email || '未绑定' },
    { k: '角色', v: roleStyle(u.role).label, c: 'text-amber-300' },
    { k: '余额', v: '¥' + money(u.balance), c: 'text-emerald-400' },
    { k: '总佣金', v: '¥' + money(u.total_commission), c: 'text-violet-300' },
    { k: '封禁状态', v: u.is_banned ? '已封禁' : '正常', c: u.is_banned ? 'text-red-400' : 'text-emerald-400' },
    { k: '所属分站', v: `#${u.site_id} ${u.site_name || ''}` },
    { k: '分站域名', v: u.site_domain || '—' },
    { k: '注册 IP', v: (u.register_ip || '—') + (u.registerLoc ? ` （${u.registerLoc}）` : '') },
    { k: '最后登录 IP', v: (u.last_login_ip || '—') + (u.loginLoc ? ` （${u.loginLoc}）` : '') },
    { k: '注册时间', v: fmtFull(u.created_at) },
    { k: '最后登录', v: fmtFull(u.last_login_at) },
  ]
})

const analysisCards = computed(() => {
  const a = d.value.analysis || {}
  const s = a.spending || {}
  const dep = a.depositStats || {}
  return [
    { k: '总消费', v: '¥' + money(s.total_spent), c: 'text-amber-300' },
    { k: '总订单', v: String(s.total_orders ?? 0), c: 'text-slate-100' },
    { k: '均价', v: '¥' + money(s.avg_order_value), c: 'text-slate-200' },
    { k: '总充值', v: '¥' + money(dep.total_deposit), c: 'text-sky-300' },
    { k: '充值笔数', v: String(dep.deposit_count ?? 0), c: 'text-slate-300' },
    { k: '返佣', v: '¥' + money(dep.total_commission), c: 'text-violet-300' },
    { k: '首单', v: fmt(s.first_order_at), c: 'text-slate-400' },
    { k: '末单', v: fmt(s.last_order_at), c: 'text-slate-400' },
  ]
})

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('xnow_token') || ''}`,
  'Content-Type': 'application/json',
})

// 批量查本页 IP 归属地（与密室「用户」页同一接口；逐个外呼会打爆限流）
const attachGeo = async (list) => {
  const ips = []
  list.forEach((u) => {
    [u.register_ip, u.last_login_ip].forEach((ip) => {
      if (ip && !['127.0.0.1', '::1', 'localhost'].includes(ip) && !ips.includes(ip)) ips.push(ip)
    })
  })
  if (!ips.length) return
  try {
    const r = await fetch('/api/admin/geo/batch', {
      method: 'POST', headers: headers(), body: JSON.stringify({ ips }),
    }).then(x => x.json())
    if (r.status !== 'success') return
    list.forEach((u) => {
      const rg = r.data[u.register_ip]
      const lg = r.data[u.last_login_ip]
      if (rg) u.registerLoc = rg.city ? `${rg.country} ${rg.city}` : rg.country
      if (lg) u.loginLoc = lg.city ? `${lg.country} ${lg.city}` : lg.country
    })
  } catch (e) { /* 归属地拿不到不影响主数据 */ }
}

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
      attachGeo(items.value)
    } else if (r.message) console.warn('[site-customers]', r.message)
  } catch (e) { console.warn('[site-customers]', e.message) }
  finally { loading.value = false }
}

const go = (p) => {
  if (p < 1 || p > pages.value) return
  page.value = p
  load()
}

const fetchGeo = async (ip) => {
  if (!ip || ['127.0.0.1', '::1', 'localhost'].includes(ip)) return ''
  try {
    const r = await fetch(`/api/admin/geo/${ip}`, { headers: headers() }).then(x => x.json())
    return r.city ? `${r.country} ${r.city}` : (r.country || '')
  } catch { return '' }
}

const openDetail = async (u) => {
  d.value = { show: true, data: { ...u }, orders: [], transactions: [], analysis: null, loading: true, note: u.admin_note || '', title: '', content: '' }
  const one = async (url, key) => {
    try {
      const r = await fetch(url, { headers: headers() }).then(x => x.json())
      if (r.status === 'success') d.value[key] = r.data
    } catch (e) { /* 单点失败不影响其它区块 */ }
  }
  await Promise.all([
    one(`/api/admin/users/${u.id}/orders`, 'orders'),
    one(`/api/admin/users/${u.id}/transactions`, 'transactions'),
    one(`/api/admin/users/${u.id}/analysis`, 'analysis'),
    fetchGeo(u.register_ip).then(v => { d.value.data.registerLoc = v }),
    fetchGeo(u.last_login_ip).then(v => { d.value.data.loginLoc = v }),
  ])
  d.value.loading = false
}

const saveNote = async () => {
  try {
    const r = await fetch(`/api/admin/users/${d.value.data.id}/note`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ note: d.value.note }),
    }).then(x => x.json())
    if (r.status === 'success') {
      d.value.data.admin_note = d.value.note
      const row = items.value.find(x => x.id === d.value.data.id)
      if (row) row.admin_note = d.value.note
      uiStore.notify('备注已保存')
    } else uiStore.notify(r.message || '保存失败')
  } catch (e) { uiStore.notify('网络异常：' + e.message) }
}

const sendNotify = async () => {
  if (!d.value.title && !d.value.content) return uiStore.notify('请输入通知标题或内容')
  try {
    const r = await fetch(`/api/admin/users/${d.value.data.id}/notify`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ title: d.value.title, content: d.value.content }),
    }).then(x => x.json())
    if (r.status === 'success') { d.value.title = ''; d.value.content = ''; uiStore.notify('通知已发送') }
    else uiStore.notify(r.message || '发送失败')
  } catch (e) { uiStore.notify('网络异常：' + e.message) }
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
  } catch (e) { uiStore.notify('导出失败：' + e.message) }
}

onMounted(load)
</script>
