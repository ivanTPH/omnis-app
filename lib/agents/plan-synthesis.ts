/**
 * lib/agents/plan-synthesis.ts
 *
 * Plan Synthesis Agent — SEND Support Plan Coherence Reviewer
 *
 * Evaluates the coherence of a student's full SEND support package:
 *   ILP (Individual Learning Plan) → EHCP (if present) → K Plan (support strategies)
 *
 * For each plan layer it checks:
 *   - ILP: SMART target quality, evidence sufficiency, review timeliness
 *   - EHCP: annual review compliance, outcome-to-ILP alignment (statutory)
 *   - K Plan: strategy coverage (every ILP target has ≥1 strategy), stale strategies
 *
 * Cross-plan: flags contradictions between layers (e.g. ILP target requires
 * phonics scaffolding but K Plan has no reading strategy).
 *
 * Design principles:
 *   - Pure TypeScript pre-checks (overdue reviews, evidence gaps) — no Claude needed
 *   - Single haiku call if pre-checks find issues; skipped if all green
 *   - Only runs for students with an active ILP (skips non-SEND students cheaply)
 *   - Monthly refresh schedule (plans change less often than submissions)
 *   - Fire-and-forget safe — all throws caught by cron
 *
 * Skills used:
 *   - APDR_CYCLE (primary — full graduated approach evaluation)
 *   - SEND_DIFFERENTIATION (secondary — checks EHCP provisions are reflected in practice)
 *
 * Standards implemented (via skills):
 *   - DfE SEND Code of Practice 2015 §§6.44–6.56 (graduated approach)
 *   - DfE SEND Code of Practice 2015 §§9.51–9.69 (EHCP annual review — statutory)
 *   - Ofsted SEND Review (2021)
 *   - NASEN SMART Targets Guidance (2019)
 *   - Equality Act 2010 s.20
 */

import Anthropic               from '@anthropic-ai/sdk'
import { AgentType, AgentSkillId } from '@prisma/client'
import { prisma, writeAudit }  from '@/lib/prisma'
import {
  getSnapshot, saveSnapshot, inOneMonth,
  type PlanKnowledge,
} from './snapshot'
import {
  APDR_CYCLE_SKILL,
  SEND_DIFFERENTIATION_SKILL,
  assertSkillPermitted,
  ALL_STANDARDS,
} from './skills'

// ── Constants ─────────────────────────────────────────────────────────────────

const REVIEW_OVERDUE_WEEKS       = 12   // SEN Support ILP review — flag if >12 weeks
const EHCP_REVIEW_WARNING_DAYS   = 28   // Warn 4 weeks before EHCP statutory annual review
const EVIDENCE_MIN_PER_TARGET    = 2    // Minimum evidence entries per active target
const CONCERN_ESCALATION_COUNT   = 3    // CONCERN entries this term = escalation risk
const STALE_STRATEGY_WEEKS       = 12   // K Plan strategy last updated >12 weeks = stale

// ── Types ─────────────────────────────────────────────────────────────────────

