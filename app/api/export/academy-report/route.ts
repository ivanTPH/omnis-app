export const maxDuration = 60

import { NextResponse }           from 'next/server'
import { requireAuth }            from '@/lib/session'
import { getAcademyStats, getAcademySchools } from '@/app/actions/academy'
import { generatePdf }            from '@/lib/pdf/generator'
import { academyReportPdf }       from '@/lib/pdf/academy-report-template'

export async function GET() {
  const user = await requireAuth()
  if (!['ACADEMY_ADMIN', 'PLATFORM_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [stats, schools] = await Promise.all([getAcademyStats(), getAcademySchools()])

  const now  = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const html = academyReportPdf(stats, schools, user.schoolName, now)
  const pdf  = await generatePdf(html)

  const filename = `trust-report-${new Date().toISOString().slice(0, 10)}.pdf`
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
