import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma, writeAudit } from '@/lib/prisma'
import { isUsableEmail } from '@/lib/accounts/placeholder'

/**
 * Turns the school's MIS data (already copied into the Wonde* tables by the
 * sync) into the Omnis records teachers actually use:
 *
 *   WondeEmployee      → staff User (TEACHER), linked by User.wondeId
 *   WondeClass         → SchoolClass, linked by SchoolClass.wondeClassId
 *   class ↔ teacher    → ClassTeacher
 *   class ↔ pupil      → Enrolment
 *
 * Rules:
 *  - Nothing is emailed. Staff are invited from /admin/invitations.
 *  - Records are linked by MIS ID. A legacy record (no MIS ID) is claimed only
 *    by an exact, unambiguous match (staff: email; class: name).
 *  - Only links the sync created (fromMis) are removed when they disappear
 *    from the MIS. Teachers or pupils added by hand in Omnis (including a
 *    tutor assigned on the Check MIS data page) are never removed.
 *  - Demo schools are skipped by the caller.
 */

export type MisClass = { id: string; name: string; subject: string | null; yearGroup: number | null; pupilIds: string[] }

export type ProvisionResult = {
  staffCreated: number; staffLinked: number; staffWithoutEmail: number; staffEmailInUse: number
  classesCreated: number; classesLinked: number; classesSkipped: number
  classesWithoutTeacher: number
  teacherLinksAdded: number; teacherLinksRemoved: number
  enrolmentsAdded: number; enrolmentsRemoved: number
  // Set by the caller from the school's class choice (lib/accounts/class-filter.ts)
  classesExcludedBySubject?: number; formGroupsExcluded?: number; formGroupsFromPupils?: number
}

/** Most common non-null year group, or null. Ties go to the lower year. */
export function majorityYear(years: Array<number | null | undefined>): number | null {
  const counts = new Map<number, number>()
  for (const y of years) if (y != null) counts.set(y, (counts.get(y) ?? 0) + 1)
  let best: number | null = null, bestN = 0
  for (const [y, n] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    if (n > bestN) { best = y; bestN = n }
  }
  return best
}

/** Invert employee → classes into class → employees, merging extra pairs (timetable, class.employee). */
export function teachersByClass(
  employeeClassIds: Map<string, string[]>,
  extraPairs: Array<{ classId: string | null; employeeId: string | null }>,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  const add = (c: string, e: string) => { if (!out.has(c)) out.set(c, new Set()); out.get(c)!.add(e) }
  for (const [e, cs] of employeeClassIds) for (const c of cs) add(c, e)
  for (const p of extraPairs) if (p.classId && p.employeeId) add(p.classId, p.employeeId)
  return out
}

