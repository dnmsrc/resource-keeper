/**
 * 模型服务调用。
 *
 * 不引 openai SDK：这里只走 /chat/completions 一个接口，和各家兼容端点
 * （OpenAI / DeepSeek / 通义 DashScope 兼容模式 / Ollama / 火山方舟）的协议一致，
 * 原生 fetch 足够，少一个打包依赖。
 *
 * 协议目前只实现了 OpenAI 兼容这一种。其他协议在配置里能选到、但会明确报
 * 「尚未实现」，不做「看着能选、点了才炸」的事。
 */
import { isImplemented, type ProtocolId } from './protocols'
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
  protocol?: ProtocolId
}

export interface ModelsResult {
  ok: boolean
  message: string
  /** 端点报回来的模型 ID 清单（按字典序，去重） */
  models: string[]
}

function endpoint(baseUrl: string, path: string): string {
  // 用户可能把 baseUrl 填成 .../v1/ ，去掉结尾斜杠免得拼出 //chat/completions
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

/** 本机端点（Ollama 之类）通常不校验 key，别拿「没填 key」把人拦在门外 */
function isLocal(baseUrl: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(baseUrl)
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
  }
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
  const protocol = opts.protocol || saved?.protocol || 'openai'

  if (!baseUrl) return { ok: false, message: '还没填 API 地址' }
  if (!model) return { ok: false, message: '还没选模型' }
  if (!isImplemented(protocol)) {
    return { ok: false, message: '这个 API 协议还没接入，暂时只能用 OpenAI Chat Completions' }
  }
  if (!apiKey && !isLocal(baseUrl)) return { ok: false, message: '还没填 API 密钥' }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)

  try {
    const res = await fetch(endpoint(baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: authHeaders(apiKey),
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

/**
 * 拉端点的模型清单（GET {baseUrl}/models）。
 *
 * OpenAI 兼容端点回 { data: [{ id }] }，Ollama 原生回 { models: [{ name }] }，
 * 两种都认。这比让用户手敲模型名靠谱，但服务商支持与否不一，所以失败不算错误，
 * 由界面提示后让用户继续手填。
 */
export async function listModels(
  opts: Pick<TestOptions, 'id' | 'baseUrl' | 'apiKey'>
): Promise<ModelsResult> {
  const saved = resolveProvider(opts.id)
  const baseUrl = (opts.baseUrl?.trim() || saved?.baseUrl || '').trim()
  const apiKey = opts.apiKey?.trim() || saved?.apiKey || ''

  if (!baseUrl) return { ok: false, message: '先填 API 地址', models: [] }
  if (!apiKey && !isLocal(baseUrl)) return { ok: false, message: '先填 API 密钥', models: [] }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)

  try {
    const res = await fetch(endpoint(baseUrl, '/models'), {
      method: 'GET',
      headers: authHeaders(apiKey),
      signal: ctrl.signal
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, message: `HTTP ${res.status} · ${body.slice(0, 200)}`, models: [] }
    }

    const json = (await res.json()) as {
      data?: { id?: string }[]
      models?: { name?: string; model?: string }[]
    }
    const ids = [
      ...(Array.isArray(json.data) ? json.data.map((m) => m?.id ?? '') : []),
      ...(Array.isArray(json.models) ? json.models.map((m) => m?.name ?? m?.model ?? '') : [])
    ]
      .map((s) => s.trim())
      .filter(Boolean)

    const models = [...new Set(ids)].sort()
    return {
      ok: true,
      message: models.length ? `拿到 ${models.length} 个模型` : '端点没有返回模型清单',
      models
    }
  } catch (e) {
    const err = e as Error
    return {
      ok: false,
      message: err.name === 'AbortError' ? '连接超时（15s）' : `获取失败：${err.message}`,
      models: []
    }
  } finally {
    clearTimeout(timer)
  }
}

// 下一步：流式对话。chat(wc, messages) 把 SSE 的 delta 逐段 send 给渲染层。