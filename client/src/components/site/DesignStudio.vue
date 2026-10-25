<template>
  <!-- ══════════════════════════════════════════════════════════════════════
       🎨 装修工作室（92 期）
       祥哥反馈："装修和文案还不够新潮，不够可视化，色条/布局可自定义太不够个性"。
       这一版按业界成熟做法重做（参考 tweakcn 的主题令牌面板、Shopify 的分区列表
       与设备预览、Framer 的可视化属性片）：
         · 顶部实时预览（手机外框，改一下立刻变）
         · 模板 = 6 张可视化缩略线框（不是一排文字按钮）
         · 配色 = 大色卡 + 取色器 + 随机/和谐 + 8 组渐变灵感
         · 首页模块 = 可拖动排序的卡片 + iOS 开关 + 真实缩略
         · 细节风格 = 全部可视化（圆角方块 / 字距条 / 卡片小样 / 真实字体）
       ══════════════════════════════════════════════════════════════════════ -->
  <div class="space-y-4">

    <!-- ── 实时预览：直接嵌入【真的分站首页】────────────────────── -->
    <!-- 祥哥 2026-10-25："这个预览跟首页也不像啊" —— 之前是 CSS 画的近似图。
         现在把真实首页放进手机框，未保存的改动通过 URL 草稿传进去，改一下就变。 -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
      <div class="flex items-center justify-between gap-2 px-3 sm:px-4 py-3">
        <button type="button" @click="openPreview = !openPreview" class="flex items-center gap-2 text-sm font-bold text-white shrink-0">
          <span class="whitespace-nowrap">📱 实时预览</span>
          <span class="hidden sm:inline text-[10px] font-normal text-slate-500 whitespace-nowrap">就是真实首页，改一下立刻变</span>
        </button>
        <div class="flex items-center gap-1 shrink-0">
          <button v-for="d in DEVICES" :key="d.key" type="button" @click="device = d.key"
            class="px-2 py-1 rounded-md text-[10px] border whitespace-nowrap shrink-0"
            :class="device === d.key ? 'border-amber-400 text-amber-300 bg-amber-400/10' : 'border-slate-700 text-slate-400'">
            {{ d.label }}
          </button>
          <button type="button" @click="openPreview = !openPreview" class="text-[10px] text-slate-400 px-1 whitespace-nowrap shrink-0">
            {{ openPreview ? '收起' : '展开' }}
          </button>
        </div>
      </div>

      <div v-show="openPreview" class="px-3 pb-3">
        <div v-if="!previewUrl" class="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center">
          <p class="text-xs text-slate-400">这个站还没有可访问的域名，没法做真预览</p>
          <p class="text-[10px] text-slate-600 mt-1">先去「域名」页确认站点地址可用</p>
        </div>
        <template v-else>
          <div ref="boxRef" class="mx-auto w-full rounded-[22px] p-1.5 border-[3px] border-slate-700 bg-slate-950 shadow-2xl">
            <div class="rounded-[15px] overflow-hidden bg-slate-900 relative"
                 :style="{ height: Math.round(deviceHeight * scale) + 'px' }">
              <!-- iframe 按真实设备宽度渲染，再整体等比缩放到容器里：
                   这样看到的就是客户在 390 宽手机上看到的真实排版，而不是被压扁的版本 -->
              <iframe :src="previewUrl" :key="previewKey" class="border-0 origin-top-left"
                      :width="deviceWidth" :height="deviceHeight"
                      :style="{ transform: `scale(${scale})` }"
                      title="分站首页预览" referrerpolicy="no-referrer"></iframe>
              <div v-if="previewLoading" class="absolute inset-0 grid place-items-center bg-slate-950/60">
                <span class="text-[11px] text-amber-300">刷新预览…</span>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between mt-2 gap-2">
            <p class="text-[10px] text-slate-500">预览里显示的是<b class="text-slate-400">还没保存</b>的改动；保存后才对客户生效</p>
            <div class="flex items-center gap-2 shrink-0">
              <button type="button" @click="refreshPreview" class="text-[11px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700">↻ 刷新</button>
              <a v-if="site && site.domain" :href="`//${site.domain}`" target="_blank"
                class="text-[11px] text-sky-400 hover:text-sky-300">打开真实站点 ↗</a>
            </div>
          </div>
        </template>
      </div>
    </section>


    <!-- ── 一键风格（可视化）────────────────────────────────────── -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold text-white">一键风格</h2>
        <span class="text-[10px] text-slate-500">点一下整套生效，再往下微调</span>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <button v-for="p in presets" :key="p.key" type="button" @click="$emit('apply-preset', p)"
          class="rounded-xl overflow-hidden border transition text-left"
          :class="isPresetActive(p) ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-700 hover:border-slate-500'">
          <div class="h-9" :style="{ background: presetGradient(p) }"></div>
          <div class="px-2 py-1.5">
            <div class="text-[11px] font-bold text-white leading-tight">{{ p.name }}</div>
            <div class="text-[9px] text-slate-500 leading-tight truncate">{{ p.desc }}</div>
          </div>
        </button>
      </div>
    </section>

    <!-- ── 模板：可视化缩略线框 ─────────────────────────────────── -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold text-white">版式模板</h2>
        <span class="text-[10px] text-slate-500">{{ templates.length }} 套</span>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <button v-for="t in templates" :key="t.key" type="button" @click="form.template = t.key"
          class="rounded-xl overflow-hidden border transition"
          :class="form.template === t.key ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-700 hover:border-slate-500'">
          <!-- 每种模板画一个 mini 线框，让站长看得懂"是结构不同，不只是换色" -->
          <div class="h-16 p-1.5 relative overflow-hidden" :style="{ background: wireBg(t.key) }">
            <template v-if="t.key === 'classic'">
              <div class="h-1.5 w-2/3 mx-auto rounded-sm mb-1" :style="{ background: pv.brand }"></div>
              <div class="h-1 w-1/2 mx-auto rounded-sm mb-1.5" style="background:rgba(148,163,184,.45)"></div>
              <div class="grid grid-cols-2 gap-1">
                <div v-for="i in 2" :key="i" class="h-4 rounded" style="background:rgba(148,163,184,.18)"></div>
              </div>
            </template>
            <template v-else-if="t.key === 'saas'">
              <div class="flex gap-1">
                <div class="flex-1">
                  <div class="h-1.5 w-full rounded-sm mb-1" :style="{ background: pv.brand }"></div>
                  <div class="h-1 w-3/4 rounded-sm mb-1" style="background:rgba(148,163,184,.4)"></div>
                  <div class="h-2 w-1/2 rounded-sm" :style="{ background: pv.brand, opacity: .55 }"></div>
                </div>
                <div class="w-8 h-8 rounded" style="background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2)"></div>
              </div>
            </template>
            <template v-else-if="t.key === 'minimal'">
              <div class="h-1 w-1/2 rounded-sm mb-1.5" :style="{ background: pv.brand }"></div>
              <div class="space-y-1">
                <div v-for="i in 4" :key="i" class="h-1 rounded-sm" :style="{ width: (90 - i * 12) + '%', background: 'rgba(148,163,184,.3)' }"></div>
              </div>
            </template>
            <template v-else-if="t.key === 'neon'">
              <div class="h-1.5 w-2/3 mx-auto rounded-sm mb-1"
                :style="{ background: pv.brand, boxShadow: `0 0 8px ${pv.brand}` }"></div>
              <div class="grid grid-cols-2 gap-1 mt-1">
                <div v-for="i in 4" :key="i" class="h-3 rounded"
                  :style="{ background: 'rgba(255,255,255,.08)', border: `1px solid ${pv.brand}66` }"></div>
              </div>
            </template>
            <template v-else-if="t.key === 'magazine'">
              <div class="h-2 w-4/5 rounded-sm mb-1" :style="{ background: pv.brand }"></div>
              <div class="flex gap-1">
                <div v-for="i in 3" :key="i" class="flex-1 space-y-0.5">
                  <div class="h-2 rounded-sm" style="background:rgba(148,163,184,.22)"></div>
                  <div class="h-0.5 w-full rounded-sm" style="background:rgba(148,163,184,.35)"></div>
                  <div class="h-0.5 w-2/3 rounded-sm" style="background:rgba(148,163,184,.25)"></div>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="h-full rounded-lg p-1" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.22)">
                <div class="h-1.5 w-2/3 rounded-sm mb-1" :style="{ background: pv.brand }"></div>
                <div class="h-3 rounded" style="background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2)"></div>
              </div>
            </template>
          </div>
          <div class="px-2 py-1.5 text-center">
            <span class="text-[11px] font-bold" :class="form.template === t.key ? 'text-amber-300' : 'text-slate-300'">{{ t.label }}</span>
          </div>
        </button>
      </div>
    </section>

    <!-- ── 配色工作室 ──────────────────────────────────────────── -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold text-white">配色</h2>
        <span class="text-[10px] text-slate-500">点色卡 / 自己取色 / 随机</span>
      </div>

      <!-- 当前主色：大色块 + 取色器 + 随机/和谐 -->
      <div class="flex items-center gap-3 mb-3">
        <label class="relative shrink-0">
          <div class="w-14 h-14 rounded-2xl border-2 border-white/20 shadow-lg cursor-pointer"
               :style="{ background: `linear-gradient(135deg, ${pv.brand}, ${pv.strong})` }"></div>
          <input type="color" :value="currentHex" @input="onPickColor($event.target.value)"
                 class="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <div class="flex-1 min-w-0">
          <div class="flex gap-1.5">
            <input :value="currentHex" @change="onPickColor($event.target.value)" maxlength="7"
              class="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono" />
            <button type="button" @click="randomColor"
              class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px]">🎲 随机</button>
            <button type="button" @click="nextHarmony"
              class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px]">🌈 换一组</button>
          </div>
          <p class="text-[10px] text-slate-500 mt-1">品牌主色；分站按钮、价格、高亮都用它</p>
        </div>
      </div>

      <!-- 灵感配色：渐变条，点一下就换整套 -->
      <div class="grid grid-cols-2 gap-1.5 mb-3">
        <button v-for="(pal, i) in PALETTES" :key="'pal' + i" type="button" @click="applyPalette(pal)"
          class="rounded-lg overflow-hidden border transition group"
          :class="accentEq(pal.hex) ? 'border-amber-400' : 'border-slate-700 hover:border-slate-500'">
          <div class="h-6 flex">
            <div v-for="c in pal.colors" :key="c" class="flex-1" :style="{ background: c }"></div>
          </div>
          <div class="px-2 py-1 text-[10px] text-slate-400 text-left">{{ pal.name }}</div>
        </button>
      </div>

      <!-- 6 个经典色（保持与老版本一致的语义）-->
      <div class="flex flex-wrap gap-2">
        <button v-for="c in colors" :key="c.key" type="button"
          @click="form.color = c.key; form.accent = ''"
          class="w-8 h-8 rounded-full border-2 transition"
          :class="form.color === c.key && !form.accent ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'"
          :style="{ background: c.hex }" :title="c.label"></button>
        <span class="text-[10px] text-slate-500 self-center ml-1">经典色</span>
      </div>
    </section>

    <!-- ── 首页模块：拖动排序 + 开关 ───────────────────────────── -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold text-white">首页模块</h2>
        <span class="text-[10px] text-slate-500">长按卡片拖动排序 · 关掉就不显示</span>
      </div>
      <div class="space-y-1.5">
        <div v-for="(m, i) in form.modules" :key="m.key"
          draggable="true"
          @dragstart="onDragStart(i, $event)" @dragover.prevent="onDragOver(i)" @drop.prevent="onDrop(i)"
          @dragend="dragFrom = null"
          class="flex items-center gap-2 rounded-xl px-2.5 py-2.5 border transition select-none"
          :class="[m.enabled ? 'bg-slate-950/70 border-slate-700' : 'bg-slate-950/30 border-slate-800 opacity-60',
                   dragOver === i ? 'border-amber-400 bg-amber-400/10' : '']">
          <span class="text-slate-500 text-sm cursor-grab active:cursor-grabbing shrink-0">⠿</span>
          <span class="w-5 h-5 shrink-0 grid place-items-center rounded-md bg-slate-800 text-[10px] font-bold text-slate-400">{{ i + 1 }}</span>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold text-slate-100 truncate">{{ moduleTitle(m.key) }}</div>
            <div class="text-[10px] text-slate-500 truncate">{{ moduleHint(m.key) }}</div>
          </div>
          <!-- iOS 风格开关 -->
          <button type="button" @click="m.enabled = !m.enabled"
            class="shrink-0 w-10 h-6 rounded-full transition relative"
            :class="m.enabled ? 'bg-emerald-500' : 'bg-slate-700'">
            <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  :class="m.enabled ? 'left-[18px]' : 'left-0.5'"></span>
          </button>
          <!-- 手机上拖不动，必须有上下键（祥哥用手机验收）-->
          <div class="flex flex-col shrink-0 -my-1">
            <button type="button" @click="move(i, -1)" :disabled="i === 0"
              class="px-1.5 text-[10px] leading-none text-slate-400 disabled:opacity-25 hover:text-amber-300">▲</button>
            <button type="button" @click="move(i, 1)" :disabled="i === form.modules.length - 1"
              class="px-1.5 text-[10px] leading-none text-slate-400 disabled:opacity-25 hover:text-amber-300">▼</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 细节风格（全部可视化）──────────────────────────────── -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-white">细节风格</h2>
        <button type="button" @click="$emit('reset-styles')"
          class="text-[10px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400">全部跟随模板</button>
      </div>

      <!-- 圆角 -->
      <div>
        <label class="block text-[11px] text-slate-400 mb-1.5">圆角</label>
        <div class="grid grid-cols-5 gap-1.5">
          <button v-for="r in RADIUS_OPTS" :key="'r' + r.key" type="button" @click="form.ui_radius = r.key"
            class="py-2 rounded-lg border flex flex-col items-center gap-1 transition"
            :class="form.ui_radius === r.key ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 hover:border-slate-500'">
            <span class="w-6 h-6 bg-slate-600 border border-slate-500" :style="{ borderRadius: r.css }"></span>
            <span class="text-[9px] text-slate-400">{{ r.name }}</span>
          </button>
        </div>
      </div>

      <!-- 字号 -->
      <div>
        <label class="block text-[11px] text-slate-400 mb-1.5">字号</label>
        <div class="grid grid-cols-3 gap-1.5">
          <button v-for="f in FONT_SCALES" :key="'f' + f.key" type="button" @click="form.font_scale = f.key"
            class="py-2 rounded-lg border flex flex-col items-center transition"
            :class="(form.font_scale || 'md') === f.key ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700'">
            <span class="text-slate-200 font-bold leading-none"
                  :style="{ fontSize: f.key === 'sm' ? '12px' : f.key === 'lg' ? '20px' : '16px' }">Aa</span>
            <span class="text-[9px] text-slate-500 mt-1">{{ f.name }}</span>
          </button>
        </div>
      </div>

      <!-- 字体（用真实字体渲染）-->
      <div>
        <label class="block text-[11px] text-slate-400 mb-1.5">字体 <span class="text-slate-600">（每档下面就是它的样子）</span></label>
        <div class="grid grid-cols-3 gap-1.5">
          <button v-for="ft in FONT_OPTS" :key="'ft' + ft.key" type="button" @click="form.font_style = ft.key"
            class="px-2 py-2 rounded-lg border text-left transition"
            :class="form.font_style === ft.key ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 hover:border-slate-500'">
            <span class="block text-sm text-slate-100 truncate" :style="{ fontFamily: ft.css }">{{ ft.sample || 'Aa 网站字体' }}</span>
            <span class="block text-[9px] text-slate-500 mt-0.5">{{ ft.name }}</span>
          </button>
        </div>
      </div>

      <!-- 🎨 110 期：图标风格 + 图标形状（祥哥：图标能不能自己挑）-->
      <div>
        <label class="block text-[11px] text-slate-400 mb-1.5">
          图标风格 <span class="text-slate-600">（首页平台方块、服务卡前面的小图标）</span>
        </label>
        <div class="grid grid-cols-3 gap-1.5">
          <button v-for="ic in ICON_STYLE_OPTS" :key="'ic' + ic.key" type="button" @click="form.icon_style = ic.key"
            class="px-2 py-2 rounded-lg border transition flex flex-col items-center gap-1"
            :class="(form.icon_style || '') === ic.key ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 hover:border-slate-500'">
            <span class="text-base leading-none">
              {{ ic.key === '' ? '✨' : ic.key === 'brand' ? '🎵' : ic.key === 'brand-mono' ? '◍' : ic.key === 'emoji' ? '😀' : 'Aa' }}
            </span>
            <span class="text-[9px] text-slate-400">{{ ic.name }}</span>
          </button>
        </div>
      </div>

      <div>
        <label class="block text-[11px] text-slate-400 mb-1.5">图标底色形状</label>
        <div class="grid grid-cols-4 gap-1.5">
          <button v-for="sh in ICON_SHAPE_OPTS" :key="'ish' + sh.key" type="button" @click="form.icon_shape = sh.key"
            class="py-2 rounded-lg border flex flex-col items-center gap-1 transition"
            :class="(form.icon_shape || '') === sh.key ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 hover:border-slate-500'">
            <span class="w-5 h-5 bg-slate-600 border border-slate-500"
                  :style="{ borderRadius: sh.key === 'circle' ? '999px' : sh.key === 'soft' ? '0.375rem' : '0' }"></span>
            <span class="text-[9px] text-slate-400">{{ sh.name }}</span>
          </button>
        </div>
      </div>

      <!-- 按钮形状 -->
      <div>
        <label class="block text-[11px] text-slate-400 mb-1.5">按钮形状</label>
        <div class="grid grid-cols-4 gap-1.5">
          <button v-for="b in BTN_OPTS" :key="'b' + b.key" type="button" @click="form.btn_shape = b.key"
            class="py-2 rounded-lg border flex flex-col items-center gap-1 transition"
            :class="form.btn_shape === b.key ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 hover:border-slate-500'">
            <span class="px-2 py-1 text-[9px] font-bold text-slate-900"
                  :style="{ background: pv.brand, borderRadius: b.css }">按钮</span>
            <span class="text-[9px] text-slate-400">{{ b.name }}</span>
          </button>
        </div>
      </div>

      <!-- 卡片质感 -->
      <div>
        <label class="block text-[11px] text-slate-400 mb-1.5">卡片质感</label>
        <div class="grid grid-cols-4 gap-1.5">
          <button v-for="c in CARD_OPTS" :key="'c' + c.key" type="button" @click="form.card_style = c.key"
            class="py-2 rounded-lg border flex flex-col items-center gap-1.5 transition"
            :class="form.card_style === c.key ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 hover:border-slate-500'">
            <span class="w-9 h-5 rounded-md" :style="cardSample(c.key)"></span>
            <span class="text-[9px] text-slate-400">{{ c.name }}</span>
          </button>
        </div>
      </div>

      <!-- 页面节奏 -->
      <div>
        <label class="block text-[11px] text-slate-400 mb-1.5">页面节奏</label>
        <div class="grid grid-cols-3 gap-1.5">
          <button v-for="d in DENSITY_OPTS" :key="'d' + d.key" type="button" @click="form.ui_density = d.key"
            class="py-2 rounded-lg border flex flex-col items-center gap-1 transition"
            :class="form.ui_density === d.key ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 hover:border-slate-500'">
            <span class="flex flex-col items-center" :style="{ gap: d.gap }">
              <span v-for="i in 3" :key="i" class="w-6 h-[3px] rounded-sm bg-slate-500"></span>
            </span>
            <span class="text-[9px] text-slate-400 mt-1">{{ d.name }}</span>
          </button>
        </div>
      </div>

      <!-- 首屏布局 -->
      <div>
        <label class="block text-[11px] text-slate-400 mb-1.5">首屏布局</label>
        <div class="grid grid-cols-3 gap-1.5">
          <button v-for="h in HERO_OPTS" :key="'h' + h.key" type="button" @click="form.hero_layout = h.key"
            class="py-2 rounded-lg border flex flex-col items-center gap-1 transition"
            :class="form.hero_layout === h.key ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 hover:border-slate-500'">
            <span class="w-12 h-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center p-1">
              <span v-if="h.key === 'split'" class="flex gap-1 w-full h-full">
                <span class="flex-1 rounded-sm" :style="{ background: pv.brand, opacity: .7 }"></span>
                <span class="w-3 rounded-sm bg-slate-600"></span>
              </span>
              <span v-else-if="h.key === 'banner'" class="w-full h-full rounded-sm"
                    :style="{ background: `linear-gradient(135deg, ${pv.brand}88, transparent)` }"></span>
              <span v-else class="w-3/4 h-[3px] rounded-sm" :style="{ background: pv.brand }"></span>
            </span>
            <span class="text-[9px] text-slate-400">{{ h.name }}</span>
          </button>
        </div>
      </div>

      <!-- 页面背景 -->
      <div>
        <label class="block text-[11px] text-slate-400 mb-1.5">页面背景</label>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="b in BG_PRESETS" :key="'bg' + b.key" type="button" @click="form.bg_color = b.key"
            class="w-9 h-9 rounded-lg border-2 transition"
            :class="form.bg_color === b.key ? 'border-amber-400 scale-110' : 'border-slate-700'"
            :style="{ background: b.css }" :title="b.name"></button>
        </div>
        <div class="flex flex-wrap items-center gap-2 mt-2">
          <button type="button" class="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-amber-400"
            :disabled="uploading === 'bg_image'" @click="$emit('pick-image', 'bg_image')">
            {{ uploading === 'bg_image' ? '上传中…' : '上传自己的背景图' }}
          </button>
          <button v-if="form.bg_image" type="button" class="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400"
            @click="form.bg_image = ''">去掉背景图</button>
          <span v-if="form.bg_image" class="text-[10px] text-emerald-400">已选背景图</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { encodePreviewDraft } from '../../utils/previewDraft'