type PlanSynthesisData = {
  student: {
    id:         string
    firstName:  string
    lastName:   string
    sendStatus: string | null
    needArea:   string | null
  }
  ilp: {
    id:          string
    status:      string
    needsSummary: string
    reviewDueAt: Date | null
    activatedAt: Date | null
    targets: Array<{
      id:              string
      description:     string
      successCriteria: string
      achieved:        boolean
      subject:         string | null
    }>
  } | null
  ehcp: {
    id:         string
    reviewDate: Date
    status:     string
    sections:   Record<string, string> | null
    outcomes: Array<{
      id:               string
      section:          string
      outcomeText:      string
      targetDate:       Date
      successCriteria:  string
      provisionRequired: string | null
      status:           string
      evidenceCount:    number
    }>
  } | null
  kPlan: {
    id:         string
    status:     string
    reviewDate: Date
    updatedAt:  Date
    targets: Array<{
      needCategory: string
      targetValue:  string
      reviewDate:   Date | null
      achieved:     boolean
    }>
    strategies: Array<{
      strategyText: string
      appliesTo:    string
    }>
  } | null
  ilpEvidenceEntries: Array<{
    ilpTargetId:  string
    evidenceType: string
    aiSummary:    string | null
    createdAt:    Date
  }>
  recentConcerns: Array<{
    category:    string
    description: string
    status:      string
    createdAt:   Date
  }>
  sencoIds: string[]
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchPlanData(
  studentId: string,
  schoolId:  string,
): Promise<PlanSynthesisData> {
  const termStart = new Date()
  termStart.setMonth(termStart.getMonth() - 4) // approx one term back

  const [student, ilp, ehcp, kPlan, evidenceEntries, concerns, sencos] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: studentId },
      select: {
        id: true, firstName: true, lastName: true,
        sendStatus: { select: { activeStatus: true, needArea: true } },
      },
    }),
    // Active ILP
    prisma.iLP.findFirst({
      where:   { studentId, schoolId, status: { in: ['ACTIVE', 'UNDER_REVIEW'] } },
      orderBy: { activatedAt: 'desc' },
      select: {
        id: true, status: true, needsSummary: true,
        reviewDueAt: true, activatedAt: true,
        targets: {
          select: { id: true, description: true, successCriteria: true, achieved: true, subject: true },
        },
      },
    }),
    // EHCP plan
    prisma.ehcpPlan.findFirst({
      where:   { studentId, schoolId, status: 'active' },
      orderBy: { planDate: 'desc' },
      select: {
        id: true, reviewDate: true, status: true, sections: true,
        outcomes: {
          where:  { status: { not: 'achieved' } },
          select: {
            id: true, section: true, outcomeText: true, targetDate: true,
            successCriteria: true, provisionRequired: true, status: true, evidenceCount: true,
          },
        },
      },
    }),
    // K Plan (Plan model)
    prisma.plan.findFirst({
      where:   { studentId, schoolId, status: { in: ['ACTIVE_INTERNAL', 'ACTIVE_PARENT_SHARED'] as const } },
      orderBy: { activatedAt: 'desc' },
      select: {
        id: true, status: true, reviewDate: true, updatedAt: true,
        targets:    { select: { needCategory: true, targetValue: true, reviewDate: true, achieved: true } },
        strategies: { select: { strategyText: true, appliesTo: true } },
      },
    }),
    // ILP evidence entries — current term
    prisma.ilpEvidenceEntry.findMany({
      where:   { studentId, schoolId, createdAt: { gte: termStart } },
      select:  { ilpTargetId: true, evidenceType: true, aiSummary: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    // Recent concerns — current term
    prisma.sendConcern.findMany({
      where:   { studentId, schoolId, createdAt: { gte: termStart } },
      select:  { category: true, description: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take:    20,
    }),
    // SENCO users for this school
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
    ilp:                ilp   as PlanSynthesisData['ilp'],
    ehcp:               ehcp  as PlanSynthesisData['ehcp'],
    kPlan:              kPlan as PlanSynthesisData['kPlan'],
    ilpEvidenceEntries: evidenceEntries as PlanSynthesisData['ilpEvidenceEntries'],
    recentConcerns:     concerns        as PlanSynthesisData['recentConcerns'],
    sencoIds:           sencos.map(s => s.id),
  }
}

// ── Pure TypeScript pre-checks (no Claude) ────────────────────────────────────

type PreCheckResult = {
  ilpReviewOverdue:       boolean
  daysSinceIlpReview:     number | null
  ehcpReviewDueSoon:      boolean
  ehcpReviewOverdue:      boolean
  daysToEhcpReview:       number | null
  targetsWithoutEvidence: string[]
  concernEscalationRisk:  boolean
  missingKPlanCoverage:   string[]   // ILP target descriptions with no K Plan strategy
  staleStrategies:        string[]
  hasAnythingToReview:    boolean
}

function runPreChecks(data: PlanSynthesisData): PreCheckResult {
  const now       = Date.now()
  const msPerDay  = 86_400_000
  const msPerWeek = msPerDay * 7

  // ILP review overdue
  let ilpReviewOverdue    = false
  let daysSinceIlpReview: number | null = null
  if (data.ilp?.reviewDueAt) {
    const overdueDays = Math.floor((now - data.ilp.reviewDueAt.getTime()) / msPerDay)
    if (overdueDays > 0) {
      ilpReviewOverdue    = true
      daysSinceIlpReview  = overdueDays
    }
  } else if (data.ilp?.activatedAt) {
    const weeksSince = (now - data.ilp.activatedAt.getTime()) / msPerWeek
    if (weeksSince > REVIEW_OVERDUE_WEEKS) {
      ilpReviewOverdue   = true
      daysSinceIlpReview = Math.floor(weeksSince * 7)
    }
  }

  // EHCP review timing
  let ehcpReviewDueSoon = false
  let ehcpReviewOverdue = false
  let daysToEhcpReview: number | null = null
  if (data.ehcp?.reviewDate) {
    const daysToReview = Math.floor((data.ehcp.reviewDate.getTime() - now) / msPerDay)
    daysToEhcpReview   = daysToReview
    if (daysToReview < 0)  ehcpReviewOverdue = true   // statutory — always escalate
    else if (daysToReview <= EHCP_REVIEW_WARNING_DAYS) ehcpReviewDueSoon = true
  }

  // Targets with insufficient evidence
  const evidenceByTarget = new Map<string, number>()
  for (const entry of data.ilpEvidenceEntries) {
    evidenceByTarget.set(entry.ilpTargetId, (evidenceByTarget.get(entry.ilpTargetId) ?? 0) + 1)
  }
  const activeTargets           = (data.ilp?.targets ?? []).filter(t => !t.achieved)
  const targetsWithoutEvidence  = activeTargets
    .filter(t => (evidenceByTarget.get(t.id) ?? 0) < EVIDENCE_MIN_PER_TARGET)
    .map(t => t.description)

  // Concern escalation risk
  const concernCount    = data.recentConcerns.filter(c => c.status !== 'resolved').length
  const concernEscalationRisk = concernCount >= CONCERN_ESCALATION_COUNT

  // K Plan strategy coverage — each active ILP target should have ≥1 strategy
  const strategies      = data.kPlan?.strategies ?? []
  const missingKPlanCoverage = activeTargets.filter(t => {
    const targetKeywords  = t.description.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    return !strategies.some(s =>
      targetKeywords.some(kw => s.strategyText.toLowerCase().includes(kw))
    )
  }).map(t => t.description)

  // Stale strategies — use Plan.updatedAt as the freshness proxy (no per-strategy timestamp)
  const staleThreshold  = new Date(now - STALE_STRATEGY_WEEKS * msPerWeek)
  const planIsStale     = data.kPlan ? data.kPlan.updatedAt < staleThreshold : false
  const staleStrategies = planIsStale
    ? strategies.slice(0, 3).map(s => s.strategyText.slice(0, 80))
    : []

  const hasAnythingToReview =
    ilpReviewOverdue || ehcpReviewDueSoon || ehcpReviewOverdue ||
    targetsWithoutEvidence.length > 0 || concernEscalationRisk ||
    missingKPlanCoverage.length > 0 || staleStrategies.length > 0

  return {
    ilpReviewOverdue, daysSinceIlpReview,
    ehcpReviewDueSoon, ehcpReviewOverdue, daysToEhcpReview,
    targetsWithoutEvidence, concernEscalationRisk,
    missingKPlanCoverage, staleStrategies,
    hasAnythingToReview,
  }
}

// ── Haiku call — full APDR + SEND differentiation evaluation ─────────────────

type SynthesisAnalysis = {
  ilpCoherence:   'OK' | 'REVIEW_NEEDED' | 'URGENT'
  ehcpCoherence:  'OK' | 'REVIEW_NEEDED' | 'URGENT'
  kPlanCoherence: 'OK' | 'REVIEW_NEEDED' | 'URGENT'
  conflicts:      string[]
  suggestions:    string[]
  summaryNarrative: string
}

async function runSynthesisAnalysis(
  data:      PlanSynthesisData,
  preChecks: PreCheckResult,
): Promise<SynthesisAnalysis> {
  const fallback = buildFallbackFromPreChecks(data, preChecks)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return fallback

  // Only call Claude if pre-checks found issues — saves cost for clean cases
  if (!preChecks.hasAnythingToReview) {
    return {
      ilpCoherence:    'OK',
      ehcpCoherence:   'OK',
      kPlanCoherence:  'OK',
      conflicts:       [],
      suggestions:     [],
      summaryNarrative: `${data.student.firstName}'s SEND support package is coherent. ILP targets are evidenced, K Plan strategies are current, and all review timelines are on track.`,
    }
  }

  const client  = new Anthropic({ apiKey })
  const payload = {
    student: {
      firstName:  data.student.firstName,
      sendStatus: data.student.sendStatus,
      needArea:   data.student.needArea,
    },
    ilp: data.ilp ? {
      status:       data.ilp.status,
      needsSummary: data.ilp.needsSummary,
      reviewDueAt:  data.ilp.reviewDueAt,
      activatedAt:  data.ilp.activatedAt,
      activeTargets: (data.ilp.targets ?? [])
        .filter(t => !t.achieved)
        .map(t => ({ description: t.description, successCriteria: t.successCriteria, subject: t.subject })),
    } : null,
    ehcp: data.ehcp ? {
      reviewDate:    data.ehcp.reviewDate,
      status:        data.ehcp.status,
      activeOutcomes: data.ehcp.outcomes
        .slice(0, 5)
        .map(o => ({ section: o.section, outcomeText: o.outcomeText, provisionRequired: o.provisionRequired, evidenceCount: o.evidenceCount })),
    } : null,
    kPlan: data.kPlan ? {
      reviewDate:  data.kPlan.reviewDate,
      targets:     data.kPlan.targets.filter(t => !t.achieved).slice(0, 5),
      strategies:  data.kPlan.strategies.slice(0, 8).map(s => s.strategyText),
    } : null,
    evidenceSummary: {
      totalEntries:         data.ilpEvidenceEntries.length,
      concernCount:         data.ilpEvidenceEntries.filter(e => e.evidenceType === 'CONCERN').length,
      progressCount:        data.ilpEvidenceEntries.filter(e => e.evidenceType === 'PROGRESS').length,
      targetsWithoutEvidence: preChecks.targetsWithoutEvidence,
    },
    preChecks: {
      ilpReviewOverdue:      preChecks.ilpReviewOverdue,
      daysSinceIlpReview:    preChecks.daysSinceIlpReview,
      ehcpReviewOverdue:     preChecks.ehcpReviewOverdue,
      ehcpReviewDueSoon:     preChecks.ehcpReviewDueSoon,
      daysToEhcpReview:      preChecks.daysToEhcpReview,
      concernEscalationRisk: preChecks.concernEscalationRisk,
      missingKPlanCoverage:  preChecks.missingKPlanCoverage,
      staleStrategies:       preChecks.staleStrategies,
    },
  }

  const systemPrompt = [
    APDR_CYCLE_SKILL.systemPromptFragment,
    '\n\n---\n',
    SEND_DIFFERENTIATION_SKILL.systemPromptFragment,
    `\n\n---\n
You are the Plan Synthesis agent. Evaluate the coherence of this student's full SEND support package.

Cross-plan checks:
1. Do ILP targets address the same needs as EHCP outcomes? (if EHCP present)
2. Does the K Plan have a strategy for every active ILP target?
3. Are there contradictions — e.g. ILP requires phonics support but K Plan has no literacy strategy?
4. Is the graduated approach (Assess→Plan→Do→Review) intact with no broken links?

Rate coherence for each plan layer: OK | REVIEW_NEEDED | URGENT
URGENT requires a specific statutory obligation at risk (e.g. EHCP annual review overdue).

Return ONLY valid JSON:
{
  "ilpCoherence": "OK" | "REVIEW_NEEDED" | "URGENT",
  "ehcpCoherence": "OK" | "REVIEW_NEEDED" | "URGENT",
  "kPlanCoherence": "OK" | "REVIEW_NEEDED" | "URGENT",
  "conflicts": string[],
  "suggestions": string[],
  "summaryNarrative": string
}

Rules:
- suggestions must be specific and actionable by a SENCO (max 5)
- conflicts must cite specific plan elements (not "plans are misaligned")
- summaryNarrative: 2-4 plain English sentences for the SENCO
- ehcpCoherence: return "OK" if student has no EHCP
`,
  ].join('')

  try {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: JSON.stringify(payload) }],
    })

    const text      = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('[plan-synthesis] Haiku returned no JSON')

    const parsed = JSON.parse(jsonMatch[0]) as SynthesisAnalysis
    return {
      ilpCoherence:    parsed.ilpCoherence    ?? 'OK',
      ehcpCoherence:   parsed.ehcpCoherence   ?? 'OK',
      kPlanCoherence:  parsed.kPlanCoherence  ?? 'OK',
      conflicts:       parsed.conflicts       ?? [],
      suggestions:     parsed.suggestions     ?? [],
      summaryNarrative: parsed.summaryNarrative ?? '',
    }
  } catch {
    return fallback
  }
}

