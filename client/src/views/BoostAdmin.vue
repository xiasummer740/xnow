<template>
  <div class="min-h-screen bg-slate-950 text-white">
    <div class="max-w-7xl mx-auto px-3 md:px-6 py-5">

      <header class="flex flex-wrap items-center gap-3 mb-5">
        <h1 class="text-lg md:text-xl font-black">🎯 千川业务后台</h1>
        <span v-if="stats.pending > 0" class="text-[11px] px-2 py-1 rounded-lg bg-red-500 text-white font-black animate-pulse">
          {{ stats.pending }} 单待派单
        </span>
        <button @click="loadAll" class="ml-auto text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 hover:border-slate-400">刷新</button>
      </header>

      <!-- 概览 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
        <div class="bg-slate-900 border border-slate-700/70 rounded-xl p-3">
          <p class="text-[10px] text-slate-500 mb-1">待派单</p>
          <p class="text-xl font-black" :class="stats.pending > 0 ? 'text-red-400' : 'text-slate-300'">{{ stats.pending }}</p>
        </div>
        <div class="bg-slate-900 border border-slate-700/70 rounded-xl p-3">
          <p class="text-[10px] text-slate-500 mb-1">处理中</p>
          <p class="text-xl font-black text-sky-400">{{ stats.processing }}</p>
        </div>
        <div class="bg-slate-900 border border-slate-700/70 rounded-xl p-3">
          <p class="text-[10px] text-slate-500 mb-1">今日订单</p>
          <p class="text-xl font-black text-white">{{ stats.today_count }}</p>
        </div>
        <div class="bg-slate-900 border border-slate-700/70 rounded-xl p-3">
          <p class="text-[10px] text-slate-500 mb-1">今日金额</p>
          <p class="text-xl font-black text-amber-400">¥{{ stats.today_amount.toFixed(2) }}</p>
        </div>
      </div>

      <!-- tab -->
      <div class="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar">
        <button v-for="t in tabs" :key="t.key" @click="switchTab(t.key)"
                :class="['px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition',
                         tab === t.key ? 'bg-amber-400 text-black border-amber-400' : 'bg-slate-900 text-slate-400 border-slate-700']">
          {{ t.label }}<span v-if="t.key === 'pending' && stats.pending" class="ml-1">({{ stats.pending }})</span>
        </button>
      </div>

      <!-- ── 订单队列 ─────────────────────────────────────────────────── -->
      <template v-if="tab === 'pending' || tab === 'orders'">
        <div class="flex gap-2 mb-3">
          <input v-model="keyword" @keyup.enter="loadOrders" placeholder="订单号 / 商品 / 链接 / 手机号"
                 class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400" />
          <select v-model="statusFilter" @change="loadOrders"
                  class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white outline-none">
            <option value="">全部状态</option>
            <option value="待派单">待派单</option>
            <option value="处理中">处理中</option>
            <option value="已完成">已完成</option>
            <option value="已取消">已取消</option>
          </select>
          <button @click="loadOrders" class="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-xs text-slate-300">搜索</button>
        </div>

        <div v-if="!orders.length" class="text-center py-14 text-slate-600 text-sm">暂无订单</div>

        <div v-else class="space-y-2">
          <div v-for="o in orders" :key="o.id"
               class="bg-slate-900 border rounded-xl p-3"
               :class="o.status === '待派单' ? 'border-amber-500/50' : 'border-slate-700/70'">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
              <span class="font-mono text-[11px] text-slate-400">{{ o.order_no }}</span>
              <span :class="statusClass(o.status)" class="text-[10px] px-1.5 py-0.5 rounded font-bold">{{ o.status }}</span>
              <span class="text-[11px] text-slate-500">{{ fmtTime(o.created_at) }}</span>
              <span v-if="o.contact_channel" class="text-[10px] text-slate-600">渠道: {{ o.contact_channel }}</span>
              <span class="ml-auto text-amber-400 font-black text-sm">¥{{ Number(o.charge).toFixed(2) }}</span>
            </div>

            <div class="text-xs text-white font-bold mb-1">{{ o.product_name }}　<span class="text-slate-500 font-normal">× {{ o.quantity }}</span></div>
            <div class="text-[11px] text-slate-400 break-all mb-1">
              <span class="text-slate-600">链接/账号：</span>{{ o.link }}
            </div>
            <div v-if="Object.keys(o.ext_fields || {}).length" class="text-[11px] text-slate-500 mb-2">
              <span v-for="(v, k) in o.ext_fields" :key="k" class="mr-3">{{ k }}: {{ v }}</span>
            </div>
            <div v-if="o.admin_note" class="text-[11px] text-yellow-500/80 mb-2">备注：{{ o.admin_note }}</div>

            <div class="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800">
              <button @click="copyScript(o)" class="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 hover:border-amber-400">
                📋 复制话术
              </button>
              <button v-if="o.status === '待派单'" @click="setStatus(o, '处理中')"
                      class="text-[11px] px-2.5 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300">开始处理</button>
              <button v-if="o.status === '处理中'" @click="setStatus(o, '已完成')"
                      class="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">标记完成</button>
              <button v-if="o.status === '待派单' || o.status === '处理中'" @click="doRefund(o)"
                      class="text-[11px] px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300">退款</button>
              <button @click="openNote(o)" class="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-400">备注</button>
            </div>
          </div>
        </div>
      </template>

      <!-- ── 商品管理 ─────────────────────────────────────────────────── -->
      <template v-if="tab === 'products'">
        <!-- 批量调价：上线录的是进货成本，售价由这里统一上浮 -->
        <div class="bg-slate-900 border border-amber-500/40 rounded-xl p-3 mb-3">
          <p class="text-[11px] text-amber-300 font-bold mb-2">💰 批量调价（按成本上浮）</p>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[11px] text-slate-500">成本 ×</span>
            <input v-model.number="repriceMultiplier" type="number" step="0.05" min="0.1" placeholder="1.5"
                   class="w-20 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white font-mono outline-none focus:border-amber-400" />
            <span class="text-[11px] text-slate-500">= 售价</span>
            <button @click="doReprice" :disabled="repricing"
                    class="px-3 py-1.5 rounded-lg bg-amber-400 text-black text-[11px] font-black disabled:opacity-50">
              {{ repricing ? '计算中…' : '一键重算全部售价' }}
            </button>
            <span class="text-[10px] text-slate-600">
              例：倍率 1.5 → 成本 ¥75 的卖 ¥112.50；成本 ¥18/万 的卖 ¥27/万
            </span>
          </div>
        </div>

        <p class="text-[11px] text-slate-500 mb-3">
          阶梯价只填「起始数量」和「单价」：<b class="text-slate-300">下单量 ≥ 起始数量，整单就按这个单价算</b>。
          例：普通播放 ≥100000 → 8 元/万，买 25 万就是 25×8=200 元。
        </p>
        <div class="space-y-2">
          <div v-for="p in products" :key="p.id" class="bg-slate-900 border border-slate-700/70 rounded-xl p-3">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span class="text-xs font-mono text-slate-500">{{ p.code }}</span>
              <span class="text-sm font-bold text-white">{{ p.name }}</span>
              <span v-if="!p.active" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">已下架</span>
              <span class="ml-auto text-[10px] text-slate-500">{{ catLabel(p.category) }}</span>
              <button @click="editProduct(p)" class="text-[11px] px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-300">编辑</button>
              <button @click="toggleProduct(p)" class="text-[11px] px-2 py-1 rounded bg-slate-800 border border-slate-600"
                      :class="p.active ? 'text-red-300' : 'text-emerald-300'">{{ p.active ? '下架' : '上架' }}</button>
            </div>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              <span class="text-slate-500">成本 <span class="font-mono text-slate-300">¥{{ fmtNum(firstCost(p)) }}</span></span>
              <span class="text-slate-700">→</span>
              <span class="text-amber-400 font-bold">售价 ¥{{ fmtNum(firstSale(p)) }}</span>
              <span v-if="marginPct(p) != null"
                    :class="['px-1.5 py-0.5 rounded font-bold',
                             marginPct(p) <= 0 ? 'bg-red-500/20 text-red-300'
                               : marginPct(p) < 20 ? 'bg-amber-500/20 text-amber-300'
                               : 'bg-emerald-500/15 text-emerald-300']">
                毛利 {{ marginPct(p).toFixed(1) }}%
              </span>
              <span class="text-slate-600">{{ p.pricing_mode === 'flat' ? `固定 ${p.min_qty} 个` : `元/${p.unit_label}` }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- ── 客服设置 ─────────────────────────────────────────────────── -->
      <template v-if="tab === 'settings'">
        <div v-if="settingsLoading && !settingsLoaded"
             class="bg-slate-900 border border-slate-700/70 rounded-xl p-8 text-center text-xs text-slate-500 max-w-lg">
          正在读取已保存的配置…
        </div>
        <div v-else-if="!settingsLoaded"
             class="bg-red-500/10 border border-red-500/40 rounded-xl p-4 text-xs text-red-300 max-w-lg">
          配置读取失败，请刷新页面重试。<b>此时不要点保存</b> —— 空白表单会把已保存的配置覆盖掉。
          <button @click="loadSettings" class="ml-2 underline font-bold">重新读取</button>
        </div>
        <div v-else class="bg-slate-900 border border-slate-700/70 rounded-xl p-4 space-y-4 max-w-lg">
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">微信号（客户点「显示」才看到）</label>
            <input v-model="settings.boost_wechat_id" class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400" />
          </div>

          <!-- 二维码：直接 Ctrl+V 粘贴截图，或点一下选文件。不用先去别处传图拿链接 -->
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">微信二维码</label>
            <div tabindex="0" ref="qrBox"
                 @paste.prevent="onQrPaste"
                 @click="$refs.qrFile.click()"
                 @dragover.prevent
                 @drop.prevent="onQrDrop"
                 :class="['relative rounded-xl border-2 border-dashed cursor-pointer transition outline-none',
                          qrUploading ? 'border-amber-400 bg-amber-400/5'
                                      : 'border-slate-600 hover:border-amber-400/60 bg-slate-800/40']">
              <div v-if="settings.boost_wechat_qr" class="p-2 flex items-center gap-3">
                <img :src="settings.boost_wechat_qr" alt="客服二维码"
                     class="w-24 h-24 rounded-lg object-contain bg-white p-1 shrink-0" />
                <div class="text-[11px] text-slate-400 leading-relaxed">
                  <p class="text-emerald-400 font-bold mb-1">已设置 ✓</p>
                  <p>点这里可换一张，或重新 Ctrl+V 粘贴</p>
                  <button @click.stop="settings.boost_wechat_qr = ''"
                          class="mt-1.5 text-red-400 underline">移除二维码</button>
                </div>
              </div>
              <div v-else class="py-7 text-center text-[11px] text-slate-500 leading-relaxed">
                <p class="text-2xl mb-1.5">📋</p>
                <p class="font-bold text-slate-400">{{ qrUploading ? '上传中…' : '点这里选图片，或直接 Ctrl+V 粘贴截图' }}</p>
                <p class="mt-1 text-[10px] text-slate-600">支持 png / jpg / webp，也可把图片拖进来</p>
              </div>
              <input type="file" ref="qrFile" accept="image/*" class="hidden" @change="onQrFileChange" />
            </div>
            <p v-if="qrTip" class="text-[11px] mt-1" :class="qrTipType === 'error' ? 'text-red-400' : 'text-emerald-400'">{{ qrTip }}</p>
          </div>

          <div>
            <label class="block text-[11px] text-slate-400 mb-1">TG 账号</label>
            <input v-model="settings.boost_tg" placeholder="@xnowfans"
                   class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400" />
            <!-- 链接不用填，自动算 -->
            <p v-if="tgUrlPreview" class="text-[11px] text-slate-500 mt-1">
              客户按钮直达：<span class="text-sky-300 font-mono">{{ tgUrlPreview }}</span>
            </p>
            <p v-else class="text-[11px] text-slate-600 mt-1">
              填了账号就会自动生成 t.me 链接，不用手填
            </p>
          </div>

          <div>
            <label class="block text-[11px] text-slate-400 mb-1">下单页提示文案（选填）</label>
            <input v-model="settings.boost_service_hint" placeholder="例如：下单后请加微信报订单号，5 分钟内安排"
                   class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400" />
          </div>
          <button @click="saveSettings" :disabled="savingSettings || !settingsLoaded"
                  class="w-full py-2.5 rounded-lg bg-amber-400 text-black font-black text-xs disabled:opacity-50">
            {{ savingSettings ? '保存中…' : '保存' }}
          </button>
          <p class="text-[10px] text-slate-600 text-center">保存后客户下单页立即生效，无需重启</p>
        </div>
      </template>
    </div>

    <!-- 编辑商品弹窗 -->
    <div v-if="editing" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" @click.self="editing = null">
      <div class="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 class="font-black text-sm">编辑商品</h3>
          <button @click="editing = null" class="text-slate-500 text-xl leading-none px-2">×</button>
        </div>
        <div class="p-4 space-y-3">
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">商品名</label>
            <input v-model="editing.name" class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400" />
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">副标题</label>
            <input v-model="editing.subtitle" class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400" />
          </div>

          <template v-if="editing.pricing_mode === 'flat'">
            <div class="flex gap-2">
              <div class="flex-1">
                <label class="block text-[11px] text-slate-400 mb-1">成本（进货价，客户看不到）</label>
                <input v-model.number="editing.cost_flat_price" type="number" step="0.01"
                       class="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400 font-mono outline-none focus:border-slate-500" />
              </div>
              <div class="flex-1">
                <label class="block text-[11px] text-amber-400 mb-1">售价（客户看到）</label>
                <input v-model.number="editing.flat_price" type="number" step="0.01"
                       class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-mono" />
              </div>
            </div>
          </template>

          <template v-else>
            <div class="flex gap-2">
              <div class="flex-1">
                <label class="block text-[11px] text-slate-400 mb-1">计价单位（每多少个）</label>
                <input v-model.number="editing.unit_qty" type="number"
                       class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-mono" />
              </div>
              <div class="w-20">
                <label class="block text-[11px] text-slate-400 mb-1">显示为</label>
                <input v-model="editing.unit_label" class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400" />
              </div>
            </div>
            <div>
              <label class="block text-[11px] text-slate-400 mb-1">
                阶梯价（起始数量 / <span class="text-slate-500">成本</span> / <span class="text-amber-400">售价</span>）
              </label>
              <div v-for="(t, i) in editing.tiers" :key="i" class="flex gap-1.5 mb-1.5">
                <input v-model.number="t.min" type="number" placeholder="起始量"
                       class="w-24 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white font-mono outline-none focus:border-amber-400" />
                <input v-model.number="editing.cost_tiers[i].price" type="number" step="0.01" placeholder="成本"
                       class="flex-1 bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-400 font-mono outline-none focus:border-slate-500" />
                <input v-model.number="t.price" type="number" step="0.01" placeholder="售价"
                       class="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-amber-300 font-mono outline-none focus:border-amber-400" />
                <button @click="delTier(i)" class="px-2 text-red-400 text-xs">删</button>
              </div>
              <button @click="addTier" class="text-[11px] text-amber-300 underline">+ 加一档</button>
            </div>
          </template>

          <div class="flex gap-2">
            <div class="flex-1">
              <label class="block text-[11px] text-slate-400 mb-1">最小起售量</label>
              <input v-model.number="editing.min_qty" type="number"
                     class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-mono" />
            </div>
            <div class="flex-1">
              <label class="block text-[11px] text-slate-400 mb-1">数量步进</label>
              <input v-model.number="editing.qty_step" type="number"
                     class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-mono" />
            </div>
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">时效说明</label>
            <input v-model="editing.eta_text" class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400" />
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">客户须知</label>
            <textarea v-model="editing.notice" rows="3"
                      class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400 resize-none"></textarea>
          </div>

          <p v-if="editTip" class="text-xs text-red-400">{{ editTip }}</p>
          <button @click="saveProduct" class="w-full py-2.5 rounded-lg bg-amber-400 text-black font-black text-xs">保存</button>
        </div>
      </div>
    </div>

    <!-- 备注弹窗 -->
    <div v-if="noting" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" @click.self="noting = null">
      <div class="w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-700 p-4">
        <h3 class="font-black text-sm mb-3">订单备注</h3>
        <textarea v-model="noteText" rows="4"
                  class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400 resize-none"
                  placeholder="例如：已授权、客户要求分两批、补量 5000…"></textarea>
        <button @click="saveNote" class="w-full mt-3 py-2.5 rounded-lg bg-amber-400 text-black font-black text-xs">保存</button>
      </div>
    </div>

    <!-- 话术预览（点了复制后弹，方便手抄） -->
    <div v-if="scriptText" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" @click.self="scriptText = ''">
      <div class="w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-700 p-4">
        <h3 class="font-black text-sm mb-2">对接话术（已复制到剪贴板）</h3>
        <pre class="text-[11px] text-slate-300 whitespace-pre-wrap bg-slate-800 rounded-lg p-3 mb-3">{{ scriptText }}</pre>
        <button @click="scriptText = ''" class="w-full py-2 rounded-lg bg-amber-400 text-black font-black text-xs">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '../stores/user';
