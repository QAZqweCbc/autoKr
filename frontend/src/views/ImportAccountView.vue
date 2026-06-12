<template>
  <div class="import-account-redirect">
    <el-result icon="info" title="导入入口已迁移" sub-title="正在跳转到 Token 管理中的文字导入面板" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  router.replace({ path: '/token', query: { import: '1' } })
})
</script>

<style scoped>
.import-account-redirect {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
