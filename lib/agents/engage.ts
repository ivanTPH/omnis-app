/**
 * lib/agents/engage.ts
 *
 * ENGAGE Agent — Engagement-Optimised Homework Generator
 *
 * Runs after the COACH agent (reads COACH snapshot for weak topics + recommended
 * focus) and uses Oak National Academy curriculum data to generate per-topic
 * engagement packages ready for teachers to use or adapt.
 *
 * Each package contains:
 *   - A curiosity hook (surprising / relevant question to open the task)
 *   - 2-3 gamified MCQ questions with misconception-rooted distractors
 *   - Key vocabulary to pre-teach (from Oak lesson keywords)
 *   - A focused retrieval/application core task
 *   - A Bloom's Evaluate/Create challenge extension
 *   - A SEND-adaptive version of the core task
 *
 * Design principles:
 *   - Zero additional DB writes during generation (all Oak data from module cache)
 *   - Single haiku call per student (all weak topics batched)
 *   - Results cached in OmnisInferenceCache (TTL 7 days) — skipped if hit
 *   - Output surfaced as AgentAuditEntry rows (type=ENGAGE, skill=ENGAGEMENT_DESIGN)
 *     so they appear automatically in /senco/agent-insights for teacher review
 *   - Never increases Claude costs vs current baseline: only fires when COACH
 *     detected weak topics (not on every student); haiku-only; cached
 *
 * Standards:
 *   EEF Metacognition 2018 · Rosenshine P1/P2/P6 · Oak Curriculum Licence
 *   SEND CoP 2015 §6.1–6.11 · Mayer Multimedia Learning (2009)
 */

import Anthropic         from '@anthropic-ai/sdk'
import { createHash }    from 'crypto'
import { AgentType, AgentSkillId } from '@prisma/client'
import { prisma, writeAudit }   from '@/lib/prisma'
import { resolveSkillFragment, resolveSkillVersion } from './skill-prompt'
import {
  getSnapshot,
  saveSnapshot,
  inOneWeek,
  type CoachKnowledge,
  type EngageKnowledge,
} from './snapshot'
import {
  ENGAGEMENT_DESIGN_SKILL,
  assertSkillPermitted,
  ALL_STANDARDS,
} from './skills'
import {
  findOakDataForTopics,
  extractMisconceptions,
  extractKeywords,
  extractKlps,
  type OakLessonContent,
} from '@/lib/oak-content'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TOPICS_PER_RUN = 3   // batch limit per haiku call
const ENGAGE_CACHE_TTL   = 7   // days

// ── Inference cache helpers ───────────────────────────────────────────────────
// We store the generated packages in OmnisInferenceCache keyed by:
//   SHA-256(studentId + weakTopics.sorted + subjectSlug)
// TTL: 7 days (re-generates as COACH weak topics change)

function buildEngageHash(studentId: string, topics: string[], subjectSlug: string): string {
  const key = JSON.stringify({ studentId, topics: [...topics].sort(), subjectSlug })
  return createHash('sha256').update(key).digest('hex').slice(0, 32)
}

async function lookupEngageCache(hash: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (prisma.omnisInferenceCache as any).findUnique({
      where: { cacheType_signatureHash: { cacheType: 'ENGAGE_PACKAGE', signatureHash: hash } },
    })
    if (!row) return null
    if (row.expiresAt && new Date() > new Date(row.expiresAt)) return null
    // Increment hit counter (fire-and-forget)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (prisma.omnisInferenceCache as any).update({
      where: { cacheType_signatureHash: { cacheType: 'ENGAGE_PACKAGE', signatureHash: hash } },
      data:  { hitCount: { increment: 1 } },
    }).catch(() => {})
    return JSON.stringify(row.payload)
  } catch {
    return null
  }
}

