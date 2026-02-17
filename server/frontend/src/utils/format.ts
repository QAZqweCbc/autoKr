/**
 * 格式化工具函数
 */

// 格式化时间戳为本地时间字符串
export function formatTime(timestamp: number | string): string {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}

// 格式化数字（添加千位分隔符）
export function formatNumber(num: number): string {
  if (num === null || num === undefined) return '0'
  return num.toLocaleString('zh-CN')
}

// 根据百分比获取颜色类名
export function getUsageClass(percent: number): string {
  if (percent < 50) return 'success'
  if (percent < 75) return 'warning'
  if (percent < 85) return 'danger'
  return 'info'
}

// 获取进度条颜色
export function getProgressColor(percent: number): string {
  if (percent < 50) return '#67C23A'
  if (percent < 75) return '#E6A23C'
  if (percent < 85) return '#F56C6C'
  return '#909399'
}

// 用户状态文本映射
export function getUserStatusText(status: string): string {
  const map: Record<string, string> = {
    active: '正常',
    suspended: '暂停',
    banned: '封禁'
  }
  return map[status] || status
}

// 分配状态文本映射
export function getAllocationStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝',
    active: '活跃',
    revoked: '已释放'
  }
  return map[status] || status
}

// 分配状态类型映射
export function getAllocationStatusType(status: string): string {
  const map: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    active: 'success',
    revoked: 'info'
  }
  return map[status] || 'info'
}
