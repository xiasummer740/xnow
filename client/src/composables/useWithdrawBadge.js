import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * 💸 提现角标（像微信未读消息那样的小红点数字）
 *
 * 为什么单独抽出来：密室 tab 栏、「分站管理」子导航都在不同的页面/组件里，
 * 各自去轮询会把接口打爆。这里做成模块级单例 —— 不管挂几个组件，只有一份状态、一个定时器。
 *
 * 只在主站管理员（admin / super_admin）身份下工作；其他角色直接跳过，不发请求。
 */
const pendingCount = ref(0)
const pendingSum = ref(0)
let timer = null
let refCount = 0
let inflight = false

const isStaff = () => {
  try {
    const u = JSON.parse(localStorage.getItem('xnow_user') || '{}')
    return ['admin', 'super_admin'].includes(u.role)
  } catch (e) { return false }
}

export const refreshWithdrawBadge = async () => {
  if (!isStaff() || inflight) return
  inflight = true
  try {
    const token = localStorage.getItem('xnow_token') || ''
    const r = await fetch('/api/admin/site-withdrawals/badge', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(x => x.json())
    if (r.status === 'success') {
      pendingCount.value = Number(r.data.pending_cnt || 0)
      pendingSum.value = Number(r.data.pending_sum || 0)
    }
  } catch (e) { /* 网络抖动不打扰用户 */ }
  finally { inflight = false }
}

const startTimer = () => {
  if (timer || !isStaff()) return
  refreshWithdrawBadge()
  timer = setInterval(refreshWithdrawBadge, 60000)   // 一分钟一刷，够快也不打库
}

const stopTimer = () => {
  if (timer) { clearInterval(timer); timer = null }
  pendingCount.value = 0
  pendingSum.value = 0
}

export function useWithdrawBadge() {
  onMounted(() => {
    refCount++
    startTimer()
    // 页面切回来时立即刷一次（用户可能刚处理完）
    document.addEventListener('visibilitychange', refreshWithdrawBadge)
  })
  onBeforeUnmount(() => {
    refCount--
    document.removeEventListener('visibilitychange', refreshWithdrawBadge)
    if (refCount <= 0) stopTimer()
  })
  return { pendingCount, pendingSum, refreshWithdrawBadge }
}
