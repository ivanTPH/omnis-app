import { NextResponse }        from 'next/server'
import { requireAuth }         from '@/lib/session'
import { getHoyWelfareData }   from '@/app/actions/hoy-welfare'
import { welfareReportPdf }    from '@/lib/pdf/welfare-report-template'
import { generatePdf }         from '@/lib/pdf/generator'

const ALLOWED = ['HEAD_OF_YEAR', 'SCHOOL_ADMIN', 'SLT']

export const maxDuration = 60

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await getHoyWelfareData()

  const html = welfareReportPdf({
    schoolName:               user.schoolName,
    yearGroup:                data.yearGroup,
    totalStudents:            data.totalStudents,
    studentsNeedingAttention: data.studentsNeedingAttention,
    openConcernsCount:        data.openConcernsCount,
    highFlagsCount:           data.highFlagsCount,
    missedHwStudentsCount:    data.missedHwStudentsCount,
    ilpReviewsDue14d:         data.ilpReviewsDue14d,
    alerts:     data.alerts,
    concerns:   data.concerns,
    flags:      data.flags,
    ilpReviews: data.ilpReviews,
  })

  const pdf  = await generatePdf(html)
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="welfare-report-${date}.pdf"`,
    },
  })
}
