<template>
  <!-- 🏬 六十三期：站长可视化编辑（P1）
       设计依据见 deploy/sites/DIY-UX.md：
       站长不懂代码，不要让他去后台表单里找字段 —— 直接在自己的店面上改。
       进入编辑态后：每个区块右上角出现 ↑ ↓ 🙈 ✏️，底部出现保存栏。 -->
  <div v-if="canEdit">
    <button v-if="!editing" @click="enter" class="site-edit-fab" title="编辑我的首页">
      ✏️ 编辑我的店
    </button>

    <template v-else>
      <!-- 底部：保存栏 -->
      <div class="site-edit-bar">
        <span class="site-edit-tip">✏️ 编辑中 · 点区块标题改文案，用 ↑ ↓ 换位置，🙈 隐藏</span>
        <div class="site-edit-actions">
          <button class="site-edit-btn ghost" @click="openLook">🎨 外观</button>
          <button class="site-edit-btn ghost" @click="reset">恢复默认</button>
          <button class="site-edit-btn ghost" @click="cancel">放弃</button>
          <button class="site-edit-btn primary" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>


      <!-- 🎨 外观抽屉：只有三组，每组一句人话建议（不出现 HEX / px）-->
      <div v-if="lookOpen" class="site-sheet-mask" @click.self="lookOpen = false">
        <div class="site-sheet site-look">
          <p class="site-look-title">外观</p>

          <p class="site-look-label">① 主色 <span class="site-look-hint">决定按钮、价格、链接的颜色</span></p>
          <div class="site-swatches">
            <button v-for="c in COLORS" :key="c.key" class="site-swatch" :class="{ on: look.color === c.key }"
                    :style="{ background: c.hex }" :title="c.name" @click="look.color = c.key"></button>
          </div>

          <p class="site-look-label">② 背景 <span class="site-look-hint">深色最显专业；想特别一点就换渐变或上传图</span></p>
          <div class="site-swatches">
            <button v-for="b in BACKS" :key="b.key" class="site-swatch back" :class="{ on: look.bgColor === b.key }"
                    :style="{ background: b.css }" :title="b.name" @click="look.bgColor = b.key"></button>
          </div>
          <div class="site-look-row">
            <button class="site-edit-btn ghost" :disabled="uploadingBg" @click="pickBg">
              {{ uploadingBg ? '上传中…' : '📤 上传自己的背景图' }}
            </button>
            <button v-if="look.bgImage" class="site-edit-btn ghost" @click="look.bgImage = ''">去掉背景图</button>
            <span v-if="look.bgImage" class="site-look-hint">已选图片（选纯色会让图片失效）</span>
          </div>

          <p class="site-look-label">③ 字号 <span class="site-look-hint">客户多是手机上看的，标准就够</span></p>
          <div class="site-look-seg">
            <button v-for="f in FONTS" :key="f.key" class="site-seg" :class="{ on: look.fontScale === f.key }"
                    @click="look.fontScale = f.key">{{ f.name }}</button>
          </div>

          <p class="site-look-label">④ 圆角 <span class="site-look-hint">方 = 严肃；圆 = 亲和</span></p>
          <div class="site-look-seg">
            <button v-for="r in RADII" :key="r.key" class="site-seg" :class="{ on: look.radius === r.key }"
                    @click="look.radius = r.key">{{ r.name }}</button>
          </div>

          <div class="site-sheet-actions">
            <button class="site-edit-btn ghost" @click="lookOpen = false">先不保存</button>
            <button class="site-edit-btn primary" :disabled="savingLook" @click="saveLook">
              {{ savingLook ? '保存中…' : '应用' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 文案编辑面板（点标题弹出，不用 contenteditable —— 避免和后端渲染打架）-->
      <div v-if="titleSheet" class="site-sheet-mask" @click.self="titleSheet = null">
        <div class="site-sheet">
          <p class="site-sheet-label">{{ titleSheet.label }}</p>
          <input v-model="titleSheet.title" class="site-sheet-input" placeholder="留空 = 用默认标题" @keyup.enter="applyTitle" />
          <div class="site-sheet-actions">
            <button class="site-edit-btn ghost" @click="titleSheet = null">取消</button>
            <button class="site-edit-btn primary" @click="applyTitle">确定</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useAppStore } from '../../stores/app';
import { useUserStore } from '../../stores/user';

const appStore = useAppStore();
const userStore = useUserStore();
const editing = ref(false);
const saving = ref(false);
const titleSheet = ref(null);
const before = ref(null);

const BLOCK_LABEL = {
  audience: '谁在用 / 适用人群',
  steps: '三步开始',
  advantages: '三张卖点卡',
  hot_services: '热门服务',
  faq: '常见问题',
  cta: '底部按钮',
  announce: '公告条',
  stats: '数据统计',
  vip: '会员模块',
  affiliate: '推广返佣'
};

// 只有站长（或平台管理员）在自己分站上才看到编辑入口
const canEdit = computed(() => {
  if (!appStore.isSubsite) return false;
  const role = userStore.userInfo?.role;
  if (!userStore.token) return false;
  return ['agent', 'admin', 'super_admin'].includes(role);
});

const blocks = () => Array.from(document.querySelectorAll('.site-section[data-module]'));

const enter = () => {
  editing.value = true;
  // 编辑时把客服浮窗藏起来：它固定在右下角，正好压住「保存」按钮
  document.body.classList.add('site-editing');
  // 记一份快照，放弃时原样还原
  before.value = JSON.stringify({
    modules: JSON.parse(JSON.stringify(appStore.homeModules || [])),
    titles: JSON.parse(JSON.stringify(appStore.sectionTitles || {}))
  });
  nextTick(paintToolbars);
};

const exit = () => {
  editing.value = false;
  document.body.classList.remove('site-editing');
  document.querySelectorAll('.site-edit-toolbar').forEach(e => e.remove());
  document.querySelectorAll('.site-section').forEach(s => s.classList.remove('site-editing-on'));
};

const moduleList = () => {
  if (!appStore.homeModules || !appStore.homeModules.length) {
    // 没有配置过就按页面现有顺序建一份
    return blocks().map((el, i) => ({ key: el.dataset.module, enabled: true, order: i }));
  }
  return appStore.homeModules;
};
const setModules = (list) => { appStore.homeModules = list; };

const resort = () => blocks().sort((a, b) => (Number(getComputedStyle(a).order) || 0) - (Number(getComputedStyle(b).order) || 0));

const move = (key, dir) => {
  const list = resort();
  const idx = list.findIndex(el => el.dataset.module === key);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= list.length) return;
  const orderA = Number(getComputedStyle(list[idx]).order) || idx;
  const orderB = Number(getComputedStyle(list[target]).order) || target;
  const mods = moduleList().slice();
  const ensure = (k) => { let m = mods.find(x => x.key === k); if (!m) { m = { key: k, enabled: true, order: mods.length }; mods.push(m); } return m; };
  ensure(key).order = orderB;
  ensure(list[target].dataset.module).order = orderA;
  setModules(mods);
  nextTick(paintToolbars);
};

