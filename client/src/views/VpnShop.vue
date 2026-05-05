<template>
  <div class="min-h-full text-white space-y-8">
    <!-- Hero -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 border border-slate-700/50 p-8 md:p-14 shadow-2xl">
      <div class="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>
      <div class="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-[60px] pointer-events-none"></div>
      <div class="relative z-10 max-w-3xl">
        <div class="inline-block mb-4 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs md:text-sm font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(16,185,129,0.2)] backdrop-blur-md">
          {{ appStore.lang === 'zh' ? '⚡ 亚太 · 欧美高速加密网络' : '⚡ ASIA-PACIFIC & EU/US NETWORK' }}
        </div>
        <h1 class="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight mb-6 drop-shadow-2xl">
          {{ appStore.lang === 'zh' ? '突破边界' : 'Break Through' }}<br/>
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-400 to-cyan-500 drop-shadow-[0_0_30px_rgba(45,212,191,0.3)]">{{ appStore.lang === 'zh' ? '自由访问国际网络' : 'Borderless Internet Access' }}</span>
        </h1>
        <p class="text-slate-300 text-base md:text-lg max-w-2xl mb-8 leading-relaxed font-light">
          {{ appStore.lang === 'zh' ? '基于 Xray 核心构建的企业级加密隧道，覆盖日本、香港、新加坡、美国、德国等优质节点。流量自由选配，即买即用，全协议兼容。' : 'Enterprise-grade encrypted tunnels powered by Xray Core. Nodes in Japan, HK, Singapore, US, Germany. Flexible traffic, instant activation.' }}
        </p>
      </div>
    </div>

    <!-- Features -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div class="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6 hover:border-emerald-500/30 transition group shadow-lg">
        <div class="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition">🔐</div>
        <h3 class="text-base font-bold text-white mb-2">{{ appStore.lang === 'zh' ? '端到端加密' : 'E2E Encryption' }}</h3>
        <p class="text-slate-500 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? 'TLS + Reality 双重加密，流量指纹伪装，确保您的网络通信绝对私密。' : 'Dual-layer TLS + Reality encryption with traffic fingerprint masking.' }}</p>
      </div>
      <div class="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6 hover:border-emerald-500/30 transition group shadow-lg">
        <div class="w-12 h-12 bg-teal-500/10 text-teal-400 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition">🌍</div>
        <h3 class="text-base font-bold text-white mb-2">{{ appStore.lang === 'zh' ? '灵活流量配置' : 'Flexible Traffic' }}</h3>
        <p class="text-slate-500 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? '100GB ~ 2000GB 自由选择，按月/季/半年/年购买，长期套餐享额外折扣。' : '100GB to 2000GB flexible plans. Monthly to yearly, long-term discounts available.' }}</p>
      </div>
      <div class="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6 hover:border-emerald-500/30 transition group shadow-lg">
        <div class="w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition">⚡</div>
        <h3 class="text-base font-bold text-white mb-2">{{ appStore.lang === 'zh' ? '全协议兼容' : 'All Protocols' }}</h3>
        <p class="text-slate-500 text-sm leading-relaxed">{{ appStore.lang === 'zh' ? 'VLESS / VMess / Trojan / Shadowsocks 全协议支持，覆盖所有主流客户端。' : 'VLESS, VMess, Trojan, Shadowsocks — compatible with all major clients.' }}</p>
      </div>
    </div>

    <!-- Purchase Section -->
    <div id="products">
      <h2 class="text-2xl md:text-3xl font-black text-white mb-6">{{ appStore.lang === 'zh' ? '选择节点与流量' : 'Select Node & Traffic' }}</h2>

      <div v-if="loading" class="flex justify-center py-20"><div class="animate-spin rounded-full h-10 w-10 border-2 border-emerald-400 border-t-transparent"></div></div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left: Node Selection -->
        <div class="lg:col-span-1 space-y-3">
          <div v-for="n in nodes" :key="n.id" @click="selectedNode = n" :class="['rounded-2xl p-4 border cursor-pointer transition-all', selectedNode?.id === n.id ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'border-slate-700/50 bg-slate-900/60 hover:border-slate-600']">
            <div class="flex items-center justify-between">
              <span class="text-lg">{{ getFlag(n) }}</span>
              <span v-if="selectedNode?.id === n.id" class="text-emerald-400 text-xs font-bold">✓ 已选</span>
            </div>
            <h3 class="font-bold text-white mt-2">{{ n.name }}</h3>
            <p class="text-xs text-slate-500 mt-1">{{ n.vps_location }}</p>
            <p class="text-xs text-slate-500 mt-1">¥{{ parseFloat(n.price_per_gb).toFixed(2) }}/GB · 上限 {{ n.max_traffic_gb }}GB</p>
          </div>
          <div v-if="nodes.length === 0" class="text-center py-10 text-slate-500 bg-slate-900/60 rounded-2xl border border-slate-700/50">
            <div class="text-3xl mb-2">🖥️</div>
            <p>{{ appStore.lang === 'zh' ? '暂无可用节点' : 'No nodes available' }}</p>
          </div>
        </div>

        <!-- Right: Config -->
        <div class="lg:col-span-2 bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6 space-y-6">
          <div v-if="!selectedNode" class="text-center py-10 text-slate-500">{{ appStore.lang === 'zh' ? '👈 请先选择节点' : '👈 Select a node first' }}</div>
          <template v-else>
            <!-- Traffic Selection -->
            <div>
              <h3 class="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">{{ appStore.lang === 'zh' ? '📦 选择流量' : '📦 Traffic' }}</h3>
              <div class="grid grid-cols-3 md:grid-cols-5 gap-2">
                <button v-for="g in trafficOptions.filter(t => t <= (selectedNode?.max_traffic_gb || 2000))" :key="g" @click="selectedTraffic = g" :class="['py-3 rounded-xl font-bold text-sm transition', selectedTraffic === g ? 'bg-emerald-500 text-slate-900 shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700']">
                  {{ g >= 1000 ? (g/1000).toFixed(1)+'TB' : g+'GB' }}
                </button>
              </div>
            </div>

            <!-- Duration Selection -->
            <div>
              <h3 class="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">{{ appStore.lang === 'zh' ? '📅 选择时长' : '📅 Duration' }}</h3>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button v-for="d in durationOptions" :key="d.days" @click="selectedDuration = d" :class="['py-3 rounded-xl font-bold text-sm transition text-center', selectedDuration?.days === d.days ? 'bg-emerald-500 text-slate-900 shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700']">
                  <div>{{ d.label }}</div>
                  <div v-if="d.discount < 1" class="text-xs opacity-60 mt-0.5">{{ appStore.lang === 'zh' ? '享' : '' }}{{Math.round((1-d.discount)*100)}}%{{ appStore.lang === 'zh' ? '折扣' : ' OFF' }}</div>
                </button>
              </div>
            </div>

            <!-- Price Summary -->
            <div class="bg-slate-800/80 rounded-2xl p-5 space-y-2">
              <div class="flex justify-between text-sm text-slate-400">
                <span>{{ selectedNode.name }} · {{ selectedTraffic }}GB · {{ selectedDuration?.label }}</span>
                <span>{{ appStore.lang === 'zh' ? '基础价' : 'Base' }}: ¥{{ basePrice.toFixed(2) }}</span>
              </div>
              <div v-if="selectedDuration?.discount < 1" class="flex justify-between text-sm text-emerald-400">
                <span>{{ appStore.lang === 'zh' ? '长期折扣' : 'Bulk Discount' }}</span>
                <span>-{{Math.round((1-selectedDuration.discount)*100)}}%</span>
              </div>
              <div class="h-px bg-slate-700"></div>
              <div class="flex justify-between items-center">
                <span class="text-slate-300 text-sm">{{ appStore.lang === 'zh' ? '应付金额' : 'Total' }}</span>
                <span class="text-3xl font-black text-emerald-400">¥{{ finalPrice.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-xs" :class="parseFloat(userStore.userInfo?.balance || 0) < finalPrice ? 'text-red-400' : 'text-slate-500'">
                <span>{{ appStore.lang === 'zh' ? '余额' : 'Balance' }}: ¥{{ parseFloat(userStore.userInfo?.balance || 0).toFixed(2) }}</span>
                <span v-if="parseFloat(userStore.userInfo?.balance || 0) < finalPrice">⚠️ {{ appStore.lang === 'zh' ? '余额不足' : 'Insufficient' }}</span>
              </div>
              <router-link v-if="parseFloat(userStore.userInfo?.balance || 0) < finalPrice" to="/recharge" class="block text-center text-xs text-amber-400 hover:text-amber-300 py-1">💳 {{ appStore.lang === 'zh' ? '余额不足？点击充值' : 'Low balance? Recharge here' }}</router-link>
              <button @click="buy" :disabled="buying" class="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-base transition transform hover:-translate-y-0.5 shadow-[0_5px_20px_rgba(16,185,129,0.2)] disabled:opacity-50 disabled:cursor-not-allowed">
                {{ buying ? '...' : (appStore.lang === 'zh' ? '立即购买' : 'Buy Now') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Success Modal -->
    <div v-if="showSuccess" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div class="bg-slate-900 border-2 border-emerald-500/50 p-8 rounded-3xl shadow-[0_0_60px_rgba(16,185,129,0.2)] max-w-md w-full text-center space-y-4">
        <div class="text-5xl">✅</div>
        <h2 class="text-xl font-black text-white">{{ appStore.lang === 'zh' ? '购买成功！' : 'Purchase Successful!' }}</h2>
        <p v-if="purchaseResult?.email" class="text-xs text-slate-400 font-mono bg-slate-800 rounded-lg px-3 py-1.5">{{ purchaseResult.email }}</p>
        <p class="text-slate-400 text-sm">{{ appStore.lang === 'zh' ? '节点已创建，可在「我的节点」中查看连接信息。' : 'Your node is ready.' }}</p>
        <button @click="goToClients" class="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold transition">{{ appStore.lang === 'zh' ? '查看我的节点' : 'View My Nodes' }}</button>
        <button @click="showSuccess = false" class="w-full py-2 text-slate-500 text-sm hover:text-white transition">{{ appStore.lang === 'zh' ? '继续选购' : 'Continue Shopping' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/app';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui';

const router = useRouter();
const appStore = useAppStore(); const userStore = useUserStore(); const uiStore = useUiStore();

const FLAG_MAP = {
  // East Asia
  hk: '🇭🇰', hongkong: '🇭🇰', 香港: '🇭🇰',
  jp: '🇯🇵', japan: '🇯🇵', 日本: '🇯🇵',
  kr: '🇰🇷', korea: '🇰🇷', southkorea: '🇰🇷', 韩国: '🇰🇷', 南韩: '🇰🇷',
  tw: '🇹🇼', taiwan: '🇹🇼', 台湾: '🇹🇼',
  cn: '🇨🇳', china: '🇨🇳', 中国: '🇨🇳', 大陆: '🇨🇳',
  mo: '🇲🇴', macau: '🇲🇴', 澳门: '🇲🇴',
  mn: '🇲🇳', mongolia: '🇲🇳', 蒙古: '🇲🇳',
  // Southeast Asia
  sg: '🇸🇬', singapore: '🇸🇬', 新加坡: '🇸🇬',
  th: '🇹🇭', thailand: '🇹🇭', 泰国: '🇹🇭',
  vn: '🇻🇳', vietnam: '🇻🇳', 越南: '🇻🇳',
  my: '🇲🇾', malaysia: '🇲🇾', 马来西亚: '🇲🇾',
  ph: '🇵🇭', philippines: '🇵🇭', 菲律宾: '🇵🇭',
  id: '🇮🇩', indonesia: '🇮🇩', 印尼: '🇮🇩', 印度尼西亚: '🇮🇩',
  kh: '🇰🇭', cambodia: '🇰🇭', 柬埔寨: '🇰🇭',
  la: '🇱🇦', laos: '🇱🇦', 老挝: '🇱🇦',
  mm: '🇲🇲', myanmar: '🇲🇲', 缅甸: '🇲🇲',
  bn: '🇧🇳', brunei: '🇧🇳', 文莱: '🇧🇳',
  tl: '🇹🇱', timorleste: '🇹🇱', 东帝汶: '🇹🇱',
  // South Asia
  in: '🇮🇳', india: '🇮🇳', 印度: '🇮🇳',
  pk: '🇵🇰', pakistan: '🇵🇰', 巴基斯坦: '🇵🇰',
  bd: '🇧🇩', bangladesh: '🇧🇩', 孟加拉: '🇧🇩', 孟加拉国: '🇧🇩',
  lk: '🇱🇰', srilanka: '🇱🇰', 斯里兰卡: '🇱🇰',
  np: '🇳🇵', nepal: '🇳🇵', 尼泊尔: '🇳🇵',
  // Central Asia
  kz: '🇰🇿', kazakhstan: '🇰🇿', 哈萨克斯坦: '🇰🇿', 哈萨克: '🇰🇿',
  uz: '🇺🇿', uzbekistan: '🇺🇿', 乌兹别克斯坦: '🇺🇿',
  // Middle East
  ae: '🇦🇪', uae: '🇦🇪', dubai: '🇦🇪', 阿联酋: '🇦🇪', 迪拜: '🇦🇪',
  sa: '🇸🇦', saudiarabia: '🇸🇦', 沙特: '🇸🇦', 沙特阿拉伯: '🇸🇦',
  qa: '🇶🇦', qatar: '🇶🇦', 卡塔尔: '🇶🇦',
  kw: '🇰🇼', kuwait: '🇰🇼', 科威特: '🇰🇼',
  bh: '🇧🇭', bahrain: '🇧🇭', 巴林: '🇧🇭',
  om: '🇴🇲', oman: '🇴🇲', 阿曼: '🇴🇲',
  il: '🇮🇱', israel: '🇮🇱', 以色列: '🇮🇱',
  jo: '🇯🇴', jordan: '🇯🇴', 约旦: '🇯🇴',
  lb: '🇱🇧', lebanon: '🇱🇧', 黎巴嫩: '🇱🇧',
  iq: '🇮🇶', iraq: '🇮🇶', 伊拉克: '🇮🇶',
  ir: '🇮🇷', iran: '🇮🇷', 伊朗: '🇮🇷',
  sy: '🇸🇾', syria: '🇸🇾', 叙利亚: '🇸🇾',
  tr: '🇹🇷', turkey: '🇹🇷', turkiye: '🇹🇷', 土耳其: '🇹🇷',
  cy: '🇨🇾', cyprus: '🇨🇾', 塞浦路斯: '🇨🇾',
  // Europe - West
  uk: '🇬🇧', gb: '🇬🇧', england: '🇬🇧', britain: '🇬🇧', 英国: '🇬🇧',
  ie: '🇮🇪', ireland: '🇮🇪', 爱尔兰: '🇮🇪',
  fr: '🇫🇷', france: '🇫🇷', 法国: '🇫🇷',
  de: '🇩🇪', germany: '🇩🇪', 德国: '🇩🇪',
  nl: '🇳🇱', netherlands: '🇳🇱', 荷兰: '🇳🇱',
  be: '🇧🇪', belgium: '🇧🇪', 比利时: '🇧🇪',
  lu: '🇱🇺', luxembourg: '🇱🇺', 卢森堡: '🇱🇺',
  ch: '🇨🇭', switzerland: '🇨🇭', 瑞士: '🇨🇭',
  at: '🇦🇹', austria: '🇦🇹', 奥地利: '🇦🇹',
  // Europe - North
  se: '🇸🇪', sweden: '🇸🇪', 瑞典: '🇸🇪',
  no: '🇳🇴', norway: '🇳🇴', 挪威: '🇳🇴',
  dk: '🇩🇰', denmark: '🇩🇰', 丹麦: '🇩🇰',
  fi: '🇫🇮', finland: '🇫🇮', 芬兰: '🇫🇮',
  is: '🇮🇸', iceland: '🇮🇸', 冰岛: '🇮🇸',
  ee: '🇪🇪', estonia: '🇪🇪', 爱沙尼亚: '🇪🇪',
  lv: '🇱🇻', latvia: '🇱🇻', 拉脱维亚: '🇱🇻',
  lt: '🇱🇹', lithuania: '🇱🇹', 立陶宛: '🇱🇹',
  // Europe - South
  it: '🇮🇹', italy: '🇮🇹', 意大利: '🇮🇹',
  es: '🇪🇸', spain: '🇪🇸', 西班牙: '🇪🇸',
  pt: '🇵🇹', portugal: '🇵🇹', 葡萄牙: '🇵🇹',
  gr: '🇬🇷', greece: '🇬🇷', 希腊: '🇬🇷',
  mt: '🇲🇹', malta: '🇲🇹', 马耳他: '🇲🇹',
  // Europe - East
  pl: '🇵🇱', poland: '🇵🇱', 波兰: '🇵🇱',
  cz: '🇨🇿', czech: '🇨🇿', czechia: '🇨🇿', 捷克: '🇨🇿',
  sk: '🇸🇰', slovakia: '🇸🇰', 斯洛伐克: '🇸🇰',
  hu: '🇭🇺', hungary: '🇭🇺', 匈牙利: '🇭🇺',
  ro: '🇷🇴', romania: '🇷🇴', 罗马尼亚: '🇷🇴',
  bg: '🇧🇬', bulgaria: '🇧🇬', 保加利亚: '🇧🇬',
  hr: '🇭🇷', croatia: '🇭🇷', 克罗地亚: '🇭🇷',
  si: '🇸🇮', slovenia: '🇸🇮', 斯洛文尼亚: '🇸🇮',
  rs: '🇷🇸', serbia: '🇷🇸', 塞尔维亚: '🇷🇸',
  ua: '🇺🇦', ukraine: '🇺🇦', 乌克兰: '🇺🇦',
  // Europe - East (former USSR)
  ru: '🇷🇺', russia: '🇷🇺', 俄罗斯: '🇷🇺',
  by: '🇧🇾', belarus: '🇧🇾', 白俄罗斯: '🇧🇾',
  md: '🇲🇩', moldova: '🇲🇩', 摩尔多瓦: '🇲🇩',
  ge: '🇬🇪', georgia: '🇬🇪', 格鲁吉亚: '🇬🇪',
  am: '🇦🇲', armenia: '🇦🇲', 亚美尼亚: '🇦🇲',
  az: '🇦🇿', azerbaijan: '🇦🇿', 阿塞拜疆: '🇦🇿',
  // North America
  us: '🇺🇸', usa: '🇺🇸', america: '🇺🇸', 美国: '🇺🇸',
  ca: '🇨🇦', canada: '🇨🇦', 加拿大: '🇨🇦',
  mx: '🇲🇽', mexico: '🇲🇽', 墨西哥: '🇲🇽',
  // Central America / Caribbean
  pa: '🇵🇦', panama: '🇵🇦', 巴拿马: '🇵🇦',
  cr: '🇨🇷', costarica: '🇨🇷', 哥斯达黎加: '🇨🇷',
  bz: '🇧🇿', belize: '🇧🇿', 伯利兹: '🇧🇿',
  gt: '🇬🇹', guatemala: '🇬🇹', 危地马拉: '🇬🇹',
  sv: '🇸🇻', elsalvador: '🇸🇻', 萨尔瓦多: '🇸🇻',
  hn: '🇭🇳', honduras: '🇭🇳', 洪都拉斯: '🇭🇳',
  ni: '🇳🇮', nicaragua: '🇳🇮', 尼加拉瓜: '🇳🇮',
  cu: '🇨🇺', cuba: '🇨🇺', 古巴: '🇨🇺',
  jm: '🇯🇲', jamaica: '🇯🇲', 牙买加: '🇯🇲',
  do: '🇩🇴', dominican: '🇩🇴', 多米尼加: '🇩🇴',
  pr: '🇵🇷', puertorico: '🇵🇷', 波多黎各: '🇵🇷',
  bs: '🇧🇸', bahamas: '🇧🇸', 巴哈马: '🇧🇸',
  // South America
  br: '🇧🇷', brazil: '🇧🇷', 巴西: '🇧🇷',
  ar: '🇦🇷', argentina: '🇦🇷', 阿根廷: '🇦🇷',
  cl: '🇨🇱', chile: '🇨🇱', 智利: '🇨🇱',
  co: '🇨🇴', colombia: '🇨🇴', 哥伦比亚: '🇨🇴',
  pe: '🇵🇪', peru: '🇵🇪', 秘鲁: '🇵🇪',
  ec: '🇪🇨', ecuador: '🇪🇨', 厄瓜多尔: '🇪🇨',
  ve: '🇻🇪', venezuela: '🇻🇪', 委内瑞拉: '🇻🇪',
  uy: '🇺🇾', uruguay: '🇺🇾', 乌拉圭: '🇺🇾',
  py: '🇵🇾', paraguay: '🇵🇾', 巴拉圭: '🇵🇾',
  bo: '🇧🇴', bolivia: '🇧🇴', 玻利维亚: '🇧🇴',
  gy: '🇬🇾', guyana: '🇬🇾', 圭亚那: '🇬🇾',
  // Oceania
  au: '🇦🇺', australia: '🇦🇺', 澳大利亚: '🇦🇺', 澳洲: '🇦🇺',
  nz: '🇳🇿', newzealand: '🇳🇿', 新西兰: '🇳🇿',
  fj: '🇫🇯', fiji: '🇫🇯', 斐济: '🇫🇯',
  // Africa - North
  eg: '🇪🇬', egypt: '🇪🇬', 埃及: '🇪🇬',
  ma: '🇲🇦', morocco: '🇲🇦', 摩洛哥: '🇲🇦',
  dz: '🇩🇿', algeria: '🇩🇿', 阿尔及利亚: '🇩🇿',
  tn: '🇹🇳', tunisia: '🇹🇳', 突尼斯: '🇹🇳',
  ly: '🇱🇾', libya: '🇱🇾', 利比亚: '🇱🇾',
  // Africa - East
  ke: '🇰🇪', kenya: '🇰🇪', 肯尼亚: '🇰🇪',
  tz: '🇹🇿', tanzania: '🇹🇿', 坦桑尼亚: '🇹🇿',
  ug: '🇺🇬', uganda: '🇺🇬', 乌干达: '🇺🇬',
  et: '🇪🇹', ethiopia: '🇪🇹', 埃塞俄比亚: '🇪🇹',
  rw: '🇷🇼', rwanda: '🇷🇼', 卢旺达: '🇷🇼',
  mu: '🇲🇺', mauritius: '🇲🇺', 毛里求斯: '🇲🇺',
  sc: '🇸🇨', seychelles: '🇸🇨', 塞舌尔: '🇸🇨',
  // Africa - South
  za: '🇿🇦', southafrica: '🇿🇦', 南非: '🇿🇦',
  ng: '🇳🇬', nigeria: '🇳🇬', 尼日利亚: '🇳🇬',
  gh: '🇬🇭', ghana: '🇬🇭', 加纳: '🇬🇭',
  ao: '🇦🇴', angola: '🇦🇴', 安哥拉: '🇦🇴',
  // Africa - West
  sn: '🇸🇳', senegal: '🇸🇳', 塞内加尔: '🇸🇳',
  ci: '🇨🇮', ivorycoast: '🇨🇮', cotedivoire: '🇨🇮', 科特迪瓦: '🇨🇮',
  cm: '🇨🇲', cameroon: '🇨🇲', 喀麦隆: '🇨🇲',
  // Africa - Central
  cd: '🇨🇩', congo: '🇨🇩', drc: '🇨🇩', 刚果: '🇨🇩',
};
const getFlag = (node) => {
  // Map short codes to emoji
  const raw = (node.flag_emoji || '').toLowerCase().trim();
  if (raw && FLAG_MAP[raw]) return FLAG_MAP[raw];
  // If already an emoji, return as-is
  if (raw && /^\p{Emoji}/u.test(raw)) return node.flag_emoji;
  // Try location/name match
  const loc = (node.vps_location || '').toLowerCase();
  const name = (node.name || '').toLowerCase();
  if (FLAG_MAP[loc]) return FLAG_MAP[loc];
  if (FLAG_MAP[name]) return FLAG_MAP[name];
  for (const [k, v] of Object.entries(FLAG_MAP)) {
    if (loc.includes(k) || name.includes(k)) return v;
  }
  return raw || '🖥️';
};

const nodes = ref([]);
const trafficOptions = ref([100, 200, 500, 1000, 2000]);
const durationOptions = ref([
  { days: 30, label: '1个月', discount: 1 },
  { days: 90, label: '3个月', discount: 0.90 },
  { days: 180, label: '6个月', discount: 0.85 },
  { days: 360, label: '12个月', discount: 0.75 },
]);
const loading = ref(true);
const buying = ref(false);
const showSuccess = ref(false);
const purchaseResult = ref(null);

const selectedNode = ref(null);
const selectedTraffic = ref(200);
const selectedDuration = ref(durationOptions.value[0]);

const basePrice = computed(() => {
  if (!selectedNode.value) return 0;
  const gb = selectedTraffic.value;
  const ppg = parseFloat(selectedNode.value.price_per_gb || 0.5);
  const months = (selectedDuration.value?.days || 30) / 30;
  return parseFloat((ppg * gb * months).toFixed(2));
});
const finalPrice = computed(() => {
  const disc = selectedDuration.value?.discount || 1;
  const raw = parseFloat((basePrice.value * disc).toFixed(2));
  return raw < 10 ? 10 : raw;
});

onMounted(async () => {
  try {
    const res = await fetch('/api/vpn/products');
    const data = await res.json();
    if (data.status === 'success') {
      nodes.value = data.data.nodes || [];
      if (data.data.trafficOptions) trafficOptions.value = data.data.trafficOptions;
      if (data.data.durationOptions) durationOptions.value = data.data.durationOptions;
      if (nodes.value.length > 0) selectedNode.value = nodes.value[0];
    }
  } catch (e) { /* API not available, use demo */ }
  // Demo data for preview without backend
  if (nodes.value.length === 0) {
    nodes.value = [
      { id: 1, name: '美国洛杉矶', flag_emoji: '🇺🇸', vps_location: '美国洛杉矶 · CN2 GIA', price_per_gb: 0.30, max_traffic_gb: 2000, _demo: true },
      { id: 2, name: '英国伦敦', flag_emoji: '🇬🇧', vps_location: '英国伦敦 · 9929 精品线路', price_per_gb: 0.35, max_traffic_gb: 1000, _demo: true },
    ];
    if (nodes.value.length > 0) selectedNode.value = nodes.value[0];
  }
  loading.value = false;
});
const buy = async () => {
  if (!selectedNode.value) return;
  if (selectedNode.value._demo) return uiStore.showToast(appStore.lang === 'zh' ? '演示模式，部署后端后可购买' : 'Demo mode', 'error');
  if (!userStore.token) return uiStore.showToast(appStore.lang === 'zh' ? '请先登录' : 'Please login', 'error');
  const nd = selectedNode.value;
  const msg = appStore.lang === 'zh'
    ? `确认购买 ${nd.name} · ${selectedTraffic.value}GB · ${selectedDuration.value.label}？¥${finalPrice.value.toFixed(2)} 将从余额扣除。`
    : `Confirm ${nd.name} · ${selectedTraffic.value}GB · ${selectedDuration.value.label}? ¥${finalPrice.value.toFixed(2)} will be deducted.`;
  if (!await uiStore.showConfirm(msg, appStore.lang === 'zh' ? '确认订单' : 'Confirm')) return;

  buying.value = true;
  try {
    const res = await fetch('/api/vpn/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
      body: JSON.stringify({ product_id: nd.id, traffic_gb: selectedTraffic.value, duration_days: selectedDuration.value.days })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (data.data?.balance) userStore.updateUserInfo({ balance: data.data.balance });
      purchaseResult.value = data.data;
      showSuccess.value = true;
    } else {
      uiStore.showToast(data.message || (appStore.lang === 'zh' ? '购买失败' : 'Failed'), 'error');
    }
  } catch (e) {
    uiStore.showToast(appStore.lang === 'zh' ? '网络异常' : 'Network error', 'error');
  }
  buying.value = false;
};

const goToClients = () => { showSuccess.value = false; router.push('/vpn/clients'); };
</script>
