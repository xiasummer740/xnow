<template>
  <div class="min-h-screen bg-slate-950 text-white">
    <div class="max-w-6xl mx-auto px-4 py-10">
      <div class="mb-8">
        <h1 class="text-2xl md:text-3xl font-black mb-2">🎨 分站风格陈列</h1>
        <p class="text-sm text-slate-400 leading-relaxed">
          这是给站长挑风格用的公开页面，不需要登录。每张卡片是<b>同一套内容</b>在 9 套预设下的样子 ——
          颜色、圆角、字体、卡片质感、按钮形状、首屏布局全都不同。
        </p>
        <p class="text-xs text-slate-500 mt-2">
          站长选定后再进后台「我的分站 → 外观模板 → 一键风格」套用即可。
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="p in presets" :key="p.key" class="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/40">
          <!-- 预览画布：完全用该预设自己的样式渲染 -->
          <div :style="canvasStyle(p)" class="p-4 h-56 flex flex-col justify-center relative overflow-hidden">
            <div v-if="p.data.hero_layout === 'split'" class="flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div :style="badgeStyle(p)" class="inline-block text-[8px] px-2 py-0.5 mb-2 font-bold">老张涨粉铺</div>
                <div :style="titleStyle(p)" class="text-[15px] font-black leading-tight mb-1">涨粉，找我没错</div>
                <div :style="subStyle(p)" class="text-[9px] leading-snug">极速交付 · 全网底价</div>
              </div>
              <div :style="cardStyle(p)" class="w-20 h-16 flex items-center justify-center flex-shrink-0">
                <span :style="{ color: p.brand }" class="text-[9px] font-black">24/7</span>
              </div>
            </div>
            <div v-else class="text-center">
              <div :style="badgeStyle(p)" class="inline-block text-[8px] px-2 py-0.5 mb-2 font-bold">老张涨粉铺</div>
              <div :style="titleStyle(p)" class="text-[15px] font-black leading-tight mb-1">涨粉，找我没错</div>
              <div :style="subStyle(p)" class="text-[9px] leading-snug mb-3">极速交付 · 全网底价</div>
              <div :style="cardStyle(p)" class="mx-auto w-24 h-10 flex items-center justify-center">
                <span :style="{ color: p.brand }" class="text-[9px] font-black">TikTok 1000 粉</span>
              </div>
            </div>
            <div class="mt-3 flex justify-center">
              <span :style="btnStyle(p)" class="text-[9px] font-black px-4 py-1.5">立即下单</span>
            </div>
          </div>

          <div class="px-4 py-3 flex items-center justify-between border-t border-slate-800">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full" :style="{ background: p.colorHex }"></span>
                <span class="text-sm font-bold">{{ p.name }}</span>
              </div>
              <div class="text-[10px] text-slate-500 mt-0.5">{{ p.desc }}</div>
            </div>
            <div class="text-[9px] text-slate-600 text-right leading-tight">
              {{ p.data.template }}<br>{{ p.data.hero_layout }}
            </div>
          </div>
        </div>
      </div>

      <div class="mt-10 text-center">
        <router-link to="/" class="inline-block px-6 py-3 rounded-xl bg-amber-400 text-slate-900 font-black text-sm">← 返回首页</router-link>
      </div>
      <p class="text-center text-[10px] text-slate-600 mt-6">
        提示：这套陈列页只是"看"，真正的套用在站长后台里，一键生效。
      </p>
    </div>
  </div>
</template>

