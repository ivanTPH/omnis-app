'use server'

import { requireAuth } from '@/lib/session'
import { getSchoolCohortContext, type CohortContext } from '@/lib/cohort-aggregate'

export type { CohortContext }

/**
 * Returns the school-level cohort aggregate for the SENCO dashboard, SLT
 * analytics, and ILP generation context. Optionally scoped to a year group.
 * Cached at the DB level — no Claude calls.
 */
export async function getSchoolCohortInsights(yearGroup?: number): Promise<CohortContext | null> {
  const user = await requireAuth()
  const allowed = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR', 'HEAD_OF_DEPT', 'PLATFORM_ADMIN', 'ACADEMY_ADMIN']
  if (!allowed.includes(user.role)) return null

  return getSchoolCohortContext(user.schoolId, yearGroup)
}
