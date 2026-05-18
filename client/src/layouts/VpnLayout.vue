<template>
  <div class="h-[100dvh] w-full flex bg-[#060b18] relative overflow-hidden">
    <div v-if="isSidebarOpen" @click="isSidebarOpen = false" class="fixed inset-0 bg-black/60 z-[9998] md:hidden backdrop-blur-sm transition-opacity"></div>

    <aside :class="['fixed md:relative z-[9999] md:z-50 h-full w-60 bg-slate-900/95 border-r border-slate-800 flex flex-col backdrop-blur-xl transition-transform duration-300 ease-in-out', isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0']">
      <div class="h-16 flex items-center px-5 border-b border-slate-800">
        <a href="/" class="flex items-center w-full hover:opacity-80 transition" title="返回首页">
          <span class="text-lg font-black tracking-wide bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">{{ appStore.siteName }} 节点</span>
        </a>
        <button @click="isSidebarOpen = false" class="md:hidden text-slate-400 hover:text-white ml-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>

      <div class="flex flex-col py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        <p class="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">节点</p>
        <router-link to="/vpn" @click="handleNav('/vpn')" class="nav-item" active-class="nav-active-vpn"><svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg><span>{{ appStore.t('vpn_menu_shop') || '选购节点' }}</span></router-link>
        <router-link to="/vpn/clients" @click="handleNav('/vpn/clients')" class="nav-item" active-class="nav-active-vpn"><svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg><span>{{ appStore.t('vpn_menu_clients') || '我的节点' }}</span></router-link>

        <template v-if="['admin', 'super_admin'].includes(userStore.userInfo?.role)">
          <p class="px-3 pt-4 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">管理</p>
          <router-link to="/vpn/admin" class="nav-item" active-class="nav-active-vpn"><svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg><span>节点管理</span></router-link>
        </template>

        <div class="h-px bg-slate-800 my-2"></div>
        <router-link to="/recharge" class="nav-item"><svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg><span>{{ appStore.t('menu_recharge') || '大佬充值' }}</span></router-link>
        <router-link to="/order" class="nav-item"><svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg><span>{{ appStore.lang === 'zh' ? '返回涨粉服务' : 'Back to SMM' }}</span></router-link>
      </div>
    </aside>

    <div class="flex-grow flex flex-col min-w-0 md:ml-0 h-[100dvh] relative z-10">
      <header class="fixed top-0 left-0 right-0 md:relative md:top-auto md:left-auto md:right-auto h-16 flex-shrink-0 bg-slate-900/60 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-3 md:px-6 z-[60] w-full md:w-auto shadow-sm">
        <div class="flex items-center space-x-1 text-slate-300">
          <button @click="isSidebarOpen = true" class="md:hidden p-1 mr-1"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg></button>
          <span class="font-bold hidden sm:block text-slate-100 tracking-widest text-sm">{{ appStore.t('vpn_console_title') || '安全节点控制台' }}</span>
        </div>
        <div class="flex items-center space-x-2 md:space-x-5 text-sm">
          <div class="flex items-center"><span class="text-slate-400 hidden sm:inline text-xs mr-1">{{ appStore.t('balance') }}</span><span class="text-emerald-400 font-mono font-black text-sm">{{ appStore.formatMoney(userStore.userInfo?.balance) }}</span></div>
          <span class="text-slate-400 text-xs hidden sm:inline">{{ userStore.userInfo?.phone || '' }}</span>
          <button @click="appStore.toggleLang" class="text-slate-400 hover:text-white font-bold text-xs select-none w-6">{{ appStore.lang === 'zh' ? 'EN' : '中' }}</button>
          <button @click="handleLogout" class="text-slate-400 hover:text-red-400 transition text-xs font-bold">退出</button>
        </div>
      </header>

      <main class="flex-grow p-4 pt-20 md:pt-6 md:p-6 overflow-y-auto relative z-[50] custom-scrollbar scroll-smooth">
        <div v-if="!shopEnabled" class="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div class="text-5xl mb-4">🔧</div>
          <h2 class="text-2xl font-black text-white mb-2">{{ appStore.lang === 'zh' ? '商城维护中' : 'Under Maintenance' }}</h2>
          <p class="text-slate-400 max-w-sm mb-6">{{ appStore.lang === 'zh' ? '节点商城暂时关闭，请稍后再来。' : 'VPN shop temporarily closed.' }}</p>
          <router-link to="/order" class="bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold px-6 py-3 rounded-xl transition">{{ appStore.lang === 'zh' ? '返回涨粉服务' : 'Back to SMM' }}</router-link>
        </div>
        <router-view v-else :key="$route.fullPath" />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAppStore } from '../stores/app';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui';
import { useRoute } from 'vue-router';

const appStore = useAppStore(); const userStore = useUserStore(); const uiStore = useUiStore();
const route = useRoute(); const isSidebarOpen = ref(false);
const shopEnabled = ref(true);

const handleNav = (path) => { isSidebarOpen.value = false; if (route.path === path) appStore.triggerRefresh(); };
onMounted(async () => {
  try { const r = await fetch('/api/vpn/status'); const d = await r.json(); shopEnabled.value = d.enabled; } catch (e) {}
});
const handleLogout = async () => {
  if (await uiStore.showConfirm(appStore.lang === 'zh' ? '确定要安全退出当前账号吗？' : 'Are you sure you want to logout?')) {
    userStore.logout(); window.location.href = '/';
  }
};
</script>

<style>
.nav-item { @apply flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/70 transition-all duration-200; }
.nav-active-vpn { @apply bg-emerald-400/15 text-emerald-400 border border-emerald-400/30 shadow-sm; }
.nav-icon { @apply w-4 h-4 flex-shrink-0; }
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.15); border-radius: 4px; }
</style>
