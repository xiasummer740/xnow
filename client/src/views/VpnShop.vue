<template>
  <div class="vx-root">
    <!-- ═══ 背景层：深空 + 网格 + 扫描线 ═══ -->
    <div class="vx-aurora" aria-hidden="true"></div>
    <div class="vx-grid" aria-hidden="true"></div>
    <div class="vx-scanline" aria-hidden="true"></div>

    <div class="relative max-w-5xl mx-auto px-4 pb-20">

      <!-- ═══ HUD 状态条 ═══ -->
      <div class="vx-hud">
        <span class="vx-ping"><i></i></span>
        <span class="vx-hud-txt">SYSTEM ONLINE</span>
        <span class="vx-hud-dim">/</span>
        <span class="vx-hud-txt">{{ nodes.length || '00' }} NODES</span>
        <span class="vx-hud-dim">/</span>
        <span class="vx-hud-txt">{{ bestLatency }}</span>
        <span class="vx-hud-dim vx-hide-sm">/</span>
        <span class="vx-hud-dim vx-hide-sm">VLESS · VMESS · TROJAN · SS · HY2</span>
      </div>

      <!-- ═══ HERO ═══ -->
      <header class="vx-hero">
        <div class="vx-badge">
          <span class="vx-badge-dot"></span>
          {{ appStore.lang === 'zh' ? '跨境创作者专属线路' : 'BUILT FOR CREATORS' }}
        </div>

        <h1 class="vx-h1">
          <span class="vx-grad">{{ appStore.lang === 'zh' ? '账号在哪' : 'YOUR IP,' }}</span>
          <span class="vx-slash">/</span>
          <span class="vx-h1-plain">{{ appStore.lang === 'zh' ? 'IP 就在哪' : 'WHERE YOU ARE' }}</span>
        </h1>

        <p class="vx-sub">
          {{ appStore.lang === 'zh'
            ? 'TikTok 限流、账号被标记、直播掉帧 —— 跨境自媒体里，IP 纯净度直接决定账号生死。原生住宅 IP + TLS/Reality 伪装，让你的流量真正「像当地人」。'
            : 'Shadow banned? IP flagged? Laggy streams? Residential IPs with TLS+Reality obfuscation — make your traffic look 100% local.' }}
        </p>

        <!-- 数据 HUD 卡 -->
        <div class="vx-stats">
          <div class="vx-stat">
            <div class="vx-stat-n vx-grad-n">{{ nodes.length || '00' }}</div>
            <div class="vx-stat-l">{{ appStore.lang === 'zh' ? '全球节点' : 'NODES' }}</div>
          </div>
          <div class="vx-stat">
            <div class="vx-stat-n">99.9<span class="vx-unit">%</span></div>
            <div class="vx-stat-l">{{ appStore.lang === 'zh' ? '在线率' : 'UPTIME' }}</div>
          </div>
          <div class="vx-stat">
            <div class="vx-stat-n">Reality</div>
            <div class="vx-stat-l">{{ appStore.lang === 'zh' ? '协议伪装' : 'STEALTH' }}</div>
          </div>
          <div class="vx-stat">
            <div class="vx-stat-n vx-grad-n">{{ bestLatency }}</div>
            <div class="vx-stat-l">{{ appStore.lang === 'zh' ? '最优延迟' : 'BEST PING' }}</div>
          </div>
        </div>

        <!-- 免费试用 -->
        <div v-if="trialEnabled" class="vx-trial-wrap">
          <button @click="startTrial" :disabled="trialBusy" class="vx-trial">
            <span class="vx-trial-ico">◈</span>
            {{ trialBusy ? '···' : (appStore.lang === 'zh' ? '免费试用 100MB' : 'FREE TRIAL 100MB') }}
          </button>
          <p class="vx-trial-hint">{{ appStore.lang === 'zh' ? '新用户专享 · 无需付费 · 注册即用' : 'New users · No payment required' }}</p>
        </div>
      </header>

      <!-- ═══ 能力卡 ═══ -->
      <div class="vx-feats">
        <div class="vx-feat">
          <div class="vx-feat-ico">◎</div>
          <h4>{{ appStore.lang === 'zh' ? '精准定位' : 'GEO-TARGET' }}</h4>
          <p>{{ appStore.lang === 'zh' ? '原生住宅 IP，算法识别为本地用户，推流权重翻倍' : 'Residential IPs. Algorithm sees you as local.' }}</p>
        </div>
        <div class="vx-feat">
          <div class="vx-feat-ico">⬡</div>
          <h4>{{ appStore.lang === 'zh' ? '防封防标记' : 'ANTI-BAN' }}</h4>
          <p>{{ appStore.lang === 'zh' ? 'TLS 指纹伪装成普通浏览器流量，平台无法识别' : 'TLS fingerprinting masks traffic as browsing.' }}</p>
        </div>
        <div class="vx-feat">
          <div class="vx-feat-ico">⚡</div>
          <h4>{{ appStore.lang === 'zh' ? '直播不卡顿' : 'ZERO LAG' }}</h4>
          <p>{{ appStore.lang === 'zh' ? 'CN2 GIA / CMIN2 优化线路，跨国直播稳 60 帧' : 'Premium routes. Smooth streaming, no frame drops.' }}</p>
        </div>
      </div>

      <!-- ═══ 空态：没配节点时 ═══ -->
      <div v-if="!loading && nodes.length === 0" class="vx-empty">
        <div class="vx-empty-ring"></div>
        <div class="vx-empty-t">NODE DEPLOYING</div>
        <p class="vx-empty-p">{{ appStore.lang === 'zh'
          ? '节点正在部署中。开通后本页会自动列出全部地区、价格与实时延迟。'
          : 'Nodes are being deployed. Regions, pricing and live latency will appear here.' }}</p>
      </div>

      <!-- ═══ 加载 ═══ -->
      <div v-if="loading" class="vx-loading">
        <div class="vx-loading-bar"><i></i></div>
        <p>INITIALIZING ···</p>
      </div>

      <template v-else-if="nodes.length > 0">
        <!-- ═══ 步骤 ①  选节点 ═══ -->
        <section class="vx-sec">
          <div class="vx-sec-head">
            <span class="vx-sec-num">01</span>
            <h2 class="vx-sec-t">{{ appStore.lang === 'zh' ? '选择节点' : 'SELECT NODE' }}</h2>
            <div class="vx-sec-line"></div>
          </div>

          <div class="vx-tools">
            <div class="vx-search">
              <span class="vx-search-ico">⌕</span>
              <input v-model="searchQuery" type="text"
                :placeholder="appStore.lang === 'zh' ? '搜索地区或机房…' : 'Search region…'" />
            </div>
            <div class="vx-chips">
              <button v-for="r in regionOptions" :key="r.v" @click="regionFilter = r.v"
                :class="['vx-chip', regionFilter === r.v && 'is-on']">{{ r.t }}</button>
            </div>
          </div>

          <div class="vx-nodes">
            <button v-for="n in filteredNodes" :key="n.id" @click="selectNode(n)"
              :class="['vx-node', selectedNode?.id === n.id && 'is-on', n._demo && 'is-demo']">
              <div class="vx-node-top">
                <img v-if="getFlagUrl(n)" :src="getFlagUrl(n)" class="vx-flag"
                  @error="e => e.target.style.display = 'none'" />
                <span v-else class="vx-flag vx-flag-ph">{{ (n.flag_emoji || '◈') }}</span>
                <span class="vx-node-name">{{ n.name }}</span>
                <span v-if="n._demo" class="vx-demo-tag">示例</span>
                <span v-if="selectedNode?.id === n.id" class="vx-node-check">✓</span>
              </div>

              <div class="vx-node-loc">{{ n.vps_location || '—' }}</div>

              <div class="vx-node-foot">
                <span class="vx-node-price">¥{{ parseFloat(n.price_per_gb || 0).toFixed(2) }}<i>/GB</i></span>
                <span :class="['vx-lat', latClass(n.id)]">{{ latText(n.id) }}</span>
              </div>

              <div class="vx-node-glow"></div>
            </button>

            <div v-if="filteredNodes.length === 0" class="vx-none">
              <span class="vx-none-ico">⌕</span>
              <p>{{ appStore.lang === 'zh' ? '没有匹配的节点' : 'No nodes found' }}</p>
            </div>
          </div>
        </section>

        <!-- ═══ 步骤 ②③  流量 + 时长 ═══ -->
        <template v-if="selectedNode">
          <section class="vx-sec">
            <div class="vx-sec-head">
              <span class="vx-sec-num">02</span>
              <h2 class="vx-sec-t">{{ appStore.lang === 'zh' ? '流量配额' : 'TRAFFIC' }}</h2>
              <div class="vx-sec-line"></div>
            </div>
            <div class="vx-pick">
              <button v-for="g in affordableTraffic" :key="g" @click="selectedTraffic = g"
                :class="['vx-pick-btn', selectedTraffic === g && 'is-on']">
                <span class="vx-pick-v">{{ g >= 1000 ? (g / 1000).toFixed(1) + 'TB' : g + 'GB' }}</span>
                <span class="vx-pick-sub">¥{{ trafficPrice(g).toFixed(0) }}</span>
              </button>
              <div v-if="affordableTraffic.length === 0" class="vx-warn">
                {{ appStore.lang === 'zh' ? '此节点已达容量上限' : 'Node at capacity' }}
              </div>
            </div>
          </section>

          <section class="vx-sec">
            <div class="vx-sec-head">
              <span class="vx-sec-num">03</span>
              <h2 class="vx-sec-t">{{ appStore.lang === 'zh' ? '使用时长' : 'DURATION' }}</h2>
              <div class="vx-sec-line"></div>
            </div>
            <div class="vx-pick vx-pick-4">
              <button v-for="d in durationOptions" :key="d.days" @click="selectedDuration = d"
                :class="['vx-pick-btn', selectedDuration?.days === d.days && 'is-on']">
                <span v-if="d.discount <= 0.75" class="vx-best">BEST</span>
                <span class="vx-pick-v">{{ d.label }}</span>
                <span v-if="d.discount < 1" class="vx-pick-off">-{{ Math.round((1 - d.discount) * 100) }}%</span>
              </button>
            </div>
          </section>

          <!-- 节点指标 HUD -->
          <div class="vx-metrics">
            <div class="vx-metric">
              <span class="vx-metric-k">PROTOCOLS</span>
              <span class="vx-metric-v">{{ getProtocols(selectedNode).length }}</span>
            </div>
            <div class="vx-metric">
              <span class="vx-metric-k">CAPACITY</span>
              <span class="vx-metric-v">{{ selectedNode.max_traffic_gb }}<i>GB</i></span>
            </div>
            <div class="vx-metric">
              <span class="vx-metric-k">ROUTE</span>
              <span class="vx-metric-v vx-metric-sm">{{ selectedNode.description || 'BGP' }}</span>
            </div>
            <div class="vx-metric">
              <span class="vx-metric-k">LATENCY</span>
              <span :class="['vx-metric-v', latClass(selectedNode.id)]">{{ latText(selectedNode.id) }}</span>
            </div>
          </div>

          <div class="vx-protos">
            <span v-for="p in getProtocols(selectedNode)" :key="p" class="vx-proto">{{ p }}</span>
          </div>

          <!-- 优惠码 -->
          <div class="vx-coupon">
            <input v-model="couponCode" @keyup.enter="applyCoupon" type="text" maxlength="20"
              :placeholder="appStore.lang === 'zh' ? '优惠码（可选）' : 'COUPON (OPT)'" />
            <button @click="applyCoupon" :disabled="couponApplying" class="vx-coupon-btn">
              {{ couponApplying ? '···' : (appStore.lang === 'zh' ? '应用' : 'APPLY') }}
            </button>
            <button v-if="couponApplied" @click="removeCoupon" class="vx-coupon-x">✕</button>
          </div>
          <p v-if="couponApplied" class="vx-ok">◈ 优惠码 {{ couponApplied.code }} · 已减 ¥{{ couponApplied.discount }}</p>
          <p v-if="couponError" class="vx-err">{{ couponError }}</p>

          <!-- ═══ 结算栏 ═══ -->
          <div class="vx-pay">
            <div class="vx-pay-l">
              <div class="vx-pay-desc">
                {{ selectedNode.name }}
                <span class="vx-dot-s">·</span>
                {{ selectedTraffic }}GB
                <span class="vx-dot-s">·</span>
                {{ selectedDuration?.label }}
              </div>
              <div class="vx-pay-price">
                <span class="vx-cur">¥</span>{{ (couponApplied ? couponApplied.final_amount : finalPrice).toFixed(2) }}
                <span v-if="couponApplied" class="vx-was">¥{{ finalPrice.toFixed(2) }}</span>
              </div>
              <div :class="['vx-bal', balanceOk ? 'is-ok' : 'is-bad']">
                {{ appStore.lang === 'zh' ? '余额' : 'BAL' }} ¥{{ parseFloat(userStore.userInfo?.balance || 0).toFixed(2) }}
                <span v-if="!balanceOk"> · {{ appStore.lang === 'zh' ? '不足' : 'LOW' }}</span>
              </div>
            </div>
            <div class="vx-pay-r">
              <button @click="buy" :disabled="buying" class="vx-buy">
                <span class="vx-buy-txt">{{ buying ? '···' : (appStore.lang === 'zh' ? '立即购买' : 'BUY NOW') }}</span>
                <span class="vx-buy-shine"></span>
              </button>
              <router-link v-if="!balanceOk" to="/recharge" class="vx-topup">
                {{ appStore.lang === 'zh' ? '余额不足？去充值 →' : 'Top up →' }}
              </router-link>
            </div>
          </div>
        </template>
      </template>

      <!-- ═══ 信任信号 ═══ -->
      <div class="vx-trust">
        <span class="vx-trust-i"><i>◆</i> {{ appStore.lang === 'zh' ? '支付宝 / 微信 / USDT' : 'Alipay / WeChat / USDT' }}</span>
        <span class="vx-trust-i"><i>◆</i> {{ appStore.lang === 'zh' ? '下单即得订阅链接' : 'Instant subscription' }}</span>
        <span class="vx-trust-i"><i>◆</i> {{ appStore.lang === 'zh' ? '全平台客户端支持' : 'All platforms' }}</span>
        <span class="vx-trust-i"><i>◆</i> {{ appStore.lang === 'zh' ? '7×12h 客服在线' : '7×12h support' }}</span>
      </div>
    </div>

    <!-- ═══ 成功弹窗 ═══ -->
    <div v-if="showSuccess" class="vx-modal" @click.self="showSuccess = false">
      <div class="vx-modal-box">
        <div class="vx-modal-ring"><span>✓</span></div>
        <h2 class="vx-modal-t">{{ appStore.lang === 'zh' ? '开通成功' : 'ACTIVATED' }}</h2>
        <p class="vx-modal-p" v-if="purchaseResult?.email">{{ purchaseResult.email }}</p>
        <div class="vx-modal-btns">
          <button @click="goToClients" class="vx-modal-primary">{{ appStore.lang === 'zh' ? '查看我的节点' : 'MY NODES' }}</button>
          <button @click="showSuccess = false" class="vx-modal-ghost">{{ appStore.lang === 'zh' ? '继续选购' : 'CONTINUE' }}</button>
        </div>
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

