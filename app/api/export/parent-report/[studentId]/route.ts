import { NextResponse }          from 'next/server'
import { auth }                  from '@/lib/auth'
import { prisma }                from '@/lib/prisma'
import { generatePdf }           from '@/lib/pdf/generator'
import { parentReportPdf }       from '@/lib/pdf/parent-report-template'

export const maxDuration = 60

const STAFF_ROLES = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN']

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role: string; schoolId: string }
  const { studentId } = await params

  // Access control: staff can generate for any student in their school.
  // Parents can generate for their own linked children only.
  if (user.role === 'PARENT') {
    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: user.id, studentId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } else if (!STAFF_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch student (scoped to school)
  const student = await prisma.user.findFirst({
    where:  { id: studentId, schoolId: user.schoolId, role: 'STUDENT' },
    select: {
      firstName: true, lastName: true,
      yearGroup: true, tutorGroup: true,
      attendancePercentage: true,
    },
  })
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  const school = await prisma.school.findUnique({
    where:  { id: user.schoolId },
    select: { name: true },
  })

  const now      = new Date()
  const ago90    = new Date(now.getTime() - 90 * 86_400_000)
  const in60days = new Date(now.getTime() + 60 * 86_400_000)

  // Parallel data fetch
  const [submissions, ilpPlan, revisionExams, sendConcerns] = await Promise.all([
    // Recent returned/marked homework
    prisma.submission.findMany({
      where: {
        studentId,
        status:   { in: ['RETURNED', 'MARKED'] },
        markedAt: { gte: ago90 },
      },
      select: {
        finalScore:  true,
        teacherScore: true,
        markedAt:    true,
        homework: {
          select: {
            title: true,
            class: { select: { subject: true } },
          },
        },
      },
      orderBy: { markedAt: 'desc' },
      take: 10,
    }),

    // Active ILP targets (ILPStatus enum values are uppercase)
    prisma.individualLearningPlan.findFirst({
      where: { studentId, schoolId: user.schoolId, status: { in: ['active', 'under_review'] } },
      select: {
        targets: {
          where:   { status: { notIn: ['not_achieved'] } },
          select:  { target: true, status: true, targetDate: true },
          orderBy: { targetDate: 'asc' },
          take: 5,
        },
      },
    }),

    // Upcoming exams (next 60 days)
    prisma.revisionExam.findMany({
      where:   { studentId, examDate: { gte: now, lte: in60days } },
      select:  { subject: true, paperName: true, examDate: true },
      orderBy: { examDate: 'asc' },
      take: 5,
    }),

    // Open concerns count
    prisma.sendConcern.count({
      where: { schoolId: user.schoolId, studentId, status: { notIn: ['closed', 'no_action'] } },
    }),
  ])

  // Convert score to GCSE grade 1–9
  function scoreToGrade(score: number | null): string {
    if (score == null) return '—'
    // finalScore / teacherScore may be on 0–9 scale or 0–100 depending on homework type
    const pct = score > 9 ? score : score * 100 / 9
    if (pct >= 95) return '9'
    if (pct >= 85) return '8'
    if (pct >= 75) return '7'
    if (pct >= 65) return '6'
    if (pct >= 55) return '5'
    if (pct >= 45) return '4'
    if (pct >= 35) return '3'
    if (pct >= 25) return '2'
    return '1'
  }

  const recentHomework = submissions
    .filter(s => s.markedAt != null)
    .map(s => ({
      title:      s.homework.title,
      subject:    s.homework.class?.subject ?? 'Unknown',
      grade:      scoreToGrade(s.finalScore ?? s.teacherScore),
      returnedAt: new Date(s.markedAt!),
    }))

  const ilpTargets = (ilpPlan?.targets ?? []).map(t => ({
    target:     t.target,
    status:     t.status,
    targetDate: new Date(t.targetDate),
  }))

  const upcomingExams = revisionExams.map(e => ({
    subject:  e.subject,
    title:    e.paperName ?? e.subject,
    examDate: new Date(e.examDate),
  }))

  const html = parentReportPdf({
    studentName:   `${student.firstName} ${student.lastName}`,
    yearGroup:     student.yearGroup,
    formClass:     student.tutorGroup,
    schoolName:    school?.name ?? 'School',
    generatedDate: now,
    attendancePct: student.attendancePercentage,
    recentHomework,
    ilpTargets,
    upcomingExams,
    openConcerns:  sendConcerns,
  })

  let pdf: ArrayBuffer
  try {
    pdf = await generatePdf(html)
  } catch (err) {
    console.error('[parent-report] PDF generation failed:', err)
    return NextResponse.json({ error: 'PDF generation failed — please try again' }, { status: 500 })
  }

  const safeFileName = `${student.firstName}-${student.lastName}-report`.replace(/[^a-z0-9-]/gi, '-')

  return new NextResponse(pdf, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFileName}.pdf"`,
    },
  })
}
