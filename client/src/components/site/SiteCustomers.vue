<script setup>
// 👥 客户价（93 期）：祥哥要的"不同客户不同价，可自定义可百分比"
//    · 分组价：建几个组（VIP / 老客户…），每组一个折扣（0.95 = 95 折）
//    · 单独定价：某个客户单独给一个折扣，优先级高于分组
//    · 红线：折扣叠完仍不低于站长成本价（下单链路统一抬平，这里只做提示）
//    后端：GET/POST/PUT/DELETE /api/sites/:id/customer-groups、GET/PUT /api/sites/:id/customers
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '../../stores/user';

const props = defineProps({ siteId: { type: [Number, String], required: true } });
const emit = defineEmits(['saved']);
const userStore = useUserStore();
const auth = () => ({ Authorization: `Bearer ${userStore.token}`, 'Content-Type': 'application/json' });

const loading = ref(true);
const saving = ref(false);
const msg = ref('');
const msgOk = ref(true);

const groups = ref([]);
const ungrouped = ref(0);
const customers = ref([]);
const query = ref('');
const groupFilter = ref('');       // '' | 'none' | group id

// 新建分组表单
const newName = ref('');
const newMult = ref(9.5);   // 单位是「折」：9.5 折 = 95%
const newNote = ref('');

const flash = (t, ok = true) => { msg.value = t; msgOk.value = ok; setTimeout(() => { if (msg.value === t) msg.value = ''; }, 4000); };

/** 0.9 → 「9 折」；0.95 → 「9.5 折」；1 → 原价（中文口径：9 折 = 打 9 折 = 90%） */
const asDiscount = (m) => {
  const v = Number(m);
  if (!isFinite(v) || v >= 1) return '原价';
  const zhe = Math.round(v * 100) / 10;      // 0.9 → 9，0.95 → 9.5
  return `${zhe % 1 === 0 ? zhe.toFixed(0) : zhe.toFixed(1)} 折`;
};
/** 「9 折」 → 0.9；「10 折」 → 1 */
const fromDiscount = (n) => {
  const v = Number(n);
  if (!isFinite(v) || v <= 0) return 1;
  if (v >= 10) return 1;
  return Math.round(v * 100) / 1000;         // 9 → 0.9，9.5 → 0.95
};

async function loadGroups() {
  const r = await fetch(`/api/sites/${props.siteId}/customer-groups`, { headers: auth() });
  const d = await r.json();
  if (d.status !== 'success') { flash(d.message || '读取分组失败', false); return; }
  groups.value = d.data.groups || [];
  ungrouped.value = d.data.ungrouped || 0;
}

async function loadCustomers() {
  const qs = [];
  if (query.value) qs.push(`q=${encodeURIComponent(query.value)}`);
  if (groupFilter.value) qs.push(`group=${encodeURIComponent(groupFilter.value)}`);
  const r = await fetch(`/api/sites/${props.siteId}/customers${qs.length ? '?' + qs.join('&') : ''}`, { headers: auth() });
  const d = await r.json();
  if (d.status !== 'success') { flash(d.message || '读取客户失败', false); return; }
  customers.value = d.data.items || [];
}

async function load() {
  loading.value = true;
  try { await loadGroups(); await loadCustomers(); }
  catch (e) { flash('读取失败：' + e.message, false); }
  finally { loading.value = false; }
}

async function createGroup() {
  if (saving.value) return;
  const name = newName.value.trim();
  if (!name) { flash('先给分组起个名字', false); return; }
  saving.value = true;
  try {
    const r = await fetch(`/api/sites/${props.siteId}/customer-groups`, {
      method: 'POST', headers: auth(),
      body: JSON.stringify({ name, multiplier: fromDiscount(newMult.value), note: newNote.value }),
    });
    const d = await r.json();
    if (d.status !== 'success') { flash(d.message || '创建失败', false); return; }
    newName.value = ''; newNote.value = ''; newMult.value = 9.5;
    await load(); emit('saved');
    flash(`已创建分组「${name}」`);
  } finally { saving.value = false; }
}

async function updateGroup(g, patch) {
  const r = await fetch(`/api/sites/${props.siteId}/customer-groups/${g.id}`, {
    method: 'PUT', headers: auth(), body: JSON.stringify(patch),
  });
  const d = await r.json();
  if (d.status !== 'success') { flash(d.message || '保存失败', false); await load(); return; }
  await load(); emit('saved');
  flash('分组已更新');
}

async function removeGroup(g) {
  if (!confirm(`删除分组「${g.name}」？组内 ${g.members} 个客户会恢复原价。`)) return;
  const r = await fetch(`/api/sites/${props.siteId}/customer-groups/${g.id}`, { method: 'DELETE', headers: auth() });
  const d = await r.json();
  if (d.status !== 'success') { flash(d.message || '删除失败', false); return; }
  await load(); emit('saved');
  flash('分组已删除');
}