import { fetchWithTimeout } from '../utils/fetchTimeout';
import { useUiStore } from '../stores/ui';

const userStore = useUserStore();
// 🪟 站内暗色弹窗 / Toast，别再用原生 confirm()、alert()（浏览器那个白框太丑）
const ui = useUiStore();

const tabs = [
  { key: 'pending', label: '待派单' },
  { key: 'orders', label: '全部订单' },
  { key: 'products', label: '商品管理' },
  { key: 'settings', label: '客服设置' },
];
const tab = ref('pending');

const stats = ref({ pending: 0, processing: 0, done: 0, today_count: 0, today_amount: 0 });
const orders = ref([]);
const products = ref([]);
const settings = ref({ boost_wechat_id: '', boost_wechat_qr: '', boost_tg: '', boost_tg_url: '', boost_service_hint: '' });
const savingSettings = ref(false);
const settingsLoading = ref(false);
const settingsLoaded = ref(false);   // 没加载成功之前不许保存，否则空白表单会把库里的配置覆盖成空

const keyword = ref('');
const statusFilter = ref('待派单');
const editing = ref(null);
const editTip = ref('');
const noting = ref(null);
const noteText = ref('');
const scriptText = ref('');

// 批量调价
const repriceMultiplier = ref(1.5);
const repricing = ref(false);

