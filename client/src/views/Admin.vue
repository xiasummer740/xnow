<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui'; 
import { useAppStore } from '../stores/app';

const userStore = useUserStore(); const ui = useUiStore(); const app = useAppStore();
const loading = ref(false); const syncing = ref(false); const editorRef = ref(null);
const data = ref({ upstreamBalance: { balance: '0.00' }, users: [], orders: [], transactions: [], config: {}, totalOrders: 0 });

const form = ref({
    global_multiplier: 2.0, agent_discount: 0.8, announcement: '', site_name: 'XNOW', site_logo: '/logo.png',
    upstream_url: '', upstream_key: '', tg_bot_token: '', tg_chat_id: '', tg_bot_link: 'https://t.me/Xnow001Bot',
    cryptomus_id: '', cryptomus_key: '', bufpay_id: '', bufpay_key: '', smtp_host: '', smtp_port: '', smtp_email: '', smtp_pass: '', usdt_image_url: '',
    ip_blacklist: '' // 💡 新增 WAF 黑名单配置绑定
});

const fundModal = ref({ show: false, userId: null, phone: '', type: 'add', amount: 100 });
const roleModal = ref({ show: false, userId: null, phone: '', role: 'user', currentExpire: null, addDays: 0 });
const deleteUserModal = ref({ show: false, userId: null, phone: '', confirmText: '' });

const searchTx = ref(''); const pageTx = ref(1); const sizeTx = ref(10);
const filteredTx = computed(() => { if (!searchTx.value) return data.value.transactions || []; const lower = searchTx.value.toLowerCase(); return data.value.transactions.filter(t => String(t.user_id).includes(lower) || String(t.phone).includes(lower) || String(t.description).toLowerCase().includes(lower)); });
const totalPageTx = computed(() => Math.ceil(filteredTx.value.length / sizeTx.value) || 1);
const pagedTx = computed(() => { const start = (pageTx.value - 1) * sizeTx.value; return filteredTx.value.slice(start, start + sizeTx.value); });
watch([searchTx, sizeTx], () => pageTx.value = 1);

const searchUser = ref(''); const pageUser = ref(1); const sizeUser = ref(10);
const filteredUsers = computed(() => { if (!searchUser.value) return data.value.users || []; const lower = searchUser.value.toLowerCase(); return data.value.users.filter(u => String(u.id).includes(lower) || String(u.phone).includes(lower) || String(u.register_ip).includes(lower) || (u.email && String(u.email).toLowerCase().includes(lower))); });
const totalPageUser = computed(() => Math.ceil(filteredUsers.value.length / sizeUser.value) || 1);
const pagedUsers = computed(() => { const start = (pageUser.value - 1) * sizeUser.value; return filteredUsers.value.slice(start, start + sizeUser.value); });
watch([searchUser, sizeUser], () => pageUser.value = 1);

const searchOrder = ref(''); const pageOrder = ref(1); const sizeOrder = ref(10);
const filteredOrders = computed(() => { if (!searchOrder.value) return data.value.orders || []; const lower = searchOrder.value.toLowerCase(); return data.value.orders.filter(o => String(o.order_no).toLowerCase().includes(lower) || String(o.service_name).toLowerCase().includes(lower) || String(o.user_id).includes(lower)); });
const totalPageOrder = computed(() => Math.ceil(filteredOrders.value.length / sizeOrder.value) || 1);
const pagedOrders = computed(() => { const start = (pageOrder.value - 1) * sizeOrder.value; return filteredOrders.value.slice(start, start + sizeOrder.value); });
watch([searchOrder, sizeOrder], () => pageOrder.value = 1);

const formatTime = (isoString) => { if (!isoString) return '--'; try { return new Date(isoString).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }); } catch (e) { return isoString; } };

const fetchDashboard = async (showLoading = true) => {
    if (showLoading) loading.value = true;
    try {
        const res = await fetch(`/api/admin/dashboard?_t=${new Date().getTime()}`, { headers: { 'Authorization': `Bearer ${userStore.token}`, 'Cache-Control': 'no-store' } });
        const json = await res.json();
        if (json.status === 'success') {
            data.value = json;
            if (data.value.users) { data.value.users.forEach(u => { u.customInput = u.custom_multiplier; }); }
            if (showLoading && json.config) {
                Object.keys(form.value).forEach(key => { if (json.config[key] !== undefined) form.value[key] = json.config[key]; });
                if (editorRef.value && !editorRef.value.innerHTML) { editorRef.value.innerHTML = form.value.announcement; }
            }
        }
    } catch (e) { ui.showToast('数据同步失败', 'error'); } finally { if (showLoading) loading.value = false; syncing.value = false; }
};

const saveConfig = async () => { try { await fetch('/api/admin/config/update', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` }, body: JSON.stringify(form.value) }); ui.showToast('系统全局配置已保存', 'success'); app.fetchConfig(); } catch (e) { ui.showToast('保存失败', 'error'); } };
const handleLogoUpload = (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { form.value.site_logo = e.target.result; ui.showToast('Logo 读取成功，请点击保存', 'success'); }; reader.readAsDataURL(file); };
const execCmd = (cmd, val = null) => { document.execCommand(cmd, false, val); syncEditorContent(); };
const syncEditorContent = () => { if (editorRef.value) form.value.announcement = editorRef.value.innerHTML; };
const insertLink = () => { const url = prompt('请输入链接地址 (需包含 http:// 或 https://):', 'https://'); if (url) execCmd('createLink', url); };
const insertImage = () => { const url = prompt('请输入图片网络地址 (URL):', 'https://'); if (url) execCmd('insertImage', url); };

const openFundModal = (user, type) => { fundModal.value = { show: true, userId: user.id, phone: user.phone, type: type, amount: 100 }; };
const submitFund = async () => {
    if (fundModal.value.amount <= 0) return ui.showToast('金额必须大于0', 'error');
    try {
        const finalAmount = fundModal.value.type === 'add' ? fundModal.value.amount : -fundModal.value.amount;
        await fetch('/api/admin/user/update', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` }, body: JSON.stringify({ userId: fundModal.value.userId, type: 'fund', amount: finalAmount, phone: fundModal.value.phone }) });
        ui.showToast('资金操作成功', 'success'); fundModal.value.show = false; fetchDashboard(false);
    } catch (e) { ui.showToast('操作失败', 'error'); }
};