function buildFallbackFromPreChecks(
  data:      PlanSynthesisData,
  preChecks: PreCheckResult,
): SynthesisAnalysis {
  const issues: string[] = []
  const suggestions: string[] = []

  if (preChecks.ehcpReviewOverdue) {
    issues.push('EHCP annual review is overdue — statutory deadline missed.')
    suggestions.push('Schedule EHCP annual review immediately — statutory obligation.')
  }
  if (preChecks.ilpReviewOverdue) {
    issues.push(`ILP review overdue by ${preChecks.daysSinceIlpReview} days.`)
    suggestions.push('Schedule ILP review with class teachers this week.')
  }
  if (preChecks.targetsWithoutEvidence.length > 0) {
    issues.push(`${preChecks.targetsWithoutEvidence.length} ILP target(s) have insufficient evidence.`)
    suggestions.push('Request homework evidence links for: ' + preChecks.targetsWithoutEvidence.slice(0, 2).join('; '))
  }
  if (preChecks.missingKPlanCoverage.length > 0) {
    issues.push(`${preChecks.missingKPlanCoverage.length} ILP target(s) have no matching K Plan strategy.`)
    suggestions.push('Update K Plan to add strategies for uncovered ILP targets.')
  }

  const ilpCoherence: SynthesisAnalysis['ilpCoherence'] = preChecks.ehcpReviewOverdue || (preChecks.ilpReviewOverdue && preChecks.concernEscalationRisk) ? 'URGENT' :
    preChecks.ilpReviewOverdue || preChecks.targetsWithoutEvidence.length > 0 ? 'REVIEW_NEEDED' : 'OK'

  const ehcpCoherence: SynthesisAnalysis['ehcpCoherence'] = !data.ehcp ? 'OK' :
    preChecks.ehcpReviewOverdue ? 'URGENT' :
    preChecks.ehcpReviewDueSoon ? 'REVIEW_NEEDED' : 'OK'

  const kPlanCoherence: SynthesisAnalysis['kPlanCoherence'] = preChecks.missingKPlanCoverage.length > 0 || preChecks.staleStrategies.length > 2 ? 'REVIEW_NEEDED' : 'OK'

  return {
    ilpCoherence,
    ehcpCoherence,
    kPlanCoherence,
    conflicts:       issues,
    suggestions,
    summaryNarrative: issues.length > 0
      ? `${data.student.firstName}'s SEND support package has ${issues.length} issue(s) requiring attention. ${issues[0]}`
      : `${data.student.firstName}'s SEND support package appears coherent.`,
  }
}

