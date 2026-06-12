<template>
  <el-dialog
    v-model="visible"
    title="浏览器启动参数助手"
    width="800px"
    :close-on-click-modal="false"
  >
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 20px;"
    >
      选择常用的浏览器启动参数，点击应用后会自动添加到配置中
    </el-alert>

    <div class="args-categories">
      <!-- 性能优化 -->
      <div class="category">
        <h3 class="category-title">⚡ 性能优化</h3>
        <div class="args-list">
          <div
            v-for="arg in performanceArgs"
            :key="arg.value"
            class="arg-item"
            :class="{ selected: isSelected(arg.value) }"
            @click="toggleArg(arg.value)"
          >
            <div class="arg-header">
              <el-checkbox :model-value="isSelected(arg.value)" @click.stop />
              <span class="arg-name">{{ arg.name }}</span>
            </div>
            <div class="arg-description">{{ arg.description }}</div>
            <div class="arg-value">{{ arg.value }}</div>
          </div>
        </div>
      </div>

      <!-- 稳定性 -->
      <div class="category">
        <h3 class="category-title">🛡️ 稳定性增强</h3>
        <div class="args-list">
          <div
            v-for="arg in stabilityArgs"
            :key="arg.value"
            class="arg-item"
            :class="{ selected: isSelected(arg.value) }"
            @click="toggleArg(arg.value)"
          >
            <div class="arg-header">
              <el-checkbox :model-value="isSelected(arg.value)" @click.stop />
              <span class="arg-name">{{ arg.name }}</span>
            </div>
            <div class="arg-description">{{ arg.description }}</div>
            <div class="arg-value">{{ arg.value }}</div>
          </div>
        </div>
      </div>

      <!-- 隐私和安全 -->
      <div class="category">
        <h3 class="category-title">🔒 隐私和安全</h3>
        <div class="args-list">
          <div
            v-for="arg in privacyArgs"
            :key="arg.value"
            class="arg-item"
            :class="{ selected: isSelected(arg.value) }"
            @click="toggleArg(arg.value)"
          >
            <div class="arg-header">
              <el-checkbox :model-value="isSelected(arg.value)" @click.stop />
              <span class="arg-name">{{ arg.name }}</span>
            </div>
            <div class="arg-description">{{ arg.description }}</div>
            <div class="arg-value">{{ arg.value }}</div>
          </div>
        </div>
      </div>

      <!-- 无头模式优化 -->
      <div class="category">
        <h3 class="category-title">🖥️ 无头模式优化</h3>
        <div class="args-list">
          <div
            v-for="arg in headlessArgs"
            :key="arg.value"
            class="arg-item"
            :class="{ selected: isSelected(arg.value) }"
            @click="toggleArg(arg.value)"
          >
            <div class="arg-header">
              <el-checkbox :model-value="isSelected(arg.value)" @click.stop />
              <span class="arg-name">{{ arg.name }}</span>
            </div>
            <div class="arg-description">{{ arg.description }}</div>
            <div class="arg-value">{{ arg.value }}</div>
          </div>
        </div>
      </div>

      <!-- 调试和开发 -->
      <div class="category">
        <h3 class="category-title">🔧 调试和开发</h3>
        <div class="args-list">
          <div
            v-for="arg in debugArgs"
            :key="arg.value"
            class="arg-item"
            :class="{ selected: isSelected(arg.value) }"
            @click="toggleArg(arg.value)"
          >
            <div class="arg-header">
              <el-checkbox :model-value="isSelected(arg.value)" @click.stop />
              <span class="arg-name">{{ arg.name }}</span>
            </div>
            <div class="arg-description">{{ arg.description }}</div>
            <div class="arg-value">{{ arg.value }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 已选参数预览 -->
    <el-divider />
    <div class="selected-preview">
      <h4>已选参数预览（{{ selectedArgs.length }} 个）：</h4>
      <el-tag
        v-for="arg in selectedArgs"
        :key="arg"
        closable
        style="margin: 4px;"
        @close="toggleArg(arg)"
      >
        {{ arg }}
      </el-tag>
      <div v-if="selectedArgs.length === 0" style="color: #909399; font-size: 14px;">
        暂未选择任何参数
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button @click="selectRecommended">使用推荐配置</el-button>
      <el-button type="primary" @click="applyArgs">应用选择</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const visible = defineModel<boolean>('visible', { default: false })

const emit = defineEmits<{
  apply: [args: string[]]
}>()

const selectedArgs = ref<string[]>([])

// 性能优化参数
const performanceArgs = [
  {
    name: '禁用共享内存',
    value: '--disable-dev-shm-usage',
    description: '解决 Docker/Linux 环境下 /dev/shm 空间不足的问题，推荐在服务器上使用'
  },
  {
    name: '禁用GPU加速',
    value: '--disable-gpu',
    description: '在无头模式或服务器环境下禁用GPU，减少资源占用'
  },
  {
    name: '禁用软件光栅化',
    value: '--disable-software-rasterizer',
    description: '禁用软件渲染，提升性能（需要硬件支持）'
  },
  {
    name: '单进程模式',
    value: '--single-process',
    description: '使用单进程运行，减少内存占用（可能影响稳定性）'
  },
  {
    name: '禁用扩展',
    value: '--disable-extensions',
    description: '禁用所有浏览器扩展，加快启动速度'
  }
]

// 稳定性参数
const stabilityArgs = [
  {
    name: '禁用沙箱',
    value: '--no-sandbox',
    description: '⚠️ 在 Docker 或 root 用户下运行时必需，但会降低安全性'
  },
  {
    name: '禁用setuid沙箱',
    value: '--disable-setuid-sandbox',
    description: '配合 --no-sandbox 使用，解决权限问题'
  },
  {
    name: '禁用崩溃报告',
    value: '--disable-crash-reporter',
    description: '禁用崩溃报告收集，减少后台进程'
  },
  {
    name: '忽略证书错误',
    value: '--ignore-certificate-errors',
    description: '忽略SSL证书错误（仅用于测试环境）'
  }
]

// 隐私和安全参数
const privacyArgs = [
  {
    name: '禁用Blink功能',
    value: '--disable-blink-features=AutomationControlled',
    description: '隐藏自动化控制特征，使浏览器更像真人操作'
  },
  {
    name: '禁用通知',
    value: '--disable-notifications',
    description: '禁用浏览器通知弹窗'
  },
  {
    name: '禁用弹窗阻止',
    value: '--disable-popup-blocking',
    description: '允许所有弹窗（某些网站需要）'
  },
  {
    name: '禁用默认应用',
    value: '--disable-default-apps',
    description: '不加载默认应用，加快启动'
  },
  {
    name: '禁用同步',
    value: '--disable-sync',
    description: '禁用Chrome同步功能'
  }
]

// 无头模式优化参数
const headlessArgs = [
  {
    name: '无头模式',
    value: '--headless=new',
    description: '使用新版无头模式（Chrome 109+）'
  },
  {
    name: '禁用音频',
    value: '--mute-audio',
    description: '静音所有音频输出'
  },
  {
    name: '窗口大小',
    value: '--window-size=1920,1080',
    description: '设置浏览器窗口大小为 1920x1080'
  },
  {
    name: '禁用图片加载',
    value: '--blink-settings=imagesEnabled=false',
    description: '不加载图片，大幅提升速度（可能影响某些网站）'
  }
]

// 调试参数
const debugArgs = [
  {
    name: '启用日志',
    value: '--enable-logging',
    description: '启用详细日志输出，便于调试'
  },
  {
    name: '日志级别',
    value: '--log-level=0',
    description: '设置日志级别（0=详细，3=错误）'
  },
  {
    name: '禁用Web安全',
    value: '--disable-web-security',
    description: '⚠️ 禁用同源策略（仅用于开发测试）'
  }
]

const isSelected = (arg: string) => {
  return selectedArgs.value.includes(arg)
}

const toggleArg = (arg: string) => {
  const index = selectedArgs.value.indexOf(arg)
  if (index > -1) {
    selectedArgs.value.splice(index, 1)
  } else {
    selectedArgs.value.push(arg)
  }
}

const selectRecommended = () => {
  // 推荐配置：适合大多数服务器环境
  selectedArgs.value = [
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-notifications',
    '--mute-audio',
    '--window-size=1920,1080'
  ]
  ElMessage.success('已应用推荐配置')
}

const applyArgs = () => {
  if (selectedArgs.value.length === 0) {
    ElMessage.warning('请至少选择一个参数')
    return
  }
  emit('apply', [...selectedArgs.value])
  visible.value = false
  ElMessage.success(`已应用 ${selectedArgs.value.length} 个参数`)
}

// 暴露方法供父组件调用
defineExpose({
  setCurrentArgs: (args: string[]) => {
    selectedArgs.value = [...args]
  }
})
</script>

<style scoped>
.args-categories {
  max-height: 600px;
  overflow-y: auto;
  padding: 10px;
}

.category {
  margin-bottom: 30px;
}

.category-title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 2px solid #e5e7eb;
}

.args-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 12px;
}

.arg-item {
  padding: 14px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
}

.arg-item:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
  transform: translateY(-2px);
}

.arg-item.selected {
  border-color: #667eea;
  background: #f0f4ff;
}

.arg-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.arg-name {
  font-weight: 600;
  font-size: 15px;
  color: #1e293b;
}

.arg-description {
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 8px;
}

.arg-value {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: #667eea;
  background: #f8fafc;
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
}

.selected-preview {
  padding: 15px;
  background: #f8fafc;
  border-radius: 8px;
  margin-top: 10px;
}

.selected-preview h4 {
  margin: 0 0 10px 0;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}
</style>
