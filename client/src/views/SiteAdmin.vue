<template>
  <div class="p-4 md:p-6 max-w-5xl mx-auto text-slate-200">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-black">我的分站</h1>
        <p class="text-xs text-slate-500 mt-1">改名字、换模板、填收款、绑域名、看收益 —— 都在这里</p>
      </div>
      <button @click="load()" class="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700">刷新</button>
    </div>

    <div v-if="loading" class="text-center py-20 text-slate-500">加载中…</div>

    <!-- 还没有分站 → 创建 -->
    <div v-else-if="!site" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
      <h2 class="font-bold mb-4">开通你的分站</h2>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-slate-400 mb-1">站点域名（子域名形式，如 myshop.xnow.taikon.top）</label>
          <input v-model="createForm.domain" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="myshop.xnow.taikon.top" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">站点名称</label>
          <input v-model="createForm.name" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="我的数字营销" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">
            售价倍率（1 ~ 100 倍，1 倍 = 你的进货价，越高越赚但客户越贵）
          </label>
          <input v-model.number="createForm.multiplier" type="number" step="0.1" min="1" max="100" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button @click="createSite()" :disabled="creating" class="w-full py-2.5 rounded-xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 disabled:opacity-50">
          {{ creating ? '开通中…' : '立即开通' }}
        </button>
        <p class="text-[11px] text-slate-500 leading-relaxed">
          开通后你的分站靠预存余额自动发货：客户下单 → 扣客户余额 + 按你的进货价扣你的余额，
          差额就是你的利润。余额不足会自动拒单，不会产生欠款。
        </p>
      </div>
    </div>

    <!-- 已有分站 -->
    <div v-else class="space-y-5">
      <!-- 收益看板 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div v-for="c in cards" :key="c.label" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <p class="text-[11px] text-slate-500">{{ c.label }}</p>
          <p class="text-xl font-black mt-1" :class="c.cls">{{ c.value }}</p>
          <p v-if="c.sub" class="text-[10px] text-slate-500 mt-1">{{ c.sub }}</p>
        </div>
      </div>

      <!-- 基本信息 -->
      <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 class="font-bold text-sm text-amber-400">基本信息</h2>
        <div class="grid md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">站点名称</label>
            <input v-model="form.name" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">倍率（1~100）</label>
            <input v-model.number="form.multiplier" type="number" step="0.1" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">页脚版权</label>
            <input v-model="form.footer_text" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="© 2026 我的站" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">客服链接（http/https）</label>
            <input v-model="form.support_url" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="https://t.me/yourbot" />
          </div>
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">站点公告</label>
          <textarea v-model="form.announcement" rows="2" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="留空则不显示公告"></textarea>
        </div>
      </section>

      <!-- 外观 -->
      <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 class="font-bold text-sm text-amber-400">外观模板</h2>
        <div>
          <label class="block text-xs text-slate-400 mb-2">模板</label>
          <div class="grid grid-cols-3 md:grid-cols-6 gap-2">
            <button v-for="t in templates" :key="t.key" @click="form.template = t.key"
              class="px-2 py-2 rounded-lg text-xs border transition"
              :class="form.template === t.key ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold' : 'border-slate-700 text-slate-400 hover:border-slate-600'">
              {{ t.label }}
            </button>
          </div>
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-2">色系</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="c in colors" :key="c.key" @click="form.color = c.key; form.accent = ''"
              class="w-9 h-9 rounded-full border-2 transition"
              :class="form.color === c.key && !form.accent ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'"
              :style="{ background: c.hex }" :title="c.label"></button>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <input v-model="form.accent" placeholder="#RRGGBB 自定义" class="w-32 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs" />
            <span class="text-[10px] text-slate-500">填了就覆盖上面的色系</span>
          </div>
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-2">首页模块（开关 + 排序）</label>
          <div class="space-y-1.5">
            <div v-for="(m, i) in form.modules" :key="m.key" class="flex items-center gap-2 bg-slate-950/60 rounded-lg px-3 py-2">
              <input type="checkbox" v-model="m.enabled" class="accent-amber-400" />
              <span class="text-xs flex-1">{{ moduleLabel(m.key) }}</span>
              <button @click="moveModule(i, -1)" :disabled="i === 0" class="text-xs px-1.5 text-slate-500 disabled:opacity-30">↑</button>
              <button @click="moveModule(i, 1)" :disabled="i === form.modules.length - 1" class="text-xs px-1.5 text-slate-500 disabled:opacity-30">↓</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 收款 -->
      <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 class="font-bold text-sm text-amber-400">收款商户（钱直接进你的账户）</h2>
        <p class="text-[11px] text-slate-500 leading-relaxed">
          填你自己的 BufPay / Cryptomus 商户，客户在你站上付款时直接进你的账号。
          不填则用平台商户（客户的钱会先到平台，需要你联系平台手动加余额，不推荐）。
        </p>
        <div class="grid md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">BufPay 商户 ID</label>
            <input v-model="form.bufpay_id" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="选填" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">BufPay 密钥</label>
            <input v-model="form.bufpay_key" type="password" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="留空/****** 表示不修改" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Cryptomus 商户 UUID</label>
            <input v-model="form.cryptomus_id" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="选填" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Cryptomus API Key</label>
            <input v-model="form.cryptomus_key" type="password" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="留空/****** 表示不修改" />
          </div>
        </div>
      </section>

      <!-- 邮件 -->
      <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 class="font-bold text-sm text-amber-400">发信邮箱（客户收到的验证码用你的品牌）</h2>
        <p class="text-[11px] text-slate-500">不填则用平台邮箱发，客户会看到平台品牌。</p>
        <div class="grid md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">SMTP 主机</label>
            <input v-model="form.smtp_host" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="smtp.qq.com" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">端口</label>
            <input v-model.number="form.smtp_port" type="number" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="465" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">邮箱账号</label>
            <input v-model="form.smtp_user" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="you@yourdomain.com" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">授权码 / 密码</label>
            <input v-model="form.smtp_pass" type="password" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="留空/****** 表示不修改" />
          </div>
        </div>
      </section>

      <!-- 域名 -->
      <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 class="font-bold text-sm text-amber-400">域名</h2>
        <p class="text-xs text-slate-400">
          当前站点域名：<span class="text-amber-300 font-bold">{{ site.domain }}</span>
          <span v-if="site.domain_status === 'active'" class="ml-2 text-emerald-400">已开通 ✅</span>
          <span v-else-if="site.domain_status === 'pending'" class="ml-2 text-amber-400">待验证</span>
          <span v-else-if="site.domain_status === 'failed'" class="ml-2 text-red-400">开通失败</span>
        </p>
        <div class="flex gap-2">
          <input v-model="bindDomain" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="绑定你自己的域名，如 shop.你的品牌.com" />
          <button @click="bindOwnDomain()" :disabled="binding" class="px-4 py-2 rounded-lg text-sm font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-50">
            {{ binding ? '验证中…' : '绑定并开通' }}
          </button>
        </div>
        <div v-if="domainHint" class="bg-amber-400/10 border border-amber-500/30 rounded-lg p-3 text-[11px] text-amber-200 whitespace-pre-wrap">{{ domainHint }}</div>
      </section>

      <div class="flex gap-3">
        <button @click="save()" :disabled="saving" class="flex-1 py-3 rounded-xl font-black bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 disabled:opacity-50">
          {{ saving ? '保存中…' : '保存全部修改' }}
        </button>
      </div>
      <p class="text-[10px] text-slate-600 text-center">修改保存后，你的分站访客刷新页面即可看到新外观</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const loading = ref(true)
