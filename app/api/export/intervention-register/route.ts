import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { PlanStatus } from '@prisma/client'

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
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const PLAN_STATUS_LABEL: Record<string, string> = {
  DRAFT:                'Draft',
  ACTIVE_INTERNAL:      'Active (Internal)',
  ACTIVE_PARENT_SHARED: 'Active — Shared with Parent',
  ARCHIVED:             'Archived',
}

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // All active SEND students with their Plan (K Plan) and ILP
  const sendStudents = await prisma.sendStatus.findMany({
    where: {
      student: { schoolId: user.schoolId, isActive: true },
      activeStatus: { not: 'NONE' },
    },
    select: {
      activeStatus: true,
      needArea:     true,
      student: {
        select: {
          id:         true,
          firstName:  true,
          lastName:   true,
          yearGroup:  true,
          tutorGroup: true,
          // Active K Plan (Plan model)
          plans: {
            where:  { status: { notIn: [PlanStatus.ARCHIVED] } },
            select: {
              status:     true,
              reviewDate: true,
              _count:     { select: { targets: true, strategies: true } },
            },
            orderBy: { activatedAt: 'desc' },
            take: 1,
          },
          // Active ILP
          studentIlps: {
            where:  { status: { not: 'archived' } },
            select: {
              status:     true,
              reviewDate: true,
              targets: {
                select: { status: true },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: [
      { student: { yearGroup: 'asc' } },
      { student: { lastName:  'asc' } },
    ],
  })

  const header = [
    'Student', 'Year', 'Tutor Group', 'SEND Status', 'Need Area',
    'K Plan Status', 'K Plan Review Due', 'K Plan Targets', 'K Plan Strategies',
    'ILP Status', 'ILP Review Due', 'ILP Targets (total)', 'ILP Targets (achieved)',
  ]

  const rows = sendStudents.map(ss => {
    const s    = ss.student
    const plan = s.plans[0]
    const ilp  = s.studentIlps[0]

    const ilpAchieved = ilp ? ilp.targets.filter(t => t.status === 'achieved').length : 0

    return [
      `${s.lastName}, ${s.firstName}`,
      s.yearGroup ?? '—',
      s.tutorGroup ?? '—',
      ss.activeStatus,
      ss.needArea ?? '—',
      plan ? (PLAN_STATUS_LABEL[plan.status] ?? plan.status) : 'None',
      plan ? fmtDate(plan.reviewDate) : '—',
      plan ? plan._count.targets : 0,
      plan ? plan._count.strategies : 0,
      ilp  ? ilp.status  : 'None',
      ilp  ? fmtDate(ilp.reviewDate) : '—',
      ilp  ? ilp.targets.length  : 0,
      ilp  ? ilpAchieved : 0,
    ]
  })

  const csv = [
    header.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="intervention-register-${date}.csv"`,
    },
  })
}