<script setup>
// 🎨 三十四期：公开风格陈列页。
// 目的：祥哥打不开后台（缺 DNS 记录）时，也能直接在公网看到 9 套预设长什么样。
// 数据与 SiteAdmin.vue 里的 presets 保持一致 —— 改一处记得同步另一处。
const PRESETS = [
  { key: 'neon_purple', name: '霓虹紫', desc: '潮、年轻、夜店感', colorHex: '#a855f7', brand: '#a855f7', strong: '#9333ea',
    data: { template: 'neon', color: 'purple', ui_radius: 'round', card_style: 'glass', font_style: 'sans', btn_shape: 'pill', hero_layout: 'center', bg: '#0b0718' } },
  { key: 'neon_cyan', name: '赛博青', desc: '科技、电竞、数据感', colorHex: '#22d3ee', brand: '#22d3ee', strong: '#06b6d4',
    data: { template: 'neon', color: 'cyan', ui_radius: 'soft', card_style: 'glass', font_style: 'mono', btn_shape: 'rounded', hero_layout: 'center', bg: '#04121a' } },
  { key: 'saas_blue', name: '商务蓝', desc: '可信、正规、企业感', colorHex: '#3b82f6', brand: '#3b82f6', strong: '#2563eb',
    data: { template: 'saas', color: 'blue', ui_radius: 'square', card_style: 'outline', font_style: 'sans', btn_shape: 'rounded', hero_layout: 'split', bg: '#0a1120' } },
  { key: 'minimal_slate', name: '极简灰', desc: '干净、高级、不抢戏', colorHex: '#94a3b8', brand: '#94a3b8', strong: '#64748b',
    data: { template: 'minimal', color: 'cyan', ui_radius: 'soft', card_style: 'outline', font_style: 'sans', btn_shape: 'square', hero_layout: 'center', bg: '#04070f' } },
  { key: 'magazine_gold', name: '杂志金', desc: '品牌感、像媒体', colorHex: '#d4a017', brand: '#d4a017', strong: '#b8860b',
    data: { template: 'magazine', color: 'orange', ui_radius: 'square', card_style: 'solid', font_style: 'serif', btn_shape: 'square', hero_layout: 'banner', bg: '#12100a' } },
  { key: 'glass_mint', name: '玻璃青', desc: '清爽、通透、轻', colorHex: '#34d399', brand: '#34d399', strong: '#10b981',
    data: { template: 'glass', color: 'green', ui_radius: 'round', card_style: 'glass', font_style: 'rounded', btn_shape: 'pill', hero_layout: 'split', bg: '#07130f' } },
  { key: 'warm_red', name: '热卖红', desc: '促销感、能催单', colorHex: '#ef4444', brand: '#ef4444', strong: '#dc2626',
    data: { template: 'classic', color: 'red', ui_radius: 'round', card_style: 'solid', font_style: 'sans', btn_shape: 'pill', hero_layout: 'center', bg: '#150808' } },
  { key: 'candy_orange', name: '活泼橙', desc: '亲和、好上手', colorHex: '#f97316', brand: '#f97316', strong: '#ea580c',
    data: { template: 'classic', color: 'orange', ui_radius: 'pill', card_style: 'glass', font_style: 'rounded', btn_shape: 'pill', hero_layout: 'split', bg: '#150f06' } },
  { key: 'deep_green', name: '沉稳绿', desc: '老练、可靠、稳重', colorHex: '#22c55e', brand: '#22c55e', strong: '#16a34a',
    data: { template: 'saas', color: 'green', ui_radius: 'soft', card_style: 'solid', font_style: 'sans', btn_shape: 'rounded', hero_layout: 'split', bg: '#07130c' } }
]

const presets = PRESETS

const RADIUS = { square: '4px', soft: '10px', round: '18px', pill: '999px' }
const FONT = {
  sans: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  rounded: '"SF Pro Rounded", "PingFang SC", system-ui, sans-serif',
  serif: 'Georgia, "Songti SC", "Times New Roman", serif',
  mono: '"JetBrains Mono", Consolas, monospace'
}

const canvasStyle = (p) => ({
  background: p.data.template === 'neon' || p.data.template === 'glass'
    ? `radial-gradient(220px 120px at 20% -10%, ${p.brand}33, transparent 60%), ${p.data.bg}`
    : p.data.bg,
  fontFamily: FONT[p.data.font_style],
  fontFamily: FONT[p.data.font_style]
})
const titleStyle = (p) => ({
  fontFamily: p.data.font_style === 'serif' ? FONT.serif : FONT[p.data.font_style],
  color: '#fff',
  letterSpacing: p.data.font_style === 'serif' ? '0.06em' : '0'
})
const subStyle = () => ({ color: 'rgba(203,213,225,.75)' })
const badgeStyle = (p) => ({
  background: p.brand + '22', color: p.brand,
  borderRadius: RADIUS[p.data.ui_radius] === '999px' ? '999px' : '999px',
  border: `1px solid ${p.brand}55`
})
const cardStyle = (p) => {
  const r = RADIUS[p.data.ui_radius]
  const base = { borderRadius: r, border: `1px solid ${p.brand}44` }
  if (p.data.card_style === 'outline') return { ...base, background: 'transparent' }
  if (p.data.card_style === 'glass') return { ...base, background: 'rgba(255,255,255,.07)', backdropFilter: 'blur(8px)' }
  return { ...base, background: 'rgba(15,23,42,.92)' }
}
const btnStyle = (p) => ({
  background: `linear-gradient(135deg, ${p.brand}, ${p.strong})`,
  color: '#0b1220',
  borderRadius: RADIUS[p.data.btn_shape]
})
</script>
