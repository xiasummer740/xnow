<template>
  <div class="vpn-page min-h-full space-y-5" style="max-width:1100px;margin:0 auto;padding:0 1rem 2rem">
    <h1 style="font-size:1.5rem;font-weight:900;color:var(--xui-text)">{{ appStore.lang === 'zh' ? '节点管理密室' : 'Node Admin' }}</h1>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:0.75rem">
      <div class="xui-card" style="padding:0.75rem;text-align:center"><div style="font-size:1.3rem;font-weight:900;color:var(--xui-primary)">{{ servers.length }}</div><div style="font-size:0.6rem;color:var(--xui-text-dim);margin-top:0.25rem;text-transform:uppercase">节点</div></div>
      <div class="xui-card" style="padding:0.75rem;text-align:center"><div style="font-size:1.3rem;font-weight:900;color:#0891b2">{{ stats?.total||clients.length }}</div><div style="font-size:0.6rem;color:var(--xui-text-dim);margin-top:0.25rem;text-transform:uppercase">总订单</div></div>
      <div class="xui-card" style="padding:0.75rem;text-align:center"><div style="font-size:1.3rem;font-weight:900;color:#d97706">{{ stats?.active||activeCount }}</div><div style="font-size:0.6rem;color:var(--xui-text-dim);margin-top:0.25rem;text-transform:uppercase">活跃</div></div>
      <div class="xui-card" style="padding:0.75rem;text-align:center"><div style="font-size:1.3rem;font-weight:900;color:#7c3aed">{{ stats?.totalTrafficGB||0 }}</div><div style="font-size:0.6rem;color:var(--xui-text-dim);margin-top:0.25rem;text-transform:uppercase">已售GB</div></div>
      <div class="xui-card" style="padding:0.75rem;text-align:center"><div style="font-size:1.3rem;font-weight:900;color:#059669">{{ stats?.usedTrafficGB||0 }}</div><div style="font-size:0.6rem;color:var(--xui-text-dim);margin-top:0.25rem;text-transform:uppercase">已用GB</div></div>
      <div class="xui-card" style="padding:0.75rem;text-align:center"><div style="font-size:1.3rem;font-weight:900;color:#dc2626">{{ stats?.recentRevenue||0 }}</div><div style="font-size:0.6rem;color:var(--xui-text-dim);margin-top:0.25rem;text-transform:uppercase">近30天¥</div></div>
    </div>

    <!-- Daily orders mini chart -->
    <div v-if="stats?.dailyOrders?.length" class="xui-card" style="padding:1rem">
      <div style="font-weight:700;font-size:0.85rem;margin-bottom:0.75rem">📊 近30天订单趋势</div>
      <div style="display:flex;align-items:end;gap:2px;height:60px">
        <div v-for="d in stats.dailyOrders" :key="d.date" :title="d.date+': '+d.count+'单'"
          style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center">
          <div :style="{height:Math.max(2, d.count*8)+'px',background:d.count>0?'#10b981':'#1e293b',width:'100%',borderRadius:'2px 2px 0 0',minHeight:'2px',transition:'height 0.3s'}"></div>
          <span v-if="stats.dailyOrders.length<=15" style="font-size:0.45rem;color:var(--xui-text-dim);margin-top:2px;white-space:nowrap">{{ d.date.slice(5) }}</span>
        </div>
      </div>
    </div>

    <!-- Per-node traffic -->
    <div v-if="stats?.productStats?.length" class="xui-card" style="padding:1rem">
      <div style="font-weight:700;font-size:0.85rem;margin-bottom:0.75rem">🖥️ 各节点用量</div>
      <div style="display:flex;flex-direction:column;gap:0.5rem">
        <div v-for="ps in stats.productStats" :key="ps.product_id" style="display:flex;align-items:center;gap:0.75rem;font-size:0.75rem">
          <span style="min-width:80px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ getProductName(ps.product_id) }}</span>
          <div style="flex:1;height:18px;background:#e2e8f0;border-radius:9px;overflow:hidden;position:relative">
            <div :style="{width:Math.min(100, ps.usedPercent)+'%',height:'100%',background:ps.usedPercent>90?'#dc2626':ps.usedPercent>70?'#d97706':'#10b981',borderRadius:'9px',transition:'width 0.5s'}"></div>
          </div>
          <span style="min-width:80px;text-align:right;color:var(--xui-text-dim)">{{ Math.round(ps.used) }}/{{ ps.total }}GB ({{ ps.active }}/{{ ps.count }})</span>
        </div>
      </div>
    </div>

    <!-- Toggle -->
    <div v-if="['admin','super_admin'].includes(userStore.userInfo?.role)" class="xui-card" style="padding:1rem;display:flex;align-items:center;justify-content:space-between">
      <div><span style="font-weight:700;font-size:0.9rem">🌐 VPN 节点商城</span> <span :class="['xui-tag ml-2',shopEnabled?'xui-tag-green':'xui-tag-red']">{{ shopEnabled?'已开启':'已关闭' }}</span></div>
      <button @click="toggleShop" class="xui-btn" :class="shopEnabled?'xui-btn-ghost':''" style="font-size:0.8rem;padding:0.4rem 1rem">{{ shopEnabled?'关闭商城':'开启商城' }}</button>
    </div>

    <!-- API Key -->
    <div class="xui-card" style="padding:1.25rem;border-left:3px solid #d97706">
      <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.25rem;color:#d97706">🔑 XX-UI API 密钥</div>
      <div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.75rem">全局默认密钥。每节点可单独覆盖。在 XX-UI 设置→远程访问→生成。</div>
      <div style="display:flex;gap:0.5rem">
        <input :type="showKey?'text':'password'" v-model="apiKey" style="flex:1;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.5rem 0.75rem;font-size:0.85rem;font-family:monospace;outline:none" :placeholder="appStore.lang==='zh'?'粘贴 XX-UI API Key...':'Paste key...'" />
        <button @click="showKey=!showKey" class="xui-btn xui-btn-ghost" style="font-size:0.75rem;padding:0.4rem 0.75rem">{{ showKey?'隐藏':'显示' }}</button>
        <button @click="saveApiKey" :disabled="savingKey" class="xui-btn" style="font-size:0.8rem;padding:0.4rem 1rem;background:#d97706">{{ savingKey?'...':'保存' }}</button>
      </div>
      <div v-if="keyMsg" style="font-size:0.7rem;margin-top:0.5rem" :style="{color:keyMsgOk?'var(--xui-primary)':'var(--xui-danger)'}">{{ keyMsg }}</div>
    </div>

    <!-- Setup Guide -->
    <div v-if="!apiKey" class="xui-card" style="padding:1.25rem">
      <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.75rem">📖 首次配置指南</div>
      <div style="font-size:0.8rem;color:var(--xui-text-dim);line-height:1.8">
        <p>1. 登录 XX-UI → 设置 → "远程访问" Tab → 点击"生成密钥"</p>
        <p>2. 复制密钥粘贴到上方输入框并保存</p>
        <p>3. 编辑入站 → 打开"允许远程管理"（allow_remote）</p>
        <p>4. 下方添加节点，填入面板地址和入站 ID</p>
      </div>
    </div>

    <!-- Node List -->
    <div class="xui-card" style="padding:1.25rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
        <div style="font-weight:700;font-size:0.9rem">🖥️ 节点列表</div>
        <button @click="editServer(null)" class="xui-btn" style="font-size:0.8rem;padding:0.4rem 1rem">+ 添加节点</button>
      </div>
      <div class="overflow-x-auto">
        <table style="width:100%;font-size:0.8rem;border-collapse:collapse">
          <thead><tr style="text-align:left;color:var(--xui-text-dim);font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em"><th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--xui-border)">名称</th><th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--xui-border)">地址</th><th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--xui-border)">入站</th><th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--xui-border)">已售/上限</th><th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--xui-border)">单价</th><th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--xui-border)">状态</th><th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--xui-border)"></th></tr></thead>
          <tbody>
            <tr v-for="s in servers" :key="s.id" style="border-bottom:1px solid #f0f0f0">
              <td style="padding:0.6rem 0.75rem;font-weight:700;white-space:nowrap">{{ getNodeFlag(s) }} {{ s.name }}</td>
              <td style="padding:0.6rem 0.75rem;font-size:0.7rem;font-family:monospace;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--xui-text-dim)" :title="s.xxui_url">{{ s.xxui_url||'—' }}</td>
              <td style="padding:0.6rem 0.75rem">{{ s.xxui_inbound_id||'—' }}</td>
              <td style="padding:0.6rem 0.75rem"><span :style="{color:(usageMap[s.id]||0)>=s.max_traffic_gb?'var(--xui-danger)':'var(--xui-text)'}">{{ usageMap[s.id]||0 }} / {{ s.max_traffic_gb }}GB</span></td>
              <td style="padding:0.6rem 0.75rem">¥{{ parseFloat(s.price_per_gb||0).toFixed(2) }}</td>
              <td style="padding:0.6rem 0.75rem"><span class="xui-tag" :class="s.active?'xui-tag-green':'xui-tag-red'">{{ s.active?'启用':'禁用' }}</span></td>
              <td style="padding:0.6rem 0.75rem;white-space:nowrap"><button @click="editServer(s)" style="color:#0891b2;font-size:0.75rem;margin-right:0.5rem">编辑</button><button @click="deleteServer(s)" style="color:var(--xui-danger);font-size:0.75rem">删除</button></td>
            </tr>
            <tr v-if="servers.length===0"><td colspan="7" style="padding:2rem;text-align:center;color:var(--xui-text-dim)">暂无节点</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Orders -->
    <div class="xui-card" style="padding:1.25rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
        <div style="font-weight:700;font-size:0.9rem">📋 最近订单</div>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <select v-model="syncInterval" @change="startAutoSync" style="background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.5rem;padding:0.3rem 0.5rem;font-size:0.7rem;color:var(--xui-text-dim);outline:none">
            <option :value="0">关闭</option><option :value="5">5s</option><option :value="10">10s</option><option :value="30">30s</option><option :value="60">60s</option>
          </select>
          <button @click="syncTraffic" :disabled="syncing" class="xui-btn xui-btn-ghost" style="font-size:0.7rem;padding:0.3rem 0.6rem">{{ syncing?'...':'🔄' }}</button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table style="width:100%;font-size:0.8rem;border-collapse:collapse">
          <thead><tr style="text-align:left;color:var(--xui-text-dim);font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em"><th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--xui-border)">用户</th><th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--xui-border)">Email</th><th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--xui-border)">已用/总额</th><th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--xui-border)">位置</th><th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--xui-border)">到期</th><th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--xui-border)"></th></tr></thead>
          <tbody>
            <tr v-for="c in clients" :key="c.id" style="border-bottom:1px solid #f0f0f0">
              <td style="padding:0.6rem 0.75rem">{{ c.user_id }}</td>
              <td style="padding:0.6rem 0.75rem;font-family:monospace;font-size:0.75rem;color:var(--xui-text-dim)">{{ c.email }}</td>
              <td style="padding:0.6rem 0.75rem;font-size:0.75rem">{{ formatTrafficUsed(c) }} / {{ c.traffic_gb }}GB</td>
              <td style="padding:0.6rem 0.75rem;font-size:0.75rem;color:var(--xui-text-dim)">{{ c.vps_location }}</td>
              <td style="padding:0.6rem 0.75rem;font-size:0.75rem" :style="{color:c.expiry_time<Date.now()?'var(--xui-danger)':'var(--xui-text-dim)'}">{{ formatDate(c.expiry_time) }}</td>
              <td style="padding:0.6rem 0.75rem"><button @click="deleteClient(c)" style="color:var(--xui-danger);font-size:0.75rem">删除</button></td>
            </tr>
            <tr v-if="clients.length===0"><td colspan="6" style="padding:2rem;text-align:center;color:var(--xui-text-dim)">暂无订单</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Coupons -->
    <div class="xui-card" style="padding:1.25rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
        <div style="font-weight:700;font-size:0.9rem">🎟️ 优惠码</div>
        <button @click="showCouponForm=true;editCoupon=null" class="xui-btn" style="font-size:0.8rem;padding:0.4rem 1rem">+ 创建</button>
      </div>
      <div v-if="showCouponForm" class="xui-card" style="padding:1rem;margin-bottom:1rem;border:1px solid #d97706">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;font-size:0.8rem">
          <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">优惠码 *</div><input v-model="couponForm.code" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.5rem;padding:0.4rem 0.6rem;outline:none;text-transform:uppercase" placeholder="VIP50" :disabled="!!editCoupon?.id" /></div>
          <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">类型</div><select v-model="couponForm.type" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.5rem;padding:0.4rem 0.6rem;outline:none"><option value="percent">百分比 (%)</option><option value="fixed">固定金额 (¥)</option></select></div>
          <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">值 *</div><input v-model.number="couponForm.value" type="number" step="0.01" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.5rem;padding:0.4rem 0.6rem;outline:none" placeholder="10" /></div>
          <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">最低消费</div><input v-model.number="couponForm.min_amount" type="number" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.5rem;padding:0.4rem 0.6rem;outline:none" placeholder="0" /></div>
          <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">使用上限 (0=不限)</div><input v-model.number="couponForm.max_uses" type="number" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.5rem;padding:0.4rem 0.6rem;outline:none" placeholder="0" /></div>
          <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">过期时间 (空=永久)</div><input v-model="couponForm.expires" type="date" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.5rem;padding:0.4rem 0.6rem;outline:none" /></div>
        </div>
        <div style="margin-top:0.5rem"><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">说明</div><input v-model="couponForm.description" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.5rem;padding:0.4rem 0.6rem;outline:none;font-size:0.8rem" placeholder="新用户8折优惠" /></div>
        <div style="display:flex;gap:0.5rem;margin-top:0.75rem">
          <button @click="saveCoupon" :disabled="couponSaving" class="xui-btn" style="font-size:0.8rem;padding:0.4rem 1rem">{{ couponSaving?'...':'保存' }}</button>
          <button @click="showCouponForm=false;couponMsg=''" class="xui-btn xui-btn-ghost" style="font-size:0.8rem;padding:0.4rem 1rem">取消</button>
        </div>
        <div v-if="couponMsg" style="font-size:0.7rem;margin-top:0.5rem" :style="{color:couponMsgOk?'var(--xui-primary)':'var(--xui-danger)'}">{{ couponMsg }}</div>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;font-size:0.8rem;border-collapse:collapse">
          <thead><tr style="text-align:left;color:var(--xui-text-dim);font-size:0.65rem;text-transform:uppercase"><th style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--xui-border)">码</th><th style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--xui-border)">类型</th><th style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--xui-border)">值</th><th style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--xui-border)">已用/上限</th><th style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--xui-border)">过期</th><th style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--xui-border)">状态</th><th style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--xui-border)"></th></tr></thead>
          <tbody>
            <tr v-for="c in coupons" :key="c.id" style="border-bottom:1px solid #f0f0f0">
              <td style="padding:0.5rem 0.75rem;font-weight:700;font-family:monospace">{{ c.code }}</td>
              <td style="padding:0.5rem 0.75rem;font-size:0.7rem">{{ c.type==='percent'?'%':'¥' }}</td>
              <td style="padding:0.5rem 0.75rem">{{ c.type==='percent'?c.value+'%':'¥'+c.value }}</td>
              <td style="padding:0.5rem 0.75rem;font-size:0.7rem">{{ c.used_count }}/{{ c.max_uses||'∞' }}</td>
              <td style="padding:0.5rem 0.75rem;font-size:0.7rem;color:var(--xui-text-dim)">{{ c.expires_at?new Date(c.expires_at).toLocaleDateString():'永久' }}</td>
              <td style="padding:0.5rem 0.75rem"><span class="xui-tag" :class="c.active?'xui-tag-green':'xui-tag-red'">{{ c.active?'启用':'禁用' }}</span></td>
              <td style="padding:0.5rem 0.75rem;white-space:nowrap">
                <button @click="toggleCoupon(c)" style="color:#d97706;font-size:0.7rem;margin-right:0.5rem">{{ c.active?'禁用':'启用' }}</button>
                <button @click="deleteCoupon(c)" style="color:var(--xui-danger);font-size:0.7rem">删除</button>
              </td>
            </tr>
            <tr v-if="coupons.length===0"><td colspan="7" style="padding:2rem;text-align:center;color:var(--xui-text-dim)">暂无优惠码</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editMode!==null" class="xui-overlay" @click.self="editMode=null">
      <div class="xui-modal" style="max-width:520px;max-height:90vh;overflow-y:auto">
        <div style="font-size:1.1rem;font-weight:900;margin-bottom:1rem">{{ editing.id?'编辑节点':'添加节点' }}</div>
        <div style="display:flex;flex-direction:column;gap:0.75rem;font-size:0.85rem">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
            <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">名称 *</div><input v-model="editing.name" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.5rem 0.75rem;outline:none" placeholder="日本东京"></div>
            <div>
              <div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">旗帜 + 地区</div>
              <select v-model="editing.flag_emoji" @change="onFlagChange" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.5rem 0.75rem;outline:none">
                <option value="">-- 选择 --</option>
                <optgroup v-for="g in flagGroups" :key="g.label" :label="g.label"><option v-for="f in g.items" :key="f.emoji" :value="f.emoji">{{ f.emoji }} {{ f.name }}</option></optgroup>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
            <div>
              <div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">位置描述</div>
              <select v-model="editing.vps_location" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.5rem 0.75rem;outline:none;margin-bottom:0.25rem">
                <option value="">-- 选择 --</option>
                <optgroup v-for="g in flagGroups" :key="'l_'+g.label" :label="g.label"><option v-for="f in g.items" :key="'l_'+f.emoji" :value="f.location">{{ f.location }}</option></optgroup>
              </select>
              <input v-model="editing.vps_location" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.4rem 0.75rem;outline:none;font-size:0.75rem" placeholder="或手动输入">
            </div>
            <div>
              <div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">线路类型</div>
              <select v-model="editing.description" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.5rem 0.75rem;outline:none;margin-bottom:0.25rem">
                <option value="">-- 选择 --</option><option v-for="d in descPresets" :key="d" :value="d">{{ d }}</option>
              </select>
              <input v-model="editing.description" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.4rem 0.75rem;outline:none;font-size:0.75rem" placeholder="或手动输入">
            </div>
          </div>
          <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">XX-UI 面板地址 *</div><input v-model="editing.xxui_url" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.5rem 0.75rem;outline:none;font-family:monospace;font-size:0.75rem" placeholder="https://panel.example.com"></div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem">
            <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">入站 ID *</div><input v-model.number="editing.xxui_inbound_id" type="number" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.5rem 0.75rem;outline:none"></div>
            <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">最大流量(GB)</div><input v-model.number="editing.max_traffic_gb" type="number" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.5rem 0.75rem;outline:none"></div>
            <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">单价(¥/GB)</div><input v-model.number="editing.price_per_gb" type="number" step="0.01" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.5rem 0.75rem;outline:none"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
            <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">订阅端口</div><input v-model.number="editing.sub_port" type="number" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.5rem 0.75rem;outline:none"></div>
            <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">订阅路径</div><input v-model="editing.sub_path" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.5rem 0.75rem;outline:none" placeholder="/sub/"></div>
          </div>
          <div><div style="font-size:0.7rem;color:var(--xui-text-dim);margin-bottom:0.25rem">节点独立 API Key（可选）</div><input v-model="editing.xxui_api_key" style="width:100%;background:#f5f7f9;border:1px solid var(--xui-border);border-radius:0.6rem;padding:0.5rem 0.75rem;outline:none;font-family:monospace;font-size:0.75rem" placeholder="留空使用全局密钥"></div>
          <div>
            <button @click="testConnection" :disabled="testingConn" class="xui-btn" :class="connResult&&connResult.status==='success'?'':'xui-btn-ghost'" style="font-size:0.75rem;padding:0.4rem 0.75rem">
              {{ testingConn?'检测中...':(connResult?(connResult.status==='success'?'✓ '+connResult.message:'✗ '+connResult.message):'🔍 检测连通性') }}
            </button>
          </div>
          <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.8rem"><input v-model="editing.active" type="checkbox" style="accent-color:var(--xui-primary)"> 启用此节点</label>
        </div>
        <div style="display:flex;gap:0.75rem;margin-top:1rem">
          <button @click="saveServer" :disabled="savingNode" class="xui-btn" style="flex:1">{{ savingNode?'...':'保存' }}</button>
          <button @click="editMode=null" class="xui-btn xui-btn-ghost" style="flex:1">取消</button>
        </div>
        <div v-if="editErr" style="font-size:0.75rem;color:var(--xui-danger);margin-top:0.5rem">{{ editErr }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAppStore } from '../stores/app';
