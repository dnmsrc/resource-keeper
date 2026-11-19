/**
 * 模型服务协议。
 *
 * 每家服务商的总线协议不一样：OpenAI 兼容端点走 /chat/completions，
 * Anthropic 是 /v1/messages，Gemini 又是另一套。界面上要把选择权交出去，
 * 但没实现的协议不能假装能跑 —— 所以 available 是给界面用的真话牌：
 * 灰掉并标注「尚未实现」，而不是选完在调用时才报错。
 */
export type ProtocolId = 'openai' | 'anthropic' | 'gemini'

export interface ProtocolDef {
  id: ProtocolId
  label: string
  /** 主进程目前实现了没有；false 的选项在界面上禁用 */
  available: boolean
  desc: string
}

export const PROTOCOLS: ProtocolDef[] = [
  {
    id: 'openai',
    label: 'OpenAI Chat Completions',
    available: true,
    desc: 'DeepSeek / 通义 DashScope / 火山方舟 / Ollama 的兼容端点都是这套'
  },
  {
    id: 'anthropic',
    label: 'Anthropic Messages',
    available: false,
    desc: '尚未接入，选了也调不通'
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    available: false,
    desc: '尚未接入，选了也调不通'
  }
]

export const DEFAULT_PROTOCOL: ProtocolId = 'openai'

export function isProtocolId(v: unknown): v is ProtocolId {
  return v === 'openai' || v === 'anthropic' || v === 'gemini'
}

export function isImplemented(id: string): boolean {
  return PROTOCOLS.some((p) => p.id === id && p.available)
}