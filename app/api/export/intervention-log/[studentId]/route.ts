import { NextRequest, NextResponse }      from 'next/server'
import { requireAuth }                    from '@/lib/session'
import { prisma }                         from '@/lib/prisma'
import { interventionLogPdf }             from '@/lib/pdf/intervention-log-template'
import { generatePdf }                    from '@/lib/pdf/generator'

const ALLOWED = ['SENCO', 'SLT', 'HEAD_OF_YEAR', 'SCHOOL_ADMIN']

export const maxDuration = 60

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { studentId } = await params

  const student = await prisma.user.findFirst({
    where:  { id: studentId, schoolId: user.schoolId, role: 'STUDENT' },
    select: { firstName: true, lastName: true, yearGroup: true },
  })
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const studentName = `${student.firstName} ${student.lastName}`

  const [evidence, taNotes, concerns, apdrs, sendStatus, ilp] = await Promise.all([
    prisma.ilpEvidenceEntry.findMany({
      where:   { studentId, schoolId: user.schoolId },
      select:  { createdAt: true, homeworkTitle: true, subject: true, evidenceType: true, score: true, maxScore: true, aiSummary: true, teacherNote: true },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.taNote.findMany({
      where:   { studentId, schoolId: user.schoolId },
      select:  { createdAt: true, content: true, isUrgent: true, author: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.sendConcern.findMany({
      where:   { studentId, schoolId: user.schoolId },
      select:  { createdAt: true, category: true, status: true, description: true, raisedByUser: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.assessPlanDoReview.findMany({
      where:   { studentId, schoolId: user.schoolId },
      select:  { cycleNumber: true, reviewDate: true, status: true, assessContent: true, planContent: true, doContent: true, reviewContent: true, outcomeRating: true, parentComments: true },
      orderBy: { cycleNumber: 'asc' },
    }),

    prisma.sendStatus.findFirst({
      where:  { studentId },
      select: { activeStatus: true },
    }),

    prisma.individualLearningPlan.findFirst({
      where:   { studentId, schoolId: user.schoolId, status: 'active' },
      select:  { areasOfNeed: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const html = interventionLogPdf({
    schoolName:  user.schoolName,
    studentName,
    yearGroup:   student.yearGroup,
    sendStatus:  sendStatus?.activeStatus ?? null,
    ilpSummary:  ilp?.areasOfNeed ?? null,
    evidence: evidence.map(e => ({
      date:          e.createdAt.toISOString(),
      homeworkTitle: e.homeworkTitle,
      subject:       e.subject,
      evidenceType:  e.evidenceType,
      score:         e.score,
      maxScore:      e.maxScore,
      aiSummary:     e.aiSummary,
      teacherNote:   e.teacherNote,
    })),
    taNotes: taNotes.map(n => ({
      date:       n.createdAt.toISOString(),
      content:    n.content,
      isUrgent:   n.isUrgent,
      authorName: `${n.author.firstName} ${n.author.lastName}`,
    })),
    concerns: concerns.map(c => ({
      date:        c.createdAt.toISOString(),
      category:    c.category,
      status:      c.status,
      description: c.description,
      raiserName:  `${c.raisedByUser.firstName} ${c.raisedByUser.lastName}`,
    })),
    apdrs: apdrs.map(a => ({
      cycleNumber:    a.cycleNumber,
      reviewDate:     a.reviewDate.toISOString(),
      status:         a.status,
      assessContent:  a.assessContent,
      planContent:    a.planContent,
      doContent:      a.doContent,
      reviewContent:  a.reviewContent,
      outcomeRating:  a.outcomeRating,
      parentComments: a.parentComments,
    })),
  })

  const pdf  = await generatePdf(html)
  const date = new Date().toISOString().slice(0, 10)
  const slug = studentName.replace(/\s+/g, '-').toLowerCase()

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="intervention-log-${slug}-${date}.pdf"`,
    },
  })
}
