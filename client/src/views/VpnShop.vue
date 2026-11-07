<template>
  <div class="lc-root" :data-theme="theme" @mousemove="onMove" @mouseleave="onLeave">
    <div class="lc-grain" aria-hidden="true"></div>

    <!-- ═══ 顶栏 + 主题切换 ═══ -->
    <header class="lc-top">
      <div class="lc-top-l">
        <span class="lc-mark">XNOW</span>
        <span class="lc-top-slash">/</span>
        <span class="lc-top-t">NODES</span>
      </div>
      <div class="lc-themes">
        <span class="lc-themes-l">STYLE</span>
        <button v-for="t in THEMES" :key="t.v" @click="setTheme(t.v)"
          :class="['lc-theme-btn', theme === t.v && 'is-on']" :title="t.d">{{ t.t }}</button>
      </div>
      <div class="lc-top-r">
        <span class="lc-top-t">{{ nodes.length || '00' }} LOC</span>
        <span class="lc-top-dot"></span>
        <span class="lc-top-t">{{ bestLatency }}</span>
      </div>
    </header>

    <!-- ═══ 首屏 ═══ -->
    <section class="lc-hero">
      <div class="lc-vtext" aria-hidden="true">
        <span>安全节点</span>
        <span class="lc-vtext-en">SECURE / ROUTE</span>
      </div>

      <div class="lc-orb-wrap" :style="orbStyle" aria-hidden="true">
        <div class="lc-orb">
          <div class="lc-orb-sheen"></div>
          <div class="lc-orb-ring"></div>
          <div class="lc-orb-grid"></div>
        </div>
        <div class="lc-orb-shadow"></div>
        <div class="lc-orb-orbit"><span class="lc-orbit-dot"></span></div>
      </div>

      <div class="lc-head">
        <p class="lc-eyebrow">
          <span class="lc-eyebrow-line"></span>
          {{ appStore.lang === 'zh' ? '为跨境创作者而建' : 'BUILT FOR CREATORS' }}
        </p>

        <h1 class="lc-title">
          <span class="lc-title-a">{{ appStore.lang === 'zh' ? '账号在哪' : 'YOUR IP' }}</span>
          <span class="lc-title-b">{{ appStore.lang === 'zh' ? 'IP 就在哪' : 'LIVES HERE' }}</span>
        </h1>

        <p class="lc-lede">
          {{ appStore.lang === 'zh'
            ? 'TikTok 限流、账号被标记、直播掉帧 —— 跨境自媒体里，IP 纯净度直接决定账号生死。原生住宅 IP + TLS/Reality 伪装，让你的流量真正「像当地人」。'
            : 'Shadow banned? IP flagged? Laggy streams? Residential IPs with TLS+Reality obfuscation.' }}
        </p>

        <div class="lc-cta-row">
          <button v-if="trialEnabled" @click="startTrial" :disabled="trialBusy" class="lc-btn lc-btn-acid">
            {{ trialBusy ? '···' : (appStore.lang === 'zh' ? '免费试用 100MB' : 'FREE TRIAL') }}
            <span class="lc-btn-arrow">↗</span>
          </button>
          <a href="#pick" class="lc-btn lc-btn-ghost">
            {{ appStore.lang === 'zh' ? '选择节点' : 'SELECT NODE' }}
            <span class="lc-btn-arrow">↓</span>
          </a>
        </div>
      </div>
    </section>

    <!-- ═══ 数据条 ═══ -->
    <div class="lc-ticker">
      <div class="lc-ticker-item">
        <span class="lc-ticker-n">{{ nodes.length || '00' }}</span>
        <span class="lc-ticker-l">{{ appStore.lang === 'zh' ? '全球节点' : 'LOCATIONS' }}</span>
      </div>
      <div class="lc-ticker-item">
        <span class="lc-ticker-n">99.9<i>%</i></span>
        <span class="lc-ticker-l">{{ appStore.lang === 'zh' ? '在线率' : 'UPTIME' }}</span>
      </div>
      <div class="lc-ticker-item">
        <span class="lc-ticker-n">{{ bestLatency }}</span>
        <span class="lc-ticker-l">{{ appStore.lang === 'zh' ? '最优延迟' : 'BEST PING' }}</span>
      </div>
      <div class="lc-ticker-item">
        <span class="lc-ticker-n lc-ticker-word">Reality</span>
        <span class="lc-ticker-l">{{ appStore.lang === 'zh' ? '协议伪装' : 'STEALTH' }}</span>
      </div>
    </div>

    <main class="lc-main">
      <div v-if="!loading && nodes.length === 0" class="lc-empty">
        <div class="lc-empty-orb"></div>
        <p class="lc-empty-t">NODE DEPLOYING</p>
        <p class="lc-empty-p">{{ appStore.lang === 'zh'
          ? '节点正在部署。开通后这里会自动列出全部地区、价格与实时延迟。'
          : 'Nodes are being deployed.' }}</p>
      </div>

      <div v-if="loading" class="lc-loading">
        <span class="lc-loading-t">LOADING</span>
        <span class="lc-loading-dots"><i></i><i></i><i></i></span>
      </div>

      <template v-else-if="nodes.length > 0">
        <!-- ① -->
        <section id="pick" class="lc-sec">
          <div class="lc-sec-head">
            <span class="lc-idx">01</span>
            <h2 class="lc-sec-t">{{ appStore.lang === 'zh' ? '选择地区' : 'LOCATION' }}</h2>
            <div class="lc-sec-fill"></div>
            <div class="lc-filter">
              <button v-for="r in regionOptions" :key="r.v" @click="regionFilter = r.v"
                :class="['lc-filter-btn', regionFilter === r.v && 'is-on']">{{ r.t }}</button>
            </div>
          </div>

          <div class="lc-search">
            <input v-model="searchQuery" type="text"
              :placeholder="appStore.lang === 'zh' ? '搜索地区或机房' : 'Search region'" />
            <span class="lc-search-line"></span>
          </div>

          <div class="lc-grid">
            <button v-for="(n, i) in filteredNodes" :key="n.id" @click="selectNode(n)"
              :class="['lc-card', selectedNode?.id === n.id && 'is-on', n._demo && 'is-demo']"
              :style="{ '--d': (i * 55) + 'ms' }">
              <div class="lc-card-top">
                <span class="lc-card-flag">
                  <img v-if="getFlagUrl(n)" :src="getFlagUrl(n)" alt=""
                    @error="e => e.target.style.display = 'none'" />
                  <span v-else>{{ n.flag_emoji || '◈' }}</span>
                </span>
                <span v-if="n._demo" class="lc-demo">示例</span>
                <span v-if="selectedNode?.id === n.id" class="lc-card-on">◆</span>
              </div>
              <h3 class="lc-card-name">{{ n.name }}</h3>
              <p class="lc-card-loc">{{ n.vps_location || '—' }}</p>
              <div class="lc-card-foot">
                <span class="lc-card-price">
                  <i>¥</i>{{ parseFloat(n.price_per_gb || 0).toFixed(2) }}<em>/GB</em>
                </span>
                <span :class="['lc-lat', latClass(n.id)]">{{ latText(n.id) }}</span>
              </div>
              <span class="lc-card-sweep" aria-hidden="true"></span>
            </button>

            <div v-if="filteredNodes.length === 0" class="lc-none">
              {{ appStore.lang === 'zh' ? '没有匹配的节点' : 'NO MATCH' }}
            </div>
          </div>
        </section>

        <template v-if="selectedNode">
          <!-- ② -->
          <section class="lc-sec">
            <div class="lc-sec-head">
              <span class="lc-idx">02</span>
              <h2 class="lc-sec-t">{{ appStore.lang === 'zh' ? '流量配额' : 'TRAFFIC' }}</h2>
              <div class="lc-sec-fill"></div>
            </div>
            <div class="lc-opts">
              <button v-for="g in affordableTraffic" :key="g" @click="selectedTraffic = g"
                :class="['lc-opt', selectedTraffic === g && 'is-on']">
                <span class="lc-opt-v">{{ g >= 1000 ? (g / 1000).toFixed(1) : g }}</span>
                <span class="lc-opt-u">{{ g >= 1000 ? 'TB' : 'GB' }}</span>
                <span class="lc-opt-p">¥{{ trafficPrice(g).toFixed(0) }}</span>
              </button>
              <div v-if="affordableTraffic.length === 0" class="lc-warn">
                {{ appStore.lang === 'zh' ? '此节点已达容量上限' : 'AT CAPACITY' }}
              </div>
            </div>
          </section>

          <!-- ③ -->
          <section class="lc-sec">
            <div class="lc-sec-head">
              <span class="lc-idx">03</span>
              <h2 class="lc-sec-t">{{ appStore.lang === 'zh' ? '使用时长' : 'DURATION' }}</h2>
              <div class="lc-sec-fill"></div>
            </div>
            <div class="lc-opts lc-opts-4">
              <button v-for="d in durationOptions" :key="d.days" @click="selectedDuration = d"
                :class="['lc-opt', selectedDuration?.days === d.days && 'is-on']">
                <span v-if="d.discount <= 0.75" class="lc-opt-best">BEST</span>
                <span class="lc-opt-v lc-opt-v-sm">{{ d.label }}</span>
                <span v-if="d.discount < 1" class="lc-opt-off">−{{ Math.round((1 - d.discount) * 100) }}%</span>
              </button>
            </div>
          </section>

          <div class="lc-specs">
            <div class="lc-spec">
              <span class="lc-spec-k">PROTOCOL</span>
              <span class="lc-spec-v">{{ getProtocols(selectedNode).length }} 种</span>
            </div>
            <div class="lc-spec">
              <span class="lc-spec-k">CAPACITY</span>
              <span class="lc-spec-v">{{ selectedNode.max_traffic_gb }}<i>GB</i></span>
            </div>
            <div class="lc-spec">
              <span class="lc-spec-k">ROUTE</span>
              <span class="lc-spec-v lc-spec-v-sm">{{ selectedNode.description || 'BGP' }}</span>
            </div>
            <div class="lc-spec">
              <span class="lc-spec-k">LATENCY</span>
              <span :class="['lc-spec-v', latClass(selectedNode.id)]">{{ latText(selectedNode.id) }}</span>
            </div>
          </div>

          <div class="lc-protos">
            <span v-for="p in getProtocols(selectedNode)" :key="p" class="lc-proto">{{ p }}</span>
          </div>

          <div class="lc-coupon">
            <span class="lc-coupon-l">COUPON</span>
            <input v-model="couponCode" @keyup.enter="applyCoupon" type="text" maxlength="20"
              :placeholder="appStore.lang === 'zh' ? '输入优惠码' : 'Enter code'" />
            <button @click="applyCoupon" :disabled="couponApplying" class="lc-coupon-btn">
              {{ couponApplying ? '···' : (appStore.lang === 'zh' ? '应用' : 'APPLY') }}
            </button>
            <button v-if="couponApplied" @click="removeCoupon" class="lc-coupon-x">✕</button>
          </div>
          <p v-if="couponApplied" class="lc-ok">− ¥{{ couponApplied.discount }} · {{ couponApplied.code }}</p>
          <p v-if="couponError" class="lc-err">{{ couponError }}</p>

          <div class="lc-pay">
            <div class="lc-pay-l">
              <p class="lc-pay-desc">
                {{ selectedNode.name }} · {{ selectedTraffic }}GB · {{ selectedDuration?.label }}
              </p>
              <div class="lc-pay-amount">
                <span class="lc-pay-cur">¥</span>
                <span class="lc-pay-num" :key="(couponApplied ? couponApplied.final_amount : finalPrice).toFixed(2)">
                  {{ (couponApplied ? couponApplied.final_amount : finalPrice).toFixed(2) }}
                </span>
                <span v-if="couponApplied" class="lc-pay-was">¥{{ finalPrice.toFixed(2) }}</span>
              </div>
              <p :class="['lc-pay-bal', balanceOk ? 'is-ok' : 'is-bad']">
                {{ appStore.lang === 'zh' ? '余额' : 'BALANCE' }} ¥{{ parseFloat(userStore.userInfo?.balance || 0).toFixed(2) }}
              </p>
            </div>
            <div class="lc-pay-r">
              <button @click="buy" :disabled="buying" class="lc-buy">
                <span>{{ buying ? '···' : (appStore.lang === 'zh' ? '立即开通' : 'ACTIVATE') }}</span>
                <span class="lc-buy-ripple" :style="rippleStyle"></span>
              </button>
              <router-link v-if="!balanceOk" to="/recharge" class="lc-topup">
                {{ appStore.lang === 'zh' ? '余额不足 · 去充值' : 'TOP UP' }} ↗
              </router-link>
            </div>
          </div>
        </template>
      </template>

      <footer class="lc-foot">
        <div class="lc-foot-row">
          <span>◈ {{ appStore.lang === 'zh' ? '支付宝 / 微信 / USDT' : 'ALIPAY / WECHAT / USDT' }}</span>
          <span>◈ {{ appStore.lang === 'zh' ? '下单即得订阅链接' : 'INSTANT SUBSCRIPTION' }}</span>
          <span>◈ {{ appStore.lang === 'zh' ? '全平台客户端' : 'ALL PLATFORMS' }}</span>
          <span>◈ 7×12H</span>
        </div>
      </footer>
    </main>

    <div v-if="showSuccess" class="lc-modal" @click.self="showSuccess = false">
      <div class="lc-modal-box">
        <div class="lc-modal-orb"></div>
        <p class="lc-modal-k">ACTIVATED</p>
        <h2 class="lc-modal-t">{{ appStore.lang === 'zh' ? '节点已开通' : 'NODE ACTIVATED' }}</h2>
        <p v-if="purchaseResult?.email" class="lc-modal-id">{{ purchaseResult.email }}</p>
        <div class="lc-modal-btns">
          <button @click="goToClients" class="lc-modal-p">{{ appStore.lang === 'zh' ? '查看我的节点' : 'MY NODES' }}</button>
          <button @click="showSuccess = false" class="lc-modal-g">{{ appStore.lang === 'zh' ? '继续' : 'CLOSE' }}</button>
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

