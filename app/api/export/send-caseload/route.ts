import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const ALLOWED = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR']

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-GB')
}

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // All students on SEND register
  const sendStudents = await prisma.sendStatus.findMany({
    where: {
      student: { schoolId: user.schoolId, isActive: true },
      activeStatus: { not: 'NONE' },
    },
    select: {
      activeStatus: true,
      needArea:     true,
      updatedAt:    true,
      student: {
        select: {
          id:        true,
          firstName: true,
          lastName:  true,
          yearGroup: true,
          tutorGroup: true,
          studentIlps: {
            where:   { status: { not: 'archived' } },
            orderBy: { createdAt: 'desc' },
            take:    1,
            select:  { status: true, reviewDate: true },
          },
          ehcpPlans: {
            orderBy: { createdAt: 'desc' },
            take:    1,
            select:  { reviewDate: true, status: true },
            where:   { status: { not: 'closed' } },
          },
          studentConcerns: {
            where: {
              schoolId: user.schoolId,
              status: { in: ['open', 'under_review', 'escalated'] },
            },
            select: { id: true },
          },
        },
      },
    },
    orderBy: [
      { student: { yearGroup: 'asc' } },
      { student: { lastName: 'asc' } },
    ],
  })

  const rows = sendStudents.map(ss => {
    const s = ss.student
    const ilp  = s.studentIlps[0]
    const ehcp = s.ehcpPlans[0]
    return [
      `${s.lastName}, ${s.firstName}`,
      s.yearGroup ?? '—',
      s.tutorGroup ?? '—',
      ss.activeStatus,
      ss.needArea ?? '—',
      ilp  ? ilp.status  : 'None',
      ilp  ? fmtDate(ilp.reviewDate) : '—',
      ehcp ? 'Yes'       : 'No',
      ehcp ? fmtDate(ehcp.reviewDate) : '—',
      s.studentConcerns.length,
    ]
  })

  const header = [
    'Student', 'Year', 'Tutor Group', 'SEND Status', 'Need Area',
    'ILP Status', 'ILP Review Due', 'EHCP', 'EHCP Review Due', 'Open Concerns',
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
      'Content-Disposition': `attachment; filename="send-caseload-${date}.csv"`,
    },
  })
}
