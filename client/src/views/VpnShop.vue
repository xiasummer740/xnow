<template>
  <div class="sf-root" :data-theme="theme" :style="{ '--city-a': cityColors.a, '--city-b': cityColors.b }">
    <div class="sf-aurora" aria-hidden="true">
      <span class="sf-blob sf-blob-1"></span>
      <span class="sf-blob sf-blob-2"></span>
      <span class="sf-blob sf-blob-3"></span>
    </div>

    <!-- ═══ 顶栏 ═══ -->
    <header class="sf-top">
      <a class="sf-brand" href="/">XNOW</a>
      <div class="sf-styles">
        <button v-for="t in THEMES" :key="t.v" @click="setTheme(t.v)"
          :class="['sf-style-btn', theme === t.v && 'is-on']">{{ t.t }}</button>
      </div>
      <div class="sf-top-meta">
        <span>{{ nodes.length || '—' }} {{ appStore.lang === 'zh' ? '座城市' : 'CITIES' }}</span>
        <span class="sf-sep">·</span>
        <span>{{ bestLatency }}</span>
      </div>
    </header>

    <!-- ═══ 首屏 ═══ -->
    <section class="sf-hero">
      <div class="sf-hero-inner">
        <p class="sf-kicker">
          <span class="sf-kicker-dot"></span>
          {{ appStore.lang === 'zh' ? '原生住宅 IP' : 'RESIDENTIAL IP' }}
        </p>

        <h1 class="sf-h1">
          <span class="sf-h1-1">{{ appStore.lang === 'zh' ? '给账号' : 'Give your account' }}</span>
          <span class="sf-h1-2">{{ appStore.lang === 'zh' ? '一个当地的地址' : 'a local address' }}</span>
        </h1>

        <p class="sf-sub">
          {{ appStore.lang === 'zh'
            ? '平台不看你发什么，先看你从哪发。同样一条内容，从洛杉矶发出去和从内罗毕发出去，是两条命。'
            : "Platforms don't read your posts first. They read where you post from. The same post from Los Angeles and from Nairobi are two different lives." }}
        </p>

        <div class="sf-hero-cta">
          <a href="#cities" class="sf-btn sf-btn-solid">
            {{ appStore.lang === 'zh' ? '找一座城市' : 'Pick a city' }}
            <span class="sf-arrow">↓</span>
          </a>
          <button v-if="trialEnabled" @click="startTrial" :disabled="trialBusy" class="sf-btn sf-btn-faint">
            {{ trialBusy ? '···' : (appStore.lang === 'zh' ? '先试用 100MB' : 'Try 100MB') }}
          </button>
        </div>
      </div>

      <!-- 柔光球：跟着选中城市变色 -->
      <div class="sf-orb" aria-hidden="true">
        <div class="sf-orb-core"></div>
        <div class="sf-orb-halo"></div>
        <div class="sf-orb-ring"></div>
      </div>
    </section>

    <!-- ═══ 一句话数据带 ═══ -->
    <div class="sf-band">
      <span>{{ nodes.length || '--' }} {{ appStore.lang === 'zh' ? '座城市' : 'cities' }}</span>
      <i>·</i>
      <span>{{ appStore.lang === 'zh' ? '5 种协议' : '5 protocols' }}</span>
      <i>·</i>
      <span>{{ appStore.lang === 'zh' ? '最快' : 'fastest' }} {{ bestLatency }}</span>
      <i>·</i>
      <span>{{ appStore.lang === 'zh' ? '几乎不断线' : 'barely ever down' }}</span>
    </div>

    <main class="sf-main">

      <div v-if="loading" class="sf-loading">
        <span></span><span></span><span></span>
      </div>

      <div v-else-if="nodes.length === 0" class="sf-empty">
        <div class="sf-empty-dot"></div>
        <p class="sf-empty-t">{{ appStore.lang === 'zh' ? '城市正在开通' : 'CITIES COMING' }}</p>
        <p class="sf-empty-p">{{ appStore.lang === 'zh'
          ? '开通后这里会列出全部城市、当地时间和价格。'
          : 'Cities, local times and prices will appear here.' }}</p>
      </div>

      <template v-else>
        <!-- ═══════ 01 选城市 ═══════ -->
        <section id="cities" class="sf-sec">
          <div class="sf-sec-head">
            <span class="sf-num">01</span>
            <div>
              <h2 class="sf-sec-t">{{ appStore.lang === 'zh' ? '选一座城市' : 'Pick a city' }}</h2>
              <p class="sf-sec-d">{{ appStore.lang === 'zh'
                ? '你的账号会看起来住在这里。'
                : 'This is where your account will appear to live.' }}</p>
            </div>
          </div>

          <div class="sf-city-row">
            <button v-for="(n, i) in nodes" :key="n.id" @click="selectNode(n)"
              :class="['sf-city', selectedNode?.id === n.id && 'is-on', n._demo && 'is-demo']"
              :style="{ '--i': i }">
              <span v-if="n._demo" class="sf-city-demo">{{ appStore.lang === 'zh' ? '示例' : 'DEMO' }}</span>

              <span class="sf-city-code">{{ codeOf(n) }}</span>

              <h3 class="sf-city-name">{{ n.name }}</h3>

              <div class="sf-city-clock">
                <span class="sf-city-time">{{ cityTime(n) }}</span>
                <span class="sf-city-tz">{{ tzLabelOf(n) }}</span>
              </div>

              <div class="sf-city-foot">
                <span class="sf-city-price">
                  <i>¥</i>{{ parseFloat(n.price_per_gb || 0).toFixed(2) }}<em>/GB</em>
                </span>
                <span :class="['sf-city-lat', latClass(n.id)]">{{ latText(n.id) }}</span>
              </div>

              <span class="sf-city-check">{{ selectedNode?.id === n.id ? '✓' : '' }}</span>
            </button>

            <div v-if="!nodes.length" class="sf-city-none">—</div>
          </div>
        </section>

        <!-- ═══════ 02 + 03 并排 ═══════ -->
        <template v-if="selectedNode">
          <div class="sf-pair">
            <!-- 02 流量：刻度尺 -->
            <section class="sf-sec sf-sec-half">
              <div class="sf-sec-head">
                <span class="sf-num">02</span>
                <div>
                  <h2 class="sf-sec-t">{{ appStore.lang === 'zh' ? '多少流量' : 'How much' }}</h2>
                  <p class="sf-sec-d">{{ appStore.lang === 'zh' ? '按用量走，不用不扣。' : 'Pay for what you use.' }}</p>
                </div>
              </div>

              <div class="sf-ruler">
                <div class="sf-ruler-track">
                  <div class="sf-ruler-fill" :style="{ width: rulerPct + '%' }"></div>
                  <button v-for="(g, i) in affordableTraffic" :key="g" @click="selectedTraffic = g"
                    :class="['sf-ruler-tick', selectedTraffic === g && 'is-on']"
                    :style="{ left: tickPct(i) + '%' }">
                    <span class="sf-tick-dot"></span>
                    <span class="sf-tick-label">
                      {{ g >= 1000 ? (g / 1000) + 'TB' : g + 'GB' }}
                    </span>
                  </button>
                </div>
                <p class="sf-ruler-price">
                  <span class="sf-ruler-num">¥{{ trafficPrice(selectedTraffic).toFixed(0) }}</span>
                  <span class="sf-ruler-note">{{ appStore.lang === 'zh' ? '这一段' : 'for this' }}</span>
                </p>
              </div>

              <div v-if="affordableTraffic.length === 0" class="sf-warn">
                {{ appStore.lang === 'zh' ? '这座城市已达容量上限' : 'At capacity' }}
              </div>
            </section>

            <!-- 03 时长 -->
            <section class="sf-sec sf-sec-half">
              <div class="sf-sec-head">
                <span class="sf-num">03</span>
                <div>
                  <h2 class="sf-sec-t">{{ appStore.lang === 'zh' ? '用多久' : 'How long' }}</h2>
                  <p class="sf-sec-d">{{ appStore.lang === 'zh' ? '订久一点，单价就低一点。' : 'Longer terms cost less per month.' }}</p>
                </div>
              </div>

              <div class="sf-terms">
                <button v-for="d in durationOptions" :key="d.days" @click="selectedDuration = d"
                  :class="['sf-term', selectedDuration?.days === d.days && 'is-on']">
                  <span class="sf-term-label">{{ d.label }}</span>
                  <span v-if="d.discount < 1" class="sf-term-off">−{{ Math.round((1 - d.discount) * 100) }}%</span>
                </button>
              </div>
            </section>
          </div>

          <!-- 城市详情 -->
          <div class="sf-detail">
            <div class="sf-detail-row">
              <span class="sf-dk">{{ appStore.lang === 'zh' ? '线路' : 'ROUTE' }}</span>
              <span class="sf-dv">{{ selectedNode.description || 'BGP' }}</span>
            </div>
            <div class="sf-detail-row">
              <span class="sf-dk">{{ appStore.lang === 'zh' ? '容量' : 'CAPACITY' }}</span>
              <span class="sf-dv">{{ selectedNode.max_traffic_gb }} GB</span>
            </div>
            <div class="sf-detail-row">
              <span class="sf-dk">{{ appStore.lang === 'zh' ? '延迟' : 'LATENCY' }}</span>
              <span :class="['sf-dv', latClass(selectedNode.id)]">{{ latText(selectedNode.id) }}</span>
            </div>
            <div class="sf-detail-row sf-detail-protos">
              <span class="sf-dk">{{ appStore.lang === 'zh' ? '协议' : 'PROTOCOL' }}</span>
              <span class="sf-protos">
                <i v-for="p in getProtocols(selectedNode)" :key="p">{{ p }}</i>
              </span>
            </div>
          </div>

          <!-- 优惠码 -->
          <div class="sf-coupon">
            <input v-model="couponCode" @keyup.enter="applyCoupon" type="text" maxlength="20"
              :placeholder="appStore.lang === 'zh' ? '有优惠码？填这里' : 'Have a code?'" />
            <button @click="applyCoupon" :disabled="couponApplying" class="sf-coupon-btn">
              {{ couponApplying ? '···' : (appStore.lang === 'zh' ? '用上' : 'APPLY') }}
            </button>
            <button v-if="couponApplied" @click="removeCoupon" class="sf-coupon-x">✕</button>
          </div>
          <p v-if="couponApplied" class="sf-note sf-note-ok">
            {{ appStore.lang === 'zh' ? `已减 ¥${couponApplied.discount}` : `−¥${couponApplied.discount}` }}
          </p>
          <p v-if="couponError" class="sf-note sf-note-err">{{ couponError }}</p>

          <!-- ═══ 结算 ═══ -->
          <div class="sf-checkout">
            <div class="sf-checkout-l">
              <p class="sf-checkout-cap">{{ appStore.lang === 'zh' ? '合计' : 'TOTAL' }}</p>
              <div class="sf-checkout-price">
                <span class="sf-cur">¥</span>
                <span class="sf-price" :key="(couponApplied ? couponApplied.final_amount : finalPrice).toFixed(2)">
                  {{ (couponApplied ? couponApplied.final_amount : finalPrice).toFixed(2) }}
                </span>
                <span v-if="couponApplied" class="sf-was">¥{{ finalPrice.toFixed(2) }}</span>
              </div>
              <p class="sf-checkout-meta">
                {{ selectedNode.name }} · {{ selectedTraffic }}GB · {{ selectedDuration?.label }}
              </p>
              <p :class="['sf-balance', balanceOk ? 'ok' : 'bad']">
                {{ appStore.lang === 'zh' ? '余额' : 'BALANCE' }} ¥{{ parseFloat(userStore.userInfo?.balance || 0).toFixed(2) }}
                <router-link v-if="!balanceOk" to="/recharge" class="sf-topup">
                  {{ appStore.lang === 'zh' ? '去充值 ↗' : 'TOP UP ↗' }}
                </router-link>
              </p>
            </div>

            <button @click="buy" :disabled="buying" class="sf-activate">
              <span class="sf-activate-t">{{ buying ? '···' : (appStore.lang === 'zh' ? '开通' : 'ACTIVATE') }}</span>
              <span class="sf-activate-ripple" :style="rippleStyle"></span>
            </button>
          </div>
        </template>
      </template>

      <!-- 底部：一句话，不做电商那种信任条 -->
      <p class="sf-outro">
        {{ appStore.lang === 'zh'
          ? '付完立刻拿到订阅链接。五个客户端，一条链接，所有设备。'
          : 'You get the subscription link immediately. Five clients, one link, every device.' }}
      </p>
    </main>

    <!-- 成功弹窗 -->
    <div v-if="showSuccess" class="sf-modal" @click.self="showSuccess = false">
      <div class="sf-modal-box">
        <div class="sf-modal-orb"><span></span></div>
        <h2 class="sf-modal-t">{{ appStore.lang === 'zh' ? '开通了' : 'ACTIVATED' }}</h2>
        <p class="sf-modal-d">{{ appStore.lang === 'zh'
          ? '订阅链接已经生成，复制到客户端就能用。'
          : 'Your subscription link is ready.' }}</p>
        <p v-if="purchaseResult?.email" class="sf-modal-id">{{ purchaseResult.email }}</p>
        <div class="sf-modal-acts">
          <button @click="goToClients" class="sf-modal-primary">
            {{ appStore.lang === 'zh' ? '查看我的节点' : 'MY NODES' }}
          </button>
          <button @click="showSuccess = false" class="sf-modal-ghost">
            {{ appStore.lang === 'zh' ? '继续看看' : 'KEEP LOOKING' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/app';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui';

const router = useRouter();
const appStore = useAppStore(); const userStore = useUserStore(); const uiStore = useUiStore();

/* ══════════════════════════════════════════════════════════════════════════
   主题切换（保留五套，但新布局只为「软」精调；其余四套用变量兜底）
   ══════════════════════════════════════════════════════════════════════════ */
const THEMES = [
  { v: 'soft', t: '软' }, { v: 'chrome', t: '铬' },
  { v: 'minimal', t: '简' }, { v: 'brutal', t: '凶' }, { v: 'precise', t: '精' },
];
const THEME_KEY = 'xnow_vpn_theme';
const theme = ref('soft');
const setTheme = (v) => { theme.value = v; try { localStorage.setItem(THEME_KEY, v); } catch (e) {} };
const THEME_Q = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('style');

/* ══════════════════════════════════════════════════════════════════════════
   城市元数据：机场代码 + 时区 + 一对渐变色
   ──────────────────────────────────────────────────────────────────────────
   这套东西是这一版的核心文案创新 —— 客户买的不是「一个节点」，是
   「账号要住的地方」。所以每座城市要有：一个机场代码（可识别、专业）、
   一个走着的本地时钟（有画面感）、一对属于它的颜色（选中后整页跟着变）。
   ══════════════════════════════════════════════════════════════════════════ */
const CITY_META = {
  '🇺🇸': { code: 'LAX', tz: 'America/Los_Angeles', a: '#7c9bff', b: '#b48cff' },
  '🇨🇦': { code: 'YVR', tz: 'America/Vancouver', a: '#7c9bff', b: '#8ec5ff' },
  '🇬🇧': { code: 'LHR', tz: 'Europe/London', a: '#8b9bb8', b: '#c4a8c8' },
  '🇩🇪': { code: 'FRA', tz: 'Europe/Berlin', a: '#c9a06a', b: '#e0c088' },
  '🇳🇱': { code: 'AMS', tz: 'Europe/Amsterdam', a: '#e08a5e', b: '#f0b880' },
  '🇫🇷': { code: 'CDG', tz: 'Europe/Paris', a: '#9c8ac4', b: '#d4b8d8' },
  '🇯🇵': { code: 'NRT', tz: 'Asia/Tokyo', a: '#f08ab0', b: '#f4b8d0' },
  '🇰🇷': { code: 'ICN', tz: 'Asia/Seoul', a: '#8ab8f0', b: '#c4a0e8' },
  '🇭🇰': { code: 'HKG', tz: 'Asia/Hong_Kong', a: '#e0a87c', b: '#f0c8a0' },
  '🇸🇬': { code: 'SIN', tz: 'Asia/Singapore', a: '#6ecfc0', b: '#a8e0d0' },
  '🇹🇼': { code: 'TPE', tz: 'Asia/Taipei', a: '#7ec8b8', b: '#b0dcc8' },
  '🇹🇭': { code: 'BKK', tz: 'Asia/Bangkok', a: '#e8b860', b: '#f0d090' },
  '🇻🇳': { code: 'SGN', tz: 'Asia/Ho_Chi_Minh', a: '#d8a060', b: '#e8c090' },
  '🇲🇾': { code: 'KUL', tz: 'Asia/Kuala_Lumpur', a: '#70c8a8', b: '#a8dcc0' },
  '🇵🇭': { code: 'MNL', tz: 'Asia/Manila', a: '#e89460', b: '#f0b880' },
  '🇮🇩': { code: 'CGK', tz: 'Asia/Jakarta', a: '#d88860', b: '#e8b090' },
  '🇮🇳': { code: 'BOM', tz: 'Asia/Kolkata', a: '#e0a050', b: '#f0c880' },
  '🇦🇪': { code: 'DXB', tz: 'Asia/Dubai', a: '#d0a060', b: '#e8c890' },
  '🇦🇺': { code: 'SYD', tz: 'Australia/Sydney', a: '#70b8e0', b: '#a0d0e8' },
  '🇧🇷': { code: 'GRU', tz: 'America/Sao_Paulo', a: '#80c870', b: '#b0dca0' },
  '🇷🇺': { code: 'SVO', tz: 'Europe/Moscow', a: '#8898b8', b: '#b0bcd0' },
  '🇿🇦': { code: 'JNB', tz: 'Africa/Johannesburg', a: '#d09060', b: '#e8b890' },
  '🇲🇽': { code: 'MEX', tz: 'America/Mexico_City', a: '#80b080', b: '#b0d0a0' },
  '🇦🇷': { code: 'EZE', tz: 'America/Argentina/Buenos_Aires', a: '#70b0d8', b: '#a0d0e0' },
};
const FALLBACK_META = { code: '———', tz: 'Asia/Shanghai', a: '#8b96c8', b: '#c8b0d8' };

const metaOf = (n) => CITY_META[n.flag_emoji || ''] || FALLBACK_META;
const codeOf = (n) => metaOf(n).code;
const tzLabelOf = (n) => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: metaOf(n).tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value || '';
  } catch (e) { return ''; }
};