async function saveCustomer(c, patch) {
  const r = await fetch(`/api/sites/${props.siteId}/customers/${c.id}`, {
    method: 'PUT', headers: auth(), body: JSON.stringify(patch),
  });
  const d = await r.json();
  if (d.status !== 'success') { flash(d.message || '保存失败', false); await load(); return; }
  await load(); emit('saved');
  flash(`已更新 ${c.phone || c.email || '客户'}`);
}

const groupedCount = computed(() => groups.value.reduce((n, g) => n + (g.members || 0), 0));

// ✏️ 客户面板（97 期）：点一个客户 → 底部弹出，大按钮选折扣
const sheetC = ref(null);          // 正在编辑的客户
const sheetGid = ref('');          // 选中的分组 id（'' = 未分组）
const sheetCust = ref('');         // 单独折扣（'折' 单位字符串，'' = 不单独定价）

// 常用折扣档：一按即填，不用自己换算
const DISCOUNT_TIERS = [
  { zhe: 10, label: '原价' },
  { zhe: 9.5, label: '9.5 折' },
  { zhe: 9, label: '9 折' },
  { zhe: 8.5, label: '8.5 折' },
  { zhe: 8, label: '8 折' },
  { zhe: 7, label: '7 折' },
];

function openCustomer(c) {
  sheetC.value = c;
  sheetGid.value = c.group_id ? String(c.group_id) : '';
  sheetCust.value = (c.custom_multiplier && Number(c.custom_multiplier) < 1)
    ? String(Math.round(Number(c.custom_multiplier) * 100) / 10)
    : '';
}
function closeCustomer() { sheetC.value = null; sheetGid.value = ''; sheetCust.value = ''; }

// 面板里的实时预览：单独定价 > 分组 > 原价
const sheetPreview = computed(() => {
  const own = Number(sheetCust.value);
  if (isFinite(own) && own > 0 && own < 10) return { text: asDiscount(fromDiscount(own)), from: '单独定价' };
  if (sheetGid.value) {
    const g = groups.value.find((x) => String(x.id) === String(sheetGid.value));
    if (g) return { text: asDiscount(g.multiplier), from: '分组「' + g.name + '」' };
  }
  return { text: '原价', from: '不打折' };
});

