import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'
import './assets/vpn-theme.css'
import { useUserStore } from './stores/user'
import { applySeo } from './utils/seo'
import { trackVisit } from './utils/analytics'

const app = createApp(App)
const pinia = createPinia() 

app.use(pinia)
app.use(router)

// 💡 核心加法：全局 Fetch 拦截器，捕获 401 并处理后端静默续签
const originalFetch = window.fetch;

// 登录失效只处理一次：一个页面通常并发 3~5 个接口，凭证失效时它们会同时拿到 401，
// 逐个弹窗+跳转会造成「连环弹窗」，且后一次导航会打断前一次 → 停在原页反复弹。
let authExpiredHandled = false;

window.fetch = async (input, init) => {
  const userStore = useUserStore(pinia);
  // 记下本次请求实际携带的凭证：并发请求是同时飞出去的，只要其中任一个先把凭证刷新了，
  // 其余请求随后收到的 401 就属于「被淘汰的旧凭证」，不能算「当前登录已失效」。
  const tokenAtRequest = userStore.token;
  const response = await originalFetch(input, init);

  // 1. 拦截 401 彻底登出
  if (response.status === 401 && window.location.pathname !== '/login') {
    // localStorage 是全浏览器共享的，store 却是每个标签页各自的内存副本。
    // 两者不一致 = 另一个标签页刚重新登录过 —— 此时绝不能 logout()，
    // 否则会把它的新凭证一并删掉，表现为「重新登录后又被踢下线」。
    const sharedToken = localStorage.getItem('xnow_token');
    if (sharedToken && sharedToken !== userStore.token) {
      userStore.setToken(sharedToken);
    } else if (userStore.token === tokenAtRequest && !authExpiredHandled) {
      // 凭证仍是发起请求时那一个，才说明是当前凭证真失效（上面两种「旧凭证」都不算）。
      // authExpiredHandled 兜住登出/跳转完成前新发出的请求，避免连环弹窗。
      authExpiredHandled = true;
      userStore.logout();
      alert('登录状态已失效，请重新登录！\nLogin expired, please login again.');
      // 用整页跳转替代 router.push：SPA 导航可能被同时进行的菜单跳转打断而静默失败，
      // 一旦失败页面就停在原地，后台页的定时轮询会持续 401 → 弹窗反复出现。
      window.location.replace('/login');
    }
  }

  // 💡 2. 核心监听：捕获后端偷偷发来的续命 Token (滑动窗口机制)
  const newToken = response.headers.get('x-new-token');
  if (newToken) {
    userStore.setToken(newToken);
    // 可选：你可以在这里加一句 console.log('Token续期成功') 用于后续调试
  }

  return response;
};

// 💡 SEO + 埋点：每次路由跳转后更新该页独立 title/description/canonical，并上报访问
router.afterEach((to) => {
  applySeo(to.path);
  trackVisit(to.fullPath);
});

app.mount('#app')
