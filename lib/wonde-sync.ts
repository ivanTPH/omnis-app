/**
 * Wonde MIS Sync — full + delta sync
 * Pulls live data from the Wonde API and upserts into the local Wonde* tables.
 * Does NOT modify User/SchoolClass — those are separate provisioning steps.
 *
 * Performance design:
 * - All upsert loops run in parallel batches of BATCH (10) instead of sequentially.
 * - FK existence checks (employee/group/student/class/period) use in-memory Sets built
 *   during the loop — zero extra DB round-trips per record.
 * - Photo bridge uses a single pre-fetched Map of school student Users.
 *
 * ── Data sourcing note (for Wonde support — April 2026) ─────────────────────
 * ILP and EHCP data is generated internally by Omnis AI.
 * We do not import these from Wonde.
 * We would benefit from: SEN status (synced), EHCP flag,
 * prior attainment/SATs scores, attendance, behaviour flags
 * — request made to Wonde support April 2026.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from '@/lib/prisma'
import {
  fetchWondeSchool,
  fetchWondeEmployees,
  fetchWondeStudents,
  fetchWondeGroups,
  fetchWondeClasses,
  fetchWondePeriods,
  fetchWondeTimetableEntries,
  fetchWondeAttendanceSummaries,
  fetchWondeBehaviours,
  fetchWondeExclusions,
  fetchWondeAssessmentResults,
} from '@/lib/wonde-client'

export interface WondeSyncResult {
  employees:   { upserted: number }
  students:    { upserted: number }
  contacts:    { upserted: number }
  groups:      { upserted: number }
  classes:     { upserted: number }
  enrolments:  { upserted: number }
  periods:     { upserted: number }
  timetable:   { upserted: number }
  sen:         { upserted: number }
  attendance:  { upserted: number }
  behaviours:  { upserted: number }
  exclusions:  { upserted: number }
  assessments: { upserted: number }
  errors:      string[]
  durationMs:  number
}

function parseWondeDate(d: { date: string } | null | undefined): Date | null {
  if (!d?.date) return null
  return new Date(d.date)
}

function yearCodeToInt(code: string | undefined): number | null {
  if (!code) return null
  const n = parseInt(code.replace(/\D/g, ''), 10)
  return isNaN(n) ? null : n
}

/** Run `fn` over `items` in parallel chunks of `size`. */
async function inBatches<T>(items: T[], fn: (item: T) => Promise<void>, size = 10): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn))
  }
}

// ── Main sync entry point ─────────────────────────────────────────────────────