// 实时时钟：每秒走一格
const now = ref(new Date());
let clockTimer = null;
const cityTime = (n) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: metaOf(n).tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(now.value);
  } catch (e) { return '--:--'; }
};

// 选中城市的配色（整页柔光跟着变）
const cityColors = computed(() => {
  const m = selectedNode.value ? metaOf(selectedNode.value) : FALLBACK_META;
  return { a: m.a, b: m.b };
});

/* ── 按钮涟漪 ── */
const rippleStyle = ref({});
const onPointerDown = (e) => {
  const btn = e.target.closest('.sf-activate');
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  rippleStyle.value = { '--rx': (e.clientX - r.left) + 'px', '--ry': (e.clientY - r.top) + 'px' };
};

/* ── 国旗 ── */
const EMOJI_MAP = { '🇭🇰':'hk','🇯🇵':'jp','🇰🇷':'kr','🇹🇼':'tw','🇸🇬':'sg','🇹🇭':'th','🇻🇳':'vn','🇲🇾':'my','🇵🇭':'ph','🇮🇩':'id','🇮🇳':'in','🇦🇪':'ae','🇺🇸':'us','🇨🇦':'ca','🇬🇧':'gb','🇩🇪':'de','🇳🇱':'nl','🇫🇷':'fr','🇷🇺':'ru','🇦🇺':'au','🇧🇷':'br','🇦🇷':'ar','🇿🇦':'za','🇲🇽':'mx' };
const getFlagUrl = (n) => { const c = EMOJI_MAP[n.flag_emoji || '']; return c ? `https://flagcdn.com/w80/${c}.png` : ''; };
const DEF_PROTOS = ['VLESS + Reality', 'VMess + WS', 'Trojan + TLS', 'Shadowsocks', 'Hysteria2'];
const getProtocols = (n) => { try { const p = JSON.parse(n.protocols || '[]'); return Array.isArray(p) && p.length ? p : DEF_PROTOS; } catch (e) { return DEF_PROTOS; } };

