<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  NButton,
  NCard,
  NDropdown,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NTabPane,
  NTabs,
  useMessage
} from 'naive-ui'
import { appInfo, refreshAppInfo } from '../lib/appInfo'
import type { PresetDef, ProviderPublic, ProvidersState } from '../../../preload/index'

const message = useMessage()

/**
 * 常见模型名，只当下拉候选。
 * 这里不校验：模型名由服务商决定，写死了以后新模型出来就用不了，
 * 所以下拉可筛选、也可直接敲任意名字。
 */
const MODEL_HINTS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o4-mini'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  qwen: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long'],
  ollama: ['qwen2.5:7b', 'qwen2.5:14b', 'llama3.1:8b']
}

const tab = ref('model')

// ---- 模型服务列表 ----
const state = ref<ProvidersState>({ activeId: '', providers: [] })
const presets = ref<PresetDef[]>([])

const addOptions = computed(() => {
  const used = new Set(state.value.providers.map((p) => p.id))
  const opts = presets.value
    .filter((p) => !used.has(p.id))
    .map((p) => ({ label: `${p.label} · ${p.desc}`, key: p.id }))
  opts.push({ label: '自定义提供商…', key: '__custom' })
  return opts
})

async function reload(): Promise<void> {
  try {
    state.value = await window.api.config.llm.list()
  } catch {
    /* 没有 preload（静态预览）时留空 */
  }
}

async function loadPresets(): Promise<void> {
  try {
    presets.value = await window.api.config.llm.presets()
  } catch {
    presets.value = []
  }
}

async function activate(p: ProviderPublic): Promise<void> {
  if (p.id === state.value.activeId) return
  try {
    state.value = await window.api.config.llm.setActive(p.id)
  } catch (e) {
    message.error(`切换失败：${(e as Error).message}`)
  }
}

async function addOne(key: string | number): Promise<void> {
  const before = new Set(state.value.providers.map((p) => p.id))
  try {
    state.value = await window.api.config.llm.add(
      key === '__custom' ? { label: '自定义提供商' } : { presetId: String(key) }
    )
    const created = state.value.providers.find((p) => !before.has(p.id))
    // 新建完直接把编辑框拉起来，省一次点击
    if (created) openEdit(created)
    else message.info('这个提供商已经在列表里了')
  } catch (e) {
    message.error(`添加失败：${(e as Error).message}`)
  }
}

async function remove(p: ProviderPublic): Promise<void> {
  try {
    state.value = await window.api.config.llm.remove(p.id)
    message.success(`已删除 ${p.label}`)
  } catch (e) {
    message.error(`删除失败：${(e as Error).message}`)
  }
}

// ---- 编辑弹窗 ----
const showEdit = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const testing = ref(false)
const form = ref({ label: '', baseUrl: '', model: '', apiKey: '', hasKey: false })

const modelOptions = computed(() =>
  (MODEL_HINTS[editingId.value ?? ''] ?? []).map((m) => ({ label: m, value: m }))
)

function openEdit(p: ProviderPublic): void {
  editingId.value = p.id
  form.value = {
    label: p.label,
    baseUrl: p.baseUrl,
    model: p.model,
    apiKey: '',
    hasKey: p.hasKey
  }
  showEdit.value = true
}

async function save(): Promise<void> {
  if (!editingId.value || saving.value) return
  saving.value = true
  try {
    state.value = await window.api.config.llm.update(editingId.value, {
      label: form.value.label,
      baseUrl: form.value.baseUrl,
      model: form.value.model,
      // 留空表示保留磁盘上已加密的那一份
      ...(form.value.apiKey.trim() ? { apiKey: form.value.apiKey.trim() } : {})
    })
    showEdit.value = false
    message.success('已保存')
  } catch (e) {
    message.error(`保存失败：${(e as Error).message}`)
  } finally {
    saving.value = false
  }
}

async function test(): Promise<void> {
  if (testing.value) return
  testing.value = true
  try {
    // 传当前输入值：不用先保存也能试连一次
    const r = await window.api.llm.test({
      ...(editingId.value ? { id: editingId.value } : {}),
      baseUrl: form.value.baseUrl,
      model: form.value.model,
      ...(form.value.apiKey.trim() ? { apiKey: form.value.apiKey.trim() } : {})
    })
    if (r.ok) message.success(r.message)
    else message.error(r.message)
  } catch (e) {
    message.error(`测试失败：${(e as Error).message}`)
  } finally {
    testing.value = false
  }
}

