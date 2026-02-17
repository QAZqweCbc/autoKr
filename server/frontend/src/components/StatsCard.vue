<template>
  <el-card class="stats-card" shadow="hover">
    <div class="stats-content">
      <div class="stats-header">
        <span v-if="icon" class="stats-icon">{{ icon }}</span>
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(102, 126, 234, 0.1);
  position: relative;
  overflow: hidden;
  height: 100%;
}

.stats-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stats-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(102, 126, 234, 0.15) !important;
  border-color: rgba(102, 126, 234, 0.3);
}

.stats-card:hover::before {
  transform: scaleX(1);
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stats-icon {
  font-size: 24px;
  filter: drop-shadow(0 2px 4px rgba(102, 126, 234, 0.2));
}

.stats-card h3 {
  color: #64748b;
  font-size: 13px;
  margin: 0;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.stats-card .value {
  font-size: 36px;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.2;
  transition: all 0.3s;
}

.stats-card:hover .value {
  transform: scale(1.05);
}
</style>
