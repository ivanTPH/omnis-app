/**
 * lib/text-diff.ts
 *
 * Small, dependency-free helpers for dspy-service/INTEGRATION.md's Step 1
 * ("Record teacher edits") -- computing how much a teacher changed
 * AI-generated content before saving, without pulling in a diff/string-distance
 * package for what's a fairly small need.
 *
 * levenshtein() feeds ResourceVersion.editDistance, which DSPy's data.py
 * normalises as `min(1.0, editDistance / 500.0)` -- a character-level distance,
 * not word-level, so this stays char-based to match.
 *
 * summarizeEdit() is deliberately NOT a line-level structured diff (e.g. from
 * the `diff` npm package) -- it's a before/after snapshot plus the same
 * character distance, truncated to a sane length. That's enough for a human
 * reviewing the audit trail directly and for DSPy's fast metric, which only
 * ever reads editDistance itself, not diffSummary's shape.
 */

const MAX_SNAPSHOT_CHARS = 4000

/** Classic O(n*m) Levenshtein distance. Fine at these string lengths (a homework
 *  question, an ILP target, a K Plan section) -- not intended for large documents. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const al = a.length
  const bl = b.length
  if (al === 0) return bl
  if (bl === 0) return al

  let prevRow = Array.from({ length: bl + 1 }, (_, i) => i)
  let currRow = new Array<number>(bl + 1)

  for (let i = 1; i <= al; i++) {
    currRow[0] = i
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      currRow[j] = Math.min(
        prevRow[j] + 1,      // deletion
        currRow[j - 1] + 1,  // insertion
        prevRow[j - 1] + cost, // substitution
      )
    }
    ;[prevRow, currRow] = [currRow, prevRow]
  }
  return prevRow[bl]
}

export type DiffSummary = {
  before: string
  after: string
  charsChanged: number
  beforeTruncated: boolean
  afterTruncated: boolean
}

/** Computes the editDistance + a diffSummary payload for a ResourceVersion write. */
export function summarizeEdit(before: string, after: string): { editDistance: number; diffSummary: DiffSummary } {
  const editDistance = levenshtein(before, after)
  return {
    editDistance,
    diffSummary: {
      before: before.slice(0, MAX_SNAPSHOT_CHARS),
      after: after.slice(0, MAX_SNAPSHOT_CHARS),
      charsChanged: editDistance,
      beforeTruncated: before.length > MAX_SNAPSHOT_CHARS,
      afterTruncated: after.length > MAX_SNAPSHOT_CHARS,
    },
  }
}
