import { test } from 'node:test'
import assert from 'node:assert/strict'
import { majorityYear, teachersByClass } from './class-provisioning'

test('majorityYear picks the most common year and ignores blanks', () => {
  assert.equal(majorityYear([9, 9, 10, null, undefined]), 9)
  assert.equal(majorityYear([null, undefined]), null)
  assert.equal(majorityYear([10, 11]), 10) // tie → lower year
})

test('teachersByClass merges employee classes, timetable and class teacher', () => {
  const m = teachersByClass(new Map([['E1', ['C1', 'C2']]]), [
    { classId: 'C1', employeeId: 'E2' },
    { classId: 'C3', employeeId: null },
    { classId: 'C2', employeeId: 'E1' },
  ])
  assert.deepEqual([...m.get('C1')!].sort(), ['E1', 'E2'])
  assert.deepEqual([...m.get('C2')!], ['E1'])
  assert.equal(m.has('C3'), false)
})
