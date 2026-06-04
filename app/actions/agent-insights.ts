'use server'

/**
 * app/actions/agent-insights.ts
 *
 * Thin server action wrapper around AgentSnapshot for UI consumption.
 * Returns typed agent knowledge for a single student — used by StudentFilePanel,
 * StudentDeepDive, and SencoDashboard.
 */

import { requireAuth }  from '@/lib/session'
import { prisma }       from '@/lib/prisma'
import { AgentType }    from '@prisma/client'
import type { CoachKnowledge, QualityKnowledge, PlanKnowledge } from '@/lib/agents/snapshot'

export type AgentInsights = {
  coach:         CoachKnowledge  | null
  quality:       QualityKnowledge | null
  planSynthesis: PlanKnowledge   | null
  lastRunAt: {
    coach:         Date | null
    quality:       Date | null
    planSynthesis: Date | null
  }
}

export async function getAgentInsights(studentId: string): Promise<AgentInsights> {
  await requireAuth()

  const snaps = await prisma.agentSnapshot.findMany({
    where:  { studentId, agentType: { in: [AgentType.COACH, AgentType.QUALITY, AgentType.PLAN_SYNTHESIS] } },
    select: { agentType: true, knowledgeJson: true, lastRunAt: true },
  })

  const get = (type: AgentType) => snaps.find(s => s.agentType === type)

  const coachSnap  = get(AgentType.COACH)
  const qualSnap   = get(AgentType.QUALITY)
  const planSnap   = get(AgentType.PLAN_SYNTHESIS)

  return {
    coach:         coachSnap  ? coachSnap.knowledgeJson  as CoachKnowledge  : null,
    quality:       qualSnap   ? qualSnap.knowledgeJson   as QualityKnowledge : null,
    planSynthesis: planSnap   ? planSnap.knowledgeJson   as PlanKnowledge   : null,
    lastRunAt: {
      coach:         coachSnap?.lastRunAt  ?? null,
      quality:       qualSnap?.lastRunAt   ?? null,
      planSynthesis: planSnap?.lastRunAt   ?? null,
    },
  }
}

// ── School-level plan coherence alerts (for SENCO dashboard) ──────────────────

export type PlanCoherenceAlert = {
  studentId:      string
  studentName:    string
  ilpCoherence:   'OK' | 'REVIEW_NEEDED' | 'URGENT'
  ehcpCoherence:  'OK' | 'REVIEW_NEEDED' | 'URGENT'
  kPlanCoherence: 'OK' | 'REVIEW_NEEDED' | 'URGENT'
  summaryNarrative: string
  conflicts:      string[]
  suggestions:    string[]
  lastRunAt:      Date | null
}

export async function getPlanCoherenceAlerts(schoolId: string): Promise<PlanCoherenceAlert[]> {
  const snaps = await prisma.agentSnapshot.findMany({
    where:   { schoolId, agentType: AgentType.PLAN_SYNTHESIS },
    select:  { studentId: true, knowledgeJson: true, lastRunAt: true },
    orderBy: { lastRunAt: 'desc' },
    take:    50,
  })

  // Filter to only those with at least one non-OK coherence level
  const alerts = snaps
    .map(s => {
      const k = s.knowledgeJson as PlanKnowledge
      return { studentId: s.studentId, knowledge: k, lastRunAt: s.lastRunAt }
    })
    .filter(({ knowledge: k }) =>
      k.ilpCoherence !== 'OK' || k.ehcpCoherence !== 'OK' || k.kPlanCoherence !== 'OK'
    )

  if (alerts.length === 0) return []

  // Fetch student names
  const studentIds = alerts.map(a => a.studentId)
  const students   = await prisma.user.findMany({
    where:  { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true },
  })
  const nameMap = new Map(students.map(s => [s.id, `${s.firstName} ${s.lastName}`]))

  return alerts.map(({ studentId, knowledge: k, lastRunAt }) => ({
    studentId,
    studentName:    nameMap.get(studentId) ?? 'Unknown',
    ilpCoherence:   k.ilpCoherence,
    ehcpCoherence:  k.ehcpCoherence,
    kPlanCoherence: k.kPlanCoherence,
    summaryNarrative: k.summaryNarrative,
    conflicts:      k.conflicts ?? [],
    suggestions:    k.suggestions ?? [],
    lastRunAt,
  })).sort((a, b) => {
    // URGENT first, then REVIEW_NEEDED
    const score = (alert: PlanCoherenceAlert) =>
      (alert.ilpCoherence === 'URGENT' || alert.ehcpCoherence === 'URGENT' || alert.kPlanCoherence === 'URGENT') ? 2
        : 1
    return score(b) - score(a)
  })
}

