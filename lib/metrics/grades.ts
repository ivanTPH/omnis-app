/**
 * Average-grade functions — the one place "average grade for a set of
 * pupils/classes over a period" gets computed, so every screen rounds and
 * weights it the same way.
 *
 * Two real bugs this fixes, found while tracing why the same school/
 * department grade showed different numbers on different screens:
 *
 * 1. Submission.finalScore is stored on each homework's OWN max-score scale
 *    (derived from that homework's gradingBands — which can be 5, 9, 20, 25,
 *    anything), not a universal 0–9 grade. Averaging raw finalScore values
 *    across submissions from different homeworks (e.g. a DB-side
 *    `_avg: { finalScore: true }`) mixes incompatible scales — a "7/9" and a
 *    "7/25" both contribute "7" to the average, even though one is a strong
 *    grade and the other is weak. `averageGrade()` fixes this by converting
 *    each submission to a GCSE grade (1–9) via its own maxScore first.
 *
 * 2. Department/school-wide figures were computed as a "mean of class
 *    means" at an inconsistent number of levels — one screen averaged
 *    class-level averages directly, another averaged per-teacher averages
 *    (each itself a mean of that teacher's classes) — and neither weighted
 *    by how many students were actually in each class. A small class and a
 *    large class counted equally, and double-averaging through a teacher
 *    level shifts the result again. `weightedClassAverage()` fixes this by
 *    weighting every class's average by its own student count, in one step.
 */

import { percentToGcseGrade } from '@/lib/grading'

/**
 * Homework.gradingBands is a `Record<bandLabel, description>` whose keys
 * encode the mark range for that band, e.g. `{"0-3": "...", "4-6": "...",
 * "7-9": "..."}` — the homework's own max score is the highest number
 * across all band keys. Was previously copy-pasted identically into 5
 * different action files; consolidated here as the one place it's defined.
 */
export function maxScoreFromBands(bands: unknown): number {
  if (!bands || typeof bands !== 'object') return 9
  const keys = Object.keys(bands as Record<string, string>)
  const nums = keys.flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n)))
  return nums.length ? Math.max(...nums) : 9
}

/** Same rounding everywhere a grade average is displayed: 1 decimal place. */
export function roundGrade(value: number): number {
  return Math.round(value * 10) / 10
}

/** A single submission's raw score plus the max score it was marked out of. */
export interface ScoredSubmission {
  finalScore: number | null
  maxScore: number
}

/** Converts one submission's raw score to a GCSE grade (1–9) via its own max score. Returns null if unmarked. */
export function gradeFromScore(finalScore: number | null, maxScore: number): number | null {
  if (finalScore == null) return null
  if (maxScore <= 0) return null
  const pct = Math.min(100, Math.max(0, (finalScore / maxScore) * 100))
  return percentToGcseGrade(pct)
}

/**
 * Average GCSE grade (1–9) across a set of marked submissions, each
 * normalised to its own max score before averaging. Returns null if none
 * are marked yet.
 */
export function averageGrade(subs: ScoredSubmission[]): number | null {
  const grades = subs
    .map(s => gradeFromScore(s.finalScore, s.maxScore))
    .filter((g): g is number => g != null)
  if (grades.length === 0) return null
  return roundGrade(grades.reduce((a, b) => a + b, 0) / grades.length)
}

/** A class (or teacher, or any group) with its own average grade and how many pupils it covers. */
export interface WeightedClassScore {
  avgScore: number | null
  studentCount: number
}

/**
 * Student-count-weighted average across a set of classes — a class of 30
 * counts 30x as much as a class of 1. This is what "department average" or
 * "school average" must use when built from per-class averages, instead of
 * a plain mean of those averages (which silently equal-weights every class
 * regardless of size, and gets worse the more levels — class → teacher →
 * department — the mean passes through).
 */
export function weightedClassAverage(classes: WeightedClassScore[]): number | null {
  const valid = classes.filter((c): c is WeightedClassScore & { avgScore: number } =>
    c.avgScore != null && c.studentCount > 0)
  if (valid.length === 0) return null
  const totalStudents = valid.reduce((sum, c) => sum + c.studentCount, 0)
  const weightedSum   = valid.reduce((sum, c) => sum + c.avgScore * c.studentCount, 0)
  return roundGrade(weightedSum / totalStudents)
}
