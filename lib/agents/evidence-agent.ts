/**
 * lib/agents/evidence-agent.ts
 *
 * Evidence & Attainment Agent — retroactively matches homework submissions
 * against EHCP outcomes and ILP targets for SEND students.
 *
 * Design:
 *   - Triggered (dirty-flag) when a submission is marked for a SEND student
 *   - Runs periodically via early-warning cron as a catch-up sweep
 *   - Single claude-haiku call per student — all submissions × all targets in one prompt
 *   - Creates HomeworkEhcpEvidence (reviewStatus="pending") and IlpEvidenceEntry
 *     (autoLinked=true) records; evidenceCount is NOT incremented until SENCO confirms
 *   - After each run, marks PLAN_SYNTHESIS dirty so it re-evaluates coherence with fresh evidence
 *   - Fire-and-forget safe — all throws caught by cron wrapper
 *
 * Standards addressed:
 *   - DfE SEND Code of Practice 2015 §6.72 — evidence base for annual review
 *   - DfE SEND Code of Practice 2015 §9.2  — EHCP outcome evidence trails
 */

import Anthropic             from '@anthropic-ai/sdk'
import { AgentType }         from '@prisma/client'
import { prisma }            from '@/lib/prisma'
import {
  getSnapshot, saveSnapshot, markDirty, getDirtyStudentIds, inOneWeek,
  type EvidenceKnowledge, type EvidenceMatch,
} from './snapshot'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Look-back window: scan submissions no older than this many days */
const LOOKBACK_DAYS = 60

/** Maximum submissions to include in a single AI call (token budget) */
const MAX_SUBMISSIONS = 20

/** Minimum passing grade to consider as evidence (GCSE 4 = C) */
const MIN_GRADE = 4

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Run the Evidence Agent for a single student.
 * Called by the cron for each dirty student; safe to call manually.
 */
