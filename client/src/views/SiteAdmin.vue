<template>
  <div class="p-4 md:p-6 max-w-5xl mx-auto text-slate-200">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-black">{{ heading }}</h1>
        <p class="text-xs text-slate-500 mt-1">{{ subheading }}</p>
      </div>
      <button @click="load()" class="px-3 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 whitespace-nowrap">刷新</button>
    </div>

<!-- 🚦 站被停了：顶部红条 + 一键续费（站长自己就能救回来） -->
    <div v-if="site && site.status !== 'active' && !isStaffRole"
         class="mb-3 rounded-2xl border border-red-600/50 bg-red-500/10 px-4 py-3 flex flex-wrap items-center gap-3">
      <span class="text-lg">🚦</span>
      <div class="min-w-0">
        <div class="text-sm font-black text-red-300">你的站已停 —— 客户打开 {{ site.domain }} 看到的是「站点已下线」</div>
        <div class="text-[11px] text-red-200/70 mt-0.5">
          数据一条没丢。续费 {{ plan.site_monthly }} 元就能立刻恢复（{{ plan.renew_days }} 天）。
        </div>
      </div>
      <button type="button" @click="renewSiteFee()" :disabled="busyStop"
              class="ml-auto px-3.5 py-2 rounded-xl bg-red-500 text-white text-xs font-black disabled:opacity-50">
        {{ busyStop ? '处理中…' : `立即续费 ¥${plan.site_monthly}` }}
      </button>
    </div>

    <!-- 🔀 多站切换常驻顶部：改价/装修前一眼就知道自己在改哪个站 -->
    <div v-if="!isStaffRole && sitesList.length > 1"
         class="mb-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2 flex items-center gap-2 flex-wrap">
      <span class="text-[11px] text-slate-500 shrink-0">当前正在管理</span>
      <select :value="site?.id" @change="pickSite($event)"
              class="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-200 max-w-[60vw]">
        <option v-for="s in sitesList" :key="s.id" :value="s.id">
          #{{ s.id }} {{ s.name }}{{ s.status === 'active' ? '' : '（已停）' }}
        </option>
      </select>
      <span class="text-[10px] text-slate-600">后面所有改动只影响这一个站</span>
      <button type="button" @click="go('overview')"
              class="ml-auto text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400">管理全部站点</button>
    </div>

    <!-- 🧭 92 期：原来 11 个区块堆在一页，手机上滑很久还找不到。拆页后导航就这一条 -->
    <nav v-if="site" class="sticky top-0 z-20 -mx-4 md:mx-0 px-4 md:px-0 py-2 mb-4 bg-slate-950/95 backdrop-blur border-b border-slate-800 md:border-none md:bg-transparent">
      <div class="grid grid-cols-4 gap-1.5 md:flex md:flex-wrap md:overflow-visible">
        <button v-for="t in PAGE_TABS" :key="t.key" @click="go(t.key)"
          class="px-1.5 py-2 rounded-xl text-[11px] md:text-xs font-bold transition flex items-center justify-center gap-1"
          :class="page === t.key ? 'bg-amber-400 text-slate-900' : 'bg-slate-900/80 text-slate-300 border border-slate-800'">
          {{ t.icon }} {{ t.label }}
        </button>
      </div>
    </nav>

    <!-- 📣 推荐同行开店：站长把朋友介绍来开至尊代理/充值，他拿 10% 返佣。
         只出现在主站的「我的分站」页，分站上不露痕迹。 -->

    <!-- 💰 110 期：代理到期**不停站**（只有本站月费到期才停）。这句务必说清楚，
         否则站长会以为"代理一停我站就没了"，不敢让代理到期。 -->
    <p v-if="site && billingState.isAgent" class="text-[10px] text-slate-500 leading-relaxed px-1">
      至尊代理到期后，你的分站<b class="text-slate-400">照常运营</b>，只是进货价从 8 折回到原价。
    </p>

    <!-- 💳 代理资格 + 分站月费（87 期商业化） -->
    <SiteBilling ref="billingRef" @changed="load()" @status="billingState = $event" />

    <div v-if="loading" class="text-center py-20 text-slate-500">加载中…</div>

    <!-- 💰 110 期：没有代理也能开站，代理只是进货价更低。
         所以这里不再拦人，只在建站表单上方挂一句「开代理更划算」。 -->

    <!-- 还没有分站 → 视觉化 hero（祥哥：视觉效果不够）
         桌面双栏：左边说人话 + 立即开通，右边直接给"开出来长什么样"，一屏能看到按钮。 -->
    <div v-else-if="!site" class="hero-wrap relative overflow-hidden rounded-3xl border border-amber-500/20 px-5 py-8 sm:px-8 sm:py-10">
      <div class="pointer-events-none absolute inset-0 hero-glow"></div>
      <div class="pointer-events-none absolute inset-0 hero-dots opacity-30"></div>
      <div class="pointer-events-none absolute -top-28 -left-16 w-80 h-80 rounded-full bg-amber-400/20 blur-3xl hero-float"></div>
      <div class="pointer-events-none absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-emerald-400/15 blur-3xl hero-float-slow"></div>

      <div class="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10">
        <!-- 左：文案 + 数字 + CTA -->
        <div class="text-center lg:text-left">
          <span class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[11px] font-bold text-amber-200 tracking-wide backdrop-blur">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 hero-pulse"></span>
            开分站 · 10 分钟上线
          </span>

          <h2 class="mt-4 text-[30px] sm:text-[38px] font-black leading-[1.12] tracking-tight">
            <span class="hero-title bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-transparent">把客户，<br />变成长期收入</span>
          </h2>
          <p class="mt-3 text-sm sm:text-[15px] text-slate-300 leading-relaxed">
            你出客户和品牌，商品、下单、自动交付、对账全包。<br />
            <span class="text-slate-400">不用囤货、不用手工发货、不抽成。</span>
          </p>

          <!-- 三个数字：一体式胶囊 -->
          <div class="mt-5 flex items-stretch rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden">
            <div v-for="(n, i) in heroStats" :key="n.k"
                 class="flex-1 px-2 py-2.5" :class="i ? 'border-l border-slate-800' : ''">
              <div class="text-base sm:text-lg font-black leading-none" :class="n.c">{{ n.k }}</div>
              <div class="text-[10px] text-slate-500 mt-1">{{ n.d }}</div>
            </div>
          </div>

          <button @click="$router.push('/my-site/new')"
            class="hero-cta relative overflow-hidden mt-5 w-full sm:w-auto sm:px-10 py-3.5 rounded-2xl font-black text-[15px] text-slate-900
                   bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500
                   shadow-[0_10px_40px_-8px_rgba(245,158,11,0.65)] ring-1 ring-amber-200/50
                   hover:brightness-105 active:scale-[0.99] transition">
            <span class="relative z-10">开通我的分站 · ¥{{ plan.site_monthly }}/月 →</span>
          </button>
          <p class="mt-2.5 text-[11px] text-slate-500">
            开通即扣 ¥{{ plan.site_monthly }}，有效期 {{ plan.renew_days }} 天 · 卖多少都是你的
          </p>
        </div>

        <!-- 右：产品预览（纯 CSS 画的迷你站，客户看到的就是这样） -->
        <div class="mx-auto w-full max-w-[330px] lg:max-w-none">
          <div class="rounded-2xl border border-slate-700/70 bg-slate-950/85 overflow-hidden shadow-2xl shadow-black/60 hero-tilt">
            <div class="flex items-center gap-1.5 px-3 py-2 bg-slate-900/90 border-b border-slate-800">
              <span class="w-2 h-2 rounded-full bg-rose-500/70"></span>
              <span class="w-2 h-2 rounded-full bg-amber-500/70"></span>
              <span class="w-2 h-2 rounded-full bg-emerald-500/70"></span>
              <span class="ml-2 flex-1 truncate text-[9px] text-slate-500">your-brand.com</span>
            </div>
            <div class="px-3 py-3">
              <div class="flex items-center gap-1.5">
                <span class="w-4 h-4 rounded-md bg-gradient-to-br from-amber-400 to-orange-500"></span>
                <span class="text-[10px] font-bold text-slate-200">你的站名</span>
                <span class="ml-auto text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">营业中</span>
              </div>
              <div class="mt-2.5 space-y-1.5">
                <div v-for="row in previewRows" :key="row.n"
                     class="flex items-center justify-between rounded-lg bg-slate-900/80 border border-slate-800 px-2 py-2">
                  <span class="flex items-center gap-1.5 min-w-0">
                    <span class="w-1.5 h-1.5 rounded-full" :class="row.dot"></span>
                    <span class="text-[9px] text-slate-300 truncate">{{ row.n }}</span>
                  </span>
                  <span class="text-[10px] font-bold text-amber-300 shrink-0">¥{{ row.p }}</span>
                </div>
              </div>
              <div class="mt-2.5 flex items-center justify-between rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-2 py-2">
                <span class="text-[9px] font-black text-slate-900">立即下单</span>
                <span class="text-[8px] font-bold text-slate-900/70">自动交付</span>
              </div>
              <div class="mt-2 flex items-center justify-between text-[8px] text-slate-500">
                <span>今天的订单 3 笔</span><span class="text-emerald-400">已到账 ¥293</span>
              </div>
            </div>
          </div>
          <p class="mt-2.5 text-center text-[10px] text-slate-500">客户看到的就是这样：你的站名、你定的价</p>
        </div>
      </div>

      <!-- 四个卖点：整行铺开 -->
      <div class="relative mt-7 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div v-for="f in heroFeatures" :key="f.t"
             class="flex gap-2.5 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 hover:border-slate-700 transition">
          <span class="shrink-0 w-8 h-8 rounded-xl grid place-items-center text-base ring-1 ring-inset ring-white/5" :class="f.bg">{{ f.i }}</span>
          <div class="min-w-0">
            <div class="text-[13px] font-bold text-slate-100">{{ f.t }}</div>
            <div class="text-[11px] text-slate-500 leading-relaxed mt-0.5">{{ f.d }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 已有分站 -->
    <!-- pb-24：右下角那个 LIVE 客服球会盖住页面最后一行字（截图自查发现）-->
    <div v-else class="space-y-5 pb-24">
      <!-- 🚦 站被停了 —— 只有一种原因：这个站的月费到期（祥哥定调） -->
      <section v-if="page === 'overview' && site && site.status === 'expired'"
        class="bg-rose-950/30 border border-rose-800/60 rounded-2xl p-4">
        <h2 class="font-bold text-sm text-rose-300 mb-1.5">站点已停：这个站的月费到期了</h2>
        <p class="text-[11px] text-slate-300 leading-relaxed">
          访客现在打开 <b>{{ site.custom_domain || site.domain }}</b> 会看到「站点已下线」。
          数据都还在，续费立刻恢复。
        </p>
        <button type="button" @click="renewSiteFee()" :disabled="busyStop"
          class="mt-2.5 px-3 py-2 rounded-lg bg-amber-500 text-slate-900 text-[11px] font-bold disabled:opacity-50">
          续费这个站 ¥{{ plan.site_monthly }}（30 天）
        </button>
        <p v-if="stopMsg" class="text-[11px] mt-2" :class="stopMsgOk ? 'text-emerald-400' : 'text-red-400'">{{ stopMsg }}</p>
      </section>

    

    <!-- 🏬 我的分站（多站时用来切换；也在这里开新站）-->
      <section v-if="page === 'overview'" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
        <div class="flex items-center justify-between mb-2.5">
          <h2 class="font-bold text-sm text-white">{{ isStaffRole ? '全部分站' : '我的分站' }} <span class="text-slate-500 font-normal">（{{ sitesList.length }} 个）</span></h2>
          <router-link to="/my-site/new"
            class="px-2.5 py-1.5 rounded-lg bg-amber-500 text-slate-900 text-[11px] font-bold">+ 开通新分站</router-link>
        </div>
        <div class="space-y-1.5">
          <button v-for="s in sitesList" :key="s.id" type="button" @click="switchSite(s)"
            class="w-full text-left flex items-center gap-2 rounded-xl border px-2.5 py-2 transition"
            :class="Number(s.id) === Number(site && site.id) ? 'border-amber-400 bg-amber-400/10' : 'border-slate-800 bg-slate-950/60'">
            <span class="shrink-0 w-5 h-5 grid place-items-center rounded-md text-[10px] font-bold"
                  :class="Number(s.id) === Number(site && site.id) ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-400'">
              {{ Number(s.id) === Number(site && site.id) ? '✓' : '' }}
            </span>
            <span class="flex-1 min-w-0">
              <span class="block text-xs font-bold text-slate-100 truncate">{{ s.name }}</span>
              <span class="block text-[12px] text-cyan-300/90 truncate underline decoration-cyan-400/30">{{ s.custom_domain || s.domain }}</span>
            </span>
            <span v-if="s.status === 'expired'" class="shrink-0 text-[10px] text-red-400">已停站</span>
            <span class="shrink-0 text-[10px] text-slate-500">{{ Number(s.id) === Number(site && site.id) ? '管理这个' : '切过去' }}</span>
          </button>
        </div>
      </section>

      <!-- 🚦 开站清单：新手不知道"开完站还差什么"，这里直接告诉他 -->
      <section v-if="page === 'overview' && pendingSteps.length" class="bg-gradient-to-br from-amber-500/10 to-slate-900/70 border border-amber-500/30 rounded-2xl p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-bold text-sm text-amber-300">开站清单（还差 {{ pendingSteps.length }} 步才建议开卖）</h2>
          <span class="text-[11px] text-amber-400/80">{{ doneSteps.length }} / {{ steps.length }} 已完成</span>
        </div>
        <ul class="space-y-2">
          <li v-for="s in steps" :key="s.key">
            <component :is="s.done || !s.go ? 'div' : 'button'" :type="s.done || !s.go ? undefined : 'button'"
              @click="(!s.done && s.go) ? go(s.go) : null"
              class="w-full text-left flex items-start gap-2 text-xs rounded-lg px-1 py-1"
              :class="(!s.done && s.go) ? 'hover:bg-amber-400/10' : ''">
              <span class="mt-[1px]">{{ s.done ? '✅' : '⬜' }}</span>
              <div class="flex-1">
                <span :class="s.done ? 'text-slate-500 line-through' : 'text-slate-200 font-bold'">{{ s.title }}</span>
                <span v-if="!s.done" class="block text-[11px] text-slate-500 mt-0.5">{{ s.hint }}</span>
              </div>
              <span v-if="!s.done && s.go" class="shrink-0 text-[11px] text-amber-400/90 mt-0.5">去改 →</span>
            </component>
          </li>
        </ul>
        <p class="text-[10px] text-slate-500 mt-3">清单只是提醒，不拦着你开卖。但「收款」没配，客户充不了值；「发信」没配，客户收到的邮件会从系统默认邮箱发出（个别情况下甚至发不出去）。</p>
      </section>

      <!-- 收益看板 -->
      <div v-if="page === 'overview'" class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div v-for="c in cards" :key="c.label" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <p class="text-[11px] text-slate-500">{{ c.label }}</p>
          <p class="text-xl font-black mt-1" :class="c.cls">{{ c.value }}</p>
          <p v-if="c.sub" class="text-[10px] text-slate-500 mt-1">{{ c.sub }}</p>
        </div>
      </div>

      <!-- 基本信息 -->
      <section v-if="page === 'overview'" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-sm text-amber-400">站点信息</h2>
          <span class="text-[10px] text-slate-500">名字 / 页脚 / 客服 / 公告</span>
        </div>
        <div class="grid md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">站点名称</label>
            <input v-model="form.name" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
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


      <!-- 💰 全站价页：加价率 + 单服务改价 + 限时折扣 -->
      <!-- 103 期：祥哥问「售价 和 客户价 是不是重复」—— 不重复，但界面没说清。
           两页各加一句话，讲明白「这一页管谁的价」。 -->
      <div v-if="page === 'pricing'" class="rounded-xl border border-amber-400/30 bg-amber-400/5 px-3.5 py-3 mb-1">
        <p class="text-[11px] text-amber-300 font-bold mb-1">这一页 = 全站统一价（所有客户都按这里的价买）</p>
        <p class="text-[11px] text-slate-400 leading-relaxed">
          加价率决定基础价；可以给单个服务单独定价；最下面的「折扣促销」是临时降价 —— 选了天数就到期自动恢复，不选就长期有效。
          <span class="block mt-1 text-slate-500">想给某个人或某群老客户更低价 → 去「客户价」页。</span>
        </p>
      </div>

      <section v-if="page === 'pricing'" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 class="font-bold text-sm text-amber-400">加价率</h2>
        <div class="grid md:grid-cols-2 gap-3 items-start">
          <div>
            <input v-model.number="form.markup_pct" type="number" step="10" min="0" max="2000" inputmode="numeric"
              class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-lg font-bold text-right" />
            <p class="text-[10px] text-slate-500 mt-1">可填 0 ~ 2000；0 = 按进货价卖（不赚不亏），低于 0 就是亏本，系统不让填。</p>

            <!-- 💾 102 期：祥哥在这里找不到保存 —— 全局按钮在整页最底部，手机上要滑很久。
                 现在输入框下面直接一个保存按钮，带「未保存/已保存」状态。 -->
            <div class="flex items-center gap-2 mt-2">
              <button type="button" @click="saveMarkup" :disabled="saving"
                      class="flex-1 py-2.5 rounded-lg font-black text-sm bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 disabled:opacity-50">
                {{ saving ? '保存中…' : '保存加价率' }}
              </button>
              <span v-if="markupDirty" class="text-[11px] text-amber-400 whitespace-nowrap">● 未保存</span>
              <span v-else class="text-[11px] text-emerald-400 whitespace-nowrap">✓ 已保存</span>
            </div>
            <p v-if="markupMsg" class="text-[11px] mt-1.5" :class="markupOk ? 'text-emerald-400' : 'text-rose-400'">{{ markupMsg }}</p>
            <p class="text-[10px] text-slate-600 mt-1">客户看到的价格 = 你的进货价 ×（1 + 加价率）。改完点上面的按钮就生效。</p>
          </div>
          <p class="text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
            加价率越高，客户看到的价格越高、你每单赚得越多。系统有底线：售价低于你的进货价会直接拦住。
            <span class="block text-slate-500 mt-1">下面还能给单个服务单独定价、或做全站折扣。</span>
          </p>
        </div>
      </section>


      <!-- 🧭 92 期：分页入口（手机两列 / 桌面四列），一格一件事 -->
      <div v-if="page === 'overview'" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button v-for="t in PAGE_TABS.filter(x => x.key !== 'overview')" :key="'entry' + t.key" @click="go(t.key)"
          class="text-left px-4 py-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-amber-400/60 transition">
          <div class="flex items-center gap-2">
            <span class="text-lg">{{ t.icon }}</span>
            <span class="font-bold text-sm text-white">{{ t.label }}</span>
          </div>
          <p class="text-[11px] text-slate-500 mt-1 leading-snug">{{ t.hint }}</p>
        </button>
      </div>

      <!-- 💰 定价体系：单服务改价 + 折扣促销（组件自取自存，保存后回读本站配置） -->
      <SitePricing v-if="page === 'pricing' && site && site.id" :site-id="site.id" @saved="load()" />
          <div v-if="page === 'customers'" class="rounded-xl border border-sky-400/30 bg-sky-400/5 px-3.5 py-3 mb-1">
        <p class="text-[11px] text-sky-300 font-bold mb-1">这一页 = 个别客户价（只影响你指定的客户）</p>
        <p class="text-[11px] text-slate-400 leading-relaxed">
          分组折扣：把客户分到「VIP / 老客户」等组，整组按这个折扣买；单独定价：只给某一个客户。
          <span class="block mt-1 text-slate-500">这里的价优先级高于「全站价」里的折扣促销。客户线下转账给你，也在这里手动加余额。</span>
        </p>
      </div>

      <SiteCustomers v-if="page === 'customers' && site && site.id" :site-id="site.id" @saved="load()" />

      <!-- 🎨 装修页（92 期）：实时预览 + 可视化配色/模板/模块拖拽/细节风格 -->
      <DesignStudio v-if="page === 'design'" :form="form" :site="site" :pv="pv" :templates="templates"
        :colors="colors" :presets="presets" :uploading="uploading" :preview-modules="previewModules"
        :module-label="moduleLabel" :module-hint="moduleHint" :sample-price="samplePrice"
        :bg-presets="BG_PRESETS" @apply-preset="applyPreset" @reset-styles="resetStyles"
        @pick-image="pickImage" />

      <!-- ✍️ 文案页（92 期）：字段旁边就能看到成品，所见即将来客户看到的 -->
      <CopyStudio v-if="page === 'copy'" :form="form" :pv="pv" :section-keys="SECTION_KEYS"
        :uploading="uploading" @pick-image="pickImage" @fill-demo="fillHeroDemo" />

      <!-- 💰 平台代收 & 提现（没配商户时的兜底：钱先进主站账户，记你名下待结算） -->
      <section v-if="page === 'payment'" class="bg-slate-900/70 border border-emerald-800/50 rounded-2xl p-5 space-y-3">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 class="font-bold text-sm text-emerald-300">💰 收款方式</h2>
            <p class="text-[11px] text-slate-500 leading-relaxed mt-1">
              两条通道都给你备着，随时自己切：<b class="text-slate-300">平台代收</b>（不用配商户，客户马上能充值，
              钱先进主站账户、记你名下待结算，每周提现一次）或 <b class="text-slate-300">自己的商户</b>
              （钱直接进你账号，平台不碰）。切换即时生效，不用等人审批。
            </p>
          </div>
          <div class="text-right shrink-0">
            <div class="text-[10px] text-slate-500 mb-1">当前生效</div>
            <div class="px-2.5 py-1.5 rounded-lg text-[11px] font-black whitespace-nowrap"
                 :class="activeChannel.channel === 'own' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-600/40'
                       : activeChannel.channel === 'platform' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-600/40'
                       : 'bg-red-500/20 text-red-300 border border-red-600/40'">
              {{ activeChannel.channel === 'own' ? '自有商户' : activeChannel.channel === 'platform' ? '平台代收' : '未开通' }}
            </div>
          </div>
        </div>

        <!-- 三选一：自动 / 只用自己的 / 只用平台代收 -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button v-for="m in PAY_MODES" :key="m.value" type="button" @click="setPayMode(m.value)"
                  class="text-left rounded-xl border px-3 py-2 transition"
                  :class="settlement.pay_mode === m.value
                    ? 'border-emerald-500/60 bg-emerald-500/10'
                    : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'">
            <div class="text-[11px] font-black" :class="settlement.pay_mode === m.value ? 'text-emerald-300' : 'text-slate-300'">
              {{ settlement.pay_mode === m.value ? '✅ ' : '' }}{{ m.label }}
            </div>
            <div class="text-[10px] text-slate-500 leading-snug mt-0.5">{{ m.hint }}</div>
          </button>
        </div>

        <div v-if="activeChannel.reason"
             class="rounded-xl border border-amber-700/40 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
          ⚠️ 客户现在付款会看到「暂未开通」：{{ activeChannel.hint }}
        </div>

        <div class="flex items-center gap-2 flex-wrap pt-1">
          <span class="text-[10px] text-slate-500">平台代收开关</span>
          <button type="button" @click="togglePlatformMerchant"
                  class="px-3 py-1.5 rounded-lg text-[11px] font-black whitespace-nowrap"
                  :class="settlement.use_platform_merchant ? 'bg-emerald-500 text-slate-900' : 'bg-slate-800 text-slate-300'">
            {{ settlement.use_platform_merchant ? '已开启 · 点此关闭' : '开启主站代收' }}
          </button>
          <span class="text-[10px] text-slate-600">
            关闭后只有你自己的商户能收款；两条都没开，客户就充不了值。
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div class="rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2">
            <div class="text-[10px] text-slate-500">可提现</div>
            <div class="text-base font-black text-emerald-300">¥{{ money(settlement.available) }}</div>
          </div>
          <div class="rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2">
            <div class="text-[10px] text-slate-500">已提现</div>
            <div class="text-base font-black text-slate-200">¥{{ money(settlement.withdrawn) }}</div>
          </div>
          <div class="rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2">
            <div class="text-[10px] text-slate-500">审核中</div>
            <div class="text-base font-black text-amber-300">¥{{ money(settlement.pending_withdraw) }}</div>
          </div>
        </div>

        <div v-if="settlement.available <= 0 && Number(settlement.pending_withdraw) > 0"
             class="rounded-xl border border-amber-700/40 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
          你有一笔 ¥{{ money(settlement.pending_withdraw) }} 的提现正在审核中，这部分金额已占住额度；
          主站确认转账后会自动清账，到账后就能再申请。
        </div>
        <div v-if="settlement.available <= 0 && Number(settlement.pending_withdraw) <= 0 && settlement.available <= 0"
             class="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-500">
          还没有可提现的余额 —— 客户用在线支付充值的钱才会记到这里（主站代收）。
        </div>

        <div v-if="settlement.available > 0" class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
          <template v-if="settlement.can_request">
            <div class="flex flex-wrap items-center gap-2">
              <label class="text-[11px] text-slate-400">提现金额</label>
              <input v-model.number="withdraw.amount" type="number" min="10" :max="settlement.available"
                     class="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm" />
              <span class="text-[10px] text-slate-600">可提 ¥{{ money(settlement.available) }} · 最低 ¥{{ settlement.min_withdraw }}</span>
              <button type="button" @click="withdrawAll" class="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-300">全部</button>
            </div>
            <!-- 收款码：点 / 拖 / 粘贴（微信里复制图片也能直接粘） -->
            <div>
              <label class="block text-[11px] text-slate-400 mb-1.5">你的收款码</label>
              <div v-if="!qrPreview"
                   role="button" tabindex="0"
                   @click="qrInput?.click()"
                   @keydown.enter="qrInput?.click()"
                   @dragover.prevent="qrDrag = true"
                   @dragleave.prevent="qrDrag = false"
                   @drop.prevent="onQrDrop"
                   class="rounded-xl border-2 border-dashed px-3 py-4 text-center cursor-pointer transition"
                   :class="qrDrag ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-700 bg-slate-950/50 hover:border-slate-500'">
                <div class="text-xl">{{ qrDrag ? '📥' : '📤' }}</div>
                <div class="text-[11px] text-slate-300 font-bold mt-1">
                  {{ qrDrag ? '松手就上传' : '点这里选图片 · 拖进来 · 或直接粘贴（Ctrl+V）' }}
                </div>
                <div class="text-[10px] text-slate-600 mt-0.5">PNG / JPG / WEBP，4MB 以内；微信里复制图片也能粘</div>
              </div>
              <div v-else class="flex items-center gap-3 rounded-xl border border-emerald-600/40 bg-emerald-500/5 p-2">
                <img :src="qrPreview" alt="收款码预览" class="w-16 h-16 object-contain bg-white rounded-lg border border-slate-700" />
                <div class="min-w-0 flex-1">
                  <div class="text-[11px] text-emerald-300 font-bold">已选好收款码</div>
                  <div class="text-[10px] text-slate-500 truncate">{{ qrName || '图片' }}</div>
                </div>
                <button type="button" @click="clearQr"
                        class="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-300 shrink-0">换一张</button>
              </div>
              <input ref="qrInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="pickQr" />
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <input v-model="withdraw.note" placeholder="备注（可不填，比如微信号）"
                     class="flex-1 min-w-[140px] bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px]" />
              <button type="button" @click="submitWithdraw" :disabled="withdrawing || !qrFile"
                      class="px-3 py-2 rounded-lg bg-emerald-500 text-slate-900 text-[11px] font-black disabled:opacity-40">
                {{ withdrawing ? '提交中…' : '申请提现' }}
              </button>
            </div>
            <p class="text-[10px] text-slate-600">一周只能申请一次，主站扫码转账后点确认才算完成。</p>
          </template>
          <p v-else class="text-[11px] text-amber-300">
            下次可申请：{{ whenText(settlement.can_request_at) }}（一周一次）
          </p>
        </div>

        <div v-if="settlement.withdrawals && settlement.withdrawals.length" class="space-y-1">
          <div class="text-[10px] text-slate-500">提现记录</div>
          <div v-for="w in settlement.withdrawals" :key="w.id"
               class="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-lg bg-slate-950/40 border border-slate-800">
            <span class="font-bold text-slate-200">¥{{ money(w.amount) }}</span>
            <span :class="w.status === 'paid' ? 'text-emerald-400' : w.status === 'rejected' ? 'text-red-400' : 'text-amber-300'">
              {{ w.status === 'paid' ? '已转账' : w.status === 'rejected' ? '已驳回' : '审核中' }}
            </span>
            <span class="text-slate-600">{{ whenText(w.created_at) }}</span>
            <span v-if="w.admin_note" class="text-slate-500 truncate">· {{ w.admin_note }}</span>
          </div>
        </div>
      </section>

      <!-- 收款 -->
      <section v-if="page === 'payment'" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 class="font-bold text-sm text-amber-400">收款商户（钱直接进你的账户）</h2>
        <p class="text-[11px] text-slate-500 leading-relaxed">
          填你自己的 BufPay / Cryptomus 商户，客户在你站上付款时直接进你的账号。
          填了这里的商户，收款方式会自动优先走你的商户；两条都没配/没开时，客户点充值才会看到「暂未开通」。
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
      <section v-if="page === 'email'" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 class="font-bold text-sm text-amber-400">发信邮箱（客户收到的验证码用你的品牌）</h2>
        <p class="text-[11px] text-slate-500">不填也能用：邮件标题、正文和署名仍然是你的品牌，但<b class="text-amber-400">发件地址会是系统默认邮箱</b>，客户点开「显示详情」能看到一个陌生域名。想让客户完全看不出破绽，就用自己域名注册一个邮箱填进来（QQ 邮箱、企业邮箱都行，两分钟）。</p>
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
          <p class="text-[11px] text-amber-500/80">⚠️ 一定要先测通再开卖：配错了客户注册收不到验证码，生意做不成。测试信只走你自己的邮箱。</p>
        </div>
      </section>

      <!-- 域名 -->
      <section v-if="page === 'domain'" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 class="font-bold text-sm text-amber-400">域名</h2>
        <p class="text-xs text-slate-400">
          当前站点域名：
          <a :href="`https://${site.custom_domain || site.domain}`" target="_blank" rel="noopener"
             class="inline-flex items-center gap-1 text-[15px] font-bold text-cyan-300 hover:text-cyan-200 underline decoration-cyan-400/40 hover:decoration-cyan-300">
            {{ site.custom_domain || site.domain }}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
            </svg>
          </a>
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
             指向 <b class="text-amber-300">{{ site.dns_target_ip || '服务器 IP（问一下你的服务商）' }}</b></p>
          <p>② 等几分钟（DNS 生效），在下面填域名点「绑定并开通」</p>
          <p>③ 如果这里显示的是「临时证书」，过 10 分钟点一次下面的「修复域名」，就会换成正式证书</p>
          <p class="text-slate-500">用系统送的免费子域名（现在这个地址）就不用管这些，已经能直接卖。</p>
        </div>

        <div class="flex flex-col sm:flex-row gap-2">
          <input v-model="bindDomain"
                 class="w-full sm:flex-1 sm:min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                 placeholder="绑定你自己的域名，如 shop.你的品牌.com" />
          <div class="flex gap-2">
            <button @click="bindOwnDomain()" :disabled="binding"
                    class="flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold bg-amber-500 text-slate-900 hover:bg-amber-400 disabled:opacity-50 whitespace-nowrap">
              {{ binding ? '验证中…' : '绑定并开通' }}
            </button>
            <button v-if="site.custom_domain" @click="republishDomain()" :disabled="publishing"
                    class="flex-1 sm:flex-none px-3 py-2 rounded-lg text-sm font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap">
              {{ publishing ? '修复中…' : '修复域名' }}
            </button>
            <button v-if="site.custom_domain" @click="unbindDomain()" :disabled="unbinding"
                    class="flex-1 sm:flex-none px-3 py-2 rounded-lg text-sm font-bold bg-slate-800 text-slate-300 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50 whitespace-nowrap">
              {{ unbinding ? '解绑中…' : '解除绑定' }}
            </button>
          </div>
        </div>
        <div v-if="domainHint" class="bg-amber-400/10 border border-amber-500/30 rounded-lg p-3 text-[11px] text-amber-200 whitespace-pre-wrap">{{ domainHint }}</div>
      </section>

      <!-- 明细 -->
      <section v-if="page === 'orders'" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-sm text-amber-400">经营明细</h2>
          <div class="flex gap-2">
            <button @click="loadOrders()" :class="tab === 'orders' ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-300'" class="px-3 py-1 text-xs rounded-lg font-bold">订单 {{ orderTotal }}</button>
            <button @click="loadCustomers()" :class="tab === 'customers' ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-300'" class="px-3 py-1 text-xs rounded-lg font-bold">客户 {{ customerTotal }}</button>
          </div>
        </div>

        <div v-if="tab === 'orders'">
          <div v-if="orders.length === 0" class="text-center py-6 text-xs text-slate-500">还没有订单</div>
          <div v-else>
            <!-- 📊 110 期：表格在手机上会把「你赚」「状态」挤出屏幕 —— 手机上改成卡片 -->
            <div class="space-y-2 md:hidden">
              <div v-for="o in orders" :key="'m' + o.id" class="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 space-y-1.5">
                <div class="flex items-start justify-between gap-2">
                  <span class="text-slate-500 text-[11px] font-mono">{{ String(o.order_no).slice(-8) }}</span>
                  <span class="text-slate-400 text-[11px] shrink-0">{{ o.status }}</span>
                </div>
                <div class="text-slate-300 text-[12px] leading-snug truncate" :title="o.service_name">{{ (o.service_name || ('#' + o.service_id)).slice(0, 30) }}</div>
                <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                  <span class="text-slate-500">数量 {{ o.quantity }}</span>
                  <span class="text-slate-200">客户付 ¥{{ o.charge }}</span>
                  <span :class="parseFloat(o.profit) > 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'">你赚 ¥{{ o.profit }}</span>
                </div>
              </div>
            </div>
            <div class="hidden md:block overflow-x-auto">
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
          </div>
          <button v-if="orders.length < orderTotal" @click="loadMoreOrders()" class="w-full mt-2 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700">加载更多</button>
        </div>

        <div v-else>
          <div v-if="customers.length === 0" class="text-center py-6 text-xs text-slate-500">还没有客户</div>
          <div v-else>
            <div class="space-y-2 md:hidden">
              <div v-for="c in customers" :key="'m' + c.id" class="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-slate-300 text-[12px]">{{ c.phone || c.email || ('#' + c.id) }}</span>
                  <span class="text-emerald-400 text-[12px] font-bold">消费 ¥{{ c.spent }}</span>
                </div>
                <div class="flex items-center justify-between text-[11px] text-slate-400">
                  <span>余额 ¥{{ c.balance }}</span>
                  <span>{{ c.orders }} 单</span>
                  <span class="text-slate-500">{{ String(c.joined || '').slice(0, 10) }}</span>
                </div>
              </div>
            </div>
            <div class="hidden md:block overflow-x-auto">
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
          </div>
          <button v-if="customers.length < customerTotal" @click="loadMoreCustomers()" class="w-full mt-2 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700">加载更多</button>
        </div>
        <p class="text-[10px] text-slate-600">手机号/邮箱已脱敏；「你赚」= 客户付款 − 你的成本</p>
      </section>

      <!-- ⚠️ 定价页有自己的「保存定价」，这里再出现「保存全部修改」= 两个保存按钮，站长会懵 -->
      <div v-if="page !== 'orders' && page !== 'customers' && page !== 'pricing'" class="flex gap-3">
        <button @click="save()" :disabled="saving" class="flex-1 py-3 rounded-xl font-black bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 disabled:opacity-50">
          {{ saving ? '保存中…' : '保存全部修改' }}
        </button>
      </div>

      <!-- 💾 102 期：只要有未保存的改动，就浮一条保存条。
           起因：祥哥把加价率改完找不到保存（全局按钮在整页最底部；装修页/文案页要滑更久）。
           现在改完随手就能点，并且明确提示「没保存」。 -->
      <div v-if="dirty && page !== 'orders' && page !== 'customers'"
           class="sticky bottom-3 z-30 mt-3 flex items-center gap-2 rounded-xl border border-amber-400/60 bg-slate-900/95 backdrop-blur pl-3 pr-24 py-2 shadow-2xl">
        <span class="text-[11px] text-amber-300 flex-1">● 有未保存的修改</span>
        <button @click="save()" :disabled="saving"
                class="px-5 py-2 rounded-lg bg-amber-400 text-slate-900 font-black text-sm disabled:opacity-50">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
      <p v-if="page !== 'pricing'" class="text-[10px] text-slate-600 text-center">修改保存后，你的分站访客刷新页面即可看到新外观</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import DesignStudio from '../components/site/DesignStudio.vue'
import CopyStudio from '../components/site/CopyStudio.vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useUiStore } from '../stores/ui'
import SiteBilling from '../components/site/SiteBilling.vue'
import SitePricing from '../components/site/SitePricing.vue'
import SiteCustomers from '../components/site/SiteCustomers.vue'

const userStore = useUserStore()
const uiStore = useUiStore()
const router = useRouter()
const route = useRoute()

// 🧭 92 期：把原来一页到底的「我的分站」拆成 8 个页面（祥哥："是不是也要做各自页面，这样方便些"）。
//    每个页面一个地址，可以直接收藏/分享/浏览器后退；手机上不会再滑半天找不到某一项。
const PAGE_TABS = [
  { key: 'overview', icon: '🏠', label: '概览', hint: '站点信息 · 开站清单 · 收益心跳' },
  { key: 'design',   icon: '🎨', label: '装修', hint: '模板 / 色系 / 首页模块排序 + 实时预览' },
  { key: 'copy',     icon: '✍️', label: '文案', hint: '首屏版式、每块标题、按钮与图片' },
  { key: 'pricing',  icon: '💰', label: '全站价', hint: '加价率 / 单服务改价 / 折扣促销' },
  { key: 'customers', icon: '👥', label: '客户价', hint: '只给指定客户更低价' },
  { key: 'payment',  icon: '💳', label: '收款', hint: '填自己的商户，客户付款直接进你账户' },
  { key: 'email',    icon: '📧', label: '邮件', hint: '客户收到的验证码用你的品牌' },
  { key: 'domain',   icon: '🌐', label: '域名', hint: '绑定自己的域名 + 证书状态' },
  { key: 'orders',   icon: '📊', label: '经营', hint: '订单明细 / 客户消费' },
]
const page = ref('overview')
const go = (key) => router.push(key === 'overview' ? '/my-site' : `/my-site/${key}`)
watch(() => route.params.page, (v) => {
  page.value = PAGE_TABS.some(t => t.key === v) ? v : 'overview'
}, { immediate: true })
watch(page, (v) => {
  if (v === 'orders') { loadOrders(); loadCustomers() }
})
const loading = ref(true)
const billingRef = ref(null)
const billingState = ref({ isAgent: false, isStaff: false, balance: 0, monthly: 99 })
// 员工视角：这里列的是**全部**分站（GET /api/sites 对 staff 返回全量），
// 所以标题与文案不能写「我的分站」
const isStaffRole = computed(() => ['admin', 'super_admin'].includes(userStore.userInfo?.role))
// 💰 平台代收 / 提现
const settlement = ref({ available: 0, withdrawn: 0, pending_withdraw: 0, use_platform_merchant: 0, min_withdraw: 10, can_request: true, withdrawals: [], pay_mode: 'auto', channels: {} })
// 💳 收款方式三选一（祥哥 2026-10-29 定：A 平台代收 / B 自有商户 两条都要具备、免审批自助切换）
const PAY_MODES = [
  { value: 'auto', label: '自动选择', hint: '配了自己的商户就用自己的，没配就用平台代收' },
  { value: 'own', label: '只用自己的商户', hint: '钱直接进你的账号，平台一分不碰' },
  { value: 'platform', label: '只用平台代收', hint: '不用配商户，钱进主站账户、记你名下待结算' },
]
const activeChannel = computed(() => (settlement.value.channels || {}).rmb || { channel: 'off', hint: '', reason: '' })
const setPayMode = async (mode) => {
  if (!site.value || settlement.value.pay_mode === mode) return
  const r = await fetch(`/api/sites/${site.value.id}/pay-mode`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ mode }),
  }).then(x => x.json()).catch(() => null)
  uiStore.notify(r?.message || (r?.status === 'success' ? '已保存' : '切换失败'))
  if (r?.status === 'success') await loadSettlement()
}
const withdraw = ref({ amount: 0, note: '' })
const withdrawing = ref(false)
const money = (v) => Number(v || 0).toFixed(2)
const whenText = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const loadSettlement = async () => {
  if (!site.value) return
  const r = await fetch(`/api/sites/${site.value.id}/settlement`, { headers: headers() }).then(x => x.json()).catch(() => null)
  if (r?.status === 'success') settlement.value = r.data
}
const togglePlatformMerchant = async () => {
  if (!site.value) return
  const enable = !settlement.value.use_platform_merchant
  const r = await fetch(`/api/sites/${site.value.id}/platform-merchant`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ enabled: enable }),
  }).then(x => x.json())
  uiStore.notify(r.message || (r.status === 'success' ? '已保存' : '失败'))
  await loadSettlement()
}
const qrInput = ref(null)
const qrFile = ref(null)
const qrPreview = ref('')
const qrName = ref('')
const qrDrag = ref(false)

