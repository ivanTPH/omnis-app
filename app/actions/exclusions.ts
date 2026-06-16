'use server'

import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

const VIEW_ROLES = ['HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT']

export type ExclusionRow = {
  id:                string
  studentId:         string
  studentName:       string
  yearGroup:         number | null
  sendStatus:        string | null
  type:              string
  reason:            string
  startDate:         string
  endDate:           string | null
  daysCount:         number
  status:            string
  reintegrationPlan: string | null
  parentContacted:   boolean
  notes:             string | null
  authorName:        string
  createdAt:         string
}

// ── Log exclusion ─────────────────────────────────────────────────────────────

export async function logExclusion(data: {
  studentId:         string
  type:              string
  reason:            string
  startDate:         string
  endDate?:          string
  daysCount:         number
  reintegrationPlan?: string
  notes?:            string
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth()
  if (!VIEW_ROLES.includes(user.role)) return { ok: false, error: 'Forbidden' }

  const student = await prisma.user.findFirst({
    where:  { id: data.studentId, schoolId: user.schoolId, role: 'STUDENT' },
    select: { id: true },
  })
  if (!student) return { ok: false, error: 'Student not found' }

  await prisma.exclusion.create({
    data: {
      schoolId:          user.schoolId,
      studentId:         data.studentId,
      authorId:          user.id,
      type:              data.type,
      reason:            data.reason,
      startDate:         new Date(data.startDate),
      endDate:           data.endDate ? new Date(data.endDate) : null,
      daysCount:         data.daysCount,
      reintegrationPlan: data.reintegrationPlan ?? null,
      notes:             data.notes ?? null,
    },
  })

  await writeAudit({
    schoolId:   user.schoolId,
    actorId:    user.id,
    action:     'EXCLUSION_LOGGED',
    targetType: 'Exclusion',
    targetId:   data.studentId,
    metadata:   { type: data.type, startDate: data.startDate },
  })

  // Update hasExclusion flag on student profile
  await prisma.user.update({
    where: { id: data.studentId },
    data:  { hasExclusion: true },
  })

  revalidatePath('/hoy/exclusions')
  revalidatePath(`/students/${data.studentId}`)
  return { ok: true }
}

// ── Resolve exclusion ─────────────────────────────────────────────────────────

export async function resolveExclusion(
  exclusionId: string,
  data: { status: string; reintegrationPlan?: string; parentContacted?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth()
  if (!VIEW_ROLES.includes(user.role)) return { ok: false, error: 'Forbidden' }

  const excl = await prisma.exclusion.findFirst({
    where:  { id: exclusionId, schoolId: user.schoolId },
    select: { id: true, studentId: true },
  })
  if (!excl) return { ok: false, error: 'Not found' }

  await prisma.exclusion.update({
    where: { id: exclusionId },
    data: {
      status:            data.status,
      reintegrationPlan: data.reintegrationPlan,
      parentContacted:   data.parentContacted,
    },
  })

  await writeAudit({
    schoolId:   user.schoolId,
    actorId:    user.id,
    action:     'EXCLUSION_RESOLVED',
    targetType: 'Exclusion',
    targetId:   excl.studentId,
    metadata:   { exclusionId, status: data.status },
  })

  revalidatePath('/hoy/exclusions')
  revalidatePath(`/students/${excl.studentId}`)
  return { ok: true }
}

// ── Get exclusion log ─────────────────────────────────────────────────────────

export type ExclusionStats = {
  total:     number
  active:    number
  fixedTerm: number
  internal:  number
  permanent: number
}

export type ExclusionLog = {
  stats:   ExclusionStats
  active:  ExclusionRow[]
  recent:  ExclusionRow[]
}

function mapExclusion(e: {
  id: string; type: string; reason: string; startDate: Date; endDate: Date | null
  daysCount: number; status: string; reintegrationPlan: string | null
  parentContacted: boolean; notes: string | null; createdAt: Date
  student: { id: string; firstName: string; lastName: string; yearGroup: number | null }
  author:  { firstName: string; lastName: string }
  sendStatus?: { activeStatus: string } | null
}): ExclusionRow {
  return {
    id:                e.id,
    studentId:         e.student.id,
    studentName:       `${e.student.firstName} ${e.student.lastName}`,
    yearGroup:         e.student.yearGroup,
    sendStatus:        e.sendStatus?.activeStatus ?? null,
    type:              e.type,
    reason:            e.reason,
    startDate:         e.startDate.toISOString(),
    endDate:           e.endDate?.toISOString() ?? null,
    daysCount:         e.daysCount,
    status:            e.status,
    reintegrationPlan: e.reintegrationPlan,
    parentContacted:   e.parentContacted,
    notes:             e.notes,
    authorName:        `${e.author.firstName} ${e.author.lastName}`,
    createdAt:         e.createdAt.toISOString(),
  }
}

export async function getExclusionLog(yearGroup?: number): Promise<ExclusionLog> {
  const user = await requireAuth()
  if (!VIEW_ROLES.includes(user.role)) redirect('/dashboard')

  const yearFilter = yearGroup ? { yearGroup } : {}
  const termStart  = new Date()
  termStart.setMonth(termStart.getMonth() - 3)

  const sel = {
    id: true, type: true, reason: true, startDate: true, endDate: true,
    daysCount: true, status: true, reintegrationPlan: true,
    parentContacted: true, notes: true, createdAt: true,
    student: { select: { id: true, firstName: true, lastName: true, yearGroup: true } },
    author:  { select: { firstName: true, lastName: true } },
  } as const

  const [active, recent] = await Promise.all([
    prisma.exclusion.findMany({
      where:   { schoolId: user.schoolId, status: 'active', student: yearFilter },
      select:  sel,
      orderBy: { startDate: 'desc' },
    }),
    prisma.exclusion.findMany({
      where:   { schoolId: user.schoolId, status: { not: 'active' }, startDate: { gte: termStart }, student: yearFilter },
      select:  sel,
      orderBy: { startDate: 'desc' },
      take:    100,
    }),
  ])

  const allRows = [...active, ...recent]
  return {
    stats: {
      total:     allRows.length,
      active:    active.length,
      fixedTerm: allRows.filter(e => e.type === 'fixed_term').length,
      internal:  allRows.filter(e => e.type === 'internal').length,
      permanent: allRows.filter(e => e.type === 'permanent').length,
    },
    active: active.map(e => mapExclusion(e)),
    recent: recent.map(e => mapExclusion(e)),
  }
}

// ── Get student exclusions ────────────────────────────────────────────────────

export async function getStudentExclusions(studentId: string): Promise<ExclusionRow[]> {
  const user = await requireAuth()
  if (!VIEW_ROLES.includes(user.role)) redirect('/dashboard')

  const rows = await prisma.exclusion.findMany({
    where:   { studentId, schoolId: user.schoolId },
    select:  {
      id: true, type: true, reason: true, startDate: true, endDate: true,
      daysCount: true, status: true, reintegrationPlan: true,
      parentContacted: true, notes: true, createdAt: true,
      student: { select: { id: true, firstName: true, lastName: true, yearGroup: true } },
      author:  { select: { firstName: true, lastName: true } },
    },
    orderBy: { startDate: 'desc' },
  })
  return rows.map(e => mapExclusion(e))
}
