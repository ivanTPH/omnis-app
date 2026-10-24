// Reads Playwright's JSON report and emits GitHub annotations summarising every
// failed and flaky test. GitHub only shows workflow logs to signed-in users, but
// annotations are readable through the API, so this makes CI failures
// diagnosable without opening the log viewer. Each annotation message is capped
// at ~4KB by GitHub, so the summary is grouped and split across several.
import { readFileSync, existsSync } from 'node:fs'

const file = process.argv[2] ?? 'e2e-results.json'
if (!existsSync(file)) {
  console.log(`::warning title=E2E report missing::${file} not found`)
  process.exit(0)
}

const report = JSON.parse(readFileSync(file, 'utf8'))
const failed = []
const flaky = []

const clean = s => (s ?? '').replace(/\u001b\[[0-9;]*m/g, '')

function walk(suite, trail, specFile) {
  const fileName = suite.file ?? specFile
  const here = suite.title && suite.title !== fileName ? [...trail, suite.title] : trail
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const name = [...here, spec.title].filter(Boolean).join(' › ')
      const err = (test.results ?? []).flatMap(r => r.errors ?? (r.error ? [r.error] : []))[0]
      const lines = clean(err?.message).split('\n').map(l => l.trim()).filter(Boolean)
      const msg = lines.slice(0, 3).join(' | ').slice(0, 700)
      if (test.status === 'unexpected') failed.push({ file: fileName, name, msg })
      else if (test.status === 'flaky') flaky.push({ file: fileName, name })
    }
  }
  for (const child of suite.suites ?? []) walk(child, here, fileName)
}
for (const s of report.suites ?? []) walk(s, [], s.file ?? s.title)

const st = report.stats ?? {}
const header = `expected=${st.expected ?? '?'} unexpected=${st.unexpected ?? '?'} flaky=${st.flaky ?? '?'} skipped=${st.skipped ?? '?'}`

// Section 1: distinct error messages with counts (most diagnostic, shortest).
const byMsg = new Map()
for (const f of failed) {
  const key = f.msg.replace(/\d+ms/g, 'Nms')
  byMsg.set(key, (byMsg.get(key) ?? 0) + 1)
}
const errorLines = [...byMsg.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${n}× ${m}`)

// Section 2: failures per spec file.
const byFile = new Map()
for (const f of failed) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f.name])
const fileLines = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)
  .map(([f, names]) => `${f} (${names.length}): ${names.map(n => n.split(' › ').pop()).join('; ')}`)

const flakyLines = flaky.map(f => `${f.file} › ${f.name}`)

const sections = [
  [`E2E results`, [header]],
  [`E2E distinct errors`, errorLines],
  [`E2E failures by file`, fileLines],
  [`E2E flaky`, flakyLines],
]

const enc = s => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
const MAX = 3800
let emitted = 0
for (const [title, lines] of sections) {
  if (!lines.length) continue
  let chunk = []
  let size = 0
  let part = 1
  const flush = () => {
    if (!chunk.length) return
    // Up to 10 annotations per level per step: alternate levels to stay under the cap.
    const level = emitted < 10 ? 'error' : emitted < 20 ? 'warning' : 'notice'
    console.log(`::${level} title=${title} (${part})::${enc(chunk.join('\n'))}`)
    emitted++
    part++
    chunk = []
    size = 0
  }
  for (const l of lines) {
    const line = l.slice(0, MAX)
    if (size + line.length + 1 > MAX) flush()
    chunk.push(line)
    size += line.length + 1
  }
  flush()
}
if (!failed.length && !flaky.length) console.log(`::notice title=E2E results::${header}`)
