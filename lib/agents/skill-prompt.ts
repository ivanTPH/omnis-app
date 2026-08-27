/**
 * lib/agents/skill-prompt.ts
 *
 * Consumes the DSPy weekly-optimization pipeline's output. The pipeline is a
 * separate Python service (see the project's DSPy integration docs) that reads
 * agent review outcomes/edit history, runs MIPROv2 against a metric blending
 * curriculum/SEND-quality alignment + teacher review outcome + edit distance,
 * and — only when a candidate beats both the hardcoded baseline and the
 * current active version by a margin — writes and promotes a new
 * AgentSkillVersion row (isActive=true, exactly one per (agentType, skillId)).
 *
 * This module is the app's only consumer of AgentSkillVersion. Every lookup
 * degrades gracefully to the existing hardcoded prompt when nothing has been
 * promoted yet (every skill starts here) — the app's request path never
 * depends on an active version existing. A bad promotion is a two-row flip to
 * roll back (isActive=false on it, isActive=true on the previous version), not
 * a code change.
 *
 * A skill shared by several agents (see lib/agents/skills/index.ts's AGENT_SKILLS
 * table — e.g. BLOOMS_ANALYSIS is used by both COACH and QUALITY) is optimized
 * independently per (agentType, skillId) pair on the DSPy side, so this same
 * function can resolve a different active version — or none — per calling agent,
 * even for the same skillId. Always pass the calling agent's own AgentType.
 *
 * One caveat carried over from the app side, not this module: lib/agents/
 * evidence-agent.ts writes no AgentAuditEntry rows at all, so the two skills
 * EVIDENCE owns (SEND_DIFFERENTIATION, APDR_CYCLE) will never accumulate
 * training data — and thus never get an optimized version — until that's fixed.
 * See docs/audit/2026-08-27-dspy-agent-skill-optimization.md.
 */

import { AgentType, AgentSkillId } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type ActiveSkillVersion = {
  version:        number
  instructions:   string
  demonstrations: unknown[]
}

async function lookupActiveVersion(
  agentType: AgentType,
  skillId:   AgentSkillId,
): Promise<ActiveSkillVersion | null> {
  const active = await prisma.agentSkillVersion.findFirst({
    where:  { agentType, skillId, isActive: true },
    select: { version: true, instructions: true, demonstrations: true },
  })
  if (!active) return null
  return {
    version:        active.version,
    instructions:   active.instructions,
    demonstrations: Array.isArray(active.demonstrations) ? active.demonstrations : [],
  }
}

export type ResolvedSkillFragment = {
  /** AgentSkillVersion.version if an optimized version is active, else 0 (hardcoded fallback). */
  version:  number
  /** The prompt text to use in place of the skill's hardcoded .systemPromptFragment. */
  fragment: string
}

/**
 * Resolves the prompt fragment to use for one (agentType, skillId) pair, and
 * the version number to stamp on the resulting AgentAuditEntry row. Pass the
 * skill's own hardcoded .systemPromptFragment as the fallback — used verbatim
 * when no optimized version has been promoted yet.
 */
export async function resolveSkillFragment(
  agentType:        AgentType,
  skillId:          AgentSkillId,
  fallbackFragment: string,
): Promise<ResolvedSkillFragment> {
  const active = await lookupActiveVersion(agentType, skillId)
  if (!active) return { version: 0, fragment: fallbackFragment }

  const demoBlock = active.demonstrations.length > 0
    ? `\n\nWorked examples from optimization:\n${JSON.stringify(active.demonstrations, null, 2)}`
    : ''
  return { version: active.version, fragment: `${active.instructions}${demoBlock}` }
}

/**
 * Resolves just the version number to stamp on an AgentAuditEntry row for
 * (agentType, skillId) — use this at the audit-write call site for a skill
 * whose prompt has no separate injectable fragment slot in the surrounding
 * agent's call (e.g. it's folded into shared prose rather than swapped
 * standalone), so there's nothing to resolveSkillFragment() for, but the
 * audit trail should still resolve to the version that was actually active
 * for this run.
 */
export async function resolveSkillVersion(
  agentType: AgentType,
  skillId:   AgentSkillId,
): Promise<number> {
  const active = await lookupActiveVersion(agentType, skillId)
  return active?.version ?? 0
}
