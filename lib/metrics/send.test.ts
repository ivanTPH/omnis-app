import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getSendCounts } from './send'

const STUDENTS = [
  { studentId: 's1', activeStatus: 'NONE' as const },
  { studentId: 's2', activeStatus: 'SEN_SUPPORT' as const },
  { studentId: 's3', activeStatus: 'SEN_SUPPORT' as const },
  { studentId: 's4', activeStatus: 'EHCP' as const },
  { studentId: 's5', activeStatus: 'EHCP' as const },
  { studentId: 's6', activeStatus: 'EHCP' as const },
]

test('onRegister is SEN_SUPPORT + EHCP, excluding NONE', () => {
  const counts = getSendCounts(STUDENTS, [])
  assert.equal(counts.onRegister, 5)
  assert.equal(counts.senSupport, 2)
  assert.equal(counts.ehcp, 3)
})

test('activeIlp + noActiveIlp always sum to onRegister', () => {
  const counts = getSendCounts(STUDENTS, ['s2', 's4'])
  assert.equal(counts.activeIlp, 2)
  assert.equal(counts.noActiveIlp, 3)
  assert.equal(counts.activeIlp + counts.noActiveIlp, counts.onRegister)
})

test('an ILP on a NONE-status student does not count toward activeIlp', () => {
  // s1 is NONE status but (hypothetically) has a stray ILP record — it must
  // not inflate the on-register ILP coverage figure.
  const counts = getSendCounts(STUDENTS, ['s1', 's2'])
  assert.equal(counts.activeIlp, 1) // only s2 counts
})

test('everyone on register has an ILP', () => {
  const counts = getSendCounts(STUDENTS, ['s2', 's3', 's4', 's5', 's6'])
  assert.equal(counts.activeIlp, 5)
  assert.equal(counts.noActiveIlp, 0)
})

test('empty roster', () => {
  assert.deepEqual(getSendCounts([], []), { onRegister: 0, senSupport: 0, ehcp: 0, activeIlp: 0, noActiveIlp: 0 })
})
