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
  fetchWondeSen,
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
  baselines:   { upserted: number }
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
    baselines:   { upserted: 0 },
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
      const yearInt     = yearCodeToInt(stu.year?.data?.code)
      const photoData   = stu.photo?.data ?? null
      // Wonde returns photo as base64 content (not a URL). Build a data URL.
      const photoUrl    = photoData?.content
        ? `data:image/jpeg;base64,${photoData.content}`
        : (photoData?.url ?? null)
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
      // Bridge MIS fields (tutorGroup, dateOfBirth, photo) to User record.
      // Always update tutorGroup + dateOfBirth when a matching User exists.
      try {
        const matchedUserId = userByName.get(`${stu.forename}|${stu.surname}`)
        if (matchedUserId) {
          const formGroup = stu.form_group?.data?.name ?? null
          const dob       = parseWondeDate(stu.date_of_birth)
          await prisma.user.update({
            where: { id: matchedUserId },
            data: {
              tutorGroup:  formGroup,
              dateOfBirth: dob,
            },
          })
        }
      } catch {
        // Best-effort — don't fail the sync
      }

      if (photoUrl) {
        try {
          const matchedUserId = userByName.get(`${stu.forename}|${stu.surname}`)
          if (matchedUserId) {
            // Store the direct Wonde CDN URL in both User.avatarUrl and
            // UserSettings.profilePictureUrl — no proxy needed; URL is publicly accessible.
            await Promise.all([
              prisma.user.update({
                where: { id: matchedUserId },
                data:  { avatarUrl: photoUrl },
              }),
              prisma.userSettings.upsert({
                where:  { userId: matchedUserId },
                create: { userId: matchedUserId, profilePictureUrl: photoUrl },
                update: { profilePictureUrl: photoUrl },
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
  // Fetched via dedicated SEN endpoint (include=sen-needs).
  // WondeStudentSen has no name fields — name lookup is done via WondeStudent DB records.
  try {
    const senStudents = await fetchWondeSen(wondeSchoolId, wondeToken)

    // Build WondeStudent id → name key from DB (already synced in section 3)
    const wondeStudentsForSen = await prisma.wondeStudent.findMany({
      where:  { schoolId: omnisSchoolId },
      select: { id: true, firstName: true, lastName: true },
    })
    const wondeNameByIdForSen = new Map(
      wondeStudentsForSen.map(ws => [ws.id, `${ws.firstName}|${ws.lastName}`])
    )

    // Pre-fetch all school student Users for send status updates
    const schoolStudentsForSen = await prisma.user.findMany({
      where:  { schoolId: omnisSchoolId, role: 'STUDENT' },
      select: { id: true, firstName: true, lastName: true },
    })
    const userByNameForSen = new Map(
      schoolStudentsForSen.map(u => [`${u.firstName}|${u.lastName}`, u.id])
    )

    await inBatches(senStudents, async stu => {
      if (!knownStudentIds.has(stu.id)) return
      const senData = stu.sen_needs?.data
      const isSen   = Array.isArray(senData) && senData.length > 0
      const isEhcp  = isSen && senData!.some(s =>
        (s.sen_category?.data?.name ?? '').toLowerCase().includes('ehcp') ||
        (s.sen_category?.data?.name ?? '').toLowerCase().includes('education, health and care')
      )

      // Primary need = highest priority (rank=1) or first entry
      const sorted      = isSen ? [...senData!].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)) : []
      const primaryNeed = sorted[0]?.sen_category?.data?.name ?? null

      await prisma.wondeSenRecord.upsert({
        where:  { studentId: stu.id },
        create: { schoolId: omnisSchoolId, studentId: stu.id, isSen, isEhcp, primaryNeed, syncedAt: now },
        update: { isSen, isEhcp, primaryNeed, syncedAt: now },
      })
      result.sen.upserted++

      // Mirror to User.sendStatus so the existing SEND system picks it up
      if (isSen) {
        const nameKey       = wondeNameByIdForSen.get(stu.id)
        const matchedUserId = nameKey ? userByNameForSen.get(nameKey) : undefined
        if (matchedUserId) {
          const sendValue = isEhcp ? 'EHCP' : 'SEN_SUPPORT'
          try {
            await prisma.sendStatus.upsert({
              where:  { studentId: matchedUserId },
              create: {
                studentId:       matchedUserId,
                activeStatus:    sendValue as any,
                needArea:        primaryNeed,
                activeSource:    'Wonde MIS sync',
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
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden') ||
        msg.includes('invalid_include') || msg.includes('400')) {
      console.warn('[wonde-sync] SEN sync skipped — sen-needs include not available for this school')
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

      // Store full attendance record
      await prisma.wondeAttendanceRecord.upsert({
        where:  { id: s.id },
        create: {
          id:                   s.id,
          schoolId:             omnisSchoolId,
          studentId:            stuId,
          possibleSessions:     s.possible_sessions   != null ? Math.round(s.possible_sessions)   : null,
          presentSessions:      s.present_sessions    != null ? Math.round(s.present_sessions)    : null,
          attendancePercentage: pct,
          authorisedAbsences:   s.authorised_absences != null ? Math.round(s.authorised_absences) : null,
          unauthorisedAbsences: s.unauthorised_absences != null ? Math.round(s.unauthorised_absences) : null,
          syncedAt:             now,
        },
        update: {
          possibleSessions:     s.possible_sessions   != null ? Math.round(s.possible_sessions)   : null,
          presentSessions:      s.present_sessions    != null ? Math.round(s.present_sessions)    : null,
          attendancePercentage: pct,
          authorisedAbsences:   s.authorised_absences != null ? Math.round(s.authorised_absences) : null,
          unauthorisedAbsences: s.unauthorised_absences != null ? Math.round(s.unauthorised_absences) : null,
        },
      })

      // Also update User.attendancePercentage via name match
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
    } else if (msg.includes('404') || msg.toLowerCase().includes('resource_not_found') || msg.toLowerCase().includes('not found')) {
      console.warn('[wonde-sync] Assessment results not available for this school')
    } else {
      errors.push(`Assessments: ${msg}`)
    }
  }

  // ── 13. Student baselines from assessment results ─────────────────────────
  // Convert the most recent WondeAssessmentResult per (student, subject) into
  // StudentBaseline records so analytics can use MIS grades as predicted grades.
  try {
    // Build WondeStudent id → User id mapping via name
    const wondeStudentsForBaseline = await prisma.wondeStudent.findMany({
      where:  { schoolId: omnisSchoolId },
      select: { id: true, firstName: true, lastName: true },
    })
    const schoolUsersForBaseline = await prisma.user.findMany({
      where:  { schoolId: omnisSchoolId, role: 'STUDENT' },
      select: { id: true, firstName: true, lastName: true },
    })
    const userByNameForBaseline = new Map(
      schoolUsersForBaseline.map(u => [`${u.firstName}|${u.lastName}`, u.id])
    )
    const wondeNameByIdForBaseline = new Map(
      wondeStudentsForBaseline.map(ws => [ws.id, `${ws.firstName}|${ws.lastName}`])
    )

    // Fetch latest assessment result per (studentId, subjectName)
    const latestAssessments = await prisma.wondeAssessmentResult.findMany({
      where:   { schoolId: omnisSchoolId, subjectName: { not: null } },
      orderBy: { collectionDate: 'desc' },
    })
    // Keep only most recent per (studentId, subject)
    const seen = new Set<string>()
    const latest = latestAssessments.filter(a => {
      const key = `${a.studentId}|${a.subjectName}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    await inBatches(latest, async a => {
      if (!a.subjectName) return
      const score = assessmentToBaselineScore(a.result, a.gradeValue)
      if (score == null) return

      const wondeName = wondeNameByIdForBaseline.get(a.studentId)
      if (!wondeName) return
      const userId = userByNameForBaseline.get(wondeName)
      if (!userId) return

      await prisma.studentBaseline.upsert({
        where:  { studentId_subject: { studentId: userId, subject: a.subjectName } },
        create: {
          studentId:     userId,
          schoolId:      omnisSchoolId,
          subject:       a.subjectName,
          baselineScore: score,
          source:        'MIS',
          recordedAt:    a.collectionDate ?? now,
        },
        update: {
          baselineScore: score,
          source:        'MIS',
          recordedAt:    a.collectionDate ?? now,
        },
      })
      result.baselines.upserted++
    })
  } catch (err) {
    errors.push(`Baselines: ${String(err)}`)
  }

  result.durationMs = Date.now() - startedAt
  return result
}

/** Convert Wonde assessment result/grade to a 0–100 normalised score. */
function assessmentToBaselineScore(result: string | null, gradeValue: string | null): number | null {
  if (result) {
    const n = parseFloat(result)
    if (!isNaN(n)) {
      // GCSE grade 1–9
      if (n >= 1 && n <= 9 && Number.isInteger(n)) return Math.round((n / 9) * 100)
      // Percentage
      if (n >= 0 && n <= 100) return n
    }
  }
  if (gradeValue) {
    const n = parseFloat(gradeValue)
    if (!isNaN(n) && n >= 1 && n <= 9) return Math.round((n / 9) * 100)
    const gradeMap: Record<string, number> = {
      'A*': 97, 'A': 85, 'B': 75, 'C': 65, 'D': 55, 'E': 45, 'F': 35, 'U': 15,
      'Distinction*': 97, 'Distinction': 85, 'Merit': 70, 'Pass': 55,
    }
    return gradeMap[gradeValue] ?? null
  }
  return null
}
