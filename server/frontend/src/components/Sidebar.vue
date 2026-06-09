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
          <span v-show="!collapsed" class="status-text">{{ wsConnected ? '服务运行中' : '连接已断开' }}</span>
        </transition>
      </div>
    </div>

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
import { computed, ref, watch } from 'vue'
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

const toggleSidebar = () => {
  collapsed.value = !collapsed.value
  document.body.classList.toggle('sidebar-collapsed', collapsed.value)
}
</script>

<style scoped>
.sidebar {
  width: 260px;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  color: var(--text-primary);
  border-right: 1px solid var(--border-color);
  box-shadow: none;
  transition: width 0.28s ease;
}

.sidebar.collapsed {
  width: 72px;
}

.sidebar-header {
  padding: 18px 16px;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
}

.logo-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
}

.sidebar-menu {
  flex: 1;
  padding: 12px 10px;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 40px;
  padding: 0 12px;
  margin-bottom: 4px;
  color: #475569;
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: background 0.16s ease, color 0.16s ease;
}

.sidebar.collapsed .menu-item {
  justify-content: center;
  padding: 0;
}

.menu-item:hover {
  background: #f1f5f9;
  color: var(--text-primary);
}

.menu-item.active {
  background: var(--primary-soft);
  color: var(--primary-dark);
  font-weight: 600;
}

.menu-icon {
  width: 24px;
  display: inline-flex;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.menu-title {
  white-space: nowrap;
}

.sidebar-footer {
  padding: 14px 12px 16px;
  border-top: 1px solid var(--border-color);
}

.server-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: #f8fafc;
  color: #475569;
}

.sidebar.collapsed .server-status {
  justify-content: center;
  padding: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #f87171;
}

.status-dot.connected {
  background: #4ade80;
}

.status-text {
  white-space: nowrap;
}

.toggle-button {
  position: fixed;
  left: 244px;
  top: 22px;
  z-index: 1001;
  border: none !important;
  box-shadow: var(--shadow-sm) !important;
}

body.sidebar-collapsed .toggle-button {
  left: 56px;
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
</style>