const acceptQr = (file) => {
  if (!file) return
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type || '')) return uiStore.showToast('只支持 PNG / JPG / WEBP 图片', 'error')
  if (file.size > 4 * 1024 * 1024) return uiStore.showToast('图片太大了，4MB 以内', 'error')
  if (qrPreview.value) URL.revokeObjectURL(qrPreview.value)
  qrFile.value = file
  qrName.value = file.name || '粘贴的图片'
  qrPreview.value = URL.createObjectURL(file)
}
const pickQr = (e) => { acceptQr(e.target.files?.[0] || null); if (e.target) e.target.value = '' }
const onQrDrop = (e) => {
  qrDrag.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) acceptQr(f)
}
const clearQr = () => {
  if (qrPreview.value) URL.revokeObjectURL(qrPreview.value)
  qrFile.value = null; qrPreview.value = ''; qrName.value = ''
}
// 微信/QQ 里复制图片后 Ctrl+V 直接粘（只在收款页生效）
const onPasteImage = (e) => {
  if (page.value !== 'payment') return
  const items = e.clipboardData?.items || []
  for (const it of items) {
    if (it.type && it.type.startsWith('image/')) {
      const f = it.getAsFile()
      if (f) { acceptQr(f); e.preventDefault() }
      return
    }
  }
}
const withdrawAll = () => { withdraw.value.amount = Number(settlement.value.available || 0) }
const submitWithdraw = async () => {
  if (!site.value) return
  if (!qrFile.value) return uiStore.showToast('请先上传你的收款码（点、拖、粘贴都行）', 'warning')
  if (!(Number(withdraw.value.amount) >= Number(settlement.value.min_withdraw || 10))) {
    return uiStore.notify(`最低提现 ¥${settlement.value.min_withdraw || 10}`)
  }
  withdrawing.value = true
  try {
    const fd = new FormData()
    fd.append('amount', String(withdraw.value.amount))
    fd.append('note', withdraw.value.note || '')
    fd.append('qr', qrFile.value)
    const r = await fetch(`/api/sites/${site.value.id}/withdraw`, { method: 'POST', headers: headers(), body: fd }).then(x => x.json())
    uiStore.notify(r.message || (r.status === 'success' ? '已提交' : '提交失败'))
    if (r.status === 'success') { withdraw.value = { amount: 0, note: '' }; clearQr() }
    await loadSettlement()
  } finally { withdrawing.value = false }
}


