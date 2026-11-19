/**
 * 模型服务调用。
 *
 * 不引 openai SDK：这里只走 /chat/completions 一个接口，和各家兼容端点
 * （OpenAI / DeepSeek / 通义 DashScope 兼容模式 / Ollama）的协议一致，
 * 原生 fetch 足够，少一个打包依赖。
 */
import { loadLlm, type LlmConfig } from './config'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface TestResult {
  ok: boolean
  message: string
}

function endpoint(cfg: LlmConfig): string {
  // 用户可能把 baseUrl 填成 .../v1/ ，去掉结尾斜杠免得拼出 //chat/completions
  return `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`
}

/**
 * 连通性测试：发一句最小请求，只看能不能拿到 200。
 * 非流式、max_tokens=1，几乎不花钱。
 */
export async function testConnection(): Promise<TestResult> {
  const cfg = loadLlm()
  if (!cfg.apiKey) return { ok: false, message: '还没填 API Key' }
  if (!cfg.baseUrl) return { ok: false, message: '还没填 Base URL' }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)

  try {
    const res = await fetch(endpoint(cfg), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      }),
      signal: ctrl.signal
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, message: `HTTP ${res.status} · ${body.slice(0, 220)}` }
    }
    return { ok: true, message: `连通正常 · ${cfg.model}` }
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