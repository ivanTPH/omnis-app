import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyRepairs, generateHomework, toProposal } from './generate'
import { MODELS, type Llm, type LlmRequest } from './llm'
import { judgeConfig } from '../ai/judges/mcq-distractor'
import type { HomeworkContext } from './context'

const ctx = (over: Partial<HomeworkContext> = {}): HomeworkContext => ({
  lessonId: 'l1', lessonTitle: 'Photosynthesis', subject: 'Biology', yearGroup: 10, qualification: 'GCSE',
  examBoard: 'aqa', type: 'MCQ_QUIZ', prompt: 'FULL PROMPT', contextBlock: 'CONTEXT', taskInstruction: 'TASK',
  ilpTargetIds: ['t1'], basedOnSchemeOfWork: true,
  curriculum: { learningPoints: ['Plants make glucose'], misconceptions: ['Plants get food from soil'], vocabulary: ['chlorophyll'] },
  ...over,
})

const mcq = (i: number, opts: string[] = [`Right ${i}`, `Wrong ${i}a`, `Wrong ${i}b`, `Wrong ${i}c`]) =>
  ({ q: `Question ${i}?`, options: opts, correct: 0, explanation: 'because' })
const mcqJson = (n: number) => JSON.stringify({ type: 'MCQ_QUIZ', instructions: 'Quiz', modelAnswer: 'key', gradingBands: {}, questionsJson: { questions: Array.from({ length: n }, (_, i) => mcq(i)) } })
const saJson = (n: number) => JSON.stringify({ instructions: 'Answer', questionsJson: { questions: Array.from({ length: n }, (_, i) => ({ q: `SA ${i}`, modelAnswer: 'A' })) } })

/** A scripted fake model that records every request. */
function fake(handler: (req: LlmRequest, n: number) => string): Llm & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = []
  const fn = (async (req: LlmRequest, onChars?: (n: number) => void) => {
    calls.push(req)
    const out = handler(req, calls.length)
    onChars?.(out.length)
    return out
  }) as Llm & { calls: LlmRequest[] }
  fn.calls = calls
  return fn
}
const isJudge = (r: LlmRequest) => r.model === judgeConfig.model && r.system === judgeConfig.system
const lastUser = (r: LlmRequest) => r.messages[r.messages.length - 1].content

test('single pass: valid output is used in one call', async () => {
  const llm = fake(() => mcqJson(10))
  const { result, meta } = await generateHomework(ctx(), llm)
  assert.equal(result?.questions.length, 10)
  assert.deepEqual(meta, { mode: 'single', attempts: 1, droppedQuestions: 0 })
  assert.equal(llm.calls.length, 1)
  assert.equal(llm.calls[0].messages[0].content, 'FULL PROMPT')
})

test('single pass: one retry that names the problem, then the better result wins', async () => {
  const llm = fake((_, n) => (n === 1 ? mcqJson(2) : mcqJson(10)))
  const { result, meta } = await generateHomework(ctx(), llm)
  assert.equal(result?.questions.length, 10)
  assert.equal(meta.attempts, 2)
  assert.match(lastUser(llm.calls[1]), /Only 2 complete, valid questions/)
})

test('single pass: short-answer homework asking for 4 is accepted without a wasted retry', async () => {
  const llm = fake(() => saJson(4))
  const { meta } = await generateHomework(ctx({ type: 'SHORT_ANSWER' }), llm)
  assert.equal(meta.attempts, 1) // the old server action required 5 and always retried
})

test('unusable output twice: real questions are kept rather than replaced by stubs', async () => {
  const llm = fake(() => mcqJson(2))
  const { result } = await generateHomework(ctx(), llm)
  assert.equal(result?.questions.length, 2)
})

test('no JSON at all: proposal falls back to editable stubs but keeps ILP links', async () => {
  const llm = fake(() => 'sorry, I cannot')
  const { result } = await generateHomework(ctx(), llm)
  assert.equal(result, null)
  const p = toProposal(ctx(), null)
  assert.match((p.questionsJson!.questions[0] as { q: string }).q, /\[Edit\]/)
  assert.deepEqual(p.ilpTargetIds, ['t1'])
})

test('toProposal returns ILP target ids and the scheme-of-work flag (the live route used to drop them)', async () => {
  const llm = fake(() => mcqJson(10))
  const { result } = await generateHomework(ctx(), llm)
  const p = toProposal(ctx(), result)
  assert.deepEqual(p.ilpTargetIds, ['t1'])
  assert.equal(p.basedOnSchemeOfWork, true)
  assert.equal(p.questionsJson?.questions.length, 10)
})

