<template>
  <div class="min-h-screen bg-transparent flex items-center justify-center p-4 relative overflow-hidden z-10">
    <div class="w-full max-w-md bg-slate-900/80 backdrop-blur-2xl rounded-3xl border border-slate-700 shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden relative z-10">
      <div class="flex border-b border-slate-700"><button @click="mode = 'login'" :class="['flex-1 py-4 text-sm font-bold transition duration-300', mode === 'login' ? 'text-amber-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300 bg-transparent']">{{ appStore.lang === 'zh' ? '登录' : 'Login' }}</button><button @click="mode = 'register'" :class="['flex-1 py-4 text-sm font-bold transition duration-300', mode === 'register' ? 'text-amber-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300 bg-transparent']">{{ appStore.lang === 'zh' ? '注册' : 'Register' }}</button></div>
      <div class="p-8">
        <div class="text-center mb-8"><img :src="appStore.siteLogo || '/logo.png'" onerror="this.onerror=null; this.src='/logo.png';" class="h-12 mx-auto mb-3 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"><h2 class="text-xl font-black text-white tracking-widest">{{ appStore.siteName || 'XNOW' }} <span class="text-amber-400 text-sm italic border border-amber-400/30 px-2 py-0.5 rounded-full ml-2 relative -top-1">PRO</span></h2><p class="text-xs text-slate-400 mt-2 tracking-widest uppercase">{{ mode === 'login' ? 'Welcome Back' : 'Create Account' }}</p></div>
        <form @submit.prevent="handleSubmit" class="space-y-5">
          <div><label class="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">{{ appStore.lang === 'zh' ? '账号 (手机号)' : 'Phone Account' }}</label><input type="text" v-model="form.phone" required class="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-400 transition" :placeholder="appStore.lang === 'zh' ? '请输入手机号' : 'Enter phone number'"></div>
          <div v-if="mode === 'register' || mode === 'reset'"><label class="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">{{ appStore.lang === 'zh' ? '安全邮箱' : 'Email' }}</label><input type="email" v-model="form.email" required class="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-400 transition" :placeholder="appStore.lang === 'zh' ? '用于接收验证码' : 'For security code'"></div>
          <div v-if="mode === 'register' || mode === 'reset'"><label class="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">{{ appStore.lang === 'zh' ? '验证码' : 'Verification Code' }}</label><div class="flex space-x-2"><input type="text" v-model="form.code" required class="flex-1 bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-400 transition" placeholder="6-digit code"><button type="button" @click="sendCode" :disabled="countdown > 0" class="bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm">{{ countdown > 0 ? `${countdown}s` : (appStore.lang === 'zh' ? '获取' : 'Get Code') }}</button></div></div>
          <div><div class="flex justify-between items-center mb-1.5"><label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">{{ mode === 'reset' ? (appStore.lang === 'zh' ? '新密码' : 'New Password') : (appStore.lang === 'zh' ? '密码' : 'Password') }}</label><a v-if="mode === 'login'" @click.prevent="mode = 'reset'" href="#" class="text-xs text-amber-400 hover:text-amber-300 transition">{{ appStore.lang === 'zh' ? '忘记密码?' : 'Forgot Password?' }}</a></div><input type="password" v-model="form.password" required class="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-400 transition" placeholder="••••••••"></div>
          <button type="submit" :disabled="loading" class="w-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-900 font-black text-lg py-3.5 rounded-xl transition transform hover:-translate-y-0.5 shadow-[0_0_20px_rgba(251,191,36,0.3)] mt-4 disabled:opacity-70 flex items-center justify-center"><svg v-if="loading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{{ submitText }}</button>
        </form>
        <div v-if="mode === 'reset'" class="mt-6 text-center"><a @click.prevent="mode = 'login'" href="#" class="text-sm text-slate-400 hover:text-white transition">{{ appStore.lang === 'zh' ? '返回登录' : 'Back to Login' }}</a></div>
      </div>
    </div>
    <button @click="appStore.toggleLang" class="absolute top-6 right-6 text-slate-400 hover:text-white font-bold transition text-sm bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700 backdrop-blur-sm z-50">{{ appStore.lang === 'zh' ? 'EN' : '中' }}</button>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'; import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user'; import { useUiStore } from '../stores/ui'; import { useAppStore } from '../stores/app';
const router = useRouter(); const userStore = useUserStore(); const uiStore = useUiStore(); const appStore = useAppStore();
const mode = ref('login'); const loading = ref(false); const countdown = ref(0); const form = ref({ phone: '', email: '', password: '', code: '' });

const submitText = computed(() => { if (loading.value) return appStore.lang === 'zh' ? '处理中...' : 'Processing...'; if (mode.value === 'login') return appStore.lang === 'zh' ? '安全登录' : 'Login'; if (mode.value === 'register') return appStore.lang === 'zh' ? '创建账号' : 'Create Account'; return appStore.lang === 'zh' ? '重置密码' : 'Reset Password'; });

const sendCode = async () => { 
  if (!form.value.email) return uiStore.showAlert(appStore.lang === 'zh' ? '请填写邮箱' : 'Email required', '错误');
  try { 
    const res = await fetch('/api/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.value.email }) });
    const data = await res.json(); 
    if (data.status === 'success') { 
      uiStore.showToast(appStore.lang === 'zh' ? '验证码已发送' : 'Code sent', 'success');
      countdown.value = 60; const timer = setInterval(() => { countdown.value--; if (countdown.value <= 0) clearInterval(timer); }, 1000);
    } else { uiStore.showAlert(data.message, '错误'); } 
  } catch (e) { uiStore.showAlert('Network Error', '系统提示'); } 
};

const handleSubmit = async () => { 
  loading.value = true;
  try { 
    // 彻底切断任何前端硬编码后门，所有请求必须打向 Node.js 后端进行真实校验！
    const res = await fetch(`/api/${mode.value}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form.value) });
    const data = await res.json(); 
    
    // 增加严格的 res.ok 判断，如果后端返回 400 或 401 走报错逻辑
    if (res.ok && data.status === 'success') { 
      uiStore.showToast(data.message || (appStore.lang === 'zh' ? '成功' : 'Success'), 'success');
      if (mode.value === 'login') { 
        userStore.setToken(data.token); userStore.setUserInfo(data.user); window.location.href = '/order';
      } else { 
        mode.value = 'login'; form.value.password = ''; form.value.code = '';
      } 
    } else { 
      uiStore.showAlert(data.message || 'Error', '验证失败');
    } 
  } catch (error) { 
    uiStore.showAlert('网络连接失败或服务异常，请重试。', '系统警告'); 
  } 
  loading.value = false; 
};
onMounted(() => { appStore.fetchConfig(); });
</script>
