/**
 * 支付追踪器 - 记录所有发起的支付，用于回调失败时自动补单
 * 使用 JSON 文件持久化，服务重启不丢失
 */
import fs from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '../../data/pending_payments.json')

// 确保 data 目录存在
function ensureDir() {
  const dir = join(__dirname, '../../data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// 读取所有待处理支付
export function getPendingPayments() {
  try {
    ensureDir()
    if (!fs.existsSync(DB_PATH)) return []
    const raw = fs.readFileSync(DB_PATH, 'utf-8')
    return JSON.parse(raw) || []
  } catch { return [] }
}

// 写入待处理支付列表
function savePendingPayments(list) {
  ensureDir()
  fs.writeFileSync(DB_PATH, JSON.stringify(list, null, 2))
}

// 记录一笔新支付
export function addPendingPayment({ order_id, user_id, amount, pay_type }) {
  const list = getPendingPayments()
  // 去重
  if (list.some(p => p.order_id === order_id)) return
  list.push({
    order_id,
    user_id: String(user_id),
    amount: String(amount),
    pay_type,
    created_at: new Date().toISOString(),
    status: 'pending',  // pending | processing | completed | failed
    retry_count: 0,
    last_check: null
  })
  savePendingPayments(list)
}

// 标记为处理中（防止重复处理）
export function markProcessing(order_id) {
  const list = getPendingPayments()
  const item = list.find(p => p.order_id === order_id)
  if (item) {
    item.status = 'processing'
    item.last_check = new Date().toISOString()
    item.retry_count = (item.retry_count || 0) + 1
    savePendingPayments(list)
  }
}

// 标记为已完成
export function markCompleted(order_id) {
  const list = getPendingPayments()
  const idx = list.findIndex(p => p.order_id === order_id)
  if (idx >= 0) {
    list[idx].status = 'completed'
    list[idx].last_check = new Date().toISOString()
    savePendingPayments(list)
  }
}

// 标记为失败
export function markFailed(order_id, reason) {
  const list = getPendingPayments()
  const item = list.find(p => p.order_id === order_id)
  if (item) {
    item.status = 'failed'
    item.fail_reason = reason
    item.last_check = new Date().toISOString()
    savePendingPayments(list)
  }
}

// 清理过期的补单记录
//   2026-10-30 修：以前只清 completed，于是 failed / 卡死的 processing 会一直堆在文件里
//   （生产上攒了 8 月底的记录）。规则：
//     completed / failed  超过 30 天 → 删（判死的单不会再有转机）
//     pending / processing 超过 90 天 → 删（连支付网关都不认了，留着只是噪音）
//     其余一律保留（可能是用户正在等他付款到账，删了就等于吞钱）
export function cleanOldPayments() {
  const now = Date.now()
  const cutoff = now - 30 * 24 * 60 * 60 * 1000
  const hardCutoff = now - 90 * 24 * 60 * 60 * 1000
  const filtered = getPendingPayments().filter((p) => {
    // 计龄口径：已结束的（completed/failed）看「发起时间」，还没结束的看「最后一次检查」
    // —— 否则 markFailed 刚把 last_check 刷成现在，这条永远不到 30 天，清不掉。
    const ended = p.status === 'completed' || p.status === 'failed'
    const ts = new Date(ended ? p.created_at : (p.last_check || p.created_at)).getTime()
    if (!Number.isFinite(ts)) return false
    if (ended) return ts > cutoff
    return ts > hardCutoff
  })
  savePendingPayments(filtered)
}
