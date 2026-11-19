/**
 * 本机配置：模型服务列表 + 数据目录。
 *
 * 存哪儿：优先 userData/config.json（Windows 上是 %APPDATA%\resource-keeper）；
 * 该目录不可写时自动退到数据目录下的 config.json（见 configFile）。
 * 两个位置都不在项目源码里，所以天然进不了版本库。
 * API Key 额外用 safeStorage（Windows 底下是 DPAPI）加密后写成 apiKeyEnc，
 * 文件被拷到别的机器/别的账号上解不开。
 *
 * 模型配置存成「列表 + 当前选中」：多接几家、随时切，比只存一条灵活。
 * 每条下面还有一层「模型目录」——同一个端点往往能点出好几个模型（含带折扣的
 * 同名变体），所以 model 记的是当前用哪个，models 记的是都能用哪些。
 * 旧版本存的是单条（llm.provider/baseUrl/model/apiKeyEnc），读到会自动迁移。
 */
import { app, safeStorage } from 'electron'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_PROTOCOL, isProtocolId, PROTOCOLS, type ProtocolDef, type ProtocolId } from './protocols'

/** 内置预设：新装时直接列出来，用户只差填一个 key */
export interface PresetDef {
  id: string
  label: string
  desc: string
  baseUrl: string
  model: string
}

export const PRESETS: PresetDef[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    desc: 'api.openai.com',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini'
  }
]

/**
 * 早期版本内置过、现在不再提供的预设。
 * 配置里读到这些 id 就直接丢掉 —— 预设删了但旧配置还留着，界面会冒出一串用不上的条目。
 * 只删「本来就是内置默认值」的那些条目，用户自己改过的 key/地址不做还原。
 */
const RETIRED_PRESET_IDS = new Set(['deepseek', 'qwen', 'ollama'])

/** 模型目录里的一条：id 发给服务端，note 只给人看（比如「2折」） */
export interface ModelEntry {
  id: string
  note?: string
}

/** 主进程内部形态：带明文密钥，只在进程里出现 */
export interface ProviderConfig {
  id: string
  label: string
  baseUrl: string
  protocol: ProtocolId
  /** 当前使用的模型，必须出现在 models 里 */
  model: string
  /** 这个端点能用的模型清单 */
  models: ModelEntry[]
  apiKey: string
  /** 是不是内置预设（界面上用它决定要不要挂「自定义」徽章、能不能删） */
  preset: boolean
}

/** 给渲染层的形态：不发明文，只说有没有 key */
export interface ProviderPublic {
  id: string
  label: string
  baseUrl: string
  protocol: ProtocolId
  model: string
  models: ModelEntry[]
  hasKey: boolean
  preset: boolean
}

export interface ProvidersState {
  activeId: string
  providers: ProviderPublic[]
}

export interface DataDirInfo {
  /** 实际生效的目录（绝对路径，直接给用户看） */
  path: string
  /** 是否用的是默认位置 */
  isDefault: boolean
  /** 默认位置不可写、退回 userData/data 时为 true */
  fallback: boolean
  /** 默认位置应该在哪，界面用它做提示 */
  defaultPath: string
}

interface StoredModel {
  id?: string
  note?: string
}

interface StoredProvider {
  id?: string
  label?: string
  baseUrl?: string
  protocol?: string
  model?: string
  models?: StoredModel[]
  apiKeyEnc?: string
  preset?: boolean
}

interface StoredConfig {
  llm?: {
    activeId?: string
    providers?: StoredProvider[]
    /** 旧版单条配置，读到就迁移 */
    provider?: string
    baseUrl?: string
    model?: string
    apiKeyEnc?: string
  }
  customDataDir?: string
}

let configFilePath: string | null = null

/**
 * 配置文件的落点。
 *
 * 首选 userData，但那台机器上可能有 ACL 问题导致整目录不可写（实测 EPERM，
 * 连 GPU 缓存都建不出来），所以写之前先探一下，不通就退到数据目录。
 * 注意这里用「默认数据目录」而不是当前生效目录：用户改了数据目录之后，
 * 配置还得能从原来的位置读出来，否则一改位置配置就丢了。
 */
