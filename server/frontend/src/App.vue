<template>
  <div class="app-container">
    <SetupWizardView v-if="!setupCompleted" @complete="handleSetupComplete" />

    <template v-else>
      <Sidebar />
      <main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import SetupWizardView from './views/SetupWizardView.vue'
import { useWebSocketStore } from './stores/websocket'
import { checkSetupStatus } from './api/setup'

const wsStore = useWebSocketStore()
const setupCompleted = ref(false)

let sidebarObserver: MutationObserver | null = null

onMounted(async () => {
  try {
    const result = await checkSetupStatus()
    setupCompleted.value = !!(result.success && result.status?.completed)
  } catch (error) {
    console.error('检查初始化状态失败:', error)
    setupCompleted.value = false
  }

  if (setupCompleted.value) {
    wsStore.connect()

    sidebarObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'))
          }, 250)
        }
      })
    })

    sidebarObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    })
  }
})

const handleSetupComplete = () => {
  setupCompleted.value = true
  wsStore.connect()
}

onUnmounted(() => {
  wsStore.disconnect()
  sidebarObserver?.disconnect()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary-color: #2563eb;
  --primary-dark: #1d4ed8;
  --primary-soft: #eff6ff;
  --success-color: #059669;
  --warning-color: #d97706;
  --danger-color: #dc2626;
  --info-color: #0284c7;
  --bg-page: #f6f8fb;
  --bg-panel: #ffffff;
  --bg-muted: #f8fafc;
  --text-primary: #111827;
  --text-secondary: #64748b;
  --text-tertiary: #94a3b8;
  --border-color: #e2e8f0;
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
  --shadow-md: 0 8px 20px rgba(15, 23, 42, 0.08);
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
}

body {
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: var(--bg-page);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app-container {
  display: flex;
  min-height: 100vh;
  background: var(--bg-page);
}

.main-content {
  flex: 1;
  margin-left: 260px;
  min-height: 100vh;
  padding: 20px 24px;
  width: calc(100vw - 260px);
  max-width: 100%;
  overflow-x: hidden;
  transition: margin-left 0.28s ease, width 0.28s ease;
}

body.sidebar-collapsed .main-content {
  margin-left: 72px;
  width: calc(100vw - 72px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.el-card {
  border-radius: var(--radius-lg) !important;
  border: 1px solid var(--border-color) !important;
  box-shadow: var(--shadow-sm) !important;
  background: #ffffff !important;
}

.el-card:hover {
  box-shadow: var(--shadow-sm) !important;
  transform: none;
}

.el-card__header {
  border-bottom: 1px solid var(--border-color) !important;
  padding: 14px 18px !important;
  background: #fbfdff !important;
}

.el-card__body {
  padding: 18px !important;
  background: #ffffff !important;
}

.el-button {
  border-radius: var(--radius-md) !important;
  font-weight: 500 !important;
}

.el-button--primary {
  background: var(--primary-color) !important;
  border: none !important;
}

.el-button--primary:hover {
  background: var(--primary-dark) !important;
  box-shadow: none !important;
  transform: translateY(-1px);
}

.el-input__wrapper,
.el-textarea__inner,
.el-select__wrapper {
  border-radius: 10px !important;
  box-shadow: none !important;
  border: 1px solid transparent;
}

.el-input__wrapper:hover,
.el-select__wrapper:hover {
  border-color: #d8e0ef;
}

.el-input__wrapper.is-focus,
.el-select__wrapper.is-focused {
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12) !important;
}

.el-table {
  border-radius: var(--radius-md) !important;
  overflow: hidden;
}

.el-table th {
  background: #f9fafb !important;
  color: var(--text-secondary) !important;
  font-weight: 600 !important;
}

.el-alert {
  border-radius: var(--radius-lg) !important;
}

.el-tag {
  border-radius: 999px !important;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #edf2f7;
}

::-webkit-scrollbar-thumb {
  background: #c7d2e3;
  border-radius: 999px;
}

::-webkit-scrollbar-thumb:hover {
  background: #aab8cf;
}

@media (max-width: 767px) {
  .main-content {
    margin-left: 0;
    padding: 16px;
    width: 100vw;
  }

  body.sidebar-collapsed .main-content {
    margin-left: 0;
    width: 100vw;
  }
}
</style>
