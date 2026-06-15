import { NextRequest, NextResponse } from 'next/server'
import { requireAuth }               from '@/lib/session'
import { getBehaviourOverview }      from '@/app/actions/behaviour'

const ALLOWED = ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT']

function escapeCsv(val: string | number | boolean | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const yearParam = req.nextUrl.searchParams.get('yearGroup')
  const yearGroup = yearParam ? parseInt(yearParam, 10) : undefined

  const rows = await getBehaviourOverview(yearGroup)

  const header = [
    'Student', 'Year', 'SEND Status',
    'Wonde Positive', 'Wonde Negative', 'Exclusion (Wonde)',
    'Manual Positive', 'Manual Negative', 'Total Manual Records',
    'Overall Concern',
  ]

  const csvRows = rows.map(r => {
    const neg = (r.wondeNegative ?? 0) + r.manualNegative
    const concern = r.hasExclusion ? 'High (Exclusion)' : neg >= 5 ? 'High' : neg >= 2 ? 'Monitor' : 'Low'
    return [
      r.studentName,
      r.yearGroup ?? '',
      r.sendStatus ?? 'None',
      r.wondePositive ?? '',
      r.wondeNegative ?? '',
      r.hasExclusion ? 'Yes' : r.hasExclusion === false ? 'No' : '',
      r.manualPositive,
      r.manualNegative,
      r.totalManual,
      concern,
    ]
  })

  const csv = [
    header.map(escapeCsv).join(','),
    ...csvRows.map(r => r.map(escapeCsv).join(',')),
  ].join('\r\n')

  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="behaviour-summary-${date}.csv"`,
    },
  })
}
