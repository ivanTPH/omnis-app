import { prisma } from '@/lib/prisma'
import { PLACEHOLDER_EMAIL_DOMAIN } from '@/lib/accounts/placeholder'
import { isFormClass, parseClassImport, subjectKey, type ClassImportSettings } from '@/lib/accounts/class-filter'
import { nameKey } from '@/lib/accounts/student-matching'

/**
 * Everything the school admin needs to check after the MIS (Wonde) sync,
 * in plain English: what the last sync did, classes with no teacher, staff
 * roles, and gaps in pupil and parent email addresses.
 */

export type SyncSummary = {
  status: string
  at: Date | null
  lines: string[]       // plain-English summary
  problems: string[]    // plain-English problems (deduplicated)
}

export type ClassNoTeacher = { id: string; name: string; subject: string; yearGroup: number; pupils: number }
export type StaffRow = { id: string; name: string; email: string; role: string; signedIn: boolean; fromMis: boolean }

export type SubjectChoice = { key: string; label: string; classes: number; included: boolean }
export type ClassImportView = {
  settings: ClassImportSettings
  subjects: SubjectChoice[]
  formClassesInMis: number   // MIS classes that are form groups
  formGroups: number         // distinct pupil form groups
}
export type NameReviewCandidate = { id: string; email: string; yearGroup: number | null; createdAt: Date; submissions: number }
export type NameReviewPupil = {
  wondeId: string; name: string; yearGroup: number | null; formGroup: string | null; dob: Date | null
  candidates: NameReviewCandidate[]
}

export type MisReview = {
  sync: SyncSummary | null
  classImport: ClassImportView
  nameReview: NameReviewPupil[]
  classesTotal: number
  classesNoTeacher: ClassNoTeacher[]
  staff: StaffRow[]
  pupils: number
  pupilsMissingEmail: number
  pupilsNoParentEmail: number
}

/** Turn technical sync errors into short, plain-English problems. */
export function explainSyncErrors(errors: unknown): string[] {
  const list = Array.isArray(errors) ? errors.map(String) : []
  const out = new Set<string>()
  for (const e of list) {
    const section = e.split(':')[0].trim()
    if (/share a name/i.test(e) || /no email address/i.test(e)) { out.add(e.replace(/^[^:]+:\s*/, '')); continue }
    if (/^Contact /.test(e) && /Unique constraint/i.test(e)) { out.add('Some parent/carer records appear more than once in the MIS and were skipped. This is usually harmless.'); continue }
    if (/forbidden|403|permission/i.test(e)) { out.add(`Wonde did not allow Omnis to read "${section}". Check the permissions granted in the Wonde portal.`); continue }
    if (/Superseded/i.test(e)) { out.add('A newer sync started before this one finished.'); continue }
    out.add(`Something went wrong in the "${section}" step. Omnis support has been notified.`)
  }
  return [...out]
}

function summaryLines(summary: unknown, recordsProcessed: number): string[] {
  const s = (summary ?? {}) as Record<string, unknown>
  const counts = (s.counts ?? {}) as Record<string, number>
  const prov = (s.provisioned ?? {}) as Record<string, number>
  const om = (s.omnis ?? null) as Record<string, number> | null
  const lines: string[] = []
  if (counts.students != null) {
    lines.push(`Read ${counts.students} pupils, ${counts.employees ?? 0} staff, ${counts.classes ?? 0} classes and ${counts.contacts ?? 0} parent/carer contacts from your MIS.`)
  } else {
    lines.push(`Read ${recordsProcessed} records from your MIS.`)
  }
  const stu = (s.students ?? {}) as Record<string, number>
  if (stu.markedLeft) lines.push(`${stu.markedLeft} pupil record(s) no longer in your MIS were marked as left. Their Omnis accounts were not changed.`)
  if (prov.students) lines.push(`Created ${prov.students} new pupil account(s). No emails were sent.`)
  if (prov.parents) lines.push(`Linked ${prov.parents} parent/carer account(s) to their children.`)
  if (om) {
    if (om.staffCreated || om.staffLinked) lines.push(`Teacher accounts: ${om.staffCreated} created, ${om.staffLinked} matched to existing accounts. No emails were sent.`)
    if (om.staffWithoutEmail) lines.push(`${om.staffWithoutEmail} teacher(s) have no email address in the MIS, so no account was created for them.`)
    if (om.classesCreated || om.classesLinked) lines.push(`Classes: ${om.classesCreated} created, ${om.classesLinked} matched to existing classes.`)
    if (om.classesExcludedBySubject) lines.push(`${om.classesExcludedBySubject} MIS class(es) were left out because of the subjects you chose not to bring in.`)
    if (om.formGroupsExcluded) lines.push(`${om.formGroupsExcluded} form group(s) were left out, as you chose.`)
    if (om.formGroupsFromPupils) lines.push(`${om.formGroupsFromPupils} form group(s) were set up from pupils' MIS form. Assign each form tutor below.`)
    if (om.classesSkipped) lines.push(`${om.classesSkipped} MIS class(es) were not brought in because they have no current pupils or no year group.`)
    if (om.enrolmentsAdded || om.enrolmentsRemoved) lines.push(`Class lists: ${om.enrolmentsAdded} pupil place(s) added, ${om.enrolmentsRemoved} removed to match the MIS.`)
  }
  return lines
}

