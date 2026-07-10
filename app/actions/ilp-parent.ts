'use server'

import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ── Parent: acknowledge ILP + optional home progress note + meeting request ──

export async function acknowledgeIlp(
  ilpId: string,
  homeProgress?: string,
  meetingRequested?: boolean,
  meetingNote?: string,
) {
  const { id: parentId, schoolId, role } = await requireAuth()
  if (role !== 'PARENT') throw new Error('Forbidden')

  // Verify the ILP belongs to a child of this parent
  const ilp = await prisma.individualLearningPlan.findFirst({
    where: { id: ilpId, schoolId, status: { in: ['active', 'under_review'] } },
    select: { id: true, studentId: true, approvedBySenco: true },
  })
  if (!ilp) throw new Error('ILP not found')

  const link = await prisma.parentStudentLink.findFirst({
    where: { parentId, studentId: ilp.studentId },
  })
  if (!link) throw new Error('Not your child')

  await (prisma.ilpParentResponse as any).upsert({
    where:  { ilpId_parentId: { ilpId, parentId } },
    update: {
      reviewedAt:       new Date(),
      homeProgress:     homeProgress?.trim() || null,
      meetingRequested: meetingRequested ?? false,
      meetingNote:      meetingNote?.trim() || null,
    },
    create: {
      ilpId,
      schoolId,
      parentId,
      studentId:        ilp.studentId,
      homeProgress:     homeProgress?.trim() || null,
      meetingRequested: meetingRequested ?? false,
      meetingNote:      meetingNote?.trim() || null,
    },
  })

  void writeAudit({
    schoolId,
    actorId:    parentId,
    action:     'ILP_PARENT_ACKNOWLEDGED',
    targetType: 'ILP',
    targetId:   ilpId,
    metadata:   { studentId: ilp.studentId, meetingRequested: meetingRequested ?? false },
  }).catch(() => {})

  if (meetingRequested) {
    void writeAudit({
      schoolId,
      actorId:    parentId,
      action:     'SENCO_MEETING_REQUESTED',
      targetType: 'ILP',
      targetId:   ilpId,
      metadata:   { studentId: ilp.studentId, note: meetingNote?.trim() || null },
    }).catch(() => {})

    // Notify SENCO users in this school
    const sencos = await prisma.user.findMany({
      where: { schoolId, role: 'SENCO', isActive: true },
      select: { id: true },
    })
    if (sencos.length > 0) {
      const parent = await prisma.user.findUnique({
        where:  { id: parentId },
        select: { firstName: true, lastName: true },
      })
      const student = await prisma.user.findUnique({
        where:  { id: ilp.studentId },
        select: { firstName: true, lastName: true },
      })
      await prisma.sendNotification.createMany({
        data: sencos.map(s => ({
          schoolId,
          recipientId: s.id,
          type:        'senco_meeting_requested',
          title:       `Meeting requested by ${parent?.firstName ?? 'Parent'} ${parent?.lastName ?? ''} re: ${student?.firstName ?? ''} ${student?.lastName ?? ''}`,
          body:        meetingNote?.trim() || 'Parent has requested a meeting to discuss the ILP.',
          link:        `/senco/ilp`,
        })),
        skipDuplicates: true,
      })
    }
  }

  revalidatePath('/parent/progress')
}

// ── SENCO: read parent responses for an ILP ──────────────────────────────────

export type IlpParentResponseData = {
  parentId:         string
  parentName:       string
  reviewedAt:       Date
  homeProgress:     string | null
  meetingRequested: boolean
  meetingNote:      string | null
}

export async function getIlpParentResponses(ilpId: string): Promise<IlpParentResponseData[]> {
  const { schoolId, role } = await requireAuth()
  const allowed = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR', 'PLATFORM_ADMIN']
  if (!allowed.includes(role)) return []

  const rows = await (prisma.ilpParentResponse as any).findMany({
    where:   { ilpId, schoolId },
    orderBy: { reviewedAt: 'desc' },
  }) as Array<{
    parentId: string; reviewedAt: Date
    homeProgress: string | null; meetingRequested: boolean; meetingNote: string | null
  }>

  const parentIds = [...new Set(rows.map(r => r.parentId))]
  const parents   = await prisma.user.findMany({
    where:  { id: { in: parentIds } },
    select: { id: true, firstName: true, lastName: true },
  })
  const parentMap = Object.fromEntries(parents.map(p => [p.id, `${p.firstName} ${p.lastName}`]))

  return rows.map(r => ({
    parentId:         r.parentId,
    parentName:       parentMap[r.parentId] ?? 'Parent',
    reviewedAt:       r.reviewedAt,
    homeProgress:     r.homeProgress,
    meetingRequested: r.meetingRequested,
    meetingNote:      r.meetingNote,
  }))
}

// ── Check whether parent has acknowledged a specific ILP ─────────────────────

export async function getMyIlpResponse(ilpId: string): Promise<{
  acknowledged: boolean
  reviewedAt:   Date | null
  meetingRequested: boolean
} | null> {
  const { id: parentId, role } = await requireAuth()
  if (role !== 'PARENT') return null

  const row = await (prisma.ilpParentResponse as any).findUnique({
    where: { ilpId_parentId: { ilpId, parentId } },
  })

  return {
    acknowledged:     !!row,
    reviewedAt:       row?.reviewedAt ?? null,
    meetingRequested: row?.meetingRequested ?? false,
  }
}
