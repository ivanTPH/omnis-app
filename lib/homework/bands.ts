/**
 * Grading-band helpers shared by the marking screens and the server.
 *
 * Homework stores its grading bands as an object whose keys name the score
 * range, and the key styles vary: "7" (single scores), "0-3" (ranges) and,
 * from AI-generated homework, "Low (1–3)". The old helpers split keys on "-"
 * and parsed each part as a whole number, so a key like "Low (1–3)" gave no
 * numbers and the maximum came out as 1 (marking screens) or NaN (the
 * grade-drop check on save). Reading every integer in each key handles all
 * three styles.
 */
import { percentToGcseGrade } from '@/lib/grading'

/** Highest score named by any band key; `fallback` when the bands name none. */
export function maxScoreFromBands(bands: unknown, fallback = 9): number {
  if (!bands || typeof bands !== 'object' || Array.isArray(bands)) return fallback
  const numbers = Object.keys(bands).flatMap(k => (k.match(/\d+/g) ?? []).map(Number))
  const max = numbers.length ? Math.max(...numbers) : 0
  return max > 0 ? max : fallback
}

/**
 * The score (0..maxScore) to store for a suggested GCSE grade, chosen so the
 * marking screen — which shows percentToGcseGrade(score / maxScore) — displays
 * that same grade. "U" is 0. Picks the smallest score that shows the grade; if
 * the scale is too coarse for any score to show it, falls back to the
 * proportional score.
 */
export function scoreForGrade(grade: string, maxScore: number): number {
  if (grade === 'U' || maxScore <= 0) return 0
  const g = Number(grade)
  if (!Number.isInteger(g) || g < 1 || g > 9) return 0
  for (let s = 0; s <= maxScore; s++) {
    if (percentToGcseGrade(Math.round((s / maxScore) * 100)) === g) return s
  }
  return Math.round((g / 9) * maxScore)
}
