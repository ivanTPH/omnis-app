'use server'

import { auth } from '@/lib/auth'
import { prisma, writeAudit } from '@/lib/prisma'

// ── Types ──────────────────────────────────────────────────────────────────────

export type QuickNote = {
  id:         string
  content:    string
  createdAt:  string
  authorName: string
}

export type ContactParent = {
  firstName:       string
  lastName:        string
  email:           string | null
  phone:           string | null
  relationship:    string
  hasParentalResp: boolean
}

export type StudentContactData = {
  id:         string
  firstName:  string
  lastName:   string
  yearGroup:  number | null
  email:      string
  phone:      string | null
  avatarUrl:  string | null
  sendStatus: string | null   // 'SEN_SUPPORT' | 'EHCP' | null
  hasIlp:     boolean
  ilpStudentId: string        // for /send/ilp/[studentId] link
  hasEhcp:    boolean
  ehcpId:     string | null
  parents:    ContactParent[]
  quickNotes: QuickNote[]
}

// ── getStudentContactData ──────────────────────────────────────────────────────

export async function getStudentContactData(studentId: string): Promise<StudentContactData | null> {
  const session = await auth()
  if (!session) return null
  const { schoolId } = session.user as any

  // 1. Core student data + independent queries in parallel
  const [user, sendStatus, ilp, ehcp, quickNotes, parentLinks] = await Promise.all([
    prisma.user.findFirst({
      where:  { id: studentId, schoolId },
      select: {
        id: true, firstName: true, lastName: true, yearGroup: true, email: true, avatarUrl: true,
        settings: { select: { phone: true, profilePictureUrl: true } },
      },
    }),
    prisma.sendStatus.findFirst({
      where:  { studentId },
      select: { activeStatus: true },
    }),
    prisma.individualLearningPlan.findFirst({
      where:   { studentId, schoolId, status: { in: ['active', 'under_review'] } },
      select:  { id: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ehcpPlan.findFirst({
      where:   { studentId, schoolId, status: { in: ['active', 'under_review'] } },
      select:  { id: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.studentQuickNote.findMany({
      where:   { studentId, schoolId },
      orderBy: { createdAt: 'desc' },
      take:    10,
      include: { author: { select: { firstName: true, lastName: true } } },
    }),
    prisma.parentChildLink.findMany({
      where:   { childId: studentId },
      include: {
        parent: {
          select: {
            firstName: true, lastName: true, email: true,
            settings: { select: { phone: true } },
          },
        },
      },
    }),
  ])

  if (!user) return null

  // 2. Wonde contacts (name-matched lookup — separate query after user is known)
  const wondeStudent = await prisma.wondeStudent.findFirst({
    where:   { schoolId, firstName: user.firstName, lastName: user.lastName, isLeaver: false },
    include: {
      contacts: {
        orderBy: { parentalResponsibility: 'desc' },
      },
    },
  })

  // 3. Build parent list — prefer Wonde (richer phone/email), fall back to ParentChildLink
  let parents: ContactParent[] = []
  if (wondeStudent && wondeStudent.contacts.length > 0) {
    parents = wondeStudent.contacts.map(c => ({
      firstName:       c.firstName,
      lastName:        c.lastName,
      email:           c.email,
      phone:           c.phone,
      relationship:    c.relationship ?? 'Contact',
      hasParentalResp: c.parentalResponsibility,
    }))
  } else if (parentLinks.length > 0) {
    parents = parentLinks.map(pl => ({
      firstName:       pl.parent.firstName,
      lastName:        pl.parent.lastName,
      email:           pl.parent.email,
      phone:           pl.parent.settings?.phone ?? null,
      relationship:    pl.relationshipType ?? 'Guardian',
      hasParentalResp: true,
    }))
  }

  const activeSend = sendStatus?.activeStatus
  const sendStatusValue = (!activeSend || activeSend === 'NONE') ? null : activeSend

  return {
    id:          user.id,
    firstName:   user.firstName,
    lastName:    user.lastName,
    yearGroup:   user.yearGroup,
    email:       user.email,
    phone:       user.settings?.phone ?? null,
    avatarUrl:   user.settings?.profilePictureUrl ?? user.avatarUrl ?? null,
    sendStatus:  sendStatusValue,
    hasIlp:      !!ilp,
    ilpStudentId: studentId,
    hasEhcp:     !!ehcp,
    ehcpId:      ehcp?.id ?? null,
    parents,
    quickNotes: quickNotes.map(n => ({
      id:         n.id,
      content:    n.content,
      createdAt:  n.createdAt.toISOString(),
      authorName: `${n.author.firstName} ${n.author.lastName}`,
    })),
  }
}

// ── saveStudentQuickNote ───────────────────────────────────────────────────────

export async function saveStudentQuickNote(studentId: string, content: string): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: authorId } = session.user as any

  const trimmed = content.trim()
  if (!trimmed) return

  await prisma.studentQuickNote.create({
    data: { studentId, schoolId, authorId, content: trimmed },
  })

  await writeAudit({
    schoolId,
    actorId:    authorId,
    action:     'USER_SETTINGS_CHANGED',
    targetType: 'StudentQuickNote',
    targetId:   studentId,
    metadata:   { content: trimmed.slice(0, 100) },
  })
}
