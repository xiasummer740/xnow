#!/usr/bin/env node
/**
 * 把 Markdown 转成 Telegraph 的 Node[] 格式并发布
 *
 * Telegraph（telegra.ph）不需要注册、有公开 API、页面会被 Google 索引，
 * 适合放「给客户看」的长文（使用说明 / 选购指南 / 行业说明）。
 * 缺点：出站链接是 nofollow，权重价值低，主要是曝光和搜索长尾。
 *
 * 支持：# / ## / ### 标题、段落、- 列表、1. 有序列表、**粗体**、`代码`、[链接](url)
 *
 * 用法：
 *   node scripts/telegraph-publish.mjs <markdown文件> [标题]
 *   node scripts/telegraph-publish.mjs article.md --dry     # 只看解析结果，不发
 *
 * 凭据：server/.telegraph-token.txt 或 .secrets/telegraph-token.txt
 *       没有的话会自动 createAccount 建一个并存下来
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TOKEN_CANDIDATES = [
    path.join(ROOT, 'server', '.telegraph-token.txt'),
    path.join(ROOT, '.secrets', 'telegraph-token.txt'),
    '/var/www/xnow/server/.telegraph-token.txt',
];
const AUTHOR = process.env.TELEGRAPH_AUTHOR || 'XNOW PRO';
const API = 'https://api.telegra.ph';

/**
 * 行内解析：**粗体** `代码` [文字](url) 裸URL
 *
 * ⚠️ 裸 URL 必须显式转成 <a>，Telegraph 不会自动识别。
 *    第一版漏了这条，发出去的文章里链接全是纯文本，等于没有外链。
 */
function inline(text) {
    const out = [];
    const re = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) out.push(text.slice(last, m.index));
        const tok = m[0];
        if (tok.startsWith('**')) out.push({ tag: 'strong', children: [tok.slice(2, -2)] });
        else if (tok.startsWith('`')) out.push({ tag: 'code', children: [tok.slice(1, -1)] });
        else if (tok.startsWith('[')) {
            const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
            out.push({ tag: 'a', attrs: { href: mm[2] }, children: [mm[1]] });
        } else {
            // 裸 URL → 可点链接，显示原文
            out.push({ tag: 'a', attrs: { href: tok }, children: [tok] });
        }
        last = m.index + tok.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out.filter((x) => (typeof x === 'string' ? x.length > 0 : true));
}

function markdownToNodes(md) {
    const lines = md.split(/\r?\n/);
    const nodes = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }

        // 标题
        const h = /^(#{1,4})\s+(.*)$/.exec(line);
        if (h) {
            const level = Math.min(h[1].length + 1, 4);   // # → h3（Telegraph 正文从 h3 起）
            nodes.push({ tag: `h${level}`, children: inline(h[2].trim()) });
            i++;
            continue;
        }

        // 无序列表
        if (/^[-*]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
                items.push({ tag: 'li', children: inline(lines[i].replace(/^[-*]\s+/, '').trim()) });
                i++;
            }
            nodes.push({ tag: 'ul', children: items });
            continue;
        }

        // 有序列表
        if (/^\d+\.\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
                items.push({ tag: 'li', children: inline(lines[i].replace(/^\d+\.\s+/, '').trim()) });
                i++;
            }
            nodes.push({ tag: 'ol', children: items });
            continue;
        }

        // 分隔线
        if (/^---+$/.test(line.trim())) { nodes.push({ tag: 'hr' }); i++; continue; }

        // 普通段落（连续非空行合并）
        const para = [];
        while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|[-*]\s|\d+\.\s|---+$)/.test(lines[i])) {
            para.push(lines[i].trim());
            i++;
        }
        if (para.length) nodes.push({ tag: 'p', children: inline(para.join(' ')) });
    }
    return nodes;
}

async function getToken() {
    for (const p of TOKEN_CANDIDATES) {
        if (existsSync(p)) return readFileSync(p, 'utf8').trim();
    }
    const res = await fetch(`${API}/createAccount?short_name=XNOW&author_name=${encodeURIComponent(AUTHOR)}`);
    const data = await res.json();
    if (!data.ok) throw new Error('createAccount 失败: ' + JSON.stringify(data).slice(0, 200));
    const token = data.result.access_token;
    try { writeFileSync(path.join(ROOT, 'server', '.telegraph-token.txt'), token); } catch {}
    console.log('[telegraph] 新建账号，token 已保存');
    return token;
}

const main = async () => {
    const args = process.argv.slice(2);
    const dry = args.includes('--dry');
    // --update <path>：它的值不是标题，取标题时要排除掉
    const updIdxEarly = args.indexOf('--update');
    const updatePath = updIdxEarly >= 0 ? args[updIdxEarly + 1] : null;
    const file = args.find((a, k) => !a.startsWith('--') && a !== updatePath);
    if (!file) { console.error('用法: node scripts/telegraph-publish.mjs <markdown> [标题] [--dry] [--update <path>]'); process.exit(1); }

    const md = readFileSync(file, 'utf8');
    let nodes = markdownToNodes(md);
    // 标题：显式参数 > markdown 第一个 # 标题 > 文件名
    const firstH = /^#\s+(.+)$/m.exec(md);
    const explicitTitle = args.find((a, k) => !a.startsWith('--') && a !== updatePath && a !== file);
    const title = explicitTitle || (firstH ? firstH[1].trim() : path.basename(file, '.md'));

    // Telegraph 页面自带 title，正文里第一个标题节点会和它重复，去掉
    if (nodes.length && /^h[2-4]$/.test(nodes[0].tag)) {
        const firstText = (nodes[0].children || []).join('').trim();
        if (firstText === title.trim()) nodes = nodes.slice(1);
    }

    console.log(`[telegraph] 标题: ${title}`);
    console.log(`[telegraph] 节点数: ${nodes.length}`);
    if (dry) {
        console.log(JSON.stringify(nodes.slice(0, 5), null, 2));
        console.log('... （--dry 模式，未发布）');
        return;
    }

    const token = await getToken();
    const body = new URLSearchParams({
        access_token: token,
        title,
        author_name: AUTHOR,
        content: JSON.stringify(nodes),
        return_content: 'false',
    });
    // --update <path> 用 editPage 改已发布的页面
    const updIdx = args.indexOf('--update');
    if (updIdx >= 0) {
        const pagePath = args[updIdx + 1];
        body.set('path', pagePath);
        const res = await fetch(`${API}/editPage`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });
        const data = await res.json();
        if (!data.ok) {
            console.error('[telegraph] 更新失败:', JSON.stringify(data).slice(0, 300));
            process.exit(1);
        }
        console.log(`[telegraph] ✅ 已更新 ${data.result.url}`);
        return;
    }

    const res = await fetch(`${API}/createPage`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const data = await res.json();
    if (!data.ok) {
        console.error('[telegraph] 发布失败:', JSON.stringify(data).slice(0, 300));
        process.exit(1);
    }
    console.log(`[telegraph] ✅ ${data.result.url}`);
    console.log(`            路径: ${data.result.path}`);
};

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
