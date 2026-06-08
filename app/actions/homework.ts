'use server'
import { auth }            from '@/lib/auth'
import { requireAuth } from '@/lib/session'
import { prisma, writeAudit, writeILPAudit } from '@/lib/prisma'
import { revalidatePath, unstable_cache }  from 'next/cache'
import { HomeworkType, HomeworkStatus } from '@prisma/client'
import Anthropic           from '@anthropic-ai/sdk'
import { updateLearningProfile } from '@/app/actions/adaptive-learning'
import { checkILPEvidenceMatch, checkEhcpEvidenceMatch } from '@/app/actions/ilp-evidence'
import { percentToGcseGrade }   from '@/lib/grading'
import { sendHomeworkReminderEmail } from '@/lib/email'
import { markDirty }            from '@/lib/agents/snapshot'
import { AgentType }            from '@prisma/client'

// ── List / fetch helpers ──────────────────────────────────────────────────────

const fetchHomeworkList = unstable_cache(
  async (schoolId: string, userId: string) =>
    prisma.homework.findMany({
      where: { schoolId, class: { teachers: { some: { userId } } } },
      include: {
        class:       { select: { name: true, subject: true, yearGroup: true } },
        lesson:      { select: { id: true, title: true } },
        submissions: { select: { id: true, status: true, finalScore: true } },
      },
      orderBy: { dueAt: 'asc' },
    }),
  ['homework-list'],
  { revalidate: 60 },
)

export async function getHomeworkList() {
  const { schoolId, id: userId } = await requireAuth()
  return fetchHomeworkList(schoolId, userId)
}

export async function getHomeworkForMarking(homeworkId: string) {
  const { schoolId } = await requireAuth()

  const hw = await prisma.homework.findFirst({
    where: { id: homeworkId, schoolId },
    include: {
      class: {
        include: {
          enrolments: {
            include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, settings: { select: { profilePictureUrl: true } } } } },
            orderBy:  [{ user: { lastName: 'asc' } }],
          },
        },
      },
      questions:   { orderBy: { orderIndex: 'asc' as const } },
      lesson:      { select: { id: true, title: true } },
      submissions: {
        where:   { schoolId },
        include: { student: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, settings: { select: { profilePictureUrl: true } } } } },
        orderBy: { submittedAt: 'asc' },
      },
    },
  })
  if (!hw) return null

  const enrolledIds = hw.class?.enrolments.map(e => e.user.id) ?? []
  const subIds      = hw.submissions.map(s => s.id)

  // Run independent lookups in parallel
  const [sendStatuses, kPlans, rawNotes] = await Promise.all([
    enrolledIds.length
      ? prisma.sendStatus.findMany({
          where:  { studentId: { in: enrolledIds }, NOT: { activeStatus: 'NONE' } },
          select: { studentId: true, activeStatus: true, needArea: true },
        })
      : Promise.resolve([] as { studentId: string; activeStatus: string; needArea: string | null }[]),
    enrolledIds.length
      ? prisma.learnerPassport.findMany({
          where:  { studentId: { in: enrolledIds }, schoolId, status: 'APPROVED' },
          select: { studentId: true, teacherActions: true },
        })
      : Promise.resolve([] as { studentId: string; teacherActions: any }[]),
    subIds.length
      ? prisma.teacherPlanNote.findMany({
          where: { planType: 'homework_submission', planId: { in: subIds }, schoolId },
          select: { id: true, planId: true, note: true, createdAt: true, teacher: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' as const },
        })
      : Promise.resolve([] as Array<{ id: string; planId: string; note: string; createdAt: Date; teacher: { firstName: string; lastName: string } }>),
  ])

  const sendByStudent  = Object.fromEntries(sendStatuses.map(s => [s.studentId, s]))
  const kPlanByStudent = Object.fromEntries(kPlans.map(p => [p.studentId, { teacherActions: p.teacherActions }]))

  // ILP goals require SEND student IDs — sequential dependency on sendStatuses
  const sendStudentIds = sendStatuses.map(s => s.studentId)
  const ilpRaw: any[] = sendStudentIds.length
    ? await prisma.individualLearningPlan.findMany({
        where: { studentId: { in: sendStudentIds }, schoolId, status: 'active', approvedBySenco: true },
        select: {
          id: true, studentId: true, areasOfNeed: true,
          targets: {
            where: { status: 'active' },
            select: { id: true, target: true, strategy: true, successMeasure: true },
          },
        },
      })
    : []
  // Normalise to the shape the marking view expects
  const ilpByStudent: Record<string, { id: string; needsSummary: string; targets: Array<{ id: string; description: string; successCriteria: string; subject: string | null }> }> =
    Object.fromEntries(ilpRaw.map((r: any) => [
      r.studentId,
      {
        id:           r.id,
        needsSummary: r.areasOfNeed ?? '',
        targets: (r.targets as any[]).map((t: any) => ({
          id:              t.id,
          description:     t.target,
          successCriteria: t.strategy,
          subject:         null as string | null,
        })),
      },
    ]))

  const notesBySubmission: Record<string, Array<{ id: string; note: string; createdAt: Date; teacherName: string }>> = {}
  for (const n of rawNotes) {
    if (!notesBySubmission[n.planId]) notesBySubmission[n.planId] = []
    notesBySubmission[n.planId].push({ id: n.id, note: n.note, createdAt: n.createdAt, teacherName: `${n.teacher.firstName} ${n.teacher.lastName}` })
  }

  // Merge UserSettings.profilePictureUrl → avatarUrl so StudentAvatar shows Wonde photos
  const hwMerged = {
    ...hw,
    class: hw.class ? {
      ...hw.class,
      enrolments: hw.class.enrolments.map(e => ({
        ...e,
        user: {
          ...e.user,
          avatarUrl: (e.user as any).settings?.profilePictureUrl ?? e.user.avatarUrl ?? null,
        },
      })),
    } : null,
    submissions: hw.submissions.map(s => ({
      ...s,
      student: {
        ...s.student,
        avatarUrl: (s.student as any).settings?.profilePictureUrl ?? s.student.avatarUrl ?? null,
      },
    })),
  }

  return { ...hwMerged, sendByStudent, kPlanByStudent, ilpByStudent, notesBySubmission }
}

