'use server'

/**
 * lib/agents/snapshot.ts
 *
 * Shared read/write/dirty-flag helpers for the AgentSnapshot model.
 *
 * All three agents (COACH, QUALITY, PLAN_SYNTHESIS) use this module to:
 *  - Read cached knowledge state (zero Claude calls at read time)
 *  - Mark a student's snapshot dirty when new data arrives
 *  - Record a completed agent run
 *  - Query which snapshots need processing (dirty or overdue)
 */

import { AgentType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type { AgentType }

// ── Types ────────────────────────────────────────────────────────────────────

/** Typed knowledge state stored per agent per student */
export type CoachKnowledge = {
  weakTopics:         string[]          // topics with <60% avg score
  strongTopics:       string[]          // topics with >80% avg score
  retentionRisk:      string[]          // topics not tested in >21 days
  bloomsGaps:         string[]          // Bloom's levels consistently missed
  recommendedFocus:   string[]          // next 1-3 topics to target
  lastHomeworkIds:    string[]          // submissions included in last run
  lastRevisionIds:    string[]          // revision sessions included in last run
  summaryNarrative:   string            // 2-3 sentence plain-English summary
}

export type QualityKnowledge = {
  lastCheckedHomeworkId: string
  issues:                string[]       // flagged quality issues
  bloomsBalance:         Record<string, number>  // level → question count
  sendAdaptationScore:   number         // 0-100 — how meaningfully adapted
  summaryNarrative:      string
}

export type PlanKnowledge = {
  ilpCoherence:     'OK' | 'REVIEW_NEEDED' | 'URGENT'
  ehcpCoherence:    'OK' | 'REVIEW_NEEDED' | 'URGENT'
  kPlanCoherence:   'OK' | 'REVIEW_NEEDED' | 'URGENT'
  conflicts:        string[]            // e.g. "ILP target contradicts K Plan strategy"
  suggestions:      string[]            // recommended plan updates
  summaryNarrative: string
}

export type AgentKnowledge = CoachKnowledge | QualityKnowledge | PlanKnowledge

// ── Read ─────────────────────────────────────────────────────────────────────

/** Returns the cached knowledge state or null if no snapshot exists yet */
export async function getSnapshot(
  studentId: string,
  agentType: AgentType,
): Promise<AgentKnowledge | null> {
  const snap = await prisma.agentSnapshot.findUnique({
    where: { studentId_agentType: { studentId, agentType } },
    select: { knowledgeJson: true },
  })
  if (!snap) return null
  return snap.knowledgeJson as AgentKnowledge
}

// ── Dirty flag ───────────────────────────────────────────────────────────────

/**
 * Mark a student's snapshot as dirty for one or more agent types.
 * Called fire-and-forget after marking, submissions, evidence entries, etc.
 * Uses upsert so it is safe to call even before a snapshot exists.
 */
export async function markDirty(
  studentId: string,
  schoolId:  string,
  agentTypes: AgentType[],
): Promise<void> {
  const now = new Date()
  await Promise.all(
    agentTypes.map(agentType =>
      prisma.agentSnapshot.upsert({
        where:  { studentId_agentType: { studentId, agentType } },
        create: { studentId, schoolId, agentType, dirtyAt: now },
        update: { dirtyAt: now },
      })
    )
  )
}

// ── Record completed run ─────────────────────────────────────────────────────

/** Called by each agent after a successful run to store new knowledge and clear dirty flag */
export async function saveSnapshot(
  studentId:    string,
  schoolId:     string,
  agentType:    AgentType,
  knowledge:    AgentKnowledge,
  nextReviewAt: Date,
): Promise<void> {
  const now = new Date()
  await prisma.agentSnapshot.upsert({
    where:  { studentId_agentType: { studentId, agentType } },
    create: {
      studentId,
      schoolId,
      agentType,
      knowledgeJson: knowledge as object,
      lastRunAt:     now,
      nextReviewAt,
    },
    update: {
      knowledgeJson: knowledge as object,
      lastRunAt:     now,
      nextReviewAt,
      // Clear dirty — this run has consumed the flag
      dirtyAt: null,
    },
  })
}

// ── Cron query ───────────────────────────────────────────────────────────────

/** Returns student IDs that need processing: dirty since last run OR overdue for periodic refresh */
export async function getDueSnapshots(
  schoolId:  string,
  agentType: AgentType,
  limit = 100,
): Promise<{ studentId: string; knowledgeJson: unknown; lastRunAt: Date | null }[]> {
  const now = new Date()
  return prisma.agentSnapshot.findMany({
    where: {
      schoolId,
      agentType,
      OR: [
        // Dirty: saveSnapshot clears dirtyAt to null, so any non-null dirtyAt = unprocessed
        { dirtyAt: { not: null } },
        // Overdue: periodic warm refresh regardless of dirty
        { nextReviewAt: { lte: now } },
      ],
    },
    select: { studentId: true, knowledgeJson: true, lastRunAt: true },
    orderBy: { dirtyAt: 'asc' },   // process most-stale first
    take: limit,
  })
}

/**
 * Lightweight version: returns just student IDs where dirtyAt > lastRunAt
 * Used by cron to build the work queue before fetching full data.
 */
export async function getDirtyStudentIds(
  schoolId:  string,
  agentType: AgentType,
): Promise<string[]> {
  const rows = await prisma.agentSnapshot.findMany({
    where: {
      schoolId,
      agentType,
      OR: [
        { dirtyAt: { not: null } },
        { nextReviewAt: { lte: new Date() } },
      ],
    },
    select: { studentId: true },
  })
  return rows.map((r: { studentId: string }) => r.studentId)
}

// ── Convenience: add week / month review windows ─────────────────────────────

export function inOneWeek(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d
}

export function inOneMonth(): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d
}