const saving = ref(false)
const creating = ref(false)
const binding = ref(false)
const site = ref(null)
const stats = ref({})
const bindDomain = ref('')
const domainHint = ref('')

const createForm = ref({ domain: '', name: '', multiplier: 2.5 })
const form = ref({
  name: '', multiplier: 2.5, footer_text: '', support_url: '', announcement: '',
  template: 'classic', color: 'cyan', accent: '', modules: [],
  bufpay_id: '', bufpay_key: '', cryptomus_id: '', cryptomus_key: '',
  smtp_host: '', smtp_port: 465, smtp_user: '', smtp_pass: ''
})

const templates = [
  { key: 'classic', label: '经典' }, { key: 'saas', label: 'SaaS' },
  { key: 'minimal', label: '极简' }, { key: 'neon', label: '霓虹' },
  { key: 'magazine', label: '杂志' }, { key: 'glass', label: '玻璃' }
]
const colors = [
  { key: 'cyan', label: '青', hex: '#22d3ee' }, { key: 'purple', label: '紫', hex: '#a855f7' },
  { key: 'green', label: '绿', hex: '#22c55e' }, { key: 'red', label: '红', hex: '#ef4444' },
  { key: 'orange', label: '橙', hex: '#f97316' }, { key: 'blue', label: '蓝', hex: '#3b82f6' }
]
const MODULES = { announce: '公告条', stats: '数据统计', hot_services: '热门服务', faq: '教程 FAQ', vip: 'VIP 入口', affiliate: '返佣横幅' }
const moduleLabel = (k) => MODULES[k] || k

