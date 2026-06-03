<template>
  <div class="dependencies-step" style="padding: 24px;">
    <el-button type="primary" @click="check">检测</el-button>
    <el-table :data="deps" style="margin-top: 20px;">
      <el-table-column label="项目" prop="name" />
      <el-table-column label="状态" prop="status" />
      <el-table-column label="信息" prop="message" />
    </el-table>
    <el-space style="margin-top: 20px;">
      <el-button type="success" @click="$emit('complete')">完成</el-button>
      <el-button @click="$emit('back')">上一步</el-button>
    </el-space>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { checkDependencies, type DependencyCheck } from '../../api/setup'

defineEmits<{ complete: []; back: [] }>()

const deps = ref<DependencyCheck[]>([])

const check = async () => {
  const result = await checkDependencies()
  if (result.dependencies) {
    deps.value = result.dependencies
  }
}
</script>
