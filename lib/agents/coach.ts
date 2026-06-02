/**
 * lib/agents/coach.ts
 *
 * Coach Agent — Student Performance Coach
 *
 * Analyses a student's homework submission and revision history to identify
 * knowledge gaps, retention risks, and Bloom's level weaknesses. Produces a
 * CoachKnowledge snapshot and notifies class teachers when significant gaps
 * are detected.
 *
 * Design principles:
 *  - Gap detection (arithmetic) is done in TypeScript — no Claude call needed
 *  - Claude haiku is called ONCE per student to produce the natural-language
 *    recommendation and Bloom's gap classifications
 *  - Delta mode: only processes records since lastRunAt (or 90 days on first run)
 *  - Fire-and-forget safe: throws are caught by the cron, never surface to UI
 *
 * Skills used:
 *  - RETRIEVAL_SPACING (primary)
 *  - BLOOMS_ANALYSIS (secondary — classifies Bloom's gaps per topic)
 *
 * Standards implemented (via skills):
 *  - Rosenshine's Principles of Instruction (2012) — P3, P9, P10
 *  - EEF Cognitive Science Approaches (2021)
 *  - Anderson & Krathwohl — Revised Bloom's Taxonomy (2001)
 */

import Anthropic                              from '@anthropic-ai/sdk'
import { AgentType, AgentSkillId }            from '@prisma/client'
import { prisma, writeAudit }                 from '@/lib/prisma'
import { getSnapshot, saveSnapshot, inOneWeek, type CoachKnowledge } from './snapshot'
import { RETRIEVAL_SPACING_SKILL, assertSkillPermitted, ALL_STANDARDS } from './skills'

// ── Constants ─────────────────────────────────────────────────────────────────

const LOOK_BACK_DAYS          = 90   // first-run window
const WEAK_TOPIC_THRESHOLD    = 60   // avg score % below this = weak
const STRONG_TOPIC_THRESHOLD  = 80   // avg score % above this = strong
const RETENTION_RISK_DAYS     = 14   // days without retrieval = risk
const MIN_ATTEMPTS_FOR_WEAK   = 2    // minimum data points before flagging weak
const MAX_FOCUS_TOPICS        = 3    // max recommendations per run

// ── Types ─────────────────────────────────────────────────────────────────────

type TopicRecord = {
  scores:      number[]
  lastTestedAt: Date
  subject:     string
  questionTexts: string[]  // for Bloom's classification
}

type StudentCoachData = {
  student: {
    id:         string
    firstName:  string
    lastName:   string
    sendStatus: string | null
    needArea:   string | null
  }
  teachers: { id: string }[]
  submissions: Array<{
    id:          string
    finalScore:  number | null
    markedAt:    Date | null
    homework: {
      title:              string
      learningObjectives: string[]
      type:               string
      gradingBands:       unknown
      questionsJson:      unknown
      class: { subject: string } | null
    }
  }>
  revisionProgress: Array<{
    topic:           string
    subject:         string
    confidenceLevel: number | null
    lastRevisedAt:   Date
    postRevisionAvg: number | null
  }>
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchStudentData(
  studentId: string,
  schoolId:  string,
  since:     Date,
): Promise<StudentCoachData> {
  const [student, submissions, revisionProgress] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: studentId },
      select: {
        id: true, firstName: true, lastName: true,
        enrolments: {
          select: {
            class: {
              select: {
                teachers: { select: { userId: true } },
              },
            },
          },
        },
        sendStatus: {
          select: { activeStatus: true, needArea: true },
        },
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
        id:         true,
        finalScore: true,
        markedAt:   true,
        homework: {
          select: {
            title:              true,
            learningObjectives: true,
            type:               true,
            gradingBands:       true,
            questionsJson:      true,
            class: { select: { subject: true } },
          },
        },
      },
      orderBy: { markedAt: 'asc' },
    }),
    prisma.revisionProgress.findMany({
      where:   { studentId, schoolId, lastRevisedAt: { gte: since } },
      select:  { topic: true, subject: true, confidenceLevel: true, lastRevisedAt: true, postRevisionAvg: true },
      orderBy: { lastRevisedAt: 'asc' },
    }),
  ])

  if (!student) throw new Error(`Student ${studentId} not found`)

  // Flatten teachers across all classes
  const teacherIds = new Set<string>()
  for (const enrolment of student.enrolments) {
    for (const ct of enrolment.class.teachers) {
      teacherIds.add(ct.userId)
    }
  }

  return {
    student: {
      id:         student.id,
      firstName:  student.firstName,
      lastName:   student.lastName,
      sendStatus: student.sendStatus?.activeStatus ?? null,
      needArea:   student.sendStatus?.needArea ?? null,
    },
    teachers:         [...teacherIds].map(id => ({ id })),
    submissions:      submissions as StudentCoachData['submissions'],
    revisionProgress: revisionProgress as StudentCoachData['revisionProgress'],
  }
}