const fmtNum = (n) => {
  const v = Number(n || 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};
// 取第一档代表价（flat 就是固定价，tier 取最低档单价）
const firstCost = (p) => (p.pricing_mode === 'flat' ? Number(p.cost_flat_price || 0) : Number((p.cost_tiers?.[0] || {}).price || 0));
const firstSale = (p) => (p.pricing_mode === 'flat' ? Number(p.flat_price || 0) : Number((p.tiers?.[0] || {}).price || 0));
const marginPct = (p) => {
  const s = firstSale(p);
  const c = firstCost(p);
  if (!s || !c) return null;
  return ((s - c) / s) * 100;
};

const CAT = { play: '普通播放', marketing: '营销播放', natural: '自然流播放', like: '千川点赞', scan: '扫码', fans: '涨粉', liveview: '场观', account: '视频号' };
const catLabel = (k) => CAT[k] || k;

const authHeaders = () => ({ Authorization: `Bearer ${userStore.token}` });

function fmtTime(s) {
  if (!s) return '';
  const d = new Date(s);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function statusClass(s) {
  if (s === '待派单') return 'bg-amber-400/15 text-amber-300';
  if (s === '处理中') return 'bg-sky-400/15 text-sky-300';
  if (s === '已完成') return 'bg-emerald-400/15 text-emerald-300';
  if (s === '已退款' || s === '已取消') return 'bg-red-400/15 text-red-300';
  return 'bg-slate-700 text-slate-300';
}

async function api(path, opts = {}) {
  const r = await fetchWithTimeout(path, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } }, 20000, 1);
  const j = await r.json().catch(() => null);
  if (!j) throw new Error('网络异常');
  return j;
}

