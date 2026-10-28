#!/usr/bin/env node
// Calibrates the MCQ distractor-quality checker against teacher scores.
//
// Data: Oak National Academy's 311 multiple-choice questions scored 1–5 by
// experienced UK teachers (Clark et al. 2024), published with
// github.com/oaknational/oak-dspy-mcq-eval (data/mcq_mindiff_dataset.json, OGL v3).
//
// Method (the same shape as Oak's experiment):
//   1. Stratified 20/60/20 split by teacher score (seeded), with Oak's four
//      worked examples removed from the dev and test sets so they never grade
//      themselves.
//   2. Score the dev set with each prompt candidate × model in
//      lib/ai/judges/mcq-distractor.prompt.json.
//   3. Fit a linear correction (least squares) on dev for each, because LLM
//      judges score systematically harsher than teachers.
//   4. Pick the combination with the lowest calibrated dev MSE, then report
//      every combination on the held-out test set, which played no part in
//      the choice.
//
// Results are cached per call in <out>.cache.jsonl, so an interrupted run
// resumes without paying twice.
//
// Usage:
//   ANTHROPIC_API_KEY=... node scripts/calibrate-mcq-judge.mjs <dataset.json> <out.json> [--write]
// --write updates `selected` and `evaluation` in the prompt JSON.

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildJudgeSystem, buildJudgeUser, parseJudgeScore, calibrate } from '../lib/ai/judges/mcq-distractor-prompt.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const promptPath = join(here, '../lib/ai/judges/mcq-distractor.prompt.json')
const [datasetPath, outPath] = process.argv.slice(2)
const write = process.argv.includes('--write')
if (!datasetPath || !outPath) { console.error('usage: calibrate-mcq-judge.mjs <dataset.json> <out.json> [--write]'); process.exit(2) }
const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) { console.error('ANTHROPIC_API_KEY is not set'); process.exit(2) }

const MODELS = (process.env.JUDGE_MODELS || 'claude-haiku-4-5-20251001,claude-sonnet-4-6').split(',')
const CONCURRENCY = Number(process.env.JUDGE_CONCURRENCY || 6)
const config = JSON.parse(readFileSync(promptPath, 'utf8'))
const data = JSON.parse(readFileSync(datasetPath, 'utf8'))

// ── Split ─────────────────────────────────────────────────────────────────
function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const rand = rng(1337)
const exampleQs = new Set(config.examples.map(e => e.question.trim().toLowerCase()))
const items = data.map((d, id) => ({
  id, question: d.question, correct_answer: d.correct_answer,
  distractors: Array.isArray(d.distractors) ? d.distractors : String(d.distractors).split(','),
  human: Number(d.human_score), isExample: exampleQs.has(String(d.question).trim().toLowerCase()),
}))
const split = { train: [], dev: [], test: [] }
for (const s of [1, 2, 3, 4, 5]) {
  const group = items.filter(i => i.human === s)
  for (let i = group.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [group[i], group[j]] = [group[j], group[i]] }
  const nTrain = Math.round(group.length * 0.2), nTest = Math.round(group.length * 0.2)
  group.forEach((g, i) => (i < nTrain ? split.train : i < nTrain + nTest ? split.test : split.dev).push(g))
}
for (const k of ['dev', 'test']) {
  const moved = split[k].filter(i => i.isExample)
  split[k] = split[k].filter(i => !i.isExample)
  split.train.push(...moved)
}

