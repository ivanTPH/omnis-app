'use server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'

export async function getStudentHomework(homeworkId: string) {
  const { schoolId, id: userId, role } = await requireAuth()
  if (role !== 'STUDENT') throw new Error('Forbidden')

  const [hw, sendStatusRecord] = await Promise.all([
    prisma.homework.findFirst({
      where: { id: homeworkId, schoolId, status: 'PUBLISHED' },
      select: {
        id:                  true,
        title:               true,
        instructions:        true,
        dueAt:               true,
        maxAttempts:         true,
        isAdapted:           true,
        type:                true,
        homeworkVariantType: true,
        structuredContent:   true,
        questionsJson:       true,
        gradingBands:        true,
        class: { select: { name: true, subject: true, yearGroup: true } },
        submissions: {
          where: { studentId: userId },
          select: {
            id:          true,
            content:     true,
            status:      true,
            grade:       true,
            feedback:    true,
            finalScore:  true,
            submittedAt: true,
            markedAt:    true,
          },
        },
      },
    }),
    prisma.sendStatus.findUnique({
      where:  { studentId: userId },
      select: { activeStatus: true },
    }),
  ])
  if (!hw) return null

  const submission = hw.submissions[0] ?? null
  const sendStatus = (sendStatusRecord?.activeStatus ?? 'NONE') as string

  // Only reveal model answer + grade context once work is returned
  let modelAnswer: string | null = null
  let classAvgScore: number | null = null
  let predictedGrade: number | null = null
  if (submission?.status === 'RETURNED') {
    const [full, avgResult, profile] = await Promise.all([
      prisma.homework.findUnique({ where: { id: homeworkId }, select: { modelAnswer: true } }),
      prisma.submission.aggregate({
        where: { homeworkId, schoolId, status: 'RETURNED', finalScore: { not: null } },
        _avg: { finalScore: true },
      }),
      prisma.studentLearningProfile.findUnique({
        where: { studentId: userId },
        select: { predictedGrade: true },
      }),
    ])
    modelAnswer = full?.modelAnswer ?? null
    classAvgScore = avgResult._avg.finalScore != null ? Math.round(avgResult._avg.finalScore) : null
    predictedGrade = profile?.predictedGrade ?? null
  }

  // Convert questionsJson → structuredContent.
  // questionsJson is used by LessonFolder/generateHomeworkFromResources;
  // structuredContent is used by HomeworkCreatorV2.
  let resolvedVariantType  = hw.homeworkVariantType
  let resolvedStructuredContent: unknown = hw.structuredContent

  if (!resolvedStructuredContent && hw.questionsJson) {
    const qj = hw.questionsJson as { questions?: any[] }
    if (Array.isArray(qj.questions) && qj.questions.length > 0) {
      const firstQ = qj.questions[0]
      // Detect type from question structure: has options → MCQ/quiz; no options → short_answer
      const hasOptions = Array.isArray(firstQ?.options) && firstQ.options.length > 0
      const isQuiz = hasOptions || hw.type === 'MCQ_QUIZ' || resolvedVariantType === 'quiz' || resolvedVariantType === 'multiple_choice'
      if (isQuiz) {
        resolvedVariantType = 'quiz'
        resolvedStructuredContent = {
          questions: qj.questions.map((q: any, i: number) => ({
            id:               String(i + 1),
            question:         q.q ?? q.question ?? '',
            options:          q.options,
            // NOTE: 'correct' and 'explanation' intentionally omitted — never expose answers to students
            marks:            q.marks ?? 1,
            scaffolding_hint: q.scaffolding_hint,
            ehcp_adaptation:  q.ehcp_adaptation,
            vocab_support:    q.vocab_support,
          })),
        }
      } else {
        resolvedVariantType = 'short_answer'
        resolvedStructuredContent = {
          questions: qj.questions.map((q: any, i: number) => ({
            id:               q.id ?? String(i + 1),
            question:         q.q ?? q.question ?? '',
            marks:            q.marks ?? 1,
            hint:             q.hint ?? null,
            scaffolding_hint: q.scaffolding_hint,
            ehcp_adaptation:  q.ehcp_adaptation,
            vocab_support:    q.vocab_support,
            // NOTE: modelAnswer and markScheme intentionally omitted — never expose answers to students
          })),
        }
      }
    }
  }

  // Normalise variant type: DB may store uppercase enum values (MCQ_QUIZ, SHORT_ANSWER)
  // which don't match the renderer's switch cases (quiz, short_answer, etc.)
  const VARIANT_MAP: Record<string, string> = {
    MCQ_QUIZ:          'quiz',
    SHORT_ANSWER:      'short_answer',
    EXTENDED_WRITING:  'extended_writing',
    MIXED:             'short_answer',
    UPLOAD:            'upload',
  }
  if (resolvedVariantType && VARIANT_MAP[resolvedVariantType]) {
    resolvedVariantType = VARIANT_MAP[resolvedVariantType]
  }
  // If still null but structuredContent has questions, infer type from first question shape
  if (!resolvedVariantType && resolvedStructuredContent) {
    const sc = resolvedStructuredContent as { questions?: unknown[] }
    if (Array.isArray(sc.questions) && sc.questions.length > 0) {
      const firstQ = sc.questions[0] as { options?: unknown[] } | undefined
      resolvedVariantType = (Array.isArray(firstQ?.options) && firstQ.options.length > 0)
        ? 'quiz'
        : 'short_answer'
    }
  }

  const { questionsJson: _qj, type: _type, gradingBands, ...hwRest } = hw
  return {
    ...hwRest,
    homeworkVariantType: resolvedVariantType,
    structuredContent:   resolvedStructuredContent,
    gradingBands,
    submission,
    modelAnswer,
    sendStatus,
    classAvgScore,
    predictedGrade,
  }
}