// 员工看到的这一页有**两种身份**，必须一眼分清：
//   概览 tab    → 分站管理（全部站列表，主站管理员视角）
//   其它 tab    → 站长后台（某个站自己的后台，视同站长本人）
const heading = computed(() => {
  if (page.value !== 'overview') return '站长后台'
  return isStaffRole.value ? '分站管理' : '我的分站'
})
const subheading = computed(() => {
  if (page.value === 'overview') {
    return isStaffRole.value
      ? '全部站点的运营情况 —— 点下面任意一个进入它的站长后台'
      : '改名字、换模板、填收款、绑域名、看收益 —— 都在这里'
  }
  const tag = `#${site.value?.id ?? ''} ${site.value?.name ?? ''}`
  return isStaffRole.value
    ? `${tag} · 只读查看`
    : `${tag} · 你正在经营这个站`
})
const plan = ref({ site_monthly: 99, agent_monthly: 99, renew_days: 30 })
const saving = ref(false)
const creating = ref(false)
const binding = ref(false)
const site = ref(null)
// 🏬 110 期：一个人可以有好几个分站（每站 ¥99/月），原来只认 list[0]，
//    第二个站建了也管不了、看不到。现在按 localStorage 记住当前在管哪个站。
const sitesList = ref([])
const currentSiteId = ref(Number(localStorage.getItem('xnow_site_current') || 0))
const pickSite = (e) => {
  const id = Number(e.target.value)
  const target = sitesList.value.find(x => Number(x.id) === id)
  if (target) switchSite(target)
}
const switchSite = (s) => {
  currentSiteId.value = Number(s.id)
  try { localStorage.setItem('xnow_site_current', String(s.id)) } catch (e) {}
  load()
}
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
// 🔒 97 期：这里也只用「加价率」——不再出现「不低于 N 倍」这种会泄露平台加价的提示。
const markupPct = computed(() => {
  const v = Number(site.value?.markup_pct)
  return isFinite(v) ? v : null
})
const steps = computed(() => {
  const s = site.value || {}
  const mk = markupPct.value
  return [
    {
      key: 'price',
        go: 'pricing',
      title: '设置全站价（不低于你的进货价）',
      done: mk !== null && mk >= 0,
      hint: mk === null ? '还没设置加价率' : `当前加价 ${mk}%（0% = 按进货价卖，不赚不亏）`
    },
    {
      key: 'pay',
        go: 'payment',
      title: '配置收款商户（客户才能在线充值）',
      done: !!(s.bufpay_id && s.bufpay_key) || !!(s.cryptomus_id && s.cryptomus_key),
      hint: '没配的话客户点充值会看到「暂未开通」，只能靠你手动给他加余额。'
    },
    {
      key: 'smtp',
        go: 'email',
      title: '配置发信邮箱（客户注册要收验证码）',
      done: !!(s.smtp_host && s.smtp_user && s.smtp_pass),
      hint: '没配的话客户注册不了。填完记得点「发一封测试信」。'
    },
    {
      key: 'look',
        go: 'design',
      title: '换成你自己的样子（模板 + 色系 + 页脚）',
      done: (s.template && s.template !== 'classic') || (s.color && s.color !== 'cyan') || !!s.footer_text,
      hint: '默认样式和主站相近，换成自己的模板客户才看不出是同一家。'
    },
    {
      key: 'copy',
        go: 'copy',
      title: '写自己的首页文案（标题/副标题/按钮）',
      done: !!(s.hero_title || s.hero_subtitle),
      hint: '模板决定长什么样，文案决定说什么话。默认文案和主站一模一样。'
    },
    {
      key: 'domain',
        go: 'domain',
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
    hei: '"Heiti SC", "SimHei", "Microsoft YaHei", system-ui, sans-serif',
    yahei: '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
    song: '"Songti SC", "SimSun", Georgia, serif',
    kai: '"Kaiti SC", "KaiTi", "STKaiti", serif',
    rounded: '"SF Pro Rounded", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    serif: 'Georgia, "Songti SC", "Times New Roman", serif',
    mono: '"JetBrains Mono", Consolas, "Courier New", monospace'
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
const previewModules = computed(() => (form.value.modules || []).filter(m => m && m.enabled).slice(0, 4))

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
  audience: '客户案例墙，让新客户觉得「真的有人在用」',
  steps: '三步流程图，降低「不会用」的顾虑',
  advantages: '三条核心卖点：快、值、安全',
  cta: '页面底部的行动号召（注册 / 下单）',
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

const createForm = ref({ domain: '', name: '', markup_pct: 50 })
// 👁 密钥/密码框的可视开关（站长填错密钥很常见，让他能看一眼）
const pwdShow = ref({ bufpay_key: false, cryptomus_key: false, smtp_pass: false });
const form = ref({
  name: '', markup_pct: 50, footer_text: '', support_url: '', announcement: '',
  template: 'classic', color: 'cyan', accent: '', modules: [],
  ui_radius: '', ui_density: '', card_style: '', font_style: '', btn_shape: '', hero_layout: '',
    icon_style: '', icon_shape: '',
  // 71期：背景色 / 背景图 / 字号 —— 之前只有首页悬浮编辑器能改，
  // 站长在后台面板里找不到，等于「设置里配不全」。
  bg_color: '', bg_image: '', bg_mode: '', font_scale: '',
      // 🎨 各模块自己的背景 { 模块: { bg, img } }
      sectionStyles: {},
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
    data: { template: 'saas', color: 'green', accent: '', ui_radius: 'soft', ui_density: 'normal', card_style: 'solid', font_style: 'sans', btn_shape: 'rounded', hero_layout: 'split' } },
    // 🎨 110 期：渐变风（背景是真双色渐变，而不是同一个色的深浅）
    { name: '紫蓝渐变', sw: 'linear-gradient(135deg,#a855f7,#3b82f6)',
      data: { template: 'neon', color: 'purple', accent: '', ui_radius: 'round', ui_density: 'normal', card_style: 'glass', font_style: 'sans', btn_shape: 'pill', hero_layout: 'center', bg_color: 'grad4' } },
    { name: '青蓝渐变', sw: 'linear-gradient(135deg,#22d3ee,#2563eb)',
      data: { template: 'glass', color: 'cyan', accent: '', ui_radius: 'soft', ui_density: 'normal', card_style: 'glass', font_style: 'sans', btn_shape: 'rounded', hero_layout: 'split', bg_color: 'grad5' } },
    { name: '橙红渐变', sw: 'linear-gradient(135deg,#fb923c,#ef4444)',
      data: { template: 'classic', color: 'orange', accent: '', ui_radius: 'round', ui_density: 'normal', card_style: 'solid', font_style: 'hei', btn_shape: 'pill', hero_layout: 'banner', bg_color: 'grad6' } },
    { name: '玫粉渐变', sw: 'linear-gradient(135deg,#e879f9,#f43f5e)',
      data: { template: 'magazine', color: 'red', accent: '', ui_radius: 'soft', ui_density: 'relaxed', card_style: 'glass', font_style: 'serif', btn_shape: 'pill', hero_layout: 'center', bg_color: 'grad8' } }
]

const activePreset = computed(() => {
  const f = form.value
  const hit = presets.find(p =>
    p.data.template === f.template && p.data.color === f.color &&
    (p.data.accent || '') === (f.accent || '') &&
    p.data.ui_radius === (f.ui_radius || '') && p.data.ui_density === (f.ui_density || '') &&
    p.data.card_style === (f.card_style || '') && p.data.font_style === (f.font_style || '') &&
    p.data.btn_shape === (f.btn_shape || '') && p.data.hero_layout === (f.hero_layout || '') &&
    (p.data.bg_color || '') === (f.bg_color || ''))
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
  { key: 'grad3',  name: '紫夜渐变', css: 'linear-gradient(160deg,#120a1f,#1d1030,#2a1033)' },
  // 🎨 110 期（祥哥：颜色都是单色吗，没有渐变吗）—— 补 6 套真双色渐变
  { key: 'grad4',  name: '紫蓝渐变', css: 'linear-gradient(135deg,#3b0764 0%,#1e1b4b 45%,#0c4a6e 100%)' },
  { key: 'grad5',  name: '青蓝渐变', css: 'linear-gradient(135deg,#042f2e 0%,#083344 45%,#0c2d6b 100%)' },
  { key: 'grad6',  name: '橙红渐变', css: 'linear-gradient(135deg,#451a03 0%,#4c0519 55%,#1c1917 100%)' },
  { key: 'grad7',  name: '绿青渐变', css: 'linear-gradient(135deg,#052e16 0%,#064e3b 45%,#083344 100%)' },
  { key: 'grad8',  name: '玫粉渐变', css: 'linear-gradient(135deg,#4a044e 0%,#500724 50%,#1c1917 100%)' },
  { key: 'grad9',  name: '金橙渐变', css: 'linear-gradient(135deg,#422006 0%,#451a03 50%,#1c1917 100%)' }
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
    if (f.size > 3 * 1024 * 1024) { uiStore.notify('图片不能超过 3MB，建议先压缩一下'); return }
    if (!site.value || !site.value.id) { uiStore.notify('请先创建分站'); return }
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
        // 🎨 mod:audience → 写进该模块自己的背景图
        if (String(field).startsWith('mod:')) {
          const key = String(field).slice(4)
          if (!form.value.sectionStyles) form.value.sectionStyles = {}
          if (!form.value.sectionStyles[key]) form.value.sectionStyles[key] = { bg: '', img: '' }
          form.value.sectionStyles[key].img = data.data.url
        } else {
          form.value[field] = data.data.url
        }
      } else {
        uiStore.notify(data.message || '上传失败')
      }
    } catch (e) {
      uiStore.notify('上传失败：' + e.message)
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
  // 计费规则（价格改在后台配置里，前端不用跟着改代码）
  fetch('/api/billing/plan').then(r => r.json()).then(p => {
    if (p.status === 'success') plan.value = p.data
  }).catch(() => {})
  try {
    const res = await fetch('/api/sites', { headers: headers() })
    const data = await res.json()
    const list = data.data || []
    sitesList.value = list
    site.value = list.find(x => Number(x.id) === Number(currentSiteId.value)) || list[0] || null
    if (site.value) {
      currentSiteId.value = Number(site.value.id)
      try { localStorage.setItem('xnow_site_current', String(site.value.id)) } catch (e) {}
    }
    // 站长后台只属于站长。主站管理员没有入口能进来（密室只能看数据 + 停站/恢复/延期/删站）。
    // 误入就送回密室的「分站管理」。（110 期祥哥定调：不需要「申请协助/代管」这套）
    // 收款页要用到代收/提现数据，进站就顺手拉一次
    loadSettlement()
    if (isStaffRole.value) {
      // 站长后台只属于站长：主站管理员没有入口（密室只能看数据 + 停站/恢复/延期/删站）
      router.replace('/admin/sites')
      return
    }
    if (site.value) {
      const s = site.value
      form.value = {
        name: s.name || '', markup_pct: Number(s.markup_pct ?? 50),
        footer_text: s.footer_text || '', support_url: s.support_url || '',
        announcement: s.announcement || '',
        template: s.template || 'classic', color: s.color || 'cyan', accent: s.accent || '',
        ui_radius: s.ui_radius || '', ui_density: s.ui_density || '',
        bg_color: s.bg_color || '', bg_image: s.bg_image || '', bg_mode: s.bg_mode || '', font_scale: s.font_scale || '',
      sectionStyles: (() => {
        try { return s.section_styles ? JSON.parse(s.section_styles) : {}; } catch { return {}; }
      })(),
        card_style: s.card_style || '', font_style: s.font_style || '',
        icon_style: s.icon_style || '', icon_shape: s.icon_shape || '',
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
      // 载入完成即「无未保存改动」
      await nextTick()
      savedSig.value = formSig.value
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

// ⚠️ 110 期修：老数据里的 home_modules 可能带 null / 不认识的 key（历史上模块增删过），
//    直接渲染会抛 "Cannot read properties of undefined (reading 'key')"，
//    整页装修就白屏了。这里统一洗一遍：丢掉坏条目、补齐新模块。
const parseModules = (raw) => {
  const KEYS = Object.keys(MODULES)
  const defaults = KEYS.map((k, i) => ({ key: k, enabled: true, order: i }))
  if (!raw) return defaults
  let arr = []
  try { arr = JSON.parse(raw) } catch (e) { return defaults }
  if (!Array.isArray(arr)) return defaults
  const clean = arr
    .filter(m => m && typeof m === 'object' && KEYS.includes(m.key))
    .map((m, i) => ({ key: m.key, enabled: m.enabled !== false, order: i }))
  // 补齐代码里新加、库里还没有的模块（否则站长永远看不到它们）
  for (const k of KEYS) {
    if (!clean.some(m => m.key === k)) clean.push({ key: k, enabled: true, order: clean.length })
  }
  return clean.length ? clean : defaults
}

const moveModule = (i, dir) => {
  const arr = form.value.modules
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  const t = arr[i]; arr[i] = arr[j]; arr[j] = t
  arr.forEach((m, idx) => (m.order = idx))
}

// 💾 「有没有未保存的改动」：当前表单与上次载入/保存时的快照对比
const savedSig = ref('')
const formSig = computed(() => {
  try { return JSON.stringify(form.value) } catch (e) { return '' }
})
const dirty = computed(() => !!savedSig.value && !!site.value && formSig.value !== savedSig.value)

// 💾 加价率就地保存（见模板注释）
const markupMsg = ref('')
const markupOk = ref(true)
const markupDirty = computed(() => {
  if (!site.value) return false
  return Number(form.value.markup_pct || 0) !== Number(site.value.markup_pct || 0)
})
const saveMarkup = async () => {
  const v = Number(form.value.markup_pct)
  if (!Number.isFinite(v) || v < 0 || v > 2000) {
    markupOk.value = false
    markupMsg.value = '加价率要填 0 ~ 2000 之间的数字'
    return
  }
  markupOk.value = true
  markupMsg.value = ''
  const ok = await save(true)   // 静默保存，不要弹 alert（手机上很烦）
  markupOk.value = ok
  markupMsg.value = ok ? `✅ 已保存：加价率 ${v}%，客户刷新即可看到新价格` : '❌ 保存失败，请再点一次'
}

const save = async (silent = false) => {
  if (!site.value) return false
  saving.value = true
  try {
    const payload = {
      name: form.value.name, markup_pct: form.value.markup_pct,
      footer_text: form.value.footer_text, support_url: form.value.support_url,
      announcement: form.value.announcement,
      template: form.value.template, color: form.value.color, accent: form.value.accent,
      ui_radius: form.value.ui_radius, ui_density: form.value.ui_density,
      bg_color: form.value.bg_color || '', bg_image: form.value.bg_image || '', bg_mode: form.value.bg_mode || '', font_scale: form.value.font_scale || '',
      section_styles: JSON.stringify(form.value.sectionStyles || {}),
      card_style: form.value.card_style, font_style: form.value.font_style,
      icon_style: form.value.icon_style, icon_shape: form.value.icon_shape,
      btn_shape: form.value.btn_shape, hero_layout: form.value.hero_layout,
      home_modules: JSON.stringify((form.value.modules || []).filter(m => m && m.key).map((m, i) => ({ key: m.key, enabled: !!m.enabled, order: i }))),
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
    if (!silent) uiStore.notify(data.status === 'success' ? '✅ 已保存，访客刷新即可看到新外观' : `❌ ${data.message}`)
    if (data.status === 'success') { savedSig.value = formSig.value; await load() }
    return data.status === 'success'
  } catch (e) { if (!silent) uiStore.notify('保存失败'); return false } finally { saving.value = false }
}

// 预览卡里的三行服务（展示"你的站、你定的价"）
const previewRows = [
  { n: 'TikTok 千粉', p: '45', dot: 'bg-pink-400' },
  { n: 'IG 万粉', p: '180', dot: 'bg-violet-400' },
  { n: 'YouTube 播放', p: '68', dot: 'bg-sky-400' },
]

// 无站时的居中大卡片（文案与 /my-site/new 一致）
const heroStats = [
  { k: '¥99', d: '每月 / 每站', c: 'text-amber-300' },
  { k: '10 分钟', d: '开完就能卖', c: 'text-emerald-400' },
  { k: '不抽成', d: '全归你', c: 'text-slate-100' },
]
const heroFeatures = [
  { i: '🎨', t: '你的品牌', d: '站名、域名、模板随便换', bg: 'bg-pink-500/15 text-pink-300' },
  { i: '💳', t: '钱进你账户', d: '客户充值进你的收款商户', bg: 'bg-sky-500/15 text-sky-300' },
  { i: '⚡', t: '自动交付', d: '下单即发，不用手工', bg: 'bg-amber-500/15 text-amber-300' },
  { i: '📈', t: '价格你定', d: '整站加价，单服务也能改', bg: 'bg-violet-500/15 text-violet-300' },
]

// 🚦 停站后的三种恢复动作
const busyStop = ref(false)
const stopMsg = ref('')
const stopMsgOk = ref(true)

const afterRestore = (ok, text) => {
  stopMsgOk.value = ok
  stopMsg.value = text
  if (ok) setTimeout(() => load(), 600)
}

const renewSiteFee = async () => {
  if (busyStop.value) return
  busyStop.value = true; stopMsg.value = ''
  try {
    const r = await fetch(`/api/billing/site/${site.value.id}/renew`, { method: 'POST', headers: headers() }).then(x => x.json())
    afterRestore(r.status === 'success', (r.status === 'success' ? '✅ ' : '❌ ') + (r.message || ''))
  } catch (e) { afterRestore(false, '❌ ' + e.message) }
  finally { busyStop.value = false }
}

const createSite = async () => {
  creating.value = true
  try {
    const payload = {
      name: createForm.value.name,
      markup_pct: createForm.value.markup_pct
    }
    // 域名留空 = 让后端自动分配免费子域名
    const d = String(createForm.value.domain || '').trim()
    if (d) payload.domain = d

    const res = await fetch('/api/sites', {
      method: 'POST', headers: headers(),
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    uiStore.notify(data.status === 'success' ? `✅ ${data.message}` : `❌ ${data.message}`)
    if (data.status === 'success') {
      createForm.value.domain = ''
      load()
      billingRef.value?.load?.()
    }
  } catch (e) { uiStore.notify('开通失败') } finally { creating.value = false }
}

// 🔓 解绑自有域名（94 期）：站长填错 / 想换域名时得能退回来。
//    后端 DELETE /api/sites/:id/domain 会顺手清掉旧域名的 vhost 与证书，
//    否则那条 nginx 配置会一直留着抢域名，站长自己解决不了。
const unbinding = ref(false)
const unbindDomain = async () => {
  if (!site.value) return
  if (!await uiStore.confirm(`确定解除绑定 ${site.value.custom_domain}？\n解绑后这个域名不再指向你的站点，系统送的子域名不受影响。`)) return
  unbinding.value = true
  try {
    const res = await fetch(`/api/sites/${site.value.id}/domain`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userStore.token}` },
    })
    const data = await res.json()
    domainHint.value = data.message || (data.status === 'success' ? '已解除绑定' : '解绑失败')
    if (data.status === 'success') { bindDomain.value = ''; await load() }
  } catch (e) {
    domainHint.value = '解绑失败：' + e.message
  } finally {
    unbinding.value = false
  }
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
      uiStore.notify(`✅ ${data.message}`)
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


onMounted(async () => {
  window.addEventListener('paste', onPasteImage)


  await load()
  if (site.value) { loadOrders(); loadHotPrice() }
})

onBeforeUnmount(() => {
  window.removeEventListener('paste', onPasteImage)
  if (qrPreview.value) URL.revokeObjectURL(qrPreview.value)
})
</script>

<style scoped>
/* 🎨 无站 hero 的视觉层（祥哥：视觉效果不够）
   全部纯 CSS，不加图片、不加依赖：光晕呼吸、点阵网格、卡片微微倾斜、按钮扫光。 */
.hero-wrap {
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(245, 158, 11, 0.11) 0%, rgba(15, 23, 42, 0) 55%),
    radial-gradient(80% 60% at 50% 100%, rgba(16, 185, 129, 0.10) 0%, rgba(15, 23, 42, 0) 60%),
    #0b1220;
}
.hero-glow {
  background: radial-gradient(60% 40% at 50% 12%, rgba(251, 191, 36, 0.15), transparent 70%);
  animation: heroBreathe 7s ease-in-out infinite;
}
.hero-dots {
  background-image: radial-gradient(rgba(148, 163, 184, 0.35) 1px, transparent 1px);
  background-size: 16px 16px;
  mask-image: radial-gradient(70% 60% at 50% 40%, #000 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(70% 60% at 50% 40%, #000 30%, transparent 75%);
}
.hero-title { filter: drop-shadow(0 0 26px rgba(245, 158, 11, 0.35)); }
.hero-float { animation: heroFloat 9s ease-in-out infinite; }
.hero-float-slow { animation: heroFloat 13s ease-in-out infinite reverse; }
.hero-tilt {
  transform: perspective(900px) rotateX(4deg);
  transition: transform 0.5s ease;
}
.hero-tilt:hover { transform: perspective(900px) rotateX(0deg) translateY(-2px); }
.hero-pulse { animation: heroPulse 2s ease-in-out infinite; }
/* 按钮扫光：一道斜向高光从左扫到右 */
.hero-cta::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0; width: 40%;
  left: -60%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.55), transparent);
  transform: skewX(-18deg);
  animation: heroShine 3.6s ease-in-out infinite;
}
@keyframes heroBreathe { 0%, 100% { opacity: 0.75; } 50% { opacity: 1; } }
@keyframes heroFloat {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(0, -18px, 0) scale(1.06); }
}
@keyframes heroPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(0.85); } }
@keyframes heroShine {
  0% { left: -60%; }
  55% { left: 130%; }
  100% { left: 130%; }
}
@media (prefers-reduced-motion: reduce) {
  .hero-glow, .hero-float, .hero-float-slow, .hero-pulse, .hero-cta::after { animation: none !important; }
  .hero-tilt { transform: none; }
}
</style>
