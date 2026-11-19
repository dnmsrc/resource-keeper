/**
 * 本机配置：模型接入参数 + 数据目录。
 *
 * 存哪儿：userData/config.json（Windows 上是 %APPDATA%\resource-keeper）。
 * 这个位置由 Electron 管，不属于项目目录，所以天然进不了版本库。
 * API Key 额外用 safeStorage（Windows 底下是 DPAPI）加密后写成 apiKeyEnc，
 * 文件被拷到别的机器/别的账号上解不开。
 */
import { app, safeStorage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface LlmConfig {
  provider: string
  baseUrl: string
  model: string
  apiKey: string
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

interface StoredConfig {
  llm?: {
    provider?: string
    baseUrl?: string
    model?: string
    apiKeyEnc?: string
  }
  customDataDir?: string
}

const LLM_DEFAULTS: Omit<LlmConfig, 'apiKey'> = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini'
}

const configFile = (): string => join(app.getPath('userData'), 'config.json')

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

export function loadLlm(): LlmConfig {
  const raw = readStored().llm ?? {}
  // 早期版本用过 'openai-compatible' 这个值，迁移一下
  const provider = raw.provider === 'openai-compatible' ? 'openai' : (raw.provider ?? LLM_DEFAULTS.provider)
  return {
    provider,
    baseUrl: raw.baseUrl?.trim() || LLM_DEFAULTS.baseUrl,
    model: raw.model?.trim() || LLM_DEFAULTS.model,
    apiKey: raw.apiKeyEnc ? decrypt(raw.apiKeyEnc) : ''
  }
}

/**
 * patch 里不带 apiKey（或带空串）时保留磁盘上已有的 key。
 * 否则「只改模型名、密码框留空」会把 key 覆盖成空。
 */
export function saveLlm(patch: Partial<LlmConfig>): LlmConfig {
  const cur = loadLlm()
  const provider = patch.provider ?? cur.provider
  const baseUrl = (patch.baseUrl ?? cur.baseUrl).trim()
  const model = (patch.model ?? cur.model).trim()
  const apiKey = patch.apiKey?.trim() || cur.apiKey

  const cfg = readStored()
  cfg.llm = {
    provider,
    baseUrl,
    model,
    ...(apiKey ? { apiKeyEnc: encrypt(apiKey) } : {})
  }
  writeStored(cfg)
  return { provider, baseUrl, model, apiKey }
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