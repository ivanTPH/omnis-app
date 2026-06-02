/**
 * lib/agents/quality.ts
 *
 * Quality Agent — Homework Content Quality Reviewer
 *
 * Analyses recently marked homework submissions for a student to evaluate:
 *   1. Bloom's distribution — are questions pitched at the right cognitive level?
 *   2. Curriculum alignment — do objectives map to NC / syllabus attainment targets?
 *   3. SEND differentiation — was adaptation meaningful for SEND students?
 *   4. Marking consistency — does the teacher grade align with the mark scheme?
 *   5. Feedback quality — is feedback specific, actionable, forward-looking?
 *
 * Produces a QualityKnowledge snapshot per student and notifies class teachers
 * when marking/feedback issues are detected, or SENCO when SEND adaptation
 * quality falls below threshold.
 *
 * Design principles:
 *   - Single haiku call per student (all 5 dimensions batched into one prompt)
 *   - Delta mode: only processes submissions marked since lastRunAt
 *   - MCQ submissions skipped for marking consistency (unambiguous right/wrong)
 *   - Guardrail: never overrides teacher grades — recommendations only
 *
 * Skills used:
 *   BLOOMS_ANALYSIS, CURRICULUM_ALIGNMENT, SEND_DIFFERENTIATION,
 *   MARKING_CONSISTENCY, FEEDBACK_QUALITY
 *
 * Standards:
 *   Anderson & Krathwohl (2001) · DfE NC 2014 · Equality Act 2010 s.20
 *   DfE SEND CoP 2015 · Ofqual Marking Standards 2023 · EEF 2021
 *   Hattie & Timperley (2007)
 */

import Anthropic                 from '@anthropic-ai/sdk'
import { AgentType, AgentSkillId } from '@prisma/client'
import { prisma, writeAudit }    from '@/lib/prisma'
import {
  getSnapshot, saveSnapshot, inOneWeek,
  type QualityKnowledge,
} from './snapshot'
import {
  BLOOMS_ANALYSIS_SKILL,
  CURRICULUM_ALIGNMENT_SKILL,
  SEND_DIFFERENTIATION_SKILL,
  MARKING_CONSISTENCY_SKILL,
  FEEDBACK_QUALITY_SKILL,
  assertSkillPermitted,
  ALL_STANDARDS,
} from './skills'

// ── Constants ─────────────────────────────────────────────────────────────────

const LOOK_BACK_DAYS         = 90   // first-run window
const MAX_SUBMISSIONS        = 10   // max submissions to review per run
const SEND_ADAPTATION_WARN   = 50   // notify SENCO if adaptation score below this
const MARKING_WARN_LEVELS    = new Set(['MODERATE', 'MAJOR'])

// ── Types ─────────────────────────────────────────────────────────────────────

type SubmissionForReview = {
  id:               string
  finalScore:       number | null
  autoScore:        number | null
  teacherScore:     number | null
  teacherScoreReason: string | null
  feedback:         string | null
  autoFeedback:     string | null
  markedAt:         Date | null
  autoMarked:       boolean
  homework: {
    id:                  string
    title:               string
    type:                string
    learningObjectives:  string[]
    bloomsLevel:         string | null
    differentiationNotes: string | null
    isAdapted:           boolean
    gradingBands:        unknown
    questionsJson:       unknown
    modelAnswer:         string | null
    class: {
      subject:    string
      yearGroup:  number | null
      teachers:   Array<{ userId: string }>
    } | null
  }
}