async function loadStats() {
  try {
    const j = await api('/api/boost-admin/stats');
    if (j.status === 'success') stats.value = { ...stats.value, ...j.data };
  } catch { /* 概览失败不影响主流程 */ }
}

async function loadOrders() {
  const qs = new URLSearchParams();
  const st = tab.value === 'pending' ? '待派单' : statusFilter.value;
  if (st) qs.set('status', st);
  if (keyword.value) qs.set('keyword', keyword.value);
  try {
    const j = await api('/api/boost-admin/orders?' + qs.toString());
    if (j.status === 'success') orders.value = j.data.items || [];
    else orders.value = [];
  } catch { orders.value = []; }
}

async function loadProducts() {
  try {
    const j = await api('/api/boost-admin/products');
    if (j.status === 'success') products.value = j.data || [];
  } catch { /* ignore */ }
}

async function loadSettings() {
  settingsLoading.value = true;
  try {
    const j = await api('/api/boost-admin/settings');
    if (j.status === 'success') {
      settings.value = { ...settings.value, ...j.data };
      settingsLoaded.value = true;
    }
  } catch { /* ignore */ } finally { settingsLoading.value = false; }
}

// 🔴 tab 切换必须自己去拉数据。
//    以前 `@click="tab = t.key"` 只改变量，切到「客服设置」时表单是空的 ——
//    看到空白以为没保存，再点一次「保存」就用空值把库里配置全清了。
function switchTab(k) {
  if (tab.value === k) return;
  tab.value = k;
  if (k === 'pending' || k === 'orders') loadOrders();
  else if (k === 'products') loadProducts();
  else if (k === 'settings') loadSettings();
}

