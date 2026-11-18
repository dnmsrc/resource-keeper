<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { NButton, NCard, NProgress, NSelect, NTag, NCheckbox } from 'naive-ui'
import { PlayOutline, StopOutline } from '@vicons/ionicons5'

const rootOptions = [
  { label: 'D:\\Downloads（内置盘）', value: 'D:\\Downloads' },
  { label: 'E:\\Media（内置盘）', value: 'E:\\Media' },
  { label: 'F:\\Archive（移动硬盘 A · 离线）', value: 'F:\\Archive' }
]

const root = ref<string | null>(rootOptions[0].value)
const scanning = ref(false)
const percent = ref(0)
const files = ref(0)
const containers = ref(0)
const logs = ref<string[]>([])
let timer: number | undefined

function pushLog(line: string): void {
  logs.value.push(line)
  if (logs.value.length > 400) logs.value.shift()
}

function start(): void {
  if (scanning.value) return
  scanning.value = true
  percent.value = 0
  files.value = 0
  containers.value = 0
  logs.value = []
  pushLog('[运行] 开始只读扫描（不会修改任何文件）')
  timer = window.setInterval(() => {
    percent.value = Math.min(100, percent.value + Math.random() * 4)
    files.value += Math.floor(Math.random() * 900) + 120
    if (Math.random() < 0.12) {
      containers.value += 1
      const kinds = ['game', 'project', 'game_or_app']
      const k = kinds[Math.floor(Math.random() * kinds.length)]
      pushLog(`[容器] ${k}  ${files.value} 文件 · 已识别`)
    }
    if (percent.value >= 100) {
      pushLog(`[完成] 文件 ${files.value} · 容器 ${containers.value} · 错误 0`)
      stop()
    }
  }, 260)
}

function stop(): void {
  scanning.value = false
  if (timer) {
    window.clearInterval(timer)
    timer = undefined
  }
}

onUnmounted(stop)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">扫描</h1>
        <p class="page-sub">只读遍历 · 容器识别 · 采样哈希，绝不修改文件</p>
      </div>
      <div class="row">
        <n-button v-if="!scanning" type="primary" @click="start">
          <template #icon><PlayOutline /></template>
          开始扫描
        </n-button>
        <n-button v-else type="error" ghost @click="stop">
          <template #icon><StopOutline /></template>
          停止
        </n-button>
      </div>
    </div>

    <div class="grid-2">
      <n-card title="扫描目标" size="small">
        <n-select v-model:value="root" :options="rootOptions" placeholder="选择受管目录" />
        <div class="opts">
          <n-checkbox inline>跳过隐藏目录</n-checkbox>
          <n-checkbox inline>只读（强制）</n-checkbox>
        </div>

        <div class="progress-block">
          <div class="row">
            <span class="label">进度</span>
            <span class="grow" />
            <span class="mono dim">{{ percent.toFixed(0) }}%</span>
          </div>
          <n-progress type="line" :percentage="Number(percent.toFixed(0))" :height="8" :show-indicator="false" />

          <div class="counters">
            <div class="counter">
              <div class="k">文件</div>
              <div class="v mono">{{ files.toLocaleString() }}</div>
            </div>
            <div class="counter">
              <div class="k">容器</div>
              <div class="v mono">{{ containers }}</div>
            </div>
            <div class="counter">
              <div class="k">耗时</div>
              <div class="v mono">{{ scanning ? '…' : '—' }}</div>
            </div>
          </div>
        </div>
      </n-card>

      <n-card title="事件流" size="small">
        <template #header-extra>
          <n-tag size="small" :bordered="false" :type="scanning ? 'success' : 'default'">
            {{ scanning ? '运行中' : '空闲' }}
          </n-tag>
        </template>
        <div class="log mono">
          <div v-if="!logs.length" class="empty">扫描开始后，这里会实时打印事件</div>
          <div v-for="(l, i) in logs" :key="i" class="line">{{ l }}</div>
        </div>
      </n-card>
    </div>
  </div>
</template>

<style scoped>
.opts {
  display: flex;
  gap: 16px;
  margin: 12px 0 4px;
  font-size: 12.5px;
  color: var(--text-2);
}

.progress-block {
  margin-top: 10px;
}

.label {
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 6px;
}

.counters {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 14px;
}

.counter {
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  padding: 9px 11px;
  background: rgba(255, 255, 255, 0.015);
}

.counter .k {
  font-size: 11px;
  color: var(--text-3);
}

.counter .v {
  font-size: 17px;
  font-weight: 620;
  margin-top: 2px;
}

.log {
  height: 300px;
  overflow: auto;
  background: #0c0e13;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.7;
}

.log .line {
  color: #9fb0c8;
  white-space: pre-wrap;
  word-break: break-all;
}

.log .empty {
  color: var(--text-3);
}
</style>