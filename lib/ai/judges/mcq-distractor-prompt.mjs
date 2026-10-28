// Prompt builder for the MCQ distractor-quality checker.
//
// Plain JavaScript (not TypeScript) on purpose: it is imported both by the app
// (lib/ai/judges/mcq-distractor.ts) and by scripts/calibrate-mcq-judge.mjs,
// which runs under plain Node without a TypeScript toolchain. One builder means
// the calibrated prompt and the production prompt cannot drift apart.

/**
 * @param {{ instruction: string, useExamples: boolean }} candidate
 * @param {{ rubric: string, examples: Array<{question: string, correct_answer: string, distractors: string[], score: number, justification?: string}> }} config
 * @returns {string}
 */
export function buildJudgeSystem(candidate, config) {
  const parts = [candidate.instruction, '', config.rubric]
  if (candidate.useExamples && config.examples.length) {
    parts.push('', 'Examples scored by experienced teachers:')
    for (const ex of config.examples) {
      parts.push(
        '',
        `Question: ${ex.question}`,
        `Correct answer: ${ex.correct_answer}`,
        `Distractors: ${ex.distractors.join(' | ')}`,
        `Score: ${ex.score}${ex.justification ? ` — ${ex.justification}` : ''}`,
      )
    }
  }
  parts.push('', 'Reply with JSON only, no other text: {"justification": "<one or two sentences>", "score": <integer 1-5>}')
  return parts.join('\n')
}

/**
 * @param {{ question: string, correct_answer: string, distractors: string[], subject?: string, key_stage?: string }} item
 * @returns {string}
 */
export function buildJudgeUser(item) {
  return [
    `Subject: ${item.subject || 'Unknown'}`,
    `Key stage: ${item.key_stage || 'Unknown'}`,
    `Question: ${item.question}`,
    `Correct answer: ${item.correct_answer}`,
    `Distractors: ${item.distractors.join(' | ')}`,
  ].join('\n')
}

/**
 * Reads the 1–5 score from the model's reply. Returns null if there is none.
 * @param {string} text
 * @returns {number | null}
 */
export function parseJudgeScore(text) {
  const m = String(text).match(/\{[\s\S]*\}/)
  if (m) {
    try {
      const n = Number(JSON.parse(m[0]).score)
      if (Number.isInteger(n) && n >= 1 && n <= 5) return n
    } catch { /* fall through to the regex */ }
  }
  const r = String(text).match(/"?score"?\s*[:=]\s*"?([1-5])\b/i)
  return r ? Number(r[1]) : null
}

/**
 * Applies the linear calibration fitted against teacher scores, rounded and
 * clamped to 1–5.
 * @param {number} raw
 * @param {{ slope: number, intercept: number }} c
 * @returns {number}
 */
export function calibrate(raw, c) {
  return Math.min(5, Math.max(1, Math.round(c.slope * raw + c.intercept)))
}
