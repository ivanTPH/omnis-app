import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { optionsSummaryPdf } from '@/lib/pdf/options-summary-template'

const ALLOWED = ['SCHOOL_ADMIN', 'SLT']

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const yearRaw = parseInt(req.nextUrl.searchParams.get('yearGroup') ?? '10', 10)
  const yearGroup = [7, 8, 9, 10, 11, 12, 13].includes(yearRaw) ? yearRaw : 10

  const subjects = await prisma.studentSubject.groupBy({
    by:    ['subject', 'isCore'],
    where: { schoolId: user.schoolId, yearGroup },
    _count: { studentId: true },
  })

  // Distinct class count per subject
  const classGroups = await prisma.studentSubject.groupBy({
    by:    ['subject', 'assignedClassId'],
    where: { schoolId: user.schoolId, yearGroup, assignedClassId: { not: null } },
  })
  const classCounts = new Map<string, Set<string>>()
  for (const r of classGroups) {
    if (!classCounts.has(r.subject)) classCounts.set(r.subject, new Set())
    if (r.assignedClassId) classCounts.get(r.subject)!.add(r.assignedClassId)
  }

  // Distinct levels per subject
  const levelGroups = await prisma.studentSubject.groupBy({
    by:    ['subject', 'level'],
    where: { schoolId: user.schoolId, yearGroup, level: { not: null } },
  })
  const levelMap = new Map<string, Set<string>>()
  for (const r of levelGroups) {
    if (!levelMap.has(r.subject)) levelMap.set(r.subject, new Set())
    if (r.level) levelMap.get(r.subject)!.add(r.level)
  }

  const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } })

  const rows = subjects.map(r => ({
    subject:      r.subject,
    isCore:       r.isCore,
    studentCount: r._count.studentId,
    classCount:   classCounts.get(r.subject)?.size ?? 0,
    levels:       [...(levelMap.get(r.subject) ?? [])],
  })).sort((a, b) => {
    if (a.isCore !== b.isCore) return a.isCore ? -1 : 1
    return a.subject.localeCompare(b.subject)
  })

  const html = optionsSummaryPdf({
    schoolName:  school?.name ?? user.schoolName,
    yearGroup,
    generatedAt: new Date(),
    rows,
  })

  const pdf  = await generatePdf(html)
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="options-summary-year${yearGroup}-${date}.pdf"`,
    },
  })
}