export async function provisionStaffAndClasses(opts: {
  schoolId: string
  classes: MisClass[]
  employeeClassIds: Map<string, string[]>
  studentUserByWondeId: Map<string, string>
}): Promise<ProvisionResult> {
  const { schoolId, classes, employeeClassIds, studentUserByWondeId } = opts
  const r: ProvisionResult = {
    staffCreated: 0, staffLinked: 0, staffWithoutEmail: 0, staffEmailInUse: 0,
    classesCreated: 0, classesLinked: 0, classesSkipped: 0, classesWithoutTeacher: 0,
    teacherLinksAdded: 0, teacherLinksRemoved: 0, enrolmentsAdded: 0, enrolmentsRemoved: 0,
  }

  // ── Teachers per class ────────────────────────────────────────────────────
  const [timetable, wondeClasses] = await Promise.all([
    prisma.wondeTimetableEntry.findMany({ where: { schoolId }, select: { classId: true, employeeId: true } }),
    prisma.wondeClass.findMany({ where: { schoolId }, select: { id: true, employeeId: true } }),
  ])
  const classTeachers = teachersByClass(employeeClassIds, [
    ...timetable,
    ...wondeClasses.map(c => ({ classId: c.id, employeeId: c.employeeId })),
  ])
  const teachingEmployeeIds = new Set([...classTeachers.values()].flatMap(s => [...s]))

  // ── Staff accounts ────────────────────────────────────────────────────────
  const employees = await prisma.wondeEmployee.findMany({
    where:  { schoolId },
    select: { id: true, firstName: true, lastName: true, email: true, isTeacher: true },
  })
  const staff = await prisma.user.findMany({
    where:  { schoolId, role: { notIn: ['STUDENT', 'PARENT'] } },
    select: { id: true, email: true, wondeId: true },
  })
  const staffByWonde = new Map(staff.filter(s => s.wondeId).map(s => [s.wondeId!, s.id]))
  const staffByEmail = new Map(staff.map(s => [s.email.toLowerCase(), s]))
  const userByEmployee = new Map<string, string>()

  for (const e of employees) {
    if (!e.isTeacher && !teachingEmployeeIds.has(e.id)) continue   // office, site staff etc.
    const linked = staffByWonde.get(e.id)
    if (linked) { userByEmployee.set(e.id, linked); continue }

    const email = e.email?.trim().toLowerCase() ?? null
    const byEmail = email ? staffByEmail.get(email) : undefined
    if (byEmail && !byEmail.wondeId) {
      await prisma.user.update({ where: { id: byEmail.id }, data: { wondeId: e.id } })
      userByEmployee.set(e.id, byEmail.id)
      r.staffLinked++
      continue
    }
    if (!isUsableEmail(email)) { r.staffWithoutEmail++; continue }
    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (taken) { r.staffEmailInUse++; continue }

    const created = await prisma.user.create({
      data: {
        email, role: 'TEACHER', schoolId, wondeId: e.id,
        firstName: e.firstName, lastName: e.lastName,
        passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
      },
      select: { id: true },
    })
    await writeAudit({
      schoolId, actorId: created.id, action: 'USER_PROVISIONED', // actorId must be a real user (FK); source is in metadata
      targetType: 'user', targetId: created.id, metadata: { role: 'TEACHER', source: 'wonde' },
    })
    userByEmployee.set(e.id, created.id)
    r.staffCreated++
  }

  // ── Classes, teachers and enrolments ───────────────────────────────────────
  const [omnisClasses, pupilYears] = await Promise.all([
    prisma.schoolClass.findMany({ where: { schoolId }, select: { id: true, name: true, wondeClassId: true } }),
    prisma.wondeStudent.findMany({ where: { schoolId }, select: { id: true, yearGroup: true } }),
  ])
  const yearByPupil = new Map(pupilYears.map(p => [p.id, p.yearGroup]))
  const classByWonde = new Map(omnisClasses.filter(c => c.wondeClassId).map(c => [c.wondeClassId!, c.id]))
  const unlinkedByName = new Map<string, string[]>()
  for (const c of omnisClasses) {
    if (c.wondeClassId) continue
    const k = c.name.trim().toLowerCase()
    unlinkedByName.set(k, [...(unlinkedByName.get(k) ?? []), c.id])
  }
  const misNameCounts = new Map<string, number>()
  for (const c of classes) { const k = c.name.trim().toLowerCase(); misNameCounts.set(k, (misNameCounts.get(k) ?? 0) + 1) }

  for (const mc of classes) {
    const pupilUserIds = [...new Set(mc.pupilIds.map(p => studentUserByWondeId.get(p)).filter((x): x is string => !!x))]
    if (pupilUserIds.length === 0) { r.classesSkipped++; continue }
    const yearGroup = mc.yearGroup ?? majorityYear(mc.pupilIds.map(p => yearByPupil.get(p)))
    if (yearGroup == null) { r.classesSkipped++; continue }
    const subject = mc.subject?.trim() || 'General'

    let classId = classByWonde.get(mc.id)
    if (!classId) {
      const k = mc.name.trim().toLowerCase()
      const cands = unlinkedByName.get(k) ?? []
      if (cands.length === 1 && misNameCounts.get(k) === 1) {
        classId = cands[0]
        await prisma.schoolClass.update({ where: { id: classId }, data: { wondeClassId: mc.id } })
        unlinkedByName.delete(k)
        r.classesLinked++
      }
    }
    if (!classId) {
      const created = await prisma.schoolClass.create({
        data: { schoolId, name: mc.name, subject, department: subject, yearGroup, wondeClassId: mc.id },
        select: { id: true },
      })
      classId = created.id
      r.classesCreated++
    } else {
      await prisma.schoolClass.update({ where: { id: classId }, data: { name: mc.name, yearGroup } })
    }

    // Teachers: add MIS teachers, remove MIS-managed teachers who no longer teach it
    const wantTeachers = new Set([...(classTeachers.get(mc.id) ?? [])].map(e => userByEmployee.get(e)).filter((x): x is string => !!x))
    if (wantTeachers.size === 0) r.classesWithoutTeacher++
    const haveTeachers = await prisma.classTeacher.findMany({ where: { classId }, select: { userId: true, fromMis: true } })
    const haveSet = new Set(haveTeachers.map(t => t.userId))
    const addT = [...wantTeachers].filter(u => !haveSet.has(u))
    if (addT.length) {
      await prisma.classTeacher.createMany({ data: addT.map(userId => ({ classId: classId!, userId, fromMis: true })), skipDuplicates: true })
      r.teacherLinksAdded += addT.length
    }
    const removeT = haveTeachers.filter(t => t.fromMis && !wantTeachers.has(t.userId)).map(t => t.userId)
    if (removeT.length) {
      await prisma.classTeacher.deleteMany({ where: { classId, userId: { in: removeT } } })
      r.teacherLinksRemoved += removeT.length
    }

    // Pupils: same rule
    const haveEnrol = await prisma.enrolment.findMany({ where: { classId }, select: { userId: true, fromMis: true } })
    const haveEnrolSet = new Set(haveEnrol.map(e => e.userId))
    const wantEnrol = new Set(pupilUserIds)
    const addE = pupilUserIds.filter(u => !haveEnrolSet.has(u))
    if (addE.length) {
      await prisma.enrolment.createMany({ data: addE.map(userId => ({ classId: classId!, userId, fromMis: true })), skipDuplicates: true })
      r.enrolmentsAdded += addE.length
    }
    const removeE = haveEnrol.filter(e => e.fromMis && !wantEnrol.has(e.userId)).map(e => e.userId)
    if (removeE.length) {
      await prisma.enrolment.deleteMany({ where: { classId, userId: { in: removeE } } })
      r.enrolmentsRemoved += removeE.length
    }
  }

  return r
}
