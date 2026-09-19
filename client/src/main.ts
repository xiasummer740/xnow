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
    } else if (tokenAtRequest && userStore.token === tokenAtRequest && !authExpiredHandled) {
      // 三个条件缺一不可：① 这次请求**确实带了**凭证（没带凭证收到 401 只说明该接口要登录，
      // 不是「你的登录失效了」——例如退出登录后页面还没跳走时，后台轮询会带空凭证打接口）；
      // ② 凭证仍是发起请求时那一个（上面两种「旧凭证」都不算）；
      // ③ 本次登录态还没处理过（authExpiredHandled 兜住跳转完成前新发出的请求，避免连环弹窗）。
      authExpiredHandled = true;
      // 只清「与本次失败相同」的那把令牌。localStorage 是各标签页共享的，
      // 无差别 removeItem 会顺手删掉别的标签页刚写入的新凭证，
      // 让对方在下次刷新时莫名其妙掉线 —— 表现为「登录了还是反复弹」。
      if (localStorage.getItem('xnow_token') === userStore.token) {
        localStorage.removeItem('xnow_token');
        localStorage.removeItem('xnow_user');
      }
      userStore.token = '';
      userStore.userInfo = null;
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

// 💡 3. 跨标签页凭证同步
// 根因：一个标签页开很久后，它内存里的凭证会过期，而它自己不会再去读 localStorage，
// 于是持续 401 → 弹「登录已失效」。而它调 logout() 又会把别的标签页刚写入的新凭证删掉，
// 形成「登录 → 被删 → 再登录 → 再弹」的死循环。
// storage 事件是浏览器原生的跨标签页广播：任一标签页写入 localStorage，其余标签页立刻收到。
// 用它把「谁登录了就全员跟上」补齐，从源头消除过期标签页，不必等它先撞一次 401。
window.addEventListener('storage', (e) => {
  if (e.key === 'xnow_token' && e.newValue && e.newValue !== useUserStore(pinia).token) {
    authExpiredHandled = false;
    useUserStore(pinia).setToken(e.newValue);
  }
});

// 💡 SEO + 埋点：每次路由跳转后更新该页独立 title/description/canonical，并上报访问
router.afterEach((to) => {
  applySeo(to.path);
  trackVisit(to.fullPath);
});

app.mount('#app')