export async function submitHomework(homeworkId: string, content: string) {
  const { schoolId, id: userId, role } = await requireAuth()
  if (role !== 'STUDENT') throw new Error('Forbidden')

  const hw = await prisma.homework.findFirst({
    where: { id: homeworkId, schoolId, status: 'PUBLISHED' },
  })
  if (!hw) throw new Error('Homework not found')

  const saved = await prisma.submission.upsert({
    where: { homeworkId_studentId: { homeworkId, studentId: userId } },
    create: {
      homeworkId,
      studentId:  userId,
      schoolId,
      content:    content.trim(),
      status:     'SUBMITTED',
    },
    update: {
      content:     content.trim(),
      status:      'SUBMITTED',
      submittedAt: new Date(),
      // Clear previous marking data when student resubmits
      markedAt:    null,
      finalScore:  null,
      teacherScore: null,
      grade:       null,
      feedback:    null,
    },
  })

  // Fire SEND risk screen asynchronously — never blocks or delays the submission
  void screenSendRisk(saved.id, content.trim(), homeworkId, schoolId, userId).catch(() => {})

  revalidatePath(`/student/homework/${homeworkId}`)
  revalidatePath('/student/dashboard')
}

// ── SEND risk screen (2A + 2B) ────────────────────────────────────────────────
//
// Fires after the submission is saved. Analyses the content via a short Claude
// call (max_tokens 200) for three signals:
//   • spelling_concern       — likely spelling/phonological difficulties
//   • engagement_level       — low / medium / high
//   • response_completeness  — 0–100
//
// Score formula (max 100):
//   spelling_concern true      → +25
//   engagement low/medium/high → +40 / +20 / 0
//   completeness gap × 0.35   → up to +35
//
// If score > 60 → Notification for class teacher(s) + school SENCO (deduped).

