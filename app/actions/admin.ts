'use server'

import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'
import { Role, Prisma } from '@prisma/client'
import { AUDIT_CATEGORIES } from '@/lib/audit-categories'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// ─── Guard ────────────────────────────────────────────────────────────────────

async function requireAdminOrSlt() {
  const u = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT', 'COVER_MANAGER'].includes(u.role)) redirect('/dashboard')
  return u
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export type AdminDashboardData = {
  studentCount:      number
  staffCount:        number
  classCount:        number
  sendCount:         number
  activeIlpCount:    number
  openConcerns:      number
  pendingActivation: number
}

const STAFF_ROLES: Role[] = [
  'TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR',
  'SENCO', 'SCHOOL_ADMIN', 'SLT', 'COVER_MANAGER', 'TEACHING_ASSISTANT',
]

const fetchAdminDashboardData = unstable_cache(
  async (schoolId: string): Promise<AdminDashboardData> => {
    const [studentCount, staffCount, classCount, sendCount, activeIlpCount, openConcerns, pendingActivation] =
      await Promise.all([
        prisma.user.count({ where: { schoolId, role: 'STUDENT', isActive: true } }),
        prisma.user.count({ where: { schoolId, role: { in: STAFF_ROLES }, isActive: true } }),
        prisma.schoolClass.count({ where: { schoolId } }),
        prisma.sendStatus.count({ where: { student: { schoolId }, NOT: { activeStatus: 'NONE' } } }),
        prisma.plan.count({
          where: { schoolId, status: { in: ['ACTIVE_INTERNAL', 'ACTIVE_PARENT_SHARED'] } },
        }),
        prisma.sendConcern.count({ where: { schoolId, status: { in: ['open', 'under_review', 'escalated'] } } }),
        prisma.user.count({ where: { schoolId, role: 'STUDENT', isActive: true, activatedAt: null } }),
      ])
    return { studentCount, staffCount, classCount, sendCount, activeIlpCount, openConcerns, pendingActivation }
  },
  ['admin-dashboard-stats'],
  { revalidate: 60 },
)

export async function getAdminDashboardData(_schoolId?: string): Promise<AdminDashboardData> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string
  return fetchAdminDashboardData(schoolId)
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export type StaffMember = {
  id:         string
  firstName:  string
  lastName:   string
  email:      string
  role:       string
  department: string | null
  yearGroups: number[]
  classCount: number
  isActive:   boolean
}

export async function getStaffMembers(_schoolId?: string): Promise<StaffMember[]> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const users = await prisma.user.findMany({
    where:   { schoolId, role: { in: STAFF_ROLES } },
    select:  {
      id: true, firstName: true, lastName: true, email: true,
      role: true, department: true, isActive: true,
      teacherClasses: { include: { class: { select: { yearGroup: true } } } },
    },
    orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
  })
  return users.map(u => ({
    id:         u.id,
    firstName:  u.firstName,
    lastName:   u.lastName,
    email:      u.email,
    role:       u.role,
    department: u.department,
    yearGroups: [...new Set(u.teacherClasses.map(tc => tc.class.yearGroup))].sort((a, b) => a - b),
    classCount: u.teacherClasses.length,
    isActive:   u.isActive,
  }))
}

// ─── Staff CRUD ────────────────────────────────────────────────────────────────

export type CreateStaffInput = {
  firstName:         string
  lastName:          string
  email:             string
  role:              string
  department?:       string
  temporaryPassword: string
}

export async function createStaffMember(
  input: CreateStaffInput,
): Promise<{ success?: true; staffId?: string; error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } })
  if (existing) return { error: 'A user with this email already exists' }

  const passwordHash = await bcrypt.hash(input.temporaryPassword, 12)

  const staff = await prisma.user.create({
    data: {
      schoolId,
      email:        input.email.toLowerCase().trim(),
      passwordHash,
      role:         input.role as Role,
      firstName:    input.firstName.trim(),
      lastName:     input.lastName.trim(),
      department:   input.department?.trim() || null,
      isActive:     true,
    },
  })

  await writeAudit({
    schoolId,
    actorId:    user.id,
    action:     'STAFF_CREATED',
    targetType: 'User',
    targetId:   staff.id,
    metadata:   { role: input.role, email: input.email },
  })

  revalidatePath('/admin/staff')
  return { success: true, staffId: staff.id }
}

export type UpdateStaffInput = {
  staffId:     string
  firstName:   string
  lastName:    string
  email:       string
  role:        string
  department?: string
}

export async function updateStaffMember(
  input: UpdateStaffInput,
): Promise<{ success?: true; error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } })
  if (existing && existing.id !== input.staffId) return { error: 'This email is already in use by another account' }

  await prisma.user.update({
    where: { id: input.staffId, schoolId },
    data: {
      firstName:  input.firstName.trim(),
      lastName:   input.lastName.trim(),
      email:      input.email.toLowerCase().trim(),
      role:       input.role as Role,
      department: input.department?.trim() || null,
    },
  })

  await writeAudit({
    schoolId,
    actorId:    user.id,
    action:     'STAFF_UPDATED',
    targetType: 'User',
    targetId:   input.staffId,
    metadata:   { role: input.role, email: input.email },
  })

  revalidatePath('/admin/staff')
  return { success: true }
}

