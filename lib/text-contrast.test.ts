import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// WCAG AA needs 4.5:1 for normal text. These Tailwind text colours fall below
// that on white (e.g. gray-400 is 2.6:1, amber-600 3.2:1, green-600 3.2:1),
// so they must not be used for text on light backgrounds. Use the shade noted
// instead. Decorative <Icon> / material-icons glyphs are aria-hidden and exempt.
//
// To use one deliberately (e.g. light text on a dark band), put a
// `contrast-ok` comment on the line or the line above, saying why.
const FAILING: Record<string, string> = {
  'gray-300': 'gray-500', 'gray-400': 'gray-500',
  'amber-500': 'amber-700', 'amber-600': 'amber-700',
  'green-500': 'green-700', 'green-600': 'green-700',
  'emerald-500': 'emerald-700', 'emerald-600': 'emerald-700',
  'blue-400': 'blue-600', 'blue-500': 'blue-600',
  'red-400': 'red-600', 'red-500': 'red-600',
  'rose-400': 'rose-600', 'rose-500': 'rose-600',
  'orange-500': 'orange-700', 'orange-600': 'orange-700',
  'purple-500': 'purple-600', 'indigo-500': 'indigo-600',
}
const TOKEN = new RegExp(`(?<![\\w-])((?:[a-z0-9-]+:)*)text-(${Object.keys(FAILING).join('|')})(?:/\\d+)?(?![\\w-])`, 'g')

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? tsxFiles(p) : p.endsWith('.tsx') ? [p] : []
  })
}

test('no text colour below WCAG AA contrast is used for text', () => {
  const offences: string[] = []
  for (const file of [...tsxFiles('app'), ...tsxFiles('components')]) {
    const src = readFileSync(file, 'utf8')
    const lines = src.split('\n')
    for (const m of src.matchAll(TOKEN)) {
      const at = m.index ?? 0
      if (m[1].startsWith('placeholder:')) continue
      const lineNo = src.slice(0, at).split('\n').length
      const line = lines[lineNo - 1]
      if (line.includes('contrast-ok') || lines[lineNo - 2]?.includes('contrast-ok')) continue
      if (line.includes('material-icons')) continue
      const lt = src.lastIndexOf('<', at), gt = src.lastIndexOf('>', at)
      if (lt > gt && /^<Icon\b/.test(src.slice(lt, at))) continue          // inside an <Icon …> tag
      if (/icon\w*\s*[:=]\s*['"`]?[^\n]*$/i.test(src.slice(Math.max(0, at - 120), at).split('\n').pop() ?? '')) continue
      if (/bg-(gray|slate)-(8|9)00/.test(line)) continue                    // on a dark surface
      offences.push(`${file}:${lineNo} text-${m[2]} → use text-${FAILING[m[2]]}`)
    }
  }
  assert.deepEqual(offences, [], `Low-contrast text colours found:\n${offences.join('\n')}`)
})
