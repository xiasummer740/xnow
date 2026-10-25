<script setup>
// 💰 站长自己的价格体系：单服务定价 + 活动折扣
//    后端：GET/PUT /api/sites/:id/prices、PUT /api/sites/:id（折扣三字段）
//    红线：任何价格乘上折扣都不得低于站长的进货价，后端会拦（这里只负责把话说清楚）。
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '../../stores/user';

const props = defineProps({
  siteId: { type: [Number, String], required: true },
});
const emit = defineEmits(['saved']);

const userStore = useUserStore();

const loading = ref(true);
const saving = ref(false);
const msg = ref('');
const msgOk = ref(true);

const items = ref([]);
const query = ref('');
// 🗂 92 期：分类顺序跟主站一模一样（后端按 services.sort 排完回传）
const categories = ref([]);
const platforms = ref([]);
const activePlatform = ref('');   // '' = 全部平台
const activeCategory = ref('');   // '' = 该平台下全部分类

// 分类名普遍很长（带【…】备注、emoji），胶囊上只显示短名，完整名放 title
const shortCat = (name) => {
  let n = String(name || '');
  n = n.split('【')[0].replace(/[（(][^）)]*[）)]\s*$/, '').trim();
  n = n.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();
  if (!n) n = String(name || '').split('【')[0].trim();
  return n.length > 16 ? n.slice(0, 15) + '…' : n;
};

// 当前平台下可见的分类（未选平台时显示全部）
const visibleCats = computed(() =>
  activePlatform.value ? categories.value.filter((c) => c.platform === activePlatform.value) : categories.value);

const pickPlatform = (p) => {
  activePlatform.value = p;
  activeCategory.value = '';
  load();
};

const draft = ref({});            // service_id -> 面板里填的价格（字符串）

// ✏️ 改价面板 + 批量（97 期）
const sheet = ref(null);
const sheetPrice = ref('');
const batchMargin = ref(30);

const isOverride = (it) => it.override !== null && it.override !== undefined;
const dirty = (it) => (draft.value[it.service_id] ?? '').trim() !== (isOverride(it) ? String(it.override) : '');
const priceText = (it) => {
  const raw = (draft.value[it.service_id] ?? '').trim();
  const v = raw === '' ? it.list_price : parseFloat(raw);
  return isFinite(v) ? v.toFixed(2) : '—';
};

function openSheet(it) {
  sheet.value = it;
  sheetPrice.value = (draft.value[it.service_id] ?? '').trim();
}
function closeSheet() { sheet.value = null; sheetPrice.value = ''; }
function applySheet() {
  if (!sheet.value) return;
  draft.value[sheet.value.service_id] = String(sheetPrice.value || '').trim();
  closeSheet();
}

// 面板里的实时收益
const sheetMargin = computed(() => {
  if (!sheet.value) return null;
  const raw = (sheetPrice.value || '').trim();
  const price = raw === '' ? sheet.value.list_price : parseFloat(raw);
  if (!isFinite(price) || price <= 0) return null;
  const sell = price * (dRate.value || 1);
  const cost = sheet.value.cost_per_1k;
  return {
    sell: sell.toFixed(4),
    profit: (sell - cost).toFixed(4),
    pct: sell > 0 ? (((sell - cost) / sell) * 100).toFixed(1) : '0',
    lose: sell < cost - 1e-6,
  };
});

// 常用价位：以进货价为基准，避免站长自己算错
function quickPresets(it) {
  const c = Number(it.cost_per_1k) || 0;
  const f = (x) => String(Number((c * x).toFixed(4)));
  return [
    { t: `进货价 ¥${c.toFixed(2)}`, v: f(1) },
    { t: '+20%', v: f(1.2) },
    { t: '+50%', v: f(1.5) },
    { t: '×2', v: f(2) },
  ];
}

