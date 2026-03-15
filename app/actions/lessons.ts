'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { LessonType, AudienceType, PlanStatus, ResourceType } from '@prisma/client'
import { type ReviewResult } from '@/lib/sendReview'
import { sendReviewCached } from '@/lib/sendReviewCached'
import { updateSendInsight } from '@/lib/sendInsights'

// ── CalendarLesson shape (mirrors WeeklyCalendar type) ────────────────────────
export type CalendarLessonData = {
  id:          string
  title:       string
  scheduledAt: string
  endsAt?:     string
  published:   boolean
  className:   string
  subject:     string
  lessonType?: string
  hasPlan:     boolean
  hasSlides:   boolean
  hasHomework: boolean
  hasOther:    boolean
}

export async function getWeekLessons(weekStartISO: string): Promise<CalendarLessonData[]> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId } = session.user as any

  const weekStart = new Date(weekStartISO)
  const friday    = new Date(weekStart)
  friday.setDate(weekStart.getDate() + 4)
  friday.setHours(23, 59, 59, 999)

  const lessons = await prisma.lesson.findMany({
    where: {
      schoolId,
      scheduledAt: { gte: weekStart, lte: friday },
      OR: [
        { class: { teachers: { some: { userId } } } },
        { createdBy: userId },
      ],
    },
    include: {
      class:     true,
      resources: { select: { type: true } },
      homework:  { select: { id: true } },
    },
  })

  return lessons.map(l => ({
    id:          l.id,
    title:       l.title,
    scheduledAt: l.scheduledAt.toISOString(),
    endsAt:      l.endsAt?.toISOString(),
    published:   l.published,
    className:   l.class?.name    ?? '—',
    subject:     l.class?.subject ?? '—',
    lessonType:  l.lessonType,
    hasPlan:     l.resources.some(r => r.type === 'PLAN'),
    hasSlides:   l.resources.some(r => r.type === 'SLIDES'),
    hasHomework: l.homework.length > 0,
    hasOther:    l.resources.some(r => r.type !== 'PLAN' && r.type !== 'SLIDES'),
  }))
}

export type CreateLessonInput = {
  classId:      string | null
  title:        string
  scheduledAt:  string   // ISO
  endsAt:       string   // ISO
  lessonType:   LessonType
  audienceType: AudienceType
  topic?:       string
  examBoard?:   string
}

export async function createLesson(input: CreateLessonInput) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId } = session.user as any

  const lesson = await prisma.lesson.create({
    data: {
      schoolId,
      classId:      input.classId ?? undefined,
      title:        input.title,
      topic:        input.topic ?? undefined,
      examBoard:    input.examBoard ?? undefined,
      objectives:   [],
      lessonType:   input.lessonType,
      audienceType: input.audienceType,
      scheduledAt:  new Date(input.scheduledAt),
      endsAt:       new Date(input.endsAt),
      published:    false,
      createdBy:    userId,
    },
  })

  revalidatePath('/dashboard')
  return { id: lesson.id }
}

export async function getLessonDetails(lessonId: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId },
    include: {
      class: {
        include: {
          _count: { select: { enrolments: true } },
          teachers: { include: { user: { select: { firstName: true, lastName: true } } } },
          enrolments: { include: { user: { select: { id: true, firstName: true, lastName: true } } }, orderBy: [{ user: { lastName: 'asc' } }] },
        },
      },
      resources: {
        include: { review: true },
        orderBy: { createdAt: 'asc' },
      },
      homework: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          submissions: {
            include: { student: { select: { id: true, firstName: true, lastName: true } } },
            orderBy: { submittedAt: 'desc' },
          },
        },
      },
    },
  })

  if (!lesson) return null

  const enrolledIds = lesson.class?.enrolments.map(e => e.user.id) ?? []

  const [sendStatuses, plans] = enrolledIds.length
    ? await Promise.all([
        prisma.sendStatus.findMany({
          where: { studentId: { in: enrolledIds }, NOT: { activeStatus: 'NONE' } },
          include: { student: { select: { id: true, firstName: true, lastName: true } } },
        }),
        prisma.plan.findMany({
          where: {
            studentId: { in: enrolledIds },
            schoolId,
            status: { in: [PlanStatus.ACTIVE_INTERNAL, PlanStatus.ACTIVE_PARENT_SHARED] },
          },
          include: { targets: true, strategies: true },
          orderBy: { activatedAt: 'desc' },
        }),
      ])
    : [[], []]

  // One active plan per student (most recently activated)
  const planByStudent = new Map<string, typeof plans[0]>()
  for (const p of plans) {
    if (!planByStudent.has(p.studentId)) planByStudent.set(p.studentId, p)
  }

  const [termAgg, subjectMedian] = lesson.class
    ? await Promise.all([
        prisma.classPerformanceAggregate.findFirst({
          where:   { classId: lesson.class.id },
          orderBy: { termId: 'desc' },
        }),
        prisma.subjectMedianAggregate.findFirst({
          where:   { schoolId, subjectId: lesson.class.subject, yearGroup: lesson.class.yearGroup },
          orderBy: { termId: 'desc' },
        }),
      ])
    : [null, null]

  return {
    ...lesson,
    sendStatuses,
    planByStudent: Object.fromEntries(planByStudent),
    termAgg,
    subjectMedian,
  }
}

