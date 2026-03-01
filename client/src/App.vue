<template>
  <div id="app-root" class="relative min-h-screen">
    <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden"><div v-for="n in 20" :key="n" class="quantum-formula" :style="getQuantumStyle(n)">{{ getFormula() }}</div></div>
    
    <router-view class="relative z-10" />
    
    <div v-if="uiStore?.toast?.show" :class="['fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full font-bold shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-[10000] transition-all border border-white/10 backdrop-blur-md', uiStore.toast.type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white']">{{ uiStore.toast.message }}</div>
    
    <div v-if="uiStore?.modal?.show" class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div class="bg-slate-900/90 border border-slate-700 p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-sm w-full text-center relative overflow-hidden transform transition-all scale-100"><div class="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/20 rounded-full blur-[40px] pointer-events-none"></div><h3 class="text-xl font-black text-white mb-3 tracking-wider relative z-10">{{ uiStore.modal.title }}</h3><p class="text-slate-300 text-sm leading-relaxed mb-8 relative z-10">{{ uiStore.modal.message }}</p><div class="flex justify-center space-x-4 relative z-10"><button v-if="uiStore.modal.isConfirm" @click="uiStore.closeModal(false)" class="cursor-pointer px-6 py-2.5 rounded-xl font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-white transition">取消</button><button @click="uiStore.closeModal(true)" class="cursor-pointer px-8 py-2.5 rounded-xl font-black text-slate-900 bg-gradient-to-r from-amber-400 to-yellow-500 hover:scale-105 transition shadow-[0_0_15px_rgba(251,191,36,0.3)]">确认</button></div></div>
    </div>

    <div class="fixed bottom-6 right-6 z-[9999] flex flex-col items-center justify-end pointer-events-none" style="gap: 6px;">
      
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

      <a :href="appStore?.tgBotLink || 'https://t.me/Xnow001Bot'" target="_blank" class="pointer-events-auto relative group flex items-center justify-center w-14 h-14 mt-1" title="联系在线客服机器人">
        <div class="relative z-10 bg-gradient-to-tr from-blue-600 to-blue-400 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.6)] group-hover:scale-110 transition-transform duration-300">
          <svg viewBox="0 0 24 24" class="w-7 h-7 fill-white transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15.15-.31.3-.46.45-1.5 1.5-3 3-4.5 4.5-.15.15-.3.3-.45.46-.3.3-.6.6-.9.9-.15.15-.3.3-.46.45l-1.5 1.5c-.15.15-.31.3-.46.46-.15.15-.31.3-.46.45-.15.15-.31.3-.46.45-.15.15-.31.3-.46.46l-1.5 1.5c-.3.3-.6.6-.91.9-.15.15-.3.3-.45.45zM21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9zM12 4.5l-8.5 7.5L12 19.5l8.5-7.5L12 4.5z"/></svg>
          <span class="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-slate-900 animate-pulse">LIVE</span>
        </div>
        <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75 z-0"></div>
      </a>

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
.quantum-formula { position: absolute; color: rgba(251, 191, 36, 0.15); font-family: 'Courier New', Courier, monospace; font-weight: bold; user-select: none; animation: floatFormula linear infinite; filter: drop-shadow(0 0 5px rgba(251, 191, 36, 0.2)); } 
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
