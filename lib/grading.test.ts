import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gradeLabel } from './grading'
import { formatGrade, formatRawScore, formatAvgGrade } from './gradeUtils'

test('gradeLabel never includes a letter equivalent', () => {
  for (let g = 1; g <= 9; g++) {
    assert.doesNotMatch(gradeLabel(g), /[A-Za-z]/)
  }
  assert.equal(gradeLabel(null), 'U')
})

test('formatGrade / formatRawScore / formatAvgGrade never include a GCSE letter equivalent', () => {
  for (let g = 1; g <= 9; g++) {
    assert.doesNotMatch(formatGrade(g), /\([A-Za-z*+]+\)/)
    assert.doesNotMatch(formatRawScore(g), /\([A-Za-z*+]+\)/)
    assert.doesNotMatch(formatAvgGrade(g).main, /\([A-Za-z*+]+\)/)
  }
})

// Repo-wide regression guard, same pattern as lib/ai/gateway.test.ts: walk
// every source file and fail if a GCSE letter-equivalent table or inline
// "9 (A**)"-style label has crept back in. A short allowlist covers
// genuinely unrelated matches (the AI grading-rubric prompt in
// homework.ts, which instructs the model and is never rendered to a
// user, and wonde-sync.ts, which parses incoming MIS grade letters).
const ALLOWLIST = [
  join('app', 'actions', 'homework.ts'),
  join('lib', 'wonde-sync.ts'),
  join('lib', 'grading.test.ts'),
  join('lib', 'grading.ts'), // explanatory comment only, no code
]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

test('no GCSE letter-equivalent table exists outside the allowlist', () => {
  // Matches the "9:'A**',8:'A*',7:'A',..." / "['','F','E','D',...]" shapes
  // that every removed GCSE_LETTERS-style table used, in either object or
  // array form — this is specific enough not to flag unrelated code.
  const pattern = /9\s*:\s*['"]A\*\*['"]|\[\s*['"]{1,2}\s*,\s*['"]F['"]/
  const offenders = [...walk('app'), ...walk('lib'), ...walk('components')]
    .filter(f => !ALLOWLIST.includes(f))
    .filter(f => pattern.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders, [], `GCSE letter table found in: ${offenders.join(', ')}`)
})
