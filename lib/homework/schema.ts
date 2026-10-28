/**
 * Validation for AI-generated homework.
 *
 * The model is asked for JSON, but what comes back is untrusted: questions can
 * be missing fields, MCQs can have three options or a correct-answer index
 * that does not exist, and short-answer items sometimes use `question`/`answer`
 * instead of `q`/`modelAnswer`. These schemas accept the shapes Claude actually
 * returns, normalise them to the shapes the editor and auto-marker use
 * (`MCQQuestion` / `SAQuestion` in lib/homework-helpers.ts), and drop any
 * question that cannot be repaired rather than letting it reach a teacher.
 *
 * Pure module: no database or network, so it is unit-tested directly
 * (lib/homework/schema.test.ts).
 */
import { z } from 'zod'
import type { HomeworkType } from '@prisma/client'
import type { MCQQuestion, SAQuestion } from '@/lib/homework-helpers'

const text = z.string().trim().min(1)
const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform(v => (typeof v === 'string' && v.trim() ? v.trim() : undefined))

/** "B", "b", "2" or 1 → 0-based index. Letters are A–D; numeric strings are taken as 0-based. */
const correctIndex = z.union([z.number(), z.string()]).transform((v, ctx) => {
  let n: number
  if (typeof v === 'number') n = v
  else if (/^[A-Da-d]$/.test(v.trim())) n = v.trim().toUpperCase().charCodeAt(0) - 65
  else n = Number(v)
  if (!Number.isInteger(n) || n < 0 || n > 3) {
    ctx.addIssue({ code: 'custom', message: 'correct must identify one of four options' })
    return z.NEVER
  }
  return n
})

/** Strips a leading "A." / "B)" label the model sometimes adds to option text. */
const optionText = text.transform(o => o.replace(/^[A-D][.)]\s+/, ''))

export const mcqQuestionSchema = z
  .object({
    q:           text.optional(),
    question:    text.optional(),
    options:     z.array(optionText).length(4),
    correct:     correctIndex,
    explanation: optionalText,
  })
  .refine(v => !!(v.q ?? v.question), { message: 'question text is missing' })
  .refine(v => new Set(v.options.map(o => o.toLowerCase())).size === 4, { message: 'options must be distinct' })
  .transform((v): MCQQuestion => ({
    q:           (v.q ?? v.question) as string,
    options:     v.options as [string, string, string, string],
    correct:     v.correct,
    explanation: v.explanation ?? '',
  }))

/** Accepts [{term, definition}] or ["term: definition"]; anything else is dropped. */
const vocabSupport = z
  .array(z.unknown())
  .transform(items =>
    items.flatMap((item): { term: string; definition: string }[] => {
      if (typeof item === 'string') {
        const i = item.indexOf(':')
        return i > 0 ? [{ term: item.slice(0, i).trim(), definition: item.slice(i + 1).trim() }] : []
      }
      if (item && typeof item === 'object') {
        const { term, definition } = item as { term?: unknown; definition?: unknown }
        if (typeof term === 'string' && term.trim() && typeof definition === 'string' && definition.trim()) {
          return [{ term: term.trim(), definition: definition.trim() }]
        }
      }
      return []
    }),
  )
  .optional()

export const saQuestionSchema = z
  .object({
    q:                text.optional(),
    question:         text.optional(),
    modelAnswer:      text.optional(),
    answer:           text.optional(),
    markScheme:       optionalText,
    marks:            z.coerce.number().int().positive().max(40).optional().catch(undefined),
    scaffolding_hint: optionalText,
    ehcp_adaptation:  optionalText,
    vocab_support:    vocabSupport.catch(undefined),
  })
  .refine(v => !!(v.q ?? v.question), { message: 'question text is missing' })
  .refine(v => !!(v.modelAnswer ?? v.answer), { message: 'model answer is missing' })
  .transform((v): SAQuestion => {
    const out: SAQuestion = { q: (v.q ?? v.question) as string, modelAnswer: (v.modelAnswer ?? v.answer) as string }
    if (v.markScheme)       out.markScheme = v.markScheme
    if (v.marks)            out.marks = v.marks
    if (v.scaffolding_hint) out.scaffolding_hint = v.scaffolding_hint
    if (v.ehcp_adaptation)  out.ehcp_adaptation = v.ehcp_adaptation
    if (v.vocab_support?.length) out.vocab_support = v.vocab_support
    return out
  })

