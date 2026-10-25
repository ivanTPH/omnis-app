/**
 * Wonde's /lessons endpoint returns one row per dated occurrence of each
 * lesson across the school year, so a teacher with 23 weekly lessons has
 * ~850 timetable rows. Every screen that shows a weekly timetable (or builds
 * cover slots from one) must narrow those rows to a single week and show each
 * lesson once. These helpers do both.
 *
 * - When rows carry a date (WondeTimetableEntry.effectiveDate, from the
 *   lesson's start_at), use the week containing the reference date, or the
 *   next week that has lessons (so half-term doesn't show an empty timetable).
 * - Always de-duplicate by class + period + teacher, which also fixes rows
 *   synced before dates were stored.
 */
import type { Prisma } from '@prisma/client'

const DAY_MS = 86_400_000

/** Monday 00:00 UTC of the week containing `d`. */
export function startOfWeekUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = x.getUTCDay() || 7
  return new Date(x.getTime() - (day - 1) * DAY_MS)
}

/**
 * Prisma filter selecting one week of timetable rows for a school.
 * Returns {} (no narrowing) when the school's rows carry no dates.
 */
export async function timetableWeekWhere(
  schoolId: string,
  ref: Date = new Date(),
): Promise<Prisma.WondeTimetableEntryWhereInput> {
  // Imported lazily so the pure helpers below can be unit-tested without a Prisma client.
  const { prisma } = await import('@/lib/prisma')
  const from = startOfWeekUTC(ref)
  const next = await prisma.wondeTimetableEntry.findFirst({
    where:   { schoolId, effectiveDate: { gte: from } },
    orderBy: { effectiveDate: 'asc' },
    select:  { effectiveDate: true },
  })
  if (!next?.effectiveDate) return {}
  const weekStart = startOfWeekUTC(next.effectiveDate)
  return {
    OR: [
      { effectiveDate: null },
      { effectiveDate: { gte: weekStart, lt: new Date(weekStart.getTime() + 7 * DAY_MS) } },
    ],
  }
}

/** One row per class + period + teacher, keeping the first seen. */
export function dedupeTimetableEntries<T extends { classId: string; periodId: string; employeeId: string | null }>(
  entries: T[],
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const e of entries) {
    const key = `${e.classId}|${e.periodId}|${e.employeeId ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  return out
}
