'use server'

import { prisma, writeAudit } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { revalidatePath } from 'next/cache'

const ALLOWED = ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN'] as const

export async function reviewIntegritySignal(
  signalId: string,
  action: 'RELEASED' | 'BLOCKED' | 'FLAGGED_FOR_RESUBMISSION',
  notes?: string,
): Promise<void> {
  const user = await requireAuth(ALLOWED as unknown as string[])

  // Verify signal belongs to this school
  const signal = await prisma.submissionIntegritySignal.findUnique({
    where: { id: signalId },
    include: {
      attempt: {
        include: {
          submission: { include: { student: { select: { schoolId: true } } } },
        },
      },
    },
  })
  if (!signal || signal.attempt.submission.student.schoolId !== user.schoolId) return

  await prisma.integrityReviewLog.create({
    data: {
      signalId,
      reviewedBy: user.id,
      action,
      notes: notes ?? null,
    },
  })

  await writeAudit({
    schoolId:   user.schoolId,
    actorId:    user.id,
    action:     'GRADE_OVERRIDDEN',
    targetId:   signalId,
    targetType: 'IntegritySignal',
    metadata:   { integrityAction: action, notes: notes ?? null },
  })

  revalidatePath('/hoy/integrity')
  revalidatePath('/slt/analytics')
}

export async function closePatternCase(
  caseId: string,
  outcome: 'CLOSED_NO_ACTION' | 'CLOSED_ACTIONED',
  notes?: string,
  outcomeCategory?: string,
): Promise<void> {
  const user = await requireAuth(ALLOWED as unknown as string[])

  const existing = await prisma.integrityPatternCase.findUnique({
    where: { id: caseId },
    select: { schoolId: true },
  })
  if (!existing || existing.schoolId !== user.schoolId) return

  await prisma.integrityPatternCase.update({
    where: { id: caseId },
    data: {
      status:          outcome,
      closedAt:        new Date(),
      closedBy:        user.id,
      notes:           notes ?? null,
      outcomeCategory: outcomeCategory ?? null,
    },
  })

  revalidatePath('/hoy/integrity')
}

export async function escalatePatternCase(
  caseId: string,
  notes?: string,
): Promise<void> {
  const user = await requireAuth(ALLOWED as unknown as string[])

  const existing = await prisma.integrityPatternCase.findFirst({
    where: { id: caseId, schoolId: user.schoolId },
  })
  if (!existing) return

  await prisma.integrityPatternCase.update({
    where: { id: caseId },
    data: {
      status:         'ESCALATED',
      escalatedBy:    user.id,
      escalatedAt:    new Date(),
      escalatedNotes: notes ?? null,
    },
  })

  await writeAudit({
    schoolId:   user.schoolId,
    actorId:    user.id,
    action:     'INTEGRITY_CASE_ESCALATED',
    targetId:   caseId,
    targetType: 'IntegrityPatternCase',
    metadata:   { notes: notes ?? null },
  })

  // Notify all SLT users
  const sltUsers = await prisma.user.findMany({
    where: { schoolId: user.schoolId, role: 'SLT', isActive: true },
    select: { id: true },
  })

  // Resolve the student name
  const student = await prisma.user.findUnique({
    where: { id: existing.studentId },
    select: { firstName: true, lastName: true },
  })
  const studentName = student ? `${student.firstName} ${student.lastName}` : 'a student'
  const escalatedBy = `${user.firstName} ${user.lastName}`

  if (sltUsers.length > 0) {
    await prisma.notification.createMany({
      data: sltUsers.map(slt => ({
        schoolId: user.schoolId,
        userId:   slt.id,
        type:     'CONCERN_RAISED',
        title:    'Integrity case escalated to SLT',
        body:     `${escalatedBy} has escalated an academic integrity case for ${studentName} to SLT for review.${notes ? ` Note: ${notes}` : ''}`,
        linkHref: '/hoy/integrity',
      })),
      skipDuplicates: true,
    })
  }

  revalidatePath('/hoy/integrity')
}

export async function updatePatternCaseStatus(
  caseId: string,
  status: 'OPEN' | 'UNDER_REVIEW',
): Promise<void> {
  const user = await requireAuth(ALLOWED as unknown as string[])

  const existing = await prisma.integrityPatternCase.findUnique({
    where: { id: caseId },
    select: { schoolId: true },
  })
  if (!existing || existing.schoolId !== user.schoolId) return

  await prisma.integrityPatternCase.update({
    where: { id: caseId },
    data: { status, closedAt: null, closedBy: null },
  })

  revalidatePath('/hoy/integrity')
}
