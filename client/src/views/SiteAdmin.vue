<template>
  <div class="p-4 md:p-6 max-w-5xl mx-auto text-slate-200">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-black">我的分站</h1>
        <p class="text-xs text-slate-500 mt-1">改名字、换模板、填收款、绑域名、看收益 —— 都在这里</p>
      </div>
      <button @click="load()" class="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 whitespace-nowrap">刷新</button>
    </div>

    <!-- 📣 推荐同行开店：站长把朋友介绍来开至尊代理/充值，他拿 10% 返佣。
         只出现在主站的「我的分站」页，分站上不露痕迹。 -->
    <div class="mb-5 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent p-4 md:p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="font-black text-amber-300 flex items-center gap-2">
            <span>🤝</span> 推荐同行来开店，你拿 10% 返佣
          </div>
          <p class="text-xs text-slate-400 mt-1 leading-relaxed">
            把下面的链接发给想开分站的朋友：他在主站注册并充值，<b class="text-amber-300">他的充值金额 10% 直接进你的余额</b>，
            不用你操作，到账自动发。目前你已带来 <b class="text-slate-200">{{ affiliate.count }}</b> 人，
            累计拿到返佣 <b class="text-emerald-400">¥{{ affiliate.commission }}</b>。
          </p>
        </div>
        <div class="flex items-center gap-2">
          <input :value="inviteLink" readonly
                 class="w-56 md:w-72 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300" />
          <button @click="copyInvite" class="px-3 py-2 text-xs font-bold rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400">
            {{ copied ? '已复制 ✓' : '复制' }}
          </button>
        </div>
      </div>
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
            售价倍率（3 倍 = 客户看到的价格是平台基础价的 3 倍；数字越大客户越贵、你赚得越多）
          </label>
          <input v-model.number="createForm.multiplier" type="number" step="0.1" min="1" max="100" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          <p class="text-[10px] text-amber-500/80 mt-1">
            你的进价是平台基础价的 <b>2 倍</b>左右，所以<b>低于 2 倍就是亏本卖，系统会直接拦住</b>。开站后用 3 倍：客户付 3 份，你付 2 份，每单赚 1 份。
          </p>
        </div>
        <button @click="createSite()" :disabled="creating" class="w-full py-2.5 rounded-xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 disabled:opacity-50">
          {{ creating ? '开通中…' : '立即开通' }}
        </button>
        <p class="text-[11px] text-slate-500 leading-relaxed">
          开通后你的分站靠预存余额自动发货：客户下单 → 扣客户余额 + 按你的你的成本价扣你的余额，
          差额就是你的利润。余额不足会自动拒单，不会产生欠款。
        </p>
      </div>
    </div>

    <!-- 已有分站 -->
    <div v-else class="space-y-5">
      <!-- 🚦 开站清单：新手不知道"开完站还差什么"，这里直接告诉他 -->
      <section v-if="pendingSteps.length" class="bg-gradient-to-br from-amber-500/10 to-slate-900/70 border border-amber-500/30 rounded-2xl p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-bold text-sm text-amber-300">开站清单（还差 {{ pendingSteps.length }} 步才建议开卖）</h2>
          <span class="text-[11px] text-amber-400/80">{{ doneSteps.length }} / {{ steps.length }} 已完成</span>
        </div>
        <ul class="space-y-2">
          <li v-for="s in steps" :key="s.key" class="flex items-start gap-2 text-xs">
            <span class="mt-[1px]">{{ s.done ? '✅' : '⬜' }}</span>
            <div>
              <span :class="s.done ? 'text-slate-500 line-through' : 'text-slate-200 font-bold'">{{ s.title }}</span>
              <span v-if="!s.done" class="block text-[11px] text-slate-500 mt-0.5">{{ s.hint }}</span>
            </div>
          </li>
        </ul>
        <p class="text-[10px] text-slate-500 mt-3">清单只是提醒，不拦着你开卖。但「收款」没配，客户充不了值；「发信」没配，客户收到的邮件会从平台邮箱发出（个别情况下甚至发不出去）。</p>
      </section>

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
            <!-- 下限不是 1：低于「你的进价」等于每单倒贴，祥哥 2026-10-25 定调保留这条底线 -->
            <label class="block text-xs text-slate-400 mb-1">倍率（{{ minMul }}~100）</label>
            <input v-model.number="form.multiplier" type="number" step="0.1" :min="minMul" max="100" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            <p class="text-[10px] text-slate-500 mt-1">低于 {{ minMul }} 倍就亏本了，系统不让填。3 倍 = 客户看到的价格是基础价的 3 倍。</p>
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
      <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
        <h2 class="font-bold text-sm text-amber-400 mb-3">外观模板</h2>

        <!-- 🎨 三十三期：一键风格预设。
             站长不需要懂 6 个旋钮怎么配 —— 先挑一套整体风格，
             不满意再用下面的旋钮微调。每个预设都是一套调好的组合。 -->
        <div class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-slate-400">一键风格（先挑一套，再微调）</label>
            <span class="text-[10px] text-slate-600">点一下整套生效</span>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
            <button v-for="p in presets" :key="p.key" @click="applyPreset(p)"
              class="text-left px-3 py-2 rounded-lg border transition hover:border-amber-400/60"
              :class="activePreset === p.key ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 bg-slate-950/40'">
              <div class="flex items-center gap-1.5 mb-0.5">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: p.colorHex }"></span>
                <span class="text-xs font-bold text-white">{{ p.name }}</span>
              </div>
              <div class="text-[10px] text-slate-500 leading-tight">{{ p.desc }}</div>
            </button>
          </div>
        </div>

        <div class="grid lg:grid-cols-2 gap-5">
          <!-- 左：选择器 -->
          <div class="space-y-3">
            <div>
              <label class="block text-xs text-slate-400 mb-2">模板</label>
              <div class="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-3 gap-2">
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
                  <button @click="moveModule(i, -1)" :disabled="i === 0" title="上移" class="w-9 h-9 md:w-7 md:h-7 grid place-items-center rounded-lg bg-slate-800/70 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800/70">↑</button>
                  <button @click="moveModule(i, 1)" :disabled="i === form.modules.length - 1" title="下移" class="w-9 h-9 md:w-7 md:h-7 grid place-items-center rounded-lg bg-slate-800/70 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800/70">↓</button>
                </div>
              </div>
            </div>

            <!-- 🎨 二十七期：风格细分（模板只能整体换，这些可以自由叠加） -->
            <div class="pt-3 border-t border-slate-700/50">
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs text-slate-400">细节风格（可自由叠加在模板之上）</label>
                <button @click="resetStyles()" class="text-[10px] text-slate-500 hover:text-amber-400">跟随模板</button>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] text-slate-500 mb-1">圆角</label>
                  <select v-model="form.ui_radius" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">
                    <option value="">跟随模板</option>
                    <option value="square">直角（硬朗）</option>
                    <option value="soft">小圆角（干净）</option>
                    <option value="round">大圆角（柔和）</option>
                    <option value="pill">胶囊（可爱）</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] text-slate-500 mb-1">页面节奏</label>
                  <select v-model="form.ui_density" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">
                    <option value="">跟随模板</option>
                    <option value="compact">紧凑（信息多）</option>
                    <option value="normal">标准</option>
                    <option value="relaxed">宽松（高级感）</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] text-slate-500 mb-1">卡片质感</label>
                  <select v-model="form.card_style" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">
                    <option value="">跟随模板</option>
                    <option value="outline">描边（极简）</option>
                    <option value="glass">毛玻璃（通透）</option>
                    <option value="solid">实心（厚实）</option>
                  </select>
                </div>

              <!-- 71期：背景与字号（站长不动代码也要能改；与首页悬浮编辑器同一套选项）-->
              <div class="col-span-2 mt-1">
                <label class="block text-[10px] text-slate-500 mb-1">页面背景</label>
                <div class="flex flex-wrap gap-2">
                  <button v-for="b in BG_PRESETS" :key="b.key" type="button"
                    class="w-9 h-9 rounded-lg border-2 transition"
                    :class="form.bg_color === b.key ? 'border-amber-400 scale-110' : 'border-slate-700'"
                    :style="{ background: b.css }" :title="b.name"
                    @click="form.bg_color = b.key"></button>
                </div>
                <div class="flex flex-wrap items-center gap-2 mt-2">
                  <button type="button" class="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-amber-400"
                    :disabled="uploading === 'bg_image'" @click="pickImage('bg_image')">
                    {{ uploading === 'bg_image' ? '上传中…' : '上传自己的背景图' }}
                  </button>
                  <button v-if="form.bg_image" type="button" class="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400"
                    @click="form.bg_image = ''">去掉背景图</button>
                  <span v-if="form.bg_image" class="text-[10px] text-emerald-400">已选背景图（选纯色会让图片失效）</span>
                </div>
              </div>

              <div class="col-span-2">
                <label class="block text-[10px] text-slate-500 mb-1">字号</label>
                <div class="flex gap-2">
                  <button v-for="f in FONT_SCALES" :key="f.key" type="button"
                    class="flex-1 py-1.5 rounded-lg text-xs border transition"
                    :class="(form.font_scale || 'md') === f.key ? 'bg-amber-400 text-slate-900 border-amber-400 font-bold' : 'bg-slate-950 border-slate-700 text-slate-400'"
                    @click="form.font_scale = f.key">{{ f.name }}</button>
                </div>
                <p class="text-[10px] text-slate-600 mt-1">字小一点能多放信息；字大一点更好读。</p>
              </div>
                <div>
                  <label class="block text-[10px] text-slate-500 mb-1">字体</label>
                  <select v-model="form.font_style" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">
                    <option value="">跟随模板</option>
                    <option value="sans">现代无衬线</option>
                    <option value="rounded">圆润</option>
                    <option value="serif">衬线（杂志感）</option>
                    <option value="mono">等宽（科技感）</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] text-slate-500 mb-1">按钮形状</label>
                  <select v-model="form.btn_shape" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">
                    <option value="">跟随模板</option>
                    <option value="pill">胶囊</option>
                    <option value="rounded">圆角</option>
                    <option value="square">方角</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] text-slate-500 mb-1">首屏布局</label>
                  <select v-model="form.hero_layout" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">
                    <option value="">居中式（默认）</option>
                    <option value="split">左文右图</option>
                    <option value="banner">整屏大图</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- ══════════════════════════════════════════════════════════
               🎨 全方位 DIY（四十一期）
               祥哥："需要站长能全方位 DIY 自己的网站"
               上面的旋钮只改颜色/圆角；这一块改的是**版式结构**与**每一块的字**。
               ══════════════════════════════════════════════════════════ -->
          <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 mt-4">
            <div class="flex items-center justify-between mb-3">
              <h2 class="font-bold text-sm text-amber-400">🎨 版式与文案（自己排版）</h2>
              <span class="text-[10px] text-slate-500">留空 = 用模板默认</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label class="block text-[10px] text-slate-500 mb-1">首屏版式（结构不同，不只是换色）</label>
                <select v-model="form.hero_variant" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">
                  <option value="">跟随模板（推荐）</option>
                  <option value="center">居中大标题 · 电商落地页</option>
                  <option value="split">左文右价卡 · SaaS 产品页</option>
                  <option value="editorial">杂志排版 · 左对齐 + 首字下沉</option>
                  <option value="terminal">终端窗口 · 极客工具感</option>
                </select>
                <p v-if="form.hero_variant || form.services_variant" class="mt-1 text-[10px] text-amber-400/90 leading-relaxed">
                  ⚠️ 你选了具体版式，上面 6 套模板的版式都会被它盖掉（只剩配色不同）。想用模板自带的版式，把这两项都选回「跟随模板」。
                </p>
              </div>
              <div>
                <label class="block text-[10px] text-slate-500 mb-1">服务列表版式</label>
                <select v-model="form.services_variant" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">
                  <option value="">跟随模板</option>
                  <option value="cards">卡片网格</option>
                  <option value="table">价格表 · 一行一个服务</option>
                  <option value="ranked">编号榜单 · 杂志感</option>
                </select>
              </div>
            </div>

            <label class="block text-[10px] text-slate-500 mb-2">每个区块的标题 / 副标题（不改就用默认）</label>
            <div class="space-y-2 mb-4">
              <div v-for="sec in SECTION_KEYS" :key="sec.key" class="grid grid-cols-[80px_1fr_1fr] items-center gap-2">
                <span class="text-[10px] text-slate-500">{{ sec.label }}</span>
                <input v-model="form.section_titles[sec.key].title" :placeholder="sec.phTitle"
                  class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs" />
                <input v-model="form.section_titles[sec.key].sub" :placeholder="sec.phSub"
                  class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs" />
              </div>
            </div>

            <label class="block text-[10px] text-slate-500 mb-2">
              「优势」三张卡片的内容（图标 + 标题 + 说明；留空用系统默认文案）
            </label>
            <div class="space-y-2 mb-4">
              <div v-for="(a, i) in form.advantages" :key="'adv' + i" class="grid grid-cols-[46px_1fr] gap-2 items-start">
                <input v-model="a.icon" maxlength="4" :placeholder="['⚡','💎','🔒'][i]"
                  class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-sm" />
                <div class="space-y-1.5">
                  <input v-model="a.title" maxlength="30" :placeholder="['秒级自动交付','超值价格','安全无需密码'][i]"
                    class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs" />
                  <input v-model="a.body" maxlength="80"
                    :placeholder="['系统全自动对接，下单即处理。','价格以下单页为准，透明可查。','只需目标链接，无需账号密码。'][i]"
                    class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs" />
                </div>
              </div>
              <p class="text-[10px] text-slate-600">图标最多 2 个字符（emoji 即可），标题最多 30 字，说明最多 80 字。</p>
            </div>

            <div class="mb-3">
              <label class="block text-[10px] text-slate-500 mb-1">
                <span>站点图标（浏览器标签上的小图标）</span>
                <button type="button" @click="pickImage('favicon_url')" :disabled="uploading"
                  class="ml-2 text-[10px] px-2 py-1 rounded border border-amber-400/40 text-amber-300 hover:bg-amber-400/10">
                  {{ uploading === 'favicon_url' ? '上传中…' : '📤 上传图标' }}
                </button>
              </label>
              <input v-model="form.favicon_url" placeholder="留空则用默认图标"
                class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs" />
            </div>

            <div>
              <label class="block text-[10px] text-slate-500 mb-1">自定义 CSS（高级：能改任何细节，最多 8000 字符）</label>
              <textarea v-model="form.custom_css" rows="5" spellcheck="false"
                placeholder="例如：&#10;.site-card { border-radius: 0; }&#10;h1 { letter-spacing: -0.02em; }"
                class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed"></textarea>
              <p class="mt-1 text-[10px] text-slate-600">只影响你自己的分站。为安全起见，@import 与尖括号会被自动过滤。</p>
            </div>
          </section>

          <!-- 右：实时预览 -->
          <div class="lg:sticky lg:top-4 self-start">
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs text-slate-400">效果预览（点了就变，不用保存）</label>
              <span class="text-[10px] text-slate-600">近似效果</span>
            </div>

            <div :style="previewShell"
              class="rounded-xl overflow-hidden border border-slate-700/60 shadow-lg">
              <!-- 顶部导航 -->
              <div :style="previewNav" class="flex items-center justify-between px-3 py-2">
                <span :style="{ color: pv.brand, fontWeight: 800, fontSize: '11px', fontFamily: pv.titleFont }">{{ form.name || '你的站点名' }}</span>                <div class="flex gap-2">
                  <span v-for="n in ['服务', '充值', '我的']" :key="n" :style="{ color: 'rgba(226,232,240,.55)', fontSize: '9px' }">{{ n }}</span>
                </div>
              </div>

              <!-- Hero -->
              <div class="px-3 pt-3 pb-2">
                <div :style="{ color: '#f8fafc', fontSize: '15px', fontWeight: 900, lineHeight: 1.25, fontFamily: pv.titleFont }">
                  {{ form.hero_title || form.name || '你的站点名' }}
                </div>
                <div :style="{ color: 'rgba(148,163,184,.9)', fontSize: '9px', marginTop: '3px' }">
                  {{ form.hero_subtitle || '全自动数字营销 · 秒级交付' }}
                </div>
                <div class="flex gap-1.5 mt-2">
                  <span :style="previewBtnPrimary">{{ form.hero_btn1_text || '立即下单' }}</span>
                  <span :style="previewBtnGhost">{{ form.hero_btn2_text || '查看价格' }}</span>
                </div>
              </div>

              <!-- 模块（跟随开关与排序） -->
              <div class="px-3 pb-2 space-y-1.5">
                <div v-for="m in previewModules" :key="m.key" :style="previewCard" class="px-2 py-1.5">
                  <div class="flex items-center justify-between">
                    <span :style="{ color: '#e2e8f0', fontSize: '9px', fontWeight: 700, fontFamily: pv.titleFont }">{{ moduleLabel(m.key) }}</span>
                    <span v-if="m.key === 'hot_services'" :style="{ color: pv.brand, fontSize: '9px', fontWeight: 700 }">¥{{ samplePrice }}/千</span>
                  </div>
                  <div v-if="m.key === 'stats'" class="flex gap-2 mt-1">
                    <span v-for="s in ['2839 服务', '12.4k 订单', '99.2% 完成']" :key="s"
                      :style="{ color: 'rgba(148,163,184,.85)', fontSize: '8px' }">{{ s }}</span>
                  </div>
                  <div v-else-if="m.key === 'hot_services'" class="mt-1 space-y-1">
                    <div v-for="(sv, i) in ['TikTok 涨粉', 'Telegram 成员', '网页流量']" :key="i"
                      class="flex items-center justify-between">
                      <span :style="{ color: 'rgba(203,213,225,.9)', fontSize: '8px' }">{{ sv }}</span>
                      <span :style="{ color: 'rgba(148,163,184,.8)', fontSize: '8px' }">下单</span>
                    </div>
                  </div>
                  <div v-else :style="{ color: 'rgba(148,163,184,.6)', fontSize: '8px', marginTop: '2px' }">
                    {{ moduleHint(m.key) }}
                  </div>
                </div>
                <div v-if="!previewModules.length" :style="{ color: 'rgba(148,163,184,.6)', fontSize: '9px' }" class="py-2 text-center">
                  首页模块全部关闭了，只剩导航和 Hero
                </div>
              </div>

              <!-- 页脚 -->
              <div :style="previewFooter" class="px-3 py-1.5 text-center">
                <span :style="{ color: 'rgba(148,163,184,.75)', fontSize: '8px' }">
                  {{ form.footer_text || `© ${new Date().getFullYear()} ${form.name || '你的站点名'}` }}
                </span>
              </div>
            </div>

            <p class="text-[10px] text-slate-500 mt-2 leading-relaxed">
              这是近似预览（配色/圆角/阴影/字体/模块顺序与实际一致，真实页面还有动画与真实数据）。
              保存后打开你的站，看到的就是最终效果。
            </p>
            <a v-if="site && site.domain" :href="`//${site.domain}`" target="_blank"
              class="inline-block mt-1 text-[11px] text-sky-400 hover:text-sky-300">
              保存后点这里打开真实站点 ↗
            </a>
          </div>
        </div>
      </section>

      <!-- ✍️ 首页文案：模板决定"骨架"，这里决定"上面写什么话" -->
      <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-bold text-sm text-amber-400">首页文案（把话换成你自己的）</h2>
            <p class="text-[11px] text-slate-500 mt-1">
              上面选的是「长什么样」，这里写的是「说什么话」。留空就用系统默认文案 —— 但默认文案和主站一样，客户一眼能认出来。
            </p>
          </div>
          <button @click="fillHeroDemo" class="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px]">
            用示例文案填满
          </button>
        </div>
        <div class="grid md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">顶部小标签</label>
            <input v-model="form.hero_badge" maxlength="120" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="🚀 全网最低价涨粉平台" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">大标题（显眼那一行）</label>
            <input v-model="form.hero_title" maxlength="120" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="涨粉就找我们" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs text-slate-400 mb-1">副标题</label>
            <input v-model="form.hero_subtitle" maxlength="255" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="TikTok / IG / YouTube 全平台涨粉，秒级交付" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs text-slate-400 mb-1">灰色小字说明</label>
            <input v-model="form.hero_desc" maxlength="255" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="支持微信 / 支付宝 / USDT 充值，注册即用" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">主按钮文字</label>
            <input v-model="form.hero_btn1_text" maxlength="40" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="⚡ 立即注册" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">主按钮链接</label>
            <input v-model="form.hero_btn1_url" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="/login（留空默认注册页）" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">次按钮文字</label>
            <input v-model="form.hero_btn2_text" maxlength="40" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="💬 联系客服" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">次按钮链接</label>
            <input v-model="form.hero_btn2_url" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="https://t.me/你的客服" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs text-slate-400 mb-1 flex items-center justify-between">
              <span>Logo 图片</span>
              <button type="button" @click="pickImage('logo')" :disabled="uploading"
                class="text-[10px] px-2 py-1 rounded border border-amber-400/40 text-amber-300 hover:bg-amber-400/10">
                {{ uploading === 'logo' ? '上传中…' : '📤 上传图片' }}
              </button>
            </label>
            <input v-model="form.logo" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="/logo.png 或 https://你的图床/logo.png" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs text-slate-400 mb-1 flex items-center justify-between">
              <span>首页背景图（可选）</span>
              <button type="button" @click="pickImage('hero_bg_url')" :disabled="uploading"
                class="text-[10px] px-2 py-1 rounded border border-amber-400/40 text-amber-300 hover:bg-amber-400/10">
                {{ uploading === 'hero_bg_url' ? '上传中…' : '📤 上传图片' }}
              </button>
            </label>
            <input v-model="form.hero_bg_url" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="留空用模板自带背景" />
          </div>
        </div>
        <p class="text-[10px] text-slate-500">链接只能填 http(s):// 开头的地址或站内路径（如 /login）。图片建议 1600×900 以内，纯色或暗色背景更耐看。</p>
      </section>

      <!-- 收款 -->
      <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 class="font-bold text-sm text-amber-400">收款商户（钱直接进你的账户）</h2>
        <p class="text-[11px] text-slate-500 leading-relaxed">
          填你自己的 BufPay / Cryptomus 商户，客户在你站上付款时直接进你的账号。
          不填的话**客户点充值会看到「暂未开通」**，只能由你手动给他加余额（兜底方式，不推荐长期这样）。
        </p>
        <div class="grid md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">BufPay 商户 ID</label>
            <input v-model="form.bufpay_id" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="选填" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">BufPay 密钥</label>
            <div class="relative">
            <input v-model="form.bufpay_key" :type="pwdShow.bufpay_key ? 'text' : 'password'" class="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-sm" placeholder="留空/****** 表示不修改" />
            <button type="button" @click="pwdShow.bufpay_key = !pwdShow.bufpay_key" :title="pwdShow.bufpay_key ? '隐藏' : '显示'" class="absolute inset-y-0 right-0 w-9 grid place-items-center text-slate-400 hover:text-amber-400 transition">
              <svg v-if="!pwdShow.bufpay_key" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 012.665-3.943m3.19-2.314A9.96 9.96 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.03 10.03 0 01-4.293 5.5M3 3l18 18"/></svg>
            </button>
          </div>
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Cryptomus 商户 UUID</label>
            <input v-model="form.cryptomus_id" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="选填" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Cryptomus API Key</label>
            <div class="relative">
            <input v-model="form.cryptomus_key" :type="pwdShow.cryptomus_key ? 'text' : 'password'" class="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-sm" placeholder="留空/****** 表示不修改" />
            <button type="button" @click="pwdShow.cryptomus_key = !pwdShow.cryptomus_key" :title="pwdShow.cryptomus_key ? '隐藏' : '显示'" class="absolute inset-y-0 right-0 w-9 grid place-items-center text-slate-400 hover:text-amber-400 transition">
              <svg v-if="!pwdShow.cryptomus_key" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 012.665-3.943m3.19-2.314A9.96 9.96 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.03 10.03 0 01-4.293 5.5M3 3l18 18"/></svg>
            </button>
          </div>
          </div>
        </div>
      </section>

      <!-- 邮件 -->
      <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 class="font-bold text-sm text-amber-400">发信邮箱（客户收到的验证码用你的品牌）</h2>
        <p class="text-[11px] text-slate-500">不填也能用：邮件标题、正文和署名仍然是你的品牌，但<b class="text-amber-400">发件地址会是平台的邮箱</b>，客户点开「显示详情」能看到平台域名。想让客户完全看不到平台，就用自己域名注册一个邮箱填进来（QQ 邮箱、企业邮箱都行，两分钟）。</p>
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
            <div class="relative">
            <input v-model="form.smtp_pass" :type="pwdShow.smtp_pass ? 'text' : 'password'" class="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-sm" placeholder="留空/****** 表示不修改" />
            <button type="button" @click="pwdShow.smtp_pass = !pwdShow.smtp_pass" :title="pwdShow.smtp_pass ? '隐藏' : '显示'" class="absolute inset-y-0 right-0 w-9 grid place-items-center text-slate-400 hover:text-amber-400 transition">
              <svg v-if="!pwdShow.smtp_pass" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 012.665-3.943m3.19-2.314A9.96 9.96 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.03 10.03 0 01-4.293 5.5M3 3l18 18"/></svg>
            </button>
          </div>
          </div>
        </div>
        <div class="pt-1 space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <input v-model="smtpTestTo" class="flex-1 min-w-[180px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="收测试信的邮箱（留空发给你的注册邮箱）" />
            <button @click="testSmtp" :disabled="smtpTesting"
              class="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold">
              {{ smtpTesting ? '发送中…' : '发一封测试信' }}
            </button>
          </div>
          <p v-if="smtpTestMsg" class="text-[11px]" :class="smtpTestOk ? 'text-emerald-400' : 'text-rose-400'">{{ smtpTestMsg }}</p>
          <p class="text-[11px] text-amber-500/80">⚠️ 一定要先测通再开卖：配错了客户注册收不到验证码，生意做不成。测试信只走你自己的邮箱，不经过平台。</p>
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
          <!-- 🔐 证书状态：站长最关心的是"客户浏览器会不会报警告" -->
          <span v-if="site.cert_mode === 'letsencrypt'" class="ml-2 text-emerald-400">证书：正式 ✅</span>
          <span v-else-if="site.cert_mode === 'selfsigned'" class="ml-2 text-amber-400">证书：临时（客户可能看到不安全提示）</span>
        </p>

        <!-- 🧭 六十五期：把"绑域名"这件小事拆成小白看得懂的三步（原来只有一个输入框）-->
        <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
          <p class="text-slate-300 font-bold">想用自己的域名（比如 shop.你的品牌.com）？三步：</p>
          <p>① 去你买域名的地方（阿里云 / 腾讯云 / Cloudflare 都行），加一条 <b class="text-amber-300">A 记录</b>，
             指向 <b class="text-amber-300">{{ site.dns_target_ip || '平台给你的服务器地址（问一下平台）' }}</b></p>
          <p>② 等几分钟（DNS 生效），在下面填域名点「绑定并开通」</p>
          <p>③ 如果这里显示的是「临时证书」，过 10 分钟点一次下面的「修复域名」，就会换成正式证书</p>
          <p class="text-slate-500">用平台送的免费子域名（现在这个地址）就不用管这些，已经能直接卖。</p>
        </div>

        <div class="flex gap-2">
          <input v-model="bindDomain" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="绑定你自己的域名，如 shop.你的品牌.com" />
          <button @click="bindOwnDomain()" :disabled="binding" class="px-4 py-2 rounded-lg text-sm font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-50">
            {{ binding ? '验证中…' : '绑定并开通' }}
          </button>
          <button v-if="site.custom_domain" @click="republishDomain()" :disabled="publishing"
                  class="px-4 py-2 rounded-lg text-sm font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap">
            {{ publishing ? '修复中…' : '修复域名' }}
          </button>
        </div>
        <div v-if="domainHint" class="bg-amber-400/10 border border-amber-500/30 rounded-lg p-3 text-[11px] text-amber-200 whitespace-pre-wrap">{{ domainHint }}</div>
      </section>

      <!-- 明细 -->
      <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-sm text-amber-400">经营明细</h2>
          <div class="flex gap-2">
            <button @click="loadOrders()" :class="tab === 'orders' ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-300'" class="px-3 py-1 text-xs rounded-lg font-bold">订单 {{ orderTotal }}</button>
            <button @click="loadCustomers()" :class="tab === 'customers' ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-300'" class="px-3 py-1 text-xs rounded-lg font-bold">客户 {{ customerTotal }}</button>
          </div>
        </div>

        <div v-if="tab === 'orders'">
          <div v-if="orders.length === 0" class="text-center py-6 text-xs text-slate-500">还没有订单</div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead class="text-slate-500 border-b border-slate-800">
                <tr><th class="text-left py-2">订单号</th><th class="text-left">服务</th><th class="text-right">数量</th><th class="text-right">客户付</th><th class="text-right">你赚</th><th class="text-right">状态</th></tr>
              </thead>
              <tbody>
                <tr v-for="o in orders" :key="o.id" class="border-b border-slate-800/50">
                  <td class="py-2 text-slate-400">{{ String(o.order_no).slice(-8) }}</td>
                  <td class="text-slate-300 max-w-[180px] truncate" :title="o.service_name">{{ (o.service_name || ('#' + o.service_id)).slice(0, 26) }}</td>
                  <td class="text-right text-slate-400">{{ o.quantity }}</td>
                  <td class="text-right text-slate-200">¥{{ o.charge }}</td>
                  <td class="text-right" :class="parseFloat(o.profit) > 0 ? 'text-emerald-400' : 'text-slate-500'">¥{{ o.profit }}</td>
                  <td class="text-right text-slate-400">{{ o.status }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button v-if="orders.length < orderTotal" @click="loadMoreOrders()" class="w-full mt-2 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700">加载更多</button>
        </div>

        <div v-else>
          <div v-if="customers.length === 0" class="text-center py-6 text-xs text-slate-500">还没有客户</div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead class="text-slate-500 border-b border-slate-800">
                <tr><th class="text-left py-2">账号</th><th class="text-right">余额</th><th class="text-right">订单数</th><th class="text-right">累计消费</th><th class="text-right">注册时间</th></tr>
              </thead>
              <tbody>
                <tr v-for="c in customers" :key="c.id" class="border-b border-slate-800/50">
                  <td class="py-2 text-slate-300">{{ c.phone || c.email || ('#' + c.id) }}</td>
                  <td class="text-right text-slate-200">¥{{ c.balance }}</td>
                  <td class="text-right text-slate-400">{{ c.orders }}</td>
                  <td class="text-right text-emerald-400">¥{{ c.spent }}</td>
                  <td class="text-right text-slate-500">{{ String(c.joined || '').slice(0, 10) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button v-if="customers.length < customerTotal" @click="loadMoreCustomers()" class="w-full mt-2 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700">加载更多</button>
        </div>
        <p class="text-[10px] text-slate-600">手机号/邮箱已脱敏；「你赚」= 客户付款 − 你的成本</p>
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
import { useAppStore } from '../stores/app'

const userStore = useUserStore()
const appStore = useAppStore()
const loading = ref(true)
const saving = ref(false)
const creating = ref(false)
const binding = ref(false)
const site = ref(null)
const stats = ref({})
const bindDomain = ref('')
const domainHint = ref('')
const publishing = ref(false)
const tab = ref('orders')
const orders = ref([])
const orderTotal = ref(0)
const customers = ref([])
const customerTotal = ref(0)
const PAGE = 30
const smtpTestTo = ref('')
const smtpTesting = ref(false)
const smtpTestMsg = ref('')
const smtpTestOk = ref(false)

// 🚦 开站清单：把"开完站还差什么"算出来，别让新手盯着 6 个表单猜
const minMul = computed(() => {
  const m = parseFloat(site.value?.min_multiplier)
  return isFinite(m) && m > 0 ? m : 1
})
const steps = computed(() => {
  const s = site.value || {}
  const mul = parseFloat(s.multiplier)
  return [
    {
      key: 'price',
      title: `设置售价（不低于 ${minMul.value} 倍才不亏）`,
      done: isFinite(mul) && mul >= minMul.value,
      hint: `现在是 ${isFinite(mul) ? mul : '未设置'} 倍。低于 ${minMul.value} 倍等于亏本卖。`
    },
    {
      key: 'pay',
      title: '配置收款商户（客户才能在线充值）',
      done: !!(s.bufpay_id && s.bufpay_key) || !!(s.cryptomus_id && s.cryptomus_key),
      hint: '没配的话客户点充值会看到「暂未开通」，只能靠你手动给他加余额。'
    },
    {
      key: 'smtp',
      title: '配置发信邮箱（客户注册要收验证码）',
      done: !!(s.smtp_host && s.smtp_user && s.smtp_pass),
      hint: '没配的话客户注册不了。填完记得点「发一封测试信」。'
    },
    {
      key: 'look',
      title: '换成你自己的样子（模板 + 色系 + 页脚）',
      done: (s.template && s.template !== 'classic') || (s.color && s.color !== 'cyan') || !!s.footer_text,
      hint: '默认样式和主站相近，换成自己的模板客户才看不出是同一家。'
    },
    {
      key: 'copy',
      title: '写自己的首页文案（标题/副标题/按钮）',
      done: !!(s.hero_title || s.hero_subtitle),
      hint: '模板决定长什么样，文案决定说什么话。默认文案和主站一模一样。'
    },
    {
      key: 'domain',
      title: '绑定自己的域名（可选，显得更专业）',
      done: !!(s.custom_domain && s.domain_status === 'active'),
      hint: '不绑也能用免费子域名，不影响收款。'
    }
  ]
})
const doneSteps = computed(() => steps.value.filter(x => x.done))
const pendingSteps = computed(() => steps.value.filter(x => !x.done))

// ============================================================================
// 外观实时预览
// 令牌值与 styles/site-theme.css 保持一致，否则"预览"和"真实页面"会对不上，
// 站长按预览做的决定到了真站上就变样了 —— 那比没有预览更糟。
// ============================================================================
const PV_COLORS = {
  cyan:   { brand: '#22d3ee', strong: '#06b6d4', soft: 'rgba(34,211,238,.18)' },
  purple: { brand: '#a855f7', strong: '#9333ea', soft: 'rgba(168,85,247,.18)' },
  green:  { brand: '#22c55e', strong: '#16a34a', soft: 'rgba(34,197,94,.18)' },
  red:    { brand: '#ef4444', strong: '#dc2626', soft: 'rgba(239,68,68,.18)' },
  orange: { brand: '#f97316', strong: '#ea580c', soft: 'rgba(249,115,22,.18)' },
  blue:   { brand: '#3b82f6', strong: '#2563eb', soft: 'rgba(59,130,246,.18)' }
}

const pv = computed(() => {
  const t = form.value.template || 'classic'
  const c = PV_COLORS[form.value.color] || PV_COLORS.cyan
  // 自定义主色：把 #rrggbb 转成同样的三件套
  let brand = c.brand, strong = c.strong, soft = c.soft
  const hex = String(form.value.accent || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    brand = hex
    strong = hex
    soft = hex + '2e'   // 18% 透明近似
  }
    const base = { brand, strong, soft }
  // 🎨 二十七期：站长选的细节风格优先于模板默认值（预览必须跟着变）
  const RADII = { square: '0.25rem', soft: '0.75rem', round: '1.25rem', pill: '2rem' }
  const FONTS = {
    sans: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
    rounded: '"SF Pro Rounded", "PingFang SC", system-ui, sans-serif',
    serif: 'Georgia, "Songti SC", "Times New Roman", serif',
    mono: '"JetBrains Mono", Consolas, monospace'
  }
  const CARDS = { outline: 'transparent', glass: 'rgba(255,255,255,.06)', solid: 'rgba(15,23,42,.92)' }
  const out = (() => { switch (t) {
    case 'saas': return { ...base, radius: '0.5rem', surface: 'rgba(15,23,42,.55)', border: 'rgba(148,163,184,.12)', shadow: '0 6px 18px rgba(0,0,0,.35)', letter: '0.02em', titleFont: 'inherit', bg: '#0a1120' }
    case 'minimal': return { ...base, radius: '0.75rem', surface: 'rgba(2,6,23,.6)', border: 'rgba(148,163,184,.1)', shadow: 'none', letter: '0.03em', titleFont: 'inherit', bg: '#04070f' }
    case 'neon': return { ...base, radius: '1.25rem', surface: 'rgba(15,23,42,.78)', border: 'rgba(148,163,184,.3)', shadow: `0 0 40px ${soft}`, letter: '0', titleFont: 'inherit', bg: `radial-gradient(320px 160px at 16% -10%, ${soft}, transparent 60%), radial-gradient(260px 140px at 90% 0%, rgba(147,51,234,.16), transparent 60%), #060b18` }
    case 'magazine': return { ...base, radius: '1.1rem', surface: 'rgba(17,24,39,.8)', border: 'rgba(148,163,184,.18)', shadow: '0 22px 60px rgba(0,0,0,.55)', letter: '0.06em', titleFont: 'Georgia, "Times New Roman", "Songti SC", serif', bg: '#0d1117' }
    case 'glass': return { ...base, radius: '1.6rem', surface: 'rgba(255,255,255,.06)', border: 'rgba(255,255,255,.16)', shadow: '0 24px 60px rgba(0,0,0,.5)', letter: '0', titleFont: 'inherit', bg: `radial-gradient(300px 160px at 8% -8%, ${soft}, transparent 55%), radial-gradient(280px 140px at 95% 8%, rgba(56,189,248,.14), transparent 55%), #070d1a` }
    default: return { ...base, radius: '1rem', surface: 'rgba(15,23,42,.72)', border: 'rgba(148,163,184,.18)', shadow: '0 18px 45px rgba(0,0,0,.45)', letter: '0', titleFont: 'inherit', bg: '#0b1220' }
  } })()
  // 细节风格覆盖模板默认值（预览必须跟着站长点的那一下就变）
  if (form.value.ui_radius && RADII[form.value.ui_radius]) out.radius = RADII[form.value.ui_radius]
  if (form.value.card_style && CARDS[form.value.card_style] !== undefined) out.surface = CARDS[form.value.card_style]
  out.font = FONTS[form.value.font_style] || 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
  out.btnRadius = form.value.btn_shape === 'pill' ? '999px'
    : form.value.btn_shape === 'square' ? '0.25rem'
    : `calc(${out.radius} * 0.6)`
  out.gap = form.value.ui_density === 'compact' ? '6px' : form.value.ui_density === 'relaxed' ? '15px' : '10px'
  return out
})

const previewShell = computed(() => ({
  background: pv.value.bg,
  fontFamily: pv.value.font,
  letterSpacing: pv.value.letter
}))
const previewNav = computed(() => ({
  background: 'rgba(2,6,23,.45)',
  borderBottom: `1px solid ${pv.value.border}`
}))
const previewCard = computed(() => ({
  background: pv.value.surface,
  border: `1px solid ${pv.value.border}`,
  borderRadius: pv.value.radius,
  boxShadow: pv.value.shadow,
  backdropFilter: (form.value.template === 'glass' || form.value.card_style === 'glass') ? 'blur(6px)' : undefined
}))
const previewBtnPrimary = computed(() => ({
  background: `linear-gradient(135deg, ${pv.value.brand}, ${pv.value.strong})`,
  color: '#0b1220',
  fontSize: '9px',
  fontWeight: 800,
  padding: '3px 9px',
  borderRadius: pv.value.btnRadius,
  boxShadow: `0 0 12px ${pv.value.soft}`
}))
const previewBtnGhost = computed(() => ({
  border: `1px solid ${pv.value.border}`,
  color: 'rgba(226,232,240,.8)',
  fontSize: '9px',
  padding: '3px 9px',
  borderRadius: pv.value.btnRadius
}))
const previewFooter = computed(() => ({ borderTop: `1px solid ${pv.value.border}` }))

// 预览里只显示"已启用"的模块，顺序与勾选顺序一致 —— 这才叫预览
const previewModules = computed(() => (form.value.modules || []).filter(m => m.enabled).slice(0, 4))

const hotPrice = ref('')
const samplePrice = computed(() => hotPrice.value || '—')
const loadHotPrice = async () => {
  try {
    const res = await fetch('/api/public/hot-services')
    const data = await res.json()
    const list = data.data || []
    if (list.length && list[0].pricePerK) hotPrice.value = list[0].pricePerK
  } catch (e) {}
}

const moduleHint = (key) => ({
  announce: '一条滚动公告，比如「新用户首单 9 折」',
  stats: '服务数 / 订单数 / 完成率，增加信任感',
  hot_services: '把卖得最好的服务摆在首页',
  faq: '4 条常见问题，减少客户来问',
  vip: 'VIP 会员入口与折扣说明',
  affiliate: '邀请好友返佣，让客户帮你拉客户'
}[key] || '首页模块')

// 一键填入示例文案：降低"不知道怎么下笔"的门槛（之后他改字即可）
const fillHeroDemo = () => {
  const n = form.value.name || '我们的站'
  form.value.hero_badge = '🚀 全平台涨粉 · 秒级交付'
  form.value.hero_title = `${n}，涨粉不用等`
  form.value.hero_subtitle = 'TikTok / IG / YouTube / Telegram 全平台增长，下单即开始'
  form.value.hero_desc = '支持微信 / 支付宝 / USDT 充值 · 无需账号密码 · 注册即用'
  form.value.hero_btn1_text = '⚡ 立即注册'
  form.value.hero_btn2_text = '💬 联系客服'
}

const testSmtp = async () => {
  if (!site.value) return
  smtpTesting.value = true
  smtpTestMsg.value = ''
  try {
    // 先把当前表单存下来，否则测的是上一次保存的旧配置
    await save(true)
    const res = await fetch(`/api/sites/${site.value.id}/smtp-test`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: smtpTestTo.value.trim() })
    })
    const data = await res.json()
    smtpTestOk.value = data.status === 'success'
    smtpTestMsg.value = data.message || (smtpTestOk.value ? '已发送' : '发送失败')
  } catch (e) {
    smtpTestOk.value = false
    smtpTestMsg.value = '请求失败，请重试'
  } finally { smtpTesting.value = false }
}

const createForm = ref({ domain: '', name: '', multiplier: 3 })
// 👁 密钥/密码框的可视开关（站长填错密钥很常见，让他能看一眼）
const pwdShow = ref({ bufpay_key: false, cryptomus_key: false, smtp_pass: false });
const form = ref({
  name: '', multiplier: 2.5, footer_text: '', support_url: '', announcement: '',
  template: 'classic', color: 'cyan', accent: '', modules: [],
  ui_radius: '', ui_density: '', card_style: '', font_style: '', btn_shape: '', hero_layout: '',
  // 71期：背景色 / 背景图 / 字号 —— 之前只有首页悬浮编辑器能改，
  // 站长在后台面板里找不到，等于「设置里配不全」。
  bg_color: '', bg_image: '', font_scale: '',
  bufpay_id: '', bufpay_key: '', cryptomus_id: '', cryptomus_key: '',
  smtp_host: '', smtp_port: 465, smtp_user: '', smtp_pass: '',
  logo: '', hero_badge: '', hero_title: '', hero_subtitle: '', hero_desc: '',
  hero_btn1_text: '', hero_btn1_url: '', hero_btn2_text: '', hero_btn2_url: '', hero_bg_url: '',
  // 🧱 五十一期：优势三卡片（站长可改图标/标题/正文）
  advantages: [ { icon: '', title: '', body: '' }, { icon: '', title: '', body: '' }, { icon: '', title: '', body: '' } ]
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
// 🧩 二十八期：这里的键必须与 Home.vue 里真实的区块一一对应，
//    否则站长在后台关了「教程 FAQ」，首页照样显示（之前就是这个 bug）。
// 🎨 三十三期：风格预设。每个都是"模板 + 色系 + 5 个细节维度"的成套组合，
//    目的是让不懂设计的站长也能一键得到协调的外观（而不是自己乱配变成大杂烩）。
//    colorHex 只用于按钮上的小圆点，不写入数据库（数据库里存 color/accent）。
const presets = [
  { key: 'neon_purple', name: '霓虹紫', desc: '潮、年轻、夜店感', colorHex: '#a855f7',
    data: { template: 'neon', color: 'purple', accent: '', ui_radius: 'round', ui_density: 'normal', card_style: 'glass', font_style: 'sans', btn_shape: 'pill', hero_layout: 'center' } },
  { key: 'neon_cyan', name: '赛博青', desc: '科技、电竞、数据感', colorHex: '#22d3ee',
    data: { template: 'neon', color: 'cyan', accent: '', ui_radius: 'soft', ui_density: 'compact', card_style: 'glass', font_style: 'mono', btn_shape: 'rounded', hero_layout: 'center' } },
  { key: 'saas_blue', name: '商务蓝', desc: '可信、正规、企业感', colorHex: '#3b82f6',
    data: { template: 'saas', color: 'blue', accent: '', ui_radius: 'square', ui_density: 'compact', card_style: 'outline', font_style: 'sans', btn_shape: 'rounded', hero_layout: 'split' } },
  { key: 'minimal_slate', name: '极简灰', desc: '干净、高级、不抢戏', colorHex: '#e2e8f0',
    data: { template: 'minimal', color: 'cyan', accent: '#94a3b8', ui_radius: 'soft', ui_density: 'relaxed', card_style: 'outline', font_style: 'sans', btn_shape: 'square', hero_layout: 'center' } },
  { key: 'magazine_gold', name: '杂志金', desc: '品牌感、像媒体', colorHex: '#d4a017',
    data: { template: 'magazine', color: 'orange', accent: '#d4a017', ui_radius: 'square', ui_density: 'relaxed', card_style: 'solid', font_style: 'serif', btn_shape: 'square', hero_layout: 'banner' } },
  { key: 'glass_mint', name: '玻璃青', desc: '清爽、通透、轻', colorHex: '#34d399',
    data: { template: 'glass', color: 'green', accent: '', ui_radius: 'round', ui_density: 'normal', card_style: 'glass', font_style: 'rounded', btn_shape: 'pill', hero_layout: 'split' } },
  { key: 'warm_red', name: '热卖红', desc: '促销感、能催单', colorHex: '#ef4444',
    data: { template: 'classic', color: 'red', accent: '', ui_radius: 'round', ui_density: 'normal', card_style: 'solid', font_style: 'sans', btn_shape: 'pill', hero_layout: 'center' } },
  { key: 'candy_orange', name: '活泼橙', desc: '亲和、好上手', colorHex: '#f97316',
    data: { template: 'classic', color: 'orange', accent: '', ui_radius: 'pill', ui_density: 'relaxed', card_style: 'glass', font_style: 'rounded', btn_shape: 'pill', hero_layout: 'split' } },
  { key: 'deep_green', name: '沉稳绿', desc: '老练、可靠、稳重', colorHex: '#22c55e',
    data: { template: 'saas', color: 'green', accent: '', ui_radius: 'soft', ui_density: 'normal', card_style: 'solid', font_style: 'sans', btn_shape: 'rounded', hero_layout: 'split' } }
]

const activePreset = computed(() => {
  const f = form.value
  const hit = presets.find(p =>
    p.data.template === f.template && p.data.color === f.color &&
    (p.data.accent || '') === (f.accent || '') &&
    p.data.ui_radius === (f.ui_radius || '') && p.data.ui_density === (f.ui_density || '') &&
    p.data.card_style === (f.card_style || '') && p.data.font_style === (f.font_style || '') &&
    p.data.btn_shape === (f.btn_shape || '') && p.data.hero_layout === (f.hero_layout || ''))
  return hit ? hit.key : ''
})

// 套用预设：只改表单（客户视角预览立刻变），站长满意再点保存
// 🖼️ 三十七期：图片上传（Logo / 首页背景图）。
// 站长大多不会把图片传到图床再拿链接 —— 给个按钮直接传。
// 🎨 四十一期：可自定义文案的首页区块
const SECTION_KEYS = [
  { key: 'audience',     label: '谁在用',   phTitle: '🎯 谁在用 我的站', phSub: '客户群一句话' },
  { key: 'steps',        label: '三步开始', phTitle: '📋 三步开始',      phSub: '流程副标题' },
  { key: 'advantages',   label: '优势',     phTitle: '为什么选我们',     phSub: '优势副标题' },
  { key: 'hot_services', label: '热门服务', phTitle: '热门服务',         phSub: '登录后可看全部' },
  { key: 'faq',          label: '常见问题', phTitle: '❓ 常见问题',      phSub: 'FAQ 副标题' },
  { key: 'cta',          label: '底部号召', phTitle: '现在就开始',       phSub: 'CTA 副标题' },
]

const uploading = ref('')
// 71期：与首页悬浮编辑器保持同一套选项（两套说法会让站长以为是两个功能）
const BG_PRESETS = [
  { key: '',       name: '跟随模板', css: 'linear-gradient(135deg,#1e293b,#0f172a)' },
  { key: '#04070f', name: '纯黑',    css: '#04070f' },
  { key: '#0b1220', name: '深蓝',    css: '#0b1220' },
  { key: '#12081a', name: '暗紫',    css: '#12081a' },
  { key: 'grad1',  name: '深空渐变', css: 'linear-gradient(160deg,#0b1220,#131a2e,#1b1030)' },
  { key: 'grad2',  name: '深海渐变', css: 'linear-gradient(160deg,#04070f,#0d1b2a,#10243a)' },
  { key: 'grad3',  name: '紫夜渐变', css: 'linear-gradient(160deg,#120a1f,#1d1030,#2a1033)' }
]
const FONT_SCALES = [
  { key: 'sm', name: '小' }, { key: 'md', name: '标准' }, { key: 'lg', name: '大' }
]
const pickImage = (field) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,image/jpeg,image/webp,image/gif'
  input.onchange = async () => {
    const f = input.files && input.files[0]
    if (!f) return
    if (f.size > 3 * 1024 * 1024) { alert('图片不能超过 3MB，建议先压缩一下'); return }
    if (!site.value || !site.value.id) { alert('请先创建分站'); return }
    uploading.value = field
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch(`/api/sites/${site.value.id}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('xnow_token') || ''}` },
        body: fd
      })
      const data = await res.json()
      if (data.status === 'success' && data.data && data.data.url) {
        form.value[field] = data.data.url
      } else {
        alert(data.message || '上传失败')
      }
    } catch (e) {
      alert('上传失败：' + e.message)
    } finally {
      uploading.value = ''
    }
  }
  input.click()
}
const applyPreset = (p) => {
  Object.assign(form.value, p.data)
}
const MODULES = {
  audience: '谁在用（客户案例）',
  steps: '三步开始',
  advantages: '优势介绍',
  hot_services: '热门服务预览',
  faq: '常见问题 FAQ',
  cta: '底部行动号召'
}
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
        ui_radius: s.ui_radius || '', ui_density: s.ui_density || '',
        bg_color: s.bg_color || '', bg_image: s.bg_image || '', font_scale: s.font_scale || '',
        card_style: s.card_style || '', font_style: s.font_style || '',
        btn_shape: s.btn_shape || '', hero_layout: s.hero_layout || '',
      // 🎨 四十一期：结构级 DIY
      hero_variant: s.hero_variant || '', services_variant: s.services_variant || '',
      custom_css: s.custom_css || '', favicon_url: s.favicon_url || '',
      section_titles: (() => {
        let saved = {}
        try { saved = s.section_titles ? JSON.parse(s.section_titles) : {} } catch (e) { saved = {} }
        const filled = {}
        for (const k of ['audience', 'steps', 'advantages', 'hot_services', 'faq', 'cta']) {
          filled[k] = { title: (saved[k] && saved[k].title) || '', sub: (saved[k] && saved[k].sub) || '' }
        }
        return filled
      })(),
        modules: parseModules(s.home_modules),
        bufpay_id: s.bufpay_id || '', bufpay_key: s.bufpay_key ? '******' : '',
        cryptomus_id: s.cryptomus_id || '', cryptomus_key: s.cryptomus_key ? '******' : '',
        smtp_host: s.smtp_host || '', smtp_port: s.smtp_port || 465,
        smtp_user: s.smtp_user || '', smtp_pass: s.smtp_pass ? '******' : '',
        logo: s.logo || '',
        hero_badge: s.hero_badge || '', hero_title: s.hero_title || '',
        hero_subtitle: s.hero_subtitle || '', hero_desc: s.hero_desc || '',
        hero_btn1_text: s.hero_btn1_text || '', hero_btn1_url: s.hero_btn1_url || '',
        hero_btn2_text: s.hero_btn2_text || '', hero_btn2_url: s.hero_btn2_url || '',
        hero_bg_url: s.hero_bg_url || '',
        // 🧱 五十一期：优势三卡片（库里为空 → 三个空行，前端会回落到平台默认文案）
        advantages: (() => {
          let saved = []
          try { saved = s.advantages ? JSON.parse(s.advantages) : [] } catch (e) { saved = [] }
          const out = []
          for (let i = 0; i < 3; i++) {
            const it = (Array.isArray(saved) && saved[i]) || {}
            out.push({ icon: it.icon || '', title: it.title || '', body: it.body || '' })
          }
          return out
        })()
      }
      const r2 = await fetch(`/api/sites/stats?site_id=${s.id}`, { headers: headers() })
      const d2 = await r2.json()
      stats.value = d2.data || {}
    }
  } catch (e) { console.error(e) } finally { loading.value = false }
}

