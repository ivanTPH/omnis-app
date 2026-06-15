'use server'

import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

const STAFF_ROLES = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'COVER_MANAGER']
const VIEW_ROLES  = ['HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT']

export type BehaviourRecordRow = {
  id:          string
  type:        string   // 'positive' | 'negative' | 'neutral'
  category:    string
  description: string
  points:      number
  recordDate:  string
  authorName:  string
}

export type StudentBehaviourSummary = {
  studentId:        string
  studentName:      string
  yearGroup:        number | null
  sendStatus:       string | null
  wondePositive:    number | null
  wondeNegative:    number | null
  hasExclusion:     boolean | null
  manualPositive:   number
  manualNegative:   number
  totalManual:      number
  records:          BehaviourRecordRow[]
}

// ── Add record ────────────────────────────────────────────────────────────────

export async function addBehaviourRecord(data: {
  studentId:   string
  type:        string
  category:    string
  description: string
  points:      number
  recordDate:  string
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth()
  if (!STAFF_ROLES.includes(user.role)) return { ok: false, error: 'Forbidden' }

  // Verify student belongs to this school
  const student = await prisma.user.findFirst({
    where: { id: data.studentId, schoolId: user.schoolId, role: 'STUDENT' },
    select: { id: true },
  })
  if (!student) return { ok: false, error: 'Student not found' }

  await prisma.behaviourRecord.create({
    data: {
      schoolId:    user.schoolId,
      studentId:   data.studentId,
      authorId:    user.id,
      type:        data.type,
      category:    data.category,
      description: data.description,
      points:      data.points,
      recordDate:  new Date(data.recordDate),
    },
  })

  await writeAudit({
    schoolId: user.schoolId,
    actorId:  user.id,
    action:   'BEHAVIOUR_RECORDED',
    targetType: 'BehaviourRecord',
    targetId:   data.studentId,
    metadata:   { type: data.type, category: data.category },
  })

  revalidatePath(`/students/${data.studentId}`)
  revalidatePath('/hoy/behaviour')
  return { ok: true }
}

// ── Delete record ─────────────────────────────────────────────────────────────

export async function deleteBehaviourRecord(recordId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth()
  if (!STAFF_ROLES.includes(user.role)) return { ok: false, error: 'Forbidden' }

  const record = await prisma.behaviourRecord.findFirst({
    where: { id: recordId, schoolId: user.schoolId },
    select: { id: true, studentId: true, authorId: true },
  })
  if (!record) return { ok: false, error: 'Not found' }

  // Only author or HOY/SLT/ADMIN can delete
  const canDelete = record.authorId === user.id || ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN'].includes(user.role)
  if (!canDelete) return { ok: false, error: 'Forbidden' }

  await prisma.behaviourRecord.delete({ where: { id: recordId } })

  await writeAudit({
    schoolId: user.schoolId,
    actorId:  user.id,
    action:   'BEHAVIOUR_DELETED',
    targetType: 'BehaviourRecord',
    targetId:   record.studentId,
    metadata:   { recordId },
  })

  revalidatePath(`/students/${record.studentId}`)
  revalidatePath('/hoy/behaviour')
  return { ok: true }
}

// ── Get records for a student ─────────────────────────────────────────────────

export async function getStudentBehaviourRecords(studentId: string): Promise<BehaviourRecordRow[]> {
  const user = await requireAuth()
  if (!STAFF_ROLES.includes(user.role)) redirect('/dashboard')

  const records = await prisma.behaviourRecord.findMany({
    where:   { studentId, schoolId: user.schoolId },
    select:  {
      id: true, type: true, category: true, description: true,
      points: true, recordDate: true,
      author: { select: { firstName: true, lastName: true } },
    },
    orderBy: { recordDate: 'desc' },
  })

  return records.map(r => ({
    id:          r.id,
    type:        r.type,
    category:    r.category,
    description: r.description,
    points:      r.points,
    recordDate:  r.recordDate.toISOString(),
    authorName:  `${r.author.firstName} ${r.author.lastName}`,
  }))
}

// ── School-wide overview ──────────────────────────────────────────────────────

export type BehaviourOverviewRow = {
  studentId:      string
  studentName:    string
  yearGroup:      number | null
  sendStatus:     string | null
  wondePositive:  number | null
  wondeNegative:  number | null
  hasExclusion:   boolean | null
  manualPositive: number
  manualNegative: number
  totalManual:    number
}

export async function getBehaviourOverview(yearGroup?: number): Promise<BehaviourOverviewRow[]> {
  const user = await requireAuth()
  if (!VIEW_ROLES.includes(user.role)) redirect('/dashboard')

  const yearFilter = yearGroup ? { yearGroup } : {}

  const students = await prisma.user.findMany({
    where:  { schoolId: user.schoolId, role: 'STUDENT', isActive: true, ...yearFilter },
    select: {
      id: true, firstName: true, lastName: true, yearGroup: true,
      behaviourPositive: true, behaviourNegative: true, hasExclusion: true,
    },
    orderBy: [{ yearGroup: 'asc' }, { lastName: 'asc' }],
  })

  const studentIds = students.map(s => s.id)

  const [sendStatuses, manualCounts] = await Promise.all([
    prisma.sendStatus.findMany({
      where:  { studentId: { in: studentIds }, NOT: { activeStatus: 'NONE' } },
      select: { studentId: true, activeStatus: true },
    }),
    prisma.behaviourRecord.groupBy({
      by:    ['studentId', 'type'],
      where: { schoolId: user.schoolId, studentId: { in: studentIds } },
      _count: { id: true },
    }),
  ])

  const sendMap    = new Map(sendStatuses.map(s => [s.studentId, s.activeStatus]))
  const posMap     = new Map<string, number>()
  const negMap     = new Map<string, number>()
  for (const g of manualCounts) {
    if (g.type === 'positive') posMap.set(g.studentId, g._count.id)
    if (g.type === 'negative') negMap.set(g.studentId, g._count.id)
  }

  return students
    .map(s => ({
      studentId:      s.id,
      studentName:    `${s.firstName} ${s.lastName}`,
      yearGroup:      s.yearGroup,
      sendStatus:     sendMap.get(s.id) ?? null,
      wondePositive:  s.behaviourPositive,
      wondeNegative:  s.behaviourNegative,
      hasExclusion:   s.hasExclusion,
      manualPositive: posMap.get(s.id) ?? 0,
      manualNegative: negMap.get(s.id) ?? 0,
      totalManual:    (posMap.get(s.id) ?? 0) + (negMap.get(s.id) ?? 0),
    }))
    .sort((a, b) => {
      // Sort by concern level: exclusion first, then most negative records
      const aScore = (a.hasExclusion ? 100 : 0) + (a.wondeNegative ?? 0) + a.manualNegative
      const bScore = (b.hasExclusion ? 100 : 0) + (b.wondeNegative ?? 0) + b.manualNegative
      return bScore - aScore
    })
}