// ═══ 主题：5 套风格，右上角实时切换，选择记在 localStorage ═══
const THEMES = [
  { v: 'chrome', t: '铬', d: '液态铬 · 当前默认' },
  { v: 'minimal', t: '简', d: '极简 · 米白大留白' },
  { v: 'brutal', t: '凶', d: '硬核 · 酸性绿压满' },
  { v: 'precise', t: '精', d: '精密 · 终端网格' },
  { v: 'soft', t: '软', d: '柔和 · 大圆角微光' },
];
const THEME_KEY = 'xnow_vpn_theme';
const theme = ref('chrome');
const setTheme = (v) => {
  theme.value = v;
  try { localStorage.setItem(THEME_KEY, v); } catch (e) {}
};
const THEME_TEST = new URLSearchParams(
  typeof window !== 'undefined' ? window.location.search : ''
).get('style');

// ── 铬球视差 ──
const px = ref(0), py = ref(0), mx = ref(50), my = ref(50);
const onMove = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  mx.value = ((e.clientX - r.left) / r.width) * 100;
  my.value = ((e.clientY - r.top) / r.height) * 100;
  px.value = (mx.value - 50) / 50;
  py.value = (my.value - 50) / 50;
};
const onLeave = () => { px.value = 0; py.value = 0; mx.value = 50; my.value = 50; };
const orbStyle = computed(() => ({
  transform: `translate3d(${px.value * -14}px, ${py.value * -12}px, 0)`,
  '--gx': mx.value + '%',
  '--gy': my.value + '%',
}));

// ── 按钮涟漪 ──
const rippleStyle = ref({});
const onPointerDown = (e) => {
  const btn = e.target.closest('.lc-buy');
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  rippleStyle.value = { '--rx': (e.clientX - r.left) + 'px', '--ry': (e.clientY - r.top) + 'px' };
};

const EMOJI_MAP = { '🇭🇰':'hk','🇯🇵':'jp','🇰🇷':'kr','🇹🇼':'tw','🇸🇬':'sg','🇹🇭':'th','🇻🇳':'vn','🇲🇾':'my','🇵🇭':'ph','🇮🇩':'id','🇮🇳':'in','🇦🇪':'ae','🇺🇸':'us','🇨🇦':'ca','🇬🇧':'gb','🇩🇪':'de','🇳🇱':'nl','🇫🇷':'fr','🇷🇺':'ru','🇦🇺':'au','🇧🇷':'br','🇦🇷':'ar','🇿🇦':'za','🇲🇽':'mx' };
const NAME_MAP = { hk:'hk',hongkong:'hk',jp:'jp',japan:'jp',kr:'kr',korea:'kr',tw:'tw',taiwan:'tw',sg:'sg',singapore:'sg',th:'th',thailand:'th',vn:'vn',vietnam:'vn',my:'my',malaysia:'my',ph:'ph',philippines:'ph',id:'id',indonesia:'id',in:'in',india:'in',ae:'ae',uae:'ae',us:'us',usa:'us',ca:'ca',canada:'ca',uk:'gb',gb:'gb',de:'de',germany:'de',nl:'nl',netherlands:'nl',fr:'fr',france:'fr',ru:'ru',russia:'ru',au:'au',australia:'au',br:'br',brazil:'br',ar:'ar',argentina:'ar',za:'za',southafrica:'za',mx:'mx',mexico:'mx' };
const getFlagCode = (n) => {
  const emoji = n.flag_emoji || '';
  if (EMOJI_MAP[emoji]) return EMOJI_MAP[emoji];
  const lower = emoji.toLowerCase().trim();
  if (NAME_MAP[lower] && lower.length <= 4) return NAME_MAP[lower];
  const loc = (n.vps_location || '').toLowerCase();
  for (const [k, v] of Object.entries(NAME_MAP)) if (k.length > 2 && loc.startsWith(k)) return v;
  return null;
};
const getFlagUrl = (n) => { const c = getFlagCode(n); return c ? `https://flagcdn.com/w80/${c}.png` : ''; };
const DEF_PROTOS = ['VLESS + Reality', 'VMess + WS', 'Trojan + TLS', 'Shadowsocks', 'Hysteria2'];
const getProtocols = (n) => { try { const p = JSON.parse(n.protocols || '[]'); return Array.isArray(p) && p.length ? p : DEF_PROTOS; } catch (e) { return DEF_PROTOS; } };

const nodes = ref([]); const trafficOptions = ref([100, 200, 500, 1000, 2000]);
const durationOptions = ref([{ days: 30, label: '1个月', discount: 1 }, { days: 90, label: '3个月', discount: .9 }, { days: 180, label: '6个月', discount: .85 }, { days: 360, label: '12个月', discount: .75 }]);
const loading = ref(true); const buying = ref(false); const showSuccess = ref(false); const purchaseResult = ref(null);
const selectedNode = ref(null); const selectedTraffic = ref(200); const selectedDuration = ref(durationOptions.value[0]);
const latencyMap = ref({});
const searchQuery = ref('');
const regionFilter = ref('');
const trialEnabled = ref(false);
const trialBusy = ref(false);

