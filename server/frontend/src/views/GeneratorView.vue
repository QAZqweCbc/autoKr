<template>
  <div class="generator-view page-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">
        <span class="title-icon">🎲</span>
        <span class="text-gradient">账号生成器</span>
      </h1>
      <p class="page-subtitle">快速批量生成测试账号，一键创建注册任务</p>
    </div>

    <el-card class="gradient-card">
      <template #header>
        <div class="card-header">
          <span class="header-title">生成配置</span>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        class="alert-gradient"
        style="margin-bottom: 24px;"
      >
        <template #title>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">💡</span>
            <span>快速生成测试账号数据，可直接创建注册任务</span>
          </div>
        </template>
      </el-alert>

      <!-- 生成表单 -->
      <el-form :model="form" label-width="120px">
        <el-form-item label="生成数量">
          <el-input-number
            v-model="form.count"
            :min="1"
            :max="100"
            style="width: 400px;"
          />
          <span style="color: #6b7280; font-size: 13px; margin-left: 12px;">
            建议每次生成 1-10 个账号
          </span>
        </el-form-item>

        <el-form-item label="邮箱域名">
          <el-input
            v-if="emailDomains"
            :model-value="emailDomains"
            disabled
            style="width: 400px;"
          />
          <el-input
            v-else
            model-value="未配置域名，请先在邮箱配置中设置"
            disabled
            style="width: 400px;"
            class="error-input"
          />
          <span style="color: #6b7280; font-size: 13px; margin-left: 12px;">
            将从配置的域名中随机选择
          </span>
        </el-form-item>

        <el-form-item label="邮箱长度">
          <el-input-number
            v-model="form.emailLength"
            :min="6"
            :max="30"
            style="width: 400px;"
          />
          <span style="color: #6b7280; font-size: 13px; margin-left: 12px;">
            邮箱前缀的字符长度（不含@域名）
          </span>
        </el-form-item>

        <el-form-item label="密码长度">
          <el-input-number
            v-model="form.passwordLength"
            :min="8"
            :max="32"
            style="width: 400px;"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            class="btn-gradient"
            size="large"
            :loading="generatorStore.loading"
            :disabled="!emailDomains"
            @click="handleGenerate"
          >
            🎲 生成账号
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 生成结果 -->
    <el-card v-if="generatorStore.accounts.length > 0" class="gradient-card result-card" style="margin-top: 24px;">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="header-title">生成的账号</span>
            <el-tag type="success" size="large" class="tag-success">
              {{ generatorStore.accounts.length }} 个账号
            </el-tag>
          </div>
          <div style="display: flex; gap: 10px;">
            <el-button
              type="primary"
              class="btn-gradient"
              :icon="Promotion"
              @click="handleCreateTasks"
            >
              批量创建任务
            </el-button>
            <el-button
              :icon="Download"
              @click="generatorStore.exportAccounts()"
            >
              导出账号
            </el-button>
            <el-button
              :icon="Delete"
              @click="generatorStore.clear()"
            >
              清空
            </el-button>
          </div>
        </div>
      </template>

      <el-table
        :data="generatorStore.accounts"
        stripe
        class="enhanced-table"
        style="width: 100%;"
      >
        <el-table-column type="index" label="序号" width="80" />
        <el-table-column prop="email" label="邮箱" min-width="250">
          <template #default="{ row }">
            <span style="font-family: monospace;">{{ row.email }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="password" label="密码" min-width="200">
          <template #default="{ row }">
            <span style="font-family: monospace;">{{ row.password }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="姓名" width="150" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Delete, Promotion } from '@element-plus/icons-vue'
import { useGeneratorStore } from '../stores/generator'
import { getEmailConfig } from '../api/generator'
import { createTask } from '../api/tasks'
import '../styles/generator-view.css'

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
    // 加载邮箱配置
    const emailData = await getEmailConfig()
    if (emailData.success && emailData.config?.domains) {
      emailDomains.value = emailData.config.domains
    }
    
    // 加载生成器配置
    const response = await fetch('/api/generator/config')
    const configData = await response.json()
    if (configData.success && configData.config) {
      form.value.count = configData.config.defaultCount || 5
      form.value.emailLength = configData.config.defaultEmailLength || 12
      form.value.passwordLength = configData.config.defaultPasswordLength || 12
    }
    
    // 标记配置已加载，开始监听变化
    configLoaded.value = true
  } catch (error) {
    console.error('获取配置失败:', error)
    configLoaded.value = true
  }
})

// 监听表单变化，自动保存配置
watch(
  () => [form.value.count, form.value.emailLength, form.value.passwordLength],
  async () => {
    if (!configLoaded.value) return // 初始加载时不保存
    
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
      console.error('保存配置失败:', error)
    }
  }
)

const handleGenerate = async () => {
  try {
    const result = await generatorStore.generate(
      form.value.count, 
      form.value.emailLength,
      form.value.passwordLength
    )
    ElMessage.success(`成功生成 ${result.count} 个账号`)
  } catch (error: any) {
    ElMessage.error(error.message || '生成失败')
  }
}

const handleCreateTasks = async () => {
  if (generatorStore.accounts.length === 0) {
    ElMessage.warning('没有可用的账号')
    return
  }

  try {
    // 获取邮箱配置
    const emailConfigData = await getEmailConfig()
    if (!emailConfigData.success || !emailConfigData.config) {
      ElMessage.error('请先在"邮箱配置"中设置邮箱')
      return
    }

    const config = emailConfigData.config
    let receiveEmail = ''
    let authCode = ''

    // 判断使用哪种邮箱配置
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
      `确定要为 ${generatorStore.accounts.length} 个账号创建注册任务吗？\n\n接收邮箱: ${receiveEmail}\n任务将自动加入队列并开始执行。`,
      '批量创建任务',
      {
        confirmButtonText: '确定',
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
        console.error(`创建任务失败 [${account.email}]:`, error)
      }
    }

    ElMessage.success(
      `批量创建完成！成功: ${successCount} 个，失败: ${failCount} 个`
    )

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



/* 错误状态输入框样式 */
.error-input :deep(.el-input__wrapper) {
  background-color: #fee2e2 !important;
}

.error-input :deep(.el-input__inner) {
  color: #ef4444 !important;
}
