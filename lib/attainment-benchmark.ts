/**
 * Outcome Benchmarking Aggregation
 *
 * CONSENT-GATED: only students whose parent/guardian has opted into the
 * OUTCOME_BENCHMARKING ConsentPurpose contribute to these aggregates.
 * Deliberately separate from SchoolCohortAggregate (which is not consent-gated).
 *
 * SUPPRESSION: any cohort with consentedCohortSize < MIN_BENCHMARK_COHORT is
 * written with suppressed=true and zeroed metric fields to prevent small-cohort
 * re-identification. Do NOT lower this threshold without DPO sign-off.
 *
 * See evidence/phase-outcome-benchmarking/README.md for the full DPIA addendum.
 */

import { prisma } from '@/lib/prisma'

/** Minimum consented cohort size for un-suppressed output. Do not lower without DPO sign-off. */
export const MIN_BENCHMARK_COHORT = 10

const OUTCOME_BENCHMARKING_SLUG = 'outcome-benchmarking'

/**
 * PLACEHOLDER — requires academic and DPO review before production use.
 *
 * Maps a prior attainment score (0–100, typically KS2/SATs or CATs) to a
 * predicted GCSE grade (1–9). Current implementation is a simple linear
 * mapping. Replace with a validated value-added regression model calibrated
 * against real cohort outcomes before this feature is promoted beyond internal
 * dashboards.
 *
 * @review Sign-off required from: academic lead, DPO, product owner
 *         before any uplift figures are shared externally.
 */
function predictedOutcome(priorAttainment: number): number {
  // Placeholder: linear interpolation  0 → grade 1,  100 → grade 9
  return Math.max(1, Math.min(9, Math.round(1 + (priorAttainment / 100) * 8)))
}

function round1dp(n: number): number {
  return Math.round(n * 10) / 10
}

/** Returns the current academic year label, e.g. "2025-26". */
function currentPeriodLabel(): string {
  const now   = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()
  const start = month >= 9 ? year : year - 1
  return `${start}-${String(start + 1).slice(-2)}`
}

// ── Main computation ──────────────────────────────────────────────────────────

export async function computeAttainmentBenchmarks(): Promise<number> {
  const periodLabel = currentPeriodLabel()

  // 1. Find all active OUTCOME_BENCHMARKING consent purposes across all schools
  const purposes = await prisma.consentPurpose.findMany({
    where:  { slug: OUTCOME_BENCHMARKING_SLUG, isActive: true },
    select: { id: true, schoolId: true },
  })
  if (!purposes.length) return 0

  const purposeSchoolMap = Object.fromEntries(purposes.map(p => [p.id, p.schoolId]))

  // 2. Load all GRANTED consent records for these purposes
  const consentRecords = await prisma.consentRecord.findMany({
    where:  { purposeId: { in: purposes.map(p => p.id) }, decision: 'granted' },
    select: { purposeId: true, studentId: true },
  })
  if (!consentRecords.length) return 0

  // Map studentId (User.id) → schoolId
  const studentSchoolMap: Record<string, string> = {}
  for (const r of consentRecords) {
    const schoolId = purposeSchoolMap[r.purposeId]
    if (schoolId) studentSchoolMap[r.studentId] = schoolId
  }
  const consentedIds = Object.keys(studentSchoolMap)

  // 3. Load User records for yearGroup
  const users = await prisma.user.findMany({
    where:  { id: { in: consentedIds } },
    select: { id: true, schoolId: true, yearGroup: true },
  })
  const userMap: Record<string, { schoolId: string; yearGroup: number | null }> =
    Object.fromEntries(users.map(u => [u.id, { schoolId: u.schoolId, yearGroup: u.yearGroup }]))

  // 4. Load StudentBaseline records for consented students
  const baselines = await prisma.studentBaseline.findMany({
    where:  { studentId: { in: consentedIds } },
    select: { studentId: true, baselineScore: true },
  })

  // 5. Load graded submissions for current academic year
  const yearStart = new Date(`${periodLabel.split('-')[0]}-09-01`)
  const submissions = await prisma.submission.findMany({
    where: {
      studentId:   { in: consentedIds },
      finalScore:  { not: null },
      submittedAt: { gte: yearStart },
    },
    select: { studentId: true, finalScore: true },
  })

  // 6. Build per-school/yearGroup buckets
  type Bucket = {
    schoolId:     string
    priorScores:  number[]
    actualScores: number[]
    consentedIds: Set<string>
  }
  const buckets = new Map<string, Bucket>()
  const bKey = (schoolId: string, yg: string) => `${schoolId}::${yg}`

  for (const b of baselines) {
    const user = userMap[b.studentId]
    if (!user) continue
    const yg = user.yearGroup?.toString() ?? 'ALL'
    const k  = bKey(user.schoolId, yg)
    if (!buckets.has(k)) {
      buckets.set(k, { schoolId: user.schoolId, priorScores: [], actualScores: [], consentedIds: new Set() })
    }
    const bucket = buckets.get(k)!
    bucket.priorScores.push(b.baselineScore)
    bucket.consentedIds.add(b.studentId)
  }

  for (const s of submissions) {
    if (s.finalScore == null) continue
    const user = userMap[s.studentId]
    if (!user) continue
    const yg = user.yearGroup?.toString() ?? 'ALL'
    const k  = bKey(user.schoolId, yg)
    if (!buckets.has(k)) {
      buckets.set(k, { schoolId: user.schoolId, priorScores: [], actualScores: [], consentedIds: new Set() })
    }
    const bucket = buckets.get(k)!
    // finalScore is 0–100; convert to GCSE grade 1–9
    const grade = Math.max(1, Math.min(9, Math.round(1 + (s.finalScore / 100) * 8)))
    bucket.actualScores.push(grade)
    bucket.consentedIds.add(s.studentId)
  }

  if (!buckets.size) return 0

  // 7. Load total school/year student counts (denominator for consent rate display)
  const allStudentUsers = await prisma.user.findMany({
    where:   { role: 'STUDENT', isActive: true },
    select:  { schoolId: true, yearGroup: true },
  })
  const totalMap: Record<string, number> = {}
  for (const u of allStudentUsers) {
    const yg = u.yearGroup?.toString() ?? 'ALL'
    const k  = bKey(u.schoolId, yg)
    totalMap[k] = (totalMap[k] ?? 0) + 1
  }

  // 8. Compute metrics and upsert
  let count = 0
  for (const [k, bucket] of buckets) {
    const yearGroup           = k.split('::')[1]
    const consentedCohortSize = bucket.consentedIds.size
    const cohortSize          = totalMap[k] ?? consentedCohortSize
    const suppressed          = consentedCohortSize < MIN_BENCHMARK_COHORT

    const avgPrior = bucket.priorScores.length
      ? bucket.priorScores.reduce((a, b) => a + b, 0) / bucket.priorScores.length
      : 0
    const avgActual = bucket.actualScores.length
      ? bucket.actualScores.reduce((a, b) => a + b, 0) / bucket.actualScores.length
      : 0
    const avgPredicted = predictedOutcome(avgPrior)
    const uplift = avgPredicted > 0
      ? round1dp(((avgActual - avgPredicted) / avgPredicted) * 100)
      : 0

    const metrics = suppressed
      ? { avgPriorAttainment: 0, avgPredictedOutcome: 0, avgActualOutcome: 0, upliftPercent: 0 }
      : {
          avgPriorAttainment:  round1dp(avgPrior),
          avgPredictedOutcome: round1dp(avgPredicted),
          avgActualOutcome:    round1dp(avgActual),
          upliftPercent:       uplift,
        }

    const data = { cohortSize, consentedCohortSize, ...metrics, suppressed, computedAt: new Date() }

    await prisma.attainmentBenchmark.upsert({
      where:  { schoolId_yearGroup_periodLabel: { schoolId: bucket.schoolId, yearGroup, periodLabel } },
      update: data,
      create: { schoolId: bucket.schoolId, yearGroup, periodLabel, subject: null, ...data },
    })
    count++
  }

  return count
}

