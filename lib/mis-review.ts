import { prisma } from '@/lib/prisma'
import { PLACEHOLDER_EMAIL_DOMAIN } from '@/lib/accounts/placeholder'

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

export type MisReview = {
  sync: SyncSummary | null
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
  if (prov.students) lines.push(`Created ${prov.students} new pupil account(s). No emails were sent.`)
  if (prov.parents) lines.push(`Linked ${prov.parents} parent/carer account(s) to their children.`)
  if (om) {
    if (om.staffCreated || om.staffLinked) lines.push(`Teacher accounts: ${om.staffCreated} created, ${om.staffLinked} matched to existing accounts. No emails were sent.`)
    if (om.staffWithoutEmail) lines.push(`${om.staffWithoutEmail} teacher(s) have no email address in the MIS, so no account was created for them.`)
    if (om.classesCreated || om.classesLinked) lines.push(`Classes: ${om.classesCreated} created, ${om.classesLinked} matched to existing classes.`)
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

  return {
    sync: log ? {
      status: log.status,
      at: log.completedAt ?? log.startedAt,
      lines: summaryLines(log.summary, log.recordsProcessed),
      problems: explainSyncErrors(log.errors),
    } : null,
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
