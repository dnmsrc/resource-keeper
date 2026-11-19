/**
 * 模型服务调用。
 *
 * 不引 openai SDK：这里只走 /chat/completions 一个接口，和各家兼容端点
 * （OpenAI / DeepSeek / 通义 DashScope 兼容模式 / Ollama）的协议一致，
 * 原生 fetch 足够，少一个打包依赖。
 */
import { resolveProvider } from './config'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface TestResult {
  ok: boolean
  message: string
}

export interface TestOptions {
  /** 测哪一条；不传就用当前选中的 */
  id?: string
  /** 下面三项可以覆盖已保存的值 —— 让界面在保存前就能试一次 */
  baseUrl?: string
  model?: string
  apiKey?: string
}

function endpoint(baseUrl: string): string {
  // 用户可能把 baseUrl 填成 .../v1/ ，去掉结尾斜杠免得拼出 //chat/completions
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`
}

/** 本机端点（Ollama 之类）通常不校验 key，别拿「没填 key」把人拦在门外 */
function isLocal(baseUrl: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(baseUrl)
}

/**
 * 连通性测试：发一句最小请求，只看能不能拿到 200。
 * 非流式、max_tokens=1，几乎不花钱。
 */
export async function testConnection(opts: TestOptions = {}): Promise<TestResult> {
  const saved = resolveProvider(opts.id)
  const baseUrl = (opts.baseUrl?.trim() || saved?.baseUrl || '').trim()
  const model = (opts.model?.trim() || saved?.model || '').trim()
  const apiKey = opts.apiKey?.trim() || saved?.apiKey || ''

  if (!baseUrl) return { ok: false, message: '还没填 Base URL' }
  if (!model) return { ok: false, message: '还没选模型' }
  if (!apiKey && !isLocal(baseUrl)) return { ok: false, message: '还没填 API Key' }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)

  try {
    const res = await fetch(endpoint(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      }),
      signal: ctrl.signal
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, message: `HTTP ${res.status} · ${body.slice(0, 220)}` }
    }
    return { ok: true, message: `连通正常 · ${model}` }
  } catch (e) {
    const err = e as Error
    return {
      ok: false,
      message: err.name === 'AbortError' ? '连接超时（15s）' : `连接失败：${err.message}`
    }
  } finally {
    clearTimeout(timer)
  }
}

// 下一步：流式对话。chat(wc, messages) 把 SSE 的 delta 逐段 send 给渲染层。