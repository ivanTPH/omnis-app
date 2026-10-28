/**
 * A minimal model-call interface for homework generation.
 *
 * Every step of generation (single pass, planner, writer, checker) goes
 * through `Llm`, so the steps can be unit-tested with a fake and the real
 * implementation stays a thin adapter over SafeAnthropic — which
 * pseudonymises names before anything leaves Omnis.
 */
import type { SafeAnthropic } from '@/lib/ai/safe-anthropic'

export const MODELS = {
  writer:  'claude-sonnet-4-6',
  planner: 'claude-haiku-4-5-20251001',
} as const

export type LlmMessage = { role: 'user' | 'assistant'; content: string }
export type LlmRequest = {
  model:      string
  system:     string
  messages:   LlmMessage[]
  maxTokens:  number
}
/** Returns the reply text. `onChars` (optional) receives the running length while streaming. */
export type Llm = (req: LlmRequest, onChars?: (chars: number) => void) => Promise<string>

export function anthropicLlm(client: SafeAnthropic): Llm {
  return async (req, onChars) => {
    const params = { model: req.model, max_tokens: req.maxTokens, system: req.system, messages: req.messages }
    if (!onChars) {
      const msg = await client.messages.create(params)
      return msg.content.map(b => (b.type === 'text' ? b.text : '')).join('')
    }
    let text = ''
    const stream = client.messages.stream(params)
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        text += event.delta.text
        onChars(text.length)
      }
    }
    return text
  }
}
