/**
 * AI homework generation — one entry point for the streaming route and the
 * server action.
 *
 * Two modes:
 *
 * • Single pass (default): one Sonnet call with the full prompt, validated
 *   against lib/homework/schema.ts, with one targeted retry if too few valid
 *   questions come back.
 *
 * • Staged (behind the `homework_pipeline` feature flag): the approach Oak
 *   National Academy moved Aila to — explicit steps with their own contracts
 *   instead of one prompt doing everything:
 *     1. planner  (Haiku)  — decides what each question tests: the learning
 *                            point, Bloom level and the misconception to probe
 *     2. writer   (Sonnet) — writes the questions to that plan
 *     3. checker  (Haiku)  — for MCQs, scores each question's distractors with
 *                            the calibrated checker (lib/ai/judges)
 *     4. repair   (Sonnet) — rewrites only the options of weak questions, and
 *                            keeps a rewrite only if it scores no worse
 *   Each step is validated and any failure falls back to the step before, so
 *   the staged mode can never return less than single pass would.
 */
import { z } from 'zod'
import type { HomeworkType } from '@prisma/client'
import { noApiKeyFallback, type MCQQuestion, type ProposalResult } from '@/lib/homework-helpers'
import { scoreDistractors, weakQuestionIndices, type JudgeCall, type DistractorScore } from '@/lib/ai/judges/mcq-distractor'
import type { HomeworkContext } from './context'
import { HOMEWORK_SYSTEM_PROMPT } from './prompts'
import { MODELS, type Llm } from './llm'
import {
  extractJsonObject, hasStructuredQuestions, isUsable, mcqQuestionSchema, minQuestionsFor,
  validateHomework, type ValidatedHomework,
} from './schema'

export type Progress = (message: string, pct: number) => void

export type GenerationMeta = {
  mode:              'single' | 'staged'
  attempts:          number
  droppedQuestions:  number
  plannedQuestions?: number
  distractorScores?: (number | null)[]
  repairedQuestions?: number
  /** Why the staged mode fell back to single pass, if it did. */
  fallbackReason?:   string
}

const WRITER_MAX_TOKENS = 6000
const JSON_ONLY = 'You are a JSON API. Return ONLY valid JSON. No markdown. No code fences. No comments.'

function tryValidate(text: string, type: HomeworkType): ValidatedHomework | null {
  try { return validateHomework(extractJsonObject(text), type) } catch { return null }
}

function better(a: ValidatedHomework | null, b: ValidatedHomework | null): ValidatedHomework | null {
  if (!a) return b
  if (!b) return a
  return b.questions.length > a.questions.length ? b : a
}

// ── Single pass ───────────────────────────────────────────────────────────────

async function writeOnce(
  prompt: string, type: HomeworkType, llm: Llm, onProgress?: Progress, pctRange: [number, number] = [50, 85],
): Promise<{ result: ValidatedHomework | null; attempts: number }> {
  const [from, to] = pctRange
  let lastPct = from
  const onChars = onProgress
    ? (chars: number) => {
        const pct = Math.min(to, from + Math.floor(chars / 80))
        if (pct > lastPct) { lastPct = pct; onProgress('Generating homework…', pct) }
      }
    : undefined

  const text = await llm({ model: MODELS.writer, system: HOMEWORK_SYSTEM_PROMPT, messages: [{ role: 'user', content: prompt }], maxTokens: WRITER_MAX_TOKENS }, onChars)
  const first = tryValidate(text, type)
  if (first && isUsable(first, type)) return { result: first, attempts: 1 }

  // One targeted retry that says exactly what was wrong.
  onProgress?.('Improving response quality…', Math.min(to + 3, 90))
  const problem = !first
    ? 'The response was not valid JSON.'
    : hasStructuredQuestions(type)
      ? `Only ${first.questions.length} complete, valid questions were found (${first.droppedQuestions} were incomplete or malformed). questionsJson.questions needs at least ${minQuestionsFor(type)} questions, each with every required field${type === 'MCQ_QUIZ' ? ', exactly 4 distinct options and a correct index from 0 to 3' : ''}.`
      : 'The instructions field is empty.'
  try {
    const retry = await llm({
      model: MODELS.writer, system: HOMEWORK_SYSTEM_PROMPT, maxTokens: WRITER_MAX_TOKENS,
      messages: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: text.slice(0, 4000) },
        { role: 'user', content: `${problem} Resend the complete JSON. Return ONLY valid JSON, no extra text.` },
      ],
    })
    const second = tryValidate(retry, type)
    return { result: keepIfAnyContent(better(first, second), type), attempts: 2 }
  } catch {
    return { result: keepIfAnyContent(first, type), attempts: 2 }
  }
}

/** A short set of real questions is more useful to a teacher than placeholder stubs. */
function keepIfAnyContent(v: ValidatedHomework | null, type: HomeworkType): ValidatedHomework | null {
  if (!v) return null
  return hasStructuredQuestions(type) ? (v.questions.length > 0 ? v : null) : (v.instructions.trim() ? v : null)
}

