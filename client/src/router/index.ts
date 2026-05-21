import { createRouter, createWebHistory } from 'vue-router'
import DashboardLayout from '../layouts/DashboardLayout.vue'
import VpnLayout from '../layouts/VpnLayout.vue'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Order from '../views/Order.vue'
import Recharge from '../views/Recharge.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/login', component: Login },
  { path: '/', component: DashboardLayout, children: [
      { path: 'order', component: Order },
      { path: 'mass-order', component: () => import('../views/MassOrder.vue') },
      { path: 'history', component: () => import('../views/History.vue') },
      { path: 'recharge', component: Recharge },
      { path: 'vip', component: () => import('../views/Vip.vue') },
      { path: 'admin', component: () => import('../views/Admin.vue') },
      { path: 'admin/backup', component: () => import('../views/AdminBackup.vue') },
      { path: 'api-doc', component: () => import('../views/ApiDoc.vue') },
      { path: 'affiliate', component: () => import('../views/Affiliate.vue') }
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
  const publicPaths = ['/', '/login']; // 允许免登录访问的白名单路径
  
  if (!publicPaths.includes(to.path) && !token) {
      // 没 Token 且访问受保护页面，直接踢回登录
      next('/login');
  } else {
      // 正常放行
      next();
  }
})

export default router
