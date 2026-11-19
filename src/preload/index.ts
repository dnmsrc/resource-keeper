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

export type ProtocolId = 'openai' | 'anthropic' | 'gemini'

export interface ProtocolDef {
  id: ProtocolId
  label: string
  /** false 的协议主进程还没实现，界面上禁用 */
  available: boolean
  desc: string
}

/** 模型目录里的一条：id 发给服务端，note 只给人看（比如「2折」） */
export interface ModelEntry {
  id: string
  note?: string
}

/** 模型服务：对外只暴露 hasKey，不发明文 */
export interface ProviderPublic {
  id: string
  label: string
  baseUrl: string
  protocol: ProtocolId
  /** 当前使用的模型，必在 models 里 */
  model: string
  models: ModelEntry[]
  hasKey: boolean
  /** 内置预设为 true；自定义的才允许删除 */
  preset: boolean
}

export interface ProvidersState {
  activeId: string
  providers: ProviderPublic[]
}

export interface PresetDef {
  id: string
  label: string
  desc: string
  baseUrl: string
  model: string
}

/** apiKey 留空表示「不修改已保存的 key」 */
export interface ProviderPatch {
  label?: string
  baseUrl?: string
  protocol?: ProtocolId
  model?: string
  models?: ModelEntry[]
  apiKey?: string
}

export interface TestOptions {
  id?: string
  baseUrl?: string
  model?: string
  apiKey?: string
  protocol?: ProtocolId
}

export interface TestResult {
  ok: boolean
  message: string
}

export interface ModelsResult {
  ok: boolean
  message: string
  models: string[]
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
    llm: {
      list: (): Promise<ProvidersState> => ipcRenderer.invoke('config:llm:list'),
      presets: (): Promise<PresetDef[]> => ipcRenderer.invoke('config:llm:presets'),
      protocols: (): Promise<ProtocolDef[]> => ipcRenderer.invoke('config:llm:protocols'),
      /** presetId 走预设初始化；都不给则建一条空白自定义 */
      add: (input: { presetId?: string; label?: string }): Promise<ProvidersState> =>
        ipcRenderer.invoke('config:llm:add', input),
      update: (id: string, patch: ProviderPatch): Promise<ProvidersState> =>
        ipcRenderer.invoke('config:llm:update', id, patch),
      remove: (id: string): Promise<ProvidersState> => ipcRenderer.invoke('config:llm:remove', id),
      setActive: (id: string): Promise<ProvidersState> =>
        ipcRenderer.invoke('config:llm:setActive', id),
      /** 向端点要可用模型清单（保存前也能拉，传临时值即可） */
      models: (opts?: Pick<TestOptions, 'id' | 'baseUrl' | 'apiKey'>): Promise<ModelsResult> =>
        ipcRenderer.invoke('llm:models', opts ?? {})
    },
    /** 配置文件绝对路径（可能落在数据目录，界面不猜） */
    path: (): Promise<string> => ipcRenderer.invoke('app:configPath'),
    /** 在资源管理器里定位配置文件；返回空串表示成功 */
    reveal: (): Promise<string> => ipcRenderer.invoke('app:revealConfig')
  },

  llm: {
    test: (opts?: TestOptions): Promise<TestResult> => ipcRenderer.invoke('llm:test', opts ?? {})
  }
}

contextBridge.exposeInMainWorld('api', api)

export type KeeperApi = typeof api