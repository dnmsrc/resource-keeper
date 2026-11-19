<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  GridOutline,
  FolderOutline,
  ScanOutline,
  CheckmarkDoneOutline,
  PricetagsOutline,
  SettingsOutline
} from '@vicons/ionicons5'
import type { Component } from 'vue'
import { openSettings } from '../lib/settingsStore'

const route = useRoute()
const router = useRouter()

interface NavItem {
  path: string
  title: string
  icon: Component
}

/** 设置不再是路由页：它是盖在窗口上的弹窗，所以单独放 */
const items: NavItem[] = [
  { path: '/dashboard', title: '总览', icon: GridOutline },
  { path: '/libraries', title: '受管目录', icon: FolderOutline },
  { path: '/scan', title: '扫描', icon: ScanOutline },
  { path: '/review', title: '待审', icon: CheckmarkDoneOutline },
  { path: '/tags', title: '标签体系', icon: PricetagsOutline }
]

const active = computed(() => route.path)

function go(path: string): void {
  void router.push(path)
}
</script>

<template>
  <aside class="sidebar">
    <nav class="nav">
      <button
        v-for="item in items"
        :key="item.path"
        class="nav-item"
        :class="{ on: active === item.path }"
        @click="go(item.path)"
      >
        <span class="icon"><component :is="item.icon" /></span>
        <span class="label">{{ item.title }}</span>
        <span class="dot" />
      </button>

      <button class="nav-item settings" @click="openSettings()">
        <span class="icon"><SettingsOutline /></span>
        <span class="label">设置</span>
        <span class="dot" />
      </button>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  flex: 0 0 var(--sidebar-w);
  border-right: 1px solid var(--line-soft);
  background: var(--sidebar-grad);
  display: flex;
  flex-direction: column;
  padding: 14px 12px;
  gap: 10px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 11px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 13.5px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.nav-item:hover {
  color: var(--text);
  background: var(--hover-2);
}

.nav-item.on {
  color: var(--nav-active-text);
  background: linear-gradient(100deg, rgba(98, 80, 240, 0.12), rgba(13, 159, 191, 0.06));
  border-color: var(--nav-active-border);
}

.icon {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  opacity: 0.95;
}

.icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.label {
  flex: 1;
  text-align: left;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
}

.nav-item.on .dot {
  background: var(--accent);
  box-shadow: 0 0 8px rgba(98, 80, 240, 0.45);
}

/* 设置是弹窗入口，不参与路由高亮，用一条间距和上面的页面分开 */
.nav-item.settings {
  margin-top: 8px;
}
</style>