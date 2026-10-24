<script setup>
// 分站「热门服务」区块 —— 三套结构不同的版式
//   cards  ：卡片网格（和主站类似，用于"就想稳一点"的站长）
//   table  ：价格表（一行一个服务，像商品目录）
//   ranked ：编号榜单（大字号 + 粗分隔线，杂志感）
import { computed } from 'vue';

const props = defineProps({
  variant: { type: String, default: 'cards' },
  services: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  lang: { type: String, default: 'zh' },
});

const zh = computed(() => props.lang === 'zh');
const label = (s) => (zh.value ? s._label : s._labelEn) || s._label || s.name;
const price = (s) => (s && s.sell_price != null ? Number(s.sell_price).toFixed(2) : '—');
const rows = computed(() => (props.services || []).slice(0, 8));
</script>

<template>
  <div>
    <!-- ── cards ── -->
    <div v-if="variant === 'cards'">
      <div v-if="loading" class="flex justify-center py-8">
        <div class="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" :style="{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }"></div>
      </div>
      <div v-else class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div v-for="s in rows" :key="s.service" class="site-card p-4 text-center">
          <div class="mb-1 text-[11px] font-black" :style="{ color: 'var(--brand)' }">{{ label(s) }}</div>
          <div class="mb-3 line-clamp-2 text-[11px] leading-snug opacity-45">{{ (s.name || '').substring(0, 30) }}</div>
          <div class="text-lg font-black" :style="{ color: 'var(--brand)' }">¥{{ price(s) }}<span class="text-[10px] font-normal opacity-40"> /千</span></div>
        </div>
      </div>
    </div>

    <!-- ── table ── -->
    <div v-else-if="variant === 'table'" class="site-card overflow-hidden p-0">
      <div class="hidden grid-cols-[1fr_90px_90px_110px] gap-3 border-b px-5 py-3 text-[10px] font-black uppercase tracking-widest opacity-45 md:grid"
        style="border-color: color-mix(in srgb, currentColor 14%, transparent)">
        <span>{{ zh ? '服务' : 'Service' }}</span>
        <span class="text-right">{{ zh ? '交付' : 'Speed' }}</span>
        <span class="text-right">{{ zh ? '单价/千' : 'Price' }}</span>
        <span class="text-right">{{ zh ? '操作' : 'Action' }}</span>
      </div>
      <div v-for="(s, i) in rows" :key="s.service"
        class="grid grid-cols-[1fr_auto] items-center gap-3 border-b px-5 py-3.5 last:border-b-0 md:grid-cols-[1fr_90px_90px_110px]"
        style="border-color: color-mix(in srgb, currentColor 8%, transparent)">
        <div class="min-w-0">
          <div class="truncate text-[13px] font-bold">{{ label(s) }}</div>
          <div class="truncate text-[10px] opacity-40">{{ (s.name || '').substring(0, 34) }}</div>
        </div>
        <span class="hidden text-right text-[11px] opacity-55 md:block">{{ zh ? '自动' : 'Auto' }}</span>
        <span class="text-right text-sm font-black" :style="{ color: 'var(--brand)' }">¥{{ price(s) }}</span>
        <router-link to="/login" class="hidden text-right text-[11px] font-bold underline underline-offset-4 opacity-60 md:block">{{ zh ? '下单' : 'Order' }}</router-link>
      </div>
    </div>

    <!-- ── ranked ── -->
    <div v-else class="mx-auto max-w-2xl">
      <div v-for="(s, i) in rows" :key="s.service"
        class="flex items-baseline gap-4 border-b py-4 last:border-b-0"
        style="border-color: color-mix(in srgb, currentColor 14%, transparent)">
        <span class="w-8 shrink-0 text-lg font-black tabular-nums opacity-25">{{ String(i + 1).padStart(2, '0') }}</span>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-bold">{{ label(s) }}</div>
          <div class="truncate text-[11px] opacity-40">{{ (s.name || '').substring(0, 32) }}</div>
        </div>
        <span class="shrink-0 text-base font-black" :style="{ color: 'var(--brand)' }">¥{{ price(s) }}</span>
      </div>
    </div>
  </div>
</template>
