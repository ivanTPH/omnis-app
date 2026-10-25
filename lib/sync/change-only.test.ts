import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stableHash, writeIfChanged, differs } from './change-only'

test('hash ignores key order, timestamps and undefined', () => {
  const a = stableHash({ b: 1, a: 'x', syncedAt: new Date(1), updatedAt: new Date(2), c: undefined })
  const b = stableHash({ a: 'x', b: 1, syncedAt: new Date(99) })
  assert.equal(a, b)
})

test('hash changes when data changes; dates compare by value', () => {
  assert.notEqual(stableHash({ a: 1 }), stableHash({ a: 2 }))
  assert.equal(stableHash({ d: new Date('2026-01-01') }), stableHash({ d: new Date('2026-01-01') }))
  assert.notEqual(stableHash({ d: new Date('2026-01-01') }), stableHash({ d: new Date('2026-01-02') }))
})

test('writeIfChanged writes new and changed rows only', async () => {
  const prev = new Map<string, string | null>()
  const writes: string[] = []
  const counts = { written: 0, unchanged: 0 }
  const w = async (c: Record<string, unknown>) => { writes.push(String(c.name)) }
  await writeIfChanged(prev, 'k', { name: 'A' }, { name: 'A' }, w, counts)       // new
  await writeIfChanged(prev, 'k', { name: 'A', syncedAt: new Date() }, {}, w, counts) // unchanged
  await writeIfChanged(prev, 'k', { name: 'B' }, { name: 'B' }, w, counts)       // changed
  assert.deepEqual(writes, ['A', 'B'])
  assert.deepEqual(counts, { written: 2, unchanged: 1 })
})

test('differs compares only the given fields', () => {
  assert.equal(differs({ a: 1, b: 2 }, { a: 1 }), false)
  assert.equal(differs({ a: 1 }, { a: 2 }), true)
  assert.equal(differs(undefined, { a: 1 }), true)
  assert.equal(differs({ d: new Date('2026-01-01') }, { d: new Date('2026-01-01') }), false)
  assert.equal(differs({ a: null }, { a: undefined }), false)
})