// ---- 数据目录 ----
const currentDir = computed(() => appInfo.dataDir ?? '')
const isDefaultDir = computed(() => appInfo.dataDirDefault ?? true)
const inDev = computed(() => appInfo.dev ?? false)
const defaultLocation = computed(() => appInfo.defaultDataDir ?? '—')

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
  await Promise.all([reload(), loadPresets()])
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
        <div class="model-wrap">
          <div class="sec-head">
            <h2 class="sec-title">模型</h2>
            <p class="sec-sub">填入各提供商的 API 密钥即可使用其模型。</p>
          </div>

          <div class="plist">
            <div
              v-for="p in state.providers"
              :key="p.id"
              class="prow"
              :class="{ active: p.id === state.activeId }"
            >
              <button
                class="pname"
                :title="p.id === state.activeId ? '当前使用的模型服务' : '设为当前使用的模型服务'"
                @click="activate(p)"
              >
                {{ p.label }}
              </button>
              <span v-if="!p.preset" class="badge">自定义</span>
              <span v-if="p.id === state.activeId" class="badge cur">使用中</span>
              <span
                class="dot"
                :class="{ ok: p.hasKey }"
                :title="p.hasKey ? '已配置密钥' : '还没配置密钥'"
              />

              <div class="prow-actions">
                <n-button size="small" class="edit-btn" @click="openEdit(p)">编辑</n-button>
                <n-popconfirm @positive-click="remove(p)">
                  <template #trigger>
                    <n-button size="small" text type="error">删除</n-button>
                  </template>
                  删除「{{ p.label }}」？已保存的密钥会一起删掉。
                </n-popconfirm>
              </div>
            </div>

            <n-dropdown trigger="click" placement="bottom-start" :options="addOptions" @select="addOne">
              <button class="add-btn">
                <span class="plus">＋</span>
                <span>添加模型提供商</span>
              </button>
            </n-dropdown>

            <p v-if="!state.providers.length" class="tip">
              列表还是空的。点上面「添加模型提供商」接一家，再填密钥。
            </p>
          </div>

          <p class="tip line">
            密钥用系统 DPAPI 加密后存在本机配置里，不写进项目目录，也不进版本库。
          </p>
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

    <n-modal
      v-model:show="showEdit"
      preset="card"
      :title="`编辑 ${form.label || '模型服务'}`"
      :bordered="false"
      class="edit-modal"
      style="width: 540px"
    >
      <div class="field">
        <label>名称</label>
        <n-input v-model:value="form.label" placeholder="OpenAI" />
      </div>

      <div class="field">
        <label>Base URL</label>
        <n-input v-model:value="form.baseUrl" placeholder="https://api.openai.com/v1" />
      </div>

      <div class="field">
        <label>模型</label>
        <n-select
          v-model:value="form.model"
          :options="modelOptions"
          filterable
          tag
          placeholder="选择或直接输入模型名"
        />
      </div>

      <div class="field">
        <label>
          API Key
          <span v-if="form.hasKey" class="ok-text">已保存</span>
        </label>
        <n-input
          v-model:value="form.apiKey"
          type="password"
          show-password-on="click"
          :placeholder="form.hasKey ? '已保存，留空则不修改' : 'sk-…'"
        />
      </div>

      <p class="tip">本地端点（如 Ollama）可以不填 Key；远端服务必须填。</p>

      <template #footer>
        <div class="modal-foot">
          <n-button size="small" quaternary :loading="testing" @click="test">测试连通</n-button>
          <span class="grow" />
          <n-button size="small" @click="showEdit = false">取消</n-button>
          <n-button size="small" type="primary" :loading="saving" @click="save">保存</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.model-wrap {
  max-width: 780px;
}

.sec-head {
  margin: 4px 0 14px;
}

.sec-title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: 0.2px;
}

.sec-sub {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-3);
}

.plist {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prow {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 14px 13px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
  transition: border-color 0.15s, background 0.15s;
}

/* Naive 的默认按钮边框太浅，白卡上基本看不见，按参考形态压深一点 */
.edit-btn {
  --n-border: 1px solid var(--line-strong) !important;
  --n-border-hover: 1px solid var(--accent) !important;
  --n-border-focus: 1px solid var(--accent) !important;
  --n-text-color: var(--text-2) !important;
}

.prow:hover {
  border-color: var(--line-strong);
}

.prow.active {
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

.pname {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  transition: color 0.15s;
}

.pname:hover {
  color: var(--accent);
}

.badge {
  font-size: 10.5px;
  line-height: 1.5;
  padding: 1px 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--text-3);
  background: var(--hover);
}

.badge.cur {
  color: var(--accent);
  border-color: var(--nav-active-border);
  background: transparent;
}

.prow-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.add-btn {
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px dashed var(--line-strong);
  border-radius: 12px;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.add-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--hover);
}

.plus {
  font-size: 15px;
  line-height: 1;
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
  padding-top: 12px;
  margin-top: 14px;
  border-top: 1px solid var(--line-soft);
}

.modal-foot {
  display: flex;
  align-items: center;
  gap: 8px;
}

.grow {
  flex: 1;
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