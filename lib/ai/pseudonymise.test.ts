import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Pseudonymiser, StreamRestorer } from './pseudonymise'
import { buildDirectory } from './name-directory-core'

const dir = buildDirectory([
  { firstName: 'Sophia', lastName: 'Ahmed' },
  { firstName: 'Rehan', lastName: 'Ali' },
  { firstName: 'Jay', lastName: 'Patel' },
  { firstName: 'Mark', lastName: 'Evans' },
  { firstName: 'Grace', lastName: 'Hughes' },
  { firstName: 'Mary Anne', lastName: 'Smith' },
])

test('replaces full names, first names and title+surname, and restores them', () => {
  const p = new Pseudonymiser(dir)
  const input = 'Student: Sophia Ahmed. Sophia has dyslexia. Raised by Mr Patel. Sophia’s ILP.'
  const out = p.redact(input)
  assert.ok(!out.includes('Sophia'), out)
  assert.ok(!out.includes('Ahmed'), out)
  assert.ok(!out.includes('Patel'), out)
  assert.equal(p.restore(out), input)
})

test('leaves everyday words that are also names alone unless part of a full name', () => {
  const p = new Pseudonymiser(dir)
  const out = p.redact('Use the Mark scheme. Grace period applies. Mark Evans and Grace Hughes were absent.')
  assert.ok(out.startsWith('Use the Mark scheme. Grace period applies.'), out)
  assert.ok(!out.includes('Evans') && !out.includes('Hughes'), out)
})

test('removes email addresses and UK phone numbers', () => {
  const p = new Pseudonymiser(dir)
  const out = p.redact('Contact mum on 07700 900123 or mum@example.com, year 2026, score 85.')
  assert.ok(!out.includes('07700') && !out.includes('@example.com'), out)
  assert.ok(out.includes('2026') && out.includes('85'), out)
})

test('handles multi-word first names', () => {
  const p = new Pseudonymiser(dir)
  const out = p.redact('Mary Anne Smith needs support. Mary will sit at the front.')
  assert.ok(!out.includes('Smith') && !out.includes('Mary'), out)
  assert.equal(p.restore(out), 'Mary Anne Smith needs support. Mary will sit at the front.')
})

test('the same name gets the same code across strings in one request', () => {
  const p = new Pseudonymiser(dir)
  const a = p.redact('Rehan Ali')
  const b = p.redact('Report for Rehan Ali')
  assert.ok(b.endsWith(a), `${a} / ${b}`)
})

test('restores codes even when the model drops the brackets', () => {
  const p = new Pseudonymiser(dir)
  const code = p.redact('Rehan Ali')
  const bare = code.replace('[', '').replace(']', '')
  assert.equal(p.restore(`${bare} should sit near the front.`), 'Rehan Ali should sit near the front.')
})

test('stream restorer handles codes split across chunks', () => {
  const p = new Pseudonymiser(dir)
  const code = p.redact('Sophia Ahmed') // e.g. [N1]
  const r = new StreamRestorer(p)
  const text = `Targets for ${code}: read daily. ${code}'s review is in May.`
  let out = ''
  for (let i = 0; i < text.length; i += 3) out += r.push(text.slice(i, i + 3))
  out += r.flush()
  assert.equal(out, "Targets for Sophia Ahmed: read daily. Sophia Ahmed's review is in May.")
})

test('handles apostrophes and accented names', () => {
  const d = buildDirectory([
    { firstName: 'Sean', lastName: "O'Brien" },
    { firstName: 'Zoë', lastName: 'Martínez' },
  ])
  const p = new Pseudonymiser(d)
  const input = "Sean O'Brien and Zoë Martínez. Zoë's target. Sean's target."
  const out = p.redact(input)
  assert.ok(!/Sean|O'Brien|Zoë|Martínez/.test(out), out)
  assert.equal(p.restore(out), input)
})