// ── Topic performance matrix ──────────────────────────────────────────────────

function buildTopicMatrix(data: StudentCoachData): Record<string, TopicRecord> {
  const matrix: Record<string, TopicRecord> = {}

  const touch = (topic: string, subject: string, scorePct: number, at: Date, questions: string[]) => {
    if (!matrix[topic]) {
      matrix[topic] = { scores: [], lastTestedAt: at, subject, questionTexts: [] }
    }
    matrix[topic].scores.push(scorePct)
    if (at > matrix[topic].lastTestedAt) matrix[topic].lastTestedAt = at
    matrix[topic].questionTexts.push(...questions)
  }

  for (const sub of data.submissions) {
    if (!sub.finalScore || !sub.markedAt) continue
    const hw     = sub.homework
    const subj   = hw.class?.subject ?? 'Unknown'

    // Derive score percentage
    const bands  = hw.gradingBands as Record<string, unknown> | null
    const max    = bands ? Math.max(...Object.keys(bands).map(Number)) : 9
    const pct    = max > 0 ? Math.round((sub.finalScore / max) * 100) : 0

    // Extract questions for Bloom's analysis
    const qs: string[] = []
    if (hw.questionsJson) {
      const arr = Array.isArray(hw.questionsJson)
        ? hw.questionsJson
        : (hw.questionsJson as { questions?: unknown[] }).questions ?? []
      for (const q of arr as Record<string, unknown>[]) {
        const text = (q.prompt ?? q.question ?? '') as string
        if (text) qs.push(text)
      }
    }

    // Use learning objectives as topics (each objective = one topic entry)
    const objectives = hw.learningObjectives.length > 0
      ? hw.learningObjectives
      : [hw.title]  // fallback to homework title

    for (const obj of objectives) {
      touch(obj, subj, pct, sub.markedAt, qs)
    }
  }

  // Merge revision progress — use confidence as a proxy score (confidence × 20 = %)
  for (const rev of data.revisionProgress) {
    const pct = rev.postRevisionAvg != null
      ? rev.postRevisionAvg
      : rev.confidenceLevel != null ? rev.confidenceLevel * 20 : null
    if (pct != null) {
      touch(rev.topic, rev.subject, pct, rev.lastRevisedAt, [])
    }
  }

  return matrix
}

// ── Gap analysis (pure TypeScript — no Claude) ────────────────────────────────

type GapAnalysis = {
  weakTopics:      Array<{ topic: string; avgScore: number; attempts: number; subject: string }>
  retentionRisks:  Array<{ topic: string; daysSinceLastRetrieval: number; subject: string }>
  strongTopics:    string[]
  newSubmissionIds: string[]
}