// 整类一键：进货价 × (1 + 毛利%)
function applyBatch() {
  const m = Number(batchMargin.value);
  if (!isFinite(m) || m < 0) return;
  for (const it of items.value) {
    draft.value[it.service_id] = String(Number((Number(it.cost_per_1k) * (1 + m / 100)).toFixed(4)));
  }
  flash(`已按「进货价 +${m}%」填好 ${items.value.length} 条，确认后点「保存定价」`, true);
}
function clearDrafts() {
  for (const it of items.value) {
    draft.value[it.service_id] = isOverride(it) ? String(it.override) : '';
  }
}
// ⚡ 110 期（祥哥：某些批量的不好改）
//    ① 勾选若干条 → 一起改（不用一条条点开面板）
//    ② 按平台/分类/关键词「整批改价」→ 服务端扫全表，不受页面只显示 200 条的截断限制
const picked = ref([]);
const pickedSet = computed(() => new Set(picked.value.map(Number)));
const isPicked = (it) => pickedSet.value.has(Number(it.service_id));
function togglePick(it) {
  const id = Number(it.service_id);
  const i = picked.value.findIndex(x => Number(x) === id);
  if (i >= 0) picked.value.splice(i, 1); else picked.value.push(id);
}
function pickAllVisible() { picked.value = items.value.map(it => Number(it.service_id)); }
function clearPicked() { picked.value = []; }

const pickMargin = ref(30);
const pickFixed = ref('');

// 勾选的这一批：按「进货价 + N%」填进草稿（确认后照旧点保存定价）
function fillPickedMargin() {
  const m = Number(pickMargin.value);
  if (!isFinite(m) || m < 0) return flash('加价率要填 0 或更大', false);
  let n = 0;
  for (const it of items.value) {
    if (!isPicked(it)) continue;
    draft.value[it.service_id] = String(Number((Number(it.cost_per_1k) * (1 + m / 100)).toFixed(4)));
    n++;
  }
  flash(`已给勾选的 ${n} 条填好「进货价 +${m}%」，确认后点保存定价`, !!n);
}
function fillPickedFixed() {
  const v = parseFloat(pickFixed.value);
  if (!isFinite(v) || v <= 0) return flash('价格要大于 0', false);
  let n = 0;
  for (const it of items.value) {
    if (!isPicked(it)) continue;
    draft.value[it.service_id] = String(v);
    n++;
  }
  flash(`已把勾选的 ${n} 条统一填成 ¥${v}`, !!n);
}
function fillPickedClear() {
  let n = 0;
  for (const it of items.value) {
    if (!isPicked(it)) continue;
    draft.value[it.service_id] = '';
    n++;
  }
  flash(`已把勾选的 ${n} 条改成「跟随全站统一价」（需点保存定价）`, !!n);
}

// 整批改价：直接落库（服务端按条件扫全表，不怕 200 条上限）
const bulkScope = ref('platform');   // platform | category | q | all
const bulkMode = ref('margin');      // margin | rate | clear
const bulkMargin = ref(30);
const bulkFixed = ref('');
const bulkBusy = ref(false);
async function runBulk() {
  if (bulkBusy.value) return;
  if (bulkScope.value === 'category' && !activeCategory.value) return flash('先在下面选一个分类，再整批改', false);
  if (bulkScope.value === 'platform' && !activePlatform.value) return flash('先选一个平台，再整批改', false);
  if (bulkScope.value === 'q' && !query.value.trim()) return flash('先在搜索框填关键词', false);
  const scopeName = bulkScope.value === 'platform' ? `平台「${activePlatform.value}」`
    : bulkScope.value === 'category' ? `分类「${shortCat(activeCategory.value)}」`
    : bulkScope.value === 'q' ? `搜到「${query.value.trim()}」的服务`
    : '全部服务';
  const how = bulkMode.value === 'margin' ? `进货价 +${bulkMargin.value}%`
    : bulkMode.value === 'rate' ? `统一 ¥${bulkFixed.value}`
    : '恢复跟随全站统一价';
  if (!confirm(`确定把 ${scopeName} 全部改成「${how}」？\n这会直接写进你的价格表（可以再改回来）。`)) return;
  bulkBusy.value = true;
  try {
    const r = await fetch(`/api/sites/${props.siteId}/prices/bulk`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: bulkScope.value,
        platform: activePlatform.value,
        category: activeCategory.value,
        q: query.value.trim(),
        mode: bulkMode.value,
        margin_pct: Number(bulkMargin.value),
        rate: bulkFixed.value,
      }),
    });
    const d = await r.json();
    flash(d.message || (d.status === 'success' ? '已改好' : '改价失败'), d.status === 'success');
    if (d.status === 'success') { picked.value = []; await load(); emit('saved'); }
  } catch (e) {
    flash('改价失败：' + e.message, false);
  } finally {
    bulkBusy.value = false;
  }
}

const meta = ref({ markup_pct: 0, discount_rate: 1, discount_label: '', discount_until: 0 });
const itemsAllCount = computed(() =>
  categories.value.reduce((n, c) => n + (c.count || 0), 0) || items.value.length);

