/**
 * SafeAnthropic — the only way Omnis code should talk to the AI provider.
 *
 * A drop-in subclass of the Anthropic SDK client. `messages.create()` and
 * `messages.stream()` pseudonymise every text part of the request (system
 * prompt and messages) before it leaves Omnis, and restore real names in the
 * response. See lib/ai/pseudonymise.ts for what is replaced.
 *
 * Fails closed: if the name list cannot be loaded, the request is not sent.
 *
 * Enforced by lib/ai/gateway.test.ts, which fails if any file outside lib/ai
 * constructs `new Anthropic(` directly.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { ClientOptions } from '@anthropic-ai/sdk'
import { Pseudonymiser, StreamRestorer } from './pseudonymise'
import { getNameDirectory } from './name-directory'

type CreateParams = Parameters<Anthropic['messages']['create']>[0]
type CreateOpts = Parameters<Anthropic['messages']['create']>[1]
type StreamParams = Parameters<Anthropic['messages']['stream']>[0]
type StreamOpts = Parameters<Anthropic['messages']['stream']>[1]

function disabled(): boolean {
  return process.env.AI_PSEUDONYMISE === 'off' && process.env.NODE_ENV !== 'production'
}

/** Where the name list comes from. Overridable in tests only. */
export const nameDirectorySource = { load: getNameDirectory }

async function newPseudonymiser(): Promise<Pseudonymiser> {
  try {
    return new Pseudonymiser(await nameDirectorySource.load())
  } catch (err) {
    console.error('[safe-anthropic] name directory unavailable — refusing to send', err)
    throw new Error('AI features are temporarily unavailable. Please try again shortly.')
  }
}

/** Redact every text part of a request. Non-text parts (images, documents) pass unchanged. */
export function redactParams<T extends { system?: unknown; messages: unknown[] }>(params: T, p: Pseudonymiser): T {
  const redactBlocks = (content: unknown): unknown => {
    if (typeof content === 'string') return p.redact(content)
    if (Array.isArray(content)) {
      return content.map((b) =>
        b && typeof b === 'object' && (b as { type?: string }).type === 'text'
          ? { ...(b as object), text: p.redact((b as { text: string }).text) }
          : b,
      )
    }
    return content
  }
  return {
    ...params,
    system: params.system === undefined ? undefined : redactBlocks(params.system),
    messages: params.messages.map((m) =>
      m && typeof m === 'object' ? { ...(m as object), content: redactBlocks((m as { content: unknown }).content) } : m,
    ),
  }
}

/** Restore names in every string of a response value (text blocks, tool input JSON). */
export function restoreDeep<T>(value: T, p: Pseudonymiser): T {
  if (typeof value === 'string') return p.restore(value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => restoreDeep(v, p)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = restoreDeep(v, p)
    return out as T
  }
  return value
}

export class SafeAnthropic extends Anthropic {
  constructor(opts?: ClientOptions) {
    super(opts)
    const messages = this.messages
    const origCreate = messages.create.bind(messages)
    const origStream = messages.stream.bind(messages)

    const safeCreate = (params: CreateParams, options?: CreateOpts) => {
      // The SDK's own stream() calls create({ stream: true }) internally with
      // the params we have already redacted below, and needs the raw
      // APIPromise back — so pass that path straight through. Omnis code must
      // not call create({ stream: true }) itself (checked by gateway.test.ts).
      if (disabled() || (params as { stream?: boolean }).stream) return origCreate(params, options)
      return (async () => {
        const p = await newPseudonymiser()
        const res = await origCreate(redactParams(params, p), options)
        return restoreDeep(res, p)
      })()
    }

    const safeStream = (params: StreamParams, options?: StreamOpts) => {
      if (disabled()) return origStream(params, options)
      // The SDK's stream() is synchronous, but loading the name list is not,
      // so return an async iterable that starts the real stream once ready.
      // Omnis only consumes streams with `for await`.
      return {
        async *[Symbol.asyncIterator]() {
          const p = await newPseudonymiser()
          const restorer = new StreamRestorer(p)
          const inner = origStream(redactParams(params, p), options)
          for await (const event of inner) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const text = restorer.push(event.delta.text)
              if (text) yield { ...event, delta: { ...event.delta, text } }
              continue
            }
            if (event.type === 'content_block_stop') {
              const rest = restorer.flush()
              if (rest) {
                yield { type: 'content_block_delta', index: event.index, delta: { type: 'text_delta', text: rest } } as unknown as typeof event
              }
            }
            yield restoreDeep(event, p)
          }
        },
      }
    }

    // Replace the two entry points on this instance only.
    ;(messages as unknown as { create: unknown }).create = safeCreate
    ;(messages as unknown as { stream: unknown }).stream = safeStream
  }
}
