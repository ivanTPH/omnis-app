import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maxScoreFromBands, scoreForGrade } from './bands'
import { percentToGcseGrade } from '../grading'

test('maxScoreFromBands reads every band key style in use', () => {
  // Styles found in the database on 29 Oct 2026.
  assert.equal(maxScoreFromBands({ '1': 'a', '5': 'b', '9': 'c' }), 9)
  assert.equal(maxScoreFromBands({ '0-3': 'a', '4-6': 'b', '7-9': 'c' }), 9)
  assert.equal(maxScoreFromBands({ 'Low (1–3)': 'a', 'Mid (4–6)': 'b', 'High (7–9)': 'c' }), 9) // was 1
  assert.equal(maxScoreFromBands({ '0-2': 'a', '3-4': 'b' }), 4)
})

test('maxScoreFromBands falls back when bands are missing or name no scores', () => {
  assert.equal(maxScoreFromBands(null), 9)
  assert.equal(maxScoreFromBands({}), 9)
  assert.equal(maxScoreFromBands([1, 2]), 9)
  assert.equal(maxScoreFromBands({ Excellent: 'x' }, 100), 100)
  assert.equal(maxScoreFromBands({ '0': 'nothing' }), 9)
})

test('scoreForGrade gives a score the marking screen shows as the same grade', () => {
  for (const max of [9, 10, 20, 40, 100]) {
    for (let g = 1; g <= 9; g++) {
      const s = scoreForGrade(String(g), max)
      assert.ok(s >= 0 && s <= max)
      assert.equal(percentToGcseGrade(Math.round((s / max) * 100)), g, `max ${max}, grade ${g}`)
    }
  }
})

test('scoreForGrade handles U, bad input and coarse scales', () => {
  assert.equal(scoreForGrade('U', 9), 0)
  assert.equal(scoreForGrade('x', 9), 0)
  assert.equal(scoreForGrade('5', 0), 0)
  const s = scoreForGrade('5', 3) // no score out of 3 shows grade 5 exactly
  assert.ok(s >= 0 && s <= 3)
})
