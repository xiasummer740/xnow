<script setup>
// 分站首屏（Hero）—— 四套**结构完全不同**的版式。
//
// 为什么要单独做组件：
//   原来 6 套"模板"只是换 CSS 变量（颜色/圆角/字号），DOM 结构一模一样，
//   所以祥哥一眼就能看出"还是你这个站"。真正让人认不出来的是**版式结构**：
//   标题在左还是居中、有没有价格卡、有没有终端窗口、是杂志排版还是电商货架。
//
// 主站永远用 Home.vue 里原来那段 hero，本组件只在分站渲染。
import { computed } from 'vue';

const props = defineProps({
  variant: { type: String, default: 'center' }, // center | split | editorial | terminal
  hero: { type: Object, required: true },
  platforms: { type: Array, default: () => [] },
  services: { type: Array, default: () => [] },
  lang: { type: String, default: 'zh' },
  siteName: { type: String, default: '' },
});

const zh = computed(() => props.lang === 'zh');
const top3 = computed(() => (props.services || []).slice(0, 3));
const price = (s) => (s && s.sell_price != null ? Number(s.sell_price).toFixed(2) : '—');
</script>

<template>
  <!-- ═══════════ 版式一：居中大标题（电商落地页感）═══════════ -->
  <main v-if="variant === 'center'"
    class="relative z-20 mx-auto max-w-4xl px-5 pt-20 pb-14 text-center md:pt-28">
    <div class="inline-block mb-6 rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em]"
      :style="{ background: 'var(--brand-soft)', color: 'var(--brand)', border: '1px solid color-mix(in srgb, var(--brand) 35%, transparent)' }">
      {{ hero.badge }}
    </div>
    <h1 class="mb-5 text-4xl font-black leading-[1.1] tracking-tight md:text-6xl">
      <span class="site-brand-text">{{ hero.title || (zh ? '全平台社媒增长' : 'Social Growth') }}</span>
    </h1>
    <p class="mx-auto mb-3 max-w-2xl text-base leading-relaxed opacity-80 md:text-lg">{{ hero.subtitle }}</p>
    <p class="mx-auto mb-9 max-w-xl text-sm leading-relaxed opacity-50">{{ hero.desc }}</p>

    <div class="mb-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
      <router-link :to="hero.btn1Url || '/login'" class="site-btn px-9 py-4 text-base font-black">{{ hero.btn1Text }}</router-link>
      <router-link v-if="hero.btn2Text" :to="hero.btn2Url || '/vpn'" class="site-btn px-7 py-4 text-sm font-bold opacity-80">{{ hero.btn2Text }}</router-link>
    </div>

    <div class="mx-auto grid max-w-2xl grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
      <div v-for="p in platforms" :key="p.name"
        class="site-card flex flex-col items-center gap-1 px-2 py-3">
        <span class="text-xl">{{ p.icon }}</span>
        <span class="text-[10px] font-bold opacity-60">{{ p.name[lang] || p.name }}</span>
      </div>
    </div>
  </main>

  <!-- ═══════════ 版式二：左文右价卡（SaaS 产品页感）═══════════ -->
  <main v-else-if="variant === 'split'"
    class="relative z-20 mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 pt-16 pb-14 md:pt-24 lg:grid-cols-[1.15fr_0.85fr]">
    <div class="text-left">
      <div class="mb-5 flex items-center gap-3">
        <span class="h-px w-10" :style="{ background: 'var(--brand)' }"></span>
        <span class="text-[11px] font-black uppercase tracking-[0.22em]" :style="{ color: 'var(--brand)' }">{{ siteName || hero.badge }}</span>
      </div>
      <h1 class="mb-5 text-3xl font-black leading-[1.14] tracking-tight md:text-5xl">
        <span class="site-brand-text">{{ hero.title || (zh ? '把流量变成你的资产' : 'Turn Traffic Into Asset') }}</span>
      </h1>
      <p class="mb-3 max-w-xl text-[15px] leading-relaxed opacity-80">{{ hero.subtitle }}</p>
      <p class="mb-8 max-w-lg text-sm leading-relaxed opacity-50">{{ hero.desc }}</p>
      <div class="mb-9 flex flex-wrap items-center gap-3">
        <router-link :to="hero.btn1Url || '/login'" class="site-btn px-8 py-3.5 text-sm font-black">{{ hero.btn1Text }}</router-link>
        <router-link v-if="hero.btn2Text" :to="hero.btn2Url || '/vpn'" class="site-btn px-6 py-3.5 text-xs font-bold opacity-80">{{ hero.btn2Text }}</router-link>
      </div>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-wider opacity-45">
        <span>● 24/7 自动交付</span><span>● 无需账号密码</span><span>● 掉粉可补</span>
      </div>
    </div>

    <!-- 右侧：真实价格的"报价卡"，这是和主站观感差别最大的一块 -->
    <div class="site-card p-5">
      <div class="mb-4 flex items-center justify-between">
        <span class="text-xs font-black uppercase tracking-widest opacity-60">{{ zh ? '实时报价' : 'Live Prices' }}</span>
        <span class="flex items-center gap-1.5 text-[10px] font-bold" :style="{ color: 'var(--brand)' }">
          <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full" :style="{ background: 'var(--brand)' }"></span>
          {{ zh ? '在线' : 'LIVE' }}
        </span>
      </div>
      <div v-if="!top3.length" class="py-6 text-center text-xs opacity-40">{{ zh ? '登录后查看全部服务' : 'Login to see all' }}</div>
      <div v-for="(s, i) in top3" :key="i" class="flex items-center justify-between border-t py-3 first:border-t-0"
        style="border-color: color-mix(in srgb, currentColor 12%, transparent)">
        <div class="min-w-0">
          <div class="truncate text-[13px] font-bold">{{ s._label || s.name }}</div>
          <div class="mt-0.5 truncate text-[10px] opacity-45">{{ (s.name || '').substring(0, 26) }}</div>
        </div>
        <div class="ml-3 shrink-0 text-right">
          <div class="text-base font-black" :style="{ color: 'var(--brand)' }">¥{{ price(s) }}</div>
          <div class="text-[9px] opacity-40">/ 千</div>
        </div>
      </div>
      <router-link to="/login" class="site-btn mt-4 block w-full py-3 text-center text-sm font-black">{{ zh ? '登录下单' : 'Order Now' }}</router-link>
      <div class="mt-3 text-center text-[10px] opacity-35">{{ zh ? '价格为实时数据，登录后可见全部服务' : 'Live data · Login for full catalog' }}</div>
    </div>
  </main>

  <!-- ═══════════ 版式三：杂志排版（左对齐 + 细线 + 首字下沉）═══════════ -->
  <main v-else-if="variant === 'editorial'" class="relative z-20 mx-auto max-w-3xl px-6 pt-16 pb-12 md:pt-24">
    <div class="mb-6 flex items-baseline justify-between border-b pb-3" style="border-color: color-mix(in srgb, currentColor 16%, transparent)">
      <span class="text-[10px] font-black uppercase tracking-[0.3em] opacity-50">{{ siteName || 'SMM' }}</span>
      <span class="text-[10px] uppercase tracking-[0.2em] opacity-35">{{ zh ? '社媒增长服务' : 'Social Growth' }}</span>
    </div>

    <h1 class="mb-6 text-left text-[2rem] font-black leading-[1.15] tracking-tight md:text-[3.1rem]">
      <span class="site-brand-text">{{ hero.title || (zh ? '让每一次曝光，都算数' : 'Every Impression Counts') }}</span>
    </h1>

    <p class="mb-2 text-left text-[10px] font-black uppercase tracking-[0.25em]" :style="{ color: 'var(--brand)' }">
      {{ zh ? '编者按' : 'Editor’s Note' }}
    </p>
    <p class="mb-6 text-left text-[15px] leading-[1.9] opacity-80">
      <span class="float-left mr-2 mt-1 text-4xl font-black leading-none" :style="{ color: 'var(--brand)' }">{{ (hero.subtitle || '流')[0] }}</span>
      {{ (hero.subtitle || '').slice(1) }}
    </p>
    <p class="mb-9 border-l-2 pl-4 text-left text-sm leading-relaxed opacity-55" :style="{ borderColor: 'var(--brand)' }">{{ hero.desc }}</p>

    <div class="mb-10 flex flex-wrap items-center gap-4">
      <router-link :to="hero.btn1Url || '/login'" class="site-btn px-7 py-3 text-sm font-black">{{ hero.btn1Text }}</router-link>
      <router-link v-if="hero.btn2Text" :to="hero.btn2Url || '/vpn'" class="text-xs font-bold underline underline-offset-4 opacity-60">{{ hero.btn2Text }}</router-link>
    </div>

    <div class="grid grid-cols-1 gap-x-8 gap-y-4 border-t pt-6 sm:grid-cols-3" style="border-color: color-mix(in srgb, currentColor 16%, transparent)">
      <div v-for="p in platforms.slice(0, 6)" :key="p.name" class="flex items-baseline gap-2">
        <span class="text-sm">{{ p.icon }}</span>
        <span class="text-[11px] font-bold tracking-wide opacity-65">{{ p.name[lang] || p.name }}</span>
      </div>
    </div>
  </main>

  <!-- ═══════════ 版式四：终端窗口（极客/自动化工具感）═══════════ -->
  <main v-else class="relative z-20 mx-auto max-w-4xl px-5 pt-16 pb-14 md:pt-24">
    <div class="mb-8 text-center">
      <h1 class="text-3xl font-black leading-tight tracking-tight md:text-5xl">
        <span class="site-brand-text">{{ hero.title || (zh ? '一行命令，直接开跑' : 'One Command To Run') }}</span>
      </h1>
      <p class="mx-auto mt-3 max-w-xl text-sm leading-relaxed opacity-60">{{ hero.subtitle }}</p>
    </div>

    <div class="site-card overflow-hidden p-0">
      <div class="flex items-center gap-1.5 border-b px-4 py-2.5" style="border-color: color-mix(in srgb, currentColor 14%, transparent)">
        <span class="h-2.5 w-2.5 rounded-full bg-red-400/70"></span>
        <span class="h-2.5 w-2.5 rounded-full bg-yellow-400/70"></span>
        <span class="h-2.5 w-2.5 rounded-full bg-green-400/70"></span>
        <span class="ml-3 text-[10px] font-mono opacity-40">{{ siteName || 'terminal' }} — zsh</span>
      </div>
      <div class="p-5 font-mono text-[12px] leading-[1.9]">
        <div class="opacity-45">$ {{ zh ? '下单' : 'order' }} tiktok-followers --qty 1000</div>
        <div class="mt-1" :style="{ color: 'var(--brand)' }">→ queued · 支付 ¥{{ top3[0] ? price(top3[0]) : '—' }} / 千</div>
        <div class="opacity-45">→ delivery started · ETA 6m</div>
        <div class="opacity-45">→ {{ zh ? '保量 30 天 · 掉粉自动补' : 'refill 30d · auto refill' }}</div>
        <div class="mt-3 opacity-45">$ {{ zh ? '查看全部' : 'list' }} --services</div>
        <div v-for="(s, i) in top3" :key="i" class="truncate">
          <span class="opacity-30">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="ml-2">{{ s._label || s.name }}</span>
          <span class="float-right" :style="{ color: 'var(--brand)' }">¥{{ price(s) }}</span>
        </div>
        <div class="mt-3 inline-block animate-pulse opacity-70">█</div>
      </div>
    </div>

    <div class="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
      <router-link :to="hero.btn1Url || '/login'" class="site-btn px-9 py-3.5 text-sm font-black">{{ hero.btn1Text }}</router-link>
      <router-link v-if="hero.btn2Text" :to="hero.btn2Url || '/vpn'" class="site-btn px-6 py-3.5 text-xs font-bold opacity-75">{{ hero.btn2Text }}</router-link>
    </div>
    <p class="mt-5 text-center text-[11px] font-mono opacity-35">{{ hero.desc }}</p>
  </main>
</template>