// 折扣草稿
const dRate = ref(1);
const dLabel = ref('');
const dDays = ref(0);             // 0 = 长期，7/30 = 到期自动恢复

const auth = () => ({ Authorization: `Bearer ${userStore.token}` });

async function load() {
  loading.value = true;
  try {
    const qs = [];
    if (query.value) qs.push(`q=${encodeURIComponent(query.value)}`);
    if (activeCategory.value) qs.push(`category=${encodeURIComponent(activeCategory.value)}`);
    if (!activeCategory.value && activePlatform.value) qs.push(`platform=${encodeURIComponent(activePlatform.value)}`);
    const q = qs.length ? `?${qs.join('&')}` : '';
    const r = await fetch(`/api/sites/${props.siteId}/prices${q}`, { headers: auth() });
    const d = await r.json();
    if (d.status !== 'success') { flash(d.message || '读取失败', false); return; }
    const data = d.data;
    items.value = data.items || [];
    if (Array.isArray(data.categories) && data.categories.length) categories.value = data.categories;
    if (Array.isArray(data.platforms) && data.platforms.length) platforms.value = data.platforms;
    meta.value = data;
    dRate.value = Number(data.discount_rate || 1);
    dLabel.value = data.discount_label || '';
    draft.value = {};
    for (const it of items.value) {
      draft.value[it.service_id] = String(it.override !== null && it.override !== undefined ? it.override : '');
    }
  } catch (e) {
    flash('读取失败：' + e.message, false);
  } finally {
    loading.value = false;
  }
}

// 全部视图下按分类分组（顺序 = 主站顺序，组内顺序 = 主站顺序）
const grouped = computed(() => {
  if (activeCategory.value) return [{ name: activeCategory.value, items: items.value }];
  const out = [];
  const idx = new Map();
  for (const it of items.value) {
    const c = it.category || '其他';
    if (!idx.has(c)) { idx.set(c, out.length); out.push({ name: c, items: [] }); }
    out[idx.get(c)].items.push(it);
  }
  return out;
});

const pickCategory = (c) => {
  activeCategory.value = c;
  load();
};

function flash(text, ok = true) {
  msg.value = text; msgOk.value = ok;
  setTimeout(() => { if (msg.value === text) msg.value = ''; }, 4000);
}

const changed = computed(() => items.value.filter(it => {
  const cur = (draft.value[it.service_id] ?? '').trim();
  const orig = (it.override !== null && it.override !== undefined) ? String(it.override) : '';
  return cur !== orig;
}));

// 单行毛利预估：用客户端已知的成本与折扣算，后端仍会二次校验
function marginOf(it) {
  const raw = (draft.value[it.service_id] ?? '').trim();
  const price = raw === '' ? it.list_price : parseFloat(raw);
  if (!isFinite(price) || price <= 0) return null;
  const sell = price * (dRate.value || 1);
  const cost = it.cost_per_1k;
  return {
    sell: sell.toFixed(4),
    profit: (sell - cost).toFixed(4),
    pct: sell > 0 ? (((sell - cost) / sell) * 100).toFixed(1) : '0',
    lose: sell < cost - 1e-6,
  };
}

async function savePrices() {
  if (!changed.value.length) { flash('没有改动', true); return; }
  saving.value = true;
  try {
    const payload = {
      items: changed.value.map(it => ({
        service_id: it.service_id,
        rate: (draft.value[it.service_id] ?? '').trim() === '' ? null : parseFloat(draft.value[it.service_id]),
      })),
    };
    const r = await fetch(`/api/sites/${props.siteId}/prices`, {
      method: 'PUT',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    flash(d.message || (d.status === 'success' ? '已保存' : '保存失败'), d.status === 'success');
    if (d.status === 'success') { await load(); emit('saved'); }
  } catch (e) {
    flash('保存失败：' + e.message, false);
  } finally {
    saving.value = false;
  }
}

async function saveDiscount() {
  saving.value = true;
  try {
    const until = dDays.value > 0 ? Math.floor(Date.now() / 1000) + dDays.value * 86400 : 0;
    const r = await fetch(`/api/sites/${props.siteId}`, {
      method: 'PUT',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        discount_rate: Number(dRate.value),
        discount_label: dLabel.value.trim(),
        discount_until: until,
      }),
    });
    const d = await r.json();
    flash(d.message || (d.status === 'success' ? '折扣已生效' : '保存失败'), d.status === 'success');
    if (d.status === 'success') { await load(); emit('saved'); }
  } catch (e) {
    flash('保存失败：' + e.message, false);
  } finally {
    saving.value = false;
  }
}

