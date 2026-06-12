<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <div class="logo">
        <span class="logo-mark">K</span>
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
        <el-icon class="menu-icon">
          <component :is="getRouteIcon(route.name)" />
        </el-icon>
        <transition name="fade-slide">
          <span v-show="!collapsed" class="menu-title">{{ route.meta?.title }}</span>
        </transition>
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <div class="server-status">
        <span :class="['status-dot', { connected: wsConnected }]"></span>
        <transition name="fade-slide">
          <span v-show="!collapsed" class="status-text">{{ wsConnected ? '服务运行中' : '连接已断开' }}</span>
        </transition>
      </div>
    </div>

    <el-tooltip :content="collapsed ? '展开侧边栏' : '收起侧边栏'" placement="right">
      <button
        type="button"
        class="toggle-button"
        :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
        :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="toggleSidebar"
      >
        <el-icon>
          <component :is="collapsed ? ArrowRight : ArrowLeft" />
        </el-icon>
      </button>
    </el-tooltip>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  DataAnalysis,
  DataBoard,
  Delete,
  Document,
  FolderChecked,
  Key,
  Lock,
  Message,
  Monitor,
  Setting,
  Tools,
  User
} from '@element-plus/icons-vue'
import { useWebSocketStore } from '../stores/websocket'
import { storeToRefs } from 'pinia'

const route = useRoute()
const router = useRouter()
const wsStore = useWebSocketStore()
const { connected: wsConnected } = storeToRefs(wsStore)

const collapsed = ref(false)
const isAdminLoggedIn = ref(!!localStorage.getItem('admin_token'))
const currentRoute = computed(() => route.path)

watch(() => route.path, () => {
  isAdminLoggedIn.value = !!localStorage.getItem('admin_token')
})

const routes = computed(() => {
  return router.getRoutes().filter(item => {
    if (!item.meta?.title || item.meta?.hiddenInMenu) return false
    if (item.name === 'admin-login') return !isAdminLoggedIn.value
    if (item.name === 'user-management') return isAdminLoggedIn.value
    return true
  })
})

const routeIcons: Record<string, any> = {
  dashboard: DataBoard,
  tasks: Document,
  accounts: User,
  check: FolderChecked,
  token: Key,
  email: Message,
  browser: Monitor,
  settings: Setting,
  logs: DataAnalysis,
  'deletion-logs': Delete,
  'user-management': User,
  'admin-login': Lock
}

const getRouteIcon = (name: unknown) => {
  return routeIcons[String(name)] || Tools
}

const toggleSidebar = () => {
  collapsed.value = !collapsed.value
  document.body.classList.toggle('sidebar-collapsed', collapsed.value)
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fbfdff;
  color: var(--text-primary);
  border-right: 1px solid var(--border-color);
  box-shadow: 1px 0 0 rgba(15, 23, 42, 0.02);
  transition: width 0.28s ease;
}

.sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar-header {
  padding: 18px 16px 16px;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}

.logo-mark {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 8px;
  background: #0f172a;
  color: #ffffff;
  font-size: 16px;
  font-weight: 800;
}

.logo-text {
  font-size: 17px;
  font-weight: 700;
  white-space: nowrap;
  letter-spacing: 0;
}

.sidebar-menu {
  flex: 1;
  padding: 14px 10px;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 42px;
  padding: 0 12px;
  margin-bottom: 3px;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
}

.sidebar.collapsed .menu-item {
  justify-content: center;
  padding: 0;
}

.menu-item:hover {
  background: #eef4fb;
  color: var(--text-primary);
}

.menu-item.active {
  background: #eaf2ff;
  color: var(--primary-dark);
  font-weight: 600;
  box-shadow: inset 3px 0 0 var(--primary-color);
}

.menu-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  font-size: 17px;
  flex-shrink: 0;
}

.menu-title {
  white-space: nowrap;
  font-size: 14px;
}

.sidebar-footer {
  padding: 14px 12px 16px;
  border-top: 1px solid var(--border-color);
}

.server-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 11px;
  border-radius: var(--radius-md);
  background: #f1f6fb;
  color: var(--text-secondary);
}

.sidebar.collapsed .server-status {
  justify-content: center;
  padding: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}

.status-dot.connected {
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.14);
}

.status-text {
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}

.toggle-button {
  position: fixed;
  left: calc(var(--sidebar-width) + 13px);
  top: 84px;
  z-index: 1001;
  width: 24px;
  height: calc(100vh - 160px);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: space-around;
  gap: 0;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: #ffffff;
  color: var(--text-secondary);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.09);
  cursor: pointer;
  transition:
    left 0.28s ease,
    transform 0.16s ease,
    color 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease;
}

.toggle-button:hover,
.toggle-button:focus-visible {
  color: var(--primary-color);
  border-color: #bfdbfe;
  background: #f8fbff;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.16);
  transform: translateX(2px);
  outline: none;
}

.toggle-button :deep(.el-icon) {
  font-size: 16px;
}

body.sidebar-collapsed .toggle-button {
  left: calc(var(--sidebar-collapsed-width) + 13px);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

@media (max-width: 767px) {
  .sidebar {
    width: var(--sidebar-collapsed-width);
  }

  .sidebar:not(.collapsed) {
    width: var(--sidebar-width);
    box-shadow: var(--shadow-md);
  }

  .logo-text,
  .menu-title,
  .status-text {
    display: none;
  }

  .sidebar:not(.collapsed) .logo-text,
  .sidebar:not(.collapsed) .menu-title,
  .sidebar:not(.collapsed) .status-text {
    display: inline;
  }

  .toggle-button {
    left: calc(var(--sidebar-collapsed-width) + 10px);
    top: 20px;
    height: calc(100vh - 40px);
  }

  .sidebar:not(.collapsed) .toggle-button {
    left: calc(var(--sidebar-width) + 10px);
  }
}
</style>
