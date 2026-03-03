<template>
  <div class="h-[100dvh] w-full flex bg-slate-950 relative overflow-hidden">
    <div v-if="isSidebarOpen" @click="isSidebarOpen = false" class="fixed inset-0 bg-black/60 z-[9998] md:hidden backdrop-blur-sm transition-opacity"></div>
    
    <aside :class="['fixed md:relative z-[9999] md:z-50 h-full w-64 bg-slate-900/95 border-r border-slate-800 flex flex-col backdrop-blur-xl transition-transform duration-300 ease-in-out', isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0']">
      <div class="h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-800 relative"><a href="/" class="flex items-center w-full hover:opacity-80 transition" title="返回首页"><img :src="appStore.siteLogo || '/logo.png'" onerror="this.onerror=null; this.src='/logo.png';" class="max-h-10 max-w-[50px] object-contain mr-3" alt="Logo"><span class="text-2xl font-black italic tracking-wider truncate bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-600 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">{{ appStore.siteName }}</span></a><button @click="isSidebarOpen = false" class="md:hidden text-slate-400 absolute right-4 bg-slate-800 p-1 rounded-md"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>
      <div class="flex flex-col py-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
        <router-link to="/order" @click="handleNav('/order')" active-class="bg-amber-400 text-slate-900 shadow-[0_0_15px_rgba(251,191,36,0.2)]" class="text-slate-400 hover:text-white hover:bg-slate-800 font-bold px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg><span>{{ appStore.t('menu_order') }}</span></router-link>
        <router-link to="/mass-order" @click="handleNav('/mass-order')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg><span>{{ appStore.t('menu_mass') }}</span></router-link>
        <router-link to="/history" @click="handleNav('/history')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span>{{ appStore.t('menu_history') }}</span></router-link>
        
        <router-link to="/affiliate" @click="handleNav('/affiliate')" active-class="bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]" class="text-slate-400 hover:text-white hover:bg-slate-800 font-bold px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer group"><span class="text-xl group-hover:scale-125 transition-transform drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]">🔥</span><span class="text-orange-400 font-black tracking-widest">{{ appStore.lang === 'zh' ? '推广赚钱' : 'Affiliate' }}</span></router-link>
        
        <router-link to="/recharge" @click="handleNav('/recharge')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg><span>{{ appStore.t('menu_recharge') }}</span></router-link>
        <router-link to="/vip" @click="handleNav('/vip')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg><span class="text-amber-500 font-medium">{{ appStore.t('menu_vip') }}</span></router-link>
        <router-link to="/api-doc" v-if="['admin', 'super_admin', 'agent'].includes(userStore.userInfo?.role)" @click="handleNav('/api-doc')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg><span class="text-blue-400 font-bold">{{ appStore.t('menu_api') || '开发者 API' }}</span></router-link>
        
        <router-link to="/admin/backup" v-if="['admin', 'super_admin'].includes(userStore.userInfo?.role)" @click="handleNav('/admin/backup')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg><span class="text-emerald-400 font-bold">{{ appStore.t('menu_backup') || '数据灾备中心' }}</span></router-link>
        
        <router-link to="/admin" v-if="['admin', 'super_admin'].includes(userStore.userInfo?.role)" @click="handleNav('/admin')" active-class="bg-slate-800 text-white" class="text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center space-x-3 transition cursor-pointer"><svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg><span class="text-red-500 font-medium">{{ appStore.t('menu_admin') }}</span></router-link>
      </div>
    </aside>
    
    <div class="flex-grow flex flex-col min-w-0 md:ml-0 h-[100dvh] relative z-10">
      
      <header class="fixed top-0 left-0 right-0 md:relative md:top-auto md:left-auto md:right-auto h-16 flex-shrink-0 bg-slate-900/60 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-3 md:px-6 z-[60] w-full md:w-auto shadow-sm">
        <div class="flex items-center space-x-1 text-slate-300"><button @click="isSidebarOpen = true" class="md:hidden p-1 mr-1"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg></button><span class="font-bold hidden sm:block text-slate-100 tracking-widest text-sm">{{ appStore.t('console') }}</span></div>
        <div class="flex items-center space-x-2 md:space-x-5 text-sm">
          <div @click="appStore.toggleCurrency" class="hidden sm:flex bg-slate-800 border border-slate-700 rounded-full p-0.5 cursor-pointer text-xs transition hover:border-amber-400 select-none"><span :class="['px-2 py-0.5 rounded-full font-bold transition', appStore.currency === 'CNY' ? 'bg-amber-400 text-black' : 'text-slate-400']">CNY</span><span :class="['px-2 py-0.5 rounded-full font-bold transition', appStore.currency === 'USD' ? 'bg-amber-400 text-black' : 'text-slate-400']">USD</span></div>
          <div class="flex items-center"><span class="text-slate-400 hidden sm:inline text-xs mr-1">{{ appStore.t('balance') }}</span><span class="text-amber-400 font-mono font-black text-sm md:text-base drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">{{ appStore.formatMoney(userStore.userInfo?.balance) }}</span></div>
          
          <div class="flex items-center space-x-1.5 md:space-x-3 text-slate-300">
            <span class="hidden lg:inline text-slate-400 text-xs">UID: {{ userStore.userInfo?.id || '--' }}</span>
            <span class="font-bold text-[10px] md:text-xs max-w-[80px] md:max-w-none truncate">{{ userStore.userInfo?.phone || '未登录' }}</span>
            
            <span v-if="userStore.userInfo?.role === 'super_admin'" class="x-badge badge-super hidden sm:inline-flex"><span class="badge-shimmer"></span>{{ appStore.t('super_admin_badge') || '至尊管理员' }}</span>
            <span v-else-if="userStore.userInfo?.role === 'admin'" class="x-badge badge-admin hidden sm:inline-flex"><span class="badge-shimmer"></span>{{ appStore.t('admin_badge') || '管理员' }}</span>
            <span v-else-if="userStore.userInfo?.role === 'agent'" class="x-badge badge-agent hidden sm:inline-flex"><span class="badge-shimmer"></span>{{ appStore.t('agent_badge') || '代理' }}</span>
            <span v-else class="x-badge badge-gold hidden sm:inline-flex"><span class="badge-shimmer"></span>{{ appStore.t('gold_badge') || '黄金用户' }}</span>
          </div>

          <button @click="appStore.toggleLang" class="text-slate-400 hover:text-white font-bold transition text-xs md:text-sm select-none w-6">{{ appStore.lang === 'zh' ? 'EN' : '中' }}</button>
          
          <div class="relative flex items-center">
            <div v-if="isProfileMenuOpen" @click="isProfileMenuOpen = false" class="fixed inset-0 z-[90]"></div>
            <button @click="isProfileMenuOpen = !isProfileMenuOpen" class="text-slate-400 hover:text-white transition pl-1 focus:outline-none flex items-center h-full relative z-[95]" title="设置/退出">
              <svg class="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </button>
            <div v-show="isProfileMenuOpen" class="absolute right-0 top-full mt-2 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-fade-in z-[100] py-1">
               <button @click="openProfileModal" class="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition flex items-center space-x-2"><span class="text-blue-400">⚙️</span><span>修改资料</span></button>
               <button v-if="!['admin', 'super_admin'].includes(userStore.userInfo?.role)" @click="openDeleteModal" class="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-red-400 hover:bg-red-500/10 transition flex items-center space-x-2"><span class="text-red-400">⚠️</span><span>注销账号</span></button>
               <div class="h-px bg-slate-700/50 my-1"></div>
               <button @click="handleLogout" class="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-amber-400 hover:bg-slate-700 transition flex items-center space-x-2"><span class="text-amber-400">🏃</span><span>退出登录</span></button>
            </div>
          </div>
        </div>
      </header>
      
      <main class="flex-grow p-4 pt-20 md:pt-6 md:p-6 overflow-y-auto relative z-[50] custom-scrollbar scroll-smooth">
        <router-view :key="$route.fullPath" />
      </main>
      
      <div v-if="profileModal.show" class="fixed inset-0 z-[10005] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
        <div class="bg-slate-900 border border-slate-700 p-5 md:p-8 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] max-w-md w-full max-h-[90dvh] overflow-y-auto custom-scrollbar relative transform transition-all scale-100">
          <button @click="profileModal.show = false" class="absolute top-3 right-3 md:top-4 md:right-4 text-slate-400 hover:text-white bg-slate-800/80 rounded-full p-1.5 md:p-1 z-10 transition border border-slate-700 shadow-sm"><svg class="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          <h3 class="text-lg md:text-xl font-black text-white mt-2 mb-4 md:mb-6 tracking-wide text-center flex items-center justify-center"><span class="text-blue-400 mr-2">🛡️</span> 安全资料中心</h3>
          
          <div class="space-y-4 mb-6 md:mb-8">
            <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4 text-xs text-blue-300 leading-relaxed">
              ⚠️ 修改任何资料均需验证当前登录密码，以及接收邮箱验证码。<br>
              接收验证码邮箱: <span class="font-bold text-amber-400">{{ userStore.userInfo?.email || '无 (请在下方填入要绑定的邮箱接收)' }}</span>
            </div>

            <div><label class="block text-xs font-bold text-slate-400 mb-1">当前密码 (必填)</label><input type="password" v-model="profileModal.form.current_password" class="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 md:py-3 text-white outline-none focus:border-blue-400 transition font-mono text-sm" placeholder="验证身份"></div>
            
            <div v-if="!userStore.userInfo?.email">
               <label class="block text-xs font-bold text-amber-400 mb-1">您尚未绑定邮箱，请输入一个邮箱接收验证码：</label>
               <input type="email" v-model="profileModal.form.new_email_for_code" class="w-full bg-slate-800 border border-amber-500/50 rounded-xl px-4 py-2.5 md:py-3 text-white outline-none focus:border-amber-400 transition font-mono text-sm mb-4" placeholder="例如: user@example.com">
            </div>

            <div class="flex space-x-2 items-end">
                <div class="flex-grow"><label class="block text-xs font-bold text-slate-400 mb-1">邮箱验证码 (必填)</label><input type="text" v-model="profileModal.form.email_code" class="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 md:py-3 text-white outline-none focus:border-blue-400 transition font-mono text-sm" placeholder="6位数字"></div>
                <button @click="sendEmailCode" :disabled="countdown > 0" :class="['w-28 py-2.5 md:py-3 rounded-xl font-bold transition text-xs border', countdown > 0 ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-lg']">{{ countdown > 0 ? countdown + 's 后重发' : '获取验证码' }}</button>
            </div>

            <div class="h-px bg-slate-700/50 my-4"></div>

            <div><label class="block text-xs font-bold text-slate-400 mb-1">新手机号 (不修改请留空)</label><input type="text" v-model="profileModal.form.phone" class="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 md:py-3 text-white outline-none focus:border-emerald-400 transition font-mono text-sm"></div>
            <div v-if="userStore.userInfo?.email"><label class="block text-xs font-bold text-slate-400 mb-1">新邮箱 (不修改请留空)</label><input type="email" v-model="profileModal.form.email" class="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 md:py-3 text-white outline-none focus:border-emerald-400 transition font-mono text-sm"></div>
            <div><label class="block text-xs font-bold text-slate-400 mb-1">新密码 (不修改请留空)</label><input type="password" v-model="profileModal.form.new_password" class="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 md:py-3 text-white outline-none focus:border-emerald-400 transition font-mono text-sm" placeholder="••••••••"></div>
          </div>
          <button @click="submitProfileUpdate" class="w-full font-black text-base md:text-lg py-3 md:py-3.5 rounded-xl transition transform hover:-translate-y-1 shadow-lg text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]">执行双重验证并保存</button>
        </div>
      </div>
      
      <div v-if="deleteModal.show" class="fixed inset-0 z-[10005] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
        <div class="bg-slate-900 border-2 border-red-500/50 p-5 md:p-8 rounded-3xl shadow-[0_0_80px_rgba(239,68,68,0.4)] max-w-md w-full max-h-[90dvh] overflow-y-auto custom-scrollbar relative transform transition-all scale-100">
          <button @click="deleteModal.show = false" class="absolute top-3 right-3 md:top-4 md:right-4 text-slate-400 hover:text-white bg-slate-800/80 rounded-full p-1.5 md:p-1 z-10 transition border border-slate-700 shadow-sm"><svg class="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          <div class="text-center mt-2 mb-6"><div class="text-5xl md:text-6xl mb-4">☢️</div><h3 class="text-xl md:text-2xl font-black text-red-500 tracking-wider">警告：核爆注销</h3></div>
          <p class="text-slate-300 text-xs md:text-sm mb-6 text-center leading-relaxed">此操作将<span class="text-red-400 font-bold">永久抹除</span>您的账号、所有余额以及交易记录。数据无法恢复！</p>
          <div class="space-y-4 mb-8">
            <div class="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-center"><span class="text-xs text-slate-400 block mb-2">请输入下方红字以确认执行：</span><span class="text-lg font-black text-red-500 tracking-widest select-none cursor-not-allowed">确认注销</span></div>
            <input type="text" v-model="deleteModal.confirmText" placeholder="请输入 确认注销" class="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500 transition font-mono text-center">
          </div>
          <button @click="submitDeleteAccount" :disabled="deleteModal.confirmText !== '确认注销'" :class="['w-full font-black text-base md:text-lg py-3 md:py-3.5 rounded-xl transition shadow-lg flex items-center justify-center space-x-2', deleteModal.confirmText === '确认注销' ? 'bg-red-600 hover:bg-red-500 text-white transform hover:-translate-y-1 shadow-[0_0_20px_rgba(239,68,68,0.6)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed']"><span>💀 立即抹除一切</span></button>
        </div>
      </div>
      
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '../stores/user'; 
import { useAppStore } from '../stores/app'; 
import { useUiStore } from '../stores/ui';
import { useRoute } from 'vue-router';