async function storeEngageCache(hash: string, packages: EngagePackage[]): Promise<void> {
  const expiresAt = new Date(Date.now() + ENGAGE_CACHE_TTL * 86_400_000)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.omnisInferenceCache as any).upsert({
      where:  { cacheType_signatureHash: { cacheType: 'ENGAGE_PACKAGE', signatureHash: hash } },
      create: {
        cacheType:     'ENGAGE_PACKAGE',
        signatureHash: hash,
        signature:     { hash },
        payload:       packages,
        expiresAt,
        hitCount:      0,
      },
      update: {
        payload:   packages,
        expiresAt,
      },
    })
  } catch { /* non-fatal */ }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type EngagePackage = {
  topic:          string
  engagementHook: string
  mcqQuestions:   Array<{
    question:     string
    options:      string[]
    correctIndex: number
    misconception: string
  }>
  preTeachVocab:  string[]
  coreTask:       string
  challengeTask:  string
  sendAdaptation: string
}

type HaikuEngageOutput = {
  packages:         EngagePackage[]
  summaryNarrative: string
}

// ── Build Oak context for weak topics ────────────────────────────────────────

async function buildOakContext(
  topics:      string[],
  subjectSlug: string,
): Promise<{ lessons: OakLessonContent[]; misconceptions: string[]; keywords: string[]; klps: string[] }> {
  const lessons       = await findOakDataForTopics(topics, subjectSlug, 4)
  const misconceptions = extractMisconceptions(lessons)
  const keywords      = extractKeywords(lessons)
  const klps          = extractKlps(lessons)
  return { lessons, misconceptions, keywords, klps }
}

// ── Single haiku call — generate all engagement packages ─────────────────────

async function generateEngagePackages(
  student:       { firstName: string; sendStatus: string | null; needArea: string | null },
  weakTopics:    Array<{ topic: string; avgScore: number; subject: string }>,
  oakContext:    { misconceptions: string[]; keywords: string[]; klps: string[] },
): Promise<HaikuEngageOutput | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const client = new Anthropic({ apiKey })

  const payload = {
    student: { firstName: student.firstName, sendStatus: student.sendStatus, needArea: student.needArea },
    weakTopics: weakTopics.map(t => ({ topic: t.topic, avgScore: t.avgScore, subject: t.subject })),
    oakMisconceptions: oakContext.misconceptions.slice(0, 8),
    oakVocabulary:     oakContext.keywords.slice(0, 15),
    oakKlps:           oakContext.klps.slice(0, 10),
  }

  const engagementDesignPrompt = await resolveSkillFragment(
    AgentType.ENGAGE,
    AgentSkillId.ENGAGEMENT_DESIGN,
    ENGAGEMENT_DESIGN_SKILL.systemPromptFragment,
  )

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: `${engagementDesignPrompt.fragment}

You are generating engagement-optimised homework packages for a UK secondary school student who has weak performance on specific topics.

Use the provided Oak curriculum data (misconceptions, vocabulary, key learning points) to ground your output in real curriculum content.

Return ONLY valid JSON with this exact shape:
{
  "packages": [
    {
      "topic": string,
      "engagementHook": string,
      "mcqQuestions": [
        {
          "question": string,
          "options": [string, string, string, string],
          "correctIndex": 0,
          "misconception": string
        }
      ],
      "preTeachVocab": string[],
      "coreTask": string,
      "challengeTask": string,
      "sendAdaptation": string
    }
  ],
  "summaryNarrative": string
}

Rules:
- Generate one package per weak topic (max ${MAX_TOPICS_PER_RUN})
- options: always 4 choices; correctIndex is ALWAYS 0 (shuffle on display)
- mcqQuestions: 2-3 per topic, each rooted in one of the oakMisconceptions
- preTeachVocab: 3-5 "word: definition" strings from oakVocabulary relevant to this topic
- coreTask: 2-3 sentences; must require active recall, not passive re-reading
- challengeTask: one sentence pushing Bloom's Evaluate or Create level
- sendAdaptation: one sentence on scaffolding for the student's SEND need (if no SEND need: "Standard task is appropriate for all learners.")
- summaryNarrative: 2 sentences describing the engagement packages generated`,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  function extractJson(raw: string): HaikuEngageOutput {
    const s = raw
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ')
    const m = s.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('[engage] Haiku returned no JSON')
    try { return JSON.parse(m[0]) } catch {
      const cleaned = m[0].replace(/("(?:[^"\\]|\\.)*")/g, (str) =>
        str.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
      )
      return JSON.parse(cleaned)
    }
  }

  return extractJson(text)
}

