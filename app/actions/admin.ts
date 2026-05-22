'use server'

import { auth } from '@/lib/auth'
import { prisma, writeAudit } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

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
  'SENCO', 'SCHOOL_ADMIN', 'SLT', 'COVER_MANAGER', 'TEACHING_ASSISTANT',
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
  const session = await auth()
  if (!session?.user) return { error: 'Unauthenticated' }
  const user = session.user as any
  if (!['SCHOOL_ADMIN', 'SLT', 'HEAD_OF_DEPT'].includes(user.role)) return { error: 'Forbidden' }
  const schoolId = user.schoolId as string

  await prisma.schoolClass.update({
    where: { id: input.classId, schoolId },
    data:  { examBoard: input.examBoard || null, examModules: input.examModules } as any,
  })

  await writeAudit({
    schoolId, actorId: user.id, action: 'CLASS_UPDATED',
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