// ── Calls (cached) ─────────────────────────────────────────────────────────
const cachePath = outPath + '.cache.jsonl'
const cache = new Map()
if (existsSync(cachePath)) {
  for (const line of readFileSync(cachePath, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const r = JSON.parse(line); cache.set(r.key, r)
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
let inputTokens = 0, outputTokens = 0

async function judge(candidateName, model, item) {
  const key = `${candidateName}|${model}|${item.id}`
  if (cache.has(key)) return cache.get(key).score
  const body = {
    model, max_tokens: 300, temperature: 0,
    system: buildJudgeSystem(config.candidates[candidateName], config),
    messages: [{ role: 'user', content: buildJudgeUser(item) }],
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    let res
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch { await sleep(2000 * (attempt + 1)); continue } // transient network error
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * (attempt + 1)); continue }
    const json = await res.json()
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 300)}`)
    inputTokens += json.usage?.input_tokens ?? 0
    outputTokens += json.usage?.output_tokens ?? 0
    const score = parseJudgeScore(json.content?.map(c => c.text ?? '').join('') ?? '')
    const rec = { key, score }
    cache.set(key, rec); appendFileSync(cachePath, JSON.stringify(rec) + '\n')
    return score
  }
  throw new Error('gave up after retries')
}

async function scoreAll(candidateName, model, set) {
  const out = new Array(set.length)
  let next = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < set.length) { const i = next++; out[i] = await judge(candidateName, model, set[i]) }
  }))
  return out
}

// ── Metrics ────────────────────────────────────────────────────────────────
function metrics(pred, human) {
  const pairs = pred.map((p, i) => [p, human[i]]).filter(([p]) => p != null)
  const n = pairs.length
  const mse = pairs.reduce((s, [p, h]) => s + (p - h) ** 2, 0) / n
  const within1 = pairs.filter(([p, h]) => Math.abs(p - h) <= 1).length / n
  const exact = pairs.filter(([p, h]) => p === h).length / n
  const bias = pairs.reduce((s, [p, h]) => s + (p - h), 0) / n
  return { n, unparsed: pred.length - n, mse: +mse.toFixed(3), within1: +within1.toFixed(3), exact: +exact.toFixed(3), meanBias: +bias.toFixed(3) }
}
function fitLinear(pred, human) {
  const pairs = pred.map((p, i) => [p, human[i]]).filter(([p]) => p != null)
  const n = pairs.length, mx = pairs.reduce((s, [x]) => s + x, 0) / n, my = pairs.reduce((s, [, y]) => s + y, 0) / n
  const sxx = pairs.reduce((s, [x]) => s + (x - mx) ** 2, 0)
  const slope = sxx === 0 ? 0 : pairs.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / sxx
  return { slope: +slope.toFixed(4), intercept: +(my - slope * mx).toFixed(4) }
}
const cal = (pred, c) => pred.map(p => (p == null ? null : calibrate(p, c)))

// Flagging weak questions is a yes/no decision: "would teachers score this 1 or 2?"
// The least-squares correction pulls scores towards the middle, so flagging uses
// a threshold on the raw score, chosen on dev by F1 and reported on test.
const WEAK = 2
function flagStats(pred, human, t) {
  let tp = 0, fp = 0, fn = 0, flagged = 0
  pred.forEach((p, i) => {
    if (p == null) return
    const isFlagged = p <= t, isWeak = human[i] <= WEAK
    if (isFlagged) flagged++
    if (isFlagged && isWeak) tp++; else if (isFlagged) fp++; else if (isWeak) fn++
  })
  const precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
  return { threshold: t, precision: +precision.toFixed(3), recall: +recall.toFixed(3), f1: +f1.toFixed(3), flaggedShare: +(flagged / pred.length).toFixed(3) }
}
function chooseFlag(devPred, testPred) {
  const options = [1, 2, 3, 4].map(t => flagStats(devPred, devH, t))
  const best = options.reduce((a, b) => (b.f1 > a.f1 ? b : a))
  return { flagRawAtOrBelow: best.threshold, dev: best, test: flagStats(testPred, testH, best.threshold) }
}

// ── Run ────────────────────────────────────────────────────────────────────
const devH = split.dev.map(i => i.human), testH = split.test.map(i => i.human)
const results = []
for (const model of MODELS) {
  for (const name of Object.keys(config.candidates)) {
    const dev = await scoreAll(name, model, split.dev)
    const fit = fitLinear(dev, devH)
    const test = await scoreAll(name, model, split.test)
    const r = {
      candidate: name, model, calibration: fit,
      dev:  { raw: metrics(dev, devH),  calibrated: metrics(cal(dev, fit), devH) },
      test: { raw: metrics(test, testH), calibrated: metrics(cal(test, fit), testH) },
      weakFlag: chooseFlag(dev, test),
    }
    results.push(r)
    console.log(`${model} ${name}: dev raw MSE ${r.dev.raw.mse} → cal ${r.dev.calibrated.mse} | test raw ${r.test.raw.mse} (±1 ${r.test.raw.within1}) → cal ${r.test.calibrated.mse} (±1 ${r.test.calibrated.within1}) | flag raw<=${r.weakFlag.flagRawAtOrBelow}: test precision ${r.weakFlag.test.precision} recall ${r.weakFlag.test.recall}`)
  }
}

// Selection uses dev only. Prefer the cheaper model unless the larger one is clearly better (≥0.15 MSE).
const byDev = [...results].sort((a, b) => a.dev.calibrated.mse - b.dev.calibrated.mse)
let best = byDev[0]
const cheapBest = byDev.find(r => r.model.includes('haiku'))
if (cheapBest && cheapBest !== best && cheapBest.dev.calibrated.mse - best.dev.calibrated.mse < 0.15) best = cheapBest

const summary = {
  dataset: { total: items.length, train: split.train.length, dev: split.dev.length, test: split.test.length, seed: 1337 },
  testScoreDistribution: [1, 2, 3, 4, 5].map(s => testH.filter(h => h === s).length),
  results,
  selected: { candidate: best.candidate, model: best.model, calibration: best.calibration, flagRawAtOrBelow: best.weakFlag.flagRawAtOrBelow },
  selectedTest: { ...best.test, weakFlag: best.weakFlag.test },
  tokens: { input: inputTokens, output: outputTokens },
  ranAt: new Date().toISOString(),
}
writeFileSync(outPath, JSON.stringify(summary, null, 2))
console.log('SELECTED', JSON.stringify(summary.selected), 'TEST', JSON.stringify(best.test))

if (write) {
  config.selected = { ...config.selected, ...summary.selected }
  config.evaluation = {
    heldOutTest: { ...best.test, weakFlag: best.weakFlag.test }, dataset: summary.dataset, ranAt: summary.ranAt,
    note: 'Held-out test questions played no part in choosing the prompt, model or calibration.',
  }
  writeFileSync(promptPath, JSON.stringify(config, null, 2) + '\n')
  console.log('updated', promptPath)
}
