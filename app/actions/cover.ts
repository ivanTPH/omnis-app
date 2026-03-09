'use server'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AbsenceWithStaff = {
  id: string
  staffId: string
  staffName: string
  staffRole: string
  date: Date
  reason: string
  notes: string | null
  reportedBy: string
  createdAt: Date
  assignmentCount: number
  unassignedCount: number
}

export type AssignmentWithDetails = {
  id: string
  absenceId: string
  timetableEntryId: string
  coveredBy: string | null
  coverName: string | null
  status: string
  notes: string | null
  periodName: string
  periodStart: string
  periodEnd: string
  dayOfWeek: number | null
  className: string
  classSubject: string | null
  absentStaffName: string
}

export type AvailableStaffMember = {
  id: string
  firstName: string
  lastName: string
  title: string | null
  subjects: string[]
  coverLoadToday: number
}

export type CoverSummary = {
  absences: AbsenceWithStaff[]
  assignments: AssignmentWithDetails[]
  unassignedCount: number
  totalLessons: number
}

export type CoverHistoryEntry = {
  id: string
  staffName: string
  date: Date
  reason: string
  lessonsAffected: number
  coverageRate: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireAdminOrSlt() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any
  if (!['SCHOOL_ADMIN', 'SLT', 'COVER_MANAGER'].includes(user.role)) redirect('/dashboard')
  return user
}