const discountText = computed(() => {
  const r = Number(dRate.value);
  if (!r || r >= 1) return '当前：不打折';
  return `当前：${(r * 10).toFixed(1).replace(/\.0$/, '')} 折` + (dDays.value > 0 ? `，${dDays.value} 天后自动恢复原价` : '，长期有效');
});

onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <!-- 🎫 折扣促销 -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 class="font-bold text-sm text-emerald-400">折扣促销（给你的客户打折）</h2>
        <span class="text-[10px] text-slate-500">{{ discountText }}</span>
      </div>

      <p class="text-[11px] text-slate-500 mb-3 leading-relaxed">
        打折只影响你的客户看到的价格，你的进货价不变。系统有底线：打完折也不许低于你的进货价，填太狠会直接拦下。
      </p>

      <div class="grid grid-cols-3 md:grid-cols-6 gap-2 mb-3">
        <button v-for="opt in [{r:1,t:'不打折'},{r:0.95,t:'95 折'},{r:0.9,t:'9 折'},{r:0.85,t:'85 折'},{r:0.8,t:'8 折'},{r:0.75,t:'75 折'}]"
                :key="opt.r"
                @click="dRate = opt.r"
                :class="['py-2 rounded-lg text-xs font-bold border transition',
                         Number(dRate) === opt.r ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-emerald-500/60']">
          {{ opt.t }}
        </button>
      </div>

      <div class="grid md:grid-cols-3 gap-3">
        <div>
          <label class="block text-xs text-slate-400 mb-1">首页宣传语（可留空）</label>
          <input v-model="dLabel" maxlength="40" placeholder="例：开业 9 折，仅限本周"
                 class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">活动时长</label>
          <select v-model.number="dDays" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm">
            <option :value="0">长期有效</option>
            <option :value="3">3 天后结束</option>
            <option :value="7">7 天后结束</option>
            <option :value="30">30 天后结束</option>
          </select>
        </div>
        <div class="flex items-end">
          <button @click="saveDiscount" :disabled="saving"
                  class="w-full py-2 rounded-lg bg-emerald-500 text-slate-900 text-sm font-bold hover:bg-emerald-400 disabled:opacity-50">
            {{ saving ? '保存中…' : '保存折扣' }}
          </button>
        </div>
      </div>
    </section>

    <!-- 💰 单服务定价 -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 class="font-bold text-sm text-amber-400">单个服务改价（可选）</h2>
        <span class="text-[10px] text-slate-500">你的进货价就是底线 · 当前全场加价 {{ meta.markup_pct ?? 0 }}%</span>
      </div>

      <p class="text-[11px] text-slate-500 mb-3 leading-relaxed">
        点任意一条服务就能改价，不用一个个敲小方框。留空 = 跟随全站统一价；价格单位是「每 1000 个」。
      </p>

      <!-- ⚡ 批量：整类一键定价（97 期新增，省掉逐条改的麻烦） -->
      <div class="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 mb-3">
        <div class="flex items-center justify-between flex-wrap gap-1 mb-2">
          <span class="text-[11px] font-bold text-amber-300">整类一键定价</span>
          <span class="text-[10px] text-slate-500">按「进货价 + 毛利」一次算好，之后还能单条微调</span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[11px] text-slate-400">在进货价上加</span>
          <input v-model.number="batchMargin" type="number" step="5" min="0" max="300" inputmode="numeric"
                 class="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-right" />
          <span class="text-[11px] text-slate-400">%</span>
          <button @click="applyBatch" :disabled="!items.length"
                  class="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-900 text-[11px] font-bold disabled:opacity-40">
            应用到当前 {{ items.length }} 条
          </button>
          <button @click="clearDrafts" :disabled="!changed.length"
                  class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[11px] disabled:opacity-40">
            撤销未保存
          </button>
        </div>
      </div>

      <!-- ⚡ 110 期：整批改价（服务端扫全表，不受「只显示 200 条」限制） -->
      <details class="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 mb-3">
        <summary class="text-[11px] font-bold text-sky-300 cursor-pointer select-none">
          整批改价 —— 一个平台或一个分类，几千条也能一次改完
          <span class="text-slate-500 font-normal">（直接生效，比一条条点快得多）</span>
        </summary>
        <div class="mt-3 space-y-2">
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] text-slate-400 mb-1">改哪些</label>
              <select v-model="bulkScope" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-[12px]">
                <option value="platform">当前平台{{ activePlatform ? '（' + activePlatform + '）' : '' }}</option>
                <option value="category">当前分类{{ activeCategory ? '（' + shortCat(activeCategory) + '）' : '' }}</option>
                <option value="q">搜索关键词</option>
                <option value="all">全部服务</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] text-slate-400 mb-1">怎么改</label>
              <select v-model="bulkMode" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-[12px]">
                <option value="margin">进货价 + N%</option>
                <option value="rate">统一价（每 1000）</option>
                <option value="clear">恢复跟随全站统一价</option>
              </select>
            </div>
          </div>
          <div v-if="bulkMode === 'margin'" class="flex items-center gap-2">
            <span class="text-[11px] text-slate-400">在进货价上加</span>
            <input v-model.number="bulkMargin" type="number" step="5" min="0" max="300" inputmode="numeric"
                   class="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-right" />
            <span class="text-[11px] text-slate-400">%</span>
            <span class="text-[10px] text-slate-500">越高客户付得越多、你赚得越多</span>
          </div>
          <div v-else-if="bulkMode === 'rate'" class="flex items-center gap-2">
            <span class="text-[11px] text-slate-400">统一卖</span>
            <input v-model="bulkFixed" type="text" inputmode="decimal" placeholder="例如 45"
                   class="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-right" />
            <span class="text-[11px] text-slate-400">元 / 千</span>
          </div>
          <button @click="runBulk" :disabled="bulkBusy"
                  class="w-full py-2 rounded-lg bg-sky-500 text-slate-900 text-[12px] font-bold disabled:opacity-40">
            {{ bulkBusy ? '正在改…' : '执行整批改价' }}
          </button>
          <p class="text-[10px] text-slate-500 leading-relaxed">
            低于你的进货价的方案会被整批拦下（一条都不会改动），不会让你亏本卖。
          </p>
        </div>
      </details>

      <div class="flex gap-2 mb-2">
        <input v-model="query" @keyup.enter="load" placeholder="搜服务名 / 分类，例如 TikTok 粉丝"
               class="flex-grow bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        <button @click="load" class="px-3 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 whitespace-nowrap">搜索</button>
      </div>

      <!-- 🧭 一级：平台（跟主站客户看到的分组一致），先把近百个分类收窄到十几条 -->
      <div v-if="platforms.length" class="flex gap-1.5 overflow-x-auto pb-2 mb-1.5 custom-scrollbar">
        <button type="button" @click="pickPlatform('')"
                class="shrink-0 px-2.5 py-1 rounded-full text-[11px] border font-bold whitespace-nowrap"
                :class="!activePlatform ? 'border-amber-400 text-amber-300 bg-amber-400/10' : 'border-slate-700 text-slate-400 hover:text-slate-200'">
          全部平台
        </button>
        <button v-for="p in platforms" :key="p.name" type="button" @click="pickPlatform(p.name)"
                class="shrink-0 px-2.5 py-1 rounded-full text-[11px] border whitespace-nowrap"
                :class="activePlatform === p.name ? 'border-amber-400 text-amber-300 bg-amber-400/10' : 'border-slate-700 text-slate-400 hover:text-slate-200'">
          {{ p.name }}<span class="opacity-60"> {{ p.categories }}</span>
        </button>
      </div>

      <!-- 🗂 二级：分类（顺序 = 主站顺序），名字太长只显示短名，完整名悬停可见 -->
      <div v-if="categories.length" class="flex gap-1.5 overflow-x-auto pb-2 mb-2 custom-scrollbar">
        <button type="button" @click="pickCategory('')"
                class="shrink-0 px-2.5 py-1 rounded-full text-[11px] border whitespace-nowrap"
                :class="!activeCategory ? 'border-sky-400 text-sky-300 bg-sky-400/10' : 'border-slate-700 text-slate-400 hover:text-slate-200'">
          全部分类 <span class="opacity-60">{{ activePlatform ? visibleCats.length : categories.length }}</span>
        </button>
        <button v-for="c in visibleCats" :key="c.name" type="button" @click="pickCategory(c.name)"
                :title="c.name"
                class="shrink-0 px-2.5 py-1 rounded-full text-[11px] border whitespace-nowrap max-w-[13rem] truncate"
                :class="activeCategory === c.name ? 'border-sky-400 text-sky-300 bg-sky-400/10' : 'border-slate-700 text-slate-400 hover:text-slate-200'">
          {{ shortCat(c.name) }}<span class="opacity-60"> {{ c.count }}</span>
        </button>
      </div>

      <div v-if="loading" class="text-xs text-slate-500 py-6 text-center">读取中…</div>
      <div v-else-if="!items.length" class="text-xs text-slate-500 py-6 text-center">没搜到服务，换个关键词试试</div>

      <!-- ✅ 勾选后出现的批量条 -->
      <div v-if="picked.length" class="mb-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] font-bold text-amber-300">已勾选 {{ picked.length }} 条</span>
          <div class="flex gap-1.5">
            <button @click="pickAllVisible" class="px-2 py-1 rounded-md bg-slate-800 text-[10px] text-slate-300">全选这几百条</button>
            <button @click="clearPicked" class="px-2 py-1 rounded-md bg-slate-800 text-[10px] text-slate-300">取消</button>
          </div>
        </div>
        <div class="flex items-center gap-1.5 flex-wrap">
          <input v-model.number="pickMargin" type="number" step="5" min="0" inputmode="numeric"
                 class="w-14 bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-1 text-[12px] text-right" />
          <span class="text-[10px] text-slate-400">%</span>
          <button @click="fillPickedMargin" class="px-2 py-1 rounded-md bg-amber-500 text-slate-900 text-[10px] font-bold">按进货价加价</button>
          <span class="text-slate-600">|</span>
          <input v-model="pickFixed" type="text" inputmode="decimal" placeholder="¥"
                 class="w-16 bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-1 text-[12px] text-right" />
          <button @click="fillPickedFixed" class="px-2 py-1 rounded-md bg-slate-700 text-[10px] text-slate-100">统一成这个价</button>
          <button @click="fillPickedClear" class="px-2 py-1 rounded-md bg-slate-800 text-[10px] text-slate-300">恢复跟随全站价</button>
        </div>
        <p class="text-[10px] text-amber-400/80">填好之后，点最下面的「保存定价」才真正生效。</p>
      </div>

      <!-- ⚠️ 这里不能写 v-else：勾选后列表还得继续显示（第一版写成 v-else，勾一条整张列表就消失了）-->
      <div class="max-h-[26rem] overflow-y-auto custom-scrollbar pr-1 pb-14">
        <div v-for="g in grouped" :key="g.name" class="mb-2">
          <div v-if="!activeCategory" class="sticky top-0 z-10 bg-slate-900/95 backdrop-blur px-1 py-1.5 mb-1.5
                      text-[11px] font-bold text-sky-300/90 border-b border-slate-800 flex items-center justify-between">
            <span :title="g.name">{{ shortCat(g.name) }}</span>
            <span class="text-slate-500 font-normal">{{ g.items.length }} 条</span>
          </div>
          <button v-for="it in g.items" :key="it.service_id" type="button" @click="openSheet(it)"
                  class="w-full text-left rounded-xl border p-3 mb-2 transition active:scale-[0.995]"
                  :class="dirty(it) ? 'border-amber-500/60 bg-amber-500/5' : 'border-slate-800 bg-slate-950/60'">
            <div class="flex items-start gap-2.5">
              <!-- ✅ 勾选（点这里只勾选，不打开改价面板）-->
              <button type="button" @click.stop="togglePick(it)"
                      class="shrink-0 mt-0.5 w-6 h-6 rounded-md border flex items-center justify-center text-[12px] font-black"
                      :class="isPicked(it) ? 'bg-amber-500 border-amber-400 text-slate-900' : 'border-slate-600 text-transparent'">✓</button>
              <div class="min-w-0 flex-grow">
                <div class="text-xs text-slate-200 line-clamp-2">{{ it.name }}</div>
                <div class="text-[10px] text-slate-500 mt-1">
                  进货价 ¥{{ it.cost_per_1k.toFixed(2) }} / 千
                  <span v-if="it.override !== null && it.override !== undefined" class="text-amber-400">· 已单独定价</span>
                  <span v-else-if="dirty(it)" class="text-amber-400">· 待保存</span>
                </div>
                <div v-if="marginOf(it)" class="text-[11px] mt-1"
                     :class="marginOf(it).lose ? 'text-red-400' : 'text-emerald-400/85'">
                  客户付 ¥{{ marginOf(it).sell }} · 你赚 ¥{{ marginOf(it).profit }}（{{ marginOf(it).pct }}%）
                  <span v-if="marginOf(it).lose">· 太低，会被拒</span>
                </div>
              </div>
              <div class="shrink-0 text-right pt-0.5">
                <div class="text-sm font-bold text-slate-100">¥{{ priceText(it) }}</div>
                <div class="text-[10px] text-amber-400 mt-1.5 px-2 py-1 rounded-md bg-amber-500/10">改价 ›</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      <p v-if="meta.truncated" class="text-[10px] text-amber-400/80 mt-2">
        ⚠️ 服务太多，这里只列了前 {{ items.length }} 条 —— 用上面的平台/分类或搜索框定位更准
      </p>

      <div class="flex items-center justify-between gap-3 mt-3 flex-wrap">
        <span class="text-[11px]" :class="msgOk ? 'text-emerald-400' : 'text-red-400'">{{ msg }}</span>
        <button @click="savePrices" :disabled="saving || !changed.length"
                class="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 text-sm font-bold hover:bg-amber-400 disabled:opacity-40">
          {{ saving ? '保存中…' : `保存定价${changed.length ? `（${changed.length} 项）` : ''}` }}
        </button>
      </div>
    </section>

    <!-- ✏️ 改价面板：手机端从底部弹出，输入框又大又好按（97 期） -->
    <div v-if="sheet" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div class="absolute inset-0 bg-black/70" @click="closeSheet"></div>
      <div class="relative w-full sm:max-w-md bg-slate-900 border-t sm:border border-slate-700
                  rounded-t-2xl sm:rounded-2xl p-4 pb-6 max-h-[88vh] overflow-y-auto custom-scrollbar">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="min-w-0">
            <div class="text-xs text-slate-200 line-clamp-2">{{ sheet.name }}</div>
            <div class="text-[10px] text-slate-500 mt-1">
              进货价 ¥{{ sheet.cost_per_1k.toFixed(2) }} / 千 · {{ shortCat(sheet.category) }}
            </div>
          </div>
          <button @click="closeSheet" class="text-slate-500 text-lg leading-none px-2 py-1 shrink-0">✕</button>
        </div>

        <label class="block text-[11px] text-slate-400 mb-1">你的售价（每 1000 个）</label>
        <input v-model="sheetPrice" type="text" inputmode="decimal" autocomplete="off"
               class="w-full bg-slate-950 border-2 border-amber-500/50 focus:border-amber-400 rounded-xl
                      px-3 py-3 text-2xl font-bold text-right outline-none"
               :placeholder="sheet.list_price.toFixed(2)" />
        <p class="text-[10px] text-slate-500 mt-1">留空 = 跟随全场（¥{{ sheet.list_price.toFixed(2) }}）</p>

        <div class="flex flex-wrap gap-2 mt-3">
          <button v-for="p in quickPresets(sheet)" :key="p.t" @click="sheetPrice = p.v"
                  class="px-3 py-2 rounded-lg bg-slate-800 text-[11px] text-slate-200 border border-slate-700">
            {{ p.t }}
          </button>
        </div>

        <div class="mt-3 rounded-xl bg-slate-950/70 border border-slate-800 p-3 text-[11px]"
             :class="sheetMargin && sheetMargin.lose ? 'text-red-400' : 'text-emerald-400/85'">
          <template v-if="sheetMargin">
            客户实付 ¥{{ sheetMargin.sell }} / 千 · 你赚 ¥{{ sheetMargin.profit }} / 千（毛利 {{ sheetMargin.pct }}%）
            <span v-if="sheetMargin.lose" class="block text-red-400 mt-1">低于进货价，保存会被拒</span>
          </template>
          <template v-else><span class="text-slate-500">填个价格，这里实时显示你能赚多少</span></template>
        </div>

        <div class="flex gap-2 mt-4">
          <button @click="sheetPrice = ''" class="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm">跟随全场</button>
          <button @click="applySheet" class="flex-[2] py-3 rounded-xl bg-amber-500 text-slate-900 text-sm font-bold">确定</button>
        </div>
        <p class="text-[10px] text-slate-600 mt-2 text-center">改完点列表下方的「保存定价」，一次提交所有改动</p>
      </div>
    </div>
  </div>
</template>