async function saveCustomerSheet() {
  if (!sheetC.value || saving.value) return;
  const c = sheetC.value;
  const payload = { group_id: sheetGid.value === '' ? null : Number(sheetGid.value) };
  const own = String(sheetCust.value || '').trim();
  payload.custom_multiplier = own === '' ? null : fromDiscount(own);
  saving.value = true;
  try {
    const r = await fetch(`/api/sites/${props.siteId}/customers/${c.id}`, {
      method: 'PUT', headers: auth(), body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (d.status !== 'success') { flash(d.message || '保存失败', false); return; }
    closeCustomer();
    await load(); emit('saved');
    flash(`已更新 ${c.phone || c.email || '客户'}`);
  } catch (e) {
    flash('保存失败：' + e.message, false);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <!-- ① 客户分组 -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h2 class="font-bold text-sm text-amber-400">客户分组价</h2>
        <span class="text-[10px] text-slate-500">
          共 {{ customers.length }} 位客户 · 已分组 {{ groupedCount }} 位 · 未分组 {{ ungrouped }} 位
        </span>
      </div>
      <p class="text-[11px] text-slate-500 leading-relaxed mb-3">
        给自己的客户分几个组，每组一个折扣。客户登录后看到和支付的价就按他的组算。<br />
        <span class="text-slate-600">例：VIP 组 9 折 —— 全场标价 ¥100 的服务，这个组的客户看到 ¥90。</span>
      </p>

      <div v-if="loading" class="text-xs text-slate-500 py-4 text-center">读取中…</div>
      <div v-else-if="!groups.length" class="text-[11px] text-slate-500 mb-3">
        还没有分组。下面建一个，比如「老客户 9 折」。
      </div>

      <div v-else class="space-y-2 mb-3">
        <div v-for="g in groups" :key="g.id" class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="min-w-0">
              <div class="text-sm font-bold text-slate-100 truncate">{{ g.name }}</div>
              <div class="text-[10px] text-slate-500">
                {{ asDiscount(g.multiplier) }} · {{ g.members }} 位客户<span v-if="g.note"> · {{ g.note }}</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button @click="removeGroup(g)" class="px-2 py-2 text-[10px] text-slate-500 hover:text-red-400">删除</button>
            </div>
          </div>
          <!-- 🎚 一排折扣档，点一下就生效（原来是 16px 宽的小输入框，手机上很难点准） -->
          <div class="flex flex-wrap gap-1.5 mt-2">
            <button v-for="t in DISCOUNT_TIERS" :key="'gt' + g.id + t.zhe" type="button"
                    @click="updateGroup(g, { multiplier: fromDiscount(t.zhe) })"
                    class="px-2.5 py-1.5 rounded-lg text-[11px] border"
                    :class="Math.round(g.multiplier * 100) / 10 === t.zhe
                      ? 'bg-amber-500 text-slate-900 border-amber-400 font-bold'
                      : 'bg-slate-900 text-slate-300 border-slate-700'">
              {{ t.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 新建分组 -->
      <div class="rounded-xl border border-dashed border-slate-700 p-3 space-y-2">
        <div class="text-[11px] font-bold text-slate-300">＋ 新建分组</div>
        <div class="flex gap-2 flex-wrap">
          <input v-model="newName" placeholder="组名，例如 VIP / 老客户"
                 class="flex-grow min-w-[8rem] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          <div class="flex items-center gap-1.5 shrink-0">
            <input v-model.number="newMult" type="number" min="3" max="10" step="0.5" inputmode="decimal"
                   class="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-sm text-right" />
            <span class="text-[11px] text-slate-500">折</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="t in DISCOUNT_TIERS" :key="'nt' + t.zhe" type="button" @click="newMult = t.zhe"
                  class="px-2.5 py-1.5 rounded-lg text-[11px] border"
                  :class="Number(newMult) === t.zhe
                    ? 'bg-amber-500 text-slate-900 border-amber-400 font-bold'
                    : 'bg-slate-900 text-slate-300 border-slate-700'">
            {{ t.label }}
          </button>
        </div>
        <div class="flex gap-2 items-center">
          <input v-model="newNote" placeholder="备注（可留空）"
                 class="flex-grow bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs" />
          <button @click="createGroup" :disabled="saving"
                  class="px-3 py-2 rounded-lg bg-amber-500 text-slate-900 text-xs font-bold hover:bg-amber-400 disabled:opacity-40 whitespace-nowrap">
            建组
          </button>
        </div>
        <p class="text-[10px] text-slate-600">折扣范围 3~10 折（10 折 = 不打折，9 折 = 打 9 折）。打得太狠会低于你的成本，系统会自动抬到成本价。</p>
      </div>
    </section>

    <!-- ② 客户列表 -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
      <h2 class="font-bold text-sm text-amber-400 mb-2">我的客户</h2>
      <div class="flex gap-2 mb-2">
        <input v-model="query" @keyup.enter="loadCustomers" placeholder="搜手机号 / 邮箱"
               class="flex-grow bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        <button @click="loadCustomers" class="px-3 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 whitespace-nowrap">搜索</button>
      </div>

      <div class="flex gap-1.5 overflow-x-auto pb-2 mb-2 custom-scrollbar">
        <button @click="groupFilter = ''; loadCustomers()"
                class="shrink-0 px-2.5 py-1 rounded-full text-[11px] border whitespace-nowrap"
                :class="!groupFilter ? 'border-amber-400 text-amber-300 bg-amber-400/10' : 'border-slate-700 text-slate-400'">
          全部
        </button>
        <button @click="groupFilter = 'none'; loadCustomers()"
                class="shrink-0 px-2.5 py-1 rounded-full text-[11px] border whitespace-nowrap"
                :class="groupFilter === 'none' ? 'border-amber-400 text-amber-300 bg-amber-400/10' : 'border-slate-700 text-slate-400'">
          未分组 {{ ungrouped }}
        </button>
        <button v-for="g in groups" :key="'f' + g.id" @click="groupFilter = String(g.id); loadCustomers()"
                class="shrink-0 px-2.5 py-1 rounded-full text-[11px] border whitespace-nowrap"
                :class="groupFilter === String(g.id) ? 'border-amber-400 text-amber-300 bg-amber-400/10' : 'border-slate-700 text-slate-400'">
          {{ g.name }} {{ g.members }}
        </button>
      </div>

      <div v-if="!customers.length" class="text-xs text-slate-500 py-6 text-center">
        还没有客户 —— 客户在你的站点注册后会自动出现在这里
      </div>

      <div v-else class="space-y-2 max-h-[28rem] overflow-y-auto custom-scrollbar pr-1">
        <button v-for="c in customers" :key="c.id" type="button" @click="openCustomer(c)"
                class="w-full text-left rounded-xl border border-slate-800 bg-slate-950/60 p-3 active:scale-[0.995]">
          <div class="flex items-start justify-between gap-2 flex-wrap">
            <div class="min-w-0">
              <div class="text-xs text-slate-200 truncate">
                {{ c.phone || '（无手机号）' }}
                <span v-if="c.banned" class="text-[10px] text-red-400">已封禁</span>
              </div>
              <div class="text-[10px] text-slate-500 mt-0.5">
                余额 ¥{{ c.balance.toFixed(2) }} · 消费 ¥{{ c.spent.toFixed(2) }} · {{ c.orders }} 单
              </div>
              <div class="text-[10px] text-slate-500 mt-1">
                {{ c.custom_multiplier && c.custom_multiplier < 1 ? '单独定价' : (c.group_id ? '按分组' : '未分组') }}
              </div>
            </div>
            <div class="shrink-0 text-right">
              <div class="text-[11px] px-2 py-1 rounded-md"
                   :class="c.effective < 1 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'">
                {{ asDiscount(c.effective) }}
              </div>
              <div class="text-[10px] text-amber-400 mt-1.5">改折扣 ›</div>
            </div>
          </div>
        </button>
      </div>
    </section>

    <p class="text-[10px] text-center" :class="msgOk ? 'text-emerald-400' : 'text-red-400'">{{ msg }}</p>

    <!-- ✏️ 客户折扣面板（97 期）：大按钮点选，不用自己换算折扣 -->
    <div v-if="sheetC" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div class="absolute inset-0 bg-black/70" @click="closeCustomer"></div>
      <div class="relative w-full sm:max-w-md bg-slate-900 border-t sm:border border-slate-700
                  rounded-t-2xl sm:rounded-2xl p-4 pb-6 max-h-[88vh] overflow-y-auto custom-scrollbar">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="min-w-0">
            <div class="text-sm font-bold text-slate-100 truncate">{{ sheetC.phone || sheetC.email || '客户' }}</div>
            <div class="text-[10px] text-slate-500 mt-1">
              余额 ¥{{ sheetC.balance.toFixed(2) }} · 消费 ¥{{ sheetC.spent.toFixed(2) }} · {{ sheetC.orders }} 单
            </div>
          </div>
          <button @click="closeCustomer" class="text-slate-500 text-lg leading-none px-2 py-1 shrink-0">✕</button>
        </div>

        <!-- 分组 -->
        <div class="mb-3">
          <div class="text-[11px] text-slate-400 mb-1.5">按分组的折扣</div>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" @click="sheetGid = ''"
                    class="px-3 py-2 rounded-lg text-[11px] border"
                    :class="sheetGid === '' ? 'bg-amber-500 text-slate-900 border-amber-400 font-bold' : 'bg-slate-950 text-slate-300 border-slate-700'">
              未分组（原价）
            </button>
            <button v-for="g in groups" :key="'sg' + g.id" type="button" @click="sheetGid = String(g.id)"
                    class="px-3 py-2 rounded-lg text-[11px] border"
                    :class="sheetGid === String(g.id) ? 'bg-amber-500 text-slate-900 border-amber-400 font-bold' : 'bg-slate-950 text-slate-300 border-slate-700'">
              {{ g.name }}
            </button>
          </div>
        </div>

        <!-- 单独定价 -->
        <div class="mb-3">
          <div class="text-[11px] text-slate-400 mb-1.5">单独给这个客户定价（覆盖分组）</div>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" @click="sheetCust = ''"
                    class="px-3 py-2 rounded-lg text-[11px] border"
                    :class="sheetCust === '' ? 'bg-emerald-500 text-slate-900 border-emerald-400 font-bold' : 'bg-slate-950 text-slate-300 border-slate-700'">
              不单独定价
            </button>
            <button v-for="t in DISCOUNT_TIERS" :key="'sc' + t.zhe" type="button" @click="sheetCust = String(t.zhe)"
                    class="px-3 py-2 rounded-lg text-[11px] border"
                    :class="String(sheetCust) === String(t.zhe) ? 'bg-emerald-500 text-slate-900 border-emerald-400 font-bold' : 'bg-slate-950 text-slate-300 border-slate-700'">
              {{ t.label }}
            </button>
          </div>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-[11px] text-slate-500">自定义</span>
            <input v-model="sheetCust" type="text" inputmode="decimal" placeholder="例：8.8"
                   class="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-lg font-bold text-right" />
            <span class="text-[11px] text-slate-500">折</span>
          </div>
        </div>

        <div class="rounded-xl bg-slate-950/70 border border-slate-800 p-3 text-[11px] text-emerald-400/85">
          这位客户看到的价：<b>{{ sheetPreview.text }}</b>
          <span class="text-slate-500">（{{ sheetPreview.from }}）</span>
        </div>

        <div class="flex gap-2 mt-4">
          <button @click="closeCustomer" class="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm">取消</button>
          <button @click="saveCustomerSheet" :disabled="saving"
                  class="flex-[2] py-3 rounded-xl bg-amber-500 text-slate-900 text-sm font-bold disabled:opacity-50">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