const userStore = useUserStore(); const appStore = useAppStore(); const uiStore = useUiStore();
const route = useRoute(); const isSidebarOpen = ref(false);
const isProfileMenuOpen = ref(false);

const handleNav = (path) => { isSidebarOpen.value = false; if (route.path === path) appStore.triggerRefresh(); };
const handleLogout = async () => { 
  isProfileMenuOpen.value = false;
  if (await uiStore.showConfirm(appStore.lang === 'zh' ? '确定要安全退出当前账号吗？' : 'Are you sure you want to logout?')) { 
    userStore.logout(); window.location.href = '/'; 
  } 
};

const profileModal = ref({ show: false, form: { current_password: '', email_code: '', phone: '', email: '', new_password: '', new_email_for_code: '' } });
const countdown = ref(0); let timer = null;
const openProfileModal = () => { 
  isProfileMenuOpen.value = false;
  profileModal.value.form = { current_password: '', email_code: '', phone: userStore.userInfo?.phone || '', email: userStore.userInfo?.email || '', new_password: '', new_email_for_code: '' };
  profileModal.value.show = true; 
};

const sendEmailCode = async () => {
  if (!userStore.userInfo?.email && !profileModal.value.form.new_email_for_code) return uiStore.showToast('您尚未绑定邮箱，请填入邮箱地址', 'warning');
  try {
    const res = await fetch('/api/user/send-profile-code', { 
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
        body: JSON.stringify({ new_email: profileModal.value.form.new_email_for_code })
    });
    const json = await res.json();
    if (json.status === 'success') {
      uiStore.showToast('验证码已发送，请查收邮箱', 'success');
      countdown.value = 60; timer = setInterval(() => { countdown.value--; if(countdown.value <= 0) clearInterval(timer); }, 1000);
    } else { uiStore.showToast(json.message || '发送失败，请确保后台已配置 SMTP', 'error'); }
  } catch (e) { uiStore.showToast('网络请求异常', 'error'); }
};

