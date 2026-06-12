<template>
  <div class="redis-step">
    <el-alert type="info" :closable="false" style="margin-bottom: 24px;">
      <template #title><strong>配置 Redis（可选）</strong></template>
      Redis 用于缓存和提升性能。这是可选配置。
    </el-alert>

    <el-form :model="form" label-width="120px" style="max-width: 600px;">
      <el-form-item label="主机地址">
        <el-input v-model="form.host" placeholder="localhost" :disabled="tested" />
      </el-form-item>
      <el-form-item label="端口">
        <el-input-number v-model="form.port" :min="1" :max="65535" style="width: 200px;" :disabled="tested" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" placeholder="可留空" show-password :disabled="tested" />
      </el-form-item>
      <el-form-item label="数据库编号">
        <el-input-number v-model="form.db" :min="0" :max="15" style="width: 200px;" :disabled="tested" />
      </el-form-item>
      <el-form-item>
        <el-space>
          <el-button type="primary" :loading="testing" :disabled="!form.host || tested" @click="handleTest">
            {{ tested ? '✓ 连接成功' : '🔍 测试连接' }}
          </el-button>
          <el-button v-if="tested" @click="handleReset">重新配置</el-button>
          <el-button type="success" :disabled="!tested && form.host" @click="handleNext">下一步</el-button>
          <el-button @click="handleSkip">跳过</el-button>
        </el-space>
      </el-form-item>
    </el-form>

    <el-alert v-if="tested" type="success" :closable="false" style="margin-top: 24px;">
      <template #title><strong>✅ Redis 连接成功！</strong></template>
    </el-alert>
    <el-alert v-if="errorMessage" type="error" :closable="true" style="margin-top: 24px;" @close="errorMessage = ''">
      <div>❌ {{ errorMessage }}</div>
    </el-alert>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { saveDatabaseConfig, testConnection, getDatabaseConfig } from '../../api/databaseConfig'

const emit = defineEmits<{
  next: [boolean]
  back: []
}>()

const form = ref({
  host: 'localhost',
  port: 6379,
  password: '',
  db: 0
})

const testing = ref(false)
const tested = ref(false)
const errorMessage = ref('')

onMounted(async () => {
  try {
    const result = await getDatabaseConfig()
    if (result.success && result.config?.redis) {
      form.value = {
        host: result.config.redis.host || 'localhost',
        port: result.config.redis.port || 6379,
        password: result.config.redis.password === '******' ? '' : result.config.redis.password || '',
        db: result.config.redis.db ?? 0
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
    const result = await testConnection('redis', form.value)
    if (result.success) {
      tested.value = true
      ElMessage.success('Redis 连接成功！')
      const currentConfig = await getDatabaseConfig()
      if (currentConfig.success && currentConfig.config) {
        await saveDatabaseConfig({ ...currentConfig.config, redis: form.value })
      }
    } else {
      errorMessage.value = result.error || 'Redis 连接失败'
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
  emit('next', tested.value)
}

const handleSkip = () => {
  ElMessage.info('已跳过 Redis 配置')
  emit('next', false)
}
</script>

<style scoped>
.redis-step {
  padding: 24px;
}
</style>