import { useUserStore } from '../stores/user';
import { useUiStore } from '../stores/ui';
import { formatTrafficUsed } from '../utils/format.js';

const appStore = useAppStore(); const userStore = useUserStore(); const uiStore = useUiStore();
const shopEnabled = ref(true);
const servers = ref([]); const clients = ref([]); const usageMap = ref({});
const stats = ref(null);
const activeCount = computed(() => clients.value.filter(c => c.expiry_time && c.expiry_time > Date.now()).length);
const totalSold = computed(() => clients.value.reduce((s, c) => s + (c.traffic_gb || 0), 0));
const editMode = ref(null); const editErr = ref('');
const savingNode = ref(false);
const apiKey = ref(''); const savingKey = ref(false); const showKey = ref(false);
const keyMsg = ref(''); const keyMsgOk = ref(false);
const editing = ref({ id: null, name: '', vps_location: '', flag_emoji: '', xxui_url: '', xxui_inbound_id: 0, max_traffic_gb: 2000, price_per_gb: 0.50, sub_port: 2096, sub_path: '/sub/', xxui_api_key: '', active: true, description: '' });

onMounted(() => { fetchData(); fetchApiKey(); fetchShopStatus(); fetchStats(); fetchCoupons(); });

const fetchStats = async () => {
  try { const r = await fetch('/api/vpn/admin/stats', { headers: getHeaders() }); const d = await r.json(); if (d.status === 'success') stats.value = d.data; } catch (e) {}
};
const getProductName = (pid) => { const s = servers.value.find(s => s.id === pid); return s ? s.name : '节点#' + pid; };