// ── Staged pipeline ───────────────────────────────────────────────────────────

const BLOOM = ['recall', 'understanding', 'application', 'analysis', 'evaluation'] as const
const planSchema = z.object({
  items: z.array(z.object({
    focus:         z.string().trim().min(3).max(300),
    bloom:         z.string().transform(b => b.toLowerCase().trim()).pipe(z.enum(BLOOM)).catch('understanding'),
    misconception: z.string().trim().max(300).optional().catch(undefined),
  })).min(1),
})
export type QuestionPlan = z.infer<typeof planSchema>['items']

export function plannedCount(type: HomeworkType): number {
  return type === 'MCQ_QUIZ' ? 10 : 4 // must match buildTypePrompt
}

export function plannerPrompt(ctx: HomeworkContext): string {
  const n = plannedCount(ctx.type)
  const list = (title: string, xs: string[]) => (xs.length ? `${title}:\n${xs.map(x => `  - ${x}`).join('\n')}\n` : '')
  const spread = ctx.type === 'MCQ_QUIZ'
    ? '3 recall, 3 understanding or application, 2 analysis, 2 evaluation'
    : 'question 1 recall, question 2 understanding or application, question 3 analysis, question 4 evaluation'
  return `${ctx.contextBlock}
TASK
====
${ctx.taskInstruction}

Before any questions are written, plan the ${n} ${ctx.type === 'MCQ_QUIZ' ? 'multiple-choice' : 'short-answer'} questions for this homework.
${list('Curriculum learning points', ctx.curriculum.learningPoints)}${list('Known misconceptions for this content', ctx.curriculum.misconceptions)}
For each question give:
- focus: the specific fact, idea or skill it tests (one sentence, taken from the lesson content above)
- bloom: one of recall, understanding, application, analysis, evaluation (spread: ${spread})
- misconception: a misconception from the list above that the question should expose${ctx.type === 'MCQ_QUIZ' ? ' through a distractor' : ''}, or "" if none fits

Cover different learning points; do not test the same idea twice.
Return JSON: {"items": [{"focus": "...", "bloom": "...", "misconception": "..."}]} with exactly ${n} items.`
}

export function writerPrompt(ctx: HomeworkContext, plan: QuestionPlan): string {
  const lines = plan.map((p, i) => `${i + 1}. [${p.bloom}] ${p.focus}${p.misconception ? ` — make a ${ctx.type === 'MCQ_QUIZ' ? 'distractor' : 'question part'} that exposes: ${p.misconception}` : ''}`)
  return `${ctx.prompt}

QUESTION PLAN — write exactly one question per item, in this order, each testing its stated focus at its stated level:
${lines.join('\n')}`
}

export function repairPrompt(ctx: HomeworkContext, questions: { index: number; q: MCQQuestion }[]): string {
  const misc = ctx.curriculum.misconceptions.length
    ? `Known misconceptions for this content:\n${ctx.curriculum.misconceptions.map(m => `  - ${m}`).join('\n')}\n\n`
    : ''
  const items = questions.map(({ index, q }) =>
    `Question ${index}: ${q.q}\n  Correct answer: ${q.options[q.correct]}\n  Current wrong options: ${q.options.filter((_, i) => i !== q.correct).join(' | ')}`)
  return `These ${ctx.subject} multiple-choice questions for Year ${ctx.yearGroup} (${ctx.qualification}) have weak distractors: a pupil could pick the right answer without understanding the topic.

${misc}${items.join('\n\n')}

Rewrite only the three wrong options of each question. Each wrong option must be:
- an answer a pupil with a specific misconception or partial understanding would genuinely choose
- similar in length, grammar and style to the correct answer, so it cannot be ruled out on form alone
- clearly wrong to someone who understands the topic
Do not change the question text or the correct answer.

Return JSON: {"questions": [{"index": <question number>, "options": ["", "", "", ""], "correct": <0-3>, "explanation": "why the correct answer is right"}]}`
}

const repairSchema = z.object({
  questions: z.array(z.object({ index: z.number().int(), options: z.unknown(), correct: z.unknown(), explanation: z.unknown().optional() })),
})

/** Applies validated rewrites; a rewrite is dropped if it changes the correct answer or fails validation. */
export function applyRepairs(original: MCQQuestion[], text: string): Map<number, MCQQuestion> {
  const out = new Map<number, MCQQuestion>()
  let parsed: z.infer<typeof repairSchema>
  try { parsed = repairSchema.parse(extractJsonObject(text)) } catch { return out }
  for (const r of parsed.questions) {
    const before = original[r.index]
    if (!before) continue
    const v = mcqQuestionSchema.safeParse({ q: before.q, options: r.options, correct: r.correct, explanation: r.explanation ?? before.explanation })
    if (!v.success) continue
    const sameAnswer = v.data.options[v.data.correct].trim().toLowerCase() === before.options[before.correct].trim().toLowerCase()
    if (sameAnswer) out.set(r.index, v.data)
  }
  return out
}

