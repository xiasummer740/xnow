<template>
  <div class="vpn-page h-[100dvh] w-full flex relative overflow-hidden">
    <div v-if="isSidebarOpen" @click="isSidebarOpen = false" class="fixed inset-0 bg-black/60 z-[9998] md:hidden backdrop-blur-sm transition-opacity"></div>

    <aside :class="['fixed md:relative z-[9999] md:z-50 h-full w-64 bg-slate-900/95 border-r border-slate-800 flex flex-col backdrop-blur-xl transition-transform duration-300 ease-in-out', isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0']">
      <div class="h-16 flex items-center px-4 md:px-6 border-b border-slate-800">
        <a href="/" class="flex items-center w-full hover:opacity-80 transition" title="返回首页">
          <span class="text-2xl font-black italic tracking-wider truncate bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-teal-400 to-cyan-500 drop-shadow-[0_0_10px_rgba(45,212,191,0.6)]">{{ appStore.siteName }} <span class="text-sm text-emerald-400">节点</span></span>
        </a>
        <button @click="isSidebarOpen = false" class="md:hidden text-slate-400 absolute right-4 bg-slate-800 p-1 rounded-md">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <div class="flex flex-col py-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
        <router-link to="/vpn" @click="handleNav('/vpn')" active-class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" class="text-slate-400 hover:text-white hover:bg-slate-800 font-bold px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
          <span>{{ appStore.t('vpn_menu_shop') || '选购节点' }}</span>
        </router-link>
        <router-link to="/vpn/clients" @click="handleNav('/vpn/clients')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          <span>{{ appStore.t('vpn_menu_clients') || '我的节点' }}</span>
        </router-link>
        <div class="h-px bg-slate-800 my-3"></div>
        <router-link to="/recharge" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
          <span>{{ appStore.t('menu_recharge') || '大佬充值' }}</span>
        </router-link>
        <router-link to="/vpn/admin" v-if="['admin', 'super_admin'].includes(userStore.userInfo?.role)" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer">
          <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          <span class="text-red-400 font-medium">{{ appStore.lang === 'zh' ? '管理密室' : 'Admin' }}</span>
        </router-link>
        <router-link to="/order" class="text-slate-500 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer text-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          <span>{{ appStore.lang === 'zh' ? '返回涨粉服务' : 'Back to SMM' }}</span>
        </router-link>
      </div>
    </aside>

    <div class="flex-grow flex flex-col min-w-0 md:ml-0 h-[100dvh] relative z-10">
      <header class="fixed top-0 left-0 right-0 md:relative md:top-auto md:left-auto md:right-auto h-16 flex-shrink-0 bg-slate-900/60 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-3 md:px-6 z-[60] w-full md:w-auto shadow-sm">
        <div class="flex items-center space-x-1 text-slate-300">
          <button @click="isSidebarOpen = true" class="md:hidden p-1 mr-1"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg></button>
          <span class="font-bold hidden sm:block text-slate-100 tracking-widest text-sm">{{ appStore.t('vpn_console_title') || '安全节点控制台' }}</span>
        </div>
        <div class="flex items-center space-x-2 md:space-x-5 text-sm">
          <div @click="appStore.toggleCurrency" class="hidden sm:flex bg-slate-800 border border-slate-700 rounded-full p-0.5 cursor-pointer text-xs transition hover:border-emerald-400 select-none">
            <span :class="['px-2 py-0.5 rounded-full font-bold transition', appStore.currency === 'CNY' ? 'bg-emerald-500 text-black' : 'text-slate-400']">CNY</span>
            <span :class="['px-2 py-0.5 rounded-full font-bold transition', appStore.currency === 'USD' ? 'bg-emerald-500 text-black' : 'text-slate-400']">USD</span>
          </div>
          <div class="flex items-center"><span class="text-slate-400 hidden sm:inline text-xs mr-1">{{ appStore.t('balance') }}</span><span class="text-emerald-400 font-mono font-black text-sm md:text-base drop-shadow-[0_0_8px_rgba(45,212,191,0.3)]">{{ appStore.formatMoney(userStore.userInfo?.balance) }}</span></div>
          <div class="flex items-center space-x-1.5 md:space-x-3 text-slate-300">
            <span class="hidden lg:inline text-slate-400 text-xs">UID: {{ userStore.userInfo?.id || '--' }}</span>
            <span class="font-bold text-[10px] md:text-xs max-w-[80px] md:max-w-none truncate">{{ userStore.userInfo?.phone || '未登录' }}</span>
          </div>
          <button @click="appStore.toggleLang" class="text-slate-400 hover:text-white font-bold transition text-xs md:text-sm select-none w-6">{{ appStore.lang === 'zh' ? 'EN' : '中' }}</button>
          <button @click="handleLogout" class="text-slate-400 hover:text-amber-400 transition pl-1 focus:outline-none flex items-center h-full" title="退出">
            <svg class="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          </button>
        </div>
      </header>
      <main class="flex-grow p-4 pt-20 md:pt-6 md:p-6 overflow-y-auto relative z-[50] custom-scrollbar scroll-smooth">
        <div v-if="!shopEnabled" class="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <div class="text-6xl">🔧</div>
          <h2 class="text-2xl font-black text-white">{{ appStore.lang === 'zh' ? '商城维护中' : 'Under Maintenance' }}</h2>
          <p class="text-slate-500 max-w-md">{{ appStore.lang === 'zh' ? '节点商城暂时关闭，请稍后再来。如有疑问请联系管理员。' : 'The VPN shop is temporarily closed. Please check back later.' }}</p>
          <router-link to="/order" class="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition">{{ appStore.lang === 'zh' ? '返回涨粉服务' : 'Back to SMM' }}</router-link>
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