// 优惠码
const coupons = ref([]);
const showCouponForm = ref(false);
const editCoupon = ref(null);
const couponForm = ref({ code: '', type: 'percent', value: 10, min_amount: 0, max_uses: 0, expires: '', description: '' });
const couponSaving = ref(false);
const couponMsg = ref(''); const couponMsgOk = ref(false);
const fetchCoupons = async () => { try { const r = await fetch('/api/vpn/admin/coupons', { headers: getHeaders() }); const d = await r.json(); if (d.status === 'success') coupons.value = d.data; } catch (e) {} };
const saveCoupon = async () => {
  if (!couponForm.value.code || !couponForm.value.value) { couponMsg.value = '请填写必填项'; couponMsgOk.value = false; return; }
  couponSaving.value = true; couponMsg.value = '';
  const expiresAt = couponForm.value.expires ? new Date(couponForm.value.expires).getTime() + 86400000 : 0;
  try {
    const r = await fetch('/api/vpn/admin/coupon', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ ...couponForm.value, expires_at: expiresAt }) });
    const d = await r.json(); couponMsgOk.value = d.status === 'success';
    couponMsg.value = couponMsgOk.value ? '已保存' : (d.message || '保存失败');
    if (d.status === 'success') { showCouponForm.value = false; fetchCoupons(); }
  } catch (e) { couponMsgOk.value = false; couponMsg.value = '网络错误'; }
  couponSaving.value = false;
};
const toggleCoupon = async (c) => { try { await fetch(`/api/vpn/admin/coupon/${c.id}/toggle`, { method: 'POST', headers: apiHeaders() }); c.active = !c.active; } catch (e) {} };
const deleteCoupon = async (c) => { if (!await uiStore.showConfirm('确认删除「' + c.code + '」？')) return; try { await fetch(`/api/vpn/admin/coupon/${c.id}`, { method: 'DELETE', headers: getHeaders() }); fetchCoupons(); } catch (e) { uiStore.showToast('删除失败', 'error'); } };