const getDefaultMultiplier = (u) => {
    const base = parseFloat(form.value.global_multiplier || 2.0);
    const agentDiscount = parseFloat(form.value.agent_discount || 0.8);
    if (u.role === 'admin' || u.role === 'super_admin') return (1.0).toFixed(2);
    if (u.role === 'agent') return (base * agentDiscount).toFixed(2);
    return base.toFixed(2);
};

const saveMultiplier = async (u) => {
    if (!u.customInput || u.customInput <= 0) return ui.showToast('请输入有效倍率', 'error');
    try {
        const res = await fetch('/api/admin/user/update', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` }, body: JSON.stringify({ userId: u.id, type: 'multiplier', multiplier: u.customInput, phone: u.phone }) });
        const json = await res.json();
        if (json.status === 'success') { ui.showToast('倍率自定义生效', 'success'); fetchDashboard(false); }
        else { ui.showToast(json.message || '更新失败', 'error'); }
    } catch (e) { ui.showToast('网络异常', 'error'); }
};

const resetMultiplier = async (u) => {
    try {
        const res = await fetch('/api/admin/user/update', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` }, body: JSON.stringify({ userId: u.id, type: 'multiplier', multiplier: 'default', phone: u.phone }) });
        const json = await res.json();
        if (json.status === 'success') { ui.showToast('已无缝恢复系统默认倍率', 'success'); fetchDashboard(false); }
    } catch (e) {}
};

const openRoleModal = (u) => {
    if (['admin', 'super_admin'].includes(u.role)) return ui.showToast('管理员身份受到神圣保护，不可变动', 'error');
    roleModal.value = { show: true, userId: u.id, phone: u.phone, role: u.role, currentExpire: u.vip_expire_at, addDays: 0 };
};

const submitRole = async () => {
    try {
        const res = await fetch('/api/admin/user/role', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` }, body: JSON.stringify({ userId: roleModal.value.userId, role: roleModal.value.role, addDays: roleModal.value.addDays }) });
        const json = await res.json();
        if (json.status === 'success') { ui.showToast('特权与时长调度成功', 'success'); roleModal.value.show = false; fetchDashboard(false); }
        else { ui.showToast(json.message || '调度失败', 'error'); }
    } catch (e) { ui.showToast('网络请求异常', 'error'); }
};

const openDeleteUserModal = (u) => {
    if (String(u.id) === String(userStore.userInfo?.id)) return ui.showToast('系统安全：无法对自己执行核爆操作', 'error');
    if (u.role === 'super_admin') return ui.showToast('系统安全：至尊管理员受到底层神圣保护，不可被删除', 'error');
    if (userStore.userInfo?.role === 'admin' && u.role === 'admin') return ui.showToast('越权警告：普通管理员无法处决同级管理员', 'error');
    deleteUserModal.value = { show: true, userId: u.id, phone: u.phone, confirmText: '' };
};

const submitDeleteUser = async () => {
    if (deleteUserModal.value.confirmText !== '执行死刑') return;
    try {
        const res = await fetch('/api/admin/user/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` }, body: JSON.stringify({ userId: deleteUserModal.value.userId }) });
        const json = await res.json();
        if (json.status === 'success') { ui.showToast('账号及所有关联流水已被系统彻底物理销毁！', 'success'); deleteUserModal.value.show = false; fetchDashboard(false); } 
        else { ui.showToast(json.message || '处决失败', 'error'); }
    } catch (e) { ui.showToast('网络请求异常', 'error'); }
};

// 💡 核心风控：快速切换封禁状态
const toggleBan = async (u) => {
    const isBanAction = !u.is_banned;
    let reason = '';
    if (isBanAction) {
        reason = prompt(`🚨 请输入封禁 UID ${u.id} 的原因 (必填):`, '恶意违规操作');
        if (reason === null) return; 
    } else {
        if (!confirm(`确定要解封 UID ${u.id} (${u.phone}) 吗？`)) return;
    }

    try {
        const res = await fetch('/api/admin/user/ban', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
            body: JSON.stringify({ userId: u.id, reason })
        });
        const json = await res.json();
        if (json.status === 'success') { ui.showToast(json.message, 'success'); fetchDashboard(false); } 
        else { ui.showToast(json.message || '操作失败', 'error'); }
    } catch (e) { ui.showToast('网络异常', 'error'); }
};

let refreshTimer = null; watch(() => app.globalRefreshTrigger, () => fetchDashboard(false));
onMounted(() => { fetchDashboard(true); refreshTimer = setInterval(() => { syncing.value = true; fetchDashboard(false); }, 10000); });
onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer); });
</script>

