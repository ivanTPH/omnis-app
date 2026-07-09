/**
 * School Cohort Aggregate computation.
 *
 * Reads all StudentLearningProfile records for a school (already computed
 * per-student by computeAndSaveAdaptiveProfile), joins with User.yearGroup
 * and SendStatus, then aggregates into SchoolCohortAggregate rows partitioned
 * by subject and year group.
 *
 * No Claude calls — pure DB aggregation. Called by the nightly cron after
 * all per-student profiles have been refreshed.
 */

import { prisma } from '@/lib/prisma'

type TypePerfEntry = { avg: number; count: number }
type TypePerfMap   = Record<string, TypePerfEntry>

export type CohortContext = {
  studentCount:       number
  sendCount:          number
  highConcernCount:   number
  avgCompletionRate:  number
  avgScore:           number
  bloomsPerformance:  Record<string, number>
  typePerformance:    TypePerfMap
  sendTypePerformance: TypePerfMap
  needAreaBreakdown:  Record<string, number>
  trendCounts:        { improving: number; stable: number; declining: number }
  topStrategies:      string[]
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function avgOf(nums: number[]): number {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0
}

function mergeTypePerf(
  acc: Record<string, { scores: number[] }>,
  perf: TypePerfMap,
  weight = 1,
) {
  for (const [type, d] of Object.entries(perf)) {
    if (!acc[type]) acc[type] = { scores: [] }
    // Re-expand avg back into individual scores (approximation — good enough for aggregation)
    for (let i = 0; i < d.count * weight; i++) acc[type].scores.push(d.avg)
  }
}

function collapseTypePerf(acc: Record<string, { scores: number[] }>): TypePerfMap {
  const out: TypePerfMap = {}
  for (const [type, d] of Object.entries(acc)) {
    if (d.scores.length) out[type] = { avg: avgOf(d.scores), count: d.scores.length }
  }
  return out
}

// ── Main aggregation function ─────────────────────────────────────────────────

export async function computeSchoolCohortAggregate(schoolId: string): Promise<number> {
  // Load all per-student profiles with user metadata and SEND status in one query
  const profiles = await prisma.studentLearningProfile.findMany({
    where: { schoolId },
    include: {
      student: {
        select: {
          yearGroup: true,
          sendStatus: { select: { activeStatus: true, needArea: true } },
        },
      },
    },
  })

  if (profiles.length === 0) return 0

  // Load top ILP strategies for this school (strategy strings, ranked by frequency)
  const ilpStrategies = await prisma.individualLearningPlan.findMany({
    where:  { schoolId, status: { in: ['active', 'under_review'] } },
    select: { strategies: true },
  })
  const strategyFreq: Record<string, number> = {}
  for (const ilp of ilpStrategies) {
    for (const s of ilp.strategies) {
      const key = s.trim().toLowerCase()
      strategyFreq[key] = (strategyFreq[key] ?? 0) + 1
    }
  }
  const globalTopStrategies = Object.entries(strategyFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s]) => s)

  // ── Partition profiles by subject and year group ─────────────────────────
  // We build two aggregate dimensions:
  //   1. subject="ALL", yearGroup=null — full school rollup
  //   2. subject="ALL", yearGroup=N   — per-year rollup
  // Subject breakdown requires per-submission data, which is expensive at
  // aggregate time. We defer subject breakdown to later iterations and focus
  // on the two most useful cuts first.

  interface Bucket {
    completionRates: number[]
    avgScores:       number[]
    bloomsRaw:       Record<string, number[]>
    typeRaw:         Record<string, { scores: number[] }>
    sendTypeRaw:     Record<string, { scores: number[] }>
    needAreas:       Record<string, number>
    trendImp:        number
    trendStab:       number
    trendDec:        number
    sendCount:       number
    highConcern:     number
    studentCount:    number
  }

  function newBucket(): Bucket {
    return {
      completionRates: [], avgScores: [], bloomsRaw: {}, typeRaw: {}, sendTypeRaw: {},
      needAreas: {}, trendImp: 0, trendStab: 0, trendDec: 0,
      sendCount: 0, highConcern: 0, studentCount: 0,
    }
  }

  const schoolBucket: Bucket  = newBucket()
  const yearBuckets: Record<number, Bucket> = {}

  for (const p of profiles) {
    const yearGroup  = p.student.yearGroup
    const sendStatus = p.student.sendStatus
    const isSend     = sendStatus?.activeStatus === 'SEN_SUPPORT' || sendStatus?.activeStatus === 'EHCP'
    const needArea   = sendStatus?.needArea ?? null
    const concern    = (p as any).sendConcernLevel as number | null

    const typePerf   = (p.typePerformance   as unknown as TypePerfMap) ?? {}
    const bloomsPerf = (p.bloomsPerformance as unknown as Record<string, number>) ?? {}
    const subjPerf   = (p.subjectPerformance as unknown as Record<string, { avg: number; trend: string }>) ?? {}

    // Compute per-student avg score across all subjects
    const subjectAvgs = Object.values(subjPerf).map(s => s.avg)
    const studentAvg  = avgOf(subjectAvgs)

    // Count trend signals
    const trends = Object.values(subjPerf).map(s => s.trend)
    const improving = trends.filter(t => t === 'improving').length
    const declining = trends.filter(t => t === 'declining').length

    function addToBucket(b: Bucket) {
      b.studentCount++
      b.completionRates.push(p.avgCompletionRate)
      if (studentAvg > 0) b.avgScores.push(studentAvg)
      if (isSend) b.sendCount++
      if (isSend && needArea) b.needAreas[needArea] = (b.needAreas[needArea] ?? 0) + 1
      if (concern != null && concern >= 60) b.highConcern++
      if (improving > declining) b.trendImp++
      else if (declining > improving) b.trendDec++
      else b.trendStab++

      // Blooms
      for (const [level, score] of Object.entries(bloomsPerf)) {
        if (!b.bloomsRaw[level]) b.bloomsRaw[level] = []
        b.bloomsRaw[level].push(score)
      }
      // Type performance
      mergeTypePerf(b.typeRaw, typePerf)
      if (isSend) mergeTypePerf(b.sendTypeRaw, typePerf)
    }

    addToBucket(schoolBucket)
    if (yearGroup != null) {
      if (!yearBuckets[yearGroup]) yearBuckets[yearGroup] = newBucket()
      addToBucket(yearBuckets[yearGroup])
    }
  }

  function bucketToUpsertData(b: Bucket, topStrategies: string[]) {
    const bloomsPerformance: Record<string, number> = {}
    for (const [level, scores] of Object.entries(b.bloomsRaw)) {
      bloomsPerformance[level] = avgOf(scores)
    }
    return {
      studentCount:       b.studentCount,
      sendCount:          b.sendCount,
      highConcernCount:   b.highConcern,
      avgCompletionRate:  b.completionRates.length ? Math.round(b.completionRates.reduce((a, c) => a + c, 0) / b.completionRates.length * 100) / 100 : 0,
      avgScore:           avgOf(b.avgScores),
      bloomsPerformance,
      typePerformance:    collapseTypePerf(b.typeRaw),
      sendTypePerformance: collapseTypePerf(b.sendTypeRaw),
      needAreaBreakdown:  b.needAreas,
      trendCounts:        { improving: b.trendImp, stable: b.trendStab, declining: b.trendDec },
      topStrategies,
    }
  }

  // ── Upsert aggregates ─────────────────────────────────────────────────────

  let upsertCount = 0

  // School-wide ALL rollup (yearGroup null = cross-year)
  await (prisma.schoolCohortAggregate as any).upsert({
    where:  { schoolId_subject_yearGroup: { schoolId, subject: 'ALL', yearGroup: null } },
    update: bucketToUpsertData(schoolBucket, globalTopStrategies),
    create: { schoolId, subject: 'ALL', yearGroup: null, ...bucketToUpsertData(schoolBucket, globalTopStrategies) },
  })
  upsertCount++

  // Per-year rollups
  for (const [yg, bucket] of Object.entries(yearBuckets)) {
    const yearGroup = Number(yg)
    await prisma.schoolCohortAggregate.upsert({
      where:  { schoolId_subject_yearGroup: { schoolId, subject: 'ALL', yearGroup } },
      update: bucketToUpsertData(bucket, globalTopStrategies),
      create: { schoolId, subject: 'ALL', yearGroup, ...bucketToUpsertData(bucket, globalTopStrategies) },
    })
    upsertCount++
  }

  return upsertCount
}

// ── Read helper (called from server actions and ILP route) ────────────────────

export async function getSchoolCohortContext(
  schoolId:  string,
  yearGroup?: number,
): Promise<CohortContext | null> {
  const row = await (prisma.schoolCohortAggregate as any).findUnique({
    where: {
      schoolId_subject_yearGroup: {
        schoolId,
        subject:   'ALL',
        yearGroup: yearGroup ?? null,
      },
    },
  })
  if (!row) return null

  return {
    studentCount:        row.studentCount,
    sendCount:           row.sendCount,
    highConcernCount:    row.highConcernCount,
    avgCompletionRate:   row.avgCompletionRate,
    avgScore:            row.avgScore,
    bloomsPerformance:   row.bloomsPerformance  as Record<string, number>,
    typePerformance:     row.typePerformance     as Record<string, TypePerfEntry>,
    sendTypePerformance: row.sendTypePerformance as Record<string, TypePerfEntry>,
    needAreaBreakdown:   row.needAreaBreakdown   as Record<string, number>,
    trendCounts:         row.trendCounts         as { improving: number; stable: number; declining: number },
    topStrategies:       row.topStrategies,
  }
}
