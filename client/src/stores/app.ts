import { defineStore } from 'pinia';
const i18nDict = {
  zh: { console: '控制台', balance: '余额', logout: '退出登录', menu_order: '开始下单', menu_mass: '批量下单', menu_history: '历史订单', menu_recharge: '大佬充值', menu_vip: '至尊代理', menu_admin: '管理密室', menu_api: '开发者 API', menu_backup: '灾备中心', search_placeholder: '搜索订单号 / 链接...', sys_notice: '系统公告', category: '服务分类 (Category)', service: '具体服务项目 (Service)', link: '目标链接 (Link)', quantity: '下单数量', total_price: '预估金额', submit_order: '立即提交订单', waiting_data: '正在加载服务列表...', select_cat_first: '请先选择分类', guide_title: '💡 下单规范指南', guide_1: '⚠️ 1. 订单完成前切勿重复下单。', guide_2: '⚠️ 2. 确保账号为公开状态。', recharge_title: '资金充值', recharge_desc: '安全、即时到账的聚合支付收银台', select_pay: '选择支付方式', recharge_amount: '充值金额', actual_pay: '应付金额', actual_get: '实际到账', pay_btn: '立即安全支付', wechat: '微信支付', alipay: '支付宝', usdt: 'USDT (TRC20)', rmb_desc_title: 'ℹ️ RMB 充值说明', rmb_desc_1: '建议充值金额为 5 的整数倍。微信/支付宝支付需要额外 ', rmb_desc_2: '5%', rmb_desc_3: ' 的通道费【', rmb_desc_4: '单次充值500元以上会赠送5%，相当于减免手续费', rmb_desc_5: '】。', rmb_tip: '💡 Tip: 充值 500+ 免手续费', usd_desc_title: '⚡ USDT 省钱攻略', usd_desc_4: '若使用 USDT-TRC20 支付，可使用能量租赁的方式节省 ', usd_desc_5: '80%', usd_desc_6: ' 的 TRX 手续费；TRX 自助能量租赁平台👇', usd_btn: 'TRX 能量租赁平台 👉 点击进入', 
  super_admin_badge: '超级系统管理', admin_badge: '至尊管理员', agent_badge: '至尊代理', gold_badge: '黄金用户', 
  vip_title: '升级至尊代理 · 掌控全局利润', vip_subtitle: '不仅是全网降维打击的批发底价，更能通过专属 API 一键搭建您的独立商业帝国。', vip_feature1_title: '📉 断崖式全局底价', vip_feature1_desc: '越过所有中间商！尊享全站服务指导价 20%~50% 的终极底价结算，将最大化的利润空间全量释放给您。', vip_feature2_title: '🔌 API 无缝独立建站', vip_feature2_desc: '全面开放开发者 API，支持完美对接市面所有主流 SMM 面板。一键克隆全站货源，轻松做真正的平台主理人。', vip_feature3_title: '⚡ 专属研发级保障', vip_feature3_desc: '7x24小时优先响应售后通道，订单异常秒退秒补，由顶级技术团队为您的海量并发业务保驾护航。', vip_status_admin: '您已是最高权限管理员，享有上帝视角，无需开通代理。', vip_status_active: '尊贵的【至尊代理】特权已激活', vip_expire: '代理有效期至：', vip_btn_renew: '立即续费特权 (¥ 99 / 30天)', vip_btn_upgrade: '立即解锁至尊代理 (¥ 99 / 30天)', menu_vpn: '🛡️ 安全节点', vpn_menu_shop: '🛒 选购套餐', vpn_menu_clients: '📡 我的节点', vpn_console_title: '安全节点控制台', vpn_shop_cta: '立即选购', vpn_buy: '立即购买', vpn_no_clients: '暂无节点，去选购一个吧', vpn_traffic: '流量', vpn_expiry: '到期时间', vpn_vps: '节点位置', vpn_status_active: '运行中' },
  en: { console: 'Console', balance: 'Balance', logout: 'Logout', menu_order: 'New Order', menu_mass: 'Mass Order', menu_history: 'Order History', menu_recharge: 'Add Funds', menu_vip: 'VIP Agent', menu_admin: 'Admin Panel', menu_api: 'Developer API', menu_backup: 'Backup Center', search_placeholder: 'Search...', sys_notice: 'Announcement', category: 'Category', service: 'Service', link: 'Target Link', quantity: 'Quantity', total_price: 'Total Price', submit_order: 'Submit Order', waiting_data: 'Waiting for sync...', select_cat_first: 'Select a category first', guide_title: '💡 Order Guidelines', guide_1: '⚠️ 1. Do not place same link twice before completion.', guide_2: '⚠️ 2. Ensure account is public.', recharge_title: 'Add Funds', recharge_desc: 'Secure & Instant Payment Gateway', select_pay: 'Select Payment Method', recharge_amount: 'Amount', actual_pay: 'You Pay', actual_get: 'You Get', pay_btn: 'Pay Securely', wechat: 'WeChat Pay', alipay: 'Alipay', usdt: 'USDT (TRC20)', rmb_desc_title: 'ℹ️ RMB Notice', rmb_desc_1: '5% extra fee applies to WeChat/Alipay. ', rmb_desc_2: '5%', rmb_desc_3: ' fee waived for ', rmb_desc_4: 'deposits over 500 CNY', rmb_desc_5: '.', rmb_tip: '💡 Tip: Deposit 500+ to waive fees', usd_desc_title: '⚡ USDT Savings', usd_desc_4: 'If paying with USDT-TRC20, energy rental saves ', usd_desc_5: '80%', usd_desc_6: ' of the TRX fee. TRX energy rental: 👇', usd_btn: 'TRX Energy Rental 👉 Click Here', 
  super_admin_badge: 'Super Admin', admin_badge: 'Supreme Admin', agent_badge: 'VIP Agent', gold_badge: 'Gold User', 
  vip_title: 'Upgrade to VIP Agent', vip_subtitle: 'Unlock wholesale prices and easily build your own SMM panel with our seamless API.', vip_feature1_title: '📉 Ultimate Wholesale Price', vip_feature1_desc: 'Bypass the middlemen! Enjoy 20%~50% off the standard retail price. Maximize your profit margins.', vip_feature2_title: '🔌 API Reseller Panel', vip_feature2_desc: 'Full access to our Developer API. Sync our entire service list to your own SMM panel and become a platform owner.', vip_feature3_title: '⚡ Priority Tech Support', vip_feature3_desc: '24/7 dedicated support channel. Auto-refills and instant refunds for absolute peace of mind.', vip_status_admin: 'You have Supreme Admin privileges. No need to upgrade.', vip_status_active: 'VIP Agent Status: ACTIVE', vip_expire: 'Expires on: ', vip_btn_renew: 'Renew VIP Status (¥ 99 / 30 Days)', vip_btn_upgrade: 'Unlock VIP Agent (¥ 99 / 30 Days)', menu_vpn: '🛡️ Secure VPN', vpn_menu_shop: '🛒 Plans', vpn_menu_clients: '📡 My Nodes', vpn_console_title: 'Secure Node Console', vpn_shop_cta: 'Get Started', vpn_buy: 'Buy Now', vpn_no_clients: 'No active nodes. Go get one!', vpn_traffic: 'Traffic', vpn_expiry: 'Expiry', vpn_vps: 'Location', vpn_status_active: 'Active' }
};
export const useAppStore = defineStore('app', {
  state: () => {
    // 🏷️ 首屏就要知道"我是不是分站"：store 初始化早于 /api/public/config，
    //    读上次落下的标记与站名，避免分站首屏闪出平台名。
    const cachedSubsite = (() => { try { return localStorage.getItem('xnow_is_subsite') === '1'; } catch (e) { return false; } })();
    const cachedName = (() => { try { return localStorage.getItem('xnow_site_name') || ''; } catch (e) { return ''; } })();
    return { currency: 'CNY', lang: 'zh', exchangeRate: 7.25,
      // 分站且没有站名时用中性词，绝不回落成平台品牌
      siteName: cachedName || '增长服务',   // 真实站名由 /api/public/config 下发；兜底用中性词，bundle 里不留平台名
      siteLogo: '/logo.png', isSubsite: cachedSubsite, siteId: 0,
      tgBotLink: '',   // 由 /api/public/config 下发（分站不下发 → 客服链接走站长自己的）
      globalRefreshTrigger: 0,
    // 🎨 分站主题（主站为空 → 外观与改造前一致）
    themeTemplate: '', themeColor: '', themeAccent: '', footerText: '', supportUrl: '', announcement: '', homeModules: [] as { key: string; enabled: boolean; order: number }[],
    // 🧱 五十一期：优势三卡片（站长可自定义图标/标题/正文；空 = 用平台默认文案）
    advantages: [] as { icon?: string; title?: string; body?: string }[],
    // 🎨 二十七期：风格细分维度（空 = 用模板默认）
    uiRadius: '', uiDensity: '', cardStyle: '', fontStyle: '', btnShape: '', heroLayout: '',
    // 🎨 六十三期：可视化编辑器的外观三板斧（背景色 / 背景图 / 字号档位）
    bgColor: '', bgImage: '', fontScale: '',
    // 🎨 四十一期：全方位 DIY
    mainOrigin: '',      // 主站地址（服务端下发，推广链接用）
  discountLabel: '',   // 分站活动标签，如「开业 9 折」
  heroVariant: '', servicesVariant: '', sectionTitles: {} as Record<string, { title?: string; sub?: string }>,
    customCss: '', faviconUrl: '',
    // ✍️ 十九期：首页文案自定义（主站为空 → Home.vue 回落到默认文案）
    hero: {} as Record<string, string> };
  },
  // 🏷️ 92 期：品牌名兜底放 getters（原来写成 actions 里的访问器，
  //    取到的是 actions 对象的 this，读不到 state，分站就一直显示兜底词）
  getters: {
    brandName(state): string {
      const n = (state.siteName || '').trim();
      return n || '增长服务';
    },
    siteInitial(state): string {
      const n = (state.siteName || '').trim();
      return n ? n.replace(/^[A-Za-z0-9\s]+$/, n).charAt(0).toUpperCase() : '增';
    },
  },
  actions: {
    toggleCurrency() { this.currency = this.currency === 'CNY' ? 'USD' : 'CNY'; }, toggleLang() { this.lang = this.lang === 'zh' ? 'en' : 'zh'; }, triggerRefresh() { this.globalRefreshTrigger++; }, 
    async fetchRate() { try { const resRate = await fetch('https://open.er-api.com/v6/latest/USD'); const dataRate = await resRate.json(); if(dataRate && dataRate.rates && dataRate.rates.CNY) this.exchangeRate = dataRate.rates.CNY; } catch(e) {} },
    async fetchConfig() { try { const res = await fetch('/api/public/config'); const data = await res.json(); if(data && data.status === 'success') { if (data.data.site_name) { this.siteName = data.data.site_name; try { localStorage.setItem('xnow_site_name', data.data.site_name); } catch (e) {} } if (data.data.site_logo) this.siteLogo = data.data.site_logo; if (data.data.tg_bot_link) this.tgBotLink = data.data.tg_bot_link;
      // 🎨 分站主题：模板 / 色系 / 自定义主色 / 页脚 / 客服 / 首页模块
      const d = data.data;
      // 是否分站（供客户侧隐藏平台专属元素，如 PRO 徽标）
    this.isSubsite = !!d.is_subsite;
    // 分站必须有名字；站长没填就用中性词，不能显示平台名
    if (this.isSubsite && !(this.siteName || '').trim()) this.siteName = '增长服务';
    if (this.isSubsite && !this.tgBotLink && this.supportUrl) this.tgBotLink = this.supportUrl;
    // 落到 localStorage 供路由守卫用（守卫读不到 store，只能读本地存储）
    try { localStorage.setItem('xnow_is_subsite', this.isSubsite ? '1' : '0'); } catch (e) {}
    this.siteId = d.site_id || 0;
    if (d.main_origin) this.mainOrigin = d.main_origin;
    this.discountLabel = d.discount_label || '';
    if (d.theme_template) this.themeTemplate = d.theme_template;
      if (d.theme_color) this.themeColor = d.theme_color;
      this.themeAccent = d.theme_accent || '';
      this.footerText = d.footer_text || '';
      this.supportUrl = d.support_url || '';
      this.announcement = d.announcement || '';
      if (d.home_modules) { try { const m = JSON.parse(d.home_modules); if (Array.isArray(m)) this.homeModules = m; } catch(e) {} }
      // 🧱 五十一期：优势三卡片（分站自定义；空则前端回落平台默认文案）
      if (d.advantages) { try { const a = JSON.parse(d.advantages); if (Array.isArray(a)) this.advantages = a; } catch(e) {} }
      // 🎨 二十七期：风格细分维度
      this.uiRadius = d.ui_radius || '';
      this.uiDensity = d.ui_density || '';
      this.cardStyle = d.card_style || '';
      this.fontStyle = d.font_style || '';
      this.btnShape = d.btn_shape || '';
      this.heroLayout = d.hero_layout || '';
    // 🎨 六十三期：背景色 / 背景图 / 字号档位
    this.bgColor = d.bg_color || '';
    this.bgImage = d.bg_image || '';
    this.fontScale = d.font_scale || '';
      // 🎨 四十一期：结构级 DIY + 自定义 CSS + 站点图标
      this.heroVariant = d.hero_variant || '';
      this.servicesVariant = d.services_variant || '';
      this.customCss = d.custom_css || '';
      this.faviconUrl = d.favicon_url || '';
      if (d.section_titles) {
        try { const st = JSON.parse(d.section_titles); this.sectionTitles = (st && typeof st === 'object') ? st : {}; }
        catch (e) { this.sectionTitles = {}; }
      }
      this.applyCustomCss();
      this.applyFavicon();

      // ✍️ 十九期：首页文案（主站没有这些 key → 保持空对象 → 首页用默认文案）
      this.hero = {
        hero_badge: d.hero_badge || '', hero_title: d.hero_title || '',
        hero_subtitle: d.hero_subtitle || '', hero_desc: d.hero_desc || '',
        hero_btn1_text: d.hero_btn1_text || '', hero_btn1_url: d.hero_btn1_url || '',
        hero_btn2_text: d.hero_btn2_text || '', hero_btn2_url: d.hero_btn2_url || '',
        hero_bg_url: d.hero_bg_url || ''
      };
      this.applyTheme();
    } } catch(e) {} this.fetchRate(); },
  applyCustomCss() {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('xn-site-css') as HTMLStyleElement | null;
    if (!this.customCss) { if (el) el.textContent = ''; return; }
    if (!el) {
      el = document.createElement('style');
      el.id = 'xn-site-css';
      document.head.appendChild(el);
    }
    el.textContent = this.customCss;
  },

  // 🖼 站点图标
  applyFavicon() {
    if (typeof document === 'undefined' || !this.faviconUrl) return;
    let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = this.faviconUrl;
  },

  // 📝 区块文案：站长没填就返回空串，调用方用默认文案兜底
  sectionTitle(key: string): string {
    const v = (this.sectionTitles || {})[key];
    return v && v.title ? v.title : '';
  },
  sectionSub(key: string): string {
    const v = (this.sectionTitles || {})[key];
    return v && v.sub ? v.sub : '';
  },

  applyTheme() {
    // 🏷️ 三十九期：分站要换掉浏览器标签上的平台名。
    //    站长把链接发给客户，标签栏写着「XNOW PRO」等于当场告诉客户他在哪进货。
    if (typeof document !== 'undefined' && this.isSubsite && this.siteName) {
      document.title = this.siteName;
      // 描述 / og 也一并换掉：静态入口是中性文案，JS 跑起来后换成站长自己的。
      // 分享预览（微信/Telegram）走静态中性版，不会出现平台品牌。
      try {
        const desc = `${this.siteName} —— TikTok / Instagram / YouTube / Telegram 等平台的粉丝、播放与成员增长服务，自动交付，注册即用。`;
        const setMeta = (sel, attr, val) => {
          let el = document.querySelector(sel);
          if (!el) { el = document.createElement('meta'); if (sel.includes('property')) el.setAttribute('property', sel.match(/"([^"]+)"/)?.[1] || ''); else el.setAttribute('name', sel.match(/"([^"]+)"/)?.[1] || ''); document.head.appendChild(el); }
          el.setAttribute(attr, val);
        };
        setMeta('meta[name="description"]', 'content', desc);
        setMeta('meta[property="og:title"]', 'content', this.siteName);
        setMeta('meta[property="og:description"]', 'content', desc);
        setMeta('meta[property="og:site_name"]', 'content', this.siteName);
      } catch (e) {}
    }
      // 只在分站生效：主站不设置 data-template，保持原样
      if (!this.themeTemplate) return;
      const el = document.documentElement;
      el.dataset.template = this.themeTemplate;
    // 🧱 四十一期：把"首屏版式"也挂到 html 上，让**整页**的区块风格跟着变
    //    （原来只有首屏结构变了，下面几块还是主站那套居中卡片 —— 一眼就露馅）
    el.dataset.block = this.heroVariant || this.themeTemplate || 'classic';
      if (this.themeColor) el.dataset.color = this.themeColor;
      if (this.themeAccent && /^#[0-9a-fA-F]{6}$/.test(this.themeAccent)) {
        el.style.setProperty('--brand', this.themeAccent);
        el.style.setProperty('--brand-soft', this.themeAccent + '2e');
        el.style.setProperty('--brand-strong', this.themeAccent);
      }
      // 🎨 二十七期：风格细分维度（圆角/间距/卡片/字体/按钮/英雄布局）。
      //    只写 data-* 属性，具体样式在 site-theme.css；主站不设置 → 无影响。
      const styleMap: Record<string, string> = {
        radius: this.uiRadius, density: this.uiDensity, card: this.cardStyle,
        font: this.fontStyle, btn: this.btnShape, hero: this.heroLayout
      };
      for (const [attr, val] of Object.entries(styleMap)) {
        if (val) el.dataset[attr] = val; else delete el.dataset[attr];
      }

      // 🎨 六十三期：外观三板斧（背景色 / 背景图 / 字号）。只在分站生效。
      //    背景色支持 #RRGGBB 或三套内置渐变（grad1/2/3），其余一律忽略。
      const GRADS: Record<string, string> = {
        grad1: 'linear-gradient(160deg, #0b1220 0%, #131a2e 55%, #1b1030 100%)',
        grad2: 'linear-gradient(160deg, #04070f 0%, #0d1b2a 60%, #10243a 100%)',
        grad3: 'linear-gradient(160deg, #120a1f 0%, #1d1030 55%, #2a1033 100%)'
      };
      const bg = String(this.bgColor || '').trim();
      if (bg && /^#[0-9a-fA-F]{6}$/.test(bg)) {
        el.style.setProperty('--site-bg', bg);
        el.style.setProperty('--site-bg-image', 'none');
      } else if (bg && GRADS[bg]) {
        el.style.setProperty('--site-bg', GRADS[bg]);
        el.style.setProperty('--site-bg-image', 'none');
      } else {
        el.style.removeProperty('--site-bg');
        el.style.removeProperty('--site-bg-image');
      }
      if (!bg && this.bgImage && /^\/uploads\/[A-Za-z0-9._-]+$/.test(this.bgImage)) {
        el.style.setProperty('--site-bg-image', `url("${this.bgImage}")`);
      }
      const scale = { sm: '0.94', md: '1', lg: '1.08' }[String(this.fontScale || '')];
      if (scale && scale !== '1') el.style.setProperty('--site-font-scale', scale);
      else el.style.removeProperty('--site-font-scale');
    },
    moduleEnabled(key: string) {
      // 未配置模块的分站：全部显示（保持与主站一致）
      if (!this.homeModules || this.homeModules.length === 0) return true;
      const m = this.homeModules.find(x => x.key === key);
      return m ? m.enabled !== false : false;
    },
    // 🧩 二十八期：首页区块排序。用 CSS order 实现，不改 DOM 顺序 → 主站默认顺序不变。
    //    未配置的分站或未出现的键，回落到主站默认顺序，保证老配置不会把页面搞乱。
    moduleOrder(key: string) {
      const DEFAULT_ORDER = ['audience', 'steps', 'advantages', 'hot_services', 'faq', 'cta'];
      const def = DEFAULT_ORDER.indexOf(key);
      const fallback = def < 0 ? 99 : def;
      if (!this.homeModules || this.homeModules.length === 0) return fallback;
      const m = this.homeModules.find(x => x.key === key);
      if (!m) return fallback;
      return typeof m.order === 'number' ? m.order : fallback;
    },
    t(key) { return i18nDict[this.lang][key] || key; }, 
    formatMoney(cnyAmount) { const amt = parseFloat(cnyAmount || 0); if (this.currency === 'CNY') return `¥ ${(amt).toFixed(2)}`; return `$ ${(amt / this.exchangeRate).toFixed(4)}`; }
  }
});