async function screenSendRisk(
  submissionId: string,
  content:      string,
  homeworkId:   string,
  schoolId:     string,
  studentId:    string,
) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return

  // Fetch homework title + class teachers for notification targeting
  const hw = await prisma.homework.findFirst({
    where: { id: homeworkId },
    select: {
      id:      true,
      title:   true,
      classId: true,
      class: { select: { teachers: { select: { userId: true } } } },
    },
  })
  if (!hw) return

  const student = await prisma.user.findFirst({
    where:  { id: studentId },
    select: { firstName: true, lastName: true },
  })
  if (!student) return

  // ── 1. Claude SEND screen (max_tokens: 200) ──────────────────────────────
  let sendRiskScore = 0
  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: 'You are a UK SEND specialist. Analyse homework submissions for learning support signals. Respond ONLY with valid JSON — no explanation, no markdown.',
      messages: [{
        role:    'user',
        content: `Analyse this homework submission for SEND risk signals.
Return ONLY valid JSON with these exact keys:
{"spelling_concern": boolean, "engagement_level": "low"|"medium"|"high", "response_completeness": 0-100}

Submission: "${content.slice(0, 800)}"`,
      }],
    })

    const raw    = (msg.content[0] as { type: string; text: string }).text.trim()
    const match  = raw.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : {}

    const spellScore = parsed.spelling_concern === true ? 25 : 0
    const engMap: Record<string, number> = { low: 40, medium: 20, high: 0 }
    const engScore   = engMap[parsed.engagement_level as string] ?? 0
    const compGap    = Math.max(0, 100 - (typeof parsed.response_completeness === 'number' ? parsed.response_completeness : 100))
    const compScore  = Math.round(compGap * 0.35)
    sendRiskScore    = Math.min(100, spellScore + engScore + compScore)
  } catch {
    return // Claude unavailable — skip silently, submission already saved
  }

  // ── 2. Store score on submission (2A) ────────────────────────────────────
  await prisma.submission.update({
    where: { id: submissionId },
    data:  { sendRiskScore },
  })

  // ── 3. Notify teacher(s) + SENCO when score exceeds threshold (2B) ───────
  if (sendRiskScore <= 60) return

  const studentName = `${student.firstName} ${student.lastName}`
  const body        = `Possible SEND need detected in ${studentName}'s submission for "${hw.title}". Review their work.`
  const linkHref    = `/homework/${hw.id}/mark/${submissionId}`

  const recipientIds = new Set<string>()
  if (hw.class?.teachers) {
    for (const t of hw.class.teachers) recipientIds.add(t.userId)
  }
  const senco = await prisma.user.findFirst({
    where:  { schoolId, role: 'SENCO' },
    select: { id: true },
  })
  if (senco) recipientIds.add(senco.id)

  for (const userId of recipientIds) {
    // Deduplication — don't fire twice for the same submission link
    const exists = await prisma.notification.findFirst({
      where: { schoolId, userId, type: 'SUBMISSION_FLAGGED', linkHref },
    })
    if (exists) continue

    await prisma.notification.create({
      data: {
        schoolId,
        userId,
        type:     'SUBMISSION_FLAGGED',
        title:    'Possible SEND need detected',
        body,
        linkHref,
      },
    })
  }
}

// ── Student SEND support profile (own view) ───────────────────────────────────

export type StudentSupportProfile = {
  sendStatus:      'NONE' | 'SEN_SUPPORT' | 'EHCP'
  needArea:        string | null
  supportSnapshot: string | null
  ilp: {
    id:           string
    areasOfNeed: string
    targets:      { id: string; target: string; strategy: string; status: string; targetDate: string }[]
  } | null
  ehcp: {
    id:            string
    localAuthority: string
    reviewDate:    string
    outcomes:      { id: string; outcomeText: string; status: string; section: string }[]
  } | null
  sencoName: string | null
}