const props = defineProps({
  form: { type: Object, required: true },
  site: { type: Object, default: null },
  pv: { type: Object, required: true },
  templates: { type: Array, default: () => [] },
  colors: { type: Array, default: () => [] },
  presets: { type: Array, default: () => [] },
  uploading: { type: String, default: '' },
  previewModules: { type: Array, default: () => [] },
  moduleLabel: { type: Function, required: true },
  moduleHint: { type: Function, required: true },
  samplePrice: { type: String, default: '—' },
  bgPresets: { type: Array, default: () => [] }
})
defineEmits(['apply-preset', 'reset-styles', 'pick-image'])

const BG_PRESETS = computed(() => props.bgPresets)
// 📱 110 期：手机上一屏就是预览框，模板、色系、模块开关全被挤到下面去了（截图自查发现）。
//    窄屏默认收起，站长先看到能点的东西；宽屏（电脑）仍默认展开。
const openPreview = ref(typeof window !== 'undefined' ? window.innerWidth >= 768 : true)

// 🖼 真预览：设备档位 + 草稿 URL
// 宽度用真实视口宽（手机 390 就是客户手机上的宽度），高度是预览框可视高度
const DEVICES = [
  { key: 'phone', label: '手机', width: 390, height: 640 },
  { key: 'tablet', label: '平板', width: 768, height: 640 },
  { key: 'desktop', label: '桌面', width: 1180, height: 640 }
]
const device = ref('phone')
const deviceWidth = computed(() => (DEVICES.find((d) => d.key === device.value) || DEVICES[0]).width)
const deviceHeight = computed(() => (DEVICES.find((d) => d.key === device.value) || DEVICES[0]).height)