const hide = (key) => {
  const mods = moduleList().slice();
  const m = mods.find(x => x.key === key);
  if (m) m.enabled = false; else mods.push({ key, enabled: false, order: mods.length });
  setModules(mods);
  nextTick(paintToolbars);
};

const editTitle = (key) => {
  titleSheet.value = {
    key,
    label: `改「${BLOCK_LABEL[key] || key}」的标题`,
    title: appStore.sectionTitle(key) || ''
  };
};

const applyTitle = () => {
  const s = titleSheet.value;
  if (!s) return;
  const titles = JSON.parse(JSON.stringify(appStore.sectionTitles || {}));
  const cur = titles[s.key] || {};
  const v = String(s.title || '').trim();
  if (v) titles[s.key] = { ...cur, title: v };
  else if (cur.sub) titles[s.key] = { sub: cur.sub };
  else delete titles[s.key];
  appStore.sectionTitles = titles;
  titleSheet.value = null;
};

const paintToolbars = () => {
  if (!editing.value) return;
  document.querySelectorAll('.site-edit-toolbar').forEach(e => e.remove());
  blocks().forEach(el => {
    if (getComputedStyle(el).display === 'none') return;
    el.classList.add('site-editing-on');
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const key = el.dataset.module;
    const bar = document.createElement('div');
    bar.className = 'site-edit-toolbar';
    const mk = (label, title, fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label; b.title = title;
      b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
      return b;
    };
    bar.appendChild(mk('↑', '这个区块往上挪', () => move(key, -1)));
    bar.appendChild(mk('↓', '这个区块往下挪', () => move(key, 1)));
    bar.appendChild(mk('✏️', '改这个区块的标题', () => editTitle(key)));
    bar.appendChild(mk('🙈', '隐藏这个区块', () => hide(key)));
    el.appendChild(bar);
  });
};


