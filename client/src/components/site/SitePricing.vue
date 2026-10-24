<script setup>
// 💰 站长自己的价格体系：单服务定价 + 活动折扣
//    后端：GET/PUT /api/sites/:id/prices、PUT /api/sites/:id（折扣三字段）
//    红线：任何价格乘上折扣都不得低于站长进货价，后端会拦（这里只负责把话说清楚）。
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
const draft = ref({});            // service_id -> 输入框里的价格（字符串）
const meta = ref({ multiplier: 0, cost_multiplier: 0, discount_rate: 1, discount_label: '', discount_until: 0 });

// 折扣草稿
const dRate = ref(1);
const dLabel = ref('');
const dDays = ref(0);             // 0 = 长期，7/30 = 到期自动恢复

const auth = () => ({ Authorization: `Bearer ${userStore.token}` });

async function load() {
  loading.value = true;
  try {
    const q = query.value ? `?q=${encodeURIComponent(query.value)}` : '';
    const r = await fetch(`/api/sites/${props.siteId}/prices${q}`, { headers: auth() });
    const d = await r.json();
    if (d.status !== 'success') { flash(d.message || '读取失败', false); return; }
    const data = d.data;
    items.value = data.items || [];
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

function resetRow(it) {
  draft.value[it.service_id] = '';
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
        打折只影响你的客户看到的价格，你的进货成本不变。系统有底线：打完折也不许低于你的进货价，填太狠会直接拦下。
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
        <span class="text-[10px] text-slate-500">
          进货倍率 {{ meta.cost_multiplier }} · 当前全场 {{ meta.multiplier }} 倍
        </span>
      </div>

      <p class="text-[11px] text-slate-500 mb-3 leading-relaxed">
        想把某个爆款压低价引流、或把冷门服务标高，就在这里单独填。留空 = 跟随全场倍率。
        价格单位是「每 1000 个」。
      </p>

      <div class="flex gap-2 mb-3">
        <input v-model="query" @keyup.enter="load" placeholder="搜服务名 / 分类，例如 TikTok 粉丝"
               class="flex-grow bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        <button @click="load" class="px-3 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 whitespace-nowrap">搜索</button>
      </div>

      <div v-if="loading" class="text-xs text-slate-500 py-6 text-center">读取中…</div>
      <div v-else-if="!items.length" class="text-xs text-slate-500 py-6 text-center">没搜到服务，换个关键词试试</div>

      <div v-else class="space-y-2 max-h-[26rem] overflow-y-auto custom-scrollbar pr-1 pb-14">
        <div v-for="it in items" :key="it.service_id"
             class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div class="min-w-0 flex-grow">
              <div class="text-xs text-slate-200 line-clamp-2">{{ it.name }}</div>
              <div class="text-[10px] text-slate-500 mt-0.5">
                成本 ¥{{ it.cost_per_1k.toFixed(4) }} / 千 ·
                默认售价 ¥{{ (it.list_price * (1)).toFixed(4) }} / 千
                <span v-if="it.override !== null && it.override !== undefined" class="text-amber-400">· 已单独定价</span>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <input v-model="draft[it.service_id]" type="number" step="0.0001" min="0" inputmode="decimal"
                     :placeholder="(it.list_price * 1).toFixed(4)"
                     class="w-28 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-right" />
              <button v-if="it.override !== null && it.override !== undefined" @click="resetRow(it)"
                      class="px-2 py-2 text-[10px] text-slate-500 hover:text-amber-400 whitespace-nowrap">恢复默认</button>
            </div>
          </div>
          <div v-if="marginOf(it)" class="mt-1 pr-12 sm:pr-0 text-[10px] leading-relaxed"
               :class="marginOf(it).lose ? 'text-red-400' : 'text-emerald-400/80'">
            <span class="block sm:inline">客户实付 ¥{{ marginOf(it).sell }} / 千</span>
            <span class="block sm:inline sm:ml-1">· 你赚 ¥{{ marginOf(it).profit }} / 千（毛利 {{ marginOf(it).pct }}%）</span>
            <span v-if="marginOf(it).lose" class="block mt-0.5">· 低于进货价，保存会被拒</span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 mt-3 flex-wrap">
        <span class="text-[11px]" :class="msgOk ? 'text-emerald-400' : 'text-red-400'">{{ msg }}</span>
        <button @click="savePrices" :disabled="saving || !changed.length"
                class="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 text-sm font-bold hover:bg-amber-400 disabled:opacity-40">
          {{ saving ? '保存中…' : `保存定价${changed.length ? `（${changed.length} 项）` : ''}` }}
        </button>
      </div>
    </section>
  </div>
</template>
