'use server'

import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma, writeAudit } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConsentPurposeData = {
  id: string
  schoolId: string
  slug: string
  title: string
  description: string
  lawfulBasis: string
  isActive: boolean
  createdAt: Date
  recordCount: number
}

export type ConsentMatrixStudent = {
  id: string
  firstName: string
  lastName: string
  yearGroup: number | null
  decisions: Record<string, { decision: string; recordedAt: Date } | null>
}

export type DsrRow = {
  id: string
  requestType: string
  studentId: string | null
  submittedBy: string
  status: string
  notes: string | null
  submittedAt: Date
  resolvedAt: Date | null
}

export type StudentOption = {
  id: string
  firstName: string
  lastName: string
  yearGroup: number | null
  email: string
}

export type ChildConsentData = {
  studentId: string
  firstName: string
  lastName: string
  yearGroup: number | null
  purposes: {
    purposeId: string
    slug: string
    title: string
    description: string
    lawfulBasis: string
    latestDecision: string | null
    decidedAt: Date | null
  }[]
}

// ─── Guards ───────────────────────────────────────────────────────────────────

async function requireAdminOrSlt() {
  const u = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(u.role)) redirect('/dashboard')
  return u
}

async function requireParent() {
  const u = await requireAuth()
  if (u.role !== 'PARENT') redirect('/dashboard')
  return u
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const CreatePurposeSchema = z.object({
  slug: z.string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (e.g. data-analytics)')
    .max(80, 'Slug must not exceed 80 characters'),
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be at most 100 characters'),
  description: z.string().max(500, 'Description must be at most 500 characters'),
  lawfulBasis: z.enum(['consent', 'legitimate_interest', 'legal_obligation'], {
    error: 'Invalid lawful basis — must be consent, legitimate_interest, or legal_obligation',
  }),
})

const RecordConsentSchema = z.object({
  decision: z.enum(['granted', 'withdrawn'], {
    error: 'Decision must be "granted" or "withdrawn"',
  }),
})

// ─── Admin: Purposes ──────────────────────────────────────────────────────────

export async function getPurposes(_schoolId?: string): Promise<ConsentPurposeData[]> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const purposes = await prisma.consentPurpose.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { records: true } } },
  })
  return purposes.map(p => ({
    id: p.id,
    schoolId: p.schoolId,
    slug: p.slug,
    title: p.title,
    description: p.description,
    lawfulBasis: p.lawfulBasis,
    isActive: p.isActive,
    createdAt: p.createdAt,
    recordCount: p._count.records,
  }))
}

export async function createPurpose(
  _schoolId: string,
  data: { slug: string; title: string; description: string; lawfulBasis: string },
): Promise<void> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  // Validate input
  const validated = CreatePurposeSchema.parse(data)

  await prisma.consentPurpose.create({
    data: { schoolId, ...validated, isActive: true },
  })
  revalidatePath('/admin/gdpr')
}

export async function togglePurposeActive(purposeId: string): Promise<void> {
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  // Security: verify purpose belongs to admin's school (prevents cross-tenant mutation)
  const current = await prisma.consentPurpose.findFirst({
    where: { id: purposeId, schoolId },
  })
  if (!current) throw new Error('Purpose not found')

  await prisma.consentPurpose.update({
    where: { id: purposeId },
    data: { isActive: !current.isActive },
  })
  revalidatePath('/admin/gdpr')
}

// ─── Admin: Consent Matrix ────────────────────────────────────────────────────

