import https from 'https'
import crypto from 'crypto'
import { Config } from '../models/index.js'
import { sendTgMessage } from './tgBot.js'
import { sanitizeAnnouncement } from './sanitize.js'

const fetchPage = (urlStr, options = {}) => {
  const u = new URL(urlStr)
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
      },
    )
    req.on('error', (e) => resolve({ error: e.message }))
    if (options.body) req.write(options.body)
    req.end()
  })
}

const getCleanAnnouncement = (raw) => {
  let html = raw.trim()
  html = html.replace(/var\(--color-id-\d+\)/g, '#ffffff')
  // 字号不再在此规整：入库前 sanitizeAnnouncement 会统一移除内联 font-size，交由前端样式一处控制
  // 清除上游广告和敏感信息
  html = html.replace(/<p[^>]*>[\s\S]*?tk7188\.top[\s\S]*?<\/p>/gi, '')
  html = html.replace(/<p[^>]*>[\s\S]*?tg频道[\s\S]*?<\/p>/gi, '')
  html = html.replace(/@tk7188\w*/g, '@客服')
  // 🔒 入库前白名单净化：剥掉 script/事件/javascript: 等危险内容，前端才可安全 v-html
  return sanitizeAnnouncement(html)
}

export const autoSyncAnnouncement = async () => {
  try {
    const urlConf = await Config.findOne({ where: { key: 'upstream_url' } })
    const loginUser = await Config.findOne({ where: { key: 'upstream_login_user' } })
    const loginPass = await Config.findOne({ where: { key: 'upstream_login_pass' } })

    if (!urlConf?.value || !loginUser?.value || !loginPass?.value) return

    const baseUrl = new URL(urlConf.value).origin

    // 获取 CSRF
    const home = await fetchPage(baseUrl)
    if (home.error) return

    const cookies = (home.headers['set-cookie'] || []).map((c) => c.split(';')[0])
    const csrfMatch = home.body.match(/name="_csrf"[^>]*value="([^"]+)"/)
    if (!csrfMatch) return

    // 登录（需带 Origin/Referer 头，否则上游 CSRF 防护会拒绝）
    const loginParams = new URLSearchParams()
    loginParams.append('LoginForm[username]', loginUser.value)
    loginParams.append('LoginForm[password]', loginPass.value)
    loginParams.append('_csrf', csrfMatch[1])

    const login = await fetchPage(baseUrl, {
      method: 'POST',
      headers: {
        Cookie: cookies.join('; '),
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: baseUrl,
        Referer: baseUrl + '/',
      },
      body: loginParams.toString(),
    })

    // 登录失败则退出
    if (login.status !== 302) {
      console.log('⚠️ [AutoAnnounce] 上游登录失败，状态码：' + login.status)
      return
    }

    const allCookies = [...cookies]
    ;(login.headers['set-cookie'] || []).forEach((nc) => {
      const name = nc.split('=')[0]
      const idx = allCookies.findIndex((c) => c.startsWith(name))
      if (idx >= 0) allCookies[idx] = nc.split(';')[0]
      else allCookies.push(nc.split(';')[0])
    })

    const dash = await fetchPage(baseUrl, {
      headers: { Cookie: allCookies.join('; '), Referer: baseUrl + '/' },
    })

    // 🛡️ 防御：抓取失败/非 200/空响应时直接退出，避免 dash.body 为 undefined 崩溃
    if (dash.error || dash.status !== 200 || typeof dash.body !== 'string') {
      console.log('⚠️ [AutoAnnounce] 公告页抓取失败: ' + (dash.error || ('HTTP ' + dash.status)))
      return
    }

    // 提取公告 — 从公告区块向上查找定位
    const annStart = dash.body.indexOf('刷粉风控期建议')
    if (annStart < 0) {
      console.log('⚠️ [AutoAnnounce] 未找到公告标记，上游公告格式可能已变更')
      return
    }

    const before = dash.body.substring(Math.max(0, annStart - 5000), annStart)
    const blockMatch = before.match(/id="block_(\d+)"/g)
    if (!blockMatch) return

    const blockId = blockMatch[blockMatch.length - 1].match(/\d+/)[0]
    const blockStartTag = 'id="block_' + blockId + '"'
    const blockStart = dash.body.indexOf(blockStartTag)
    const nextBlockStart = dash.body.indexOf('id="block_', blockStart + blockStartTag.length)
    const blockHtml = dash.body.substring(
      blockStart,
      nextBlockStart > 0 ? nextBlockStart : blockStart + 50000,
    )

    const descMatch = blockHtml.match(
      /<div class="text-block__description">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/,
    )
    if (!descMatch) return

    const newContent = getCleanAnnouncement(descMatch[1])

    // 对比现有公告，不同则更新
    const existing = await Config.findOne({ where: { key: 'announcement' } })
    const existingClean = existing?.value
      ? existing.value.replace(/var\(--color-id-\d+\)/g, '#ffffff').trim()
      : ''

    // 剥离 HTML 标签后比对纯文本，避免上游动态 HTML 属性导致的误判
    const _stripHtml = (s) =>
      s
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    const oldText = _stripHtml(existingClean)
    const newText = _stripHtml(newContent)

    // 提取版本号
    const _extractVersion = (s) => {
      const m = s.match(/【([^】]+)】/)
      return m ? m[1].trim() : ''
    }
    const oldVersion = _extractVersion(oldText)
    const newVersion = _extractVersion(newText)

    if (oldText === newText) {
      // 完全一致：不处理
    } else if (oldVersion !== newVersion) {
      // 版本号变了 → 真正的公告更新：更新 + 通知
      await Config.upsert({ key: 'announcement', value: newContent })
      const version = newVersion || '最新'
      console.log('📢 [AutoAnnounce] 公告已更新至: ' + version)
      sendTgMessage('📢 <b>公告已自动同步</b>\n版本: ' + version)
    } else {
      // 版本号相同但文本有差异
      // 用去噪比对确认是否是真正的内容变更，还是上游页面的动态干扰
      const newHash = crypto.createHash('md5').update(newText).digest('hex')

      // 读取上次记录的"待确认"hash
      const pendingConf = await Config.findOne({ where: { key: 'announce_pending_hash' } })
      const pendingHash = pendingConf?.value || ''

      if (pendingHash === newHash) {
        // 连续两次都是同一个"新内容" → 真正的变更，通知
        await Config.upsert({ key: 'announcement', value: newContent })
        await Config.upsert({ key: 'announce_pending_hash', value: '' }) // 清空待确认
        console.log('📢 [AutoAnnounce] 公告内容已更新（二次确认）')
        sendTgMessage('📢 <b>公告已自动同步</b>\n版本: ' + (newVersion || '最新'))
      } else {
        // 第一次看到这个新内容 → 记下hash，下次再确认
        await Config.upsert({ key: 'announce_pending_hash', value: newHash })
        // 也更新存储内容，但先不发通知
        await Config.upsert({ key: 'announcement', value: newContent })
        console.log('📢 [AutoAnnounce] 公告内容疑似变更，等待下次确认')
      }
    }
    // 静默：内容无变化时不输出任何日志，不通知
  } catch (e) {
    console.error('[AutoAnnounce] 同步失败:', e.message)
  }
}
