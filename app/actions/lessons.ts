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
  id:             string
  title:          string
  scheduledAt:    string
  endsAt?:        string
  published:      boolean
  className:      string
  subject:        string
  lessonType?:    string
  hasPlan:        boolean
  hasSlides:      boolean
  hasHomework:    boolean
  homeworkStatus: string | null
  hasOther:       boolean
}

export async function getWeekLessons(weekStartISO: string): Promise<CalendarLessonData[]> {
  try {
    const session = await auth()
    if (!session) return []
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
          // classless lessons (e.g. cover, personal) created by this teacher
          { classId: null, createdBy: userId },
        ],
      },
      include: {
        class:     true,
        resources: { select: { type: true } },
        homework:  { select: { id: true, status: true } },
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
      hasPlan:        l.resources.some(r => r.type === 'PLAN'),
      hasSlides:      l.resources.some(r => r.type === 'SLIDES'),
      hasHomework:    l.homework.length > 0,
      homeworkStatus: l.homework.length > 0 ? l.homework[0].status : null,
      hasOther:       l.resources.some(r => r.type !== 'PLAN' && r.type !== 'SLIDES'),
    }))
  } catch (err) {
    console.error('[getWeekLessons] error:', err)
    return []
  }
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
  try {
  const session = await auth()
  if (!session) return null
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

  const [sendStatuses, plans, snapshots] = enrolledIds.length
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
        // Fetch supportSnapshot separately so a missing column (pending migration)
        // cannot break the core lesson load — it is only used in the SEND & Inclusion tab.
        prisma.user.findMany({
          where: { id: { in: enrolledIds } },
          select: { id: true, supportSnapshot: true },
        }).catch(() => [] as { id: string; supportSnapshot: string | null }[]),
      ])
    : [[], [], []]

  // Merge snapshots onto sendStatuses
  const snapshotMap = new Map((snapshots as { id: string; supportSnapshot: string | null }[]).map(u => [u.id, u.supportSnapshot]))
  const sendStatusesWithSnapshot = sendStatuses.map(ss => ({
    ...ss,
    student: { ...ss.student, supportSnapshot: snapshotMap.get(ss.studentId) ?? null },
  }))

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
    sendStatuses: sendStatusesWithSnapshot,
    planByStudent: Object.fromEntries(planByStudent),
    termAgg,
    subjectMedian,
  }
  } catch (err) {
    console.error('[getLessonDetails] error:', err)
    return null
  }
}

export async function updateLessonObjectives(lessonId: string, objectives: string[]) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any
  await prisma.lesson.updateMany({
    where: { id: lessonId, schoolId },
    data: { objectives },
  })
  revalidatePath('/dashboard')
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

// ── Class Roster ─────────────────────────────────────────────────────────────

export type ClassRosterRow = {
  id:              string
  firstName:       string
  lastName:        string
  avatarUrl:       string | null
  sendStatus:      string   // 'NONE' | 'SEN_SUPPORT' | 'EHCP'
  needArea:        string | null
  hasIlp:          boolean
  latestScore:     number | null
  maxScore:        number | null
  supportSnapshot: string | null
}

export async function getClassRoster(classId: string): Promise<ClassRosterRow[]> {
  try {
    const session = await auth()
    if (!session) return []
    const { schoolId } = session.user as any

    const enrolments = await prisma.enrolment.findMany({
      where:   { classId, class: { schoolId } },
      include: {
        user: {
          include: {
            sendStatus: { select: { activeStatus: true, needArea: true } },
            plans: {
              where:  { schoolId, status: { in: ['ACTIVE_INTERNAL', 'ACTIVE_PARENT_SHARED'] } },
              take:   1,
              select: { id: true },
            },
            submissions: {
              where:   { schoolId },
              orderBy: { submittedAt: 'desc' },
              take:    1,
              select:  { finalScore: true, autoScore: true, teacherScore: true, homework: { select: { gradingBands: true } } },
            },
            settings: { select: { profilePictureUrl: true } },
          },
        },
      },
      orderBy: [{ user: { lastName: 'asc' } }],
    })

    return enrolments.map(e => {
      const sub   = e.user.submissions[0]
      const score = sub?.finalScore ?? sub?.teacherScore ?? sub?.autoScore ?? null
      return {
        id:              e.user.id,
        firstName:       e.user.firstName,
        lastName:        e.user.lastName,
        avatarUrl:       e.user.settings?.profilePictureUrl ?? e.user.avatarUrl ?? null,
        sendStatus:      e.user.sendStatus?.activeStatus ?? 'NONE',
        needArea:        e.user.sendStatus?.needArea ?? null,
        hasIlp:          e.user.plans.length > 0,
        latestScore:     score,
        maxScore:        sub ? maxFromBandsServer(sub.homework?.gradingBands) : null,
        supportSnapshot: e.user.supportSnapshot ?? null,
      }
    })
  } catch (err) {
    console.error('[getClassRoster] error:', err)
    return []
  }
}