const plan = (n: number) => JSON.stringify({ items: Array.from({ length: n }, (_, i) => ({ focus: `Point ${i}`, bloom: i < 3 ? 'Recall' : 'analysis', misconception: i === 0 ? 'Plants get food from soil' : '' })) })

test('staged: plan → write → check → repair weak question, keeping the correct answer', async () => {
  const llm = fake(req => {
    if (req.model === MODELS.planner && !isJudge(req)) return plan(10)
    if (isJudge(req)) {
      const u = lastUser(req)
      if (u.includes('Question 3?')) return u.includes('Better') ? '{"score": 5}' : '{"score": 1}'
      return '{"score": 5}'
    }
    if (lastUser(req).startsWith('These Biology')) {
      return JSON.stringify({ questions: [{ index: 3, options: ['Right 3', 'Better a', 'Better b', 'Better c'], correct: 0, explanation: 'x' }] })
    }
    return mcqJson(10)
  })
  const { result, meta } = await generateHomework(ctx(), llm, { staged: true })
  assert.equal(meta.mode, 'staged')
  assert.equal(meta.plannedQuestions, 10)
  assert.equal(meta.repairedQuestions, 1)
  const writer = llm.calls.find(c => c.model === MODELS.writer)!
  assert.match(lastUser(writer), /QUESTION PLAN[\s\S]*1\. \[recall\] Point 0 — make a distractor that exposes: Plants get food from soil/)
  const q3 = result!.questions[3] as { q: string; options: string[] }
  assert.equal(q3.q, 'Question 3?')
  assert.deepEqual(q3.options, ['Right 3', 'Better a', 'Better b', 'Better c'])
  assert.equal(llm.calls.filter(isJudge).length, 11) // 10 checks + 1 re-check of the rewrite
})

test('staged: a rewrite that scores worse, or changes the correct answer, is not kept', async () => {
  const llm = fake(req => {
    if (req.model === MODELS.planner && !isJudge(req)) return plan(10)
    if (isJudge(req)) return lastUser(req).includes('Question 1?') || lastUser(req).includes('Question 2?') ? '{"score": 1}' : '{"score": 5}'
    if (lastUser(req).startsWith('These Biology')) {
      return JSON.stringify({ questions: [
        { index: 1, options: ['Totally different', 'x', 'y', 'z'], correct: 0 }, // changes the answer
        { index: 2, options: ['Right 2', 'p', 'q', 'r'], correct: 0 },           // still scores 1 → not worse, kept
      ] })
    }
    return mcqJson(10)
  })
  const { result, meta } = await generateHomework(ctx(), llm, { staged: true })
  assert.equal((result!.questions[1] as { options: string[] }).options[0], 'Right 1')
  assert.equal(meta.repairedQuestions, 1)
})

test('staged: an unusable plan falls back to single pass with the reason recorded', async () => {
  const llm = fake(req => (req.model === MODELS.planner ? 'not a plan' : mcqJson(10)))
  const { result, meta } = await generateHomework(ctx(), llm, { staged: true })
  assert.equal(result?.questions.length, 10)
  assert.equal(meta.mode, 'single')
  assert.match(meta.fallbackReason ?? '', /planner/)
})

test('staged short-answer homework is planned and written but not sent to the MCQ checker', async () => {
  const llm = fake(req => (req.model === MODELS.planner ? plan(4) : saJson(4)))
  const { meta } = await generateHomework(ctx({ type: 'SHORT_ANSWER' }), llm, { staged: true })
  assert.equal(meta.mode, 'staged')
  assert.equal(llm.calls.filter(isJudge).length, 0)
})

test('extended writing ignores the staged flag', async () => {
  const llm = fake(() => JSON.stringify({ instructions: 'Essay', modelAnswer: 'Plan' }))
  const { meta } = await generateHomework(ctx({ type: 'EXTENDED_WRITING' }), llm, { staged: true })
  assert.equal(meta.mode, 'single')
  assert.equal(llm.calls.length, 1)
})

test('applyRepairs ignores unknown indices and invalid options', () => {
  const original = [mcq(0), mcq(1)] as never
  const out = applyRepairs(original, JSON.stringify({ questions: [
    { index: 9, options: ['a', 'b', 'c', 'd'], correct: 0 },
    { index: 0, options: ['Right 0', 'a', 'a', 'b'], correct: 0 }, // duplicate options
    { index: 1, options: ['Right 1', 'n', 'm', 'o'], correct: 'A' },
  ] }))
  assert.deepEqual([...out.keys()], [1])
})
