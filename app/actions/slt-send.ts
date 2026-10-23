'use server'

import { requireAuth } from '@/lib/session'
import { prisma }      from '@/lib/prisma'
import { averageGrade, maxScoreFromBands, roundGrade } from '@/lib/metrics/grades'

// ── Types ─────────────────────────────────────────────────────────────────────

export type YearGroupSendRow = {
  yearGroup:    number
  total:        number
  senSupport:   number
  ehcp:         number
  activeIlps:   number
  sendAvgScore: number | null
  allAvgScore:  number | null
}

export type EhcpComplianceStats = {
  total:             number
  approved:          number
  pendingApproval:   number
  reviewOverdue:     number
  reviewDue30:       number
  outcomesTotal:     number
  outcomesAchieved:  number
  outcomesActive:    number
  evidenceGood:      number   // >= 2 evidence pieces
  evidenceSome:      number   // exactly 1
  evidenceNone:      number   // 0
  pendingAiSuggestions: number
}

export type IlpCoverageStats = {
  activeIlps:       number
  coveragePct:      number
  targetsTotal:     number
  targetsAchieved:  number
  targetsActive:    number
  targetsNotAch:    number
  reviewOverdue:    number   // ILPs where reviewDate < now
}

export type NeedAreaRow = {
  needArea:    string
  count:       number
  avgScore:    number | null
}

export type FlagSummary = {
  totalActive: number
  high:        number
  medium:      number
  low:         number
  byType:      { type: string; count: number }[]
}

export type TrendPoint = {
  month:     string        // e.g. "Jan 25"
  schoolAvg: number | null // 0–9 grade scale
  sendAvg:   number | null
  gap:       number | null // sendAvg - schoolAvg (negative = below)
}

export type SltSendDashboardData = {
  sendTotal:      number
  senSupport:     number
  ehcpCount:      number
  schoolAvgScore: number | null
  sendAvgScore:   number | null
  yearGroupRows:  YearGroupSendRow[]
  ehcp:           EhcpComplianceStats
  ilp:            IlpCoverageStats
  needAreas:      NeedAreaRow[]
  flags:          FlagSummary
  trend:          TrendPoint[]
}

// ── Main action ───────────────────────────────────────────────────────────────