export async function updateLessonOverview(lessonId: string, data: {
  title: string
  objectives: string[]
}) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  await prisma.lesson.updateMany({
    where: { id: lessonId, schoolId },
    data: { title: data.title, objectives: data.objectives },
  })

  revalidatePath('/dashboard')
}

// ── Resource library ──────────────────────────────────────────────────────────

export async function getSchoolResourceLibrary(forLessonId?: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  // Resolve the calling lesson's subject + yearGroup for contextual filtering
  let contextSubject: string | undefined
  if (forLessonId) {
    const ctx = await prisma.lesson.findUnique({
      where:  { id: forLessonId },
      select: { class: { select: { subject: true } } },
    })
    contextSubject = ctx?.class?.subject ?? undefined
  }

  return prisma.resource.findMany({
    where: {
      schoolId,
      type: { in: [ResourceType.PLAN, ResourceType.SLIDES, ResourceType.WORKSHEET] },
      // Exclude resources already attached to this lesson
      ...(forLessonId ? { NOT: { lessonId: forLessonId } } : {}),
      // Filter to same subject when context is known (any year group)
      ...(contextSubject ? {
        lesson: {
          class: { subject: contextSubject },
        },
      } : {}),
    },
    include: { review: true },
    orderBy: { updatedAt: 'desc' },
    take: 60,
  })
}

// ── Add URL resource with SEND review ────────────────────────────────────────

export async function addUrlResource(
  lessonId: string,
  input: { label: string; type: ResourceType; url: string; description?: string }
): Promise<{ resourceId: string; review: ReviewResult }> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId } = session.user as any

  const resource = await prisma.resource.create({
    data: {
      schoolId,
      lessonId,
      type:      input.type,
      label:     input.label,
      url:       input.url,
      createdBy: userId,
    },
  })

  // Run SEND review — always returns something (fallback on any error)
  let review: ReviewResult = { score: 5, suggestions: ['Add a description to get a more accurate SEND review.'] }
  try {
    review = await sendReviewCached({
      label:       input.label,
      type:        input.type,
      url:         input.url,
      description: input.description,
    })
    await prisma.resourceReview.create({
      data: {
        resourceId:  resource.id,
        sendScore:   review.score,
        suggestions: review.suggestions,
        reviewedBy:  'claude-ai',
        reviewedAt:  new Date(),
      },
    })
    await updateSendInsight({ schoolId, lessonId, resourceType: input.type })
  } catch (err) {
    console.error('[addUrlResource] SEND review failed:', err)
  }

  revalidatePath('/dashboard')
  return { resourceId: resource.id, review }
}

// ── Add uploaded file resource (stub) with SEND review ───────────────────────

export async function addUploadedResource(
  lessonId: string,
  input: { label: string; type: ResourceType; fileName: string; description?: string }
): Promise<{ resourceId: string; review: ReviewResult }> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId } = session.user as any

  const resource = await prisma.resource.create({
    data: {
      schoolId,
      lessonId,
      type:      input.type,
      label:     input.label,
      fileKey:   `stub:${input.fileName}`,
      createdBy: userId,
    },
  })

  // Run SEND review — always returns something (fallback on any error)
  let review: ReviewResult = { score: 5, suggestions: ['Add a description to get a more accurate SEND review.'] }
  try {
    review = await sendReviewCached({
      label:       input.label,
      type:        input.type,
      description: input.description,
    })
    await prisma.resourceReview.create({
      data: {
        resourceId:  resource.id,
        sendScore:   review.score,
        suggestions: review.suggestions,
        reviewedBy:  'claude-ai',
        reviewedAt:  new Date(),
      },
    })
    await updateSendInsight({ schoolId, lessonId, resourceType: input.type })
  } catch (err) {
    console.error('[addUploadedResource] SEND review failed:', err)
  }

  revalidatePath('/dashboard')
  return { resourceId: resource.id, review }
}

