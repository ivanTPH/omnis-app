'use server'

import { requireAuth } from '@/lib/session'
import { prisma }      from '@/lib/prisma'

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
  const [schoolAvgResult, sendAvgResult] = await Promise.all([
    prisma.submission.aggregate({
      where: { schoolId, finalScore: { not: null }, submittedAt: { gte: since90 } },
      _avg:  { finalScore: true },
    }),
    sendIds.length > 0
      ? prisma.submission.aggregate({
          where: { schoolId, studentId: { in: sendIds }, finalScore: { not: null }, submittedAt: { gte: since90 } },
          _avg:  { finalScore: true },
        })
      : Promise.resolve({ _avg: { finalScore: null } }),
  ])
  const schoolAvgScore = schoolAvgResult._avg.finalScore ?? null
  const sendAvgScore   = sendAvgResult._avg.finalScore   ?? null

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

  // Submissions per year group (SEND + all)
  const subsRaw = await prisma.submission.findMany({
    where: { schoolId, finalScore: { not: null }, submittedAt: { gte: since90 } },
    select: {
      studentId: true,
      finalScore: true,
      student:   { select: { yearGroup: true } },
    },
  })

  const yearGroupRows: YearGroupSendRow[] = yearGroups.map(yg => {
    const inYear     = sendStatuses.filter(s => s.student.yearGroup === yg)
    const inYearIds  = new Set(inYear.map(s => s.studentId))
    const yearSubs   = subsRaw.filter(s => s.student.yearGroup === yg)
    const sendSubs   = yearSubs.filter(s => inYearIds.has(s.studentId))

    const sendYgAvg  = sendSubs.length  ? sendSubs.reduce((a, s)  => a + (s.finalScore ?? 0), 0) / sendSubs.length  : null
    const allYgAvg   = yearSubs.length  ? yearSubs.reduce((a, s)  => a + (s.finalScore ?? 0), 0) / yearSubs.length  : null

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

  const needAreaSubs = subsRaw.filter(s => sendIds.includes(s.studentId))
  const needAreas: NeedAreaRow[] = Array.from(needAreaMap.entries())
    .map(([needArea, ids]) => {
      const idSet = new Set(ids)
      const subs  = needAreaSubs.filter(s => idSet.has(s.studentId))
      return {
        needArea,
        count:    ids.length,
        avgScore: subs.length ? subs.reduce((a, s) => a + (s.finalScore ?? 0), 0) / subs.length : null,
      }
    })
    .sort((a, b) => b.count - a.count)

  // ── 7. Attainment trend — last 6 months, grouped by calendar month ─────────
  const since6mo   = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const trendSubs  = await prisma.submission.findMany({
    where:  { schoolId, finalScore: { not: null }, submittedAt: { gte: since6mo } },
    select: { studentId: true, finalScore: true, submittedAt: true },
  })

  const sendIdSet = new Set(sendIds)
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

    const schoolAvg = monthSubs.length
      ? monthSubs.reduce((a, s) => a + (s.finalScore ?? 0), 0) / monthSubs.length
      : null
    const sendAvg = sendMonthSubs.length
      ? sendMonthSubs.reduce((a, s) => a + (s.finalScore ?? 0), 0) / sendMonthSubs.length
      : null

    trend.push({
      month:     label,
      schoolAvg: schoolAvg != null ? parseFloat(schoolAvg.toFixed(2)) : null,
      sendAvg:   sendAvg   != null ? parseFloat(sendAvg.toFixed(2))   : null,
      gap:       schoolAvg != null && sendAvg != null ? parseFloat((sendAvg - schoolAvg).toFixed(2)) : null,
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
