export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { auth }         from '@/lib/auth'
import { prisma }       from '@/lib/prisma'
import { generatePdf }  from '@/lib/pdf/generator'
import { homeworkSheetPdf } from '@/lib/pdf/homework-template'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ homeworkId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any

  const { homeworkId } = await params

  const hw = await prisma.homework.findFirst({
    where: { id: homeworkId, schoolId: user.schoolId },
    include: {
      class:     { select: { name: true, subject: true } },
      questions: { orderBy: { orderIndex: 'asc' } },
    },
  })

  if (!hw) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const html = homeworkSheetPdf({
    title:        hw.title,
    subject:      hw.class?.subject ?? 'Unknown',
    instructions: hw.instructions,
    type:         hw.type,
    setAt:        hw.createdAt,
    dueAt:        hw.dueAt,
    schoolName:   user.schoolName,
    className:    hw.class?.name ?? null,
    questions:    hw.questions.map(q => ({
      order:   q.orderIndex,
      text:    q.prompt,
      marks:   q.maxScore ?? null,
      options: Array.isArray(q.optionsJson) ? (q.optionsJson as string[]) : null,
      rubric:  q.rubricJson ? String(q.rubricJson) : null,
    })),
  })

  const pdf = await generatePdf(html)

  const subject  = (hw.class?.subject ?? 'homework').toLowerCase().replace(/\s+/g, '-')
  const title    = hw.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30)
  const filename = `homework-${subject}-${title}.pdf`

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
