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
// 默认假设配置已完成，避免每次刷新向导都闪现
// API 返回后会根据实际状态修正
const setupCompleted = ref(true)

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
  --primary-color: #1d4ed8;
  --primary-dark: #1e40af;
  --primary-soft: #eaf2ff;
  --accent-color: #0891b2;
  --success-color: #047857;
  --warning-color: #b45309;
  --danger-color: #b91c1c;
  --info-color: #0369a1;
  --bg-page: #f4f7fb;
  --bg-panel: #ffffff;
  --bg-muted: #f8fafc;
  --bg-subtle: #eef4fb;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-tertiary: #94a3b8;
  --border-color: #dbe4ef;
  --border-strong: #cbd5e1;
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 12px 28px rgba(15, 23, 42, 0.08);
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --sidebar-width: 260px;
  --sidebar-collapsed-width: 76px;
  --content-max-width: 1440px;
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
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(244, 247, 251, 0) 240px),
    var(--bg-page);
}

.main-content {
  flex: 1;
  margin-left: var(--sidebar-width);
  min-height: 100vh;
  padding: 24px 28px 32px;
  width: calc(100vw - var(--sidebar-width));
  max-width: 100%;
  overflow-x: hidden;
  transition: margin-left 0.28s ease, width 0.28s ease;
}

body.sidebar-collapsed .main-content {
  margin-left: var(--sidebar-collapsed-width);
  width: calc(100vw - var(--sidebar-collapsed-width));
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
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
  padding: 13px 18px !important;
  background: #fbfcfe !important;
}

.el-card__body {
  padding: 18px !important;
  background: #ffffff !important;
}

.el-button {
  border-radius: var(--radius-md) !important;
  font-weight: 500 !important;
  letter-spacing: 0 !important;
}

.el-button--primary {
  background: var(--primary-color) !important;
  border-color: var(--primary-color) !important;
}

.el-button--primary:hover {
  background: var(--primary-dark) !important;
  border-color: var(--primary-dark) !important;
  box-shadow: none !important;
  transform: translateY(-1px);
}

.el-input__wrapper,
.el-textarea__inner,
.el-select__wrapper {
  border-radius: var(--radius-md) !important;
  box-shadow: none !important;
  border: 1px solid #d8e0ec;
  background: #ffffff !important;
}

.el-input__wrapper:hover,
.el-select__wrapper:hover {
  border-color: #b9c7da;
}

.el-input__wrapper.is-focus,
.el-select__wrapper.is-focused {
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12) !important;
  border-color: var(--primary-color);
}

.el-table {
  border-radius: var(--radius-md) !important;
  overflow: hidden;
  color: var(--text-primary) !important;
}

.el-table th {
  background: #f8fafc !important;
  color: var(--text-secondary) !important;
  font-weight: 600 !important;
}

.el-table td,
.el-table th {
  border-color: #edf2f7 !important;
}

.el-alert {
  border-radius: var(--radius-lg) !important;
}

.el-tag {
  border-radius: var(--radius-sm) !important;
  font-weight: 600;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #eef3f8;
}

::-webkit-scrollbar-thumb {
  background: #bfccdb;
  border-radius: 999px;
}

::-webkit-scrollbar-thumb:hover {
  background: #9fb0c4;
}

@media (max-width: 767px) {
  .main-content {
    margin-left: 0;
    padding: 18px 14px 28px;
    width: 100vw;
  }

  body.sidebar-collapsed .main-content {
    margin-left: 0;
    width: 100vw;
  }
}
</style>
