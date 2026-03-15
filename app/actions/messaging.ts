'use server'
import { auth }           from '@/lib/auth'
import { prisma }         from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

function requireAuth() {
  return auth().then(s => {
    if (!s) throw new Error('Unauthenticated')
    return s.user as { id: string; schoolId: string; role: string }
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThreadSummary = {
  id:          string
  subject:     string
  context:     string | null
  isPrivate:   boolean
  updatedAt:   Date
  lastMessage: string | null
  lastSender:  string | null
  unreadCount: number
  participants: { id: string; firstName: string; lastName: string; avatarUrl: string | null }[]
}

export type ThreadDetail = {
  id:          string
  subject:     string
  context:     string | null
  contextId:   string | null
  isPrivate:   boolean
  createdAt:   Date
  participants: { id: string; firstName: string; lastName: string; role: string; avatarUrl: string | null }[]
  messages:    MessageRow[]
}

export type MessageRow = {
  id:         string
  senderId:   string
  senderName: string
  senderAvatar: string | null
  body:       string
  isSystem:   boolean
  sentAt:     Date
  editedAt:   Date | null
}

export type ContactGroup = {
  role:     string
  contacts: { id: string; firstName: string; lastName: string; role: string; avatarUrl: string | null; yearGroup: number | null }[]
}

// ── getMyThreads ──────────────────────────────────────────────────────────────

export async function getMyThreads(): Promise<ThreadSummary[]> {
  const user = await requireAuth()

  const participations = await prisma.msgParticipant.findMany({
    where:   { userId: user.id, isArchived: false },
    include: {
      thread: {
        include: {
          participants: {
            include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
          },
          messages: {
            orderBy: { sentAt: 'desc' },
            take:    1,
            include: { sender: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
    orderBy: { thread: { updatedAt: 'desc' } },
  })

  return participations.map(p => {
    const thread   = p.thread
    const last     = thread.messages[0]

    return {
      id:          thread.id,
      subject:     thread.subject,
      context:     thread.context,
      isPrivate:   thread.isPrivate,
      updatedAt:   thread.updatedAt,
      lastMessage: last ? last.body.slice(0, 80) : null,
      lastSender:  last ? `${last.sender.firstName} ${last.sender.lastName}` : null,
      unreadCount: 0,  // lightweight — unread loaded per-thread on open
      participants: thread.participants
        .filter(pt => pt.userId !== user.id)
        .map(pt => ({
          id:        pt.user.id,
          firstName: pt.user.firstName,
          lastName:  pt.user.lastName,
          avatarUrl: pt.user.avatarUrl,
        })),
    }
  })
}

// ── getThread ─────────────────────────────────────────────────────────────────

export async function getThread(threadId: string): Promise<ThreadDetail | null> {
  const user = await requireAuth()

  const participation = await prisma.msgParticipant.findUnique({
    where: { threadId_userId: { threadId, userId: user.id } },
  })
  if (!participation) return null

  const thread = await prisma.msgThread.findFirst({
    where:   { id: threadId, schoolId: user.schoolId },
    include: {
      participants: {
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } } },
      },
      messages: {
        include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
        orderBy: { sentAt: 'asc' },
      },
    },
  })
  if (!thread) return null

  // Mark as read
  await prisma.msgParticipant.update({
    where: { threadId_userId: { threadId, userId: user.id } },
    data:  { lastReadAt: new Date() },
  })

  return {
    id:          thread.id,
    subject:     thread.subject,
    context:     thread.context,
    contextId:   thread.contextId,
    isPrivate:   thread.isPrivate,
    createdAt:   thread.createdAt,
    participants: thread.participants.map(p => ({
      id:        p.user.id,
      firstName: p.user.firstName,
      lastName:  p.user.lastName,
      role:      p.user.role,
      avatarUrl: p.user.avatarUrl,
    })),
    messages: thread.messages.map(m => ({
      id:          m.id,
      senderId:    m.senderId,
      senderName:  `${m.sender.firstName} ${m.sender.lastName}`,
      senderAvatar: m.sender.avatarUrl,
      body:        m.body,
      isSystem:    m.isSystem,
      sentAt:      m.sentAt,
      editedAt:    m.editedAt,
    })),
  }
}

// ── createThread ──────────────────────────────────────────────────────────────

export async function createThread(data: {
  recipientIds: string[]
  subject:      string
  body:         string
  context?:     string
  contextId?:   string
  isPrivate?:   boolean
}): Promise<{ threadId: string }> {
  const user = await requireAuth()
  if (!data.subject.trim() || !data.body.trim()) throw new Error('Subject and message body required')
  if (data.recipientIds.length === 0) throw new Error('At least one recipient required')

  // Verify recipients are in same school
  const recipients = await prisma.user.findMany({
    where: { id: { in: data.recipientIds }, schoolId: user.schoolId },
    select: { id: true, role: true },
  })
  if (recipients.length !== data.recipientIds.length) throw new Error('Invalid recipients')

  // Role checks for STUDENT and PARENT
  if (user.role === 'STUDENT') {
    const classTeacherIds = await prisma.classTeacher.findMany({
      where: { class: { enrolments: { some: { userId: user.id } } } },
      select: { userId: true },
    }).then(rows => new Set(rows.map(r => r.userId)))
    const invalid = recipients.filter(r => !classTeacherIds.has(r.id))
    if (invalid.length > 0) throw new Error('Students can only message their class teachers')
  }

  if (user.role === 'PARENT') {
    const childLinks = await prisma.parentChildLink.findMany({
      where: { parentId: user.id },
      select: { childId: true },
    })
    const childIds = childLinks.map(c => c.childId)
    const teacherIds = await prisma.classTeacher.findMany({
      where: { class: { enrolments: { some: { userId: { in: childIds } } } } },
      select: { userId: true },
    }).then(rows => new Set(rows.map(r => r.userId)))
    const invalid = recipients.filter(r => !teacherIds.has(r.id))
    if (invalid.length > 0) throw new Error('Parents can only message their child\'s teachers')
  }

  const allParticipantIds = [user.id, ...data.recipientIds.filter(id => id !== user.id)]

  const thread = await prisma.msgThread.create({
    data: {
      schoolId:  user.schoolId,
      subject:   data.subject.trim(),
      context:   data.context ?? 'general',
      contextId: data.contextId ?? null,
      isPrivate: data.isPrivate ?? false,
      createdBy: user.id,
      participants: {
        create: allParticipantIds.map(uid => ({ userId: uid })),
      },
      messages: {
        create: {
          senderId: user.id,
          body:     data.body.trim(),
        },
      },
    },
  })

  // Notify recipients
  await prisma.notification.createMany({
    data: data.recipientIds.map(uid => ({
      schoolId:  user.schoolId,
      userId:    uid,
      type:      'new_message',
      title:     `New message: ${data.subject.slice(0, 60)}`,
      body:      data.body.slice(0, 120),
      linkHref:  `/messages?threadId=${thread.id}`,
    })),
    skipDuplicates: true,
  })

  revalidatePath('/messages')
  return { threadId: thread.id }
}

// ── sendMessage ───────────────────────────────────────────────────────────────

export async function sendMessage(threadId: string, body: string): Promise<MessageRow> {
  const user = await requireAuth()
  if (!body.trim()) throw new Error('Message body required')

  const participation = await prisma.msgParticipant.findUnique({
    where: { threadId_userId: { threadId, userId: user.id } },
  })
  if (!participation) throw new Error('Not a participant')

  const [message] = await prisma.$transaction([
    prisma.msgMessage.create({
      data:    { threadId, senderId: user.id, body: body.trim() },
      include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    }),
    prisma.msgThread.update({
      where: { id: threadId },
      data:  { updatedAt: new Date() },
    }),
    prisma.msgParticipant.update({
      where: { threadId_userId: { threadId, userId: user.id } },
      data:  { lastReadAt: new Date() },
    }),
  ])

  // Notify other participants
  const otherParticipants = await prisma.msgParticipant.findMany({
    where: { threadId, userId: { not: user.id } },
    select: { userId: true, thread: { select: { subject: true, schoolId: true } } },
  })
  if (otherParticipants.length > 0) {
    const { subject, schoolId } = otherParticipants[0].thread
    await prisma.notification.createMany({
      data: otherParticipants.map(p => ({
        schoolId,
        userId:   p.userId,
        type:     'new_message',
        title:    `New message in: ${subject.slice(0, 60)}`,
        body:     body.slice(0, 120),
        linkHref: `/messages?threadId=${threadId}`,
      })),
      skipDuplicates: true,
    })
  }

  revalidatePath('/messages')

  const m = message as any
  return {
    id:          m.id,
    senderId:    m.senderId,
    senderName:  `${m.sender.firstName} ${m.sender.lastName}`,
    senderAvatar: m.sender.avatarUrl,
    body:        m.body,
    isSystem:    m.isSystem,
    sentAt:      m.sentAt,
    editedAt:    m.editedAt,
  }
}

// ── archiveThread ─────────────────────────────────────────────────────────────

export async function archiveThread(threadId: string): Promise<void> {
  const user = await requireAuth()
  await prisma.msgParticipant.update({
    where: { threadId_userId: { threadId, userId: user.id } },
    data:  { isArchived: true },
  })
  revalidatePath('/messages')
}

// ── getUnreadMessageCount ─────────────────────────────────────────────────────

export async function getUnreadMessageCount(): Promise<number> {
  const user = await requireAuth()

  const participations = await prisma.msgParticipant.findMany({
    where:   { userId: user.id, isArchived: false },
    include: {
      thread: {
        include: {
          messages: {
            where:   { senderId: { not: user.id } },
            orderBy: { sentAt: 'desc' },
            take:    1,
            select:  { sentAt: true },
          },
        },
      },
    },
  })

  let count = 0
  for (const p of participations) {
    const latestMsg = p.thread.messages[0]
    if (latestMsg && (!p.lastReadAt || latestMsg.sentAt > p.lastReadAt)) {
      count++
    }
  }
  return count
}

// ── getContactList ────────────────────────────────────────────────────────────

export async function getContactList(): Promise<ContactGroup[]> {
  const user = await requireAuth()

  let contacts: { id: string; firstName: string; lastName: string; role: string; avatarUrl: string | null; yearGroup: number | null }[] = []

  if (user.role === 'STUDENT') {
    // Only own class teachers
    const rows = await prisma.classTeacher.findMany({
      where:   { class: { enrolments: { some: { userId: user.id } } } },
      include: { user: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true, yearGroup: true } } },
    })
    contacts = rows.map(r => ({ ...r.user, role: r.user.role }))
  } else if (user.role === 'PARENT') {
    // Own child's teachers
    const childLinks = await prisma.parentChildLink.findMany({
      where: { parentId: user.id },
      select: { childId: true },
    })
    const childIds = childLinks.map(c => c.childId)
    const rows = await prisma.classTeacher.findMany({
      where:   { class: { enrolments: { some: { userId: { in: childIds } } } } },
      include: { user: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true, yearGroup: true } } },
    })
    // Deduplicate
    const seen = new Set<string>()
    contacts = rows
      .filter(r => { if (seen.has(r.user.id)) return false; seen.add(r.user.id); return true })
      .map(r => ({ ...r.user, role: r.user.role }))
  } else {
    // Staff: all users in school except self
    const users = await prisma.user.findMany({
      where:   { schoolId: user.schoolId, isActive: true, id: { not: user.id } },
      select:  { id: true, firstName: true, lastName: true, role: true, avatarUrl: true, yearGroup: true },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
      take:    500,
    })
    contacts = users
  }

  // Group by role
  const grouped: Record<string, typeof contacts> = {}
  for (const c of contacts) {
    const key = c.role
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(c)
  }

  return Object.entries(grouped).map(([role, list]) => ({ role, contacts: list }))
}

// ── Platform notifications (with linkHref for deep-linking) ───────────────────

export type PlatformNotificationRow = {
  id:        string
  type:      string
  title:     string
  body:      string
  read:      boolean
  linkHref:  string | null
  createdAt: Date
}

export async function getMyPlatformNotifications(): Promise<PlatformNotificationRow[]> {
  const user = await requireAuth()
  return prisma.notification.findMany({
    where:   { userId: user.id, schoolId: user.schoolId },
    orderBy: { createdAt: 'desc' },
    take:    30,
  })
}

export async function markPlatformNotificationRead(id: string): Promise<void> {
  const user = await requireAuth()
  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data:  { read: true },
  })
}

export async function markAllPlatformNotificationsRead(): Promise<void> {
  const user = await requireAuth()
  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data:  { read: true },
  })
}
