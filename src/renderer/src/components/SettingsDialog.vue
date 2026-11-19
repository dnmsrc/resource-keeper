<script setup lang="ts">
/**
 * 设置弹窗。
 *
 * 居中弹在窗口上层（带遮罩），不铺满窗口 —— 背后的界面还看得见，
 * 点遮罩空白处 / 右上角 ✕ / Esc 都能退出来。
 * 分节不放左侧竖排菜单，收成标题旁的图标切换。
 * 模型分节里「编辑」是行内展开的一整块面板，不是再弹一层小窗 ——
 * 一张面板里同时能改名称/地址/协议/密钥/模型目录，改完保存才落盘。
 *
 * 数据全都走主进程：密钥只回 hasKey，明文留在主进程内存里。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { NButton, NDropdown, NInput, NPopconfirm, NSelect, useMessage } from 'naive-ui'
import { ChevronDownOutline, ChevronForwardOutline, CloseOutline, CubeOutline, SettingsOutline } from '@vicons/ionicons5'
import type {
  ModelEntry,
  PresetDef,
  ProtocolDef,
  ProtocolId,
  ProviderPublic,
  ProvidersState
} from '../../../preload/index'
import { appInfo, refreshAppInfo } from '../lib/appInfo'
import { closeSettings, settings, type SettingsSection } from '../lib/settingsStore'

const message = useMessage()

const sections: { id: SettingsSection; label: string; icon: Component }[] = [
  { id: 'general', label: '通用设置', icon: SettingsOutline },
  { id: 'model', label: '模型', icon: CubeOutline }
]

// ---- 列表与元数据 ----
const state = ref<ProvidersState>({ activeId: '', providers: [] })
const presets = ref<PresetDef[]>([])
const protocols = ref<ProtocolDef[]>([])
const configFilePath = ref('')

const protocolOptions = computed(() =>
  protocols.value.map((p) => ({
    label: p.available ? p.label : `${p.label}（尚未接入）`,
    value: p.id,
    disabled: !p.available
  }))
)

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

async function loadMeta(): Promise<void> {
  try {
    const [p, pr, path] = await Promise.all([
      window.api.config.llm.presets(),
      window.api.config.llm.protocols(),
      window.api.config.path()
    ])
    presets.value = p
    protocols.value = pr
    configFilePath.value = path
  } catch {
    presets.value = []
    protocols.value = []
    configFilePath.value = ''
  }
}

// ---- 切换当前使用的提供商 ----
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
    if (created) openEdit(created)
    else message.info('这个提供商已经在列表里了')
  } catch (e) {
    message.error(`添加失败：${(e as Error).message}`)
  }
}

async function remove(p: ProviderPublic): Promise<void> {
  try {
    state.value = await window.api.config.llm.remove(p.id)
    if (editingId.value === p.id) editingId.value = null
    message.success(`已删除 ${p.label}`)
  } catch (e) {
    message.error(`删除失败：${(e as Error).message}`)
  }
}

// ---- 行内编辑面板 ----
interface EditForm {
  id: string
  label: string
  baseUrl: string
  protocol: string
  model: string
  models: ModelEntry[]
  apiKey: string
  hasKey: boolean
}

const editingId = ref<string | null>(null)
const advanced = ref(true)
const saving = ref(false)
const fetching = ref(false)
const testing = ref(false)

const form = ref<EditForm>({
  id: '',
  label: '',
  baseUrl: '',
  protocol: 'openai',
  model: '',
  models: [],
  apiKey: '',
  hasKey: false
})

function openEdit(p: ProviderPublic): void {
  editingId.value = p.id
  form.value = {
    id: p.id,
    label: p.label,
    baseUrl: p.baseUrl,
    protocol: p.protocol,
    model: p.model,
    // 深拷贝：取消时不留下改动
    models: p.models.map((m) => ({ ...m })),
    apiKey: '',
    hasKey: p.hasKey
  }
  advanced.value = true
}

function toggleEdit(p: ProviderPublic): void {
  if (editingId.value === p.id) editingId.value = null
  else openEdit(p)
}

function cancelEdit(): void {
  editingId.value = null
}

async function save(): Promise<void> {
  const id = editingId.value
  if (!id || saving.value) return
  saving.value = true
  try {
    state.value = await window.api.config.llm.update(id, {
      label: form.value.label,
      baseUrl: form.value.baseUrl,
      protocol: form.value.protocol as ProtocolId,
      model: form.value.model,
      // 先摊平成普通对象：Vue 的 reactive 是 Proxy，结构化克隆送不过 IPC
      models: form.value.models
        .map((m) => ({ id: m.id.trim(), ...(m.note?.trim() ? { note: m.note.trim() } : {}) }))
        .filter((m) => m.id),
      // 留空表示保留磁盘上已加密的那一份
      ...(form.value.apiKey.trim() ? { apiKey: form.value.apiKey.trim() } : {})
    })
    editingId.value = null
    message.success('已保存')
  } catch (e) {
    message.error(`保存失败：${(e as Error).message}`)
  } finally {
    saving.value = false
  }
}

async function testFromForm(): Promise<void> {
  if (testing.value) return
  testing.value = true
  try {
    const r = await window.api.llm.test({
      ...(form.value.id ? { id: form.value.id } : {}),
      baseUrl: form.value.baseUrl,
      model: form.value.model,
      protocol: form.value.protocol as ProtocolId,
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

// ---- 模型目录 ----
const defaultModel = computed(() => presets.value.find((p) => p.id === form.value.id)?.model ?? '')

function addModel(): void {
  form.value.models.push({ id: '', note: '' })
}

function removeModel(index: number): void {
  const removed = form.value.models[index]
  form.value.models.splice(index, 1)
  // 删掉的正好是当前模型：把当前模型顺位交给下一条
  if (removed && removed.id && removed.id === form.value.model) {
    form.value.model = form.value.models[0]?.id ?? ''
  }
}

function setCurrentModel(m: ModelEntry): void {
  if (!m.id.trim()) {
    message.warning('先填模型 ID')
    return
  }
  form.value.model = m.id
}

function restoreDefaultModel(): void {
  const d = defaultModel.value
  if (!d) return
  if (!form.value.models.some((m) => m.id === d)) form.value.models.unshift({ id: d })
  form.value.model = d
  message.success(`已换回默认模型 ${d}`)
}

async function fetchModels(): Promise<void> {
  if (fetching.value) return
  fetching.value = true
  try {
    // 传当前输入值：不用先保存也能拉一次
    const r = await window.api.config.llm.models({
      ...(form.value.id ? { id: form.value.id } : {}),
      baseUrl: form.value.baseUrl,
      ...(form.value.apiKey.trim() ? { apiKey: form.value.apiKey.trim() } : {})
    })
    if (!r.ok) {
      message.error(r.message)
      return
    }
    const have = new Set(form.value.models.map((m) => m.id))
    let added = 0
    for (const id of r.models) {
      if (have.has(id)) continue
      form.value.models.push({ id })
      added++
    }
    if (!form.value.model && form.value.models[0]) form.value.model = form.value.models[0].id
    message.success(added ? `已补进 ${added} 个模型` : '清单里的模型都在目录里了')
  } catch (e) {
    message.error(`获取失败：${(e as Error).message}`)
  } finally {
    fetching.value = false
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

async function revealConfig(): Promise<void> {
  try {
    const err = await window.api.config.reveal()
    if (err) message.error(`打不开配置文件：${err}`)
  } catch (e) {
    message.error(`打不开配置文件：${(e as Error).message}`)
  }
}

// ---- 关闭 ----
function close(): void {
  editingId.value = null
  closeSettings()
}

function onKeydown(e: KeyboardEvent): void {
  if (!settings.open) return
  if (e.key !== 'Escape') return
  // 编辑中按 Esc 先收起编辑面板，再按一次才关弹窗
  if (editingId.value) editingId.value = null
  else close()
}

// 每次打开都重新拉一遍：数据可能在别处（主进程 / 磁盘）被改过
watch(
  () => settings.open,
  (open) => {
    if (!open) return
    editingId.value = null
    void reload()
    void loadMeta()
    void refreshAppInfo()
  }
)

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="dlg">
      <div v-if="settings.open" class="mask" @click.self="close">
        <div class="dialog">
          <header class="dlg-head">
            <h1 class="dlg-title">设置</h1>
            <div class="tabs" role="tablist">
              <button
                v-for="s in sections"
                :key="s.id"
                class="tab"
                :class="{ on: settings.section === s.id }"
                role="tab"
                :aria-selected="settings.section === s.id"
                :title="s.label"
                :aria-label="s.label"
                @click="settings.section = s.id"
              >
                <component :is="s.icon" />
              </button>
            </div>
            <div class="head-ops">
              <button class="ghost-btn" @click="revealConfig">打开配置文件</button>
              <button class="icon-btn" title="关闭（Esc）" @click="close">
                <CloseOutline />
              </button>
            </div>
          </header>

          <div class="dlg-main">
              <!-- ============ 模型 ============ -->
              <section v-if="settings.section === 'model'" class="sec">
                <h2 class="sec-title">模型</h2>
                <p class="sec-sub">填入各提供商的 API 密钥即可使用其模型。</p>

                <div class="plist">
                  <div
                    v-for="p in state.providers"
                    :key="p.id"
                    class="prow"
                    :class="{ current: p.id === state.activeId, editing: editingId === p.id }"
                  >
                    <div class="prow-head">
                      <button
                        class="pname"
                        :title="p.id === state.activeId ? '当前使用的模型服务' : '设为当前使用的模型服务'"
                        @click="activate(p)"
                      >
                        {{ p.label }}
                      </button>
                      <span v-if="!p.preset" class="tag">自定义</span>
                      <span v-if="p.id === state.activeId" class="tag cur">使用中</span>
                      <span
                        class="dot"
                        :class="{ ok: p.hasKey }"
                        :title="p.hasKey ? '已配置密钥' : '还没配置密钥'"
                      />

                      <div class="prow-ops">
                        <button class="line-btn" @click="toggleEdit(p)">
                          {{ editingId === p.id ? '收起' : '编辑' }}
                        </button>
                        <n-popconfirm v-if="!p.preset" @positive-click="remove(p)">
                          <template #trigger>
                            <button class="line-btn danger">删除</button>
                          </template>
                          删除「{{ p.label }}」？已保存的密钥会一起删掉。
                        </n-popconfirm>
                      </div>
                    </div>

                    <!-- 行内编辑面板 -->
                    <div v-if="editingId === p.id" class="epanel">
                      <div class="epanel-head">
                        <span class="epanel-name">{{ form.label || p.label }}</span>
                        <span class="epanel-id">{{ form.id }}</span>
                      </div>

                      <div class="field">
                        <label class="flabel">
                          API 密钥
                          <span
                            class="q"
                            title="密钥只存在本机配置文件里，用系统加密；界面上不回显明文"
                            >?</span
                          >
                        </label>
                        <n-input
                          v-model:value="form.apiKey"
                          type="password"
                          show-password-on="click"
                          :placeholder="form.hasKey ? '留空使用已保存凭据' : 'sk-…'"
                        />
                        <p v-if="form.hasKey" class="field-tip">已保存过密钥，留空即不修改。</p>
                      </div>

                      <button class="fold" @click="advanced = !advanced">
                        <span class="caret">
                          <ChevronDownOutline v-if="advanced" />
                          <ChevronForwardOutline v-else />
                        </span>
                        自定义设置
                      </button>

                      <div v-if="advanced" class="fields">
                        <div class="field">
                          <label class="flabel">显示名称</label>
                          <n-input v-model:value="form.label" placeholder="随便起个好认的名字" />
                        </div>
                        <div class="field">
                          <label class="flabel">API 地址</label>
                          <n-input v-model:value="form.baseUrl" placeholder="https://…/v1" />
                        </div>
                        <div class="field">
                          <label class="flabel">API 协议</label>
                          <n-select v-model:value="form.protocol" :options="protocolOptions" />
                        </div>
                      </div>

                      <div class="mgroup">
                        <div class="mgroup-head">
                          <span class="flabel">模型目录</span>
                          <div class="mgroup-links">
                            <button class="link" :disabled="!defaultModel" @click="restoreDefaultModel">
                              恢复默认模型
                            </button>
                            <button class="link" :disabled="fetching" @click="fetchModels">
                              {{ fetching ? '获取中…' : '获取可用模型' }}
                            </button>
                          </div>
                        </div>
                        <p class="mgroup-sub">已自定义模型目录（{{ form.models.length }} 个模型）</p>

                        <div v-for="(m, i) in form.models" :key="i" class="mrow">
                          <n-input v-model:value="m.id" placeholder="模型 ID" class="m-id" />
                          <n-input v-model:value="m.note" placeholder="备注（如 2折）" class="m-note" />
                          <button
                            class="pick"
                            :class="{ on: form.model === m.id }"
                            title="设为当前使用的模型"
                            @click="setCurrentModel(m)"
                          >
                            →
                          </button>
                          <button class="row-del" title="删除这个模型" @click="removeModel(i)">✕</button>
                        </div>
                        <p v-if="!form.models.length" class="mempty">
                          还没有模型。点「添加模型」手填，或让它按 API 自己拉一次。
                        </p>

                        <button class="add-model" @click="addModel">＋ 添加模型</button>
                      </div>

                      <div class="epanel-foot">
                        <n-button size="small" quaternary :loading="testing" @click="testFromForm">
                          测试连通
                        </n-button>
                        <span class="grow" />
                        <button class="btn ghost" @click="cancelEdit">取消</button>
                        <button class="btn solid" :disabled="saving" @click="save">保存</button>
                      </div>
                    </div>
                  </div>

                  <n-dropdown
                    trigger="click"
                    placement="bottom-start"
                    :options="addOptions"
                    @select="addOne"
                  >
                    <button class="add-provider">＋ 添加模型提供商</button>
                  </n-dropdown>

                  <p v-if="!state.providers.length" class="mempty">
                    列表还是空的。点上面「添加模型提供商」接一家，再填密钥。
                  </p>
                </div>

                <p class="foot-note">
                  密钥用系统 DPAPI 加密后写在本机配置文件里，不进项目目录、不进版本库。
                  <br />
                  配置文件：<span class="mono">{{ configFilePath || '（读不到路径）' }}</span>
                </p>
              </section>

              <!-- ============ 通用设置 ============ -->
              <section v-else class="sec">
                <h2 class="sec-title">通用设置</h2>
                <p class="sec-sub">台账、索引和设置都存在数据目录里。</p>

                <div class="panel-card">
                  <div class="card-title">数据目录</div>
                  <p class="field-tip">换位置只是换个读写目标，旧目录不会自动搬走或清理。</p>

                  <div class="dirbox">
                    <span class="dir mono" :title="currentDir">{{ currentDir || '仅桌面端可用' }}</span>
                    <span class="tag" :class="{ cur: !isDefaultDir }">
                      {{ isDefaultDir ? '默认位置' : '自定义' }}
                    </span>
                  </div>

                  <div class="actions">
                    <n-button size="small" @click="openDir">打开目录</n-button>
                    <n-button size="small" @click="chooseDir">更改位置…</n-button>
                    <n-button size="small" quaternary :disabled="isDefaultDir" @click="resetDir">
                      恢复默认
                    </n-button>
                  </div>

                  <p class="field-tip note">
                    {{
                      inDev
                        ? '开发模式下默认放在项目同级目录，方便随时翻看。'
                        : '安装后默认放在程序安装目录下的 data。'
                    }}
                    <br />
                    默认位置：<span class="mono">{{ defaultLocation }}</span>
                  </p>
                </div>
              </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  /* 点遮罩空白处也能关：编辑面板里的点击不会冒泡到这里 */
  background: rgba(15, 20, 32, 0.32);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  /* 顶部让开标题栏和右上角窗口按钮，右侧同理，弹窗不压住它们 */
  padding: 58px 56px 60px;
}