const submitProfileUpdate = async () => {
  if (!profileModal.value.form.current_password) return uiStore.showToast('必须输入当前登录密码！', 'error');
  if (!profileModal.value.form.email_code) return uiStore.showToast('必须输入邮箱验证码！', 'error');
  if (!userStore.userInfo?.email && profileModal.value.form.new_email_for_code && !profileModal.value.form.email) profileModal.value.form.email = profileModal.value.form.new_email_for_code;

  try {
    const res = await fetch('/api/user/update-profile', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` }, body: JSON.stringify(profileModal.value.form) });
    const json = await res.json();
    if (json.status === 'success') {
      uiStore.showToast('资料通过安全验证并更新成功！', 'success');
      profileModal.value.show = false; syncUserStatus();
      if (profileModal.value.form.new_password) {
        uiStore.showToast('密码已重置，请重新登录', 'warning');
        setTimeout(() => { userStore.logout(); window.location.href = '/'; }, 1500);
      }
    } else { uiStore.showToast(json.message || '验证失败', 'error'); }
  } catch (e) { uiStore.showToast('网络请求异常', 'error'); }
};

const deleteModal = ref({ show: false, confirmText: '' });
const openDeleteModal = () => { isProfileMenuOpen.value = false; deleteModal.value = { show: true, confirmText: '' }; };
const submitDeleteAccount = async () => {
  if (deleteModal.value.confirmText !== '确认注销') return;
  try {
    const res = await fetch('/api/user/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` } });
    const json = await res.json();
    if (json.status === 'success') {
      uiStore.showToast('账号已彻底抹除', 'success');
      setTimeout(() => { userStore.logout(); window.location.href = '/'; }, 1000);
    } else { uiStore.showToast(json.message || '注销失败', 'error'); }
  } catch (e) { uiStore.showToast('网络请求异常', 'error'); }
};

const syncUserStatus = async () => { 
  if (!userStore.token || userStore.token === 'super-admin-offline-token') return;
  try { 
    const res = await fetch(`/api/user/status?_t=${Date.now()}`, { headers: { 'Authorization': `Bearer ${userStore.token}` } }); 
    const data = await res.json();
    if (data.status === 'success') { 
      userStore.updateUserInfo({ balance: data.balance, role: data.role, vip_expire_at: data.vip_expire_at, api_key: data.api_key, phone: data.phone, email: data.email });
    } 
  } catch (e) {} 
};

onMounted(() => { appStore.fetchConfig(); syncUserStatus(); });
</script>
