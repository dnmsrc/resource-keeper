<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  label: string
  value: string
  hint?: string
  tone?: 'violet' | 'cyan' | 'green' | 'amber'
  icon?: Component
}>()
</script>

<template>
  <div class="stat" :class="tone ?? 'violet'">
    <div class="top">
      <span class="label">{{ label }}</span>
      <span v-if="icon" class="icon"><component :is="icon" /></span>
    </div>
    <div class="value">{{ value }}</div>
    <div class="hint">{{ hint ?? '' }}</div>
  </div>
</template>

<style scoped>
.stat {
  position: relative;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--panel-grad);
  box-shadow: var(--shadow-1);
  padding: 15px 16px 14px;
  overflow: hidden;
  transition: transform 0.16s, border-color 0.16s;
}

.stat:hover {
  transform: translateY(-1px);
  border-color: var(--line-strong);
}

.stat::after {
  content: '';
  position: absolute;
  inset: auto -20% -60% auto;
  width: 180px;
  height: 120px;
  border-radius: 50%;
  filter: blur(28px);
  opacity: 0.3;
  pointer-events: none;
}

.violet::after { background: rgba(98, 80, 240, 0.32); }
.cyan::after { background: rgba(13, 159, 191, 0.28); }
.green::after { background: rgba(15, 159, 110, 0.24); }
.amber::after { background: rgba(180, 83, 9, 0.18); }

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.label {
  font-size: 12px;
  color: var(--text-2);
  letter-spacing: 0.03em;
}

.icon {
  color: var(--text-3);
  display: grid;
  place-items: center;
}

.icon :deep(svg) {
  width: 15px;
  height: 15px;
}

.value {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 680;
  letter-spacing: -0.4px;
  font-variant-numeric: tabular-nums;
}

.hint {
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--text-3);
  min-height: 16px;
}
</style>