/* ── 状态 ── */
const nodes = ref([]); const trafficOptions = ref([100, 200, 500, 1000, 2000]);
const durationOptions = ref([
  { days: 30, label: '1 个月', discount: 1 },
  { days: 90, label: '3 个月', discount: .9 },
  { days: 180, label: '6 个月', discount: .85 },
  { days: 360, label: '12 个月', discount: .75 },
]);
const loading = ref(true); const buying = ref(false); const showSuccess = ref(false); const purchaseResult = ref(null);
const selectedNode = ref(null); const selectedTraffic = ref(200); const selectedDuration = ref(durationOptions.value[0]);
const latencyMap = ref({});
const trialEnabled = ref(false); const trialBusy = ref(false);

const latText = (id) => {
  const v = latencyMap.value[id];
  if (v === undefined) return '—';
  if (v === null) return '···';
  return v + 'ms';
};
const latClass = (id) => {
  const v = latencyMap.value[id];
  if (v === undefined || v === null) return 'l-none';
  return v < 100 ? 'l-good' : v < 250 ? 'l-mid' : 'l-bad';
};
const bestLatency = computed(() => {
  const vals = Object.values(latencyMap.value).filter((v) => typeof v === 'number');
  if (!vals.length) return '—';
  return Math.min(...vals) + 'ms';
});

/* ── 刻度尺定位 ── */
const affordableTraffic = computed(() => {
  const cap = selectedNode.value?.max_traffic_gb || 2000;
  return trafficOptions.value.filter((t) => t <= cap);
});
const tickPct = (i) => {
  const total = affordableTraffic.value.length;
  if (total <= 1) return 0;
  return (i / (total - 1)) * 100;
};
const rulerPct = computed(() => {
  const total = affordableTraffic.value.length;
  if (total <= 1) return 0;
  const i = affordableTraffic.value.indexOf(selectedTraffic.value);
  return i < 0 ? 0 : (i / (total - 1)) * 100;
});
const trafficPrice = (g) => {
  if (!selectedNode.value) return 0;
  const ppg = parseFloat(selectedNode.value.price_per_gb || .5);
  const m = (selectedDuration.value?.days || 30) / 30;
  const raw = parseFloat((ppg * g * m * (selectedDuration.value?.discount || 1)).toFixed(2));
  return raw < 10 ? 10 : raw;
};

