'use server'
import { auth }            from '@/lib/auth'
import { prisma }          from '@/lib/prisma'
import { revalidatePath }  from 'next/cache'
import { HomeworkType, HomeworkStatus } from '@prisma/client'
import Anthropic           from '@anthropic-ai/sdk'
import { updateLearningProfile } from '@/app/actions/adaptive-learning'

// ── List / fetch helpers ──────────────────────────────────────────────────────

export async function getHomeworkList() {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId } = session.user as any

  return prisma.homework.findMany({
    where: { schoolId, class: { teachers: { some: { userId } } } },
    include: {
      class:       { select: { name: true, subject: true, yearGroup: true } },
      lesson:      { select: { id: true, title: true } },
      submissions: { select: { id: true, status: true, finalScore: true } },
    },
    orderBy: { dueAt: 'asc' },
  })
}

export async function getHomeworkForMarking(homeworkId: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

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
      lesson:      { select: { id: true, title: true } },
      submissions: {
        include: { student: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, settings: { select: { profilePictureUrl: true } } } } },
        orderBy: { submittedAt: 'asc' },
      },
    },
  })
  if (!hw) return null

  const enrolledIds  = hw.class?.enrolments.map(e => e.user.id) ?? []
  const sendStatuses = enrolledIds.length
    ? await prisma.sendStatus.findMany({
        where:  { studentId: { in: enrolledIds }, NOT: { activeStatus: 'NONE' } },
        select: { studentId: true, activeStatus: true, needArea: true },
      })
    : []

  const sendByStudent = Object.fromEntries(sendStatuses.map(s => [s.studentId, s]))

  // K Plan teacher actions for each enrolled student (APPROVED only)
  const kPlans = enrolledIds.length
    ? await prisma.learnerPassport.findMany({
        where:  { studentId: { in: enrolledIds }, schoolId, status: 'APPROVED' },
        select: { studentId: true, teacherActions: true },
      })
    : []
  const kPlanByStudent = Object.fromEntries(kPlans.map(p => [p.studentId, { teacherActions: p.teacherActions }]))

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

  return { ...hwMerged, sendByStudent, kPlanByStudent }
}

export async function getSubmissionForMarking(submissionId: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

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
  const session = await auth()
  if (!session) return null
  const { schoolId, role } = session.user as { schoolId: string; role: string }

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
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId } = session.user as any

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
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId } = session.user as any

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
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId } = session.user as any

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

  revalidatePath('/dashboard')
  revalidatePath('/homework')
  return { id: hw.id }
}

// ── AI helpers ────────────────────────────────────────────────────────────────

export type MCQQuestion = {
  q:           string
  options:     [string, string, string, string]
  correct:     number       // 0–3 index into options[]
  explanation: string
}

export type SAQuestion = {
  q:                string
  modelAnswer:      string
  markScheme?:      string
  marks?:           number
  scaffolding_hint?: string
}

type ProposalResult = {
  type:            HomeworkType
  instructions:    string
  modelAnswer:     string
  gradingBands:    Record<string, string>
  targetWordCount: number
  questionsJson?:  { questions: MCQQuestion[] | SAQuestion[] }
}

