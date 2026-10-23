import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeFromScore, averageGrade, weightedClassAverage, roundGrade, maxScoreFromBands } from './grades'

test('maxScoreFromBands reads the highest number across all band keys', () => {
  assert.equal(maxScoreFromBands({ '0-3': 'x', '4-6': 'y', '7-9': 'z' }), 9)
  assert.equal(maxScoreFromBands({ '0-5': 'x', '6-10': 'y', '11-15': 'z', '16-20': 'w', '21-25': 'v' }), 25)
  assert.equal(maxScoreFromBands({ '5': 'x', '4': 'y', '3': 'z', '2': 'w', '1': 'v' }), 5)
})

test('maxScoreFromBands defaults to 9 when there are no bands', () => {
  assert.equal(maxScoreFromBands(null), 9)
  assert.equal(maxScoreFromBands(undefined), 9)
  assert.equal(maxScoreFromBands({}), 9)
  assert.equal(maxScoreFromBands('not an object'), 9)
})

test('maxScoreFromBands handles an en-dash range separator', () => {
  assert.equal(maxScoreFromBands({ '0–5': 'x', '6–10': 'y' }), 10)
})

test('gradeFromScore normalises to the submission\'s own max score, not a universal 0-9 scale', () => {
  // 7/9 is a strong grade (78%) -> GCSE 7
  assert.equal(gradeFromScore(7, 9), 7)
  // 7/25 is a weak grade (28%) -> GCSE 2, even though the raw number "7" is the same
  assert.equal(gradeFromScore(7, 25), 2)
  // 18/20 is 90% -> top grade
  assert.equal(gradeFromScore(18, 20), 9)
})

test('gradeFromScore returns null for an unmarked submission', () => {
  assert.equal(gradeFromScore(null, 9), null)
})

test('gradeFromScore guards against a zero or negative max score', () => {
  assert.equal(gradeFromScore(5, 0), null)
  assert.equal(gradeFromScore(5, -1), null)
})

test('averageGrade mixes homeworks with different max scores correctly', () => {
  // One essay (7/9 = 78% -> grade 7) and one quiz (14/25 = 56% -> grade 5).
  // A naive average of raw scores would wrongly give (7+14)/2 = 10.5.
  // The correct average-of-grades is (7+5)/2 = 6.
  const result = averageGrade([
    { finalScore: 7,  maxScore: 9 },
    { finalScore: 14, maxScore: 25 },
  ])
  assert.equal(result, 6)
})

test('averageGrade ignores unmarked submissions', () => {
  const result = averageGrade([
    { finalScore: 9, maxScore: 9 },
    { finalScore: null, maxScore: 9 },
  ])
  assert.equal(result, 9)
})

test('averageGrade returns null when nothing is marked', () => {
  assert.equal(averageGrade([{ finalScore: null, maxScore: 9 }]), null)
  assert.equal(averageGrade([]), null)
})

test('averageGrade rounds to 1 decimal place consistently', () => {
  // grades 7, 7, 6 -> 20/3 = 6.666... -> 6.7
  const result = averageGrade([
    { finalScore: 7, maxScore: 9 },
    { finalScore: 7, maxScore: 9 },
    { finalScore: 6, maxScore: 9 },
  ])
  assert.equal(result, 6.7)
})

test('weightedClassAverage weights a large class more than a small one', () => {
  // A 30-pupil class averaging grade 5 and a 1-pupil class averaging grade 9.
  // A plain mean of the two class averages would give (5+9)/2 = 7.
  // The correct, size-weighted figure is much closer to the large class: (5*30 + 9*1) / 31.
  const result = weightedClassAverage([
    { avgScore: 5, studentCount: 30 },
    { avgScore: 9, studentCount: 1 },
  ])
  assert.equal(result, roundGrade((5 * 30 + 9 * 1) / 31))
  assert.ok(result! < 6, 'weighted result should stay close to the large class, not the midpoint')
})

test('weightedClassAverage matches a plain mean when every class is the same size', () => {
  const result = weightedClassAverage([
    { avgScore: 6, studentCount: 20 },
    { avgScore: 8, studentCount: 20 },
  ])
  assert.equal(result, 7)
})

test('weightedClassAverage skips classes with no average or no students', () => {
  const result = weightedClassAverage([
    { avgScore: 6, studentCount: 20 },
    { avgScore: null, studentCount: 15 },
    { avgScore: 9, studentCount: 0 },
  ])
  assert.equal(result, 6)
})

test('weightedClassAverage returns null when there is nothing usable', () => {
  assert.equal(weightedClassAverage([]), null)
  assert.equal(weightedClassAverage([{ avgScore: null, studentCount: 10 }]), null)
})

test('roundGrade is the single rounding rule used everywhere', () => {
  assert.equal(roundGrade(6.666666), 6.7)
  assert.equal(roundGrade(6.0), 6)
  assert.equal(roundGrade(6.25), 6.3) // JS rounds .25*10=62.5 -> 63 -> 6.3 (round-half-up)
})
