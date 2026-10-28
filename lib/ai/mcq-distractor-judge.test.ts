import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreDistractors, weakQuestionIndices, judgeConfig, toJudgeItem, type JudgeCall } from './judges/mcq-distractor'
import { buildJudgeSystem, buildJudgeUser, parseJudgeScore, calibrate } from './judges/mcq-distractor-prompt.mjs'
import config from './judges/mcq-distractor.prompt.json'

const q = (stem: string) => ({ q: stem, options: ['Right', 'Wrong 1', 'Wrong 2', 'Wrong 3'] as [string, string, string, string], correct: 0, explanation: '' })

test('parseJudgeScore reads JSON, tolerates prose, and rejects out-of-range scores', () => {
  assert.equal(parseJudgeScore('{"justification": "x", "score": 4}'), 4)
  assert.equal(parseJudgeScore('Sure.\n{"score": 2, "justification": "y"}'), 2)
  assert.equal(parseJudgeScore('score: 3'), 3)
  assert.equal(parseJudgeScore('{"score": 7}'), null)
  assert.equal(parseJudgeScore('no score'), null)
})

test('calibrate rounds and clamps to 1–5', () => {
  assert.equal(calibrate(1, { slope: 0.5, intercept: 1.6 }), 2)
  assert.equal(calibrate(5, { slope: 2, intercept: 3 }), 5)
  assert.equal(calibrate(1, { slope: 1, intercept: -3 }), 1)
})

test('the production prompt is built from the calibrated candidate', () => {
  const candidate = (config.candidates as Record<string, { instruction: string; useExamples: boolean }>)[config.selected.candidate]
  assert.ok(candidate, 'selected candidate exists in the prompt file')
  assert.equal(judgeConfig.system, buildJudgeSystem(candidate, config as never))
  assert.match(judgeConfig.system, /JSON only/)
})

test('toJudgeItem separates the correct answer from the distractors', () => {
  const item = toJudgeItem({ q: 'Q', options: ['a', 'b', 'c', 'd'], correct: 2, explanation: '' }, { subject: 'Science' })
  assert.equal(item.correct_answer, 'c')
  assert.deepEqual(item.distractors, ['a', 'b', 'd'])
  assert.match(buildJudgeUser(item), /Subject: Science/)
})

test('scoreDistractors calibrates scores and survives a failed call', async () => {
  const replies: Record<string, string | Error> = { Q1: '{"score": 1}', Q2: '{"score": 5}', Q3: new Error('timeout') }
  const call: JudgeCall = async ({ user }) => {
    const r = replies[user.match(/Question: (Q\d)/)![1]]
    if (r instanceof Error) throw r
    return r
  }
  const scores = await scoreDistractors([q('Q1'), q('Q2'), q('Q3')], call)
  assert.deepEqual([scores[0].raw, scores[0].score], [1, calibrate(1, judgeConfig.calibration)])
  assert.deepEqual([scores[1].raw, scores[1].score], [5, calibrate(5, judgeConfig.calibration)])
  assert.deepEqual([scores[2].raw, scores[2].score], [null, null])
})

test('weakQuestionIndices flags on the raw score, not the calibrated one', () => {
  const t = judgeConfig.flagRawAtOrBelow
  assert.deepEqual(weakQuestionIndices([
    { index: 0, raw: t, score: 4 },        // calibrated score looks fine, raw says weak → flagged
    { index: 1, raw: t + 1, score: 1 },
    { index: 2, raw: null, score: null },
  ]), [0])
})