type StudentQualityData = {
  student: {
    id:         string
    firstName:  string
    lastName:   string
    sendStatus: string | null
    needArea:   string | null
  }
  submissions:  SubmissionForReview[]
  sencoIds:     string[]
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchQualityData(
  studentId: string,
  schoolId:  string,
  since:     Date,
): Promise<StudentQualityData> {
  const [student, submissions, sencos] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: studentId },
      select: {
        id: true, firstName: true, lastName: true,
        sendStatus: { select: { activeStatus: true, needArea: true } },
      },
    }),
    prisma.submission.findMany({
      where: {
        studentId,
        schoolId,
        markedAt:   { gte: since },
        finalScore: { not: null },
      },
      select: {
        id:                 true,
        finalScore:         true,
        autoScore:          true,
        teacherScore:       true,
        teacherScoreReason: true,
        feedback:           true,
        autoFeedback:       true,
        markedAt:           true,
        autoMarked:         true,
        homework: {
          select: {
            id:                   true,
            title:                true,
            type:                 true,
            learningObjectives:   true,
            bloomsLevel:          true,
            differentiationNotes: true,
            isAdapted:            true,
            gradingBands:         true,
            questionsJson:        true,
            modelAnswer:          true,
            class: {
              select: {
                subject:  true,
                yearGroup: true,
                teachers: { select: { userId: true } },
              },
            },
          },
        },
      },
      orderBy: { markedAt: 'desc' },
      take:    MAX_SUBMISSIONS,
    }),
    // Find SENCO users for this school to notify on SEND issues
    prisma.user.findMany({
      where:  { schoolId, role: 'SENCO', isActive: true },
      select: { id: true },
    }),
  ])

  if (!student) throw new Error(`Student ${studentId} not found`)

  return {
    student: {
      id:         student.id,
      firstName:  student.firstName,
      lastName:   student.lastName,
      sendStatus: student.sendStatus?.activeStatus ?? null,
      needArea:   student.sendStatus?.needArea ?? null,
    },
    submissions: submissions as SubmissionForReview[],
    sencoIds:    sencos.map(s => s.id),
  }
}

// ── Extract question texts from questionsJson ─────────────────────────────────

function extractQuestions(questionsJson: unknown): string[] {
  if (!questionsJson) return []
  const arr = Array.isArray(questionsJson)
    ? questionsJson
    : (questionsJson as { questions?: unknown[] }).questions ?? []
  return (arr as Record<string, unknown>[])
    .map(q => ((q.prompt ?? q.question ?? '') as string).trim())
    .filter(Boolean)
}

// ── Build compact review payload for haiku ────────────────────────────────────

function buildReviewPayload(data: StudentQualityData) {
  return {
    student: {
      sendStatus: data.student.sendStatus,
      needArea:   data.student.needArea,
    },
    submissions: data.submissions.map(s => ({
      id:                  s.id,
      homeworkTitle:       s.homework.title,
      type:                s.homework.type,
      subject:             s.homework.class?.subject ?? 'Unknown',
      yearGroup:           s.homework.class?.yearGroup ?? null,
      learningObjectives:  s.homework.learningObjectives,
      bloomsLevelDeclared: s.homework.bloomsLevel,
      questions:           extractQuestions(s.homework.questionsJson).slice(0, 5),
      modelAnswer:         s.homework.modelAnswer?.slice(0, 200) ?? null,
      differentiationNotes: s.homework.differentiationNotes,
      isAdapted:           s.homework.isAdapted,
      teacherGrade:        s.teacherScore,
      autoGrade:           s.autoScore,
      finalGrade:          s.finalScore,
      teacherFeedback:     s.feedback ?? s.autoFeedback,
      autoMarked:          s.autoMarked,
    })),
  }
}

// ── Single haiku call — all 5 quality dimensions ──────────────────────────────

type QualityAnalysis = {
  bloomsBalance:       Record<string, number>  // level → question count
  curriculumIssues:    string[]
  sendAdaptationScore: number                  // 0–100
  sendAdaptationIssues: string[]
  markingIssues:       Array<{ submissionId: string; discrepancyLevel: string; summary: string }>
  feedbackIssues:      Array<{ submissionId: string; overallScore: number; flags: string[] }>
  allIssues:           string[]
  summaryNarrative:    string
  lastCheckedHomeworkId: string
}

