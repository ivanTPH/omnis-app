'use server'

import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

const STAFF_ROLES = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'COVER_MANAGER']
const VIEW_ROLES  = ['HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT']

export type SafeguardingRow = {
  id:            string
  studentId:     string
  studentName:   string
  yearGroup:     number | null
  authorName:    string
  category:      string
  priority:      string
  description:   string
  referredToDSL: boolean
  dslNotes:      string | null
  status:        string
  resolvedAt:    string | null
  createdAt:     string
}

// ── Log a new safeguarding record ─────────────────────────────────────────────

export async function logSafeguardingRecord(data: {
  studentId:     string
  category:      string
  priority:      string
  description:   string
  referredToDSL: boolean
  dslNotes?:     string
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth()
  if (!STAFF_ROLES.includes(user.role)) return { ok: false, error: 'Forbidden' }

  const student = await prisma.user.findFirst({
    where: { id: data.studentId, schoolId: user.schoolId, role: 'STUDENT' },
    select: { id: true },
  })
  if (!student) return { ok: false, error: 'Student not found' }

  const record = await prisma.safeguardingRecord.create({
    data: {
      schoolId:      user.schoolId,
      studentId:     data.studentId,
      authorId:      user.id,
      category:      data.category,
      priority:      data.priority,
      description:   data.description,
      referredToDSL: data.referredToDSL,
      dslNotes:      data.dslNotes ?? null,
      status:        data.referredToDSL ? 'referred' : 'open',
    },
  })

  await writeAudit({
    schoolId:   user.schoolId,
    actorId:    user.id,
    action:     data.referredToDSL ? 'SAFEGUARDING_REFERRED' : 'SAFEGUARDING_LOGGED',
    targetType: 'SafeguardingRecord',
    targetId:   record.id,
    metadata:   { category: data.category, priority: data.priority, studentId: data.studentId },
  })

  revalidatePath('/hoy/safeguarding')
  revalidatePath(`/students/${data.studentId}`)
  return { ok: true }
}

// ── Update status / DSL notes ─────────────────────────────────────────────────

export async function updateSafeguardingRecord(
  id:   string,
  data: { status?: string; dslNotes?: string; referredToDSL?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth()
  if (!VIEW_ROLES.includes(user.role)) return { ok: false, error: 'Forbidden' }

  const record = await prisma.safeguardingRecord.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true, studentId: true },
  })
  if (!record) return { ok: false, error: 'Not found' }

  await prisma.safeguardingRecord.update({
    where: { id },
    data: {
      ...(data.status        !== undefined ? { status:        data.status }        : {}),
      ...(data.dslNotes      !== undefined ? { dslNotes:      data.dslNotes }      : {}),
      ...(data.referredToDSL !== undefined ? { referredToDSL: data.referredToDSL } : {}),
      ...(data.status === 'closed' ? { resolvedAt: new Date() } : {}),
    },
  })

  if (data.referredToDSL) {
    await writeAudit({
      schoolId:   user.schoolId,
      actorId:    user.id,
      action:     'SAFEGUARDING_REFERRED',
      targetType: 'SafeguardingRecord',
      targetId:   id,
      metadata:   {},
    })
  }

  revalidatePath('/hoy/safeguarding')
  revalidatePath(`/students/${record.studentId}`)
  return { ok: true }
}

// ── School-wide log ───────────────────────────────────────────────────────────

export type SafeguardingLog = {
  open:       SafeguardingRow[]
  referred:   SafeguardingRow[]
  monitoring: SafeguardingRow[]
  closed:     SafeguardingRow[]
  stats: {
    total: number; open: number; referred: number; critical: number
  }
}

function mapRow(r: {
  id: string; category: string; priority: string; description: string
  referredToDSL: boolean; dslNotes: string | null; status: string
  resolvedAt: Date | null; createdAt: Date
  student: { id: string; firstName: string; lastName: string; yearGroup: number | null }
  author:  { firstName: string; lastName: string }
}): SafeguardingRow {
  return {
    id:            r.id,
    studentId:     r.student.id,
    studentName:   `${r.student.firstName} ${r.student.lastName}`,
    yearGroup:     r.student.yearGroup,
    authorName:    `${r.author.firstName} ${r.author.lastName}`,
    category:      r.category,
    priority:      r.priority,
    description:   r.description,
    referredToDSL: r.referredToDSL,
    dslNotes:      r.dslNotes,
    status:        r.status,
    resolvedAt:    r.resolvedAt?.toISOString() ?? null,
    createdAt:     r.createdAt.toISOString(),
  }
}

export async function getSafeguardingLog(yearGroup?: number): Promise<SafeguardingLog> {
  const user = await requireAuth()
  if (!VIEW_ROLES.includes(user.role)) redirect('/dashboard')

  const yearFilter = yearGroup ? { student: { yearGroup } } : {}

  const records = await prisma.safeguardingRecord.findMany({
    where: { schoolId: user.schoolId, ...yearFilter },
    select: {
      id: true, category: true, priority: true, description: true,
      referredToDSL: true, dslNotes: true, status: true,
      resolvedAt: true, createdAt: true,
      student: { select: { id: true, firstName: true, lastName: true, yearGroup: true } },
      author:  { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  const rows = records.map(mapRow)

  return {
    open:       rows.filter(r => r.status === 'open'),
    referred:   rows.filter(r => r.status === 'referred'),
    monitoring: rows.filter(r => r.status === 'monitoring'),
    closed:     rows.filter(r => r.status === 'closed'),
    stats: {
      total:    rows.length,
      open:     rows.filter(r => r.status === 'open').length,
      referred: rows.filter(r => r.status === 'referred').length,
      critical: rows.filter(r => r.priority === 'critical').length,
    },
  }
}

// ── Per-student records ───────────────────────────────────────────────────────

export async function getStudentSafeguardingRecords(studentId: string): Promise<SafeguardingRow[]> {
  const user = await requireAuth()
  if (!VIEW_ROLES.includes(user.role)) redirect('/dashboard')

  const records = await prisma.safeguardingRecord.findMany({
    where: { studentId, schoolId: user.schoolId },
    select: {
      id: true, category: true, priority: true, description: true,
      referredToDSL: true, dslNotes: true, status: true,
      resolvedAt: true, createdAt: true,
      student: { select: { id: true, firstName: true, lastName: true, yearGroup: true } },
      author:  { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return records.map(mapRow)
}