export async function runEvidenceAgent(
  studentId: string,
  schoolId:  string,
): Promise<EvidenceKnowledge> {

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return fallbackKnowledge('No API key — skipped')
  }

  // ── 1. Load student's active SEND plans ──────────────────────────────────

  const [ehcp, ilp] = await Promise.all([
    prisma.ehcpPlan.findFirst({
      where: {
        studentId,
        schoolId,
        status: 'active',
        approvedBySenco: true,
      },
      select: {
        id: true,
        outcomes: {
          where:  { status: 'active' },
          select: { id: true, outcomeText: true, section: true },
        },
      },
    }),
    prisma.individualLearningPlan.findFirst({
      where:  { studentId, schoolId, status: 'ACTIVE' },
      select: {
        targets: {
          where:  { status: 'active' },
          select: { id: true, target: true },
        },
      },
    }),
  ])

  const ehcpOutcomes  = ehcp?.outcomes ?? []
  const ilpTargets    = ilp?.targets  ?? []

  // Nothing to match against
  if (ehcpOutcomes.length === 0 && ilpTargets.length === 0) {
    const knowledge = fallbackKnowledge('No active EHCP outcomes or ILP targets')
    await saveSnapshot(studentId, schoolId, AgentType.EVIDENCE, knowledge, inOneWeek())
    return knowledge
  }

  // ── 2. Load recent passing submissions (not already confirmed as evidence) ──

  const since = new Date()
  since.setDate(since.getDate() - LOOKBACK_DAYS)

  // Collect already-confirmed evidence to avoid duplicates
  const [confirmedEhcp, confirmedIlp] = await Promise.all([
    ehcpOutcomes.length > 0
      ? prisma.homeworkEhcpEvidence.findMany({
          where: {
            outcomeId: { in: ehcpOutcomes.map(o => o.id) },
            reviewStatus: { in: ['confirmed', 'pending'] },
          },
          select: { submissionId: true, outcomeId: true },
        })
      : Promise.resolve([]),
    ilpTargets.length > 0
      ? prisma.ilpEvidenceEntry.findMany({
          where: {
            ilpTargetId: { in: ilpTargets.map(t => t.id) },
            studentId,
          },
          select: { submissionId: true, ilpTargetId: true },
        })
      : Promise.resolve([]),
  ])

  const confirmedEhcpSet = new Set(confirmedEhcp.map(e => `${e.outcomeId}:${e.submissionId}`))
  const confirmedIlpSet  = new Set(confirmedIlp.map(e => `${e.ilpTargetId}:${e.submissionId}`))

  const submissions = await prisma.submission.findMany({
    where: {
      homework: { schoolId },
      studentId,
      status:      { in: ['MARKED', 'RETURNED'] },
      submittedAt: { gte: since },
      finalScore:  { not: null },
    },
    select: {
      id: true,
      finalScore: true,
      submittedAt: true,
      homework: { select: { title: true, class: { select: { subject: true } } } },
    },
    orderBy: { submittedAt: 'desc' },
    take: MAX_SUBMISSIONS,
  })

  // Filter to passing grades only
  const passingSubmissions = submissions.filter(s => {
    if (s.finalScore == null) return false
    // finalScore is on 0-9 scale for GCSE
    return s.finalScore >= MIN_GRADE
  })

  if (passingSubmissions.length === 0) {
    const knowledge = fallbackKnowledge('No passing submissions in lookback window')
    await saveSnapshot(studentId, schoolId, AgentType.EVIDENCE, knowledge, inOneWeek())
    return knowledge
  }

  // ── 3. Build previous snapshot state ─────────────────────────────────────

  const prev = await getSnapshot(studentId, AgentType.EVIDENCE) as EvidenceKnowledge | null
  const previousPending = prev?.pendingMatches ?? []

  // ── 4. AI matching call ───────────────────────────────────────────────────

  const subsText = passingSubmissions.map((s, i) =>
    `SUB-${i + 1}: "${s.homework.title}" | Subject: ${s.homework.class?.subject ?? 'N/A'} | Grade: ${s.finalScore} | Date: ${s.submittedAt?.toLocaleDateString('en-GB') ?? 'unknown'} | id: ${s.id}`
  ).join('\n')

  const ehcpText = ehcpOutcomes.length > 0
    ? ehcpOutcomes.map((o, i) => `EHCP-${i + 1}: [§${o.section}] ${o.outcomeText} | id: ${o.id}`).join('\n')
    : '(none)'

  const ilpText = ilpTargets.length > 0
    ? ilpTargets.map((t, i) => `ILP-${i + 1}: ${t.target} | id: ${t.id}`).join('\n')
    : '(none)'

  const prompt = `You are a UK SEND specialist reviewing homework evidence for a SEND student's support plans.

HOMEWORK SUBMISSIONS (graded, recent ${LOOKBACK_DAYS} days):
${subsText}

ACTIVE EHCP OUTCOMES:
${ehcpText}

ACTIVE ILP TARGETS:
${ilpText}

For each submission, identify whether it provides meaningful evidence toward any EHCP outcome or ILP target.
Only flag HIGH or MEDIUM confidence matches. Skip weak/irrelevant links.

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "matches": [
    {
      "submissionRef": "SUB-1",
      "submissionId": "<exact id from above>",
      "planRef": "EHCP-2",
      "planId": "<exact id from above>",
      "planType": "EHCP",
      "confidence": "HIGH",
      "rationale": "One sentence explaining the evidence link."
    }
  ]
}

If no meaningful matches: {"matches": []}`

  const newMatches: EvidenceMatch[] = []

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages:   [{ role: 'user', content: prompt }],
    })
    const text = (msg.content[0] as { type: string; text: string }).text.trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
    const parsed = JSON.parse(text)

    if (Array.isArray(parsed.matches)) {
      for (const m of parsed.matches) {
        const sid = m.submissionId as string
        const pid = m.planId       as string
        const ptype = m.planType   as 'EHCP' | 'ILP'
        const conf  = m.confidence as 'HIGH' | 'MEDIUM' | 'LOW'
        const rationale = m.rationale as string

        if (!sid || !pid || !ptype || !conf || !rationale) continue

        // Skip already-confirmed or pending
        const dupKey = `${pid}:${sid}`
        if (ptype === 'EHCP' && confirmedEhcpSet.has(dupKey)) continue
        if (ptype === 'ILP'  && confirmedIlpSet.has(dupKey))  continue

        // Skip if already pending in previous snapshot (avoid duplicate inserts)
        const alreadyPending = previousPending.some(p => p.targetId === pid && p.submissionId === sid)
        if (alreadyPending) continue

        newMatches.push({ type: ptype, targetId: pid, submissionId: sid, rationale, confidence: conf })
      }
    }
  } catch (err) {
    console.error('[evidence-agent] AI call failed for student', studentId, err)
    // Fall through with empty newMatches — still save snapshot to avoid retry storms
  }

  // ── 5. Persist pending evidence records ──────────────────────────────────

  if (newMatches.length > 0) {
    for (const match of newMatches) {
      try {
        if (match.type === 'EHCP') {
          await prisma.homeworkEhcpEvidence.upsert({
            where:  { outcomeId_submissionId: { outcomeId: match.targetId, submissionId: match.submissionId } },
            create: {
              outcomeId:    match.targetId,
              submissionId: match.submissionId,
              teacherNote:  match.rationale,
              qualityRating: match.confidence === 'HIGH' ? 4 : 3,
              autoLinked:   true,
              reviewStatus: 'pending',
            },
            update: {}, // don't overwrite if already exists
          })
        } else {
          // ILP match — need submission detail for IlpEvidenceEntry
          const sub = passingSubmissions.find(s => s.id === match.submissionId)
          if (!sub) continue

          // Find a system user (SENCO) to be createdBy, or use studentId as fallback
          const senco = await prisma.user.findFirst({
            where:  { schoolId, role: 'SENCO' },
            select: { id: true },
          })

          await prisma.ilpEvidenceEntry.upsert({
            where:  { submissionId_ilpTargetId: { submissionId: match.submissionId, ilpTargetId: match.targetId } },
            create: {
              schoolId,
              studentId,
              ilpTargetId:  match.targetId,
              submissionId: match.submissionId,
              homeworkTitle: sub.homework.title,
              subject:      sub.homework.class?.subject ?? null,
              score:        sub.finalScore,
              evidenceType: 'PROGRESS',
              aiSummary:    match.rationale,
              autoLinked:   true,
              createdBy:    senco?.id ?? studentId,
            },
            update: {}, // don't overwrite confirmed entries
          })
        }
      } catch (err) {
        // Unique constraint violation = already exists — safe to ignore
        if (!(err as { code?: string }).code?.includes('P2002')) {
          console.error('[evidence-agent] Failed to persist match', match, err)
        }
      }
    }

    // Mark PLAN_SYNTHESIS dirty — it will re-evaluate coherence with new evidence
    void markDirty(studentId, schoolId, [AgentType.PLAN_SYNTHESIS]).catch(() => {})
  }

  // ── 6. Build and save knowledge ───────────────────────────────────────────

  const allPending = [
    ...previousPending.filter(p => {
      // Remove any that are now confirmed/dismissed
      const key = `${p.targetId}:${p.submissionId}`
      if (p.type === 'EHCP') return !confirmedEhcpSet.has(key)
      return true
    }),
    ...newMatches,
  ]

  const knowledge: EvidenceKnowledge = {
    pendingMatches:   allPending,
    confirmedCount:   confirmedEhcp.length + confirmedIlp.length,
    dismissedCount:   prev?.dismissedCount ?? 0,
    lastScannedAt:    new Date().toISOString(),
    summaryNarrative: buildNarrative(newMatches, allPending, confirmedEhcp.length + confirmedIlp.length),
  }

  await saveSnapshot(studentId, schoolId, AgentType.EVIDENCE, knowledge, inOneWeek())
  return knowledge
}