const REGION_DEF = [
  { v: '', t: '全部' }, { v: 'asia', t: '亚洲' }, { v: 'americas', t: '美洲' },
  { v: 'europe', t: '欧洲' }, { v: 'oceania', t: '大洋洲' }, { v: 'middle-east', t: '中东' },
];
const regionOptions = computed(() => appStore.lang === 'zh' ? REGION_DEF
  : [{ v: '', t: 'ALL' }, { v: 'asia', t: 'ASIA' }, { v: 'americas', t: 'AMER' }, { v: 'europe', t: 'EURO' }, { v: 'oceania', t: 'OCEA' }, { v: 'middle-east', t: 'M.E' }]);

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

const startTrial = async () => {
  if (!userStore.token) { uiStore.showToast(appStore.lang === 'zh' ? '请先登录' : 'Please login', 'error'); return; }
  trialBusy.value = true;
  try {
    const r = await fetch('/api/vpn/trial', { method: 'POST', headers: { 'Authorization': `Bearer ${userStore.token}` } });
    const d = await r.json();
    if (d.status === 'success') { uiStore.showToast(appStore.lang === 'zh' ? '试用节点已创建' : 'Trial created', 'success'); router.push('/vpn/clients'); }
    else uiStore.showToast(d.message || 'FAILED', 'error');
  } catch (e) { uiStore.showToast('NETWORK ERROR', 'error'); }
  trialBusy.value = false;
};
const couponCode = ref('');
const couponApplied = ref(null);
const couponError = ref('');
const couponApplying = ref(false);

const applyCoupon = async () => {
  if (!couponCode.value.trim()) return;
  couponApplying.value = true; couponError.value = ''; couponApplied.value = null;
  try {
    const r = await fetch('/api/vpn/coupon/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: couponCode.value, amount: finalPrice.value })
    });
    const d = await r.json();
    if (d.status === 'success') { couponApplied.value = d.data; couponError.value = ''; }
    else { couponError.value = d.message; couponApplied.value = null; }
  } catch (e) { couponError.value = 'VERIFY FAILED'; }
  couponApplying.value = false;
};
const removeCoupon = () => { couponApplied.value = null; couponCode.value = ''; couponError.value = ''; };

const regionMap = { '🇭🇰':'asia','🇯🇵':'asia','🇰🇷':'asia','🇹🇼':'asia','🇸🇬':'asia','🇹🇭':'asia','🇻🇳':'asia','🇲🇾':'asia','🇵🇭':'asia','🇮🇩':'asia','🇮🇳':'asia','🇨🇳':'asia','🇦🇪':'middle-east','🇸🇦':'middle-east','🇹🇷':'middle-east','🇺🇸':'americas','🇨🇦':'americas','🇲🇽':'americas','🇧🇷':'americas','🇦🇷':'americas','🇬🇧':'europe','🇩🇪':'europe','🇳🇱':'europe','🇫🇷':'europe','🇷🇺':'europe','🇸🇪':'europe','🇨🇭':'europe','🇮🇹':'europe','🇪🇸':'europe','🇵🇱':'europe','🇦🇺':'oceania','🇿🇦':'africa' };
const filteredNodes = computed(() => {
  let list = nodes.value;
  if (regionFilter.value) list = list.filter((n) => regionMap[n.flag_emoji || ''] === regionFilter.value);
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter((n) => (n.name || '').toLowerCase().includes(q) || (n.vps_location || '').toLowerCase().includes(q));
  }
  return list;
});

const pingNodes = async () => {
  if (!nodes.value.length) return;
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

const basePrice = computed(() => { if (!selectedNode.value) return 0; const ppg = parseFloat(selectedNode.value.price_per_gb || .5); const m = (selectedDuration.value?.days || 30) / 30; return parseFloat((ppg * selectedTraffic.value * m).toFixed(2)); });
const finalPrice = computed(() => { const raw = parseFloat((basePrice.value * (selectedDuration.value?.discount || 1)).toFixed(2)); return raw < 10 ? 10 : raw; });
const actualPrice = computed(() => couponApplied.value ? couponApplied.value.final_amount : finalPrice.value);
const balanceOk = computed(() => parseFloat(userStore.userInfo?.balance || 0) >= actualPrice.value);

const affordableTraffic = computed(() => {
  const cap = selectedNode.value?.max_traffic_gb || 2000;
  return trafficOptions.value.filter((t) => t <= cap);
});
const trafficPrice = (g) => {
  if (!selectedNode.value) return 0;
  const ppg = parseFloat(selectedNode.value.price_per_gb || .5);
  const m = (selectedDuration.value?.days || 30) / 30;
  const raw = parseFloat((ppg * g * m * (selectedDuration.value?.discount || 1)).toFixed(2));
  return raw < 10 ? 10 : raw;
};

onMounted(async () => {
  // 主题：URL ?style= 优先（方便直接分享某个风格），否则读上次选择
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEME_TEST && THEMES.some((t) => t.v === THEME_TEST)) theme.value = THEME_TEST;
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
  if (nodes.value.length === 0) {
    nodes.value = [
      { id: 1, name: '美国洛杉矶', flag_emoji: '🇺🇸', vps_location: '洛杉矶 · CN2 GIA', price_per_gb: .3, max_traffic_gb: 2000, _demo: true },
      { id: 2, name: '英国伦敦', flag_emoji: '🇬🇧', vps_location: '伦敦 · 9929', price_per_gb: .35, max_traffic_gb: 1000, _demo: true },
    ];
    selectedNode.value = nodes.value[0];
  }
  loading.value = false;
  setTimeout(pingNodes, 500);
  try { const r2 = await fetch('/api/vpn/trial-check'); const d2 = await r2.json(); trialEnabled.value = d2.status === 'success' && d2.enabled; } catch (e) {}

  document.addEventListener('pointerdown', onPointerDown, true);
});
onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown, true);
});

