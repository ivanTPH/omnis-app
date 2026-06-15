import { NextResponse }           from 'next/server'
import { requireAuth }            from '@/lib/session'
import { getHodDashboardData }    from '@/app/actions/hod'
import { departmentReportPdf }    from '@/lib/pdf/department-report-template'
import { generatePdf }            from '@/lib/pdf/generator'

const ALLOWED = ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN']

export const maxDuration = 60

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await getHodDashboardData()

  const html = departmentReportPdf({
    schoolName:    user.schoolName,
    department:    data.department,
    subjects:      data.subjects,
    totalClasses:  data.totalClasses,
    totalStudents: data.totalStudents,
    sendStudents:  data.sendStudents,
    activeIlps:    data.activeIlps,
    openConcerns:  data.openConcerns,
    avgScore:      data.avgScore,
    avgCompletion: data.avgCompletion,
    totalUngraded: data.totalUngraded,
    classes:       data.classes,
    staff:         data.staff,
  })

  const pdf  = await generatePdf(html)
  const date = new Date().toISOString().slice(0, 10)
  const slug = data.department.toLowerCase().replace(/\s+/g, '-')

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="dept-report-${slug}-${date}.pdf"`,
    },
  })
}
