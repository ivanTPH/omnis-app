export const maxDuration = 60

import { NextResponse } from 'next/server'
import { requireAuth }  from '@/lib/session'
import { prisma }       from '@/lib/prisma'
import { generatePdf }  from '@/lib/pdf/generator'
import { sltSummaryPdf } from '@/lib/pdf/slt-summary-template'
import type { SltSummaryData } from '@/lib/pdf/slt-summary-template'

export async function GET() {
  const { schoolId, schoolName, role } = await requireAuth()
  if (!['SLT', 'SCHOOL_ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now  = new Date()
  const term = currentTermLabel(now)

  // ── Attendance by year group ─────────────────────────────────────────────
  const allStudents = await prisma.user.findMany({
    where:  { schoolId, role: 'STUDENT', isActive: true },
    select: { yearGroup: true, attendancePercentage: true },
  })

  const yearGroups = [...new Set(allStudents.map(s => s.yearGroup).filter(Boolean) as number[])].sort()
  const yearAttendance = yearGroups.map(yr => {
    const grp = allStudents.filter(s => s.yearGroup === yr)
    const withData = grp.filter(s => s.attendancePercentage != null)
    const avg = withData.length > 0
      ? withData.reduce((sum, s) => sum + s.attendancePercentage!, 0) / withData.length
      : null
    return {
      year:    yr,
      avg:     avg != null ? Math.round(avg * 10) / 10 : null,
      below90: withData.filter(s => s.attendancePercentage! < 90).length,
      total:   grp.length,
    }
  })

  const schoolAvgStudents = allStudents.filter(s => s.attendancePercentage != null)
  const schoolAvgPct = schoolAvgStudents.length > 0
    ? Math.round(schoolAvgStudents.reduce((s, u) => s + u.attendancePercentage!, 0) / schoolAvgStudents.length * 10) / 10
    : null

  // ── Subject grades (latest aggregate per class) ───────────────────────────
  const allAggs = await prisma.classPerformanceAggregate.findMany({
    where:   { schoolId },
    include: { class: { select: { subject: true, yearGroup: true } } },
    orderBy: { termId: 'desc' },
  })
  // Deduplicate: latest per classId
  const latestByClass = new Map<string, typeof allAggs[0]>()
  for (const a of allAggs) { if (!latestByClass.has(a.classId)) latestByClass.set(a.classId, a) }

  // Group by subject + yearGroup, average the avgScore
  type SubjKey = string
  const subjectMap = new Map<SubjKey, { avgScores: number[]; classCount: number }>()
  for (const a of latestByClass.values()) {
    const key: SubjKey = `${a.class.subject}||${a.class.yearGroup}`
    if (!subjectMap.has(key)) subjectMap.set(key, { avgScores: [], classCount: 0 })
    const entry = subjectMap.get(key)!
    entry.classCount++
    if (a.avgScore != null) entry.avgScores.push(a.avgScore)
  }
  const subjectGrades = [...subjectMap.entries()].map(([key, val]) => {
    const [subject, yr] = key.split('||')
    const avg = val.avgScores.length > 0
      ? val.avgScores.reduce((s, v) => s + v, 0) / val.avgScores.length
      : null
    return { subject, yearGroup: Number(yr), avgScore: avg, classCount: val.classCount }
  }).sort((a, b) => a.subject.localeCompare(b.subject) || a.yearGroup - b.yearGroup)

  // ── SEND headline ────────────────────────────────────────────────────────
  const [sendTotal, ehcpCount, senSupportCount, activeIlps] = await Promise.all([
    prisma.sendStatus.count({ where: { student: { schoolId }, NOT: { activeStatus: 'NONE' } } }),
    prisma.sendStatus.count({ where: { student: { schoolId }, activeStatus: 'EHCP' } }),
    prisma.sendStatus.count({ where: { student: { schoolId }, activeStatus: 'SEN_SUPPORT' } }),
    prisma.individualLearningPlan.count({ where: { schoolId, status: 'active', approvedBySenco: true } }),
  ])

  // ── Homework completion this term ────────────────────────────────────────
  const termStart = termStartDate(now)
  const [totalAssigned, totalSubmitted] = await Promise.all([
    prisma.submission.count({ where: { schoolId, submittedAt: { gte: termStart } } }),
    prisma.submission.count({
      where: { schoolId, submittedAt: { gte: termStart }, status: { in: ['SUBMITTED', 'MARKED', 'RETURNED'] } },
    }),
  ])

  const summaryData: SltSummaryData = {
    schoolName,
    termLabel:       term,
    generatedAt:     now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    schoolAvgPct,
    yearAttendance,
    subjectGrades,
    sendTotal,
    ehcpCount,
    senSupportCount,
    activeIlps,
    totalAssigned,
    totalSubmitted,
  }

  const html = sltSummaryPdf(summaryData)
  const pdf  = await generatePdf(html)

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="slt-termly-summary.pdf"`,
    },
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function currentTermLabel(d: Date): string {
  const m = d.getMonth() + 1  // 1-based
  const y = d.getFullYear()
  if (m >= 9)  return `Autumn Term ${y}`
  if (m >= 4)  return `Summer Term ${y}`
  return `Spring Term ${y}`
}

function termStartDate(d: Date): Date {
  const m = d.getMonth() + 1
  const y = d.getFullYear()
  if (m >= 9)  return new Date(y, 8,  1)   // Sept
  if (m >= 4)  return new Date(y, 3,  1)   // April
  return new Date(y, 0, 1)                  // January
}
