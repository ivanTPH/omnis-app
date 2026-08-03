'use server'
import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { revalidatePath, unstable_cache } from 'next/cache'
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
    const { schoolId, id: userId } = await requireAuth()

    const weekStart = new Date(weekStartISO)
    // Add 5 days in ms then subtract 1ms → end of Friday regardless of client timezone offset
    const friday    = new Date(weekStart.getTime() + 5 * 86_400_000 - 1)

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
  const { schoolId, id: userId } = await requireAuth()

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
  try {
  const { schoolId } = await requireAuth()

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

  // Replace base64 data URLs with authenticated API route to avoid megabytes in JSON payload
  lesson.resources = lesson.resources.map(r => {
    if (r.url?.startsWith('data:')) {
      return { ...r, url: `/api/resource-file/${r.id}` }
    }
    return r
  })

  const enrolledIds = lesson.class?.enrolments.map(e => e.user.id) ?? []

  const [sendStatuses, plans, snapshots, ilpsByStudent, ehcpsByStudent, kPlansRaw] = enrolledIds.length
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
        // Active ILP targets per SEND student (SEND & Inclusion tab)
        prisma.individualLearningPlan.findMany({
          where: { studentId: { in: enrolledIds }, schoolId, status: 'active' },
          select: {
            studentId: true,
            targets: {
              where: { status: 'active' },
              take: 3,
              select: { id: true, target: true, strategy: true, successMeasure: true, targetDate: true, status: true },
            },
          },
        }).catch(() => [] as { studentId: string; targets: { id: string; target: string; strategy: string; successMeasure: string; targetDate: Date; status: string }[] }[]),
        // Active EHCP outcomes per EHCP student (SEND & Inclusion tab)
        prisma.ehcpPlan.findMany({
          where: { studentId: { in: enrolledIds }, schoolId, status: 'active' },
          select: {
            studentId: true,
            outcomes: {
              where: { status: 'active' },
              take: 2,
              select: { id: true, outcomeText: true, section: true, provisionRequired: true },
            },
          },
        }).catch(() => [] as { studentId: string; outcomes: { id: string; outcomeText: string; section: string; provisionRequired: string | null }[] }[]),
        // K Plan (student voice) — only show when GDPR consented
        prisma.kPlan.findMany({
          where: { studentId: { in: enrolledIds }, schoolId, gdprConsented: true },
          select: {
            studentId:              true,
            iLearnBestWhen:         true,
            pleaseHelpMeBy:         true,
            examAccessArrangements: true,
          },
        }).catch(() => [] as { studentId: string; iLearnBestWhen: string | null; pleaseHelpMeBy: string | null; examAccessArrangements: string[] }[]),
      ])
    : [[], [], [], [], [], []]

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

  // ILP targets grouped by studentId
  type IlpTargetRow = { id: string; target: string; strategy: string; successMeasure: string; targetDate: Date; status: string }
  const ilpTargetsByStudent: Record<string, IlpTargetRow[]> = {}
  for (const ilp of ilpsByStudent as { studentId: string; targets: IlpTargetRow[] }[]) {
    if (!ilpTargetsByStudent[ilp.studentId]) ilpTargetsByStudent[ilp.studentId] = []
    ilpTargetsByStudent[ilp.studentId].push(...ilp.targets)
  }

  // EHCP outcomes grouped by studentId
  type EhcpOutcomeRow = { id: string; outcomeText: string; section: string; provisionRequired: string | null }
  const ehcpOutcomesByStudent: Record<string, EhcpOutcomeRow[]> = {}
  for (const ehcp of ehcpsByStudent as { studentId: string; outcomes: EhcpOutcomeRow[] }[]) {
    if (!ehcpOutcomesByStudent[ehcp.studentId]) ehcpOutcomesByStudent[ehcp.studentId] = []
    ehcpOutcomesByStudent[ehcp.studentId].push(...ehcp.outcomes)
  }

  // K Plan by studentId (only GDPR-consented records)
  type KPlanRow = { studentId: string; iLearnBestWhen: string | null; pleaseHelpMeBy: string | null; examAccessArrangements: string[] }
  const kPlanByStudent: Record<string, KPlanRow> = {}
  for (const kp of kPlansRaw as KPlanRow[]) {
    kPlanByStudent[kp.studentId] = kp
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
    ilpTargetsByStudent,
    ehcpOutcomesByStudent,
    kPlanByStudent,
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
  const { schoolId } = await requireAuth()
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
  const { schoolId } = await requireAuth()

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
  const { schoolId } = await requireAuth()

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
  const { schoolId } = await requireAuth()

  // Resolve the calling lesson's subject + yearGroup for contextual filtering
  let contextSubject: string | undefined
  if (forLessonId) {
    const ctx = await prisma.lesson.findUnique({
      where:  { id: forLessonId },
      select: { class: { select: { subject: true } } },
    })
    contextSubject = ctx?.class?.subject ?? undefined
  }

  const rows = await prisma.resource.findMany({
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
    take: 120,
  })

  // Deduplicate: same file can be attached to multiple lessons — keep highest sendScore copy
  const seen = new Map<string, typeof rows[number]>()
  for (const row of rows) {
    const key = row.url ?? row.fileKey ?? row.label
    const existing = seen.get(key)
    if (!existing || ((row.review?.sendScore ?? -1) > (existing.review?.sendScore ?? -1))) {
      seen.set(key, row)
    }
  }
  return Array.from(seen.values())
}

