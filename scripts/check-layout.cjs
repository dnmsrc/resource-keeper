/**
 * 开发用布局自检 / 截图脚本
 *
 * 两种模式：
 *  1) 静态服务模式（不需要主进程逻辑，界面里会显示「仅桌面端可用」这类兜底文案）
 *     cd out/renderer && python -m http.server 8756
 *     SHOT_BASE=http://127.0.0.1:8756/ SHOT_PAGES=dashboard,libraries \
 *       ./node_modules/electron/dist/electron.exe --no-sandbox scripts/check-layout.cjs
 *
 *  2) 真实应用模式（挂上 preload + 和主进程一致的 IPC 桩，界面拿到真实的 dataDir/版本）
 *     SHOT_APP=1 SHOT_PAGES=dashboard,libraries \
 *       ./node_modules/electron/dist/electron.exe --no-sandbox scripts/check-layout.cjs
 *
 * 踩过的坑（两个都跟 show:false + 无 GPU 有关，别删）：
 *  - 同一窗口连续切路由，合成器不重绘固定层，侧栏会残留上一页的边框。所以每页都做一次
 *    resize 抖动 + invalidate 强制全量重绘，再截图。
 *  - 每页新建 BrowserWindow 会在本机（无桌面会话）让第二个窗口起不来，进程直接退出。
 *    因此全程复用一个窗口。
 *
 * 产物：layout-report.json（每个页面的元素真实尺寸 + 内部滚动溢出清单）、shot-<页面>.png
 * 原理：直接读 getBoundingClientRect / scrollHeight，比看截图猜更准。
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.setName('resource-keeper')

// 与 src/main/index.ts 的 defaultDataDir 保持一致：开发时落在项目同级目录
const dataDir = path.resolve(__dirname, '../../resource-keeper-data')

const useApp = process.env.SHOT_APP === '1'
const base = process.env.SHOT_BASE || 'http://127.0.0.1:8756/'
const outDir = process.env.SHOT_DIR || __dirname
const pages = (process.env.SHOT_PAGES || 'dashboard')
  .split(',')
  .map((p) => (p.startsWith('/') ? p : '/' + p))
const outJson = path.join(outDir, 'layout-report.json')
// 可选：加载完成后先点击一个选择器再截图（例如 SHOT_CLICK=.fab 截悬浮助手展开态）
const clickSel = process.env.SHOT_CLICK || ''
// 可选：按可见文本依次点击（逗号分隔），例如 SHOT_CLICK_TEXT=设置,编辑
// 设置已经改成弹窗，截图得先点开它再点别的，所以支持一串动作
const clickTexts = (process.env.SHOT_CLICK_TEXT || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const rendererHtml = path.resolve(__dirname, '../out/renderer/index.html')
const preloadJs = path.resolve(__dirname, '../out/preload/index.js')

// 窗口尺寸可调：设置弹窗这类内容比单页长的界面，需要更高的视口才能一屏看完
const winW = Number(process.env.SHOT_W || 1400)
const winH = Number(process.env.SHOT_H || 900)

const results = []

function flush() {
  try {
    fs.writeFileSync(outJson, JSON.stringify(results, null, 2), 'utf8')
  } catch {
    /* ignore */
  }
}

process.on('uncaughtException', (e) => {
  results.push({ stage: 'uncaughtException', error: String((e && e.stack) || e) })
  flush()
  app.exit(1)
})

app.disableHardwareAcceleration()