const basePrice = computed(() => {
  if (!selectedNode.value) return 0;
  const ppg = parseFloat(selectedNode.value.price_per_gb || .5);
  const m = (selectedDuration.value?.days || 30) / 30;
  return parseFloat((ppg * selectedTraffic.value * m).toFixed(2));
});
const finalPrice = computed(() => {
  const raw = parseFloat((basePrice.value * (selectedDuration.value?.discount || 1)).toFixed(2));
  return raw < 10 ? 10 : raw;
});
const actualPrice = computed(() => couponApplied.value ? couponApplied.value.final_amount : finalPrice.value);
const balanceOk = computed(() => parseFloat(userStore.userInfo?.balance || 0) >= actualPrice.value);

/* ── 试用 ── */
const startTrial = async () => {
  if (!userStore.token) { uiStore.showToast(appStore.lang === 'zh' ? '先登录一下' : 'Please login', 'error'); return; }
  trialBusy.value = true;
  try {
    const r = await fetch('/api/vpn/trial', { method: 'POST', headers: { Authorization: `Bearer ${userStore.token}` } });
    const d = await r.json();
    if (d.status === 'success') { uiStore.showToast(appStore.lang === 'zh' ? '试用已开通' : 'Trial created', 'success'); router.push('/vpn/clients'); }
    else uiStore.showToast(d.message || 'FAILED', 'error');
  } catch (e) { uiStore.showToast('NETWORK ERROR', 'error'); }
  trialBusy.value = false;
};

/* ── 优惠码 ── */
const couponCode = ref(''); const couponApplied = ref(null);
const couponError = ref(''); const couponApplying = ref(false);
const applyCoupon = async () => {
  if (!couponCode.value.trim()) return;
  couponApplying.value = true; couponError.value = ''; couponApplied.value = null;
  try {
    const r = await fetch('/api/vpn/coupon/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: couponCode.value, amount: finalPrice.value }),
    });
    const d = await r.json();
    if (d.status === 'success') { couponApplied.value = d.data; }
    else { couponError.value = d.message; }
  } catch (e) { couponError.value = 'VERIFY FAILED'; }
  couponApplying.value = false;
};
const removeCoupon = () => { couponApplied.value = null; couponCode.value = ''; couponError.value = ''; };

/* ── 延迟测试 ── */
const pingNodes = async () => {
  for (const n of nodes.value) {
    if (n._demo) continue;
    latencyMap.value[n.id] = null;
    try {
      const r = await fetch('/api/vpn/ping?id=' + n.id);
      const d = await r.json();
      if (d.status === 'success') latencyMap.value[n.id] = d.data.latency;
    } catch (e) {}
  }
};

onMounted(async () => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEME_Q && THEMES.some((t) => t.v === THEME_Q)) theme.value = THEME_Q;
    else if (saved && THEMES.some((t) => t.v === saved)) theme.value = saved;
  } catch (e) {}

  try {
    const r = await fetch('/api/vpn/products');
    const d = await r.json();
    if (d.status === 'success') {
      nodes.value = d.data.nodes || [];
      if (d.data.trafficOptions) trafficOptions.value = d.data.trafficOptions;
      if (d.data.durationOptions) durationOptions.value = d.data.durationOptions;
      if (nodes.value.length > 0) selectedNode.value = nodes.value[0];
    }
  } catch (e) {}

  // 表里还没配节点时用两条「示例」撑住版式；带 _demo，下单会被拦。
  if (nodes.value.length === 0) {
    nodes.value = [
      { id: 1, name: '洛杉矶', flag_emoji: '🇺🇸', vps_location: 'CN2 GIA', price_per_gb: .3, max_traffic_gb: 2000, _demo: true },
      { id: 2, name: '东京', flag_emoji: '🇯🇵', vps_location: 'IIJ', price_per_gb: .45, max_traffic_gb: 2000, _demo: true },
      { id: 3, name: '新加坡', flag_emoji: '🇸🇬', vps_location: 'CN2', price_per_gb: .4, max_traffic_gb: 1500, _demo: true },
      { id: 4, name: '伦敦', flag_emoji: '🇬🇧', vps_location: '9929', price_per_gb: .35, max_traffic_gb: 1000, _demo: true },
    ];
    selectedNode.value = nodes.value[0];
  }

  loading.value = false;
  setTimeout(pingNodes, 400);
  clockTimer = setInterval(() => { now.value = new Date(); }, 1000);

  try {
    const r2 = await fetch('/api/vpn/trial-check');
    const d2 = await r2.json();
    trialEnabled.value = d2.status === 'success' && d2.enabled;
  } catch (e) {}

  document.addEventListener('pointerdown', onPointerDown, true);
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
  document.removeEventListener('pointerdown', onPointerDown, true);
});

const selectNode = (n) => {
  selectedNode.value = n;
  const valid = trafficOptions.value.filter((t) => t <= (n.max_traffic_gb || 2000));
  if (valid.length > 0 && !valid.includes(selectedTraffic.value)) selectedTraffic.value = valid[0];
};

const buy = async () => {
  const nd = selectedNode.value;
  if (!nd) return;
  if (nd._demo) return uiStore.showToast(appStore.lang === 'zh' ? '这是示例城市，配上真实节点后就能买' : 'Demo city', 'error');
  if (!userStore.token) return uiStore.showToast(appStore.lang === 'zh' ? '先登录一下' : 'Please login', 'error');
  const price = actualPrice.value;
  if (parseFloat(userStore.userInfo?.balance || 0) < price)
    return uiStore.showToast(appStore.lang === 'zh' ? '余额不够，先充一点' : 'Insufficient balance', 'error');
  if (!await uiStore.showConfirm(
    `${nd.name} · ${selectedTraffic.value}GB · ${selectedDuration.value.label} · ¥${price.toFixed(2)}`,
    appStore.lang === 'zh' ? '确认' : 'Confirm')) return;

  buying.value = true;
  try {
    const r = await fetch('/api/vpn/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userStore.token}` },
      body: JSON.stringify({
        product_id: nd.id, traffic_gb: selectedTraffic.value,
        duration_days: selectedDuration.value.days, coupon_id: couponApplied.value?.id || null,
      }),
    });
    const d = await r.json();
    if (d.status === 'success') {
      if (d.data?.balance) userStore.updateUserInfo({ balance: d.data.balance });
      purchaseResult.value = d.data; showSuccess.value = true;
    } else uiStore.showToast(d.message || 'FAILED', 'error');
  } catch (e) { uiStore.showToast('NETWORK ERROR', 'error'); }
  buying.value = false;
};
const goToClients = () => { showSuccess.value = false; router.push('/vpn/clients'); };
</script>

<style>
/* ══════════════════════════════════════════════════════════════════════════
   软 · SOFT（2026-11-07 第三版，布局与文案全重做）
   --------------------------------------------------------------------------
   祥哥定调「软稍微接近一点，全部文案和布局全部重做」。所以这一版：

   材质（保留软的）—— 浅灰蓝底 + 三团柔光 + 白色半透明卡 + 扩散阴影
   结构（推翻重做）—— 不再是「选配置→加购→结算」的表单流：
      · 首屏是品牌宣言，左对齐大字，球挪到右下当背景光
      · 数据不做四格卡片，压成一句横排细字
      · 城市是**大卡**，每张卡上有走着的本地时钟和机场代码
      · 选中城市 → 整页柔光跟着换色（--city-a / --city-b）
      · 流量从按钮网格改成**刻度尺**，02/03 并排，纵向省一半
      · 底部不做「支付宝/微信/USDT」那种电商信任条，一句话收尾
   文案（全部重写）—— 不列痛点（所有人都列），讲画面和比喻。
   ══════════════════════════════════════════════════════════════════════════ */