function analyseGaps(matrix: Record<string, TopicRecord>, data: StudentCoachData): GapAnalysis {
  const now        = new Date()
  const weakTopics: GapAnalysis['weakTopics']     = []
  const retention:  GapAnalysis['retentionRisks'] = []
  const strong:     string[]                      = []

  // Apply SEND spacing threshold: 10 days for SEND students (more frequent retrieval)
  const riskDays = data.student.sendStatus ? 10 : RETENTION_RISK_DAYS

  for (const [topic, record] of Object.entries(matrix)) {
    const avgScore = record.scores.reduce((a, b) => a + b, 0) / record.scores.length
    const daysSince = Math.floor((now.getTime() - record.lastTestedAt.getTime()) / 86_400_000)

    if (avgScore < WEAK_TOPIC_THRESHOLD && record.scores.length >= MIN_ATTEMPTS_FOR_WEAK) {
      weakTopics.push({ topic, avgScore: Math.round(avgScore), attempts: record.scores.length, subject: record.subject })
    } else if (avgScore >= STRONG_TOPIC_THRESHOLD && record.scores.length >= 3) {
      strong.push(topic)
    }

    if (avgScore >= WEAK_TOPIC_THRESHOLD && daysSince >= riskDays) {
      retention.push({ topic, daysSinceLastRetrieval: daysSince, subject: record.subject })
    }
  }

  // Sort by severity
  weakTopics.sort((a, b) => a.avgScore - b.avgScore)
  retention.sort((a, b) => b.daysSinceLastRetrieval - a.daysSinceLastRetrieval)

  return {
    weakTopics,
    retentionRisks:  retention,
    strongTopics:    strong,
    newSubmissionIds: data.submissions.map(s => s.id),
  }
}

// ── Claude haiku call — recommendation + Bloom's narrative ───────────────────

