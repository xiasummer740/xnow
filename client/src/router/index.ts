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
      { path: 'api-doc', component: ApiDoc }
    ]
  }
]
const router = createRouter({ history: createWebHistory(), routes })
export default router
