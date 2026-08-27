import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getStudentAiJourney } from '@/app/actions/agent-insights'
import { generatePdf } from '@/lib/pdf/generator'
import { aiJourneyPdf } from '@/lib/pdf/ai-journey-template'

const ALLOWED = ['SCHOOL_ADMIN', 'SLT']

export const maxDuration = 60

/**
 * DSAR PDF export of a student's full AI-assisted decision-support journey —
 * dspy-service/XAI.md's build-scope item 4. Reuses getStudentAiJourney()
 * (the same data the in-app "AI Journey" tab renders) and the existing
 * DataSubjectRequest flow's admin-only gating, alongside the JSON export at
 * /api/export/gdpr-data/[dsrId].
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dsrId: string }> },
) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { dsrId } = await params

  const dsr = await prisma.dataSubjectRequest.findFirst({
    where: { id: dsrId, schoolId: user.schoolId, requestType: { in: ['access', 'portability'] } },
  })
  if (!dsr) return NextResponse.json({ error: 'Request not found or not an access/portability request' }, { status: 404 })
  if (!dsr.studentId) return NextResponse.json({ error: 'No student linked to this request' }, { status: 400 })

  const [student, school] = await Promise.all([
    prisma.user.findFirst({
      where:  { id: dsr.studentId, schoolId: user.schoolId },
      select: { firstName: true, lastName: true },
    }),
    prisma.school.findUnique({
      where:  { id: user.schoolId },
      select: { name: true },
    }),
  ])
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  let journey
  try {
    journey = await getStudentAiJourney(dsr.studentId)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const html = aiJourneyPdf({
    studentName: `${student.firstName} ${student.lastName}`,
    schoolName:  school?.name ?? user.schoolName,
    journey,
  })

  const pdf = await generatePdf(html)

  const safeName = `${student.lastName}-${student.firstName}`.replace(/[^a-zA-Z0-9-]/g, '')
  const date     = new Date().toISOString().slice(0, 10)

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="ai-journey-${safeName}-${date}.pdf"`,
    },
  })
}
