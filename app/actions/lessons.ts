'use server'
import { auth } from '@/lib/auth'
import { prisma, writeAudit } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { LessonType, AudienceType, PlanStatus, ResourceType } from '@prisma/client'
import { type ReviewResult } from '@/lib/sendReview'
import { sendReviewCached } from '@/lib/sendReviewCached'
import { updateSendInsight } from '@/lib/sendInsights'
import Anthropic from '@anthropic-ai/sdk'

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
    // Add 5 days in ms then subtract 1ms → end of Friday regardless of client timezone offset
    const friday    = new Date(weekStart.getTime() + 5 * 86_400_000 - 1)

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

  // AI-generate learning objectives — fast Haiku call, swallowed on failure
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey) {
    try {
      // Fetch class context (subject + year group) if classId provided
      let subject   = ''
      let yearLabel = ''
      if (input.classId) {
        const cls = await prisma.schoolClass.findUnique({
          where:  { id: input.classId },
          select: { subject: true, yearGroup: true },
        })
        if (cls) { subject = cls.subject; yearLabel = `Year ${cls.yearGroup}` }
      }

      const contextParts = [
        subject   && `Subject: ${subject}`,
        yearLabel && `Year group: ${yearLabel}`,
        input.topic && `Topic: ${input.topic}`,
      ].filter(Boolean).join('. ')

      const client   = new Anthropic({ apiKey })
      const response = await client.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role:    'user',
          content: `Generate exactly 3 clear, specific learning objectives for a UK secondary school lesson titled "${input.title}".${contextParts ? ` ${contextParts}.` : ''}
Each objective must start with "Students will be able to" and be a single, measurable sentence.
Respond with ONLY a valid JSON array of 3 strings and nothing else.
Example format: ["Students will be able to ...", "Students will be able to ...", "Students will be able to ..."]`,
        }],
      })

      const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''
      // Strip any markdown code fences if present
      const cleaned = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
      const generated = JSON.parse(cleaned) as string[]
      if (Array.isArray(generated) && generated.length > 0) {
        await prisma.lesson.update({
          where: { id: lesson.id },
          data:  { objectives: generated.map(o => String(o)).slice(0, 5) },
        })
      }
    } catch (err) {
      console.error('[createLesson] objectives AI generation failed:', err)
      // Swallow — lesson was created; teacher can add objectives manually
    }
  }

  revalidatePath('/dashboard')
  return { id: lesson.id }
}