async function loadAll() {
  await loadStats();
  if (tab.value === 'pending' || tab.value === 'orders') await loadOrders();
  if (tab.value === 'products') await loadProducts();
  if (tab.value === 'settings') await loadSettings();
}

async function setStatus(o, status) {
  try {
    const j = await api(`/api/boost-admin/orders/${o.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (j.status !== 'success') { ui.showToast(j.message || '操作失败', 'error'); return; }
    await loadAll();
  } catch { ui.showToast('网络异常', 'error'); }
}

async function doRefund(o) {
  const ok = await ui.showConfirm(
    `确认给订单 ${o.order_no} 全额退款 ¥${Number(o.charge).toFixed(2)}？\n退款会直接加到客户账户余额，订单同时标记为已退款。`,
    '确认退款',
  );
  if (!ok) return;
  try {
    const j = await api(`/api/boost-admin/orders/${o.id}/refund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    ui.showToast(j.status === 'success' ? (j.message || '已退款') : (j.message || '退款失败'), j.status === 'success' ? 'success' : 'error');
    await loadAll();
  } catch { ui.showToast('网络异常', 'error'); }
}

function openNote(o) {
  noting.value = o;
  noteText.value = o.admin_note || '';
}

async function saveNote() {
  if (!noting.value) return;
  try {
    const j = await api(`/api/boost-admin/orders/${noting.value.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 只改备注：status 传当前值，走同一条合法的自迁移判断会失败，所以这里单独放行
      body: JSON.stringify({ status: noting.value.status, note: noteText.value }),
    });
    if (j.status !== 'success') { ui.showToast(j.message || '保存失败', 'error'); return; }
    noting.value = null;
    await loadOrders();
  } catch { ui.showToast('网络异常', 'error'); }
}

// 一键对接话术：把运营要在微信里打的字全部拼好
function copyScript(o) {
  const ext = o.ext_fields || {};
  const lines = [
    `老板您好，您拍的「${o.product_name}」× ${o.quantity}，实付 ¥${Number(o.charge).toFixed(2)} 已到账。`,
    `订单号：${o.order_no}`,
  ];
  if (ext.link) lines.push(`视频/作品链接：${ext.link}`);
  if (ext.douyin_id) lines.push(`抖音号：${ext.douyin_id}`);
  if (ext.remark) lines.push(`备注要求：${ext.remark}`);
  lines.push('麻烦确认以上信息无误，确认后我们 24 小时内给您授权开跑～');
  const text = lines.join('\n');
  navigator.clipboard?.writeText(text).catch(() => {});
  scriptText.value = text;
}

function editProduct(p) {
  editing.value = JSON.parse(JSON.stringify(p));
  // 成本阶梯必须和售价阶梯等长，否则模板里 editing.cost_tiers[i].price 会炸
  if (!Array.isArray(editing.value.cost_tiers)) editing.value.cost_tiers = [];
  while (editing.value.cost_tiers.length < editing.value.tiers.length) {
    const t = editing.value.tiers[editing.value.cost_tiers.length];
    editing.value.cost_tiers.push({ min: t.min, price: 0 });
  }
  editTip.value = '';
}

function addTier() {
  if (!editing.value) return;
  const last = editing.value.tiers[editing.value.tiers.length - 1];
  const nextMin = last ? last.min * 2 : 10000;
  editing.value.tiers.push({ min: nextMin, price: last ? last.price : 0 });
  editing.value.cost_tiers.push({ min: nextMin, price: 0 });
}

function delTier(i) {
  if (!editing.value) return;
  editing.value.tiers.splice(i, 1);
  editing.value.cost_tiers.splice(i, 1);
}

async function saveProduct() {
  if (!editing.value) return;
  editTip.value = '';
  try {
    const j = await api(`/api/boost-admin/products/${editing.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing.value),
    });
    if (j.status !== 'success') { editTip.value = j.message || '保存失败'; return; }
    editing.value = null;
    await loadProducts();
  } catch { editTip.value = '网络异常'; }
}