// ── 🎨 外观三板斧 ───────────────────────────────────────────────
const lookOpen = ref(false);
const savingLook = ref(false);
const uploadingBg = ref(false);
const COLORS = [
  { key: 'cyan',   name: '青',   hex: '#22d3ee' },
  { key: 'blue',   name: '蓝',   hex: '#3b82f6' },
  { key: 'purple', name: '紫',   hex: '#a855f7' },
  { key: 'green',  name: '绿',   hex: '#22c55e' },
  { key: 'orange', name: '橙',   hex: '#f97316' },
  { key: 'red',    name: '红',   hex: '#ef4444' },
  { key: 'pink',   name: '粉',   hex: '#ec4899' },
  { key: 'gold',   name: '金',   hex: '#eab308' },
  { key: 'teal',   name: '青绿', hex: '#14b8a6' },
  { key: 'indigo', name: '靛',   hex: '#6366f1' },
  { key: 'lime',   name: '黄绿', hex: '#84cc16' },
  { key: 'slate',  name: '灰蓝', hex: '#64748b' }
];
const BACKS = [
  { key: '',      name: '跟随模板', css: 'linear-gradient(135deg,#1e293b,#0f172a)' },
  { key: '#04070f', name: '纯黑',   css: '#04070f' },
  { key: '#0b1220', name: '深蓝',   css: '#0b1220' },
  { key: '#12081a', name: '暗紫',   css: '#12081a' },
  { key: 'grad1',  name: '深空渐变', css: 'linear-gradient(160deg,#0b1220,#131a2e,#1b1030)' },
  { key: 'grad2',  name: '深海渐变', css: 'linear-gradient(160deg,#04070f,#0d1b2a,#10243a)' },
  { key: 'grad3',  name: '紫夜渐变', css: 'linear-gradient(160deg,#120a1f,#1d1030,#2a1033)' }
];
const FONTS = [
  { key: 'sm', name: '小' },
  { key: 'md', name: '标准' },
  { key: 'lg', name: '大' }
];
const RADII = [
  { key: 'square', name: '方' },
  { key: 'soft', name: '微圆' },
  { key: 'round', name: '圆' }
];
const look = ref({ color: '', bgColor: '', bgImage: '', fontScale: '', radius: '' });

const openLook = () => {
  look.value = {
    color: appStore.themeColor || '',
    bgColor: appStore.bgColor || '',
    bgImage: appStore.bgImage || '',
    fontScale: appStore.fontScale || '',
    radius: appStore.uiRadius || ''
  };
  lookOpen.value = true;
};

const pickBg = () => {
  if (uploadingBg.value) return;
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/png,image/jpeg,image/webp';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { alert('图片太大了，请选 5MB 以内的'); return; }
    uploadingBg.value = true;
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch(`/api/sites/${appStore.siteId || ''}/upload`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${userStore.token}` }, body: fd
      });
      const j = await res.json();
      if (j.status !== 'success') throw new Error(j.message || '上传失败');
      look.value.bgImage = j.data.url;
      look.value.bgColor = '';
    } catch (e) {
      alert('上传失败：' + e.message);
    } finally {
      uploadingBg.value = false;
    }
  };
  inp.click();
};

const saveLook = async () => {
  savingLook.value = true;
  try {
    const payload = {
      color: look.value.color || undefined,
      bg_color: look.value.bgColor || '',
      bg_image: look.value.bgImage || '',
      font_scale: look.value.fontScale || '',
      ui_radius: look.value.radius || ''
    };
    const res = await fetch(`/api/sites/${appStore.siteId || ''}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
      body: JSON.stringify(payload)
    });
    const j = await res.json();
    if (j.status !== 'success') throw new Error(j.message || '保存失败');
    // 立刻生效：不等刷新
    appStore.themeColor = look.value.color || appStore.themeColor;
    appStore.bgColor = look.value.bgColor || '';
    appStore.bgImage = look.value.bgImage || '';
    appStore.fontScale = look.value.fontScale || '';
    appStore.uiRadius = look.value.radius || '';
    appStore.applyTheme();
    lookOpen.value = false;
  } catch (e) {
    alert('保存失败：' + e.message);
  } finally {
    savingLook.value = false;
  }
};