onUnmounted(() => { clearInterval(syncTimer); });

const apiHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` });
const getHeaders = () => ({ 'Authorization': `Bearer ${userStore.token}` });

const fetchShopStatus = async () => { try { const r = await fetch('/api/vpn/status'); const d = await r.json(); shopEnabled.value = d.enabled; } catch (e) {} };
const toggleShop = async () => { const h = apiHeaders(); const r = await fetch('/api/vpn/admin/toggle-shop', { method: 'POST', headers: h, body: JSON.stringify({ enabled: !shopEnabled.value }) }); const d = await r.json(); if (d.status === 'success') shopEnabled.value = d.enabled; };
const fetchApiKey = async () => { try { const r = await fetch('/api/vpn/admin/apikey', { headers: getHeaders() }); const d = await r.json(); if (d.status === 'success') apiKey.value = d.data || ''; } catch (e) {} };
const saveApiKey = async () => { savingKey.value = true; keyMsg.value = ''; try { const r = await fetch('/api/vpn/admin/apikey', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ apiKey: apiKey.value }) }); const d = await r.json(); keyMsgOk.value = d.status === 'success'; keyMsg.value = keyMsgOk.value ? (appStore.lang === 'zh' ? '密钥已保存' : 'Key saved') : (d.message || '保存失败'); } catch (e) { keyMsgOk.value = false; keyMsg.value = appStore.lang === 'zh' ? '后端未部署' : 'Backend offline'; } savingKey.value = false; };

const fetchData = async () => {
  try { const r = await fetch('/api/vpn/admin/servers', { headers: getHeaders() }); const d = await r.json(); if (d.status === 'success') servers.value = d.data; } catch (e) {}
  try {
    const r = await fetch('/api/vpn/admin/clients', { headers: getHeaders() }); const d = await r.json();
    if (d.status === 'success') { clients.value = d.data; const now = Date.now(); const map = {}; d.data.forEach(c => { if (c.product_id && c.expiry_time && c.expiry_time > now) map[c.product_id] = (map[c.product_id] || 0) + (c.traffic_gb || 0); }); usageMap.value = map; }
  } catch (e) {}
};

const onFlagChange = () => { const sel = editing.value.flag_emoji; for (const g of flagGroups) { const found = g.items.find(i => i.emoji === sel); if (found) { editing.value.vps_location = found.location; break; } } };
const editServer = (s) => { editErr.value = ''; connResult.value = null; editMode.value = true; editing.value = s ? { ...s } : { id: null, name: '', vps_location: '', flag_emoji: '', xxui_url: '', xxui_inbound_id: 0, max_traffic_gb: 2000, price_per_gb: 0.50, sub_port: 2096, sub_path: '/sub/', xxui_api_key: '', active: true, description: '' }; };

const flagGroups = [
  { label: '东亚', items: [{ emoji: '🇭🇰', name: '香港', location: '香港 · BGP' },{ emoji: '🇯🇵', name: '日本', location: '日本东京 · BGP' },{ emoji: '🇰🇷', name: '韩国', location: '韩国首尔 · BGP' },{ emoji: '🇹🇼', name: '台湾', location: '台湾台北 · BGP' }] },
  { label: '东南亚', items: [{ emoji: '🇸🇬', name: '新加坡', location: '新加坡 · BGP' },{ emoji: '🇹🇭', name: '泰国', location: '泰国曼谷 · BGP' },{ emoji: '🇻🇳', name: '越南', location: '越南胡志明 · BGP' },{ emoji: '🇲🇾', name: '马来西亚', location: '马来西亚吉隆坡 · BGP' },{ emoji: '🇵🇭', name: '菲律宾', location: '菲律宾马尼拉 · BGP' },{ emoji: '🇮🇩', name: '印度尼西亚', location: '印尼雅加达 · BGP' }] },
  { label: '南亚', items: [{ emoji: '🇮🇳', name: '印度', location: '印度孟买 · BGP' }] },
  { label: '中东', items: [{ emoji: '🇦🇪', name: '阿联酋', location: '阿联酋迪拜 · BGP' },{ emoji: '🇸🇦', name: '沙特', location: '沙特利雅得 · BGP' },{ emoji: '🇹🇷', name: '土耳其', location: '土耳其伊斯坦布尔 · BGP' }] },
  { label: '北美', items: [{ emoji: '🇺🇸', name: '美国', location: '美国洛杉矶 · CN2 GIA' },{ emoji: '🇨🇦', name: '加拿大', location: '加拿大多伦多 · BGP' }] },
  { label: '欧洲', items: [{ emoji: '🇬🇧', name: '英国', location: '英国伦敦 · 9929' },{ emoji: '🇩🇪', name: '德国', location: '德国法兰克福 · 9929' },{ emoji: '🇳🇱', name: '荷兰', location: '荷兰阿姆斯特丹 · BGP' },{ emoji: '🇫🇷', name: '法国', location: '法国巴黎 · BGP' },{ emoji: '🇷🇺', name: '俄罗斯', location: '俄罗斯莫斯科 · BGP' },{ emoji: '🇸🇪', name: '瑞典', location: '瑞典斯德哥尔摩 · BGP' },{ emoji: '🇨🇭', name: '瑞士', location: '瑞士苏黎世 · BGP' },{ emoji: '🇮🇹', name: '意大利', location: '意大利米兰 · BGP' },{ emoji: '🇪🇸', name: '西班牙', location: '西班牙马德里 · BGP' },{ emoji: '🇵🇱', name: '波兰', location: '波兰华沙 · BGP' }] },
  { label: '大洋洲', items: [{ emoji: '🇦🇺', name: '澳大利亚', location: '澳大利亚悉尼 · BGP' }] },
  { label: '南美', items: [{ emoji: '🇧🇷', name: '巴西', location: '巴西圣保罗 · BGP' },{ emoji: '🇦🇷', name: '阿根廷', location: '阿根廷布宜诺斯艾利斯 · BGP' }] },
  { label: '非洲', items: [{ emoji: '🇿🇦', name: '南非', location: '南非约翰内斯堡 · BGP' }] },
];
const descPresets = ['BGP 高速线路', 'CN2 GIA 优质线路', '9929 精品线路', 'CMIN2 移动优化', 'IIJ 日本直连', '软银 日本专线', 'HKT 家宽', 'HGC 商宽', 'NTT 国际线路', 'HE 国际线路', 'Cogent 国际线路'];
const testingConn = ref(false); const connResult = ref(null);
const testConnection = async () => { testingConn.value = true; connResult.value = null; try { const r = await fetch('/api/vpn/admin/test-connection', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ xxui_url: editing.value.xxui_url, api_key: editing.value.xxui_api_key, inbound_id: editing.value.xxui_inbound_id }) }); connResult.value = await r.json(); } catch (e) { connResult.value = { status: 'error', message: '网络异常' }; } testingConn.value = false; };
const saveServer = async () => { if (!editing.value.name || !editing.value.xxui_inbound_id) { editErr.value = '名称和入站 ID 为必填项'; return; } savingNode.value = true; editErr.value = ''; try { const r = await fetch('/api/vpn/admin/server', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(editing.value) }); const d = await r.json(); if (d.status === 'success') { editMode.value = null; fetchData(); fetchStats(); uiStore.showToast('已保存', 'success'); } else editErr.value = d.message || '保存失败'; } catch (e) { editErr.value = '后端未部署'; } savingNode.value = false; };

const syncing = ref(false); const syncInterval = ref(0); let syncTimer = null;
const doSync = async () => { syncing.value = true; try { const r = await fetch('/api/vpn/admin/sync-traffic', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ clients: clients.value.map(c => ({ id: c.id, email: c.email, product_id: c.product_id })) }) }); const d = await r.json(); if (d.status === 'success' && d.data) { d.data.forEach(u => { const c = clients.value.find(x => x.id === u.id); if (c) { c.traffic_used_up = u.up; c.traffic_used_down = u.down; } }); } } catch (e) {} syncing.value = false; };
const syncTraffic = async () => { await doSync(); };
const startAutoSync = () => { clearInterval(syncTimer); if (syncInterval.value > 0) syncTimer = setInterval(doSync, syncInterval.value * 1000); };
const F2 = { hk:'🇭🇰',hongkong:'🇭🇰',jp:'🇯🇵',japan:'🇯🇵',kr:'🇰🇷',korea:'🇰🇷',tw:'🇹🇼',taiwan:'🇹🇼',cn:'🇨🇳',china:'🇨🇳',sg:'🇸🇬',singapore:'🇸🇬',th:'🇹🇭',thailand:'🇹🇭',vn:'🇻🇳',vietnam:'🇻🇳',my:'🇲🇾',malaysia:'🇲🇾',ph:'🇵🇭',philippines:'🇵🇭',id:'🇮🇩',indonesia:'🇮🇩',in:'🇮🇳',india:'🇮🇳',ae:'🇦🇪',uae:'🇦🇪',sa:'🇸🇦',tr:'🇹🇷',us:'🇺🇸',usa:'🇺🇸',ca:'🇨🇦',canada:'🇨🇦',uk:'🇬🇧',gb:'🇬🇧',de:'🇩🇪',germany:'🇩🇪',nl:'🇳🇱',netherlands:'🇳🇱',fr:'🇫🇷',france:'🇫🇷',ru:'🇷🇺',russia:'🇷🇺',se:'🇸🇪',sweden:'🇸🇪',ch:'🇨🇭',switzerland:'🇨🇭',it:'🇮🇹',italy:'🇮🇹',es:'🇪🇸',spain:'🇪🇸',pl:'🇵🇱',poland:'🇵🇱',au:'🇦🇺',australia:'🇦🇺',br:'🇧🇷',brazil:'🇧🇷',ar:'🇦🇷',argentina:'🇦🇷',za:'🇿🇦',southafrica:'🇿🇦',mx:'🇲🇽',mexico:'🇲🇽'};
const getNodeFlag = (s) => { const f = (s.flag_emoji || '').toLowerCase().trim(); if (F2[f]) return F2[f]; if (f && /^\p{Emoji}/u.test(s.flag_emoji)) return s.flag_emoji; return '🖥️'; };
const deleteClient = async (c) => { if (!await uiStore.showConfirm(`确认删除「${c.email}」？也会从 XX-UI 删除。`)) return; try { await fetch(`/api/vpn/admin/client/${c.id}`, { method: 'DELETE', headers: getHeaders() }); fetchData(); fetchStats(); } catch (e) { uiStore.showToast('删除失败', 'error'); } };
const deleteServer = async (s) => { const activeNodeClients = clients.value.filter(c => c.product_id === s.id && c.expiry_time && c.expiry_time > Date.now()); const warn = activeNodeClients.length > 0 ? `\n⚠️ ${activeNodeClients.length} 个活跃客户端将被影响！` : ''; if (!await uiStore.showConfirm(`确认删除「${s.name}」？不可恢复。${warn}`)) return; try { await fetch(`/api/vpn/admin/server/${s.id}`, { method: 'DELETE', headers: getHeaders() }); fetchData(); } catch (e) { uiStore.showToast('删除失败', 'error'); } };
const formatDate = (ts) => ts ? new Date(ts).toLocaleDateString('zh-CN') : '--';
</script>
