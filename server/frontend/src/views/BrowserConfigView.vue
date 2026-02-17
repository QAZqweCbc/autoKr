<template>
  <div class="browser-config-view">
    <el-card>
      <template #header>
        <span style="font-weight: 600;">浏览器配置</span>
      </template>

      <el-alert
        type="info"
        :closable="false"
        style="margin-bottom: 24px;"
      >
        配置浏览器启动参数和人类行为模拟
      </el-alert>

      <!-- Linux 环境警告 -->
      <el-alert
        v-if="isLinux"
        type="warning"
        :closable="false"
        style="margin-bottom: 24px;"
      >
        <template #title>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">🐧</span>
            <div>
              <div style="font-weight: 600; margin-bottom: 4px;">Linux 环境已检测</div>
              <div style="font-size: 14px;">无头模式（Headless）是必需的。某些选项已被禁用。</div>
            </div>
          </div>
        </template>
      </el-alert>

      <el-form :model="form" label-width="160px">
        <!-- 浏览器设置 -->
        <h3 style="margin: 20px 0 15px 0; color: #667eea;">浏览器设置</h3>

        <el-form-item label="浏览器类型">
          <el-select v-model="form.browserType" style="width: 300px;">
            <el-option label="Chrome/Chromium (推荐)" value="chrome" />
            <el-option label="Firefox" value="firefox" />
          </el-select>
          <div style="color: #6b7280; font-size: 13px; margin-top: 8px;">
            💡 Chrome/Chromium 兼容性最好，推荐使用
          </div>
        </el-form-item>

        <el-form-item label="使用内置浏览器">
          <el-switch
            v-model="useBuiltinBrowser"
            @change="handleBuiltinBrowserToggle"
          />
          <span style="color: #6b7280; font-size: 13px; margin-left: 12px;">
            {{ useBuiltinBrowser ? '使用 Playwright 内置浏览器（推荐）' : '使用系统本地浏览器' }}
          </span>
        </el-form-item>

        <el-form-item v-if="!useBuiltinBrowser" label="自定义浏览器路径">
          <div style="display: flex; gap: 10px; width: 100%;">
            <el-input
              v-model="form.browserPath"
              placeholder="留空自动检测，或手动输入浏览器路径"
              style="flex: 1; max-width: 600px;"
            />
            <el-button
              :icon="Search"
              @click="handleDetectBrowser"
            >
              自动检测
            </el-button>
          </div>
          <div style="color: #6b7280; font-size: 13px; margin-top: 8px;">
            💡 留空时系统会自动查找已安装的浏览器，也可以点击"自动检测"或手动输入路径
          </div>
        </el-form-item>

        <el-form-item label="无头模式">
          <el-switch
            v-model="form.headless"
            :disabled="isLinux"
          />
          <span style="color: #6b7280; font-size: 13px; margin-left: 12px;">
            {{ headlessTooltip }}
          </span>
        </el-form-item>

        <el-form-item label="显示浏览器窗口">
          <el-switch
            v-model="form.showWindow"
            :disabled="isLinux"
          />
          <span style="color: #6b7280; font-size: 13px; margin-left: 12px;">
            {{ showWindowTooltip }}
          </span>
        </el-form-item>

        <el-form-item label="启动参数（高级）">
          <div style="display: flex; gap: 10px; align-items: flex-start; width: 100%;">
            <el-input
              v-model="argsText"
              type="textarea"
              :rows="6"
              placeholder="每行一个参数，例如：&#10;--disable-dev-shm-usage&#10;--disable-gpu&#10;--disable-software-rasterizer"
              style="flex: 1; max-width: 600px;"
            />
            <el-button
              type="primary"
              @click="openArgsHelper"
            >
              📋 参数助手
            </el-button>
          </div>
          <div style="color: #6b7280; font-size: 13px; margin-top: 8px;">
            ⚙️ 每行一个参数。默认参数会自动添加。点击"参数助手"快速选择常用参数。<br>
            ⚠️ 避免使用 --remote-debugging-port 和 --user-data-dir 等危险参数
          </div>
        </el-form-item>

        <!-- 人类行为模拟 -->
        <el-divider />
        <h3 style="margin: 20px 0 15px 0; color: #667eea;">人类行为模拟</h3>

        <el-form-item label="最小延迟（秒）">
          <el-input-number
            v-model="form.delayMin"
            :min="1"
            :max="30"
            style="width: 200px;"
          />
          <span style="color: #6b7280; font-size: 13px; margin-left: 12px;">
            操作之间的最小等待时间
          </span>
        </el-form-item>

        <el-form-item label="最大延迟（秒）">
          <el-input-number
            v-model="form.delayMax"
            :min="1"
            :max="60"
            style="width: 200px;"
          />
          <span style="color: #6b7280; font-size: 13px; margin-left: 12px;">
            操作之间的最大等待时间（必须大于最小延迟）
          </span>
        </el-form-item>

        <!-- 操作按钮 -->
        <el-divider />
        <el-form-item>
          <el-button
            type="primary"
            :loading="testing"
            @click="handleTest"
          >
            🔍 测试配置
          </el-button>
          <el-button
            type="success"
            :loading="saving"
            @click="handleSave"
          >
            💾 保存配置
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 使用说明 -->
      <el-alert
        type="info"
        :closable="false"
        style="margin-top: 30px;"
      >
        <template #title>
          <div style="font-size: 14px;">
            <strong>📖 使用说明</strong>
            <ul style="margin: 8px 0 0 20px; padding: 0;">
              <li><strong>浏览器类型:</strong> 推荐使用 Chrome/Chromium，兼容性最好</li>
              <li><strong>无头模式:</strong> 在 Linux 服务器上必须启用，Windows 可选</li>
              <li><strong>自定义路径:</strong> 留空使用 Playwright 内置浏览器（推荐），或指定系统浏览器完整路径</li>
              <li><strong>启动参数:</strong> 高级用户可以添加自定义参数优化性能，避免使用危险参数</li>
              <li><strong>人类行为模拟:</strong> 随机延迟使自动化更像真人操作，建议 3-8 秒范围</li>
              <li><strong>测试配置:</strong> 保存前建议先测试，确保浏览器能正常启动</li>
            </ul>
          </div>
        </template>
      </el-alert>
    </el-card>

    <!-- 浏览器检测对话框 -->
    <el-dialog
      v-model="detectDialogVisible"
      title="检测到的浏览器"
      width="600px"
    >
      <div v-if="detectedBrowsers.length > 0">
        <div
          v-for="(browser, index) in detectedBrowsers"
          :key="index"
          class="browser-card"
          @click="selectBrowser(browser)"
        >
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="font-size: 32px;">{{ browser.type === 'chrome' ? '🌐' : '🦊' }}</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; margin-bottom: 4px;">
                {{ browser.name }}
                <span v-if="browser.version" style="color: #10b981; font-weight: 500;">
                  v{{ browser.version }}
                </span>
              </div>
              <div style="font-size: 12px; color: #6b7280; font-family: monospace;">
                {{ browser.path }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else description="未检测到系统浏览器" />
    </el-dialog>

    <!-- 浏览器启动参数助手对话框 -->
    <BrowserArgsHelper
      ref="argsHelperRef"
      v-model:visible="showArgsHelper"
      @apply="handleArgsApply"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useBrowserConfigStore } from '../stores/browserConfig'
