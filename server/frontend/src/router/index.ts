import { createRouter, createWebHistory } from 'vue-router'

// 检查管理员登录状态
function isAdminLoggedIn(): boolean {
  const token = localStorage.getItem('admin_token')
  return !!token
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { title: '仪表盘', icon: '📊' }
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: () => import('../views/TasksView.vue'),
      meta: { title: '任务管理', icon: '📝' }
    },
    {
      path: '/accounts',
      name: 'accounts',
      component: () => import('../views/AccountsView.vue'),
      meta: { title: '账号管理', icon: '👤' }
    },
    {
      path: '/generator',
      name: 'generator',
      component: () => import('../views/GeneratorView.vue'),
      meta: { title: '账号生成', icon: '🎲' }
    },
    {
      path: '/check',
      name: 'check',
      component: () => import('../views/CheckView.vue'),
      meta: { title: '基本检测', icon: '🛡️' }
    },
    {
      path: '/token',
      name: 'token',
      component: () => import('../views/TokenView.vue'),
      meta: { title: 'Token管理', icon: '🔑' }
    },
    {
      path: '/import',
      name: 'import',
      component: () => import('../views/ImportAccountView.vue'),
      meta: { title: '导入账号', icon: '📥' }
    },
    {
      path: '/email',
      name: 'email',
      component: () => import('../views/EmailConfigView.vue'),
      meta: { title: '邮箱配置', icon: '📧' }
    },
    {
      path: '/browser',
      name: 'browser',
      component: () => import('../views/BrowserConfigView.vue'),
      meta: { title: '浏览器配置', icon: '🌐' }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: { title: '设置', icon: '⚙️' }
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('../views/LogsView.vue'),
      meta: { title: '实时日志', icon: '📊' }
    },
    {
      path: '/deletion-logs',
      name: 'deletion-logs',
      component: () => import('../views/DeletionLogsView.vue'),
      meta: { title: '删除日志', icon: '🗑️' }
    },
    {
      path: '/user-management',
      name: 'user-management',
      component: () => import('../views/UserManagementView.vue'),
      meta: { title: '用户管理', icon: '👥', requiresAuth: true }
    },
    {
      path: '/admin-login',
      name: 'admin-login',
      component: () => import('../views/AdminLoginView.vue'),
      meta: { title: '管理员登录', icon: '🔐' }
    }
  ]
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  // 检查路由是否需要管理员权限
  if (to.meta.requiresAuth) {
    if (isAdminLoggedIn()) {
      next()
    } else {
      // 未登录，重定向到管理员登录页
      next({ name: 'admin-login', query: { redirect: to.fullPath } })
    }
  } else {
    next()
  }
})

export default router