// ── Read helpers ──────────────────────────────────────────────────────────────

export type AttainmentBenchmarkRow = {
  id:                   string
  schoolId:             string
  yearGroup:            string
  periodLabel:          string
  cohortSize:           number
  consentedCohortSize:  number
  avgPriorAttainment:   number
  avgPredictedOutcome:  number
  avgActualOutcome:     number
  upliftPercent:        number
  suppressed:           boolean
  computedAt:           Date
}

export async function getSchoolBenchmarkRows(schoolId: string): Promise<AttainmentBenchmarkRow[]> {
  const rows = await prisma.attainmentBenchmark.findMany({
    where:   { schoolId },
    orderBy: [{ yearGroup: 'asc' }, { periodLabel: 'desc' }],
  })
  return rows as unknown as AttainmentBenchmarkRow[]
}

/**
 * Returns a network-wide aggregate — weighted mean across all un-suppressed
 * rows, with NO school-level or year-group-level breakdown.
 * Intended for the platform admin marketing export ONLY.
 * Returns null when there are no un-suppressed rows.
 */
export async function getNetworkBenchmarkAggregate(): Promise<{
  schoolCount:     number
  studentCount:    number
  consentedCount:  number
  avgUplift:       number
  upliftAvailable: boolean
} | null> {
  const rows = await prisma.attainmentBenchmark.findMany({
    where:  { suppressed: false },
    select: { schoolId: true, cohortSize: true, consentedCohortSize: true, upliftPercent: true },
  })
  if (!rows.length) return null

  const schoolIds     = new Set(rows.map(r => r.schoolId))
  const totalStudents = rows.reduce((s, r) => s + r.cohortSize, 0)
  const totalConsented = rows.reduce((s, r) => s + r.consentedCohortSize, 0)
  const weightedUplift = rows.reduce((s, r) => s + r.upliftPercent * r.consentedCohortSize, 0)
  const avgUplift      = totalConsented > 0
    ? round1dp(weightedUplift / totalConsented)
    : 0

  return {
    schoolCount:     schoolIds.size,
    studentCount:    totalStudents,
    consentedCount:  totalConsented,
    avgUplift,
    upliftAvailable: totalConsented >= MIN_BENCHMARK_COHORT,
  }
}
