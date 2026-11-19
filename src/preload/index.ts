import { contextBridge, ipcRenderer } from 'electron'

export interface AppInfo {
  name: string
  version: string
  electron: string
  node: string
  chrome: string
  platform: string
  dev: boolean
  /** 实际生效的数据目录（绝对路径，可直接给用户） */
  dataDir: string
  /** 是否使用默认位置 */
  dataDirDefault: boolean
  /** 默认位置不可写、退回 userData/data */
  dataDirFallback: boolean
  /** 默认位置应该在哪 */
  defaultDataDir: string
}

export interface Overview {
  libraries: number
  files: number
  containers: number
  totalBytes: number
  duplicates: number
  scanning: boolean
}

export interface DataDirInfo {
  path: string
  isDefault: boolean
  fallback: boolean
  defaultPath: string
}

/** 模型配置：对外只暴露 hasKey，不暴露明文 */
export interface LlmPublic {
  provider: string
  baseUrl: string
  model: string
  hasKey: boolean
}

/** apiKey 留空表示「不修改已保存的 key」 */
export interface LlmPatch {
  provider?: string
  baseUrl?: string
  model?: string
  apiKey?: string
}

export interface TestResult {
  ok: boolean
  message: string
}

const api = {
  info: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  overview: (): Promise<Overview> => ipcRenderer.invoke('db:overview'),

  window: {
    minimize: (): void => ipcRenderer.send('win:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('win:toggle-maximize'),
    close: (): void => ipcRenderer.send('win:close')
  },

  data: {
    /** 在系统文件管理器里打开数据目录；返回空串表示成功 */
    open: (): Promise<string> => ipcRenderer.invoke('app:openDataDir'),
    /** 弹目录选择框；用户取消返回 null */
    choose: (): Promise<DataDirInfo | null> => ipcRenderer.invoke('app:chooseDataDir'),
    reset: (): Promise<DataDirInfo> => ipcRenderer.invoke('app:resetDataDir')
  },

  config: {
    getLlm: (): Promise<LlmPublic> => ipcRenderer.invoke('config:llm:get'),
    setLlm: (patch: LlmPatch): Promise<LlmPublic> => ipcRenderer.invoke('config:llm:set', patch)
  },

  llm: {
    test: (): Promise<TestResult> => ipcRenderer.invoke('llm:test')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type KeeperApi = typeof api