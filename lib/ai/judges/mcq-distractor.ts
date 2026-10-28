/**
 * MCQ distractor-quality checker.
 *
 * Scores how well the wrong options of a multiple-choice question test
 * understanding (1 = the answer is obvious without knowing the topic,
 * 5 = only a pupil who understands it can tell the options apart). The
 * staged homework pipeline (lib/homework/pipeline.ts) uses it to rewrite
 * weak questions before a teacher sees them.
 *
 * The prompt and the linear correction applied to its scores were chosen
 * against 311 questions scored by experienced UK teachers (Oak National
 * Academy's open dataset, credit: Oak National Academy) — see
 * scripts/calibrate-mcq-judge.mjs and the `evaluation` block in
 * mcq-distractor.prompt.json for the held-out results. Uncalibrated LLM
 * judges score far more harshly than teachers, so raw scores are never used.
 */
import type { MCQQuestion } from '@/lib/homework-helpers'
import config from './mcq-distractor.prompt.json'
import { buildJudgeSystem, buildJudgeUser, parseJudgeScore, calibrate } from './mcq-distractor-prompt.mjs'

/** One model call: system + user text in, reply text out. Injected so tests need no network. */
export type JudgeCall = (req: { model: string; system: string; user: string; maxTokens: number }) => Promise<string>

export type DistractorScore = {
  index: number
  /** The checker's own 1–5 score — used to decide what to rewrite. Null if it gave no usable answer. */
  raw:   number | null
  /** Raw score mapped onto the teachers' scale — the figure to show or log. */
  score: number | null
}

type Candidate = { instruction: string; useExamples: boolean }

export const judgeConfig = {
  model:               config.selected.model as string,
  /**
   * Flag a question for rewriting when its raw score is at or below this.
   * Chosen on the dev set for detecting questions teachers score 1–2 (the
   * least-squares calibration pulls scores to the middle, so it is not used
   * for this yes/no decision).
   */
  flagRawAtOrBelow:    config.selected.flagRawAtOrBelow as number,
  calibration:         config.selected.calibration as { slope: number; intercept: number },
  system:              buildJudgeSystem(
    (config.candidates as Record<string, Candidate>)[config.selected.candidate],
    config as unknown as Parameters<typeof buildJudgeSystem>[1],
  ) as string,
}

/** Converts an app MCQ into the checker's input shape. */
export function toJudgeItem(q: MCQQuestion, ctx: { subject?: string; keyStage?: string } = {}) {
  return {
    question:       q.q,
    correct_answer: q.options[q.correct],
    distractors:    q.options.filter((_, i) => i !== q.correct),
    subject:        ctx.subject,
    key_stage:      ctx.keyStage,
  }
}

/**
 * Scores every question. Calls run in parallel; a failed call yields a null
 * score for that question rather than failing the whole check.
 */
export async function scoreDistractors(
  questions: MCQQuestion[],
  call: JudgeCall,
  ctx: { subject?: string; keyStage?: string } = {},
): Promise<DistractorScore[]> {
  return Promise.all(questions.map(async (q, index) => {
    try {
      const reply = await call({
        model:     judgeConfig.model,
        system:    judgeConfig.system,
        user:      buildJudgeUser(toJudgeItem(q, ctx)) as string,
        maxTokens: 300,
      })
      const raw = parseJudgeScore(reply) as number | null
      return { index, raw, score: raw == null ? null : (calibrate(raw, judgeConfig.calibration) as number) }
    } catch {
      return { index, raw: null, score: null }
    }
  }))
}

/** Indices of questions whose distractors should be rewritten. */
export function weakQuestionIndices(scores: DistractorScore[]): number[] {
  return scores.filter(s => s.raw != null && s.raw <= judgeConfig.flagRawAtOrBelow).map(s => s.index)
}