const selectNode = (n) => {
  selectedNode.value = n;
  const valid = trafficOptions.value.filter((t) => t <= (n.max_traffic_gb || 2000));
  if (valid.length > 0 && !valid.includes(selectedTraffic.value)) selectedTraffic.value = valid[0];
};
const buy = async () => {
  if (!selectedNode.value) return;
  const nd = selectedNode.value;
  if (nd._demo) return uiStore.showToast(appStore.lang === 'zh' ? '这是示例节点，配置真实节点后即可购买' : 'Demo node', 'error');
  if (!userStore.token) return uiStore.showToast(appStore.lang === 'zh' ? '请先登录' : 'Please login', 'error');
  const price = actualPrice.value;
  if (parseFloat(userStore.userInfo?.balance || 0) < price) return uiStore.showToast(appStore.lang === 'zh' ? '余额不足，请先充值' : 'Insufficient balance', 'error');
  if (!await uiStore.showConfirm(`${nd.name} · ${selectedTraffic.value}GB · ${selectedDuration.value.label} · ¥${price.toFixed(2)}`, appStore.lang === 'zh' ? '确认订单' : 'Confirm')) return;
  buying.value = true;
  try {
    const r = await fetch('/api/vpn/buy', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` }, body: JSON.stringify({ product_id: nd.id, traffic_gb: selectedTraffic.value, duration_days: selectedDuration.value.days, coupon_id: couponApplied.value?.id || null }) });
    const d = await r.json();
    if (d.status === 'success') { if (d.data?.balance) userStore.updateUserInfo({ balance: d.data.balance }); purchaseResult.value = d.data; showSuccess.value = true; }
    else uiStore.showToast(d.message || 'FAILED', 'error');
  } catch (e) { uiStore.showToast('NETWORK ERROR', 'error'); }
  buying.value = false;
};
const goToClients = () => { showSuccess.value = false; router.push('/vpn/clients'); };
</script>

<style>
/* ══════════════════════════════════════════════════════════════════════════
   五套风格（2026-11-07）
   --------------------------------------------------------------------------
   祥哥要「都要」—— 极简 / 凶 / 精密 / 软，加上原本的液态铬，一共五套。
   做法：**一套 DOM + 五组 CSS 变量 + 主题级覆盖**，右上角实时切换，
   选择记 localStorage，也支持 ?style=minimal 直接分享某个风格。

   为什么不用五个组件：五套外观的**信息结构完全一样**（同样是选节点、选流量、
   选时长、结算），差别在材质与排版。拆成五个组件会有五份重复的逻辑要同步维护，
   改一个 bug 得改五遍。变量化的代价是 CSS 长一点，但只有一份 JS。

   五套的性格：
     chrome   液态铬 —— 镜面金属球，冷、精密、贵
     minimal  极简   —— 米白大留白，细字重，只靠排版说话
     brutal   凶     —— 酸性绿铺满，超粗黑体压屏，像 rave flyer
     precise  精密   —— 终端网格，等宽字体，数据面板感
     soft     软     —— 大圆角 + 柔和渐变 + 扩散阴影，接近 Apple Liquid Glass
   ══════════════════════════════════════════════════════════════════════════ */

/* ── 兜底变量（chrome 用） ── */
.lc-root {
  --bg: #08080a;
  --bg-2: #0c0c10;
  --fg: #f2f4f8;
  --fg-dim: #8b8b98;
  --fg-faint: #4a4a54;
  --fg-ghost: #2e2e36;
  --line: rgba(255, 255, 255, .08);
  --line-strong: rgba(255, 255, 255, .16);
  --accent: #ccff00;
  --accent-fg: #08080a;
  --radius: 0px;
  --radius-sm: 0px;
  --font: "Inter", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, sans-serif;
  --font-num: "Inter", system-ui, sans-serif;
  --title-size: clamp(40px, 7.4vw, 84px);
  --title-weight-a: 200;
  --title-weight-b: 900;
  --title-spacing: -.045em;
  --h1-transform: none;
  --shadow-card: none;
  --grain: .045;
  --orb-show: block;
}

.lc-root {
  position: relative; min-height: 100vh;
  background: var(--bg); color: var(--fg);
  overflow-x: hidden; font-family: var(--font);
  -webkit-font-smoothing: antialiased;
  transition: background .4s, color .4s;
}

/* 噪点 */
.lc-grain {
  position: fixed; inset: 0; z-index: 9999; pointer-events: none; opacity: var(--grain);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

@media (prefers-reduced-motion: reduce) {
  .lc-orb, .lc-orb-sheen, .lc-orb-ring, .lc-orbit-dot, .lc-card, .lc-buy-ripple,
  .lc-empty-orb, .lc-loading-dots i, .lc-title-b { animation: none !important; }
}

/* ── 顶栏 ── */
.lc-top {
  position: relative; z-index: 10;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 24px clamp(18px, 4vw, 54px) 18px;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
}
.lc-top-l, .lc-top-r { display: flex; align-items: center; gap: 12px; }
.lc-mark { font-size: 13px; font-weight: 900; letter-spacing: .22em; color: var(--fg); }
.lc-top-slash { color: var(--fg-ghost); font-size: 12px; }
.lc-top-t {
  font-size: 9.5px; font-weight: 600; letter-spacing: .26em;
  color: var(--fg-faint); text-transform: uppercase;
}
.lc-top-dot {
  width: 4px; height: 4px; border-radius: 999px; background: var(--accent);
  box-shadow: 0 0 9px var(--accent);
}

/* 主题切换 */
.lc-themes { display: flex; align-items: center; gap: 3px; }
.lc-themes-l {
  font-size: 8px; font-weight: 800; letter-spacing: .24em;
  color: var(--fg-ghost); margin-right: 6px;
}
.lc-theme-btn {
  min-width: 30px; padding: 6px 9px; border: none; cursor: pointer;
  background: transparent; color: var(--fg-faint);
  font-size: 10px; font-weight: 800; letter-spacing: .06em;
  border-radius: var(--radius-sm);
  transition: background .18s, color .18s;
}
.lc-theme-btn:hover { color: var(--fg); background: rgba(128, 128, 128, .1); }
.lc-theme-btn.is-on { background: var(--accent); color: var(--accent-fg); }

/* ── 首屏 ── */
.lc-hero {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas: "vtext head";
  align-items: center;
  gap: clamp(20px, 5vw, 68px);
  padding: clamp(36px, 7vw, 90px) clamp(18px, 4vw, 54px) clamp(30px, 5vw, 66px);
  min-height: 62vh;
}
.lc-vtext {
  grid-area: vtext;
  display: flex; flex-direction: column; align-items: center; gap: 20px;
  writing-mode: vertical-rl; text-orientation: upright;
  font-size: clamp(19px, 2.4vw, 27px); font-weight: 200;
  letter-spacing: .34em; color: var(--fg-ghost);
  user-select: none;
}
.lc-vtext-en {
  writing-mode: vertical-rl; text-orientation: mixed;
  font-size: 8.5px; font-weight: 700; letter-spacing: .42em;
  color: var(--fg-ghost); opacity: .7; text-transform: uppercase;
}

.lc-head { grid-area: head; position: relative; z-index: 3; max-width: 560px; }
.lc-eyebrow {
  display: flex; align-items: center; gap: 11px;
  margin: 0 0 20px; font-size: 9.5px; font-weight: 700;
  letter-spacing: .3em; color: var(--fg-faint); text-transform: uppercase;
}
.lc-eyebrow-line { width: 34px; height: 1px; background: var(--accent); }

.lc-title {
  margin: 0 0 22px; display: flex; flex-direction: column;
  font-size: var(--title-size); line-height: .94;
  letter-spacing: var(--title-spacing); text-transform: var(--h1-transform);
}
.lc-title-a { font-weight: var(--title-weight-a); color: var(--fg); }
.lc-title-b {
  font-weight: var(--title-weight-b);
  background: linear-gradient(102deg,
    #ffffff 0%, #c8d2ea 12%, #8a94b8 26%,
    #ffffff 40%, #b8c4e6 52%, #6f7896 66%,
    #e8eeff 80%, #ffffff 92%, #a8b4d4 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  background-size: 240% 100%;
  animation: lc-chrome 9s ease-in-out infinite alternate;
}
@keyframes lc-chrome {
  0% { background-position: 0% 50% } 100% { background-position: 100% 50% }
}

.lc-lede {
  margin: 0 0 30px; max-width: 470px;
  font-size: 13.5px; line-height: 1.95; color: var(--fg-dim); font-weight: 300;
}

.lc-cta-row { display: flex; gap: 11px; flex-wrap: wrap; }
.lc-btn {
  position: relative; display: inline-flex; align-items: center; gap: 11px;
  padding: 15px 26px; border: none; cursor: pointer; border-radius: var(--radius-sm);
  font-size: 12.5px; font-weight: 800; letter-spacing: .1em;
  text-transform: uppercase; text-decoration: none;
  transition: transform .16s cubic-bezier(.3,.9,.3,1), background .18s, color .18s;
}
.lc-btn:active { transform: scale(.975); }
.lc-btn-arrow { font-size: 15px; transition: transform .2s; }
.lc-btn:hover .lc-btn-arrow { transform: translate(3px, -3px); }
.lc-btn-acid { background: var(--accent); color: var(--accent-fg); }
.lc-btn-acid:hover { filter: brightness(1.12); }
.lc-btn-acid:disabled { opacity: .5; cursor: wait; }
.lc-btn-ghost {
  background: transparent; color: var(--fg-dim);
  box-shadow: inset 0 0 0 1px var(--line-strong);
}
.lc-btn-ghost:hover { background: rgba(128, 128, 128, .08); color: var(--fg); }

/* ── 球（各主题里各有形变） ── */
.lc-orb-wrap {
  position: absolute; z-index: 2;
  right: clamp(-40px, 6vw, 90px); top: 50%;
  width: clamp(210px, 30vw, 400px); height: clamp(210px, 30vw, 400px);
  margin-top: calc(clamp(210px, 30vw, 400px) / -2);
  transition: transform .5s cubic-bezier(.22,.8,.3,1);
  pointer-events: none; display: var(--orb-show);
}
.lc-orb {
  position: relative; width: 100%; height: 100%; border-radius: 50%;
  background:
    radial-gradient(circle at var(--gx, 32%) var(--gy, 26%),
      #ffffff 0%, #e6ecff 5%, #b9c4e4 13%, #7b88b0 25%,
      #41496e 40%, #1b2138 56%, #0b0e18 72%, #05060b 100%),
    conic-gradient(from 200deg,
      #ff7ae0, #8be9ff, #ffffff, #a99bff, #5d6ee0, #ffd36e, #ff7ae0);
  background-blend-mode: screen, normal;
  box-shadow:
    inset -18px -22px 62px rgba(0, 0, 0, .92),
    inset 16px 14px 44px rgba(255, 255, 255, .3),
    0 44px 100px rgba(90, 130, 220, .16),
    0 0 0 1px rgba(255, 255, 255, .07);
  filter: saturate(1.22) contrast(1.05);
  animation: lc-float 7s ease-in-out infinite;
}
@keyframes lc-float {
  0%, 100% { transform: translateY(-8px) }
  50%      { transform: translateY(8px) }
}
.lc-orb-sheen {
  position: absolute; inset: 0; border-radius: 50%; overflow: hidden;
  background: conic-gradient(from 0deg,
    transparent 0%, rgba(255,255,255,.55) 12%, transparent 26%,
    transparent 55%, rgba(255,255,255,.28) 68%, transparent 82%);
  mix-blend-mode: overlay;
  animation: lc-sheen 15s linear infinite;
}
@keyframes lc-sheen { to { transform: rotate(360deg) } }
.lc-orb-ring {
  position: absolute; inset: 0; border-radius: 50%;
  background: repeating-conic-gradient(from 0deg,
    rgba(255,255,255,.09) 0deg 1deg, transparent 1deg 4deg);
  mask-image: radial-gradient(circle, transparent 58%, #000 62%, #000 76%, transparent 82%);
  -webkit-mask-image: radial-gradient(circle, transparent 58%, #000 62%, #000 76%, transparent 82%);
  animation: lc-ring 40s linear infinite reverse;
}
@keyframes lc-ring { to { transform: rotate(360deg) } }
.lc-orb-grid { display: none; }
.lc-orb-shadow {
  position: absolute; left: 50%; bottom: -8%;
  width: 62%; height: 9%; transform: translateX(-50%);
  border-radius: 50%; filter: blur(18px);
  background: radial-gradient(ellipse, rgba(120, 160, 255, .3), transparent 70%);
}
.lc-orb-orbit {
  position: absolute; inset: -13%; border-radius: 50%;
  border: 1px solid var(--line);
  animation: lc-orbit 24s linear infinite;
}
@keyframes lc-orbit { to { transform: rotate(360deg) } }
.lc-orbit-dot {
  position: absolute; top: -2.5px; left: 50%; width: 5px; height: 5px;
  margin-left: -2.5px; border-radius: 999px; background: var(--accent);
  box-shadow: 0 0 12px var(--accent);
}

@media (max-width: 900px) {
  .lc-hero { grid-template-columns: 1fr; grid-template-areas: "head"; min-height: 0; }
  .lc-vtext { display: none; }
  .lc-orb-wrap {
    position: relative; right: auto; top: auto; margin: 0 auto 26px;
    width: 190px; height: 190px;
  }
  .lc-head { max-width: none; }
}

/* ── 数据条 ── */
.lc-ticker {
  display: grid; grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
}
.lc-ticker-item {
  padding: clamp(20px, 3vw, 34px) clamp(14px, 2.6vw, 34px);
  display: flex; flex-direction: column; gap: 9px;
  border-right: 1px solid var(--line);
}
.lc-ticker-item:last-child { border-right: none; }
.lc-ticker-n {
  font-size: clamp(26px, 3.6vw, 44px); font-weight: 200;
  letter-spacing: -.045em; line-height: 1; color: var(--fg);
  font-variant-numeric: tabular-nums; font-family: var(--font-num);
}
.lc-ticker-n i { font-style: normal; font-size: .4em; font-weight: 700; color: var(--fg-faint); margin-left: 3px; }
.lc-ticker-word { font-weight: 900; letter-spacing: -.03em; }
.lc-ticker-l {
  font-size: 8.5px; font-weight: 700; letter-spacing: .28em;
  color: var(--fg-faint); text-transform: uppercase;
}
@media (max-width: 700px) {
  .lc-ticker { grid-template-columns: repeat(2, 1fr); }
  .lc-ticker-item:nth-child(2) { border-right: none; }
  .lc-ticker-item:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
}

/* ── 主体 ── */
.lc-main {
  position: relative; z-index: 3;
  padding: clamp(40px, 6vw, 76px) clamp(18px, 4vw, 54px) 60px;
  max-width: 1180px; margin: 0 auto;
}
.lc-sec { margin-bottom: clamp(38px, 5vw, 64px); }
.lc-sec-head { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
.lc-idx {
  font-size: 9.5px; font-weight: 800; letter-spacing: .1em;
  color: var(--accent); font-variant-numeric: tabular-nums;
}
.lc-sec-t {
  margin: 0; font-size: 12px; font-weight: 800;
  letter-spacing: .22em; color: var(--fg); text-transform: uppercase;
}
.lc-sec-fill { flex: 1; height: 1px; background: var(--line); min-width: 20px; }
.lc-filter { display: flex; gap: 3px; flex-wrap: wrap; }
.lc-filter-btn {
  padding: 7px 12px; border: none; cursor: pointer; background: transparent;
  font-size: 10px; font-weight: 700; letter-spacing: .1em; color: var(--fg-faint);
  border-radius: var(--radius-sm);
  transition: color .16s, background .16s;
}
.lc-filter-btn:hover { color: var(--fg); }
.lc-filter-btn.is-on { color: var(--accent-fg); background: var(--accent); }

.lc-search { position: relative; margin-bottom: 26px; }
.lc-search input {
  width: 100%; padding: 13px 0; border: none; outline: none;
  background: transparent; color: var(--fg);
  font-family: var(--font); font-size: 13px; letter-spacing: .02em;
}
.lc-search input::placeholder { color: var(--fg-ghost); letter-spacing: .08em; }
.lc-search-line {
  position: absolute; left: 0; bottom: 0; width: 100%; height: 1px;
  background: var(--line-strong); overflow: hidden;
}
.lc-search-line::after {
  content: ''; position: absolute; inset: 0; background: var(--accent);
  transform: scaleX(0); transform-origin: left;
  transition: transform .34s cubic-bezier(.3,.9,.3,1);
}
.lc-search:focus-within .lc-search-line::after { transform: scaleX(1); }

/* ── 节点卡 ── */
.lc-grid {
  display: grid; gap: 1px;
  grid-template-columns: repeat(auto-fill, minmax(212px, 1fr));
  background: var(--line);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}
.lc-card {
  position: relative; overflow: hidden; text-align: left; cursor: pointer;
  padding: 20px 18px 17px; border: none; color: inherit; font: inherit;
  background: var(--bg-2); border-radius: 0;
  box-shadow: var(--shadow-card);
  transition: background .28s cubic-bezier(.3,.9,.3,1);
  animation: lc-in .5s cubic-bezier(.3,.9,.3,1) both;
  animation-delay: var(--d, 0ms);
}
@keyframes lc-in {
  from { opacity: 0; transform: translateY(10px) }
  to   { opacity: 1; transform: none }
}
.lc-card.is-on { background: color-mix(in srgb, var(--accent) 8%, var(--bg-2)); }
.lc-card-sweep {
  position: absolute; left: 0; right: 0; bottom: 0; height: 0;
  background: var(--accent); z-index: 0;
  transition: height .34s cubic-bezier(.3,.9,.3,1);
}
.lc-card:hover .lc-card-sweep,
.lc-card.is-on .lc-card-sweep { height: 2px; }

.lc-card-top {
  position: relative; z-index: 1;
  display: flex; align-items: center; justify-content: space-between;
  min-height: 18px; margin-bottom: 14px;
}
.lc-card-flag {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 16px; overflow: hidden;
  background: rgba(128, 128, 128, .12); font-size: 12px;
  border-radius: calc(var(--radius-sm) / 2);
}
.lc-card-flag img { width: 100%; height: 100%; object-fit: cover; }
.lc-demo {
  padding: 2px 6px; font-size: 8px; font-weight: 800; letter-spacing: .1em;
  color: #ffb020; background: rgba(255, 176, 32, .1);
  box-shadow: inset 0 0 0 1px rgba(255, 176, 32, .28);
  border-radius: var(--radius-sm);
}
.lc-card-on { font-size: 9px; color: var(--accent); }

.lc-card-name {
  position: relative; z-index: 1; margin: 0 0 6px;
  font-size: 15px; font-weight: 800; letter-spacing: -.01em; color: var(--fg);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lc-card-loc {
  position: relative; z-index: 1; margin: 0 0 18px;
  font-size: 10.5px; color: var(--fg-faint);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lc-card-foot {
  position: relative; z-index: 1;
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
}
.lc-card-price {
  font-family: var(--font-num);
  font-size: 19px; font-weight: 300; letter-spacing: -.03em; color: var(--fg);
  font-variant-numeric: tabular-nums;
}
.lc-card-price i { font-style: normal; font-size: .58em; font-weight: 600; color: var(--fg-faint); margin-right: 1px; }
.lc-card-price em { font-style: normal; font-size: .46em; font-weight: 600; color: var(--fg-faint); letter-spacing: .04em; }

.lc-lat {
  font-size: 9px; font-weight: 700; letter-spacing: .1em;
  padding: 3px 6px; font-variant-numeric: tabular-nums;
  border-radius: var(--radius-sm);
}
.lc-lat.l-good { color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
.lc-lat.l-mid  { color: #ffc046; background: rgba(255, 192, 70, .1); }
.lc-lat.l-bad  { color: #ff5f7a; background: rgba(255, 95, 122, .1); }
.lc-lat.l-none { color: var(--fg-ghost); background: rgba(128, 128, 128, .08); }

.lc-none {
  grid-column: 1 / -1; padding: 50px 0; text-align: center;
  background: var(--bg); color: var(--fg-ghost);
  font-size: 10px; font-weight: 700; letter-spacing: .24em;
}

/* ── 选项 ── */
.lc-opts {
  display: grid; gap: 1px; background: var(--line);
  border: 1px solid var(--line); border-radius: var(--radius);
  overflow: hidden; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
}
.lc-opts-4 { grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); }
.lc-opt {
  position: relative; cursor: pointer; border: none; border-radius: 0;
  padding: 17px 10px; display: flex; flex-direction: column;
  align-items: center; gap: 5px; background: var(--bg-2); color: inherit; font: inherit;
  transition: background .22s cubic-bezier(.3,.9,.3,1);
}
.lc-opt:hover { background: color-mix(in srgb, var(--fg) 6%, var(--bg-2)); }
.lc-opt.is-on { background: var(--accent); color: var(--accent-fg); }
.lc-opt-v {
  font-family: var(--font-num);
  font-size: 20px; font-weight: 300; letter-spacing: -.03em;
  font-variant-numeric: tabular-nums; line-height: 1;
}
.lc-opt-v-sm { font-size: 14px; font-weight: 700; letter-spacing: 0; font-family: var(--font); }
.lc-opt-u { font-size: 8.5px; font-weight: 700; letter-spacing: .16em; opacity: .5; margin-top: -2px; }
.lc-opt-p { font-size: 9.5px; font-weight: 700; letter-spacing: .04em; opacity: .55; font-variant-numeric: tabular-nums; }
.lc-opt.is-on .lc-opt-p { opacity: .75; }
.lc-opt-off {
  position: absolute; top: 7px; right: 8px;
  font-size: 8px; font-weight: 800; letter-spacing: .04em; color: var(--accent);
}
.lc-opt.is-on .lc-opt-off { color: var(--accent-fg); opacity: .7; }
.lc-opt-best {
  position: absolute; top: 0; left: 0; padding: 3px 7px;
  font-size: 7.5px; font-weight: 900; letter-spacing: .14em;
  background: var(--fg); color: var(--bg);
}
.lc-warn {
  grid-column: 1 / -1; padding: 22px; text-align: center; background: var(--bg);
  font-size: 10px; font-weight: 700; letter-spacing: .2em; color: #ffc046;
}

/* ── 规格条 ── */
.lc-specs {
  display: grid; grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  margin-bottom: 22px;
}
.lc-spec {
  padding: 20px 14px; display: flex; flex-direction: column; gap: 8px;
  border-right: 1px solid var(--line);
}
.lc-spec:last-child { border-right: none; }
.lc-spec-k { font-size: 8px; font-weight: 700; letter-spacing: .26em; color: var(--fg-faint); }
.lc-spec-v {
  font-family: var(--font-num);
  font-size: 17px; font-weight: 300; letter-spacing: -.02em;
  color: var(--fg); font-variant-numeric: tabular-nums;
}
.lc-spec-v i { font-style: normal; font-size: .5em; font-weight: 700; color: var(--fg-faint); margin-left: 2px; }
.lc-spec-v-sm { font-size: 12px; font-weight: 700; font-family: var(--font); }
.lc-spec-v.l-good { color: var(--accent); }
.lc-spec-v.l-mid { color: #ffc046; }
.lc-spec-v.l-bad { color: #ff5f7a; }
.lc-spec-v.l-none { color: var(--fg-ghost); }
@media (max-width: 640px) {
  .lc-specs { grid-template-columns: repeat(2, 1fr); }
  .lc-spec:nth-child(2) { border-right: none; }
  .lc-spec:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
}

/* ── 协议 ── */
.lc-protos { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 26px; }
.lc-proto {
  padding: 6px 11px; font-size: 9px; font-weight: 700; letter-spacing: .12em;
  color: var(--fg-faint); box-shadow: inset 0 0 0 1px var(--line-strong);
  text-transform: uppercase; border-radius: var(--radius-sm);
}

/* ── 优惠码 ── */
.lc-coupon { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.lc-coupon-l { font-size: 8px; font-weight: 800; letter-spacing: .24em; color: var(--fg-faint); flex: none; }
.lc-coupon input {
  flex: 1; min-width: 0; padding: 11px 0; border: none; outline: none;
  background: transparent; color: var(--fg); font-family: var(--font); font-size: 12px;
  letter-spacing: .12em; text-transform: uppercase;
  box-shadow: inset 0 -1px 0 var(--line-strong);
}
.lc-coupon input::placeholder { color: var(--fg-ghost); letter-spacing: .04em; text-transform: none; }
.lc-coupon input:focus { box-shadow: inset 0 -1px 0 var(--accent); }
.lc-coupon-btn {
  flex: none; padding: 11px 18px; border: none; cursor: pointer;
  background: transparent; color: var(--fg-dim);
  font-size: 9.5px; font-weight: 800; letter-spacing: .16em;
  box-shadow: inset 0 0 0 1px var(--line-strong);
  border-radius: var(--radius-sm);
  transition: background .18s, color .18s;
}
.lc-coupon-btn:hover { background: rgba(128, 128, 128, .1); color: var(--fg); }
.lc-coupon-x {
  flex: none; padding: 10px 12px; border: none; cursor: pointer;
  background: transparent; color: #ff5f7a; font-size: 11px;
  box-shadow: inset 0 0 0 1px rgba(255, 95, 122, .3);
  border-radius: var(--radius-sm);
}
.lc-ok { margin: 0 0 6px; font-size: 10px; font-weight: 700; letter-spacing: .1em; color: var(--accent); }
.lc-err { margin: 0 0 6px; font-size: 10px; font-weight: 700; letter-spacing: .1em; color: #ff5f7a; }

/* ── 结算 ── */
.lc-pay {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 26px; flex-wrap: wrap;
  margin-top: 30px; padding-top: 30px;
  border-top: 1px solid var(--line-strong);
}
.lc-pay-desc {
  margin: 0 0 10px; font-size: 10px; font-weight: 700;
  letter-spacing: .18em; color: var(--fg-faint); text-transform: uppercase;
}
.lc-pay-amount { display: flex; align-items: baseline; gap: 6px; font-variant-numeric: tabular-nums; }
.lc-pay-cur { font-size: 18px; font-weight: 300; color: var(--fg-faint); font-family: var(--font-num); }
.lc-pay-num {
  font-family: var(--font-num);
  font-size: clamp(42px, 6.2vw, 74px); font-weight: 200;
  letter-spacing: -.05em; line-height: .9; color: var(--fg);
  animation: lc-num .34s cubic-bezier(.3,.9,.3,1);
}
@keyframes lc-num {
  from { opacity: .4; transform: translateY(7px) }
  to   { opacity: 1; transform: none }
}
.lc-pay-was {
  font-size: 13px; font-weight: 300; color: var(--fg-ghost);
  text-decoration: line-through; margin-left: 8px;
}
.lc-pay-bal { margin: 9px 0 0; font-size: 9.5px; font-weight: 700; letter-spacing: .14em; }
.lc-pay-bal.is-ok { color: var(--fg-faint); }
.lc-pay-bal.is-bad { color: #ff5f7a; }

.lc-pay-r { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.lc-buy {
  position: relative; overflow: hidden; cursor: pointer; border: none;
  padding: 20px 46px; border-radius: var(--radius-sm);
  background: var(--fg); color: var(--bg);
  font-family: var(--font); font-size: 13px; font-weight: 900; letter-spacing: .16em;
  text-transform: uppercase;
  transition: transform .16s cubic-bezier(.3,.9,.3,1), filter .2s;
}
.lc-buy:hover { filter: brightness(1.1); }
.lc-buy:active { transform: scale(.975); }
.lc-buy:disabled { opacity: .5; cursor: wait; transform: none; }
.lc-buy span:first-child { position: relative; z-index: 2; }
.lc-buy-ripple {
  position: absolute; z-index: 1; pointer-events: none;
  left: var(--rx, 50%); top: var(--ry, 50%);
  width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 999px;
  background: var(--accent);
  animation: lc-ripple .62s cubic-bezier(.2,.8,.3,1);
}
@keyframes lc-ripple {
  from { transform: scale(0); opacity: .85 }
  to   { transform: scale(70); opacity: 0 }
}
.lc-topup {
  font-size: 9.5px; font-weight: 700; letter-spacing: .14em;
  color: #ffc046; text-decoration: none; text-transform: uppercase;
}
@media (max-width: 640px) {
  .lc-pay { flex-direction: column; align-items: stretch; }
  .lc-pay-r { align-items: stretch; }
  .lc-buy { width: 100%; }
  .lc-topup { text-align: center; }
}

/* ── 空态 / 加载 ── */
.lc-empty { padding: 70px 20px; text-align: center; }
.lc-empty-orb {
  width: 54px; height: 54px; margin: 0 auto 22px; border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, #fff 0%, #b9c4e4 18%, #41496e 52%, #0b0e18 88%);
  box-shadow: inset -6px -8px 20px rgba(0,0,0,.85), 0 14px 34px rgba(90,130,220,.18);
  animation: lc-pulse 2.6s ease-in-out infinite;
}
@keyframes lc-pulse {
  0%, 100% { transform: scale(1); opacity: .85 }
  50%      { transform: scale(1.07); opacity: 1 }
}
.lc-empty-t { margin: 0 0 12px; font-size: 10px; font-weight: 800; letter-spacing: .32em; color: var(--accent); }
.lc-empty-p { margin: 0 auto; max-width: 380px; font-size: 12px; line-height: 1.9; color: var(--fg-faint); }

.lc-loading { padding: 80px 0; display: flex; align-items: center; justify-content: center; gap: 12px; }
.lc-loading-t { font-size: 9.5px; font-weight: 800; letter-spacing: .3em; color: var(--fg-faint); }
.lc-loading-dots { display: inline-flex; gap: 4px; }
.lc-loading-dots i {
  width: 4px; height: 4px; border-radius: 999px; background: var(--accent);
  animation: lc-bounce 1.1s ease-in-out infinite;
}
.lc-loading-dots i:nth-child(2) { animation-delay: .16s }
.lc-loading-dots i:nth-child(3) { animation-delay: .32s }
@keyframes lc-bounce {
  0%, 100% { opacity: .2; transform: translateY(0) }
  50%      { opacity: 1; transform: translateY(-4px) }
}

/* ── 底部 ── */
.lc-foot { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--line); }
.lc-foot-row {
  display: flex; flex-wrap: wrap; gap: 10px 30px;
  font-size: 9px; font-weight: 700; letter-spacing: .18em;
  color: var(--fg-ghost); text-transform: uppercase;
}

/* ── 弹窗 ── */
.lc-modal {
  position: fixed; inset: 0; z-index: 10001; display: flex;
  align-items: center; justify-content: center; padding: 20px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(6px);
}
.lc-modal-box {
  position: relative; width: 100%; max-width: 340px;
  padding: 40px 28px 30px; text-align: center;
  background: var(--bg-2); border-radius: var(--radius);
  box-shadow: inset 0 0 0 1px var(--line-strong), 0 40px 90px rgba(0, 0, 0, .7);
  animation: lc-in .4s cubic-bezier(.3,.9,.3,1);
}
.lc-modal-orb {
  width: 44px; height: 44px; margin: 0 auto 20px; border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, #fff 0%, #b9c4e4 18%, #41496e 52%, #0b0e18 88%);
  box-shadow: inset -5px -7px 18px rgba(0,0,0,.85), 0 0 30px color-mix(in srgb, var(--accent) 30%, transparent);
}
.lc-modal-k { margin: 0 0 10px; font-size: 8.5px; font-weight: 800; letter-spacing: .34em; color: var(--accent); }
.lc-modal-t { margin: 0 0 16px; font-size: 19px; font-weight: 200; letter-spacing: -.02em; color: var(--fg); }
.lc-modal-id {
  margin: 0 0 4px; padding: 10px 12px; font-size: 11px; font-weight: 700;
  letter-spacing: .06em; color: var(--fg-dim); word-break: break-all;
  background: rgba(128, 128, 128, .1); border-radius: var(--radius-sm);
}
.lc-modal-btns { display: flex; flex-direction: column; gap: 8px; margin-top: 22px; }
.lc-modal-p {
  padding: 14px; border: none; cursor: pointer; border-radius: var(--radius-sm);
  background: var(--accent); color: var(--accent-fg);
  font-family: var(--font); font-size: 11px; font-weight: 900;
  letter-spacing: .16em; text-transform: uppercase;
  transition: filter .18s;
}
.lc-modal-p:hover { filter: brightness(1.1); }
.lc-modal-g {
  padding: 14px; border: none; cursor: pointer; border-radius: var(--radius-sm);
  background: transparent; color: var(--fg-dim);
  font-family: var(--font); font-size: 10px; font-weight: 800;
  letter-spacing: .16em; text-transform: uppercase;
  box-shadow: inset 0 0 0 1px var(--line-strong);
  transition: background .18s;
}
.lc-modal-g:hover { background: rgba(128, 128, 128, .1); }

/* ══════════════════════════════════════════════════════════════════════════
   主题 2：极简 MINIMAL
   米白底 + 黑字，去掉球和所有装饰，只靠排版和留白说话。
   字重全降一档（细体），卡片无底色，靠 1px 线分隔。
   ══════════════════════════════════════════════════════════════════════════ */
.lc-root[data-theme="minimal"] {
  --bg: #f6f5f2;
  --bg-2: #f6f5f2;
  --fg: #111110;
  --fg-dim: #5c5b57;
  --fg-faint: #8e8d88;
  --fg-ghost: #c9c8c3;
  --line: rgba(17, 17, 16, .1);
  --line-strong: rgba(17, 17, 16, .18);
  --accent: #111110;
  --accent-fg: #f6f5f2;
  --radius: 0px;
  --radius-sm: 0px;
  --font: "Helvetica Neue", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --font-num: "Helvetica Neue", system-ui, sans-serif;
  --title-size: clamp(38px, 6.6vw, 76px);
  --title-weight-a: 300;
  --title-weight-b: 500;
  --title-spacing: -.035em;
  --grain: 0;
  --orb-show: none;
}
.lc-root[data-theme="minimal"] .lc-title-b {
  background: none; -webkit-text-fill-color: currentColor; color: var(--fg);
  animation: none;
}
.lc-root[data-theme="minimal"] .lc-grain { display: none; }
.lc-root[data-theme="minimal"] .lc-card { background: transparent; }
.lc-root[data-theme="minimal"] .lc-card.is-on { background: #fff; }
.lc-root[data-theme="minimal"] .lc-grid { background: transparent; border: none; }
.lc-root[data-theme="minimal"] .lc-card { border-bottom: 1px solid var(--line); }
.lc-root[data-theme="minimal"] .lc-card-price { font-weight: 400; }
.lc-root[data-theme="minimal"] .lc-ticker-n { font-weight: 300; }
.lc-root[data-theme="minimal"] .lc-hero { min-height: 58vh; }
.lc-root[data-theme="minimal"] .lc-btn { letter-spacing: .14em; font-weight: 600; }
.lc-root[data-theme="minimal"] .lc-buy { font-weight: 700; letter-spacing: .2em; }

/* ══════════════════════════════════════════════════════════════════════════
   主题 3：凶 BRUTAL
   酸性绿铺满整屏，超粗黑体压到溢出，硬边直角，噪点加重。
   像 rave flyer / Off-White 的网页版。
   ══════════════════════════════════════════════════════════════════════════ */
.lc-root[data-theme="brutal"] {
  --bg: #ccff00;
  --bg-2: #ccff00;
  --fg: #000000;
  --fg-dim: rgba(0, 0, 0, .68);
  --fg-faint: rgba(0, 0, 0, .55);
  --fg-ghost: rgba(0, 0, 0, .3);
  --line: #000;
  --line-strong: #000;
  --accent: #000000;
  --accent-fg: #ccff00;
  --radius: 0px;
  --radius-sm: 0px;
  --font: "Arial Black", "Helvetica Neue", "PingFang SC", Impact, sans-serif;
  --font-num: "Arial Black", Impact, sans-serif;
  --title-size: clamp(46px, 10.5vw, 132px);
  --title-weight-a: 900;
  --title-weight-b: 900;
  --title-spacing: -.06em;
  --grain: .11;
}
.lc-root[data-theme="brutal"] .lc-title-b {
  background: none; -webkit-text-fill-color: currentColor; color: #000;
  animation: none;
  -webkit-text-stroke: 2px #000;
}
.lc-root[data-theme="brutal"] .lc-title { line-height: .84; }
.lc-root[data-theme="brutal"] .lc-grain { opacity: .11; mix-blend-mode: multiply; }
.lc-root[data-theme="brutal"] .lc-mark { font-size: 16px; letter-spacing: .3em; }
.lc-root[data-theme="brutal"] .lc-ticker-n { font-weight: 900; letter-spacing: -.05em; }
.lc-root[data-theme="brutal"] .lc-card { background: transparent; border: 2px solid #000; }
.lc-root[data-theme="brutal"] .lc-grid { gap: 10px; background: transparent; border: none; }
.lc-root[data-theme="brutal"] .lc-card.is-on { background: #000; color: #ccff00; }
.lc-root[data-theme="brutal"] .lc-card.is-on .lc-card-name,
.lc-root[data-theme="brutal"] .lc-card.is-on .lc-card-price { color: #ccff00; }
.lc-root[data-theme="brutal"] .lc-card.is-on .lc-card-loc { color: rgba(204, 255, 0, .7); }
.lc-root[data-theme="brutal"] .lc-opts { gap: 10px; background: transparent; border: none; }
.lc-root[data-theme="brutal"] .lc-opt { border: 2px solid #000; background: transparent; }
.lc-root[data-theme="brutal"] .lc-opt-v { font-weight: 900; }
.lc-root[data-theme="brutal"] .lc-specs { border-top: 3px solid #000; border-bottom: 3px solid #000; }
.lc-root[data-theme="brutal"] .lc-spec-k { font-weight: 900; letter-spacing: .2em; }
.lc-root[data-theme="brutal"] .lc-spec-v { font-weight: 900; }
.lc-root[data-theme="brutal"] .lc-pay { border-top: 3px solid #000; }
.lc-root[data-theme="brutal"] .lc-pay-num { font-weight: 900; font-size: clamp(52px, 8vw, 96px); }
.lc-root[data-theme="brutal"] .lc-btn { border: 2px solid #000; font-weight: 900; }
.lc-root[data-theme="brutal"] .lc-btn-ghost { box-shadow: none; border: 2px solid #000; color: #000; }
.lc-root[data-theme="brutal"] .lc-btn-ghost:hover { background: #000; color: #ccff00; }
.lc-root[data-theme="brutal"] .lc-buy { border: 3px solid #000; }
.lc-root[data-theme="brutal"] .lc-proto { box-shadow: none; border: 1.5px solid #000; color: #000; font-weight: 900; }
.lc-root[data-theme="brutal"] .lc-vtext { font-weight: 900; color: rgba(0, 0, 0, .18); }

/* ══════════════════════════════════════════════════════════════════════════
   主题 4：精密 PRECISE
   近黑底 + 终端绿，等宽字体，网格线密集，字号全部收小。
   像 Bloomberg 终端、工业设备面板、网管监控屏。
   ══════════════════════════════════════════════════════════════════════════ */
.lc-root[data-theme="precise"] {
  --bg: #07090c;
  --bg-2: #0b0e13;
  --fg: #c3cfd9;
  --fg-dim: #7d8e9c;
  --fg-faint: #55636e;
  --fg-ghost: #2b353d;
  --line: rgba(120, 180, 210, .14);
  --line-strong: rgba(120, 180, 210, .28);
  --accent: #4ade80;
  --accent-fg: #04070a;
  --radius: 2px;
  --radius-sm: 2px;
  --font: ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", Consolas, monospace;
  --font-num: ui-monospace, "SF Mono", Consolas, monospace;
  --title-size: clamp(26px, 3.6vw, 44px);
  --title-weight-a: 700;
  --title-weight-b: 700;
  --title-spacing: -.01em;
  --grain: .02;
}
.lc-root[data-theme="precise"] .lc-title-b {
  background: none; -webkit-text-fill-color: currentColor; color: var(--accent);
  animation: none;
}
.lc-root[data-theme="precise"] .lc-title { flex-direction: row; gap: .3em; flex-wrap: wrap; line-height: 1.1; }
.lc-root[data-theme="precise"] .lc-hero { min-height: 34vh; }
.lc-root[data-theme="precise"] .lc-lede { font-size: 11.5px; line-height: 1.85; max-width: 620px; }
.lc-root[data-theme="precise"] .lc-top-t { letter-spacing: .18em; }
.lc-root[data-theme="precise"] .lc-ticker-n { font-size: clamp(20px, 2.4vw, 30px); font-weight: 700; }
.lc-root[data-theme="precise"] .lc-sec-t { font-size: 10.5px; letter-spacing: .18em; }
.lc-root[data-theme="precise"] .lc-card-name { font-size: 12.5px; font-weight: 700; }
.lc-root[data-theme="precise"] .lc-card-loc { font-size: 9.5px; }
.lc-root[data-theme="precise"] .lc-card-price { font-size: 15px; font-weight: 700; }
.lc-root[data-theme="precise"] .lc-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
.lc-root[data-theme="precise"] .lc-opt-v { font-size: 15px; font-weight: 700; }
.lc-root[data-theme="precise"] .lc-pay-num { font-size: clamp(30px, 4vw, 46px); font-weight: 700; }
.lc-root[data-theme="precise"] .lc-buy { font-size: 11px; letter-spacing: .12em; padding: 16px 34px; }
/* 精密版把球换成网格球 */
.lc-root[data-theme="precise"] .lc-orb {
  background: radial-gradient(circle at 50% 50%, rgba(74, 222, 128, .08), transparent 62%);
  box-shadow: none; filter: none; animation: none;
  border: 1px solid rgba(74, 222, 128, .3);
}
.lc-root[data-theme="precise"] .lc-orb-sheen { display: none; }
.lc-root[data-theme="precise"] .lc-orb-ring {
  background:
    repeating-linear-gradient(0deg, rgba(74, 222, 128, .16) 0 1px, transparent 1px 15px),
    repeating-linear-gradient(90deg, rgba(74, 222, 128, .16) 0 1px, transparent 1px 15px);
  mask-image: radial-gradient(circle, #000 0%, #000 62%, transparent 78%);
  -webkit-mask-image: radial-gradient(circle, #000 0%, #000 62%, transparent 78%);
  animation: none; border-radius: 50%;
}
.lc-root[data-theme="precise"] .lc-orb-orbit { border-color: rgba(74, 222, 128, .2); }
.lc-root[data-theme="precise"] .lc-orb-shadow { display: none; }
.lc-root[data-theme="precise"] .lc-vtext { font-size: 11px; letter-spacing: .3em; color: var(--fg-ghost); }

/* ══════════════════════════════════════════════════════════════════════════
   主题 5：软 SOFT
   浅灰蓝底 + 白色大圆角卡 + 柔和渐变 + 扩散阴影。
   接近 Apple Liquid Glass / Nothing OS 的观感。
   ══════════════════════════════════════════════════════════════════════════ */
.lc-root[data-theme="soft"] {
  --bg: #eef1f8;
  --bg-2: #ffffff;
  --fg: #1a2138;
  --fg-dim: #5d6785;
  --fg-faint: #8a94ad;
  --fg-ghost: #c3cbdd;
  --line: rgba(40, 55, 100, .07);
  --line-strong: rgba(40, 55, 100, .13);
  --accent: #6d7cff;
  --accent-fg: #ffffff;
  --radius: 26px;
  --radius-sm: 16px;
  --font: "SF Pro Display", -apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --font-num: "SF Pro Display", -apple-system, system-ui, sans-serif;
  --title-size: clamp(34px, 5.4vw, 64px);
  --title-weight-a: 400;
  --title-weight-b: 700;
  --title-spacing: -.03em;
  --grain: 0;
  --shadow-card: 0 2px 8px rgba(40, 55, 100, .04), 0 12px 32px rgba(40, 55, 100, .06);
}
.lc-root[data-theme="soft"] {
  background:
    radial-gradient(60% 50% at 18% 8%, rgba(140, 160, 255, .22), transparent 62%),
    radial-gradient(55% 45% at 85% 4%, rgba(200, 150, 255, .18), transparent 60%),
    radial-gradient(50% 40% at 50% 96%, rgba(120, 220, 230, .16), transparent 64%),
    #eef1f8;
  background-attachment: fixed;
}
.lc-root[data-theme="soft"] .lc-title-b {
  background: linear-gradient(102deg, #6d7cff 0%, #a78bff 42%, #64c8e8 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: none;
}
.lc-root[data-theme="soft"] .lc-grain { display: none; }
.lc-root[data-theme="soft"] .lc-top { background: rgba(255, 255, 255, .55); backdrop-filter: blur(20px); border-bottom: 1px solid var(--line); }
.lc-root[data-theme="soft"] .lc-ticker { border: none; gap: 12px; padding: 0 clamp(18px, 4vw, 54px); }
.lc-root[data-theme="soft"] .lc-ticker-item {
  background: rgba(255, 255, 255, .7); border-radius: var(--radius-sm);
  border-right: none; backdrop-filter: blur(14px);
  box-shadow: var(--shadow-card); margin-top: 12px; margin-bottom: 12px;
}
.lc-root[data-theme="soft"] .lc-grid {
  gap: 14px; background: transparent; border: none;
}
.lc-root[data-theme="soft"] .lc-card {
  background: rgba(255, 255, 255, .82); border-radius: var(--radius);
  backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, .9);
  box-shadow: var(--shadow-card);
  transition: transform .3s cubic-bezier(.3,.9,.3,1), box-shadow .3s;
}
.lc-root[data-theme="soft"] .lc-card:hover { transform: translateY(-4px); box-shadow: 0 8px 20px rgba(40,55,100,.08), 0 22px 50px rgba(40,55,100,.1); }
.lc-root[data-theme="soft"] .lc-card.is-on {
  background: #fff;
  box-shadow: 0 0 0 2px var(--accent), 0 14px 40px rgba(109, 124, 255, .22);
}
.lc-root[data-theme="soft"] .lc-card-sweep { display: none; }
.lc-root[data-theme="soft"] .lc-opts { gap: 10px; background: transparent; border: none; }
.lc-root[data-theme="soft"] .lc-opt {
  background: rgba(255, 255, 255, .8); border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, .9);
  box-shadow: 0 2px 8px rgba(40, 55, 100, .04);
  transition: transform .24s, box-shadow .24s, background .24s;
}
.lc-root[data-theme="soft"] .lc-opt:hover { transform: translateY(-2px); }
.lc-root[data-theme="soft"] .lc-opt.is-on {
  background: linear-gradient(135deg, #6d7cff, #9182ff);
  color: #fff; box-shadow: 0 10px 26px rgba(109, 124, 255, .34);
}
.lc-root[data-theme="soft"] .lc-opt-best { border-radius: 0 var(--radius-sm) 0 8px; }
.lc-root[data-theme="soft"] .lc-specs {
  border: none; gap: 12px; margin-bottom: 24px;
}
.lc-root[data-theme="soft"] .lc-spec {
  background: rgba(255, 255, 255, .7); border-radius: var(--radius-sm);
  border-right: none; backdrop-filter: blur(14px);
  box-shadow: var(--shadow-card); padding: 18px 14px;
}
.lc-root[data-theme="soft"] .lc-proto {
  background: rgba(255, 255, 255, .8); box-shadow: none;
  border: 1px solid rgba(40, 55, 100, .08);
  color: var(--fg-dim); border-radius: 999px; padding: 6px 14px;
}
.lc-root[data-theme="soft"] .lc-pay {
  border-top: none; margin-top: 34px; padding: 26px 26px;
  background: rgba(255, 255, 255, .82); border-radius: var(--radius);
  backdrop-filter: blur(18px); box-shadow: var(--shadow-card);
}
.lc-root[data-theme="soft"] .lc-btn { border-radius: 999px; font-weight: 700; letter-spacing: .04em; text-transform: none; font-size: 13.5px; }
.lc-root[data-theme="soft"] .lc-btn-ghost { box-shadow: inset 0 0 0 1.5px var(--line-strong); }
.lc-root[data-theme="soft"] .lc-buy {
  border-radius: 999px; background: linear-gradient(135deg, #6d7cff, #8b7dff 55%, #a78bff);
  color: #fff; font-weight: 700; letter-spacing: .06em; text-transform: none; font-size: 14px;
  box-shadow: 0 12px 30px rgba(109, 124, 255, .34);
}
.lc-root[data-theme="soft"] .lc-buy:hover { filter: brightness(1.06); box-shadow: 0 16px 38px rgba(109, 124, 255, .42); }
.lc-root[data-theme="soft"] .lc-search input {
  background: rgba(255, 255, 255, .8); border-radius: 999px; padding: 13px 20px;
  box-shadow: var(--shadow-card);
}
.lc-root[data-theme="soft"] .lc-search-line {
  display: none;
}
.lc-root[data-theme="soft"] .lc-filter-btn { border-radius: 999px; }
.lc-root[data-theme="soft"] .lc-filter-btn.is-on { background: #fff; color: var(--accent); box-shadow: 0 4px 12px rgba(109,124,255,.18); }
.lc-root[data-theme="soft"] .lc-coupon input,
.lc-root[data-theme="soft"] .lc-coupon-btn,
.lc-root[data-theme="soft"] .lc-coupon-x { box-shadow: none; border-radius: 999px; }
.lc-root[data-theme="soft"] .lc-coupon input { background: rgba(255,255,255,.8); padding: 12px 18px; box-shadow: var(--shadow-card); }
.lc-root[data-theme="soft"] .lc-modal-box { border-radius: 28px; }
/* 软版球：柔和光球 */
.lc-root[data-theme="soft"] .lc-orb {
  background:
    radial-gradient(circle at 34% 28%, #ffffff 0%, #e4ebff 22%, #c7d2ff 44%, #b4bcff 62%, #d9e0fb 100%);
  box-shadow:
    inset -14px -16px 44px rgba(120, 140, 220, .28),
    inset 12px 10px 34px rgba(255, 255, 255, .9),
    0 30px 70px rgba(109, 124, 255, .28);
  filter: none;
  animation: lc-float 9s ease-in-out infinite;
}
.lc-root[data-theme="soft"] .lc-orb-sheen { opacity: .5; }
.lc-root[data-theme="soft"] .lc-orb-ring { display: none; }
.lc-root[data-theme="soft"] .lc-orb-shadow { background: radial-gradient(ellipse, rgba(109, 124, 255, .32), transparent 70%); }
.lc-root[data-theme="soft"] .lc-vtext { color: rgba(40, 55, 100, .16); }
</style>