import BrowserArgsHelper from '../components/BrowserArgsHelper.vue'
import type { BrowserDetectResult, BrowserConfig } from '../types'
import '../styles/browser-config-view.css'

// ==================== Store & Refs ====================
const browserConfigStore = useBrowserConfigStore()
const argsHelperRef = ref<InstanceType<typeof BrowserArgsHelper> | null>(null)

// ==================== State ====================
const form = ref<BrowserConfig>({
  browserType: 'chrome',
  browserPath: '',
  headless: true,
  showWindow: false,
  args: [],
  delayMin: 3,
  delayMax: 8
})

const argsText = ref('')
const isLinux = ref(false)
const testing = ref(false)
const saving = ref(false)
const detectDialogVisible = ref(false)
const showArgsHelper = ref(false)
const detectedBrowsers = ref<BrowserDetectResult[]>([])

// ==================== Computed ====================
// 使用独立的状态来控制开关，而不是依赖 browserPath
const useBuiltinBrowser = ref(true)

const headlessTooltip = computed(() => 
  isLinux.value ? 'Linux 环境必须启用无头模式' : '后台运行，不显示浏览器窗口'
)

const showWindowTooltip = computed(() => 
  isLinux.value ? 'Linux 环境不支持此选项' : '调试时可以看到浏览器操作过程'
)

// ==================== Utility Functions ====================
const parseArgsFromText = (): string[] => {
  return argsText.value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line)
}

