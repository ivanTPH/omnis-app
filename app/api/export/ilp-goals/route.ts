import { NextResponse }  from 'next/server'
import { requireAuth }   from '@/lib/session'
import { prisma }        from '@/lib/prisma'

const ALLOWED = ['SENCO', 'SLT', 'SCHOOL_ADMIN']

function escapeCsv(val: string | number | boolean | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB')
}

export const maxDuration = 60

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { schoolId } = user

  // Fetch all non-archived ILPs with their targets
  const ilps = await prisma.individualLearningPlan.findMany({
    where:   { schoolId, status: { not: 'archived' } },
    include: { targets: { orderBy: { targetDate: 'asc' } } },
    orderBy: [{ reviewDate: 'asc' }],
  })

  const studentIds = [...new Set(ilps.map(i => i.studentId))]

  const [students, enrolments] = await Promise.all([
    prisma.user.findMany({
      where:  { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, yearGroup: true },
    }),
    prisma.enrolment.findMany({
      where:  { userId: { in: studentIds } },
      select: { userId: true, class: { select: { name: true } } },
      take:   studentIds.length * 3,
    }),
  ])

  const studentMap  = new Map(students.map(s => [s.id, s]))
  const classMap    = new Map<string, string>()
  for (const e of enrolments) {
    if (!classMap.has(e.userId)) classMap.set(e.userId, e.class.name)
  }

  const header = [
    'Student Name',
    'Year Group',
    'Class',
    'SEND Category',
    'ILP Status',
    'Review Date',
    'Approved by SENCO',
    'Areas of Need',
    'Target',
    'Strategy',
    'Success Measure',
    'Target Date',
    'Target Status',
    'Progress Notes',
  ]

  const csvRows: (string | number | boolean | null | undefined)[][] = []

  for (const ilp of ilps) {
    const stu         = studentMap.get(ilp.studentId)
    const studentName = stu ? `${stu.firstName} ${stu.lastName}` : 'Unknown'
    const yearGroup   = stu?.yearGroup ?? ''
    const className   = classMap.get(ilp.studentId) ?? ''
    const status      = ilp.status === 'under_review' ? 'Draft / Pending Approval' : ilp.status === 'active' ? 'Active' : ilp.status
    const approved    = ilp.approvedBySenco ? 'Yes' : 'No'
    const reviewDate  = fmtDate(ilp.reviewDate)

    if (ilp.targets.length === 0) {
      // One row with blank target columns so the student still appears
      csvRows.push([
        studentName, yearGroup, className, ilp.sendCategory,
        status, reviewDate, approved, ilp.areasOfNeed,
        '', '', '', '', '', '',
      ])
    } else {
      for (const t of ilp.targets) {
        csvRows.push([
          studentName, yearGroup, className, ilp.sendCategory,
          status, reviewDate, approved, ilp.areasOfNeed,
          t.target, t.strategy, t.successMeasure,
          fmtDate(t.targetDate), t.status, t.progressNotes ?? '',
        ])
      }
    }
  }

  const csv = [
    header.map(escapeCsv).join(','),
    ...csvRows.map(r => r.map(escapeCsv).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ilp-goals-${date}.csv"`,
    },
  })
}