// 🎨 二十七期：一键回到"跟随模板"（避免站长乱点后不知道该选什么）
const resetStyles = () => {
  form.value.ui_radius = ''
  form.value.ui_density = ''
  form.value.card_style = ''
  form.value.font_style = ''
  form.value.btn_shape = ''
  form.value.hero_layout = ''
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

const save = async (silent = false) => {
  if (!site.value) return false
  saving.value = true
  try {
    const payload = {
      name: form.value.name, multiplier: form.value.multiplier,
      footer_text: form.value.footer_text, support_url: form.value.support_url,
      announcement: form.value.announcement,
      template: form.value.template, color: form.value.color, accent: form.value.accent,
      ui_radius: form.value.ui_radius, ui_density: form.value.ui_density,
      bg_color: form.value.bg_color || '', bg_image: form.value.bg_image || '', font_scale: form.value.font_scale || '',
      card_style: form.value.card_style, font_style: form.value.font_style,
      btn_shape: form.value.btn_shape, hero_layout: form.value.hero_layout,
      home_modules: JSON.stringify(form.value.modules.map((m, i) => ({ key: m.key, enabled: !!m.enabled, order: i }))),
      bufpay_id: form.value.bufpay_id, bufpay_key: form.value.bufpay_key,
      cryptomus_id: form.value.cryptomus_id, cryptomus_key: form.value.cryptomus_key,
      smtp_host: form.value.smtp_host, smtp_port: form.value.smtp_port,
      smtp_user: form.value.smtp_user, smtp_pass: form.value.smtp_pass,
      logo: form.value.logo,
      hero_badge: form.value.hero_badge, hero_title: form.value.hero_title,
      hero_subtitle: form.value.hero_subtitle, hero_desc: form.value.hero_desc,
      hero_btn1_text: form.value.hero_btn1_text, hero_btn1_url: form.value.hero_btn1_url,
      hero_btn2_text: form.value.hero_btn2_text, hero_btn2_url: form.value.hero_btn2_url,
      hero_bg_url: form.value.hero_bg_url,
      // 🎨 四十一期：结构级 DIY（版式 / 逐区块文案 / 自定义 CSS / 图标）
      hero_variant: form.value.hero_variant || '',
      services_variant: form.value.services_variant || '',
      section_titles: JSON.stringify(form.value.section_titles || {}),
      custom_css: form.value.custom_css || '',
      favicon_url: form.value.favicon_url || '',
      // 🧱 五十一期：优势三卡片（全空则后端存 null → 前端回落平台默认文案）
      advantages: JSON.stringify((form.value.advantages || []).map(a => ({
        icon: (a.icon || '').trim(), title: (a.title || '').trim(), body: (a.body || '').trim()
      })))
    }
    const res = await fetch(`/api/sites/${site.value.id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(payload) })
    const data = await res.json()
    if (!silent) alert(data.status === 'success' ? '✅ 已保存，访客刷新即可看到新外观' : `❌ ${data.message}`)
    if (data.status === 'success') load()
    return data.status === 'success'
  } catch (e) { if (!silent) alert('保存失败'); return false } finally { saving.value = false }
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

// 🔧 修复域名：重新签发证书 + 重写 vhost。
//    站长的典型用法：改完 DNS 等几分钟，点这个把「临时证书」换成正式证书。
const republishDomain = async () => {
  if (!site.value) return
  publishing.value = true
  domainHint.value = ''
  try {
    const res = await fetch(`/api/sites/${site.value.id}/publish`, { method: 'POST', headers: headers() })
    const data = await res.json()
    if (data.status === 'success') {
      domainHint.value = `✅ ${data.message}`
      load()
    } else {
      domainHint.value = `❌ ${data.message}`
    }
  } catch (e) { domainHint.value = '❌ 请求失败' } finally { publishing.value = false }
}

const loadOrders = async (append = false) => {
  if (!site.value) return
  tab.value = 'orders'
  try {
    const off = append ? orders.value.length : 0
    const res = await fetch(`/api/sites/orders?site_id=${site.value.id}&limit=${PAGE}&offset=${off}`, { headers: headers() })
    const data = await res.json()
    if (data.status === 'success') {
      orders.value = append ? [...orders.value, ...data.data] : data.data
      orderTotal.value = data.total || 0
    }
  } catch (e) {}
}
const loadMoreOrders = () => loadOrders(true)

const loadCustomers = async (append = false) => {
  if (!site.value) return
  tab.value = 'customers'
  try {
    const off = append ? customers.value.length : 0
    const res = await fetch(`/api/sites/customers?site_id=${site.value.id}&limit=${PAGE}&offset=${off}`, { headers: headers() })
    const data = await res.json()
    if (data.status === 'success') {
      customers.value = append ? [...customers.value, ...data.data] : data.data
      customerTotal.value = data.total || 0
    }
  } catch (e) {}
}
const loadMoreCustomers = () => loadCustomers(true)

// 🤝 推广数据：复用已有的 /api/user/affiliate-stats（返佣比例 + 下级人数 + 累计佣金）
const affiliate = ref({ count: 0, commission: '0.00', rate: '10%' });
const copied = ref(false);
const inviteLink = computed(() => {
  const uid = userStore.userInfo?.id || '';
  // 主站地址由服务端下发；拿不到才退回当前域名
  const origin = (appStore.mainOrigin || window.location.origin).replace(/\/+$/, '');
  return `${origin}/?ref=${uid}`;
});
async function loadAffiliate() {
  try {
    const r = await fetch('/api/user/affiliate-stats', { headers: { Authorization: `Bearer ${userStore.token}` } });
    const d = await r.json();
    const data = d.data || d;
    affiliate.value = {
      count: (data.invitees || []).length,
      commission: Number(data.total_commission || data.commission || 0).toFixed(2),
      rate: data.rate ? Math.round(Number(data.rate) * 100) + '%' : '10%',
    };
  } catch (e) { /* 拿不到就显示 0，不影响主功能 */ }
}
function copyInvite() {
  const done = () => { copied.value = true; setTimeout(() => (copied.value = false), 1600); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(inviteLink.value).then(done).catch(done);
  else done();
}

onMounted(async () => {
  loadAffiliate()
  await load()
  if (site.value) { loadOrders(); loadHotPrice() }
})
</script>