export async function toggleStaffActive(
  staffId: string,
): Promise<{ success?: true; isActive?: boolean; error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  if (staffId === user.id) return { error: 'You cannot deactivate your own account' }

  const staff = await prisma.user.findUnique({ where: { id: staffId, schoolId } })
  if (!staff) return { error: 'Staff member not found' }

  const newIsActive = !staff.isActive
  await prisma.user.update({ where: { id: staffId }, data: { isActive: newIsActive } })

  await writeAudit({
    schoolId,
    actorId:    user.id,
    action:     newIsActive ? 'STAFF_REACTIVATED' : 'STAFF_DEACTIVATED',
    targetType: 'User',
    targetId:   staffId,
    metadata:   { email: staff.email },
  })

  revalidatePath('/admin/staff')
  return { success: true, isActive: newIsActive }
}

export async function deleteStaffMember(
  staffId: string,
): Promise<{ success?: true; error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  if (staffId === user.id) return { error: 'You cannot delete your own account' }

  const staff = await prisma.user.findUnique({ where: { id: staffId, schoolId } })
  if (!staff) return { error: 'Staff member not found' }

  // Soft delete — preserve lessons/homework records, remove login access
  await prisma.user.update({
    where: { id: staffId, schoolId },
    data: {
      isActive: false,
      email:    `deleted-${staffId}@deleted.invalid`,
    },
  })

  await writeAudit({
    schoolId,
    actorId:    user.id,
    action:     'STAFF_DELETED',
    targetType: 'User',
    targetId:   staffId,
    metadata:   { originalEmail: staff.email, name: `${staff.firstName} ${staff.lastName}` },
  })

  revalidatePath('/admin/staff')
  return { success: true }
}

// Keep old name for backwards compatibility with any existing callers
export async function getStaffList(...args: Parameters<typeof getStaffMembers>) {
  return getStaffMembers(...args)
}

// ─── Students ─────────────────────────────────────────────────────────────────

export type StudentRow = {
  id:         string
  firstName:  string
  lastName:   string
  email:      string
  yearGroup:  number | null
  tutorGroup: string | null
  className:  string
  hasSend:    boolean
  avatarUrl:  string | null
  isActive:   boolean
}

export async function getStudentList(_schoolId?: string): Promise<StudentRow[]> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const students = await prisma.user.findMany({
    where:   { schoolId, role: 'STUDENT' }, // admin sees all, including inactive
    select:  {
      id: true, firstName: true, lastName: true, email: true,
      yearGroup: true, tutorGroup: true, avatarUrl: true, isActive: true,
      enrolments: { select: { class: { select: { name: true } } }, take: 1 },
      sendStatus: { select: { activeStatus: true } },
    },
    orderBy: [{ yearGroup: 'asc' }, { lastName: 'asc' }],
  })
  return students.map(u => ({
    id:         u.id,
    firstName:  u.firstName,
    lastName:   u.lastName,
    email:      u.email,
    yearGroup:  u.yearGroup,
    tutorGroup: u.tutorGroup,
    className:  u.enrolments[0]?.class.name ?? '—',
    hasSend:    u.sendStatus !== null && u.sendStatus.activeStatus !== 'NONE',
    avatarUrl:  u.avatarUrl ?? null,
    isActive:   u.isActive,
  }))
}

// ─── Classes ──────────────────────────────────────────────────────────────────

export type ClassRow = {
  id:           string
  name:         string
  subject:      string
  yearGroup:    number
  department:   string
  examBoard:    string | null
  examModules:  string[]
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
    examBoard:    (c as any).examBoard   ?? null,
    examModules:  (c as any).examModules ?? [],
    studentCount: c._count.enrolments,
    teacherNames: c.teachers.map(t => `${t.user.firstName} ${t.user.lastName}`),
  }))
}

// ─── Student CRUD ─────────────────────────────────────────────────────────────

export type CreateStudentInput = {
  firstName:         string
  lastName:          string
  email:             string
  yearGroup:         number
  tutorGroup?:       string
  temporaryPassword: string
}

export async function createStudent(
  input: CreateStudentInput,
): Promise<{ success?: true; studentId?: string; error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } })
  if (existing) return { error: 'A user with this email already exists' }

  const passwordHash = await bcrypt.hash(input.temporaryPassword, 12)
  const student = await prisma.user.create({
    data: {
      schoolId,
      email:      input.email.toLowerCase().trim(),
      passwordHash,
      role:       'STUDENT',
      firstName:  input.firstName.trim(),
      lastName:   input.lastName.trim(),
      yearGroup:  input.yearGroup,
      tutorGroup: input.tutorGroup?.trim() || null,
      isActive:   true,
    },
  })

  await writeAudit({
    schoolId, actorId: user.id, action: 'STUDENT_CREATED',
    targetType: 'User', targetId: student.id,
    metadata: { email: input.email, yearGroup: input.yearGroup },
  })
  revalidatePath('/admin/students')
  return { success: true, studentId: student.id }
}

export type UpdateStudentInput = {
  studentId:   string
  firstName:   string
  lastName:    string
  email:       string
  yearGroup:   number
  tutorGroup?: string
}

export async function updateStudent(
  input: UpdateStudentInput,
): Promise<{ success?: true; error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } })
  if (existing && existing.id !== input.studentId) return { error: 'This email is already in use' }

  await prisma.user.update({
    where: { id: input.studentId, schoolId },
    data: {
      firstName:  input.firstName.trim(),
      lastName:   input.lastName.trim(),
      email:      input.email.toLowerCase().trim(),
      yearGroup:  input.yearGroup,
      tutorGroup: input.tutorGroup?.trim() || null,
    },
  })

  await writeAudit({
    schoolId, actorId: user.id, action: 'STUDENT_UPDATED',
    targetType: 'User', targetId: input.studentId,
    metadata: { email: input.email },
  })
  revalidatePath('/admin/students')
  return { success: true }
}

