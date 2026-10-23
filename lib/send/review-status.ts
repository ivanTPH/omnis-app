/**
 * Single source of truth for "is this SEND review overdue, due soon, or
 * scheduled" — used by the SENCO dashboard, ILP cards/detail, APDR cycles,
 * EHCP plans, teacher My SEND Students, SLT SEND Reporting, the Head of
 * Year "Reviews Due" tile, and the AI Plan Coherence flags.
 *
 * Before this existed, each screen computed its own day-count, and several
 * did it with `Math.max(0, Math.floor((reviewDate - now) / 86_400_000))` —
 * which clamps every overdue date to 0, so an overdue review reads as
 * "due today" and never gets counted as overdue anywhere. That bug is
 * exactly why this module exists: compute the state once, correctly, and
 * have every screen call it.
 */

export type ReviewState = 'overdue' | 'due_soon' | 'scheduled'

export interface ReviewStatus {
  state: ReviewState
  /** Whole calendar days (Europe/London) from today to the review date — negative when overdue. */
  daysUntil: number
}

const LONDON_TZ = 'Europe/London'
const MS_PER_DAY = 86_400_000

// en-CA formats as YYYY-MM-DD, which Date.parse(`${key}T00:00:00Z`) reads back
// unambiguously — this is just a convenient way to get the Europe/London
// calendar date for an instant without a date library.
const londonDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LONDON_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * The UTC timestamp of midnight on `date`'s Europe/London calendar day.
 * Normalising both sides to this before differencing is what makes the day
 * count correct regardless of what time of day "now" is, what time of day
 * a review date was stored at, or whether BST is in effect on either side.
 */
function londonMidnightUtcMs(date: Date): number {
  return Date.parse(`${londonDateFormatter.format(date)}T00:00:00Z`)
}

function toDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value
}

/** Due-soon window used everywhere unless a screen has its own statutory window (e.g. EHCP's 28-day warning). */
export const DEFAULT_DUE_SOON_WINDOW_DAYS = 14

export function getReviewStatus(
  reviewDate: Date | string,
  today: Date = new Date(),
  dueSoonWindowDays: number = DEFAULT_DUE_SOON_WINDOW_DAYS,
): ReviewStatus {
  const daysUntil = Math.round(
    (londonMidnightUtcMs(toDate(reviewDate)) - londonMidnightUtcMs(today)) / MS_PER_DAY,
  )
  const state: ReviewState =
    daysUntil < 0 ? 'overdue' : daysUntil <= dueSoonWindowDays ? 'due_soon' : 'scheduled'
  return { state, daysUntil }
}

/** "Overdue by 3 days" / "Due today" / "Due tomorrow" / "Due in 9 days" — never a generic badge. */
export function reviewStatusLabel(status: ReviewStatus): string {
  if (status.state === 'overdue') {
    const days = Math.abs(status.daysUntil)
    return `Overdue by ${days} day${days === 1 ? '' : 's'}`
  }
  if (status.daysUntil === 0) return 'Due today'
  if (status.daysUntil === 1) return 'Due tomorrow'
  return `Due in ${status.daysUntil} days`
}

/**
 * Ascending by the raw review date already sorts "overdue first, then
 * soonest-due" — an overdue date is chronologically earlier than any
 * future due-soon date, so no separate "is it overdue" sort key is needed.
 * Exported so call sites don't have to re-derive `.getTime()` comparisons.
 */
export function compareByReviewDate(a: Date | string, b: Date | string): number {
  return toDate(a).getTime() - toDate(b).getTime()
}

export function countByReviewState(
  dates: Array<Date | string>,
  state: ReviewState,
  today: Date = new Date(),
  dueSoonWindowDays: number = DEFAULT_DUE_SOON_WINDOW_DAYS,
): number {
  return dates.filter(d => getReviewStatus(d, today, dueSoonWindowDays).state === state).length
}
