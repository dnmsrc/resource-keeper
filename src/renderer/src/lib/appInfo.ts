/**
 * 应用运行信息的共享单例。
 *
 * 标题栏、底部状态栏、设置页都要用 version / dataDir，但它们是三个不同组件。
 * 每次各自调一次 window.api.info() 会重复走 IPC，而且换了数据目录后各处不同步。
 * 这里存一份响应式副本，谁需要谁读，改完调 refreshAppInfo() 统一刷新。
 */
import { reactive } from 'vue'
import type { AppInfo } from '../../../preload/index'

export const appInfo = reactive<Partial<AppInfo>>({})

export async function refreshAppInfo(): Promise<void> {
  try {
    // 静态预览（没有 preload）时 window.api 不存在
    if (!window.api) return
    Object.assign(appInfo, await window.api.info())
  } catch {
    /* 忽略：界面走兜底文案 */
  }
}