async function toggleProduct(p) {
  try {
    if (p.active) {
      const ok = await ui.showConfirm(`下架「${p.name}」？\n已下单的订单不受影响，客户那边只是看不到这个商品。`, '确认下架');
      if (!ok) return;
      await api(`/api/boost-admin/products/${p.id}`, { method: 'DELETE' });
    } else {
      const j = await api(`/api/boost-admin/products/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      });
      if (j.status !== 'success') { ui.showToast(j.message || '操作失败', 'error'); return; }
    }
    await loadProducts();
  } catch { ui.showToast('网络异常', 'error'); }
}

async function doReprice() {
  const m = Number(repriceMultiplier.value);
  if (!Number.isFinite(m) || m <= 0) { ui.showToast('倍率必须是大于 0 的数字', 'error'); return; }
  const ok = await ui.showConfirm(
    `把所有商品的售价改成「成本 × ${m}」？\n\n注意：这会覆盖你手动改过的售价。`,
    '确认批量调价',
  );
  if (!ok) return;
  repricing.value = true;
  try {
    const j = await api('/api/boost-admin/products/reprice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ multiplier: m, basis: 'cost' }),
    });
    ui.showToast(j.message || (j.status === 'success' ? '调价完成' : '调价失败'), j.status === 'success' ? 'success' : 'error');
    if (j.status === 'success') await loadProducts();
  } catch { ui.showToast('网络异常', 'error'); }
  finally { repricing.value = false; }
}

async function saveSettings() {
  if (!settingsLoaded.value) { ui.showToast('配置还没读取成功，先点「重新读取」再保存', 'error'); return; }
  savingSettings.value = true;
  try {
    const j = await api('/api/boost-admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings.value),
    });
    if (j.status === 'success') {
      // 后端会顺手把 tg_url 算出来回传，回填一下让界面和库里一致
      if (j.data?.tg_url != null) settings.value.boost_tg_url = j.data.tg_url;
      ui.showToast('已保存，客户下单页立即生效');
    } else ui.showToast(j.message || '保存失败', 'error');
  } catch { ui.showToast('网络异常', 'error'); } finally { savingSettings.value = false; }
}

// ── 客服二维码：粘贴 / 拖拽 / 选文件 三种都行 ────────────────────────────────
const qrFile = ref(null);
const qrBox = ref(null);
const qrUploading = ref(false);
const qrTip = ref('');
const qrTipType = ref('ok');

const tgUrlPreview = computed(() => {
  const h = String(settings.value.boost_tg || '').trim()
    .replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '').replace(/\s+/g, '');
  return h ? 'https://t.me/' + h : '';
});

function tip(msg, type = 'ok') { qrTip.value = msg; qrTipType.value = type; if (msg) setTimeout(() => { qrTip.value = ''; }, 4000); }

async function uploadQr(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) return tip('这不是图片文件，请复制图片本身（不是图片地址）', 'error');
  if (file.size > 3 * 1024 * 1024) return tip('图片超过 3MB，压缩一下再传', 'error');
  qrUploading.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const j = await api('/api/boost-admin/upload', { method: 'POST', body: fd });
    if (j.status === 'success' && j.data?.url) {
      settings.value.boost_wechat_qr = j.data.url;   // 只是回填，点「保存」才写库
      tip('图片已上传，记得点下面的「保存」');
    } else tip(j.message || '上传失败', 'error');
  } catch (e) {
    tip('上传失败，检查网络后重试', 'error');
  } finally { qrUploading.value = false; }
}

function onQrPaste(e) {
  const items = e.clipboardData?.items || [];
  for (const it of items) {
    if (it.type && it.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) return uploadQr(f);
    }
  }
  tip('剪贴板里没有图片 —— 要先截图（Win+Shift+S），再回来 Ctrl+V', 'error');
}

function onQrFileChange(e) {
  const f = e.target.files?.[0];
  e.target.value = '';        // 允许重复选同一个文件
  uploadQr(f);
}

function onQrDrop(e) {
  const f = e.dataTransfer?.files?.[0];
  uploadQr(f);
}

onMounted(loadAll);
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
