'use server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const ALLOWED_ROLES = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'TEACHING_ASSISTANT']
const EDIT_ROLES    = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'TEACHING_ASSISTANT']
const APPROVE_ROLES = ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN']

async function requireAccess() {
  const u = await requireAuth()
  if (!ALLOWED_ROLES.includes(u.role)) throw new Error('Forbidden')
  return u
}

export type YearGroupPlanData = {
  id:              string
  yearGroup:       number
  subject:         string
  planContent:     string
  uploadedFileUrl: string | null
  status:          string
  createdById:     string
  createdByName:   string
  approvedByName:  string | null
  createdAt:       string
  updatedAt:       string
}

export async function getYearGroupPlans(): Promise<YearGroupPlanData[]> {
  const user = await requireAccess()
  const plans = await prisma.yearGroupPlan.findMany({
    where: { schoolId: user.schoolId },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      approvedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ yearGroup: 'asc' }, { subject: 'asc' }],
  })
  return plans.map(p => ({
    id:              p.id,
    yearGroup:       p.yearGroup,
    subject:         p.subject,
    planContent:     p.planContent,
    uploadedFileUrl: p.uploadedFileUrl,
    status:          p.status,
    createdById:     p.createdById,
    createdByName:   `${p.createdBy.firstName} ${p.createdBy.lastName}`,
    approvedByName:  p.approvedBy ? `${p.approvedBy.firstName} ${p.approvedBy.lastName}` : null,
    createdAt:       p.createdAt.toISOString(),
    updatedAt:       p.updatedAt.toISOString(),
  }))
}

export async function upsertYearGroupPlan(input: {
  id?:             string
  yearGroup:       number
  subject:         string
  planContent:     string
  uploadedFileUrl?: string | null
}) {
  const user = await requireAccess()
  if (!EDIT_ROLES.includes(user.role)) throw new Error('Forbidden: edit requires HOD/SLT/Admin role')

  const data = {
    schoolId:        user.schoolId,
    yearGroup:       input.yearGroup,
    subject:         input.subject,
    planContent:     input.planContent,
    uploadedFileUrl: input.uploadedFileUrl ?? null,
    createdById:     user.id,
    status:          'DRAFT' as const,
    updatedAt:       new Date(),
  }

  if (input.id) {
    await prisma.yearGroupPlan.update({ where: { id: input.id }, data })
  } else {
    await prisma.yearGroupPlan.upsert({
      where: { schoolId_yearGroup_subject: { schoolId: user.schoolId, yearGroup: input.yearGroup, subject: input.subject } },
      create: data,
      update: { planContent: input.planContent, uploadedFileUrl: input.uploadedFileUrl ?? null, updatedAt: new Date() },
    })
  }
  revalidatePath('/plans/year-group')
}

export async function submitForApproval(id: string) {
  const user = await requireAccess()
  if (!EDIT_ROLES.includes(user.role)) throw new Error('Forbidden')
  await prisma.yearGroupPlan.update({ where: { id, schoolId: user.schoolId }, data: { status: 'SUBMITTED' } })
  revalidatePath('/plans/year-group')
}

export async function approvePlan(id: string) {
  const user = await requireAccess()
  if (!APPROVE_ROLES.includes(user.role)) throw new Error('Forbidden: approve requires HOD/SLT/Admin role')
  await prisma.yearGroupPlan.update({
    where: { id, schoolId: user.schoolId },
    data: { status: 'APPROVED', approvedById: user.id },
  })
  revalidatePath('/plans/year-group')
}

export async function deletePlan(id: string) {
  const user = await requireAccess()
  if (!EDIT_ROLES.includes(user.role)) throw new Error('Forbidden')
  await prisma.yearGroupPlan.delete({ where: { id, schoolId: user.schoolId } })
  revalidatePath('/plans/year-group')
}

// Used by homework generation to get scheme of work context
export async function getYearGroupPlanContext(schoolId: string, subject: string, yearGroup: number): Promise<string | null> {
  const plan = await prisma.yearGroupPlan.findUnique({
    where: { schoolId_yearGroup_subject: { schoolId, yearGroup, subject } },
    select: { planContent: true, status: true },
  })
  if (!plan || plan.status === 'DRAFT') return null
  return plan.planContent
}

// ── Phase 4: Curriculum coverage helpers ──────────────────────────────────────

export type CoverageUnit = {
  title:  string
  taught: boolean
  topics: string[]
}

export type CurriculumCoverage = {
  hasSchemeOfWork:   boolean
  units:             CoverageUnit[]
  taughtLessonTopics: string[]
}

/** Compare lessons taught in a class against the approved SoW for that subject/year. */
export async function getCurriculumCoverage(
  classId:   string,
  subject:   string,
  yearGroup: number,
): Promise<CurriculumCoverage> {
  const user = await requireAccess()

  const plan = await prisma.yearGroupPlan.findUnique({
    where: { schoolId_yearGroup_subject: { schoolId: user.schoolId, yearGroup, subject } },
    select: { planContent: true, status: true },
  })

  if (!plan || plan.status === 'DRAFT') {
    return { hasSchemeOfWork: false, units: [], taughtLessonTopics: [] }
  }

  const lessons = await prisma.lesson.findMany({
    where: { classId, schoolId: user.schoolId },
    select: { title: true },
  })

  const taughtLessonTopics = lessons.map(l => l.title)
  const taughtWords = new Set(
    lessons.flatMap(l =>
      l.title.toLowerCase().split(/[\s\-—,;:()\[\]]+/).filter(w => w.length > 3)
    )
  )

  const units: CoverageUnit[] = []
  let current: CoverageUnit | null = null

  for (const line of plan.planContent.split('\n')) {
    const headingMatch = line.match(/^##\s+(.+)/)
    if (headingMatch) {
      if (current) units.push(current)
      const title      = headingMatch[1].trim()
      const titleWords = title.toLowerCase().split(/[\s\-—,;:()\[\]]+/).filter(w => w.length > 3)
      current = { title, taught: titleWords.some(w => taughtWords.has(w)), topics: [] }
    } else if (current && line.startsWith('- ')) {
      const topic = line.slice(2).split(':')[0].trim()
      if (topic) current.topics.push(topic)
    }
  }
  if (current) units.push(current)

  return { hasSchemeOfWork: true, units, taughtLessonTopics }
}

/** Return a flat list of SoW topic names for a subject/year group (homework objective chips). */
export async function getSoWTopicsForClass(subject: string, yearGroup: number): Promise<string[]> {
  const user = await requireAccess()

  const plan = await prisma.yearGroupPlan.findUnique({
    where: { schoolId_yearGroup_subject: { schoolId: user.schoolId, yearGroup, subject } },
    select: { planContent: true, status: true },
  })

  if (!plan || plan.status === 'DRAFT') return []

  const topics: string[] = []
  for (const line of plan.planContent.split('\n')) {
    if (line.startsWith('- ')) {
      const topic = line.slice(2).split(':')[0].trim()
      if (topic) topics.push(topic)
    }
  }
  return topics
}