export async function getSubmissionForMarking(submissionId: string) {
  const { schoolId } = await requireAuth()

  const sub = await prisma.submission.findFirst({
    where: { id: submissionId, schoolId },
    include: {
      student:  { select: { id: true, firstName: true, lastName: true, avatarUrl: true, settings: { select: { profilePictureUrl: true } } } },
      homework: {
        include: {
          class: {
            include: {
              enrolments: {
                include: { user: { select: { id: true, firstName: true, lastName: true } } },
                orderBy:  [{ user: { lastName: 'asc' } }],
              },
              teachers: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
          },
          lesson:      { select: { id: true, title: true } },
          submissions: {
            select:  { id: true, studentId: true, status: true, finalScore: true },
            orderBy: { submittedAt: 'asc' },
          },
        },
      },
    },
  })
  if (!sub) return null

  const [sendStatus, plan, ilpTargetsDue, ehcpOutcomesDue] = await Promise.all([
    prisma.sendStatus.findUnique({ where: { studentId: sub.studentId } }),
    prisma.plan.findFirst({
      where:   { studentId: sub.studentId, schoolId, status: { in: ['ACTIVE_INTERNAL', 'ACTIVE_PARENT_SHARED'] } },
      include: { strategies: true },
    }),
    prisma.ilpTarget.findMany({
      where: {
        ilp: { schoolId, studentId: sub.studentId, status: 'active' },
        status: 'active',
        targetDate: { lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, target: true, targetDate: true, strategy: true },
      orderBy: { targetDate: 'asc' },
      take: 10,
    }),
    prisma.ehcpOutcome.findMany({
      where: {
        ehcp: { schoolId, studentId: sub.studentId, status: { in: ['active', 'under_review'] } },
        status: 'active',
      },
      select: { id: true, section: true, outcomeText: true, targetDate: true },
      orderBy: [{ section: 'asc' }, { targetDate: 'asc' }],
      take: 20,
    }),
  ])

  const enrolled     = sub.homework.class?.enrolments ?? []
  const submittedSet = new Set(sub.homework.submissions.map(s => s.studentId))
  const ordered      = enrolled
    .filter(e => submittedSet.has(e.user.id))
    .sort((a, b) => a.user.lastName.localeCompare(b.user.lastName))

  const subIdByStudent = Object.fromEntries(sub.homework.submissions.map(s => [s.studentId, s.id]))
  const idx  = ordered.findIndex(e => e.user.id === sub.studentId)
  const prev = idx > 0                  ? subIdByStudent[ordered[idx - 1].user.id] : null
  const next = idx < ordered.length - 1 ? subIdByStudent[ordered[idx + 1].user.id] : null

  return {
    ...sub,
    student: {
      ...sub.student,
      avatarUrl: (sub.student as any).settings?.profilePictureUrl ?? sub.student.avatarUrl ?? null,
    },
    sendStatus: sendStatus?.activeStatus !== 'NONE' ? sendStatus : null,
    plan,
    nav: { current: idx + 1, total: ordered.length, prev, next },
    ilpTargetsDue,
    ehcpOutcomesDue,
  }
}

// ── Lesson + class helpers for homework creation ─────────────────────────────

export type LessonForHomework = {
  id:          string
  title:       string
  topic:       string | null
  scheduledAt: string
  class:       { id: string; name: string; subject: string; yearGroup: number } | null
  objectives:  string[]
  resources:   { type: string; label: string }[]
}

export type ClassForHomework = {
  id:        string
  name:      string
  subject:   string
  yearGroup: number
}

// ── Teacher homework detail (questions + mark scheme) ────────────────────────

export async function getHomeworkDetail(homeworkId: string) {
  const { schoolId, role } = await requireAuth()

  const teacherRoles = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN']
  if (!teacherRoles.includes(role)) return null

  return prisma.homework.findFirst({
    where: { id: homeworkId, schoolId },
    include: {
      questions: { orderBy: { orderIndex: 'asc' } },
      class:     { select: { name: true, subject: true, yearGroup: true } },
      lesson:    { select: { id: true, title: true } },
    },
  })
}

export type HomeworkDetail = Awaited<ReturnType<typeof getHomeworkDetail>>

export async function getTeacherLessons(): Promise<LessonForHomework[]> {
  const { schoolId, id: userId } = await requireAuth()

  const lessons = await prisma.lesson.findMany({
    where:   { schoolId, createdBy: userId },
    include: {
      class:     { select: { id: true, name: true, subject: true, yearGroup: true } },
      resources: { select: { type: true, label: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { scheduledAt: 'desc' },
    take: 60,
  })

  return lessons.map(l => ({
    id:          l.id,
    title:       l.title,
    topic:       l.topic,
    scheduledAt: l.scheduledAt.toISOString(),
    class:       l.class,
    objectives:  l.objectives,
    resources:   l.resources.map(r => ({ type: r.type, label: r.label })),
  }))
}

export async function getTeacherClasses(): Promise<ClassForHomework[]> {
  const { schoolId, id: userId } = await requireAuth()

  return prisma.schoolClass.findMany({
    where:   { schoolId, teachers: { some: { userId } } },
    select:  { id: true, name: true, subject: true, yearGroup: true },
    orderBy: [{ yearGroup: 'asc' }, { name: 'asc' }],
  })
}

// ── Create homework ───────────────────────────────────────────────────────────

export async function createHomework(input: {
  lessonId:        string
  classId:         string
  title:           string
  instructions:    string
  type:            HomeworkType
  modelAnswer?:    string
  gradingBands?:   object
  targetWordCount?: number
  questionsJson?:  object
  aiDecision?:     string
  setAt:           string
  dueAt:           string
  // Phase 6 adaptive fields
  homeworkVariantType?:  string
  structuredContent?:    object
  learningObjectives?:   string[]
  bloomsLevel?:          string
  ilpTargetIds?:         string[]
  ehcpOutcomeIds?:       string[]
  differentiationNotes?: string
  estimatedMins?:        number
}): Promise<{ id: string }> {
  const { schoolId, id: userId } = await requireAuth()

  const hw = await prisma.homework.create({
    data: {
      schoolId,
      classId:         input.classId,
      lessonId:        input.lessonId,
      title:           input.title,
      instructions:    input.instructions,
      type:            input.type,
      modelAnswer:     input.modelAnswer      ?? undefined,
      gradingBands:    input.gradingBands as any ?? undefined,
      targetWordCount: input.targetWordCount  ?? undefined,
      questionsJson:   input.questionsJson as any ?? undefined,
      aiDecision:      input.aiDecision       ?? undefined,
      dueAt:           new Date(input.dueAt),
      status:          HomeworkStatus.PUBLISHED,
      releasePolicy:   'TEACHER_EXTENDED',
      createdBy:       userId,
      // Phase 6
      homeworkVariantType:  input.homeworkVariantType ?? 'free_text',
      structuredContent:    input.structuredContent as any ?? undefined,
      learningObjectives:   input.learningObjectives ?? [],
      bloomsLevel:          input.bloomsLevel ?? undefined,
      ilpTargetIds:         input.ilpTargetIds ?? [],
      ehcpOutcomeIds:       input.ehcpOutcomeIds ?? [],
      differentiationNotes: input.differentiationNotes ?? undefined,
      estimatedMins:        input.estimatedMins ?? undefined,
    },
  })

  // Auto-link homework to ILP targets that were included in the AI generation prompt
  if (input.ilpTargetIds && input.ilpTargetIds.length > 0) {
    await prisma.ilpHomeworkLink.createMany({
      data: input.ilpTargetIds.map(ilpTargetId => ({
        ilpTargetId,
        homeworkId: hw.id,
        linkedBy:   userId,
        evidenceNote: 'Auto-linked during AI homework generation',
      })),
      skipDuplicates: true,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath('/homework')
  return { id: hw.id }
}

// ── AI helpers (types + prompt builders live in lib/homework-helpers.ts) ──────

export type { MCQQuestion, ProposalResult } from '@/lib/homework-helpers'
import { buildTypePrompt, noApiKeyFallback, defaultBands, type ProposalResult } from '@/lib/homework-helpers'

// ── Generate from lesson content (objectives + resources) ─────────────────────

export async function generateHomeworkFromResources(
  lessonId:  string,
  forceType?: HomeworkType,
  preferredResourceId?: string,
): Promise<ProposalResult> {
  const { schoolId, id: userId } = await requireAuth()

  const lesson = await prisma.lesson.findFirst({
    where:   { id: lessonId, schoolId },
    include: {
      resources: { orderBy: { createdAt: 'asc' } },
      class: { select: { subject: true, yearGroup: true, examBoard: true, examModules: true } },
    },
  })
  if (!lesson) throw new Error('Lesson not found')

  const subject       = lesson.class?.subject   ?? 'the subject'
  const yearGroup     = lesson.class?.yearGroup ?? 10
  const qualification = yearGroup <= 9 ? 'KS3' : yearGroup <= 11 ? 'GCSE' : 'A-Level'
  // Prefer lesson-level exam board, fall back to class-level
  const examBoard     = lesson.examBoard ?? lesson.class?.examBoard ?? ''
  const topic         = (lesson as any).topic ?? ''
  const type          = forceType ?? 'SHORT_ANSWER'

  // Learning objectives are the primary curriculum context
  const objectivesContext = lesson.objectives.length > 0
    ? lesson.objectives.map((o, i) => `  ${i + 1}. ${o}`).join('\n')
    : '  (No learning objectives specified — generate questions appropriate for the lesson title and topic)'

  // Enrich Oak resources (type=LINK with oakContentId) with lesson outcome text
  const oakSlugs = lesson.resources
    .filter(r => r.oakContentId)
    .map(r => r.oakContentId as string)
  const oakDetails = oakSlugs.length
    ? await prisma.oakLesson.findMany({
        where:  { slug: { in: oakSlugs } },
        select: {
          slug: true, title: true, pupilLessonOutcome: true,
          keyLearningPoints: true, lessonKeywords: true, lessonOutline: true,
          starterQuiz: true, exitQuiz: true,
          misconceptionsAndCommonMistakes: true, teacherTips: true,
          transcriptSentences: true,
        },
      })
    : []
  const oakBySlug = Object.fromEntries(oakDetails.map(o => [o.slug, o]))

  // Reorder resources: put teacher's preferred resource first if specified
  const orderedResources = preferredResourceId
    ? [
        ...lesson.resources.filter(r => r.id === preferredResourceId),
        ...lesson.resources.filter(r => r.id !== preferredResourceId),
      ]
    : lesson.resources
  const primaryResource = orderedResources[0]
  const hasPrimaryNonOak = !!(primaryResource && !primaryResource.oakContentId && preferredResourceId)

  // Build rich Oak content block from all available curriculum data
  function buildOakContentBlock(oak: (typeof oakDetails)[number]): string {
    const lines: string[] = []

    if (oak.pupilLessonOutcome) {
      lines.push(`  Learning outcome: ${oak.pupilLessonOutcome}`)
    }

    const klp = Array.isArray(oak.keyLearningPoints) ? oak.keyLearningPoints as any[] : []
    if (klp.length > 0) {
      lines.push(`  Key learning points:`)
      klp.slice(0, 6).forEach((p: any, i: number) => {
        const text = typeof p === 'string' ? p : p?.keyLearningPoint ?? ''
        if (text) lines.push(`    ${i + 1}. ${text}`)
      })
    }

    const kw = Array.isArray(oak.lessonKeywords) ? oak.lessonKeywords as any[] : []
    if (kw.length > 0) {
      const vocabList = kw.slice(0, 8)
        .map((k: any) => {
          const word = typeof k === 'string' ? k : k?.keyword ?? ''
          const desc = typeof k === 'object' ? k?.description ?? '' : ''
          return desc ? `${word}: ${desc}` : word
        })
        .filter(Boolean)
      if (vocabList.length > 0) {
        lines.push(`  Key vocabulary: ${vocabList.join('; ')}`)
      }
    }

    const sq = Array.isArray(oak.starterQuiz) ? oak.starterQuiz as any[] : []
    const eq = Array.isArray(oak.exitQuiz) ? oak.exitQuiz as any[] : []
    const quizItems = [...sq, ...eq].slice(0, 4)
    if (quizItems.length > 0) {
      lines.push(`  Curriculum quiz questions (use these as models for depth and style):`)
      quizItems.forEach((q: any, i: number) => {
        const stem = q?.questionStem ?? q?.question ?? ''
        if (!stem) return
        lines.push(`    Q${i + 1}: ${stem}`)
        const answers = Array.isArray(q?.answers) ? q.answers as any[] : []
        const correct = answers.find((a: any) => a?.answerIsCorrect)
        if (correct) {
          const ans = correct?.answer ?? ''
          if (ans) lines.push(`         → ${ans}`)
        }
      })
    }

    const misc = Array.isArray(oak.misconceptionsAndCommonMistakes) ? oak.misconceptionsAndCommonMistakes as any[] : []
    if (misc.length > 0) {
      lines.push(`  Common misconceptions to probe with questions:`)
      misc.slice(0, 3).forEach((m: any) => {
        const mc = typeof m === 'string' ? m : m?.misconception ?? ''
        if (mc) lines.push(`    - ${mc}`)
      })
    }

    const trans = Array.isArray(oak.transcriptSentences) ? oak.transcriptSentences as any[] : []
    if (trans.length > 0 && klp.length === 0) {
      // Only include transcript excerpt when no structured content available
      const excerpt = trans.slice(0, 8)
        .map((t: any) => typeof t === 'string' ? t : t?.transcriptSentence ?? '')
        .filter(Boolean)
        .join(' ')
        .slice(0, 600)
      if (excerpt) lines.push(`  Lesson transcript excerpt: ${excerpt}`)
    }

    return lines.join('\n')
  }

  // Build resource context — primary resource is clearly marked for the AI
  const resourceContext = orderedResources.length > 0
    ? orderedResources.map((r, idx) => {
        const isPrimary = idx === 0 && !!preferredResourceId
        if (r.oakContentId && oakBySlug[r.oakContentId]) {
          const oak = oakBySlug[r.oakContentId]
          const contentBlock = buildOakContentBlock(oak)
          const header = isPrimary
            ? `  - [PRIMARY RESOURCE — BASE ALL QUESTIONS ON THIS] [Oak Lesson] "${oak.title}"`
            : `  - [Oak Lesson] "${oak.title}"`
          return contentBlock ? `${header}\n${contentBlock}` : header
        }
        const urlPart = r.url ? ` (${r.url})` : ''
        const extractedText = (r as any).extractedText as string | null | undefined
        if (r.fileKey && !r.url && extractedText) {
          // Uploaded file with extracted text — give the AI the actual content
          const header = isPrimary
            ? `  - [PRIMARY RESOURCE — BASE ALL QUESTIONS ON THIS] [${r.type}] "${r.label}" (uploaded file)`
            : `  - [${r.type}] "${r.label}" (uploaded file)`
          const excerpt = extractedText.slice(0, 3000)
          return `${header}\n  Slide/page content:\n${excerpt.split('\n').map(l => `    ${l}`).join('\n')}`
        }
        return isPrimary
          ? `  - [PRIMARY RESOURCE — BASE ALL QUESTIONS ON THIS] [${r.type}] "${r.label}"${urlPart}`
          : `  - [${r.type}] "${r.label}"${urlPart}`
      }).join('\n')
    : '  - No lesson resources attached'

  // Fetch SEND context for the lesson's class (best-effort — don't fail generation if this errors)
  let sendContextBlock = ''
  let promptIlpTargetIds: string[] = []
  try {
    if (lesson.classId) {
      const ehcpStudentIdsForOutcomes: string[] = []
      const [classSize, sendStatuses, ilpData] = await Promise.all([
        prisma.enrolment.count({ where: { classId: lesson.classId } }),
        prisma.sendStatus.findMany({
          where: {
            student: { enrolments: { some: { classId: lesson.classId } } },
            NOT: { activeStatus: 'NONE' },
          },
          select: { studentId: true, activeStatus: true, needArea: true },
        }),
        prisma.individualLearningPlan.findMany({
          where: {
            approvedBySenco: true,
            status: 'active',
            student: { enrolments: { some: { classId: lesson.classId } } },
          },
          select: {
            studentId:    true,
            sendCategory: true,
            areasOfNeed:  true,
            strategies:   true,
            targets: {
              where: { status: 'active' },
              select: { id: true, target: true, strategy: true, successMeasure: true },
              take: 3,
            },
          },
        }),
      ])
      if (sendStatuses.length > 0) {
        const ilpByStudent: Record<string, {
          sendCategory: string; areasOfNeed: string; strategies: string[];
          targets: { id: string; target: string; strategy: string; successMeasure: string }[]
        }> = Object.fromEntries(ilpData.map((i: any) => [i.studentId, i]))

        const ehcpStudents = sendStatuses.filter(s => s.activeStatus === 'EHCP')
        const senStudents  = sendStatuses.filter(s => s.activeStatus === 'SEN_SUPPORT')
        const noneCount    = Math.max(0, classSize - sendStatuses.length)

        // Fetch active EHCP outcomes for EHCP students in this class
        ehcpStudentIdsForOutcomes.push(...ehcpStudents.map(s => s.studentId))
        const ehcpOutcomes = ehcpStudentIdsForOutcomes.length > 0
          ? await prisma.ehcpOutcome.findMany({
              where: {
                ehcp: { studentId: { in: ehcpStudentIdsForOutcomes }, schoolId, status: 'active' },
                status: 'active',
              },
              select: { outcomeText: true, provisionRequired: true, section: true },
              take: 4,
              orderBy: { section: 'asc' },
            })
          : []

        // SEN Support: collect unique needs + per-student ILP targets with strategies
        const senNeeds = [...new Set(
          senStudents.map(s => ilpByStudent[s.studentId]?.sendCategory || s.needArea || 'SEN Support').filter(Boolean)
        )].slice(0, 4)

        // Collect ILP targets WITH strategies for the prompt (deduplicated, max 4)
        const senIlpTargets = senStudents
          .flatMap(s => (ilpByStudent[s.studentId]?.targets ?? []).map(t => ({
            id:       t.id,
            target:   t.target,
            strategy: t.strategy,
          })))
          .slice(0, 4)
        // Track target IDs used in the prompt for auto-linking after homework creation
        promptIlpTargetIds = senIlpTargets.map(t => t.id)
        const senIlpLines = senIlpTargets
          .map(t => `    • Target: "${t.target}"\n      Strategy: "${t.strategy}"`)

        // ILP-level classroom strategies (from the ILP strategies[] array)
        const senClassroomStrategies = [...new Set(
          senStudents.flatMap(s => ilpByStudent[s.studentId]?.strategies ?? [])
        )].slice(0, 4)

        // EHCP: needs, areas of need, outcomes
        const ehcpNeeds = [...new Set(
          ehcpStudents.map(s => ilpByStudent[s.studentId]?.sendCategory || s.needArea || 'EHCP').filter(Boolean)
        )].slice(0, 4)

        const ehcpAreas = ehcpStudents
          .map(s => ilpByStudent[s.studentId]?.areasOfNeed)
          .filter(Boolean)
          .slice(0, 2)

        const ehcpOutcomeLines = ehcpOutcomes
          .map(o => `    • [Section ${o.section}] "${o.outcomeText}"${o.provisionRequired ? ` — provision: ${o.provisionRequired}` : ''}`)

        sendContextBlock = `
CLASS SEND PROFILE — use this to generate all accessibility fields in every question
=====================================================================================
Standard (no SEND): ${noneCount} student${noneCount !== 1 ? 's' : ''}

SEN SUPPORT — ${senStudents.length} student${senStudents.length !== 1 ? 's' : ''}:
  Support needs: ${senNeeds.join(', ') || 'general learning support'}
${senIlpLines.length > 0 ? '  Active ILP targets and classroom strategies:\n' + senIlpLines.join('\n') : '  No ILP targets recorded yet.'}
${senClassroomStrategies.length > 0 ? '  ILP classroom strategies to apply: ' + senClassroomStrategies.join(' | ') : ''}
  → scaffolding_hint for EVERY question: write a sentence starter OR step-by-step thinking scaffold that directly applies the ILP strategies above. It must reduce the cognitive load for this specific target without giving away the answer.

EHCP — ${ehcpStudents.length} student${ehcpStudents.length !== 1 ? 's' : ''}:
  Categories: ${ehcpNeeds.join(', ') || 'EHCP'}
  Areas of need: ${ehcpAreas.join('; ') || 'not recorded'}
${ehcpOutcomeLines.length > 0 ? '  EHCP outcomes this homework can evidence:\n' + ehcpOutcomeLines.join('\n') : ''}
  → ehcp_adaptation for EVERY question: rewrite the question in plain English (max 2 sentences, no complex clauses), broken into numbered steps if multi-part. Reference the EHCP outcome where relevant.
  → vocab_support for EVERY question: define exactly 5 key subject terms in simple language (format: "word: plain definition").

ALL questions MUST include scaffolding_hint, ehcp_adaptation, and vocab_support fields regardless of class size.
`
      }
    }
  } catch {
    // SEND fetch is best-effort; don't block generation
  }

  // Fetch year group plan context (best-effort — don't fail generation if this errors)
  let ygPlanContext = ''
  try {
    const { getYearGroupPlanContext } = await import('./year-group-plans')
    const ygPlan = await getYearGroupPlanContext(schoolId as string, subject, yearGroup)
    if (ygPlan) {
      ygPlanContext = `\nSCHEME OF WORK — use this to ensure homework aligns with the curriculum plan:\n${ygPlan.slice(0, 800)}\n`
    }
  } catch { /* best-effort */ }

  // P1-8: Rate limit — max 10 AI homework generations per teacher per calendar day.
  // Checked against AuditLog so it's durable across server restarts.
  const generatingUserId = userId
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)
  const todayGenerationCount = await prisma.auditLog.count({
    where: {
      schoolId,
      actorId: generatingUserId,
      action:  'AI_HOMEWORK_GENERATED',
      createdAt: { gte: todayMidnight },
    },
  })
  if (todayGenerationCount >= 10) {
    throw new Error('Daily AI generation limit reached (10 per day). Try again tomorrow.')
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return noApiKeyFallback(type, lesson.title, subject)

  const typePrompt = buildTypePrompt(type, subject, qualification)

  // Task instruction — respect the teacher's chosen primary resource
  const taskInstruction = hasPrimaryNonOak
    ? `Your homework questions MUST be based on the PRIMARY RESOURCE marked above (the teacher's own uploaded material). The slide/page content extracted from that file is provided above — use it as your primary source. Generate questions that test the SPECIFIC facts, arguments, and evidence from those slides. Each model answer MUST be drawn directly from the content shown, including specific details, dates, names, and key vocabulary. Do NOT generate generic questions.`
    : preferredResourceId
      ? `Your homework questions MUST be based primarily on the PRIMARY RESOURCE marked in the resource list above. Generate questions that test the specific content and learning outcome of that resource. Other resources and learning objectives are supplementary context — do not let them override the PRIMARY RESOURCE selection.`
      : lesson.objectives.length > 0
        ? `Your homework questions MUST directly test the learning objectives listed above. Students should be able to answer from what they learned in this lesson.`
        : `Your homework questions MUST be based on the lesson resources listed above. Use the Oak lesson learning outcomes as your targets — generate questions that test exactly what those outcomes describe. Questions must be specific to "${lesson.title}" — do not generate generic "describe key concepts" questions.`

  const prompt = `You are an expert UK secondary school ${subject} teacher creating homework for a ${qualification} class${examBoard ? ` (${examBoard})` : ''}.

LESSON CONTEXT
==============
Title: "${lesson.title}"${topic ? `\nTopic: ${topic}` : ''}
Year Group: Year ${yearGroup} (${qualification})${examBoard ? `\nExam Board: ${examBoard}` : ''}

LEARNING OBJECTIVES — what was taught in this lesson:
${objectivesContext}

LESSON RESOURCES — source material for questions:
${resourceContext}
${sendContextBlock}${ygPlanContext}
TASK
====
${taskInstruction}

${typePrompt}`

  try {
    const client  = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 8000,
      system:     'You are a JSON API. Return ONLY valid JSON. No markdown. No code fences. No comments. In JSON string values, represent newlines as \\n — never use literal line breaks inside string values.',
      messages:   [{ role: 'user', content: prompt }],
    })
    const raw     = (message.content[0] as any).text.trim()
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()


    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Repair: literal newlines inside JSON string values break JSON.parse.
      // Fix only the chars inside quoted strings, not the structural whitespace.
      try {
        const repaired = cleaned.replace(
          /"(?:[^"\\]|\\.|\n|\r)*"/g,
          (m: string) => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r'),
        )
        parsed = JSON.parse(repaired)
      } catch (parseErr) {
        console.error('[generateHomeworkFromResources] JSON parse FAILED (raw first 300):', cleaned.slice(0, 300))
        return noApiKeyFallback(type, lesson.title, subject)
      }
    }

    // Validate questionsJson for structured types
    const needsQuestions = type === 'MCQ_QUIZ' || type === 'SHORT_ANSWER'
    const minQuestions   = type === 'SHORT_ANSWER' ? 5 : 4
    const hasQuestions   = parsed.questionsJson?.questions && Array.isArray(parsed.questionsJson.questions) && parsed.questionsJson.questions.length >= minQuestions
    if (needsQuestions && !hasQuestions) {
      // Retry once with a more directive prompt
      const retryMsg = await client.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 8000,
        system:     'You are a JSON API. Return ONLY valid JSON. No markdown. No code fences. No comments. In JSON string values, represent newlines as \\n — never use literal line breaks inside string values.',
        messages:   [
          { role: 'user',      content: prompt },
          { role: 'assistant', content: cleaned },
          { role: 'user',      content: 'The questionsJson field is missing or has too few questions. Please resend the complete JSON with questionsJson containing all required questions. Return ONLY valid JSON, no extra text.' },
        ],
      })
      const retryRaw     = (retryMsg.content[0] as any).text.trim()
      const retryCleaned = retryRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      try { parsed = JSON.parse(retryCleaned) } catch { /* use original parsed */ }
    }

    // Defensive: Claude sometimes returns questions at root level instead of inside questionsJson
    let questionsJson = parsed.questionsJson ?? undefined
    if (!questionsJson && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      questionsJson = { questions: parsed.questions }
    }
    // Last resort: fall back to stub questions rather than silently returning none
    if ((type === 'MCQ_QUIZ' || type === 'SHORT_ANSWER') && (!questionsJson || !Array.isArray((questionsJson as any).questions) || (questionsJson as any).questions.length === 0)) {
        const fallback = noApiKeyFallback(type, lesson.title, subject)
      questionsJson = fallback.questionsJson
    }

    // P1-8: Write audit entry on successful generation so the daily counter is accurate.
    // Fire-and-forget — don't block the return on the audit write.
    writeAudit({
      schoolId,
      actorId:    generatingUserId,
      action:     'AI_HOMEWORK_GENERATED',
      targetType: 'Lesson',
      targetId:   lessonId,
      metadata:   { homeworkType: type, lessonTitle: lesson.title },
    }).catch(() => { /* non-blocking */ })

    return {
      type:                 type,
      instructions:         parsed.instructions    ?? '',
      modelAnswer:          parsed.modelAnswer     ?? '',
      gradingBands:         parsed.gradingBands    ?? {},
      targetWordCount:      parsed.targetWordCount ?? (type === 'EXTENDED_WRITING' ? 300 : 0),
      questionsJson,
      basedOnSchemeOfWork:  !!ygPlanContext,
      ilpTargetIds:         promptIlpTargetIds.length > 0 ? promptIlpTargetIds : undefined,
    }
  } catch (err) {
    console.error('[generateHomeworkFromResources] API call failed:', err)
    return noApiKeyFallback(type, lesson.title, subject)
  }
}

// ── Generate proposal from teacher's own instructions ─────────────────────────

export async function generateHomeworkProposal(params: {
  lessonTitle:  string
  subject:      string
  yearGroup:    number
  examBoard:    string
  type:         HomeworkType
  instructions: string
}): Promise<ProposalResult> {
  const qualification = params.yearGroup <= 9 ? 'KS3' : params.yearGroup <= 11 ? 'GCSE' : 'A-Level'
  const apiKey        = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return {
      type:            params.type,
      instructions:    params.instructions,
      modelAnswer:     '[Add ANTHROPIC_API_KEY to .env.local for AI model answer generation]',
      gradingBands:    params.type === 'MCQ_QUIZ' || params.type === 'UPLOAD' ? {} : defaultBands(),
      targetWordCount: params.type === 'EXTENDED_WRITING' ? 300 : 0,
    }
  }

  const typePrompt = buildTypePrompt(params.type, params.subject, qualification)

  const prompt = `You are an expert UK secondary school teacher creating a model answer for ${qualification} ${params.subject}${params.examBoard ? ` (${params.examBoard})` : ''}.

Lesson: "${params.lessonTitle}"
Year Group: Year ${params.yearGroup}
Homework type: ${params.type}
Teacher's task instructions: "${params.instructions}"

Generate a model answer / answer key for the above task.
${typePrompt}

Respond ONLY with valid JSON, no markdown, no code fences:
{"type":"${params.type}","instructions":"${params.instructions}","modelAnswer":"<model answer>","gradingBands":{},"targetWordCount":0}`

  try {
    const client  = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2500,
      messages:   [{ role: 'user', content: prompt }],
    })
    const raw     = (message.content[0] as any).text.trim()
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    let parsed: any
    try { parsed = JSON.parse(cleaned) } catch { parsed = {} }
    return {
      type:            params.type,
      instructions:    params.instructions,
      modelAnswer:     parsed.modelAnswer     ?? `[Model answer for ${params.lessonTitle} — add content here]`,
      gradingBands:    parsed.gradingBands    ?? (params.type === 'MCQ_QUIZ' || params.type === 'UPLOAD' ? {} : defaultBands()),
      targetWordCount: parsed.targetWordCount ?? (params.type === 'EXTENDED_WRITING' ? 300 : 0),
    }
  } catch (err) {
    console.error('[generateHomeworkProposal] API call failed:', err)
    return {
      type:            params.type,
      instructions:    params.instructions,
      modelAnswer:     `[Model answer for ${params.lessonTitle} — add content here]`,
      gradingBands:    params.type === 'MCQ_QUIZ' || params.type === 'UPLOAD' ? {} : defaultBands(),
      targetWordCount: params.type === 'EXTENDED_WRITING' ? 300 : 0,
    }
  }
}

