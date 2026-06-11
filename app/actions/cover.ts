'use server'

import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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
  const user = await requireAuth()
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

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const VALID_REASONS = ['illness', 'personal_leave', 'training', 'compassionate', 'unauthorised', 'other'] as const

const LogAbsenceSchema = z.object({
  staffId:   z.string().min(1, 'Staff ID required'),
  date:      z.date(),
  reason:    z.enum(VALID_REASONS, { error: 'Invalid absence reason' }),
  notes:     z.string().max(500, 'Notes must not exceed 500 characters').optional(),
  coveredBy: z.string().optional(),   // WondeEmployee.id — pre-assigns all slots on creation
})

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getTodaysCoverSummary(
  _schoolId?: string,
  date?: Date,
): Promise<CoverSummary> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string
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
  }
  // suppress unused warning
  void assignmentIds
}

export async function logAbsence(
  _schoolId: string,
  data: { staffId: string; date: Date; reason: string; notes?: string; coveredBy?: string },
) {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  // Validate input
  const validated = LogAbsenceSchema.parse(data)

  const { start, end } = dayBounds(validated.date)

  // Create absence
  const absence = await prisma.staffAbsence.create({
    data: {
      schoolId,
      staffId:     validated.staffId,
      date:        validated.date,
      reason:      validated.reason,
      notes:       validated.notes ?? null,
      reportedBy:  user.id,
    },
  })

  // Find timetable entries for this employee on that day
  const dayOfWeek = validated.date.getDay()
  const entries = await prisma.wondeTimetableEntry.findMany({
    where: {
      schoolId,
      employeeId: validated.staffId,
      period: { dayOfWeek },
    },
  })

  // Create cover slots for each lesson; pre-assign if coveredBy provided
  const coverTeacher = validated.coveredBy ?? null
  if (entries.length > 0) {
    await prisma.coverAssignment.createMany({
      data: entries.map(e => ({
        schoolId,
        absenceId:        absence.id,
        timetableEntryId: e.id,
        coveredBy:        coverTeacher,
        status:           coverTeacher ? 'assigned' : 'unassigned',
      })),
    })
  }

  revalidatePath('/admin/cover')
  return absence
  void start; void end
}

export async function getAvailableStaff(
  _schoolId: string,
  date: Date,
  periodId: string,
): Promise<AvailableStaffMember[]> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

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
  const { schoolId } = await requireAdminOrSlt()

  // Fetch assignment + timetable details for the notification body
  const assignment = await prisma.coverAssignment.findFirst({
    where: { id: assignmentId, schoolId },
    select: { timetableEntryId: true },
  })

  const updated = await prisma.coverAssignment.update({
    where: { id: assignmentId },
    data: { coveredBy, status: 'assigned' },
  })

  // Notify the cover supervisor (fire-and-forget — never throws)
  void notifyCoverSupervisor(schoolId, coveredBy, assignment?.timetableEntryId ?? null)

  revalidatePath('/admin/cover')
  return updated
}

/** Look up timetable entry details, find the matching Omnis User for the
 *  WondeEmployee, and create a COVER_ASSIGNED notification. */
async function notifyCoverSupervisor(
  schoolId:         string,
  wondeEmployeeId:  string,
  timetableEntryId: string | null,
): Promise<void> {
  try {
    const [employee, entry] = await Promise.all([
      prisma.wondeEmployee.findUnique({
        where:  { id: wondeEmployeeId },
        select: { firstName: true, lastName: true },
      }),
      timetableEntryId
        ? prisma.wondeTimetableEntry.findUnique({
            where:   { id: timetableEntryId },
            include: {
              period:     { select: { startTime: true, endTime: true } },
              wondeClass: { select: { name: true, subject: true } },
            },
          })
        : null,
    ])
    if (!employee) return

    // Name-match WondeEmployee → Omnis User
    const coverUser = await prisma.user.findFirst({
      where:  { schoolId, firstName: employee.firstName, lastName: employee.lastName, isActive: true },
      select: { id: true },
    })
    if (!coverUser) return

    const className = entry?.wondeClass.name ?? 'a class'
    const subject   = entry?.wondeClass.subject ? ` · ${entry.wondeClass.subject}` : ''
    const time      = entry
      ? ` at ${entry.period.startTime.slice(0, 5)}–${entry.period.endTime.slice(0, 5)}`
      : ''

    await prisma.notification.create({
      data: {
        schoolId,
        userId:   coverUser.id,
        type:     'COVER_ASSIGNED',
        title:    'Cover assigned to you',
        body:     `You have been assigned to cover ${className}${subject}${time}.`,
        linkHref: '/admin/cover',
      },
    })
  } catch {
    // Notification failure must never break the cover assignment workflow
  }
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
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  // Security: scope delete to admin's school to prevent cross-tenant deletion
  const absence = await prisma.staffAbsence.findFirst({ where: { id: absenceId, schoolId } })
  if (!absence) throw new Error('Absence not found')

  await prisma.staffAbsence.delete({ where: { id: absenceId } })
  revalidatePath('/admin/cover')
}