const save = async () => {
  saving.value = true;
  try {
    const res = await fetch(`/api/sites/${appStore.siteId || ''}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
      body: JSON.stringify({
        home_modules: JSON.stringify(appStore.homeModules || []),
        section_titles: JSON.stringify(appStore.sectionTitles || {})
      })
    });
    const j = await res.json();
    if (j.status !== 'success') throw new Error(j.message || '保存失败');
    exit();
  } catch (e) {
    alert('保存失败：' + e.message);
  } finally {
    saving.value = false;
  }
};

const cancel = () => {
  if (before.value) {
    const snap = JSON.parse(before.value);
    appStore.homeModules = snap.modules;
    appStore.sectionTitles = snap.titles;
  }
  exit();
};

const reset = async () => {
  if (!confirm('恢复成平台推荐的默认布局吗？你改过的顺序和标题会清空。')) return;
  appStore.homeModules = [];
  appStore.sectionTitles = {};
  await save();
};

onMounted(() => setTimeout(paintToolbars, 1500));
onBeforeUnmount(exit);
</script>

<style scoped>
.site-edit-fab {
  position: fixed; right: 20px; bottom: 88px; z-index: 60;
  background: var(--brand, #22d3ee); color: #04070f;
  border: 0; border-radius: 999px; padding: 12px 20px;
  font-weight: 800; font-size: 14px; cursor: pointer;
  box-shadow: 0 10px 30px rgba(0,0,0,.45);
}
.site-edit-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 70;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 16px; background: rgba(9, 14, 26, .96);
  border-top: 1px solid rgba(148,163,184,.2); backdrop-filter: blur(10px);
  flex-wrap: wrap;
}
.site-edit-tip { color: #cbd5e1; font-size: 12px; }
.site-edit-actions { display: flex; gap: 8px; }
.site-edit-btn {
  border-radius: 10px; padding: 8px 16px; font-weight: 700; font-size: 13px; cursor: pointer; border: 1px solid transparent;
}
.site-edit-btn.ghost { background: transparent; color: #cbd5e1; border-color: rgba(148,163,184,.35); }
.site-edit-btn.primary { background: var(--brand, #22d3ee); color: #04070f; }
.site-edit-btn:disabled { opacity: .6; cursor: default; }
.site-sheet-mask {
  position: fixed; inset: 0; z-index: 80; background: rgba(2,6,23,.6);
  display: flex; align-items: flex-end; justify-content: center;
}
.site-sheet {
  width: 100%; max-width: 560px; background: #0b1220; border-radius: 16px 16px 0 0;
  padding: 18px; border: 1px solid rgba(148,163,184,.2);
}
.site-sheet-label { color: #94a3b8; font-size: 12px; margin-bottom: 8px; }
.site-sheet-input {
  width: 100%; background: #04070f; border: 1px solid rgba(148,163,184,.3); color: #f8fafc;
  border-radius: 10px; padding: 12px; font-size: 15px;
}
.site-sheet-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }

.site-look { max-height: 82vh; overflow-y: auto; }
.site-look-title { color: #f8fafc; font-weight: 800; font-size: 16px; margin-bottom: 14px; }
.site-look-label { color: #cbd5e1; font-size: 13px; font-weight: 700; margin: 14px 0 8px; }
.site-look-hint { color: #64748b; font-weight: 400; font-size: 11px; margin-left: 6px; }
.site-swatches { display: flex; flex-wrap: wrap; gap: 8px; }
.site-swatch { width: 34px; height: 34px; border-radius: 10px; border: 1px solid rgba(148,163,184,.45); cursor: pointer; }
.site-swatch.back { width: 46px; }
.site-swatch.on { border-color: #22d3ee; box-shadow: 0 0 0 3px rgba(34,211,238,.18); }
.site-look-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.site-look-seg { display: flex; gap: 8px; }
.site-seg { padding: 8px 16px; border-radius: 10px; border: 1px solid rgba(148,163,184,.35); background: transparent; color: #cbd5e1; font-size: 13px; cursor: pointer; }
.site-seg.on { background: var(--brand, #22d3ee); color: #04070f; border-color: transparent; font-weight: 800; }
</style>

<style>
/* 编辑态下区块的高亮与外挂工具栏（非 scoped：要作用到页面里的区块）*/
.site-editing-on {
  outline: 1px dashed rgba(34, 211, 238, .45);
  outline-offset: 6px;
}
.site-edit-toolbar {
  position: absolute; top: 6px; right: 6px; z-index: 40;
  display: flex; gap: 4px;
  background: rgba(9, 14, 26, .92);
  border: 1px solid rgba(148, 163, 184, .28);
  border-radius: 10px; padding: 4px;
}
.site-edit-toolbar button {
  width: 30px; height: 30px; border-radius: 8px; border: 0; cursor: pointer;
  background: rgba(148, 163, 184, .12); color: #e2e8f0; font-size: 14px; line-height: 1;
}
.site-edit-toolbar button:hover { background: rgba(34, 211, 238, .25); }

/* 编辑态：隐藏右下角客服浮窗（它压住保存按钮）和编辑入口按钮 */
body.site-editing .fixed.bottom-6.right-6,
body.site-editing .site-edit-fab { display: none !important; }
</style>