const validateForm = (): boolean => {
  if (form.value.delayMin <= 0) {
    ElMessage.error('最小延迟必须大于 0')
    return false
  }
  
  if (form.value.delayMax <= form.value.delayMin) {
    ElMessage.error('最大延迟必须大于最小延迟')
    return false
  }
  
  // 移除路径必填的验证，允许留空自动检测
  
  return true
}

const showTestResult = (result: any) => {
  if (result.success) {
    let message = '✅ 浏览器启动成功！\n\n'
    if (result.result?.browserVersion) {
      message += `浏览器版本: ${result.result.browserVersion}\n`
    }
    if (result.result?.launchTime) {
      message += `启动时间: ${result.result.launchTime} ms`
    }
    
    ElMessageBox.alert(message, '测试成功', {
      confirmButtonText: '确定',
      type: 'success'
    })
  } else {
    let errorMsg = `❌ 浏览器启动失败\n\n错误信息: ${result.error}`
    if (result.suggestions?.length > 0) {
      errorMsg += '\n\n💡 解决建议：\n'
      result.suggestions.forEach((s: string) => errorMsg += `• ${s}\n`)
    }
    
    ElMessageBox.alert(errorMsg, '测试失败', {
      confirmButtonText: '确定',
      type: 'error'
    })
  }
}

const handleError = (error: any, defaultMsg: string) => {
  ElMessage.error(error.message || defaultMsg)
}

// ==================== Lifecycle ====================
onMounted(async () => {
  try {
    const result = await browserConfigStore.loadConfig()
    
    if (result?.config) {
      form.value = { ...form.value, ...result.config }
      argsText.value = result.config.args.join('\n')
      
      // 根据 browserPath 设置开关状态
      useBuiltinBrowser.value = !result.config.browserPath || result.config.browserPath.trim() === ''
    }
    
    if (result?.envInfo) {
      isLinux.value = result.envInfo.isLinux
      
      // Linux 环境强制启用无头模式
      if (isLinux.value) {
        form.value.headless = true
        form.value.showWindow = false
      }
    }
  } catch (error: any) {
    handleError(error, '加载配置失败')
  }
})

// ==================== Event Handlers ====================
const handleDetectBrowser = async () => {
  try {
    const result = await browserConfigStore.detect()
    
    if (result.success && result.browsers.length > 0) {
      detectedBrowsers.value = result.browsers
      detectDialogVisible.value = true
    } else {
      ElMessage.warning('未检测到系统浏览器')
    }
  } catch (error: any) {
    handleError(error, '检测失败')
  }
}

const handleBuiltinBrowserToggle = (value: boolean) => {
  if (value) {
    // 使用内置浏览器，清空路径
    form.value.browserPath = ''
    ElMessage.success('已切换到 Playwright 内置浏览器')
  } else {
    ElMessage.info('已切换到系统浏览器，留空将自动检测')
  }
}

const selectBrowser = (browser: BrowserDetectResult) => {
  form.value.browserType = browser.type
  form.value.browserPath = browser.path
  useBuiltinBrowser.value = false  // 选择了浏览器，关闭内置浏览器开关
  detectDialogVisible.value = false
  ElMessage.success(`已选择: ${browser.name}`)
}

const handleTest = async () => {
  if (!validateForm()) return

  testing.value = true
  
  try {
    const args = parseArgsFromText()
    
    // 临时保存配置用于测试
    await browserConfigStore.saveConfig({
      ...form.value,
      args
    })
    
    // 执行测试
    const result = await browserConfigStore.testConfig()
    showTestResult(result)
  } catch (error: any) {
    handleError(error, '测试失败')
  } finally {
    testing.value = false
  }
}

const handleSave = async () => {
  if (!validateForm()) return

  saving.value = true
  
  try {
    const args = parseArgsFromText()
    
    await browserConfigStore.saveConfig({
      ...form.value,
      args
    })
    
    ElMessage.success('✅ 浏览器配置保存成功！')
  } catch (error: any) {
    handleError(error, '保存失败')
  } finally {
    saving.value = false
  }
}

const openArgsHelper = () => {
  const currentArgs = parseArgsFromText()
  
  if (argsHelperRef.value) {
    argsHelperRef.value.setCurrentArgs(currentArgs)
  }
  
  showArgsHelper.value = true
}

const handleArgsApply = (args: string[]) => {
  const existingArgs = parseArgsFromText()
  const allArgs = [...new Set([...existingArgs, ...args])]
  
  argsText.value = allArgs.join('\n')
  ElMessage.success(`已添加 ${args.length} 个参数`)
}
</script>