.dialog {
  width: min(900px, 100%);
  /* 高度跟着内容走：列表态不空一大截，编辑展开到上限后在弹窗内滚动 */
  max-height: min(760px, 100%);
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: var(--shadow-2);
  overflow: hidden;
}

.dlg-head {
  flex: 0 0 auto;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 14px 0 22px;
  border-bottom: 1px solid var(--line-soft);
}

.dlg-title {
  margin: 0;
  font-size: 16.5px;
  font-weight: 650;
  letter-spacing: 0.2px;
}

/* 分节切换：只留图标，悬停/选中给反馈 */
.tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  background: var(--panel-2);
}

.tab {
  width: 30px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.tab :deep(svg) {
  width: 17px;
  height: 17px;
}

.tab:hover {
  color: var(--text);
  background: var(--hover-2);
}

.tab.on {
  background: var(--panel);
  color: var(--accent);
  box-shadow: var(--shadow-1);
}

.head-ops {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.ghost-btn {
  height: 32px;
  padding: 0 13px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.ghost-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.icon-btn {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.icon-btn :deep(svg) {
  width: 19px;
  height: 19px;
}

.icon-btn:hover {
  background: var(--hover-2);
  color: var(--text);
}

.dlg-main {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  padding: 22px 28px 18px;
}

.sec {
  max-width: 860px;
}

.sec-title {
  margin: 2px 0 6px;
  font-size: 16px;
  font-weight: 650;
}

.sec-sub {
  margin: 0 0 18px;
  font-size: 12.5px;
  color: var(--text-3);
}

/* ---- 提供商列表 ---- */
.plist {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.prow {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.prow.current {
  border-color: var(--nav-active-border);
}

.prow.editing {
  border-color: var(--line-strong);
  box-shadow: var(--shadow-1);
}

.prow-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 13px 12px 15px;
}

.pname {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  transition: color 0.15s;
}

.pname:hover {
  color: var(--accent);
}

.tag {
  flex: 0 0 auto;
  font-size: 10.5px;
  line-height: 1.6;
  padding: 0 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--text-3);
  background: var(--hover);
}

.tag.cur {
  color: var(--accent);
  border-color: var(--nav-active-border);
  background: transparent;
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

.prow-ops {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
}

.line-btn {
  height: 28px;
  padding: 0 11px;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  background: var(--panel);
  color: var(--text-2);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.line-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* 删除是破坏性动作，留纯文字红：有框按钮会让人以为随时能点 */
.line-btn.danger {
  height: auto;
  padding: 2px 1px;
  border: 0;
  background: none;
  color: var(--danger);
}

.line-btn.danger:hover {
  text-decoration: underline;
}

/* ---- 行内编辑面板 ---- */
.epanel {
  margin: 0 12px 12px;
  padding: 16px 18px 14px;
  border-radius: 10px;
  background: var(--panel-3);
}

.epanel-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 14px;
}

.epanel-name {
  font-size: 14px;
  font-weight: 650;
}

.epanel-id {
  font-size: 11.5px;
  color: var(--text-3);
  font-family: var(--font-mono);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.flabel {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-2);
}

.q {
  width: 14px;
  height: 14px;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  font-size: 9.5px;
  color: var(--text-3);
  cursor: help;
}

.field-tip {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--text-3);
}

.fold {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 2px 0 12px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-2);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.caret {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  color: var(--text-3);
}

.caret :deep(svg) {
  width: 14px;
  height: 14px;
}

.fields {
  padding-bottom: 4px;
}

/* ---- 模型目录 ---- */
.mgroup {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.mgroup-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mgroup-links {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
}

.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-3);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s;
}

.link:hover:not(:disabled) {
  color: var(--accent);
  text-decoration: underline;
}

.link:disabled {
  color: var(--text-3);
  cursor: default;
}

.mgroup-sub {
  margin: 3px 0 9px;
  font-size: 11.5px;
  color: var(--text-3);
}

.mrow {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) 30px 30px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.pick,
.row-del {
  height: 30px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--panel);
  color: var(--text-3);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.pick:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* 当前模型：同一个入口，选中态直接变色，不用额外说明文字 */
.pick.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-deep);
  font-weight: 700;
}

.row-del:hover {
  border-color: rgba(220, 38, 38, 0.4);
  color: var(--danger);
}

.add-model {
  margin-top: 2px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  background: var(--panel);
  color: var(--text-2);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.add-model:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.mempty {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-3);
}

.epanel-foot {
  /* 面板比弹窗高时要滚动，保存按钮得一直够得着 */
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px -18px -14px;
  padding: 13px 18px 14px;
  border-top: 1px solid var(--line);
  border-radius: 0 0 10px 10px;
  background: var(--panel-3);
}

.grow {
  flex: 1;
}

.btn {
  height: 31px;
  padding: 0 15px;
  border-radius: 8px;
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.btn.ghost {
  border: 1px solid var(--line-strong);
  background: var(--panel);
  color: var(--text-2);
}

.btn.ghost:hover {
  border-color: var(--text-2);
  color: var(--text);
}

/* 参照形态里保存是深色实心，和品牌紫分开：一次性动作，不需要抢品牌色 */
.btn.solid {
  border: 1px solid var(--text);
  background: var(--text);
  color: #fff;
  font-weight: 600;
}

.btn.solid:hover {
  background: #0f141f;
}

.btn.solid:disabled {
  opacity: 0.55;
  cursor: default;
}

.add-provider {
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--line-strong);
  border-radius: 12px;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.add-provider:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--hover);
}

.foot-note {
  margin: 18px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
  font-size: 11.5px;
  line-height: 1.75;
  color: var(--text-3);
}

.mono {
  font-family: var(--font-mono);
  font-size: 11px;
  word-break: break-all;
}

/* ---- 通用设置 ---- */
.panel-card {
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
}

.card-title {
  margin-bottom: 6px;
  font-size: 13.5px;
  font-weight: 650;
}

.dirbox {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  margin: 12px 0 10px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--panel-2);
}

.dir {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-tip.note {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line-soft);
}

/* ---- 进出场 ---- */
.dlg-enter-active,
.dlg-leave-active {
  transition: opacity 0.16s ease;
}

.dlg-enter-active .dialog,
.dlg-leave-active .dialog {
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}

.dlg-enter-from,
.dlg-leave-to {
  opacity: 0;
}

.dlg-enter-from .dialog,
.dlg-leave-to .dialog {
  transform: translateY(6px) scale(0.995);
}
</style>

