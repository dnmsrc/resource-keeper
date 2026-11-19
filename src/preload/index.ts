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

/** 模型服务：对外只暴露 hasKey，不发明文 */
export interface ProviderPublic {
  id: string
  label: string
  baseUrl: string
  model: string
  hasKey: boolean
  /** 内置预设为 true；用户自己加的不显示「自定义」徽章以外的差别 */
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
  model?: string
  apiKey?: string
}

export interface TestOptions {
  id?: string
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
    llm: {
      list: (): Promise<ProvidersState> => ipcRenderer.invoke('config:llm:list'),
      presets: (): Promise<PresetDef[]> => ipcRenderer.invoke('config:llm:presets'),
      /** presetId 走预设初始化；都不给则建一条空白自定义 */
      add: (input: { presetId?: string; label?: string }): Promise<ProvidersState> =>
        ipcRenderer.invoke('config:llm:add', input),
      update: (id: string, patch: ProviderPatch): Promise<ProvidersState> =>
        ipcRenderer.invoke('config:llm:update', id, patch),
      remove: (id: string): Promise<ProvidersState> => ipcRenderer.invoke('config:llm:remove', id),
      setActive: (id: string): Promise<ProvidersState> =>
        ipcRenderer.invoke('config:llm:setActive', id)
    }
  },

  llm: {
    test: (opts?: TestOptions): Promise<TestResult> => ipcRenderer.invoke('llm:test', opts ?? {})
  }
}

contextBridge.exposeInMainWorld('api', api)

export type KeeperApi = typeof api