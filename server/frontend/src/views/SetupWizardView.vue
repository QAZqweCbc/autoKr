<template>
  <el-dialog :model-value="true" fullscreen :close-on-click-modal="false" :show-close="false">
    <template #header>
      <h2>🚀 环境配置向导</h2>
    </template>

    <el-steps :active="step" align-center style="margin-bottom: 40px;">
      <el-step title="MySQL" />
      <el-step title="Redis" />
      <el-step title="环境变量" />
      <el-step title="系统依赖" />
    </el-steps>

    <div style="min-height: 400px; padding: 20px;">
      <MySQLStep v-if="step === 0" @next="step = 1" @skip="step = 1" />
      <RedisStep v-if="step === 1" @next="step = 2" @back="step = 0" />
      <EnvVarsStep v-if="step === 2" @next="step = 3" @back="step = 1" />
      <DependenciesStep v-if="step === 3" @complete="handleComplete" @back="step = 2" />
    </div>

    <el-dialog v-model="completed" title="✅ 配置完成" width="500px">
      <div v-if="needsRestart" style="padding: 20px;">
        <el-alert type="warning" :closable="false">
          <template #title><strong>需要重启服务器</strong></template>
          <div style="margin-top: 8px;">环境变量已更新，请重启服务器以使配置生效。</div>
        </el-alert>
      </div>
      <div v-else style="padding: 20px;">
        <el-alert type="success" :closable="false">
          <template #title><strong>配置已完成</strong></template>
          <div style="margin-top: 8px;">所有配置已保存，可以开始使用了。</div>
        </el-alert>
      </div>
      <template #footer>
        <el-button type="primary" @click="reload">刷新页面</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MySQLStep from '../components/setup/MySQLStep.vue'
import RedisStep from '../components/setup/RedisStep.vue'
import EnvVarsStep from '../components/setup/EnvVarsStep.vue'
import DependenciesStep from '../components/setup/DependenciesStep.vue'
import { markSetupComplete } from '../api/setup'

const step = ref(0)
const completed = ref(false)
const needsRestart = ref(false)

const handleComplete = async () => {
  try {
    const result = await markSetupComplete({
      envVarsChanged: true,
      systemDepsInstalled: false,
      mysqlChanged: false,
      redisChanged: false
    })
    if (result.success) {
      needsRestart.value = result.needsRestart || false
      completed.value = true
    }
  } catch (error) {
    console.error('完成配置失败:', error)
  }
}

const reload = () => {
  window.location.reload()
}
</script>

<style scoped>
.el-steps {
  max-width: 800px;
  margin: 0 auto;
}
</style>
