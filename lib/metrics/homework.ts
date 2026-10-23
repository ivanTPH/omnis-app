/**
 * Homework status + assignment-count functions — the one place that
 * decides "has this submission been marked" and "what state is this
 * assignment in for this pupil", so every screen agrees.
 *
 * Root cause traced for the "7 to mark on the dashboard/homework list but
 * 10/28 marked, Ungraded 18 on the marking screen" bug: autoMarkSubmission
 * sets `status: 'MARKED'` + `finalScore` but does NOT touch the legacy
 * `grade` string field — only the teacher's "Mark & Return" action
 * (markSubmission) sets `grade`, and it always does so in the same write as
 * `status: 'RETURNED'`. So `grade != null` and `status === 'RETURNED'` are
 * actually always in lock-step — but app/homework/page.tsx's needsMarkCount
 * additionally required `!finalScore`, which auto-marking DOES set. That
 * extra condition silently excluded every auto-marked-but-not-yet-reviewed
 * submission from "to mark" there, while the dashboard, HomeworkMarkingView
 * and HomeworkMarkingV2 (which all key off `grade`/`status !== 'RETURNED'`)
 * correctly still counted them as outstanding. `needsMarking()` below is
 * the one place that decision is made, matching the majority convention
 * already established across those three screens: a submission still
 * needs teacher action — hasn't been returned to the pupil — until its
 * status is RETURNED, whether or not AI has pre-filled a score.
 */

export type SubmissionStatusLike =
  | 'SUBMITTED' | 'UNDER_REVIEW' | 'RESUBMISSION_REQ' | 'MARKED' | 'RETURNED'

/** True while a submission still needs teacher action (has not been returned to the pupil). */
export function needsMarking(status: SubmissionStatusLike): boolean {
  return status !== 'RETURNED'
}

export interface SubmissionForCounts {
  status: SubmissionStatusLike
}

export interface AssignmentCounts {
  expected:  number  // pupils who should submit (e.g. the class roster)
  submitted: number  // pupils who have submitted at all
  marked:    number  // submitted AND returned to the pupil
  toMark:    number  // submitted AND NOT yet returned — see needsMarking()
}

/** One assignment's counts, from its roster size and its submissions. */
export function getAssignmentCounts(expected: number, submissions: SubmissionForCounts[]): AssignmentCounts {
  const submitted = submissions.length
  const toMark     = submissions.filter(s => needsMarking(s.status)).length
  return { expected, submitted, marked: submitted - toMark, toMark }
}

/** "8 assignments · 19 scripts to mark" — the two units a single raw number conflates. */
export interface ToMarkTotals {
  assignments: number  // distinct assignments with at least one script still to mark
  scripts:     number  // total scripts still to mark, across those assignments
}

export function getToMarkTotals(perAssignment: AssignmentCounts[]): ToMarkTotals {
  const outstanding = perAssignment.filter(a => a.toMark > 0)
  return {
    assignments: outstanding.length,
    scripts:     outstanding.reduce((sum, a) => sum + a.toMark, 0),
  }
}

// ── Per-pupil, per-assignment status ────────────────────────────────────────

export type HomeworkStatusValue =
  | 'draft' | 'open' | 'due_today' | 'overdue' | 'submitted' | 'marked' | 'closed'

export interface HomeworkStatusInput {
  homeworkStatus: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
  dueAt: Date | string
  /** This pupil's submission status, or null if they haven't submitted. */
  submissionStatus: SubmissionStatusLike | null
}

const LONDON_TZ = 'Europe/London'
const londonDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LONDON_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
})
function londonDateKey(date: Date): string {
  return londonDateFormatter.format(date)
}

/**
 * Status for one pupil, one assignment. Checked in this order:
 *  1. Draft — the homework itself isn't published yet.
 *  2. This pupil's own submission outcome (Submitted / Marked) — once a
 *     pupil has submitted, their status is about THEIR work, never about
 *     the due date any more. This is what "Overdue (only when the pupil
 *     has not submitted after the due date)" means, and it's what fixes
 *     "fully submitted and marked past homework labelled Overdue": a
 *     submission existing is checked BEFORE any due-date comparison.
 *  3. Closed — the assignment itself is closed and this pupil never
 *     submitted (distinct from Overdue: no further action is possible).
 *  4. Overdue / Due today / Open — based on the due date, Europe/London
 *     calendar day (not a raw ms diff, so time-of-day/DST can't shift it).
 */
export function getHomeworkStatus(input: HomeworkStatusInput, now: Date = new Date()): HomeworkStatusValue {
  if (input.homeworkStatus === 'DRAFT') return 'draft'

  if (input.submissionStatus != null) {
    return input.submissionStatus === 'RETURNED' ? 'marked' : 'submitted'
  }

  if (input.homeworkStatus === 'CLOSED') return 'closed'

  const dueDay   = londonDateKey(typeof input.dueAt === 'string' ? new Date(input.dueAt) : input.dueAt)
  const todayDay = londonDateKey(now)
  if (dueDay < todayDay)  return 'overdue'
  if (dueDay === todayDay) return 'due_today'
  return 'open'
}