// ── Phase 6: Learning extraction + adaptive generation ───────────────────────

export type LearningExtraction = {
  learningObjectives: string[]
  bloomsLevel: string
  keyTopics: string[]
  suggestedHomeworkTypes: string[]
  suggestedDurationMins: number
  rationale: string
}

export type GeneratedHomeworkContent = {
  title: string
  instructions: string
  structuredContent: object
  differentiationNotes: string
}

export async function extractLearningFromLesson(lessonId: string): Promise<LearningExtraction> {
  const { schoolId } = await requireAuth()

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId },
    include: {
      resources: { select: { type: true, label: true, oakContentId: true } },
      class: { select: { subject: true, yearGroup: true } },
    },
  })
  if (!lesson) throw new Error('Lesson not found')
  if (lesson.resources.length === 0) throw new Error('No resources attached to this lesson. Add at least one resource before generating homework.')

  const subject = lesson.class?.subject ?? 'Unknown'
  const yearGroup = lesson.class?.yearGroup ?? 10

  const fallback: LearningExtraction = {
    learningObjectives: lesson.objectives.length > 0
      ? lesson.objectives
      : [`Understand key concepts from ${lesson.title}`],
    bloomsLevel: 'understand',
    keyTopics: lesson.topic ? [lesson.topic] : [lesson.title],
    suggestedHomeworkTypes: ['quiz', 'retrieval_practice', 'short_answer'],
    suggestedDurationMins: 20,
    rationale: 'Extracted from lesson content.',
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return fallback

  const resourceList = lesson.resources.map(r => `[${r.type}] ${r.label}`).join('\n')
  const objectives = lesson.objectives.length > 0
    ? lesson.objectives.join('\n')
    : '(No objectives specified)'

  // Fetch Oak lesson content for any linked Oak resources
  const oakSlugs = lesson.resources
    .filter(r => r.oakContentId)
    .map(r => r.oakContentId as string)

  const oakLessons = oakSlugs.length > 0
    ? await prisma.oakLesson.findMany({
        where: { slug: { in: oakSlugs }, deletedAt: null },
        select: { slug: true, title: true, pupilLessonOutcome: true, keystage: true },
      })
    : []

  const oakContext = oakLessons.length > 0
    ? `\nOak National Academy resources used:\n${oakLessons.map(o =>
        `- "${o.title}": ${o.pupilLessonOutcome ?? 'No outcome description'}`
      ).join('\n')}`
    : ''

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: 'You are a UK curriculum expert. Extract learning requirements from lesson content and suggest appropriate homework types aligned to Bloom\'s Taxonomy. Return ONLY valid JSON, no markdown.',
      messages: [{
        role: 'user',
        content: `Lesson: "${lesson.title}", Subject: ${subject}, Year: ${yearGroup}
Objectives: ${objectives}
Resources: ${resourceList || 'None'}${oakContext}

Return JSON:
{
  "learningObjectives": ["2-4 specific, measurable objectives"],
  "bloomsLevel": "remember|understand|apply|analyse|evaluate|create",
  "keyTopics": ["3-6 key topics/concepts"],
  "suggestedHomeworkTypes": ["ordered by suitability for this lesson"],
  "suggestedDurationMins": 20,
  "rationale": "brief explanation"
}`,
      }],
    })
    const raw = (msg.content[0] as any).text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
    return JSON.parse(raw) as LearningExtraction
  } catch {
    return fallback
  }
}