// ── Pending recommendation review ─────────────────────────────────────────────

export type AgentRecommendation = {
  id:              string
  agentType:       string
  skillId:         string
  studentId:       string
  studentName:     string
  schoolId:        string
  outputSummary:   string
  decision:        string
  confidence:      number
  standardsApplied: string[]
  createdAt:       Date
  reviewOutcome:   string | null
  reviewedBy:      string | null
  reviewedAt:      Date | null
  reviewNote:      string | null
}

export async function getPendingAgentRecommendations(
  filter: 'pending' | 'reviewed' | 'all' = 'pending',
  page = 0,
  pageSize = 30,
): Promise<{ items: AgentRecommendation[]; total: number }> {
  const { schoolId } = await requireAuth()

  const where = {
    schoolId,
    ...(filter === 'pending'  ? { reviewOutcome: null }             : {}),
    ...(filter === 'reviewed' ? { reviewOutcome: { not: null } }    : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.agentAuditEntry.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip:  page * pageSize,
      take:  pageSize,
      select: {
        id: true, agentType: true, skillId: true, studentId: true, schoolId: true,
        outputSummary: true, decision: true, confidence: true,
        standardsApplied: true, createdAt: true,
        reviewOutcome: true, reviewedById: true, reviewedAt: true, reviewNote: true,
      },
    }),
    prisma.agentAuditEntry.count({ where }),
  ])

  if (rows.length === 0) return { items: [], total }

  const studentIds = [...new Set(rows.map(r => r.studentId))]
  const students   = await prisma.user.findMany({
    where:  { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true },
  })
  const nameMap = new Map(students.map(s => [s.id, `${s.firstName} ${s.lastName}`]))

  return {
    total,
    items: rows.map(r => ({
      ...r,
      studentName:      nameMap.get(r.studentId) ?? 'Unknown',
      standardsApplied: r.standardsApplied as string[],
      reviewOutcome:    r.reviewOutcome ?? null,
      reviewedBy:       r.reviewedById ?? null,
      reviewedAt:       r.reviewedAt ?? null,
      reviewNote:       r.reviewNote ?? null,
    })),
  }
}

export async function reviewAgentRecommendation(
  entryId:  string,
  outcome:  'CONFIRMED' | 'OVERRIDDEN' | 'DISMISSED',
  note?:    string,
): Promise<void> {
  const { id: userId, schoolId } = await requireAuth()

  const entry = await prisma.agentAuditEntry.findFirst({
    where: { id: entryId, schoolId },
    select: { id: true, agentType: true, studentId: true },
  })
  if (!entry) throw new Error('Recommendation not found')

  await prisma.agentAuditEntry.update({
    where: { id: entryId },
    data: {
      reviewOutcome: outcome,
      reviewedById:  userId,
      reviewedAt:    new Date(),
      reviewNote:    note ?? null,
    },
  })

  const { writeAudit } = await import('@/lib/prisma')
  await writeAudit({
    schoolId,
    actorId: userId,
    action: outcome === 'CONFIRMED'  ? 'AGENT_RECOMMENDATION_CONFIRMED'  as any
          : outcome === 'OVERRIDDEN' ? 'AGENT_RECOMMENDATION_OVERRIDDEN' as any
          :                           'AGENT_RECOMMENDATION_DISMISSED'   as any,
    targetId:   entryId,
    targetType: 'AgentAuditEntry',
    metadata:   { agentType: entry.agentType, studentId: entry.studentId },
  })
}