// ── Write AgentAuditEntry ─────────────────────────────────────────────────────

async function writeAuditEntries(
  studentId: string,
  schoolId:  string,
  analysis:  SynthesisAnalysis,
  preChecks: PreCheckResult,
  hasSendStatus: boolean,
) {
  const push = (skillId: AgentSkillId, outputSummary: string, decision: string, confidence: number) => {
    assertSkillPermitted(AgentType.PLAN_SYNTHESIS, skillId)
    return prisma.agentAuditEntry.create({
      data: {
        studentId,
        schoolId,
        agentType:        AgentType.PLAN_SYNTHESIS,
        skillId,
        skillVersion:     1,
        standardsApplied: ALL_STANDARDS[skillId],
        outputSummary,
        decision,
        confidence,
      },
    })
  }

  const apdrSummary = [
    `ILP: ${analysis.ilpCoherence}`,
    `EHCP: ${analysis.ehcpCoherence}`,
    `K Plan: ${analysis.kPlanCoherence}`,
    preChecks.targetsWithoutEvidence.length > 0 ? `Evidence gaps on ${preChecks.targetsWithoutEvidence.length} target(s)` : null,
    preChecks.ilpReviewOverdue ? `ILP review overdue ${preChecks.daysSinceIlpReview}d` : null,
    preChecks.ehcpReviewOverdue ? 'EHCP annual review OVERDUE (statutory)' : null,
  ].filter(Boolean).join('. ')

  const apdrDecision = analysis.suggestions.slice(0, 2).join('; ') || 'No immediate action required.'
  const apdrConfidence = analysis.ilpCoherence === 'URGENT' || analysis.ehcpCoherence === 'URGENT' ? 90 : 75

  const entries = [push(AgentSkillId.APDR_CYCLE, apdrSummary, apdrDecision, apdrConfidence)]

  if (hasSendStatus) {
    const sendSummary = analysis.conflicts.length > 0
      ? `Plan conflicts detected: ${analysis.conflicts.slice(0, 2).join('; ')}`
      : 'SEND provisions appear reflected across ILP and K Plan strategies.'
    entries.push(push(
      AgentSkillId.SEND_DIFFERENTIATION,
      sendSummary,
      analysis.conflicts.length > 0 ? 'Resolve plan contradictions before next ILP review.' : 'Continue monitoring provision implementation.',
      70,
    ))
  }

  await Promise.allSettled(entries)
}