const cards = computed(() => {
  const s = stats.value || {}
  const profit = parseFloat(s.profit || 0)
  const todayProfit = parseFloat(s.today_profit || 0)
  return [
    { label: '今日订单', value: s.today_orders ?? 0, cls: 'text-white' },
    { label: '今日毛利', value: `¥${todayProfit.toFixed(4)}`, cls: 'text-emerald-400' },
    { label: '累计营收', value: `¥${parseFloat(s.revenue || 0).toFixed(2)}`, cls: 'text-white' },
    { label: '累计毛利', value: `¥${profit.toFixed(2)}`, cls: profit >= 0 ? 'text-emerald-400' : 'text-red-400', sub: `成本 ¥${parseFloat(s.cost || 0).toFixed(2)}` }
  ]
})

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('xnow_token') || ''}`
})

const load = async () => {
  loading.value = true
  try {
    const res = await fetch('/api/sites', { headers: headers() })
    const data = await res.json()
    const list = data.data || []
    site.value = list[0] || null
    if (site.value) {
      const s = site.value
      form.value = {
        name: s.name || '', multiplier: s.multiplier ?? 2.5,
        footer_text: s.footer_text || '', support_url: s.support_url || '',
        announcement: s.announcement || '',
        template: s.template || 'classic', color: s.color || 'cyan', accent: s.accent || '',
        modules: parseModules(s.home_modules),
        bufpay_id: s.bufpay_id || '', bufpay_key: s.bufpay_key ? '******' : '',
        cryptomus_id: s.cryptomus_id || '', cryptomus_key: s.cryptomus_key ? '******' : '',
        smtp_host: s.smtp_host || '', smtp_port: s.smtp_port || 465,
        smtp_user: s.smtp_user || '', smtp_pass: s.smtp_pass ? '******' : ''
      }
      const r2 = await fetch(`/api/sites/stats?site_id=${s.id}`, { headers: headers() })
      const d2 = await r2.json()
      stats.value = d2.data || {}
    }
  } catch (e) { console.error(e) } finally { loading.value = false }
}

const parseModules = (raw) => {
  const defaults = Object.keys(MODULES).map((k, i) => ({ key: k, enabled: true, order: i }))
  if (!raw) return defaults
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr) || arr.length === 0) return defaults
    return arr
  } catch (e) { return defaults }
}

const moveModule = (i, dir) => {
  const arr = form.value.modules
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  const t = arr[i]; arr[i] = arr[j]; arr[j] = t
  arr.forEach((m, idx) => (m.order = idx))
}

const save = async () => {
  if (!site.value) return
  saving.value = true
  try {
    const payload = {
      name: form.value.name, multiplier: form.value.multiplier,
      footer_text: form.value.footer_text, support_url: form.value.support_url,
      announcement: form.value.announcement,
      template: form.value.template, color: form.value.color, accent: form.value.accent,
      home_modules: JSON.stringify(form.value.modules.map((m, i) => ({ key: m.key, enabled: !!m.enabled, order: i }))),
      bufpay_id: form.value.bufpay_id, bufpay_key: form.value.bufpay_key,
      cryptomus_id: form.value.cryptomus_id, cryptomus_key: form.value.cryptomus_key,
      smtp_host: form.value.smtp_host, smtp_port: form.value.smtp_port,
      smtp_user: form.value.smtp_user, smtp_pass: form.value.smtp_pass
    }
    const res = await fetch(`/api/sites/${site.value.id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(payload) })
    const data = await res.json()
    alert(data.status === 'success' ? '✅ 已保存，访客刷新即可看到新外观' : `❌ ${data.message}`)
    if (data.status === 'success') load()
  } catch (e) { alert('保存失败') } finally { saving.value = false }
}

const createSite = async () => {
  creating.value = true
  try {
    const res = await fetch('/api/sites', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        domain: createForm.value.domain, name: createForm.value.name,
        multiplier: createForm.value.multiplier
      })
    })
    const data = await res.json()
    alert(data.status === 'success' ? '✅ 分站已开通' : `❌ ${data.message}`)
    if (data.status === 'success') load()
  } catch (e) { alert('开通失败') } finally { creating.value = false }
}

const bindOwnDomain = async () => {
  if (!site.value || !bindDomain.value) return
  binding.value = true
  domainHint.value = ''
  try {
    const res = await fetch(`/api/sites/${site.value.id}/domain`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ domain: bindDomain.value.trim() })
    })
    const data = await res.json()
    if (data.status === 'success') {
      alert(`✅ ${data.message}`)
      load()
    } else if (data.status === 'pending') {
      domainHint.value = `${data.message}\n${data.detail || ''}\n\n${data.hint || ''}`
    } else {
      domainHint.value = `❌ ${data.message}`
    }
  } catch (e) { domainHint.value = '❌ 请求失败' } finally { binding.value = false }
}

onMounted(load)
</script>
