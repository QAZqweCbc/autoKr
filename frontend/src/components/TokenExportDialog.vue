<template>
  <el-dialog
    v-model="visible"
    title="导出 Token"
    width="600px"
    :before-close="handleClose"
  >
    <el-form label-width="100px">
      <!-- 导出范围 -->
      <el-form-item label="导出范围">
        <el-tag type="info">已选择 {{ selectedCount }} 个账号</el-tag>
      </el-form-item>

      <!-- 导出格式 -->
      <el-form-item label="导出格式">
        <el-radio-group v-model="exportFormat" class="export-format-options">
          <el-radio value="aiclient2api">
            <div class="format-option">
              <span class="format-title">AIClient2API 格式</span>
              <span class="format-desc">
                标准 OAuth 凭据格式，兼容 AIClient2API
              </span>
            </div>
          </el-radio>
          <el-radio value="json">
            <div class="format-option">
              <span class="format-title">JSON 自定义格式</span>
              <span class="format-desc">
                选择需要导出的字段
              </span>
            </div>
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- 自定义字段选择 -->
      <el-form-item v-if="exportFormat === 'json'" label="导出字段">
        <div class="field-selection-card">
          <div class="field-toolbar">
            <span>已选择 {{ selectedFields.length }} / {{ allFieldKeys.length }} 个字段</span>
            <div class="field-actions">
              <el-button size="small" text @click="selectedFields = []">清空</el-button>
              <el-button size="small" @click="selectAllFields">全选</el-button>
            </div>
          </div>
          <el-checkbox-group v-model="selectedFields">
            <div class="field-groups">
              <section v-for="group in fieldGroups" :key="group.title" class="field-group">
                <div class="field-group-title">{{ group.title }}</div>
                <div class="field-grid">
                  <el-checkbox
                    v-for="field in group.fields"
                    :key="field.key"
                    :label="field.key"
                    class="field-option"
                  >
                    <span class="field-name">{{ field.label }}</span>
                    <span class="field-key">{{ field.key }}</span>
                  </el-checkbox>
                </div>
              </section>
            </div>
          </el-checkbox-group>
        </div>
      </el-form-item>

      <!-- 过滤选项 -->
      <el-form-item label="过滤选项">
        <el-checkbox v-model="onlyWithToken">仅导出有 Token 的账号</el-checkbox>
        <el-checkbox v-model="includeExpired">包含已过期的 Token</el-checkbox>
      </el-form-item>

      <!-- AIClient2API 格式说明 -->
      <el-alert
        v-if="exportFormat === 'aiclient2api'"
        type="info"
        :closable="false"
        style="margin-top: 16px;"
      >
        <template #title>
          <div style="font-size: 13px;">
            <strong>AIClient2API 格式说明</strong>
            <ul style="margin: 8px 0 0 20px; padding: 0;">
              <li>包含完整的 OAuth 凭据信息</li>
              <li>可直接导入到支持 AIClient2API 的工具</li>
              <li>包含字段: email, access_token, refresh_token, client_id, client_secret, region 等</li>
            </ul>
          </div>
        </template>
      </el-alert>
    </el-form>

    <template #footer>
      <div style="display: flex; justify-content: space-between;">
        <el-button @click="handleClose">取消</el-button>
        <div style="display: flex; gap: 12px;">
          <el-button
            type="primary"
            :icon="CopyDocument"
            :loading="copying"
            @click="handleCopy"
          >
            复制到剪贴板
          </el-button>
          <el-button
            type="success"
            :icon="Download"
            :loading="downloading"
            @click="handleDownload"
          >
            下载文件
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Download } from '@element-plus/icons-vue'
import axios from 'axios'

