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

// 清理30天前的已完成记录
export function cleanOldPayments() {
  const list = getPendingPayments()
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const filtered = list.filter(p => {
    if (p.status === 'completed') {
      return new Date(p.last_check || p.created_at).getTime() > cutoff
    }
    return true
  })
  savePendingPayments(filtered)
}