// 容器实际宽度 → 缩放比（永远不超过 1，手机档基本是 1:1）
const boxRef = ref(null)
const boxW = ref(360)
const scale = computed(() => {
  const w = boxW.value || 360
  return Math.min(1, Math.max(0.3, w / deviceWidth.value))
})
const measure = () => {
  const el = boxRef.value
  if (el) boxW.value = el.clientWidth
}
let ro = null
const observeBox = () => {
  nextTick(() => {
    measure()
    if (boxRef.value && ro) { try { ro.observe(boxRef.value); } catch (e) {} }
  })
}
onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined') ro = new ResizeObserver(() => measure())
  observeBox()
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  if (ro) { try { ro.disconnect(); } catch (e) {} }
})
// 预览框是在 previewUrl 赋上之后才渲染出来的，得等它挂载完再量

const previewUrl = ref('')
const previewKey = ref(0)
const previewLoading = ref(false)

watch([device, openPreview], observeBox)
watch(previewUrl, observeBox)
let previewTimer = null

// 把表单里"影响外观/文案"的字段收成草稿，交给 iframe 里的真实首页渲染
const buildDraft = () => ({
  siteName: props.form.name, siteLogo: props.form.logo,
  footerText: props.form.footer_text, supportUrl: props.form.support_url,
  announcement: props.form.announcement, discountLabel: props.form.discount_label,
  themeTemplate: props.form.template, themeColor: props.form.color, themeAccent: props.form.accent,
  uiRadius: props.form.ui_radius, uiDensity: props.form.ui_density, cardStyle: props.form.card_style,
  fontStyle: props.form.font_style, btnShape: props.form.btn_shape, heroLayout: props.form.hero_layout,
  iconStyle: props.form.icon_style, iconShape: props.form.icon_shape,
  bgColor: props.form.bg_color, bgImage: props.form.bg_image, fontScale: props.form.font_scale,
  heroVariant: props.form.hero_variant, servicesVariant: props.form.services_variant,
  customCss: props.form.custom_css, faviconUrl: props.form.favicon_url,
  sectionTitles: props.form.section_titles, advantages: props.form.advantages,
  homeModules: props.form.modules,
  hero: {
    hero_badge: props.form.hero_badge, hero_title: props.form.hero_title,
    hero_subtitle: props.form.hero_subtitle, hero_desc: props.form.hero_desc,
    hero_btn1_text: props.form.hero_btn1_text, hero_btn1_url: props.form.hero_btn1_url,
    hero_btn2_text: props.form.hero_btn2_text, hero_btn2_url: props.form.hero_btn2_url,
    hero_bg_url: props.form.hero_bg_url
  }
})