// ── Write AgentAuditEntry entries ─────────────────────────────────────────────

async function writeEngageAuditEntries(
  studentId:    string,
  schoolId:     string,
  packages:     EngagePackage[],
  narrative:    string,
): Promise<void> {
  assertSkillPermitted(AgentType.ENGAGE, AgentSkillId.ENGAGEMENT_DESIGN)

  const engagementDesignVersion = await resolveSkillVersion(AgentType.ENGAGE, AgentSkillId.ENGAGEMENT_DESIGN)

  const entries = packages.map(pkg => ({
    studentId,
    schoolId,
    agentType:        AgentType.ENGAGE,
    skillId:          AgentSkillId.ENGAGEMENT_DESIGN,
    skillVersion:     engagementDesignVersion,
    standardsApplied: [...ENGAGEMENT_DESIGN_SKILL.standards],
    outputSummary:    `Engagement package for "${pkg.topic}": ${pkg.mcqQuestions.length} MCQ questions, ${pkg.preTeachVocab.length} vocab terms, core + challenge tasks, SEND adaptation.`,
    decision:         [
      `Hook: ${pkg.engagementHook}`,
      `Core: ${pkg.coreTask.slice(0, 200)}`,
      `Vocab: ${pkg.preTeachVocab.slice(0, 3).join('; ')}`,
    ].join(' | ').slice(0, 500),
    confidence:       72,
  }))

  await Promise.allSettled(
    entries.map(data => prisma.agentAuditEntry.create({ data }))
  )

  // Also write one RETRIEVAL_SPACING entry covering the overall interleaving strategy
  if (packages.length > 0) {
    assertSkillPermitted(AgentType.ENGAGE, AgentSkillId.RETRIEVAL_SPACING)
    await prisma.agentAuditEntry.create({
      data: {
        studentId,
        schoolId,
        agentType:        AgentType.ENGAGE,
        skillId:          AgentSkillId.RETRIEVAL_SPACING,
        skillVersion:     await resolveSkillVersion(AgentType.ENGAGE, AgentSkillId.RETRIEVAL_SPACING),
        standardsApplied: ALL_STANDARDS[AgentSkillId.RETRIEVAL_SPACING],
        outputSummary:    narrative,
        decision:         `${packages.length} engagement package(s) generated for weak topics. Interleave one per homework cycle.`,
        confidence:       78,
      },
    }).catch(() => {})
  }
}

// ── Main: run ENGAGE for one student ─────────────────────────────────────────

