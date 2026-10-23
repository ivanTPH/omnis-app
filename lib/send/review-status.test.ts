import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getReviewStatus, reviewStatusLabel, compareByReviewDate, countByReviewState } from './review-status'

// "Today" fixed at a GMT (non-DST) date and a BST (DST) date, both at a
// time of day far from midnight, to prove the day count is calendar-day
// based in Europe/London rather than a raw 24h-bucket division.
const TODAY_GMT = new Date('2026-01-15T23:30:00Z') // 23:30 GMT on 15 Jan = still 15 Jan in London
const TODAY_BST = new Date('2026-06-15T23:30:00Z') // 23:30 UTC = 00:30 BST on 16 Jun in London

test('today is due_soon with daysUntil 0', () => {
  assert.deepEqual(getReviewStatus('2026-01-15T09:00:00Z', TODAY_GMT), { state: 'due_soon', daysUntil: 0 })
})

test('tomorrow is due_soon with daysUntil 1', () => {
  assert.deepEqual(getReviewStatus('2026-01-16T09:00:00Z', TODAY_GMT), { state: 'due_soon', daysUntil: 1 })
})

test('14 days ahead is still due_soon (inclusive boundary)', () => {
  assert.deepEqual(getReviewStatus('2026-01-29T09:00:00Z', TODAY_GMT), { state: 'due_soon', daysUntil: 14 })
})

test('15 days ahead is scheduled, not due_soon', () => {
  assert.deepEqual(getReviewStatus('2026-01-30T09:00:00Z', TODAY_GMT), { state: 'scheduled', daysUntil: 15 })
})

test('a past date is overdue with a negative daysUntil — never clamped to 0', () => {
  const status = getReviewStatus('2026-06-10T09:00:00Z', new Date('2026-10-23T12:00:00Z'))
  assert.equal(status.state, 'overdue')
  assert.equal(status.daysUntil, -135)
})

test('yesterday is overdue by 1 day', () => {
  assert.deepEqual(getReviewStatus('2026-01-14T09:00:00Z', TODAY_GMT), { state: 'overdue', daysUntil: -1 })
})

test('day counting uses Europe/London calendar days, not raw 24h buckets (GMT side)', () => {
  // Review date is late in the evening London-time on the 16th; "today" is
  // 23:30 UTC on the 15th. A naive ms-division would see <24h between the
  // two instants and could round to "0 days" or even a different day
  // depending on exact seconds; the calendar-day comparison must say 1.
  const status = getReviewStatus('2026-01-16T22:00:00Z', TODAY_GMT)
  assert.equal(status.daysUntil, 1)
})

test('day counting uses Europe/London calendar days, not raw 24h buckets (BST side)', () => {
  // "Today" is 00:30 BST on 16 Jun (23:30 UTC on 15 Jun). A review date of
  // 2026-06-16T22:00:00Z is 23:00 BST on the 16th — still the same London
  // calendar day as "today", so this must be daysUntil 0, not 1.
  const status = getReviewStatus('2026-06-16T22:00:00Z', TODAY_BST)
  assert.equal(status.daysUntil, 0)
})

test('reviewStatusLabel never shows a generic badge', () => {
  assert.equal(reviewStatusLabel(getReviewStatus('2026-01-15T09:00:00Z', TODAY_GMT)), 'Due today')
  assert.equal(reviewStatusLabel(getReviewStatus('2026-01-16T09:00:00Z', TODAY_GMT)), 'Due tomorrow')
  assert.equal(reviewStatusLabel(getReviewStatus('2026-01-20T09:00:00Z', TODAY_GMT)), 'Due in 5 days')
  assert.equal(reviewStatusLabel(getReviewStatus('2026-01-14T09:00:00Z', TODAY_GMT)), 'Overdue by 1 day')
  assert.equal(reviewStatusLabel(getReviewStatus('2026-01-05T09:00:00Z', TODAY_GMT)), 'Overdue by 10 days')
})

test('a custom due-soon window (e.g. EHCP\'s 28-day statutory warning) is respected', () => {
  assert.equal(getReviewStatus('2026-02-10T09:00:00Z', TODAY_GMT, 28).state, 'due_soon')
  assert.equal(getReviewStatus('2026-02-10T09:00:00Z', TODAY_GMT, 14).state, 'scheduled')
})

test('compareByReviewDate sorts overdue first, then soonest-due, with no separate overdue flag needed', () => {
  const dates = ['2026-01-20T09:00:00Z', '2026-01-05T09:00:00Z', '2026-01-16T09:00:00Z', '2026-01-10T09:00:00Z']
  const sorted = [...dates].sort(compareByReviewDate)
  assert.deepEqual(sorted, ['2026-01-05T09:00:00Z', '2026-01-10T09:00:00Z', '2026-01-16T09:00:00Z', '2026-01-20T09:00:00Z'])
  // The first two are overdue relative to TODAY_GMT (15 Jan); confirm they really are.
  assert.equal(getReviewStatus(sorted[0], TODAY_GMT).state, 'overdue')
  assert.equal(getReviewStatus(sorted[1], TODAY_GMT).state, 'overdue')
})

test('countByReviewState tallies overdue and due_soon independently', () => {
  const dates = [
    '2026-01-05T09:00:00Z', // overdue
    '2026-01-14T09:00:00Z', // overdue (yesterday)
    '2026-01-16T09:00:00Z', // due_soon
    '2026-02-01T09:00:00Z', // scheduled
  ]
  assert.equal(countByReviewState(dates, 'overdue', TODAY_GMT), 2)
  assert.equal(countByReviewState(dates, 'due_soon', TODAY_GMT), 1)
  assert.equal(countByReviewState(dates, 'scheduled', TODAY_GMT), 1)
})
