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
      status:   outcome,
      closedAt: new Date(),
      closedBy: user.id,
      notes:    notes ?? null,
    },
  })

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
