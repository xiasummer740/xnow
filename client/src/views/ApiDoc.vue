<template>
  <div class="max-w-6xl mx-auto pb-20 relative z-10 font-sans">
    <div class="mb-8 border-b border-slate-700 pb-6">
      <h2 class="text-3xl font-black text-white flex items-center tracking-wide"><span class="mr-3 text-blue-400">🔌</span> 开发者 API</h2>
      <p class="text-slate-400 text-sm mt-3">完全兼容通用 SMM 规范，随时随地自动化您的商业帝国。</p>
    </div>

    <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900/20 p-8 rounded-3xl border border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.15)] mb-8 relative overflow-hidden">
      <div class="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-[50px] pointer-events-none z-0"></div>
      
      <h3 class="text-lg font-bold text-white mb-4 relative z-10">API 连接凭证</h3>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
        <div><div class="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">请求方式 (Method)</div><div class="text-white font-mono bg-slate-900 px-3 py-1.5 rounded inline-block">POST</div></div>
        <div class="md:col-span-2"><div class="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">接口地址 (API URL)</div><div class="text-green-400 font-mono bg-slate-900 px-3 py-1.5 rounded inline-block border border-green-500/30 w-full overflow-x-auto">{{ apiBase }}/api/v2</div></div>
        <div><div class="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">返回格式 (Format)</div><div class="text-white font-mono bg-slate-900 px-3 py-1.5 rounded inline-block">JSON</div></div>
        <div class="md:col-span-4 mt-2">
          <div class="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">API 密钥 (API Key) - 请妥善保管</div>
          <div class="flex flex-col sm:flex-row items-center gap-3 bg-slate-900 p-3 rounded-lg border border-amber-500/30 relative z-10">
            <code class="text-amber-400 font-mono text-sm break-all flex-1">{{ userStore.userInfo?.api_key || '您尚未生成密钥' }}</code>
            
            <div class="flex space-x-2 w-full sm:w-auto relative z-20">
              <button @click="copyKey" class="cursor-pointer flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-md transition shadow whitespace-nowrap">一键复制</button>
              <button @click="regenerateKey" class="cursor-pointer flex-1 sm:flex-none px-4 py-2 bg-red-900/50 hover:bg-red-600 border border-red-500/50 text-white text-xs font-bold rounded-md transition shadow whitespace-nowrap">重新生成</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-6 relative z-10">
      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div class="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center justify-between"><h4 class="font-bold text-white font-mono text-lg">获取服务列表 (Service list)</h4></div>
        <div class="p-6">
          <table class="w-full text-left text-sm text-slate-300 mb-4 border border-slate-700 rounded-lg"><thead class="bg-slate-900 text-xs"><tr><th class="p-3 w-1/4">参数 (Parameters)</th><th class="p-3">说明 (Description)</th></tr></thead><tbody class="divide-y divide-slate-700"><tr><td class="p-3 font-mono text-amber-400">key</td><td class="p-3">您的 API 密钥</td></tr><tr><td class="p-3 font-mono text-amber-400">action</td><td class="p-3"><code>services</code></td></tr></tbody></table>
          <div class="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">返回示例 (Example response)</div>
          <pre class="bg-[#0f172a] text-green-400 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-slate-700">
