<template>
  <div class="max-w-5xl mx-auto space-y-6">
    <div class="bg-slate-800/80 p-8 rounded-3xl border border-slate-700 shadow-xl">
      <div class="mb-6 space-y-2">
        <h2 class="text-xl font-bold text-white flex items-center"><span class="mr-2">📑</span> 批量下单格式指南</h2>
        <p class="text-slate-400 text-sm">格式中每行一个订单，链接示例可直接复制：</p>
        <div class="bg-slate-900/80 p-3 rounded-lg border border-slate-700 font-mono text-amber-400 text-sm">服务ID | https://www.tiktok.com/@填写你的用户名 | 数量</div>
        <p class="text-slate-500 text-sm mt-1">如：11|https://www.tiktok.com/@xxx|1000</p>
      </div>

      <textarea v-model="massData" rows="12" placeholder="服务ID | 链接 | 数量，如：&#10;11 | https://www.tiktok.com/@xxx | 1000&#10;12 | https://www.tiktok.com/@yyy | 500" class="w-full bg-slate-900/80 border border-slate-600 rounded-xl p-5 text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition font-mono text-base resize-y"></textarea>
      
      <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg py-4 rounded-xl mt-6 transition transform hover:-translate-y-1 shadow-[0_10px_30px_rgba(37,99,235,0.3)]">提交批量订单</button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-slate-800/60 p-6 rounded-2xl border border-slate-700 text-center">
        <div class="text-amber-400 text-3xl mb-3">⚡</div>
        <h4 class="text-white font-bold mb-2">极速处理</h4>
        <p class="text-sm text-slate-400">系统每 5 秒自动抓取一次队列，毫秒级响应上游。</p>
      </div>
      <div class="bg-slate-800/60 p-6 rounded-2xl border border-slate-700 text-center">
        <div class="text-purple-400 text-3xl mb-3">🔌</div>
        <h4 class="text-white font-bold mb-2">API 对接</h4>
        <p class="text-sm text-slate-400">支持开发者 API 接入，实现全自动化转售业务。</p>
      </div>
      <div class="bg-slate-800/60 p-6 rounded-2xl border border-slate-700 text-center">
        <div class="text-blue-400 text-3xl mb-3">🛡️</div>
        <h4 class="text-white font-bold mb-2">售后保障</h4>
        <p class="text-sm text-slate-400">掉量自动补单，7x24 小时客服在线支持。</p>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue';
const massData = ref('');
</script>
