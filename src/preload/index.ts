import { contextBridge, ipcRenderer } from 'electron'

export interface AppInfo {
  name: string
  version: string
  electron: string
  node: string
  chrome: string
  platform: string
  dev: boolean
  dataDir: string
}

export interface Overview {
  libraries: number
  files: number
  containers: number
  totalBytes: number
  duplicates: number
  scanning: boolean
}

const api = {
  info: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  overview: (): Promise<Overview> => ipcRenderer.invoke('db:overview'),
  window: {
    minimize: (): void => ipcRenderer.send('win:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('win:toggle-maximize'),
    close: (): void => ipcRenderer.send('win:close')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type KeeperApi = typeof api