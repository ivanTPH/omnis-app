import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Every AI call must go through lib/ai/safe-anthropic.ts so pupil names are
// pseudonymised. This test fails if any code constructs the raw SDK client.
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

test('no code outside lib/ai constructs the Anthropic client directly', () => {
  const offenders = [...walk('app'), ...walk('lib'), ...walk('components')]
    .filter((f) => !f.startsWith(join('lib', 'ai')))
    .filter((f) => /new\s+Anthropic\s*\(/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders, [], `Use SafeAnthropic from lib/ai/safe-anthropic instead: ${offenders.join(', ')}`)
})

test('no code calls messages.create({ stream: true }) — streaming must use messages.stream()', () => {
  const offenders = [...walk('app'), ...walk('lib')]
    .filter((f) => !f.startsWith(join('lib', 'ai')))
    .filter((f) => /messages\.create\([\s\S]{0,400}?stream:\s*true/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders, [], offenders.join(', '))
})
