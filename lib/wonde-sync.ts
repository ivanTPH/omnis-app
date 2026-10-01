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

import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma, writeAudit } from '@/lib/prisma'
import { matchPupilsToAccounts } from '@/lib/accounts/student-matching'
import { placeholderEmail, isPlaceholderEmail, isUsableEmail } from '@/lib/accounts/placeholder'
import { linkParentToChildren } from '@/lib/accounts/parent-links'
import { provisionStaffAndClasses, type MisClass, type ProvisionResult } from '@/lib/accounts/class-provisioning'
import { filterMisClasses, formClassesFromPupils, isFormClass, parseClassImport } from '@/lib/accounts/class-filter'
import {
  fetchWondeStudentEmails,
  fetchWondeEmployeeDetails,
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
  assessments:  { upserted: number }
  baselines:    { upserted: number }
  provisioned: { students: number; parents: number; needsReview?: number }
  omnis?:      ProvisionResult   // staff accounts, classes, teachers and enrolments created from MIS data
  errors:       string[]
  durationMs:   number
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

/**
 * Run `fn` over `items` in parallel chunks of `size`.
 *
 * Uses Promise.allSettled rather than Promise.all so one item's failure (a bad
 * record, a constraint violation) doesn't reject the whole chunk and abort every
 * remaining chunk in this phase -- previously, e.g. employee #245 of 500 failing
 * meant employees 250-500 were silently skipped for the run while 1-240 already
 * persisted (no transaction wraps these upserts). A rejected item is logged and
 * skipped; the batch keeps going. Earlier writes in the batch are unaffected
 * either way, since each upsert is already its own independent statement.
 */
async function inBatches<T>(items: T[], fn: (item: T) => Promise<void>, size = 10): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    const chunk   = items.slice(i, i + size)
    const results = await Promise.allSettled(chunk.map(fn))
    results.forEach((r, idx) => {
      if (r.status === 'rejected') {
        console.error('[wonde-sync] item failed, skipping:', chunk[idx], r.reason)
      }
    })
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
    assessments:  { upserted: 0 },
    baselines:    { upserted: 0 },
    provisioned:  { students: 0, parents: 0 },
    errors,
    durationMs:   0,
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

  // Staff emails and who teaches which class (only if the school granted them)
  let employeeClassIds = new Map<string, string[]>()
  try {
    const details = await fetchWondeEmployeeDetails(wondeSchoolId, wondeToken)
    employeeClassIds = details.classIds
    for (const [id, email] of details.emails) {
      if (knownEmployeeIds.has(id)) await prisma.wondeEmployee.update({ where: { id }, data: { email } })
    }
  } catch (err) {
    errors.push(`Employee details: ${String(err)}`)
  }

  // Wonde pupil ID → Omnis student account ID. Filled in step 3 and used by
  // every later step. Pupils are matched by Wonde ID only, never by name
  // (see lib/accounts/student-matching.ts).
  const studentUserByWondeId = new Map<string, string>()

  // ── 3. Students (+ contacts) ──────────────────────────────────────────────
  try {
    const students = await fetchWondeStudents(wondeSchoolId, wondeToken)

    // ── 3a. Student accounts ────────────────────────────────────────────────
    // Accounts are created silently. NO email is sent from the sync: the school
    // admin sends invitations when the school is ready (/admin/invitations).
    // Demo schools keep their seeded sample pupils: MIS data is synced for
    // display, but no accounts are created or linked from it.
    const syncSchool = await prisma.school.findUnique({ where: { id: omnisSchoolId }, select: { isDemo: true } })
    if (!syncSchool?.isDemo) try {
      let misEmails = new Map<string, string>()
      try {
        misEmails = await fetchWondeStudentEmails(wondeSchoolId, wondeToken)
      } catch {
        // School has not granted pupil contact details in Wonde — accounts
        // get placeholder addresses until the school adds real ones.
      }
      const accounts = await prisma.user.findMany({
        where:  { schoolId: omnisSchoolId, role: 'STUDENT' },
        select: { id: true, firstName: true, lastName: true, wondeId: true, email: true },
      })
      const current = students.filter(st => !st.is_leaver)
      const match = matchPupilsToAccounts(
        current.map(st => ({ id: st.id, firstName: st.forename, lastName: st.surname })),
        accounts,
      )
      for (const c of match.claims) {
        await prisma.user.update({ where: { id: c.userId }, data: { wondeId: c.wondeId } })
      }
      for (const [wid, uid] of match.byWondeId) studentUserByWondeId.set(wid, uid)

      const emailById = new Map(accounts.map(a => [a.id, a.email]))
      for (const pupil of match.unmatched) {
        const st = current.find(x => x.id === pupil.id)!
        const mis = misEmails.get(pupil.id)
        let email = placeholderEmail(pupil.id)
        if (isUsableEmail(mis) && !(await prisma.user.findUnique({ where: { email: mis }, select: { id: true } }))) {
          email = mis
        }
        const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10)
        const created = await prisma.user.create({
          data: {
            email,
            firstName: pupil.firstName,
            lastName:  pupil.lastName,
            role:      'STUDENT',
            passwordHash,
            schoolId:  omnisSchoolId,
            yearGroup: yearCodeToInt(st.year?.data?.code),
            wondeId:   pupil.id,
          },
        })
        studentUserByWondeId.set(pupil.id, created.id)
        await writeAudit({
          schoolId: omnisSchoolId, actorId: created.id, action: 'USER_PROVISIONED', // AuditLog.actorId must be a real user; the actor (the MIS sync) is recorded in metadata
          targetType: 'user', targetId: created.id,
          metadata: { role: 'STUDENT', source: 'wonde', emailKnown: !isPlaceholderEmail(email) },
        })
        result.provisioned.students++
      }

      // Swap a placeholder for the school's real address once the MIS supplies one
      for (const [wid, uid] of studentUserByWondeId) {
        const mis = misEmails.get(wid)
        if (!isUsableEmail(mis) || !isPlaceholderEmail(emailById.get(uid))) continue
        const taken = await prisma.user.findUnique({ where: { email: mis }, select: { id: true } })
        if (!taken) await prisma.user.update({ where: { id: uid }, data: { email: mis } })
      }

      if (match.ambiguous.length > 0) {
        result.provisioned.needsReview = match.ambiguous.length
        errors.push(`Student accounts: ${match.ambiguous.length} pupil(s) share a name with another pupil or an existing account, so they were not linked automatically. Check them in User Management.`)
      }
    } catch (err) {
      errors.push(`Student accounts: ${String(err)}`)
    }

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
      // Matched by Wonde ID (studentUserByWondeId), never by name.
      //
      // We store a proxy URL (/api/student-photo/{userId}) rather than the raw Wonde URL.
      // The proxy route fetches the image server-side with the Wonde API token, so the
      // browser never needs to supply an Authorization header.
      // Bridge MIS fields (tutorGroup, dateOfBirth, photo) to User record.
      // Always update tutorGroup + dateOfBirth when a matching User exists.
      try {
        const matchedUserId = studentUserByWondeId.get(stu.id)
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
          const matchedUserId = studentUserByWondeId.get(stu.id)
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
                school:                { connect: { id: omnisSchoolId } },
                student:               { connect: { id: stu.id } },
                firstName:             c.forename ?? '',
                lastName:              c.surname  ?? '',
                email:                 c.email ?? null,
                phone:                 c.telephone ?? c.mobile ?? null,
                relationship:          relationshipStr,
                parentalResponsibility:parentalResp,
                syncedAt:              now,
              },
              update: {
                firstName:             c.forename ?? '',
                lastName:              c.surname  ?? '',
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
  const misClasses: MisClass[] = []
  try {
    const classes = await fetchWondeClasses(wondeSchoolId, wondeToken)
    for (const c of classes) {
      misClasses.push({
        id: c.id, name: c.name, subject: c.subject?.data?.name ?? null,
        yearGroup: yearCodeToInt(c.year?.data?.code),
        pupilIds: (c.students?.data ?? []).map(st => st.id),
      })
    }

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
  // Pupils are linked to accounts by Wonde ID (studentUserByWondeId), never by name.
  try {
    const senStudents = await fetchWondeSen(wondeSchoolId, wondeToken)

    // Known WondeStudent IDs (identity map, kept so the lookups below read the same)
    const wondeStudentsForSen = await prisma.wondeStudent.findMany({
      where:  { schoolId: omnisSchoolId },
      select: { id: true },
    })
    const wondeNameByIdForSen = new Map(
      wondeStudentsForSen.map(ws => [ws.id, ws.id])
    )

    const userByNameForSen = studentUserByWondeId

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
    const userByNameForAtt = studentUserByWondeId
    const wondeStudentNameById = new Map(
      wondeStudentUsers.map(ws => [ws.id, ws.id])
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
    const wondeStudentsForBeh = await prisma.wondeStudent.findMany({
      where:  { schoolId: omnisSchoolId },
      select: { id: true, firstName: true, lastName: true },
    })
    const userByNameForBeh = studentUserByWondeId
    const wondeStudentNameByIdBeh = new Map(
      wondeStudentsForBeh.map(ws => [ws.id, ws.id])
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

    const wondeStudentsForExc = await prisma.wondeStudent.findMany({
      where:  { schoolId: omnisSchoolId },
      select: { id: true, firstName: true, lastName: true },
    })
    const userByNameForExc = studentUserByWondeId
    const wondeStudentNameByIdExc = new Map(
      wondeStudentsForExc.map(ws => [ws.id, ws.id])
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
    const userByNameForBaseline = studentUserByWondeId
    const wondeNameByIdForBaseline = new Map(
      wondeStudentsForBaseline.map(ws => [ws.id, ws.id])
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

  // ── Omnis staff, classes, teachers and enrolments ────────────────────────
  // Not for demo schools (they keep their seeded classes). No emails are sent.
  try {
    const sch = await prisma.school.findUnique({ where: { id: omnisSchoolId }, select: { isDemo: true, misClassImport: true } })
    if (!sch?.isDemo && misClasses.length > 0) {
      // Only the classes the school chose: teaching classes, plus form groups if wanted (lib/accounts/class-filter.ts)
      const settings = parseClassImport(sch?.misClassImport)
      const pupilForms = await prisma.wondeStudent.findMany({
        where:  { schoolId: omnisSchoolId, isLeaver: false },
        select: { id: true, formGroup: true, yearGroup: true },
      })
      const formNames = new Set(pupilForms.map(p => p.formGroup?.trim().toLowerCase()).filter((x): x is string => !!x))
      const filtered = filterMisClasses(misClasses, settings, formNames)
      let formGroupsAdded = 0
      if (settings.formGroups) {
        const misFormNames = new Set(misClasses.filter(c => isFormClass(c, formNames)).map(c => c.name.trim().toLowerCase()))
        const extra = formClassesFromPupils(omnisSchoolId, pupilForms, misFormNames)
        filtered.included.push(...extra)
        formGroupsAdded = extra.length
      }
      const prov = await provisionStaffAndClasses({
        schoolId: omnisSchoolId, classes: filtered.included, employeeClassIds, studentUserByWondeId,
      })
      result.omnis = {
        ...prov,
        classesExcludedBySubject: filtered.excludedSubjects,
        formGroupsExcluded: filtered.excludedForms,
        formGroupsFromPupils: formGroupsAdded,
      }
      if (prov.staffWithoutEmail > 0) {
        errors.push(`Staff: ${prov.staffWithoutEmail} teacher(s) have no email address in the MIS, so no Omnis account was created. Grant staff contact details in Wonde or add them by hand.`)
      }
    }
  } catch (err) {
    errors.push(`Omnis classes: ${String(err)}`)
  }

  // ── Parent links ────────────────────────────────────────────────────────
  // Parents register themselves (/parents) once the school opens registration.
  // Each night, make sure every registered parent is linked to all of their
  // children, using the MIS contact records (parental responsibility only).
  try {
    const parents = await prisma.user.findMany({
      where:  { schoolId: omnisSchoolId, role: 'PARENT', isActive: true },
      select: { id: true, email: true },
    })
    for (const p of parents) {
      result.provisioned.parents += await linkParentToChildren(omnisSchoolId, p.id, p.email)
    }
  } catch (err) {
    errors.push(`Parent links: ${String(err)}`)
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
