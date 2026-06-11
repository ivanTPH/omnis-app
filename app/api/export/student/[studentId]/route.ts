export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { getStudentFile } from '@/app/actions/students'
import { generatePdf }    from '@/lib/pdf/generator'
import { studentRecordPdf } from '@/lib/pdf/student-record-template'

const ALLOWED = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR', 'HEAD_OF_DEPT', 'TEACHER']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { studentId } = await params
  const data = await getStudentFile(studentId)
  if (!data) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  const html = studentRecordPdf(data, user.schoolName)
  const pdf  = await generatePdf(html)

  const name = `${data.student.firstName}-${data.student.lastName}-record.pdf`
    .replace(/\s+/g, '-').toLowerCase()

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  })
}
