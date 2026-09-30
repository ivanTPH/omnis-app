/**
 * Which schools the overnight AI jobs may run for.
 *
 * The nightly agents (coach, quality, plan synthesis, engage, evidence) and
 * the AI part of the adaptive-profile refresh call the paid AI API once per
 * pupil. Running them for demo and synthetic test schools spent almost all
 * the API credit before any real pupil was on the platform (about 14,000
 * runs in September 2026, ~99% on demo/test data).
 *
 * They now run only for schools where a platform admin has switched on the
 * "ai_agents" feature flag (Platform admin → Schools → Feature flags). Off by
 * default, so new, demo and test schools never incur overnight AI cost.
 * Staff-initiated AI (e.g. "Generate homework") is not affected.
 */
import { prisma } from '@/lib/prisma'

export const AI_AGENTS_FLAG = 'ai_agents'

/** Active schools with overnight AI jobs switched on. */
export async function getAiAgentSchools(): Promise<{ id: string; name: string }[]> {
  return prisma.school.findMany({
    where: {
      isActive: true,
      featureFlags: { some: { flag: AI_AGENTS_FLAG, enabled: true } },
    },
    select: { id: true, name: true },
  })
}

export async function schoolHasAiAgents(schoolId: string): Promise<boolean> {
  const flag = await prisma.schoolFeatureFlag.findUnique({
    where: { schoolId_flag: { schoolId, flag: AI_AGENTS_FLAG } },
    select: { enabled: true },
  })
  return !!flag?.enabled
}

/**
 * Days (UTC, 0=Sunday) on which the high-volume pupil agents (coach, quality,
 * engage) run. Default Monday, Wednesday and Friday: each pupil's new work is
 * batched into one analysis, which roughly halves the AI cost compared with
 * nightly runs while keeping insights at most two days old. Override with
 * AGENT_RUN_DAYS, e.g. "0,1,2,3,4,5,6" for nightly. SEND plan and evidence
 * checks are low-volume and still run every night.
 */
export function isAgentRunDay(now = new Date()): boolean {
  const raw = process.env.AGENT_RUN_DAYS ?? '1,3,5'
  const days = raw.split(',').map(d => parseInt(d.trim(), 10)).filter(n => n >= 0 && n <= 6)
  return days.includes(now.getUTCDay())
}