export async function toggleStudentActive(
  studentId: string,
): Promise<{ success?: true; isActive?: boolean; error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  const student = await prisma.user.findUnique({ where: { id: studentId, schoolId } })
  if (!student) return { error: 'Student not found' }

  const newIsActive = !student.isActive
  await prisma.user.update({ where: { id: studentId }, data: { isActive: newIsActive } })

  await writeAudit({
    schoolId, actorId: user.id,
    action: newIsActive ? 'STUDENT_REACTIVATED' : 'STUDENT_DEACTIVATED',
    targetType: 'User', targetId: studentId,
    metadata: { email: student.email },
  })
  revalidatePath('/admin/students')
  return { success: true, isActive: newIsActive }
}

export async function deleteStudent(
  studentId: string,
): Promise<{ success?: true; error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  const student = await prisma.user.findUnique({ where: { id: studentId, schoolId } })
  if (!student) return { error: 'Student not found' }

  // Soft delete — preserve submissions, ILP, SEND records
  await prisma.user.update({
    where: { id: studentId, schoolId },
    data: { isActive: false, email: `deleted-${studentId}@deleted.invalid` },
  })

  await writeAudit({
    schoolId, actorId: user.id, action: 'STUDENT_DELETED',
    targetType: 'User', targetId: studentId,
    metadata: { originalEmail: student.email, name: `${student.firstName} ${student.lastName}` },
  })
  revalidatePath('/admin/students')
  return { success: true }
}

// ─── Class CRUD ────────────────────────────────────────────────────────────────

export type CreateClassInput = {
  name:        string
  subject:     string
  yearGroup:   number
  department:  string
  examBoard?:  string
  examModules?: string[]
}

export async function createClass(
  input: CreateClassInput,
): Promise<{ success?: true; classId?: string; error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  const cls = await prisma.schoolClass.create({
    data: {
      schoolId,
      name:        input.name.trim(),
      subject:     input.subject,
      yearGroup:   input.yearGroup,
      department:  input.department,
      examBoard:   input.examBoard  || null,
      examModules: input.examModules ?? [],
    } as any,
  })

  await writeAudit({
    schoolId, actorId: user.id, action: 'CLASS_CREATED',
    targetType: 'SchoolClass', targetId: cls.id,
    metadata: { name: input.name, subject: input.subject, yearGroup: input.yearGroup },
  })
  revalidatePath('/admin/classes')
  return { success: true, classId: cls.id }
}

export type UpdateClassInput = {
  classId:     string
  name:        string
  subject:     string
  yearGroup:   number
  department:  string
  examBoard?:  string
  examModules?: string[]
}

export async function updateClass(
  input: UpdateClassInput,
): Promise<{ success?: true; error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  await prisma.schoolClass.update({
    where: { id: input.classId, schoolId },
    data: {
      name:        input.name.trim(),
      subject:     input.subject,
      yearGroup:   input.yearGroup,
      department:  input.department,
      examBoard:   input.examBoard  ?? null,
      examModules: input.examModules ?? [],
    } as any,
  })

  await writeAudit({
    schoolId, actorId: user.id, action: 'CLASS_UPDATED',
    targetType: 'SchoolClass', targetId: input.classId,
    metadata: { name: input.name, subject: input.subject },
  })
  revalidatePath('/admin/classes')
  return { success: true }
}

/** Update exam board and modules for a class — accessible by HOD, SLT, SCHOOL_ADMIN. */
export async function updateClassExamBoard(input: {
  classId:    string
  examBoard:  string
  examModules: string[]
}): Promise<{ success?: true; error?: string }> {
  const { schoolId, id: userId, role } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT', 'HEAD_OF_DEPT'].includes(role)) return { error: 'Forbidden' }

  await prisma.schoolClass.update({
    where: { id: input.classId, schoolId },
    data:  { examBoard: input.examBoard || null, examModules: input.examModules } as any,
  })

  await writeAudit({
    schoolId, actorId: userId, action: 'CLASS_UPDATED',
    targetType: 'SchoolClass', targetId: input.classId,
    metadata: { field: 'examBoard', examBoard: input.examBoard, examModules: input.examModules },
  })
  revalidatePath('/classes')
  revalidatePath('/admin/classes')
  return { success: true }
}

// ─── Class membership management ──────────────────────────────────────────────

export type ClassDetailForAdmin = {
  id:          string
  name:        string
  subject:     string
  yearGroup:   number
  department:  string
  teachers:    { id: string; firstName: string; lastName: string; role: string }[]
  students:    { id: string; firstName: string; lastName: string; yearGroup: number | null }[]
}

