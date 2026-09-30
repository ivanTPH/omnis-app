import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fingerprint } from './snapshot'

test('fingerprint ignores key order', () => {
  assert.equal(fingerprint({ a: 1, b: { c: 2, d: 3 } }), fingerprint({ b: { d: 3, c: 2 }, a: 1 }))
})

test('fingerprint changes when any value changes', () => {
  const base = { ilp: { targets: [{ id: 't1', achieved: false }] } }
  assert.notEqual(fingerprint(base), fingerprint({ ilp: { targets: [{ id: 't1', achieved: true }] } }))
})

test('fingerprint treats equal dates as equal', () => {
  assert.equal(fingerprint({ d: new Date('2026-09-30T10:00:00Z') }), fingerprint({ d: new Date('2026-09-30T10:00:00Z') }))
  assert.notEqual(fingerprint({ d: new Date('2026-09-30T10:00:00Z') }), fingerprint({ d: new Date('2026-10-01T10:00:00Z') }))
})
