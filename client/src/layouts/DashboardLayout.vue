<template>
  <div class="min-h-screen flex bg-transparent relative z-10 overflow-hidden">
    <div v-if="isSidebarOpen" @click="isSidebarOpen = false" class="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"></div>
    <aside :class="['fixed md:relative z-50 h-full w-64 bg-slate-900/95 border-r border-slate-800 flex flex-col backdrop-blur-xl transition-transform duration-300 ease-in-out', isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0']">
      <div class="h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-800 relative"><a href="/" class="flex items-center w-full hover:opacity-80 transition" title="返回首页"><img :src="appStore.siteLogo || '/logo.png'" onerror="this.onerror=null; this.src='/logo.png';" class="max-h-10 max-w-[50px] object-contain mr-3" alt="Logo"><span class="text-2xl font-black italic tracking-wider truncate bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-600 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">{{ appStore.siteName }}</span></a><button @click="isSidebarOpen = false" class="md:hidden text-slate-400 absolute right-4 bg-slate-800 p-1 rounded-md"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>
      <div class="flex flex-col py-6 px-4 space-y-2 overflow-y-auto">
        <router-link to="/order" @click="handleNav('/order')" active-class="bg-amber-400 text-slate-900 shadow-[0_0_15px_rgba(251,191,36,0.2)]" class="text-slate-400 hover:text-white hover:bg-slate-800 font-bold px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg><span>{{ appStore.t('menu_order') }}</span></router-link>
        <router-link to="/mass-order" @click="handleNav('/mass-order')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg><span>{{ appStore.t('menu_mass') }}</span></router-link>
        <router-link to="/history" @click="handleNav('/history')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span>{{ appStore.t('menu_history') }}</span></router-link>
        <router-link to="/recharge" @click="handleNav('/recharge')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg><span>{{ appStore.t('menu_recharge') }}</span></router-link>
        <router-link to="/vip" @click="handleNav('/vip')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg><span class="text-amber-500 font-medium">{{ appStore.t('menu_vip') }}</span></router-link>
        <router-link to="/api-doc" v-if="['admin', 'super_admin', 'agent'].includes(userStore.userInfo?.role)" @click="handleNav('/api-doc')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg><span class="text-blue-400 font-bold">{{ appStore.t('menu_api') || '开发者 API' }}</span></router-link>
        <router-link to="/admin" v-if="['admin', 'super_admin'].includes(userStore.userInfo?.role)" @click="handleNav('/admin')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg><span class="text-red-500 font-medium">{{ appStore.t('menu_admin') }}</span></router-link>
      </div>
    </aside>
    <div class="flex-grow flex flex-col min-w-0 md:ml-0 h-screen">
      <header class="h-16 flex-shrink-0 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between px-3 md:px-6 backdrop-blur-sm">
        <div class="flex items-center space-x-1 text-slate-300"><button @click="isSidebarOpen = true" class="md:hidden p-1 mr-1"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg></button><span class="font-bold hidden sm:block text-slate-100 tracking-widest text-sm">{{ appStore.t('console') }}</span></div>
        <div class="flex items-center space-x-3 md:space-x-5 text-sm">
          <div @click="appStore.toggleCurrency" class="hidden sm:flex bg-slate-800 border border-slate-700 rounded-full p-0.5 cursor-pointer text-xs transition hover:border-amber-400 select-none"><span :class="['px-2 py-0.5 rounded-full font-bold transition', appStore.currency === 'CNY' ? 'bg-amber-400 text-black' : 'text-slate-400']">CNY</span><span :class="['px-2 py-0.5 rounded-full font-bold transition', appStore.currency === 'USD' ? 'bg-amber-400 text-black' : 'text-slate-400']">USD</span></div>
          <div class="flex items-center"><span class="text-slate-400 hidden sm:inline text-xs mr-1">{{ appStore.t('balance') }}</span><span class="text-amber-400 font-mono font-black text-sm md:text-base drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">{{ appStore.formatMoney(userStore.userInfo?.balance) }}</span></div>
          <div class="flex items-center space-x-1.5 md:space-x-3 text-slate-300">
            <span class="hidden lg:inline text-slate-400 text-xs">UID: {{ userStore.userInfo?.id || '--' }}</span>
            <span class="hidden md:inline font-bold text-xs">{{ userStore.userInfo?.phone || '未登录' }}</span>
            
            <span v-if="userStore.userInfo?.role === 'super_admin'" class="x-badge badge-super"><span class="badge-shimmer"></span>{{ appStore.t('super_admin_badge') }}</span>
            <span v-else-if="userStore.userInfo?.role === 'admin'" class="x-badge badge-admin"><span class="badge-shimmer"></span>{{ appStore.t('admin_badge') }}</span>
            <span v-else-if="userStore.userInfo?.role === 'agent'" class="x-badge badge-agent"><span class="badge-shimmer"></span>{{ appStore.t('agent_badge') }}</span>
            <span v-else class="x-badge badge-gold"><span class="badge-shimmer"></span>{{ appStore.t('gold_badge') }}</span>
          </div>
          <button @click="appStore.toggleLang" class="text-slate-400 hover:text-white font-bold transition text-xs md:text-sm select-none w-6">{{ appStore.lang === 'zh' ? 'EN' : '中' }}</button>
          <button @click="handleLogout" class="text-slate-400 hover:text-red-400 transition pl-1" :title="appStore.t('logout')"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg></button>
        </div>
      </header>
      <main class="flex-grow p-4 md:p-6 overflow-auto relative"><router-view :key="$route.fullPath" /></main>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '../stores/user'; import { useAppStore } from '../stores/app'; import { useUiStore } from '../stores/ui';
import { useRoute } from 'vue-router';
const userStore = useUserStore(); const appStore = useAppStore(); const uiStore = useUiStore();
const route = useRoute(); const isSidebarOpen = ref(false);
const handleNav = (path) => { isSidebarOpen.value = false; if (route.path === path) appStore.triggerRefresh(); };
const handleLogout = async () => { if (await uiStore.showConfirm(appStore.lang === 'zh' ? '确定要退出当前账号吗？' : 'Are you sure you want to logout?')) { userStore.logout(); window.location.href = '/'; } };
const syncUserStatus = async () => { if (!userStore.token || userStore.token === 'super-admin-offline-token') return;
try { const res = await fetch(`/api/user/status?_t=${Date.now()}`, { headers: { 'Authorization': `Bearer ${userStore.token}` } }); const data = await res.json();
if (data.status === 'success') { userStore.updateUserInfo({ balance: data.balance, role: data.role, vip_expire_at: data.vip_expire_at, api_key: data.api_key });
} } catch (e) {} };
onMounted(() => { appStore.fetchConfig(); syncUserStatus(); });
</script>
