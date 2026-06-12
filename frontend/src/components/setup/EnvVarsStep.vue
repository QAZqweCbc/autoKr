<template>
  <div class="env-vars-step" style="padding: 24px;">
    <el-form :model="form" label-width="140px">
      <el-form-item label="配置模式">
        <el-radio-group v-model="mode">
          <el-radio value="auto">自动生成</el-radio>
          <el-radio value="manual">手动输入</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="mode === 'auto'">
        <el-button type="primary" @click="generate">生成环境变量</el-button>
      </el-form-item>

      <el-form-item v-if="generated || mode === 'manual'" label="JWT_SECRET">
        <el-input v-model="form.JWT_SECRET" type="textarea" :rows="3" placeholder="JWT 密钥" />
      </el-form-item>

      <el-form-item v-if="generated || mode === 'manual'" label="ENCRYPTION_KEY">
        <el-input v-model="form.ENCRYPTION_KEY" type="textarea" :rows="3" placeholder="加密密钥" />
      </el-form-item>

      <el-form-item>
        <el-button type="success" @click="save" :disabled="!canSave">保存并继续</el-button>
        <el-button @click="emit('back')">上一步</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { generateEnvVars, saveEnvVars } from '../../api/setup'
import { ElMessage } from 'element-plus'

const emit = defineEmits<{
  next: [needsRestart: boolean]
  back: []
}>()

const mode = ref('auto')
const form = ref({ JWT_SECRET: '', ENCRYPTION_KEY: '' })
const generated = ref(false)

const canSave = computed(() => {
  return form.value.JWT_SECRET.length > 0 && form.value.ENCRYPTION_KEY.length > 0
})

const generate = async () => {
  try {
    const result = await generateEnvVars()
    if (result.success && result.envVars) {
      form.value = result.envVars
      generated.value = true
      ElMessage.success('环境变量已生成')
    } else {
      ElMessage.error('生成失败')
    }
  } catch (error) {
    ElMessage.error('生成失败: ' + error)
  }
}

const save = async () => {
  try {
    const result = await saveEnvVars(form.value)
    if (result.success) {
      ElMessage.success('环境变量已保存')
      emit('next', result.needsRestart || false)
    } else {
      ElMessage.error('保存失败')
    }
  } catch (error) {
    ElMessage.error('保存失败: ' + error)
  }
}
</script>

<style scoped>
.env-vars-step {
  max-width: 600px;
  margin: 0 auto;
}
</style>
