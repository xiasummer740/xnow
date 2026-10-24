<template>
  <div class="p-4 md:p-6 max-w-5xl mx-auto text-slate-200">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-black">我的分站</h1>
        <p class="text-xs text-slate-500 mt-1">改名字、换模板、填收款、绑域名、看收益 —— 都在这里</p>
      </div>
      <button @click="load()" class="px-3 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 whitespace-nowrap">刷新</button>
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

    <!-- 💳 代理资格 + 分站月费（87 期商业化） -->
    <SiteBilling ref="billingRef" @changed="load()" @status="billingState = $event" />

    <div v-if="loading" class="text-center py-20 text-slate-500">加载中…</div>

    <!-- 还不是代理 → 先开通代理（上面那张卡就是入口，这里只做解释） -->
    <div v-else-if="!site && !billingState.isAgent" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-center">
      <div class="text-3xl mb-2">🔒</div>
      <h2 class="font-bold mb-2">还没有至尊代理资格</h2>
      <p class="text-xs text-slate-400 leading-relaxed">
        开分站需要先开通至尊代理（¥{{ plan.agent_monthly }}/月）。<br />
        开通后即可创建分站：首个分站 {{ plan.trial_hours }} 小时免费试用，之后 ¥{{ plan.site_monthly }}/月 / 站。
      </p>
    </div>

    <!-- 还没有分站 → 创建 -->
    <div v-else-if="!site" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
      <h2 class="font-bold mb-4">开通你的分站</h2>
      <div class="space-y-3">
        <p class="text-[11px] text-amber-500/90 bg-amber-950/20 border border-amber-900/40 rounded-lg px-3 py-2 leading-relaxed">
          💳 首个分站 <b>{{ plan.trial_hours }} 小时免费试用</b>，之后 <b>¥{{ plan.site_monthly }}/月</b>；
          每个分站单独计费，到期未续费会停站（数据保留，续费即恢复）。
        </p>
        <div>
          <label class="block text-xs text-slate-400 mb-1">
            站点域名 <span class="text-slate-500">（可不填 —— 留空自动分配一个免费子域名，之后也能改成自己的域名）</span>
          </label>
          <input v-model="createForm.domain" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="myshop.xnow.taikon.top" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">站点名称</label>
          <input v-model="createForm.name" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="我的数字营销" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">
            加价率（在进货价上加多少 %，越高客户付得越多、你赚得越多）
          </label>
          <input v-model.number="createForm.markup_pct" type="number" step="10" min="0" max="2000" inputmode="numeric" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          <p class="text-[10px] text-amber-500/80 mt-1">
            例：填 <b>50</b> = 客户看到的价格是你的进货价 × 1.5。系统会拦住亏本设置（低于 0% 不许保存）。
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
        <p class="text-[10px] text-slate-500 mt-3">清单只是提醒，不拦着你开卖。但「收款」没配，客户充不了值；「发信」没配，客户收到的邮件会从平台邮箱发出（个别情况下甚至发不出去）。</p>
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
          <span class="block mt-1 text-slate-500">这里的价优先级高于「全站价」里的限时折扣。客户线下转账给你，也在这里手动加余额。</span>
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

      <!-- 收款 -->
      <section v-if="page === 'payment'" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
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
      <section v-if="page === 'email'" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
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
      <section v-if="page === 'domain'" class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
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

      <div v-if="page !== 'orders' && page !== 'customers'" class="flex gap-3">
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
      <p class="text-[10px] text-slate-600 text-center">修改保存后，你的分站访客刷新页面即可看到新外观</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import DesignStudio from '../components/site/DesignStudio.vue'
import CopyStudio from '../components/site/CopyStudio.vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'
import SiteBilling from '../components/site/SiteBilling.vue'
import SitePricing from '../components/site/SitePricing.vue'
import SiteCustomers from '../components/site/SiteCustomers.vue'

const userStore = useUserStore()
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
const plan = ref({ site_monthly: 99, agent_monthly: 99, trial_hours: 24 })
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
  // 计费规则（价格改在后台配置里，前端不用跟着改代码）
  fetch('/api/billing/plan').then(r => r.json()).then(p => {
    if (p.status === 'success') plan.value = p.data
  }).catch(() => {})
  try {
    const res = await fetch('/api/sites', { headers: headers() })
    const data = await res.json()
    const list = data.data || []
    site.value = list[0] || null
    if (site.value) {
      const s = site.value
      form.value = {
        name: s.name || '', markup_pct: Number(s.markup_pct ?? 50),
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
    if (data.status === 'success') { savedSig.value = formSig.value; await load() }
    return data.status === 'success'
  } catch (e) { if (!silent) alert('保存失败'); return false } finally { saving.value = false }
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
    alert(data.status === 'success' ? `✅ ${data.message}` : `❌ ${data.message}`)
    if (data.status === 'success') {
      createForm.value.domain = ''
      load()
      billingRef.value?.load?.()
    }
  } catch (e) { alert('开通失败') } finally { creating.value = false }
}

// 🔓 解绑自有域名（94 期）：站长填错 / 想换域名时得能退回来。
//    后端 DELETE /api/sites/:id/domain 会顺手清掉旧域名的 vhost 与证书，
//    否则那条 nginx 配置会一直留着抢域名，站长自己解决不了。
const unbinding = ref(false)
const unbindDomain = async () => {
  if (!site.value) return
  if (!confirm(`确定解除绑定 ${site.value.custom_domain}？\n解绑后这个域名不再指向你的站点，平台送的子域名不受影响。`)) return
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


onMounted(async () => {
  await load()
  if (site.value) { loadOrders(); loadHotPrice() }
})
</script>
