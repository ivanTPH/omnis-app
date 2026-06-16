'use server'

import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sendDetentionNotificationEmail } from '@/lib/email'

const STAFF_ROLES = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'COVER_MANAGER']
const VIEW_ROLES  = ['HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT']

export type DetentionRow = {
  id:             string
  studentId:      string
  studentName:    string
  yearGroup:      number | null
  type:           string
  reason:         string
  scheduledAt:    string
  durationMins:   number
  location:       string | null
  status:         string
  parentNotified: boolean
  notes:          string | null
  authorName:     string
  createdAt:      string
}

// ── Log detention ─────────────────────────────────────────────────────────────

export async function logDetention(data: {
  studentId:    string
  type:         string
  reason:       string
  scheduledAt:  string
  durationMins: number
  location?:    string
  notes?:       string
  notifyParent: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth()
  if (!STAFF_ROLES.includes(user.role)) return { ok: false, error: 'Forbidden' }

  const student = await prisma.user.findFirst({
    where:  { id: data.studentId, schoolId: user.schoolId, role: 'STUDENT' },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!student) return { ok: false, error: 'Student not found' }

  const detention = await prisma.detention.create({
    data: {
      schoolId:       user.schoolId,
      studentId:      data.studentId,
      authorId:       user.id,
      type:           data.type,
      reason:         data.reason,
      scheduledAt:    new Date(data.scheduledAt),
      durationMins:   data.durationMins,
      location:       data.location ?? null,
      notes:          data.notes ?? null,
      parentNotified: false,
    },
  })

  await writeAudit({
    schoolId:   user.schoolId,
    actorId:    user.id,
    action:     'DETENTION_LOGGED',
    targetType: 'Detention',
    targetId:   data.studentId,
    metadata:   { type: data.type, scheduledAt: data.scheduledAt },
  })

  // Notify parent fire-and-forget
  if (data.notifyParent) {
    const links = await prisma.parentStudentLink.findMany({
      where:  { studentId: data.studentId },
      select: { parent: { select: { email: true, firstName: true } } },
    })
    const school = await prisma.school.findUnique({
      where:  { id: user.schoolId },
      select: { name: true },
    })
    void Promise.allSettled(
      links.map(l =>
        sendDetentionNotificationEmail({
          to:          l.parent.email ?? '',
          parentName:  l.parent.firstName,
          studentName: `${student.firstName} ${student.lastName}`,
          type:        data.type,
          reason:      data.reason,
          scheduledAt: new Date(data.scheduledAt),
          durationMins: data.durationMins,
          location:    data.location ?? null,
          schoolName:  school?.name ?? 'School',
        })
      )
    ).then(() =>
      prisma.detention.update({
        where: { id: detention.id },
        data:  { parentNotified: true },
      })
    )
  }

  revalidatePath('/hoy/detentions')
  revalidatePath(`/students/${data.studentId}`)
  return { ok: true }
}

// ── Resolve detention ─────────────────────────────────────────────────────────

export async function resolveDetention(
  detentionId: string,
  status: 'attended' | 'missed' | 'cancelled'
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth()
  if (!VIEW_ROLES.includes(user.role)) return { ok: false, error: 'Forbidden' }

  const det = await prisma.detention.findFirst({
    where:  { id: detentionId, schoolId: user.schoolId },
    select: { id: true, studentId: true },
  })
  if (!det) return { ok: false, error: 'Not found' }

  await prisma.detention.update({
    where: { id: detentionId },
    data:  { status },
  })

  await writeAudit({
    schoolId:   user.schoolId,
    actorId:    user.id,
    action:     'DETENTION_RESOLVED',
    targetType: 'Detention',
    targetId:   det.studentId,
    metadata:   { detentionId, status },
  })

  revalidatePath('/hoy/detentions')
  revalidatePath(`/students/${det.studentId}`)
  return { ok: true }
}

// ── Delete detention ──────────────────────────────────────────────────────────

export async function deleteDetention(detentionId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth()
  if (!VIEW_ROLES.includes(user.role)) return { ok: false, error: 'Forbidden' }

  const det = await prisma.detention.findFirst({
    where:  { id: detentionId, schoolId: user.schoolId },
    select: { id: true, studentId: true, authorId: true },
  })
  if (!det) return { ok: false, error: 'Not found' }

  const canDelete = det.authorId === user.id || ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN'].includes(user.role)
  if (!canDelete) return { ok: false, error: 'Forbidden' }

  await prisma.detention.delete({ where: { id: detentionId } })

  revalidatePath('/hoy/detentions')
  revalidatePath(`/students/${det.studentId}`)
  return { ok: true }
}

// ── Get detention register ────────────────────────────────────────────────────

export type DetentionRegister = {
  upcoming:   DetentionRow[]
  today:      DetentionRow[]
  missed:     DetentionRow[]
  pastWeek:   DetentionRow[]
}

function mapRow(d: {
  id: string; type: string; reason: string; scheduledAt: Date; durationMins: number
  location: string | null; status: string; parentNotified: boolean; notes: string | null; createdAt: Date
  student: { id: string; firstName: string; lastName: string; yearGroup: number | null }
  author:  { firstName: string; lastName: string }
}): DetentionRow {
  return {
    id:             d.id,
    studentId:      d.student.id,
    studentName:    `${d.student.firstName} ${d.student.lastName}`,
    yearGroup:      d.student.yearGroup,
    type:           d.type,
    reason:         d.reason,
    scheduledAt:    d.scheduledAt.toISOString(),
    durationMins:   d.durationMins,
    location:       d.location,
    status:         d.status,
    parentNotified: d.parentNotified,
    notes:          d.notes,
    authorName:     `${d.author.firstName} ${d.author.lastName}`,
    createdAt:      d.createdAt.toISOString(),
  }
}

export async function getDetentionRegister(yearGroup?: number): Promise<DetentionRegister> {
  const user = await requireAuth()
  if (!VIEW_ROLES.includes(user.role)) redirect('/dashboard')

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)
  const weekAgo    = new Date(Date.now() - 7 * 24 * 3600_000)

  const yearFilter = yearGroup ? { yearGroup } : {}

  const sel = {
    id: true, type: true, reason: true, scheduledAt: true, durationMins: true,
    location: true, status: true, parentNotified: true, notes: true, createdAt: true,
    student: { select: { id: true, firstName: true, lastName: true, yearGroup: true } },
    author:  { select: { firstName: true, lastName: true } },
  } as const

  const [upcoming, today, missed, pastWeek] = await Promise.all([
    prisma.detention.findMany({
      where:   { schoolId: user.schoolId, status: 'scheduled', scheduledAt: { gt: todayEnd }, student: yearFilter },
      select:  sel,
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.detention.findMany({
      where:   { schoolId: user.schoolId, status: { in: ['scheduled', 'attended'] }, scheduledAt: { gte: todayStart, lte: todayEnd }, student: yearFilter },
      select:  sel,
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.detention.findMany({
      where:   { schoolId: user.schoolId, status: 'missed', student: yearFilter },
      select:  sel,
      orderBy: { scheduledAt: 'desc' },
      take:    30,
    }),
    prisma.detention.findMany({
      where:   { schoolId: user.schoolId, status: { in: ['attended', 'cancelled'] }, scheduledAt: { gte: weekAgo, lt: todayStart }, student: yearFilter },
      select:  sel,
      orderBy: { scheduledAt: 'desc' },
      take:    50,
    }),
  ])

  return {
    upcoming: upcoming.map(mapRow),
    today:    today.map(mapRow),
    missed:   missed.map(mapRow),
    pastWeek: pastWeek.map(mapRow),
  }
}

// ── Get student detentions ─────────────────────────────────────────────────────

export async function getStudentDetentions(studentId: string): Promise<DetentionRow[]> {
  const user = await requireAuth()
  if (!STAFF_ROLES.includes(user.role)) redirect('/dashboard')

  const rows = await prisma.detention.findMany({
    where:   { studentId, schoolId: user.schoolId },
    select:  {
      id: true, type: true, reason: true, scheduledAt: true, durationMins: true,
      location: true, status: true, parentNotified: true, notes: true, createdAt: true,
      student: { select: { id: true, firstName: true, lastName: true, yearGroup: true } },
      author:  { select: { firstName: true, lastName: true } },
    },
    orderBy: { scheduledAt: 'desc' },
  })
  return rows.map(mapRow)
}
