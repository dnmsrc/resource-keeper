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
 * 旧版本存的是单条（llm.provider/baseUrl/model/apiKeyEnc），读到会自动迁移。
 */
import { app, safeStorage } from 'electron'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

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
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    desc: 'api.deepseek.com',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat'
  },
  {
    id: 'qwen',
    label: '通义千问',
    desc: 'DashScope 兼容模式',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus'
  },
  {
    id: 'ollama',
    label: 'Ollama',
    desc: '本机 11434 端口',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b'
  }
]

/** 主进程内部形态：带明文密钥，只在进程里出现 */
export interface ProviderConfig {
  id: string
  label: string
  baseUrl: string
  model: string
  apiKey: string
  /** 是不是内置预设（界面上用它决定要不要挂「自定义」徽章） */
  preset: boolean
}

/** 给渲染层的形态：不发明文，只说有没有 key */
export interface ProviderPublic {
  id: string
  label: string
  baseUrl: string
  model: string
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

interface StoredProvider {
  id?: string
  label?: string
  baseUrl?: string
  model?: string
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
    model: p.model,
    preset: true
  }))
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
        model: llm.model ?? preset?.model ?? PRESETS[0].model,
        apiKeyEnc: llm.apiKeyEnc,
        preset: !!preset
      }
    ]
    needSave = true
  } else {
    raw = defaultProviders()
    needSave = true
  }

  const providers = raw.map((p) => ({
    id: p.id ?? `custom-${Math.random().toString(36).slice(2, 8)}`,
    label: p.label ?? p.id ?? '未命名',
    baseUrl: p.baseUrl ?? '',
    model: p.model ?? '',
    apiKey: p.apiKeyEnc ? decrypt(p.apiKeyEnc) : '',
    preset: !!p.preset
  }))

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
      model: p.model,
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
    model: p.model,
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
    model: preset?.model ?? '',
    apiKey: '',
    preset: !!preset
  }
  persist([...providers, next], activeId || id)
  return providersState()
}

/** apiKey 传空串表示「不修改已保存的 key」 */
export function updateProvider(
  id: string,
  patch: Partial<Pick<ProviderConfig, 'label' | 'baseUrl' | 'model' | 'apiKey'>>
): ProvidersState {
  const { providers, activeId } = loadProviders()
  const idx = providers.findIndex((p) => p.id === id)
  if (idx < 0) return providersState()

  const cur = providers[idx]
  providers[idx] = {
    ...cur,
    label: patch.label?.trim() || cur.label,
    baseUrl: (patch.baseUrl ?? cur.baseUrl).trim(),
    model: (patch.model ?? cur.model).trim(),
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