[
    {
        "service": 1,
        "name": "Followers",
        "type": "Default",
        "category": "First Category",
        "rate": "0.90",
        "min": "50",
        "max": "10000",
        "refill": true,
        "cancel": true
    }
]</pre>
        </div>
      </div>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div class="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center justify-between"><h4 class="font-bold text-white font-mono text-lg">提交订单 (Add order)</h4></div>
        <div class="p-6">
          <table class="w-full text-left text-sm text-slate-300 mb-4 border border-slate-700 rounded-lg"><thead class="bg-slate-900 text-xs"><tr><th class="p-3 w-1/4">参数 (Parameters)</th><th class="p-3">说明 (Description)</th></tr></thead><tbody class="divide-y divide-slate-700"><tr><td class="p-3 font-mono text-amber-400">key</td><td class="p-3">您的 API 密钥</td></tr><tr><td class="p-3 font-mono text-amber-400">action</td><td class="p-3"><code>add</code></td></tr><tr><td class="p-3 font-mono text-amber-400">service</td><td class="p-3">服务 ID</td></tr><tr><td class="p-3 font-mono text-amber-400">link</td><td class="p-3">目标链接</td></tr><tr><td class="p-3 font-mono text-amber-400">quantity</td><td class="p-3">下单数量</td></tr></tbody></table>
          <div class="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">返回示例 (Example response)</div>
          <pre class="bg-[#0f172a] text-green-400 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-slate-700">
{
    "order": 23501
}</pre>
        </div>
      </div>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div class="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center justify-between"><h4 class="font-bold text-white font-mono text-lg">查询订单状态 (Order status)</h4></div>
        <div class="p-6">
          <table class="w-full text-left text-sm text-slate-300 mb-4 border border-slate-700 rounded-lg"><thead class="bg-slate-900 text-xs"><tr><th class="p-3 w-1/4">参数 (Parameters)</th><th class="p-3">说明 (Description)</th></tr></thead><tbody class="divide-y divide-slate-700"><tr><td class="p-3 font-mono text-amber-400">key</td><td class="p-3">您的 API 密钥</td></tr><tr><td class="p-3 font-mono text-amber-400">action</td><td class="p-3"><code>status</code></td></tr><tr><td class="p-3 font-mono text-amber-400">order</td><td class="p-3">订单 ID</td></tr></tbody></table>
          <div class="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">返回示例 (Example response)</div>
          <pre class="bg-[#0f172a] text-green-400 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-slate-700">
{
    "charge": "2.78",
    "start_count": "3572",
    "status": "Partial",
    "remains": "157",
    "currency": "CNY"
}</pre>
        </div>
      </div>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div class="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center justify-between"><h4 class="font-bold text-white font-mono text-lg">查询余额 (User balance)</h4></div>
        <div class="p-6">
          <table class="w-full text-left text-sm text-slate-300 mb-4 border border-slate-700 rounded-lg"><thead class="bg-slate-900 text-xs"><tr><th class="p-3 w-1/4">参数 (Parameters)</th><th class="p-3">说明 (Description)</th></tr></thead><tbody class="divide-y divide-slate-700"><tr><td class="p-3 font-mono text-amber-400">key</td><td class="p-3">您的 API 密钥</td></tr><tr><td class="p-3 font-mono text-amber-400">action</td><td class="p-3"><code>balance</code></td></tr></tbody></table>
          <div class="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">返回示例 (Example response)</div>
          <pre class="bg-[#0f172a] text-green-400 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-slate-700">
{
    "balance": "100.84",
    "currency": "CNY"
}</pre>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { useUserStore } from '../stores/user';
import { useAppStore } from '../stores/app';
import { useUiStore } from '../stores/ui';

const userStore = useUserStore(); 
const appStore = useAppStore();
const uiStore = useUiStore();

// 🔒 分站必须显示自己的接口地址：站长把 API 文档发给客户时，
//    写死平台域名等于直接告诉客户"他去哪进货"，也等于把客户导回主站。
const apiBase = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : ''

const copyKey = () => { 
  if(userStore.userInfo?.api_key){ 
    navigator.clipboard.writeText(userStore.userInfo.api_key); 
    uiStore.showToast('密钥已复制到剪贴板', 'success');
  } 
};

const regenerateKey = async () => {
    const confirmed = await uiStore.showConfirm('重置密钥将导致您现有的 API 对接全部失效，确定继续吗？', '高危操作确认');
    if(confirmed) {
        try {
            const res = await fetch('/api/user/regenerate-key', { method: 'POST', headers: { 'Authorization': `Bearer ${userStore.token}` } });
            const data = await res.json();
            if(data.status === 'success') { 
                userStore.updateUserInfo({ api_key: data.api_key });
                uiStore.showToast('密钥已成功重置', 'success'); 
            } else { 
                uiStore.showToast('重置失败', 'error');
            }
        } catch(e) { 
            uiStore.showToast('网络异常', 'error');
        }
    }
};
</script>