function writable(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true })
    const probe = join(dir, '.write-probe')
    writeFileSync(probe, '')
    rmSync(probe, { force: true })
    return true
  } catch {
    return false
  }
}

function configFile(): string {
  if (configFilePath) return configFilePath

  const candidates = [
    join(app.getPath('userData'), 'config.json'),
    join(defaultDataDir(), 'config.json'),
    join(app.getPath('temp'), 'resource-keeper-config.json')
  ]
  for (const p of candidates) {
    if (writable(dirname(p))) {
      configFilePath = p
      return p
    }
  }
  configFilePath = candidates[candidates.length - 1]
  return configFilePath
}

function readStored(): StoredConfig {
  try {
    return JSON.parse(readFileSync(configFile(), 'utf-8')) as StoredConfig
  } catch {
    return {}
  }
}

function writeStored(cfg: StoredConfig): void {
  mkdirSync(dirname(configFile()), { recursive: true })
  writeFileSync(configFile(), JSON.stringify(cfg, null, 2), 'utf-8')
}

function encrypt(key: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(key).toString('base64')
  }
  // safeStorage 不可用（少见）时只能 base64，只防误看，不是加密
  return Buffer.from(key, 'utf-8').toString('base64')
}

function decrypt(enc: string): string {
  if (!safeStorage.isEncryptionAvailable()) return ''
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    // 换了 Windows 账号或换了机器，DPAPI 解不开：当作没配置
    return ''
  }
}

function defaultProviders(): StoredProvider[] {
  return PRESETS.map((p) => ({
    id: p.id,
    label: p.label,
    baseUrl: p.baseUrl,
    protocol: DEFAULT_PROTOCOL,
    model: p.model,
    models: [{ id: p.model }],
    preset: true
  }))
}

/** 把磁盘上的一条整理成模型目录：老配置只有单个 model，就补成一条 */
function normalizeModels(raw: StoredProvider): ModelEntry[] {
  const list = Array.isArray(raw.models)
    ? raw.models
        .map((m) => ({ id: (m?.id ?? '').trim(), ...(m?.note?.trim() ? { note: m.note.trim() } : {}) }))
        .filter((m) => m.id)
    : []
  if (list.length) return list
  const single = (raw.model ?? '').trim()
  return single ? [{ id: single }] : []
}

/**
 * 把磁盘上的配置整理成统一的 provider 列表。
 * needSave 表示这次读的时候补了东西（首次运行 / 旧格式），调用方负责落盘。
 */
function normalize(): { providers: ProviderConfig[]; activeId: string; needSave: boolean } {
  const llm = readStored().llm ?? {}
  let raw: StoredProvider[]
  let needSave = false

  if (Array.isArray(llm.providers) && llm.providers.length) {
    raw = llm.providers
  } else if (llm.provider || llm.baseUrl || llm.apiKeyEnc) {
    // 旧版单条配置：迁移成列表里的一条
    const preset = PRESETS.find((p) => p.id === llm.provider)
    raw = [
      {
        id: preset?.id ?? llm.provider ?? 'openai',
        label: preset?.label ?? llm.provider ?? 'OpenAI',
        baseUrl: llm.baseUrl ?? preset?.baseUrl ?? PRESETS[0].baseUrl,
        protocol: DEFAULT_PROTOCOL,
        model: llm.model ?? preset?.model ?? PRESETS[0].model,
        models: [{ id: llm.model ?? preset?.model ?? PRESETS[0].model }],
        apiKeyEnc: llm.apiKeyEnc,
        preset: !!preset
      }
    ]
    needSave = true
  } else {
    raw = defaultProviders()
    needSave = true
  }

  // 旧配置里还留着已下线的内置预设：直接清掉
  if (raw.some((p) => RETIRED_PRESET_IDS.has(p.id ?? ''))) {
    raw = raw.filter((p) => !RETIRED_PRESET_IDS.has(p.id ?? ''))
    needSave = true
  }

  const providers = raw.map((p) => {
    const models = normalizeModels(p)
    const declared = (p.model ?? '').trim()
    // 当前模型必须落在目录里：老配置里 model 可能只有一项，补进去
    if (declared && !models.some((m) => m.id === declared)) models.unshift({ id: declared })

    return {
      id: p.id ?? `custom-${Math.random().toString(36).slice(2, 8)}`,
      label: p.label ?? p.id ?? '未命名',
      baseUrl: p.baseUrl ?? '',
      protocol: isProtocolId(p.protocol) ? p.protocol : DEFAULT_PROTOCOL,
      model: declared || models[0]?.id || '',
      models,
      apiKey: p.apiKeyEnc ? decrypt(p.apiKeyEnc) : '',
      preset: !!p.preset
    }
  })

  const activeId =
    llm.activeId && providers.some((p) => p.id === llm.activeId)
      ? llm.activeId
      : (providers[0]?.id ?? '')

  return { providers, activeId, needSave }
}

