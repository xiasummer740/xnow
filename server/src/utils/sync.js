import axios from 'axios';
import { Config, Service } from '../models/index.js';

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
    
    if (!Array.isArray(apiRes.data)) {
      console.error('❌ [AutoSync] 上游返回数据异常。');
      return;
    }

    // 2. 原生正则爬虫获取长文本描述 (极速 & 内存安全)
    const baseUrl = new URL(urlConf.value).origin; 
    let descMap = {};
    
    try {
      console.log(`📡 正在启动原生正则爬虫，抓取页面: ${baseUrl}/services ...`);
      let htmlRes = await axios.get(`${baseUrl}/services`, { 
        timeout: 25000,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        }
      });
      
      let htmlStr = htmlRes.data;
      htmlRes.data = null; 
      htmlRes = null;

      // 🎯 终极正则匹配：匹配 <div ... id="service-description-id-任意数字-真实ID">任意内容</div>
      const regex = /id="service-description-id-\d+-(\d+)"[^>]*>([\s\S]*?)<\/div>/g;
      let match;
      while ((match = regex.exec(htmlStr)) !== null) {
          const sid = match[1];
          const rawContent = match[2];
          
          // 进一步清理内部多余的结构（如果有），保留纯净的 HTML 换行描述
          const cleanDesc = rawContent.replace(/<div class="panel-description">/g, '').replace(/<\/div>/g, '').trim();
          descMap[sid] = cleanDesc;
      }
      
      htmlStr = null; 
      console.log(`✅ [原生爬虫] 成功且安全地提取了 ${Object.keys(descMap).length} 条隐藏描述。`);
    } catch (htmlErr) {
      console.log("⚠️ [原生爬虫] 抓取描述受阻：", htmlErr.message);
    }

    // 3. 数据融合与组装
    // 先将所有现有服务置为末尾排序，避免上游已下架服务遗留居前
    await Service.update({ sort: 999999 }, { where: {} });

    const servicesToInsert = apiRes.data.map((item, idx) => {
      const sortOrder = idx + 1;
      let parsedRate = parseFloat(item.rate);
      if (isNaN(parsedRate) || parsedRate > 999999999) parsedRate = 0;

      let rawDesc = descMap[String(item.service)] || item.description || item.desc || '';
      if (typeof rawDesc !== 'string') rawDesc = String(rawDesc);

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
        description: rawDesc,
        sort: sortOrder
      };
    });

    // 4. 平滑防断开分块入库 (Chunking)
    const chunkSize = 200;
    for (let i = 0; i < servicesToInsert.length; i += chunkSize) {
      const chunk = servicesToInsert.slice(i, i + chunkSize);
      await Service.bulkCreate(chunk, {
        updateOnDuplicate: ['name', 'type', 'category', 'rate', 'min', 'max', 'refill', 'cancel', 'description', 'sort']
      });
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 清理已下架的服务(排序值仍为999999的)
    const deleted = await Service.destroy({ where: { sort: 999999 } });
    if (deleted > 0) console.log("🗑️ [AutoSync] 已清理 " + deleted + " 条下架服务");

    console.log("✅ [AutoSync] 所有 " + servicesToInsert.length + " 条服务已绝对安全地写入数据库，未发生内存溢出！");
  } catch (err) {
    console.error('❌ [AutoSync] 致命错误:', err.message);
  }
};
