<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui';
import { useAppStore } from '../stores/app';

const userStore = useUserStore(); const ui = useUiStore(); const app = useAppStore();
const backups = ref([]); const loading = ref(false);
const autoInterval = ref(0);

const fetchBackups = async () => {
    loading.value = true;
    try {
        const res = await fetch('/api/admin/backups', { headers: { 'Authorization': `Bearer ${userStore.token}` } });
        const json = await res.json();
        if (json.status === 'success') backups.value = json.backups;
        
        const confRes = await fetch(`/api/public/config?_t=${Date.now()}`);
        const confJson = await confRes.json();
        if (confJson.data && confJson.data.auto_backup_interval) {
            autoInterval.value = parseFloat(confJson.data.auto_backup_interval);
        }
    } catch(e) {} finally { loading.value = false; }
};

const saveAutoInterval = async () => {
    try {
        await fetch('/api/admin/config/update', { 
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
            body: JSON.stringify({ auto_backup_interval: autoInterval.value })
        });
        ui.showToast('自动化容灾频率已更新', 'success');
    } catch(e) {}
};

const createManualBackup = async () => {
    loading.value = true;
    try {
        const res = await fetch('/api/admin/backup/create', { method: 'POST', headers: { 'Authorization': `Bearer ${userStore.token}` } });
        const json = await res.json();
        if (json.status === 'success') { ui.showToast(json.message, 'success'); fetchBackups(); }
        else ui.showToast(json.message, 'error');
    } catch(e) { ui.showToast('网络异常', 'error'); } finally { loading.value = false; }
};

const downloadFile = (filename) => {
    window.location.href = `/api/admin/backup/download?filename=${filename}&token=${userStore.token}`;
};

const restoreFromHistory = async (filename) => {
    if (!await ui.showConfirm(`警告：此操作将使用历史快照 [${filename}] 彻底覆盖当前所有数据！您确定吗？`)) return;
    loading.value = true;
    try {
        const res = await fetch('/api/admin/backup/restore', { 
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
            body: JSON.stringify({ filename })
        });
        const json = await res.json();
        if (json.status === 'success') { ui.showToast(json.message, 'success'); setTimeout(() => window.location.reload(), 2000); }
        else ui.showToast(json.message, 'error');
    } catch(e) { ui.showToast('恢复异常', 'error'); } finally { loading.value = false; }
};

const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.name.endsWith('.sql.gz')) return ui.showToast('只能上传 .sql.gz 格式的备份包！', 'error');
    if (!await ui.showConfirm(`危险操作：系统即将读取您上传的 [${file.name}] 并强制清空当前数据库重新注水！确定执行？`)) return;
    
    loading.value = true;
    const formData = new FormData(); formData.append('file', file);
    try {
        const res = await fetch('/api/admin/backup/upload', {
            method: 'POST', headers: { 'Authorization': `Bearer ${userStore.token}` }, body: formData
        });
        const json = await res.json();
        if (json.status === 'success') { ui.showToast(json.message, 'success'); setTimeout(() => window.location.reload(), 2000); }
        else ui.showToast(json.message, 'error');
    } catch(e) { ui.showToast('上传恢复失败，可能文件过大或已损坏', 'error'); } finally { loading.value = false; event.target.value = ''; }
};

onMounted(() => { fetchBackups(); });
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-6 pb-20 relative z-10">
    <div class="relative w-full rounded-3xl overflow-hidden bg-slate-900 border border-emerald-500/30 shadow-[0_20px_60px_rgba(16,185,129,0.15)] flex flex-col p-8 md:p-12">
      <div class="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full mix-blend-screen filter blur-[100px] animate-pulse"></div>
      <div class="flex items-center space-x-4 relative z-10 mb-6">
          <div class="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(16,185,129,0.4)]">🛡️</div>
          <div><h1 class="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-500 tracking-widest">数据灾备中心</h1><p class="text-slate-400 text-sm md:text-base mt-2">企业级自动化容灾引擎 · 数据资产绝对防线</p></div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 mt-4">
          <div class="bg-slate-800/80 p-6 rounded-2xl border border-slate-700">
              <h3 class="text-white font-bold mb-4 flex items-center"><span class="text-blue-400 mr-2">⏱️</span> 自动化备份策略</h3>
              <div class="flex items-center space-x-3 mb-2"><input type="number" step="0.5" min="0" v-model="autoInterval" class="w-24 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-emerald-400 font-mono outline-none focus:border-emerald-400 transition"><span class="text-sm text-slate-400">小时/次 (填 0 为关闭)</span></div>
              <p class="text-[10px] text-slate-500 mb-4 leading-relaxed">系统将在后台自动生成快照并推送通知，硬盘最多保留最近 24 份快照。</p>
              <button @click="saveAutoInterval" class="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-xl transition shadow-sm">保存策略</button>
          </div>
          <div class="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 flex flex-col justify-center space-y-4">
              <button @click="createManualBackup" :disabled="loading" class="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black py-4 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition transform hover:-translate-y-1">立即创建数据快照</button>
              <div class="relative w-full">
                  <div class="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-3 rounded-xl border border-slate-600 transition text-center cursor-pointer flex items-center justify-center space-x-2"><span class="text-amber-400">🔥</span><span>上传外置备份并强制还原</span></div>
                  <input type="file" accept=".gz" @change="handleFileUpload" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
              </div>
          </div>
      </div>
    </div>

    <div class="bg-slate-800/80 border border-slate-700 rounded-3xl shadow-xl overflow-hidden relative">
      <div v-if="loading" class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center"><div class="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>
      <div class="p-6 border-b border-slate-700"><h3 class="text-lg font-bold text-white flex items-center"><span class="text-purple-400 mr-2">📂</span> 历史快照库 (自动清理极旧数据)</h3></div>
      <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-left text-sm whitespace-nowrap">
              <thead class="bg-slate-900/50 text-xs uppercase text-slate-400"><tr><th class="px-6 py-4">生成时间</th><th class="px-6 py-4">快照文件名</th><th class="px-6 py-4">体量</th><th class="px-6 py-4 text-right">执行操作</th></tr></thead>
              <tbody class="divide-y divide-slate-700/50 text-slate-200">
                  <tr v-for="b in backups" :key="b.name" class="hover:bg-slate-700/30 transition">
                      <td class="px-6 py-4 font-mono text-xs text-amber-400/80 font-bold">{{ new Date(b.time).toLocaleString() }}</td>
                      <td class="px-6 py-4 font-mono text-emerald-400 text-xs">{{ b.name }}</td>
                      <td class="px-6 py-4 font-mono text-slate-400 text-xs">{{ (b.size / 1024).toFixed(2) }} KB</td>
                      <td class="px-6 py-4 text-right space-x-2">
                          <button @click="downloadFile(b.name)" class="text-xs bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded transition font-bold">⬇️ 下载</button>
                          <button @click="restoreFromHistory(b.name)" class="text-xs bg-red-500/10 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-3 py-1.5 rounded transition font-bold">☠️ 强制覆盖还原</button>
                      </td>
                  </tr>
                  <tr v-if="backups.length === 0"><td colspan="4" class="text-center py-10 text-slate-500">暂无任何数据快照</td></tr>
              </tbody>
          </table>
      </div>
    </div>
  </div>
</template>
