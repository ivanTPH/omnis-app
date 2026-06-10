import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { prisma } from '@/lib/prisma'
import IntegrityView, { type SignalRow, type PatternCaseRow } from '@/components/hoy/IntegrityView'

export default async function HoyIntegrityPage() {
  const { role, id: userId, firstName, lastName, schoolName, schoolId } = await requireAuth()
  if (!['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  // HOY scoped to their own year group; SLT/admin see all
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { yearGroup: true },
  })
  const myYearGroup = role === 'HEAD_OF_YEAR' ? (userRecord?.yearGroup ?? null) : null

  // Collect student IDs in this year group (or all students in school)
  const students = await prisma.user.findMany({
    where: {
      schoolId,
      role: 'STUDENT',
      isActive: true,
      ...(myYearGroup ? { yearGroup: myYearGroup } : {}),
    },
    select: { id: true },
  })
  const studentIds = students.map(s => s.id)

  const rawSignals = await prisma.submissionIntegritySignal.findMany({
    where: {
      riskLevel: { in: ['LOW', 'MEDIUM', 'HIGH'] },
      attempt: {
        submission: { studentId: { in: studentIds } },
      },
    },
    include: {
      attempt: {
        include: {
          submission: {
            include: {
              student:  { select: { firstName: true, lastName: true, id: true } },
              homework: { select: { title: true, class: { select: { name: true } } } },
            },
          },
        },
      },
      reviewLogs: {
        include: {
          reviewer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const rawCases = await prisma.integrityPatternCase.findMany({
    where: { schoolId, ...(myYearGroup ? {} : {}) },
    orderBy: { openedAt: 'desc' },
    take: 50,
  })

  // Resolve student names for pattern cases
  const caseStudentIds = [...new Set(rawCases.map(c => c.studentId))]
  const caseStudents   = caseStudentIds.length > 0 ? await prisma.user.findMany({
    where: { id: { in: caseStudentIds } },
    select: { id: true, firstName: true, lastName: true },
  }) : []
  const studentMap = new Map(caseStudents.map(s => [s.id, s]))

  // Serialise for client component
  const signals: SignalRow[] = rawSignals.map(s => ({
    id:             s.id,
    riskLevel:      s.riskLevel,
    pasteRatio:     s.pasteRatio,
    focusLostCount: s.focusLostCount,
    pastedChars:    s.pastedChars,
    typedChars:     s.typedChars,
    createdAt:      s.createdAt.toISOString(),
    studentName:    `${s.attempt.submission.student.firstName} ${s.attempt.submission.student.lastName}`,
    studentId:      s.attempt.submission.student.id,
    homeworkTitle:  s.attempt.submission.homework.title,
    className:      s.attempt.submission.homework.class?.name ?? '—',
    reviewLogs:     s.reviewLogs.map(r => ({
      action:       r.action,
      reviewerName: `${r.reviewer.firstName} ${r.reviewer.lastName}`,
      createdAt:    r.createdAt.toISOString(),
      notes:        r.notes,
    })),
  }))

  const patternCases: PatternCaseRow[] = rawCases.map(c => {
    const st = studentMap.get(c.studentId)
    return {
      id:           c.id,
      studentId:    c.studentId,
      studentName:  st ? `${st.firstName} ${st.lastName}` : '—',
      status:       c.status,
      triggerCount: c.triggerCount,
      subjectCount: c.subjectCount,
      openedAt:     c.openedAt.toISOString(),
      closedAt:     c.closedAt?.toISOString() ?? null,
      notes:        c.notes,
    }
  })

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <IntegrityView
        signals={signals}
        patternCases={patternCases}
        yearGroup={myYearGroup}
      />
    </AppShell>
  )
}
