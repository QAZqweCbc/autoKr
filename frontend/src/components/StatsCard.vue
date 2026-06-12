<template>
  <el-card class="stats-card" shadow="never">
    <div class="stats-content">
      <div class="stats-header">
        <span v-if="icon" class="stats-icon" :style="{ color }">{{ icon }}</span>
        <h3>{{ title }}</h3>
      </div>
      <div class="value" :style="{ color }">{{ value }}</div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  value: number | string
  color?: string
  icon?: string
}>()
</script>

<style scoped>
.stats-card {
  height: 100%;
  background: #ffffff;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.stats-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md) !important;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 96px;
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 9px;
}

.stats-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 8px;
  background: #eef4fb;
  font-size: 16px;
  font-weight: 700;
}

.stats-card h3 {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 0;
  font-weight: 600;
  letter-spacing: 0;
}

.stats-card .value {
  color: var(--text-primary);
  font-size: 34px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
}

@media (max-width: 639px) {
  .stats-content {
    min-height: 78px;
    gap: 10px;
  }

  .stats-card .value {
    font-size: 28px;
  }
}
</style>
