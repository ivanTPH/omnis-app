/**
 * UK GCSE grade utilities (1–9 scale)
 *
 * Grade 9 = A** | 8 = A* | 7 = A | 6 = B | 5 = C+ | 4 = C | 3 = D | 2 = E | 1 = F
 */

export const GCSE_LETTERS: Record<number, string> = {
  9: 'A**', 8: 'A*', 7: 'A', 6: 'B', 5: 'C+', 4: 'C', 3: 'D', 2: 'E', 1: 'F',
}

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

/** "4 (C)" — compact grade label with letter abbreviation */
export function gradeLabel(grade: number | null | undefined): string {
  if (grade == null) return 'U'
  return `${grade} (${GCSE_LETTERS[grade] ?? '?'})`
}

/** Tailwind classes for a colour-coded GCSE grade pill (9,8=dark green / 7,6=green / 5,4=amber / 3,2,1=red) */
export function gradePillClass(grade: number | null | undefined): string {
  if (grade == null || grade < 1) return 'bg-gray-100 text-gray-400'
  if (grade >= 8) return 'bg-green-700 text-white'
  if (grade >= 6) return 'bg-green-500 text-white'
  if (grade >= 4) return 'bg-amber-400 text-white'
  return 'bg-red-500 text-white'
}

/**
 * Format a score for display — always shows grade, never a raw fraction.
 * e.g. score=7, maxScore=9 → "78% — Grade 7 (A)"
 */
export function formatScore(
  score: number | null,
  maxScore?: number,
  showGrade = true,
): string {
  if (score == null) return 'Not marked'
  const pct   = maxScore && maxScore !== 100 ? Math.round((score / maxScore) * 100) : score
  const grade = percentToGcseGrade(pct)
  if (showGrade) return `${pct}% — Grade ${grade} (${GCSE_LETTERS[grade]})`
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
