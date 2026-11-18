<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NCard, NTag, NSelect, NEmpty, NCheckbox } from 'naive-ui'

interface Item {
  id: number
  name: string
  path: string
  kind: string
  size: string
  suggest: string[]
  action: 'keep' | 'trash' | 'review'
  dup: boolean
}

const items = ref<Item[]>([
  { id: 1, name: 'Inception.2010.1080p.mkv', path: 'D:\\Downloads\\', kind: 'video', size: '8.2 GB', suggest: ['电影', '科幻', '1080p'], action: 'keep', dup: true },
  { id: 2, name: 'Some.Show.S01E03.mkv', path: 'E:\\Media\\未整理\\', kind: 'video', size: '1.1 GB', suggest: ['剧集', 'S01E03'], action: 'keep', dup: false },
  { id: 3, name: '三体.txt', path: 'D:\\Downloads\\', kind: 'text', size: '2.4 MB', suggest: ['小说', '科幻'], action: 'keep', dup: false },
  { id: 4, name: 'wallpaper-a(1).jpg', path: 'C:\\Users\\Me\\Pictures', kind: 'image', size: '3.9 MB', suggest: ['图片', '重复'], action: 'trash', dup: true },
  { id: 5, name: 'corrupted-video.mp4', path: 'E:\\Media\\旧\\', kind: 'video', size: '512 MB', suggest: ['损坏'], action: 'review', dup: false }
])

const selected = ref<Set<number>>(new Set())
const filter = ref<'all' | 'dup' | 'trash'>('all')

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '仅重复', value: 'dup' },
  { label: '仅待删候选', value: 'trash' }
]

const visible = computed(() =>
  items.value.filter((i) => {
    if (filter.value === 'dup') return i.dup
    if (filter.value === 'trash') return i.action === 'trash'
    return true
  })
)

const allChecked = computed(() => visible.value.every((i) => selected.value.has(i.id)))

function toggle(id: number): void {
  const s = new Set(selected.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selected.value = s
}

function toggleAll(): void {
  if (allChecked.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(visible.value.map((i) => i.id))
  }
}

const selectedCount = computed(() => selected.value.size)

function batch(action: 'keep' | 'trash'): void {
  items.value = items.value.map((i) =>
    selected.value.has(i.id) ? { ...i, action: action === 'trash' ? 'trash' : 'keep' } : i
  )
  selected.value = new Set()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">待审</h1>
        <p class="page-sub">AI 只给建议，打勾确认后才会进入移动或删除队列</p>
      </div>
      <div class="row">
        <n-select v-model:value="filter" :options="filterOptions" size="small" style="width: 150px" />
      </div>
    </div>

    <n-card size="small">
      <div class="toolbar">
        <n-checkbox :checked="allChecked" @update:checked="toggleAll">全选</n-checkbox>
        <span class="muted" style="font-size: 12px">已选 {{ selectedCount }} 项</span>
        <span class="grow" />
        <n-button size="small" :disabled="!selectedCount" @click="batch('keep')">标记保留</n-button>
        <n-button size="small" type="error" ghost :disabled="!selectedCount" @click="batch('trash')">
          标记待删
        </n-button>
      </div>

      <div class="table">
        <div class="thead">
          <span class="c-check" />
          <span class="c-name">文件</span>
          <span class="c-kind">类型</span>
          <span class="c-size">大小</span>
          <span class="c-tags">建议标签</span>
          <span class="c-state">状态</span>
        </div>
        <div v-for="item in visible" :key="item.id" class="tr">
          <span class="c-check">
            <n-checkbox :checked="selected.has(item.id)" @update:checked="toggle(item.id)" />
          </span>
          <span class="c-name">
            <span class="fname">{{ item.name }}</span>
            <span class="fpath mono">{{ item.path }}</span>
          </span>
          <span class="c-kind"><n-tag size="small" :bordered="false">{{ item.kind }}</n-tag></span>
          <span class="c-size mono">{{ item.size }}</span>
          <span class="c-tags">
            <n-tag v-for="t in item.suggest" :key="t" size="tiny" :bordered="false" type="info" style="margin-right: 4px">
              {{ t }}
            </n-tag>
          </span>
          <span class="c-state">
            <n-tag
              size="small"
              :bordered="false"
              :type="item.action === 'trash' ? 'error' : item.action === 'review' ? 'warning' : 'success'"
            >
              {{ item.action === 'trash' ? '待删' : item.action === 'review' ? '待定' : '保留' }}
            </n-tag>
          </span>
        </div>
        <div v-if="!visible.length" class="empty-wrap">
          <n-empty description="没有符合条件的条目" />
        </div>
      </div>
    </n-card>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 2px 12px;
  border-bottom: 1px solid var(--line-soft);
  margin-bottom: 6px;
}

.table {
  display: flex;
  flex-direction: column;
}

.thead,
.tr {
  display: grid;
  grid-template-columns: 34px minmax(240px, 2.2fr) 90px 90px minmax(180px, 1.4fr) 90px;
  align-items: center;
  gap: 10px;
  padding: 9px 4px;
}

.thead {
  font-size: 11.5px;
  color: var(--text-3);
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--line-soft);
}

.tr {
  border-bottom: 1px solid var(--line-soft);
  transition: background 0.14s;
}

.tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.c-name {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.fname {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fpath {
  color: var(--text-3);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.c-size {
  font-size: 12px;
  color: var(--text-2);
}

.empty-wrap {
  padding: 36px 0;
}
</style>