// ── Extract learning from uploaded file label ──────────────────────────────────

export async function extractLearningFromLabel(params: {
  label:      string
  subject?:   string
  yearGroup?: number
}): Promise<{ objectives: string[]; topics: string[] }> {
  const { label, subject = '', yearGroup } = params
  const fallback = {
    objectives: [`Understand key concepts from "${label}"`],
    topics:     [label],
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return fallback
  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system:     'You are a UK curriculum expert. Return ONLY valid JSON, no markdown.',
      messages: [{
        role:    'user',
        content: `A teacher uploaded a resource called "${label}"${subject ? ` for ${subject}` : ''}${yearGroup ? ` Year ${yearGroup}` : ''}.
Infer 2-4 learning objectives and 2-4 key topics from the title.
Return JSON: {"objectives":["..."],"topics":["..."]}`,
      }],
    })
    const raw = (msg.content[0] as any).text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export async function generateHomeworkContent(input: {
  homeworkVariantType: string
  subject: string
  yearGroup: number
  learningObjectives: string[]
  bloomsLevel: string
  keyTopics: string[]
  sendAdaptations?: string[]
  ilpTargets?: string[]
  durationMins: number
  additionalContext?: string
}): Promise<GeneratedHomeworkContent> {
  await requireAuth()

  const qualification = input.yearGroup <= 9 ? 'KS3' : input.yearGroup <= 11 ? 'GCSE' : 'A-Level'

  const typeInstructions: Record<string, string> = {
    quiz: 'Generate 6-8 short questions with model answers. Return structuredContent: { questions: [{question, answer, marks}] }',
    multiple_choice: 'Generate 8-10 MCQs with 4 options each. Return structuredContent: { questions: [{question, options: [string,string,string,string], correct: 0-3}] }',
    essay: 'Generate essay title, word count, paragraph guide, mark scheme. Return structuredContent: { title, wordCount, paragraphGuide: [string], markScheme }',
    retrieval_practice: 'Generate 8-12 retrieval questions with answers. Return structuredContent: { questions: [{question, answer}] }',
    mind_map: 'Generate mind map structure. Return structuredContent: { centralConcept, branches: [string], keyTerms: [string] }',
    reading_response: 'Generate a short text extract and 3-4 response questions. Return structuredContent: { text, questions: [{question, responseFrame}] }',
    short_answer: 'Generate 4-5 short answer questions with model answers. Return structuredContent: { questions: [{question, modelAnswer, marks}] }',
    free_text: 'Generate a clear task description. Return structuredContent: { taskDescription, hints: [string] }',
    research_task: 'Generate research questions and sources list. Return structuredContent: { researchQuestions: [string], suggestedSources: [string], outputFormat }',
    creative: 'Generate creative brief. Return structuredContent: { brief, constraints: [string], successCriteria }',
    practical: 'Generate practical task instructions. Return structuredContent: { steps: [string], materials: [string], outputFormat }',
  }

  const typeGuide = typeInstructions[input.homeworkVariantType] ?? typeInstructions.free_text
  const sendNote = input.sendAdaptations?.length
    ? `\nSEND adaptations required: ${input.sendAdaptations.join('; ')}`
    : ''
  const ilpNote = input.ilpTargets?.length
    ? `\nCRITICAL: This homework must provide evidence opportunities for these ILP targets. Design at least one question or task that directly addresses each target:\n${input.ilpTargets.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : ''
  const contextNote = input.additionalContext?.trim()
    ? `\nTeacher-provided source material for additional objectives:\n${input.additionalContext}`
    : ''

  const fallback: GeneratedHomeworkContent = {
    title: `${input.subject} — ${input.keyTopics[0] ?? 'Homework'}`,
    instructions: `Complete the following ${input.homeworkVariantType} task on ${input.keyTopics.join(', ')}.`,
    structuredContent: { taskDescription: 'AI generation unavailable. Please add content manually.' },
    differentiationNotes: sendNote || 'Standard differentiation applies.',
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return fallback

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: 'You are a UK secondary school teacher creating homework content. Return ONLY valid JSON, no markdown fences.',
      messages: [{
        role: 'user',
        content: `Create ${qualification} ${input.subject} homework.
Type: ${input.homeworkVariantType}
Duration: ${input.durationMins} minutes
Bloom's level: ${input.bloomsLevel}
Objectives: ${input.learningObjectives.join('; ')}
Key topics: ${input.keyTopics.join(', ')}${sendNote}${ilpNote}${contextNote}

${typeGuide}

Return JSON:
{
  "title": "Descriptive homework title",
  "instructions": "Clear student-facing instructions (2-4 sentences)",
  "structuredContent": { /* per type schema above */ },
  "differentiationNotes": "Brief SEND/differentiation notes for teacher"
}`,
      }],
    })
    const raw = (msg.content[0] as any).text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
    return JSON.parse(raw) as GeneratedHomeworkContent
  } catch {
    return fallback
  }
}

export async function autoMarkSubmission(submissionId: string): Promise<{ score: number; maxScore: number; feedback: string }> {
  const { schoolId } = await requireAuth()

  const sub = await prisma.submission.findFirst({
    where: { id: submissionId, schoolId },
    include: {
      homework: {
        select: {
          homeworkVariantType: true,
          structuredContent:   true,
          title:               true,
          class:               { select: { subject: true, yearGroup: true, examBoard: true, examModules: true } },
        },
      },
    },
  })
  if (!sub) throw new Error('Submission not found')

  const hwType = sub.homework.homeworkVariantType
  if (!['quiz', 'multiple_choice', 'retrieval_practice'].includes(hwType ?? '')) {
    return { score: 0, maxScore: 0, feedback: 'Auto-marking not available for this homework type. Please mark manually.' }
  }

  const content = sub.homework.structuredContent as any
  if (!content?.questions || !Array.isArray(content.questions) || content.questions.length === 0) {
    return { score: 0, maxScore: 0, feedback: 'Auto-marking not available — no structured questions found. Please mark manually.' }
  }

  const response = sub.structuredResponse as any

  // Exam board context for AI marking
  const hwClass     = (sub.homework as any).class
  const examBoard   = hwClass?.examBoard   as string | null
  const examModules = hwClass?.examModules as string[]
  const subject     = hwClass?.subject     as string | null
  const yearGroup   = hwClass?.yearGroup   as number | null
  const examContext = examBoard
    ? `Exam board: ${examBoard}. ${examModules?.length ? `Modules: ${examModules.join(', ')}.` : ''} Subject: ${subject ?? 'unknown'}. Year ${yearGroup ?? ''}.`
    : `Subject: ${subject ?? 'unknown'}. Year ${yearGroup ?? ''}.`

  let score = 0
  let maxScore = 0

  if (hwType === 'multiple_choice' && content?.questions && response?.answers) {
    for (let i = 0; i < content.questions.length; i++) {
      maxScore++
      if (response.answers[i] === content.questions[i].correct) score++
    }
  } else if ((hwType === 'quiz' || hwType === 'retrieval_practice') && content?.questions) {
    maxScore = content.questions.reduce((a: number, q: any) => a + (q.marks ?? 1), 0)
    // For text-based quiz, use AI to assess
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey && response?.answers) {
      try {
        const client = new Anthropic({ apiKey })
        const qaPairs = content.questions.map((q: any, i: number) =>
          `Q${i + 1}: ${q.question}\nModel answer: ${q.answer ?? q.modelAnswer}\nStudent answer: ${response.answers?.[i] ?? '(no answer)'}`
        ).join('\n\n')
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          system: `You are a UK teacher marking homework according to the official examination board mark scheme guidelines. ${examContext} Score each answer strictly and fairly against the model answer, applying the mark allocation as the exam board would. Return ONLY JSON.`,
          messages: [{
            role: 'user',
            content: `Mark these answers using ${examBoard ? `${examBoard} mark scheme conventions` : 'standard UK mark scheme conventions'}. Max total marks: ${maxScore}.\n\n${qaPairs}\n\nReturn: {"scores": [number per question], "totalScore": number, "feedback": "brief 2-sentence feedback referencing exam board expectations"}`,
          }],
        })
        const parsed = JSON.parse((msg.content[0] as any).text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''))
        score = parsed.totalScore ?? 0
        const feedback = parsed.feedback ?? 'Auto-marked by AI.'
        await prisma.submission.update({
          where: { id: submissionId },
          data: { autoScore: score, autoFeedback: feedback, finalScore: score, feedback, status: 'MARKED', autoMarked: true, teacherReviewed: false },
        })
        void updateLearningProfile(sub.studentId).catch(() => {})
        return { score, maxScore, feedback }
      } catch {
        // Fall through to simple scoring
      }
    }
  }

  const feedback = `Auto-scored: ${score}/${maxScore}. Please review and add personalised feedback.`
  await prisma.submission.update({
    where: { id: submissionId },
    data: { autoScore: score, autoFeedback: feedback, finalScore: score, feedback, status: 'MARKED', autoMarked: true, teacherReviewed: false },
  })
  void updateLearningProfile(sub.studentId).catch(() => {})
  return { score, maxScore, feedback }
}

// ── Mark submission ───────────────────────────────────────────────────────────

export async function markSubmission(submissionId: string, data: {
  teacherScore: number
  feedback:     string
  grade?:       string
}): Promise<{
  ilpData: { studentId: string; ilpId: string; targets: Array<{ id: string; description: string; successCriteria: string; subject: string | null }> } | null
  gradeDrop: { studentId: string; studentName: string; previousGrade: number; newGrade: number; drop: number; suggestion: string } | null
}> {
  const { schoolId, role } = await requireAuth()
  if (!['TEACHER', 'HEAD_OF_DEPT'].includes(role)) throw new Error('Only teaching staff can grade homework')

  const sub = await prisma.submission.findFirst({ where: { id: submissionId, schoolId } })
  if (!sub) throw new Error('Submission not found')

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      teacherScore:      data.teacherScore,
      finalScore:        data.teacherScore,
      feedback:          data.feedback,
      grade:             data.grade ?? null,
      status:            'RETURNED',
      markedAt:          new Date(),
      integrityReviewed: true,
      teacherReviewed:   true,
    },
  })

  // Check for active approved ILP with active targets (new IndividualLearningPlan model)
  const studentId = sub.studentId
  const ilpRecord = await prisma.individualLearningPlan.findFirst({
    where: { studentId, schoolId, status: 'active', approvedBySenco: true },
    select: {
      id: true,
      targets: {
        where: { status: 'active' },
        select: { id: true, target: true, strategy: true, successMeasure: true },
      },
    },
  })
  const ilpData = ilpRecord && ilpRecord.targets.length > 0
    ? {
        studentId,
        ilpId:   ilpRecord.id as string,
        targets: (ilpRecord.targets as any[]).map(t => ({
          id:              t.id,
          description:     t.target,
          successCriteria: t.strategy,
          subject:         null as string | null,
        })),
      }
    : null

  void updateLearningProfile(sub.studentId).catch(() => {})

  // Proactive ILP evidence detection (fire-and-forget)
  if (ilpData) {
    void prisma.homework.findUnique({
      where:  { id: sub.homeworkId },
      select: { title: true, createdBy: true, class: { select: { subject: true } } },
    }).then(hw => {
      if (!hw) return
      void checkILPEvidenceMatch({
        submissionId,
        studentId,
        ilpTargets:    ilpData.targets.map(t => ({ id: t.id, description: t.description })),
        homeworkTitle: hw.title,
        subject:       hw.class?.subject ?? '',
        grade:         data.grade ?? '',
        schoolId,
        teacherId:     hw.createdBy,
        homeworkId:    sub.homeworkId,
      }).catch(() => {})
    }).catch(() => {})
  }

  // Proactive EHCP evidence detection (fire-and-forget)
  void prisma.ehcpPlan.findFirst({
    where: { studentId, schoolId, status: 'active' },
    select: { outcomes: { where: { status: 'active' }, select: { id: true, outcomeText: true, section: true } } },
  }).then(ehcp => {
    if (!ehcp || ehcp.outcomes.length === 0) return
    void prisma.homework.findUnique({
      where:  { id: sub.homeworkId },
      select: { title: true, createdBy: true, class: { select: { subject: true } } },
    }).then(hw => {
      if (!hw) return
      void checkEhcpEvidenceMatch({
        submissionId,
        studentId,
        ehcpOutcomes:  ehcp.outcomes,
        homeworkTitle: hw.title,
        subject:       hw.class?.subject ?? '',
        grade:         data.grade ?? '',
        schoolId,
        teacherId:     hw.createdBy,
        homeworkId:    sub.homeworkId,
      }).catch(() => {})
    }).catch(() => {})
  }).catch(() => {})

  // ── Grade-drop detection ───────────────────────────────────────────────────
  let gradeDrop: {
    studentId:     string
    studentName:   string
    previousGrade: number
    newGrade:      number
    drop:          number
    suggestion:    string
  } | null = null

  try {
    const homework = await prisma.homework.findUnique({
      where:  { id: sub.homeworkId },
      select: { classId: true, gradingBands: true, title: true },
    })

    if (homework?.classId) {
      const prevSub = await prisma.submission.findFirst({
        where: {
          studentId:  sub.studentId,
          schoolId,
          id:         { not: submissionId },
          homework:   { classId: homework.classId },
          finalScore: { not: null },
          markedAt:   { not: null },
        },
        select: {
          finalScore: true,
          homework:   { select: { gradingBands: true } },
        },
        orderBy: { markedAt: 'desc' },
      })

      if (prevSub) {
        const prevBands = prevSub.homework.gradingBands as Record<string, unknown> | null
        const prevMax   = prevBands ? Math.max(...Object.keys(prevBands).map(Number)) : 100
        const prevPct   = Math.round((prevSub.finalScore! / prevMax) * 100)
        const prevGrade = percentToGcseGrade(prevPct)

        const currBands = homework.gradingBands as Record<string, unknown> | null
        const currMax   = currBands ? Math.max(...Object.keys(currBands).map(Number)) : 100
        const currPct   = Math.round((data.teacherScore / currMax) * 100)
        const currGrade = percentToGcseGrade(currPct)

        const drop = prevGrade - currGrade
        if (drop >= 1) {
          const student = await prisma.user.findUnique({
            where:  { id: sub.studentId },
            select: { firstName: true, lastName: true },
          })
          const sName = student ? `${student.firstName} ${student.lastName}` : 'Student'
          gradeDrop = {
            studentId:     sub.studentId,
            studentName:   sName,
            previousGrade: prevGrade,
            newGrade:      currGrade,
            drop,
            suggestion:    `Grade dropped from ${prevGrade} to ${currGrade} on "${homework.title}". Consider adding targeted classroom strategies to their Learning Passport.`,
          }
          // SEND risk screening: auto-create EarlyWarningFlag for significant grade drops
          if (drop >= 2) {
            void prisma.earlyWarningFlag.create({
              data: {
                schoolId,
                studentId:   sub.studentId,
                flagType:    'grade_drop',
                severity:    drop >= 3 ? 'high' : 'medium',
                description: `Significant grade drop detected for ${sName}: Grade ${prevGrade} → Grade ${currGrade} (↓${drop}) on "${homework.title}"`,
                dataPoints:  { homeworkId: sub.homeworkId, previousGrade: prevGrade, newGrade: currGrade, drop },
                expiresAt:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            }).catch(() => {})
          }
        }
      }
    }
  } catch {
    // Grade drop detection is non-critical — don't fail the mark
  }

  revalidatePath('/homework')
  revalidatePath(`/homework/${sub.homeworkId}`)
  revalidatePath(`/homework/${sub.homeworkId}/mark/${submissionId}`)
  revalidatePath('/dashboard')
  revalidatePath('/', 'layout')

  // Mark Coach + Quality + Evidence agent snapshots dirty — new marked submission = new data
  void markDirty(sub.studentId, schoolId, [AgentType.COACH, AgentType.QUALITY, AgentType.EVIDENCE]).catch(() => {})

  return { ilpData, gradeDrop }
}

// ── Bulk auto-mark queue ──────────────────────────────────────────────────────

export async function bulkAutoMarkAndQueue(homeworkId: string): Promise<{
  queued: number
  alreadyMarked: number
}> {
  const { schoolId, id: userId } = await requireAuth()

  const hw = await prisma.homework.findFirst({
    where: { id: homeworkId, schoolId },
    select: {
      title: true,
      homeworkVariantType: true,
      class: { select: { teachers: { select: { userId: true } } } },
    },
  })
  if (!hw) throw new Error('Homework not found')

  const autoMarkableTypes = ['quiz', 'multiple_choice', 'retrieval_practice']
  if (!autoMarkableTypes.includes(hw.homeworkVariantType ?? '')) {
    throw new Error('This homework type does not support auto-marking')
  }

  const submissions = await prisma.submission.findMany({
    where: { homeworkId, schoolId, status: 'SUBMITTED' },
    select: { id: true },
  })

  const alreadyMarked = await prisma.submission.count({
    where: { homeworkId, schoolId, status: { not: 'SUBMITTED' } },
  })

  let queued = 0
  for (const sub of submissions) {
    try {
      await autoMarkSubmission(sub.id)
      queued++
    } catch {
      // Skip submissions that fail
    }
  }

  // Notify the teacher
  if (queued > 0) {
    const teacherIds = hw.class?.teachers.map(t => t.userId) ?? [userId]
    await prisma.notification.createMany({
      data: teacherIds.map(tid => ({
        schoolId,
        userId: tid,
        type: 'HOMEWORK_GRADED',
        title: `${queued} submission${queued !== 1 ? 's' : ''} auto-marked`,
        body: `${queued} submission${queued !== 1 ? 's have' : ' has'} been auto-marked for "${hw.title}". Please review before returning to students.`,
        linkHref: `/homework/${homeworkId}`,
      })),
      skipDuplicates: true,
    })
  }

  revalidatePath(`/homework/${homeworkId}`)
  return { queued, alreadyMarked }
}

/** Send a homework reminder notification (in-app + email) to a student who hasn't submitted. */
export async function resendHomeworkReminder(homeworkId: string, studentId: string): Promise<{ ok: true }> {
  const { schoolId } = await requireAuth()

  const hw = await prisma.homework.findFirst({
    where:  { id: homeworkId, schoolId },
    select: { title: true, dueAt: true },
  })
  if (!hw) throw new Error('Homework not found')

  const student = await prisma.user.findUnique({
    where:  { id: studentId },
    select: { email: true, firstName: true },
  })

  await prisma.notification.create({
    data: {
      schoolId,
      userId:   studentId,
      type:     'HOMEWORK_SET',
      title:    `Reminder: "${hw.title}" is due`,
      body:     hw.dueAt
        ? `This homework is due ${new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. Please submit when ready.`
        : 'Please submit your homework when ready.',
      linkHref: `/student/homework/${homeworkId}`,
    },
  })

  // Fire-and-forget email — never blocks the response
  if (student?.email) {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'https://omnis-app-ten.vercel.app'
    void sendHomeworkReminderEmail({
      to:               student.email,
      studentFirstName: student.firstName,
      homeworkTitle:    hw.title,
      dueAt:            hw.dueAt,
      homeworkUrl:      `${baseUrl}/student/homework/${homeworkId}`,
    })
  }

  return { ok: true }
}

// ── Teacher notes on submissions ──────────────────────────────────────────────

export async function saveHomeworkTeacherNote(submissionId: string, note: string): Promise<void> {
  const { schoolId, id: userId } = await requireAuth()

  const sub = await prisma.submission.findFirst({ where: { id: submissionId, schoolId } })
  if (!sub) throw new Error('Submission not found')

  await prisma.teacherPlanNote.create({
    data: { planType: 'homework_submission', planId: submissionId, teacherId: userId, schoolId, note },
  })

  await writeAudit({ schoolId, actorId: userId, action: 'SUBMISSION_GRADED', targetType: 'Submission', targetId: submissionId, metadata: { noteAdded: true } })
  revalidatePath(`/homework/${sub.homeworkId}`)
}

export async function updateHomeworkTeacherNote(noteId: string, note: string): Promise<void> {
  const { schoolId, id: userId } = await requireAuth()
  const existing = await prisma.teacherPlanNote.findFirst({ where: { id: noteId, schoolId } })
  if (!existing) throw new Error('Note not found')
  if (existing.teacherId !== userId) throw new Error('Forbidden')
  if (!note.trim()) return
  await prisma.teacherPlanNote.update({ where: { id: noteId }, data: { note: note.trim() } })
  revalidatePath(`/homework`)
}

export async function deleteHomeworkTeacherNote(noteId: string): Promise<{ homeworkId: string }> {
  const { schoolId, id: userId, role } = await requireAuth()
  const existing = await prisma.teacherPlanNote.findFirst({
    where: { id: noteId, schoolId },
    select: { teacherId: true, planId: true },
  })
  if (!existing) throw new Error('Note not found')
  const canDelete = existing.teacherId === userId || ['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)
  if (!canDelete) throw new Error('Forbidden')
  await prisma.teacherPlanNote.delete({ where: { id: noteId } })
  // planId is submissionId — find the homeworkId from submission
  const sub = await prisma.submission.findUnique({ where: { id: existing.planId }, select: { homeworkId: true } })
  const homeworkId = sub?.homeworkId ?? ''
  if (homeworkId) revalidatePath(`/homework/${homeworkId}`)
  return { homeworkId }
}

// ── Link homework to ILP target as evidence ───────────────────────────────────

export async function recordHomeworkAsIlpEvidence(homeworkId: string, ilpTargetId: string): Promise<{ alreadyLinked: boolean }> {
  const { schoolId, id: userId } = await requireAuth()

  const hw = await prisma.homework.findFirst({ where: { id: homeworkId, schoolId } })
  if (!hw) throw new Error('Homework not found')

  const existing = await prisma.ilpHomeworkLink.findFirst({ where: { ilpTargetId, homeworkId } })
  if (existing) return { alreadyLinked: true }

  await prisma.ilpHomeworkLink.create({
    data: { ilpTargetId, homeworkId, linkedBy: userId },
  })

  return { alreadyLinked: false }
}

// ── ILP Evidence Classification (AI) ──────────────────────────────────────────

export async function classifyIlpEvidence(payload: {
  homeworkTitle: string
  subject: string
  score: number
  maxScore: number
  ilpTargets: Array<{ id: string; description: string; successCriteria: string; subject: string | null }>
}): Promise<Array<{ targetId: string; evidenceType: string; aiSummary: string }>> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return payload.ilpTargets.map(t => ({ targetId: t.id, evidenceType: 'NEUTRAL', aiSummary: '' }))
  }

  const pct = payload.maxScore > 0 ? Math.round((payload.score / payload.maxScore) * 100) : 0

  const prompt = `A UK secondary school student completed homework titled "${payload.homeworkTitle}" (subject: ${payload.subject}).
Score: ${payload.score}/${payload.maxScore} (${pct}%).

Active ILP SMART goals:
${payload.ilpTargets.map((t, i) => `${i + 1}. ${t.description}${t.subject ? ` [${t.subject}]` : ''}\n   Success criteria: ${t.successCriteria}`).join('\n')}

Classify each goal as:
- PROGRESS: score/subject shows clear progress
- CONCERN: score/subject suggests this goal is at risk
- NEUTRAL: no clear indication either way

Return ONLY JSON with no markdown: {"classifications":[{"targetId":"...","evidenceType":"PROGRESS"|"CONCERN"|"NEUTRAL","aiSummary":"one sentence"}]}`

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = (msg.content[0] as any).text.trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
    const parsed = JSON.parse(text)
    return parsed.classifications as Array<{ targetId: string; evidenceType: string; aiSummary: string }>
  } catch {
    return payload.ilpTargets.map(t => ({ targetId: t.id, evidenceType: 'NEUTRAL', aiSummary: '' }))
  }
}

// ── Update ILP Evidence Entry ─────────────────────────────────────────────────

export async function updateIlpEvidence(
  evidenceId: string,
  data: { evidenceType: 'PROGRESS' | 'CONCERN' | 'NEUTRAL'; teacherNote?: string },
): Promise<void> {
  const { schoolId, role } = await requireAuth()
  const staffRoles = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']
  if (!staffRoles.includes(role)) throw new Error('Forbidden')

  await prisma.ilpEvidenceEntry.updateMany({
    where: { id: evidenceId, schoolId },
    data:  {
      evidenceType: data.evidenceType,
      teacherNote:  data.teacherNote ?? null,
    },
  })
}

// ── Save ILP Evidence Entries ─────────────────────────────────────────────────

export async function saveIlpEvidenceEntries(
  submissionId: string,
  entries: Array<{
    ilpTargetId: string
    evidenceType: string
    aiSummary: string
    teacherNote?: string
  }>
): Promise<void> {
  const { schoolId, id: userId } = await requireAuth()

  const sub = await prisma.submission.findFirst({
    where: { id: submissionId, schoolId },
    include: {
      homework: { select: { title: true, class: { select: { subject: true } } } },
    },
  })
  if (!sub) throw new Error('Submission not found')

  const { count: insertedCount } = await prisma.ilpEvidenceEntry.createMany({
    data: entries.map(e => ({
      schoolId,
      studentId:    sub.studentId,
      ilpTargetId:  e.ilpTargetId,
      submissionId,
      homeworkTitle: sub.homework.title,
      subject:      (sub.homework as any).class?.subject ?? null,
      score:        sub.finalScore ?? null,
      maxScore:     null,
      evidenceType: e.evidenceType,
      aiSummary:    e.aiSummary,
      teacherNote:  e.teacherNote ?? null,
      createdBy:    userId,
    })),
    skipDuplicates: true,
  })
  // All entries already existed — skip notifications to avoid duplicates
  if (insertedCount === 0) return

  // Auto-raise SENCO notification + EarlyWarningFlag if student has 3+ CONCERN entries this term,
  // and auto-transition IlpTarget.status to 'achieved' when 3+ PROGRESS entries accumulate.
  const hasConcern  = entries.some(e => e.evidenceType === 'CONCERN')
  const hasProgress = entries.some(e => e.evidenceType === 'PROGRESS')
  if (hasConcern || hasProgress) {
    try {
      const now = new Date()
      const currentTerm = await prisma.termDate.findFirst({
        where: { schoolId, startsAt: { lte: now }, endsAt: { gte: now } },
      })
      const termStart = currentTerm?.startsAt ?? new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000)

      // Count overall CONCERN entries for this student this term
      const concernCount = await prisma.ilpEvidenceEntry.count({
        where: { schoolId, studentId: sub.studentId, evidenceType: 'CONCERN', createdAt: { gte: termStart } },
      })
      if (concernCount >= 3) {
        const notifLinkHref = `/student/${sub.studentId}/send`
        const alreadyNotified = await prisma.notification.findFirst({
          where: { schoolId, type: 'ILP_CONCERN_THRESHOLD', linkHref: notifLinkHref },
        })
        const [student, senco] = await Promise.all([
          prisma.user.findUnique({ where: { id: sub.studentId }, select: { firstName: true, lastName: true } }),
          prisma.user.findFirst({ where: { schoolId, role: 'SENCO' }, select: { id: true } }),
        ])
        if (student && senco && !alreadyNotified) {
          await prisma.notification.create({
            data: {
              schoolId,
              userId:   senco.id,
              type:     'ILP_CONCERN_THRESHOLD',
              title:    `ILP concern alert: ${student.firstName} ${student.lastName}`,
              body:     `${student.firstName} ${student.lastName} now has ${concernCount} CONCERN entries on their ILP this term. Review their progress.`,
              linkHref: notifLinkHref,
            },
          })
        }

        // Raise EarlyWarningFlag for persistent ILP concern pattern
        const existingFlag = await prisma.earlyWarningFlag.findFirst({
          where: { schoolId, studentId: sub.studentId, flagType: 'ilp_concern_pattern', isActioned: false, expiresAt: { gte: now } },
        })
        if (!existingFlag && student) {
          const expiresAt = new Date(now)
          expiresAt.setDate(expiresAt.getDate() + 30)
          await prisma.earlyWarningFlag.create({
            data: {
              schoolId,
              studentId: sub.studentId,
              flagType:  'ilp_concern_pattern',
              severity:  concernCount >= 5 ? 'high' : 'medium',
              description: `${student.firstName} ${student.lastName} has ${concernCount} CONCERN evidence entries on their ILP this term.`,
              dataPoints: { concernCount, termStart },
              expiresAt,
            },
          })
          revalidatePath('/senco/early-warning')
        }
      }

      // Per-target: count CONCERN entries and notify SENCO if a specific target has 3+ concerns
      const concernTargetIds = entries.filter(e => e.evidenceType === 'CONCERN').map(e => e.ilpTargetId)
      for (const targetId of concernTargetIds) {
        const targetConcernCount = await prisma.ilpEvidenceEntry.count({
          where: { schoolId, studentId: sub.studentId, ilpTargetId: targetId, evidenceType: 'CONCERN', createdAt: { gte: termStart } },
        })
        if (targetConcernCount >= 3) {
          const senco = await prisma.user.findFirst({ where: { schoolId, role: 'SENCO' }, select: { id: true } })
          const student = await prisma.user.findUnique({ where: { id: sub.studentId }, select: { firstName: true, lastName: true } })
          if (senco && student) {
            const targetNotifHref = `/send/ilp/${sub.studentId}`
            const alreadyFlagged = await prisma.notification.findFirst({
              where: { schoolId, userId: senco.id, type: 'ILP_TARGET_CONCERN', linkHref: targetNotifHref,
                createdAt: { gte: termStart } },
            })
            if (!alreadyFlagged) {
              await prisma.notification.create({
                data: {
                  schoolId,
                  userId:   senco.id,
                  type:     'ILP_TARGET_CONCERN',
                  title:    `ILP target needs review: ${student.firstName} ${student.lastName}`,
                  body:     `An ILP target for ${student.firstName} ${student.lastName} has ${targetConcernCount} CONCERN entries this term — consider updating target status.`,
                  linkHref: targetNotifHref,
                },
              })
            }
          }
        }
      }
      // Per-target: auto-transition to 'achieved' when 3+ PROGRESS entries accumulate
      if (hasProgress) {
        const progressTargetIds = entries.filter(e => e.evidenceType === 'PROGRESS').map(e => e.ilpTargetId)
        for (const targetId of progressTargetIds) {
          const target = await prisma.ilpTarget.findUnique({
            where: { id: targetId },
            select: { id: true, status: true, ilpId: true, target: true },
          })
          if (!target || target.status !== 'active') continue

          const progressCount = await prisma.ilpEvidenceEntry.count({
            where: { schoolId, studentId: sub.studentId, ilpTargetId: targetId, evidenceType: 'PROGRESS', createdAt: { gte: termStart } },
          })
          if (progressCount < 3) continue

          // Auto-transition to achieved
          await prisma.ilpTarget.update({
            where: { id: targetId },
            data:  { status: 'achieved', reviewedAt: new Date() },
          })

          // Audit trail
          await writeILPAudit({
            ilpId:         target.ilpId,
            userId,
            userName:      'System (auto)',
            userRole:      'SYSTEM',
            fieldChanged:  'Target status',
            previousValue: 'active',
            newValue:      'achieved',
            changeType:    'EDITED',
          })

          // Notify SENCO so they can review and confirm
          const [student, senco] = await Promise.all([
            prisma.user.findUnique({ where: { id: sub.studentId }, select: { firstName: true, lastName: true } }),
            prisma.user.findFirst({ where: { schoolId, role: 'SENCO' }, select: { id: true } }),
          ])
          if (student && senco) {
            const notifHref = `/send/ilp/${sub.studentId}`
            const alreadyNotified = await prisma.notification.findFirst({
              where: { schoolId, userId: senco.id, type: 'ILP_TARGET_ACHIEVED',
                linkHref: notifHref, createdAt: { gte: termStart } },
            })
            if (!alreadyNotified) {
              await prisma.notification.create({
                data: {
                  schoolId,
                  userId:   senco.id,
                  type:     'ILP_TARGET_ACHIEVED',
                  title:    `ILP target achieved: ${student.firstName} ${student.lastName}`,
                  body:     `An ILP target for ${student.firstName} ${student.lastName} has been automatically marked as achieved after ${progressCount} PROGRESS entries. Please review and confirm.`,
                  linkHref: notifHref,
                },
              })
            }
          }
        }
      }
    } catch {
      // Notification is best-effort; don't fail the evidence save
    }
  }

  revalidatePath(`/send/ilp/${sub.studentId}`)
  revalidatePath('/senco/early-warning')

  // Mark Plan Synthesis snapshot dirty — new evidence affects APDR cycle assessment
  void markDirty(sub.studentId, schoolId, [AgentType.PLAN_SYNTHESIS]).catch(() => {})
}

// ── Get ILP Evidence for Student ──────────────────────────────────────────────

export async function getIlpEvidenceForStudent(studentId: string): Promise<Array<{
  id: string; ilpTargetId: string; homeworkTitle: string; subject: string | null
  score: number | null; maxScore: number | null; evidenceType: string
  aiSummary: string | null; teacherNote: string | null; createdAt: Date
}>> {
  const { schoolId } = await requireAuth()

  return prisma.ilpEvidenceEntry.findMany({
    where: { studentId, schoolId },
    select: {
      id: true, ilpTargetId: true, homeworkTitle: true, subject: true,
      score: true, maxScore: true, evidenceType: true,
      aiSummary: true, teacherNote: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

// ── Get submissions available for ILP evidence linking ────────────────────────

export type SubmissionForEvidencing = {
  id:                  string
  homeworkId:          string
  title:               string
  subject:             string | null
  className:           string | null
  homeworkVariantType: string | null
  submittedAt:         Date
  grade:               string | null
  finalScore:          number | null
  linkedTargetIds:     string[]
}

export async function getStudentSubmissionsForEvidencing(studentId: string): Promise<SubmissionForEvidencing[]> {
  const { schoolId, role } = await requireAuth()
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN', 'TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR'].includes(role)) {
    throw new Error('Unauthorized')
  }

  const [submissions, evidenceEntries] = await Promise.all([
    prisma.submission.findMany({
      where:   { studentId, schoolId, status: 'RETURNED' },
      include: {
        homework: {
          select: {
            id: true, title: true, dueAt: true,
            homeworkVariantType: true,
            class: { select: { name: true, subject: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take:    50,
    }),
    prisma.ilpEvidenceEntry.findMany({
      where:  { studentId },
      select: { submissionId: true, ilpTargetId: true },
    }) as Promise<Array<{ submissionId: string | null; ilpTargetId: string }>>,
  ])

  const linkedMap = new Map<string, string[]>()
  for (const e of evidenceEntries) {
    if (!e.submissionId) continue
    const arr = linkedMap.get(e.submissionId) ?? []
    arr.push(e.ilpTargetId)
    linkedMap.set(e.submissionId, arr)
  }

  return submissions.map(s => ({
    id:                  s.id,
    homeworkId:          s.homeworkId,
    title:               s.homework.title,
    subject:             (s.homework as any).class?.subject ?? null,
    className:           (s.homework as any).class?.name ?? null,
    homeworkVariantType: (s.homework as any).homeworkVariantType ?? null,
    submittedAt:         s.submittedAt,
    grade:               s.grade,
    finalScore:          s.finalScore,
    linkedTargetIds:     linkedMap.get(s.id) ?? [],
  }))
}

// ── ILP Concerns This Term ────────────────────────────────────────────────────

export async function getIlpConcernsThisTerm(): Promise<Array<{
  id: string; firstName: string; lastName: string; yearGroup: number | null; concernCount: number
}>> {
  const { schoolId } = await requireAuth()

  const now = new Date()
  const currentTerm = await prisma.termDate.findFirst({
    where: { schoolId, startsAt: { lte: now }, endsAt: { gte: now } },
  })
  const termStart = currentTerm?.startsAt ?? new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000)

  const concerns = await prisma.ilpEvidenceEntry.groupBy({
    by: ['studentId'],
    where: { schoolId, evidenceType: 'CONCERN', createdAt: { gte: termStart } },
    _count: { studentId: true },
    having: { studentId: { _count: { gte: 3 } } },
  }) as Array<{ studentId: string; _count: { studentId: number } }>

  if (!concerns.length) return []

  const studentIds = concerns.map(c => c.studentId)
  const students = await prisma.user.findMany({
    where: { id: { in: studentIds }, schoolId },
    select: { id: true, firstName: true, lastName: true, yearGroup: true },
  })

  return students.map(s => {
    const entry = concerns.find(c => c.studentId === s.id)
    return { ...s, concernCount: entry?._count.studentId ?? 0 }
  })
}

// ── Grade calibration report (HOD moderation) ─────────────────────────────────

export type GradeCalibrationReport = {
  schoolMedian:   number
  teacherRows:    Array<{
    teacherId:    string
    teacherName:  string
    gradedCount:  number
    avgGrade:     number
    distribution: Record<string, number>  // grade "1"–"9" → count
    drift:        number                  // avgGrade − schoolMedian (positive = inflated)
  }>
}

/**
 * Returns per-teacher grade distribution vs school median for the current term.
 * Accessible to HEAD_OF_DEPT, SLT, SCHOOL_ADMIN only.
 */
export async function getGradeCalibrationReport(): Promise<GradeCalibrationReport> {
  const { schoolId, role } = await requireAuth()
  if (!['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN', 'PLATFORM_ADMIN'].includes(role)) {
    return { schoolMedian: 0, teacherRows: [] }
  }

  const now = new Date()
  const currentTerm = await prisma.termDate.findFirst({
    where: { schoolId, startsAt: { lte: now }, endsAt: { gte: now } },
  })
  const termStart = currentTerm?.startsAt ?? new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000)

  // Fetch all graded submissions this term that have a numeric grade
  const submissions = await prisma.submission.findMany({
    where: {
      schoolId,
      status:   'RETURNED',
      markedAt: { gte: termStart },
      grade:    { not: null },
    },
    select: {
      grade:    true,
      homework: { select: { createdBy: true } },
    },
  })

  // Parse grade to numeric — skip U / non-numeric
  const validGrades = ['1','2','3','4','5','6','7','8','9']
  const graded = submissions
    .map(s => ({ teacherId: s.homework.createdBy, grade: s.grade ?? '' }))
    .filter(s => validGrades.includes(s.grade))
    .map(s => ({ teacherId: s.teacherId, grade: parseInt(s.grade, 10) }))

  if (!graded.length) return { schoolMedian: 0, teacherRows: [] }

  // School-wide median
  const allGrades = graded.map(s => s.grade).sort((a, b) => a - b)
  const mid = Math.floor(allGrades.length / 2)
  const schoolMedian = allGrades.length % 2 === 0
    ? (allGrades[mid - 1] + allGrades[mid]) / 2
    : allGrades[mid]

  // Group by teacher
  const byTeacher = new Map<string, number[]>()
  for (const { teacherId, grade } of graded) {
    if (!byTeacher.has(teacherId)) byTeacher.set(teacherId, [])
    byTeacher.get(teacherId)!.push(grade)
  }

  // Fetch teacher names
  const teacherIds = [...byTeacher.keys()]
  const teachers = await prisma.user.findMany({
    where: { id: { in: teacherIds }, schoolId },
    select: { id: true, firstName: true, lastName: true },
  })
  const nameMap = new Map(teachers.map(t => [t.id, `${t.firstName} ${t.lastName}`]))

  const teacherRows = teacherIds.map(tid => {
    const grades = byTeacher.get(tid)!
    const avgGrade = grades.reduce((a, b) => a + b, 0) / grades.length
    const distribution: Record<string, number> = {}
    for (const g of validGrades) distribution[g] = 0
    for (const g of grades) distribution[String(g)]++
    return {
      teacherId:    tid,
      teacherName:  nameMap.get(tid) ?? 'Unknown',
      gradedCount:  grades.length,
      avgGrade:     Math.round(avgGrade * 10) / 10,
      distribution,
      drift:        Math.round((avgGrade - schoolMedian) * 10) / 10,
    }
  }).sort((a, b) => b.drift - a.drift)

  return { schoolMedian: Math.round(schoolMedian * 10) / 10, teacherRows }
}

// ── AI grade suggestion ────────────────────────────────────────────────────────

export async function suggestHomeworkGrade(
  submissionId: string,
): Promise<{ grade: string; rationale: string; feedback: string; confidence: 'high' | 'medium' | 'low' }> {
  const { role } = await requireAuth()
  if (!['TEACHER', 'HEAD_OF_DEPT'].includes(role)) {
    return { grade: '', rationale: 'Not authorized', feedback: '', confidence: 'low' as const }
  }

  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      content:  true,
      homework: {
        select: {
          title:        true,
          modelAnswer:  true,
          gradingBands: true,
          type:         true,
          class: { select: { subject: true, yearGroup: true, examBoard: true } },
        },
      },
    },
  })

  const fallback = { grade: '', rationale: 'No mark scheme available', feedback: '', confidence: 'low' as const }
  if (!sub?.homework.modelAnswer) return fallback

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return fallback

  const hw        = sub.homework
  const subject   = hw.class?.subject   ?? 'this subject'
  const year      = hw.class?.yearGroup ? `Year ${hw.class.yearGroup}` : 'GCSE'
  const examBoard = hw.class?.examBoard ?? 'AQA'
  const hwType    = hw.type ?? 'SHORT_ANSWER'

  const bandsText = hw.gradingBands
    ? Object.entries(hw.gradingBands as Record<string, string>)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    : null

  const lengthGuidance = (() => {
    switch (hwType) {
      case 'EXTENDED_WRITING':
        return 'This is an EXTENDED WRITING task. Grade 7–9 requires approximately 300–500 words with sustained analysis and a structured argument. A response under 100 words must not exceed Grade 3. A 1–2 sentence response warrants Grade 1–2.'
      case 'SHORT_ANSWER':
        return 'This is a SHORT ANSWER task. Analytical questions (higher-order) require 5–8 full sentences for Grade 7+. Factual recall questions may need only 2–3 sentences. A 1–2 sentence answer to an analytical question must not exceed Grade 3. Assess response length against the cognitive demand of each question.'
      case 'MIXED':
        return 'This is a MIXED assessment. Extended sections require sustained analysis (300+ words) for Grade 7+. Short factual questions may be answered concisely. A single-sentence response to an analytical section must not exceed Grade 3.'
      default:
        return 'Grade 7–9 requires depth, development, and subject-specific language. A 1–2 sentence response cannot merit Grade 7+ for questions requiring analysis or evaluation.'
    }
  })()

  const prompt = `You are an experienced UK secondary school teacher and examiner marking ${year} ${subject} homework for ${examBoard}.

## Task
Assign a GCSE grade (1–9) to the student submission below. Apply the same rigour as a public examination — do not inflate grades.

## Homework
${hw.title}

## Mark Scheme / Model Answer
${hw.modelAnswer}

${bandsText ? `## Grading Bands\n${bandsText}\n` : ''}
## GCSE Grade Standards (apply strictly)
- Grade 9 (A**): Exceptional; sophisticated analysis; precise subject vocabulary; all assessment objectives fully met.
- Grade 8 (A*): Outstanding analytical response; strong sustained argument; high-level language throughout.
- Grade 7 (A): Secure, well-structured analysis; clear line of argument; mostly accurate subject vocabulary.
- Grade 6 (B): Mostly secure; some analysis but may lack consistency or depth; generally accurate language.
- Grade 5 (C+): Partial analysis; relevant content but underdeveloped; some subject-specific language.
- Grade 4 (C): Basic understanding; description-level response; limited analytical development.
- Grade 3 (D): Limited understanding; mainly narrative or list; minimal subject vocabulary.
- Grade 2 (E): Very limited; largely irrelevant or inaccurate.
- Grade 1 (F): Minimal response; almost no demonstrable knowledge.
- U: Nothing written, or wholly irrelevant.

## Response Length Requirement (mandatory check before grading)
${lengthGuidance}

## Student Submission
${sub.content || '(no response submitted — award Grade 1 or U)'}

## Instructions
1. Estimate the word count of the student response.
2. Check whether that length is appropriate for the GCSE grade you are considering.
3. If the response is too brief for its cognitive demand, cap the grade accordingly — do not award Grade 7+ for analysis questions answered in 1–3 sentences.
4. Write feedback (3–4 sentences) directly to the student, referencing their specific answer.

Respond with ONLY valid JSON — no markdown:
{"grade": "7", "rationale": "One sentence: why this grade, referencing length and quality", "feedback": "3-4 sentence feedback written directly to the student", "confidence": "high"}`

  try {
    const client   = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    })
    const text      = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON in response')
    const parsed    = JSON.parse(jsonMatch[0])
    const valid     = ['9', '8', '7', '6', '5', '4', '3', '2', '1', 'U']
    if (!valid.includes(parsed.grade)) throw new Error('bad grade')
    return {
      grade:      parsed.grade,
      rationale:  String(parsed.rationale ?? '').slice(0, 300),
      feedback:   String(parsed.feedback ?? '').slice(0, 600),
      confidence: (['high', 'medium', 'low'] as const).includes(parsed.confidence) ? parsed.confidence : 'medium',
    }
  } catch {
    return fallback
  }
}

// ── Read-only submission detail for SENCO view ────────────────────────────────

export type SubmissionReadOnly = {
  content:      string
  grade:        string | null
  feedback:     string | null
  submittedAt:  string
  markedAt:     string | null
  instructions: string
  modelAnswer:  string | null
}

export async function getSubmissionReadOnly(
  submissionId: string,
): Promise<SubmissionReadOnly | null> {
  const { schoolId, role } = await requireAuth()

  const staffRoles = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN']
  if (!staffRoles.includes(role)) return null

  const sub = await prisma.submission.findFirst({
    where:  { id: submissionId, schoolId },
    select: {
      content:     true,
      grade:       true,
      feedback:    true,
      submittedAt: true,
      markedAt:    true,
      homework: {
        select: {
          instructions: true,
          modelAnswer:  true,
        },
      },
    },
  })
  if (!sub) return null

  return {
    content:      sub.content,
    grade:        sub.grade ?? null,
    feedback:     sub.feedback ?? null,
    submittedAt:  sub.submittedAt.toISOString(),
    markedAt:     sub.markedAt?.toISOString() ?? null,
    instructions: sub.homework.instructions,
    modelAnswer:  sub.homework.modelAnswer ?? null,
  }
}
