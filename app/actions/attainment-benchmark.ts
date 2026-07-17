'use server'

import { requireAuth } from '@/lib/session'
import {
  getSchoolBenchmarkRows,
  getNetworkBenchmarkAggregate,
  type AttainmentBenchmarkRow,
} from '@/lib/attainment-benchmark'

/**
 * Returns all AttainmentBenchmark rows for the platform admin dashboard.
 * PLATFORM_ADMIN only.
 */
export async function getAllAttainmentBenchmarks(): Promise<{
  bySchool: Record<string, AttainmentBenchmarkRow[]>
  network:  Awaited<ReturnType<typeof getNetworkBenchmarkAggregate>>
}> {
  const { role } = await requireAuth(['PLATFORM_ADMIN'])
  void role  // role check enforced by requireAuth

  // Load all schools that have benchmark data
  const { prisma } = await import('@/lib/prisma')
  const schoolIds = await prisma.attainmentBenchmark
    .findMany({ distinct: ['schoolId'], select: { schoolId: true } })
    .then(rows => rows.map(r => r.schoolId))

  const [bySchoolEntries, network] = await Promise.all([
    Promise.all(schoolIds.map(async id => [id, await getSchoolBenchmarkRows(id)] as const)),
    getNetworkBenchmarkAggregate(),
  ])

  return {
    bySchool: Object.fromEntries(bySchoolEntries),
    network,
  }
}

/**
 * Network-wide marketing aggregate export.
 * Returns ONLY the weighted mean across un-suppressed cohorts.
 * No school-level or year-group breakdown is ever returned.
 * PLATFORM_ADMIN only.
 */
export async function getMarketingBenchmarkExport() {
  await requireAuth(['PLATFORM_ADMIN'])
  return getNetworkBenchmarkAggregate()
}