async function runQualityAnalysis(data: StudentQualityData): Promise<QualityAnalysis | null> {
  if (data.submissions.length === 0) return null

  const apiKey = process.env.ANTHROPIC_API_KEY
  const lastSub = data.submissions[0]

  if (!apiKey) {
    // Graceful no-API fallback — return minimal structure
    return {
      bloomsBalance:        {},
      curriculumIssues:     [],
      sendAdaptationScore:  data.student.sendStatus ? 60 : 100,
      sendAdaptationIssues: [],
      markingIssues:        [],
      feedbackIssues:       [],
      allIssues:            [],
      summaryNarrative:     `Quality review for ${data.student.firstName}: ${data.submissions.length} submission(s) reviewed. API key absent — detailed analysis unavailable.`,
      lastCheckedHomeworkId: lastSub.homework.id,
    }
  }

  const client  = new Anthropic({ apiKey })
  const payload = buildReviewPayload(data)

  const systemPrompt = [
    BLOOMS_ANALYSIS_SKILL.systemPromptFragment,
    '\n\n---\n',
    CURRICULUM_ALIGNMENT_SKILL.systemPromptFragment,
    '\n\n---\n',
    SEND_DIFFERENTIATION_SKILL.systemPromptFragment,
    '\n\n---\n',
    MARKING_CONSISTENCY_SKILL.systemPromptFragment,
    '\n\n---\n',
    FEEDBACK_QUALITY_SKILL.systemPromptFragment,
    `\n\n---\n
You are reviewing a batch of recent homework submissions for a single student.
Apply ALL five quality skills across the batch.

Return ONLY valid JSON with this exact shape:
{
  "bloomsBalance": { "Remember": number, "Understand": number, "Apply": number, "Analyse": number, "Evaluate": number, "Create": number },
  "curriculumIssues": string[],
  "sendAdaptationScore": number,
  "sendAdaptationIssues": string[],
  "markingIssues": [{ "submissionId": string, "discrepancyLevel": "NONE"|"MINOR"|"MODERATE"|"MAJOR", "summary": string }],
  "feedbackIssues": [{ "submissionId": string, "overallScore": number, "flags": string[] }],
  "allIssues": string[],
  "summaryNarrative": string
}

Rules:
- bloomsBalance: count questions per Bloom's level across all submissions
- curriculumIssues: only flag if a learning objective clearly falls outside the subject/year curriculum
- sendAdaptationScore: 100 if student has no SEND need; score 0-100 for SEND students based on adaptation quality
- markingIssues: skip MCQ_QUIZ submissions (unambiguous); flag SHORT_ANSWER and EXTENDED_WRITING only
- feedbackIssues: only include submissions where feedback is absent, vague, or praise-only
- allIssues: flat list of the most significant issues for the snapshot (max 10 strings)
- summaryNarrative: 2-3 sentences for the teacher/SENCO
`,
  ].join('')

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: JSON.stringify(payload) }],
  })

  const text      = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('[quality] Haiku returned no JSON')

  const parsed = JSON.parse(jsonMatch[0]) as Omit<QualityAnalysis, 'lastCheckedHomeworkId'>

  return {
    ...parsed,
    sendAdaptationScore:  parsed.sendAdaptationScore ?? 100,
    lastCheckedHomeworkId: lastSub.homework.id,
  }
}

// ── Write AgentAuditEntry for each skill used ─────────────────────────────────

