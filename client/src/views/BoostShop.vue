<template>
  <div class="min-h-screen bg-slate-950 text-white">
    <div class="max-w-6xl mx-auto px-3 md:px-5 py-5 md:py-8">

      <!-- ── 头部 ─────────────────────────────────────────────────────────── -->
      <header class="mb-5">
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <span class="text-2xl">🎯</span>
          <h1 class="text-xl md:text-2xl font-black tracking-tight">千川流量 · 价目表</h1>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 font-bold">XNOW 直连资源</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 font-bold">24H 在线授权</span>
        </div>
        <p class="text-xs md:text-sm text-slate-400 leading-relaxed">
          抖音播放 · 点赞 · 涨粉 · 场观 · 扫码，全部 24 小时秒授权。
          <span class="text-amber-300 font-bold">下单后请务必添加客服确认链接</span>，否则无法开跑。
        </p>
      </header>

      <!-- ── 下单须知（后台可改：客服设置 → 下单页提示文案）────────────────── -->
      <div v-if="customer.hint"
           class="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3.5 py-3 flex gap-2.5">
        <span class="text-amber-400 text-base leading-none mt-0.5 shrink-0">📌</span>
        <p class="text-[12px] md:text-[13px] text-amber-100/90 leading-relaxed">{{ customer.hint }}</p>
      </div>

      <div v-if="loading" class="text-center py-20 text-slate-500 text-sm">加载中…</div>
      <div v-else-if="error" class="bg-red-500/10 border border-red-500/40 rounded-xl p-4 text-sm text-red-300">
        {{ error }}
        <button @click="load" class="ml-2 underline">重试</button>
      </div>

      <template v-else>
        <!-- ── 平台 + 业务 两级筛选 ─────────────────────────────────────── -->
        <!-- 抖音和视频号是两套完全不同的业务，必须先在平台这一层分开，
             否则客户会把「视频号涨粉」当成抖音的业务 -->
        <div class="sticky top-0 z-20 bg-slate-950/95 backdrop-blur py-2 -mx-3 px-3 md:mx-0 md:px-0 mb-3">
          <div class="flex gap-1.5 mb-2">
            <button v-for="p in PLATFORMS" :key="p.key" @click="switchPlatform(p.key)"
                    :class="platClass(activePlatform === p.key)">
              <span v-if="p.icon" class="mr-1">{{ p.icon }}</span>{{ p.label }}
              <span class="ml-1 text-[10px] opacity-60">{{ platformCount(p.key) }}</span>
            </button>
          </div>
          <div class="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button @click="activeCat = 'all'"
                    :class="tabClass(activeCat === 'all')">全部</button>
            <button v-for="c in catsOfPlatform" :key="c.key" @click="activeCat = c.key"
                    :class="tabClass(activeCat === c.key)">
              {{ c.label }}
            </button>
          </div>
        </div>

        <!-- ── 分组表格 ─────────────────────────────────────────────────── -->
        <section v-for="g in displayGroups" :key="g.key" class="mb-5">
          <!-- 分组标题条：抖音用琥珀色、视频号用翠绿色，扫一眼就知道是哪个平台 -->
          <div :class="['flex flex-wrap items-baseline gap-2 px-3 py-2 rounded-t-xl bg-gradient-to-r text-black',
                        g.platform === 'wechat' ? 'from-emerald-500 to-teal-500' : 'from-amber-500 to-orange-500']">
            <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-black/25">
              {{ g.platform === 'wechat' ? '视频号' : '抖音' }}
            </span>
            <h2 class="font-black text-sm md:text-base">{{ g.label }}</h2>
            <span class="text-[11px] font-bold opacity-70">{{ g.sub }}</span>
            <span class="ml-auto text-[10px] font-bold opacity-60">{{ g.items.length }} 项</span>
          </div>

          <div class="overflow-x-auto bg-slate-900 border border-t-0 border-slate-700/70 rounded-b-xl">
            <table class="w-full min-w-[700px] text-xs md:text-sm">
              <thead>
                <tr class="text-[10px] md:text-[11px] text-slate-500 uppercase tracking-wide border-b border-slate-800">
                  <th class="text-left font-bold px-3 py-2 w-10">#</th>
                  <th class="text-left font-bold px-2 py-2">商品</th>
                  <th class="text-left font-bold px-2 py-2">规格</th>
                  <th class="text-right font-bold px-2 py-2 whitespace-nowrap">下单量</th>
                  <th class="text-right font-bold px-2 py-2 whitespace-nowrap">单价</th>
                  <th class="text-right font-bold px-2 py-2 whitespace-nowrap">总价</th>
                  <th class="text-left font-bold px-2 py-2">备注</th>
                  <th class="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(p, pi) in g.items" :key="p.id">
                  <tr v-for="(r, ri) in p.rows" :key="p.id + '-' + ri"
                      class="border-b border-slate-800/60 hover:bg-slate-800/40 transition"
                      :class="(pi + ri) % 2 ? 'bg-slate-900/40' : ''">

                    <!-- 同一商品的多档合并成一格（和价目表一样，只写一次商品名） -->
                    <td v-if="ri === 0" :rowspan="p.rows.length"
                        class="px-3 py-2 font-mono text-[10px] text-slate-600 align-top border-r border-slate-800/60">
                      {{ seq(pi) }}
                    </td>
                    <td v-if="ri === 0" :rowspan="p.rows.length"
                        class="px-2 py-2 align-top border-r border-slate-800/60 min-w-[130px]">
                      <div class="font-bold text-white leading-snug">{{ shortName(p) }}</div>
                      <div v-if="p.badge" class="mt-1">
                        <span :class="['text-[9px] px-1.5 py-0.5 rounded font-black whitespace-nowrap',
                                       p.badge === '需授权'
                                         ? 'bg-red-500/20 border border-red-500/50 text-red-300'
                                         : 'bg-amber-400 text-black']">{{ p.badge }}</span>
                      </div>
                    </td>

                    <td class="px-2 py-2 text-amber-300/90 whitespace-nowrap">{{ r.label }}</td>

                    <td class="px-2 py-2 text-right font-mono text-slate-300 whitespace-nowrap">
                      {{ r.qty.toLocaleString() }}
                    </td>

                    <td class="px-2 py-2 text-right font-mono whitespace-nowrap">
                      <template v-if="r.unitPrice != null">
                        <span class="text-amber-400 font-bold">¥{{ r.unitPrice }}</span><span class="text-slate-600">/{{ p.unit_label }}</span>
                      </template>
                      <span v-else class="text-slate-600">—</span>
                    </td>

                    <td class="px-2 py-2 text-right font-mono font-black text-white whitespace-nowrap">
                      <template v-if="r.total > 0">¥{{ r.total.toFixed(2) }}</template>
                      <span v-else class="text-amber-300 text-[11px]">面议</span>
                    </td>

                    <td v-if="ri === 0" :rowspan="p.rows.length"
                        class="px-2 py-2 text-[11px] align-top max-w-[210px] leading-relaxed">
                      <div class="text-slate-400">{{ specNote(p) }}</div>
                      <div v-if="p.eta_text" class="text-emerald-400/80 mt-1">⏱ {{ p.eta_text }}</div>
                    </td>

                    <td class="px-2 py-2 text-right align-top">
                      <!-- 价格待定的商品（如千川场观）不让人自助下单，改成询价 -->
                      <button v-if="r.total > 0" @click="openProduct(p, r.qty)"
                              class="px-2.5 py-1.5 rounded-lg bg-amber-400 text-black text-[11px] font-black hover:bg-amber-300 active:scale-95 transition whitespace-nowrap">
                        下单
                      </button>
                      <button v-else @click="askPrice(p)"
                              class="px-2.5 py-1.5 rounded-lg bg-slate-700 text-amber-300 text-[11px] font-black hover:bg-slate-600 active:scale-95 transition whitespace-nowrap border border-amber-500/40">
                        询价
                      </button>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <!-- 分组说明（如「稳定 24-48 小时左右清除」） -->
          <p v-if="g.note" class="mt-1.5 text-[11px] text-slate-500 px-1">{{ cleanNotice(g.note) }}</p>
        </section>

        <!-- ── 我的千川订单 ─────────────────────────────────────────────── -->
        <section v-if="myOrders.length" class="mt-8">
          <h2 class="text-sm font-black text-slate-300 mb-3">我的千川订单</h2>
          <div class="space-y-2">
            <div v-for="o in myOrders" :key="o.id"
                 class="bg-slate-900 border border-slate-700/70 rounded-xl p-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
              <span class="font-mono text-slate-400">{{ o.order_no }}</span>
              <span class="text-white font-bold">{{ o.product_name }}</span>
              <span class="text-slate-500">× {{ o.quantity }}</span>
              <span class="text-amber-400 font-bold">¥{{ Number(o.charge).toFixed(2) }}</span>
              <span :class="statusClass(o.status)" class="px-2 py-0.5 rounded font-bold">{{ o.status }}</span>
              <button v-if="o.status === '待派单' || o.status === '处理中'"
                      @click="reopenContact(o)"
                      class="ml-auto text-amber-300 underline">联系客服</button>
            </div>
          </div>
        </section>
      </template>
    </div>

    <!-- ── 下单面板 ───────────────────────────────────────────────────────── -->
    <div v-if="active" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4" @click.self="closeActive">
      <div class="w-full md:max-w-lg bg-slate-900 md:rounded-2xl rounded-t-3xl border border-slate-700 max-h-[92vh] overflow-y-auto">
        <div class="sticky top-0 bg-slate-900/95 backdrop-blur px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 class="font-black text-sm">{{ active.name }}</h3>
          <button @click="closeActive" class="text-slate-500 hover:text-white text-xl leading-none px-2">×</button>
        </div>

        <div class="p-4 space-y-4">
          <!-- 数量 -->
          <div v-if="active.pricing_mode !== 'flat'">
            <label class="block text-xs font-bold text-slate-400 mb-1.5">
              购买数量（{{ active.unit_label }}）—— 最少 {{ active.min_qty.toLocaleString() }}
            </label>
            <div class="flex gap-2">
              <input v-model.number="form.quantity" type="number" :step="active.qty_step" :min="active.min_qty"
                     class="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white outline-none focus:border-amber-400 font-mono text-sm" />
              <button @click="form.quantity = active.min_qty"
                      class="px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-xs font-bold text-slate-300">最少</button>
            </div>
            <div v-if="active.tiers.length > 1" class="mt-2 flex flex-wrap gap-1.5">
              <button v-for="t in active.tiers" :key="t.min" @click="form.quantity = t.min"
                      :class="['text-[10px] px-2 py-1 rounded-lg border font-mono transition',
                               hitTier && hitTier.min === t.min
                                 ? 'bg-amber-400/20 border-amber-400/60 text-amber-200'
                                 : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500']">
                ≥{{ t.min.toLocaleString() }} → ¥{{ t.price }}/{{ active.unit_label }}
              </button>
            </div>
          </div>
          <div v-else class="bg-slate-800/60 rounded-xl p-3 text-xs text-slate-300">
            固定规格：<span class="font-bold text-white">{{ active.min_qty.toLocaleString() }}</span>
            <span class="text-slate-500 ml-2">（此规格数量不可修改）</span>
          </div>

          <!-- 动态字段 -->
          <div v-for="f in active.input_schema" :key="f.key">
            <label class="block text-xs font-bold text-slate-400 mb-1.5">
              {{ f.label }}<span v-if="f.required" class="text-red-400 ml-0.5">*</span>
            </label>
            <textarea v-if="f.type === 'textarea'" v-model="form.fields[f.key]" :placeholder="f.placeholder || ''" rows="2"
                      class="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white outline-none focus:border-amber-400 text-sm resize-none"></textarea>
            <input v-else v-model="form.fields[f.key]" :placeholder="f.placeholder || ''"
                   class="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white outline-none focus:border-amber-400 text-sm" />
            <!-- 填错格式当场提示，别等提交后才报错 -->
            <p v-if="f.patternHint" class="text-[10px] text-slate-500 mt-1 leading-relaxed">{{ f.patternHint }}</p>
          </div>

          <div v-if="active.notice" class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-200/90 leading-relaxed">
            ⚠️ {{ cleanNotice(active.notice) }}
          </div>

          <!-- 需授权业务（视频号 Adq / 千川涨粉）：未授权下单必然要退，这里再顶一条红色提醒 -->
          <div v-if="needsAuth(active)" class="bg-red-500/10 border border-red-500/40 rounded-xl p-3 text-[11px] text-red-200 leading-relaxed">
            <b>下单前请确认：</b>你的账号已完成授权，否则无法开跑，只能全额退款。不确定就先加客服问一下。
          </div>

          <div class="border-t border-slate-800 pt-3 space-y-1.5">
            <div class="flex justify-between text-xs text-slate-400">
              <span>单价</span>
              <span class="font-mono">{{ hitTier ? '¥' + hitTier.price + '/' + active.unit_label : (active.pricing_mode === 'flat' ? '固定总价' : '—') }}</span>
            </div>
            <div class="flex justify-between items-baseline">
              <span class="text-xs text-slate-400">应付金额</span>
              <span class="text-2xl font-black text-amber-400">¥{{ chargeDisplay }}</span>
            </div>
            <div class="flex justify-between text-[11px] text-slate-500">
              <span>当前余额</span><span class="font-mono">¥{{ balanceDisplay }}</span>
            </div>
          </div>

          <p v-if="tip" class="text-xs text-center" :class="tipType === 'error' ? 'text-red-400' : 'text-emerald-400'">{{ tip }}</p>

          <button @click="submit" :disabled="submitting || !canSubmit"
                  :class="['w-full py-3.5 rounded-xl font-black text-sm transition',
                           submitting || !canSubmit
                             ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                             : 'bg-amber-400 text-black hover:bg-amber-300 active:scale-[0.99]']">
            {{ submitting ? '提交中…' : '确认下单 ¥' + chargeDisplay }}
          </button>
          <p class="text-[10px] text-center text-slate-500">
            下单后会自动跳转到客服对接页，请复制订单号发给客服
          </p>
        </div>
      </div>
    </div>

    <!-- ── 询价（价格待定的商品，如千川场观）───────────────────────────── -->
    <div v-if="inquiry" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="w-full max-w-sm bg-slate-900 rounded-2xl border border-amber-500/40 p-5 text-center">
        <div class="text-3xl mb-2">💬</div>
        <h3 class="font-black text-base mb-1">{{ inquiry.name }}</h3>
        <p class="text-[11px] text-slate-400 mb-4">该项价格待定，请联系客服报价后下单</p>

        <div v-if="customer.wechat_qr || customer.tg || customer.wechat_id" class="border-t border-slate-800 pt-4">
          <img v-if="customer.wechat_qr" :src="customer.wechat_qr" alt="客服微信"
               class="w-36 h-36 mx-auto rounded-xl object-contain bg-white p-1.5" />
          <a v-if="customer.tg" :href="customer.tg_url || ('https://t.me/' + customer.tg.replace('@',''))"
             target="_blank" rel="noopener"
             class="inline-block mt-2 px-4 py-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-bold">
            ✈️ TG：{{ customer.tg }}
          </a>
          <p v-if="customer.wechat_id" class="text-[11px] text-slate-500 mt-2">
            微信号：<span class="font-mono">{{ customer.wechat_id }}</span>
          </p>
        </div>
        <p v-else class="text-[11px] text-slate-500">客服联系方式正在配置中，请稍后再来。</p>

        <button @click="inquiry = null" class="w-full mt-4 py-3 rounded-xl bg-amber-400 text-black font-black text-sm">知道了</button>
      </div>
    </div>

    <!-- ── 下单成功 · 客服对接卡 ─────────────────────────────────────────── -->
    <div v-if="success" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="w-full max-w-sm bg-slate-900 rounded-2xl border border-emerald-500/40 p-5 text-center max-h-[92vh] overflow-y-auto">
        <div class="text-4xl mb-2">✅</div>
        <h3 class="font-black text-lg mb-1">下单成功</h3>
        <p class="text-[11px] text-slate-400 mb-4">客服将在 5 分钟内联系你确认链接</p>

        <div class="bg-slate-800 rounded-xl p-3 mb-4">
          <p class="text-[10px] text-slate-500 mb-1">订单号（加客服时请发这个）</p>
          <p class="font-mono text-lg font-black text-amber-400 tracking-wider select-all">{{ success.order_no }}</p>
          <button @click="copyOrderNo" class="mt-2 text-[11px] text-slate-300 underline">
            {{ copied ? '已复制 ✓' : '一键复制' }}
          </button>
        </div>

        <div class="text-xs text-slate-300 space-y-1 mb-4">
          <p>{{ success.product_name }}</p>
          <p class="text-slate-500">× {{ success.quantity }}　实付 <span class="text-amber-400 font-bold">¥{{ Number(success.charge).toFixed(2) }}</span></p>
        </div>

        <div v-if="customer.wechat_qr || customer.tg || customer.wechat_id" class="border-t border-slate-800 pt-4">
          <p class="text-[11px] text-slate-400 mb-2">👉 加客服确认链接</p>
          <img v-if="customer.wechat_qr" :src="customer.wechat_qr" alt="客服微信"
               class="w-36 h-36 mx-auto rounded-xl object-contain bg-white p-1.5" />
          <a v-if="customer.tg" :href="customer.tg_url || ('https://t.me/' + customer.tg.replace('@',''))"
             target="_blank" rel="noopener"
             class="inline-block mt-2 px-4 py-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-bold">
            ✈️ TG：{{ customer.tg }}
          </a>
          <p v-if="customer.wechat_id" class="text-[11px] text-slate-500 mt-2">
            微信号：<span class="font-mono">{{ customer.wechat_id }}</span>
          </p>
          <div class="flex gap-2 mt-3">
            <button @click="markContact('wechat')" class="flex-1 text-[11px] py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">我已加微信</button>
            <button @click="markContact('tg')" class="flex-1 text-[11px] py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">我已加 TG</button>
          </div>
        </div>

        <button @click="closeSuccess" class="w-full mt-4 py-3 rounded-xl bg-amber-400 text-black font-black text-sm">
          知道了
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '../stores/user';
import { fetchWithTimeout } from '../utils/fetchTimeout';

