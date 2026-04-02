import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css' // Tailwind 引入点
import { useUserStore } from './stores/user' // 💡 核心加法：引入 user store 以便调用登出逻辑

const app = createApp(App)
const pinia = createPinia() // 💡 将 pinia 实例独立出来

app.use(pinia)
app.use(router)

// 💡 核心加法：全局 Fetch 拦截器，捕获所有 401 鉴权失败
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const response = await originalFetch(input, init);
  // 拦截后端返回的 401 (未授权/Token失效)，且确保不陷入登录页死循环
  if (response.status === 401 && window.location.pathname !== '/login') {
    const userStore = useUserStore(pinia); // 获取 store
    userStore.logout(); // 执行原有的本地清理逻辑
    alert('登录状态已失效或过期，请重新登录！\nLogin expired, please login again.'); // 💡 内置基础双语提示
    router.push('/login'); // 强制回弹到登录页
  }
  return response;
};

app.mount('#app')