// ── Batch runner (called by cron) ─────────────────────────────────────────────

/**
 * Process all dirty EVIDENCE snapshots for a school.
 * Returns count of students processed.
 */
export async function runEvidenceAgentBatch(schoolId: string): Promise<number> {
  const studentIds = await getDirtyStudentIds(schoolId, AgentType.EVIDENCE)
  if (studentIds.length === 0) return 0

  let processed = 0
  const BATCH = 3  // haiku calls, but still rate-limit

  for (let i = 0; i < studentIds.length; i += BATCH) {
    const chunk = studentIds.slice(i, i + BATCH)
    await Promise.allSettled(
      chunk.map(sid => runEvidenceAgent(sid, schoolId))
    )
    processed += chunk.length
    if (i + BATCH < studentIds.length) {
      await new Promise(r => setTimeout(r, 800))
    }
  }

  return processed
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fallbackKnowledge(reason: string): EvidenceKnowledge {
  return {
    pendingMatches:   [],
    confirmedCount:   0,
    dismissedCount:   0,
    lastScannedAt:    new Date().toISOString(),
    summaryNarrative: reason,
  }
}

function buildNarrative(
  newMatches: EvidenceMatch[],
  allPending: EvidenceMatch[],
  confirmedCount: number,
): string {
  const parts: string[] = []
  if (newMatches.length > 0) {
    parts.push(`${newMatches.length} new evidence link${newMatches.length !== 1 ? 's' : ''} identified`)
  }
  if (allPending.length > 0) {
    parts.push(`${allPending.length} pending SENCO review`)
  }
  if (confirmedCount > 0) {
    parts.push(`${confirmedCount} confirmed`)
  }
  return parts.length > 0 ? parts.join('; ') + '.' : 'No evidence links found in recent submissions.'
}
