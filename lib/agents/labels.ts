/**
 * lib/agents/labels.ts
 *
 * Plain-language labels for AgentType / AgentSkillId, for surfaces where a
 * non-technical reader (a parent, a DPO, an inspector) needs to see what
 * produced an AI-assisted suggestion — not the internal enum name.
 *
 * Used by the XAI explainability feature (see dspy-service/XAI.md,
 * docs/audit/2026-08-27-dspy-agent-skill-optimization.md): the per-decision
 * explanation renderer and the student AI-journey summary both read from
 * these maps rather than hardcoding labels inline, so a copy change only
 * needs to happen in one place.
 */
import { AgentType, AgentSkillId } from '@prisma/client'

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  [AgentType.COACH]:          'Coach',
  [AgentType.QUALITY]:        'Quality',
  [AgentType.PLAN_SYNTHESIS]: 'Plan Synthesis',
  [AgentType.EVIDENCE]:       'Evidence',
  [AgentType.ENGAGE]:         'Engage',
}

export const AGENT_TYPE_DESCRIPTIONS: Record<AgentType, string> = {
  [AgentType.COACH]:          'helps plan retrieval-practice and question sets aligned to curriculum standards',
  [AgentType.QUALITY]:        'checks marking consistency and feedback quality against curriculum standards',
  [AgentType.PLAN_SYNTHESIS]: 'drafts and reviews assess-plan-do-review (APDR) cycle targets',
  [AgentType.EVIDENCE]:       'selects and adapts SEND evidence for a student’s plan',
  [AgentType.ENGAGE]:         'designs engagement and retrieval-spacing activities',
}

export const AGENT_SKILL_LABELS: Record<AgentSkillId, string> = {
  [AgentSkillId.CURRICULUM_ALIGNMENT]:  'Curriculum alignment',
  [AgentSkillId.BLOOMS_ANALYSIS]:       "Bloom's taxonomy analysis",
  [AgentSkillId.SEND_DIFFERENTIATION]:  'SEND differentiation',
  [AgentSkillId.RETRIEVAL_SPACING]:     'Retrieval spacing',
  [AgentSkillId.MARKING_CONSISTENCY]:   'Marking consistency',
  [AgentSkillId.APDR_CYCLE]:            'Assess-plan-do-review (APDR) cycle',
  [AgentSkillId.FEEDBACK_QUALITY]:      'Feedback quality',
  [AgentSkillId.ENGAGEMENT_DESIGN]:     'Engagement design',
}

export const REVIEW_OUTCOME_LABELS: Record<string, string> = {
  CONFIRMED:  'confirmed it as-is',
  OVERRIDDEN: 'edited it before use',
  DISMISSED:  'dismissed it — no action taken',
}
