/**
 * UK GCSE grade utilities (1–9 scale)
 */

export function percentToGcseGrade(pct: number): number {
  if (pct >= 90) return 9
  if (pct >= 80) return 8
  if (pct >= 70) return 7
  if (pct >= 60) return 6
  if (pct >= 50) return 5
  if (pct >= 40) return 4
  if (pct >= 30) return 3
  if (pct >= 20) return 2
  return 1
}

/**
 * Format a score for display.
 * - If showGrade is true: "87% (Grade 8)"
 * - Otherwise: "87%"
 * If score is null, returns "Not marked".
 */
export function formatScore(
  score: number | null,
  maxScore?: number,
  showGrade = true,
): string {
  if (score == null) return 'Not marked'
  const pct   = maxScore && maxScore !== 100 ? Math.round((score / maxScore) * 100) : score
  const grade = percentToGcseGrade(pct)
  if (showGrade) return `${pct}% (Grade ${grade})`
  return `${pct}%`
}

/**
 * Normalise a stored finalScore to the raw-score scale used in the marking form.
 *
 * autoMarkSubmission stores finalScore as a percentage (0–100).
 * Manual markSubmission stores finalScore on the 0–maxScore scale (typically 0–9).
 *
 * Detection: if stored value > maxScore and maxScore ≤ 20, treat as percentage.
 */
export function normalizeScoreForForm(
  finalScore: number | null,
  maxScore: number,
): string {
  if (finalScore == null) return ''
  if (finalScore > maxScore && maxScore <= 20) {
    return String(Math.round((finalScore / 100) * maxScore))
  }
  return String(finalScore)
}
