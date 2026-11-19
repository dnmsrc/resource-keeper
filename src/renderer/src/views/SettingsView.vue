<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NCard, NInput, NButton, NTag, NTabs, NTabPane, NSelect, useMessage } from 'naive-ui'
import { appInfo, refreshAppInfo } from '../lib/appInfo'

const message = useMessage()

interface ProviderPreset {
  id: string
  label: string
  desc: string
  baseUrl: string
  /** 常用模型；只是候选，用户可以直接输入别的名字 */
  models: string[]
}

// 只列真能跑通的 OpenAI 兼容端点。想接别的，选一个最接近的再改地址即可。
const PROVIDERS: ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    desc: 'api.openai.com',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o4-mini']
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    desc: 'api.deepseek.com',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  {
    id: 'qwen',
    label: '通义千问',
    desc: 'DashScope 兼容模式',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long']
  },
  {
    id: 'ollama',
    label: 'Ollama',
    desc: '本机 11434 端口',
    baseUrl: 'http://localhost:11434/v1',
    models: ['qwen2.5:7b', 'qwen2.5:14b', 'llama3.1:8b']
  }
]

const tab = ref('model')
const provider = ref(PROVIDERS[0].id)
const baseUrl = ref(PROVIDERS[0].baseUrl)
const model = ref(PROVIDERS[0].models[0])
const apiKey = ref('')
const hasKey = ref(false)
const busy = ref(false)

// 当前服务商的模型候选；n-select 开了 tag，不在候选里的名字也能直接输入
const modelOptions = computed(() => {
  const p = PROVIDERS.find((x) => x.id === provider.value)
  return (p?.models ?? []).map((m) => ({ label: m, value: m }))
})

// 模板里直接读 reactive 单例时，vue-tsc 会按 ref 去找 .value；这里统一摊平成 computed
const currentDir = computed(() => appInfo.dataDir ?? '')
const isDefaultDir = computed(() => appInfo.dataDirDefault ?? true)
const inDev = computed(() => appInfo.dev ?? false)
const defaultLocation = computed(() => appInfo.defaultDataDir ?? '—')

function pick(p: ProviderPreset): void {
  if (provider.value === p.id) return
  provider.value = p.id
  baseUrl.value = p.baseUrl
  model.value = p.models[0]
  apiKey.value = ''
}

async function loadLlm(): Promise<void> {
  try {
    const c = await window.api.config.getLlm()
    provider.value = c.provider
    baseUrl.value = c.baseUrl
    model.value = c.model
    hasKey.value = c.hasKey
  } catch {
    /* 没有 preload（静态预览）时保持默认值 */
  }
}

