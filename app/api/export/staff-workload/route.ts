import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const ALLOWED = ['SLT', 'SCHOOL_ADMIN']

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const since30d = new Date(Date.now() - 30 * 86_400_000)

  // All teaching staff (not STUDENT/PARENT/PLATFORM_ADMIN/TA)
  const staff = await prisma.user.findMany({
    where: {
      schoolId: user.schoolId,
      role:     { in: ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN'] },
      isActive: true,
    },
    select: {
      id:        true,
      firstName: true,
      lastName:  true,
      email:     true,
      role:      true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  // Per-teacher stats: homework set + ungraded submissions (last 30d)
  const rows = await Promise.all(
    staff.map(async s => {
      const classLinks = await prisma.classTeacher.findMany({
        where:  { userId: s.id },
        select: { class: { select: { id: true, name: true, _count: { select: { enrolments: true } } } } },
      })
      const classIds      = classLinks.map(ct => ct.class.id)
      const totalStudents = classLinks.reduce((sum, ct) => sum + ct.class._count.enrolments, 0)

      const [homeworkSet, ungradedCount] = classIds.length > 0
        ? await Promise.all([
            prisma.homework.count({
              where: { classId: { in: classIds }, status: 'PUBLISHED', createdAt: { gte: since30d } },
            }),
            prisma.submission.count({
              where: {
                schoolId: user.schoolId,
                status:   { in: ['SUBMITTED', 'UNDER_REVIEW'] },
                homework: { classId: { in: classIds } },
              },
            }),
          ])
        : [0, 0]

      return [
        `${s.lastName}, ${s.firstName}`,
        s.email,
        s.role,
        classLinks.length,
        totalStudents,
        homeworkSet,
        ungradedCount,
        classIds.length > 0 ? classLinks.map(ct => ct.class.name).join('; ') : '',
      ]
    }),
  )

  const header = [
    'Name', 'Email', 'Role', 'Classes', 'Total Students',
    'HW Set (30d)', 'Ungraded Submissions', 'Class List',
  ]
  const csv = [
    header.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="staff-workload-${date}.csv"`,
    },
  })
}
