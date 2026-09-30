import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchPupilsToAccounts } from './student-matching'
import { placeholderEmail, isPlaceholderEmail, isUsableEmail } from './placeholder'

const pupil = (id: string, f: string, l: string) => ({ id, firstName: f, lastName: l })
const acct = (id: string, f: string, l: string, wondeId: string | null = null) => ({ id, firstName: f, lastName: l, wondeId })

test('pupils already linked by Wonde ID keep their account, whatever their name', () => {
  const r = matchPupilsToAccounts([pupil('W1', 'Amy', 'Brown')], [acct('U1', 'Amelia', 'Brown-Smith', 'W1')])
  assert.equal(r.byWondeId.get('W1'), 'U1')
  assert.equal(r.claims.length, 0)
  assert.equal(r.unmatched.length, 0)
})

test('two pupils with the same name are never matched by name', () => {
  const r = matchPupilsToAccounts(
    [pupil('W1', 'John', 'Smith'), pupil('W2', 'John', 'Smith')],
    [acct('U1', 'John', 'Smith')],
  )
  assert.equal(r.claims.length, 0)
  assert.equal(r.byWondeId.size, 0)
  assert.equal(r.ambiguous.length, 2)
})

test('two legacy accounts with the same name are not claimed', () => {
  const r = matchPupilsToAccounts([pupil('W1', 'John', 'Smith')], [acct('U1', 'John', 'Smith'), acct('U2', 'John', 'Smith')])
  assert.equal(r.claims.length, 0)
  assert.deepEqual(r.ambiguous.map(p => p.id), ['W1'])
})

test('a unique name claims a legacy account once, case-insensitively', () => {
  const r = matchPupilsToAccounts([pupil('W1', 'Zoë', 'Adams')], [acct('U9', 'zoë', 'ADAMS')])
  assert.deepEqual(r.claims, [{ userId: 'U9', wondeId: 'W1' }])
  assert.equal(r.byWondeId.get('W1'), 'U9')
})

test('a legacy account already linked to another pupil is not reused', () => {
  const r = matchPupilsToAccounts(
    [pupil('W1', 'Sam', 'Lee'), pupil('W2', 'Sam', 'Lee')],
    [acct('U1', 'Sam', 'Lee', 'W1')],
  )
  assert.equal(r.byWondeId.get('W1'), 'U1')
  assert.deepEqual(r.unmatched.map(p => p.id), ['W2'])
})

test('pupils with no account are reported for creation', () => {
  const r = matchPupilsToAccounts([pupil('W5', 'New', 'Pupil')], [])
  assert.deepEqual(r.unmatched.map(p => p.id), ['W5'])
})

test('placeholder emails are recognised and never usable', () => {
  const e = placeholderEmail('A123:XY')
  assert.ok(isPlaceholderEmail(e))
  assert.equal(isUsableEmail(e), false)
  assert.equal(isUsableEmail('pupil@school.sch.uk'), true)
  assert.equal(isUsableEmail('not-an-email'), false)
  assert.equal(isPlaceholderEmail(null), true)
})
