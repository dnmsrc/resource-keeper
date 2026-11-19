<script setup lang="ts">
/**
 * 窗口底部状态栏。
 * 用途：把「数据存在哪」和「当前版本」常驻在最下面——这两件事用户随时会想确认，
 * 不该藏进设置页里翻。数据目录本身就是打开入口，点一下直接跳资源管理器。
 */
import { appInfo } from '../lib/appInfo'

async function openDir(): Promise<void> {
  await window.api?.data.open()
}
</script>

<template>
  <footer class="statusbar">
    <span class="label">数据目录</span>
    <button
      class="path mono"
      :title="`点击打开 ${appInfo.dataDir ?? ''}`"
      :disabled="!appInfo.dataDir"
      @click="openDir"
    >
      {{ appInfo.dataDir ?? '仅桌面端可用' }}
    </button>
    <span v-if="appInfo.dataDirFallback" class="flag warn">默认位置不可写，已临时改用用户目录</span>
    <span v-else-if="appInfo.dev" class="flag">开发模式</span>
    <span class="grow" />
    <span class="ver mono">v{{ appInfo.version ?? '0.0.0' }}</span>
  </footer>
</template>

<style scoped>
.statusbar {
  height: var(--statusbar-h);
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border-top: 1px solid var(--line-soft);
  background: var(--panel-2);
  font-size: 11.5px;
  color: var(--text-3);
  user-select: none;
}

.label {
  flex: 0 0 auto;
}

.path {
  max-width: 58ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 11px;
  cursor: pointer;
  transition: color 0.15s;
}

.path:hover:not(:disabled) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.path:disabled {
  cursor: default;
  color: var(--text-3);
}

.flag {
  flex: 0 0 auto;
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--hover-2);
  color: var(--text-3);
}

.flag.warn {
  background: rgba(180, 83, 9, 0.1);
  color: var(--warn);
}

.grow {
  flex: 1;
}

.ver {
  flex: 0 0 auto;
  font-size: 10.5px;
  color: var(--text-3);
  letter-spacing: 0.3px;
}
</style>