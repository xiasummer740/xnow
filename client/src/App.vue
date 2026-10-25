<template>
  <div id="app-root" class="relative min-h-screen bg-[#060b18]">
    <!-- 🧹 分站：关掉主站招牌的飘动公式背景（那是 XNOW 的视觉标识，分站不能有）--><div v-if="!appStore?.isSubsite" class="fixed inset-0 pointer-events-none z-0 overflow-hidden"><div v-for="n in 30" :key="n" class="quantum-formula" :style="getQuantumStyle(n)">{{ getFormula() }}</div></div>
    
    <!-- 📱 98 期：右下角悬浮客服/互动按钮会压住页面最后一屏的内容
         （实测 neon 模板下把「服务用户」数据卡和底部说明压掉一半）。
         分站会显示悬浮按钮时，给页面底部留出让位空间。 -->
    <router-view class="relative z-10"
                 :class="appStore?.isSubsite && appStore?.supportUrl ? 'pb-28' : ''" />
    
    <!-- 🔔 Toast：右上角堆叠，不挡操作 -->
    <div class="fixed top-3 right-3 z-[10050] flex flex-col items-end gap-2 pointer-events-none">
      <transition-group name="x-toast">
        <div v-for="t in uiStore?.toasts || []" :key="t.id"
             class="pointer-events-auto flex items-start gap-2.5 max-w-[86vw] sm:max-w-sm px-3.5 py-2.5 rounded-2xl border shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-md"
             :class="{
               'bg-emerald-500/15 border-emerald-400/40 text-emerald-100': t.type === 'success',
               'bg-red-500/15 border-red-400/40 text-red-100': t.type === 'error',
               'bg-amber-500/15 border-amber-400/40 text-amber-100': t.type === 'warning',
               'bg-slate-800/85 border-slate-600/60 text-slate-100': t.type === 'info'
             }">
          <span class="text-base leading-5 shrink-0">
            {{ t.type === 'success' ? '✅' : t.type === 'error' ? '⚠️' : t.type === 'warning' ? '🔔' : '💬' }}
          </span>
          <span class="text-[13px] font-bold leading-5 break-words">{{ t.message }}</span>
          <button class="ml-1 shrink-0 text-[13px] opacity-50 hover:opacity-100" @click="uiStore.dismissToast(t.id)">✕</button>
        </div>
      </transition-group>
    </div>

    <!-- 💬 弹窗：alert / confirm / prompt 共用一套，替代系统原生弹窗 -->
    <transition name="x-modal">
      <div v-if="uiStore?.modal?.show"
           class="fixed inset-0 z-[10060] flex items-end sm:items-center justify-center bg-[#03060f]/70 backdrop-blur-[6px] p-3 sm:p-4"
           @click.self="uiStore.closeModal(false)">
        <div class="w-full sm:max-w-[420px] rounded-[22px] overflow-hidden relative
                    bg-gradient-to-b from-[#141d33] to-[#0b1222] border border-slate-700/70
                    shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
          <!-- 顶部光晕：危险=红，普通=金 -->
          <div class="absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-32 rounded-full blur-[46px] pointer-events-none"
               :class="uiStore.modal.danger ? 'bg-red-500/25' : 'bg-amber-500/20'"></div>

          <div class="relative px-5 pt-6 pb-4">
            <div class="flex items-start gap-3">
              <div class="w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-xl
                          border"
                   :class="uiStore.modal.danger
                     ? 'bg-red-500/15 border-red-500/40'
                     : 'bg-amber-400/15 border-amber-400/40'">
                {{ uiStore.modal.icon || (uiStore.modal.danger ? '⚠️' : '💬') }}
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-[15px] font-black text-white leading-6">{{ uiStore.modal.title }}</h3>
                <p v-if="uiStore.modal.message"
                   class="mt-1.5 text-[13px] leading-6 text-slate-300 whitespace-pre-line break-words">{{ uiStore.modal.message }}</p>
              </div>
            </div>

            <div v-if="uiStore.modal.kind === 'prompt'" class="mt-4">
              <input v-model="uiStore.modal.input"
                     :placeholder="uiStore.modal.placeholder"
                     class="w-full bg-[#0a1120] border border-slate-700 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20
                            rounded-xl px-3.5 py-2.5 text-[14px] text-slate-100 outline-none transition"
                     @keyup.enter="uiStore.closeModal(true)" />
            </div>
          </div>

          <div class="relative px-5 pb-5 pt-1 flex items-center gap-2">
            <button v-if="uiStore.modal.kind !== 'alert'"
                    class="flex-1 h-11 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-[13px] font-bold transition"
                    @click="uiStore.closeModal(false)">
              {{ uiStore.modal.cancelText }}
            </button>
            <button class="flex-1 h-11 rounded-xl text-[13px] font-black transition active:scale-[0.98]"
                    :class="uiStore.modal.danger
                      ? 'bg-red-500 hover:bg-red-400 text-white'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-900'"
                    @click="uiStore.closeModal(true)">
              {{ uiStore.modal.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 🏬 分站：站长没填客服链接就整块不显示。
         否则这里会挂平台自己的 Telegram 机器人（t.me/Xnow001Bot），
         客户点进去直接进了平台的群 —— 等于当面告诉客户"这店是二道贩子"。 -->
    <div v-if="!appStore?.isSubsite || appStore.supportUrl" class="fixed bottom-6 right-6 z-[9999] flex flex-col items-center justify-end pointer-events-none" style="gap: 6px;">
      
      <div class="x-3d-character-stage pointer-events-auto cursor-pointer" @click="doRandomAction" title="戳我互动呀~">
        <div class="x-character" :class="currentAction">
          <div class="head">
            <div class="face">
              <div class="eyes"></div>
              <div class="blush"></div>
              <div class="mouth"></div>
            </div>
            <div class="ear left"></div>
            <div class="ear right"></div>
            <div class="hair"></div>
          </div>
        </div>
      </div>

      <div class="anime-arrow-container flex justify-center items-center">
        <svg viewBox="0 0 100 100" class="anime-arrow">
          <path d="M50,10 C30,30 30,70 50,90" fill="none" stroke="#fbbf24" stroke-width="6" stroke-linecap="round" stroke-dasharray="10 6"/>
          <path d="M40,80 L50,90 L60,80" fill="none" stroke="#fbbf24" stroke-width="6" stroke-linecap="round"/>
        </svg>
      </div>

      <!-- 🏬 分站：只认站长自己填的客服链接。没填就整个按钮不出现 ——
           以前会兜底到平台的机器人，等于直接把客户送到主站去。
           92 期：连平台机器人地址这段字符串也从前端删掉了（后台配置里配好才有）。 -->
      <a v-if="appStore?.isSubsite ? !!appStore?.supportUrl : !!appStore?.tgBotLink"
         :href="appStore?.isSubsite ? appStore.supportUrl : appStore.tgBotLink" target="_blank" class="pointer-events-auto relative group flex items-center justify-center w-14 h-14 mt-1" title="联系在线客服">
        <div class="relative z-10 bg-gradient-to-tr from-blue-600 to-blue-400 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.6)] group-hover:scale-110 transition-transform duration-300">
          <svg viewBox="0 0 24 24" class="w-7 h-7 fill-white transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15.15-.31.3-.46.45-1.5 1.5-3 3-4.5 4.5-.15.15-.3.3-.45.46-.3.3-.6.6-.9.9-.15.15-.3.3-.46.45l-1.5 1.5c-.15.15-.31.3-.46.46-.15.15-.31.3-.46.45-.15.15-.31.3-.46.45-.15.15-.31.3-.46.46l-1.5 1.5c-.3.3-.6.6-.91.9-.15.15-.3.3-.45.45zM21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9zM12 4.5l-8.5 7.5L12 19.5l8.5-7.5L12 4.5z"/></svg>
          <span class="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-slate-900 animate-pulse">LIVE</span>
        </div>
        <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75 z-0"></div>
      </a>

    </div>

    <!-- 🎨 分站页脚：只有分站配置了 footer_text 才出现，主站保持原样 -->
    <div v-if="appStore.footerText" class="site-footer relative z-10">
      {{ appStore.footerText }}
      <template v-if="appStore.supportUrl">
        · <a :href="appStore.supportUrl" target="_blank" rel="noopener noreferrer">联系客服</a>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useUiStore } from './stores/ui';
import { useAppStore } from './stores/app';

const uiStore = useUiStore();
const appStore = useAppStore();

const formulas = ['E=mc²', 'iℏ∂ψ/∂t=Hψ', '∇×E=-∂B/∂t', 'S=k·logW', 'F=ma', 'e^(iπ)+1=0', 'ΔxΔp≥ℏ/2', 'G_μν+Λg_μν=(8πG/c^4)T_μν'];
const getFormula = () => formulas[Math.floor(Math.random() * formulas.length)];
const getQuantumStyle = (n) => { const top = Math.random() * 100; const left = Math.random() * 100; const size = 0.5 + Math.random() * 1; const duration = 15 + Math.random() * 20; const delay = Math.random() * -20; return `top: ${top}%; left: ${left}%; font-size: ${size}rem; animation-duration: ${duration}s; animation-delay: ${delay}s;`; };

// 💡 交互动作逻辑
const currentAction = ref('');
const actions = ['action-spin', 'action-bounce', 'action-nod', 'action-shake'];
let actionTimeout;

const doRandomAction = () => {
  if (actionTimeout) clearTimeout(actionTimeout);
  const nextAction = actions[Math.floor(Math.random() * actions.length)];
  currentAction.value = nextAction;
  actionTimeout = setTimeout(() => {
    currentAction.value = '';
  }, 1000);
};
</script>

<style>
/* 保持原有背景量子特效 */
.quantum-formula { position: absolute; color: rgba(251, 191, 36, 0.25); font-family: 'Courier New', Courier, monospace; font-weight: bold; user-select: none; animation: floatFormula linear infinite; filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.4)); } 
@keyframes floatFormula { 0% { transform: translateY(100vh) rotate(0deg) scale(0.8); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(-100vh) rotate(360deg) scale(1.2); opacity: 0; } } 
.animate-fade-in { animation: fadeIn 0.2s ease-out forwards; } 
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* ========================================================= */
/* 💡 3D 卡通小人与箭头专属 CSS */
/* ========================================================= */