// ── Student class detail (for expandable roster row) ──────────────────────────

export type StudentClassDetail = {
  recentSubmissions: {
    homeworkTitle: string
    status:        string
    finalScore:    number | null
    autoScore:     number | null
    maxScore:      number | null
    dueAt:         string
  }[]
}

export async function getStudentClassDetail(
  studentId: string,
  classId:   string,
): Promise<StudentClassDetail> {
  try {
    const session = await auth()
    if (!session) return { recentSubmissions: [] }
    const { schoolId } = session.user as any

    const submissions = await prisma.submission.findMany({
      where: {
        studentId,
        schoolId,
        homework: { classId },
      },
      include: { homework: { select: { title: true, dueAt: true, gradingBands: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 5,
    })

    return {
      recentSubmissions: submissions.map(s => ({
        homeworkTitle: s.homework.title,
        status:        s.status,
        finalScore:    s.finalScore,
        autoScore:     s.autoScore,
        maxScore:      maxFromBandsServer(s.homework.gradingBands),
        dueAt:         s.homework.dueAt.toISOString(),
      })),
    }
  } catch (err) {
    console.error('[getStudentClassDetail] error:', err)
    return { recentSubmissions: [] }
  }
}

// ── Class-wide insights ────────────────────────────────────────────────────────

export type ClassInsightsStudent = {
  studentId:       string
  name:            string
  avgScore:        number | null   // 0–100 percentage
  submissionCount: number
  totalHomework:   number
  ragStatus:       'green' | 'amber' | 'red' | 'none'
}

export type ClassInsightsData = {
  students:      ClassInsightsStudent[]
  classAvg:      number | null
  totalHomework: number
}

function maxFromBandsServer(bands: unknown): number {
  if (!bands || typeof bands !== 'object') return 9
  const keys = Object.keys(bands as Record<string, string>)
  const nums = keys.flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n)))
  return nums.length ? Math.max(...nums) : 9
}

export async function getClassInsights(classId: string): Promise<ClassInsightsData> {
  try {
    const session = await auth()
    if (!session) return { students: [], classAvg: null, totalHomework: 0 }
    const { schoolId } = session.user as any

    const [enrolments, homework] = await Promise.all([
      prisma.enrolment.findMany({
        where:   { classId, class: { schoolId } },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ user: { lastName: 'asc' } }],
      }),
      prisma.homework.findMany({
        where: { classId, schoolId, status: { not: 'DRAFT' } },
        select: {
          id:           true,
          gradingBands: true,
          submissions:  { select: { studentId: true, finalScore: true, autoScore: true, teacherScore: true } },
        },
      }),
    ])

    const totalHomework = homework.length

    const students: ClassInsightsStudent[] = enrolments.map(e => {
      const studentId = e.user.id

      const pcts = homework.map(hw => {
        const sub = hw.submissions.find(s => s.studentId === studentId)
        if (!sub) return null
        const score = sub.finalScore ?? sub.autoScore ?? sub.teacherScore
        if (score == null) return null
        const max = maxFromBandsServer(hw.gradingBands)
        return Math.round((score / max) * 100)
      }).filter((v): v is number => v !== null)

      const avgScore        = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null
      const submissionCount = pcts.length

      const ragStatus: ClassInsightsStudent['ragStatus'] =
        avgScore == null ? 'none' :
        avgScore >= 70   ? 'green' :
        avgScore >= 40   ? 'amber' : 'red'

      return {
        studentId,
        name:            `${e.user.firstName} ${e.user.lastName}`,
        avgScore,
        submissionCount,
        totalHomework,
        ragStatus,
      }
    })

    const scored   = students.filter(s => s.avgScore != null)
    const classAvg = scored.length
      ? scored.reduce((a, s) => a + s.avgScore!, 0) / scored.length
      : null

    return { students, classAvg, totalHomework }
  } catch (err) {
    console.error('[getClassInsights] error:', err)
    return { students: [], classAvg: null, totalHomework: 0 }
  }
}