.sf-root {
  --bg: #eef1f8;
  --card: rgba(255, 255, 255, .78);
  --card-solid: #ffffff;
  --fg: #171d30;
  --fg-2: #4a5470;
  --fg-3: #8a93ab;
  --fg-4: #c2c8d8;
  --line: rgba(40, 55, 100, .08);
  --line-2: rgba(40, 55, 100, .14);
  --accent: #6d7cff;
  --accent-2: #a78bff;
  --radius: 26px;
  --radius-s: 16px;
  --radius-xs: 12px;
  --font: "SF Pro Display", -apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --font-num: "SF Pro Display", -apple-system, ui-rounded, system-ui, sans-serif;
  --city-a: #7c9bff;
  --city-b: #b48cff;

  position: relative; min-height: 100vh;
  background: var(--bg); color: var(--fg);
  font-family: var(--font);
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  transition: background .5s;
}

/* ── 柔光：三团，颜色跟着城市走 ── */
.sf-aurora {
  position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
}
.sf-blob {
  position: absolute; border-radius: 50%; filter: blur(80px);
  transition: background 1.1s cubic-bezier(.3,.9,.3,1), transform 1.4s cubic-bezier(.3,.9,.3,1);
}
.sf-blob-1 {
  width: 62vw; height: 62vw; max-width: 900px; max-height: 900px;
  top: -22vw; left: -14vw; opacity: .5;
  background: radial-gradient(circle, var(--city-a), transparent 68%);
}
.sf-blob-2 {
  width: 52vw; height: 52vw; max-width: 760px; max-height: 760px;
  top: -12vw; right: -12vw; opacity: .42;
  background: radial-gradient(circle, var(--city-b), transparent 68%);
}
.sf-blob-3 {
  width: 56vw; height: 52vw; max-width: 820px; max-height: 820px;
  bottom: -20vw; left: 22vw; opacity: .3;
  background: radial-gradient(circle, #7fe0d8, transparent 70%);
}

@media (prefers-reduced-motion: reduce) {
  .sf-orb-core, .sf-orb-halo, .sf-orb-ring, .sf-loading span, .sf-activate-ripple { animation: none !important; }
}

/* ── 顶栏 ── */
.sf-top {
  position: relative; z-index: 20;
  display: flex; align-items: center; justify-content: space-between; gap: 18px;
  padding: 26px clamp(20px, 4.5vw, 60px);
}
.sf-brand {
  font-size: 15px; font-weight: 700; letter-spacing: .16em;
  color: var(--fg); text-decoration: none;
}
.sf-styles { display: flex; gap: 2px; }
.sf-style-btn {
  min-width: 28px; padding: 6px 8px; border: none; cursor: pointer;
  background: transparent; color: var(--fg-3);
  font-family: var(--font); font-size: 10.5px; font-weight: 600;
  border-radius: 999px; transition: background .2s, color .2s;
}
.sf-style-btn:hover { color: var(--fg); background: rgba(255, 255, 255, .6); }
.sf-style-btn.is-on { background: var(--fg); color: #fff; }
.sf-top-meta {
  font-size: 11px; font-weight: 500; color: var(--fg-3);
  font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 7px;
}
.sf-sep { color: var(--fg-4); }

/* ── 首屏 ── */
.sf-hero {
  position: relative; z-index: 5;
  padding: clamp(40px, 8vw, 110px) clamp(20px, 4.5vw, 60px) clamp(50px, 7vw, 100px);
  min-height: 60vh;
  display: flex; align-items: center;
}
.sf-hero-inner { position: relative; z-index: 3; max-width: 620px; }

.sf-kicker {
  display: inline-flex; align-items: center; gap: 9px;
  margin: 0 0 26px; font-size: 11px; font-weight: 600;
  letter-spacing: .14em; color: var(--fg-2); text-transform: uppercase;
}
.sf-kicker-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--city-a); box-shadow: 0 0 12px var(--city-a);
  transition: background .6s, box-shadow .6s;
}

.sf-h1 {
  margin: 0 0 26px; display: flex; flex-direction: column;
  font-size: clamp(38px, 6.4vw, 78px); line-height: 1.04;
  letter-spacing: -.035em; font-weight: 400;
}
.sf-h1-1 { color: var(--fg); font-weight: 300; }
.sf-h1-2 {
  font-weight: 700;
  background: linear-gradient(100deg, var(--city-a) 0%, var(--city-b) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  transition: background .8s;
}

.sf-sub {
  margin: 0 0 34px; max-width: 480px;
  font-size: 14.5px; line-height: 1.92; color: var(--fg-2); font-weight: 400;
}

.sf-hero-cta { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.sf-btn {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 15px 28px; border: none; cursor: pointer;
  font-family: var(--font); font-size: 13.5px; font-weight: 600;
  letter-spacing: .01em; text-decoration: none; border-radius: 999px;
  transition: transform .22s cubic-bezier(.3,.9,.3,1), box-shadow .22s, background .22s;
}
.sf-btn:active { transform: scale(.97); }
.sf-arrow { font-size: 13px; transition: transform .25s; }
.sf-btn:hover .sf-arrow { transform: translateY(3px); }
.sf-btn-solid {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff; box-shadow: 0 10px 30px rgba(109, 124, 255, .32);
}
.sf-btn-solid:hover { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(109, 124, 255, .42); }
.sf-btn-faint {
  background: rgba(255, 255, 255, .7); color: var(--fg-2);
  backdrop-filter: blur(12px); box-shadow: 0 2px 10px rgba(40, 55, 100, .06);
}
.sf-btn-faint:hover { background: #fff; color: var(--fg); }
.sf-btn-faint:disabled { opacity: .55; cursor: wait; }

/* ── 柔光球（右下）── */
.sf-orb {
  position: absolute; right: clamp(-60px, 4vw, 70px); top: 50%;
  width: clamp(240px, 34vw, 460px); height: clamp(240px, 34vw, 460px);
  margin-top: calc(clamp(240px, 34vw, 460px) / -2);
  z-index: 1; pointer-events: none;
}
.sf-orb-core {
  position: absolute; inset: 12%; border-radius: 50%;
  background:
    radial-gradient(circle at 34% 28%, #ffffff 0%, rgba(255,255,255,.86) 18%,
      var(--city-a) 52%, var(--city-b) 88%);
  box-shadow:
    inset -18px -20px 52px rgba(120, 140, 210, .3),
    inset 14px 12px 40px rgba(255, 255, 255, .95),
    0 40px 90px color-mix(in srgb, var(--city-a) 30%, transparent);
  filter: blur(.4px);
  transition: background 1.1s cubic-bezier(.3,.9,.3,1), box-shadow 1.1s;
  animation: sf-breathe 8s ease-in-out infinite;
}
@keyframes sf-breathe {
  0%, 100% { transform: scale(1) translateY(-6px) }
  50%      { transform: scale(1.03) translateY(6px) }
}
.sf-orb-halo {
  position: absolute; inset: -6%; border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--city-b) 34%, transparent), transparent 64%);
  filter: blur(28px);
  transition: background 1.1s;
  animation: sf-pulse 6s ease-in-out infinite;
}
@keyframes sf-pulse {
  0%, 100% { transform: scale(1); opacity: .7 }
  50%      { transform: scale(1.08); opacity: 1 }
}
.sf-orb-ring {
  position: absolute; inset: 4%; border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, .55);
  animation: sf-spin 40s linear infinite;
}
@keyframes sf-spin { to { transform: rotate(360deg) } }
.sf-orb-ring::after {
  content: ''; position: absolute; top: -3px; left: 50%; margin-left: -3px;
  width: 6px; height: 6px; border-radius: 999px; background: #fff;
  box-shadow: 0 0 12px #fff;
}

@media (max-width: 860px) {
  .sf-hero { min-height: 0; padding-top: 30px; }
  .sf-orb {
    position: relative; right: auto; top: auto; margin: 0 0 -30px auto;
    width: 170px; height: 170px;
  }
}