async function writeAuditEntries(
  studentId:  string,
  schoolId:   string,
  analysis:   QualityAnalysis,
) {
  const entries: Parameters<typeof prisma.agentAuditEntry.create>[0]['data'][] = []

  const push = (skillId: AgentSkillId, outputSummary: string, decision: string, confidence: number) => {
    assertSkillPermitted(AgentType.QUALITY, skillId)
    entries.push({
      studentId,
      schoolId,
      agentType:        AgentType.QUALITY,
      skillId,
      skillVersion:     1,
      standardsApplied: ALL_STANDARDS[skillId],
      outputSummary,
      decision,
      confidence,
    })
  }

  const bloomLevels = Object.entries(analysis.bloomsBalance)
    .map(([l, c]) => `${l}:${c}`)
    .join(', ')

  push(
    AgentSkillId.BLOOMS_ANALYSIS,
    bloomLevels || 'No question distribution data',
    analysis.bloomsBalance['Analyse'] || analysis.bloomsBalance['Evaluate']
      ? 'Bloom\'s distribution includes higher-order thinking. Continue current balance.'
      : 'Distribution skewed toward lower-order levels. Introduce Analyse/Evaluate questions.',
    75,
  )

  push(
    AgentSkillId.CURRICULUM_ALIGNMENT,
    analysis.curriculumIssues.length > 0
      ? `Curriculum issues: ${analysis.curriculumIssues.join('; ')}`
      : 'Learning objectives align with curriculum expectations.',
    analysis.curriculumIssues.length > 0
      ? 'Review learning objectives against NC/syllabus attainment targets.'
      : 'No curriculum alignment action required.',
    80,
  )

  if (analysis.sendAdaptationScore < 100) {
    push(
      AgentSkillId.SEND_DIFFERENTIATION,
      `SEND adaptation score: ${analysis.sendAdaptationScore}/100. ${analysis.sendAdaptationIssues.join('; ')}`,
      analysis.sendAdaptationScore < SEND_ADAPTATION_WARN
        ? 'Adaptation quality below threshold. SENCO notified. Review differentiation notes.'
        : 'Adaptation present but could be more targeted to need area.',
      70,
    )
  }

  const markingProblems = analysis.markingIssues.filter(m => MARKING_WARN_LEVELS.has(m.discrepancyLevel))
  if (markingProblems.length > 0) {
    push(
      AgentSkillId.MARKING_CONSISTENCY,
      `Marking discrepancies: ${markingProblems.map(m => `${m.discrepancyLevel} — ${m.summary}`).join('; ')}`,
      'Teacher notified. Recommend reviewing mark scheme guidance for affected submissions.',
      65,
    )
  }

  const poorFeedback = analysis.feedbackIssues.filter(f => f.overallScore < 60)
  if (poorFeedback.length > 0) {
    push(
      AgentSkillId.FEEDBACK_QUALITY,
      `Feedback quality low on ${poorFeedback.length} submission(s). Flags: ${poorFeedback.flatMap(f => f.flags).join(', ')}`,
      'Encourage use of feed-forward model: specific next step referencing student\'s actual answer.',
      70,
    )
  }

  await Promise.allSettled(
    entries.map(data => prisma.agentAuditEntry.create({ data }))
  )
}

// ── Notifications ─────────────────────────────────────────────────────────────

async function notifyOnIssues(
  data:     StudentQualityData,
  schoolId: string,
  analysis: QualityAnalysis,
) {
  const notifications: Array<{
    schoolId: string
    recipientId: string
    type: string
    title: string
    body: string
    link: string
  }> = []

  const studentName = `${data.student.firstName} ${data.student.lastName}`

  // Gather class teacher IDs from submissions
  const teacherIds = new Set<string>()
  for (const sub of data.submissions) {
    for (const ct of sub.homework.class?.teachers ?? []) {
      teacherIds.add(ct.userId)
    }
  }

  // Notify teachers for marking/feedback issues
  const markingProblems = analysis.markingIssues.filter(m => MARKING_WARN_LEVELS.has(m.discrepancyLevel))
  if (markingProblems.length > 0 || analysis.feedbackIssues.filter(f => f.overallScore < 50).length > 0) {
    for (const recipientId of teacherIds) {
      notifications.push({
        schoolId,
        recipientId,
        type:  'quality_marking_alert',
        title: `Quality review: marking/feedback for ${studentName}`,
        body:  analysis.summaryNarrative,
        link:  `/analytics`,
      })
    }
  }

  // Notify SENCO for SEND adaptation issues
  if (
    data.student.sendStatus &&
    analysis.sendAdaptationScore < SEND_ADAPTATION_WARN &&
    data.sencoIds.length > 0
  ) {
    for (const recipientId of data.sencoIds) {
      notifications.push({
        schoolId,
        recipientId,
        type:  'quality_send_alert',
        title: `SEND adaptation quality alert: ${studentName}`,
        body:  `Homework adaptation score ${analysis.sendAdaptationScore}/100 — below threshold for ${data.student.needArea ?? 'SEND'} need. ${analysis.sendAdaptationIssues.join(' ')}`,
        link:  `/send/ilp/${data.student.id}`,
      })
    }
  }

  if (notifications.length > 0) {
    await prisma.sendNotification.createMany({
      data:           notifications,
      skipDuplicates: true,
    })
  }
}

