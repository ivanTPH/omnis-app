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
} from '@/lib/wonde-client'

export interface WondeSyncResult {
  employees:  { upserted: number }
  students:   { upserted: number }
  contacts:   { upserted: number }
  groups:     { upserted: number }
  classes:    { upserted: number }
  enrolments: { upserted: number }
  periods:    { upserted: number }
  timetable:  { upserted: number }
  errors:     string[]
  durationMs: number
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
    employees: { upserted: 0 },
    students:  { upserted: 0 },
    contacts:  { upserted: 0 },
    groups:    { upserted: 0 },
    classes:   { upserted: 0 },
    enrolments:{ upserted: 0 },
    periods:   { upserted: 0 },
    timetable: { upserted: 0 },
    errors,
    durationMs: 0,
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

  result.durationMs = Date.now() - startedAt
  return result
}
