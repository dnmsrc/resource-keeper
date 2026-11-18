// 临时验证脚本：逐页加载构建产物，读取真实布局尺寸 + 截图（结果写文件，避免 GUI 子系统吞掉 stdout）
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const base = process.env.SHOT_BASE || 'http://127.0.0.1:8756/'
const outDir = process.env.SHOT_DIR || __dirname
const pages = (process.env.SHOT_PAGES || 'dashboard')
  .split(',')
  .map((p) => (p.startsWith('/') ? p : '/' + p))
const outJson = path.join(outDir, 'layout-report.json')

const results = []

function flush() {
  try {
    fs.writeFileSync(outJson, JSON.stringify(results, null, 2), 'utf8')
  } catch (e) {
    /* ignore */
  }
}

process.on('uncaughtException', (e) => {
  results.push({ stage: 'uncaughtException', error: String((e && e.stack) || e) })
  flush()
  app.exit(1)
})

app.disableHardwareAcceleration()

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

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    backgroundColor: '#0e1015',
    webPreferences: { offscreen: false }
  })

  for (const route of pages) {
    const name = route.replace(/^\//, '').replace(/[^\w-]/g, '_') || 'root'
    try {
      await win.loadURL(base + '#' + route)
    } catch (e) {
      results.push({ route, stage: 'load', error: String(e) })
      continue
    }
    await new Promise((r) => setTimeout(r, 1500))
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