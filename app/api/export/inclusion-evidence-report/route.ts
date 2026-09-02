export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { getInclusionEvidenceReport, type InclusionReportFilters } from '@/app/actions/analytics'
import { generatePdf } from '@/lib/pdf/generator'
import { inclusionEvidenceReportPdf } from '@/lib/pdf/inclusion-evidence-template'

const ALLOWED = ['SLT', 'SCHOOL_ADMIN', 'SENCO', 'HEAD_OF_YEAR']

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
  const html = inclusionEvidenceReportPdf(data)
  const pdf  = await generatePdf(html)

  const date = new Date().toISOString().slice(0, 10)
  const suffix = data.section7CaseStudy
    ? data.section7CaseStudy.studentName.replace(/\s+/g, '-').toLowerCase()
    : 'summary'
  const name = `inclusion-evidence-report-${suffix}-${date}.pdf`

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  })
}
