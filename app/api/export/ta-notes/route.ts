import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const ALLOWED = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR']

function escapeCsv(val: string | number | boolean | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const daysRaw = parseInt(req.nextUrl.searchParams.get('days') ?? '90', 10)
  const days    = [30, 60, 90, 180, 365].includes(daysRaw) ? daysRaw : 90
  const since   = new Date()
  since.setDate(since.getDate() - days)

  // HOY scoped to their year group
  let yearGroupFilter: number | null = null
  if (user.role === 'HEAD_OF_YEAR') {
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { yearGroup: true } })
    yearGroupFilter = u?.yearGroup ?? null
  }

  const notes = await prisma.taNote.findMany({
    where: {
      schoolId:  user.schoolId,
      createdAt: { gte: since },
      ...(yearGroupFilter ? { student: { yearGroup: yearGroupFilter } } : {}),
    },
    select: {
      content:   true,
      isUrgent:  true,
      isRead:    true,
      visibleTo: true,
      createdAt: true,
      student: {
        select: { firstName: true, lastName: true, yearGroup: true, tutorGroup: true },
      },
      class: { select: { name: true, subject: true } },
      author: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ isUrgent: 'desc' }, { createdAt: 'desc' }],
  })

  const header = [
    'Student', 'Year', 'Tutor Group', 'Class', 'Subject',
    'TA Author', 'Urgent', 'Read', 'Visible To', 'Date', 'Note',
  ]

  const rows = notes.map(n => [
    `${n.student.lastName}, ${n.student.firstName}`,
    n.student.yearGroup ?? '—',
    n.student.tutorGroup ?? '—',
    n.class?.name ?? '—',
    n.class?.subject ?? '—',
    `${n.author.firstName} ${n.author.lastName}`,
    n.isUrgent ? 'Yes' : 'No',
    n.isRead   ? 'Yes' : 'No',
    n.visibleTo,
    fmtDate(n.createdAt),
    n.content,
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
      'Content-Disposition': `attachment; filename="ta-notes-${days}d-${date}.csv"`,
    },
  })
}
