#!/usr/bin/env node
// 抓取自检 · 手动跑一轮（不推 TG，只打印 4 项检查的实测结果）
//
// 用法（生产机上）：
//   cd /var/www/xnow && node scripts/seo-guard-check.mjs
//   cd /var/www/xnow && SEO_GUARD_HOSTS=xnow.taikon.top node scripts/seo-guard-check.mjs
//
// 用途：
//   · 查「现在到底还能不能被抓到」——不用登服务器逐个 curl
//   · 改完 CF 开关 / 改完 robots 后立刻确认效果
//   · 部署后确认自检本身是通的（全 ✅ 且退出码 0）
//
// 退出码：0 = 全部通过；1 = 有异常（CI / 人工都能直接看）

const mod = await import('../server/src/utils/seoWatch.js');
const results = await mod.runSeoGuard({ verbose: true, alert: false });

if (!results.length) {
    console.log('没有可检查的站点（.indexnow-hosts 不存在？用 SEO_GUARD_HOSTS=xnow.taikon.top 指定）');
    process.exit(0);
}

const bad = results.filter((r) => !r.ok);
console.log(bad.length ? `\n❌ ${bad.length} 项异常` : '\n✅ 全部通过');
process.exit(bad.length ? 1 : 0);
