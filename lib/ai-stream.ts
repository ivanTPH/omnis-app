/**
 * Client-side helper for consuming SSE streams from /api/ai/* route handlers.
 * Safe to import from Client Components — no server-only code here.
 */

export type AiStreamEvent =
  | { type: 'progress'; message: string; pct: number }
  | { type: 'done'; data: unknown }
  | { type: 'error'; message: string }

/**
 * POST to a streaming AI endpoint and consume SSE events.
 *
 * @param url          Route handler path (e.g. '/api/ai/generate-homework')
 * @param body         JSON body sent as POST payload
 * @param onProgress   Called for each progress event with (message, pct 0–100)
 * @returns            The `data` payload from the `done` event
 * @throws             Error if the server emits an `error` event or the request fails
 */
export async function streamAiRequest<T>(
  url: string,
  body: object,
  onProgress: (message: string, pct: number) => void,
): Promise<T> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(text || `Request failed: ${resp.status}`)
  }

  const reader = resp.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      let event: AiStreamEvent
      try {
        event = JSON.parse(line.slice(6))
      } catch {
        continue
      }
      if (event.type === 'progress') {
        onProgress(event.message, event.pct)
      } else if (event.type === 'done') {
        reader.cancel()
        return event.data as T
      } else if (event.type === 'error') {
        reader.cancel()
        throw new Error(event.message)
      }
    }
  }

  throw new Error('Stream ended without a result event')
}
