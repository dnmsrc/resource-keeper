import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  addProvider,
  configPath,
  dataDirInfo,
  ensureConfigFile,
  presetList,
  protocolList,
  providersState,
  removeProvider,
  setActiveProvider,
  setDataDir,
  updateProvider
} from './config'
import { listModels, testConnection } from './llm'

app.setName('resource-keeper')

// 本机 Electron 在 userData 目录不存在时创建会失败（0x5 拒绝访问）并直接崩溃，
// 且不留下任何日志。所以在 app ready 之前显式把目录建好、显式指定路径。
const userDataDir = join(app.getPath('appData'), 'resource-keeper')
try {
  mkdirSync(userDataDir, { recursive: true })
  app.setPath('userData', userDataDir)
} catch {
  // 建不出来就交给 Electron 默认逻辑，不阻断启动
}

// 注意：renderer sandbox 必须在 electron 进程启动前就用 ELECTRON_DISABLE_SANDBOX=1 禁用。
// 这里调 app.commandLine.appendSwitch('no-sandbox') 太晚（sandbox 已初始化），实测无效。
// 由 scripts/launch.cjs 在 spawn 之前处理，见 package.json 的 dev/start。

const isDev = !app.isPackaged

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f5f6fa',
    titleBarStyle: 'hidden',
    // 窗口按钮区（最小化/最大化/关闭）由系统按这个色自己画，渲染层盖不住它。
    // 必须和渲染层的 --titlebar-bg 完全一致，否则右上角会出现一块色差。
    // 改色时两处一起改：这里是主进程，那边在 src/renderer/src/styles/_tokens.scss
    titleBarOverlay: {
      color: '#fafbfd',
      symbolColor: '#5a6478',
      height: 44
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/**
 * 交给系统文件管理器打开目录 / 定位文件。
 *
 * 不用 shell.openPath / shell.showItemInFolder：这两个最终走 ShellExecute，
 * 一旦进程或目标目录的权限环境不匹配（例如目录整体性级别被降成 Low、或进程在
 * 受限会话里），Windows 会直接弹一个「无法访问指定设备、路径或文件」的系统错误框，
 * 用户只能点确定，界面上拿不到任何可处理的错误。直接拉起 explorer.exe 是普通
 * CreateProcess，失败能拿到异常并转成界面提示。
 */
function revealInExplorer(target: string, select = false): string {
  try {
    const args = select ? [`/select,${target}`] : [target]
    spawn('explorer.exe', args, { detached: true, stdio: 'ignore' }).unref()
    return ''
  } catch (e) {
    return (e as Error).message
  }
}

/** 数据目录可能被用户从资源管理器里删掉，打开前先确保它是存在的目录 */
function openDataDir(): string {
  const dir = dataDirInfo().path
  try {
    mkdirSync(dir, { recursive: true })
  } catch (e) {
    return `数据目录不可用：${(e as Error).message}`
  }
  return revealInExplorer(dir)
}

function registerIpc(): void {
  ipcMain.handle('app:info', () => {
    const dir = dataDirInfo()
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      platform: process.platform,
      dev: isDev,
      // 直接给绝对路径：用户需要能拿去资源管理器里访问
      dataDir: dir.path,
      dataDirDefault: dir.isDefault,
      dataDirFallback: dir.fallback,
      defaultDataDir: dir.defaultPath
    }
  })

  ipcMain.on('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on('win:toggle-maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())

  // ---- 数据目录 ----
  ipcMain.handle('app:openDataDir', () => openDataDir())

  ipcMain.handle('app:chooseDataDir', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const opts = {
      title: '选择数据目录',
      properties: ['openDirectory', 'createDirectory'] as const
    }
    const picked = win
      ? await dialog.showOpenDialog(win, { ...opts, properties: [...opts.properties] })
      : await dialog.showOpenDialog({ ...opts, properties: [...opts.properties] })
    if (picked.canceled || !picked.filePaths[0]) return null
    return setDataDir(picked.filePaths[0])
  })

  ipcMain.handle('app:resetDataDir', () => setDataDir(null))

  // ---- 模型接入 ----
  // 全部只回 hasKey，明文 key 不出主进程
  ipcMain.handle('config:llm:list', () => providersState())
  ipcMain.handle('config:llm:presets', () => presetList())
  ipcMain.handle('config:llm:protocols', () => protocolList())
  ipcMain.handle('config:llm:add', (_e, input) => addProvider(input ?? {}))
  ipcMain.handle('config:llm:update', (_e, id: string, patch) => updateProvider(id, patch ?? {}))
  ipcMain.handle('config:llm:remove', (_e, id: string) => removeProvider(id))
  ipcMain.handle('config:llm:setActive', (_e, id: string) => setActiveProvider(id))

  ipcMain.handle('llm:test', (_e, opts) => testConnection(opts ?? {}))
  ipcMain.handle('llm:models', (_e, opts) => listModels(opts ?? {}))

  // 「打开配置文件」：路径由主进程决定（可能退到数据目录），界面不猜
  ipcMain.handle('app:configPath', () => configPath())
  ipcMain.handle('app:revealConfig', () => revealInExplorer(ensureConfigFile(), true))

  // 占位：阶段 1 接入真实 SQLite 台账
  ipcMain.handle('db:overview', () => ({
    libraries: 0,
    files: 0,
    containers: 0,
    totalBytes: 0,
    duplicates: 0,
    scanning: false
  }))
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})