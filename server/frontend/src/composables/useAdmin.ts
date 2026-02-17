import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

/**
 * 管理员认证相关的组合式函数
 */
export function useAdmin() {
  const router = useRouter()
  const adminToken = ref(localStorage.getItem('admin_token') || '')

  // 检查是否已登录
  const isAuthenticated = () => {
    return !!adminToken.value
  }

  // 退出登录
  const logout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_info')
    ElMessage.success('已退出登录')
    router.push('/admin-login')
  }

  // 检查认证状态，未登录则跳转
  const requireAuth = () => {
    if (!isAuthenticated()) {
      ElMessage.warning('请先登录管理员账户')
      router.push('/admin-login')
      return false
    }
    return true
  }

  return {
    adminToken,
    isAuthenticated,
    logout,
    requireAuth
  }
}
