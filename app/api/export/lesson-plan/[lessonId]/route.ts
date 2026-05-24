export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma }     from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { lessonPlanPdf } from '@/lib/pdf/lesson-plan-template'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const user = await requireAuth()

  const { lessonId } = await params

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId: user.schoolId },
    include: {
      class: { select: { name: true, subject: true, yearGroup: true, department: true } },
      resources: { select: { type: true, label: true, url: true }, orderBy: { createdAt: 'asc' } },
      homework: { select: { title: true, type: true, dueAt: true, instructions: true }, orderBy: { createdAt: 'desc' }, take: 5 },
    },
  })

  if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const html = lessonPlanPdf({
    title:       lesson.title,
    topic:       lesson.topic,
    objectives:  lesson.objectives as string[],
    scheduledAt: lesson.scheduledAt,
    schoolName:  user.schoolName,
    class:       lesson.class,
    resources:   lesson.resources.map(r => ({ type: r.type, label: r.label, url: r.url })),
    homework:    lesson.homework.map(h => ({
      title:        h.title,
      type:         h.type,
      dueAt:        h.dueAt,
      instructions: h.instructions,
    })),
  })

  const pdf = await generatePdf(html)

  const subject  = lesson.class?.subject?.toLowerCase().replace(/\s+/g, '-') ?? 'lesson'
  const dateStr  = lesson.scheduledAt
    ? new Date(lesson.scheduledAt).toISOString().slice(0, 10)
    : 'undated'
  const filename = `lesson-plan-${subject}-${dateStr}.pdf`

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