export async function getStudentSupportProfile(): Promise<StudentSupportProfile> {
  const { schoolId, id: userId, role } = await requireAuth()
  if (role !== 'STUDENT') throw new Error('Forbidden')

  const [sendStatus, ilp, ehcp, senco, userRecord] = await Promise.all([
    prisma.sendStatus.findUnique({
      where:  { studentId: userId },
      select: { activeStatus: true, needArea: true },
    }),
    prisma.individualLearningPlan.findFirst({
      where:   { studentId: userId, schoolId, approvedBySenco: true, status: { not: 'archived' } },
      orderBy: { updatedAt: 'desc' },
      select:  {
        id: true, areasOfNeed: true,
        targets: {
          where:  { status: { in: ['active', 'deferred'] } },
          select: { id: true, target: true, strategy: true, status: true, targetDate: true },
          orderBy: { targetDate: 'asc' },
        },
      },
    }),
    prisma.ehcpPlan.findFirst({
      where:   { studentId: userId, schoolId, status: 'active', approvedBySenco: true },
      orderBy: { createdAt: 'desc' },
      select:  {
        id: true, localAuthority: true, reviewDate: true,
        outcomes: {
          where:  { status: { in: ['active', 'partially_achieved'] } },
          select: { id: true, outcomeText: true, status: true, section: true },
          orderBy: { section: 'asc' },
          take: 10,
        },
      },
    }),
    prisma.user.findFirst({
      where:  { schoolId, role: 'SENCO', isActive: true },
      select: { firstName: true, lastName: true },
    }),
    prisma.user.findUnique({
      where:  { id: userId },
      select: { supportSnapshot: true },
    }),
  ])

  return {
    sendStatus:      (sendStatus?.activeStatus ?? 'NONE') as 'NONE' | 'SEN_SUPPORT' | 'EHCP',
    needArea:        sendStatus?.needArea ?? null,
    supportSnapshot: userRecord?.supportSnapshot ?? null,
    ilp: ilp ? {
      id:           ilp.id,
      areasOfNeed: ilp.areasOfNeed,
      targets:      ilp.targets.map(t => ({
        id:         t.id,
        target:     t.target,
        strategy:   t.strategy,
        status:     t.status,
        targetDate: t.targetDate.toISOString(),
      })),
    } : null,
    ehcp: ehcp ? {
      id:             ehcp.id,
      localAuthority: ehcp.localAuthority,
      reviewDate:     ehcp.reviewDate.toISOString(),
      outcomes:       ehcp.outcomes.map(o => ({
        id:          o.id,
        outcomeText: o.outcomeText,
        status:      o.status,
        section:     o.section,
      })),
    } : null,
    sencoName: senco ? `${senco.firstName} ${senco.lastName}` : null,
  }
}

// ── Grade history ─────────────────────────────────────────────────────────────

export type GradeHistorySubmission = {
  homeworkId:   string
  title:        string
  subject:      string
  className:    string
  dueAt:        string
  markedAt:     string
  finalScore:   number
  maxScore:     number
  pct:          number          // 0-100
  gcseGrade:    number          // 1-9
  feedback:     string | null
  homeworkType: string | null   // MCQ_QUIZ | SHORT_ANSWER | EXTENDED_WRITING | UPLOAD | MIXED
}

export type TopicWeakness = {
  topic:      string   // derived from homework title keywords
  avgGrade:   number   // GCSE 1-9
  count:      number
}

export type TopicSummary = {
  topic:    string
  avgGrade: number   // GCSE 1-9
  count:    number
  isWeak:   boolean
}

export type FormatBreakdown = {
  type:     string   // MCQ_QUIZ | SHORT_ANSWER | EXTENDED_WRITING | UPLOAD | MIXED
  label:    string
  avgGrade: number
  count:    number
}

export type AdaptiveProfileSummary = {
  profileSummary:     string | null
  preferredTypes:     string[]
  strengthAreas:      string[]
  developmentAreas:   string[]
  workingAtGrade:     number | null
  predictedGrade:     number | null
}

export type SubjectGradeSummary = {
  subject:          string
  avgGrade:         number       // GCSE 1-9
  submissions:      GradeHistorySubmission[]
  predictedGrade:   number | null // GCSE 1-9 from TeacherPrediction or StudentBaseline
  weakTopics:       TopicWeakness[]   // topics with grade < subject avg
  allTopics:        TopicSummary[]    // all topics (for heatmap)
  formatBreakdown:  FormatBreakdown[] // avg grade per homework type
  adaptiveProfile?: AdaptiveProfileSummary
}

