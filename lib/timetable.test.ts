import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startOfWeekUTC, dedupeTimetableEntries } from './timetable'

test('startOfWeekUTC returns Monday 00:00 UTC', () => {
  assert.equal(startOfWeekUTC(new Date('2026-10-25T08:00:00Z')).toISOString(), '2026-10-19T00:00:00.000Z') // Sunday
  assert.equal(startOfWeekUTC(new Date('2026-10-26T00:00:00Z')).toISOString(), '2026-10-26T00:00:00.000Z') // Monday
  assert.equal(startOfWeekUTC(new Date('2026-10-30T15:00:00Z')).toISOString(), '2026-10-26T00:00:00.000Z') // Friday
})

test('dedupeTimetableEntries keeps one row per class, period and teacher', () => {
  const rows = [
    { id: 'a', classId: 'c1', periodId: 'p1', employeeId: 't1' },
    { id: 'b', classId: 'c1', periodId: 'p1', employeeId: 't1' }, // same lesson, another week
    { id: 'c', classId: 'c1', periodId: 'p2', employeeId: 't1' },
    { id: 'd', classId: 'c2', periodId: 'p1', employeeId: 't2' },
    { id: 'e', classId: 'c2', periodId: 'p1', employeeId: null },
  ]
  assert.deepEqual(dedupeTimetableEntries(rows).map(r => r.id), ['a', 'c', 'd', 'e'])
})
