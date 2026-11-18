<script setup lang="ts">
import { ref } from 'vue'
import { NCard, NButton, NTag, NInput, NEmpty } from 'naive-ui'
import { AddOutline, ColorPaletteOutline } from '@vicons/ionicons5'

interface Dimension {
  key: string
  name: string
  desc: string
  tags: string[]
  color: 'violet' | 'cyan' | 'green' | 'amber'
}

const dims = ref<Dimension[]>([
  { key: 'kind', name: '类型', desc: '资源的物理形态', tags: ['电影', '剧集', '动漫', '音乐', '小说', '图片', '游戏'], color: 'violet' },
  { key: 'genre', name: '题材', desc: '内容主题（AI 语义标签）', tags: ['科幻', '悬疑', '动作', '剧情', '喜剧', '纪录片'], color: 'cyan' },
  { key: 'quality', name: '画质', desc: '分辨率与编码', tags: ['4K', '1080p', '720p', 'HDR', 'REMUX'], color: 'green' },
  { key: 'state', name: '状态', desc: '你与这条资源的关系', tags: ['未看', '看过', '在追', '收藏'], color: 'amber' }
])

const newTag = ref('')
const activeDim = ref<string | null>(null)

function addTag(): void {
  const v = newTag.value.trim()
  if (!v) return
  const dim = dims.value.find((d) => d.key === activeDim.value)
  if (!dim) return
  if (!dim.tags.includes(v)) dim.tags.push(v)
  newTag.value = ''
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">标签体系</h1>
        <p class="page-sub">文件夹只做粗分层，一切检索靠标签；一套体系可以挂多个受管目录</p>
      </div>
      <n-button type="primary" quaternary>
        <template #icon><ColorPaletteOutline /></template>
        与 AI 一起设计体系
      </n-button>
    </div>

    <div class="scheme-bar">
      <span class="mono dim">当前体系：</span>
      <n-tag type="primary" :bordered="false">影视资源 v1（草稿）</n-tag>
      <span class="muted" style="font-size: 12px">· 4 个维度 · 22 个标签</span>
    </div>

    <div class="dims">
      <n-card v-for="d in dims" :key="d.key" size="small">
        <div class="dim-head">
          <div class="dim-name">{{ d.name }}</div>
          <div class="dim-desc">{{ d.desc }}</div>
        </div>
        <div class="tags">
          <n-tag
            v-for="t in d.tags"
            :key="t"
            size="small"
            :bordered="false"
            :type="d.color === 'violet' ? 'primary' : d.color === 'cyan' ? 'info' : d.color === 'green' ? 'success' : 'warning'"
            class="tag"
          >
            {{ t }}
          </n-tag>
          <button class="add-tag" @click="activeDim = d.key">
            <AddOutline />
          </button>
        </div>

        <div v-if="activeDim === d.key" class="add-row">
          <n-input v-model:value="newTag" size="small" placeholder="新标签名" @keyup.enter="addTag" />
          <n-button size="small" type="primary" @click="addTag">添加</n-button>
        </div>
      </n-card>
    </div>

    <n-card size="small" style="margin-top: 14px">
      <template #header>体系设计原则</template>
      <ul class="principles">
        <li><b>只建大类型目录</b>：电影 / 剧集 / 音乐 / 小说 / 图片 / 游戏，不按题材建深目录。</li>
        <li><b>一资源多标签</b>：一部片子可以同时是「电影 + 科幻 + 4K + 未看」。</li>
        <li><b>语义标签由 AI 提议</b>，你确认后才写入；规则标签（分辨率/季集）由代码自动打。</li>
        <li><b>体系可版本化</b>：以后想改维度，升 v2，历史标签保留可回溯。</li>
      </ul>
    </n-card>
  </div>
</template>

<style scoped>
.scheme-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.dims {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}

.dim-head {
  margin-bottom: 10px;
}

.dim-name {
  font-weight: 600;
  font-size: 14px;
}

.dim-desc {
  font-size: 11.5px;
  color: var(--text-3);
  margin-top: 2px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.tag {
  border-radius: 8px;
}

.add-tag {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: 1px dashed var(--line);
  background: transparent;
  color: var(--text-3);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: 0.15s;
}

.add-tag:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}

.add-tag :deep(svg) {
  width: 13px;
  height: 13px;
}

.add-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.principles {
  margin: 0;
  padding-left: 18px;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.9;
}

.principles b {
  color: var(--text);
}
</style>