const userStore = useUserStore();

const loading = ref(true);
const error = ref('');
const categories = ref([]);
const activeCat = ref('all');
const activePlatform = ref('all');   // all | douyin | wechat
const myOrders = ref([]);
const customer = ref({ wechat_id: '', wechat_qr: '', tg: '', tg_url: '', hint: '' });

// 平台层：抖音和视频号是两条独立业务线，先选平台再看业务分类
const PLATFORMS = [
  { key: 'all', label: '全部', icon: '' },
  { key: 'douyin', label: '抖音', icon: '🎵' },
  { key: 'wechat', label: '视频号', icon: '💬' },
];

const active = ref(null);
const form = ref({ quantity: 0, fields: {} });
const submitting = ref(false);
const tip = ref('');
const tipType = ref('error');

const success = ref(null);
const copied = ref(false);
const inquiry = ref(null);   // 价格待定商品的询价弹窗

// 分组副标题：尽量贴原价目表的措辞，别自己改词
const GROUP_SUB = {
  play: '无互动 / 无点赞',
  marketing: '带互动带点赞 · 有真实访客',
  natural: '纯自然推荐流量 · 包中位数',
  like: '真实点赞',
  scan: '扫码配合 · 要求客户及时在线',
  fans: '仅限已授权账号',
  liveview: '仅限已授权账号',
  account: '仅限已授权账号',
};
const GROUP_NOTE = {
  fans: '⚠️ 数据稳定 24–48 小时左右，之后可能回清；「不包有效」档不承诺留存数量。',
  scan: '⚠️ 扫码配合要求客户及时在线，客服会跟您约时间；未在线会导致无法完成。',
  liveview: '价格待定，请联系客服报价后下单。',
};

