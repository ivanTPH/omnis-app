'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Role } from '@prisma/client'

// ─── Guard ────────────────────────────────────────────────────────────────────

async function requireAdminOrSlt() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = session.user as any
  if (!['SCHOOL_ADMIN', 'SLT', 'COVER_MANAGER'].includes(u.role)) redirect('/dashboard')
  return u
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export type AdminDashboardData = {
  studentCount:    number
  staffCount:      number
  classCount:      number
  sendCount:       number
  pendingHomework: number
  activeIlpCount:  number
}

const STAFF_ROLES: Role[] = [
  'TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR',
  'SENCO', 'SCHOOL_ADMIN', 'SLT', 'COVER_MANAGER',
]

export async function getAdminDashboardData(_schoolId?: string): Promise<AdminDashboardData> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const [studentCount, staffCount, classCount, sendCount, pendingHomework, activeIlpCount] =
    await Promise.all([
      prisma.user.count({ where: { schoolId, role: 'STUDENT', isActive: true } }),
      prisma.user.count({ where: { schoolId, role: { in: STAFF_ROLES }, isActive: true } }),
      prisma.schoolClass.count({ where: { schoolId } }),
      prisma.sendStatus.count({ where: { student: { schoolId }, NOT: { activeStatus: 'NONE' } } }),
      prisma.submission.count({ where: { schoolId, status: 'SUBMITTED' } }),
      prisma.plan.count({
        where: { schoolId, status: { in: ['ACTIVE_INTERNAL', 'ACTIVE_PARENT_SHARED'] } },
      }),
    ])
  return { studentCount, staffCount, classCount, sendCount, pendingHomework, activeIlpCount }
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export type StaffMember = {
  id:         string
  firstName:  string
  lastName:   string
  email:      string
  role:       string
  department: string | null
  classCount: number
  isActive:   boolean
}

export async function getStaffMembers(_schoolId?: string): Promise<StaffMember[]> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const users = await prisma.user.findMany({
    where:   { schoolId, role: { in: STAFF_ROLES } },
    include: { teacherClasses: true },
    orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
  })
  return users.map(u => ({
    id:         u.id,
    firstName:  u.firstName,
    lastName:   u.lastName,
    email:      u.email,
    role:       u.role,
    department: u.department,
    classCount: (u.teacherClasses ?? []).length,
    isActive:   u.isActive,
  }))
}

// Keep old name for backwards compatibility with any existing callers
export async function getStaffList(...args: Parameters<typeof getStaffMembers>) {
  return getStaffMembers(...args)
}

// ─── Students ─────────────────────────────────────────────────────────────────

export type StudentRow = {
  id:        string
  firstName: string
  lastName:  string
  email:     string
  yearGroup: number | null
  className: string
  hasSend:   boolean
  avatarUrl: string | null
}

export async function getStudentList(_schoolId?: string): Promise<StudentRow[]> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const students = await prisma.user.findMany({
    where:   { schoolId, role: 'STUDENT', isActive: true },
    include: {
      enrolments: { include: { class: { select: { name: true } } }, take: 1 },
      sendStatus: true,
    },
    orderBy: [{ yearGroup: 'asc' }, { lastName: 'asc' }],
  })
  return students.map(u => ({
    id:        u.id,
    firstName: u.firstName,
    lastName:  u.lastName,
    email:     u.email,
    yearGroup: u.yearGroup,
    className: u.enrolments[0]?.class.name ?? '—',
    hasSend:   u.sendStatus !== null && u.sendStatus.activeStatus !== 'NONE',
    avatarUrl: u.avatarUrl ?? null,
  }))
}

// ─── Classes ──────────────────────────────────────────────────────────────────

export type ClassRow = {
  id:           string
  name:         string
  subject:      string
  yearGroup:    number
  department:   string
  studentCount: number
  teacherNames: string[]
}

