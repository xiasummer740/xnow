import { createRouter, createWebHistory } from 'vue-router'
import DashboardLayout from '../layouts/DashboardLayout.vue'
import VpnLayout from '../layouts/VpnLayout.vue'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Order from '../views/Order.vue'
import Recharge from '../views/Recharge.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/en', component: Home }, // 英文镜像：复用 Home，按路径强制英文
  { path: '/login', component: Login },
  { path: '/showcase', component: () => import('../views/Showcase.vue') }, // 🎨 分站风格陈列（公开，不需要登录）
  { path: '/', component: DashboardLayout, children: [
      { path: 'order', component: Order },
      { path: 'mass-order', component: () => import('../views/MassOrder.vue') },
      { path: 'history', component: () => import('../views/History.vue') },
      { path: 'recharge', component: Recharge },
      { path: 'vip', component: () => import('../views/Vip.vue') },
      { path: 'admin', component: () => import('../views/Admin.vue') },
      { path: 'admin/backup', component: () => import('../views/AdminBackup.vue') },
      { path: 'api-doc', component: () => import('../views/ApiDoc.vue') },
      { path: 'affiliate', component: () => import('../views/Affiliate.vue') },
      { path: 'my-site', component: () => import('../views/SiteAdmin.vue') }
    ]
  },
  { path: '/vpn', component: VpnLayout, children: [
      { path: '', component: () => import('../views/VpnShop.vue') },
      { path: 'clients', component: () => import('../views/VpnClients.vue') },
      { path: 'admin', component: () => import('../views/VpnAdmin.vue') }
    ]
  }
]

const router = createRouter({ history: createWebHistory(), routes })

// 💡 全局路由守卫：死死锁住一切带有推广码的流量！+ 新增登录鉴权校验
router.beforeEach((to, from, next) => {
  // 1. 保留原有的推广码追踪逻辑
  if (to.query.ref) {
    localStorage.setItem('xnow_inviter_id', to.query.ref as string);
  }

  // 💡 2. 核心加法：路由级 Token 过期/缺失拦截
  const token = localStorage.getItem('xnow_token');
  const publicPaths = ['/', '/en', '/vpn', '/login', '/showcase']; // 允许免登录访问的白名单路径（/en 为英文营销镜像，/vpn 为节点商城公开页）

  // 🏬 分站屏蔽「至尊代理」页：那是平台自己的招代理页面（¥99/月、8 折进货、佣金翻倍），
  //    出现在站长的店里替他拉代理，也等于告诉客户"站长是二级代理"。手输 URL 也挡掉。
  if (to.path === '/vip' && localStorage.getItem('xnow_is_subsite') === '1') {
    return next('/');
  }

  // 🏬 分站上不开放平台的运维 / 管理页面（灾备中心、用户管理、系统设置、开发者 API）。
  //    六十二期：祥哥在分站侧边栏看到「灾备中心」—— 那是平台的服务器备份页，
  //    出现在站长的店里既没用，又等于告诉客户"这家店背后有平台"。
  //    即使当前登录的是平台超管，在分站域名下也不给入口（手输 URL 一样挡）。
  if (localStorage.getItem('xnow_is_subsite') === '1'
      && (to.path.startsWith('/admin') || to.path === '/api-doc')) {
    return next('/');
  }

  if (!publicPaths.includes(to.path) && !token) {
      // 没 Token 且访问受保护页面，直接踢回登录
      next('/login');
  } else if (token && (to.path.startsWith('/admin') || to.path === '/vpn/admin' || to.path === '/my-site')) {
      // 🔒 3. 角色守卫：后台页只许 管理员/至尊管理员（防普通用户手输 URL 直捣后台）
      try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        // 「我的分站」额外放行至尊代理（agent）—— 普通用户仍被拦
        const allow = to.path === '/my-site'
          ? ['admin', 'super_admin', 'agent']
          : ['admin', 'super_admin'];
        if (!allow.includes(payload.role)) return next('/');
        next();
      } catch {
        return next('/login');
      }
  } else {
      // 正常放行
      next();
  }
})

export default router