// 与 src/main/index.ts 保持一致的 IPC 桩，让渲染层拿到真实信息
function registerIpcStubs() {
  ipcMain.handle('app:info', () => ({
    name: 'resource-keeper',
    version: '0.1.0',
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    platform: process.platform,
    dev: true,
    dataDir,
    dataDirDefault: true,
    dataDirFallback: false,
    defaultDataDir: dataDir
  }))
  ipcMain.handle('app:openDataDir', () => '')
  ipcMain.handle('app:chooseDataDir', () => null)
  ipcMain.handle('app:resetDataDir', () => ({
    path: dataDir,
    isDefault: true,
    fallback: false,
    defaultPath: dataDir
  }))
  // 模型服务列表：截图时固定放几条，包含「使用中 / 未配密钥 / 自定义」三种形态
  const providersState = () => ({
    activeId: 'openai',
    providers: [
      {
        id: 'openai',
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        protocol: 'openai',
        model: 'gpt-4o-mini',
        models: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o', note: '贵' }],
        hasKey: true,
        preset: true
      },
      {
        id: 'deepseek',
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        protocol: 'openai',
        model: 'deepseek-chat',
        models: [{ id: 'deepseek-chat', note: '2折' }],
        hasKey: false,
        preset: true
      },
      {
        id: 'ollama',
        label: 'Ollama',
        baseUrl: 'http://localhost:11434/v1',
        protocol: 'openai',
        model: 'qwen2.5:7b',
        models: [{ id: 'qwen2.5:7b' }],
        hasKey: true,
        preset: true
      },
      {
        id: 'custom-ark',
        label: '火山方舟 Coding Plan',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        protocol: 'openai',
        model: 'doubao-seed-1-6',
        models: [{ id: 'doubao-seed-1-6', note: '2折' }, { id: 'deepseek-v3.1' }],
        hasKey: true,
        preset: false
      }
    ]
  })
  ipcMain.handle('config:llm:list', providersState)
  ipcMain.handle('config:llm:presets', () => [
    { id: 'openai', label: 'OpenAI', desc: 'api.openai.com', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { id: 'deepseek', label: 'DeepSeek', desc: 'api.deepseek.com', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    { id: 'qwen', label: '通义千问', desc: 'DashScope 兼容模式', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    { id: 'ollama', label: 'Ollama', desc: '本机 11434 端口', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b' }
  ])
  ipcMain.handle('config:llm:protocols', () => [
    { id: 'openai', label: 'OpenAI Chat Completions', available: true, desc: '兼容端点通用' },
    { id: 'anthropic', label: 'Anthropic Messages', available: false, desc: '尚未接入' },
    { id: 'gemini', label: 'Google Gemini', available: false, desc: '尚未接入' }
  ])
  ipcMain.handle('config:llm:add', providersState)
  ipcMain.handle('config:llm:update', providersState)
  ipcMain.handle('config:llm:remove', providersState)
  ipcMain.handle('config:llm:setActive', providersState)
  ipcMain.handle('app:configPath', () => path.join(dataDir, 'config.json'))
  ipcMain.handle('app:revealConfig', () => '')
  ipcMain.handle('llm:test', () => ({ ok: false, message: '截图模式不发起网络请求' }))
  ipcMain.handle('llm:models', () => ({ ok: true, message: '截图模式', models: [] }))
  ipcMain.handle('db:overview', () => ({
    libraries: 0,
    files: 0,
    containers: 0,
    totalBytes: 0,
    duplicates: 0,
    scanning: false
  }))
}

const measure = `(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width),
      display: s.display, flex: s.flex, height: s.height, overflow: s.overflow,
      scrollH: el.scrollHeight, clientH: el.clientHeight
    };
  };
  const scrollers = [];
  document.querySelectorAll('.page, .list, .chat, .panel, .scroll').forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 2) {
      scrollers.push({ cls: el.className, scrollH: el.scrollHeight, clientH: el.clientHeight });
    }
  });
  return {
    viewport: { w: innerWidth, h: innerHeight },
    shell: box('.shell'),
    body: box('.body'),
    content: box('.content'),
    page: box('.page'),
    overflowInside: scrollers
  };
})()`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  if (useApp) registerIpcStubs()

  const win = new BrowserWindow({
    width: winW,
    height: winH,
    show: false,
    backgroundColor: '#f5f6fa',
    webPreferences: useApp
      ? { preload: preloadJs, sandbox: false, contextIsolation: true, nodeIntegration: false }
      : { offscreen: false }
  })

  for (const route of pages) {
    const name = route.replace(/^\//, '').replace(/[^\w-]/g, '_') || 'root'
    try {
      if (useApp) {
        await win.loadFile(rendererHtml, { hash: route })
      } else {
        await win.loadURL(base + '#' + route)
      }
    } catch (e) {
      results.push({ route, stage: 'load', error: String(e) })
      continue
    }
    await sleep(900)
    if (clickSel) {
      try {
        const clicked = await win.webContents.executeJavaScript(
          `(() => {
             const el = document.querySelector(${JSON.stringify(clickSel)});
             if (!el) return false;
             el.click();
             return true;
           })()`
        )
        if (!clicked) results.push({ route, stage: 'click', warning: `未找到选择器 ${clickSel}` })
        await sleep(520)
      } catch (e) {
        results.push({ route, stage: 'click', error: String(e) })
      }
    }
    for (const text of clickTexts) {
      try {
        const clicked = await win.webContents.executeJavaScript(
          `(() => {
             const nodes = [...document.querySelectorAll('.n-tabs-tab, button, a, [role="tab"], .link')];
             const hit = nodes.find((n) => (n.textContent || '').trim() === ${JSON.stringify(text)});
             if (!hit) return false;
             hit.click();
             return true;
           })()`
        )
        if (!clicked) results.push({ route, stage: 'click', warning: `未找到文本 ${text}` })
        await sleep(600)
      } catch (e) {
        results.push({ route, stage: 'click', error: String(e) })
      }
    }
    // 强制全量重绘：消除上一页残留的合成层
    win.setSize(winW + 1, winH + 1)
    win.webContents.invalidate()
    await sleep(120)
    win.setSize(winW, winH)
    win.webContents.invalidate()
    await sleep(320)

    try {
      const metrics = await win.webContents.executeJavaScript(measure)
      const img = await win.webContents.capturePage()
      const png = path.join(outDir, `shot-${name}.png`)
      fs.writeFileSync(png, img.toPNG())
      results.push({ route, stage: 'ok', metrics, png, pngBytes: fs.statSync(png).size })
    } catch (e) {
      results.push({ route, stage: 'measure', error: String((e && e.stack) || e) })
    }
  }

  flush()
  app.exit(0)
})