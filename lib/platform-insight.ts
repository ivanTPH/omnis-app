/**
 * Cross-school anonymised insight pipeline.
 *
 * Reads all SchoolCohortAggregate rows (subject='ALL'), cross-references
 * them across schools, and upserts PlatformInsight rows with national
 * patterns. No school IDs or student IDs appear in the output — only
 * aggregate signals that meet the k-anonymity threshold (MIN_SCHOOLS >= 3).
 *
 * Called by /api/cron/platform-insights (weekly, Sundays 05:00 UTC).
 * Insights are consumed by ILP generation and the Platform Admin dashboard.
 */

import { prisma } from '@/lib/prisma'
import { storeIlpStrategyRec } from '@/lib/omnis-inference'

const MIN_SCHOOLS = 3  // k-anonymity threshold

// ── Payload types (stored as Json in DB) ──────────────────────────────────────

export type BloomsPayload = {
  levels: Record<string, number>  // weighted avg per Bloom's level, 0–100
}

export type SendTaskTypePayload = {
  types: Record<string, { avg: number; studentCount: number }>
}

export type StrategyFrequencyPayload = {
  strategies: Array<{ strategy: string; schoolCount: number }>  // top 10
}

export type NeedAreaPrevalencePayload = {
  areas: Record<string, number>  // % of SEND students nationally
  totalSend: number
  totalStudents: number
}

export type AttainmentBenchmarkPayload = {
  avgScore:         number   // % (0–100)
  avgCompletion:    number   // % (0–100)
  sendAvgScore:     number   // SEND students only
  sendPct:          number   // % of students on SEND register
  improvingPct:     number   // % of students on improving trend
}

