<template>
  <div class="generator-panel">
    <div class="panel-intro">
      <div>
        <div class="intro-title">账号生成</div>
        <div class="intro-subtitle">在账号管理页内直接完成批量生成、导出和创建注册任务。</div>
      </div>
      <el-tag type="info">推荐每次生成 1-10 个账号</el-tag>
    </div>

    <el-alert v-if="!emailDomains" type="warning" :closable="false" class="panel-alert">
      未检测到邮箱域名，请先前往“邮箱配置”完成域名设置。
    </el-alert>

    <el-form :model="form" class="generator-form">
      <div class="generator-controls">
        <div class="control-card control-card-strong">
          <div class="control-label">生成数量</div>
          <el-input-number v-model="form.count" :min="1" :max="100" controls-position="right" />
          <div class="control-hint">建议 1-10 个，最高 100 个</div>
        </div>

        <div class="control-card control-card-wide">
          <div class="control-label">邮箱域名</div>
          <el-input :model-value="emailDomains || '未配置邮箱域名'" readonly />
          <div class="control-hint">生成邮箱会自动使用当前邮箱配置域名</div>
        </div>

        <div class="control-card">
          <div class="control-label">邮箱长度</div>
          <el-input-number v-model="form.emailLength" :min="6" :max="30" controls-position="right" />
          <div class="control-hint">本地部分字符数</div>
        </div>

        <div class="control-card">
          <div class="control-label">密码长度</div>
          <el-input-number v-model="form.passwordLength" :min="8" :max="32" controls-position="right" />
          <div class="control-hint">建议不少于 12 位</div>
        </div>
      </div>

      <div class="panel-actions">
        <el-button type="primary" :loading="generatorStore.loading" :disabled="!emailDomains" @click="handleGenerate">
          生成账号
        </el-button>
        <el-button :disabled="generatorStore.accounts.length === 0" @click="generatorStore.exportAccounts()">导出 CSV</el-button>
        <el-button :disabled="generatorStore.accounts.length === 0" @click="generatorStore.clear()">清空结果</el-button>
      </div>
    </el-form>

    <el-card v-if="generatorStore.accounts.length > 0" shadow="never" class="result-panel">
      <template #header>
        <div class="result-header">
          <div>
            <span class="result-title">生成结果</span>
            <span class="result-count">共 {{ generatorStore.accounts.length }} 个账号</span>
          </div>
          <el-button type="primary" :icon="Promotion" @click="handleCreateTasks">批量创建任务</el-button>
        </div>
      </template>

      <el-table :data="generatorStore.accounts" stripe>
        <el-table-column type="index" label="序号" width="70" />
        <el-table-column prop="email" label="邮箱" min-width="220" />
        <el-table-column prop="password" label="密码" min-width="180" />
        <el-table-column prop="name" label="姓名" min-width="140" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Promotion } from '@element-plus/icons-vue'
import { useGeneratorStore } from '../stores/generator'
import { getEmailConfig } from '../api/generator'
import { createTask } from '../api/tasks'

const router = useRouter()
const generatorStore = useGeneratorStore()

const form = ref({
  count: 5,
  emailLength: 12,
  passwordLength: 12
})

const emailDomains = ref('')
const configLoaded = ref(false)

onMounted(async () => {
  try {
    const emailData = await getEmailConfig()
    if (emailData.success && emailData.config?.domains) {
      emailDomains.value = emailData.config.domains
    }

    const response = await fetch('/api/generator/config')
    const configData = await response.json()
    if (configData.success && configData.config) {
      form.value.count = configData.config.defaultCount || 5
      form.value.emailLength = configData.config.defaultEmailLength || 12
      form.value.passwordLength = configData.config.defaultPasswordLength || 12
    }
  } catch (error) {
    console.error('获取生成配置失败:', error)
  } finally {
    configLoaded.value = true
  }
})

watch(
  () => [form.value.count, form.value.emailLength, form.value.passwordLength],
  async () => {
    if (!configLoaded.value) return
    try {
      await fetch('/api/generator/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultCount: form.value.count,
          defaultEmailLength: form.value.emailLength,
          defaultPasswordLength: form.value.passwordLength
        })
      })
    } catch (error) {
      console.error('保存生成配置失败:', error)
    }
  }
)

const handleGenerate = async () => {
  try {
    const result = await generatorStore.generate(form.value.count, form.value.emailLength, form.value.passwordLength)
    ElMessage.success(`成功生成 ${result.count} 个账号`)
  } catch (error: any) {
    ElMessage.error(error.message || '生成失败')
  }
}

const handleCreateTasks = async () => {
  if (generatorStore.accounts.length === 0) {
    ElMessage.warning('没有可用的生成结果')
    return
  }

  try {
    const emailConfigData = await getEmailConfig()
    if (!emailConfigData.success || !emailConfigData.config) {
      ElMessage.error('请先在邮箱配置中完善接收邮箱信息')
      return
    }

    const config = emailConfigData.config
    let receiveEmail = ''
    let authCode = ''

    if (config.useAlias && config.aliasType === 'gmail' && config.gmailBase && config.gmailAppPassword) {
      receiveEmail = config.gmailBase
      authCode = config.gmailAppPassword
    } else if (config.qqEmail && config.authCode) {
      receiveEmail = config.qqEmail
      authCode = config.authCode
    } else {
      ElMessage.error('邮箱配置不完整')
      return
    }

    await ElMessageBox.confirm(
      `确定要为 ${generatorStore.accounts.length} 个账号批量创建注册任务吗？\n\n接收邮箱：${receiveEmail}`,
      '批量创建任务',
      {
        confirmButtonText: '确认创建',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    let successCount = 0
    let failCount = 0

    for (const account of generatorStore.accounts) {
      try {
        await createTask({
          email: account.email,
          password: account.password,
          receive_email: receiveEmail,
          auth_code: authCode
        })
        successCount++
      } catch (error) {
        failCount++
        console.error(`创建任务失败 [${account.email}]`, error)
      }
    }

    ElMessage.success(`批量任务创建完成：成功 ${successCount} 个，失败 ${failCount} 个`)

    if (successCount > 0) {
      generatorStore.clear()
      router.push('/tasks')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '创建任务失败')
    }
  }
}
</script>

<style scoped>
.generator-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel-intro,
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.intro-title,
.result-title {
  font-size: 16px;
  font-weight: 700;
}

.intro-subtitle,
.result-count {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 13px;
}

.panel-alert {
  margin: 0;
}

.generator-controls {
  display: grid;
  grid-template-columns: 1fr 1.35fr 1fr 1fr;
  gap: 12px;
}

.control-card {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: #ffffff;
}

.control-card-strong {
  background: #f8fafc;
}

.control-label {
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
}

.control-hint {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.generator-form :deep(.el-input-number),
.generator-form :deep(.el-input) {
  width: 100%;
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 2px;
}

.result-panel {
  border-radius: var(--radius-lg) !important;
}

@media (max-width: 767px) {
  .panel-intro,
  .result-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .generator-controls {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1180px) and (min-width: 768px) {
  .generator-controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
