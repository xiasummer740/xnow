import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css' 
import { useUserStore } from './stores/user' 

const app = createApp(App)
const pinia = createPinia() 

app.use(pinia)
app.use(router)

// 💡 核心加法：全局 Fetch 拦截器，捕获 401 并处理后端静默续签
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const response = await originalFetch(input, init);
  const userStore = useUserStore(pinia); 

  // 1. 拦截 401 彻底登出
  if (response.status === 401 && window.location.pathname !== '/login') {
    userStore.logout(); 
    alert('登录状态已失效，您已超过 7 天未活跃，请重新登录！\nLogin expired due to inactivity, please login again.'); 
    router.push('/login'); 
  }

  // 💡 2. 核心监听：捕获后端偷偷发来的续命 Token (滑动窗口机制)
  const newToken = response.headers.get('x-new-token');
  if (newToken) {
    userStore.setToken(newToken);
    // 可选：你可以在这里加一句 console.log('Token续期成功') 用于后续调试
  }

  return response;
};

app.mount('#app')