// 区域筛选（按需生成，只有存在节点的区域才显示）
const REGION_DEF = [
  { v: '', t: '全部' },
  { v: 'asia', t: '亚洲' },
  { v: 'americas', t: '美洲' },
  { v: 'europe', t: '欧洲' },
  { v: 'oceania', t: '大洋洲' },
  { v: 'middle-east', t: '中东' },
];
const regionOptions = computed(() => appStore.lang === 'zh'
  ? REGION_DEF
  : [{ v: '', t: 'ALL' }, { v: 'asia', t: 'ASIA' }, { v: 'americas', t: 'AMERICAS' }, { v: 'europe', t: 'EUROPE' }, { v: 'oceania', t: 'OCEANIA' }, { v: 'middle-east', t: 'M.EAST' }]);

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

// 流量档位：只显示节点容量以内，且每个档位旁边直接标出该档的总价（少点一次计算）
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
  // ⚠️ 2026-11-07：数据库里还没配节点时，用两条**标注为「示例」**的节点撑住版式，
  //    让祥哥能看到完整 UI。它们带 _demo 标记：不参与延迟测试、点下单会被拦下。
  //    真节点一配上，这段就不会触发。
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
});

const selectNode = (n) => {
  selectedNode.value = n;
  const valid = trafficOptions.value.filter((t) => t <= (n.max_traffic_gb || 2000));
  if (valid.length > 0 && !valid.includes(selectedTraffic.value)) selectedTraffic.value = valid[0];
};
const buy = async () => {
  if (!selectedNode.value) return;
  const nd = selectedNode.value;
  if (nd._demo) return uiStore.showToast(appStore.lang === 'zh' ? '这是示例节点，配置真实节点后即可购买' : 'Demo node — configure real nodes to buy', 'error');
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

<style scoped>
/* ══════════════════════════════════════════════════════════════════════════
   未来系视觉（2026-11-07）
   --------------------------------------------------------------------------
   设计取向：深空底 + 冷光渐变 + HUD 读数。00 后那批视觉习惯里，这套语言
   出现在游戏 UI、终端工具、耳机/外设品牌页面上，接受度高；同时不牺牲可读性。
   三条自我约束：
     1. 动效只用 transform / opacity / background-position —— 不触发重排；
     2. 所有装饰元素 aria-hidden，屏幕阅读器和爬虫不受影响；
     3. 颜色对比度保持 ≥4.5:1，正文不用霓虹色（只有数据和高亮用）。
   ══════════════════════════════════════════════════════════════════════════ */

.vx-root {
  position: relative;
  min-height: 100vh;
  background: #04050c;
  color: #e7ecf5;
  overflow-x: hidden;
  font-feature-settings: "tnum" 1;
}

/* 极光光晕：两块大范围径向渐变，缓慢漂移 */
.vx-aurora {
  position: fixed; inset: -20% -10%; z-index: 0; pointer-events: none;
  background:
    radial-gradient(46% 38% at 22% 18%, rgba(0, 229, 255, .16), transparent 62%),
    radial-gradient(42% 40% at 82% 12%, rgba(139, 92, 246, .17), transparent 60%),
    radial-gradient(50% 44% at 60% 88%, rgba(255, 45, 149, .10), transparent 64%);
  filter: blur(18px);
  animation: vx-drift 22s ease-in-out infinite alternate;
}
@keyframes vx-drift {
  0%   { transform: translate3d(0, 0, 0) scale(1); }
  100% { transform: translate3d(2.5%, -2%, 0) scale(1.08); }
}

/* 网格：细线 + 透视消失感 */
.vx-grid {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(120, 190, 255, .045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(120, 190, 255, .045) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 78% 62% at 50% 26%, #000 28%, transparent 82%);
  -webkit-mask-image: radial-gradient(ellipse 78% 62% at 50% 26%, #000 28%, transparent 82%);
}

/* 扫描线：一条光带自上而下循环 */
.vx-scanline {
  position: fixed; left: 0; right: 0; top: 0; height: 180px; z-index: 1; pointer-events: none;
  background: linear-gradient(180deg, transparent, rgba(0, 229, 255, .055) 46%, transparent);
  animation: vx-scan 9s linear infinite;
}
@keyframes vx-scan {
  0%   { transform: translateY(-200px); opacity: 0; }
  12%  { opacity: 1; }
  88%  { opacity: 1; }
  100% { transform: translateY(100vh); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .vx-aurora, .vx-scanline, .vx-buy-shine, .vx-empty-ring, .vx-loading-bar i { animation: none !important; }
}

/* ── HUD 状态条 ── */
.vx-hud {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 18px 0 8px;
  font: 600 10.5px/1 ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace;
  letter-spacing: .13em; color: #4b6280;
}
.vx-ping { position: relative; width: 7px; height: 7px; flex: none; }
.vx-ping i {
  position: absolute; inset: 0; border-radius: 999px; background: #00e5ff;
  box-shadow: 0 0 10px #00e5ff; animation: vx-blink 2.4s ease-in-out infinite;
}
.vx-ping::after {
  content: ''; position: absolute; inset: -4px; border-radius: 999px;
  border: 1px solid rgba(0, 229, 255, .5); animation: vx-ripple 2.4s ease-out infinite;
}
@keyframes vx-blink { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
@keyframes vx-ripple { 0% { transform: scale(.5); opacity: 1 } 100% { transform: scale(1.7); opacity: 0 } }
.vx-hud-txt { color: #7d9ab8; }
.vx-hud-dim { color: #26374d; }
@media (max-width: 640px) { .vx-hide-sm { display: none; } }

/* ── Hero ── */
.vx-hero { padding: 26px 0 8px; text-align: center; }
.vx-badge {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px; border-radius: 999px;
  border: 1px solid rgba(0, 229, 255, .28);
  background: linear-gradient(180deg, rgba(0, 229, 255, .12), rgba(0, 229, 255, .03));
  font: 700 10.5px/1 ui-monospace, monospace; letter-spacing: .16em;
  color: #6ff0ff; text-transform: uppercase;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
}
.vx-badge-dot { width: 5px; height: 5px; border-radius: 999px; background: #00e5ff; box-shadow: 0 0 8px #00e5ff; }

.vx-h1 {
  margin: 18px 0 14px;
  font-size: clamp(30px, 6.2vw, 62px);
  line-height: 1.04; font-weight: 900; letter-spacing: -.02em;
  display: flex; align-items: center; justify-content: center; gap: .18em; flex-wrap: wrap;
}
.vx-grad {
  background: linear-gradient(96deg, #00e5ff 0%, #7c9bff 38%, #a855f7 68%, #ff2d95 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  background-size: 220% 100%; animation: vx-flow 8s ease-in-out infinite alternate;
}
@keyframes vx-flow { 0% { background-position: 0% 50% } 100% { background-position: 100% 50% } }
.vx-slash { color: #1d2f45; font-weight: 300; font-size: .78em; transform: translateY(-1px); }
.vx-h1-plain { color: #f1f5fb; }

.vx-sub {
  max-width: 660px; margin: 0 auto;
  color: #8ea4bf; font-size: 14.5px; line-height: 1.85;
}

/* ── 数据 HUD 卡 ── */
.vx-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
  max-width: 720px; margin: 30px auto 0;
  background: rgba(120, 190, 255, .10);
  border: 1px solid rgba(120, 190, 255, .13);
  border-radius: 16px; overflow: hidden;
}
.vx-stat { padding: 16px 8px; background: rgba(6, 10, 20, .82); text-align: center; }
.vx-stat-n {
  font: 900 21px/1 ui-monospace, monospace; color: #dbeafe; letter-spacing: -.02em;
}
.vx-grad-n {
  background: linear-gradient(94deg, #00e5ff, #a855f7);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.vx-unit { font-size: .62em; font-weight: 700; color: #4b6280; }
.vx-stat-l {
  margin-top: 7px; font: 600 9.5px/1 ui-monospace, monospace;
  letter-spacing: .15em; color: #4b6280; text-transform: uppercase;
}
@media (max-width: 560px) { .vx-stats { grid-template-columns: repeat(2, 1fr); } }

/* ── 试用 ── */
.vx-trial-wrap { margin-top: 22px; }
.vx-trial {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 12px 26px; border-radius: 12px; cursor: pointer;
  background: linear-gradient(96deg, rgba(255, 176, 32, .95), rgba(255, 92, 60, .95));
  color: #180a00; font-weight: 900; font-size: 13px; letter-spacing: .04em;
  border: none; box-shadow: 0 10px 34px rgba(255, 138, 40, .28);
  transition: transform .18s, box-shadow .18s;
}
.vx-trial:hover { transform: translateY(-2px); box-shadow: 0 14px 40px rgba(255, 138, 40, .38); }
.vx-trial:disabled { opacity: .6; cursor: wait; }
.vx-trial-ico { font-size: 15px; }
.vx-trial-hint { margin-top: 8px; font-size: 10.5px; color: #47607d; letter-spacing: .04em; }

/* ── 能力卡 ── */
.vx-feats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
  margin: 34px 0 8px;
}
.vx-feat {
  position: relative; padding: 18px 16px; border-radius: 16px;
  background: linear-gradient(180deg, rgba(255, 255, 255, .045), rgba(255, 255, 255, .012));
  border: 1px solid rgba(120, 190, 255, .12);
  transition: border-color .22s, transform .22s;
  overflow: hidden;
}
.vx-feat::after {
  content: ''; position: absolute; inset: 0; opacity: 0;
  background: radial-gradient(120px 60px at 50% 0%, rgba(0, 229, 255, .18), transparent 70%);
  transition: opacity .3s; pointer-events: none;
}
.vx-feat:hover { border-color: rgba(0, 229, 255, .34); transform: translateY(-3px); }
.vx-feat:hover::after { opacity: 1; }
.vx-feat-ico {
  font-size: 19px; line-height: 1; color: #00e5ff; margin-bottom: 10px;
  text-shadow: 0 0 14px rgba(0, 229, 255, .7);
}
.vx-feat h4 {
  font-size: 13px; font-weight: 800; color: #eaf2ff; margin: 0 0 6px; letter-spacing: .02em;
}
.vx-feat p { font-size: 11.5px; line-height: 1.7; color: #7791ad; margin: 0; }
@media (max-width: 700px) { .vx-feats { grid-template-columns: 1fr; } }

/* ── 区块标题 ── */
.vx-sec { margin-top: 40px; }
.vx-sec-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.vx-sec-num {
  font: 900 11px/1 ui-monospace, monospace; color: #00e5ff;
  padding: 5px 8px; border-radius: 6px;
  background: rgba(0, 229, 255, .1); border: 1px solid rgba(0, 229, 255, .26);
}
.vx-sec-t {
  font: 800 13px/1 ui-monospace, monospace; letter-spacing: .2em;
  color: #a9c0d8; text-transform: uppercase; margin: 0; white-space: nowrap;
}
.vx-sec-line {
  flex: 1; height: 1px;
  background: linear-gradient(90deg, rgba(0, 229, 255, .32), transparent);
}

/* ── 搜索 / 筛选 ── */
.vx-tools { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.vx-search {
  flex: 1 1 220px; display: flex; align-items: center; gap: 9px;
  padding: 11px 14px; border-radius: 12px;
  background: rgba(8, 13, 24, .85); border: 1px solid rgba(120, 190, 255, .14);
  transition: border-color .2s, box-shadow .2s;
}
.vx-search:focus-within { border-color: rgba(0, 229, 255, .45); box-shadow: 0 0 0 3px rgba(0, 229, 255, .08); }
.vx-search-ico { color: #3f5872; font-size: 14px; }
.vx-search input {
  flex: 1; background: none; border: none; outline: none;
  color: #dbeafe; font-size: 12.5px;
}
.vx-search input::placeholder { color: #3d5372; }
.vx-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.vx-chip {
  padding: 9px 13px; border-radius: 10px; cursor: pointer;
  font: 700 10.5px/1 ui-monospace, monospace; letter-spacing: .08em;
  color: #6b86a3; background: rgba(8, 13, 24, .7);
  border: 1px solid rgba(120, 190, 255, .12);
  transition: all .18s;
}
.vx-chip:hover { color: #a9c0d8; border-color: rgba(120, 190, 255, .28); }
.vx-chip.is-on {
  color: #04121a; background: linear-gradient(96deg, #00e5ff, #57c8ff);
  border-color: transparent; box-shadow: 0 0 18px rgba(0, 229, 255, .35);
}

/* ── 节点卡 ── */
.vx-nodes { display: grid; grid-template-columns: repeat(auto-fill, minmax(228px, 1fr)); gap: 11px; }
.vx-node {
  position: relative; overflow: hidden; text-align: left; cursor: pointer;
  padding: 15px; border-radius: 15px;
  background: linear-gradient(180deg, rgba(255, 255, 255, .042), rgba(255, 255, 255, .01));
  border: 1px solid rgba(120, 190, 255, .13);
  transition: transform .2s, border-color .2s, box-shadow .2s;
  color: inherit; font: inherit;
}
.vx-node:hover { transform: translateY(-3px); border-color: rgba(120, 190, 255, .32); }
.vx-node.is-on {
  border-color: rgba(0, 229, 255, .62);
  box-shadow: 0 0 0 1px rgba(0, 229, 255, .4), 0 12px 36px rgba(0, 229, 255, .16);
}
.vx-node-glow {
  position: absolute; inset: 0; opacity: 0; pointer-events: none;
  background: radial-gradient(140px 70px at 50% 0%, rgba(0, 229, 255, .3), transparent 72%);
  transition: opacity .32s;
}
.vx-node.is-on .vx-node-glow { opacity: 1; }
.vx-node-top { display: flex; align-items: center; gap: 9px; }
.vx-flag {
  width: 25px; height: 18px; object-fit: cover; border-radius: 3px; flex: none;
  box-shadow: 0 1px 6px rgba(0, 0, 0, .5);
}
.vx-flag-ph {
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(120, 190, 255, .1); font-size: 12px; color: #6b86a3;
}
.vx-node-name {
  font-size: 13.5px; font-weight: 800; color: #f0f6ff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
}
.vx-node-check {
  flex: none; width: 17px; height: 17px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: #00e5ff; color: #04121a; font-size: 10px; font-weight: 900;
  box-shadow: 0 0 12px rgba(0, 229, 255, .8);
}
.vx-demo-tag {
  flex: none; padding: 2px 6px; border-radius: 4px;
  font: 700 9px/1 ui-monospace, monospace; letter-spacing: .08em;
  color: #ffb020; background: rgba(255, 176, 32, .13);
  border: 1px solid rgba(255, 176, 32, .3);
}
.vx-node-loc {
  margin: 7px 0 12px; font-size: 11px; color: #5e7893;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.vx-node-foot { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.vx-node-price {
  font: 900 15px/1 ui-monospace, monospace; color: #dbeafe; letter-spacing: -.02em;
}
.vx-node-price i { font: 600 9.5px/1 ui-monospace, monospace; color: #4b6280; font-style: normal; margin-left: 1px; }
.vx-lat {
  font: 700 10px/1 ui-monospace, monospace; letter-spacing: .04em;
  padding: 3px 7px; border-radius: 999px;
}
.vx-lat.l-good { color: #34e5b0; background: rgba(52, 229, 176, .11); }
.vx-lat.l-mid  { color: #ffc046; background: rgba(255, 192, 70, .11); }
.vx-lat.l-bad  { color: #ff5f7a; background: rgba(255, 95, 122, .11); }
.vx-lat.l-none { color: #3f5872; background: rgba(120, 190, 255, .06); }

.vx-none {
  grid-column: 1 / -1; padding: 44px 0; text-align: center; color: #4b6280;
}
.vx-none-ico { font-size: 26px; display: block; margin-bottom: 8px; opacity: .5; }
.vx-none p { font-size: 12.5px; margin: 0; }

/* ── 选项按钮 ── */
.vx-pick { display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)); gap: 9px; }
.vx-pick-4 { grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); }
.vx-pick-btn {
  position: relative; cursor: pointer; padding: 13px 8px; border-radius: 13px;
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  background: linear-gradient(180deg, rgba(255, 255, 255, .04), rgba(255, 255, 255, .008));
  border: 1px solid rgba(120, 190, 255, .13);
  transition: transform .18s, border-color .18s, box-shadow .18s;
  color: inherit; font: inherit;
}
.vx-pick-btn:hover { transform: translateY(-2px); border-color: rgba(120, 190, 255, .3); }
.vx-pick-btn.is-on {
  border-color: rgba(0, 229, 255, .6);
  background: linear-gradient(180deg, rgba(0, 229, 255, .14), rgba(0, 229, 255, .03));
  box-shadow: 0 0 0 1px rgba(0, 229, 255, .35), 0 10px 30px rgba(0, 229, 255, .14);
}
.vx-pick-v { font: 900 14px/1 ui-monospace, monospace; color: #eaf2ff; letter-spacing: -.01em; }
.vx-pick-btn.is-on .vx-pick-v { color: #6ff0ff; }
.vx-pick-sub { font: 600 10px/1 ui-monospace, monospace; color: #4b6280; }
.vx-pick-off {
  position: absolute; top: 6px; right: 7px;
  font: 800 8.5px/1 ui-monospace, monospace; color: #34e5b0; letter-spacing: .04em;
}
.vx-best {
  position: absolute; top: -7px; left: 50%; transform: translateX(-50%);
  padding: 2.5px 8px; border-radius: 999px;
  font: 900 8.5px/1 ui-monospace, monospace; letter-spacing: .1em;
  color: #180a00; background: linear-gradient(96deg, #ffb020, #ff6a3d);
  box-shadow: 0 3px 12px rgba(255, 138, 40, .45);
}
.vx-warn { grid-column: 1 / -1; text-align: center; padding: 16px; font-size: 12px; color: #ffc046; }

/* ── 指标 HUD ── */
.vx-metrics {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
  margin-top: 22px; border-radius: 14px; overflow: hidden;
  background: rgba(120, 190, 255, .1);
  border: 1px solid rgba(120, 190, 255, .12);
}
.vx-metric {
  padding: 14px 10px; background: rgba(6, 10, 20, .84);
  display: flex; flex-direction: column; align-items: center; gap: 7px;
}
.vx-metric-k {
  font: 600 8.5px/1 ui-monospace, monospace; letter-spacing: .16em; color: #3f5872;
}
.vx-metric-v {
  font: 900 16px/1 ui-monospace, monospace; color: #dbeafe; letter-spacing: -.02em;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.vx-metric-sm { font-size: 12px; font-weight: 700; }
.vx-metric-v i { font: 600 9px/1 ui-monospace, monospace; color: #4b6280; font-style: normal; }
.vx-metric-v.l-good { color: #34e5b0; }
.vx-metric-v.l-mid { color: #ffc046; }
.vx-metric-v.l-bad { color: #ff5f7a; }
.vx-metric-v.l-none { color: #3f5872; }
@media (max-width: 600px) { .vx-metrics { grid-template-columns: repeat(2, 1fr); } }

/* ── 协议标签 ── */
.vx-protos { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 14px; }
.vx-proto {
  padding: 5px 11px; border-radius: 999px;
  font: 700 10px/1 ui-monospace, monospace; letter-spacing: .05em;
  color: #7d9ab8; background: rgba(0, 229, 255, .06);
  border: 1px solid rgba(0, 229, 255, .16);
}

/* ── 优惠码 ── */
.vx-coupon { display: flex; gap: 8px; margin-top: 22px; align-items: center; }
.vx-coupon input {
  flex: 1; padding: 11px 14px; border-radius: 11px; outline: none;
  background: rgba(8, 13, 24, .85); border: 1px solid rgba(120, 190, 255, .14);
  color: #dbeafe; font: 600 12.5px/1 ui-monospace, monospace; letter-spacing: .08em;
  text-transform: uppercase; transition: border-color .2s;
}
.vx-coupon input::placeholder { color: #3d5372; letter-spacing: .04em; text-transform: none; }
.vx-coupon input:focus { border-color: rgba(255, 176, 32, .45); }
.vx-coupon-btn {
  padding: 11px 20px; border-radius: 11px; cursor: pointer; border: none;
  font: 800 11.5px/1 ui-monospace, monospace; letter-spacing: .08em;
  color: #180a00; background: linear-gradient(96deg, #ffb020, #ff8a28);
  transition: filter .18s;
}
.vx-coupon-btn:hover { filter: brightness(1.1); }
.vx-coupon-btn:disabled { opacity: .6; cursor: wait; }
.vx-coupon-x {
  padding: 10px 12px; border-radius: 11px; cursor: pointer;
  background: rgba(255, 95, 122, .1); border: 1px solid rgba(255, 95, 122, .3);
  color: #ff5f7a; font-size: 11px;
}
.vx-ok { margin-top: 9px; font-size: 11.5px; color: #34e5b0; }
.vx-err { margin-top: 9px; font-size: 11.5px; color: #ff5f7a; }

/* ── 结算栏 ── */
.vx-pay {
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  margin-top: 26px; padding: 20px 22px; border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, .055), rgba(255, 255, 255, .015)),
    radial-gradient(320px 120px at 12% 0%, rgba(0, 229, 255, .12), transparent 70%);
  border: 1px solid rgba(0, 229, 255, .2);
  box-shadow: 0 18px 50px rgba(0, 0, 0, .5);
}
.vx-pay-desc { font-size: 11.5px; color: #7d9ab8; letter-spacing: .02em; }
.vx-dot-s { color: #2a3d55; margin: 0 4px; }
.vx-pay-price {
  margin-top: 7px; font: 900 33px/1 ui-monospace, monospace;
  color: #6ff0ff; letter-spacing: -.03em;
  text-shadow: 0 0 26px rgba(0, 229, 255, .45);
}
.vx-cur { font-size: .52em; font-weight: 700; margin-right: 2px; color: #4b8fa8; }
.vx-was {
  font-size: .38em; font-weight: 600; color: #44607c; margin-left: 9px;
  text-decoration: line-through; text-shadow: none;
}
.vx-bal {
  display: inline-block; margin-top: 9px; padding: 4px 10px; border-radius: 999px;
  font: 700 10px/1 ui-monospace, monospace; letter-spacing: .05em;
}
.vx-bal.is-ok { color: #34e5b0; background: rgba(52, 229, 176, .1); border: 1px solid rgba(52, 229, 176, .28); }
.vx-bal.is-bad { color: #ff5f7a; background: rgba(255, 95, 122, .1); border: 1px solid rgba(255, 95, 122, .3); }
.vx-pay-r { display: flex; flex-direction: column; align-items: flex-end; gap: 9px; }

.vx-buy {
  position: relative; overflow: hidden; cursor: pointer; border: none;
  padding: 15px 40px; border-radius: 14px;
  background: linear-gradient(96deg, #00e5ff, #4db8ff 52%, #a855f7);
  color: #04121a; font-weight: 900; font-size: 15px; letter-spacing: .06em;
  box-shadow: 0 14px 40px rgba(0, 229, 255, .3);
  transition: transform .18s, box-shadow .18s;
}
.vx-buy:hover { transform: translateY(-2px); box-shadow: 0 18px 50px rgba(0, 229, 255, .44); }
.vx-buy:disabled { opacity: .6; cursor: wait; transform: none; }
.vx-buy-txt { position: relative; z-index: 2; }
.vx-buy-shine {
  position: absolute; top: 0; left: -60%; width: 40%; height: 100%; z-index: 1;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, .55), transparent);
  animation: vx-shine 3.4s ease-in-out infinite;
}
@keyframes vx-shine {
  0% { left: -60% } 55% { left: 130% } 100% { left: 130% }
}
.vx-topup { font-size: 11px; color: #ffc046; text-decoration: none; }
.vx-topup:hover { color: #ffd77a; }
@media (max-width: 640px) {
  .vx-pay { flex-direction: column; align-items: stretch; gap: 16px; }
  .vx-pay-r { align-items: stretch; }
  .vx-buy { width: 100%; }
  .vx-topup { text-align: center; }
}

/* ── 空态 ── */
.vx-empty {
  position: relative; margin: 44px 0; padding: 54px 20px; text-align: center;
  border-radius: 20px; overflow: hidden;
  background: linear-gradient(180deg, rgba(255, 255, 255, .035), transparent);
  border: 1px dashed rgba(120, 190, 255, .22);
}
.vx-empty-ring {
  width: 46px; height: 46px; margin: 0 auto 18px; border-radius: 999px;
  border: 1.5px solid rgba(0, 229, 255, .5); border-top-color: transparent;
  animation: vx-spin 1.6s linear infinite;
}
@keyframes vx-spin { to { transform: rotate(360deg) } }
.vx-empty-t {
  font: 800 12px/1 ui-monospace, monospace; letter-spacing: .26em; color: #6ff0ff;
}
.vx-empty-p { margin: 12px auto 0; max-width: 440px; font-size: 12.5px; line-height: 1.85; color: #5e7893; }

/* ── 加载 ── */
.vx-loading { padding: 60px 0; text-align: center; }
.vx-loading-bar {
  width: 180px; height: 2px; margin: 0 auto 14px; border-radius: 2px;
  background: rgba(120, 190, 255, .12); overflow: hidden;
}
.vx-loading-bar i {
  display: block; width: 40%; height: 100%;
  background: linear-gradient(90deg, transparent, #00e5ff, transparent);
  animation: vx-slide 1.3s ease-in-out infinite;
}
@keyframes vx-slide { 0% { transform: translateX(-100%) } 100% { transform: translateX(350%) } }
.vx-loading p {
  font: 600 10px/1 ui-monospace, monospace; letter-spacing: .22em; color: #3f5872;
}

/* ── 信任条 ── */
.vx-trust {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 20px;
  margin-top: 44px; padding-top: 22px;
  border-top: 1px solid rgba(120, 190, 255, .09);
}
.vx-trust-i {
  display: inline-flex; align-items: center; gap: 7px;
  font: 600 10.5px/1 ui-monospace, monospace; letter-spacing: .05em; color: #47607d;
}
.vx-trust-i i { color: #00e5ff; font-style: normal; font-size: 7px; opacity: .7; }

/* ── 成功弹窗 ── */
.vx-modal {
  position: fixed; inset: 0; z-index: 10001; display: flex;
  align-items: center; justify-content: center; padding: 20px;
  background: rgba(2, 4, 10, .82); backdrop-filter: blur(8px);
}
.vx-modal-box {
  width: 100%; max-width: 350px; padding: 34px 26px; text-align: center;
  border-radius: 22px; position: relative; overflow: hidden;
  background: linear-gradient(180deg, #0b1220, #070b14);
  border: 1px solid rgba(0, 229, 255, .26);
  box-shadow: 0 30px 80px rgba(0, 0, 0, .8), 0 0 60px rgba(0, 229, 255, .1);
}
.vx-modal-ring {
  width: 60px; height: 60px; margin: 0 auto 18px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid rgba(52, 229, 176, .55);
  background: radial-gradient(circle, rgba(52, 229, 176, .16), transparent 70%);
  box-shadow: 0 0 34px rgba(52, 229, 176, .3);
}
.vx-modal-ring span { font-size: 24px; color: #34e5b0; font-weight: 900; }
.vx-modal-t {
  margin: 0 0 12px; font: 900 17px/1 ui-monospace, monospace;
  letter-spacing: .14em; color: #eaf2ff;
}
.vx-modal-p {
  margin: 0 0 4px; padding: 9px 12px; border-radius: 9px;
  font: 600 12.5px/1.4 ui-monospace, monospace; color: #6ff0ff;
  background: rgba(0, 229, 255, .07); border: 1px solid rgba(0, 229, 255, .18);
  word-break: break-all;
}
.vx-modal-btns { display: flex; flex-direction: column; gap: 9px; margin-top: 20px; }
.vx-modal-primary {
  padding: 13px; border-radius: 12px; cursor: pointer; border: none;
  font-weight: 900; font-size: 13px; letter-spacing: .04em;
  color: #04121a; background: linear-gradient(96deg, #00e5ff, #4db8ff);
  transition: filter .18s;
}
.vx-modal-primary:hover { filter: brightness(1.08); }
.vx-modal-ghost {
  padding: 13px; border-radius: 12px; cursor: pointer;
  font-weight: 700; font-size: 12.5px; color: #8ea4bf;
  background: rgba(255, 255, 255, .05);
  border: 1px solid rgba(120, 190, 255, .16);
  transition: background .18s;
}
.vx-modal-ghost:hover { background: rgba(255, 255, 255, .09); }
</style>
