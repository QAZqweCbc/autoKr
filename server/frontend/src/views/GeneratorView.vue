<template>
  <div class="generator-redirect">
    <el-result icon="info" title="页面已迁移" sub-title="账号生成已并入账号管理页，正在为你跳转。" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  router.replace('/accounts')
})
</script>

<style scoped>
.generator-redirect {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
