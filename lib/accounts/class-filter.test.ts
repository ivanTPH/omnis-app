import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterMisClasses, formClassesFromPupils, isFormClass, parseClassImport, FORM_SUBJECT } from './class-filter'

const forms = new Set(['10a', '10b'])
const cls = (id: string, name: string, subject: string | null) => ({ id, name, subject, yearGroup: 10, pupilIds: ['p1'] })

test('parseClassImport defaults and cleans', () => {
  assert.deepEqual(parseClassImport(null), { formGroups: true, excludedSubjects: [] })
  assert.deepEqual(parseClassImport({ formGroups: false, excludedSubjects: [' Music ', 'music', 3] }), { formGroups: false, excludedSubjects: ['music'] })
})

test('isFormClass by subject or by form name', () => {
  assert.equal(isFormClass(cls('a', '10A', 'Maths'), forms), true)
  assert.equal(isFormClass(cls('a', '7X', 'Registration'), forms), true)
  assert.equal(isFormClass(cls('a', '7X', 'Tutor Group'), forms), true)
  assert.equal(isFormClass(cls('a', '10A/Ma1', 'Maths'), forms), false)
})

test('filterMisClasses keeps teaching, applies form and subject choices', () => {
  const all = [cls('1', '10A/Ma1', 'Maths'), cls('2', '10A/Mu1', 'Music'), cls('3', '10A', 'Registration')]
  const on = filterMisClasses(all, { formGroups: true, excludedSubjects: ['music'] }, forms)
  assert.deepEqual(on.included.map(c => c.id), ['1', '3'])
  assert.equal(on.included[1].subject, FORM_SUBJECT)
  assert.equal(on.excludedSubjects, 1)
  const off = filterMisClasses(all, { formGroups: false, excludedSubjects: [] }, forms)
  assert.deepEqual(off.included.map(c => c.id), ['1', '2'])
  assert.equal(off.excludedForms, 1)
})

test('formClassesFromPupils builds missing forms only', () => {
  const pupils = [
    { id: 'a', formGroup: '10A', yearGroup: 10 }, { id: 'b', formGroup: '10A', yearGroup: 10 },
    { id: 'c', formGroup: '10B', yearGroup: 10 }, { id: 'd', formGroup: null, yearGroup: 10 },
  ]
  const out = formClassesFromPupils('s1', pupils, new Set(['10b']))
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'form:s1:10a')
  assert.deepEqual(out[0].pupilIds, ['a', 'b'])
})