function dayBounds(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getTodaysCoverSummary(
  schoolId: string,
  date?: Date,
): Promise<CoverSummary> {
  await requireAdminOrSlt()
  const target = date ?? new Date()
  const { start, end } = dayBounds(target)

  const absences = await prisma.staffAbsence.findMany({
    where: { schoolId, date: { gte: start, lte: end } },
    include: { coverAssignments: true },
    orderBy: { createdAt: 'asc' },
  })

  // Gather staff details for absent employees
  const staffIds = [...new Set(absences.map(a => a.staffId))]
  const employees = await prisma.wondeEmployee.findMany({
    where: { schoolId, id: { in: staffIds } },
  })
  const empMap = new Map(employees.map(e => [e.id, e]))

  // Gather assignment details (timetable entries, periods, classes)
  const assignmentIds = absences.flatMap(a => a.coverAssignments.map(c => c.id))
  const allAssignments = absences.flatMap(a => a.coverAssignments)
  const entryIds = [...new Set(allAssignments.map(c => c.timetableEntryId))]

  const timetableEntries = await prisma.wondeTimetableEntry.findMany({
    where: { id: { in: entryIds } },
    include: { period: true, wondeClass: true },
  })
  const entryMap = new Map(timetableEntries.map(e => [e.id, e]))

  // Gather cover supervisor names
  const coverIds = allAssignments.map(c => c.coveredBy).filter(Boolean) as string[]
  const coverEmployees =
    coverIds.length > 0
      ? await prisma.wondeEmployee.findMany({ where: { id: { in: coverIds } } })
      : []
  const coverMap = new Map(coverEmployees.map(e => [e.id, e]))

  const absencesWithStaff: AbsenceWithStaff[] = absences.map(a => {
    const emp = empMap.get(a.staffId)
    const unassigned = a.coverAssignments.filter(c => c.status === 'unassigned').length
    return {
      id: a.id,
      staffId: a.staffId,
      staffName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
      staffRole: emp?.title ?? 'Teacher',
      date: a.date,
      reason: a.reason,
      notes: a.notes,
      reportedBy: a.reportedBy,
      createdAt: a.createdAt,
      assignmentCount: a.coverAssignments.length,
      unassignedCount: unassigned,
    }
  })

  const assignmentsWithDetails: AssignmentWithDetails[] = allAssignments.map(c => {
    const entry = entryMap.get(c.timetableEntryId)
    const cover = c.coveredBy ? coverMap.get(c.coveredBy) : null
    const absence = absences.find(a => a.id === c.absenceId)!
    const absentEmp = empMap.get(absence.staffId)
    return {
      id: c.id,
      absenceId: c.absenceId,
      timetableEntryId: c.timetableEntryId,
      coveredBy: c.coveredBy,
      coverName: cover ? `${cover.firstName} ${cover.lastName}` : null,
      status: c.status,
      notes: c.notes,
      periodName: entry?.period.name ?? '',
      periodStart: entry?.period.startTime ?? '',
      periodEnd: entry?.period.endTime ?? '',
      dayOfWeek: entry?.period.dayOfWeek ?? null,
      className: entry?.wondeClass.name ?? '',
      classSubject: entry?.wondeClass.subject ?? null,
      absentStaffName: absentEmp ? `${absentEmp.firstName} ${absentEmp.lastName}` : 'Unknown',
    }
  })

  const unassignedCount = allAssignments.filter(c => c.status === 'unassigned').length

  return {
    absences: absencesWithStaff,
    assignments: assignmentsWithDetails,
    unassignedCount,
    totalLessons: allAssignments.length,
    // assignmentIds exposed for completeness — unused but harmless
  }
  // suppress unused warning
  void assignmentIds
}

export async function logAbsence(
  schoolId: string,
  data: { staffId: string; date: Date; reason: string; notes?: string },
) {
  const user = await requireAdminOrSlt()
  const { start, end } = dayBounds(data.date)

  // Create absence
  const absence = await prisma.staffAbsence.create({
    data: {
      schoolId,
      staffId: data.staffId,
      date: data.date,
      reason: data.reason,
      notes: data.notes ?? null,
      reportedBy: user.id,
    },
  })

  // Find timetable entries for this employee on that day
  const dayOfWeek = data.date.getDay() // 0=Sun, 1=Mon… match WondePeriod.dayOfWeek
  const entries = await prisma.wondeTimetableEntry.findMany({
    where: {
      schoolId,
      employeeId: data.staffId,
      period: { dayOfWeek },
    },
  })

  // Create unassigned cover for each lesson
  if (entries.length > 0) {
    await prisma.coverAssignment.createMany({
      data: entries.map(e => ({
        schoolId,
        absenceId: absence.id,
        timetableEntryId: e.id,
        status: 'unassigned',
      })),
    })
  }

  revalidatePath('/admin/cover')
  return absence
  void start; void end
}

export async function getAvailableStaff(
  schoolId: string,
  date: Date,
  periodId: string,
): Promise<AvailableStaffMember[]> {
  await requireAdminOrSlt()
  const { start, end } = dayBounds(date)

  // Get absent staff IDs for this date
  const absences = await prisma.staffAbsence.findMany({
    where: { schoolId, date: { gte: start, lte: end } },
    select: { staffId: true },
  })
  const absentIds = new Set(absences.map(a => a.staffId))

  // Get staff already covering this period
  const alreadyCovering = await prisma.coverAssignment.findMany({
    where: {
      schoolId,
      status: { not: 'cancelled' },
      absence: { date: { gte: start, lte: end } },
      timetableEntryId: {
        in: (
          await prisma.wondeTimetableEntry.findMany({
            where: { schoolId, periodId },
            select: { id: true },
          })
        ).map(e => e.id),
      },
    },
    select: { coveredBy: true },
  })
  const busyIds = new Set(alreadyCovering.map(c => c.coveredBy).filter(Boolean) as string[])

  // Get all staff not absent and not already covering
  const allStaff = await prisma.wondeEmployee.findMany({
    where: { schoolId },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  // Count how many covers each staff member already has today
  const coverCounts = await prisma.coverAssignment.groupBy({
    by: ['coveredBy'],
    where: {
      schoolId,
      status: { not: 'cancelled' },
      coveredBy: { not: null },
      absence: { date: { gte: start, lte: end } },
    },
    _count: { coveredBy: true },
  })
  const coverCountMap = new Map(coverCounts.map(c => [c.coveredBy, c._count.coveredBy]))

  return allStaff
    .filter(e => !absentIds.has(e.id) && !busyIds.has(e.id))
    .map(e => ({
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      title: e.title,
      subjects: Array.isArray(e.subjects) ? (e.subjects as string[]) : [],
      coverLoadToday: coverCountMap.get(e.id) ?? 0,
    }))
}

export async function assignCover(assignmentId: string, coveredBy: string) {
  await requireAdminOrSlt()
  const updated = await prisma.coverAssignment.update({
    where: { id: assignmentId },
    data: { coveredBy, status: 'assigned' },
  })
  revalidatePath('/admin/cover')
  return updated
}

export async function updateAssignmentStatus(assignmentId: string, status: string) {
  await requireAdminOrSlt()
  const updated = await prisma.coverAssignment.update({
    where: { id: assignmentId },
    data: { status },
  })
  revalidatePath('/admin/cover')
  return updated
}

export async function deleteAbsence(absenceId: string) {
  await requireAdminOrSlt()
  await prisma.staffAbsence.delete({ where: { id: absenceId } })
  revalidatePath('/admin/cover')
}

export async function getStaffList(schoolId: string) {
  await requireAdminOrSlt()
  return prisma.wondeEmployee.findMany({
    where: { schoolId, isTeacher: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
}

export async function getCoverHistory(
  schoolId: string,
  limit = 30,
): Promise<CoverHistoryEntry[]> {
  await requireAdminOrSlt()
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const absences = await prisma.staffAbsence.findMany({
    where: { schoolId, date: { gte: since } },
    include: { coverAssignments: true },
    orderBy: { date: 'desc' },
    take: limit,
  })

  const staffIds = [...new Set(absences.map(a => a.staffId))]
  const employees = await prisma.wondeEmployee.findMany({
    where: { id: { in: staffIds } },
  })
  const empMap = new Map(employees.map(e => [e.id, e]))

  return absences.map(a => {
    const emp = empMap.get(a.staffId)
    const total = a.coverAssignments.length
    const covered = a.coverAssignments.filter(c => ['assigned', 'confirmed'].includes(c.status)).length
    return {
      id: a.id,
      staffName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
      date: a.date,
      reason: a.reason,
      lessonsAffected: total,
      coverageRate: total > 0 ? Math.round((covered / total) * 100) : 0,
    }
  })
}