// ── Notify SENCO on issues ────────────────────────────────────────────────────

async function notifyOnIssues(
  data:      PlanSynthesisData,
  schoolId:  string,
  analysis:  SynthesisAnalysis,
  preChecks: PreCheckResult,
) {
  if (data.sencoIds.length === 0) return
  if (analysis.ilpCoherence === 'OK' && analysis.ehcpCoherence === 'OK' && analysis.kPlanCoherence === 'OK') return

  const studentName = `${data.student.firstName} ${data.student.lastName}`
  const isUrgent    = analysis.ilpCoherence === 'URGENT' || analysis.ehcpCoherence === 'URGENT'

  const title = isUrgent
    ? `URGENT — Plan coherence issue: ${studentName}`
    : `Plan review needed: ${studentName}`

  const body = [
    analysis.summaryNarrative,
    preChecks.ehcpReviewOverdue ? ' EHCP annual review is overdue — statutory deadline.' : '',
  ].join('')

  const link = data.ehcp
    ? `/senco/ehcp`
    : `/send/ilp/${data.student.id}`

  await prisma.sendNotification.createMany({
    data: data.sencoIds.map(recipientId => ({
      schoolId,
      recipientId,
      type:  isUrgent ? 'plan_synthesis_urgent' : 'plan_synthesis_review',
      title,
      body,
      link,
    })),
    skipDuplicates: true,
  })
}