<template>
    <div class="max-w-7xl mx-auto space-y-6 pb-20 relative z-10">
        <div v-if="loading" class="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center pt-32 rounded-3xl"><div class="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(251,191,36,0.5)]"></div><div class="text-amber-400 font-black mt-6 text-lg tracking-widest animate-pulse">正在与上游进行绝对实时同步...</div><div class="text-slate-400 text-xs mt-2">拉取最新数据中，请稍候</div></div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div class="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl shadow-lg relative overflow-hidden"><div class="absolute -right-4 -top-4 text-green-500/10 text-8xl">💰</div><div class="text-slate-400 text-xs font-bold mb-1 flex items-center justify-between"><span>上游余额 (API)</span><span v-if="syncing" class="text-[9px] text-amber-500 font-bold animate-pulse">⏳ 同步中...</span><span v-else class="flex items-center text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/30"><span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse mr-1"></span>LIVE</span></div><div class="text-3xl font-black text-green-400 font-mono mt-2">{{ data.upstreamBalance?.balance || '0.00' }}</div></div>
            <div class="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl shadow-lg relative overflow-hidden"><div class="absolute -right-4 -top-4 text-amber-500/10 text-8xl">🏦</div><div class="text-slate-400 text-xs font-bold mb-1">本站玩家金库汇总</div><div class="text-3xl font-black text-amber-400 font-mono mt-2">{{ app.formatMoney(data.users ? data.users.reduce((acc, u) => acc + parseFloat(u.balance || 0), 0) : 0) }}</div></div>
            <div class="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl shadow-lg relative overflow-hidden"><div class="absolute -right-4 -top-4 text-blue-500/10 text-8xl">📈</div><div class="text-slate-400 text-xs font-bold mb-1">实时汇率 (USD/CNY)</div><div class="text-3xl font-black text-blue-400 font-mono mt-2 flex items-baseline">{{ app.exchangeRate }}</div></div>
            <div class="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl shadow-lg relative overflow-hidden"><div class="absolute -right-4 -top-4 text-purple-500/10 text-8xl">📦</div><div class="text-slate-400 text-xs font-bold mb-1">全站累计处理订单</div><div class="text-3xl font-black text-purple-400 font-mono mt-2">{{ data.totalOrders || '0' }}</div></div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-slate-800/80 border border-slate-700 p-6 rounded-3xl shadow-xl flex flex-col justify-between space-y-6">
                <div>
                    <h3 class="text-lg font-bold text-white mb-6 flex items-center"><span class="text-amber-400 mr-2">⚙️</span> 全局价格与折扣调控中枢</h3>
                    <div class="flex justify-between items-end mb-2"><span class="text-sm text-slate-400">全局基础销售倍率 (1-10x)</span><span class="text-2xl font-black text-amber-400">{{ form.global_multiplier }}x</span></div>
                    <input type="range" min="1" max="10" step="0.1" v-model="form.global_multiplier" class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400 mb-6">
                    <div class="flex justify-between items-end mb-2"><span class="text-sm text-slate-400">至尊代理专属折扣 (折上折比例)</span><span class="text-xl font-black text-emerald-400">{{ Math.round(form.agent_discount * 100) }}% ({{ form.agent_discount * 10 }} 折)</span></div>
                    <input type="range" min="0.1" max="1.0" step="0.05" v-model="form.agent_discount" class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400 mb-8">
                    <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-3">
                        <div class="flex justify-between items-center"><span class="badge-agent px-2 py-0.5 text-[10px]">至尊代理 ({{ Math.round(form.agent_discount * 100) }}%)</span><span class="font-mono font-bold text-emerald-400">x {{ (form.global_multiplier * form.agent_discount).toFixed(2) }}</span></div>
                        <div class="flex justify-between items-center"><span class="badge-gold px-2 py-0.5 text-[10px]">黄金用户</span><span class="font-mono font-bold text-slate-300">x {{ parseFloat(form.global_multiplier).toFixed(2) }}</span></div>
                    </div>
                </div>
                <div class="border-t border-slate-700 pt-6">
                    <h3 class="text-sm font-bold text-white mb-4 flex items-center"><span class="text-blue-400 mr-2">🎨</span> 网站品牌定制</h3>
                    <div class="space-y-4">
                        <div><label class="block text-xs text-slate-400 mb-1">网站名称</label><input type="text" v-model="form.site_name" class="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none text-sm focus:border-amber-400 transition"></div>
                        <div><label class="block text-xs text-slate-400 mb-2">自定义 Logo</label><div class="flex items-center space-x-4"><img v-if="form.site_logo" :src="form.site_logo" class="max-h-12 max-w-[120px] object-contain bg-slate-800 p-1 rounded border border-slate-600"><div class="relative overflow-hidden bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2 px-4 rounded-lg cursor-pointer transition"><span>上传本地图片</span><input type="file" accept="image/*" @change="handleLogoUpload" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"></div></div></div>
                    </div>
                </div>
                <button @click="saveConfig" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition shadow-[0_0_15px_rgba(37,99,235,0.4)]">保存全局价格与品牌</button>
            </div>

            <div class="bg-slate-800/80 border border-slate-700 p-6 rounded-3xl shadow-xl flex flex-col">
                <h3 class="text-lg font-bold text-white mb-4 flex items-center"><span class="text-pink-500 mr-2">📢</span> 全站公告编辑</h3>
                <div class="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-2 rounded-t-xl border border-slate-600 border-b-0 select-none">
                    <button @click="execCmd('bold')" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white font-bold text-xs shadow-sm" title="加粗">B</button><button @click="execCmd('italic')" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white italic text-xs shadow-sm" title="斜体">I</button><button @click="execCmd('underline')" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white underline text-xs shadow-sm" title="下划线">U</button><button @click="execCmd('strikeThrough')" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white line-through text-xs shadow-sm" title="删除线">S</button><div class="w-px h-4 bg-slate-600 mx-1"></div><button @click="execCmd('justifyLeft')" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs shadow-sm" title="左对齐">⇤</button><button @click="execCmd('justifyCenter')" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs shadow-sm" title="居中">⇥⇤</button><button @click="execCmd('justifyRight')" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs shadow-sm" title="右对齐">⇥</button><div class="w-px h-4 bg-slate-600 mx-1"></div><button @click="execCmd('insertUnorderedList')" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs shadow-sm" title="无序列表">•</button><button @click="execCmd('insertOrderedList')" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs shadow-sm" title="有序列表">1.</button><div class="w-px h-4 bg-slate-600 mx-1"></div><select @change="e => { execCmd('fontSize', e.target.value); e.target.selectedIndex=0 }" class="bg-slate-700 text-white text-xs rounded px-1 py-1 outline-none shadow-sm cursor-pointer"><option value="">字号</option><option value="1">极小</option><option value="3">标准</option><option value="5">大</option><option value="7">特大</option></select><select @change="e => { execCmd('foreColor', e.target.value); e.target.selectedIndex=0 }" class="bg-slate-700 text-white text-xs rounded px-1 py-1 outline-none shadow-sm cursor-pointer"><option value="">A 颜色</option><option value="#ef4444">🔴 红</option><option value="#f59e0b">🟠 橙</option><option value="#fbbf24">🟡 黄</option><option value="#22c55e">🟢 绿</option><option value="#3b82f6">🔵 蓝</option><option value="#a855f7">🟣 紫</option><option value="#ffffff">⚪ 白</option></select><select @change="e => { execCmd('hiliteColor', e.target.value); e.target.selectedIndex=0 }" class="bg-slate-700 text-white text-xs rounded px-1 py-1 outline-none shadow-sm cursor-pointer"><option value="">背景色</option><option value="#ef4444">🔴 红</option><option value="#f59e0b">🟠 橙</option><option value="#fbbf24">🟡 黄</option><option value="#22c55e">🟢 绿</option><option value="#3b82f6">🔵 蓝</option><option value="#1e293b">⚫ 黑</option></select><div class="w-px h-4 bg-slate-600 mx-1"></div><button @click="insertLink" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs shadow-sm" title="插入链接">🔗</button><button @click="insertImage" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs shadow-sm" title="插入图片">🖼️</button><button @click="execCmd('removeFormat')" class="px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded text-xs ml-auto border border-red-500/30 transition shadow-sm" title="清除格式">🧹 清除格式</button>
                </div>
                <div ref="editorRef" contenteditable="true" @input="syncEditorContent" @blur="syncEditorContent" class="w-full h-48 bg-slate-900/80 border border-slate-600 rounded-b-xl p-4 text-slate-200 outline-none focus:border-pink-500 transition overflow-y-auto custom-scrollbar mb-3 text-sm leading-relaxed" style="min-height: 12rem;"></div>
                
                <div class="flex justify-between items-center mb-6">
                    <span class="text-xs text-slate-500">超强富媒体支持，图文并茂</span>
                    <button @click="saveConfig" class="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-black transition shadow-[0_0_15px_rgba(251,191,36,0.3)]">同步发布公告</button>
                </div>

                <hr class="border-slate-700 mb-4">

                <div>
                    <h4 class="text-sm font-bold text-slate-300 mb-3 flex items-center"><span class="text-green-400 mr-2">🖼️</span> USDT 专属教程图配置</h4>
                    <div class="flex space-x-3">
                        <input type="text" v-model="form.usdt_image_url" placeholder="在此粘贴教程图片直链 (例如: https://...)" class="flex-grow bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-400 transition font-mono text-sm">
                        <button @click="saveConfig" class="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition shadow-sm whitespace-nowrap">保存图片</button>
                    </div>
                    <p class="text-[10px] text-slate-500 mt-2">用户在充值页选择 USDT 时，下方将展示该图片。鼠标悬停可放大预览。</p>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div class="bg-slate-800/80 border border-slate-700 p-6 md:p-8 rounded-3xl shadow-xl flex flex-col gap-6 w-full">
                <div class="flex items-center space-x-4 border-b border-slate-700 pb-4"><div class="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 text-2xl shrink-0">⚡</div><div><h3 class="text-white font-bold text-lg md:text-xl tracking-wide">核心系统连接配置 (System Core)</h3><p class="text-xs text-slate-400 mt-1">第三方服务参数配置中心 (管理员填入后生效)</p></div></div>
                <div class="grid grid-cols-1 gap-y-6 w-full">
                    <div class="space-y-3 bg-slate-900/30 p-5 rounded-2xl border border-slate-700/50"><h4 class="text-amber-400 font-bold text-sm flex items-center"><span class="mr-2">🔌</span> 上游货源 (API)</h4><input type="text" v-model="form.upstream_url" placeholder="API URL" class="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-amber-400 transition font-mono text-sm"><input type="password" v-model="form.upstream_key" placeholder="API Key" class="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-amber-400 transition font-mono text-sm"></div>
                    <div class="space-y-3 bg-slate-900/30 p-5 rounded-2xl border border-slate-700/50"><h4 class="text-blue-400 font-bold text-sm flex items-center"><span class="mr-2">🤖</span> TELEGRAM 机器人</h4><div class="grid grid-cols-2 gap-3"><input type="text" v-model="form.tg_bot_token" placeholder="Bot Token" class="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-blue-400 transition font-mono text-sm"><input type="text" v-model="form.tg_chat_id" placeholder="Chat ID" class="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-blue-400 transition font-mono text-sm"></div><input type="text" v-model="form.tg_bot_link" placeholder="Bot Link" class="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-blue-400 transition font-mono text-sm"></div>
                    <div class="space-y-3 bg-slate-900/30 p-5 rounded-2xl border border-slate-700/50"><h4 class="text-emerald-400 font-bold text-sm flex items-center"><span class="mr-2">💳</span> 支付网关</h4><div class="flex space-x-2"><input type="text" v-model="form.cryptomus_id" placeholder="Cryptomus ID" class="w-1/3 bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-emerald-400 text-sm"><input type="password" v-model="form.cryptomus_key" placeholder="Key" class="w-2/3 bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-emerald-400 text-sm"></div><div class="flex space-x-2"><input type="text" v-model="form.bufpay_id" placeholder="BufPay ID" class="w-1/3 bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-emerald-400 text-sm"><input type="password" v-model="form.bufpay_key" placeholder="Secret" class="w-2/3 bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-emerald-400 text-sm"></div></div>
                    <div class="space-y-3 bg-slate-900/30 p-5 rounded-2xl border border-slate-700/50"><h4 class="text-purple-400 font-bold text-sm flex items-center"><span class="mr-2">📧</span> 邮件服务 (SMTP)</h4><div class="grid grid-cols-2 gap-3"><input type="text" v-model="form.smtp_host" placeholder="Host" class="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-purple-400 text-sm"><input type="text" v-model="form.smtp_port" placeholder="Port" class="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-purple-400 text-sm"></div><div class="grid grid-cols-2 gap-3"><input type="text" v-model="form.smtp_email" placeholder="Email" class="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-purple-400 text-sm"><input type="password" v-model="form.smtp_pass" placeholder="Pass" class="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-purple-400 text-sm"></div></div>
                </div>
                <button @click="saveConfig" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-lg py-4 rounded-xl transition shadow-[0_10px_30px_rgba(79,70,229,0.3)] transform hover:-translate-y-1 tracking-wider mt-auto">保存系统配置</button>
            </div>

            <div class="bg-slate-800/80 border border-red-500/30 p-6 md:p-8 rounded-3xl shadow-[0_0_30px_rgba(239,68,68,0.1)] flex flex-col gap-4 w-full relative overflow-hidden">
                <div class="absolute -right-10 -top-10 text-9xl opacity-5">🛑</div>
                <div class="flex items-center space-x-4 border-b border-red-500/30 pb-4">
                    <div class="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 text-2xl shrink-0 shadow-[0_0_15px_rgba(239,68,68,0.5)]">🛡️</div>
                    <div>
                        <h3 class="text-red-400 font-black text-lg md:text-xl tracking-wide">WAF 数字护城河 (IP 封禁)</h3>
                        <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">在此输入恶意请求 IP，每行一个。保存后全局拦截立即生效，被禁 IP 访问任何接口将直接遭受 403 惩罚，不消耗数据库资源。</p>
                    </div>
                </div>
                <textarea v-model="form.ip_blacklist" class="w-full h-full min-h-[400px] bg-slate-900/80 border border-red-500/50 rounded-xl p-4 text-red-400 font-mono text-sm outline-none focus:border-red-400 transition shadow-inner leading-relaxed custom-scrollbar" placeholder="输入格式示例:\n192.168.1.1\n8.8.8.8"></textarea>
                <button @click="saveConfig" class="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-lg py-4 rounded-xl transition shadow-[0_10px_30px_rgba(220,38,38,0.3)] transform hover:-translate-y-1 tracking-wider mt-auto">挂载全站 IP 拦截网</button>
            </div>
        </div>

        <div class="bg-slate-800/80 border border-slate-700 rounded-3xl shadow-xl overflow-hidden mt-6 relative"><div class="p-6 border-b border-slate-700 flex justify-between items-center"><h3 class="text-lg font-bold text-white flex items-center"><span class="text-blue-400 mr-2">🧾</span> 全站资金流水大盘</h3></div><div class="flex justify-between items-center bg-slate-900/50 p-3 border-b border-slate-700"><input type="text" v-model="searchTx" placeholder="搜索 UID / 账号 / 摘要" class="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs border border-slate-600 focus:border-amber-400 outline-none w-64"><div class="flex items-center space-x-2 text-xs text-slate-400"><span>单页显示</span><select v-model="sizeTx" class="bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 outline-none"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option></select></div></div><div class="overflow-x-auto custom-scrollbar"><table class="w-full text-left text-sm whitespace-nowrap"><thead class="bg-slate-900/50 text-xs uppercase text-slate-400"><tr><th class="px-6 py-4">时间 (Time)</th><th class="px-6 py-4">用户账号</th><th class="px-6 py-4">变动金额</th><th class="px-6 py-4">当前余额</th><th class="px-6 py-4">资金摘要 (类型)</th></tr></thead><tbody class="divide-y divide-slate-700/50 text-slate-200"><tr v-for="t in pagedTx" :key="t.id" class="hover:bg-slate-700/30 transition"><td class="px-6 py-4 font-mono text-xs text-amber-400/80 font-bold">{{ formatTime(t.createdAt || t.created_at) }}</td><td class="px-6 py-4 font-bold text-white"><div class="flex items-center"><span class="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] mr-2">UID {{ t.user_id }}</span>{{ t.phone || '未知' }}</div></td><td class="px-6 py-4 font-mono font-bold" :class="t.amount > 0 ? 'text-green-400' : 'text-red-400'">{{ t.amount > 0 ? '+' : '' }}{{ t.amount }}</td><td class="px-6 py-4 font-mono text-amber-400 font-bold">{{ t.balance != null ? app.formatMoney(t.balance) : '--' }}</td><td class="px-6 py-4 text-xs"><span class="text-slate-300 font-bold mr-2">{{ t.description }}</span><span class="text-slate-500 font-mono">({{ t.type }})</span></td></tr><tr v-if="pagedTx.length === 0"><td colspan="5" class="text-center py-10 text-slate-500">暂无资金变动记录</td></tr></tbody></table></div><div class="flex justify-between items-center p-3 bg-slate-900/50 border-t border-slate-700"><span class="text-xs text-slate-400">共 {{ filteredTx.length }} 条记录，第 {{ pageTx }} / {{ totalPageTx }} 页</span><div class="flex space-x-2"><button @click="pageTx > 1 && pageTx--" :disabled="pageTx === 1" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs disabled:opacity-50 transition">上一页</button><button @click="pageTx < totalPageTx && pageTx++" :disabled="pageTx === totalPageTx" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs disabled:opacity-50 transition">下一页</button></div></div></div>

        <div class="bg-slate-800/80 border border-slate-700 rounded-3xl shadow-xl overflow-hidden mt-6"><div class="p-6 border-b border-slate-700 flex justify-between items-center"><h3 class="text-lg font-bold text-white flex items-center"><span class="text-blue-400 mr-2">👥</span> 全站用户监控与资金管理</h3></div><div class="flex justify-between items-center bg-slate-900/50 p-3 border-b border-slate-700"><input type="text" v-model="searchUser" placeholder="搜索 UID / 账号 / 邮箱 / IP" class="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs border border-slate-600 focus:border-amber-400 outline-none w-64"></div><div class="overflow-x-auto custom-scrollbar"><table class="w-full text-left text-sm whitespace-nowrap"><thead class="bg-slate-900/50 text-xs uppercase text-slate-400"><tr><th class="px-6 py-4">UID/账号/邮箱/注册IP与时间</th><th class="px-6 py-4">最后登录 IP</th><th class="px-6 py-4">等级/状态</th><th class="px-6 py-4">当前余额</th><th class="px-6 py-4">专属倍率</th><th class="px-6 py-4 text-center">操作</th></tr></thead><tbody class="divide-y divide-slate-700/50 text-slate-200"><tr v-for="u in pagedUsers" :key="u.id" :class="['hover:bg-slate-700/30 transition', u.is_banned ? 'bg-red-900/20 opacity-80' : '']"><td class="px-6 py-4"><div class="font-bold text-white mb-1 flex items-center"><span class="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] mr-2">UID {{ u.id }}</span><span :class="u.is_banned ? 'line-through text-red-400' : ''">{{ u.phone }}</span></div><div class="text-[10px] text-blue-400 font-mono tracking-tighter mb-0.5 flex items-center"><span class="mr-1">📧</span> {{ u.email || '未绑定邮箱' }}</div><div class="text-[10px] text-slate-500 font-mono tracking-tighter">注册IP: {{ u.register_ip || '未知' }} | {{ formatTime(u.createdAt || u.created_at) }}</div></td><td class="px-6 py-4"><div class="text-xs font-mono text-amber-400/80 mb-1">{{ u.last_login_ip || '未登录' }}</div><div v-if="u.last_login_at" class="text-[10px] text-slate-500 font-mono tracking-tighter flex items-center"><span class="mr-1">🕒</span> {{ formatTime(u.last_login_at) }}</div></td><td class="px-6 py-4"><div v-if="u.role === 'super_admin'" class="x-badge badge-super inline-flex items-center"><span class="badge-shimmer"></span>{{ app.t('super_admin_badge') || '至尊管理员' }}</div><div v-else-if="u.role === 'admin'" class="x-badge badge-admin inline-flex items-center"><span class="badge-shimmer"></span>{{ app.t('admin_badge') || '管理员' }}</div><div v-else-if="u.role === 'agent'" class="flex flex-col items-start"><div class="x-badge badge-agent inline-flex items-center mb-1"><span class="badge-shimmer"></span>{{ app.t('agent_badge') || '代理' }}</div><div class="text-[9px] text-slate-500">{{ u.vip_expire_at ? new Date(u.vip_expire_at).toLocaleDateString() : '无期限' }}</div></div><div v-else class="x-badge badge-gold inline-flex items-center"><span class="badge-shimmer"></span>{{ app.t('gold_badge') || '黄金用户' }}</div><div v-if="u.is_banned" class="mt-2 text-[10px] font-black text-red-500 bg-red-500/10 px-2 py-1 rounded border border-red-500/30 w-max tracking-widest">🚨 账号已封禁</div></td><td class="px-6 py-4 font-mono text-amber-400 font-bold text-lg bg-slate-900/30">{{ app.formatMoney(u.balance) }}</td><td class="px-6 py-4"><div v-if="['admin', 'super_admin'].includes(u.role)" class="flex flex-col space-y-2"><div class="flex space-x-1.5 items-center"><input type="text" disabled value="1.00" class="w-24 bg-slate-900/50 border border-slate-700/50 rounded-lg py-1.5 px-2 text-center text-xs text-slate-600 font-mono cursor-not-allowed"><span class="text-[10px] text-slate-500 font-bold px-2 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700">🔒 锁定</span></div><div class="text-[10px] text-slate-500">目前生效: <span class="text-slate-400 font-bold tracking-wide">1.00x (原价)</span></div></div><div v-else class="flex flex-col space-y-2"><div class="flex space-x-1.5 items-center"><input type="number" v-model="u.customInput" :placeholder="getDefaultMultiplier(u) + ' (默认)'" step="0.1" class="w-24 bg-slate-900 border border-slate-600 rounded-lg py-1.5 px-2 text-center text-xs outline-none focus:border-amber-400 placeholder:text-slate-600 transition shadow-inner font-mono text-white"><button @click="saveMultiplier(u)" class="text-[10px] bg-slate-700 px-3 py-1.5 rounded-lg text-white font-bold transition hover:bg-amber-400 hover:text-black shadow-sm">保存</button><button v-if="u.custom_multiplier" @click="resetMultiplier(u)" class="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg transition hover:bg-red-500 hover:text-white shadow-sm font-bold" title="一键恢复系统默认倍率">恢复</button></div><div class="text-[10px] text-slate-400">目前生效: <span :class="u.custom_multiplier ? 'text-purple-400 font-black tracking-wide' : 'text-emerald-400 font-bold tracking-wide'">{{ u.custom_multiplier ? parseFloat(u.custom_multiplier).toFixed(2) + 'x (已自定义)' : getDefaultMultiplier(u) + 'x (系统默认)' }}</span></div></div></td><td class="px-6 py-4 text-center">
            <div class="flex items-center justify-center space-x-2 mb-2">
                <button v-if="!['admin', 'super_admin'].includes(u.role)" @click="openRoleModal(u)" class="text-xs bg-purple-500/10 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded transition font-bold shadow-[0_0_10px_rgba(168,85,247,0.1)]">👑 提权</button>
                <button @click="openFundModal(u, 'add')" class="text-xs bg-green-500/10 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-3 py-1.5 rounded transition font-bold">+ 加款</button>
                <button @click="openFundModal(u, 'deduct')" class="text-xs bg-amber-500/10 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded transition font-bold">- 扣款</button>
            </div>
            <div class="flex items-center justify-center space-x-2">
                <button v-if="String(u.id) !== String(userStore.userInfo?.id) && u.role !== 'super_admin' && (userStore.userInfo?.role === 'super_admin' || u.role !== 'admin')" @click="toggleBan(u)" :class="['text-xs px-3 py-1.5 rounded transition font-bold shadow', u.is_banned ? 'bg-green-500/10 hover:bg-green-500/30 text-green-400 border border-green-500/30' : 'bg-orange-500/10 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30']">{{ u.is_banned ? '✅ 解除封禁' : '🚫 一键封禁' }}</button>
                <button v-if="String(u.id) !== String(userStore.userInfo?.id) && u.role !== 'super_admin' && (userStore.userInfo?.role === 'super_admin' || u.role !== 'admin')" @click="openDeleteUserModal(u)" class="text-xs bg-red-600/10 hover:bg-red-600/30 text-red-500 border border-red-500/30 px-3 py-1.5 rounded transition font-bold shadow-[0_0_10px_rgba(220,38,38,0.1)]">💀 抹除</button>
            </div>
        </td></tr></tbody></table></div><div class="flex justify-between items-center p-3 bg-slate-900/50 border-t border-slate-700"><span class="text-xs text-slate-400">共 {{ filteredUsers.length }} 位用户，第 {{ pageUser }} / {{ totalPageUser }} 页</span><div class="flex space-x-2"><button @click="pageUser > 1 && pageUser--" :disabled="pageUser === 1" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs disabled:opacity-50 transition">上一页</button><button @click="pageUser < totalPageUser && pageUser++" :disabled="pageUser === totalPageUser" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs disabled:opacity-50 transition">下一页</button></div></div></div>

        <div class="bg-slate-800/80 border border-slate-700 rounded-3xl shadow-xl overflow-hidden mt-6 relative"><div class="p-6 border-b border-slate-700 flex justify-between items-center"><h3 class="text-lg font-bold text-white flex items-center"><span class="text-purple-400 mr-2">📊</span> 全站历史订单监控池</h3><button @click="fetchDashboard(false)" class="text-xs bg-amber-500 hover:bg-amber-600 text-slate-900 font-black px-4 py-2 rounded transition shadow flex items-center">手动强刷大盘</button></div><div class="flex justify-between items-center bg-slate-900/50 p-3 border-b border-slate-700"><input type="text" v-model="searchOrder" placeholder="搜索 订单号 / UID / 服务名" class="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs border border-slate-600 focus:border-amber-400 outline-none w-64"><div class="flex items-center space-x-2 text-xs text-slate-400"><span>单页显示</span><select v-model="sizeOrder" class="bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 outline-none"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option></select></div></div><div class="overflow-x-auto custom-scrollbar"><table class="w-full text-left text-sm whitespace-nowrap"><thead class="bg-slate-900/50 text-xs uppercase text-slate-400"><tr><th class="px-6 py-4">订单号 / 时间</th><th class="px-6 py-4">下单人 UID</th><th class="px-6 py-4 max-w-xs">服务 (ID) / 链接</th><th class="px-6 py-4 text-center">初始 / 数量 / 剩余</th><th class="px-6 py-4">费用</th><th class="px-6 py-4 text-right">上游状态</th></tr></thead><tbody class="divide-y divide-slate-700/50 text-slate-200"><tr v-for="o in pagedOrders" :key="o.id" class="hover:bg-slate-700/30 transition"><td class="px-6 py-4"><div class="font-mono text-xs text-slate-300">{{ o.order_no }}</div><div class="text-[10px] text-amber-500/80 mt-1 font-mono tracking-tighter">{{ formatTime(o.createdAt || o.created_at) }}</div></td><td class="px-6 py-4 font-bold text-white"><div class="text-xs">{{ o.phone || '未知' }}</div><div class="text-[10px] text-slate-500">UID: {{ o.user_id }}</div></td><td class="px-6 py-4" style="max-width: 280px; white-space: normal !important; word-wrap: break-word; word-break: break-all;"><div class="text-xs text-slate-400 mb-1 leading-relaxed"><span v-if="o.service_id" class="text-amber-500 font-bold mr-1">[ID:{{ o.service_id }}]</span><span v-else class="text-slate-500 font-bold mr-1">[ID:无]</span>{{ o.service_name }}</div><a :href="o.link" target="_blank" class="text-[11px] text-blue-400 hover:text-blue-300 transition select-all leading-relaxed block">{{ o.link }}</a></td><td class="px-6 py-4 text-center"><div class="flex items-center justify-center space-x-2 text-xs font-mono bg-slate-900/50 py-1 rounded-lg border border-slate-700/50"><span class="text-slate-500" title="Start">{{ o.start_count || 0 }}</span><span class="text-slate-600">/</span><span class="font-bold text-white" title="Quantity">{{ o.quantity }}</span><span class="text-slate-600">/</span><span class="text-red-400" title="Remains">{{ o.remains || 0 }}</span></div></td><td class="px-6 py-4"><div class="text-xs text-amber-400 font-bold mt-0.5">{{ app.formatMoney(o.charge) }}</div></td><td class="px-6 py-4 text-right"><span class="px-3 py-1 rounded-full text-[10px] font-bold border" :class="o.status === '进行中' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : o.status === '已完成' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'">{{ o.status }}</span></td></tr><tr v-if="pagedOrders.length === 0"><td colspan="6" class="text-center py-10 text-slate-500">暂无订单记录</td></tr></tbody></table></div><div class="flex justify-between items-center p-3 bg-slate-900/50 border-t border-slate-700"><span class="text-xs text-slate-400">共 {{ filteredOrders.length }} 条订单，第 {{ pageOrder }} / {{ totalPageOrder }} 页</span><div class="flex space-x-2"><button @click="pageOrder > 1 && pageOrder--" :disabled="pageOrder === 1" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs disabled:opacity-50 transition">上一页</button><button @click="pageOrder < totalPageOrder && pageOrder++" :disabled="pageOrder === totalPageOrder" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs disabled:opacity-50 transition">下一页</button></div></div></div>

        <div v-if="fundModal.show" class="fixed inset-0 z-[10005] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"><div class="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] max-w-sm w-full relative transform transition-all scale-100"><button @click="fundModal.show = false" class="absolute top-4 right-4 text-slate-400 hover:text-white"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button><h3 class="text-xl font-black text-white mb-2 tracking-wide text-center">资金中心指令</h3><p class="text-slate-400 text-sm mb-6 text-center">目标账户: <span class="text-amber-400 font-bold">{{ fundModal.phone }}</span></p><div class="space-y-4 mb-8"><div><label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">操作金额 (CNY)</label><input type="number" v-model="fundModal.amount" class="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-400 transition font-mono text-lg" placeholder="0.00"></div></div><button @click="submitFund" :class="['w-full font-black text-lg py-3.5 rounded-xl transition transform hover:-translate-y-1 shadow-lg text-slate-900', fundModal.type === 'add' ? 'bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 shadow-[0_0_20px_rgba(251,191,36,0.3)]']">确认{{ fundModal.type === 'add' ? '加款' : '扣款' }}</button></div></div>
        <div v-if="roleModal.show" class="fixed inset-0 z-[10006] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"><div class="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] max-w-md w-full relative transform transition-all scale-100"><button @click="roleModal.show = false" class="absolute top-4 right-4 text-slate-400 hover:text-white"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button><h3 class="text-xl font-black text-white mb-2 tracking-wide text-center">用户特权与等级调度</h3><p class="text-slate-400 text-sm mb-6 text-center">目标账户: <span class="text-amber-400 font-bold">{{ roleModal.phone }}</span></p><div class="space-y-6 mb-8"><div><label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">分配身份</label><div class="grid grid-cols-2 gap-3"><button @click="roleModal.role = 'user'; roleModal.addDays = 0" :class="['py-3 rounded-xl border text-sm font-bold transition', roleModal.role === 'user' ? 'bg-slate-700 border-slate-500 text-white shadow-inner' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800']">黄金用户</button><button @click="roleModal.role = 'agent'" :class="['py-3 rounded-xl border text-sm font-bold transition flex flex-col items-center justify-center', roleModal.role === 'agent' ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)]' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800']">👑 至尊代理</button></div></div><div v-if="roleModal.role === 'agent'" class="animate-fade-in space-y-3 p-4 bg-slate-800/50 rounded-2xl border border-amber-500/20"><div class="flex justify-between items-center"><label class="block text-xs font-bold text-amber-400 uppercase tracking-wider">赠送代理时长 (天)</label><span class="text-[10px] text-slate-400">目前到期: {{ roleModal.currentExpire ? new Date(roleModal.currentExpire).toLocaleDateString() : '无' }}</span></div><div class="grid grid-cols-4 gap-2"><button @click="roleModal.addDays = 7" :class="['py-1.5 rounded-lg border text-xs font-bold transition', roleModal.addDays === 7 ? 'bg-amber-500 text-slate-900 border-amber-400' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600']">+7天</button><button @click="roleModal.addDays = 30" :class="['py-1.5 rounded-lg border text-xs font-bold transition', roleModal.addDays === 30 ? 'bg-amber-500 text-slate-900 border-amber-400' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600']">+1月</button><button @click="roleModal.addDays = 90" :class="['py-1.5 rounded-lg border text-xs font-bold transition', roleModal.addDays === 90 ? 'bg-amber-500 text-slate-900 border-amber-400' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600']">+1季</button><button @click="roleModal.addDays = 365" :class="['py-1.5 rounded-lg border text-xs font-bold transition', roleModal.addDays === 365 ? 'bg-amber-500 text-slate-900 border-amber-400' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600']">+1年</button></div><div class="flex items-center space-x-3 mt-3"><span class="text-xs text-slate-400 whitespace-nowrap">自定义:</span><input type="number" v-model="roleModal.addDays" min="0" class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-amber-400 outline-none focus:border-amber-400 transition font-mono text-sm" placeholder="输入天数"></div><p v-if="roleModal.addDays > 0" class="text-[10px] text-emerald-400 text-right mt-1">将在原时间上自动续期 {{ roleModal.addDays }} 天</p></div></div><button @click="submitRole" class="w-full font-black text-lg py-3.5 rounded-xl transition transform hover:-translate-y-1 shadow-lg text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]">确认调度</button></div></div>
        
        <div v-if="deleteUserModal.show" class="fixed inset-0 z-[10007] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div class="bg-slate-900 border-2 border-red-500/50 p-8 rounded-3xl shadow-[0_0_80px_rgba(239,68,68,0.4)] max-w-md w-full relative transform transition-all scale-100">
            <button @click="deleteUserModal.show = false" class="absolute top-4 right-4 text-slate-400 hover:text-white"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            <div class="text-center mb-6"><div class="text-6xl mb-4">☢️</div><h3 class="text-2xl font-black text-red-500 tracking-wider">警告：强制核爆注销</h3></div>
            <p class="text-slate-300 text-sm mb-6 text-center leading-relaxed">您正在强制抹除用户 <span class="text-amber-400 font-bold font-mono">{{ deleteUserModal.phone }}</span> (UID: {{ deleteUserModal.userId }})。<br><span class="text-red-400 font-bold">此账号及其产生的所有资金记录将被永久物理销毁！</span></p>
            <div class="space-y-4 mb-8">
              <div class="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-center"><span class="text-xs text-slate-400 block mb-2">为防止误操作，请输入下方红字确认：</span><span class="text-lg font-black text-red-500 tracking-widest select-none cursor-not-allowed">执行死刑</span></div>
              <input type="text" v-model="deleteUserModal.confirmText" placeholder="请输入 执行死刑" class="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500 transition font-mono text-center tracking-widest">
            </div>
            <button @click="submitDeleteUser" :disabled="deleteUserModal.confirmText !== '执行死刑'" :class="['w-full font-black text-lg py-3.5 rounded-xl transition shadow-lg flex items-center justify-center space-x-2', deleteUserModal.confirmText === '执行死刑' ? 'bg-red-600 hover:bg-red-500 text-white transform hover:-translate-y-1 shadow-[0_0_20px_rgba(239,68,68,0.6)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed']"><span>💀 强制下达抹除指令</span></button>
          </div>
        </div>

    </div>
</template>