export async function getMisReview(schoolId: string): Promise<MisReview> {
  const [log, classes, staff, pupils, pupilsMissingEmail, pupilsWithParentEmail] = await Promise.all([
    prisma.wondeSyncLog.findFirst({
      where: { schoolId, status: { not: 'running' } },
      orderBy: { startedAt: 'desc' },
      select: { status: true, completedAt: true, startedAt: true, errors: true, summary: true, recordsProcessed: true },
    }),
    prisma.schoolClass.findMany({
      where:  { schoolId },
      select: { id: true, name: true, subject: true, yearGroup: true, _count: { select: { teachers: true, enrolments: true } } },
      orderBy: [{ yearGroup: 'asc' }, { name: 'asc' }],
    }),
    prisma.user.findMany({
      where:  { schoolId, isActive: true, role: { notIn: ['STUDENT', 'PARENT', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'ACADEMY_ADMIN'] } },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, activatedAt: true, wondeId: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.user.count({ where: { schoolId, role: 'STUDENT', isActive: true } }),
    prisma.user.count({ where: { schoolId, role: 'STUDENT', isActive: true, email: { endsWith: `@${PLACEHOLDER_EMAIL_DOMAIN}` } } }),
    prisma.wondeStudent.count({
      where: { schoolId, isLeaver: false, contacts: { some: { parentalResponsibility: true, email: { not: null } } } },
    }),
  ])
  const misPupils = await prisma.wondeStudent.count({ where: { schoolId, isLeaver: false } })
  const [classImport, nameReview] = await Promise.all([getClassImportView(schoolId), getNameReview(schoolId)])

  return {
    sync: log ? {
      status: log.status,
      at: log.completedAt ?? log.startedAt,
      lines: summaryLines(log.summary, log.recordsProcessed),
      problems: explainSyncErrors(log.errors),
    } : null,
    classImport,
    nameReview,
    classesTotal: classes.length,
    classesNoTeacher: classes.filter(c => c._count.teachers === 0).map(c => ({
      id: c.id, name: c.name, subject: c.subject, yearGroup: c.yearGroup, pupils: c._count.enrolments,
    })),
    staff: staff.map(s => ({
      id: s.id, name: `${s.firstName} ${s.lastName}`.trim(), email: s.email, role: s.role,
      signedIn: !!s.activatedAt, fromMis: !!s.wondeId,
    })),
    pupils,
    pupilsMissingEmail,
    pupilsNoParentEmail: Math.max(misPupils - pupilsWithParentEmail, 0),
  }
}

/** The school's choice of MIS classes, with the subjects found in the MIS. */
export async function getClassImportView(schoolId: string): Promise<ClassImportView> {
  const [school, classes, forms] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId }, select: { misClassImport: true } }),
    prisma.wondeClass.findMany({ where: { schoolId }, select: { name: true, subject: true } }),
    prisma.wondeStudent.findMany({ where: { schoolId, isLeaver: false, formGroup: { not: null } }, select: { formGroup: true }, distinct: ['formGroup'] }),
  ])
  const settings = parseClassImport(school?.misClassImport)
  const formNames = new Set(forms.map(f => f.formGroup!.trim().toLowerCase()))
  const excluded = new Set(settings.excludedSubjects)
  const bySubject = new Map<string, { label: string; classes: number }>()
  let formClassesInMis = 0
  for (const c of classes) {
    if (isFormClass(c, formNames)) { formClassesInMis++; continue }
    const k = subjectKey(c.subject)
    const cur = bySubject.get(k) ?? { label: c.subject?.trim() || 'General', classes: 0 }
    cur.classes++
    bySubject.set(k, cur)
  }
  const subjects = [...bySubject.entries()]
    .map(([key, v]) => ({ key, label: v.label, classes: v.classes, included: !excluded.has(key) }))
    .sort((a, b) => a.label.localeCompare(b.label))
  return { settings, subjects, formClassesInMis, formGroups: formNames.size }
}

/**
 * MIS pupils the sync could not link safely: their name matches one or more
 * existing pupil accounts that are not linked to the MIS (for example from a
 * CSV import). A person must decide: link to one of those accounts, or create
 * a new account.
 */
export async function getNameReview(schoolId: string): Promise<NameReviewPupil[]> {
  const [pupils, accounts] = await Promise.all([
    prisma.wondeStudent.findMany({
      where:  { schoolId, isLeaver: false },
      select: { id: true, firstName: true, lastName: true, yearGroup: true, formGroup: true, dob: true },
    }),
    prisma.user.findMany({
      where:  { schoolId, role: 'STUDENT' },
      select: { id: true, wondeId: true, firstName: true, lastName: true, email: true, yearGroup: true, createdAt: true, _count: { select: { submissions: true } } },
    }),
  ])
  const linked = new Set(accounts.filter(a => a.wondeId).map(a => a.wondeId!))
  const unlinkedByName = new Map<string, typeof accounts>()
  for (const a of accounts) {
    if (a.wondeId) continue
    const k = nameKey(a.firstName, a.lastName)
    unlinkedByName.set(k, [...(unlinkedByName.get(k) ?? []), a])
  }
  const out: NameReviewPupil[] = []
  for (const p of pupils) {
    if (linked.has(p.id)) continue
    const cands = unlinkedByName.get(nameKey(p.firstName, p.lastName)) ?? []
    if (cands.length === 0) continue
    out.push({
      wondeId: p.id, name: `${p.firstName} ${p.lastName}`.trim(), yearGroup: p.yearGroup, formGroup: p.formGroup, dob: p.dob,
      candidates: cands.map(c => ({ id: c.id, email: c.email, yearGroup: c.yearGroup, createdAt: c.createdAt, submissions: c._count.submissions })),
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}