/** Per-type JSON prompt suffix used in both generation functions. */
function buildTypePrompt(type: HomeworkType, subject: string, qualification: string): string {
  switch (type) {
    case 'MCQ_QUIZ':
      return `Generate exactly 8 multiple-choice questions directly testing the learning objectives above.
Each question must have exactly 4 options (A/B/C/D). Vary difficulty across the 8 questions.

Return this exact JSON structure (questionsJson is required):
{
  "type": "MCQ_QUIZ",
  "instructions": "Quiz: [short title]\\n\\n1. [Q1 text]\\nA. [opt]\\nB. [opt]\\nC. [opt]\\nD. [opt]\\n\\n2. ...",
  "modelAnswer": "1. B – [1-sentence explanation]\\n2. ...",
  "gradingBands": {},
  "targetWordCount": 0,
  "questionsJson": {
    "questions": [
      {"q": "Question text", "options": ["Option A", "Option B", "Option C", "Option D"], "correct": 1, "explanation": "Why B is correct"},
      ...
    ]
  }
}`

    case 'SHORT_ANSWER':
      return `Generate exactly 4 short-answer questions directly testing the learning objectives above.
Each question should require a 3–5 sentence response and include a detailed mark scheme.
For each question, also provide a scaffolding_hint: a short sentence starter or guided prompt to help students who need more support (e.g. "Think about... / Consider the role of... / Start with: The main reason was...").

Return this exact JSON structure (questionsJson is required):
{
  "type": "SHORT_ANSWER",
  "instructions": "Answer each question in full sentences.\\n\\n1. [Q1 text]\\n\\n2. ...",
  "modelAnswer": "Q1: [model answer]\\n\\nQ2: ...",
  "gradingBands": {"Low (1–3)": "...", "Mid (4–6)": "...", "High (7–9)": "..."},
  "targetWordCount": 0,
  "questionsJson": {
    "questions": [
      {"q": "Question text", "modelAnswer": "Full model answer for this question", "markScheme": "Award 1 mark for... Award 2 marks for...", "marks": 4, "scaffolding_hint": "Think about... / Start your answer with: The key event was..."},
      ...
    ]
  }
}`

    case 'EXTENDED_WRITING':
      return `Generate ONE extended writing question for ${qualification} ${subject} directly related to the learning objectives.
The question should require an analytical, structured response.

Return this exact JSON structure:
{
  "type": "EXTENDED_WRITING",
  "instructions": "[Clear, formal essay question]",
  "modelAnswer": "[250–350 word model response or structured essay plan with paragraph headings]",
  "gradingBands": {"Low (1–3)": "...", "Mid (4–6)": "...", "High (7–9)": "..."},
  "targetWordCount": 300,
  "questionsJson": null
}`

    case 'MIXED':
      return `Generate a mixed assessment: Part A = 3 short knowledge questions (2–3 sentences each), Part B = 1 extended question.
All questions must directly test the learning objectives.

Return this exact JSON structure:
{
  "type": "MIXED",
  "instructions": "Part A – Knowledge Questions\\n1. [Q1]\\n\\n2. [Q2]\\n\\n3. [Q3]\\n\\nPart B – Extended Response\\n[Essay question]",
  "modelAnswer": "Part A mark scheme:\\n1. [answer]\\n2. [answer]\\n3. [answer]\\n\\nPart B model answer:\\n[Extended response]",
  "gradingBands": {"Low (1–3)": "...", "Mid (4–6)": "...", "High (7–9)": "..."},
  "targetWordCount": 0,
  "questionsJson": null
}`

    case 'UPLOAD':
      return `Generate clear pupil-facing instructions for a practical or written task on paper that pupils will photograph and upload.
The task must relate directly to the learning objectives.

Return this exact JSON structure:
{
  "type": "UPLOAD",
  "instructions": "[Step-by-step instructions for what to complete and photograph]",
  "modelAnswer": "[Teacher marking notes — key points to look for, not shown to pupils]",
  "gradingBands": {},
  "targetWordCount": 0,
  "questionsJson": null
}`
  }
}

function defaultBands() {
  return {
    'Low (1–3)':  'Limited understanding; minimal use of subject vocabulary.',
    'Mid (4–6)':  'Developing understanding; relevant points with some appropriate vocabulary.',
    'High (7–9)': 'Secure understanding; well-structured response with accurate terminology.',
  }
}