/** Top-level fields shared by every homework type. Missing fields get safe defaults. */
const envelopeSchema = z.object({
  instructions:    z.string().catch(''),
  modelAnswer:     z.string().catch(''),
  gradingBands:    z.record(z.string(), z.string()).catch({}),
  targetWordCount: z.coerce.number().int().min(0).max(5000).optional().catch(undefined),
})

export type ValidatedHomework = {
  instructions:    string
  modelAnswer:     string
  gradingBands:    Record<string, string>
  targetWordCount: number | undefined
  /** Only for MCQ_QUIZ and SHORT_ANSWER; empty for other types. */
  questions:       MCQQuestion[] | SAQuestion[]
  /** How many questions the model returned that failed validation and were dropped. */
  droppedQuestions: number
}

/** Types whose questions are structured (rendered, edited and auto-marked per question). */
export function hasStructuredQuestions(type: HomeworkType): type is 'MCQ_QUIZ' | 'SHORT_ANSWER' {
  return type === 'MCQ_QUIZ' || type === 'SHORT_ANSWER'
}

/**
 * Minimum number of valid questions before a generation counts as usable.
 * Must stay below what buildTypePrompt asks for (10 MCQs, 4 short-answer).
 */
export function minQuestionsFor(type: HomeworkType): number {
  return type === 'MCQ_QUIZ' ? 4 : type === 'SHORT_ANSWER' ? 3 : 0
}

/** Validates a parsed JSON value against the homework type. Never throws. */
export function validateHomework(value: unknown, type: HomeworkType): ValidatedHomework {
  const obj = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const env = envelopeSchema.parse(obj)

  let questions: MCQQuestion[] | SAQuestion[] = []
  let dropped = 0
  if (hasStructuredQuestions(type)) {
    // The model sometimes returns questions at the root instead of under questionsJson.
    const qj = obj.questionsJson as { questions?: unknown } | null | undefined
    const raw = Array.isArray(qj?.questions) ? qj.questions : Array.isArray(obj.questions) ? obj.questions : []
    const schema = type === 'MCQ_QUIZ' ? mcqQuestionSchema : saQuestionSchema
    const valid: (MCQQuestion | SAQuestion)[] = []
    for (const item of raw) {
      const r = schema.safeParse(item)
      if (r.success) valid.push(r.data)
      else dropped++
    }
    questions = valid as MCQQuestion[] | SAQuestion[]
  }

  return {
    instructions:     env.instructions,
    modelAnswer:      env.modelAnswer,
    gradingBands:     env.gradingBands,
    targetWordCount:  env.targetWordCount,
    questions,
    droppedQuestions: dropped,
  }
}

/** True when a validated result is good enough to show a teacher without retrying. */
export function isUsable(v: ValidatedHomework, type: HomeworkType): boolean {
  if (hasStructuredQuestions(type)) return v.questions.length >= minQuestionsFor(type)
  return v.instructions.trim().length > 0
}

/**
 * Pulls a JSON object out of model text. Handles code fences, prose around the
 * object, stray control characters and raw newlines inside string values.
 * Throws if no object can be recovered.
 */
export function extractJsonObject(raw: string): unknown {
  let t = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  t = t.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
  try { return JSON.parse(t) } catch { /* try the outermost object */ }
  const m = t.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('no JSON object found')
  try { return JSON.parse(m[0]) } catch { /* escape raw whitespace inside strings */ }
  const escaped = m[0].replace(/"(?:[^"\\]|\\.)*"/g, s => s.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'))
  return JSON.parse(escaped)
}
