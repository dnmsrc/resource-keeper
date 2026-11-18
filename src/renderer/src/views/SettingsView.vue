<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NCard, NInput, NSelect, NSwitch, NButton, NTag, useMessage } from 'naive-ui'
import type { AppInfo } from '../../../preload/index'

const message = useMessage()
const info = ref<AppInfo | null>(null)

const provider = ref('openai-compatible')
const baseUrl = ref('https://api.openai.com/v1')
const model = ref('gpt-4o-mini')
const apiKey = ref('')
const autoTag = ref(true)
const semanticTag = ref(true)

const providerOptions = [
  { label: 'OpenAI', value: 'openai-compatible' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: '通义千问', value: 'qwen' },
  { label: 'Ollama（本地）', value: 'ollama' }
]

onMounted(async () => {
  try {
    info.value = (await window.api?.info()) ?? null
  } catch {
    /* 忽略 */
  }
})

function save(): void {
  message.success('已保存到 config.json（占位，阶段 2 接入真实读写）')
}

function test(): void {
  message.info('阶段 2 支持连通性测试')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">设置</h1>
        <p class="page-sub">模型接入、标签策略、数据目录</p>
      </div>
      <n-button type="primary" @click="save">保存</n-button>
    </div>

    <div class="grid-2">
      <n-card title="模型接入" size="small">
        <div class="form">
          <label>服务商</label>
          <n-select v-model:value="provider" :options="providerOptions" />

          <label>Base URL</label>
          <n-input v-model:value="baseUrl" placeholder="https://api.openai.com/v1" />

          <label>模型</label>
          <n-input v-model:value="model" placeholder="gpt-4o-mini" />

          <label>API Key</label>
          <n-input v-model:value="apiKey" type="password" show-password-on="click" placeholder="sk-…" />

          <div class="row" style="margin-top: 6px">
            <n-button size="small" quaternary @click="test">测试连通</n-button>
            <span class="grow" />
            <n-tag size="small" :bordered="false" type="warning">未配置时自动走规则模式</n-tag>
          </div>
        </div>
      </n-card>

      <div class="col">
        <n-card title="标签策略" size="small">
          <div class="switch-row">
            <div>
              <div class="sr-title">规则标签自动打</div>
              <div class="sr-desc">分辨率 / 季集 / 编码等，由代码直接判定</div>
            </div>
            <n-switch v-model:value="autoTag" />
          </div>
          <div class="switch-row">
            <div>
              <div class="sr-title">语义标签由 AI 提议</div>
              <div class="sr-desc">题材 / 风格 / 系列，需你确认后才写入</div>
            </div>
            <n-switch v-model:value="semanticTag" />
          </div>
        </n-card>

        <n-card title="数据与运行" size="small" style="margin-top: 14px">
          <div class="kv">
            <span>数据目录</span>
            <span class="mono v">{{ info?.dataDir ?? '仅桌面端可用' }}</span>
          </div>
          <div class="kv">
            <span>版本</span>
            <span class="mono v">{{ info?.version ?? '开发版' }}</span>
          </div>
          <div class="kv">
            <span>运行时</span>
            <span class="mono v">Electron {{ info?.electron ?? '—' }} · Node {{ info?.node ?? '—' }}</span>
          </div>
          <div class="kv">
            <span>数据库</span>
            <span class="mono v">data/keeper.db（阶段 1 接入）</span>
          </div>
        </n-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.form label {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 6px;
}

.col {
  display: flex;
  flex-direction: column;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line-soft);
}

.switch-row:last-child {
  border-bottom: none;
}

.sr-title {
  font-size: 13px;
}

.sr-desc {
  font-size: 11.5px;
  color: var(--text-3);
  margin-top: 2px;
}

.kv {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 7px 0;
  font-size: 12.5px;
  color: var(--text-2);
  border-bottom: 1px solid var(--line-soft);
}

.kv:last-child {
  border-bottom: none;
}

.kv .v {
  color: var(--text);
  max-width: 62%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>