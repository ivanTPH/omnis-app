import { NextRequest, NextResponse } from 'next/server'
import { requireAuth }               from '@/lib/session'
import { prisma }                    from '@/lib/prisma'

const ALLOWED = ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT']

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
  const days      = parseInt(req.nextUrl.searchParams.get('days') ?? '90', 10)
  const since     = new Date(Date.now() - days * 86_400_000)

  const TYPE_LABELS: Record<string, string> = {
    lunchtime:    'Lunchtime',
    after_school: 'After School',
    morning:      'Morning',
    isolation:    'Isolation',
  }

  const rows = await prisma.detention.findMany({
    where: {
      schoolId: user.schoolId,
      createdAt: { gte: since },
      ...(yearGroup ? { student: { yearGroup } } : {}),
    },
    select: {
      type: true, reason: true, scheduledAt: true, durationMins: true,
      location: true, status: true, parentNotified: true, notes: true, createdAt: true,
      student: { select: { firstName: true, lastName: true, yearGroup: true } },
      author:  { select: { firstName: true, lastName: true, role: true } },
    },
    orderBy: { scheduledAt: 'desc' },
  })

  const header = [
    'Student', 'Year Group', 'Type', 'Reason',
    'Scheduled Date', 'Scheduled Time', 'Duration (min)', 'Location',
    'Status', 'Parent Notified', 'Set By', 'Notes', 'Logged At',
  ]

  const csvRows = rows.map(r => [
    `${r.student.firstName} ${r.student.lastName}`,
    r.student.yearGroup ?? '',
    TYPE_LABELS[r.type] ?? r.type,
    r.reason,
    r.scheduledAt.toLocaleDateString('en-GB'),
    r.scheduledAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    r.durationMins,
    r.location ?? '',
    r.status.charAt(0).toUpperCase() + r.status.slice(1),
    r.parentNotified ? 'Yes' : 'No',
    `${r.author.firstName} ${r.author.lastName}`,
    r.notes ?? '',
    r.createdAt.toLocaleDateString('en-GB'),
  ])

  const csv = [
    header.map(esc).join(','),
    ...csvRows.map(row => row.map(esc).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="detention-register-${date}.csv"`,
    },
  })
}
