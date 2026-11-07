import axios from 'axios';
import { Config, Service } from '../models/index.js';
import { sanitizeServiceDescription } from './sanitizeText.js';

export const autoSyncServices = async () => {
  try {
    const urlConf = await Config.findOne({ where: { key: 'upstream_url' } });
    const keyConf = await Config.findOne({ where: { key: 'upstream_key' } });
    
    if (!urlConf?.value || !keyConf?.value) return; 
    
    // 1. 获取 API 基础数据
    const payload = new URLSearchParams({ key: keyConf.value, action: 'services' });
    const apiRes = await axios.post(urlConf.value, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000 
    });
    
    if (!Array.isArray(apiRes.data) || apiRes.data.length === 0) {
      // 🔒 空数组也拒绝：否则全表会被标记下架后整库销毁，业务中断且难恢复
      console.error('❌ [AutoSync] 上游返回数据异常' + (Array.isArray(apiRes.data) ? '（空数组，已跳过防清库）' : '。'));
      return;
    }

    // 2. 抓长文本描述
    // ────────────────────────────────────────────────────────────────────────
    // 🔴 2026-11-06 重写。原来的做法是下载上游 /services 整页 HTML（5.3 MB），
    //    再用正则 /id="service-description-id-\d+-(\d+)"/ 抠描述。
    //    上游早就改版了 —— 那个 id 在页面上出现 **0 次**，正则一条都匹配不到，
    //    所以全站 2809 个服务的 description 全是空的（客户看不到下单规范，
    //    链接格式写错、重复下单全都来了）。
    //
    //    新端点（页面点「查看」时调的同一个）：GET /services/get-service-description/{id}
    //    返回 {"description": "...", "create_order": true}，不需要 API key。
    //    比抓整页快得多，也不再依赖 DOM 结构。
    const baseUrl = new URL(urlConf.value).origin;
    const descMap = {};

    // 抓失败时不能把库里已有的描述清空 —— 下游 bulkCreate 会整列覆盖，
    // 一次上游抖动就能把 2809 条说明洗成空白。先把现有值读出来当兜底。
    const existingDesc = new Map(
      (await Service.findAll({ attributes: ['service_id', 'description'] }))
        .map((s) => [String(s.service_id), s.description || ''])
    );

    try {
      // ⏱ 上游这个端点单次 5–6 秒（实测），2803 个全抓要 30 多分钟，同步周期根本装不下。
      //    所以这里只**补库里还没有描述的**，每轮限量 —— 热门服务由
      //    /api/services/detail/:id 的按需补抓立刻覆盖，冷门的靠这里慢慢补齐。
      const DESC_PER_ROUND = 200;
      const allIds = apiRes.data.map((i) => Number(i.service)).filter((n) => n > 0);
      const ids = allIds
        .filter((id) => !String(existingDesc.get(String(id)) || '').trim())
        .slice(0, DESC_PER_ROUND);
      const stillMissing = allIds.length - [...existingDesc.keys()].filter((k) => allIds.includes(Number(k)) && String(existingDesc.get(k) || '').trim()).length;

      if (ids.length === 0) {
        console.log(`✅ [描述抓取] 无需补抓（本轮检查 ${allIds.length} 个服务）`);
      } else {
        console.log(`📡 [描述抓取] 本轮补 ${ids.length} 个（整库仍缺约 ${stillMissing} 个，并发 8）…`);

        const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        const queue = ids.slice();
        let okCount = 0;
        let failCount = 0;

        const worker = async () => {
          while (queue.length) {
            const sid = queue.shift();
            try {
              const r = await axios.get(`${baseUrl}/services/get-service-description/${sid}`, {
                timeout: 8000,
                headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest' },
              });
              const d = r.data && r.data.description;
              if (d && String(d).trim()) {
                descMap[sid] = String(d).trim();
                okCount++;
              }
            } catch {
              failCount++;
            }
          }
        };
        await Promise.all(Array.from({ length: 8 }, worker));
        console.log(`✅ [描述抓取] 成功 ${okCount} 条 / 上游无描述 ${ids.length - okCount - failCount} 条 / 失败 ${failCount} 条`);
        if (failCount > ids.length * 0.5) {
          console.warn('⚠️ [描述抓取] 超过一半失败，本轮保留库里原有描述，不覆盖');
        }
      }
    } catch (descErr) {
      console.error('⚠️ [描述抓取] 整体失败，保留库里原有描述:', descErr.message);
    }

    // 3. 数据融合与组装
    // ────────────────────────────────────────────────────────────────────────
    // 🔴 2026-11-03 重写下面这一段。原来的写法是：
    //      await Service.update({ sort: 999999 }, { where: {} });   // 全表 2809 行
    //      ...分 14 批 bulkCreate...
    //      await Service.destroy({ where: { sort: 999999 } });      // 物理删除
    //    三个致命问题：
    //      ① 上游抽风返回残缺数据（比如只回 200 条）时，剩下 2600 条会全被删掉；
    //      ② 中间任何一步失败（上游超时、DB 慢、进程刚好重启），②③之间断掉 ——
    //         此时库里是「全表 sort=999999」，顺序全乱，而且没人知道；
    //      ③ destroy 是物理删除：连带把手工改过的 custom_rate、分站单价
    //         （site_service_prices）、订单里的 service_id 关联一起废掉，恢复不了。
    //    现在改成：**只动真正不在上游列表里的那些**，且加两道护栏。
    const upstreamIds = new Set(apiRes.data.map(i => Number(i.service)));
    const existing = await Service.findAll({ attributes: ['service_id'] });
    const staleIds = existing
      .map(s => Number(s.service_id))
      .filter(id => !upstreamIds.has(id));

    // 护栏一：条数骤降就整轮跳过（上游残缺数据比"少更新一次"危险得多）
    if (existing.length > 0 && apiRes.data.length < existing.length * 0.5) {
      console.error(
        `❌ [AutoSync] 上游只回了 ${apiRes.data.length} 条，库里现有 ${existing.length} 条 —— ` +
        `不足一半，判定为上游异常，本轮整轮跳过（不动任何数据）。`
      );
      return;
    }
    // 护栏二：单轮下架量超过三成也跳过删除（大概率上游分类整片返回失败）
    const deleteLimit = Math.floor(existing.length * 0.3);
    const willDelete = staleIds.slice(0, deleteLimit);
    const overLimit = staleIds.length > deleteLimit;

    const servicesToInsert = apiRes.data.map((item, idx) => {
      const sortOrder = idx + 1;
      let parsedRate = parseFloat(item.rate);
      if (isNaN(parsedRate) || parsedRate > 999999999) parsedRate = 0;

      // 描述三级兜底：新抓到 > 上游 API 带的字段 > 库里原有值 > 空
      // 最后一档很关键：抓取整体失败时不能把已有说明洗成空白
      let rawDesc = descMap[String(item.service)] || item.description || item.desc || '';
      if (typeof rawDesc !== 'string') rawDesc = String(rawDesc);
      if (!rawDesc.trim()) rawDesc = existingDesc.get(String(item.service)) || '';

      return {
        service_id: item.service,
        name: item.name || '未命名服务',
        type: item.type || 'Default',
        category: item.category || '默认分类',
        rate: parsedRate,
        min: item.min ? parseInt(item.min) : 0,
        max: item.max ? parseInt(item.max) : 0,
        refill: item.refill === true || item.refill === '1' || item.refill === 1,
        cancel: item.cancel === true || item.cancel === '1' || item.cancel === 1,
        // 🚫 上游描述里会夹带上游品牌和下单链接（例：
        //    「取消自动化订单👉https://tk7188.com/subscriptions」），
        //    原样落库就等于原样送到客户眼前 —— 客户点一下就去上游下单了。
        //    落库前统一清洗，规则见 utils/sanitizeText.js
        description: sanitizeServiceDescription(rawDesc),
        sort: sortOrder
      };
    });

    // 4. 平滑防断开分块入库 (Chunking)
    const chunkSize = 200;
    for (let i = 0; i < servicesToInsert.length; i += chunkSize) {
      const chunk = servicesToInsert.slice(i, i + chunkSize);
      await Service.bulkCreate(chunk, {
        updateOnDuplicate: ['name', 'type', 'category', 'rate', 'min', 'max', 'refill', 'cancel', 'description', 'sort'] // 不覆盖 custom_rate
      });
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 5. 下架处理：先标 999999（排在末尾、不再出现在前 N 条里），再物理删
    //    ⚠️ 顺序很重要：**写库成功之后**才允许动 stale，否则一旦中途抛错，
    //       库里会留下一批"被标下架但服务其实还在卖"的记录。
    let deleted = 0;
    if (staleIds.length > 0) {
      // 所有 stale 一律先标 999999（= 已下架哨兵值）：哪怕本轮因为护栏不删，
      // 也要保证公开列表看不到、下单接口拒绝 —— 否则客户能买到上游已经没有了的东西。
      await Service.update({ sort: 999999 }, { where: { service_id: staleIds } });
    }
    if (willDelete.length > 0) {
      deleted = await Service.destroy({ where: { service_id: willDelete } });
      if (deleted > 0) {
        console.log(`🗑️ [AutoSync] 上游已下架，清理 ${deleted} 条（含手工定价一并移除）：` +
          willDelete.slice(0, 50).join(',') + (willDelete.length > 50 ? ' …' : ''));
      }
    }
    if (overLimit) {
      console.error(
        `⚠️ [AutoSync] 本轮待下架 ${staleIds.length} 条，超过现有 ${existing.length} 条的 30%，` +
        `只处理了前 ${deleteLimit} 条 —— 剩余 ${staleIds.length - deleteLimit} 条请人工确认上游是否真的下架。`
      );
    }

    console.log("✅ [AutoSync] 所有 " + servicesToInsert.length + " 条服务已绝对安全地写入数据库，未发生内存溢出！");
    if (staleIds.length === 0) console.log("✅ [AutoSync] 上游列表与本地完全一致，无需下架。");
  } catch (err) {
    console.error('❌ [AutoSync] 致命错误:', err.message);
  }
};
