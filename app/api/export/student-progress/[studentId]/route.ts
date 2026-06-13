export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getStudentFile } from '@/app/actions/students'
import { generatePdf } from '@/lib/pdf/generator'
import { studentProgressPdf } from '@/lib/pdf/student-progress-template'

const STAFF_ROLES = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const user = await requireAuth()
  const { studentId } = await params

  if (user.role === 'PARENT') {
    // Verify parentship
    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: user.id, studentId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } else if (!STAFF_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await getStudentFile(studentId)
  if (!data) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  const html = studentProgressPdf(data, user.schoolName)
  const pdf  = await generatePdf(html)

  const name = `${data.student.firstName}-${data.student.lastName}-progress.pdf`
    .replace(/\s+/g, '-').toLowerCase()

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  })
}
