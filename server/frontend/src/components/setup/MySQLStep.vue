<template>
  <div class="mysql-step">
    <el-alert type="info" :closable="false" style="margin-bottom: 24px;">
      <template #title><strong>配置 MySQL 数据库</strong></template>
      <div style="margin-top: 8px;">MySQL 用于存储账号数据。如果暂时不想使用数据库，可以选择跳过，系统将使用 JSON 文件存储。</div>
    </el-alert>

    <el-form :model="form" label-width="120px" style="max-width: 600px;">
      <el-form-item label="主机地址">
        <el-input v-model="form.host" placeholder="localhost" :disabled="tested" />
      </el-form-item>
      <el-form-item label="端口">
        <el-input-number v-model="form.port" :min="1" :max="65535" style="width: 200px;" :disabled="tested" />
      </el-form-item>
      <el-form-item label="用户名">
        <el-input v-model="form.user" placeholder="root" :disabled="tested" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" show-password :disabled="tested" />
      </el-form-item>
      <el-form-item label="数据库">
        <el-input v-model="form.database" disabled />
      </el-form-item>
      <el-form-item>
        <el-space>
          <el-button type="primary" :loading="testing" :disabled="!canTest || tested" @click="handleTest">
            {{ tested ? '✓ 连接成功' : '🔍 测试连接' }}
          </el-button>
          <el-button v-if="tested" @click="handleReset">重新配置</el-button>
          <el-button type="success" :disabled="!tested" @click="handleNext">下一步 →</el-button>
          <el-button @click="handleSkip">跳过</el-button>
        </el-space>
      </el-form-item>
    </el-form>

    <el-alert v-if="tested" type="success" :closable="false" style="margin-top: 24px;">
      <template #title><strong>✅ MySQL 连接成功！</strong></template>
    </el-alert>
    <el-alert v-if="errorMessage" type="error" :closable="true" style="margin-top: 24px;" @close="errorMessage = ''">
      <template #title><strong>❌ 连接失败</strong></template>
      <div style="margin-top: 8px;">{{ errorMessage }}</div>
    </el-alert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getDatabaseConfig, saveDatabaseConfig, testConnection } from '../../api/databaseConfig'

const emit = defineEmits<{ next: [boolean]; skip: [] }>()

const form = ref({ host: 'localhost', port: 3306, user: 'root', password: '', database: 'KrioServer' })
const testing = ref(false)
const tested = ref(false)
const errorMessage = ref('')

const canTest = computed(() => form.value.host && form.value.user)

onMounted(async () => {
  try {
    const result = await getDatabaseConfig()
    if (result.success && result.config?.mysql) {
      form.value = {
        host: result.config.mysql.host || 'localhost',
        port: result.config.mysql.port || 3306,
        user: result.config.mysql.user || 'root',
        password: result.config.mysql.password === '******' ? '' : result.config.mysql.password || '',
        database: result.config.mysql.database || 'KrioServer'
      }
    }
  } catch {
    // 保留默认值，避免阻塞配置向导
  }
})

const handleTest = async () => {
  testing.value = true
  errorMessage.value = ''
  try {
    const result = await testConnection('mysql', form.value)
    if (result.success) {
      tested.value = true
      ElMessage.success('MySQL 连接成功！')
      await saveDatabaseConfig({
        storage: 'mysql',
        mysql: form.value,
        redis: { host: '', port: 6379, password: '', db: 0 }
      })
    } else {
      errorMessage.value = result.error || 'MySQL 连接失败'
    }
  } catch (error: any) {
    errorMessage.value = error.message || '连接测试失败'
  } finally {
    testing.value = false
  }
}

const handleReset = () => {
  tested.value = false
  errorMessage.value = ''
}

const handleNext = () => {
  if (tested.value) emit('next', true)
}

const handleSkip = async () => {
  try {
    await saveDatabaseConfig({
      storage: 'mysql',
      mysql: { host: '', port: 3306, user: '', password: '', database: 'KrioServer' },
      redis: { host: '', port: 6379, password: '', db: 0 }
    })
    ElMessage.info('已跳过 MySQL 配置')
    emit('skip')
  } catch {
    ElMessage.error('保存配置失败')
  }
}
</script>

<style scoped>
.mysql-step { padding: 24px; }
</style>
