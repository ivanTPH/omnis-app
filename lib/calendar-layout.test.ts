import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutOverlaps } from './calendar-layout'

const h = (n: number) => n * 3_600_000

test('non-overlapping events each take the full width', () => {
  const m = layoutOverlaps([
    { id: 'a', start: h(9),  end: h(10) },
    { id: 'b', start: h(10), end: h(11) }, // touches, does not overlap
  ])
  assert.deepEqual(m.get('a'), { col: 0, cols: 1 })
  assert.deepEqual(m.get('b'), { col: 0, cols: 1 })
})

test('two lessons in the same slot sit side by side', () => {
  const m = layoutOverlaps([
    { id: 'a', start: h(9), end: h(10) },
    { id: 'b', start: h(9), end: h(10) },
  ])
  assert.deepEqual(m.get('a'), { col: 0, cols: 2 })
  assert.deepEqual(m.get('b'), { col: 1, cols: 2 })
})

test('a chain of overlaps shares one cluster; freed columns are reused', () => {
  const m = layoutOverlaps([
    { id: 'a', start: h(9),   end: h(10) },
    { id: 'b', start: h(9.5), end: h(10.5) },
    { id: 'c', start: h(10),  end: h(11) },   // a has ended, so c reuses column 0
    { id: 'd', start: h(12),  end: h(13) },   // separate cluster
  ])
  assert.deepEqual(m.get('a'), { col: 0, cols: 2 })
  assert.deepEqual(m.get('b'), { col: 1, cols: 2 })
  assert.deepEqual(m.get('c'), { col: 0, cols: 2 })
  assert.deepEqual(m.get('d'), { col: 0, cols: 1 })
})
