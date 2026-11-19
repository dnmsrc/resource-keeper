<script setup lang="ts">
import { useRoute } from 'vue-router'
import { appInfo } from '../lib/appInfo'

const route = useRoute()
</script>

<template>
  <header class="titlebar">
    <div class="brand">
      <div class="mark">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
          <path d="M4 7.5 12 12l8-4.5M12 12v9" fill="none" stroke="currentColor" stroke-width="1.6" />
        </svg>
      </div>
      <span class="name">资源管家</span>
    </div>

    <div class="center">
      <span class="crumb">{{ route.meta.title ?? '' }}</span>
    </div>

    <div class="right">
      <!-- 运行时信息（平台、Electron 版本）不展示：版本号统一放窗口底部状态栏 -->
      <span v-if="appInfo.dev" class="badge">DEV</span>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  height: var(--titlebar-h);
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 152px 0 16px; /* 右侧给系统按钮留位 */
  border-bottom: 1px solid var(--line-soft);
  background: var(--glass);
  backdrop-filter: blur(12px);
  -webkit-app-region: drag;
  user-select: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
}

.mark {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(140deg, #6d5bf4, #0fa8c8);
  box-shadow: 0 4px 12px rgba(98, 80, 240, 0.26);
}

.name {
  font-weight: 650;
  letter-spacing: 0.3px;
  font-size: 13.5px;
}

.center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.crumb {
  font-size: 12.5px;
  color: var(--text-2);
  padding: 3px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--hover);
}

.right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge {
  font-size: 10.5px;
  letter-spacing: 0.08em;
  padding: 2px 7px;
  border-radius: 6px;
  color: #fff;
  background: linear-gradient(120deg, #6250f0, #0d9fbf);
  font-weight: 700;
}
</style>