export async function getLessonDetails(lessonId: string) {
  console.log('[DEBUG] getLessonDetails called, lessonId:', lessonId)
  try {
  const session = await auth()
  console.log('[DEBUG] auth() result, session exists:', !!session, 'schoolId:', (session?.user as any)?.schoolId)
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
    console.error('[getLessonDetails] CAUGHT ERROR:', err instanceof Error ? err.message : String(err))
    console.error('[getLessonDetails] stack:', err instanceof Error ? err.stack : 'no stack')
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

// ── AI-generate learning objectives ──────────────────────────────────────────

/** Maps school subject name → Oak subject slug (mirrors LessonFolder.tsx) */
function toOakSlug(subject: string): string {
  const s = subject.toLowerCase().trim()
  const MAP: Record<string, string> = {
    'mathematics': 'maths', 'math': 'maths',
    'english language': 'english', 'english literature': 'english',
    'english lang': 'english', 'english lit': 'english',
    'eng lang': 'english', 'eng lit': 'english',
    'combined science': 'science', 'triple science': 'science',
    'physical education': 'physical-education', 'pe': 'physical-education',
    'p.e.': 'physical-education', 'p.e': 'physical-education',
    'art & design': 'art', 'art and design': 'art',
    'design & technology': 'design-and-technology',
    'design and technology': 'design-and-technology',
    'd&t': 'design-and-technology', 'dt': 'design-and-technology',
    'religious education': 'religious-education', 're': 'religious-education',
    'r.e.': 'religious-education', 'religious studies': 'religious-education',
    'rs': 'religious-education', 'pshe': 'rshe-and-pshe',
    'modern foreign languages': 'modern-foreign-languages', 'mfl': 'modern-foreign-languages',
  }
  return MAP[s] ?? s.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

/** Score an Oak lesson by keyword overlap with the given search terms */
function scoreOakLesson(lesson: { title: string; unitSlug: string; pupilLessonOutcome: string | null }, terms: string[]): number {
  if (terms.length === 0) return 0
  const haystack = `${lesson.title} ${lesson.unitSlug} ${lesson.pupilLessonOutcome ?? ''}`.toLowerCase()
  return terms.filter(t => haystack.includes(t.toLowerCase())).length
}

export async function generateLessonObjectives(lessonId: string): Promise<string[]> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  // Fetch lesson + class context
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId },
    select: {
      title: true, topic: true, examBoard: true, objectives: true,
      class: { select: { subject: true, yearGroup: true } },
    },
  })
  if (!lesson) throw new Error('Lesson not found')

  const subject   = lesson.class?.subject ?? ''
  const yearGroup = lesson.class?.yearGroup ?? null
  const topic     = lesson.topic ?? ''
  const title     = lesson.title

  // ── Query Oak curriculum for matching content ──────────────────────────────
  const subjectSlug = subject ? toOakSlug(subject) : null

  // Search terms: split title + topic into individual words (3+ chars)
  const searchTerms = [...title.split(/\s+/), ...topic.split(/\s+/)]
    .map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length >= 3)

  let oakContext = ''
  if (subjectSlug) {
    const candidates = await prisma.oakLesson.findMany({
      where: {
        subjectSlug,
        ...(yearGroup ? { yearGroup } : {}),
        NOT: { pupilLessonOutcome: null },
      },
      select: {
        title: true,
        unitSlug: true,
        pupilLessonOutcome: true,
        keyLearningPoints: true,
      },
      take: 200,
    })

    // Score and pick the best match
    const scored = candidates.map(c => ({
      ...c,
      score: scoreOakLesson(c, searchTerms),
    })).sort((a, b) => b.score - a.score)

    const top = scored.filter(c => c.score > 0).slice(0, 3)

    if (top.length > 0) {
      const parts: string[] = []
      for (const c of top) {
        if (c.pupilLessonOutcome) parts.push(`- ${c.pupilLessonOutcome}`)
        const klp = (c.keyLearningPoints as Array<{ keyLearningPoint?: string }> | null) ?? []
        for (const k of klp.slice(0, 3)) {
          if (k.keyLearningPoint) parts.push(`  • ${k.keyLearningPoint}`)
        }
      }
      if (parts.length > 0) {
        oakContext = `\n\nRelevant national curriculum content from Oak National Academy for ${subject}${yearGroup ? ` Year ${yearGroup}` : ''}:\n${parts.join('\n')}`
      }
    }
  }

  // ── Placeholder fallback (no AI key or no match) ──────────────────────────
  const placeholders = [
    `Students will be able to explain key concepts relating to ${topic || title}.`,
    `Students will be able to apply their understanding of ${topic || title} to unseen examples.`,
    `Students will be able to evaluate and critically analyse ${topic || title}.`,
  ]

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    await prisma.lesson.updateMany({ where: { id: lessonId, schoolId }, data: { objectives: placeholders } })
    return placeholders
  }

  // ── Claude Haiku call ─────────────────────────────────────────────────────
  try {
    const contextLine = [
      subject   && `Subject: ${subject}`,
      yearGroup && `Year group: Year ${yearGroup}`,
      topic     && `Topic: ${topic}`,
      lesson.examBoard && `Exam board: ${lesson.examBoard}`,
    ].filter(Boolean).join('. ')

    const prompt = `Generate exactly 3 clear, specific learning objectives for a UK secondary school lesson.

Lesson title: "${title}"
${contextLine}${oakContext}

Each objective must:
- Start with "Students will be able to"
- Be a single, measurable sentence
- Be aligned to UK national curriculum expectations
- Progress from recall → application → analysis/evaluation

Respond with ONLY a valid JSON array of exactly 3 strings and nothing else.
Example: ["Students will be able to ...", "Students will be able to ...", "Students will be able to ..."]`

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text    = response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''
    const cleaned = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed  = JSON.parse(cleaned) as string[]

    if (Array.isArray(parsed) && parsed.length > 0) {
      const objectives = parsed.map(o => String(o)).slice(0, 3)
      await prisma.lesson.updateMany({ where: { id: lessonId, schoolId }, data: { objectives } })
      return objectives
    }
  } catch (err) {
    console.error('[generateLessonObjectives] Claude call failed:', err)
  }

  // Final fallback — save placeholders so the UI is never blank
  await prisma.lesson.updateMany({ where: { id: lessonId, schoolId }, data: { objectives: placeholders } })
  return placeholders
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
  id:                  string
  firstName:           string
  lastName:            string
  yearGroup:           number | null
  avatarUrl:           string | null
  sendStatus:          string   // 'NONE' | 'SEN_SUPPORT' | 'EHCP'
  needArea:            string | null
  hasIlp:              boolean
  hasEhcp:             boolean
  latestScore:         number | null
  maxScore:            number | null
  supportSnapshot:     string | null
  // Wonde MIS data
  attendancePercentage: number | null
  behaviourPositive:    number | null
  behaviourNegative:    number | null
  hasExclusion:         boolean | null
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
            studentIlps: {
              where:  { schoolId, status: { in: ['ACTIVE', 'UNDER_REVIEW'] } },
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
      const status = e.user.sendStatus?.activeStatus ?? 'NONE'
      return {
        id:              e.user.id,
        firstName:       e.user.firstName,
        lastName:        e.user.lastName,
        yearGroup:           e.user.yearGroup ?? null,
        // Prefer UserSettings.profilePictureUrl (teacher-uploaded or Wonde proxy URL set during sync)
        // Fall back to User.avatarUrl (also set by Wonde sync and used by other roster queries)
        avatarUrl:           e.user.settings?.profilePictureUrl ?? e.user.avatarUrl ?? null,
        sendStatus:          status,
        needArea:            e.user.sendStatus?.needArea ?? null,
        hasIlp:              e.user.studentIlps.length > 0,
        hasEhcp:             status === 'EHCP',
        latestScore:         score,
        maxScore:            sub ? maxFromBandsServer(sub.homework?.gradingBands) : null,
        supportSnapshot:     e.user.supportSnapshot ?? null,
        // Wonde MIS data (null when not a Wonde-synced school)
        attendancePercentage: e.user.attendancePercentage ?? null,
        behaviourPositive:    e.user.behaviourPositive    ?? null,
        behaviourNegative:    e.user.behaviourNegative    ?? null,
        hasExclusion:         e.user.hasExclusion         ?? null,
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
    homeworkId:    string
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
      include: { homework: { select: { id: true, title: true, dueAt: true, gradingBands: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 5,
    })

    return {
      recentSubmissions: submissions.map(s => ({
        homeworkId:    s.homework.id,
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

// ── Roster Notes + Student Roster Detail ─────────────────────────────────────

export type RosterNote = {
  id:        string
  content:   string
  createdAt: string
  actorId:   string
}

export type StudentRosterDetail = {
  recentHomework: {
    id:       string
    title:    string
    dueAt:    string
    status:   string
    score:    number | null
    maxScore: number
    grade:    string | null
  }[]
  examScores: {
    id:       string
    title:    string
    dueAt:    string
    score:    number | null
    maxScore: number
    grade:    string | null
  }[]
  rosterNotes: RosterNote[]
}

export async function getStudentRosterDetail(
  studentId: string,
  classId:   string,
): Promise<StudentRosterDetail> {
  try {
    const session = await auth()
    if (!session) return { recentHomework: [], examScores: [], rosterNotes: [] }
    const { schoolId } = session.user as any

    // Recent homework submissions for this student in this class
    const [classSubs, allSubs, auditNotes] = await Promise.all([
      prisma.submission.findMany({
        where:   { studentId, schoolId, homework: { classId } },
        include: { homework: { select: { id: true, title: true, dueAt: true, gradingBands: true, type: true } } },
        orderBy: { submittedAt: 'desc' },
        take:    5,
      }),
      // Exam-type submissions across all classes for this student at this school
      prisma.submission.findMany({
        where: {
          studentId,
          schoolId,
          OR: [
            { homework: { title: { contains: 'test',       mode: 'insensitive' } } },
            { homework: { title: { contains: 'exam',       mode: 'insensitive' } } },
            { homework: { title: { contains: 'mock',       mode: 'insensitive' } } },
            { homework: { title: { contains: 'assessment', mode: 'insensitive' } } },
            { homework: { type: 'MCQ_QUIZ' } },
          ],
        },
        include: { homework: { select: { id: true, title: true, dueAt: true, gradingBands: true, type: true } } },
        orderBy: { submittedAt: 'desc' },
        take:    10,
      }),
      prisma.auditLog.findMany({
        where:   { schoolId, targetType: 'RosterNote', targetId: studentId },
        orderBy: { createdAt: 'desc' },
        take:    20,
      }),
    ])

    function scoreFromSub(s: { finalScore: number | null; teacherScore: number | null; autoScore: number | null }) {
      return s.finalScore ?? s.teacherScore ?? s.autoScore ?? null
    }

    function gradeFromScore(score: number | null, maxScore: number): string | null {
      if (score == null) return null
      const pct = maxScore && maxScore !== 100 ? Math.round((score / maxScore) * 100) : score
      if (pct >= 90) return '9'
      if (pct >= 80) return '8'
      if (pct >= 70) return '7'
      if (pct >= 60) return '6'
      if (pct >= 50) return '5'
      if (pct >= 40) return '4'
      if (pct >= 30) return '3'
      if (pct >= 20) return '2'
      return '1'
    }

    const recentHomework = classSubs.map(s => {
      const score    = scoreFromSub(s)
      const maxScore = maxFromBandsServer(s.homework.gradingBands)
      return {
        id:       s.homework.id,
        title:    s.homework.title,
        dueAt:    s.homework.dueAt.toISOString(),
        status:   s.status,
        score,
        maxScore,
        grade:    gradeFromScore(score, maxScore),
      }
    })

    const examScores = allSubs.map(s => {
      const score    = scoreFromSub(s)
      const maxScore = maxFromBandsServer(s.homework.gradingBands)
      return {
        id:       s.homework.id,
        title:    s.homework.title,
        dueAt:    s.homework.dueAt.toISOString(),
        status:   s.status,
        score,
        maxScore,
        grade:    gradeFromScore(score, maxScore),
      }
    })

    const rosterNotes: RosterNote[] = auditNotes.map(n => ({
      id:        n.id,
      content:   (n.metadata as any)?.content ?? '',
      createdAt: n.createdAt.toISOString(),
      actorId:   n.actorId,
    }))

    return { recentHomework, examScores, rosterNotes }
  } catch (err) {
    console.error('[getStudentRosterDetail] error:', err)
    return { recentHomework: [], examScores: [], rosterNotes: [] }
  }
}

// ── Class performance time series ─────────────────────────────────────────────

export type TimeSeriesPoint = {
  homeworkId:          string
  title:               string
  dueAt:               string   // ISO
  classAvgScore:       number | null
  yearAvgScore:        number | null
  curriculumBaseline:  number          // fixed at 65
  scores: { studentId: string; name: string; score: number | null }[]
}

export type ClassTimeSeriesData = {
  points:       TimeSeriesPoint[]
  studentNames: { studentId: string; name: string }[]
}

export async function getClassTimeSeries(classId: string): Promise<ClassTimeSeriesData> {
  try {
    const session = await auth()
    if (!session) return { points: [], studentNames: [] }
    const { schoolId } = session.user as any

    // 1. Get class metadata
    const cls = await prisma.schoolClass.findFirst({
      where:  { id: classId, schoolId },
      select: { yearGroup: true, subject: true },
    })
    if (!cls) return { points: [], studentNames: [] }

    const { yearGroup, subject } = cls

    // 2. Fetch this class's published homework ordered by dueAt
    const classHomework = await prisma.homework.findMany({
      where:   { classId, schoolId, status: { not: 'DRAFT' } },
      select: {
        id:           true,
        title:        true,
        dueAt:        true,
        gradingBands: true,
        submissions:  {
          select: {
            studentId:   true,
            finalScore:  true,
            autoScore:   true,
            teacherScore: true,
          },
        },
      },
      orderBy: { dueAt: 'asc' },
    })

    // 3. Fetch enrolled students
    const enrolments = await prisma.enrolment.findMany({
      where:   { classId, class: { schoolId } },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ user: { lastName: 'asc' } }],
    })

    const studentNames = enrolments.map(e => ({
      studentId: e.user.id,
      name:      `${e.user.firstName} ${e.user.lastName}`,
    }))

    // 4. Compute year group average (excluding this class)
    const yearHomework = await prisma.homework.findMany({
      where: {
        schoolId,
        classId:  { not: classId },
        class:    { yearGroup, subject },
        status:   { not: 'DRAFT' },
      },
      select: {
        gradingBands: true,
        submissions:  { select: { finalScore: true, autoScore: true } },
      },
    })

    // Flatten to percentages
    const yearPcts: number[] = []
    for (const hw of yearHomework) {
      const max = maxFromBandsServer(hw.gradingBands)
      for (const sub of hw.submissions) {
        const score = sub.finalScore ?? sub.autoScore
        if (score != null) yearPcts.push((score / max) * 100)
      }
    }
    const overallYearAvg = yearPcts.length
      ? yearPcts.reduce((a, b) => a + b, 0) / yearPcts.length
      : null

    // 5. Build time series points — only for homework with at least one submission
    const points: TimeSeriesPoint[] = []

    for (const hw of classHomework) {
      if (hw.submissions.length === 0) continue

      const max = maxFromBandsServer(hw.gradingBands)

      // Per-student scores
      const studentNameMap = new Map(studentNames.map(s => [s.studentId, s.name]))
      const scores = enrolments.map(e => {
        const sub = hw.submissions.find(s => s.studentId === e.user.id)
        const rawScore = sub ? (sub.finalScore ?? sub.autoScore ?? sub.teacherScore) : null
        const pct = rawScore != null ? Math.round((rawScore / max) * 100) : null
        return { studentId: e.user.id, name: studentNameMap.get(e.user.id) ?? '', score: pct }
      })

      // Class average
      const classScores = scores.map(s => s.score).filter((v): v is number => v !== null)
      const classAvgScore = classScores.length
        ? classScores.reduce((a, b) => a + b, 0) / classScores.length
        : null

      points.push({
        homeworkId:         hw.id,
        title:              hw.title,
        dueAt:              hw.dueAt.toISOString(),
        classAvgScore,
        yearAvgScore:       overallYearAvg,
        curriculumBaseline: 65,
        scores,
      })
    }

    return { points, studentNames }
  } catch (err) {
    console.error('[getClassTimeSeries] error:', err)
    return { points: [], studentNames: [] }
  }
}

export async function addRosterNote(studentId: string, content: string): Promise<void> {
  try {
    const session = await auth()
    if (!session) return
    const { schoolId, id: actorId } = session.user as any
    await writeAudit({
      schoolId,
      actorId,
      action:     'USER_SETTINGS_CHANGED',
      targetType: 'RosterNote',
      targetId:   studentId,
      metadata:   { content },
    })
  } catch (err) {
    console.error('[addRosterNote] error:', err)
  }
}
