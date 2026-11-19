<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NCard, NModal, NInput, NSelect, NTag, useMessage } from 'naive-ui'
import { FolderOutline, AddOutline, TrashOutline } from '@vicons/ionicons5'

interface Library {
  id: number
  name: string
  path: string
  volume: string
  scheme: string
  status: 'idle' | 'online' | 'offline'
  files: number
  size: string
}

const message = useMessage()
const showAdd = ref(false)
const newPath = ref('')
const newLabel = ref('')
const newVolume = ref('builtin')

const volumeOptions = [
  { label: '内置盘（C/D）', value: 'builtin' },
  { label: '移动硬盘 A', value: 'usb-a' },
  { label: '移动硬盘 B', value: 'usb-b' }
]

const libs = ref<Library[]>([
  { id: 1, name: '下载目录', path: 'D:\\Downloads', volume: '内置盘', scheme: '未绑定', status: 'idle', files: 0, size: '—' },
  { id: 2, name: '影视库', path: 'E:\\Media', volume: '内置盘', scheme: '未绑定', status: 'idle', files: 0, size: '—' },
  { id: 3, name: '移动硬盘 A', path: 'F:\\Archive', volume: '移动硬盘 A', scheme: '未绑定', status: 'offline', files: 0, size: '—' }
])

function addLibrary(): void {
  if (!newPath.value.trim()) {
    message.warning('请填写目录路径')
    return
  }
  libs.value.push({
    id: Date.now(),
    name: newLabel.value.trim() || '新目录',
    path: newPath.value.trim(),
    volume: newVolume.value === 'builtin' ? '内置盘' : newVolume.value === 'usb-a' ? '移动硬盘 A' : '移动硬盘 B',
    scheme: '未绑定',
    status: 'idle',
    files: 0,
    size: '—'
  })
  showAdd.value = false
  newPath.value = ''
  newLabel.value = ''
  message.success('已加入受管目录')
}

function remove(id: number): void {
  libs.value = libs.value.filter((l) => l.id !== id)
  message.success('已移除（不会影响磁盘上的文件）')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">受管目录</h1>
        <p class="page-sub">可以加多个目录，分布在不同硬盘上，共享同一套标签体系</p>
      </div>
      <n-button type="primary" @click="showAdd = true">
        <template #icon><AddOutline /></template>
        添加目录
      </n-button>
    </div>

    <div class="libs">
      <n-card v-for="lib in libs" :key="lib.id" size="small" :bordered="true">
        <div class="lib-head">
          <div class="lib-icon"><FolderOutline /></div>
          <div class="grow">
            <div class="lib-name">{{ lib.name }}</div>
            <div class="lib-path mono">{{ lib.path }}</div>
          </div>
          <n-tag
            size="small"
            :bordered="false"
            :type="lib.status === 'offline' ? 'warning' : lib.status === 'online' ? 'success' : 'default'"
          >
            {{ lib.status === 'offline' ? '离线' : lib.status === 'online' ? '在线' : '未扫描' }}
          </n-tag>
        </div>

        <div class="meta">
          <span>卷：{{ lib.volume }}</span>
          <span>标签体系：{{ lib.scheme }}</span>
          <span>文件：{{ lib.files || '—' }}</span>
          <span>大小：{{ lib.size }}</span>
        </div>

        <div class="actions">
          <n-button size="small" quaternary>扫描</n-button>
          <n-button size="small" quaternary>绑定标签体系</n-button>
          <span class="grow" />
          <n-button size="small" quaternary type="error" @click="remove(lib.id)">
            <template #icon><TrashOutline /></template>
          </n-button>
        </div>
      </n-card>
    </div>

    <n-modal
      v-model:show="showAdd"
      preset="card"
      title="添加受管目录"
      style="width: 520px"
      :bordered="false"
    >
      <div class="form">
        <label>目录路径</label>
        <n-input v-model:value="newPath" placeholder="D:\Downloads" />
        <label>显示名称</label>
        <n-input v-model:value="newLabel" placeholder="下载目录（可留空）" />
        <label>所属硬盘</label>
        <n-select v-model:value="newVolume" :options="volumeOptions" />
        <p class="tip">加入后只做登记，扫描前不会读取或修改任何文件。</p>
      </div>
      <template #footer>
        <div class="row" style="justify-content: flex-end">
          <n-button quaternary @click="showAdd = false">取消</n-button>
          <n-button type="primary" @click="addLibrary">加入</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.libs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 14px;
}

.lib-head {
  display: flex;
  align-items: center;
  gap: 11px;
}

.lib-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: rgba(98, 80, 240, 0.12);
  color: #4634d6;
}

.lib-icon :deep(svg) {
  width: 17px;
  height: 17px;
}

.lib-name {
  font-weight: 600;
  font-size: 14px;
}

.lib-path {
  color: var(--text-3);
  font-size: 11.5px;
  margin-top: 2px;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-2);
}

.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line-soft);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form label {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 4px;
}

.tip {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-3);
}
</style>