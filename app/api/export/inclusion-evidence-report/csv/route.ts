import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { getInclusionEvidenceReport, type InclusionReportFilters } from '@/app/actions/analytics'

const ALLOWED = ['SLT', 'SCHOOL_ADMIN', 'SENCO', 'HEAD_OF_YEAR']

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB')
}

function parseFilters(searchParams: URLSearchParams): InclusionReportFilters {
  const yearGroupsRaw = searchParams.get('yearGroups')
  const yearGroups = yearGroupsRaw
    ? yearGroupsRaw.split(',').map(v => parseInt(v, 10)).filter(n => !Number.isNaN(n))
    : undefined
  const sendStatusRaw = searchParams.get('sendStatus')
  const sendStatus = (['NONE', 'SEN_SUPPORT', 'EHCP', 'ALL'].includes(sendStatusRaw ?? '')
    ? sendStatusRaw
    : undefined) as InclusionReportFilters['sendStatus']

  return {
    yearGroups,
    sendStatus,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    studentId: searchParams.get('studentId') ?? undefined,
  }
}

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const filters = parseFilters(req.nextUrl.searchParams)
  const data = await getInclusionEvidenceReport(filters)

  const header = [
    'Student', 'Year Group', 'SEND Status', 'Need Area',
    'ILP Status', 'ILP Approved', 'ILP Review Due', 'EHCP Review Due', 'Open Concerns',
  ]
  const rows = data.registerRows.map(r => [
    r.studentName,
    r.yearGroup ?? '—',
    r.sendStatus,
    r.needArea ?? '—',
    r.ilpStatus ?? 'None',
    r.ilpApproved ? 'Yes' : 'No',
    fmtDate(r.ilpReviewDate),
    fmtDate(r.ehcpReviewDate),
    r.openConcernCount,
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
      'Content-Disposition': `attachment; filename="inclusion-evidence-report-${date}.csv"`,
    },
  })
}
