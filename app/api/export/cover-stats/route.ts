import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const ALLOWED = ['COVER_MANAGER', 'SCHOOL_ADMIN', 'SLT']

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const daysRaw = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const days    = [7, 14, 30, 60, 90].includes(daysRaw) ? daysRaw : 30
  const since   = new Date()
  since.setDate(since.getDate() - days)

  const absences = await prisma.staffAbsence.findMany({
    where: { schoolId: user.schoolId, date: { gte: since } },
    include: {
      coverAssignments: true,
    },
    orderBy: { date: 'desc' },
  })

  // Resolve Wonde employee names for staffId and coveredBy
  const allStaffIds = [
    ...absences.map(a => a.staffId),
    ...absences.flatMap(a => a.coverAssignments.map(c => c.coveredBy)).filter(Boolean) as string[],
  ]
  const wondeStaff = allStaffIds.length > 0
    ? await prisma.wondeEmployee.findMany({
        where: { id: { in: [...new Set(allStaffIds)] } },
        select: { id: true, firstName: true, lastName: true },
      })
    : []
  const staffMap = new Map(wondeStaff.map(s => [s.id, `${s.firstName} ${s.lastName}`]))

  // Resolve timetable entry class names via WondeClass relation
  const timetableIds = absences.flatMap(a => a.coverAssignments.map(c => c.timetableEntryId))
  const timetableEntries = timetableIds.length > 0
    ? await prisma.wondeTimetableEntry.findMany({
        where: { id: { in: [...new Set(timetableIds)] } },
        select: { id: true, wondeClass: { select: { name: true, subject: true } } },
      })
    : []
  const timetableMap = new Map(timetableEntries.map(t => [t.id, t]))

  const header = [
    'Date', 'Absent Staff', 'Reason', 'Class', 'Subject',
    'Cover Teacher', 'Status', 'Notes',
  ]

  const rows: (string | number | null)[][] = []

  for (const absence of absences) {
    if (absence.coverAssignments.length === 0) {
      rows.push([
        fmtDate(absence.date),
        staffMap.get(absence.staffId) ?? absence.staffId,
        absence.reason,
        '—', '—', '—', 'No cover needed',
        absence.notes ?? '',
      ])
    } else {
      for (const ca of absence.coverAssignments) {
        const te = timetableMap.get(ca.timetableEntryId)
        rows.push([
          fmtDate(absence.date),
          staffMap.get(absence.staffId) ?? absence.staffId,
          absence.reason,
          te?.wondeClass?.name ?? '—',
          te?.wondeClass?.subject ?? '—',
          ca.coveredBy ? (staffMap.get(ca.coveredBy) ?? ca.coveredBy) : 'Unassigned',
          ca.status,
          ca.notes ?? absence.notes ?? '',
        ])
      }
    }
  }

  const csv = [
    header.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cover-stats-${days}d-${date}.csv"`,
    },
  })
}