const schedulePreview = () => {
  const domain = props.site && props.site.domain
  if (!domain) { previewUrl.value = ''; return }
  previewLoading.value = true
  clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    const d = encodePreviewDraft(buildDraft())
    previewUrl.value = `//${domain}/?pv=1&draft=${d}&t=${Date.now()}`
    previewKey.value++
    setTimeout(() => { previewLoading.value = false }, 900)
  }, 700)
}

const refreshPreview = () => schedulePreview()

watch(
  () => JSON.stringify(buildDraft()),
  () => schedulePreview(),
  { immediate: true }
)

// ── 预览样式（与真实站点同一套令牌）──────────────────────────────
const shellStyle = computed(() => ({
  background: props.pv.bg,
  fontFamily: props.pv.font,
  letterSpacing: props.pv.letter
}))
const navStyle = computed(() => ({ background: 'rgba(2,6,23,.45)', borderBottom: `1px solid ${props.pv.border}` }))
const cardStyle = computed(() => ({
  background: props.pv.surface,
  border: `1px solid ${props.pv.border}`,
  borderRadius: props.pv.radius,
  boxShadow: props.pv.shadow,
  backdropFilter: (props.form.template === 'glass' || props.form.card_style === 'glass') ? 'blur(6px)' : undefined
}))
const btnPrimary = computed(() => ({
  background: `linear-gradient(135deg, ${props.pv.brand}, ${props.pv.strong})`,
  color: '#0b1220', fontSize: '9px', fontWeight: 800, padding: '3px 9px',
  borderRadius: props.pv.btnRadius, boxShadow: `0 0 12px ${props.pv.soft}`
}))
const btnGhost = computed(() => ({
  border: `1px solid ${props.pv.border}`, color: 'rgba(226,232,240,.8)',
  fontSize: '9px', padding: '3px 9px', borderRadius: props.pv.btnRadius
}))
const moduleTitle = (k) => props.moduleLabel(k)

