import { createRouter, createWebHistory } from 'vue-router'
import DashboardLayout from '../layouts/DashboardLayout.vue'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Order from '../views/Order.vue'
import MassOrder from '../views/MassOrder.vue'
import History from '../views/History.vue'
import Recharge from '../views/Recharge.vue'
import Vip from '../views/Vip.vue'
import Admin from '../views/Admin.vue'
import ApiDoc from '../views/ApiDoc.vue'
import Affiliate from '../views/Affiliate.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/login', component: Login },
  { path: '/', component: DashboardLayout, children: [
      { path: 'order', component: Order },
      { path: 'mass-order', component: MassOrder },
      { path: 'history', component: History },
      { path: 'recharge', component: Recharge },
      { path: 'vip', component: Vip },
      { path: 'admin', component: Admin },
      { path: 'api-doc', component: ApiDoc },
      { path: 'affiliate', component: Affiliate }
    ]
  }
]

const router = createRouter({ history: createWebHistory(), routes })

// 💡 核心修复：全局路由守卫，死死锁住一切带有推广码的流量！
router.beforeEach((to, from, next) => {
  // 如果发现地址栏里有 ref 参数，不管在哪个页面，立刻存入本地最深处
  if (to.query.ref) {
    localStorage.setItem('xnow_inviter_id', to.query.ref as string);
  }
  next();
})

export default router
