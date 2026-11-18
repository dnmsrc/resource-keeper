import type { KeeperApi } from './index'

declare global {
  interface Window {
    api: KeeperApi
  }
}

export {}