export async function runWondeSync(
  omnisSchoolId: string,   // our internal School.id
  wondeSchoolId: string,   // e.g. "A1930499544"
  wondeToken:   string,
): Promise<WondeSyncResult> {
  const startedAt = Date.now()
  const errors: string[] = []

  const result: WondeSyncResult = {
    employees:   { upserted: 0 },
    students:    { upserted: 0 },
    contacts:    { upserted: 0 },
    groups:      { upserted: 0 },
    classes:     { upserted: 0 },
    enrolments:  { upserted: 0 },
    periods:     { upserted: 0 },
    timetable:   { upserted: 0 },
    sen:         { upserted: 0 },
    attendance:  { upserted: 0 },
    behaviours:  { upserted: 0 },
    exclusions:  { upserted: 0 },
    assessments: { upserted: 0 },
    errors,
    durationMs:  0,
  }

  const now = new Date()

  // ID sets built as each section completes — used for FK existence checks later.
  // This removes all per-record findUnique existence checks entirely.
  const knownEmployeeIds = new Set<string>()
  const knownGroupIds    = new Set<string>()
  const knownStudentIds  = new Set<string>()
  const knownClassIds    = new Set<string>()
  const knownPeriodIds   = new Set<string>()

  try {
    // ── 1. Upsert WondeSchool record ──────────────────────────────────────────
    const school = await fetchWondeSchool(wondeSchoolId, wondeToken)
    await prisma.wondeSchool.upsert({
      where:  { schoolId: omnisSchoolId },
      create: {
        id:                  school.id,
        schoolId:            omnisSchoolId,
        wondeToken,
        mis:                 school.mis_provider?.name ?? null,
        phaseOfEducation:    school.phase_of_education?.name ?? null,
        urn:                 school.urn ?? null,
        establishmentNumber: school.establishment_number ?? null,
        syncedAt:            now,
      },
      update: {
        mis:                 school.mis_provider?.name ?? null,
        phaseOfEducation:    school.phase_of_education?.name ?? null,
        urn:                 school.urn ?? null,
        establishmentNumber: school.establishment_number ?? null,
        syncedAt:            now,
        lastDeltaAt:         now,
      },
    })
  } catch (err) {
    errors.push(`WondeSchool: ${String(err)}`)
  }

  // ── 2. Employees ─────────────────────────────────────────────────────────
  try {
    const employees = await fetchWondeEmployees(wondeSchoolId, wondeToken)
    await inBatches(employees, async emp => {
      const subjects = emp.subjects?.data.map(s => s.name) ?? []
      await prisma.wondeEmployee.upsert({
        where:  { id: emp.id },
        create: {
          id:             emp.id,
          schoolId:       omnisSchoolId,
          misId:          emp.mis_id ?? null,
          firstName:      emp.forename,
          lastName:       emp.surname,
          email:          emp.email ?? null,
          title:          emp.title ?? null,
          isTeacher:      emp.is_teacher,
          subjects,
          wondeUpdatedAt: parseWondeDate(emp.updated_at),
          syncedAt:       now,
        },
        update: {
          misId:          emp.mis_id ?? null,
          firstName:      emp.forename,
          lastName:       emp.surname,
          email:          emp.email ?? null,
          title:          emp.title ?? null,
          isTeacher:      emp.is_teacher,
          subjects,
          wondeUpdatedAt: parseWondeDate(emp.updated_at),
          updatedAt:      now,
        },
      })
      knownEmployeeIds.add(emp.id)
      result.employees.upserted++
    })
  } catch (err) {
    errors.push(`Employees: ${String(err)}`)
  }

  // ── 3. Students (+ contacts) ──────────────────────────────────────────────
  try {
    const students = await fetchWondeStudents(wondeSchoolId, wondeToken)

    // Pre-fetch all school student Users in one query for the photo bridge.
    const schoolStudentUsers = await prisma.user.findMany({
      where:  { schoolId: omnisSchoolId, role: 'STUDENT' },
      select: { id: true, firstName: true, lastName: true },
    })
    const userByName = new Map(
      schoolStudentUsers.map(u => [`${u.firstName}|${u.lastName}`, u.id])
    )

    await inBatches(students, async stu => {
      const yearInt  = yearCodeToInt(stu.year?.data?.code)
      const photoUrl = stu.photo?.data?.url ?? null
      await prisma.wondeStudent.upsert({
        where:  { id: stu.id },
        create: {
          id:             stu.id,
          schoolId:       omnisSchoolId,
          misId:          stu.mis_id ?? null,
          upn:            stu.upn ?? null,
          firstName:      stu.forename,
          lastName:       stu.surname,
          dob:            parseWondeDate(stu.date_of_birth),
          yearGroup:      yearInt,
          formGroup:      stu.form_group?.data?.name ?? null,
          isLeaver:       stu.is_leaver,
          photoUrl,
          wondeUpdatedAt: parseWondeDate(stu.updated_at),
          syncedAt:       now,
        },
        update: {
          misId:          stu.mis_id ?? null,
          upn:            stu.upn ?? null,
          firstName:      stu.forename,
          lastName:       stu.surname,
          dob:            parseWondeDate(stu.date_of_birth),
          yearGroup:      yearInt,
          formGroup:      stu.form_group?.data?.name ?? null,
          isLeaver:       stu.is_leaver,
          photoUrl,
          wondeUpdatedAt: parseWondeDate(stu.updated_at),
          updatedAt:      now,
        },
      })
      knownStudentIds.add(stu.id)
      result.students.upserted++

      // Bridge photo URL to User.avatarUrl AND UserSettings.profilePictureUrl.
      // User.avatarUrl is read by homework, messaging, and SEND queries directly.
      // UserSettings.profilePictureUrl is read by the teacher class roster and AppShell.
      // Both must be set so photos appear everywhere after a Wonde sync.
      // Match by firstName + lastName within the school (best effort for demo).
      //
      // We store a proxy URL (/api/student-photo/{userId}) rather than the raw Wonde URL.
      // The proxy route fetches the image server-side with the Wonde API token, so the
      // browser never needs to supply an Authorization header.
      if (photoUrl) {
        try {
          const matchedUserId = userByName.get(`${stu.forename}|${stu.surname}`)
          if (matchedUserId) {
            const proxyUrl = `/api/student-photo/${matchedUserId}`
            await Promise.all([
              prisma.user.update({
                where: { id: matchedUserId },
                data:  { avatarUrl: proxyUrl },
              }),
              prisma.userSettings.upsert({
                where:  { userId: matchedUserId },
                create: { userId: matchedUserId, profilePictureUrl: proxyUrl },
                update: { profilePictureUrl: proxyUrl },
              }),
            ])
          }
        } catch {
          // Photo bridge is best-effort; don't fail the sync
        }
      }

      // Contacts — sequential within each student (inner try/catch per record)
      if (stu.contacts?.data) {
        for (const c of stu.contacts.data) {
          try {
            // API returns relationship as a nested object; extract the string label
            const relObj = typeof c.relationship === 'object' && c.relationship !== null
              ? (c.relationship as { relationship?: string | null; parental_responsibility?: boolean | null })
              : null
            const relationshipStr = relObj
              ? (relObj.relationship ?? null)
              : (typeof c.relationship === 'string' ? c.relationship : null)
            const parentalResp = relObj
              ? (relObj.parental_responsibility ?? false)
              : false

            await prisma.wondeContact.upsert({
              where:  { id: c.id },
              create: {
                id:                    c.id,
                schoolId:              omnisSchoolId,
                studentId:             stu.id,
                firstName:             c.forename,
                lastName:              c.surname,
                email:                 c.email ?? null,
                phone:                 c.telephone ?? c.mobile ?? null,
                relationship:          relationshipStr,
                parentalResponsibility:parentalResp,
                syncedAt:              now,
              },
              update: {
                firstName:             c.forename,
                lastName:              c.surname,
                email:                 c.email ?? null,
                phone:                 c.telephone ?? c.mobile ?? null,
                relationship:          relationshipStr,
                parentalResponsibility:parentalResp,
              },
            })
            result.contacts.upserted++
          } catch (contactErr) {
            errors.push(`Contact ${c.id}: ${String(contactErr)}`)
          }
        }
      }
    })
  } catch (err) {
    errors.push(`Students/Contacts: ${String(err)}`)
  }

  // ── 4. Groups ─────────────────────────────────────────────────────────────
  try {
    const groups = await fetchWondeGroups(wondeSchoolId, wondeToken)
    await inBatches(groups, async g => {
      await prisma.wondeGroup.upsert({
        where:  { id: g.id },
        create: {
          id:             g.id,
          schoolId:       omnisSchoolId,
          misId:          g.mis_id ?? null,
          name:           g.name,
          description:    g.description ?? null,
          type:           g.type ?? null,
          wondeUpdatedAt: parseWondeDate(g.updated_at),
          syncedAt:       now,
        },
        update: {
          misId:          g.mis_id ?? null,
          name:           g.name,
          description:    g.description ?? null,
          type:           g.type ?? null,
          wondeUpdatedAt: parseWondeDate(g.updated_at),
        },
      })
      knownGroupIds.add(g.id)
      result.groups.upserted++
    })
  } catch (err) {
    errors.push(`Groups: ${String(err)}`)
  }

  // ── 5. Classes (+ enrolments) ─────────────────────────────────────────────
  // FK existence is checked via in-memory Sets — no per-class findUnique calls.
  try {
    const classes = await fetchWondeClasses(wondeSchoolId, wondeToken)

    // Pass 1: upsert all classes in parallel batches
    await inBatches(classes, async cls => {
      const yearInt    = yearCodeToInt(cls.year?.data?.code)
      const employeeId = cls.employee?.data?.id ?? null
      const groupId    = cls.group?.data?.id    ?? null

      await prisma.wondeClass.upsert({
        where:  { id: cls.id },
        create: {
          id:             cls.id,
          schoolId:       omnisSchoolId,
          misId:          cls.mis_id ?? null,
          name:           cls.name,
          subject:        cls.subject?.data?.name ?? null,
          yearGroup:      yearInt,
          employeeId:     (employeeId && knownEmployeeIds.has(employeeId)) ? employeeId : null,
          groupId:        (groupId    && knownGroupIds.has(groupId))       ? groupId    : null,
          wondeUpdatedAt: parseWondeDate(cls.updated_at),
          syncedAt:       now,
        },
        update: {
          misId:          cls.mis_id ?? null,
          name:           cls.name,
          subject:        cls.subject?.data?.name ?? null,
          yearGroup:      yearInt,
          employeeId:     (employeeId && knownEmployeeIds.has(employeeId)) ? employeeId : null,
          groupId:        (groupId    && knownGroupIds.has(groupId))       ? groupId    : null,
          wondeUpdatedAt: parseWondeDate(cls.updated_at),
        },
      })
      knownClassIds.add(cls.id)
      result.classes.upserted++
    })

    // Pass 2: upsert all enrolments in parallel batches (all classes now in DB)
    const allEnrolments: Array<{ classId: string; studentId: string }> = []
    for (const cls of classes) {
      if (cls.students?.data) {
        for (const stu of cls.students.data) {
          if (knownStudentIds.has(stu.id)) {
            allEnrolments.push({ classId: cls.id, studentId: stu.id })
          }
        }
      }
    }
    await inBatches(allEnrolments, async ({ classId, studentId }) => {
      await prisma.wondeClassStudent.upsert({
        where:  { classId_studentId: { classId, studentId } },
        create: { classId, studentId },
        update: {},
      })
      result.enrolments.upserted++
    })
  } catch (err) {
    errors.push(`Classes/Enrolments: ${String(err)}`)
  }

  // ── 6. Periods ────────────────────────────────────────────────────────────
  try {
    const periods = await fetchWondePeriods(wondeSchoolId, wondeToken)
    const DAY_MAP: Record<string, number> = {
      monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
      friday: 5, saturday: 6, sunday: 7,
    }
    await inBatches(periods, async p => {
      // API returns day as a string ("monday") — map to ISO weekday int (1=Mon…7=Sun)
      const dayOfWeek = p.day_number ?? (p.day ? (DAY_MAP[p.day.toLowerCase()] ?? null) : null)
      await prisma.wondePeriod.upsert({
        where:  { id: p.id },
        create: {
          id:        p.id,
          schoolId:  omnisSchoolId,
          name:      p.name,
          startTime: p.start_time ?? '',
          endTime:   p.end_time ?? '',
          dayOfWeek,
        },
        update: {
          name:      p.name,
          startTime: p.start_time ?? '',
          endTime:   p.end_time ?? '',
          dayOfWeek,
        },
      })
      knownPeriodIds.add(p.id)
      result.periods.upserted++
    })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission')) {
      console.warn('[wonde-sync] Periods sync skipped — enable periods.read permission in Wonde dashboard to sync timetable data')
    } else {
      errors.push(`Periods: ${msg}`)
    }
  }

  // ── 7. Timetable entries ──────────────────────────────────────────────────
  // FK existence is checked via in-memory Sets — no per-entry findUnique calls.
  try {
    const entries = await fetchWondeTimetableEntries(wondeSchoolId, wondeToken)
    const validEntries = entries.filter(e => {
      const classId  = e.class?.data?.id ?? null
      const periodId = e.period ?? null
      return classId && periodId && knownClassIds.has(classId) && knownPeriodIds.has(periodId)
    })
    await inBatches(validEntries, async e => {
      const classId    = e.class!.data!.id
      const periodId   = e.period as string
      const employeeId = (e.employee && knownEmployeeIds.has(e.employee as string))
        ? (e.employee as string)
        : null

      await prisma.wondeTimetableEntry.upsert({
        where:  { id: e.id },
        create: {
          id:            e.id,
          schoolId:      omnisSchoolId,
          classId,
          employeeId,
          periodId,
          // room is a flat string name in the API response
          roomName:      e.room ?? null,
          effectiveDate: parseWondeDate(e.effective_date),
        },
        update: {
          classId,
          employeeId,
          periodId,
          roomName:      e.room ?? null,
          effectiveDate: parseWondeDate(e.effective_date),
        },
      })
      result.timetable.upserted++
    })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission')) {
      console.warn('[wonde-sync] Timetable sync skipped — enable lessons.read permission in Wonde dashboard to sync timetable data')
    } else {
      errors.push(`Timetable: ${msg}`)
    }
  }

  // ── 8. SEN records ────────────────────────────────────────────────────────
  // SEN is already included in the student fetch (include=sen). We process it
  // here using the already-fetched students from section 3. The wondeStudent
  // records are now in DB (knownStudentIds). We map primaryNeed to User.sendStatus.
  try {
    // Re-fetch students with sen include for the SEN data
    const studentsWithSen = await fetchWondeStudents(wondeSchoolId, wondeToken)

    // Pre-fetch all school student Users once more for send status updates
    const schoolStudentsForSen = await prisma.user.findMany({
      where:  { schoolId: omnisSchoolId, role: 'STUDENT' },
      select: { id: true, firstName: true, lastName: true },
    })
    const userByNameForSen = new Map(
      schoolStudentsForSen.map(u => [`${u.firstName}|${u.lastName}`, u.id])
    )

    await inBatches(studentsWithSen, async stu => {
      if (!knownStudentIds.has(stu.id)) return
      // `sen_needs` is populated when include=sen is used
      const senData = (stu as any).sen_needs?.data as Array<{ rank: number | null; sen_category?: { data: { name: string } | null } | null }> | undefined
      const isSen   = Array.isArray(senData) && senData.length > 0
      const isEhcp  = (stu as any).has_ehcp === true

      // Primary need = highest priority (rank=1) or first entry
      const sorted  = isSen ? [...senData].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)) : []
      const primaryNeed = sorted[0]?.sen_category?.data?.name ?? null

      await prisma.wondeSenRecord.upsert({
        where:  { studentId: stu.id },
        create: { schoolId: omnisSchoolId, studentId: stu.id, isSen, isEhcp, primaryNeed, syncedAt: now },
        update: { isSen, isEhcp, primaryNeed, syncedAt: now },
      })
      result.sen.upserted++

      // Mirror to User.sendStatus so the existing SEND system picks it up
      if (isSen) {
        const matchedUserId = userByNameForSen.get(`${stu.forename}|${stu.surname}`)
        if (matchedUserId) {
          const sendValue = isEhcp ? 'EHCP' : 'SEN_SUPPORT'
          try {
            await prisma.sendStatus.upsert({
              where:  { studentId: matchedUserId },
              create: {
                studentId:      matchedUserId,
                activeStatus:   sendValue as any,
                needArea:       primaryNeed,
                activeSource:   'Wonde MIS sync',
                latestMisStatus: sendValue as any,
                misLastSyncedAt: now,
              },
              update: {
                activeStatus:    sendValue as any,
                needArea:        primaryNeed ?? undefined,
                latestMisStatus: sendValue as any,
                misLastSyncedAt: now,
              },
            })
          } catch {
            // SEND status update is best-effort
          }
        }
      }
    })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
      console.warn('[wonde-sync] SEN sync skipped — enable sen.read permission in Wonde dashboard')
    } else {
      errors.push(`SEN: ${msg}`)
    }
  }

  // ── 9. Attendance summaries ───────────────────────────────────────────────
  try {
    const summaries = await fetchWondeAttendanceSummaries(wondeSchoolId, wondeToken)

    // Map WondeStudent.id → User.id for attendance update
    const wondeStudentUsers = await prisma.wondeStudent.findMany({
      where:  { schoolId: omnisSchoolId },
      select: { id: true, firstName: true, lastName: true },
    })
    const schoolStudentsForAtt = await prisma.user.findMany({
      where:  { schoolId: omnisSchoolId, role: 'STUDENT' },
      select: { id: true, firstName: true, lastName: true },
    })
    const userByNameForAtt = new Map(
      schoolStudentsForAtt.map(u => [`${u.firstName}|${u.lastName}`, u.id])
    )
    const wondeStudentNameById = new Map(
      wondeStudentUsers.map(ws => [ws.id, `${ws.firstName}|${ws.lastName}`])
    )

    await inBatches(summaries, async s => {
      const stuId = s.student?.data?.id
      if (!stuId || !knownStudentIds.has(stuId)) return
      const pct = s.attendance_percentage

      // Update User.attendancePercentage via name match
      const nameKey = wondeStudentNameById.get(stuId)
      if (nameKey && pct != null) {
        const userId = userByNameForAtt.get(nameKey)
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data:  { attendancePercentage: pct },
          })
        }
      }
      result.attendance.upserted++
    })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
      console.warn('[wonde-sync] Attendance sync skipped — enable attendance.read permission in Wonde dashboard')
    } else {
      errors.push(`Attendance: ${msg}`)
    }
  }

  // ── 10. Behaviour records ─────────────────────────────────────────────────
  try {
    const behaviours = await fetchWondeBehaviours(wondeSchoolId, wondeToken)

    // Tally per-student counts then write to User + WondeBehaviourRecord
    const schoolStudentsForBeh = await prisma.user.findMany({
      where:  { schoolId: omnisSchoolId, role: 'STUDENT' },
      select: { id: true, firstName: true, lastName: true },
    })
    const wondeStudentsForBeh = await prisma.wondeStudent.findMany({
      where:  { schoolId: omnisSchoolId },
      select: { id: true, firstName: true, lastName: true },
    })
    const userByNameForBeh = new Map(
      schoolStudentsForBeh.map(u => [`${u.firstName}|${u.lastName}`, u.id])
    )
    const wondeStudentNameByIdBeh = new Map(
      wondeStudentsForBeh.map(ws => [ws.id, `${ws.firstName}|${ws.lastName}`])
    )
    const positiveCount = new Map<string, number>()
    const negativeCount = new Map<string, number>()

    await inBatches(behaviours, async b => {
      const stuId = b.student?.data?.id
      if (!stuId || !knownStudentIds.has(stuId)) return

      await prisma.wondeBehaviourRecord.upsert({
        where:  { id: b.id },
        create: {
          id:        b.id,
          schoolId:  omnisSchoolId,
          studentId: stuId,
          type:      b.type ?? null,
          category:  b.category ?? null,
          points:    b.points ? Math.round(b.points) : null,
          occurredAt: b.date?.date ? new Date(b.date.date) : null,
          syncedAt:   now,
        },
        update: {
          type:      b.type ?? null,
          category:  b.category ?? null,
          points:    b.points ? Math.round(b.points) : null,
          occurredAt: b.date?.date ? new Date(b.date.date) : null,
        },
      })
      result.behaviours.upserted++

      const isPositive = (b.type ?? '').toLowerCase() === 'positive'
      if (isPositive) positiveCount.set(stuId, (positiveCount.get(stuId) ?? 0) + 1)
      else            negativeCount.set(stuId, (negativeCount.get(stuId) ?? 0) + 1)
    })

    // Write summarised counts to User model
    const allStuIds = new Set([...positiveCount.keys(), ...negativeCount.keys()])
    await inBatches([...allStuIds], async stuId => {
      const nameKey = wondeStudentNameByIdBeh.get(stuId)
      if (!nameKey) return
      const userId = userByNameForBeh.get(nameKey)
      if (!userId) return
      await prisma.user.update({
        where: { id: userId },
        data:  {
          behaviourPositive: positiveCount.get(stuId) ?? 0,
          behaviourNegative: negativeCount.get(stuId) ?? 0,
        },
      })
    })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
      console.warn('[wonde-sync] Behaviour sync skipped — enable behaviour.read permission in Wonde dashboard')
    } else {
      errors.push(`Behaviours: ${msg}`)
    }
  }

  // ── 11. Exclusion records ─────────────────────────────────────────────────
  try {
    const exclusions = await fetchWondeExclusions(wondeSchoolId, wondeToken)

    const schoolStudentsForExc = await prisma.user.findMany({
      where:  { schoolId: omnisSchoolId, role: 'STUDENT' },
      select: { id: true, firstName: true, lastName: true },
    })
    const wondeStudentsForExc = await prisma.wondeStudent.findMany({
      where:  { schoolId: omnisSchoolId },
      select: { id: true, firstName: true, lastName: true },
    })
    const userByNameForExc = new Map(
      schoolStudentsForExc.map(u => [`${u.firstName}|${u.lastName}`, u.id])
    )
    const wondeStudentNameByIdExc = new Map(
      wondeStudentsForExc.map(ws => [ws.id, `${ws.firstName}|${ws.lastName}`])
    )
    const studentsWithExclusions = new Set<string>()

    await inBatches(exclusions, async ex => {
      const stuId = ex.student?.data?.id
      if (!stuId || !knownStudentIds.has(stuId)) return

      await prisma.wondeExclusionRecord.upsert({
        where:  { id: ex.id },
        create: {
          id:        ex.id,
          schoolId:  omnisSchoolId,
          studentId: stuId,
          type:      ex.type ?? null,
          reason:    ex.reason ?? null,
          startDate: ex.start_date?.date ? new Date(ex.start_date.date) : null,
          endDate:   ex.end_date?.date   ? new Date(ex.end_date.date)   : null,
          lengthDays: ex.length ? Math.round(ex.length) : null,
          syncedAt:   now,
        },
        update: {
          type:      ex.type ?? null,
          reason:    ex.reason ?? null,
          startDate: ex.start_date?.date ? new Date(ex.start_date.date) : null,
          endDate:   ex.end_date?.date   ? new Date(ex.end_date.date)   : null,
          lengthDays: ex.length ? Math.round(ex.length) : null,
        },
      })
      result.exclusions.upserted++
      studentsWithExclusions.add(stuId)
    })

    // Mark User.hasExclusion
    await inBatches([...studentsWithExclusions], async stuId => {
      const nameKey = wondeStudentNameByIdExc.get(stuId)
      if (!nameKey) return
      const userId = userByNameForExc.get(nameKey)
      if (!userId) return
      await prisma.user.update({ where: { id: userId }, data: { hasExclusion: true } })
    })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
      console.warn('[wonde-sync] Exclusion sync skipped — enable exclusion.read permission in Wonde dashboard')
    } else {
      errors.push(`Exclusions: ${msg}`)
    }
  }

  // ── 12. Assessment results ────────────────────────────────────────────────
  try {
    const assessments = await fetchWondeAssessmentResults(wondeSchoolId, wondeToken)
    await inBatches(assessments, async a => {
      const stuId = a.student?.data?.id
      if (!stuId || !knownStudentIds.has(stuId)) return
      await prisma.wondeAssessmentResult.upsert({
        where:  { id: a.id },
        create: {
          id:            a.id,
          schoolId:      omnisSchoolId,
          studentId:     stuId,
          subjectName:   a.subject?.data?.name  ?? null,
          resultSetName: a.result_set?.data?.name ?? null,
          aspectName:    a.aspect?.data?.name   ?? null,
          result:        a.result               ?? null,
          gradeValue:    a.grade?.data?.value   ?? null,
          collectionDate: a.collection_date?.date ? new Date(a.collection_date.date) : null,
          syncedAt:       now,
        },
        update: {
          subjectName:   a.subject?.data?.name  ?? null,
          resultSetName: a.result_set?.data?.name ?? null,
          aspectName:    a.aspect?.data?.name   ?? null,
          result:        a.result               ?? null,
          gradeValue:    a.grade?.data?.value   ?? null,
          collectionDate: a.collection_date?.date ? new Date(a.collection_date.date) : null,
        },
      })
      result.assessments.upserted++
    })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
      console.warn('[wonde-sync] Assessment results sync skipped — enable assessment.read permission in Wonde dashboard')
    } else {
      errors.push(`Assessments: ${msg}`)
    }
  }

  result.durationMs = Date.now() - startedAt
  return result
}