function persist(providers: ProviderConfig[], activeId: string): void {
  const cfg = readStored()
  cfg.llm = {
    activeId,
    providers: providers.map((p) => ({
      id: p.id,
      label: p.label,
      baseUrl: p.baseUrl,
      protocol: p.protocol,
      model: p.model,
      models: p.models.map((m) => (m.note ? { id: m.id, note: m.note } : { id: m.id })),
      preset: p.preset,
      ...(p.apiKey ? { apiKeyEnc: encrypt(p.apiKey) } : {})
    }))
  }
  writeStored(cfg)
}

function loadProviders(): { providers: ProviderConfig[]; activeId: string } {
  const s = normalize()
  if (s.needSave) persist(s.providers, s.activeId)
  return { providers: s.providers, activeId: s.activeId }
}

function toPublic(p: ProviderConfig): ProviderPublic {
  return {
    id: p.id,
    label: p.label,
    baseUrl: p.baseUrl,
    protocol: p.protocol,
    model: p.model,
    models: p.models,
    hasKey: !!p.apiKey,
    preset: p.preset
  }
}

/** 界面读的入口：不含明文密钥 */
export function providersState(): ProvidersState {
  const { providers, activeId } = loadProviders()
  return { activeId, providers: providers.map(toPublic) }
}

/** 主进程内部用：按 id（缺省用当前选中）取一条含明文密钥的配置 */
export function resolveProvider(id?: string): ProviderConfig | null {
  const { providers, activeId } = loadProviders()
  const target = id ?? activeId
  return providers.find((p) => p.id === target) ?? null
}

export function presetList(): PresetDef[] {
  return PRESETS
}

export function protocolList(): ProtocolDef[] {
  return PROTOCOLS
}

/** 配置文件的绝对路径；「打开配置文件」按钮用它 */
export function configPath(): string {
  return configFile()
}

/**
 * 把配置落到磁盘并把文件建出来。
 * 只读路径（比如从没写过配置）时文件并不存在，资源管理器里定位不到，
 * 所以定位之前先确保它存在。
 */
export function ensureConfigFile(): string {
  const p = configFile()
  // 读出再写回：目录不存在、文件不存在两种情况都会在这里补齐
  writeStored(readStored())
  return p
}

/** 添加一条：给预设 id 就按预设初始化，否则建一条空白自定义 */
export function addProvider(input: { presetId?: string; label?: string }): ProvidersState {
  const { providers, activeId } = loadProviders()
  const preset = input.presetId ? PRESETS.find((p) => p.id === input.presetId) : undefined
  // 同一个预设已经存在就不重复加，交给界面给提示
  if (preset && providers.some((p) => p.id === preset.id)) return providersState()

  const id = preset?.id ?? `custom-${Date.now().toString(36)}`
  const next: ProviderConfig = {
    id,
    label: preset?.label ?? input.label?.trim() ?? '自定义提供商',
    baseUrl: preset?.baseUrl ?? '',
    protocol: DEFAULT_PROTOCOL,
    model: preset?.model ?? '',
    models: preset?.model ? [{ id: preset.model }] : [],
    apiKey: '',
    preset: !!preset
  }
  persist([...providers, next], activeId || id)
  return providersState()
}

/**
 * 改一条。apiKey 传空串/不传都表示「不修改已保存的 key」——
 * 界面上密钥框默认是空的，占位写「留空使用已保存凭据」。
 */