// ── Reuse a library resource (copy + inherit review) ─────────────────────────

export async function addLibraryResource(
  lessonId: string,
  sourceResourceId: string
): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId } = session.user as any

  const source = await prisma.resource.findFirst({
    where:   { id: sourceResourceId, schoolId },
    include: { review: true },
  })
  if (!source) throw new Error('Resource not found')

  const copy = await prisma.resource.create({
    data: {
      schoolId,
      lessonId,
      type:        source.type,
      label:       source.label,
      url:         source.url ?? undefined,
      fileKey:     source.fileKey ?? undefined,
      oakContentId: source.oakContentId ?? undefined,
      createdBy:   userId,
    },
  })

  // Inherit SEND review score
  if (source.review) {
    await prisma.resourceReview.create({
      data: {
        resourceId:  copy.id,
        sendScore:   source.review.sendScore,
        suggestions: source.review.suggestions as string[],
        reviewedBy:  source.review.reviewedBy ?? undefined,
        reviewedAt:  source.review.reviewedAt ?? undefined,
        accepted:    false,
      },
    })
    await updateSendInsight({ schoolId, lessonId, resourceType: source.type })
  }

  revalidatePath('/dashboard')
}

// ── Re-review resource with updated metadata ─────────────────────────────────

export async function reReviewResource(
  resourceId: string,
  updates: { label: string; description?: string }
): Promise<{ review: ReviewResult }> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  const resource = await prisma.resource.findFirst({ where: { id: resourceId, schoolId } })
  if (!resource) throw new Error('Resource not found')

  await prisma.resource.update({ where: { id: resourceId }, data: { label: updates.label } })

  const review = await sendReviewCached({
    label:       updates.label,
    type:        resource.type,
    url:         resource.url ?? undefined,
    description: updates.description,
  })

  await prisma.resourceReview.upsert({
    where:  { resourceId },
    create: {
      resourceId,
      sendScore:   review.score,
      suggestions: review.suggestions,
      reviewedBy:  'claude-ai',
      reviewedAt:  new Date(),
    },
    update: {
      sendScore:   review.score,
      suggestions: review.suggestions,
      reviewedAt:  new Date(),
    },
  })

  revalidatePath('/dashboard')
  return { review }
}

// ── Remove resource ───────────────────────────────────────────────────────────

export async function removeResource(resourceId: string): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  // Delete review first (FK constraint)
  await prisma.resourceReview.deleteMany({ where: { resourceId } })
  await prisma.resourceVersion.deleteMany({ where: { resourceId } })
  await prisma.resource.deleteMany({ where: { id: resourceId, schoolId } })

  revalidatePath('/dashboard')
}

// ── Delete lesson ─────────────────────────────────────────────────────────────

export async function deleteLesson(lessonId: string): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  // Cascade: reviews → resource versions → resources → homework → lesson
  const resources = await prisma.resource.findMany({ where: { lessonId, schoolId }, select: { id: true } })
  const resourceIds = resources.map(r => r.id)
  await prisma.resourceReview.deleteMany({ where: { resourceId: { in: resourceIds } } })
  await prisma.resourceVersion.deleteMany({ where: { resourceId: { in: resourceIds } } })
  await prisma.resource.deleteMany({ where: { lessonId, schoolId } })
  await prisma.submission.deleteMany({ where: { homework: { lessonId } } })
  await prisma.homework.deleteMany({ where: { lessonId, schoolId } })
  await prisma.lesson.deleteMany({ where: { id: lessonId, schoolId } })

  revalidatePath('/dashboard')
}

// ── Reschedule lesson ─────────────────────────────────────────────────────────

export async function rescheduleLesson(
  lessonId: string,
  scheduledAt: string,
  endsAt: string,
): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  await prisma.lesson.updateMany({
    where: { id: lessonId, schoolId },
    data:  { scheduledAt: new Date(scheduledAt), endsAt: new Date(endsAt) },
  })

  revalidatePath('/dashboard')
}

// ── Update resource metadata ──────────────────────────────────────────────────

export async function updateResource(
  resourceId: string,
  data: { label?: string; url?: string }
): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  await prisma.resource.updateMany({
    where: { id: resourceId, schoolId },
    data,
  })

  revalidatePath('/dashboard')
}
