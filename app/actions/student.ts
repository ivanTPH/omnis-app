'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'

export async function getStudentHomework(homeworkId: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId, role } = session.user as any
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

  // Only reveal model answer once work is returned
  let modelAnswer: string | null = null
  if (submission?.status === 'RETURNED') {
    const full = await prisma.homework.findUnique({
      where: { id: homeworkId },
      select: { modelAnswer: true },
    })
    modelAnswer = full?.modelAnswer ?? null
  }

  // Convert questionsJson → structuredContent when homework was created via LessonFolder
  // (LessonFolder stores AI questions in questionsJson, not structuredContent)
  let resolvedVariantType  = hw.homeworkVariantType
  let resolvedStructuredContent: unknown = hw.structuredContent

  if (!resolvedStructuredContent && hw.questionsJson) {
    const qj = hw.questionsJson as { questions?: any[] }
    if (Array.isArray(qj.questions) && qj.questions.length > 0) {
      if (hw.type === 'SHORT_ANSWER') {
        resolvedVariantType = 'short_answer'
        resolvedStructuredContent = {
          questions: qj.questions.map((q: any, i: number) => ({
            id:               String(i + 1),
            question:         q.q ?? q.question ?? '',
            marks:            q.marks,
            scaffolding_hint: q.scaffolding_hint,
            ehcp_adaptation:  q.ehcp_adaptation,
            vocab_support:    q.vocab_support,
          })),
        }
      } else if (hw.type === 'MCQ_QUIZ') {
        resolvedVariantType = 'quiz'
        resolvedStructuredContent = {
          questions: qj.questions.map((q: any, i: number) => ({
            id:      String(i + 1),
            question: q.q ?? q.question ?? '',
            options:  q.options,
            marks:    q.marks,
          })),
        }
      }
    }
  }

  const { questionsJson: _qj, type: _type, ...hwRest } = hw
  return {
    ...hwRest,
    homeworkVariantType: resolvedVariantType,
    structuredContent:   resolvedStructuredContent,
    submission,
    modelAnswer,
    sendStatus,
  }
}

export async function submitHomework(homeworkId: string, content: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId, role } = session.user as any
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