export function updateProvider(
  id: string,
  patch: Partial<Pick<ProviderConfig, 'label' | 'baseUrl' | 'protocol' | 'model' | 'models' | 'apiKey'>>
): ProvidersState {
  const { providers, activeId } = loadProviders()
  const idx = providers.findIndex((p) => p.id === id)
  if (idx < 0) return providersState()

  const cur = providers[idx]

  // 模型目录：界面传什么就以什么为准，去掉空行和重复 id
  const seen = new Set<string>()
  const models: ModelEntry[] = (patch.models ?? cur.models)
    .map((m) => ({ id: (m.id ?? '').trim(), ...(m.note?.trim() ? { note: m.note.trim() } : {}) }))
    .filter((m) => {
      if (!m.id || seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })

  const requested = (patch.model ?? cur.model).trim()
  let model = models.some((m) => m.id === requested) ? requested : (models[0]?.id ?? '')
  // 目录被清空但还留着当前模型：补回去，避免「配了却调不动」
  if (!models.length && requested) models.push({ id: requested })
  if (!model) model = models[0]?.id ?? ''

  providers[idx] = {
    ...cur,
    label: patch.label?.trim() || cur.label,
    baseUrl: (patch.baseUrl ?? cur.baseUrl).trim(),
    protocol: patch.protocol && isProtocolId(patch.protocol) ? patch.protocol : cur.protocol,
    model,
    models,
    apiKey: patch.apiKey?.trim() || cur.apiKey
  }
  persist(providers, activeId)
  return providersState()
}

export function removeProvider(id: string): ProvidersState {
  const { providers, activeId } = loadProviders()
  const next = providers.filter((p) => p.id !== id)
  // 删掉的正好是当前选中：顺位交给列表里的第一条
  persist(next, activeId === id ? (next[0]?.id ?? '') : activeId)
  return providersState()
}

export function setActiveProvider(id: string): ProvidersState {
  const { providers } = loadProviders()
  if (!providers.some((p) => p.id === id)) return providersState()
  persist(providers, id)
  return providersState()
}

function ensureDir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true })
    return true
  } catch {
    return false
  }
}

/** 内置预设的默认模型：编辑面板里「恢复默认模型」用 */
export function presetModelOf(id: string): string {
  return PRESETS.find((p) => p.id === id)?.model ?? ''
}

/**
 * 默认数据目录：
 *  - 开发时：项目根的同级目录 resource-keeper-data（旁边就是源码，随时能翻）
 *  - 打包后：exe 所在目录下的 data（跟着安装位置走）
 */
export function defaultDataDir(): string {
  if (app.isPackaged) return join(dirname(app.getPath('exe')), 'data')
  return join(dirname(app.getAppPath()), 'resource-keeper-data')
}

let cachedDir: DataDirInfo | null = null

export function resolveDataDir(): DataDirInfo {
  const stored = readStored()
  const custom = stored.customDataDir?.trim()
  const def = defaultDataDir()

  if (custom) {
    if (ensureDir(custom)) {
      return { path: custom, isDefault: false, fallback: false, defaultPath: def }
    }
    // 自定义目录不可用（被删了 / 没权限）：清掉这条配置，避免每次启动都白试一遍
    delete stored.customDataDir
    writeStored(stored)
  }

  if (ensureDir(def)) {
    return { path: def, isDefault: true, fallback: false, defaultPath: def }
  }

  // 安装目录只读之类的情况下退回 userData，保证程序还能起来
  const fb = join(app.getPath('userData'), 'data')
  ensureDir(fb)
  return { path: fb, isDefault: true, fallback: true, defaultPath: def }
}

export function dataDirInfo(force = false): DataDirInfo {
  if (force || !cachedDir) cachedDir = resolveDataDir()
  return cachedDir
}

/** 传 null 表示恢复默认位置 */
export function setDataDir(dir: string | null): DataDirInfo {
  const cfg = readStored()
  if (dir?.trim()) cfg.customDataDir = dir.trim()
  else delete cfg.customDataDir
  writeStored(cfg)
  return dataDirInfo(true)
}