function noApiKeyFallback(type: HomeworkType, lessonTitle: string, subject: string): ProposalResult {
  const placeholders: Record<HomeworkType, { instructions: string; modelAnswer: string }> = {
    MCQ_QUIZ: {
      instructions: `Quiz: ${lessonTitle}\n\n1. [Question 1]\nA. [Option A]\nB. [Option B]\nC. [Option C]\nD. [Option D]\n\n2. [Question 2]...`,
      modelAnswer: `1. B – [Add explanation]\n2. [Continue answer key...]`,
    },
    SHORT_ANSWER: {
      instructions: `Based on today's ${subject} lesson on "${lessonTitle}", answer the following questions:\n\n1. [Question 1]\n\n2. [Question 2]`,
      modelAnswer: `Q1: [Model answer for question 1]\n\nQ2: [Model answer for question 2]`,
    },
    EXTENDED_WRITING: {
      instructions: `[Essay question about ${lessonTitle}]`,
      modelAnswer: `[250–350 word model response or essay plan for "${lessonTitle}"]`,
    },
    MIXED: {
      instructions: `Part A – Knowledge Questions\n1. [Q1]\n2. [Q2]\n\nPart B – Extended Response\n[Essay/explanation question]`,
      modelAnswer: `Part A mark scheme:\n1. [Answer]\n2. [Answer]\n\nPart B model answer:\n[Extended response]`,
    },
    UPLOAD: {
      instructions: `Complete the following task and upload a clear photograph of your work:\n\n${lessonTitle} – [Describe task here]`,
      modelAnswer: `[Teacher marking notes — not visible to pupils]`,
    },
  }
  const questionsJson: ProposalResult['questionsJson'] =
    type === 'MCQ_QUIZ' ? {
      questions: [
        { q: `[Edit] Question 1 about "${lessonTitle}"`, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 0, explanation: '' },
        { q: `[Edit] Question 2 about "${lessonTitle}"`, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 1, explanation: '' },
        { q: `[Edit] Question 3 about "${lessonTitle}"`, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 2, explanation: '' },
      ] as MCQQuestion[],
    } :
    type === 'SHORT_ANSWER' ? {
      questions: [
        { q: `[Edit] Describe the key concepts from "${lessonTitle}".`,  modelAnswer: '[Add model answer]' },
        { q: `[Edit] Give an example related to "${lessonTitle}".`,       modelAnswer: '[Add model answer]' },
        { q: `[Edit] Explain why "${lessonTitle}" matters in ${subject}.`, modelAnswer: '[Add model answer]' },
      ] as SAQuestion[],
    } : undefined

  return {
    type,
    ...placeholders[type],
    gradingBands: type === 'MCQ_QUIZ' || type === 'UPLOAD' ? {} : defaultBands(),
    targetWordCount: type === 'EXTENDED_WRITING' ? 300 : 0,
    questionsJson,
  }
}

// ── Generate from lesson content (objectives + resources) ─────────────────────

