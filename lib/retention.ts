/**
 * Retention policy for pupil records.
 *
 * The school is the data controller and sets the retention schedule; Omnis
 * (the processor) follows it. Defaults come from the IRMS Academies Toolkit,
 * which the DfE Data Protection Toolkit for Schools relies on:
 *   - SEND files (ILP, EHCP, APDR, SEND status): pupil's DOB + 31 years
 *   - Pupil educational record incl. behaviour/exclusions: DOB + 25 years
 *   - Child protection / safeguarding files: DOB + 25 years, then review
 * Attendance registers (6 years from entry, 2024 Regulations) are kept in the
 * school's MIS, not in Omnis.
 *
 * There is no "DfE 7-year obligation" — earlier wording in the app said so and
 * has been replaced.
 */
import { prisma } from '@/lib/prisma'

export const RETENTION_DEFAULTS = {
  sendYears: 31,
  pupilRecordYears: 25,
  safeguardingYears: 25,
} as const

export type LeaverRecordHandling = 'EXPORT_THEN_DELETE' | 'RETAIN_IN_OMNIS'

export type SchoolRetention = {
  sendYears: number
  pupilRecordYears: number
  safeguardingYears: number
  leaverRecordHandling: LeaverRecordHandling
}

export async function getSchoolRetention(schoolId: string): Promise<SchoolRetention> {
  const s = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      retentionSendYears: true,
      retentionPupilRecordYears: true,
      retentionSafeguardingYears: true,
      leaverRecordHandling: true,
    },
  })
  return {
    sendYears: s?.retentionSendYears ?? RETENTION_DEFAULTS.sendYears,
    pupilRecordYears: s?.retentionPupilRecordYears ?? RETENTION_DEFAULTS.pupilRecordYears,
    safeguardingYears: s?.retentionSafeguardingYears ?? RETENTION_DEFAULTS.safeguardingYears,
    leaverRecordHandling: s?.leaverRecordHandling === 'RETAIN_IN_OMNIS' ? 'RETAIN_IN_OMNIS' : 'EXPORT_THEN_DELETE',
  }
}

/** Plain-English description used in the UI and erasure notes. */
export function describeRetention(r: SchoolRetention): string {
  return `SEND files: date of birth + ${r.sendYears} years; pupil record: date of birth + ${r.pupilRecordYears} years; ` +
    `safeguarding files: date of birth + ${r.safeguardingYears} years, then review (school retention schedule)`
}

/** The date a record category expires for a pupil, or null if DOB unknown. */
export function retentionEnds(dateOfBirth: Date | null | undefined, years: number): Date | null {
  if (!dateOfBirth) return null
  const d = new Date(dateOfBirth)
  d.setFullYear(d.getFullYear() + years)
  return d
}

/**
 * Everything in the pupil's statutory file that Omnis holds, for handing to
 * the school when a pupil leaves or is erased. Scoped by schoolId throughout.
 */
export async function buildLeaverFile(schoolId: string, studentId: string) {
  const student = await prisma.user.findFirst({
    where: { id: studentId, schoolId, role: 'STUDENT' },
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true, yearGroup: true, tutorGroup: true },
  })
  if (!student) return null

  const where = { schoolId, studentId }
  const [
    ilps, ehcps, apdrs, sendStatus, sendReviewLogs, sendStatusReviews,
    safeguarding, pastoral, behaviour, detentions, exclusions,
    legacyPlans, legacyIlps, aiAudit,
  ] = await Promise.all([
    prisma.individualLearningPlan.findMany({ where, include: { targets: true, auditEntries: true } }),
    prisma.ehcpPlan.findMany({ where, include: { outcomes: true, annualReviews: true, auditEntries: true } }),
    prisma.assessPlanDoReview.findMany({ where, include: { auditEntries: true } }),
    // SendStatus / SendStatusReview carry no schoolId; the student lookup above already scopes them.
    prisma.sendStatus.findMany({ where: { studentId } }),
    prisma.sendReviewLog.findMany({ where }),
    prisma.sendStatusReview.findMany({ where: { studentId } }),
    prisma.safeguardingRecord.findMany({ where }),
    prisma.pastoralNote.findMany({ where }),
    prisma.behaviourRecord.findMany({ where }),
    prisma.detention.findMany({ where }),
    prisma.exclusion.findMany({ where }),
    prisma.plan.findMany({ where, include: { targets: true, strategies: true, reviewCycles: true } }),
    prisma.iLP.findMany({ where, include: { targets: true, notes: true } }),
    prisma.agentAuditEntry.findMany({ where }),
  ])

  return {
    exportedAt: new Date().toISOString(),
    note: 'Statutory pupil file exported from Omnis for the school to keep under its own retention schedule.',
    student,
    send: { ilps, ehcps, apdrs, sendStatus, sendReviewLogs, sendStatusReviews, legacyPlans, legacyIlps },
    safeguarding,
    pupilRecord: { pastoral, behaviour, detentions, exclusions },
    aiDecisionSupportLog: aiAudit,
  }
}
