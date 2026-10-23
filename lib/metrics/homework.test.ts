import { test } from 'node:test'
import assert from 'node:assert/strict'
import { needsMarking, getAssignmentCounts, getToMarkTotals, getHomeworkStatus } from './homework'

test('needsMarking is true for every status except RETURNED', () => {
  assert.equal(needsMarking('SUBMITTED'), true)
  assert.equal(needsMarking('UNDER_REVIEW'), true)
  assert.equal(needsMarking('RESUBMISSION_REQ'), true)
  assert.equal(needsMarking('MARKED'), true) // auto-marked but not yet returned — still needs teacher action
  assert.equal(needsMarking('RETURNED'), false)
})

test('getAssignmentCounts splits submitted into marked vs to-mark', () => {
  const counts = getAssignmentCounts(28, [
    ...Array(10).fill({ status: 'RETURNED' }),
    ...Array(8).fill({ status: 'MARKED' }),         // auto-marked, awaiting teacher review
    ...Array(10).fill({ status: 'SUBMITTED' }),
  ])
  assert.deepEqual(counts, { expected: 28, submitted: 28, marked: 10, toMark: 18 })
})

test('getAssignmentCounts: expected can exceed submitted (pupils who never submitted)', () => {
  const counts = getAssignmentCounts(30, [{ status: 'RETURNED' }, { status: 'SUBMITTED' }])
  assert.deepEqual(counts, { expected: 30, submitted: 2, marked: 1, toMark: 1 })
})

test('getAssignmentCounts with no submissions at all', () => {
  assert.deepEqual(getAssignmentCounts(25, []), { expected: 25, submitted: 0, marked: 0, toMark: 0 })
})

test('getToMarkTotals reports distinct assignments and total scripts separately', () => {
  const perAssignment = [
    getAssignmentCounts(28, [...Array(10).fill({ status: 'RETURNED' }), ...Array(18).fill({ status: 'MARKED' })]),
    getAssignmentCounts(20, [...Array(20).fill({ status: 'RETURNED' })]), // nothing outstanding
    getAssignmentCounts(15, [...Array(1).fill({ status: 'SUBMITTED' })]),
  ]
  assert.deepEqual(getToMarkTotals(perAssignment), { assignments: 2, scripts: 19 })
})

const PUBLISHED_DUE_TODAY = { homeworkStatus: 'PUBLISHED' as const, dueAt: '2026-10-23T09:00:00Z', submissionStatus: null }
const NOW = new Date('2026-10-23T15:00:00Z')

test('a draft homework is draft regardless of due date or submission', () => {
  assert.equal(getHomeworkStatus({ ...PUBLISHED_DUE_TODAY, homeworkStatus: 'DRAFT', submissionStatus: 'RETURNED' }, NOW), 'draft')
})

test('open: published, due in the future, not submitted', () => {
  assert.equal(getHomeworkStatus({ ...PUBLISHED_DUE_TODAY, dueAt: '2026-10-30T09:00:00Z' }, NOW), 'open')
})

test('due_today: due date is today (London calendar day), not submitted', () => {
  assert.equal(getHomeworkStatus(PUBLISHED_DUE_TODAY, NOW), 'due_today')
})

test('overdue: due date has passed and the pupil has not submitted', () => {
  assert.equal(getHomeworkStatus({ ...PUBLISHED_DUE_TODAY, dueAt: '2026-10-01T09:00:00Z' }, NOW), 'overdue')
})

test('submitted: has a submission, not yet returned — never overdue once submitted', () => {
  const result = getHomeworkStatus({ ...PUBLISHED_DUE_TODAY, dueAt: '2026-10-01T09:00:00Z', submissionStatus: 'SUBMITTED' }, NOW)
  assert.equal(result, 'submitted')
})

test('marked: fully submitted and returned, even for a homework long past due — never "Overdue"', () => {
  const result = getHomeworkStatus({ ...PUBLISHED_DUE_TODAY, dueAt: '2026-01-01T09:00:00Z', submissionStatus: 'RETURNED' }, NOW)
  assert.equal(result, 'marked')
})

test('auto-marked-but-not-returned is "submitted", not "marked" — still needs teacher action', () => {
  const result = getHomeworkStatus({ ...PUBLISHED_DUE_TODAY, dueAt: '2026-01-01T09:00:00Z', submissionStatus: 'MARKED' }, NOW)
  assert.equal(result, 'submitted')
})

test('closed: assignment closed, pupil never submitted — distinct from overdue', () => {
  const result = getHomeworkStatus({ ...PUBLISHED_DUE_TODAY, homeworkStatus: 'CLOSED', dueAt: '2026-01-01T09:00:00Z' }, NOW)
  assert.equal(result, 'closed')
})

test('a submission always wins over "closed" — a late-accepted submission is not stuck as closed', () => {
  const result = getHomeworkStatus({ ...PUBLISHED_DUE_TODAY, homeworkStatus: 'CLOSED', dueAt: '2026-01-01T09:00:00Z', submissionStatus: 'RETURNED' }, NOW)
  assert.equal(result, 'marked')
})
