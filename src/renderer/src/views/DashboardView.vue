<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NCard, NProgress, NButton, NTag } from 'naive-ui'
import { FolderOutline, DocumentOutline, CubeOutline, CopyOutline } from '@vicons/ionicons5'
import StatCard from '../components/StatCard.vue'
import type { Overview } from '../../../preload/index'

const ov = ref<Overview>({
  libraries: 0,
  files: 0,
  containers: 0,
  totalBytes: 0,
  duplicates: 0,
  scanning: false
})

onMounted(async () => {
  try {
    ov.value = await window.api.overview()
  } catch {
    /* dev 预览时可无 preload */
  }
})

function human(n: number): string {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

const libraries = ref([
  { name: '下载目录', path: 'D:\\Downloads', files: 0, size: '—', tone: 'violet' as const },
  { name: '影视库', path: 'E:\\Media', files: 0, size: '—', tone: 'cyan' as const },
  { name: '移动硬盘 A', path: 'F:\\Archive', files: 0, size: '—', tone: 'amber' as const }
])

const todos = ref([
  { text: '添加第一个受管目录', done: false },
  { text: '扫描并生成台账', done: false },
  { text: '与 AI 对话，确定分类体系', done: false },
  { text: '批量确认待审标签', done: false }
])
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">总览</h1>
        <p class="page-sub">只读扫描 · 台账 · 标签 · 待审，一处看全</p>
      </div>
      <div class="row">
        <n-button type="primary">添加受管目录</n-button>
      </div>
    </div>

    <div class="grid-cards">
      <StatCard label="受管目录" :value="String(ov.libraries)" hint="可分布在多块硬盘" tone="violet" :icon="FolderOutline" />
      <StatCard label="独立文件" :value="ov.files.toLocaleString()" hint="不含容器内部" tone="cyan" :icon="DocumentOutline" />
      <StatCard label="容器" :value="String(ov.containers)" hint="游戏 / 软件 / 工程，整体管理" tone="green" :icon="CubeOutline" />
      <StatCard label="疑似重复" :value="String(ov.duplicates)" hint="待确认可回收空间" tone="amber" :icon="CopyOutline" />
    </div>

    <div class="grid-2">
      <n-card title="受管目录" :bordered="true" size="small">
        <div class="lib-list">
          <div v-for="lib in libraries" :key="lib.path" class="lib" :class="lib.tone">
            <div class="lib-icon"><FolderOutline /></div>
            <div class="grow">
              <div class="lib-name">{{ lib.name }}</div>
              <div class="lib-path mono">{{ lib.path }}</div>
            </div>
            <div class="lib-meta">
              <span>{{ lib.files || '—' }} 文件</span>
              <span class="dim">·</span>
              <span>{{ lib.size }}</span>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="row muted" style="font-size: 12px">
            <span>尚未扫描</span>
            <span class="grow" />
            <n-button text type="primary">去扫描</n-button>
          </div>
        </template>
      </n-card>

      <div class="col">
        <n-card title="扫描进度" size="small">
          <div class="scan-box">
            <n-progress type="line" :percentage="0" :height="8" :show-indicator="false" />
            <div class="row" style="margin-top: 8px">
              <span class="muted" style="font-size: 12px">空闲</span>
              <span class="grow" />
              <span class="mono dim">0 / 0</span>
            </div>
          </div>
        </n-card>

        <n-card title="开始之前" size="small" style="margin-top: 14px">
          <ul class="todo">
            <li v-for="t in todos" :key="t.text" :class="{ done: t.done }">
              <span class="tick" />
              <span>{{ t.text }}</span>
            </li>
          </ul>
          <template #footer>
            <div class="row">
              <n-tag size="small" :bordered="false" type="success">只读</n-tag>
              <span class="muted" style="font-size: 12px">扫描阶段不会修改任何文件</span>
            </div>
          </template>
        </n-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lib-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lib {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: var(--hover);
}

.lib-icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
}

.lib-icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.violet .lib-icon { background: rgba(98, 80, 240, 0.12); color: #4634d6; }
.cyan .lib-icon { background: rgba(13, 159, 191, 0.12); color: #0a7d96; }
.amber .lib-icon { background: rgba(180, 83, 9, 0.1); color: #9a5b12; }

.lib-name {
  font-size: 13.5px;
  font-weight: 550;
}

.lib-path {
  color: var(--text-3);
  font-size: 11.5px;
  margin-top: 1px;
}

.lib-meta {
  font-size: 12px;
  color: var(--text-2);
  display: flex;
  gap: 6px;
  align-items: center;
}

.col {
  display: flex;
  flex-direction: column;
}

.todo {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo li {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  color: var(--text-2);
}

.todo li.done {
  color: var(--text-3);
  text-decoration: line-through;
}

.tick {
  width: 14px;
  height: 14px;
  border-radius: 5px;
  border: 1px solid var(--line);
  background: var(--hover);
}

.todo li.done .tick {
  background: var(--success);
  border-color: var(--success);
}

.scan-box {
  padding: 4px 2px;
}
</style>