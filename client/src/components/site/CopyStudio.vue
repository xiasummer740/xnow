<template>
  <!-- ✍️ 文案工作室（92 期）：每一块都能"边写边看到成品"的样子 -->
  <div class="space-y-4">

    <!-- ── 版式变体（结构层，比配色更"个性"）────────────────────── -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold text-white">版式变体</h2>
        <span class="text-[10px] text-slate-500">留空 = 用模板自带版式</span>
      </div>
      <p class="text-[10px] text-slate-500 mb-1.5">首屏怎么排</p>
      <div class="grid grid-cols-3 gap-1.5 mb-3">
        <button v-for="v in HERO_VARIANTS" :key="'hv' + v.key" type="button" @click="form.hero_variant = v.key"
          class="rounded-lg border px-1.5 py-2 transition"
          :class="(form.hero_variant || '') === v.key ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 hover:border-slate-500'">
          <span class="block w-full h-8 rounded bg-slate-950 border border-slate-800 p-1 flex flex-col justify-center gap-0.5">
            <span v-if="v.key === 'split'" class="flex gap-1 h-full items-center">
              <span class="flex-1"><span class="block h-[3px] rounded-sm mb-1" :style="{ background: pv.brand }"></span>
                <span class="block h-[2px] w-2/3 rounded-sm bg-slate-600"></span></span>
              <span class="w-3 h-full rounded-sm bg-slate-700"></span>
            </span>
            <span v-else-if="v.key === 'editorial'" class="block">
              <span class="block h-[5px] w-1/2 rounded-sm mb-1" :style="{ background: pv.brand }"></span>
              <span class="block h-[2px] w-full rounded-sm bg-slate-600 mb-0.5"></span>
              <span class="block h-[2px] w-3/4 rounded-sm bg-slate-700"></span>
            </span>
            <span v-else-if="v.key === 'terminal'" class="block rounded-sm"
              style="border:1px solid rgba(148,163,184,.4);height:100%;padding:2px">
              <span class="block h-[2px] w-1/3 rounded-sm" :style="{ background: pv.brand }"></span>
            </span>
            <span v-else-if="v.key === 'center'" class="block text-center">
              <span class="block h-[4px] w-3/4 mx-auto rounded-sm mb-1" :style="{ background: pv.brand }"></span>
              <span class="block h-[2px] w-1/2 mx-auto rounded-sm bg-slate-600"></span>
            </span>
            <span v-else class="block text-center text-[7px] text-slate-600">跟随</span>
          </span>
          <span class="block text-[9px] mt-1" :class="(form.hero_variant || '') === v.key ? 'text-amber-300' : 'text-slate-400'">{{ v.name }}</span>
        </button>
      </div>
      <p class="text-[10px] text-slate-500 mb-1.5">服务列表怎么排</p>
      <div class="grid grid-cols-4 gap-1.5">
        <button v-for="v in SERVICE_VARIANTS" :key="'sv' + v.key" type="button" @click="form.services_variant = v.key"
          class="rounded-lg border px-1 py-2 text-[10px] transition"
          :class="(form.services_variant || '') === v.key ? 'border-amber-400 bg-amber-400/10 text-amber-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'">
          {{ v.name }}
        </button>
      </div>
      <p v-if="form.hero_variant || form.services_variant"
        class="mt-2 text-[10px] text-amber-400/90 leading-relaxed bg-amber-400/5 border border-amber-400/20 rounded-lg px-2 py-1.5">
        ⚠️ 选了具体版式会盖掉模板自带的版式（6 套模板就只剩配色不同）。想用模板版式，点回「跟随」。
      </p>
    </section>

    <!-- ── 首屏（Hero）────────────────────────────────────────── -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-white">首屏（客户进来第一眼）</h2>
        <button type="button" @click="$emit('fill-demo')"
          class="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 shrink-0">用示例填满</button>
      </div>

      <!-- 实时预览 -->
      <div class="rounded-xl p-3 border border-slate-700/70" :style="{ background: pv.bg || '#0b1220', fontFamily: pv.font }">
        <span v-if="form.hero_badge"
          class="inline-block mb-1.5 px-2 py-0.5 rounded text-[10px] font-bold"
          :style="{ background: pv.soft, color: pv.brand }">{{ form.hero_badge }}</span>
        <div class="text-lg font-black leading-tight" :style="{ color: '#f8fafc', fontFamily: pv.font }">
          {{ form.hero_title || '（这里是大标题）' }}
        </div>
        <div v-if="form.hero_subtitle" class="text-[11px] mt-1" :style="{ color: 'rgba(148,163,184,.95)' }">
          {{ form.hero_subtitle }}
        </div>
        <div v-if="form.hero_desc" class="text-[10px] mt-0.5" :style="{ color: 'rgba(148,163,184,.7)' }">
          {{ form.hero_desc }}
        </div>
        <div class="flex gap-2 mt-2">
          <span class="px-3 py-1.5 text-[11px] font-bold"
            :style="{ background: `linear-gradient(135deg, ${pv.brand}, ${pv.strong})`, color: '#0b1220', borderRadius: pv.btnRadius }">
            {{ form.hero_btn1_text || '主按钮' }}
          </span>
          <span class="px-3 py-1.5 text-[11px]"
            :style="{ border: `1px solid ${pv.border}`, color: 'rgba(226,232,240,.85)', borderRadius: pv.btnRadius }">
            {{ form.hero_btn2_text || '次按钮' }}
          </span>
        </div>
      </div>

      <!-- 字段 -->
      <div class="space-y-2.5">
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[11px] text-slate-400">顶部小标签</label>
            <span class="text-[10px] text-slate-600">{{ (form.hero_badge || '').length }}/120</span>
          </div>
          <input v-model="form.hero_badge" maxlength="120" placeholder="🚀 全平台涨粉 · 秒级交付"
            class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[11px] text-slate-400">大标题</label>
            <span class="text-[10px] text-slate-600">{{ (form.hero_title || '').length }}/120</span>
          </div>
          <input v-model="form.hero_title" maxlength="120" placeholder="涨粉这事，交给专业的人"
            class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[11px] text-slate-400">副标题</label>
            <span class="text-[10px] text-slate-600">{{ (form.hero_subtitle || '').length }}/255</span>
          </div>
          <input v-model="form.hero_subtitle" maxlength="255" placeholder="TikTok / IG / YouTube 全平台增长"
            class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">灰色小字</label>
          <input v-model="form.hero_desc" maxlength="255" placeholder="支持微信 / 支付宝 / USDT 充值"
            class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">主按钮文字</label>
            <input v-model="form.hero_btn1_text" maxlength="40" placeholder="⚡ 立即注册"
              class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">主按钮链接</label>
            <input v-model="form.hero_btn1_url" placeholder="/login"
              class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">次按钮文字</label>
            <input v-model="form.hero_btn2_text" maxlength="40" placeholder="💬 联系客服"
              class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">次按钮链接</label>
            <input v-model="form.hero_btn2_url" placeholder="https://t.me/xxx"
              class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs" />
          </div>
        </div>
      </div>
    </section>

    <!-- ── 图片（Logo / 首屏背景）─────────────────────────────── -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
      <h2 class="text-sm font-bold text-white">图片</h2>
      <div>
        <label class="flex items-center justify-between mb-1">
          <span class="text-[11px] text-slate-400">Logo</span>
          <button type="button" @click="$emit('pick-image', 'logo')" :disabled="uploading === 'logo'"
            class="text-[10px] px-2 py-1 rounded border border-amber-400/40 text-amber-300 hover:bg-amber-400/10">
            {{ uploading === 'logo' ? '上传中…' : '📤 上传' }}
          </button>
        </label>
        <div class="flex items-center gap-2">
          <div class="w-10 h-10 rounded-lg bg-slate-950 border border-slate-700 grid place-items-center overflow-hidden shrink-0">
            <img v-if="form.logo" :src="form.logo" class="w-full h-full object-contain" alt="" />
            <span v-else class="text-slate-600 text-xs">无</span>
          </div>
          <input v-model="form.logo" placeholder="/logo.png 或图片地址"
            class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs" />
        </div>
      </div>
      <div>
        <label class="flex items-center justify-between mb-1">
          <span class="text-[11px] text-slate-400">首屏背景图（可选）</span>
          <button type="button" @click="$emit('pick-image', 'hero_bg_url')" :disabled="uploading === 'hero_bg_url'"
            class="text-[10px] px-2 py-1 rounded border border-amber-400/40 text-amber-300 hover:bg-amber-400/10">
            {{ uploading === 'hero_bg_url' ? '上传中…' : '📤 上传' }}
          </button>
        </label>
        <input v-model="form.hero_bg_url" placeholder="留空用模板自带背景"
          class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs" />
      </div>
    </section>

    <!-- ── 各区块标题 ─────────────────────────────────────────── -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold text-white">各区块标题</h2>
        <span class="text-[10px] text-slate-500">留空用默认</span>
      </div>
      <div class="space-y-2.5">
        <div v-for="sec in sectionKeys" :key="sec.key" class="rounded-xl bg-slate-950/60 border border-slate-800 p-2.5">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[10px] px-1.5 py-0.5 rounded" :style="{ background: pv.soft, color: pv.brand }">{{ sec.label }}</span>
            <span class="text-[10px] text-slate-500 truncate">{{ form.section_titles[sec.key].title || sec.phTitle }}</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            <input v-model="form.section_titles[sec.key].title" :placeholder="sec.phTitle"
              class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs" />
            <input v-model="form.section_titles[sec.key].sub" :placeholder="sec.phSub"
              class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs" />
          </div>
        </div>
      </div>
    </section>

    <!-- ── 优势三卡 ───────────────────────────────────────────── -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold text-white">「优势」三张卡</h2>
        <span class="text-[10px] text-slate-500">留空用系统默认文案</span>
      </div>
      <div class="space-y-2.5">
        <div v-for="(a, i) in form.advantages" :key="'adv' + i"
          class="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
          <!-- 卡片内实时预览 -->
          <div class="rounded-lg p-2 mb-2" :style="{ background: pv.surface, border: `1px solid ${pv.border}`, borderRadius: '10px' }">
            <div class="text-base leading-none">{{ a.icon || ['⚡', '💎', '🔒'][i] }}</div>
            <div class="text-[11px] font-bold mt-1" :style="{ color: '#f1f5f9' }">
              {{ a.title || ['秒级自动交付', '超值价格', '安全无需密码'][i] }}
            </div>
            <div class="text-[10px] mt-0.5" :style="{ color: 'rgba(148,163,184,.9)' }">
              {{ a.body || ['系统全自动对接，下单即处理。', '价格以下单页为准，透明可查。', '只需目标链接，无需账号密码。'][i] }}
            </div>
          </div>
          <div class="grid grid-cols-[42px_1fr] gap-1.5">
            <input v-model="a.icon" maxlength="4" :placeholder="['⚡', '💎', '🔒'][i]"
              class="w-full bg-slate-900 border border-slate-700 rounded-lg px-1 py-1.5 text-center text-sm" />
            <div class="space-y-1.5">
              <input v-model="a.title" maxlength="30" :placeholder="['秒级自动交付', '超值价格', '安全无需密码'][i]"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs" />
              <input v-model="a.body" maxlength="80"
                :placeholder="['系统全自动对接，下单即处理。', '价格以下单页为准，透明可查。', '只需目标链接，无需账号密码。'][i]"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs" />
            </div>
          </div>
        </div>
      </div>
      <p class="text-[10px] text-slate-600 mt-2">图标最多 2 个字符（emoji 即可）· 标题最多 30 字 · 说明最多 80 字</p>
    </section>

    <!-- ── 高级（图标 / 自定义 CSS）──────────────────────────── -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-white">高级</h2>
        <span class="text-[10px] text-slate-500">不改也没关系</span>
      </div>
      <div>
        <label class="flex items-center justify-between mb-1">
          <span class="text-[11px] text-slate-400">站点图标（浏览器标签上的小图）</span>
          <button type="button" @click="$emit('pick-image', 'favicon_url')" :disabled="uploading === 'favicon_url'"
            class="text-[10px] px-2 py-1 rounded border border-amber-400/40 text-amber-300 hover:bg-amber-400/10">
            {{ uploading === 'favicon_url' ? '上传中…' : '📤 上传' }}
          </button>
        </label>
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded bg-slate-950 border border-slate-700 grid place-items-center overflow-hidden shrink-0">
            <img v-if="form.favicon_url" :src="form.favicon_url" class="w-full h-full object-contain" alt="" />
            <span v-else class="text-slate-600 text-[10px]">默认</span>
          </div>
          <input v-model="form.favicon_url" placeholder="留空则用默认图标"
            class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs" />
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="text-[11px] text-slate-400">自定义 CSS</label>
          <span class="text-[10px] text-slate-600">{{ (form.custom_css || '').length }}/8000</span>
        </div>
        <textarea v-model="form.custom_css" rows="5" maxlength="8000" spellcheck="false"
          placeholder="/* 想改任何细节就写这里，例如：.hero-title { letter-spacing: -0.02em } */"
          class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[11px] font-mono"></textarea>
        <p class="text-[10px] text-slate-600 mt-1">给懂代码的人用；留空不影响什么</p>
      </div>
    </section>
  </div>
</template>

<script setup>
const props = defineProps({
  form: { type: Object, required: true },
  pv: { type: Object, required: true },
  sectionKeys: { type: Array, default: () => [] },
  uploading: { type: String, default: '' }
})
defineEmits(['pick-image', 'fill-demo'])

const HERO_VARIANTS = [
  { key: '', name: '跟随模板' },
  { key: 'center', name: '居中大标题' },
  { key: 'split', name: '左文右价卡' },
  { key: 'editorial', name: '杂志排版' },
  { key: 'terminal', name: '终端窗口' }
]
const SERVICE_VARIANTS = [
  { key: '', name: '跟随' }, { key: 'cards', name: '卡片' },
  { key: 'table', name: '价格表' }, { key: 'ranked', name: '榜单' }
]
</script>
