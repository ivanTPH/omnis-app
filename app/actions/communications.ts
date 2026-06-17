'use server'

import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { sendSchoolCommunicationEmail } from '@/lib/email'

const STAFF_ROLES = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'COVER_MANAGER']
const ADMIN_ROLES = ['HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT']

export type CommunicationRow = {
  id:            string
  title:         string
  body:          string
  recipientScope: string
  yearGroup:     number | null
  sentCount:     number
  readCount:     number
  authorName:    string
  createdAt:     string
}

export type ParentCommunicationRow = {
  id:          string
  title:       string
  body:        string
  authorName:  string
  readAt:      string | null
  createdAt:   string
}

// ── Send a communication ───────────────────────────────────────────────────────

export async function sendCommunication(data: {
  title:          string
  body:           string
  recipientScope: string   // 'ALL_PARENTS' | 'YEAR_N' | 'CLASS_ID'
  yearGroup?:     number
  classId?:       string
  sendEmail:      boolean
}): Promise<{ ok: boolean; error?: string; sentCount?: number }> {
  const user = await requireAuth()
  if (!ADMIN_ROLES.includes(user.role)) return { ok: false, error: 'Forbidden' }

  // Resolve recipient parent User IDs
  let parentIds: string[] = []

  if (data.recipientScope === 'ALL_PARENTS') {
    const parents = await prisma.user.findMany({
      where: { schoolId: user.schoolId, role: 'PARENT', isActive: true },
      select: { id: true },
    })
    parentIds = parents.map(p => p.id)
  } else if (data.recipientScope.startsWith('YEAR_') && data.yearGroup) {
    const links = await prisma.parentChildLink.findMany({
      where: { child: { schoolId: user.schoolId, yearGroup: data.yearGroup } },
      select: { parentId: true },
    })
    parentIds = [...new Set(links.map(l => l.parentId))]
  } else if (data.recipientScope.startsWith('CLASS_') && data.classId) {
    const enrolments = await prisma.enrolment.findMany({
      where: { classId: data.classId },
      select: { userId: true },
    })
    const studentIds = enrolments.map(e => e.userId)
    const links = await prisma.parentChildLink.findMany({
      where: { childId: { in: studentIds } },
      select: { parentId: true },
    })
    parentIds = [...new Set(links.map(l => l.parentId))]
  }

  if (parentIds.length === 0) return { ok: false, error: 'No recipients found' }

  const comm = await prisma.schoolCommunication.create({
    data: {
      schoolId:       user.schoolId,
      authorId:       user.id,
      title:          data.title,
      body:           data.body,
      recipientScope: data.recipientScope,
      yearGroup:      data.yearGroup ?? null,
      classId:        data.classId ?? null,
    },
  })

  await prisma.communicationReceipt.createMany({
    data: parentIds.map(parentId => ({
      communicationId: comm.id,
      parentId,
    })),
    skipDuplicates: true,
  })

  if (data.sendEmail) {
    const parentUsers = await prisma.user.findMany({
      where: { id: { in: parentIds }, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    await Promise.allSettled(
      parentUsers.map(p =>
        sendSchoolCommunicationEmail({
          to:         p.email,
          parentName: `${p.firstName} ${p.lastName}`,
          subject:    data.title,
          body:       data.body,
          schoolName: user.schoolName,
        }),
      ),
    )
  }

  await writeAudit({
    schoolId:   user.schoolId,
    actorId:    user.id,
    action:     'COMMUNICATION_SENT',
    targetType: 'SchoolCommunication',
    targetId:   comm.id,
    metadata:   { title: data.title, sentCount: parentIds.length },
  })

  revalidatePath('/admin/communications')
  return { ok: true, sentCount: parentIds.length }
}

// ── School communication log (staff view) ─────────────────────────────────────

export async function getCommunicationLog(): Promise<CommunicationRow[]> {
  const user = await requireAuth()
  if (!STAFF_ROLES.includes(user.role)) return []

  const comms = await prisma.schoolCommunication.findMany({
    where: { schoolId: user.schoolId },
    select: {
      id: true, title: true, body: true, recipientScope: true, yearGroup: true, createdAt: true,
      author:   { select: { firstName: true, lastName: true } },
      receipts: { select: { id: true, readAt: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return comms.map(c => ({
    id:             c.id,
    title:          c.title,
    body:           c.body,
    recipientScope: c.recipientScope,
    yearGroup:      c.yearGroup,
    sentCount:      c.receipts.length,
    readCount:      c.receipts.filter(r => r.readAt != null).length,
    authorName:     `${c.author.firstName} ${c.author.lastName}`,
    createdAt:      c.createdAt.toISOString(),
  }))
}

// ── Parent inbox ───────────────────────────────────────────────────────────────

export async function getParentCommunications(): Promise<ParentCommunicationRow[]> {
  const user = await requireAuth()

  const receipts = await prisma.communicationReceipt.findMany({
    where: { parentId: user.id },
    select: {
      readAt: true,
      communication: {
        select: {
          id: true, title: true, body: true, createdAt: true,
          author: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { communication: { createdAt: 'desc' } },
  })

  return receipts.map(r => ({
    id:         r.communication.id,
    title:      r.communication.title,
    body:       r.communication.body,
    authorName: `${r.communication.author.firstName} ${r.communication.author.lastName}`,
    readAt:     r.readAt?.toISOString() ?? null,
    createdAt:  r.communication.createdAt.toISOString(),
  }))
}

// ── Mark communication as read ─────────────────────────────────────────────────

export async function markCommunicationRead(communicationId: string): Promise<void> {
  const user = await requireAuth()

  await prisma.communicationReceipt.updateMany({
    where: { communicationId, parentId: user.id, readAt: null },
    data:  { readAt: new Date() },
  })
}

// ── Unread count for badge ──────────────────────────────────────────────────────

export async function getUnreadCommunicationsCount(): Promise<number> {
  const user = await requireAuth()
  return prisma.communicationReceipt.count({
    where: { parentId: user.id, readAt: null },
  })
}

// ── Per-communication recipient list (staff view) ──────────────────────────────

export type CommunicationRecipientRow = {
  parentId:   string
  parentName: string
  email:      string
  readAt:     string | null
}

export async function getCommunicationRecipients(
  communicationId: string,
): Promise<CommunicationRecipientRow[]> {
  const user = await requireAuth()
  if (!ADMIN_ROLES.includes(user.role)) return []

  const receipts = await prisma.communicationReceipt.findMany({
    where: {
      communicationId,
      communication: { schoolId: user.schoolId },
    },
    select: {
      readAt: true,
      parent: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { readAt: 'asc' },
  })

  return receipts.map(r => ({
    parentId:   r.parent.id,
    parentName: `${r.parent.firstName} ${r.parent.lastName}`,
    email:      r.parent.email,
    readAt:     r.readAt?.toISOString() ?? null,
  }))
}
