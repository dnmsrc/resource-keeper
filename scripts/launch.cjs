#!/usr/bin/env node
/**
 * 启动包装器：在 Electron 进程起来「之前」办好两件本机必需的事。
 *
 * 这台机器上 Electron 有两个启动即崩的坑，而且都发生在主进程 JS 执行之前
 * （实测 src/main/index.ts 里的代码根本没跑到），所以只能在 spawn 前解决：
 *
 *   1. renderer sandbox 初始化失败 -> EXCEPTION_BREAKPOINT / exit 3
 *      对策：spawn 前设 ELECTRON_DISABLE_SANDBOX=1
 *      （app.commandLine.appendSwitch('no-sandbox') 太晚，实测无效）
 *
 *   2. userData 目录不存在时创建被拒（0x5 拒绝访问）-> SIGSEGV / exit 139
 *      对策：spawn 前把 %APPDATA%/<package name> 建好
 *      （在 src/main 里 mkdirSync 同样太晚）
 *
 * 正常电脑上这两条都是无害的空操作，不需要的人删掉这个包装器也能跑。
 *
 * 用法：node scripts/launch.cjs dev | preview
 */
const { spawn } = require('node:child_process')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')

const mode = process.argv[2] || 'dev'
const appName = require('../package.json').name

const appDataDir =
  process.env.APPDATA || join(process.env.USERPROFILE || process.cwd(), 'AppData', 'Roaming')
const userDataDir = join(appDataDir, appName)

try {
  mkdirSync(userDataDir, { recursive: true })
} catch (err) {
  console.warn(`[launch] 预建 userData 目录失败，应用可能无法启动：${err.message}`)
}

const cli = join(__dirname, '..', 'node_modules', 'electron-vite', 'bin', 'electron-vite.js')

const env = { ...process.env, ELECTRON_DISABLE_SANDBOX: '1' }
// 如果父进程是某个 Electron 应用（比如 DSH / VS Code）且带着这个变量，
// 子 electron 会把自己当普通 Node 跑，窗口永远不出现。
if (env.ELECTRON_RUN_AS_NODE) {
  delete env.ELECTRON_RUN_AS_NODE
  console.warn('[launch] 已清除父进程继承的 ELECTRON_RUN_AS_NODE')
}

const child = spawn(process.execPath, [cli, mode], { stdio: 'inherit', env })

child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 0)
})