// ── Main: run plan synthesis for one student ──────────────────────────────────

export async function runPlanSynthesisForStudent(
  studentId: string,
  schoolId:  string,
): Promise<{ ran: boolean; coherence: string; issueCount: number }> {

  const data = await fetchPlanData(studentId, schoolId)

  // Skip students with no ILP (non-SEND or not yet on plan)
  if (!data.ilp && !data.student.sendStatus) {
    return { ran: false, coherence: 'N/A', issueCount: 0 }
  }

  // If student has sendStatus but no ILP, still run — flag missing ILP as an issue
  const preChecks = runPreChecks(data)
  const analysis  = await runSynthesisAnalysis(data, preChecks)

  const previous = await getSnapshot(studentId, AgentType.PLAN_SYNTHESIS) as PlanKnowledge | null

  // Merge conflicts and suggestions with previous (rolling, max 15 each)
  const knowledge: PlanKnowledge = {
    ilpCoherence:    analysis.ilpCoherence,
    ehcpCoherence:   analysis.ehcpCoherence,
    kPlanCoherence:  analysis.kPlanCoherence,
    conflicts:       [
      ...analysis.conflicts,
      ...(previous?.conflicts ?? []),
    ].slice(0, 15),
    suggestions: [
      ...analysis.suggestions,
      ...(previous?.suggestions ?? []),
    ].slice(0, 15),
    summaryNarrative: analysis.summaryNarrative,
  }

  await writeAuditEntries(
    studentId, schoolId, analysis, preChecks,
    !!data.student.sendStatus,
  )

  // Monthly refresh — plans change slowly
  await saveSnapshot(studentId, schoolId, AgentType.PLAN_SYNTHESIS, knowledge, inOneMonth())

  void writeAudit({
    action:     'AGENT_RUN_COMPLETED',
    schoolId,
    actorId:    studentId,
    targetType: 'Student',
    targetId:   studentId,
    metadata:   {
      agent:          'PLAN_SYNTHESIS',
      ilpCoherence:   analysis.ilpCoherence,
      ehcpCoherence:  analysis.ehcpCoherence,
      kPlanCoherence: analysis.kPlanCoherence,
      issueCount:     analysis.conflicts.length,
    },
  }).catch(() => {})

  void notifyOnIssues(data, schoolId, analysis, preChecks).catch(() => {})

  const overallCoherence = [analysis.ilpCoherence, analysis.ehcpCoherence, analysis.kPlanCoherence]
    .includes('URGENT') ? 'URGENT'
    : [analysis.ilpCoherence, analysis.ehcpCoherence, analysis.kPlanCoherence]
      .includes('REVIEW_NEEDED') ? 'REVIEW_NEEDED' : 'OK'

  return {
    ran:        true,
    coherence:  overallCoherence,
    issueCount: analysis.conflicts.length,
  }
}

