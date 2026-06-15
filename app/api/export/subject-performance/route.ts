import { NextRequest, NextResponse } from 'next/server'
import { requireAuth }               from '@/lib/session'
import { prisma }                    from '@/lib/prisma'
import { percentToGcseGrade }        from '@/lib/grading'

const ALLOWED = ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN']

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

  const subject   = req.nextUrl.searchParams.get('subject')
  const yearParam = req.nextUrl.searchParams.get('yearGroup')
  const yearGroup = yearParam ? parseInt(yearParam, 10) : null

  if (!subject) {
    return NextResponse.json({ error: 'subject required' }, { status: 400 })
  }

  // Classes for this subject
  const classes = await prisma.schoolClass.findMany({
    where: {
      schoolId: user.schoolId,
      subject,
      ...(yearGroup ? { yearGroup } : {}),
    },
    select: { id: true, name: true },
  })

  if (classes.length === 0) {
    return new NextResponse('No data\r\n', {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="subject-performance-${subject}.csv"`,
      },
    })
  }

  const classIds = classes.map(c => c.id)

  // Students enrolled in these classes
  const enrolments = await prisma.enrolment.findMany({
    where:  { classId: { in: classIds }, user: { schoolId: user.schoolId, role: 'STUDENT' } },
    select: {
      classId: true,
      user: {
        select: {
          id:                  true,
          firstName:           true,
          lastName:            true,
          yearGroup:           true,
          attendancePercentage: true,
        },
      },
    },
  })

  // Deduplicate students (may be in multiple classes)
  const studentMap = new Map<string, typeof enrolments[0]['user'] & { classIds: string[] }>()
  for (const e of enrolments) {
    if (!studentMap.has(e.user.id)) {
      studentMap.set(e.user.id, { ...e.user, classIds: [e.classId] })
    } else {
      studentMap.get(e.user.id)!.classIds.push(e.classId)
    }
  }

  const studentIds = [...studentMap.keys()]
  if (studentIds.length === 0) {
    return new NextResponse('No students enrolled\r\n', {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="subject-performance-${subject}.csv"`,
      },
    })
  }

  // Homework + submissions for these classes
  const homework = await prisma.homework.findMany({
    where:  { classId: { in: classIds }, status: { in: ['PUBLISHED', 'CLOSED'] } },
    select: { id: true, classId: true },
  })
  const hwIds = homework.map(h => h.id)

  const [submissions, sendStatuses] = await Promise.all([
    hwIds.length > 0
      ? prisma.submission.findMany({
          where:  { homeworkId: { in: hwIds }, studentId: { in: studentIds } },
          select: { studentId: true, homeworkId: true, status: true, teacherScore: true, autoScore: true },
        })
      : Promise.resolve([]),
    prisma.sendStatus.findMany({
      where:  { studentId: { in: studentIds }, NOT: { activeStatus: 'NONE' } },
      select: { studentId: true, activeStatus: true },
    }),
  ])

  // Maps
  const sendMap = new Map(sendStatuses.map(s => [s.studentId, s.activeStatus]))
  const hwByClass = new Map<string, string[]>()
  for (const h of homework) {
    if (!hwByClass.has(h.classId)) hwByClass.set(h.classId, [])
    hwByClass.get(h.classId)!.push(h.id)
  }

  // Submission stats per student
  const subMap = new Map<string, { scores: number[]; submitted: number; total: number }>()
  for (const sub of submissions) {
    if (!subMap.has(sub.studentId)) subMap.set(sub.studentId, { scores: [], submitted: 0, total: 0 })
    const entry = subMap.get(sub.studentId)!
    entry.submitted++
    const raw = sub.teacherScore ?? sub.autoScore
    if (raw != null) entry.scores.push(raw)
  }

  const header = [
    'Student', 'Year', 'Class(es)', 'SEND Status',
    'Attendance %', 'HW Submitted', 'HW Total', 'Completion %', 'Avg GCSE Grade',
  ]

  const classNameMap = new Map(classes.map(c => [c.id, c.name]))

  const rows = [...studentMap.values()]
    .sort((a, b) => a.lastName.localeCompare(b.lastName))
    .map(s => {
      const stats    = subMap.get(s.id)
      const hwTotal  = s.classIds.reduce((n, cid) => n + (hwByClass.get(cid)?.length ?? 0), 0)
      const hwDone   = stats?.submitted ?? 0
      const pct      = hwTotal > 0 ? Math.round((hwDone / hwTotal) * 100) : null
      const scores   = stats?.scores ?? []
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
      const grade    = avgScore != null ? `Grade ${percentToGcseGrade(avgScore)}` : '—'
      const classNames = s.classIds.map(id => classNameMap.get(id) ?? id).join('; ')

      return [
        `${s.lastName}, ${s.firstName}`,
        s.yearGroup ?? '',
        classNames,
        sendMap.get(s.id) ?? 'None',
        s.attendancePercentage != null ? `${Math.round(s.attendancePercentage)}%` : '—',
        hwDone,
        hwTotal,
        pct != null ? `${pct}%` : '—',
        grade,
      ]
    })

  const csv = [
    header.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)
  const slug = subject.replace(/\s+/g, '-').toLowerCase()

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="subject-performance-${slug}-${date}.csv"`,
    },
  })
}