export async function getConsentMatrix(
  _schoolId?: string,
): Promise<{ purposes: ConsentPurposeData[]; students: ConsentMatrixStudent[] }> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const purposes = await getPurposes(schoolId)
  const activePurposes = purposes.filter(p => p.isActive)

  const students = await prisma.wondeStudent.findMany({
    where: { schoolId, isLeaver: false },
    orderBy: [{ yearGroup: 'asc' }, { lastName: 'asc' }],
  })

  // Fetch all consent records for this school's active purposes
  const allRecords = await prisma.consentRecord.findMany({
    where: { purposeId: { in: activePurposes.map(p => p.id) } },
    orderBy: { recordedAt: 'desc' },
  })

  // Build latest-decision map: studentId+purposeId → record
  const latestMap = new Map<string, { decision: string; recordedAt: Date }>()
  for (const rec of allRecords) {
    const key = `${rec.studentId}:${rec.purposeId}`
    if (!latestMap.has(key)) {
      latestMap.set(key, { decision: rec.decision, recordedAt: rec.recordedAt })
    }
  }

  const matrixStudents: ConsentMatrixStudent[] = students.map(s => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    yearGroup: s.yearGroup,
    decisions: Object.fromEntries(
      activePurposes.map(p => [
        p.id,
        latestMap.get(`${s.id}:${p.id}`) ?? null,
      ]),
    ),
  }))

  return { purposes: activePurposes, students: matrixStudents }
}

export async function exportConsentCsv(_schoolId?: string): Promise<string> {
  // Security: schoolId comes from session via getConsentMatrix
  const { purposes, students } = await getConsentMatrix()

  const header = [
    'Student ID', 'Last Name', 'First Name', 'Year Group',
    ...purposes.map(p => p.title),
  ].join(',')

  const rows = students.map(s => {
    const cells = purposes.map(p => {
      const d = s.decisions[p.id]
      return d ? d.decision : 'unknown'
    })
    return [s.id, s.lastName, s.firstName, s.yearGroup ?? '', ...cells].join(',')
  })

  return [header, ...rows].join('\n')
}

// ─── Admin: Data Subject Requests ────────────────────────────────────────────

export async function getDataSubjectRequests(_schoolId?: string): Promise<DsrRow[]> {
  // Security: always use session schoolId — never trust client-provided schoolId
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  const rows = await prisma.dataSubjectRequest.findMany({
    where: { schoolId },
    orderBy: { submittedAt: 'desc' },
  })
  return rows as DsrRow[]
}

export async function updateDsrStatus(
  dsrId: string,
  status: string,
  notes?: string,
): Promise<void> {
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId as string

  // Security: verify DSR belongs to admin's school (prevents cross-tenant mutation)
  const dsr = await prisma.dataSubjectRequest.findFirst({ where: { id: dsrId, schoolId } })
  if (!dsr) throw new Error('Request not found')

  await prisma.dataSubjectRequest.update({
    where: { id: dsrId },
    data: {
      status,
      notes,
      resolvedAt: ['completed', 'rejected'].includes(status) ? new Date() : null,
    },
  })
  revalidatePath('/admin/gdpr')
}

// ─── Parent: Consent Portal ───────────────────────────────────────────────────

