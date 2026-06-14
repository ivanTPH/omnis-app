import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { ilpReportPdf } from '@/lib/pdf/ilp-report-template'

const ALLOWED = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR']

export const maxDuration = 60

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { studentId } = await params

  const student = await prisma.user.findFirst({
    where: { id: studentId, schoolId: user.schoolId, isActive: true },
    select: {
      firstName:  true,
      lastName:   true,
      yearGroup:  true,
      tutorGroup: true,
      sendStatus: { select: { activeStatus: true, needArea: true } },
    },
  })
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Active ILP targets (IndividualLearningPlan model)
  const ilps = await prisma.individualLearningPlan.findMany({
    where: {
      studentId,
      status: { not: 'archived' },
    },
    select: {
      targets: {
        select: {
          target:         true,
          status:         true,
          successMeasure: true,
          targetDate:     true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  })
  const targets = ilps[0]?.targets ?? []

  // ILP evidence entries
  const evidenceEntries = await prisma.ilpEvidenceEntry.findMany({
    where: { studentId, schoolId: user.schoolId },
    select: {
      homeworkTitle: true,
      subject:       true,
      evidenceType:  true,
      aiSummary:     true,
      createdAt:     true,
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  // Recent homework submissions
  const classIds = (await prisma.enrolment.findMany({
    where: { userId: studentId },
    select: { classId: true },
  })).map(e => e.classId)

  const submissions = await prisma.submission.findMany({
    where: { studentId, schoolId: user.schoolId, homework: { classId: { in: classIds } } },
    select: {
      finalScore:  true,
      status:      true,
      submittedAt: true,
      homework: {
        select: {
          title: true,
          class: { select: { name: true } },
        },
      },
    },
    orderBy: { submittedAt: 'desc' },
    take: 15,
  })

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true },
  })

  const data = {
    studentName:   `${student.firstName} ${student.lastName}`,
    yearGroup:     student.yearGroup,
    tutorGroup:    student.tutorGroup,
    sendStatus:    student.sendStatus?.activeStatus ?? 'NONE',
    needArea:      student.sendStatus?.needArea,
    schoolName:    school?.name ?? user.schoolName,
    generatedAt:   new Date(),
    targets:       targets.map(t => ({
      targetDescription: t.target,
      status:            t.status,
      successCriteria:   t.successMeasure,
      reviewDate:        t.targetDate,
    })),
    evidenceEntries: evidenceEntries.map(e => ({
      homeworkTitle: e.homeworkTitle,
      subject:       e.subject,
      evidenceType:  e.evidenceType,
      aiSummary:     e.aiSummary,
      createdAt:     e.createdAt,
    })),
    recentSubmissions: submissions.map(s => ({
      homeworkTitle: s.homework.title,
      className:     s.homework.class?.name ?? '—',
      finalScore:    s.finalScore,
      status:        s.status,
      submittedAt:   s.submittedAt,
    })),
  }

  const html = ilpReportPdf(data)
  const pdf  = await generatePdf(html)

  const date     = new Date().toISOString().slice(0, 10)
  const safeName = `${student.lastName}-${student.firstName}`.replace(/[^a-zA-Z0-9-]/g, '')
  const filename = `ilp-report-${safeName}-${date}.pdf`

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