export async function generateHomeworkFromResources(
  lessonId:  string,
  forceType?: HomeworkType,
): Promise<ProposalResult> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  const lesson = await prisma.lesson.findFirst({
    where:   { id: lessonId, schoolId },
    include: { resources: { orderBy: { createdAt: 'asc' } }, class: { select: { subject: true, yearGroup: true } } },
  })
  if (!lesson) throw new Error('Lesson not found')

  const subject       = lesson.class?.subject   ?? 'the subject'
  const yearGroup     = lesson.class?.yearGroup ?? 10
  const qualification = yearGroup <= 9 ? 'KS3' : yearGroup <= 11 ? 'GCSE' : 'A-Level'
  const examBoard     = (lesson as any).examBoard ?? ''
  const topic         = (lesson as any).topic ?? ''
  const type          = forceType ?? 'SHORT_ANSWER'

  console.log('[generateHomeworkFromResources] START lessonId:', lessonId, '| lesson:', lesson.title, '| resources:', lesson.resources.length, '| type:', type)
  if (lesson.resources.length > 0) {
    const r0 = lesson.resources[0]
    console.log('[generateHomeworkFromResources] first resource — type:', r0.type, '| label:', r0.label, '| url:', r0.url, '| oakContentId:', (r0 as any).oakContentId ?? 'none')
  } else {
    console.log('[generateHomeworkFromResources] WARNING: lesson has NO resources — will generate from title only')
  }

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
        select: { slug: true, title: true, pupilLessonOutcome: true },
      })
    : []
  const oakBySlug = Object.fromEntries(oakDetails.map(o => [o.slug, o]))

  // Include ALL resources as context (Oak LINK resources are the primary source material)
  const resourceContext = lesson.resources.length > 0
    ? lesson.resources.map(r => {
        if (r.oakContentId && oakBySlug[r.oakContentId]) {
          const oak = oakBySlug[r.oakContentId]
          return `  - [Oak Lesson] "${oak.title}"${oak.pupilLessonOutcome ? `\n      Learning outcome: ${oak.pupilLessonOutcome}` : ''}`
        }
        return `  - [${r.type}] "${r.label}"${r.url ? ` (${r.url})` : ''}`
      }).join('\n')
    : '  - No lesson resources attached'

  // Fetch SEND context for the lesson's class (best-effort — don't fail generation if this errors)
  let sendContextBlock = ''
  try {
    if (lesson.classId) {
      const [sendStatuses, ilpTargets] = await Promise.all([
        prisma.sendStatus.findMany({
          where: {
            student: { enrolments: { some: { classId: lesson.classId } } },
            NOT: { activeStatus: 'NONE' },
          },
          select: { activeStatus: true, needArea: true },
        }),
        prisma.ilpTarget.findMany({
          where: {
            status: 'active',
            ilp: { student: { enrolments: { some: { classId: lesson.classId } } } },
          },
          select: { target: true },
          take: 5,
        }),
      ])
      if (sendStatuses.length > 0) {
        const ehcpCount = sendStatuses.filter(s => s.activeStatus === 'EHCP').length
        const senCount  = sendStatuses.filter(s => s.activeStatus === 'SEN_SUPPORT').length
        const needAreas = [...new Set(sendStatuses.map(s => s.needArea).filter(Boolean))].slice(0, 5)
        sendContextBlock = `
CLASS SEND PROFILE
==================
This class has ${sendStatuses.length} student${sendStatuses.length !== 1 ? 's' : ''} with SEND needs (${ehcpCount > 0 ? `${ehcpCount} EHCP` : ''}${ehcpCount > 0 && senCount > 0 ? ', ' : ''}${senCount > 0 ? `${senCount} SEN Support` : ''}).${needAreas.length > 0 ? `\nNeed areas: ${needAreas.join(', ')}.` : ''}${ilpTargets.length > 0 ? `\nActive ILP targets include: ${ilpTargets.map(t => t.target).join('; ')}.` : ''}
The scaffolding_hint for each question should address these specific needs — use sentence starters, break the question into steps, or highlight key vocabulary to scaffold access for these students.
`
      }
    }
  } catch {
    // SEND fetch is best-effort; don't block generation
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return noApiKeyFallback(type, lesson.title, subject)

  const typePrompt = buildTypePrompt(type, subject, qualification)

  // When no objectives, base the task instruction on resources instead
  const taskInstruction = lesson.objectives.length > 0
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
${sendContextBlock}
TASK
====
${taskInstruction}

${typePrompt}`

  try {
    const client  = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 4000,
      system:     'You are a JSON API. Return ONLY valid JSON. No markdown. No code fences. No comments. In JSON string values, represent newlines as \\n — never use literal line breaks inside string values.',
      messages:   [{ role: 'user', content: prompt }],
    })
    const raw     = (message.content[0] as any).text.trim()
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

    console.log('[generateHomeworkFromResources] RAW AI RESPONSE (first 500):', cleaned.slice(0, 500))

    console.log('[generateHomeworkFromResources] RAW AI RESPONSE (first 600):', cleaned.slice(0, 600))

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
        console.log('[generateHomeworkFromResources] JSON repaired after literal-newline fix')
      } catch (parseErr) {
        console.error('[generateHomeworkFromResources] JSON parse FAILED (raw first 300):', cleaned.slice(0, 300))
        return noApiKeyFallback(type, lesson.title, subject)
      }
    }
    console.log('[generateHomeworkFromResources] PARSED KEYS:', Object.keys(parsed))
    console.log('[generateHomeworkFromResources] questionsJson?.questions length:', parsed.questionsJson?.questions?.length ?? 'MISSING')
    console.log('[generateHomeworkFromResources] root questions length:', parsed.questions?.length ?? 'MISSING')

    // Validate questionsJson for structured types
    const needsQuestions = type === 'MCQ_QUIZ' || type === 'SHORT_ANSWER'
    const hasQuestions   = parsed.questionsJson?.questions && Array.isArray(parsed.questionsJson.questions) && parsed.questionsJson.questions.length >= 3
    if (needsQuestions && !hasQuestions) {
      console.warn('[generateHomeworkFromResources] questionsJson missing or too short for', type, '— retrying')
      // Retry once with a more directive prompt
      const retryMsg = await client.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 4000,
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
      console.warn('[generateHomeworkFromResources] USING STUB FALLBACK — questionsJson still empty after retry for type:', type)
      const fallback = noApiKeyFallback(type, lesson.title, subject)
      questionsJson = fallback.questionsJson
    }

    return {
      type:            type,
      instructions:    parsed.instructions    ?? '',
      modelAnswer:     parsed.modelAnswer     ?? '',
      gradingBands:    parsed.gradingBands    ?? {},
      targetWordCount: parsed.targetWordCount ?? (type === 'EXTENDED_WRITING' ? 300 : 0),
      questionsJson,
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
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId },
    include: {
      resources: { select: { type: true, label: true, oakContentId: true } },
      class: { select: { subject: true, yearGroup: true } },
    },
  })
  if (!lesson) throw new Error('Lesson not found')

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
      model: 'claude-sonnet-4-20250514',
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
}): Promise<GeneratedHomeworkContent> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')

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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: 'You are a UK secondary school teacher creating homework content. Return ONLY valid JSON, no markdown fences.',
      messages: [{
        role: 'user',
        content: `Create ${qualification} ${input.subject} homework.
Type: ${input.homeworkVariantType}
Duration: ${input.durationMins} minutes
Bloom's level: ${input.bloomsLevel}
Objectives: ${input.learningObjectives.join('; ')}
Key topics: ${input.keyTopics.join(', ')}${sendNote}${ilpNote}

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
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  const sub = await prisma.submission.findFirst({
    where: { id: submissionId, schoolId },
    include: { homework: { select: { homeworkVariantType: true, structuredContent: true, title: true } } },
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
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          system: 'You are a UK teacher marking homework. Score each answer fairly against the model answer. Return ONLY JSON.',
          messages: [{
            role: 'user',
            content: `Mark these answers. Max total marks: ${maxScore}.\n\n${qaPairs}\n\nReturn: {"scores": [number per question], "totalScore": number, "feedback": "brief 2-sentence feedback"}`,
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
}) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

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

  void updateLearningProfile(sub.studentId).catch(() => {})

  revalidatePath('/homework')
  revalidatePath(`/homework/${sub.homeworkId}`)
  revalidatePath(`/homework/${sub.homeworkId}/mark/${submissionId}`)
  revalidatePath('/dashboard')
  revalidatePath('/', 'layout')
}

// ── Bulk auto-mark queue ──────────────────────────────────────────────────────

export async function bulkAutoMarkAndQueue(homeworkId: string): Promise<{
  queued: number
  alreadyMarked: number
}> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId } = session.user as any

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

/** Send a homework reminder notification to a student who hasn't submitted. */
export async function resendHomeworkReminder(homeworkId: string, studentId: string): Promise<{ ok: true }> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  const hw = await prisma.homework.findFirst({
    where:  { id: homeworkId, schoolId },
    select: { title: true, dueAt: true },
  })
  if (!hw) throw new Error('Homework not found')

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

  return { ok: true }
}