export async function getClassList(_schoolId?: string): Promise<ClassRow[]> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const classes = await prisma.schoolClass.findMany({
    where:   { schoolId },
    include: {
      teachers: { include: { user: { select: { firstName: true, lastName: true } } } },
      _count:   { select: { enrolments: true } },
    },
    orderBy: [{ subject: 'asc' }, { yearGroup: 'asc' }, { name: 'asc' }],
  })
  return classes.map(c => ({
    id:           c.id,
    name:         c.name,
    subject:      c.subject,
    yearGroup:    c.yearGroup,
    department:   c.department,
    studentCount: c._count.enrolments,
    teacherNames: c.teachers.map(t => `${t.user.firstName} ${t.user.lastName}`),
  }))
}

// ─── Timetable ────────────────────────────────────────────────────────────────

export type TimetableRow = {
  id:         string
  className:  string
  subject:    string | null
  teacher:    string
  periodName: string
  startTime:  string
  endTime:    string
  dayOfWeek:  number | null
  room:       string | null
}

export async function getTimetable(_schoolId?: string): Promise<TimetableRow[]> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const entries = await prisma.wondeTimetableEntry.findMany({
    where:   { schoolId },
    include: {
      wondeClass: { select: { name: true, subject: true } },
      employee:   { select: { firstName: true, lastName: true } },
      period:     { select: { name: true, startTime: true, endTime: true, dayOfWeek: true } },
    },
    orderBy: [{ period: { dayOfWeek: 'asc' } }, { period: { startTime: 'asc' } }],
  })
  return entries.map(e => ({
    id:         e.id,
    className:  e.wondeClass.name,
    subject:    e.wondeClass.subject,
    teacher:    e.employee ? `${e.employee.firstName} ${e.employee.lastName}` : '—',
    periodName: e.period.name,
    startTime:  e.period.startTime,
    endTime:    e.period.endTime,
    dayOfWeek:  e.period.dayOfWeek,
    room:       e.roomName,
  }))
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export type CalendarEntry = {
  id:    string
  date:  string   // ISO string
  type:  string
  label: string | null
}

export async function getCalendarEntries(_schoolId?: string): Promise<CalendarEntry[]> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const entries = await prisma.schoolCalendar.findMany({
    where:   { schoolId },
    orderBy: { date: 'asc' },
  })
  return entries.map(e => ({ id: e.id, date: e.date.toISOString(), type: e.type, label: e.label }))
}

export async function createCalendarEntry(
  _schoolId: string,
  date:      string,
  type:      string,
  label:     string,
): Promise<void> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')

  await prisma.schoolCalendar.create({
    data: { schoolId, date: new Date(date), type, label },
  })
  revalidatePath('/admin/calendar')
}

export async function deleteCalendarEntry(id: string): Promise<void> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  // Security: scope delete to admin's school to prevent cross-tenant deletion
  await prisma.schoolCalendar.deleteMany({ where: { id, schoolId } })
  revalidatePath('/admin/calendar')
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export type AuditLogEntry = {
  id:         string
  action:     string
  targetType: string
  targetId:   string
  metadata:   Record<string, unknown> | null
  createdAt:  string
  actorName:  string
  actorRole:  string
}

export async function getSchoolAuditLog(page = 0, pageSize = 50): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where:   { schoolId },
      orderBy: { createdAt: 'desc' },
      skip:    page * pageSize,
      take:    pageSize,
      include: { actor: { select: { firstName: true, lastName: true, role: true } } },
    }),
    prisma.auditLog.count({ where: { schoolId } }),
  ])

  return {
    total,
    entries: entries.map(e => ({
      id:         e.id,
      action:     e.action,
      targetType: e.targetType,
      targetId:   e.targetId,
      metadata:   e.metadata as Record<string, unknown> | null,
      createdAt:  e.createdAt.toISOString(),
      actorName:  `${e.actor.firstName} ${e.actor.lastName}`,
      actorRole:  e.actor.role,
    })),
  }
}
