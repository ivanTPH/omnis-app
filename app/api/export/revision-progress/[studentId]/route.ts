import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { revisionProgressPdf } from '@/lib/pdf/revision-progress-template'

const ALLOWED = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN']

export const maxDuration = 60

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { studentId } = await params

  const student = await prisma.user.findUnique({
    where: { id: studentId, schoolId: user.schoolId, role: 'STUDENT' },
    select: { firstName: true, lastName: true, yearGroup: true },
  })
  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  const [exams, sessions, topics, school] = await Promise.all([
    prisma.revisionExam.findMany({
      where:   { studentId },
      include: { sessions: { select: { status: true } } },
      orderBy: { examDate: 'asc' },
    }),
    prisma.revisionSession.findMany({
      where:   { studentId },
      select:  { status: true, confidence: true },
    }),
    prisma.revisionProgress.findMany({
      where:   { studentId },
      orderBy: [{ subject: 'asc' }, { topic: 'asc' }],
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
  ])

  const now = Date.now()

  const examRows = exams.map(e => ({
    subject:           e.subject,
    examBoard:         e.examBoard,
    paperName:         e.paperName,
    examDate:          e.examDate,
    daysUntil:         Math.ceil((e.examDate.getTime() - now) / 86_400_000),
    sessionsCompleted: e.sessions.filter(s => s.status === 'completed').length,
    sessionsTotal:     e.sessions.length,
  }))

  const totalPlanned   = sessions.length
  const totalCompleted = sessions.filter(s => s.status === 'completed').length
  const totalSkipped   = sessions.filter(s => s.status === 'skipped').length

  const confidences = sessions.map(s => s.confidence).filter((c): c is number => c != null)
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : null

  const topicRows = topics.map(t => ({
    subject:     t.subject,
    topic:       t.topic,
    confidence:  t.confidenceLevel,
    lastRevised: t.lastRevisedAt,
    nextReview:  t.nextReviewAt,
  }))

  const html = revisionProgressPdf({
    schoolName:     school?.name ?? user.schoolName,
    generatedAt:    new Date(),
    studentName:    `${student.firstName} ${student.lastName}`,
    yearGroup:      student.yearGroup,
    exams:          examRows,
    topics:         topicRows,
    totalPlanned,
    totalCompleted,
    totalSkipped,
    avgConfidence,
  })

  const pdf  = await generatePdf(html)
  const date = new Date().toISOString().slice(0, 10)
  const safe = `${student.lastName}-${student.firstName}`.replace(/[^a-zA-Z0-9-]/g, '')

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="revision-progress-${safe}-${date}.pdf"`,
    },
  })
}