interface Props {
  modelValue: boolean
  selectedAccountIds: string[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const selectedCount = computed(() => props.selectedAccountIds.length)

// 导出格式
const exportFormat = ref<'aiclient2api' | 'json'>('aiclient2api')
const selectedFields = ref<string[]>([
  'email',
  'access_token',
  'refresh_token',
  'client_id',
  'client_secret',
  'region'
])
const onlyWithToken = ref(true)
const includeExpired = ref(false)

// 操作状态
const copying = ref(false)
const downloading = ref(false)

const fieldGroups = [
  {
    title: '基础字段',
    fields: [
      { key: 'email', label: '邮箱' },
      { key: 'password', label: '密码' },
      { key: 'status', label: '状态' },
      { key: 'nickname', label: '昵称' },
      { key: 'user_id', label: '用户 ID' },
      { key: 'region', label: '区域' }
    ]
  },
  {
    title: 'Token 凭证',
    fields: [
      { key: 'access_token', label: 'Access Token' },
      { key: 'refresh_token', label: 'Refresh Token' },
      { key: 'csrf_token', label: 'CSRF Token' },
      { key: 'sso_token', label: 'SSO Token' },
      { key: 'client_id', label: 'Client ID' },
      { key: 'client_secret', label: 'Client Secret' },
      { key: 'expires_at', label: '过期时间' }
    ]
  },
  {
    title: '订阅与额度',
    fields: [
      { key: 'subscription_type', label: '订阅类型' },
      { key: 'usage_current', label: '当前用量' },
      { key: 'usage_limit', label: '用量限制' }
    ]
  }
] as const

const allFieldKeys = fieldGroups.flatMap(group => group.fields.map(field => field.key))

// 全选字段
const selectAllFields = () => {
  selectedFields.value = [...allFieldKeys]
}

// 获取导出数据
const getExportData = async (): Promise<string> => {
  const requestData: any = {
    accountIds: props.selectedAccountIds,
    format: exportFormat.value,
    onlyWithToken: onlyWithToken.value,
    includeExpired: includeExpired.value
  }

  // JSON 格式需要传递字段配置
  if (exportFormat.value === 'json') {
    const fields: Record<string, boolean> = {}
    selectedFields.value.forEach(field => {
      fields[field] = true
    })
    requestData.fields = fields
  }

  const response = await axios.post('/api/accounts/export-tokens', requestData, {
    responseType: 'text'
  })

  return response.data
}

// 复制到剪贴板
const handleCopy = async () => {
  if (selectedCount.value === 0) {
    ElMessage.warning('请先选择要导出的账号')
    return
  }

  if (exportFormat.value === 'json' && selectedFields.value.length === 0) {
    ElMessage.warning('请至少选择一个导出字段')
    return
  }

  try {
    copying.value = true
    const data = await getExportData()

    await navigator.clipboard.writeText(data)
    ElMessage.success('已复制到剪贴板')
    handleClose()
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || '复制失败'
    ElMessage.error(errorMsg)
  } finally {
    copying.value = false
  }
}

// 下载文件
const handleDownload = async () => {
  if (selectedCount.value === 0) {
    ElMessage.warning('请先选择要导出的账号')
    return
  }

  if (exportFormat.value === 'json' && selectedFields.value.length === 0) {
    ElMessage.warning('请至少选择一个导出字段')
    return
  }

  try {
    downloading.value = true
    const data = await getExportData()

    // 创建 Blob 并下载
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const prefix = exportFormat.value === 'aiclient2api' ? 'aiclient2api-tokens' : 'tokens'
    link.download = `${prefix}_${selectedCount.value}_${timestamp}.json`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    ElMessage.success('文件下载成功')
    handleClose()
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || '下载失败'
    ElMessage.error(errorMsg)
  } finally {
    downloading.value = false
  }
}

const handleClose = () => {
  visible.value = false
}

// 监听格式变化，自动选择默认字段
watch(exportFormat, (newFormat) => {
  if (newFormat === 'json' && selectedFields.value.length === 0) {
    selectedFields.value = [
      'email',
      'access_token',
      'refresh_token',
      'client_id',
      'client_secret',
      'region'
    ]
  }
})
</script>

<style scoped>
.export-format-options {
  display: grid;
  gap: 10px;
  width: 100%;
}

.export-format-options :deep(.el-radio) {
  height: auto;
  margin-right: 0;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: #ffffff;
}

.format-option {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.format-title {
  font-weight: 700;
}

.format-desc,
.field-key,
.field-toolbar {
  color: var(--text-secondary);
  font-size: 12px;
}

.field-selection-card {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: #f8fafc;
}

.field-toolbar,
.field-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-toolbar {
  justify-content: space-between;
  margin-bottom: 10px;
}

.field-groups {
  display: grid;
  gap: 10px;
}

.field-group {
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: var(--radius-md);
  background: #ffffff;
}

.field-group-title {
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.field-option {
  min-height: 36px;
  margin-right: 0;
  padding: 8px;
  border-radius: 8px;
  background: #f9fafb;
}

.field-option :deep(.el-checkbox__label) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.3;
}

.field-name {
  color: var(--text-primary);
  font-weight: 600;
}

@media (max-width: 640px) {
  .field-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