/* ── 数据带：一句横排 ── */
.sf-band {
  position: relative; z-index: 5;
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px;
  padding: 18px clamp(20px, 4.5vw, 60px);
  font-size: 11.5px; font-weight: 500; letter-spacing: .04em; color: var(--fg-3);
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, .34);
  backdrop-filter: blur(16px);
}
.sf-band i { color: var(--fg-4); font-style: normal; }

/* ── 主体 ── */
.sf-main {
  position: relative; z-index: 5;
  padding: clamp(44px, 6vw, 88px) clamp(20px, 4.5vw, 60px) 70px;
  max-width: 1180px; margin: 0 auto;
}

.sf-sec { margin-bottom: clamp(40px, 5vw, 66px); }
.sf-sec-head { display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start; }
.sf-num {
  flex: none; font-family: var(--font-num); font-size: 11px; font-weight: 600;
  color: var(--accent); font-variant-numeric: tabular-nums;
  padding-top: 4px; letter-spacing: .06em;
}
.sf-sec-t {
  margin: 0 0 5px; font-size: clamp(20px, 2.6vw, 28px);
  font-weight: 600; letter-spacing: -.02em; color: var(--fg);
}
.sf-sec-d { margin: 0; font-size: 12.5px; color: var(--fg-3); line-height: 1.6; }

/* ── 城市大卡 ── */
.sf-city-row {
  display: grid; gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
}
.sf-city {
  position: relative; text-align: left; cursor: pointer;
  padding: 24px 22px 20px; border: 1px solid rgba(255, 255, 255, .9);
  border-radius: var(--radius); background: var(--card);
  backdrop-filter: blur(18px);
  color: inherit; font: inherit;
  box-shadow: 0 2px 10px rgba(40, 55, 100, .05), 0 14px 36px rgba(40, 55, 100, .06);
  transition: transform .32s cubic-bezier(.3,.9,.3,1), box-shadow .32s, background .32s, border-color .32s;
  animation: sf-in .55s cubic-bezier(.3,.9,.3,1) both;
  animation-delay: calc(var(--i, 0) * 60ms);
}
@keyframes sf-in {
  from { opacity: 0; transform: translateY(14px) }
  to   { opacity: 1; transform: none }
}
.sf-city:hover { transform: translateY(-5px); box-shadow: 0 6px 18px rgba(40,55,100,.07), 0 24px 56px rgba(40,55,100,.1); }
.sf-city.is-on {
  background: var(--card-solid);
  border-color: transparent;
  box-shadow:
    0 0 0 2px var(--accent),
    0 12px 34px rgba(109, 124, 255, .24),
    0 26px 64px rgba(109, 124, 255, .16);
  transform: translateY(-5px);
}

.sf-city-demo {
  position: absolute; top: 14px; right: 16px;
  padding: 3px 8px; border-radius: 999px;
  font-size: 9px; font-weight: 700; letter-spacing: .08em;
  color: #c08a20; background: rgba(255, 190, 60, .16);
}
.sf-city-code {
  display: block; font-family: var(--font-num);
  font-size: 10px; font-weight: 700; letter-spacing: .18em;
  color: var(--fg-4); margin-bottom: 14px;
  transition: color .3s;
}
.sf-city.is-on .sf-city-code { color: var(--accent); }

.sf-city-name {
  margin: 0 0 16px; font-size: 25px; font-weight: 600;
  letter-spacing: -.025em; color: var(--fg); line-height: 1.1;
}
.sf-city-clock {
  display: flex; align-items: baseline; gap: 8px; margin-bottom: 18px;
}
.sf-city-time {
  font-family: var(--font-num); font-size: 27px; font-weight: 300;
  letter-spacing: -.02em; color: var(--fg);
  font-variant-numeric: tabular-nums;
}
.sf-city-tz { font-size: 10px; font-weight: 500; color: var(--fg-4); letter-spacing: .04em; }