// ── Lesson picker for resource library "Add to lesson" ────────────────────────

export type LessonPickerItem = {
  id:        string
  title:     string
  subject:   string | null
  className: string | null
  scheduledAt: string  // ISO
}

export async function getLessonsForPicker(): Promise<LessonPickerItem[]> {
  const { schoolId, id: userId } = await requireAuth()
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const to   = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  const lessons = await prisma.lesson.findMany({
    where: {
      schoolId,
      scheduledAt: { gte: from, lte: to },
      OR: [
        { createdBy: userId },
        { class: { teachers: { some: { userId } } } },
      ],
    },
    include: { class: true },
    orderBy: { scheduledAt: 'asc' },
    take: 40,
  })

  return lessons.map(l => ({
    id:          l.id,
    title:       l.title,
    subject:     l.class?.subject ?? null,
    className:   l.class?.name ?? null,
    scheduledAt: l.scheduledAt.toISOString(),
  }))
}

// ── Full resource library (for /resources page) ───────────────────────────────

export type ResourceLibraryItem = {
  id:         string
  label:      string
  type:       string
  url:        string | null
  fileKey:    string | null
  lessonId:   string | null
  createdBy:  string
  createdAt:  Date
  updatedAt:  Date
  sendScore:  number | null
  lessonTitle?: string | null
  subject?:    string | null
}