function judgeVia(llm: Llm): JudgeCall {
  return ({ model, system, user, maxTokens }) => llm({ model, system, messages: [{ role: 'user', content: user }], maxTokens })
}

async function staged(ctx: HomeworkContext, llm: Llm, onProgress?: Progress): Promise<{ result: ValidatedHomework | null; meta: GenerationMeta }> {
  const type = ctx.type

  // 1. Plan
  onProgress?.('Planning questions…', 46)
  let plan: QuestionPlan | null = null
  try {
    const text = await llm({ model: MODELS.planner, system: JSON_ONLY, messages: [{ role: 'user', content: plannerPrompt(ctx) }], maxTokens: 1500 })
    const p = planSchema.safeParse(extractJsonObject(text))
    if (p.success && p.data.items.length >= minQuestionsFor(type)) plan = p.data.items.slice(0, plannedCount(type))
  } catch { /* fall back below */ }
  if (!plan) {
    const single = await writeOnce(ctx.prompt, type, llm, onProgress)
    return { result: single.result, meta: { mode: 'single', attempts: single.attempts, droppedQuestions: single.result?.droppedQuestions ?? 0, fallbackReason: 'planner returned no usable plan' } }
  }

  // 2. Write to the plan
  onProgress?.('Writing questions…', 52)
  const written = await writeOnce(writerPrompt(ctx, plan), type, llm, onProgress, [52, 80])
  const meta: GenerationMeta = { mode: 'staged', attempts: written.attempts, droppedQuestions: written.result?.droppedQuestions ?? 0, plannedQuestions: plan.length }
  if (!written.result || type !== 'MCQ_QUIZ') return { result: written.result, meta }

  // 3. Check distractors
  onProgress?.('Checking answer options…', 84)
  const questions = [...(written.result.questions as MCQQuestion[])]
  const judge = judgeVia(llm)
  const judgeCtx = { subject: ctx.subject, keyStage: ctx.qualification === 'KS3' ? 'KS3' : 'KS4' }
  const scores: DistractorScore[] = await scoreDistractors(questions, judge, judgeCtx)
  meta.distractorScores = scores.map(s => s.score)
  const weak = weakQuestionIndices(scores)
  if (weak.length === 0) return { result: written.result, meta }

  // 4. Repair weak questions, keeping a rewrite only if it scores no worse
  onProgress?.('Strengthening weak answer options…', 90)
  let repaired = 0
  try {
    const text = await llm({
      model: MODELS.writer, system: JSON_ONLY, maxTokens: 2500,
      messages: [{ role: 'user', content: repairPrompt(ctx, weak.map(i => ({ index: i, q: questions[i] }))) }],
    })
    const rewrites = applyRepairs(questions, text)
    if (rewrites.size > 0) {
      const idx = [...rewrites.keys()]
      const rescored = await scoreDistractors(idx.map(i => rewrites.get(i)!), judge, judgeCtx)
      rescored.forEach((s, k) => {
        const i = idx[k]
        const before = scores[i].raw ?? 0
        if (s.raw != null && s.raw >= before) {
          questions[i] = rewrites.get(i)!
          meta.distractorScores![i] = s.score
          repaired++
        }
      })
    }
  } catch { /* keep the written questions */ }
  meta.repairedQuestions = repaired
  return { result: { ...written.result, questions }, meta }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function generateHomework(
  ctx: HomeworkContext,
  llm: Llm,
  opts: { staged?: boolean; onProgress?: Progress } = {},
): Promise<{ result: ValidatedHomework | null; meta: GenerationMeta }> {
  if (opts.staged && hasStructuredQuestions(ctx.type)) return staged(ctx, llm, opts.onProgress)
  const single = await writeOnce(ctx.prompt, ctx.type, llm, opts.onProgress)
  return { result: single.result, meta: { mode: 'single', attempts: single.attempts, droppedQuestions: single.result?.droppedQuestions ?? 0 } }
}

/** Shapes a validated result into what the lesson screen expects; stub questions if generation failed. */
export function toProposal(ctx: HomeworkContext, result: ValidatedHomework | null): ProposalResult {
  const fallback = noApiKeyFallback(ctx.type, ctx.lessonTitle, ctx.subject)
  if (!result) return { ...fallback, ilpTargetIds: ctx.ilpTargetIds.length ? ctx.ilpTargetIds : undefined }
  return {
    type:                ctx.type,
    instructions:        result.instructions,
    modelAnswer:         result.modelAnswer,
    gradingBands:        result.gradingBands,
    targetWordCount:     result.targetWordCount ?? (ctx.type === 'EXTENDED_WRITING' ? 300 : 0),
    questionsJson:       hasStructuredQuestions(ctx.type) ? { questions: result.questions } : undefined,
    basedOnSchemeOfWork: ctx.basedOnSchemeOfWork,
    ilpTargetIds:        ctx.ilpTargetIds.length ? ctx.ilpTargetIds : undefined,
  }
}
