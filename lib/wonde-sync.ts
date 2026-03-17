/**
 * Wonde MIS Sync — full + delta sync
 * Pulls live data from the Wonde API and upserts into the local Wonde* tables.
 * Does NOT modify User/SchoolClass — those are separate provisioning steps.
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
    for (const emp of employees) {
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
      result.employees.upserted++
    }
  } catch (err) {
    errors.push(`Employees: ${String(err)}`)
  }

  // ── 3. Students (+ contacts) ──────────────────────────────────────────────
  try {
    const students = await fetchWondeStudents(wondeSchoolId, wondeToken)
    for (const stu of students) {
      const yearInt = yearCodeToInt(stu.year?.data?.code)
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
          wondeUpdatedAt: parseWondeDate(stu.updated_at),
          updatedAt:      now,
        },
      })
      result.students.upserted++

      // Contacts
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
    }
  } catch (err) {
    errors.push(`Students/Contacts: ${String(err)}`)
  }

  // ── 4. Groups ─────────────────────────────────────────────────────────────
  try {
    const groups = await fetchWondeGroups(wondeSchoolId, wondeToken)
    for (const g of groups) {
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
      result.groups.upserted++
    }
  } catch (err) {
    errors.push(`Groups: ${String(err)}`)
  }

  // ── 5. Classes (+ enrolments) ─────────────────────────────────────────────
  try {
    const classes = await fetchWondeClasses(wondeSchoolId, wondeToken)
    for (const cls of classes) {
      const yearInt = yearCodeToInt(cls.year?.data?.code)
      const employeeId = cls.employee?.data?.id ?? null
      const groupId    = cls.group?.data?.id ?? null

      // Only link employee if we have that record
      const empExists = employeeId
        ? (await prisma.wondeEmployee.findUnique({ where: { id: employeeId }, select: { id: true } })) !== null
        : false
      const grpExists = groupId
        ? (await prisma.wondeGroup.findUnique({ where: { id: groupId }, select: { id: true } })) !== null
        : false

      await prisma.wondeClass.upsert({
        where:  { id: cls.id },
        create: {
          id:             cls.id,
          schoolId:       omnisSchoolId,
          misId:          cls.mis_id ?? null,
          name:           cls.name,
          subject:        cls.subject?.data?.name ?? null,
          yearGroup:      yearInt,
          employeeId:     empExists ? employeeId : null,
          groupId:        grpExists ? groupId    : null,
          wondeUpdatedAt: parseWondeDate(cls.updated_at),
          syncedAt:       now,
        },
        update: {
          misId:          cls.mis_id ?? null,
          name:           cls.name,
          subject:        cls.subject?.data?.name ?? null,
          yearGroup:      yearInt,
          employeeId:     empExists ? employeeId : null,
          groupId:        grpExists ? groupId    : null,
          wondeUpdatedAt: parseWondeDate(cls.updated_at),
        },
      })
      result.classes.upserted++

      // Enrolments
      if (cls.students?.data) {
        for (const stu of cls.students.data) {
          const stuExists = await prisma.wondeStudent.findUnique({
            where:  { id: stu.id },
            select: { id: true },
          })
          if (!stuExists) continue
          await prisma.wondeClassStudent.upsert({
            where:  { classId_studentId: { classId: cls.id, studentId: stu.id } },
            create: { classId: cls.id, studentId: stu.id },
            update: {},
          })
          result.enrolments.upserted++
        }
      }
    }
  } catch (err) {
    errors.push(`Classes/Enrolments: ${String(err)}`)
  }

  // ── 6. Periods ────────────────────────────────────────────────────────────
  try {
    const periods = await fetchWondePeriods(wondeSchoolId, wondeToken)
    for (const p of periods) {
      // API returns day as a string ("monday") — map to ISO weekday int (1=Mon…7=Sun)
      const DAY_MAP: Record<string, number> = {
        monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
        friday: 5, saturday: 6, sunday: 7,
      }
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
      result.periods.upserted++
    }
  } catch (err) {
    const msg = String(err)
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission')) {
      console.warn('[wonde-sync] Periods sync skipped — enable periods.read permission in Wonde dashboard to sync timetable data')
    } else {
      errors.push(`Periods: ${msg}`)
    }
  }

  // ── 7. Timetable entries ──────────────────────────────────────────────────
  try {
    const entries = await fetchWondeTimetableEntries(wondeSchoolId, wondeToken)
    for (const e of entries) {
      const classId    = e.class?.data?.id ?? null
      // period and employee come back as flat string IDs (not nested objects)
      const employeeId = e.employee ?? null
      const periodId   = e.period ?? null

      if (!classId || !periodId) continue

      const [clsExists, perExists] = await Promise.all([
        prisma.wondeClass.findUnique({ where: { id: classId }, select: { id: true } }),
        prisma.wondePeriod.findUnique({ where: { id: periodId }, select: { id: true } }),
      ])
      if (!clsExists || !perExists) continue

      const empExists = employeeId
        ? (await prisma.wondeEmployee.findUnique({ where: { id: employeeId }, select: { id: true } })) !== null
        : false

      await prisma.wondeTimetableEntry.upsert({
        where:  { id: e.id },
        create: {
          id:            e.id,
          schoolId:      omnisSchoolId,
          classId,
          employeeId:    empExists ? employeeId : null,
          periodId,
          // room is a flat string name in the API response
          roomName:      e.room ?? null,
          effectiveDate: parseWondeDate(e.effective_date),
        },
        update: {
          classId,
          employeeId:    empExists ? employeeId : null,
          periodId,
          roomName:      e.room ?? null,
          effectiveDate: parseWondeDate(e.effective_date),
        },
      })
      result.timetable.upserted++
    }
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
