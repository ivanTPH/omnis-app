/**
 * lib/agents/skills/index.ts
 *
 * Single source of truth for all agent skills.
 *
 * Skills are defined once and shared across agents. Each agent has a declared
 * set of permitted skills — it cannot call a skill outside its remit. This
 * prevents duplication of logic and enforces coherence across the system.
 *
 * Skill → Agent mapping (which agents may use which skills):
 *
 *   CURRICULUM_ALIGNMENT  → Quality, Coach
 *   BLOOMS_ANALYSIS       → Quality, Coach
 *   SEND_DIFFERENTIATION  → Quality, Coach, Plan Synthesis
 *   RETRIEVAL_SPACING     → Coach only
 *   MARKING_CONSISTENCY   → Quality only
 *   APDR_CYCLE            → Plan Synthesis only
 *   FEEDBACK_QUALITY      → Quality only
 *
 * Audit chain: every skill execution writes an AgentAuditEntry row with the
 * skill ID, version, standards applied, and the plain-English output summary.
 * This provides a complete, Ofsted-ready audit trail of all AI decisions.
 */

import { AgentType, AgentSkillId } from '@prisma/client'

export { CURRICULUM_ALIGNMENT_SKILL } from './curriculum-alignment'
export { BLOOMS_ANALYSIS_SKILL }      from './blooms-analysis'
export { SEND_DIFFERENTIATION_SKILL } from './send-differentiation'
export { RETRIEVAL_SPACING_SKILL }    from './retrieval-spacing'
export { MARKING_CONSISTENCY_SKILL }  from './marking-consistency'
export { APDR_CYCLE_SKILL }           from './apdr-cycle'
export { FEEDBACK_QUALITY_SKILL }     from './feedback-quality'

export type { CurriculumAlignmentOutput } from './curriculum-alignment'
export type { BloomsAnalysisOutput, BloomsLevel } from './blooms-analysis'
export type { SendDifferentiationOutput } from './send-differentiation'
export type { RetrievalSpacingOutput }    from './retrieval-spacing'
export type { MarkingConsistencyOutput, DiscrepancyLevel, MarkSchemeQuality } from './marking-consistency'
export type { APDRCycleOutput, APDRCoherence } from './apdr-cycle'
export type { FeedbackQualityOutput, FeedbackDimension } from './feedback-quality'

// ── Permitted skill sets per agent ────────────────────────────────────────────

export const AGENT_SKILLS: Record<AgentType, AgentSkillId[]> = {
  [AgentType.COACH]: [
    AgentSkillId.RETRIEVAL_SPACING,
    AgentSkillId.BLOOMS_ANALYSIS,
    AgentSkillId.CURRICULUM_ALIGNMENT,
    AgentSkillId.SEND_DIFFERENTIATION,
  ],
  [AgentType.QUALITY]: [
    AgentSkillId.CURRICULUM_ALIGNMENT,
    AgentSkillId.BLOOMS_ANALYSIS,
    AgentSkillId.SEND_DIFFERENTIATION,
    AgentSkillId.MARKING_CONSISTENCY,
    AgentSkillId.FEEDBACK_QUALITY,
  ],
  [AgentType.PLAN_SYNTHESIS]: [
    AgentSkillId.APDR_CYCLE,
    AgentSkillId.SEND_DIFFERENTIATION,
  ],
}

/** Runtime guard — throws if an agent attempts to use a skill outside its remit */
export function assertSkillPermitted(agent: AgentType, skill: AgentSkillId): void {
  if (!AGENT_SKILLS[agent].includes(skill)) {
    throw new Error(
      `Agent ${agent} is not permitted to use skill ${skill}. ` +
      `Permitted skills: ${AGENT_SKILLS[agent].join(', ')}`
    )
  }
}

// ── Standards registry — flat list for system-level audit queries ─────────────

export const ALL_STANDARDS: Record<AgentSkillId, string[]> = {
  [AgentSkillId.CURRICULUM_ALIGNMENT]: [
    'DfE National Curriculum 2014 (updated 2023)',
    'Ofqual GCSE Subject-Level Conditions',
    'Ofsted EIF 2023 §§174–176',
  ],
  [AgentSkillId.BLOOMS_ANALYSIS]: [
    "Anderson & Krathwohl — Revised Bloom's Taxonomy (2001)",
    'EEF Cognitive Science Approaches in the Classroom (2021)',
    'Ofsted EIF 2023 §§177–179',
  ],
  [AgentSkillId.SEND_DIFFERENTIATION]: [
    'Equality Act 2010 s.20',
    'DfE SEND Code of Practice 2015 §§6.1–6.11',
    'DfE SEND Code of Practice 2015 §§9.51–9.69',
    'EEF Special Educational Needs in Mainstream Schools (2020)',
  ],
  [AgentSkillId.RETRIEVAL_SPACING]: [
    "Rosenshine's Principles of Instruction (2012) — P3, P9, P10",
    'EEF Cognitive Science Approaches in the Classroom (2021)',
    'Cepeda et al. (2006) — spacing effect',
  ],
  [AgentSkillId.MARKING_CONSISTENCY]: [
    'Ofqual GCSE Marking Standards and Code of Practice (2023)',
    'Ofqual General Conditions of Recognition — Condition H6',
    'JCQ Marking, Moderation and Standardisation guidance (2024)',
  ],
  [AgentSkillId.APDR_CYCLE]: [
    'DfE SEND Code of Practice 2015 §§6.44–6.56',
    'DfE SEND Code of Practice 2015 §§9.51–9.69',
    'Ofsted SEND Review (2021)',
    'NASEN SMART Targets Guidance (2019)',
  ],
  [AgentSkillId.FEEDBACK_QUALITY]: [
    'EEF Teacher Feedback to Improve Pupil Learning (2021)',
    "Hattie & Timperley — The Power of Feedback (2007)",
    'DfE ITT Core Content Framework (2019) — Standard 6',
    'Ofsted EIF 2023 §§180–183',
  ],
}
