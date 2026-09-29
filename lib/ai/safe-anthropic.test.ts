import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SafeAnthropic, nameDirectorySource } from './safe-anthropic'
import { buildDirectory } from './name-directory-core'

nameDirectorySource.load = async () =>
  buildDirectory([{ firstName: 'Sophia', lastName: 'Ahmed' }, { firstName: 'Jay', lastName: 'Patel' }])

let sentBody = ''
// A fake API that echoes the prompt it received, so we can check both what
// left Omnis and what the caller gets back.
const echoFetch = async (_url: unknown, init: { body: string }) => {
  sentBody = init.body
  const req = JSON.parse(init.body)
  const text = `Echo: ${req.messages[0].content} | system: ${req.system}`
  if (req.stream) {
    const events = [
      { type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: req.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      ...text.match(/.{1,3}/g)!.map((t) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } })),
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } },
      { type: 'message_stop' },
    ]
    const body = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }
  return new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: req.model, content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } })
}

test('create(): names never leave Omnis, and come back restored', async () => {
  const c = new SafeAnthropic({ apiKey: 'x', fetch: echoFetch as never })
  const res = await c.messages.create({ model: 'm', max_tokens: 10, system: 'Teacher is Mr Patel', messages: [{ role: 'user', content: 'Plan for Sophia Ahmed. Sophia likes maps.' }] })
  assert.ok(!/Sophia|Ahmed|Patel/.test(sentBody), sentBody)
  const block = res.content[0]
  assert.equal(block.type === 'text' ? block.text : '', 'Echo: Plan for Sophia Ahmed. Sophia likes maps. | system: Teacher is Mr Patel')
})

test('stream(): names never leave Omnis, and streamed text is restored', async () => {
  const c = new SafeAnthropic({ apiKey: 'x', fetch: echoFetch as never })
  const s = c.messages.stream({ model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'ILP for Sophia Ahmed' }] })
  let acc = ''
  for await (const ev of s) if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') acc += ev.delta.text
  assert.ok(!/Sophia|Ahmed/.test(sentBody), sentBody)
  assert.equal(acc, 'Echo: ILP for Sophia Ahmed | system: undefined')
})

test('fails closed when the name list cannot be loaded', async () => {
  const saved = nameDirectorySource.load
  nameDirectorySource.load = async () => { throw new Error('db down') }
  try {
    const c = new SafeAnthropic({ apiKey: 'x', fetch: echoFetch as never })
    sentBody = ''
    await assert.rejects(c.messages.create({ model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'Sophia Ahmed' }] }))
    assert.equal(sentBody, '')
  } finally {
    nameDirectorySource.load = saved
  }
})