async function saveLlm(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    // 只有真的输入了新 key 才提交，留空表示保留磁盘上已加密的那一份
    const c = await window.api.config.setLlm({
      provider: provider.value,
      baseUrl: baseUrl.value,
      model: model.value,
      ...(apiKey.value.trim() ? { apiKey: apiKey.value.trim() } : {})
    })
    hasKey.value = c.hasKey
    apiKey.value = ''
    message.success('已保存')
  } catch (e) {
    message.error(`保存失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

async function testLlm(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const r = await window.api.llm.test()
    if (r.ok) message.success(r.message)
    else message.error(r.message)
  } catch (e) {
    message.error(`测试失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

async function openDir(): Promise<void> {
  const err = await window.api.data.open()
  // shell.openPath 用空串表示打开成功
  if (err) message.error(`打不开目录：${err}`)
}

async function chooseDir(): Promise<void> {
  try {
    const d = await window.api.data.choose()
    if (!d) return
    await refreshAppInfo()
    message.success('数据目录已切换')
  } catch (e) {
    message.error(`切换失败：${(e as Error).message}`)
  }
}

async function resetDir(): Promise<void> {
  await window.api.data.reset()
  await refreshAppInfo()
  message.success('已恢复默认位置')
}

onMounted(async () => {
  await refreshAppInfo()
  await loadLlm()
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">设置</h1>
        <p class="page-sub">模型接入与数据位置</p>
      </div>
    </div>

    <n-tabs v-model:value="tab" type="line" animated>
      <n-tab-pane name="model" tab="模型">
        <div class="model-grid">
          <div class="providers">
            <div class="sec-title">模型服务</div>
            <button
              v-for="p in PROVIDERS"
              :key="p.id"
              class="provider"
              :class="{ active: provider === p.id }"
              @click="pick(p)"
            >
              <span class="dot" :class="{ ok: provider === p.id && hasKey }" />
              <span class="p-text">
                <span class="p-name">{{ p.label }}</span>
                <span class="p-desc">{{ p.desc }}</span>
              </span>
            </button>
            <p class="tip">切换服务商会重置地址与模型名，已保存的密钥不会丢。</p>
          </div>

          <n-card size="small" class="panel-card">
            <div class="field">
              <label>Base URL</label>
              <n-input v-model:value="baseUrl" placeholder="https://api.openai.com/v1" />
            </div>

            <div class="field">
              <label>模型</label>
              <n-select
                v-model:value="model"
                :options="modelOptions"
                filterable
                tag
                placeholder="选择或直接输入模型名"
              />
            </div>

            <div class="field">
              <label>
                API Key
                <span v-if="hasKey" class="ok-text">已保存</span>
              </label>
              <n-input
                v-model:value="apiKey"
                type="password"
                show-password-on="click"
                :placeholder="hasKey ? '已保存，留空则不修改' : 'sk-…'"
              />
            </div>

            <div class="actions">
              <n-button size="small" quaternary :loading="busy" @click="testLlm">测试连通</n-button>
              <span class="grow" />
              <n-tag size="small" :bordered="false" :type="hasKey ? 'success' : 'default'">
                {{ hasKey ? '已配置' : '未配置' }}
              </n-tag>
              <n-button size="small" type="primary" :loading="busy" @click="saveLlm">保存</n-button>
            </div>

            <p class="tip line">
              密钥用系统 DPAPI 加密后存在本机配置里，不写进项目目录，也不进版本库。
            </p>
          </n-card>
        </div>
      </n-tab-pane>

      <n-tab-pane name="data" tab="数据">
        <n-card size="small" title="数据目录" class="data-card">
          <p class="tip">台账、索引和设置都放在这里。换位置只是换个读写目标，旧目录不会自动搬走或清理。</p>

          <div class="dirbox">
            <span class="dir mono" :title="currentDir">{{ currentDir || '仅桌面端可用' }}</span>
            <n-tag size="small" :bordered="false" :type="isDefaultDir ? 'default' : 'info'">
              {{ isDefaultDir ? '默认位置' : '自定义' }}
            </n-tag>
          </div>

          <div class="actions">
            <n-button size="small" @click="openDir">打开目录</n-button>
            <n-button size="small" @click="chooseDir">更改位置…</n-button>
            <n-button size="small" quaternary :disabled="isDefaultDir" @click="resetDir">
              恢复默认
            </n-button>
          </div>

          <div class="note">
            <p class="tip">
              {{ inDev ? '开发模式下默认放在项目同级目录，方便随时翻看。' : '安装后默认放在程序安装目录下的 data。' }}
            </p>
            <p class="tip">
              默认位置：<span class="mono">{{ defaultLocation ?? '—' }}</span>
            </p>
          </div>
        </n-card>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<style scoped>
.model-grid {
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr);
  gap: 14px;
  margin-top: 4px;
}

@media (max-width: 1080px) {
  .model-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.providers {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sec-title {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 2px;
}

.provider {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: border-color 0.15s, background 0.15s;
}

.provider:hover {
  border-color: var(--line-strong);
  background: var(--panel-2);
}

.provider.active {
  border-color: var(--nav-active-border);
  background: var(--nav-active-bg);
}

.dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--line-strong);
  transition: background 0.15s;
}

.dot.ok {
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(15, 159, 110, 0.14);
}

.p-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.35;
}

.p-name {
  font-size: 13px;
  font-weight: 550;
  color: var(--text);
}

.p-desc {
  font-size: 11px;
  color: var(--text-3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.field label {
  font-size: 12px;
  color: var(--text-2);
}

.ok-text {
  margin-left: 6px;
  font-size: 11px;
  color: var(--accent);
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.tip {
  margin: 10px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-3);
}

.tip.line {
  padding-top: 10px;
  border-top: 1px solid var(--line-soft);
}

.dirbox {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  margin: 12px 0 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-2);
}

.dir {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: 12px;
}

.data-card {
  max-width: 760px;
}

.note {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line-soft);
}

.note .tip {
  margin: 0 0 4px;
}

.note .tip:last-child {
  margin-bottom: 0;
}
</style>