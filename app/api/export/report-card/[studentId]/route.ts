import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { reportCardPdf } from '@/lib/pdf/report-card-template'
import { percentToGcseGrade } from '@/lib/grading'

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
    select: {
      firstName:            true,
      lastName:             true,
      yearGroup:            true,
      tutorGroup:           true,
      attendancePercentage: true,
      sendStatus: { select: { activeStatus: true } },
      studentIlps: {
        where:   { status: { not: 'archived' } },
        select:  { areasOfNeed: true },
        orderBy: { reviewDate: 'desc' },
        take:    1,
      },
    },
  })

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  const [openConcerns, submissions, school, ilpTargets, behaviourCount] = await Promise.all([
    prisma.sendConcern.count({
      where: { studentId, status: { in: ['open', 'under_review', 'escalated'] } },
    }),
    // Include ALL returned submissions — teacher-graded (finalScore) + auto-graded (autoScore)
    prisma.submission.findMany({
      where:   { studentId, status: 'RETURNED', finalScore: { not: null } },
      select:  {
        finalScore: true,
        autoScore:  true,
        feedback:   true,
        submittedAt: true,
        homework: { select: { title: true, class: { select: { subject: true } } } },
      },
      orderBy: { submittedAt: 'desc' },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
    prisma.ilpTarget.findMany({
      where:  { ilp: { studentId, status: { not: 'ARCHIVED' } }, status: 'active' },
      select: { target: true, successMeasure: true, status: true },
      take:   5,
    }),
    prisma.behaviourRecord.count({ where: { studentId } }),
  ])

  // Aggregate per subject — use finalScore (teacher grade) with autoScore as fallback
  const subjectMap = new Map<string, { scores: number[]; lastScore: number | null; hwCount: number; feedbacks: string[] }>()
  for (const sub of submissions) {
    const subject = sub.homework.class?.subject ?? 'Unknown'
    const raw     = sub.finalScore!
    const gcse    = raw <= 9 ? raw : percentToGcseGrade(raw)

    if (!subjectMap.has(subject)) subjectMap.set(subject, { scores: [], lastScore: null, hwCount: 0, feedbacks: [] })
    const entry = subjectMap.get(subject)!
    entry.scores.push(gcse)
    entry.hwCount++
    if (entry.lastScore === null) entry.lastScore = gcse  // sorted desc, first = most recent
    if (sub.feedback && entry.feedbacks.length < 1) entry.feedbacks.push(sub.feedback)
  }

  const subjects = [...subjectMap.entries()].map(([subject, data]) => {
    const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length
    return {
      subject,
      avgGrade:       Math.round(avg * 10) / 10,
      letterGrade:    null,
      hwCount:        data.hwCount,
      lastGrade:      data.lastScore,
      recentFeedback: data.feedbacks[0] ?? null,
    }
  }).sort((a, b) => a.subject.localeCompare(b.subject))

  const sendStatus = student.sendStatus?.activeStatus ?? null
  const ilpSummary = student.studentIlps[0]?.areasOfNeed ?? null

  const html = reportCardPdf({
    schoolName:           school?.name ?? user.schoolName,
    generatedAt:          new Date(),
    studentName:          `${student.firstName} ${student.lastName}`,
    yearGroup:            student.yearGroup,
    tutorGroup:           student.tutorGroup,
    attendancePercentage: student.attendancePercentage,
    sendStatus,
    ilpSummary,
    openConcerns,
    subjects,
    ilpTargets:     ilpTargets.map(t => ({ description: t.target, successCriteria: t.successMeasure ?? '', status: t.status })),
    behaviourCount,
  })

  const pdf  = await generatePdf(html)
  const date = new Date().toISOString().slice(0, 10)
  const safe = `${student.lastName}-${student.firstName}`.replace(/[^a-zA-Z0-9-]/g, '')

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="report-card-${safe}-${date}.pdf"`,
    },
  })
}
