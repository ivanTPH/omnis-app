import { NextRequest, NextResponse } from 'next/server'
import { requireAuth }               from '@/lib/session'
import { prisma }                    from '@/lib/prisma'
import { percentToGcseGrade }        from '@/lib/grading'

const ALLOWED = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN']

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const classId = req.nextUrl.searchParams.get('classId')
  if (!classId) {
    return NextResponse.json({ error: 'classId required' }, { status: 400 })
  }

  // Verify class belongs to this school
  const schoolClass = await prisma.schoolClass.findFirst({
    where:  { id: classId, schoolId: user.schoolId },
    select: { id: true, name: true, subject: true, yearGroup: true },
  })
  if (!schoolClass) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 })
  }

  // TEACHER: must be assigned to this class
  if (user.role === 'TEACHER') {
    const ct = await prisma.classTeacher.findFirst({
      where: { classId, userId: user.id },
    })
    if (!ct) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const [homework, enrolments] = await Promise.all([
    prisma.homework.findMany({
      where:   { classId, schoolId: user.schoolId, status: { in: ['PUBLISHED', 'CLOSED'] } },
      select:  { id: true, title: true, dueAt: true },
      orderBy: { dueAt: 'asc' },
    }),
    prisma.enrolment.findMany({
      where:  { classId, user: { schoolId: user.schoolId, role: 'STUDENT' } },
      select: { user: { select: { id: true, firstName: true, lastName: true, yearGroup: true } } },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    }),
  ])

  const students = enrolments.map(e => e.user)

  if (homework.length === 0 || students.length === 0) {
    const csv = 'No data available\r\n'
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="homework-tracker-${classId}.csv"`,
      },
    })
  }

  const studentIds = students.map(s => s.id)
  const hwIds      = homework.map(h => h.id)

  const submissions = await prisma.submission.findMany({
    where:  { homeworkId: { in: hwIds }, studentId: { in: studentIds } },
    select: { studentId: true, homeworkId: true, status: true, autoScore: true, teacherScore: true },
  })

  // Map: `${studentId}:${hwId}` → submission
  const subMap = new Map(submissions.map(s => [`${s.studentId}:${s.homeworkId}`, s]))

  const fmtScore = (sub: typeof submissions[0] | undefined): string => {
    if (!sub) return 'Not submitted'
    const raw = sub.teacherScore ?? sub.autoScore
    if (raw != null) {
      const grade = percentToGcseGrade(raw)
      return `Grade ${grade}`
    }
    if (sub.status === 'SUBMITTED' || sub.status === 'UNDER_REVIEW') return 'Submitted'
    if (sub.status === 'RESUBMISSION_REQ') return 'Resubmission'
    return sub.status
  }

  const fmtDue = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''

  const header = [
    'Student Name', 'Year',
    ...homework.map(h => `${h.title} (due ${fmtDue(h.dueAt)})`),
  ]

  const rows = students.map(s => [
    `${s.lastName}, ${s.firstName}`,
    s.yearGroup ?? '',
    ...homework.map(h => fmtScore(subMap.get(`${s.id}:${h.id}`))),
  ])

  const csv = [
    header.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="homework-tracker-${schoolClass.name.replace(/\s+/g, '-')}-${date}.csv"`,
    },
  })
}