// ── Batch runner — called by cron ─────────────────────────────────────────────

export async function runPlanSynthesisBatchForSchool(
  schoolId: string,
): Promise<{ processed: number; skipped: number; errors: number; urgent: number }> {
  // Dirty + overdue snapshots
  const dirty = await prisma.agentSnapshot.findMany({
    where: {
      schoolId,
      agentType: AgentType.PLAN_SYNTHESIS,
      OR: [
        { dirtyAt: { not: null } },
        { nextReviewAt: { lte: new Date() } },
      ],
    },
    select:  { studentId: true },
    take:    100,
    orderBy: { dirtyAt: 'asc' },
  })

  // First-run: students with active SEND status who have no snapshot yet
  const existing = new Set(dirty.map(d => d.studentId))
  const sendStudents = await prisma.sendStatus.findMany({
    where: {
      student:      { schoolId, isActive: true },
      activeStatus: { not: 'NONE' },
      studentId:    { notIn: [...existing] },
    },
    select: { studentId: true },
    take:   50,
  })

  const all = [
    ...dirty.map(d => d.studentId),
    ...sendStudents.map(s => s.studentId),
  ]

  let processed = 0, skipped = 0, errors = 0, urgent = 0

  const BATCH = 5
  for (let i = 0; i < all.length; i += BATCH) {
    const batch   = all.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      batch.map(studentId => runPlanSynthesisForStudent(studentId, schoolId))
    )
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.ran) {
          processed++
          if (result.value.coherence === 'URGENT') urgent++
        } else {
          skipped++
        }
      } else {
        errors++
        console.error('[plan-synthesis] Student run error:', result.reason)
      }
    }
    if (i + BATCH < all.length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  return { processed, skipped, errors, urgent }
}