const catsOfPlatform = computed(() => {
  if (activePlatform.value === 'all') return categories.value;
  return categories.value.filter((c) => (c.platform || 'douyin') === activePlatform.value);
});

// 平台 tab 后面的商品数，让客户知道点进去有多少东西
function platformCount(key) {
  const list = key === 'all'
    ? categories.value
    : categories.value.filter((c) => (c.platform || 'douyin') === key);
  return list.reduce((s, c) => s + (c.count || 0), 0);
}

function switchPlatform(key) {
  activePlatform.value = key;
  activeCat.value = 'all';   // 换平台时业务分类必须重置，否则会筛出空列表
}

const displayGroups = computed(() => {
  const withRows = (items) => items.map((p) => ({ ...p, rows: rowsOf(p) }));
  let list = catsOfPlatform.value;
  if (activeCat.value !== 'all') {
    const c = list.find((x) => x.key === activeCat.value);
    list = c ? [c] : [];
  }
  return list.map((c) => ({
    key: c.key,
    label: c.label,
    platform: c.platform || 'douyin',
    items: withRows(c.items),
    sub: GROUP_SUB[c.key] || '',
    note: GROUP_NOTE[c.key] || '',
  }));
});

function platClass(on) {
  return ['px-3.5 py-1.5 rounded-lg text-xs font-black border transition shrink-0',
          on ? 'bg-white text-slate-900 border-white' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'];
}

// 把商品展开成「表行」：阶梯商品每一档一行（像价目表的 1-2万 / 3-9万 / 10万以上），
// 固定价商品就一行（扫码 200 = ¥75）
function fmtQty(n) {
  if (n >= 10000 && n % 10000 === 0) return n / 10000 + '万';
  if (n >= 1000 && n % 1000 === 0) return n / 1000 + '千';
  return n.toLocaleString();
}

function rowsOf(p) {
  if (p.pricing_mode === 'flat') {
    return [{
      label: p.subtitle || '固定规格',
      qty: p.min_qty,
      unitPrice: null,
      total: Number(p.flat_price || 0),
      hint: p.eta_text || '',
    }];
  }
  return (p.tiers || []).map((t) => ({
    label: `≥ ${fmtQty(t.min)}`,
    qty: t.min,
    unitPrice: t.price,
    total: Number(((t.min / (p.unit_qty || 10000)) * t.price).toFixed(2)),
    hint: p.eta_text || '',
  }));
}

function seq(i) {
  return String(i + 1).padStart(3, '0');
}

// 后台用 markdown 的 ** 强调写须知，这里是纯文本插值，不清理会把星号原样显示给客户
function cleanNotice(s) {
  return String(s || '').replace(/\*\*/g, '');
}

// 需授权的业务线：视频号 Adq、千川场观、千川不开播涨粉。靠 badge 文案判定，后台改 badge 即可切换。
function needsAuth(p) {
  return !!(p && (p.badge === '需授权' || /需授权|仅限已授权/.test(p.subtitle || '')));
}

// 表格「备注」列 = 商品特性说明（无互动/无点赞、包来客…），这是客户最关心的一句话
function specNote(p) {
  return p.subtitle || '';
}

// 表格里商品名去掉「XNOW 」前缀和「·」后面的重复分类词，保留可读的品类名
function shortName(p) {
  return (p.name || '').replace(/^XNOW\s*/, '');
}

function tabClass(on) {
  return ['px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition shrink-0',
          on ? 'bg-amber-400 text-black border-amber-400' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'];
}

function calcPrice(p, qty) {
  if (!p) return null;
  if (p.pricing_mode === 'flat') return Number(p.flat_price || 0);
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return null;
  let best = null;
  for (const t of p.tiers || []) if (n >= t.min && (!best || t.min > best.min)) best = t;
  if (!best) return null;
  return Number(((n / (p.unit_qty || 10000)) * best.price).toFixed(2));
}

const hitTier = computed(() => {
  const p = active.value;
  if (!p || p.pricing_mode === 'flat') return null;
  const n = Number(form.value.quantity);
  let best = null;
  for (const t of p.tiers || []) if (n >= t.min && (!best || t.min > best.min)) best = t;
  return best;
});

const charge = computed(() => calcPrice(active.value, form.value.quantity));
const chargeDisplay = computed(() => (charge.value == null ? '—' : charge.value.toFixed(2)));
const balanceDisplay = computed(() => Number(userStore.userInfo?.balance || 0).toFixed(2));
const canSubmit = computed(() => charge.value != null && charge.value > 0);

function statusClass(s) {
  if (s === '待派单') return 'bg-amber-400/15 text-amber-300';
  if (s === '处理中') return 'bg-sky-400/15 text-sky-300';
  if (s === '已完成') return 'bg-emerald-400/15 text-emerald-300';
  if (s === '已退款') return 'bg-red-400/15 text-red-300';
  return 'bg-slate-700 text-slate-300';
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [cRes, custRes] = await Promise.all([
      fetchWithTimeout('/api/boost/catalog', {}, 15000, 1),
      fetchWithTimeout('/api/boost/customer', {}, 10000, 1).catch(() => null),
    ]);
    if (!cRes.ok) throw new Error('HTTP ' + cRes.status);
    const j = await cRes.json();
    if (j.status !== 'success') throw new Error(j.message || '加载失败');
    categories.value = j.data.categories || [];

    if (custRes && custRes.ok) {
      const cj = await custRes.json().catch(() => null);
      if (cj && cj.status === 'success') customer.value = cj.data || customer.value;
    }
    loadMyOrders();
  } catch (e) {
    error.value = e.name === 'AbortError' ? '加载超时，请重试' : '加载失败，请点击重试';
  } finally {
    loading.value = false;
  }
}

async function loadMyOrders() {
  if (!userStore.token) return;
  try {
    const r = await fetchWithTimeout('/api/boost/orders', {
      headers: { Authorization: `Bearer ${userStore.token}` },
    }, 15000, 1);
    if (!r.ok) return;
    const j = await r.json();
    if (j.status === 'success') myOrders.value = j.data || [];
  } catch { /* 静默：订单列表失败不影响下单 */ }
}

// qty 由表格行传入：点「≥10万」那一行，下单面板就预填 100000
function openProduct(p, qty) {
  active.value = p;
  tip.value = '';
  form.value = {
    quantity: qty || p.min_qty,
    fields: {},
  };
  if (!userStore.token) {
    tip.value = '请先登录后再下单';
    tipType.value = 'error';
  }
}

function closeActive() {
  active.value = null;
  tip.value = '';
}

// 价格待定（flat_price = 0）的商品走询价，不让客户自助下单
function askPrice(p) {
  inquiry.value = { name: p.name };
}

async function submit() {
  if (!active.value || submitting.value) return;
  if (!userStore.token) {
    tip.value = '登录状态已失效，请重新登录';
    tipType.value = 'error';
    return;
  }
  for (const f of active.value.input_schema || []) {
    const raw = String(form.value.fields[f.key] || '').trim();
    if (f.required && !raw) {
      tip.value = `请填写${f.label}`;
      tipType.value = 'error';
      return;
    }
    // 🔴 格式校验：填错了投不出去，最后只能退款，浪费双方时间。
    //    规则由后端 input_schema 下发，前后端用同一份，不会跑偏。
    if (raw && f.pattern) {
      let re = null;
      try { re = new RegExp(f.pattern, 'i'); } catch { re = null; }
      if (re) {
        const vals = f.multiple ? raw.split(/[\s,，]+/).filter(Boolean) : [raw];
        if (vals.some((x) => !re.test(x))) {
          tip.value = f.patternHint || `${f.label} 格式不正确，请检查后重新填写`;
          tipType.value = 'error';
          return;
        }
      }
    }
  }

  submitting.value = true;
  tip.value = '';
  try {
    const r = await fetchWithTimeout('/api/boost/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userStore.token}`,
      },
      body: JSON.stringify({
        product_id: active.value.id,
        quantity: form.value.quantity,
        fields: form.value.fields,
      }),
    }, 25000, 0);

    const j = await r.json().catch(() => null);
    if (!j) { tip.value = '网络异常，请重试'; tipType.value = 'error'; return; }
    if (j.status !== 'success') { tip.value = j.message || '下单失败'; tipType.value = 'error'; return; }

    success.value = j.data;
    active.value = null;
    if (j.data && j.data.balance != null) {
      userStore.userInfo = { ...(userStore.userInfo || {}), balance: j.data.balance };
    }
    loadMyOrders();
  } catch (e) {
    tip.value = e.name === 'AbortError' ? '提交超时，请到「我的千川订单」确认是否成功' : '网络异常，请重试';
    tipType.value = 'error';
  } finally {
    submitting.value = false;
  }
}

async function copyOrderNo() {
  if (!success.value) return;
  try {
    await navigator.clipboard.writeText(success.value.order_no);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    tip.value = '复制失败，请手动选择复制';
  }
}

async function markContact(channel) {
  if (!success.value || !userStore.token) return;
  try {
    await fetchWithTimeout(`/api/boost/orders/${success.value.id}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userStore.token}` },
      body: JSON.stringify({ channel }),
    }, 10000, 0);
  } catch { /* 无关紧要，运营后台也能标记 */ }
}

function closeSuccess() {
  success.value = null;
  copied.value = false;
}

async function reopenContact(o) {
  success.value = { id: o.id, order_no: o.order_no, product_name: o.product_name, quantity: o.quantity, charge: o.charge };
  copied.value = false;
}

onMounted(load);
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
