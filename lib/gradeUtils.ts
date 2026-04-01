/**
 * gradeUtils.ts — consolidated grade display helpers
 *
 * Builds on lib/grading.ts primitives to provide formatting utilities
 * used across analytics, progress, and marking views.
 */

import { GCSE_LETTERS, percentToGcseGrade } from './grading'

/**
 * Format a GCSE grade (1–9) as a human-readable string.
 * "Grade 7 (A)"
 */
export function formatGrade(grade: number | null | undefined): string {
  if (grade == null) return '—'
  const letter = GCSE_LETTERS[Math.round(grade)]
  if (!letter) return `Grade ${Math.round(grade)}`
  return `Grade ${Math.round(grade)} (${letter})`
}

/**
 * Convert any score to a GCSE grade (1–9), handling both raw 0–9
 * scores and 0–100 percentages.
 *
 * Detection rule (matches normalizeScoreForForm):
 *   • score ≤ 9  → treat as raw GCSE grade (return as-is, clamped 1–9)
 *   • score > 9  → treat as percentage → convert via percentToGcseGrade
 */
export function scoreToGcseGrade(score: number | null | undefined): number | null {
  if (score == null) return null
  if (score <= 9)  return Math.max(1, Math.min(9, Math.round(score)))
  return percentToGcseGrade(score)
}

/**
 * Format a raw score (either 0–9 grade or 0–100 percentage) for
 * compact display in lists.  Returns e.g. "Grade 7 (A)".
 */
export function formatRawScore(score: number | null | undefined): string {
  const grade = scoreToGcseGrade(score)
  return formatGrade(grade)
}

/**
 * Format a 0–9 GCSE average for display in analytics tables.
 * e.g. avgScore=6.4  →  "Grade 6 (B)"  with subtitle "avg 6.4"
 *
 * Returns { main, sub } for flexible rendering.
 */
export function formatAvgGrade(avgScore: number | null | undefined): { main: string; sub: string } {
  if (avgScore == null) return { main: '—', sub: '' }
  const rounded = Math.round(avgScore)
  const letter  = GCSE_LETTERS[Math.max(1, Math.min(9, rounded))] ?? '?'
  return {
    main: `Gr ${Math.max(1, Math.min(9, rounded))} (${letter})`,
    sub:  `avg ${avgScore.toFixed(1)}`,
  }
}
