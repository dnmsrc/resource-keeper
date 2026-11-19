/**
 * 设置弹窗外壳状态。
 *
 * 设置不再是路由页面，而是盖在窗口上的居中弹窗，
 * 所以显隐 + 当前分节要有个不依赖路由的地方放。侧栏、标题栏、快捷键都能调它。
 */
import { reactive } from 'vue'

export type SettingsSection = 'general' | 'model'

export const settings = reactive({
  open: false,
  section: 'model' as SettingsSection
})

export function openSettings(section: SettingsSection = 'model'): void {
  settings.section = section
  settings.open = true
}

export function closeSettings(): void {
  settings.open = false
}