export async function getStudentGradeHistory(): Promise<SubjectGradeSummary[]> {
  const { schoolId, id: userId, role } = await requireAuth()
  if (role !== 'STUDENT') throw new Error('Forbidden')

  const { percentToGcseGrade } = await import('@/lib/grading')

  function maxFromBands(bands: unknown): number {
    if (!bands || typeof bands !== 'object') return 9
    const keys = Object.keys(bands as Record<string, string>)
    const nums = keys.flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n)))
    return nums.length ? Math.max(...nums) : 9
  }

  const [submissions, baselines, predictions, learningProfile] = await Promise.all([
    prisma.submission.findMany({
      where: {
        studentId: userId,
        finalScore: { not: null },
        status: { in: ['MARKED', 'RETURNED'] },
        homework: { schoolId },
      },
      select: {
        id: true, finalScore: true, feedback: true, markedAt: true,
        homework: {
          select: {
            id: true, title: true, dueAt: true, gradingBands: true, type: true,
            class: { select: { name: true, subject: true } },
          },
        },
      },
      orderBy: { markedAt: 'desc' },
    }),
    prisma.studentBaseline.findMany({
      where: { studentId: userId, schoolId },
      select: { subject: true, baselineScore: true },
    }),
    prisma.teacherPrediction.findMany({
      where: { studentId: userId, schoolId },
      select: { subject: true, predictedScore: true, adjustment: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.studentLearningProfile.findUnique({
      where: { studentId: userId },
      select: {
        profileSummary: true, preferredTypes: true,
        strengthAreas: true, developmentAreas: true,
        workingAtGrade: true, predictedGrade: true,
      },
    }).catch(() => null),
  ])

  const baselineMap = new Map(baselines.map(b => [b.subject, b.baselineScore]))
  // Latest prediction per subject
  const predMap = new Map<string, number>()
  for (const p of predictions) {
    if (!predMap.has(p.subject)) predMap.set(p.subject, p.predictedScore + p.adjustment)
  }

  const bySubject = new Map<string, GradeHistorySubmission[]>()
  for (const sub of submissions) {
    const hw     = sub.homework
    const subj   = hw.class.subject
    const max    = maxFromBands(hw.gradingBands)
    const pct    = Math.min(100, Math.round(((sub.finalScore ?? 0) / max) * 100))
    const grade  = percentToGcseGrade(pct)
    const entry: GradeHistorySubmission = {
      homeworkId:   hw.id,
      title:        hw.title,
      subject:      subj,
      className:    hw.class.name,
      dueAt:        hw.dueAt.toISOString(),
      markedAt:     sub.markedAt?.toISOString() ?? hw.dueAt.toISOString(),
      finalScore:   sub.finalScore ?? 0,
      maxScore:     max,
      pct,
      gcseGrade:    grade,
      feedback:     sub.feedback ?? null,
      homeworkType: hw.type ?? null,
    }
    if (!bySubject.has(subj)) bySubject.set(subj, [])
    bySubject.get(subj)!.push(entry)
  }

  // Build adaptive profile summary (shared across all subjects)
  const adaptiveProfile: AdaptiveProfileSummary | undefined = learningProfile ? {
    profileSummary:   learningProfile.profileSummary ?? null,
    preferredTypes:   (learningProfile.preferredTypes as string[]) ?? [],
    strengthAreas:    (learningProfile.strengthAreas as string[]) ?? [],
    developmentAreas: (learningProfile.developmentAreas as string[]) ?? [],
    workingAtGrade:   learningProfile.workingAtGrade ?? null,
    predictedGrade:   learningProfile.predictedGrade ?? null,
  } : undefined

  const result: SubjectGradeSummary[] = []
  for (const [subject, subs] of bySubject.entries()) {
    const avgGrade   = Math.round(subs.reduce((a, s) => a + s.gcseGrade, 0) / subs.length)
    const predScore  = predMap.get(subject) ?? baselineMap.get(subject) ?? null
    const predicted  = predScore != null ? percentToGcseGrade(predScore) : null

    // Detect topics: group by title keywords (first 4 words)
    const topicMap = new Map<string, number[]>()
    for (const sub of subs) {
      const topic = sub.title.split(/\s+/).slice(0, 4).join(' ')
      if (!topicMap.has(topic)) topicMap.set(topic, [])
      topicMap.get(topic)!.push(sub.gcseGrade)
    }
    const allTopics: TopicSummary[] = []
    const weakTopics: TopicWeakness[] = []
    for (const [topic, grades] of topicMap.entries()) {
      const topicAvg = Math.round(grades.reduce((a, b) => a + b, 0) / grades.length)
      const isWeak = topicAvg < avgGrade || topicAvg <= 4
      allTopics.push({ topic, avgGrade: topicAvg, count: grades.length, isWeak })
      if (isWeak) weakTopics.push({ topic, avgGrade: topicAvg, count: grades.length })
    }
    allTopics.sort((a, b) => a.avgGrade - b.avgGrade)
    weakTopics.sort((a, b) => a.avgGrade - b.avgGrade)

    // Format breakdown: group by homework type
    const FORMAT_LABELS: Record<string, string> = {
      MCQ_QUIZ:         'Quiz (MCQ)',
      SHORT_ANSWER:     'Short Answer',
      EXTENDED_WRITING: 'Extended Writing',
      UPLOAD:           'Upload',
      MIXED:            'Mixed',
    }
    const fmtMap = new Map<string, number[]>()
    for (const sub of subs) {
      const t = sub.homeworkType ?? 'SHORT_ANSWER'
      if (!fmtMap.has(t)) fmtMap.set(t, [])
      fmtMap.get(t)!.push(sub.gcseGrade)
    }
    const formatBreakdown: FormatBreakdown[] = []
    for (const [type, grades] of fmtMap.entries()) {
      if (grades.length === 0) continue
      formatBreakdown.push({
        type,
        label:    FORMAT_LABELS[type] ?? type,
        avgGrade: Math.round(grades.reduce((a, b) => a + b, 0) / grades.length),
        count:    grades.length,
      })
    }
    formatBreakdown.sort((a, b) => b.avgGrade - a.avgGrade)

    result.push({ subject, avgGrade, submissions: subs, predictedGrade: predicted, weakTopics, allTopics, formatBreakdown, adaptiveProfile })
  }

  return result.sort((a, b) => a.subject.localeCompare(b.subject))
}

// ── Topic self-assessment ─────────────────────────────────────────────────────

export async function saveTopicConfidence(
  homeworkId: string,
  confidence:  number,   // 1–5
): Promise<{ success: true } | { error: string }> {
  const { id: studentId, role } = await requireAuth()
  if (role !== 'STUDENT') return { error: 'Forbidden' }
  if (confidence < 1 || confidence > 5) return { error: 'Confidence must be 1–5' }

  // Get the homework to extract subject + title (used as topic)
  const hw = await prisma.homework.findFirst({
    where:  { id: homeworkId },
    select: {
      title: true,
      class: { select: { subject: true } },
      submissions: {
        where:  { studentId },
        select: { status: true },
        take:   1,
      },
    },
  })
  if (!hw) return { error: 'Homework not found' }

  // Only allow self-assessment on returned work
  if (hw.submissions[0]?.status !== 'RETURNED') return { error: 'Homework not yet returned' }

  const subject = hw.class?.subject ?? 'General'
  const topic   = hw.title

  // Upsert: one row per (studentId, subject, topic)
  const existing = await prisma.revisionConfidence.findFirst({
    where:  { studentId, subject, topic },
    select: { id: true },
  })

  if (existing) {
    await prisma.revisionConfidence.update({
      where: { id: existing.id },
      data:  { confidence, assessedAt: new Date() },
    })
  } else {
    await prisma.revisionConfidence.create({
      data: { studentId, subject, topic, confidence },
    })
  }

  revalidatePath(`/student/homework/${homeworkId}`)
  return { success: true }
}
