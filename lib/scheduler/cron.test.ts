import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cronMatches } from './cron'
import { SCHEDULED_JOBS } from './jobs'

const at = (iso: string) => new Date(iso)

test('matches exact minute and hour (UTC)', () => {
  assert.ok(cronMatches('15 1 * * *', at('2026-10-01T01:15:00Z')))
  assert.ok(!cronMatches('15 1 * * *', at('2026-10-01T01:16:00Z')))
})

test('weekday ranges and lists', () => {
  assert.ok(cronMatches('0 6 * * 1-5', at('2026-10-02T06:00:00Z')))   // Friday
  assert.ok(!cronMatches('0 6 * * 1-5', at('2026-10-03T06:00:00Z')))  // Saturday
  assert.ok(cronMatches('0 7 * * 1,3', at('2026-09-30T07:00:00Z')))   // Wednesday
})

test('Sunday as 0 or 7, monthly and yearly', () => {
  assert.ok(cronMatches('0 2 * * 0', at('2026-10-04T02:00:00Z')))
  assert.ok(cronMatches('0 2 * * 7', at('2026-10-04T02:00:00Z')))
  assert.ok(cronMatches('0 8 1 * *', at('2026-11-01T08:00:00Z')))
  assert.ok(cronMatches('0 1 1 9 *', at('2027-09-01T01:00:00Z')))
  assert.ok(!cronMatches('0 1 1 9 *', at('2027-10-01T01:00:00Z')))
})

test('steps', () => {
  assert.ok(cronMatches('*/15 * * * *', at('2026-10-01T10:45:00Z')))
  assert.ok(!cronMatches('*/15 * * * *', at('2026-10-01T10:46:00Z')))
})

test('every scheduled job has a valid expression and a cron path', () => {
  for (const j of SCHEDULED_JOBS) {
    assert.equal(j.cron.trim().split(/\s+/).length, 5, j.path)
    assert.ok(j.path.startsWith('/api/cron/'), j.path)
  }
  assert.equal(new Set(SCHEDULED_JOBS.map(j => j.path)).size, SCHEDULED_JOBS.length)
})