export async function getFullResourceLibrary(
  typeFilter?: string,
  query?:      string,
): Promise<ResourceLibraryItem[]> {
  const { schoolId } = await requireAuth()

  const resources = await prisma.resource.findMany({
    where: {
      schoolId,
      ...(typeFilter ? { type: typeFilter as ResourceType } : {}),
      ...(query ? { label: { contains: query, mode: 'insensitive' } } : {}),
    },
    include: {
      review:  { select: { sendScore: true } },
      lesson:  { select: { title: true, class: { select: { subject: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
    take:    200,
  })

  const mapped = resources.map(r => ({
    id:         r.id,
    label:      r.label,
    type:       r.type,
    url:        r.url ?? null,
    fileKey:    r.fileKey ?? null,
    lessonId:   r.lessonId ?? null,
    createdBy:  r.createdBy,
    createdAt:  r.createdAt,
    updatedAt:  r.updatedAt,
    sendScore:  r.review?.sendScore ?? null,
    lessonTitle: r.lesson?.title ?? null,
    subject:    r.lesson?.class?.subject ?? null,
  }))

  // Deduplicate: same URL/fileKey can appear across multiple lessons.
  // Keep the copy with the highest sendScore (or first seen if tied).
  const seen = new Map<string, typeof mapped[number]>()
  for (const item of mapped) {
    const key = item.url ?? item.fileKey ?? item.label
    const existing = seen.get(key)
    if (!existing || (item.sendScore ?? -1) > (existing.sendScore ?? -1)) {
      seen.set(key, item)
    }
  }
  return Array.from(seen.values())
}

// ── Add URL resource with SEND review ────────────────────────────────────────

export async function addUrlResource(
  lessonId: string,
  input: { label: string; type: ResourceType; url: string; description?: string }
): Promise<{ resourceId: string; review: ReviewResult }> {
  const { schoolId, id: userId } = await requireAuth()

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
  input: { label: string; type: ResourceType; fileName: string; description?: string; extractedText?: string; dataUrl?: string }
): Promise<{ resourceId: string; review: ReviewResult }> {
  const { schoolId, id: userId } = await requireAuth()

  const resource = await prisma.resource.create({
    data: {
      schoolId,
      lessonId,
      type:          input.type,
      label:         input.label,
      fileKey:       `upload:${input.fileName}`,
      url:           input.dataUrl ?? null,   // base64 dataUrl stored directly — same pattern as avatars
      extractedText: input.extractedText ?? null,
      createdBy:     userId,
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
  const { schoolId, id: userId } = await requireAuth()

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
  const { schoolId } = await requireAuth()

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
  const { schoolId } = await requireAuth()

  // Delete review first (FK constraint)
  await prisma.resourceReview.deleteMany({ where: { resourceId } })
  await prisma.resourceVersion.deleteMany({ where: { resourceId } })
  await prisma.resource.deleteMany({ where: { id: resourceId, schoolId } })

  revalidatePath('/dashboard')
}

// ── Delete lesson ─────────────────────────────────────────────────────────────

export async function deleteLesson(lessonId: string): Promise<void> {
  const { schoolId } = await requireAuth()

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
  const { schoolId } = await requireAuth()

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
  const { schoolId } = await requireAuth()

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
  hasKPlan:            boolean  // K Plan (Learning Passport) exists for this student
  hasLearningProfile:  boolean
  latestScore:         number | null
  maxScore:            number | null
  supportSnapshot:     string | null
  // Wonde MIS data
  attendancePercentage: number | null
  behaviourPositive:    number | null
  behaviourNegative:    number | null
  hasExclusion:         boolean | null
}

async function fetchClassRosterFromDb(classId: string, schoolId: string): Promise<ClassRosterRow[]> {
  const enrolments = await prisma.enrolment.findMany({
    // schoolId scoped via class; isActive filters out deactivated/deleted students
    where:   { classId, class: { schoolId }, user: { isActive: true } },
    include: {
      user: {
        include: {
          sendStatus: { select: { activeStatus: true, needArea: true } },
          // IndividualLearningPlan.status is a plain String with lowercase values ('active'/'under_review')
          studentIlps: {
            where:  { schoolId, status: { in: ['active', 'under_review'] } },
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
          learningProfile: { select: { id: true } },
          kPlan: { select: { id: true } },
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
      hasKPlan:            e.user.kPlan != null,
      hasLearningProfile:  e.user.learningProfile != null,
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
}

export async function getClassRoster(classId: string): Promise<ClassRosterRow[]> {
  try {
    const { schoolId } = await requireAuth()
    return await unstable_cache(
      () => fetchClassRosterFromDb(classId, schoolId),
      [`roster-${classId}-${schoolId}`],
      { revalidate: 60, tags: [`roster-${classId}`, 'class-rosters'] },
    )()
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
    const { schoolId } = await requireAuth()

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

async function fetchClassInsights(classId: string, schoolId: string): Promise<ClassInsightsData> {
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
}

export async function getClassInsights(classId: string): Promise<ClassInsightsData> {
  try {
    const { schoolId } = await requireAuth()
    return await unstable_cache(
      () => fetchClassInsights(classId, schoolId),
      [`class-insights-${classId}-${schoolId}`],
      { revalidate: 120, tags: [`insights-${classId}`, 'class-rosters'] },
    )()
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
    const { schoolId } = await requireAuth()

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

async function fetchClassTimeSeries(classId: string, schoolId: string): Promise<ClassTimeSeriesData> {
    // 1+2+3 in parallel — steps 2 and 3 only need classId, not cls metadata
    const [cls, classHomework, enrolments] = await Promise.all([
      // 1. Class metadata (needed for year-group benchmark query)
      prisma.schoolClass.findFirst({
        where:  { id: classId, schoolId },
        select: { yearGroup: true, subject: true },
      }),
      // 2. This class's published homework ordered by dueAt
      prisma.homework.findMany({
        where:   { classId, schoolId, status: { not: 'DRAFT' } },
        select: {
          id:           true,
          title:        true,
          dueAt:        true,
          gradingBands: true,
          submissions:  {
            select: {
              studentId:    true,
              finalScore:   true,
              autoScore:    true,
              teacherScore: true,
            },
          },
        },
        orderBy: { dueAt: 'asc' },
      }),
      // 3. Enrolled students
      prisma.enrolment.findMany({
        where:   { classId, class: { schoolId } },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ user: { lastName: 'asc' } }],
      }),
    ])

    if (!cls) return { points: [], studentNames: [] }

    const studentNames = enrolments.map(e => ({
      studentId: e.user.id,
      name:      `${e.user.firstName} ${e.user.lastName}`,
    }))

    // 4. Year group average (needs cls.yearGroup + cls.subject from step 1)
    const yearHomework = await prisma.homework.findMany({
      where: {
        schoolId,
        classId:  { not: classId },
        class:    { yearGroup: cls.yearGroup, subject: cls.subject },
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
}

export async function getClassTimeSeries(classId: string): Promise<ClassTimeSeriesData> {
  try {
    const { schoolId } = await requireAuth()
    return await unstable_cache(
      () => fetchClassTimeSeries(classId, schoolId),
      [`class-timeseries-${classId}-${schoolId}`],
      { revalidate: 120, tags: [`insights-${classId}`, 'class-rosters'] },
    )()
  } catch (err) {
    console.error('[getClassTimeSeries] error:', err)
    return { points: [], studentNames: [] }
  }
}

/** Request in-lesson SEND/cover support — notifies COVER_MANAGER + SENCO. */
export async function requestLessonSupport(
  lessonId: string,
  urgency: 'low' | 'medium' | 'high',
  details: string,
): Promise<void> {
  const user = await requireAuth()
  const allowedRoles = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN']
  if (!allowedRoles.includes(user.role)) return

  const schoolId   = user.schoolId
  const teacherName = `${user.firstName} ${user.lastName}`

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId },
    select: { title: true, scheduledAt: true, class: { select: { name: true } } },
  })

  const className  = lesson?.class?.name ?? 'class'
  const lessonDate = lesson?.scheduledAt
    ? new Date(lesson.scheduledAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : ''
  const urgencyLabel = urgency.charAt(0).toUpperCase() + urgency.slice(1)
  const body = `${teacherName} requests ${urgency}-urgency support during "${lesson?.title ?? 'lesson'}" (${className}${lessonDate ? ` · ${lessonDate}` : ''}).${details ? ` Notes: ${details}` : ''}`

  const recipients = await prisma.user.findMany({
    where: { schoolId, role: { in: ['COVER_MANAGER', 'SENCO'] } },
    select: { id: true },
  })

  if (recipients.length > 0) {
    await prisma.notification.createMany({
      data: recipients.map(r => ({
        userId:    r.id,
        schoolId,
        type:      'LESSON_SUPPORT_REQUESTED',
        title:     `${urgencyLabel}-urgency support needed`,
        body,
        linkHref:  `/dashboard`,
        read:      false,
      })),
      skipDuplicates: true,
    })
  }

  await writeAudit({
    schoolId,
    actorId:    user.id,
    action:     'LESSON_SUPPORT_REQUESTED',
    targetType: 'Lesson',
    targetId:   lessonId,
    metadata:   { urgency, details: details.slice(0, 200) },
  })
}

export async function addRosterNote(studentId: string, content: string): Promise<void> {
  try {
    const { schoolId, id: actorId } = await requireAuth()
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

/** AI suggestion: 1–2 bullet adaptations for a specific student in this lesson. */
export async function suggestStudentLessonAdaptation(
  studentId: string,
  lessonId: string,
): Promise<string[]> {
  const { schoolId } = await requireAuth()

  const [student, lesson, ilpTargets] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, schoolId },
      select: { firstName: true, lastName: true },
    }),
    prisma.lesson.findFirst({
      where: { id: lessonId, schoolId },
      select: { title: true, objectives: true, class: { select: { subject: true, yearGroup: true } } },
    }),
    prisma.individualLearningPlan.findFirst({
      where: { studentId, schoolId, status: 'active' },
      select: {
        areasOfNeed: true,
        targets: {
          where: { status: 'active' },
          take: 3,
          select: { target: true, strategy: true, successMeasure: true },
        },
      },
    }),
  ])

  if (!student || !lesson) return []

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return [
      'Break instructions into 2–3 short steps with a visual checklist.',
      'Provide sentence starters or key vocabulary on a prompt card.',
    ]
  }

  const studentName = `${student.firstName} ${student.lastName}`
  const targetLines = ilpTargets?.targets.map(t => `- ${t.target} (strategy: ${t.strategy})`).join('\n') ?? 'No active ILP targets on file.'
  const needAreas = ilpTargets?.areasOfNeed ?? 'Not specified'
  const subject = lesson.class?.subject ?? 'this subject'
  const yearGroup = lesson.class?.yearGroup ? `Year ${lesson.class.yearGroup}` : ''
  const objectives = lesson.objectives?.length ? lesson.objectives.join('; ') : 'Not specified'

  const prompt = `You are a UK secondary school SENCO advising a class teacher.
Student: ${studentName} (${yearGroup} ${subject})
Lesson title: ${lesson.title ?? 'untitled'}
Learning objectives: ${objectives}
Need areas: ${needAreas}
Active ILP targets:
${targetLines}

Give exactly 2 short, practical, classroom-ready adaptation suggestions for this specific student for this lesson. Each suggestion must be one sentence, actionable, and reference the student's specific ILP needs.
Return JSON only: {"suggestions": ["...", "..."]}`

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as { suggestions?: string[] }
      if (Array.isArray(parsed.suggestions)) return parsed.suggestions.slice(0, 2)
    }
  } catch (err) {
    console.error('[suggestStudentLessonAdaptation]', err)
  }

  return [
    'Break instructions into 2–3 short steps with a visual checklist.',
    'Provide sentence starters or key vocabulary on a prompt card.',
  ]
}

// ── AI Lesson Slide Generation ────────────────────────────────────────────────

import {
  getOakLessonContent,
  findOakDataForTopics,
  extractKlps,
  extractMisconceptions,
  extractKeywords,
  type OakLessonContent,
} from '@/lib/oak-content'

function toOakSubjectSlugLocal(subject: string): string {
  const s = subject.toLowerCase().trim()
  if (s.includes('math')) return 'maths'
  if (s.includes('english lit')) return 'english'
  if (s === 'english') return 'english'
  if (s.includes('science')) return 'science'
  if (s.includes('history')) return 'history'
  if (s.includes('geography')) return 'geography'
  if (s.includes('biology')) return 'biology'
  if (s.includes('chemistry')) return 'chemistry'
  if (s.includes('physics')) return 'physics'
  if (s.includes('french')) return 'french'
  if (s.includes('spanish')) return 'spanish'
  if (s.includes('german')) return 'german'
  if (s.includes('music')) return 'music'
  if (s.includes('art')) return 'art-and-design'
  if (s.includes('computing') || s.includes('computer')) return 'computing'
  if (s.includes('physical') || s === 'pe') return 'physical-education'
  if (s.includes('religious') || s === 'rs' || s === 're') return 'religious-education'
  if (s.includes('drama')) return 'drama'
  return s.replace(/\s+/g, '-')
}

function buildAiSlidesHtml(title: string, yearGroup: number | null, subject: string, slides: Array<{ type: string; title: string; content: string; duration: string }>, vocabulary: string[], learningObjective: string, teacherNotes: string, oakAlignment: string): string {
  const typeColors: Record<string, string> = {
    starter: '#2563eb', context: '#7c3aed', teaching: '#0891b2',
    activity: '#059669', check: '#d97706', plenary: '#dc2626',
  }
  const slidesHtml = slides.map((s, i) => {
    const color = typeColors[s.type] ?? '#374151'
    return `
      <div class="slide" style="border-left:4px solid ${color}">
        <div class="slide-header" style="color:${color}">
          <span class="slide-num">${i + 1}</span>
          <span class="slide-type">${s.type.charAt(0).toUpperCase() + s.type.slice(1)}</span>
          <span class="slide-title">${s.title}</span>
          <span class="slide-dur">${s.duration}</span>
        </div>
        <div class="slide-content">${s.content.replace(/\n/g, '<br>')}</div>
      </div>`
  }).join('')

  const vocabHtml = vocabulary.length > 0
    ? `<div class="section"><h3>Key Vocabulary</h3><ul>${vocabulary.map(v => `<li>${v}</li>`).join('')}</ul></div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #1e293b; font-size: 14px; }
  .ai-banner { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 10px 16px; display: flex; align-items: center; gap: 8px; margin-bottom: 20px; font-size: 12px; color: #92400e; font-weight: 600; }
  .ai-icon { font-size: 16px; }
  .header { background: #1e3a5f; color: white; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; }
  .header h1 { margin: 0 0 4px; font-size: 20px; }
  .header .meta { font-size: 12px; opacity: 0.8; }
  .objective { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
  .objective strong { color: #1d4ed8; }
  .slide { background: white; border-radius: 10px; padding: 16px 20px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .slide-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .slide-num { background: currentColor; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
  .slide-type { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
  .slide-title { font-weight: 600; font-size: 14px; color: #1e293b; flex: 1; }
  .slide-dur { font-size: 11px; color: #94a3b8; background: #f1f5f9; padding: 2px 8px; border-radius: 99px; flex-shrink: 0; }
  .slide-content { font-size: 13px; line-height: 1.6; color: #374151; }
  .section { background: white; border-radius: 10px; padding: 16px 20px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .section h3 { margin: 0 0 10px; font-size: 13px; color: #374151; text-transform: uppercase; letter-spacing: .06em; }
  .section ul { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.7; color: #374151; }
  .teacher-notes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 18px; font-size: 12px; color: #78350f; }
  .teacher-notes strong { color: #92400e; }
  .oak-align { font-size: 11px; color: #6b7280; background: #f3f4f6; border-radius: 6px; padding: 8px 12px; margin-top: 14px; }
  @media print { body { background: white; padding: 0; } .ai-banner { display: none; } }
</style>
</head>
<body>
<div class="ai-banner">
  <span class="ai-icon">✨</span>
  AI GENERATED — Review and adapt before use. Content is based on Oak National Academy curriculum frameworks and best practice.
</div>
<div class="header">
  <h1>${title}</h1>
  <div class="meta">${subject}${yearGroup ? ` · Year ${yearGroup}` : ''}</div>
</div>
${learningObjective ? `<div class="objective"><strong>Learning Objective:</strong> ${learningObjective}</div>` : ''}
${slidesHtml}
${vocabHtml}
${teacherNotes ? `<div class="section"><div class="teacher-notes"><strong>Teacher Notes:</strong> ${teacherNotes.replace(/\n/g, '<br>')}</div></div>` : ''}
${oakAlignment ? `<div class="oak-align">🍃 Oak alignment: ${oakAlignment}</div>` : ''}
</body>
</html>`
}

export async function generateAiLessonSlides(lessonId: string): Promise<{ resourceId: string }> {
  const { schoolId, id: userId } = await requireAuth([
    'TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'SENCO',
  ])

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId },
    include: {
      class: { select: { subject: true, yearGroup: true } },
      resources: { where: { oakContentId: { not: null } }, select: { oakContentId: true } },
    },
  })
  if (!lesson) throw new Error('Lesson not found')

  // Gather Oak data from linked resources
  const oakData: OakLessonContent[] = []
  for (const r of lesson.resources) {
    if (r.oakContentId) {
      const d = await getOakLessonContent(r.oakContentId!)
      if (d) oakData.push(d)
    }
  }

  // Fallback: find by topic keywords when no linked Oak resources
  if (oakData.length === 0 && lesson.class?.subject) {
    const subjectSlug = toOakSubjectSlugLocal(lesson.class.subject)
    const keywords = lesson.title
      .replace(/[—\-–:]/g, ' ')
      .split(' ')
      .map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 3 && !['with','from','that','this','their','have','been'].includes(w))
      .slice(0, 4)
    if (keywords.length > 0 && subjectSlug) {
      const found = await findOakDataForTopics(keywords, subjectSlug)
      oakData.push(...found.slice(0, 3))
    }
  }

  const klps          = extractKlps(oakData).slice(0, 8)
  const misconceptions = extractMisconceptions(oakData).slice(0, 4)
  const vocab         = extractKeywords(oakData).slice(0, 10)
  const yearGroup     = lesson.class?.yearGroup ?? null
  const subject       = lesson.class?.subject ?? 'Subject'

  const systemPrompt = `You are an expert UK secondary school curriculum designer. Generate a complete, detailed lesson plan in JSON.
Use accurate subject knowledge appropriate for Year ${yearGroup ?? 'secondary'} ${subject} students.
Follow EEF evidence on explicit instruction: clear learning objectives, worked examples, guided practice, independent practice, retrieval.
Produce content that is educationally rigorous, engaging, and differentiated.`

  const userPrompt = `Lesson title: "${lesson.title}"
Subject: ${subject}  Year: ${yearGroup ?? 'secondary'}

${klps.length > 0 ? `Oak curriculum key learning points:\n${klps.map((k, i) => `${i + 1}. ${k}`).join('\n')}\n` : ''}
${misconceptions.length > 0 ? `Common misconceptions to address:\n${misconceptions.join('\n')}\n` : ''}
${vocab.length > 0 ? `Curriculum vocabulary: ${vocab.join(', ')}\n` : ''}

Generate a complete lesson plan JSON with exactly this structure:
{
  "learningObjective": "Students will be able to...",
  "slides": [
    { "type": "starter", "title": "Hook / Retrieval Practice", "content": "...", "duration": "5 min" },
    { "type": "context", "title": "Background / Prior Knowledge", "content": "...", "duration": "8 min" },
    { "type": "teaching", "title": "Direct Teaching / Worked Example", "content": "...", "duration": "15 min" },
    { "type": "activity", "title": "Guided / Independent Practice", "content": "...", "duration": "15 min" },
    { "type": "check", "title": "Retrieval Check / Exit Ticket", "content": "...", "duration": "7 min" }
  ],
  "vocabulary": ["term: definition", "term: definition"],
  "teacherNotes": "Differentiation tips, common errors to watch for, extension ideas",
  "oakAlignment": "Brief note on how this links to Oak National Academy curriculum frameworks"
}

Make content highly specific to "${lesson.title}" — not generic. Each slide content should be 3-6 sentences with specific examples, quotes (if literature), methods (if maths/science), or tasks.
Return ONLY valid JSON, no markdown fences.`

  const client = new Anthropic()
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
  let slideData: { slides: Array<{ type: string; title: string; content: string; duration: string }>; vocabulary: string[]; learningObjective: string; teacherNotes: string; oakAlignment: string }

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    slideData = JSON.parse(cleaned)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI returned unparseable content')
    slideData = JSON.parse(match[0])
  }

  const html    = buildAiSlidesHtml(lesson.title, yearGroup, subject, slideData.slides ?? [], slideData.vocabulary ?? [], slideData.learningObjective ?? '', slideData.teacherNotes ?? '', slideData.oakAlignment ?? '')
  const dataUrl = `data:text/html;base64,${Buffer.from(html).toString('base64')}`

  const resource = await prisma.resource.create({
    data: {
      schoolId,
      lessonId,
      type:         ResourceType.SLIDES,
      label:        `${lesson.title} — AI Lesson Plan`,
      url:          dataUrl,
      isAiGenerated: true,
      createdBy:    userId,
    },
  })

  await writeAudit({ schoolId, actorId: userId, action: 'RESOURCE_UPLOADED', targetType: 'Resource', targetId: resource.id, metadata: { aiGenerated: true, lessonTitle: lesson.title } })
  revalidatePath('/dashboard')

  return { resourceId: resource.id }
}

// ─── Supported non-slides AI resource types ───────────────────────────────────

export type AiResourceType = 'WORKSHEET' | 'HANDOUT' | 'TEACHER_NOTES' | 'QUIZ' | 'EXIT_TICKET'

const AI_RESOURCE_TYPE_META: Record<AiResourceType, { label: string; prismType: ResourceType; prompt: string }> = {
  WORKSHEET: {
    label: 'Worksheet',
    prismType: ResourceType.WORKSHEET,
    prompt: 'Create a classroom worksheet with clear instructions, scaffolded tasks (starter → main → extension), and a mark scheme.',
  },
  HANDOUT: {
    label: 'Pupil Handout',
    prismType: ResourceType.WORKSHEET,
    prompt: 'Create a pupil handout summarising the key content, including annotated diagrams or structured notes, and 2–3 consolidation questions at the end. Suitable for sticking into an exercise book.',
  },
  TEACHER_NOTES: {
    label: 'Teacher Notes',
    prismType: ResourceType.PLAN,
    prompt: 'Create detailed teacher notes covering: learning objectives, subject-knowledge background, common misconceptions to watch for, suggested discussion questions, differentiation strategies (stretch + support), and links to relevant exam skills. Be thorough and practical.',
  },
  QUIZ: {
    label: 'Quiz',
    prismType: ResourceType.WORKSHEET,
    prompt: 'Create a 10-question quiz with a mix of multiple choice and short answer questions. Include an answer key at the end.',
  },
  EXIT_TICKET: {
    label: 'Exit Ticket',
    prismType: ResourceType.WORKSHEET,
    prompt: 'Create a 5-question exit ticket for the end of the lesson. Include 3 recall questions, 1 application question, and 1 "muddiest point" self-assessment prompt. Provide an answer key.',
  },
}

/** Converts markdown-style AI text to simple styled HTML for inline display. */
function buildAiResourceHtml(title: string, yearGroup: number | null, subject: string, resourceType: string, content: string): string {
  // Basic markdown → HTML: bold, headings, bullet lists
  const body = content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #1e293b; font-size: 14px; line-height: 1.65; }
  .ai-banner { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 10px 16px; display: flex; align-items: center; gap: 8px; margin-bottom: 20px; font-size: 12px; color: #92400e; font-weight: 600; }
  .header { background: #1e3a5f; color: white; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; }
  .header h1 { margin: 0 0 4px; font-size: 18px; }
  .header .meta { font-size: 12px; opacity: 0.8; }
  .content { background: white; border-radius: 10px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  h1,h2,h3 { color: #1e3a5f; margin: 16px 0 8px; }
  h1 { font-size: 18px; } h2 { font-size: 15px; } h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin-bottom: 4px; }
  strong { color: #1e293b; }
  @media print { body { background: white; padding: 0; } .ai-banner { display: none; } }
</style>
</head>
<body>
<div class="ai-banner">✨ AI GENERATED — Review and adapt before use. Based on UK curriculum knowledge.</div>
<div class="header">
  <h1>${title} — ${resourceType}</h1>
  <div class="meta">${subject}${yearGroup ? ` · Year ${yearGroup}` : ''}</div>
</div>
<div class="content"><p>${body}</p></div>
</body>
</html>`
}

/**
 * Generate a non-slides AI resource (worksheet, handout, teacher notes, quiz, exit ticket)
 * and attach it directly to the lesson as a Resource record.
 */
export async function generateAiLessonResource(
  lessonId: string,
  resourceType: AiResourceType,
): Promise<{ resourceId: string; label: string }> {
  const { schoolId, id: userId } = await requireAuth([
    'TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'SENCO',
  ])

  const meta = AI_RESOURCE_TYPE_META[resourceType]
  if (!meta) throw new Error('Invalid resource type')

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId },
    include: {
      class: { select: { subject: true, yearGroup: true } },
      resources: { where: { oakContentId: { not: null } }, select: { oakContentId: true } },
    },
  })
  if (!lesson) throw new Error('Lesson not found')

  // Gather Oak data — linked resources first, then keyword fallback
  const oakData: OakLessonContent[] = []
  for (const r of lesson.resources) {
    if (r.oakContentId) {
      const d = await getOakLessonContent(r.oakContentId!)
      if (d) oakData.push(d)
    }
  }
  if (oakData.length === 0 && lesson.class?.subject) {
    const subjectSlug = toOakSubjectSlugLocal(lesson.class.subject)
    const keywords = lesson.title
      .replace(/[—\-–:]/g, ' ')
      .split(' ')
      .map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 3 && !['with','from','that','this','their','have','been'].includes(w))
      .slice(0, 4)
    if (keywords.length > 0 && subjectSlug) {
      const found = await findOakDataForTopics(keywords, subjectSlug)
      oakData.push(...found.slice(0, 3))
    }
  }

  const klps   = extractKlps(oakData).slice(0, 6)
  const vocab  = extractKeywords(oakData).slice(0, 8)
  const yearGroup = lesson.class?.yearGroup ?? null
  const subject   = lesson.class?.subject ?? 'Subject'

  const oakSection = [
    klps.length  > 0 ? `Oak curriculum key learning points:\n${klps.map((k, i) => `${i + 1}. ${k}`).join('\n')}` : '',
    vocab.length > 0 ? `Curriculum vocabulary: ${vocab.join(', ')}` : '',
  ].filter(Boolean).join('\n\n')

  const userPrompt = [
    `Subject: ${subject}`,
    `Year Group: ${yearGroup ? `Year ${yearGroup}` : 'Secondary'}`,
    `Topic / Lesson title: "${lesson.title}"`,
    oakSection,
    oakSection ? '' : 'No Oak National Academy content is available for this specific topic — use your expert knowledge of the UK secondary curriculum, relevant exam specifications (AQA/Edexcel/OCR), and best practice pedagogy.',
    '',
    meta.prompt,
    '',
    'Respond in clean markdown. Start immediately with a # heading — no preamble.',
  ].filter(s => s !== undefined).join('\n')

  const systemPrompt = `You are an expert UK secondary school teacher and curriculum designer.
You create high-quality, classroom-ready resources aligned to the UK National Curriculum and common UK exam specifications (AQA, Edexcel, OCR).
Your resources are accurate, well-structured, and immediately usable.
Respond in clean markdown — no preamble, no explanation, just the resource itself starting with a # Title.`

  const client = new Anthropic()
  const msg = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 2000,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userPrompt }],
  })

  const content = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
  if (!content) throw new Error('AI returned empty content — please try again')

  const label = `${lesson.title} — ${meta.label}`
  const html  = buildAiResourceHtml(lesson.title, yearGroup, subject, meta.label, content)
  const dataUrl = `data:text/html;base64,${Buffer.from(html).toString('base64')}`

  const resource = await prisma.resource.create({
    data: {
      schoolId,
      lessonId,
      type:          meta.prismType,
      label,
      url:           dataUrl,
      isAiGenerated: true,
      createdBy:     userId,
    },
  })

  await writeAudit({ schoolId, actorId: userId, action: 'RESOURCE_UPLOADED', targetType: 'Resource', targetId: resource.id, metadata: { aiGenerated: true, lessonTitle: lesson.title, resourceType } })
  revalidatePath('/dashboard')

  return { resourceId: resource.id, label }
}