// Summary type used by ILP generation (collapsed from individual insight rows)
export type PlatformInsightForIlp = {
  schoolCount:       number
  studentCount:      number
  nationalAvgScore:  number
  nationalAvgCompletion: number
  nationalSendPct:   number
  bestBloomsLevels:  string[]  // top-2 levels nationally
  bestSendTaskTypes: string[]  // top-2 task types for SEND
  topNeedAreas:      string[]  // top-3 need areas (% label)
  topStrategies:     string[]  // top-5 ILP strategies
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function weightedAvg(pairs: Array<{ value: number; weight: number }>): number {
  const totalWeight = pairs.reduce((s, p) => s + p.weight, 0)
  if (!totalWeight) return 0
  return Math.round(pairs.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight)
}

// ── Main computation ──────────────────────────────────────────────────────────

export async function computePlatformInsights(): Promise<number> {
  // Load all cross-year school cohort aggregates (subject=ALL)
  const rows = await (prisma.schoolCohortAggregate as any).findMany({
    where: { subject: 'ALL' },
  }) as Array<{
    schoolId:           string
    yearGroup:          number | null
    studentCount:       number
    sendCount:          number
    avgScore:           number
    avgCompletionRate:  number
    bloomsPerformance:  unknown
    typePerformance:    unknown
    sendTypePerformance: unknown
    needAreaBreakdown:  unknown
    trendCounts:        unknown
    topStrategies:      string[]
  }>

  if (rows.length === 0) return 0

  // ── Partition by yearGroup (null = school-wide, N = year-specific) ─────────
  const byYearGroup = new Map<number | null, typeof rows>()
  for (const r of rows) {
    const yg = r.yearGroup
    if (!byYearGroup.has(yg)) byYearGroup.set(yg, [])
    byYearGroup.get(yg)!.push(r)
  }

  let upsertCount = 0

  for (const [yearGroup, bucket] of byYearGroup) {
    // Count distinct schools in this bucket
    const schoolIds = new Set(bucket.map(r => r.schoolId))
    const schoolCount = schoolIds.size
    if (schoolCount < MIN_SCHOOLS) continue  // k-anonymity guard

    const totalStudents = bucket.reduce((s, r) => s + r.studentCount, 0)
    const totalSend     = bucket.reduce((s, r) => s + r.sendCount, 0)

    // ── ATTAINMENT_BENCHMARK ──────────────────────────────────────────────────
    const avgScore = weightedAvg(bucket.map(r => ({ value: r.avgScore, weight: r.studentCount })))
    const avgCompletion = weightedAvg(bucket.map(r => ({
      value: Math.round(r.avgCompletionRate * 100),
      weight: r.studentCount,
    })))
    const sendAvgScore = weightedAvg(
      bucket.filter(r => r.sendCount > 0).map(r => ({ value: r.avgScore, weight: r.sendCount }))
    )
    const improvingCounts = bucket.map(r => {
      const tc = (r.trendCounts as Record<string, number>) ?? {}
      return { improving: tc.improving ?? 0, total: (tc.improving ?? 0) + (tc.stable ?? 0) + (tc.declining ?? 0) }
    })
    const totalImproving = improvingCounts.reduce((s, c) => s + c.improving, 0)
    const totalTrend     = improvingCounts.reduce((s, c) => s + c.total, 0)
    const improvingPct   = totalTrend > 0 ? Math.round((totalImproving / totalTrend) * 100) : 0
    const sendPct        = totalStudents > 0 ? Math.round((totalSend / totalStudents) * 100) : 0

    const attainmentPayload: AttainmentBenchmarkPayload = {
      avgScore, avgCompletion, sendAvgScore, sendPct, improvingPct,
    }
    await upsertInsight('ATTAINMENT_BENCHMARK', yearGroup, schoolCount, totalStudents, attainmentPayload)
    upsertCount++

    // ── BLOOMS_DISTRIBUTION ───────────────────────────────────────────────────
    const bloomsAcc: Record<string, Array<{ value: number; weight: number }>> = {}
    for (const r of bucket) {
      const bp = (r.bloomsPerformance as Record<string, number>) ?? {}
      for (const [level, score] of Object.entries(bp)) {
        if (!bloomsAcc[level]) bloomsAcc[level] = []
        bloomsAcc[level].push({ value: score, weight: r.studentCount })
      }
    }
    const bloomsLevels: Record<string, number> = {}
    for (const [level, pairs] of Object.entries(bloomsAcc)) {
      bloomsLevels[level] = weightedAvg(pairs)
    }
    if (Object.keys(bloomsLevels).length > 0) {
      const bloomsPayload: BloomsPayload = { levels: bloomsLevels }
      await upsertInsight('BLOOMS_DISTRIBUTION', yearGroup, schoolCount, totalStudents, bloomsPayload)
      upsertCount++
    }

    // ── SEND_TASK_TYPE ────────────────────────────────────────────────────────
    const taskAcc: Record<string, { totalAvgWeight: number; totalCount: number }> = {}
    for (const r of bucket) {
      const stp = (r.sendTypePerformance as Record<string, { avg: number; count: number }>) ?? {}
      for (const [type, d] of Object.entries(stp)) {
        if (!taskAcc[type]) taskAcc[type] = { totalAvgWeight: 0, totalCount: 0 }
        taskAcc[type].totalAvgWeight += d.avg * d.count
        taskAcc[type].totalCount     += d.count
      }
    }
    const taskTypes: Record<string, { avg: number; studentCount: number }> = {}
    for (const [type, acc] of Object.entries(taskAcc)) {
      if (acc.totalCount > 0) {
        taskTypes[type] = {
          avg:          Math.round(acc.totalAvgWeight / acc.totalCount),
          studentCount: acc.totalCount,
        }
      }
    }
    if (Object.keys(taskTypes).length > 0) {
      const taskPayload: SendTaskTypePayload = { types: taskTypes }
      await upsertInsight('SEND_TASK_TYPE', yearGroup, schoolCount, totalStudents, taskPayload)
      upsertCount++
    }

    // Strategy + need area only for cross-year aggregate (yearGroup=null)
    if (yearGroup !== null) continue

    // ── STRATEGY_FREQUENCY ────────────────────────────────────────────────────
    // Count how many schools use each strategy (not raw frequency — avoids
    // large schools dominating)
    const stratBySchool: Map<string, Set<string>> = new Map()
    for (const r of bucket) {
      for (const s of r.topStrategies ?? []) {
        const key = s.trim().toLowerCase()
        if (!stratBySchool.has(key)) stratBySchool.set(key, new Set())
        stratBySchool.get(key)!.add(r.schoolId)
      }
    }
    const strategyList = Array.from(stratBySchool.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 10)
      .map(([strategy, schools]) => ({ strategy, schoolCount: schools.size }))

    if (strategyList.length > 0) {
      const stratPayload: StrategyFrequencyPayload = { strategies: strategyList }
      await upsertInsight('STRATEGY_FREQUENCY', null, schoolCount, totalStudents, stratPayload)
      upsertCount++
    }

    // ── NEED_AREA_PREVALENCE ──────────────────────────────────────────────────
    const needAcc: Record<string, number> = {}
    for (const r of bucket) {
      const na = (r.needAreaBreakdown as Record<string, number>) ?? {}
      for (const [area, count] of Object.entries(na)) {
        needAcc[area] = (needAcc[area] ?? 0) + count
      }
    }
    if (totalSend > 0 && Object.keys(needAcc).length > 0) {
      const areas: Record<string, number> = {}
      for (const [area, count] of Object.entries(needAcc)) {
        areas[area] = Math.round((count / totalSend) * 100 * 10) / 10  // 1dp %
      }
      const needPayload: NeedAreaPrevalencePayload = { areas, totalSend, totalStudents }
      await upsertInsight('NEED_AREA_PREVALENCE', null, schoolCount, totalStudents, needPayload)
      upsertCount++
    }
  }

  // ── Per-needArea ILP strategy recommendations (no Claude — pure data) ────────
  // Cross-join ILP.strategies with SendStatus.needArea across all active ILPs.
  // Stored in OmnisInferenceCache as ILP_STRATEGY_REC; consumed by ILP generation.
  try {
    const ilps = await prisma.individualLearningPlan.findMany({
      where:  { status: { in: ['active', 'under_review'] } },
      select: {
        strategies: true,
        student:    { select: { sendStatus: { select: { needArea: true } } } },
        schoolId:   true,
      },
    })

    // Count strategy frequency per needArea, track contributing schools
    const needAreaData: Record<string, {
      stratFreq:  Record<string, number>
      schoolIds:  Set<string>
    }> = {}

    for (const ilp of ilps) {
      const needArea = ilp.student.sendStatus?.needArea
      if (!needArea || !ilp.strategies.length) continue
      if (!needAreaData[needArea]) needAreaData[needArea] = { stratFreq: {}, schoolIds: new Set() }
      needAreaData[needArea].schoolIds.add(ilp.schoolId)
      for (const s of ilp.strategies) {
        const key = s.trim().toLowerCase()
        needAreaData[needArea].stratFreq[key] = (needAreaData[needArea].stratFreq[key] ?? 0) + 1
      }
    }

    for (const [needArea, { stratFreq, schoolIds }] of Object.entries(needAreaData)) {
      if (schoolIds.size < MIN_SCHOOLS) continue  // k-anonymity
      const strategies = Object.entries(stratFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([s]) => s)
      await storeIlpStrategyRec(needArea, { strategies, schoolCount: schoolIds.size })
      upsertCount++
    }
  } catch {
    // Non-fatal — strategy recs are optional enhancement
  }

  return upsertCount
}

async function upsertInsight(
  insightType: string,
  yearGroup:   number | null,
  schoolCount: number,
  studentCount: number,
  payload:     unknown,
) {
  const data = { schoolCount, studentCount, payload, generatedAt: new Date() }
  await (prisma.platformInsight as any).upsert({
    where:  { insightType_yearGroup: { insightType, yearGroup } },
    update: data,
    create: { insightType, yearGroup, ...data },
  })
}

// ── Read helpers ──────────────────────────────────────────────────────────────

export async function getPlatformInsightsForIlp(
  yearGroup?: number,
): Promise<PlatformInsightForIlp | null> {
  // Prefer year-group-specific benchmark, fall back to cross-year
  const yg = yearGroup ?? null

  const [attainment, blooms, tasks, strategies, needAreas] = await Promise.all([
    (prisma.platformInsight as any).findFirst({
      where: { insightType: 'ATTAINMENT_BENCHMARK', yearGroup: yg },
    }),
    (prisma.platformInsight as any).findFirst({
      where: { insightType: 'BLOOMS_DISTRIBUTION', yearGroup: yg },
    }),
    (prisma.platformInsight as any).findFirst({
      where: { insightType: 'SEND_TASK_TYPE', yearGroup: yg },
    }),
    (prisma.platformInsight as any).findFirst({
      where: { insightType: 'STRATEGY_FREQUENCY', yearGroup: null },
    }),
    (prisma.platformInsight as any).findFirst({
      where: { insightType: 'NEED_AREA_PREVALENCE', yearGroup: null },
    }),
  ])

  if (!attainment) return null  // no data yet — pipeline hasn't run

  const ap = attainment.payload as AttainmentBenchmarkPayload

  // Best Bloom's levels (top 2)
  const bloomsLevels = blooms
    ? Object.entries((blooms.payload as BloomsPayload).levels)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 2)
        .map(([l]) => l)
    : []

  // Best SEND task types (top 2 by avg)
  const bestSendTaskTypes = tasks
    ? Object.entries((tasks.payload as SendTaskTypePayload).types)
        .sort((a, b) => b[1].avg - a[1].avg)
        .slice(0, 2)
        .map(([t]) => t.replace(/_/g, ' ').toLowerCase())
    : []

  // Top need areas (top 3 by %)
  const topNeedAreas = needAreas
    ? Object.entries((needAreas.payload as NeedAreaPrevalencePayload).areas)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 3)
        .map(([area, pct]) => `${area} (${pct}% of SEND)`)
    : []

  // Top strategies (top 5 by school count)
  const topStrategies = strategies
    ? (strategies.payload as StrategyFrequencyPayload).strategies
        .slice(0, 5)
        .map((s: { strategy: string }) => s.strategy)
    : []

  return {
    schoolCount:           attainment.schoolCount,
    studentCount:          attainment.studentCount,
    nationalAvgScore:      ap.avgScore,
    nationalAvgCompletion: ap.avgCompletion,
    nationalSendPct:       ap.sendPct,
    bestBloomsLevels:      bloomsLevels,
    bestSendTaskTypes,
    topNeedAreas,
    topStrategies,
  }
}

// Full data for Platform Admin dashboard
export async function getAllPlatformInsights() {
  const rows = await (prisma.platformInsight as any).findMany({
    orderBy: [{ insightType: 'asc' }, { yearGroup: 'asc' }],
  })
  return rows as Array<{
    id:          string
    insightType: string
    yearGroup:   number | null
    schoolCount: number
    studentCount: number
    payload:     unknown
    generatedAt: Date
  }>
}
