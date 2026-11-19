import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

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
    titleBarOverlay: {
      color: '#f5f6fa',
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

function registerIpc(): void {
  ipcMain.handle('app:info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    platform: process.platform,
    dev: isDev,
    dataDir: join(app.getPath('userData'))
  }))

  ipcMain.on('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on('win:toggle-maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())

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