export async function getMyChildrenConsents(
  _schoolId?: string,
): Promise<ChildConsentData[]> {
  // Security: schoolId and parentId always come from session
  const user = await requireParent()
  const schoolId = user.schoolId as string

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: user.id },
    include: { child: { select: { id: true, firstName: true, lastName: true, yearGroup: true } } },
  })

  const activePurposes = await prisma.consentPurpose.findMany({
    where: { schoolId, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  const result: ChildConsentData[] = []

  for (const link of links) {
    const child = link.child
    if (!child) continue

    // Fetch the latest consent record per purpose for this student
    const records = await prisma.consentRecord.findMany({
      where: {
        studentId: child.id,
        purposeId: { in: activePurposes.map(p => p.id) },
      },
      orderBy: { recordedAt: 'desc' },
    })

    const latestByPurpose = new Map<string, { decision: string; recordedAt: Date }>()
    for (const rec of records) {
      if (!latestByPurpose.has(rec.purposeId)) {
        latestByPurpose.set(rec.purposeId, { decision: rec.decision, recordedAt: rec.recordedAt })
      }
    }

    result.push({
      studentId: child.id,
      firstName: child.firstName,
      lastName: child.lastName,
      yearGroup: child.yearGroup ?? null,
      purposes: activePurposes.map(p => {
        const latest = latestByPurpose.get(p.id) ?? null
        return {
          purposeId: p.id,
          slug: p.slug,
          title: p.title,
          description: p.description,
          lawfulBasis: p.lawfulBasis,
          latestDecision: latest?.decision ?? null,
          decidedAt: latest?.recordedAt ?? null,
        }
      }),
    })
  }

  return result
}

export async function recordConsent(
  purposeId: string,
  studentId: string,
  decision: string,
): Promise<void> {
  const user = await requireParent()

  // Validate decision value
  const validated = RecordConsentSchema.parse({ decision })

  // Security: verify the parent is linked to this student (IDOR protection)
  const link = await prisma.parentStudentLink.findFirst({
    where: { parentId: user.id, studentId },
  })
  if (!link) throw new Error('Not authorised to record consent for this student')

  // Immutable INSERT — never update
  await prisma.consentRecord.create({
    data: {
      purposeId,
      studentId,
      responderId: user.id,
      decision: validated.decision,
      method: 'portal',
    },
  })
  revalidatePath('/parent/consent')
}

// ─── Article 17 — Data Subject Requests (submit + erasure) ───────────────────

export async function getStudentsForDsr(): Promise<StudentOption[]> {
  const user = await requireAdminOrSlt()
  return prisma.user.findMany({
    where: { schoolId: user.schoolId!, role: 'STUDENT' },
    select: { id: true, firstName: true, lastName: true, yearGroup: true, email: true },
    orderBy: [{ yearGroup: 'asc' }, { lastName: 'asc' }],
  })
}

export async function submitDataSubjectRequest(
  studentId: string | null,
  requestType: string,
  notes: string,
): Promise<void> {
  const user = await requireAdminOrSlt()
  const schoolId = user.schoolId!

  if (studentId) {
    const student = await prisma.user.findFirst({ where: { id: studentId, schoolId } })
    if (!student) throw new Error('Student not found in this school')
  }

  await prisma.dataSubjectRequest.create({
    data: { schoolId, requestType, studentId: studentId ?? null, submittedBy: user.id, status: 'pending', notes: notes || null },
  })
  revalidatePath('/admin/gdpr')
}

export async function executeErasure(dsrId: string): Promise<{ studentName: string }> {
  const user = await requireAdminOrSlt()
  if (user.role !== 'SCHOOL_ADMIN') throw new Error('Only SCHOOL_ADMIN can execute erasure')
  const schoolId = user.schoolId!

  const dsr = await prisma.dataSubjectRequest.findFirst({
    where: { id: dsrId, schoolId, requestType: 'erasure' },
  })
  if (!dsr) throw new Error('Request not found')
  if (!dsr.studentId) throw new Error('No student linked to this erasure request')
  if (dsr.status === 'completed') throw new Error('Erasure has already been executed')

  const studentId = dsr.studentId

  const student = await prisma.user.findFirst({
    where: { id: studentId, schoolId },
    select: { firstName: true, lastName: true },
  })
  if (!student) throw new Error('Student not found in this school')
  const studentName = `${student.firstName} ${student.lastName}`

  await prisma.$transaction(async (tx) => {
    // 1. Submission chain — leaf to root
    const submissions = await tx.submission.findMany({ where: { studentId }, select: { id: true } })
    const submissionIds = submissions.map(s => s.id)

    if (submissionIds.length > 0) {
      const attempts = await tx.submissionAttempt.findMany({
        where: { submissionId: { in: submissionIds } },
        select: { id: true },
      })
      const attemptIds = attempts.map(a => a.id)
      if (attemptIds.length > 0) {
        await tx.submissionIntegritySignal.deleteMany({ where: { attemptId: { in: attemptIds } } })
        await tx.submissionAttemptAnswer.deleteMany({ where: { attemptId: { in: attemptIds } } })
        await tx.submissionAttempt.deleteMany({ where: { id: { in: attemptIds } } })
      }
      await tx.ilpEvidenceEntry.deleteMany({ where: { submissionId: { in: submissionIds } } })
      await tx.submission.deleteMany({ where: { id: { in: submissionIds } } })
    }

    // 2. SEND & pastoral data
    await tx.taNote.deleteMany({ where: { studentId } })
    await tx.parentContactEntry.deleteMany({ where: { studentId } })
    await tx.sendConcern.deleteMany({ where: { studentId } })
    await tx.earlyWarningFlag.deleteMany({ where: { studentId } })
    await tx.sendNotification.deleteMany({ where: { recipientId: studentId } })
    await tx.notification.deleteMany({ where: { userId: studentId } })

    // 3. Learning profile & agent data
    await tx.studentLearningProfile.deleteMany({ where: { studentId } })
    await tx.agentSnapshot.deleteMany({ where: { studentId } })
    await tx.studentQuickNote.deleteMany({ where: { studentId } })
    await tx.studentBaseline.deleteMany({ where: { studentId } })

    // 4. Revision data
    await tx.revisionConfidence.deleteMany({ where: { studentId } })
    await tx.revisionSession.deleteMany({ where: { studentId } })
    await tx.revisionExam.deleteMany({ where: { studentId } })
    await tx.revisionProgress.deleteMany({ where: { studentId } })

    // 5. Messaging
    await tx.msgMessage.deleteMany({ where: { senderId: studentId } })
    await tx.msgParticipant.deleteMany({ where: { userId: studentId } })

    // 6. Enrolment & relationships
    await tx.enrolment.deleteMany({ where: { userId: studentId } })
    await tx.studentSubject.deleteMany({ where: { studentId } })
    await tx.parentStudentLink.deleteMany({ where: { studentId } })
    await tx.parentChildLink.deleteMany({ where: { childId: studentId } })

    // 7. Auth & settings
    await tx.consentRecord.deleteMany({ where: { studentId } })
    await tx.passwordResetToken.deleteMany({ where: { userId: studentId } })
    await tx.userSettings.deleteMany({ where: { userId: studentId } })
    await tx.userAccessibilitySettings.deleteMany({ where: { userId: studentId } })

    // 8. K Plan / Learning Passport
    await tx.kPlan.deleteMany({ where: { studentId } })
    await tx.learnerPassport.deleteMany({ where: { studentId } })

    // NOTE: IndividualLearningPlan, EhcpPlan, AssessPlanDoReview, SendStatus, and
    // AuditLog are intentionally retained under DfE 7-year retention obligation.

    // 9. Anonymise User PII — keep row for audit trail integrity
    await tx.user.update({
      where: { id: studentId },
      data: {
        firstName: '[Deleted',
        lastName: 'User]',
        email: `erased-${studentId}@erased.local`,
        passwordHash: '',
        avatarUrl: null,
        dateOfBirth: null,
        tutorGroup: null,
        supportSnapshot: null,
        attendancePercentage: null,
        behaviourPositive: null,
        behaviourNegative: null,
        hasExclusion: null,
        isFsm: null,
        isEal: null,
        ethnicGroup: null,
        department: null,
        isActive: false,
      },
    })

    // 10. Mark DSR complete
    await tx.dataSubjectRequest.update({
      where: { id: dsrId },
      data: {
        status: 'completed',
        resolvedAt: new Date(),
        notes: `Erasure executed by ${user.firstName} ${user.lastName} on ${new Date().toLocaleDateString('en-GB')}. PII anonymised; SEND records retained per DfE 7-year obligation.`,
      },
    })
  }, { timeout: 30_000 })

  // Audit (best-effort, outside transaction)
  try {
    await writeAudit({ schoolId, actorId: user.id, action: 'USER_DATA_ERASED', targetType: 'user', targetId: studentId })
  } catch { /* non-fatal */ }

  revalidatePath('/admin/gdpr')
  return { studentName }
}
