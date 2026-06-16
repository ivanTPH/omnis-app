import { NextRequest, NextResponse } from 'next/server'
import { requireAuth }               from '@/lib/session'
import { prisma }                    from '@/lib/prisma'

const ALLOWED = ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT', 'SENCO']

function esc(val: string | number | boolean | null | undefined): string {
  const s = String(val ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const yearParam = req.nextUrl.searchParams.get('yearGroup')
  const yearGroup = yearParam ? parseInt(yearParam, 10) : undefined
  const days      = parseInt(req.nextUrl.searchParams.get('days') ?? '365', 10)
  const since     = new Date(Date.now() - days * 86_400_000)

  const TYPE_LABELS: Record<string, string> = {
    internal:   'Internal',
    fixed_term: 'Fixed-Term',
    permanent:  'Permanent',
  }

  const rows = await prisma.exclusion.findMany({
    where: {
      schoolId: user.schoolId,
      startDate: { gte: since },
      ...(yearGroup ? { student: { yearGroup } } : {}),
    },
    select: {
      type: true, reason: true, startDate: true, endDate: true,
      daysCount: true, status: true, reintegrationPlan: true,
      parentContacted: true, notes: true, createdAt: true,
      student: {
        select: {
          firstName: true, lastName: true, yearGroup: true,
          sendStatus: { select: { activeStatus: true } },
        },
      },
      author: { select: { firstName: true, lastName: true, role: true } },
    },
    orderBy: { startDate: 'desc' },
  })

  const header = [
    'Student', 'Year Group', 'SEND Status', 'Type', 'Reason',
    'Start Date', 'End Date', 'Days', 'Status',
    'Parent Contacted', 'Reintegration Plan', 'Notes',
    'Logged By', 'Logged At',
  ]

  const csvRows = rows.map(r => {
    const send = r.student.sendStatus?.activeStatus
    return [
      `${r.student.firstName} ${r.student.lastName}`,
      r.student.yearGroup ?? '',
      send && send !== 'NONE' ? send.replace('_', ' ') : 'None',
      TYPE_LABELS[r.type] ?? r.type,
      r.reason,
      r.startDate.toLocaleDateString('en-GB'),
      r.endDate ? r.endDate.toLocaleDateString('en-GB') : '',
      r.daysCount,
      r.status.charAt(0).toUpperCase() + r.status.slice(1),
      r.parentContacted ? 'Yes' : 'No',
      r.reintegrationPlan ?? '',
      r.notes ?? '',
      `${r.author.firstName} ${r.author.lastName}`,
      r.createdAt.toLocaleDateString('en-GB'),
    ]
  })

  const csv = [
    header.map(esc).join(','),
    ...csvRows.map(row => row.map(esc).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="exclusion-log-${date}.csv"`,
    },
  })
}
