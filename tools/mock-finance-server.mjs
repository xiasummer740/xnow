// 模拟财务数据 - 仅用于演示
import http from 'http';

const MOCK_DATA = {
  status: 'success',
  data: {
    deposit: {
      total_deposit: 128560.50,
      today_deposit: 2350.00,
      month_deposit: 28650.00,
      wechat_deposit: 68200.00,
      alipay_deposit: 45360.50,
      usdt_deposit: 15000.00
    },
    orders: {
      total_charge: 98500.00,
      total_upstream_charge: 59100.00,
      total_profit: 39400.00,
      total_orders: 2847
    },
    refund: { total_refund: 1280.00 },
    commission: { total_commission: 4250.00 },
    userBalance: { total_balance: 36580.00 },
    dailyTrend: [
      { date: '2026-06-05', deposit: 856.00, spending: 420.00 },
      { date: '2026-06-06', deposit: 1200.00, spending: 680.00 },
      { date: '2026-06-07', deposit: 2350.00, spending: 920.00 },
      { date: '2026-06-08', deposit: 680.00, spending: 550.00 },
      { date: '2026-06-09', deposit: 1890.00, spending: 780.00 },
      { date: '2026-06-10', deposit: 1520.00, spending: 1100.00 },
      { date: '2026-06-11', deposit: 2350.00, spending: 890.00 }
    ],
    summary: {
      grossProfit: '39400.00',
      profitRate: '40.0',
      netIncome: '123030.50',
      totalBalance: '36580.00'
    }
  }
};

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url.startsWith('/api/admin/finance')) {
    return res.end(JSON.stringify(MOCK_DATA));
  }

  // 模拟 auth token 校验通过
  if (req.url.startsWith('/api/admin/dashboard')) {
    return res.end(JSON.stringify({
      status: 'success',
      config: {
        global_multiplier: '2.0', agent_discount: '0.8', site_name: 'XNOW',
        announcement: '', site_logo: '/logo.png'
      },
      upstreamBalance: { balance: '1250.50' },
      users: [
        { id: 1, phone: '13800138000', email: 'admin@xnow.com', role: 'admin',
          balance: '99999.000000', register_ip: '127.0.0.1', created_at: '2026-01-01', is_banned: false }
      ],
      orders: [],
      transactions: [],
      totalOrders: 2847
    }));
  }

  // mock login
  if (req.url.startsWith('/api/auth/login')) {
    return res.end(JSON.stringify({
      status: 'success', token: 'mock-token-123',
      user: { id: 1, phone: '13800138000', role: 'admin' }
    }));
  }

  // mock public config
  if (req.url.startsWith('/api/public/config')) {
    return res.end(JSON.stringify({
      status: 'success', data: { site_name: 'XNOW', site_logo: '/logo.png', tg_bot_link: '' }
    }));
  }

  res.end(JSON.stringify({ status: 'error', message: 'not found' }));
}).listen(3000, () => {
  console.log('✅ Mock server running on http://127.0.0.1:3000');
  console.log('   GET /api/admin/finance -> returns mock finance data');
});
