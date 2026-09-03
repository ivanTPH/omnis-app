import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { writeAudit } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { narrativeReportPdf } from '@/lib/pdf/narrative-report-template'
import { getReportSourceData } from '@/app/actions/reports'

const ALLOWED = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN']

export const maxDuration = 60

/**
 * Exports the teacher-reviewed narrative report as a PDF. The narrative text is
 * whatever the teacher is currently looking at on screen (possibly edited from the
 * AI draft) — sent in the POST body. All structured data (grades, attendance, ILP
 * targets) is re-fetched server-side rather than trusted from the client, so a
 * tampered request body can change what's SAID about a student but never the
 * underlying figures shown.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { studentId } = await params

  let body: { performance?: string; potential?: string; areasForImprovement?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const narrative = {
    performance:         String(body.performance ?? '').slice(0, 2000),
    potential:           String(body.potential ?? '').slice(0, 2000),
    areasForImprovement: String(body.areasForImprovement ?? '').slice(0, 2000),
  }

  let source
  try {
    source = await getReportSourceData(studentId)
  } catch {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  const html = narrativeReportPdf({
    source,
    narrative,
    teacherName:  `${user.firstName} ${user.lastName}`,
    preparedDate: new Date(),
  })

  let pdf: ArrayBuffer
  try {
    pdf = await generatePdf(html)
  } catch (err) {
    console.error('[narrative-report] PDF generation failed:', err)
    return NextResponse.json({ error: 'PDF generation failed — please try again' }, { status: 500 })
  }

  await writeAudit({
    schoolId:   user.schoolId,
    actorId:    user.id,
    action:     'REPORT_EXPORTED',
    targetType: 'Student',
    targetId:   studentId,
    metadata:   { reportType: 'narrative' },
  })

  const safeFileName = `${source.studentName}-report`.replace(/[^a-z0-9-]/gi, '-')

  return new NextResponse(pdf, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFileName}.pdf"`,
    },
  })
}