async function generateRecommendation(
  gaps:    GapAnalysis,
  matrix:  Record<string, TopicRecord>,
  student: StudentCoachData['student'],
): Promise<{ recommendedFocus: string[]; bloomsGaps: string[]; summaryNarrative: string; interleaveSuggestion: string }> {

  if (gaps.weakTopics.length === 0 && gaps.retentionRisks.length === 0) {
    return {
      recommendedFocus: [],
      bloomsGaps: [],
      summaryNarrative: `${student.firstName} is performing well across all recent topics with no significant gaps or retention risks identified.`,
      interleaveSuggestion: 'Continue current homework structure. Introduce one new topic alongside monthly review of strong topics.',
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Graceful fallback without API key
    return {
      recommendedFocus: [
        ...gaps.weakTopics.slice(0, 2).map(t => t.topic),
        ...gaps.retentionRisks.slice(0, 1).map(t => t.topic),
      ].slice(0, MAX_FOCUS_TOPICS),
      bloomsGaps:       [],
      summaryNarrative: `${student.firstName} has ${gaps.weakTopics.length} weak topic(s) and ${gaps.retentionRisks.length} retention risk(s).`,
      interleaveSuggestion: `Focus next homework on: ${gaps.weakTopics.slice(0, 2).map(t => t.topic).join(', ')}.`,
    }
  }

  // Sample up to 10 question texts for Bloom's classification
  const sampleQuestions = Object.values(matrix)
    .flatMap(r => r.questionTexts)
    .filter(Boolean)
    .slice(0, 10)

  const client  = new Anthropic({ apiKey })
  const payload = {
    student:      { firstName: student.firstName, sendStatus: student.sendStatus, needArea: student.needArea },
    weakTopics:   gaps.weakTopics,
    retentionRisks: gaps.retentionRisks,
    strongTopics: gaps.strongTopics,
    sampleQuestions,
    maxFocusTopics: MAX_FOCUS_TOPICS,
  }

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: `${RETRIEVAL_SPACING_SKILL.systemPromptFragment}

You are also applying the Bloom's Analysis skill to classify any Bloom's gaps across topics.

Return ONLY valid JSON with this exact shape:
{
  "recommendedFocus": [{ "topic": string, "reason": string, "priority": 1|2|3 }],
  "bloomsGaps": string[],
  "summaryNarrative": string,
  "interleaveSuggestion": string
}`,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('[coach] Haiku returned no JSON')

  const parsed = JSON.parse(jsonMatch[0]) as {
    recommendedFocus: Array<{ topic: string } | string>
    bloomsGaps: string[]
    summaryNarrative: string
    interleaveSuggestion: string
  }

  // Normalise recommendedFocus to string[] regardless of what haiku returns
  const recommendedFocusStrings = (parsed.recommendedFocus ?? []).map(r =>
    typeof r === 'string' ? r : r.topic
  ).slice(0, MAX_FOCUS_TOPICS)

  return {
    recommendedFocus:     recommendedFocusStrings,
    bloomsGaps:           parsed.bloomsGaps ?? [],
    summaryNarrative:     parsed.summaryNarrative ?? '',
    interleaveSuggestion: parsed.interleaveSuggestion ?? '',
  }
}

// ── Write AgentAuditEntry ─────────────────────────────────────────────────────

async function writeAuditEntry({
  studentId, schoolId, skillId, outputSummary, decision, confidence,
}: {
  studentId:     string
  schoolId:      string
  skillId:       AgentSkillId
  outputSummary: string
  decision:      string
  confidence:    number
}) {
  assertSkillPermitted(AgentType.COACH, skillId)
  await prisma.agentAuditEntry.create({
    data: {
      studentId,
      schoolId,
      agentType:        AgentType.COACH,
      skillId,
      skillVersion:     1,
      standardsApplied: ALL_STANDARDS[skillId],
      outputSummary,
      decision,
      confidence,
    },
  })
}

// ── Notify teachers ───────────────────────────────────────────────────────────

async function notifyTeachers(
  teacherIds: string[],
  student:    StudentCoachData['student'],
  schoolId:   string,
  summary:    string,
  studentId:  string,
) {
  if (teacherIds.length === 0) return
  await prisma.sendNotification.createMany({
    data: teacherIds.map(recipientId => ({
      schoolId,
      recipientId,
      type:  'coach_gap_alert',
      title: `Coach alert: ${student.firstName} ${student.lastName} has knowledge gaps`,
      body:  summary,
      link:  `/analytics/students/${studentId}`,
    })),
    skipDuplicates: true,
  })
}

// ── Main: run coach for one student ──────────────────────────────────────────

export async function runCoachForStudent(
  studentId: string,
  schoolId:  string,
): Promise<{ ran: boolean; weakTopics: number; retentionRisks: number }> {

  const previous  = await getSnapshot(studentId, AgentType.COACH) as CoachKnowledge | null
  const snap      = await prisma.agentSnapshot.findUnique({
    where:  { studentId_agentType: { studentId, agentType: AgentType.COACH } },
    select: { lastRunAt: true },
  })
  const lastRunAt = snap?.lastRunAt ?? null

  // Delta window — default 90 days for first run
  const since = lastRunAt ?? new Date(Date.now() - LOOK_BACK_DAYS * 86_400_000)
  const data  = await fetchStudentData(studentId, schoolId, since)

  // Nothing to process
  if (data.submissions.length === 0 && data.revisionProgress.length === 0) {
    return { ran: false, weakTopics: 0, retentionRisks: 0 }
  }

  const matrix  = buildTopicMatrix(data)
  const gaps    = analyseGaps(matrix, data)
  const { recommendedFocus, bloomsGaps, summaryNarrative, interleaveSuggestion } =
    await generateRecommendation(gaps, matrix, data.student)

  // Build new CoachKnowledge (merge with previous strong topics for continuity)
  const newKnowledge: CoachKnowledge = {
    weakTopics:       gaps.weakTopics.map(t => t.topic),
    strongTopics:     [...new Set([...(previous?.strongTopics ?? []), ...gaps.strongTopics])],
    retentionRisk:    gaps.retentionRisks.map(t => t.topic),
    bloomsGaps,
    recommendedFocus,
    lastHomeworkIds:  gaps.newSubmissionIds,
    lastRevisionIds:  data.revisionProgress.map((_, i) => String(i)),
    summaryNarrative,
  }

  // Write audit entries for skills used
  await Promise.allSettled([
    writeAuditEntry({
      studentId, schoolId,
      skillId:       AgentSkillId.RETRIEVAL_SPACING,
      outputSummary: summaryNarrative,
      decision:      interleaveSuggestion,
      confidence:    gaps.weakTopics.length > 0 || gaps.retentionRisks.length > 0 ? 80 : 95,
    }),
    gaps.weakTopics.length > 0
      ? writeAuditEntry({
          studentId, schoolId,
          skillId:       AgentSkillId.BLOOMS_ANALYSIS,
          outputSummary: bloomsGaps.length > 0
            ? `Bloom's gaps detected: ${bloomsGaps.join(', ')}`
            : 'No Bloom\'s level gaps detected in recent submissions.',
          decision:      bloomsGaps.length > 0
            ? `Next homework should include higher-order questions for: ${bloomsGaps.join(', ')}`
            : 'Current question distribution is appropriate.',
          confidence: 70,
        })
      : Promise.resolve(),
  ])

  // Persist snapshot
  await saveSnapshot(studentId, schoolId, AgentType.COACH, newKnowledge, inOneWeek())

  // Write system audit log
  void writeAudit({
    action:     'AGENT_RUN_COMPLETED',
    schoolId,
    actorId:    studentId,
    targetType: 'Student',
    targetId:   studentId,
    metadata:   { agent: 'COACH', weakTopics: gaps.weakTopics.length, retentionRisks: gaps.retentionRisks.length },
  }).catch(() => {})

  // Notify teachers if significant gaps found (≥2 weak topics OR ≥1 retention risk)
  const shouldNotify = gaps.weakTopics.length >= 2 || gaps.retentionRisks.length >= 1
  if (shouldNotify && data.teachers.length > 0) {
    void notifyTeachers(
      data.teachers.map(t => t.id),
      data.student,
      schoolId,
      summaryNarrative,
      studentId,
    ).catch(() => {})
  }

  return { ran: true, weakTopics: gaps.weakTopics.length, retentionRisks: gaps.retentionRisks.length }
}

// ── Batch runner — called by cron ─────────────────────────────────────────────

export async function runCoachBatchForSchool(
  schoolId: string,
): Promise<{ processed: number; skipped: number; errors: number; totalGaps: number }> {
  // Find all students who are dirty (or have never been run) — up to 100 per batch
  const dirty = await prisma.agentSnapshot.findMany({
    where: {
      schoolId,
      agentType: AgentType.COACH,
      OR: [
        { dirtyAt: { not: null } },
        { nextReviewAt: { lte: new Date() } },
      ],
    },
    select:  { studentId: true },
    take:    100,
    orderBy: { dirtyAt: 'asc' },
  })

  // Also include active students who have NO snapshot yet (first-run)
  const existing = new Set(dirty.map(d => d.studentId))
  const newStudents = await prisma.user.findMany({
    where: {
      schoolId,
      role:     'STUDENT',
      isActive: true,
      id:       { notIn: [...existing] },
    },
    select: { id: true },
    take:   50,
  })

  const allStudents = [
    ...dirty.map(d => d.studentId),
    ...newStudents.map(s => s.id),
  ]

  let processed = 0, skipped = 0, errors = 0, totalGaps = 0

  const BATCH = 5
  for (let i = 0; i < allStudents.length; i += BATCH) {
    const batch = allStudents.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      batch.map(studentId => runCoachForStudent(studentId, schoolId))
    )
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.ran) {
          processed++
          totalGaps += result.value.weakTopics + result.value.retentionRisks
        } else {
          skipped++
        }
      } else {
        errors++
        console.error('[coach] Student run error:', result.reason)
      }
    }
    // Brief pause between batches to avoid DB connection spikes
    if (i + BATCH < allStudents.length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  return { processed, skipped, errors, totalGaps }
}