// ── Main: run quality review for one student ──────────────────────────────────

export async function runQualityForStudent(
  studentId: string,
  schoolId:  string,
): Promise<{ ran: boolean; issueCount: number }> {

  const snap = await prisma.agentSnapshot.findUnique({
    where:  { studentId_agentType: { studentId, agentType: AgentType.QUALITY } },
    select: { lastRunAt: true },
  })
  const lastRunAt = snap?.lastRunAt ?? null
  const since     = lastRunAt ?? new Date(Date.now() - LOOK_BACK_DAYS * 86_400_000)

  const data = await fetchQualityData(studentId, schoolId, since)
  if (data.submissions.length === 0) return { ran: false, issueCount: 0 }

  const previous = await getSnapshot(studentId, AgentType.QUALITY) as QualityKnowledge | null
  const analysis = await runQualityAnalysis(data)
  if (!analysis) return { ran: false, issueCount: 0 }

  // Merge issues from previous snapshot (rolling history — keep last 20)
  const mergedIssues = [
    ...analysis.allIssues,
    ...(previous?.issues ?? []),
  ].slice(0, 20)

  const knowledge: QualityKnowledge = {
    lastCheckedHomeworkId: analysis.lastCheckedHomeworkId,
    issues:                mergedIssues,
    bloomsBalance:         analysis.bloomsBalance,
    sendAdaptationScore:   analysis.sendAdaptationScore,
    summaryNarrative:      analysis.summaryNarrative,
  }

  // Write audit entries for skills exercised
  await writeAuditEntries(studentId, schoolId, analysis)

  // Save snapshot
  await saveSnapshot(studentId, schoolId, AgentType.QUALITY, knowledge, inOneWeek())

  // System audit log
  void writeAudit({
    action:     'AGENT_RUN_COMPLETED',
    schoolId,
    actorId:    studentId,
    targetType: 'Student',
    targetId:   studentId,
    metadata:   { agent: 'QUALITY', issueCount: analysis.allIssues.length, sendAdaptationScore: analysis.sendAdaptationScore },
  }).catch(() => {})

  // Notify on significant issues
  void notifyOnIssues(data, schoolId, analysis).catch(() => {})

  return { ran: true, issueCount: analysis.allIssues.length }
}

// ── Batch runner — called by cron ─────────────────────────────────────────────

export async function runQualityBatchForSchool(
  schoolId: string,
): Promise<{ processed: number; skipped: number; errors: number; totalIssues: number }> {
  // Find students with dirty Quality snapshots
  const dirty = await prisma.agentSnapshot.findMany({
    where: {
      schoolId,
      agentType: AgentType.QUALITY,
      OR: [
        { dirtyAt: { not: null } },
        { nextReviewAt: { lte: new Date() } },
      ],
    },
    select:  { studentId: true },
    take:    100,
    orderBy: { dirtyAt: 'asc' },
  })

  // Also first-run students (active students with no Quality snapshot yet)
  const existing     = new Set(dirty.map(d => d.studentId))
  const newStudents  = await prisma.user.findMany({
    where:  { schoolId, role: 'STUDENT', isActive: true, id: { notIn: [...existing] } },
    select: { id: true },
    take:   50,
  })

  const all = [
    ...dirty.map(d => d.studentId),
    ...newStudents.map(s => s.id),
  ]

  let processed = 0, skipped = 0, errors = 0, totalIssues = 0

  const BATCH = 5
  for (let i = 0; i < all.length; i += BATCH) {
    const batch   = all.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      batch.map(studentId => runQualityForStudent(studentId, schoolId))
    )
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.ran) { processed++; totalIssues += result.value.issueCount }
        else skipped++
      } else {
        errors++
        console.error('[quality] Student run error:', result.reason)
      }
    }
    if (i + BATCH < all.length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  return { processed, skipped, errors, totalIssues }
}