.x-3d-character-stage {
  width: 60px;
  height: 60px;
  perspective: 1000px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.x-character {
  width: 44px;
  height: 44px;
  transform-style: preserve-3d;
  transition: transform 0.3s ease;
  position: relative;
  animation: idleFloat 3s ease-in-out infinite;
}

/* 默认态：浮动 */
@keyframes idleFloat {
  0%, 100% { transform: translateY(0) rotateY(10deg); }
  50% { transform: translateY(-5px) rotateY(-10deg); }
}

/* 3D 头部构造 */
.x-character .head {
  position: absolute;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 30% 30%, #ffdbac, #f1c27d);
  border-radius: 50%;
  box-shadow: inset -4px -4px 10px rgba(0,0,0,0.2), 0 5px 15px rgba(241,194,125,0.4);
  transform-style: preserve-3d;
}

/* 五官面板 */
.x-character .face {
  position: absolute;
  width: 100%;
  height: 100%;
  transform: translateZ(22px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  pointer-events: none; /* 防止挡住点击 */
}

/* 眼睛 */
.x-character .eyes {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}
.x-character .eyes::before, .x-character .eyes::after {
  content: '';
  width: 6px;
  height: 8px;
  background: #2d3748;
  border-radius: 50%;
}

/* 腮红 */
.x-character .blush {
  position: absolute;
  width: 30px;
  height: 10px;
  top: 22px;
  display: flex;
  justify-content: space-between;
}
.x-character .blush::before, .x-character .blush::after {
  content: '';
  width: 8px;
  height: 4px;
  background: rgba(244, 114, 182, 0.6);
  border-radius: 50%;
  filter: blur(1px);
}

/* 嘴巴 */
.x-character .mouth {
  width: 10px;
  height: 6px;
  border: 2px solid #2d3748;
  border-top: none;
  border-radius: 0 0 10px 10px;
  margin-top: 2px;
}

/* 耳朵 */
.x-character .ear {
  position: absolute;
  width: 12px;
  height: 14px;
  background: #f1c27d;
  border-radius: 50%;
  top: 15px;
}
.x-character .ear.left { left: -6px; transform: translateZ(5px) rotateY(-20deg); }
.x-character .ear.right { right: -6px; transform: translateZ(5px) rotateY(20deg); }

/* 交互动作 CSS 动画 */
.action-spin { animation: spin 0.8s ease-out !important; }
.action-bounce { animation: bounce 0.8s ease-out !important; }
.action-nod { animation: nod 0.8s ease-out !important; }
.action-shake { animation: shake 0.8s ease-out !important; }

@keyframes spin { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(360deg); } }
@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px) scale(1.1); } }
@keyframes nod { 0%, 100% { transform: rotateX(0deg); } 50% { transform: rotateX(40deg); } }
@keyframes shake { 0%, 100% { transform: rotateZ(0deg); } 25% { transform: rotateZ(20deg); } 75% { transform: rotateZ(-20deg); } }

