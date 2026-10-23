// Reads Playwright's JSON report and emits ONE GitHub annotation listing every
// failed and flaky test with its first error line. GitHub only shows workflow
// logs to signed-in users, but annotations are readable through the API, so
// this makes CI failures diagnosable without opening the log viewer.
import { readFileSync, existsSync } from 'node:fs'

const file = process.argv[2] ?? 'e2e-results.json'
if (!existsSync(file)) {
  console.log(`::warning title=E2E report missing::${file} not found`)
  process.exit(0)
}

const report = JSON.parse(readFileSync(file, 'utf8'))
const failed = []
const flaky = []

function walk(suite, trail) {
  const here = suite.title ? [...trail, suite.title] : trail
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const name = [...here, spec.title].filter(Boolean).join(' › ')
      const results = test.results ?? []
      const last = results[results.length - 1]
      const err = results.flatMap(r => r.errors ?? (r.error ? [r.error] : []))[0]
      const msg = (err?.message ?? '')
        .replace(/\u001b\[[0-9;]*m/g, '')
        .split('\n')
        .find(l => l.trim()) ?? ''
      if (test.status === 'unexpected') failed.push(`${name} :: ${msg.slice(0, 220)}`)
      else if (test.status === 'flaky') flaky.push(name)
      void last
    }
  }
  for (const child of suite.suites ?? []) walk(child, here)
}
for (const s of report.suites ?? []) walk(s, [])

const st = report.stats ?? {}
const header = `expected=${st.expected ?? '?'} unexpected=${st.unexpected ?? '?'} flaky=${st.flaky ?? '?'} skipped=${st.skipped ?? '?'}`
const enc = s => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
const body = [header, '', `FAILED (${failed.length}):`, ...failed, '', `FLAKY (${flaky.length}):`, ...flaky].join('\n')
console.log(`::${failed.length ? 'error' : 'notice'} title=E2E results::${enc(body).slice(0, 60000)}`)
