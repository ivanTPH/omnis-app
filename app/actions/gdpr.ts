'use server'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

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
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = session.user as any
  if (!['SCHOOL_ADMIN', 'SLT'].includes(u.role)) redirect('/dashboard')
  return u
}

async function requireParent() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = session.user as any
  if (u.role !== 'PARENT') redirect('/dashboard')
  return u
}

// ─── Admin: Purposes ──────────────────────────────────────────────────────────

export async function getPurposes(schoolId: string): Promise<ConsentPurposeData[]> {
  await requireAdminOrSlt()
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
  schoolId: string,
  data: { slug: string; title: string; description: string; lawfulBasis: string },
): Promise<void> {
  await requireAdminOrSlt()
  await prisma.consentPurpose.create({
    data: { schoolId, ...data, isActive: true },
  })
  revalidatePath('/admin/gdpr')
}

export async function togglePurposeActive(purposeId: string): Promise<void> {
  await requireAdminOrSlt()
  const current = await prisma.consentPurpose.findUniqueOrThrow({ where: { id: purposeId } })
  await prisma.consentPurpose.update({
    where: { id: purposeId },
    data: { isActive: !current.isActive },
  })
  revalidatePath('/admin/gdpr')
}

// ─── Admin: Consent Matrix ────────────────────────────────────────────────────

export async function getConsentMatrix(
  schoolId: string,
): Promise<{ purposes: ConsentPurposeData[]; students: ConsentMatrixStudent[] }> {
  await requireAdminOrSlt()

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

export async function exportConsentCsv(schoolId: string): Promise<string> {
  await requireAdminOrSlt()
  const { purposes, students } = await getConsentMatrix(schoolId)

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

export async function getDataSubjectRequests(schoolId: string): Promise<DsrRow[]> {
  await requireAdminOrSlt()
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
  await requireAdminOrSlt()
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
  schoolId: string,
): Promise<ChildConsentData[]> {
  const user = await requireParent()

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: user.id },
    include: { child: true },
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
  // Verify the parent is linked to this student
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
      decision,
      method: 'portal',
    },
  })
  revalidatePath('/parent/consent')
}