export async function getClassDetail(classId: string): Promise<ClassDetailForAdmin | null> {
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const cls = await prisma.schoolClass.findFirst({
    where:   { id: classId, schoolId },
    include: {
      teachers:   { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
      enrolments: { include: { user: { select: { id: true, firstName: true, lastName: true, yearGroup: true } } } },
    },
  })
  if (!cls) return null
  return {
    id:         cls.id,
    name:       cls.name,
    subject:    cls.subject,
    yearGroup:  cls.yearGroup,
    department: cls.department,
    teachers:   cls.teachers.map(t => ({ id: t.user.id, firstName: t.user.firstName, lastName: t.user.lastName, role: t.user.role })),
    students:   cls.enrolments.map(e => ({ id: e.user.id, firstName: e.user.firstName, lastName: e.user.lastName, yearGroup: e.user.yearGroup })),
  }
}

export async function assignTeacherToClass(classId: string, userId: string): Promise<{ error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  const [cls, teacher] = await Promise.all([
    prisma.schoolClass.findFirst({ where: { id: classId, schoolId } }),
    prisma.user.findFirst({ where: { id: userId, schoolId } }),
  ])
  if (!cls)     return { error: 'Class not found' }
  if (!teacher) return { error: 'Staff member not found' }

  await prisma.classTeacher.upsert({
    where:  { classId_userId: { classId, userId } },
    create: { classId, userId },
    update: {},
  })

  await writeAudit({
    schoolId, actorId: user.id, action: 'CLASS_TEACHER_ASSIGNED',
    targetType: 'SchoolClass', targetId: classId,
    metadata: { teacherId: userId, teacherName: `${teacher.firstName} ${teacher.lastName}` },
  })
  revalidatePath('/admin/classes')
  return {}
}

export async function removeTeacherFromClass(classId: string, userId: string): Promise<{ error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  const cls = await prisma.schoolClass.findFirst({ where: { id: classId, schoolId } })
  if (!cls) return { error: 'Class not found' }

  await prisma.classTeacher.deleteMany({ where: { classId, userId } })

  await writeAudit({
    schoolId, actorId: user.id, action: 'CLASS_TEACHER_REMOVED',
    targetType: 'SchoolClass', targetId: classId,
    metadata: { teacherId: userId },
  })
  revalidatePath('/admin/classes')
  return {}
}

export async function addStudentToClass(classId: string, studentId: string): Promise<{ error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  const [cls, student] = await Promise.all([
    prisma.schoolClass.findFirst({ where: { id: classId, schoolId } }),
    prisma.user.findFirst({ where: { id: studentId, schoolId, role: 'STUDENT' } }),
  ])
  if (!cls)     return { error: 'Class not found' }
  if (!student) return { error: 'Student not found' }

  await prisma.enrolment.upsert({
    where:  { classId_userId: { classId, userId: studentId } },
    create: { classId, userId: studentId },
    update: {},
  })

  await writeAudit({
    schoolId, actorId: user.id, action: 'STUDENT_ENROLLED',
    targetType: 'SchoolClass', targetId: classId,
    metadata: { studentId, studentName: `${student.firstName} ${student.lastName}` },
  })
  revalidatePath('/admin/classes')
  revalidateTag(`roster-${classId}`, 'default')
  return {}
}

export async function removeStudentFromClass(classId: string, studentId: string): Promise<{ error?: string }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  const cls = await prisma.schoolClass.findFirst({ where: { id: classId, schoolId } })
  if (!cls) return { error: 'Class not found' }

  await prisma.enrolment.deleteMany({ where: { classId, userId: studentId } })

  await writeAudit({
    schoolId, actorId: user.id, action: 'STUDENT_UNENROLLED',
    targetType: 'SchoolClass', targetId: classId,
    metadata: { studentId },
  })
  revalidatePath('/admin/classes')
  revalidateTag(`roster-${classId}`, 'default')
  return {}
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


export async function getSchoolAuditLog(
  page     = 0,
  pageSize = 50,
  category?: string,
  days?:     number,
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const user = await requireAdminOrSlt()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(user.role)) throw new Error('Forbidden')
  const schoolId = user.schoolId as string

  const where: Prisma.AuditLogWhereInput = { schoolId }

  if (category && AUDIT_CATEGORIES[category]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where.action = { in: AUDIT_CATEGORIES[category] as any }
  }

  if (days && days > 0) {
    const since = new Date(Date.now() - days * 86_400_000)
    where.createdAt = { gte: since }
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    page * pageSize,
      take:    pageSize,
      include: { actor: { select: { firstName: true, lastName: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
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

// ─── Subject Config ────────────────────────────────────────────────────────────

export type SubjectConfigRow = {
  id:        string
  subject:   string
  examBoard: string | null
  tier:      string | null
  updatedAt: string
  /** How many classes use this subject (for context) */
  classCount: number
}

/** Allowed roles: SCHOOL_ADMIN, SLT, HEAD_OF_DEPT (read + edit their own dept), HEAD_OF_YEAR (read only) */
const SUBJECT_CONFIG_ROLES = ['SCHOOL_ADMIN', 'SLT', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR']

export async function getSubjectConfigs(): Promise<SubjectConfigRow[]> {
  const { schoolId, role } = await requireAuth()
  if (!SUBJECT_CONFIG_ROLES.includes(role)) throw new Error('Forbidden')

  // All distinct subjects in the school's classes
  const [classes, configs] = await Promise.all([
    prisma.schoolClass.groupBy({
      by:    ['subject'],
      where: { schoolId },
      _count: { subject: true },
    }),
    prisma.subjectConfig.findMany({
      where:   { schoolId },
      orderBy: { subject: 'asc' },
    }),
  ])

  const configMap = new Map(configs.map(c => [c.subject, c]))
  const classCounts = new Map(classes.map(c => [c.subject, c._count.subject]))
  const allSubjects = [...new Set([
    ...classes.map(c => c.subject),
    ...configs.map(c => c.subject),
  ])].sort()

  return allSubjects.map(subject => {
    const cfg = configMap.get(subject)
    return {
      id:         cfg?.id        ?? '',
      subject,
      examBoard:  cfg?.examBoard ?? null,
      tier:       cfg?.tier      ?? null,
      updatedAt:  cfg?.updatedAt?.toISOString() ?? '',
      classCount: classCounts.get(subject) ?? 0,
    }
  })
}

export async function saveSubjectConfig(input: {
  subject:   string
  examBoard: string
  tier:      string
}): Promise<{ ok: true; error?: never } | { ok?: never; error: string }> {
  const { schoolId, id: userId } = await requireAuth(['SCHOOL_ADMIN', 'SLT', 'HEAD_OF_DEPT'])

  const examBoard = input.examBoard || null
  const tier      = input.tier      || null

  await prisma.subjectConfig.upsert({
    where:  { schoolId_subject: { schoolId, subject: input.subject } },
    create: { schoolId, subject: input.subject, examBoard, tier, updatedBy: userId },
    update: { examBoard, tier, updatedBy: userId },
  })

  // Propagate to any classes with this subject that don't have an exam board yet
  if (examBoard) {
    await prisma.schoolClass.updateMany({
      where: { schoolId, subject: input.subject, examBoard: null },
      data:  { examBoard },
    })
  }

  await writeAudit({
    schoolId, actorId: userId, action: 'CLASS_UPDATED',
    targetType: 'SubjectConfig', targetId: input.subject,
    metadata: { subject: input.subject, examBoard, tier },
  })

  revalidatePath('/admin/subjects')
  revalidatePath('/classes')
  revalidatePath('/admin/classes')
  return { ok: true }
}

/** Apply a subject's configured exam board to ALL classes (not just unset ones). */
export async function applySubjectConfigToAllClasses(input: {
  subject:   string
  examBoard: string
}): Promise<{ ok: true; updated: number }> {
  const { schoolId, role } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) throw new Error('Forbidden')

  const result = await prisma.schoolClass.updateMany({
    where: { schoolId, subject: input.subject },
    data:  { examBoard: input.examBoard || null },
  })

  revalidatePath('/admin/subjects')
  revalidatePath('/classes')
  revalidatePath('/admin/classes')
  return { ok: true, updated: result.count }
}

// ─── Unified user management ──────────────────────────────────────────────────

export type ManagedUser = {
  id:          string
  firstName:   string
  lastName:    string
  email:       string
  role:        string
  yearGroup:   number | null
  isActive:    boolean
  activatedAt: Date | null
  createdAt:   Date
}

export type UserFilter = 'all' | 'students' | 'parents' | 'staff' | 'pending'

export async function getSchoolAllUsers(filter: UserFilter = 'all'): Promise<ManagedUser[]> {
  const { schoolId } = await requireAdminOrSlt()

  const roleFilter: Role[] | undefined =
    filter === 'students' ? ['STUDENT'] :
    filter === 'parents'  ? ['PARENT']  :
    filter === 'staff'    ? STAFF_ROLES :
    undefined

  const users = await prisma.user.findMany({
    where: {
      schoolId,
      ...(roleFilter ? { role: { in: roleFilter } } : {}),
      ...(filter === 'pending' ? { activatedAt: null, isActive: true } : {}),
    },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      role: true, yearGroup: true, isActive: true, activatedAt: true, createdAt: true,
    },
    orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    take: 500,
  })

  return users
}

export async function activateAllPendingUsers(): Promise<{ count: number }> {
  const { schoolId, id: actorId } = await requireAdminOrSlt()
  const result = await prisma.user.updateMany({
    where: { schoolId, isActive: true, activatedAt: null },
    data: { activatedAt: new Date() },
  })
  await writeAudit({ schoolId, actorId, action: 'USER_PROVISIONED', targetType: 'school', targetId: schoolId, metadata: { bulkActivated: result.count } })
  revalidatePath('/admin/users')
  revalidatePath('/admin/dashboard')
  revalidateTag('admin-dashboard-stats', 'default')
  return { count: result.count }
}

export async function deactivateUser(userId: string): Promise<void> {
  const { schoolId, id: actorId } = await requireAdminOrSlt()
  const target = await prisma.user.findFirst({ where: { id: userId, schoolId }, select: { id: true, role: true } })
  if (!target) throw new Error('User not found')

  await prisma.user.update({ where: { id: userId }, data: { isActive: false } })
  await writeAudit({ schoolId, actorId, action: 'USER_DEACTIVATED', targetType: 'user', targetId: userId, metadata: { role: target.role } })
  revalidatePath('/admin/users')
}

export async function reactivateUser(userId: string): Promise<void> {
  const { schoolId, id: actorId } = await requireAdminOrSlt()
  const target = await prisma.user.findFirst({ where: { id: userId, schoolId }, select: { id: true, role: true } })
  if (!target) throw new Error('User not found')

  await prisma.user.update({ where: { id: userId }, data: { isActive: true } })
  await writeAudit({ schoolId, actorId, action: 'USER_ROLE_CHANGED', targetType: 'user', targetId: userId, metadata: { reactivated: true } })
  revalidatePath('/admin/users')
}

export async function resendWelcomeEmail(userId: string): Promise<void> {
  const { schoolId } = await requireAdminOrSlt()
  const user   = await prisma.user.findFirst({ where: { id: userId, schoolId }, select: { id: true, email: true, firstName: true, role: true, school: { select: { name: true } } } })
  if (!user) throw new Error('User not found')

  // Invalidate previous tokens
  await prisma.passwordResetToken.updateMany({ where: { userId, used: false }, data: { used: true } })

  const raw  = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  })

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const { sendWelcomeAccountEmail } = await import('@/lib/email')
  await sendWelcomeAccountEmail({
    to:          user.email,
    firstName:   user.firstName,
    role:        user.role === 'PARENT' ? 'parent' : 'student',
    schoolName:  user.school.name,
    activateUrl: `${baseUrl}/reset-password?token=${raw}`,
  })
}

// ─── Item 5: Role + class assignment ─────────────────────────────────────────

export async function changeUserRole(userId: string, newRole: string): Promise<void> {
  const { schoolId, id: actorId } = await requireAdminOrSlt()
  const target = await prisma.user.findFirst({ where: { id: userId, schoolId }, select: { id: true, role: true } })
  if (!target) throw new Error('User not found')

  await prisma.user.update({ where: { id: userId }, data: { role: newRole as Role } })
  await writeAudit({ schoolId, actorId, action: 'USER_ROLE_CHANGED', targetType: 'user', targetId: userId, metadata: { from: target.role, to: newRole } })
  revalidatePath('/admin/users')
}

export async function updateStudentYearGroup(userId: string, yearGroup: number | null): Promise<void> {
  const { schoolId } = await requireAdminOrSlt()
  await prisma.user.updateMany({ where: { id: userId, schoolId, role: 'STUDENT' }, data: { yearGroup } })
  revalidatePath('/admin/users')
}

export type ClassOption = { id: string; name: string; subject: string; yearGroup: number }

export async function getSchoolClasses(): Promise<ClassOption[]> {
  const { schoolId } = await requireAdminOrSlt()
  return prisma.schoolClass.findMany({
    where: { schoolId },
    select: { id: true, name: true, subject: true, yearGroup: true },
    orderBy: [{ yearGroup: 'asc' }, { subject: 'asc' }, { name: 'asc' }],
  })
}

export async function getUserClasses(userId: string): Promise<string[]> {
  const { schoolId } = await requireAdminOrSlt()
  // Verify user belongs to this school
  const user = await prisma.user.findFirst({ where: { id: userId, schoolId }, select: { id: true } })
  if (!user) return []
  const rows = await prisma.classTeacher.findMany({ where: { userId }, select: { classId: true } })
  return rows.map(r => r.classId)
}

export async function setTeacherClasses(teacherId: string, classIds: string[]): Promise<void> {
  const { schoolId, id: actorId } = await requireAdminOrSlt()
  const target = await prisma.user.findFirst({ where: { id: teacherId, schoolId }, select: { id: true } })
  if (!target) throw new Error('User not found')

  await prisma.$transaction([
    prisma.classTeacher.deleteMany({ where: { userId: teacherId } }),
    ...(classIds.length > 0
      ? [prisma.classTeacher.createMany({
          data: classIds.map(classId => ({ userId: teacherId, classId })),
          skipDuplicates: true,
        })]
      : []
    ),
  ])
  await writeAudit({ schoolId, actorId, action: 'USER_CLASS_ASSIGNED', targetType: 'user', targetId: teacherId, metadata: { classIds } })
  revalidatePath('/admin/users')
  revalidateTag(`teacher-defaults-${teacherId}`, 'default')
}

// ─── Item 6: School onboarding ────────────────────────────────────────────────

export type SchoolSettings = {
  id:          string
  name:        string
  phase:       string
  urn:         string
  emailDomain: string
  onboardedAt: Date | null
}

export async function getSchoolSettings(): Promise<SchoolSettings> {
  const { schoolId } = await requireAdminOrSlt()
  const s = await prisma.school.findUniqueOrThrow({
    where: { id: schoolId as string },
    select: { id: true, name: true, phase: true, urn: true, emailDomain: true, onboardedAt: true },
  })
  return { id: s.id, name: s.name, phase: s.phase ?? '', urn: s.urn ?? '', emailDomain: s.emailDomain ?? '', onboardedAt: s.onboardedAt }
}

export async function saveSchoolSettings(data: Partial<Omit<SchoolSettings, 'id' | 'onboardedAt'>>): Promise<void> {
  const { schoolId, id: actorId } = await requireAdminOrSlt()
  await prisma.school.update({
    where: { id: schoolId as string },
    data: {
      ...(data.name        != null ? { name: data.name }               : {}),
      ...(data.phase       != null ? { phase: data.phase || null }      : {}),
      ...(data.urn         != null ? { urn: data.urn || null }          : {}),
      ...(data.emailDomain != null ? { emailDomain: data.emailDomain || null } : {}),
    },
  })
  await writeAudit({ schoolId: schoolId as string, actorId, action: 'SCHOOL_SETTINGS_UPDATED', targetType: 'school', targetId: schoolId as string, metadata: data })
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/onboarding')
}

export async function completeOnboarding(): Promise<void> {
  const { schoolId, id: actorId } = await requireAdminOrSlt()
  await prisma.school.update({ where: { id: schoolId as string }, data: { onboardedAt: new Date() } })
  await writeAudit({ schoolId: schoolId as string, actorId, action: 'SCHOOL_ONBOARDED', targetType: 'school', targetId: schoolId as string })
  revalidatePath('/admin/dashboard')
}

// ─── Student enrolments (class assignment) ────────────────────────────────────

export async function getStudentEnrolments(userId: string): Promise<string[]> {
  const { schoolId } = await requireAdminOrSlt()
  const rows = await prisma.enrolment.findMany({
    where: { userId, class: { schoolId } },
    select: { classId: true },
  })
  return rows.map(r => r.classId)
}

export async function setStudentEnrolments(studentId: string, classIds: string[]): Promise<void> {
  const { schoolId, id: actorId } = await requireAdminOrSlt()
  const student = await prisma.user.findFirst({
    where: { id: studentId, schoolId, role: 'STUDENT' },
    select: { id: true },
  })
  if (!student) throw new Error('Student not found')

  await prisma.$transaction([
    prisma.enrolment.deleteMany({ where: { userId: studentId } }),
    ...(classIds.length > 0 ? [prisma.enrolment.createMany({
      data: classIds.map(classId => ({ classId, userId: studentId })),
      skipDuplicates: true,
    })] : []),
  ])

  await writeAudit({
    schoolId: schoolId as string, actorId, action: 'USER_CLASS_ASSIGNED',
    targetType: 'user', targetId: studentId, metadata: { classIds },
  })
  revalidatePath('/admin/users')
}

// ─── Activation breakdown (for dashboard widget) ──────────────────────────────

export type ActivationByYear = { yearGroup: number | null; pending: number; total: number }[]

export async function getActivationBreakdown(): Promise<ActivationByYear> {
  const { schoolId } = await requireAdminOrSlt()
  const students = await prisma.user.findMany({
    where: { schoolId, role: 'STUDENT', isActive: true },
    select: { yearGroup: true, activatedAt: true },
  })

  const map = new Map<number | null, { pending: number; total: number }>()
  for (const s of students) {
    const yg = s.yearGroup
    if (!map.has(yg)) map.set(yg, { pending: 0, total: 0 })
    const entry = map.get(yg)!
    entry.total++
    if (!s.activatedAt) entry.pending++
  }

  return [...map.entries()]
    .sort(([a], [b]) => (a ?? 99) - (b ?? 99))
    .map(([yearGroup, counts]) => ({ yearGroup, ...counts }))
    .filter(r => r.pending > 0)
}

// ─── CSV student import ────────────────────────────────────────────────────────

export type ImportStudentRow = {
  firstName: string
  lastName:  string
  yearGroup: number | null
  className: string | null
  email:     string
}

export type ImportResult = {
  created: number
  skipped: number
  errors:  string[]
}

export async function importStudents(rows: ImportStudentRow[]): Promise<ImportResult> {
  const { schoolId, id: actorId } = await requireAdminOrSlt()

  const school = await prisma.school.findUnique({
    where: { id: schoolId as string },
    select: { id: true, name: true },
  })
  if (!school) throw new Error('School not found')

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://omnis-app-ten.vercel.app'
  const result: ImportResult = { created: 0, skipped: 0, errors: [] }

  for (const row of rows) {
    try {
      const email = row.email.toLowerCase().trim()
      if (!email || !email.includes('@')) {
        result.errors.push(`${row.firstName} ${row.lastName}: invalid email "${row.email}"`)
        continue
      }

      const existing = await prisma.user.findFirst({ where: { email } })
      if (existing) { result.skipped++; continue }

      const placeholder = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10)
      const newUser = await prisma.user.create({
        data: {
          email,
          firstName:    row.firstName.trim(),
          lastName:     row.lastName.trim(),
          role:         'STUDENT',
          passwordHash: placeholder,
          schoolId:     schoolId as string,
          yearGroup:    row.yearGroup,
        },
      })

      // Enrol in class if provided
      if (row.className) {
        const cls = await prisma.schoolClass.findFirst({
          where: { schoolId: schoolId as string, name: { equals: row.className.trim(), mode: 'insensitive' } },
          select: { id: true },
        })
        if (cls) {
          await prisma.enrolment.upsert({
            where: { classId_userId: { classId: cls.id, userId: newUser.id } },
            update: {},
            create: { classId: cls.id, userId: newUser.id },
          })
        }
      }

      // Create 7-day activation token
      const raw  = crypto.randomBytes(32).toString('hex')
      const hash = crypto.createHash('sha256').update(raw).digest('hex')
      await prisma.passwordResetToken.create({
        data: { userId: newUser.id, tokenHash: hash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      })

      const { sendWelcomeAccountEmail } = await import('@/lib/email')
      await sendWelcomeAccountEmail({
        to:          email,
        firstName:   row.firstName.trim(),
        role:        'student',
        schoolName:  school.name,
        activateUrl: `${baseUrl}/reset-password?token=${raw}`,
      })

      await writeAudit({
        schoolId: schoolId as string, actorId, action: 'USER_PROVISIONED',
        targetType: 'user', targetId: newUser.id,
        metadata: { role: 'STUDENT', source: 'csv-import' },
      })

      result.created++
    } catch (err) {
      result.errors.push(`${row.firstName} ${row.lastName}: ${String(err)}`)
    }
  }

  revalidatePath('/admin/users')
  revalidatePath('/admin/dashboard')
  return result
}

// ─── Student subject options ──────────────────────────────────────────────────

export type StudentSubjectRow = {
  id:             string
  subject:        string
  yearGroup:      number
  isCore:         boolean
  level:          string | null
  assignedClassId: string | null
  assignedClassName: string | null
}

export async function getStudentSubjects(studentId: string): Promise<StudentSubjectRow[]> {
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  // Verify the student belongs to this school
  const student = await prisma.user.findFirst({ where: { id: studentId, schoolId } })
  if (!student) return []

  const rows = await prisma.studentSubject.findMany({
    where: { studentId, schoolId },
    include: { assignedClass: { select: { id: true, name: true } } },
    orderBy: [{ isCore: 'desc' }, { subject: 'asc' }],
  })

  return rows.map(r => ({
    id:               r.id,
    subject:          r.subject,
    yearGroup:        r.yearGroup,
    isCore:           r.isCore,
    level:            r.level,
    assignedClassId:  r.assignedClassId,
    assignedClassName: r.assignedClass?.name ?? null,
  }))
}

export type SetSubjectInput = {
  subject:         string
  isCore:          boolean
  level:           string | null
  assignedClassId: string | null
}

export async function setStudentSubjects(
  studentId: string,
  subjects: SetSubjectInput[],
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const student = await prisma.user.findFirst({ where: { id: studentId, schoolId, role: 'STUDENT' } })
  if (!student) return { success: false, error: 'Student not found' }

  const yearGroup = student.yearGroup ?? 10

  await prisma.$transaction(async (tx) => {
    await tx.studentSubject.deleteMany({ where: { studentId, schoolId } })
    if (subjects.length > 0) {
      await tx.studentSubject.createMany({
        data: subjects.map(s => ({
          studentId,
          schoolId,
          subject:         s.subject,
          yearGroup,
          isCore:          s.isCore,
          level:           s.level,
          assignedClassId: s.assignedClassId || null,
        })),
      })
    }
  })

  await writeAudit({
    schoolId,
    actorId:    user.id,
    action:     'USER_SETTINGS_CHANGED',
    targetType: 'User',
    targetId:   studentId,
    metadata:   { change: 'subject-options', subjectCount: subjects.length },
  })

  revalidatePath('/admin/students')
  return { success: true }
}

export type SubjectClassOption = {
  id:        string
  name:      string
  yearGroup: number
  subject:   string
}

export async function getClassesForSubject(subject: string, yearGroup: number): Promise<SubjectClassOption[]> {
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const classes = await prisma.schoolClass.findMany({
    where:   { schoolId, subject, yearGroup },
    select:  { id: true, name: true, yearGroup: true, subject: true },
    orderBy: { name: 'asc' },
  })
  return classes
}

// Year-group overview: how many students have each subject selected
export type OptionsOverviewRow = {
  subject:      string
  isCore:       boolean
  studentCount: number
  classCount:   number
}

export async function getOptionsOverview(yearGroup: number): Promise<OptionsOverviewRow[]> {
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const rows = await prisma.studentSubject.groupBy({
    by:     ['subject', 'isCore'],
    where:  { schoolId, yearGroup },
    _count: { studentId: true },
  })

  // Get distinct class counts per subject
  const classGroups = await prisma.studentSubject.groupBy({
    by:     ['subject', 'assignedClassId'],
    where:  { schoolId, yearGroup, assignedClassId: { not: null } },
  })
  const classCounts = new Map<string, Set<string>>()
  for (const r of classGroups) {
    if (!classCounts.has(r.subject)) classCounts.set(r.subject, new Set())
    if (r.assignedClassId) classCounts.get(r.subject)!.add(r.assignedClassId)
  }

  return rows.map(r => ({
    subject:      r.subject,
    isCore:       r.isCore,
    studentCount: r._count.studentId,
    classCount:   classCounts.get(r.subject)?.size ?? 0,
  })).sort((a, b) => {
    if (a.isCore !== b.isCore) return a.isCore ? -1 : 1
    return a.subject.localeCompare(b.subject)
  })
}

// ── Parent engagement overview ────────────────────────────────────────────────

export type ParentEngagementRow = {
  id:            string
  firstName:     string
  lastName:      string
  email:         string
  lastLogin:     Date | null
  activatedAt:   Date | null
  messageCount:  number
  consentCount:  number
  childCount:    number
  childNames:    string[]
}

export async function getParentEngagementData(): Promise<ParentEngagementRow[]> {
  const u = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(u.role)) redirect('/dashboard')
  const { schoolId } = u

  const parents = await prisma.user.findMany({
    where:   { schoolId, role: 'PARENT', isActive: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: {
      id: true, firstName: true, lastName: true, email: true,
      activatedAt: true,
      childLinks: {
        select: { child: { select: { firstName: true, lastName: true } } },
      },
    },
  })

  if (parents.length === 0) return []

  const parentIds = parents.map(p => p.id)

  // Message counts per parent (as participant)
  const msgParticipants = await prisma.msgParticipant.findMany({
    where:  { userId: { in: parentIds } },
    select: { userId: true, thread: { select: { messages: { select: { id: true } } } } },
  })
  const msgCountMap = new Map<string, number>()
  for (const mp of msgParticipants) {
    msgCountMap.set(mp.userId, (msgCountMap.get(mp.userId) ?? 0) + mp.thread.messages.length)
  }

  // Consent records per parent
  const consents = await prisma.consentRecord.groupBy({
    by:    ['responderId'],
    where: { responderId: { in: parentIds }, decision: 'GRANTED' },
    _count: { id: true },
  })
  const consentMap = new Map(consents.map(c => [c.responderId, c._count.id]))

  return parents.map(p => ({
    id:           p.id,
    firstName:    p.firstName,
    lastName:     p.lastName,
    email:        p.email,
    lastLogin:    null,   // User model has no lastLogin; activatedAt is best proxy
    activatedAt:  p.activatedAt,
    messageCount: msgCountMap.get(p.id) ?? 0,
    consentCount: consentMap.get(p.id) ?? 0,
    childCount:   p.childLinks.length,
    childNames:   p.childLinks.map(l => `${l.child.firstName} ${l.child.lastName}`),
  }))
}
