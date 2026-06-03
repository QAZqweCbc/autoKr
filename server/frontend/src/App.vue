<template>
  <div class="app-container">
    <!-- 配置向导（全屏遮罩） -->
    <SetupWizardView
      v-if="!setupCompleted"
      @complete="handleSetupComplete"
    />

    <!-- 主应用 -->
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
import { ref, onMounted, onUnmounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import SetupWizardView from './views/SetupWizardView.vue'
import { useWebSocketStore } from './stores/websocket'
import { checkSetupStatus } from './api/setup'

const wsStore = useWebSocketStore()
const setupCompleted = ref(false)

// 监听侧边栏状态变化，触发全局 resize 事件
let sidebarObserver: MutationObserver | null = null

onMounted(async () => {
  // 检查配置状态
  try {
    const result = await checkSetupStatus()
    if (result.success && result.status) {
      setupCompleted.value = result.status.completed
    } else {
      setupCompleted.value = false
    }
  } catch (error) {
    console.error('检查配置状态失败:', error)
    setupCompleted.value = false
  }

  // 只有在配置完成后才连接 WebSocket
  if (setupCompleted.value) {
    wsStore.connect()

    // 监听 body 的 class 变化（sidebar-collapsed）
    sidebarObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          // 延迟触发 resize 事件，确保 CSS 过渡完成
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'))
          }, 350) // 与 CSS transition 时间一致
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
  // 配置完成后连接 WebSocket
  wsStore.connect()
}

onUnmounted(() => {
  wsStore.disconnect()
  
  if (sidebarObserver) {
    sidebarObserver.disconnect()
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --primary-color: #667eea;
  --primary-dark: #5568d3;
  --secondary-color: #764ba2;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --danger-color: #ef4444;
  --info-color: #3b82f6;
  --bg-primary: #f8fafc;
  --bg-secondary: #ffffff;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --border-color: #e2e8f0;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app-container {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
  position: relative;
}

.main-content {
  flex: 1;
  margin-left: 280px;
  transition: margin-left 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 100vh;
  padding: 24px;
  background: transparent;
  width: calc(100vw - 280px);
  max-width: 100%;
  overflow-x: hidden;
}

body.sidebar-collapsed .main-content {
  margin-left: 80px;
  width: calc(100vw - 80px);
}

/* 移动端适配 */
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

/* 页面过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.98);
}

/* Element Plus 全局样式覆盖 */
.el-card {
  border-radius: var(--radius-lg) !important;
  border: 1px solid var(--border-color) !important;
  box-shadow: var(--shadow-md) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  background: var(--bg-secondary) !important;
}

.el-card:hover {
  box-shadow: var(--shadow-lg) !important;
  transform: translateY(-2px);
}

.el-card__header {
  border-bottom: 1px solid var(--border-color) !important;
  padding: 20px 24px !important;
  background: linear-gradient(to bottom, #fafbfc, #ffffff) !important;
}

.el-card__body {
  padding: 24px !important;
  background: linear-gradient(135deg, #e0e7ff 0%, #dbeafe 100%) !important;
}

.el-button {
  border-radius: var(--radius-sm) !important;
  font-weight: 500 !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.el-button--primary {
  background: var(--primary-gradient) !important;
  border: none !important;
}

.el-button--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4) !important;
}

.el-input__wrapper {
  border-radius: var(--radius-sm) !important;
  box-shadow: var(--shadow-sm) !important;
  transition: all 0.2s !important;
}

.el-input__wrapper:hover {
  box-shadow: var(--shadow-md) !important;
}

.el-input__wrapper.is-focus {
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
}

.el-table {
  border-radius: var(--radius-md) !important;
  overflow: hidden;
}

.el-table th {
  background: linear-gradient(to bottom, #f8fafc, #f1f5f9) !important;
  font-weight: 600 !important;
  color: var(--text-primary) !important;
}

.el-alert {
  border-radius: var(--radius-md) !important;
  border: none !important;
}

.el-tag {
  border-radius: var(--radius-sm) !important;
  font-weight: 500 !important;
}

/* 滚动条美化 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #5568d3, #6a3f8f);
}

/* 加载动画 */
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.loading-shimmer {
  animation: shimmer 2s infinite;
  background: linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%);
  background-size: 1000px 100%;
}
</style>