export async function getSltSendDashboard(): Promise<SltSendDashboardData> {
  const { schoolId, role } = await requireAuth()
  if (!['SLT', 'SCHOOL_ADMIN', 'SENCO'].includes(role)) {
    throw new Error('Unauthorised')
  }

  const now      = new Date()
  const in30days = new Date(now.getTime() + 30 * 86_400_000)
  const since90  = new Date(now.getTime() - 90 * 86_400_000)

  // ── 1. SEND register ───────────────────────────────────────────────────────
  const sendStatuses = await prisma.sendStatus.findMany({
    where:  { student: { schoolId }, NOT: { activeStatus: 'NONE' } },
    select: {
      activeStatus: true,
      needArea:     true,
      studentId:    true,
      student:      { select: { yearGroup: true } },
    },
  })

  const sendTotal    = sendStatuses.length
  const senSupport   = sendStatuses.filter(s => s.activeStatus === 'SEN_SUPPORT').length
  const ehcpCount    = sendStatuses.filter(s => s.activeStatus === 'EHCP').length
  const sendIds      = sendStatuses.map(s => s.studentId)

  // ── 2. Attainment gap (school-wide + SEND) ─────────────────────────────────
  // finalScore is on each homework's OWN max-score scale (from its
  // gradingBands — 5, 9, 20, 25, anything), so a DB-side AVG(finalScore)
  // mixes incompatible scales. Fetch raw rows + each one's gradingBands and
  // normalise to a GCSE grade before averaging (see lib/metrics/grades.ts).
  const allSchoolSubs = await prisma.submission.findMany({
    where: { schoolId, finalScore: { not: null }, submittedAt: { gte: since90 } },
    select: {
      studentId: true, finalScore: true,
      homework: { select: { gradingBands: true } },
      student:  { select: { yearGroup: true } },
    },
  })
  const schoolAvgScore = averageGrade(allSchoolSubs.map(s => ({
    finalScore: s.finalScore, maxScore: maxScoreFromBands(s.homework.gradingBands),
  })))
  const sendIdSet = new Set(sendIds)
  const sendSubs = allSchoolSubs.filter(s => sendIdSet.has(s.studentId))
  const sendAvgScore = averageGrade(sendSubs.map(s => ({
    finalScore: s.finalScore, maxScore: maxScoreFromBands(s.homework.gradingBands),
  })))

  // ── 3. Year-group breakdown ────────────────────────────────────────────────
  const yearGroups = [...new Set(
    sendStatuses.map(s => s.student.yearGroup).filter((y): y is number => y != null)
  )].sort((a, b) => a - b)

  // Active ILPs per student
  const activeIlps = await prisma.individualLearningPlan.findMany({
    where:  { schoolId, status: 'active', approvedBySenco: true },
    select: { studentId: true },
  })
  const ilpStudentSet = new Set(activeIlps.map(i => i.studentId))

  // Submissions per year group (SEND + all) — reuses allSchoolSubs fetched above.
  const yearGroupRows: YearGroupSendRow[] = yearGroups.map(yg => {
    const inYear     = sendStatuses.filter(s => s.student.yearGroup === yg)
    const inYearIds  = new Set(inYear.map(s => s.studentId))
    const yearSubs   = allSchoolSubs.filter(s => s.student.yearGroup === yg)
    const subsOfYear = yearSubs.filter(s => inYearIds.has(s.studentId))

    const toScored = (rows: typeof yearSubs) =>
      rows.map(s => ({ finalScore: s.finalScore, maxScore: maxScoreFromBands(s.homework.gradingBands) }))
    const sendYgAvg  = averageGrade(toScored(subsOfYear))
    const allYgAvg   = averageGrade(toScored(yearSubs))

    return {
      yearGroup:    yg,
      total:        inYear.length,
      senSupport:   inYear.filter(s => s.activeStatus === 'SEN_SUPPORT').length,
      ehcp:         inYear.filter(s => s.activeStatus === 'EHCP').length,
      activeIlps:   inYear.filter(s => ilpStudentSet.has(s.studentId)).length,
      sendAvgScore: sendYgAvg,
      allAvgScore:  allYgAvg,
    }
  })

  // ── 4. EHCP compliance ─────────────────────────────────────────────────────
  const [ehcpPlans, ehcpOutcomes, pendingAiCount] = await Promise.all([
    prisma.ehcpPlan.findMany({
      where:  { schoolId },
      select: { approvedBySenco: true, reviewDate: true, status: true },
    }),
    prisma.ehcpOutcome.findMany({
      where:  { ehcp: { schoolId } },
      select: { status: true, evidenceCount: true },
    }),
    prisma.homeworkEhcpEvidence.count({
      where: { reviewStatus: 'pending', outcome: { ehcp: { schoolId } } },
    }),
  ])

  const ehcp: EhcpComplianceStats = {
    total:           ehcpPlans.length,
    approved:        ehcpPlans.filter(p => p.approvedBySenco).length,
    pendingApproval: ehcpPlans.filter(p => !p.approvedBySenco).length,
    reviewOverdue:   ehcpPlans.filter(p => new Date(p.reviewDate) < now).length,
    reviewDue30:     ehcpPlans.filter(p => { const d = new Date(p.reviewDate); return d >= now && d <= in30days }).length,
    outcomesTotal:   ehcpOutcomes.length,
    outcomesAchieved: ehcpOutcomes.filter(o => o.status === 'achieved').length,
    outcomesActive:   ehcpOutcomes.filter(o => o.status === 'active').length,
    evidenceGood:    ehcpOutcomes.filter(o => o.evidenceCount >= 2).length,
    evidenceSome:    ehcpOutcomes.filter(o => o.evidenceCount === 1).length,
    evidenceNone:    ehcpOutcomes.filter(o => o.evidenceCount === 0).length,
    pendingAiSuggestions: pendingAiCount,
  }

  // ── 5. ILP coverage ────────────────────────────────────────────────────────
  const [ilpFull, ilpTargets] = await Promise.all([
    prisma.individualLearningPlan.findMany({
      where:  { schoolId, status: 'active' },
      select: { reviewDate: true },
    }),
    prisma.ilpTarget.findMany({
      where:  { ilp: { schoolId, status: 'active' } },
      select: { status: true },
    }),
  ])

  const ilp: IlpCoverageStats = {
    activeIlps:      ilpFull.length,
    coveragePct:     sendTotal > 0 ? Math.round((ilpFull.length / sendTotal) * 100) : 0,
    targetsTotal:    ilpTargets.length,
    targetsAchieved: ilpTargets.filter(t => t.status === 'achieved').length,
    targetsActive:   ilpTargets.filter(t => t.status === 'active').length,
    targetsNotAch:   ilpTargets.filter(t => t.status === 'not_achieved').length,
    reviewOverdue:   ilpFull.filter(i => new Date(i.reviewDate) < now).length,
  }

  // ── 6. Need area breakdown ─────────────────────────────────────────────────
  const needAreaMap = new Map<string, string[]>()
  for (const s of sendStatuses) {
    const key = s.needArea ?? 'Not specified'
    if (!needAreaMap.has(key)) needAreaMap.set(key, [])
    needAreaMap.get(key)!.push(s.studentId)
  }

  const needAreaSubs = allSchoolSubs.filter(s => sendIdSet.has(s.studentId))
  const needAreas: NeedAreaRow[] = Array.from(needAreaMap.entries())
    .map(([needArea, ids]) => {
      const idSet = new Set(ids)
      const subs  = needAreaSubs.filter(s => idSet.has(s.studentId))
      return {
        needArea,
        count:    ids.length,
        avgScore: averageGrade(subs.map(s => ({ finalScore: s.finalScore, maxScore: maxScoreFromBands(s.homework.gradingBands) }))),
      }
    })
    .sort((a, b) => b.count - a.count)

  // ── 7. Attainment trend — last 6 months, grouped by calendar month ─────────
  const since6mo   = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const trendSubs  = await prisma.submission.findMany({
    where:  { schoolId, finalScore: { not: null }, submittedAt: { gte: since6mo } },
    select: { studentId: true, finalScore: true, submittedAt: true, homework: { select: { gradingBands: true } } },
  })

  const trend: TrendPoint[] = []
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i,     1)
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const label = monthStart.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })

    const monthSubs     = trendSubs.filter(s => {
      const d = new Date(s.submittedAt)
      return d >= monthStart && d < monthEnd
    })
    const sendMonthSubs = monthSubs.filter(s => sendIdSet.has(s.studentId))
    const toScored = (rows: typeof monthSubs) =>
      rows.map(s => ({ finalScore: s.finalScore, maxScore: maxScoreFromBands(s.homework.gradingBands) }))

    const schoolAvg = averageGrade(toScored(monthSubs))
    const sendAvg   = averageGrade(toScored(sendMonthSubs))

    trend.push({
      month:     label,
      schoolAvg,
      sendAvg,
      gap:       schoolAvg != null && sendAvg != null ? roundGrade(sendAvg - schoolAvg) : null,
    })
  }

  // ── 8. Early warning flags ─────────────────────────────────────────────────
  const activeFlags = await prisma.earlyWarningFlag.findMany({
    where:  { schoolId, isActioned: false, expiresAt: { gt: now } },
    select: { severity: true, flagType: true },
  })

  const typeCount = new Map<string, number>()
  for (const f of activeFlags) {
    typeCount.set(f.flagType, (typeCount.get(f.flagType) ?? 0) + 1)
  }

  const flags: FlagSummary = {
    totalActive: activeFlags.length,
    high:        activeFlags.filter(f => f.severity === 'high').length,
    medium:      activeFlags.filter(f => f.severity === 'medium').length,
    low:         activeFlags.filter(f => f.severity === 'low').length,
    byType:      Array.from(typeCount.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
  }

  return {
    sendTotal,
    senSupport,
    ehcpCount,
    schoolAvgScore,
    sendAvgScore,
    yearGroupRows,
    ehcp,
    ilp,
    needAreas,
    flags,
    trend,
  }
}