export async function getStaffList(_schoolId?: string) {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  return prisma.wondeEmployee.findMany({
    where: { schoolId, isTeacher: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
}

// ─── Auto-assign ──────────────────────────────────────────────────────────────

export type AutoAssignResult = {
  assigned: number
  skipped:  number   // no available staff found for this slot
}

/**
 * Auto-fills all unassigned cover slots for a given date.
 * Ranking: subject match > fewest covers today. Staff double-booking across
 * periods is prevented both from DB state and within this batch.
 */
export async function autoAssignCover(
  _schoolId: string,
  date: Date,
): Promise<AutoAssignResult> {
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string
  const { start, end } = dayBounds(date)

  // ── 1. Unassigned slots for today ──────────────────────────────────────────
  const unassigned = await prisma.coverAssignment.findMany({
    where: {
      schoolId,
      status: 'unassigned',
      absence: { date: { gte: start, lte: end } },
    },
    select: { id: true, timetableEntryId: true },
  })
  if (unassigned.length === 0) return { assigned: 0, skipped: 0 }

  // ── 2. Timetable entries (period + class) for all slots ────────────────────
  const entryIds = unassigned.map(u => u.timetableEntryId)
  const entries  = await prisma.wondeTimetableEntry.findMany({
    where: { id: { in: entryIds } },
    include: {
      period:     { select: { id: true } },
      wondeClass: { select: { subject: true } },
    },
  })
  const entryMap = new Map(entries.map(e => [e.id, e]))

  // ── 3. Absent staff today ──────────────────────────────────────────────────
  const todayAbsences = await prisma.staffAbsence.findMany({
    where: { schoolId, date: { gte: start, lte: end } },
    select: { staffId: true },
  })
  const absentIds = new Set(todayAbsences.map(a => a.staffId))

  // ── 4. Existing assignments today (to prevent double-booking) ─────────────
  // Build periodId → Set<staffId> of who's already covering each period
  const existingAssignments = await prisma.coverAssignment.findMany({
    where: {
      schoolId,
      status: { not: 'cancelled' },
      coveredBy: { not: null },
      absence: { date: { gte: start, lte: end } },
    },
    select: { coveredBy: true, timetableEntryId: true },
  })

  const coveredEntryIds = existingAssignments.map(c => c.timetableEntryId)
  const coveredEntries  = coveredEntryIds.length > 0
    ? await prisma.wondeTimetableEntry.findMany({
        where:  { id: { in: coveredEntryIds } },
        select: { id: true, periodId: true },
      })
    : []
  const entryToPeriodId = new Map(coveredEntries.map(e => [e.id, e.periodId]))

  // periodId → Set<staffId> already covering that period
  const periodBusy = new Map<string, Set<string>>()
  for (const ca of existingAssignments) {
    if (!ca.coveredBy) continue
    const periodId = entryToPeriodId.get(ca.timetableEntryId)
    if (!periodId) continue
    if (!periodBusy.has(periodId)) periodBusy.set(periodId, new Set())
    periodBusy.get(periodId)!.add(ca.coveredBy)
  }

  // ── 5. All staff with subjects + cover load ────────────────────────────────
  const allStaff = await prisma.wondeEmployee.findMany({
    where:  { schoolId },
    select: { id: true, subjects: true },
  })

  // cover count per staff member today (from existing assigned/confirmed slots)
  const coverLoad = new Map<string, number>()
  for (const ca of existingAssignments) {
    if (ca.coveredBy) coverLoad.set(ca.coveredBy, (coverLoad.get(ca.coveredBy) ?? 0) + 1)
  }

  // ── 6. Assign best candidate per slot ─────────────────────────────────────
  let assigned = 0
  let skipped  = 0
  const notified: { employeeId: string; timetableEntryId: string }[] = []

  for (const slot of unassigned) {
    const entry = entryMap.get(slot.timetableEntryId)
    if (!entry) { skipped++; continue }

    const periodId = entry.period.id
    const subject  = (entry.wondeClass.subject ?? '').toLowerCase()
    const busy     = periodBusy.get(periodId) ?? new Set()

    // Rank available staff: subject match first, then fewest covers today
    const candidates = allStaff
      .filter(s => !absentIds.has(s.id) && !busy.has(s.id))
      .map(s => {
        const subs  = Array.isArray(s.subjects)
          ? (s.subjects as string[]).map((x: string) => x.toLowerCase())
          : []
        const match = subject.length > 0 && subs.includes(subject)
        const load  = coverLoad.get(s.id) ?? 0
        return { id: s.id, match, load }
      })
      .sort((a, b) => {
        if (a.match !== b.match) return a.match ? -1 : 1
        return a.load - b.load
      })

    if (candidates.length === 0) { skipped++; continue }

    const best = candidates[0]
    await prisma.coverAssignment.update({
      where: { id: slot.id },
      data:  { coveredBy: best.id, status: 'assigned' },
    })

    // Update in-memory state so the next iteration respects this assignment
    if (!periodBusy.has(periodId)) periodBusy.set(periodId, new Set())
    periodBusy.get(periodId)!.add(best.id)
    coverLoad.set(best.id, (coverLoad.get(best.id) ?? 0) + 1)

    notified.push({ employeeId: best.id, timetableEntryId: slot.timetableEntryId })
    assigned++
  }

  // Batch-notify all newly assigned cover supervisors (fire-and-forget)
  void (async () => {
    try {
      // Name-match WondeEmployees → Omnis Users in one query
      const employees = await prisma.wondeEmployee.findMany({
        where:  { id: { in: notified.map(n => n.employeeId) } },
        select: { id: true, firstName: true, lastName: true },
      })
      const empMap = new Map(employees.map(e => [e.id, e]))

      const coverUsers = await prisma.user.findMany({
        where: {
          schoolId,
          isActive: true,
          OR: employees.map(e => ({ firstName: e.firstName, lastName: e.lastName })),
        },
        select: { id: true, firstName: true, lastName: true },
      })
      const userByName = new Map(coverUsers.map(u => [`${u.firstName}|${u.lastName}`, u.id]))

      // Build entry detail map
      const entryIds = notified.map(n => n.timetableEntryId)
      const entries  = await prisma.wondeTimetableEntry.findMany({
        where:   { id: { in: entryIds } },
        include: {
          period:     { select: { startTime: true, endTime: true } },
          wondeClass: { select: { name: true, subject: true } },
        },
      })
      const entryDetailMap = new Map(entries.map(e => [e.id, e]))

      const notifData = notified.flatMap(n => {
        const emp    = empMap.get(n.employeeId)
        if (!emp) return []
        const userId = userByName.get(`${emp.firstName}|${emp.lastName}`)
        if (!userId) return []
        const entry   = entryDetailMap.get(n.timetableEntryId)
        const clsName = entry?.wondeClass.name ?? 'a class'
        const subj    = entry?.wondeClass.subject ? ` · ${entry.wondeClass.subject}` : ''
        const time    = entry
          ? ` at ${entry.period.startTime.slice(0, 5)}–${entry.period.endTime.slice(0, 5)}`
          : ''
        return [{
          schoolId,
          userId,
          type:     'COVER_ASSIGNED',
          title:    'Cover assigned to you',
          body:     `You have been assigned to cover ${clsName}${subj}${time}.`,
          linkHref: '/admin/cover',
        }]
      })

      if (notifData.length > 0) {
        await prisma.notification.createMany({ data: notifData, skipDuplicates: true })
      }
    } catch { /* notification failure never blocks the response */ }
  })()

  revalidatePath('/admin/cover')
  return { assigned, skipped }
}

export async function getCoverHistory(
  _schoolId?: string,
  limit = 30,
): Promise<CoverHistoryEntry[]> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

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