// ── 风格选项（可视化）────────────────────────────────────────────
const RADIUS_OPTS = [
  { key: '', name: '跟随', css: '0.375rem' },
  { key: 'square', name: '直角', css: '0.125rem' },
  { key: 'soft', name: '小圆', css: '0.5rem' },
  { key: 'round', name: '大圆', css: '999px' },
  { key: 'pill', name: '胶囊', css: '999px' }
]
const FONT_SCALES = [{ key: 'sm', name: '小' }, { key: 'md', name: '标准' }, { key: 'lg', name: '大' }]
// 🎨 110 期（祥哥：字体能不能更丰富）：原来 4 档里有 3 档是西文字体，
//    中文看起来几乎一样。现在补上 4 档真中文字体栈，站长一眼能看出差别。
const FONT_OPTS = [
  { key: '', name: '跟随模板', css: 'system-ui, sans-serif', sample: 'Aa 涨价' },
  { key: 'sans', name: '现代黑体', css: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif', sample: '粉丝 到账' },
  { key: 'hei', name: '硬黑海报', css: '"Heiti SC", "SimHei", "Microsoft YaHei", system-ui, sans-serif', sample: '秒级 交付' },
  { key: 'yahei', name: '雅黑圆润', css: '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif', sample: '下单 即发' },
  { key: 'song', name: '宋体杂志', css: '"Songti SC", "SimSun", Georgia, serif', sample: '品质 服务' },
  { key: 'kai', name: '楷体文艺', css: '"Kaiti SC", "KaiTi", "STKaiti", serif', sample: '匠心 出品' },
  { key: 'rounded', name: '圆体亲和', css: '"SF Pro Rounded", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif', sample: '轻松 涨粉' },
  { key: 'serif', name: '衬线英文', css: 'Georgia, "Times New Roman", "Songti SC", serif', sample: 'Premium' },
  { key: 'mono', name: '等宽科技', css: '"JetBrains Mono", Consolas, "Courier New", monospace', sample: 'ID 30094' }
]
// 🎨 110 期：图标风格 + 图标形状
const ICON_STYLE_OPTS = [
  { key: '', name: '跟随模板' },
  { key: 'brand', name: '品牌彩色' },
  { key: 'brand-mono', name: '品牌单色' },
  { key: 'emoji', name: '表情符号' },
  { key: 'text', name: '只用文字' }
]
const ICON_SHAPE_OPTS = [
  { key: '', name: '无底' },
  { key: 'none', name: '透明' },
  { key: 'soft', name: '圆角块' },
  { key: 'circle', name: '圆形块' }
]
const BTN_OPTS = [
  { key: '', name: '跟随', css: '0.5rem' },
  { key: 'pill', name: '胶囊', css: '999px' },
  { key: 'rounded', name: '圆角', css: '0.5rem' },
  { key: 'square', name: '方角', css: '0.125rem' }
]
const CARD_OPTS = [
  { key: '', name: '跟随' }, { key: 'outline', name: '描边' },
  { key: 'glass', name: '毛玻璃' }, { key: 'solid', name: '实心' }
]
const cardSample = (key) => {
  if (key === 'outline') return { background: 'transparent', border: '1px solid rgba(148,163,184,.5)' }
  if (key === 'glass') return { background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.3)', backdropFilter: 'blur(3px)' }
  if (key === 'solid') return { background: 'rgba(15,23,42,.95)', border: '1px solid rgba(148,163,184,.25)' }
  return { background: 'rgba(148,163,184,.25)', border: '1px dashed rgba(148,163,184,.4)' }
}
const DENSITY_OPTS = [
  { key: '', name: '跟随', gap: '3px' },
  { key: 'compact', name: '紧凑', gap: '1px' },
  { key: 'normal', name: '标准', gap: '3px' },
  { key: 'relaxed', name: '宽松', gap: '5px' }
]
const HERO_OPTS = [
  { key: '', name: '居中' }, { key: 'split', name: '左文右图' }, { key: 'banner', name: '整屏大图' }
]

// ── 配色 ────────────────────────────────────────────────────────
const currentHex = computed(() => {
  const h = String(props.form.accent || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h
  return props.pv.brand
})
const accentEq = (hex) => String(props.form.accent || '').toLowerCase() === String(hex).toLowerCase()

// 8 组配色灵感（渐变条，点一下整套换掉）
const PALETTES = [
  { name: '霓虹紫', hex: '#a855f7', bg: '#12081a', colors: ['#a855f7', '#7c3aed', '#f472b6'] },
  { name: '赛博青', hex: '#22d3ee', bg: '#04070f', colors: ['#22d3ee', '#0ea5e9', '#6366f1'] },
  { name: '日落橙', hex: '#fb7185', bg: '#1a0a10', colors: ['#fb7185', '#f97316', '#fbbf24'] },
  { name: '薄荷绿', hex: '#34d399', bg: '#04140f', colors: ['#34d399', '#10b981', '#22d3ee'] },
  { name: '深海蓝', hex: '#38bdf8', bg: '#050b1a', colors: ['#38bdf8', '#2563eb', '#818cf8'] },
  { name: '玫瑰金', hex: '#f472b6', bg: '#180a13', colors: ['#f472b6', '#f59e0b', '#fde68a'] },
  { name: '极光', hex: '#a3e635', bg: '#08120a', colors: ['#a3e635', '#22d3ee', '#a78bfa'] },
  { name: '樱桃红', hex: '#ef4444', bg: '#17070a', colors: ['#ef4444', '#f97316', '#fbbf24'] }
]
const HARMONY = ['#a855f7', '#22d3ee', '#34d399', '#fb7185', '#38bdf8', '#f59e0b', '#f472b6', '#a3e635']
const harmonyIdx = ref(0)

const onPickColor = (v) => {
  const hex = String(v || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) props.form.accent = hex.toLowerCase()
}
const randomColor = () => {
  const h = Math.floor(Math.random() * 360)
  const s = 65 + Math.floor(Math.random() * 25)
  const l = 52 + Math.floor(Math.random() * 12)
  props.form.accent = hslToHex(h, s, l)
}
const nextHarmony = () => {
  harmonyIdx.value = (harmonyIdx.value + 1) % HARMONY.length
  props.form.accent = HARMONY[harmonyIdx.value]
}
const applyPalette = (pal) => {
  props.form.accent = pal.hex
  if (pal.bg) props.form.bg_color = pal.bg
}
const hslToHex = (h, s, l) => {
  s /= 100; l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = (x) => Math.round(255 * x).toString(16).padStart(2, '0')
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`
}

// ── 预设是否处于选中态 ───────────────────────────────────────────
const isPresetActive = (p) => {
  const d = p.data || {}
  return Object.keys(d).every((k) => String(props.form[k] ?? '') === String(d[k] ?? ''))
}
// 🎨 110 期：风格卡片原来一律画成「同色深→浅」，所以祥哥说"颜色都是单色吗，没有渐变吗"。
//    现在预设可以自带 sw（真双色渐变），有就用，没有才退回原来的单色深浅。
const presetGradient = (p) => p.sw || `linear-gradient(135deg, ${p.colorHex}, ${p.colorHex}55)`
const wireBg = (key) => {
  if (key === 'neon') return 'rgba(12,4,24,.9)'
  if (key === 'glass') return 'rgba(255,255,255,.05)'
  if (key === 'minimal') return 'rgba(2,6,23,.85)'
  if (key === 'magazine') return 'rgba(17,24,39,.9)'
  return 'rgba(15,23,42,.85)'
}

// ── 拖拽排序 ───────────────────────────────────────────────────
const dragFrom = ref(null)
const dragOver = ref(null)
const onDragStart = (i, e) => {
  dragFrom.value = i
  try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)) } catch (err) {}
}
const onDragOver = (i) => { dragOver.value = i }
const onDrop = (i) => {
  const from = dragFrom.value
  dragOver.value = null
  dragFrom.value = null
  if (from === null || from === i) return
  const arr = props.form.modules
  const [moved] = arr.splice(from, 1)
  arr.splice(i, 0, moved)
  arr.forEach((m, idx) => (m.order = idx))
}
// 手机上没有拖拽手势，必须给上下键
const move = (i, dir) => {
  const arr = props.form.modules
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  const t = arr[i]
  arr[i] = arr[j]
  arr[j] = t
  arr.forEach((m, idx) => (m.order = idx))
}
</script>
