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
  // 🤖 平台落地页（/c/tiktok 这类）：服务端渲染同名页面给搜索引擎/AI，
  //    人点进来由这条 SPA 路由接管，内容与价格口径和服务端一致。
  { path: '/c/:slug', component: () => import('../views/Landing.vue') },
  { path: '/', component: DashboardLayout, children: [
      { path: 'order', component: Order },
      // 🎯 千川流量业务（独立业务线：本地商品表 + 人工派单，不走上游 API）
      { path: 'boost', component: () => import('../views/BoostShop.vue') },
      { path: 'mass-order', component: () => import('../views/MassOrder.vue') },
      { path: 'history', component: () => import('../views/History.vue') },
      { path: 'recharge', component: Recharge },
      { path: 'vip', component: () => import('../views/Vip.vue') },
      { path: 'admin', component: () => import('../views/Admin.vue') },
      { path: 'admin/boost', component: () => import('../views/BoostAdmin.vue') },
      { path: 'admin/backup', component: () => import('../views/AdminBackup.vue') },
      // 💳 补单队列：支付回调丢了也不丢钱 —— 客户说"付了没到账"时在这里当场查/判死
      { path: 'admin/payments', component: () => import('../views/AdminPayments.vue') },
  { path: 'admin/site-customers', component: () => import('../views/AdminSiteCustomers.vue') },
  { path: 'admin/sites', component: () => import('../views/AdminSites.vue') },
  { path: 'admin/site-withdrawals', component: () => import('../views/AdminWithdrawals.vue') },
      { path: 'api-doc', component: () => import('../views/ApiDoc.vue') },
      { path: 'affiliate', component: () => import('../views/Affiliate.vue') },
      // 🛒 开通新分站必须先匹配（否则会被 :page 吃掉，变成 page='new' 的空页面）
      { path: 'my-site/new', component: () => import('../views/SiteNew.vue') },
      { path: 'my-site/:page?', component: () => import('../views/SiteAdmin.vue') }
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

  // ⚠️ 公开路径白名单 —— 这些是**服务端渲染的 SEO 落地页**，必须免登录。
  //    2026-11-08 踩过的坑：加了 7 个语种落地页、价格表、知识库之后，
  //    只验证了 curl（爬虫能拿到完整 HTML），**没验证浏览器** ——
  //    结果真实用户访问 /guide、/price、/id、/ar 全被踢回 /login，
  //    页面对爬虫存在、对人不存在。凡是新增 SSR 页面，都要往这里加一条，
  //    并且用浏览器实测一次，不能只看 curl。
  const PUBLIC_EXACT = [
    '/', '/en', '/vpn', '/login', '/showcase',
    '/price', '/en/price',
    '/guide', '/en/guide',
    '/id', '/pt', '/vi', '/ar', '/ru',
    '/id/price', '/pt/price', '/vi/price', '/ar/price', '/ru/price',
  ];
  const PUBLIC_PREFIX = [
    '/c/',                 // 平台落地页（/c/tiktok）
    '/guide/',             // 知识库文章（中文）
    '/en/guide/',          // 知识库文章（英文）
    '/en/c/',              // 英文平台页
    '/id/c/', '/pt/c/', '/vi/c/', '/ar/c/', '/ru/c/',   // 多语种平台页
  ];
  const isPublicPath = PUBLIC_EXACT.includes(to.path)
    || PUBLIC_PREFIX.some((p) => to.path.startsWith(p));

  // 🏬 分站屏蔽「至尊代理」页：那是平台自己的招代理页面（¥99/月、8 折进货、佣金翻倍），
  //    出现在站长的店里替他拉代理，也等于告诉客户"站长是二级代理"。手输 URL 也挡掉。
  if (to.path === '/vip' && localStorage.getItem('xnow_is_subsite') === '1') {
    return next('/');
  }

  // 🏬 分站上不开放平台的运维 / 管理页面（灾备中心、用户管理、系统设置、开发者 API）。
  //    六十二期：祥哥在分站侧边栏看到「灾备中心」—— 那是平台的服务器备份页，
  //    出现在站长的店里既没用，又等于告诉客户"这家店背后有平台"。
  //    即使当前登录的是平台超管，在分站域名下也不给入口（手输 URL 一样挡）。
  // 🔒 110 期：祥哥指着分站窗口问「怎么会有我的分站页面」——
  //    侧边栏本来就不显示，但手输 /my-site 还能打开（我给他开的标签就是这么来的）。
  //    站长管分站应该去主站账号里管；分站域名上留这个页面等于告诉客户「这家店背后有一套系统」。
  //    所以分站域名下 /my-site 一律踢回首页，连 UI 都不渲染。
  // 🔴 分站上同样不许出现 /vpn —— 那是**平台自己**的节点商城（「XNOW 全球安全节点」）。
  //    站长没填按钮链接时，首页与分站 Hero 的兜底都指向它，等于把涨粉店的顾客
  //    直接带到平台另一条业务线上（客户一眼就看出这家店背后有平台）。
  //    nginx 侧只挡整页刷新，SPA 内部跳转必须在这里拦。
  if (localStorage.getItem('xnow_is_subsite') === '1'
      && (to.path.startsWith('/admin') || to.path === '/api-doc' || to.path.startsWith('/my-site')
          || to.path === '/vpn' || to.path.startsWith('/vpn/'))) {
    return next('/');
  }

  // 🤖 平台落地页（/c/tiktok）、价格表、知识库、多语种首页都必须免登录 ——
  //    那些是搜索引擎/AI 导流进来的第一页，要求登录等于把流量全丢掉。
  //    注意 /vpn/admin 仍受保护：它不匹配 PUBLIC_PREFIX（没有 '/vpn/' 这一条）。
  if (!isPublicPath && !token) {
      // 没 Token 且访问受保护页面，直接踢回登录
      next('/login');
  } else if (token && (to.path.startsWith('/admin') || to.path === '/vpn/admin')) {
      // 🔒 3. 角色守卫：后台页只许 管理员/至尊管理员（防普通用户手输 URL 直捣后台）
      try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        // 「我的分站」现在对所有登录用户开放：普通用户要先在这里开通至尊代理
        // （¥99/月）。不开代理就开不了分站，但**入口必须让他们看得到**。
        const allow = ['admin', 'super_admin'];
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