.sf-city-foot {
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
  padding-top: 14px; border-top: 1px solid var(--line);
}
.sf-city-price {
  font-family: var(--font-num); font-size: 17px; font-weight: 500;
  color: var(--fg); font-variant-numeric: tabular-nums;
}
.sf-city-price i { font-style: normal; font-size: .66em; color: var(--fg-3); margin-right: 1px; }
.sf-city-price em { font-style: normal; font-size: .58em; color: var(--fg-3); letter-spacing: .04em; }
.sf-city-lat {
  font-size: 10px; font-weight: 600; letter-spacing: .04em;
  font-variant-numeric: tabular-nums; color: var(--fg-3);
}
.sf-city-lat.l-good { color: #2eb888; }
.sf-city-lat.l-mid { color: #e0a030; }
.sf-city-lat.l-bad { color: #e05575; }
.sf-city-lat.l-none { color: var(--fg-4); }
.sf-city-check {
  position: absolute; bottom: 16px; right: 18px;
  font-size: 13px; color: var(--accent); opacity: 0;
  transition: opacity .25s;
}
.sf-city.is-on .sf-city-check { opacity: 1; }
.sf-city-none { padding: 40px; text-align: center; color: var(--fg-4); }

/* ── 02/03 并排 ── */
.sf-pair {
  display: grid; grid-template-columns: 1fr 1fr; gap: clamp(20px, 4vw, 46px);
  margin-bottom: clamp(36px, 4.5vw, 56px);
}
.sf-sec-half { margin-bottom: 0; }
@media (max-width: 780px) { .sf-pair { grid-template-columns: 1fr; gap: 40px; } }

/* 刻度尺 */
.sf-ruler { padding: 34px 6px 0; }
.sf-ruler-track {
  position: relative; height: 2px; border-radius: 2px;
  background: var(--line-2); margin: 0 12px 30px;
}
.sf-ruler-fill {
  position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  transition: width .38s cubic-bezier(.3,.9,.3,1);
}
.sf-ruler-tick {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  background: none; border: none; cursor: pointer; padding: 12px 6px;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.sf-tick-dot {
  width: 9px; height: 9px; border-radius: 999px;
  background: #fff; box-shadow: 0 0 0 1.5px var(--line-2);
  transition: transform .28s cubic-bezier(.3,.9,.3,1), background .28s, box-shadow .28s;
}
.sf-ruler-tick:hover .sf-tick-dot { transform: scale(1.3); }
.sf-ruler-tick.is-on .sf-tick-dot {
  background: var(--accent); transform: scale(1.5);
  box-shadow: 0 0 0 3px rgba(109, 124, 255, .22), 0 0 16px rgba(109, 124, 255, .5);
}
.sf-tick-label {
  font-family: var(--font-num); font-size: 11px; font-weight: 500;
  color: var(--fg-3); white-space: nowrap;
  transition: color .28s, font-weight .28s;
}
.sf-ruler-tick.is-on .sf-tick-label { color: var(--fg); font-weight: 700; }
.sf-ruler-price {
  display: flex; align-items: baseline; gap: 8px;
  margin: 0; padding-left: 12px;
}
.sf-ruler-num {
  font-family: var(--font-num); font-size: 30px; font-weight: 400;
  letter-spacing: -.03em; color: var(--fg); font-variant-numeric: tabular-nums;
}
.sf-ruler-note { font-size: 11.5px; color: var(--fg-3); }
.sf-warn { margin-top: 16px; font-size: 12px; color: #e0a030; }

/* 时长胶囊 */
.sf-terms { display: flex; flex-wrap: wrap; gap: 9px; padding-top: 10px; }
.sf-term {
  position: relative; cursor: pointer; border: 1px solid rgba(255, 255, 255, .9);
  padding: 16px 22px; border-radius: 999px; background: var(--card);
  backdrop-filter: blur(14px);
  color: var(--fg-2); font: inherit; font-size: 13px; font-weight: 500;
  box-shadow: 0 2px 8px rgba(40, 55, 100, .04);
  transition: transform .24s, box-shadow .24s, background .24s, color .24s;
}
.sf-term:hover { transform: translateY(-2px); color: var(--fg); }
.sf-term.is-on {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff; border-color: transparent;
  box-shadow: 0 10px 26px rgba(109, 124, 255, .3);
}
.sf-term-off {
  margin-left: 7px; font-size: 10.5px; font-weight: 700;
  color: #2eb888;
}
.sf-term.is-on .sf-term-off { color: rgba(255, 255, 255, .88); }

/* ── 城市详情 ── */
.sf-detail {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1px; background: var(--line); border-radius: var(--radius-s);
  overflow: hidden; margin-bottom: 26px;
}
.sf-detail-row {
  background: var(--card); backdrop-filter: blur(14px);
  padding: 18px 20px; display: flex; flex-direction: column; gap: 7px;
}
.sf-detail-protos { grid-column: 1 / -1; }
.sf-dk { font-size: 9.5px; font-weight: 600; letter-spacing: .12em; color: var(--fg-4); text-transform: uppercase; }
.sf-dv {
  font-size: 14px; font-weight: 500; color: var(--fg);
  font-variant-numeric: tabular-nums;
}
.sf-dv.l-good { color: #2eb888; }
.sf-dv.l-mid { color: #e0a030; }
.sf-dv.l-bad { color: #e05575; }
.sf-dv.l-none { color: var(--fg-4); }
.sf-protos { display: flex; flex-wrap: wrap; gap: 7px; }
.sf-protos i {
  font-style: normal; font-size: 10px; font-weight: 500;
  padding: 5px 11px; border-radius: 999px;
  color: var(--fg-2); background: rgba(255, 255, 255, .8);
  border: 1px solid var(--line);
}

/* ── 优惠码 ── */
.sf-coupon { display: flex; gap: 9px; align-items: center; margin-bottom: 8px; }
.sf-coupon input {
  flex: 1; min-width: 0; padding: 13px 20px; border: none; outline: none;
  border-radius: 999px; background: rgba(255, 255, 255, .8);
  color: var(--fg); font-family: var(--font); font-size: 13px;
  box-shadow: 0 2px 8px rgba(40, 55, 100, .04);
  transition: box-shadow .2s;
}
.sf-coupon input::placeholder { color: var(--fg-4); }
.sf-coupon input:focus { box-shadow: 0 0 0 2px rgba(109, 124, 255, .28); }
.sf-coupon-btn {
  flex: none; padding: 13px 24px; border: none; cursor: pointer;
  border-radius: 999px; background: rgba(255, 255, 255, .8);
  color: var(--fg-2); font-family: var(--font); font-size: 12.5px; font-weight: 600;
  box-shadow: 0 2px 8px rgba(40, 55, 100, .04);
  transition: background .2s, color .2s;
}
.sf-coupon-btn:hover { background: #fff; color: var(--fg); }
.sf-coupon-btn:disabled { opacity: .55; cursor: wait; }
.sf-coupon-x {
  flex: none; width: 42px; height: 42px; border: none; cursor: pointer;
  border-radius: 999px; background: rgba(255, 95, 122, .1);
  color: #e05575; font-size: 12px;
}
.sf-note { margin: 0 0 4px; font-size: 12px; font-weight: 500; }
.sf-note-ok { color: #2eb888; }
.sf-note-err { color: #e05575; }

/* ── 结算 ── */
.sf-checkout {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 28px; flex-wrap: wrap;
  margin-top: 34px; padding: 30px 32px;
  border-radius: var(--radius); background: var(--card);
  backdrop-filter: blur(20px);
  box-shadow: 0 4px 16px rgba(40, 55, 100, .06), 0 20px 50px rgba(40, 55, 100, .08);
}
.sf-checkout-cap {
  margin: 0 0 8px; font-size: 10px; font-weight: 700;
  letter-spacing: .16em; color: var(--fg-4); text-transform: uppercase;
}
.sf-checkout-price { display: flex; align-items: baseline; gap: 4px; font-variant-numeric: tabular-nums; }
.sf-cur { font-family: var(--font-num); font-size: 20px; font-weight: 400; color: var(--fg-3); }
.sf-price {
  font-family: var(--font-num); font-size: clamp(40px, 5.4vw, 62px);
  font-weight: 300; letter-spacing: -.045em; line-height: .94; color: var(--fg);
  animation: sf-num .36s cubic-bezier(.3,.9,.3,1);
}
@keyframes sf-num {
  from { opacity: .3; transform: translateY(8px) }
  to   { opacity: 1; transform: none }
}
.sf-was {
  font-size: 14px; font-weight: 400; color: var(--fg-4);
  text-decoration: line-through; margin-left: 8px;
}
.sf-checkout-meta { margin: 10px 0 0; font-size: 12px; color: var(--fg-3); }
.sf-balance {
  margin: 8px 0 0; font-size: 11px; font-weight: 500; color: var(--fg-3);
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.sf-balance.bad { color: #e0a030; }
.sf-topup { color: var(--accent); text-decoration: none; font-weight: 600; }
.sf-topup:hover { text-decoration: underline; }

.sf-activate {
  position: relative; overflow: hidden; cursor: pointer; border: none;
  padding: 19px 54px; border-radius: 999px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff; font-family: var(--font); font-size: 15px; font-weight: 700;
  letter-spacing: .04em;
  box-shadow: 0 12px 32px rgba(109, 124, 255, .34);
  transition: transform .2s cubic-bezier(.3,.9,.3,1), box-shadow .2s, filter .2s;
}
.sf-activate:hover { transform: translateY(-2px); box-shadow: 0 18px 44px rgba(109, 124, 255, .44); filter: brightness(1.05); }
.sf-activate:active { transform: scale(.97); }
.sf-activate:disabled { opacity: .55; cursor: wait; transform: none; }
.sf-activate-t { position: relative; z-index: 2; }
.sf-activate-ripple {
  position: absolute; z-index: 1; pointer-events: none;
  left: var(--rx, 50%); top: var(--ry, 50%);
  width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 999px;
  background: rgba(255, 255, 255, .7);
  animation: sf-ripple .7s cubic-bezier(.2,.8,.3,1);
}
@keyframes sf-ripple {
  from { transform: scale(0); opacity: .8 }
  to   { transform: scale(60); opacity: 0 }
}
@media (max-width: 640px) {
  .sf-checkout { flex-direction: column; align-items: stretch; padding: 24px; }
  .sf-activate { width: 100%; }
}

/* ── 收尾 ── */
.sf-outro {
  margin: clamp(48px, 7vw, 90px) 0 0;
  max-width: 460px;
  font-size: 12.5px; line-height: 1.9; color: var(--fg-3);
}

/* ── 加载 / 空态 ── */
.sf-loading {
  display: flex; gap: 7px; justify-content: center; padding: 90px 0;
}
.sf-loading span {
  width: 7px; height: 7px; border-radius: 999px; background: var(--accent);
  animation: sf-dot 1.2s ease-in-out infinite;
}
.sf-loading span:nth-child(2) { animation-delay: .15s }
.sf-loading span:nth-child(3) { animation-delay: .3s }
@keyframes sf-dot {
  0%, 100% { opacity: .22; transform: translateY(0) }
  50%      { opacity: 1; transform: translateY(-5px) }
}

.sf-empty { text-align: center; padding: 80px 20px; }
.sf-empty-dot {
  width: 46px; height: 46px; margin: 0 auto 22px; border-radius: 50%;
  background: radial-gradient(circle at 34% 28%, #fff, var(--city-a));
  box-shadow: 0 12px 34px color-mix(in srgb, var(--city-a) 34%, transparent);
  animation: sf-breathe 4s ease-in-out infinite;
}
.sf-empty-t { margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: .16em; color: var(--fg-2); }
.sf-empty-p { margin: 0 auto; max-width: 360px; font-size: 12.5px; line-height: 1.9; color: var(--fg-3); }

/* ── 弹窗 ── */
.sf-modal {
  position: fixed; inset: 0; z-index: 10001; display: flex;
  align-items: center; justify-content: center; padding: 20px;
  background: rgba(30, 38, 62, .38); backdrop-filter: blur(14px);
}
.sf-modal-box {
  width: 100%; max-width: 360px; padding: 40px 30px 28px; text-align: center;
  border-radius: 30px; background: rgba(255, 255, 255, .95);
  box-shadow: 0 30px 80px rgba(40, 55, 100, .24);
  animation: sf-modal-in .44s cubic-bezier(.3,.9,.3,1);
}
@keyframes sf-modal-in {
  from { opacity: 0; transform: scale(.93) translateY(14px) }
  to   { opacity: 1; transform: none }
}
.sf-modal-orb {
  width: 62px; height: 62px; margin: 0 auto 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 34% 28%, #fff, var(--city-a) 62%, var(--city-b));
  box-shadow: 0 14px 40px color-mix(in srgb, var(--city-a) 40%, transparent);
}
.sf-modal-orb span {
  width: 20px; height: 20px; border-radius: 50%;
  background: rgba(255, 255, 255, .9);
}
.sf-modal-t { margin: 0 0 12px; font-size: 26px; font-weight: 600; letter-spacing: -.025em; color: var(--fg); }
.sf-modal-d { margin: 0 0 18px; font-size: 13px; line-height: 1.75; color: var(--fg-3); }
.sf-modal-id {
  margin: 0 0 4px; padding: 12px 16px; border-radius: 14px;
  font-size: 12px; font-weight: 500; color: var(--fg-2); word-break: break-all;
  background: rgba(40, 55, 100, .05);
}
.sf-modal-acts { display: flex; flex-direction: column; gap: 9px; margin-top: 22px; }
.sf-modal-primary {
  padding: 16px; border: none; cursor: pointer; border-radius: 999px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff; font-family: var(--font); font-size: 14px; font-weight: 600;
  box-shadow: 0 10px 26px rgba(109, 124, 255, .3);
  transition: transform .18s, filter .18s;
}
.sf-modal-primary:hover { transform: translateY(-1px); filter: brightness(1.05); }
.sf-modal-ghost {
  padding: 16px; border: none; cursor: pointer; border-radius: 999px;
  background: rgba(40, 55, 100, .06); color: var(--fg-2);
  font-family: var(--font); font-size: 13px; font-weight: 500;
  transition: background .18s;
}
.sf-modal-ghost:hover { background: rgba(40, 55, 100, .1); }

/* ══════════════════════════════════════════════════════════════════════════
   其余四套主题：只做变量级兜底，新布局的细节不为它们精调
   ══════════════════════════════════════════════════════════════════════════ */
.sf-root[data-theme="chrome"] {
  --bg: #08080a; --card: rgba(255,255,255,.045); --card-solid: #14141a;
  --fg: #f2f4f8; --fg-2: #8b8b98; --fg-3: #5a5a66; --fg-4: #3d3d46;
  --line: rgba(255,255,255,.08); --line-2: rgba(255,255,255,.16);
  --accent: #ccff00; --accent-2: #a8e000;
  --radius: 4px; --radius-s: 3px;
  --font: "Inter", "PingFang SC", system-ui, sans-serif;
}
.sf-root[data-theme="chrome"] .sf-blob { opacity: .18; }
.sf-root[data-theme="chrome"] .sf-btn-solid,
.sf-root[data-theme="chrome"] .sf-activate,
.sf-root[data-theme="chrome"] .sf-term.is-on,
.sf-root[data-theme="chrome"] .sf-modal-primary { color: #08080a; }
.sf-root[data-theme="chrome"] .sf-btn-solid { background: #ccff00; box-shadow: none; }
.sf-root[data-theme="chrome"] .sf-activate { background: #f2f4f8; color: #08080a; box-shadow: none; }

.sf-root[data-theme="minimal"] {
  --bg: #f6f5f2; --card: #f6f5f2; --card-solid: #fff;
  --fg: #111110; --fg-2: #5c5b57; --fg-3: #8e8d88; --fg-4: #c9c8c3;
  --line: rgba(17,17,16,.1); --line-2: rgba(17,17,16,.18);
  --accent: #111110; --accent-2: #333;
  --radius: 4px; --radius-s: 3px;
  --font: "Helvetica Neue", "PingFang SC", system-ui, sans-serif;
}
.sf-root[data-theme="minimal"] .sf-aurora { display: none; }
.sf-root[data-theme="minimal"] .sf-city,
.sf-root[data-theme="minimal"] .sf-term,
.sf-root[data-theme="minimal"] .sf-checkout,
.sf-root[data-theme="minimal"] .sf-detail-row { backdrop-filter: none; box-shadow: none; border-color: var(--line); }
.sf-root[data-theme="minimal"] .sf-city.is-on { box-shadow: 0 0 0 1.5px #111110; }

.sf-root[data-theme="brutal"] {
  --bg: #ccff00; --card: transparent; --card-solid: #000;
  --fg: #000; --fg-2: rgba(0,0,0,.68); --fg-3: rgba(0,0,0,.55); --fg-4: rgba(0,0,0,.3);
  --line: #000; --line-2: #000;
  --accent: #000; --accent-2: #000;
  --radius: 0px; --radius-s: 0px;
  --font: "Arial Black", Impact, "PingFang SC", sans-serif;
}
.sf-root[data-theme="brutal"] .sf-aurora { display: none; }
.sf-root[data-theme="brutal"] .sf-city,
.sf-root[data-theme="brutal"] .sf-term,
.sf-root[data-theme="brutal"] .sf-checkout,
.sf-root[data-theme="brutal"] .sf-detail-row { backdrop-filter: none; box-shadow: none; border: 2px solid #000; }
.sf-root[data-theme="brutal"] .sf-city.is-on { background: #000; box-shadow: none; }
.sf-root[data-theme="brutal"] .sf-city.is-on .sf-city-name,
.sf-root[data-theme="brutal"] .sf-city.is-on .sf-city-time,
.sf-root[data-theme="brutal"] .sf-city.is-on .sf-city-price { color: #ccff00; }
.sf-root[data-theme="brutal"] .sf-btn-solid,
.sf-root[data-theme="brutal"] .sf-activate,
.sf-root[data-theme="brutal"] .sf-term.is-on { background: #000; color: #ccff00; box-shadow: none; }

.sf-root[data-theme="precise"] {
  --bg: #07090c; --card: #0b0e13; --card-solid: #0e1218;
  --fg: #c3cfd9; --fg-2: #7d8e9c; --fg-3: #55636e; --fg-4: #2b353d;
  --line: rgba(120,180,210,.14); --line-2: rgba(120,180,210,.3);
  --accent: #4ade80; --accent-2: #2eb888;
  --radius: 3px; --radius-s: 2px;
  --font: ui-monospace, "SF Mono", Consolas, monospace;
  --font-num: ui-monospace, "SF Mono", Consolas, monospace;
}
.sf-root[data-theme="precise"] .sf-aurora { display: none; }
.sf-root[data-theme="precise"] .sf-city,
.sf-root[data-theme="precise"] .sf-term,
.sf-root[data-theme="precise"] .sf-checkout,
.sf-root[data-theme="precise"] .sf-detail-row { backdrop-filter: none; box-shadow: none; }
.sf-root[data-theme="precise"] .sf-city-name { font-size: 17px; }
.sf-root[data-theme="precise"] .sf-city-time { font-size: 19px; }
.sf-root[data-theme="precise"] .sf-h1 { font-size: clamp(24px, 3.4vw, 40px); }
</style>
