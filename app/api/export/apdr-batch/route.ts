import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const ALLOWED = ['SENCO', 'SLT', 'SCHOOL_ADMIN']

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function truncate(s: string, max = 120): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max) + '…' : s
}

const OUTCOME_LABELS: Record<string, string> = {
  GOOD_PROGRESS: 'Good Progress',
  SOME_PROGRESS: 'Some Progress',
  INSUFFICIENT:  'Insufficient Progress',
  NO_PROGRESS:   'No Progress Made',
}

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cycles = await prisma.assessPlanDoReview.findMany({
    where: { schoolId: user.schoolId },
    include: {
      student: {
        select: {
          firstName:  true,
          lastName:   true,
          yearGroup:  true,
          tutorGroup: true,
          sendStatus: { select: { activeStatus: true, needArea: true } },
        },
      },
    },
    orderBy: [
      { student: { yearGroup: 'asc' } },
      { student: { lastName:  'asc' } },
      { cycleNumber: 'asc' },
    ],
  })

  const header = [
    'Student', 'Year', 'Tutor Group', 'SEND Status', 'Need Area',
    'Cycle #', 'Status', 'Outcome Rating', 'Review Date', 'Approved',
    'Assess (summary)', 'Plan (summary)', 'Do (summary)', 'Review (summary)',
  ]

  const rows = cycles.map(c => [
    `${c.student.lastName}, ${c.student.firstName}`,
    c.student.yearGroup ?? '—',
    c.student.tutorGroup ?? '—',
    c.student.sendStatus?.activeStatus ?? 'NONE',
    c.student.sendStatus?.needArea ?? '—',
    c.cycleNumber,
    c.status,
    OUTCOME_LABELS[c.outcomeRating] ?? (c.outcomeRating || 'Not rated'),
    fmtDate(c.reviewDate),
    c.approvedBySenco ? 'Yes' : 'No',
    truncate(c.assessContent),
    truncate(c.planContent),
    truncate(c.doContent),
    truncate(c.reviewContent),
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
      'Content-Disposition': `attachment; filename="apdr-cycles-${date}.csv"`,
    },
  })
}
