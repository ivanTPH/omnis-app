import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { integrityReportPdf } from '@/lib/pdf/integrity-report-template'

const ALLOWED = ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN']

export const maxDuration = 60

export async function GET(_req: NextRequest) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // HOY scoped to their own year group
  let myYearGroup: number | null = null
  if (user.role === 'HEAD_OF_YEAR') {
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { yearGroup: true } })
    myYearGroup = u?.yearGroup ?? null
  }

  const students = await prisma.user.findMany({
    where: {
      schoolId: user.schoolId,
      role: 'STUDENT',
      isActive: true,
      ...(myYearGroup ? { yearGroup: myYearGroup } : {}),
    },
    select: { id: true },
  })
  const studentIds = students.map(s => s.id)

  const [rawSignals, rawCases] = await Promise.all([
    prisma.submissionIntegritySignal.findMany({
      where: {
        riskLevel: { in: ['LOW', 'MEDIUM', 'HIGH'] },
        attempt: { submission: { studentId: { in: studentIds } } },
      },
      include: {
        attempt: {
          include: {
            submission: {
              include: {
                student:  { select: { firstName: true, lastName: true } },
                homework: { select: { title: true, class: { select: { name: true } } } },
              },
            },
          },
        },
        reviewLogs: {
          include: { reviewer: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),

    prisma.integrityPatternCase.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { openedAt: 'desc' },
      take: 50,
    }),
  ])

  // Resolve student names for pattern cases
  const caseStudentIds = [...new Set(rawCases.map(c => c.studentId))]
  const caseStudents = caseStudentIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: caseStudentIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : []
  const studentMap = new Map(caseStudents.map(s => [s.id, s]))

  // Resolve escalatedBy user names
  const extraIds = [...new Set(rawCases.map(c => c.escalatedBy).filter(Boolean) as string[])]
  const extraUsers = extraIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: extraIds } }, select: { id: true, firstName: true, lastName: true } })
    : []
  const userNameMap = new Map(extraUsers.map(u => [u.id, `${u.firstName} ${u.lastName}`]))

  const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } })

  const signals = rawSignals.map(s => ({
    studentName:     `${s.attempt.submission.student.firstName} ${s.attempt.submission.student.lastName}`,
    homeworkTitle:   s.attempt.submission.homework.title,
    className:       s.attempt.submission.homework.class?.name ?? '—',
    riskLevel:       s.riskLevel,
    pasteRatio:      s.pasteRatio,
    focusLostCount:  s.focusLostCount,
    pastedChars:     s.pastedChars,
    typedChars:      s.typedChars,
    createdAt:       s.createdAt,
    lastReviewAction: s.reviewLogs[0]?.action ?? null,
    lastReviewerName: s.reviewLogs[0] ? `${s.reviewLogs[0].reviewer.firstName} ${s.reviewLogs[0].reviewer.lastName}` : null,
  }))

  const patternCases = rawCases.map(c => {
    const st = studentMap.get(c.studentId)
    return {
      studentName:      st ? `${st.firstName} ${st.lastName}` : '—',
      status:           c.status,
      triggerCount:     c.triggerCount,
      subjectCount:     c.subjectCount,
      openedAt:         c.openedAt,
      notes:            c.notes,
      escalatedAt:      c.escalatedAt,
      escalatedByName:  c.escalatedBy ? (userNameMap.get(c.escalatedBy) ?? null) : null,
    }
  })

  const reportScope = myYearGroup ? `Year ${myYearGroup}` : 'All year groups'
  const html = integrityReportPdf({
    schoolName:   school?.name ?? user.schoolName,
    reportScope,
    generatedAt:  new Date(),
    signals,
    patternCases,
  })

  const pdf  = await generatePdf(html)
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="integrity-report-${date}.pdf"`,
    },
  })
}