export async function runEngageForStudent(
  studentId: string,
  schoolId:  string,
): Promise<{ ran: boolean; packagesGenerated: number; fromCache: boolean }> {

  // Read COACH snapshot — ENGAGE depends on COACH weak topics
  const coachSnap = await getSnapshot(studentId, AgentType.COACH) as CoachKnowledge | null
  if (!coachSnap || coachSnap.weakTopics.length === 0) {
    return { ran: false, packagesGenerated: 0, fromCache: false }
  }

  // Check if ENGAGE snapshot already exists and is recent
  const existing = await getSnapshot(studentId, AgentType.ENGAGE) as EngageKnowledge | null
  if (existing) {
    const lastGenAt = new Date(existing.lastGeneratedAt)
    const ageMs     = Date.now() - lastGenAt.getTime()
    if (ageMs < ENGAGE_CACHE_TTL * 86_400_000) {
      return { ran: false, packagesGenerated: 0, fromCache: true }
    }
  }

  // Determine primary subject from COACH weak topics
  const topWeakTopics  = coachSnap.weakTopics.slice(0, MAX_TOPICS_PER_RUN)
  const primarySubject = (coachSnap.weakTopics[0] as unknown as { subject?: string })?.subject
    ?? 'english'
  const subjectSlug    = primarySubject.toLowerCase().replace(/\s+/g, '-')

  // Check inference cache
  const hash       = buildEngageHash(studentId, topWeakTopics, subjectSlug)
  const cachedJson = await lookupEngageCache(hash)

  let packages: EngagePackage[]
  let narrative: string
  let fromCache = false

  if (cachedJson) {
    const parsed = JSON.parse(cachedJson) as EngagePackage[]
    packages  = parsed
    narrative = `${packages.length} engagement package(s) served from cache for: ${topWeakTopics.join(', ')}.`
    fromCache = true
  } else {
    // Fetch student info for SEND context
    const student = await prisma.user.findUnique({
      where:  { id: studentId },
      select: { firstName: true, sendStatus: { select: { activeStatus: true, needArea: true } } },
    })
    if (!student) return { ran: false, packagesGenerated: 0, fromCache: false }

    const studentInfo = {
      firstName:  student.firstName,
      sendStatus: student.sendStatus?.activeStatus ?? null,
      needArea:   student.sendStatus?.needArea     ?? null,
    }

    // Build Oak context (module cache — no extra DB round-trips on warm container)
    const oakCtx = await buildOakContext(topWeakTopics, subjectSlug)

    // Reconstruct weak topic structs for haiku
    const weakTopicStructs = topWeakTopics.map(t => ({
      topic:    t,
      avgScore: 50,  // COACH snapshot stores only topic names; default to 50% for prompt context
      subject:  primarySubject,
    }))

    const result = await generateEngagePackages(studentInfo, weakTopicStructs, oakCtx)
    if (!result || result.packages.length === 0) {
      return { ran: false, packagesGenerated: 0, fromCache: false }
    }

    packages  = result.packages
    narrative = result.summaryNarrative

    // Store in inference cache (fire-and-forget)
    void storeEngageCache(hash, packages).catch(() => {})
  }

  // Write AgentAuditEntry rows (appear in /senco/agent-insights)
  await writeEngageAuditEntries(studentId, schoolId, packages, narrative)

  // Save ENGAGE snapshot
  const knowledge: EngageKnowledge = {
    packages:         packages.map(p => p.topic),
    lastGeneratedAt:  new Date().toISOString(),
    summaryNarrative: narrative,
  }
  await saveSnapshot(studentId, schoolId, AgentType.ENGAGE, knowledge, inOneWeek())

  // System audit log (fire-and-forget)
  void writeAudit({
    action:     'AGENT_RUN_COMPLETED',
    schoolId,
    actorId:    studentId,
    targetType: 'Student',
    targetId:   studentId,
    metadata:   { agent: 'ENGAGE', packagesGenerated: packages.length, fromCache },
  }).catch(() => {})

  return { ran: true, packagesGenerated: packages.length, fromCache }
}

// ── Batch runner — called by cron ─────────────────────────────────────────────

export async function runEngageBatchForSchool(
  schoolId: string,
): Promise<{ processed: number; skipped: number; errors: number; totalPackages: number; cacheHits: number }> {

  // Only run ENGAGE for students who have a COACH snapshot with weak topics
  const coachSnaps = await prisma.agentSnapshot.findMany({
    where: { schoolId, agentType: AgentType.COACH },
    select: { studentId: true, knowledgeJson: true },
    take:   100,
  })

  const eligible = coachSnaps.filter(s => {
    const k = s.knowledgeJson as CoachKnowledge | null
    return k && Array.isArray(k.weakTopics) && k.weakTopics.length > 0
  })

  let processed = 0, skipped = 0, errors = 0, totalPackages = 0, cacheHits = 0

  const BATCH = 3  // conservative — each call does Oak DB lookups + optional Claude call
  for (let i = 0; i < eligible.length; i += BATCH) {
    const batch   = eligible.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      batch.map(s => runEngageForStudent(s.studentId, schoolId))
    )
    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value.ran)       { processed++; totalPackages += r.value.packagesGenerated }
        else if (r.value.fromCache) cacheHits++
        else                   skipped++
      } else {
        errors++
        console.error('[engage] Student run error:', r.reason)
      }
    }
    if (i + BATCH < eligible.length) {
      await new Promise(res => setTimeout(res, 500))
    }
  }

  return { processed, skipped, errors, totalPackages, cacheHits }
}