/* 二次元箭头容器 */
.anime-arrow-container {
  width: 24px;
  height: 36px;
  animation: arrowFloat 1.5s ease-in-out infinite;
  filter: drop-shadow(0 0 6px rgba(251,191,36,0.6));
}

@keyframes arrowFloat {
  0%, 100% { transform: translateY(0); opacity: 0.8; }
  50% { transform: translateY(6px); opacity: 1; }
}

.anime-arrow {
  width: 100%;
  height: 100%;
  transform: rotate(5deg);
}
</style>

<style>
.x-toast-enter-active, .x-toast-leave-active { transition: all .22s ease; }
.x-toast-enter-from { opacity: 0; transform: translateY(-8px) scale(.96); }
.x-toast-leave-to { opacity: 0; transform: translateX(12px); }
.x-modal-enter-active, .x-modal-leave-active { transition: opacity .18s ease; }
.x-modal-enter-from, .x-modal-leave-to { opacity: 0; }
.x-modal-enter-active > div, .x-modal-leave-active > div { transition: transform .2s cubic-bezier(.2,.9,.3,1.2); }
.x-modal-enter-from > div, .x-modal-leave-to > div { transform: translateY(14px) scale(.97); }
@media (min-width: 640px) {
  .x-modal-enter-from > div, .x-modal-leave-to > div { transform: scale(.96); }
}
</style>
