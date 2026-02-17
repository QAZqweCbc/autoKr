<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <div class="logo">
        <span class="logo-icon">🚀</span>
        <transition name="fade-slide">
          <span v-show="!collapsed" class="logo-text">Kiro Server</span>
        </transition>
      </div>
    </div>

    <nav class="sidebar-menu">
      <router-link
        v-for="route in routes"
        :key="route.path"
        :to="route.path"
        class="menu-item"
        :class="{ active: currentRoute === route.path }"
      >
        <span class="menu-icon">{{ route.meta?.icon }}</span>
        <transition name="fade-slide">
          <span v-show="!collapsed" class="menu-title">{{ route.meta?.title }}</span>
        </transition>
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <div class="server-status">
        <span :class="['status-dot', { connected: wsConnected }]"></span>
        <transition name="fade-slide">
          <span v-show="!collapsed" class="status-text">{{ wsConnected ? '服务运行中' : '连接断开' }}</span>
        </transition>
      </div>
    </div>

    <!-- 收起/展开按钮 - 放在侧边栏外面 -->
    <el-button
      :icon="collapsed ? ArrowRight : ArrowLeft"
      circle
      size="small"
      class="toggle-button"
      @click="toggleSidebar"
    />
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { useWebSocketStore } from '../stores/websocket'
import { storeToRefs } from 'pinia'

const route = useRoute()
const router = useRouter()
const wsStore = useWebSocketStore()
const { connected: wsConnected } = storeToRefs(wsStore)

const collapsed = ref(false)
const isAdminLoggedIn = ref(!!localStorage.getItem('admin_token'))

// 监听路由变化，更新登录状态
watch(() => route.path, () => {
  isAdminLoggedIn.value = !!localStorage.getItem('admin_token')
})

const currentRoute = computed(() => route.path)

const routes = computed(() => {
  const allRoutes = router.getRoutes().filter(r => r.meta?.title)
  
  return allRoutes.filter(route => {
    // 管理员登录页：只在未登录时显示
    if (route.name === 'admin-login') {
      return !isAdminLoggedIn.value
    }
    // 用户管理页：只在已登录时显示
    if (route.name === 'user-management') {
      return isAdminLoggedIn.value
    }
    // 其他页面都显示
    return true
  })
})

const toggleSidebar = () => {
  collapsed.value = !collapsed.value
  // 通知 App.vue 更新主内容区域的 margin
  document.body.classList.toggle('sidebar-collapsed', collapsed.value)
}
</script>

<style scoped>
.sidebar {
  width: 280px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  flex-direction: column;
  height: 100vh;
  transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  box-shadow: 4px 0 24px rgba(102, 126, 234, 0.15);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.sidebar.collapsed {
  width: 80px;
}

.sidebar-header {
  padding: 28px 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  min-height: 84px;
}

.sidebar.collapsed .sidebar-header {
  padding: 28px 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 14px;
  transition: all 0.3s;
  overflow: hidden;
}

.logo-icon {
  font-size: 32px;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
  animation: float 3s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
}

.logo-text {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  white-space: nowrap;
}

.sidebar-menu {
  flex: 1;
  padding: 16px 12px;
  overflow-y: auto;
  overflow-x: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 48px;
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  margin-bottom: 8px;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 500;
  cursor: pointer;
  overflow: hidden;
  position: relative;
}

.sidebar.collapsed .menu-item {
  padding: 0;
  justify-content: center;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.sidebar.collapsed .menu-item:hover {
  transform: translateX(0) scale(1.05);
}

.menu-item.active {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.menu-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 24px;
  background: white;
  border-radius: 0 4px 4px 0;
}

.sidebar.collapsed .menu-item.active::before {
  display: none;
}

.menu-icon {
  font-size: 22px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
}

.menu-title {
  margin-left: 12px;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.sidebar.collapsed .sidebar-footer {
  padding: 24px 12px;
}

.server-status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  backdrop-filter: blur(10px);
  transition: all 0.3s;
  overflow: hidden;
}

.sidebar.collapsed .server-status {
  padding: 12px;
  justify-content: center;
}

.status-dot {
  width: 10px;
  height: 10px;
  background: #ef4444;
  border-radius: 50%;
  animation: pulse 2s infinite;
  box-shadow: 0 0 12px currentColor;
  flex-shrink: 0;
}

.status-dot.connected {
  background: #4ade80;
}

.status-text {
  white-space: nowrap;
}

@keyframes pulse {
  0%, 100% { 
    opacity: 1;
    transform: scale(1);
  }
  50% { 
    opacity: 0.6;
    transform: scale(1.1);
  }
}

/* 淡入淡出 + 滑动动画 */
.fade-slide-enter-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0.1s;
}

.fade-slide-leave-active {
  transition: all 0.17s cubic-bezier(0.4, 0, 1, 1)0.1s;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* 滚动条美化 */
.sidebar-menu::-webkit-scrollbar {
  width: 6px;
}

.sidebar-menu::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.sidebar-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.sidebar-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 收起/展开按钮 */
.toggle-button {
  position: fixed;
  left: 260px;
  top: 40px;
  z-index: 1001;
  background: white !important;
  color: #667eea !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s !important;
  border: 2px solid #667eea !important;
}

body.sidebar-collapsed .toggle-button {
  left: 60px;
}

.toggle-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.3) !important;
  background: linear-gradient(135deg, #667eea, #764ba2) !important;
  color: white !important;
}
</style>
