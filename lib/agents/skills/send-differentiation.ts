/**
 * Skill: SEND_DIFFERENTIATION
 *
 * Evaluates whether SEND adaptations in homework and revision content are
 * genuinely meaningful — not just simplified wording of the same task.
 * Checks scaffolding hints address the student's specific need area, and
 * that EHCP adaptations reflect the provisions in the student's plan.
 * Used by Quality, Coach, and Plan Synthesis agents.
 *
 * Standards:
 *   Equality Act 2010 s.20 — duty to make reasonable adjustments
 *   DfE SEND Code of Practice 2015 §§6.1–6.11 — graduated approach, high-quality teaching
 *   DfE SEND Code of Practice 2015 §§9.51–9.69 — EHCP outcomes and provisions
 *   EEF Special Educational Needs in Mainstream Schools (2020)
 */

import { AgentSkillId } from '@prisma/client'

export const SEND_DIFFERENTIATION_SKILL = {
  id:          AgentSkillId.SEND_DIFFERENTIATION,
  version:     1,
  name:        'SEND Differentiation Quality',
  description: "Evaluates whether SEND adaptations are genuinely targeted and meaningful. Checks that scaffolding hints address the student's specific need area, and that EHCP adaptations reflect stated provisions.",

  standards: [
    'Equality Act 2010 s.20 — reasonable adjustments duty',
    'DfE SEND Code of Practice 2015 §§6.1–6.11 — high-quality teaching as first response',
    'DfE SEND Code of Practice 2015 §§9.51–9.69 — EHCP outcomes and provisions',
    'EEF Special Educational Needs in Mainstream Schools (2020) — five-strand framework',
  ],

  needAreas: [
    'Communication and interaction',
    'Cognition and learning',
    'Social, emotional and mental health',
    'Sensory and physical needs',
  ],

  inputs: [
    'sendStatus',       // SEN_SUPPORT | EHCP
    'needArea',         // string — from SendStatus record
    'ilpTargets',       // string[] — active ILP target descriptions
    'ehcpProvisions',   // string[] — EHCP Section F provisions (if EHCP)
    'originalQuestion', // string — the base question
    'adaptedQuestion',  // string — the SEND-adapted version
    'scaffoldingHint',  // string | null
    'vocabSupport',     // string | null
  ],

  process: [
    '1. Identify the student\'s primary need area from sendStatus and needArea.',
    '2. Evaluate whether the adapted question meaningfully reduces barriers for that need area — not just shorter/simpler.',
    '3. Check the scaffolding hint gives structured support without revealing the answer.',
    '4. For EHCP students: verify the adaptation reflects at least one stated Section F provision.',
    '5. Check vocab support targets the specific vocabulary barriers for this need area.',
    '6. Score the adaptation 0–100: 0=no meaningful adaptation, 100=exemplary targeted support.',
    '7. Flag generic adaptations (e.g. "use simpler words") that do not address the specific need.',
    '8. Suggest improvements where score <60.',
  ],

  outputs: {
    adaptationScore:    'number 0–100',
    needAreaAddressed:  'boolean — adaptation addresses stated need area',
    ehcpAligned:        'boolean | null — null if not EHCP student',
    genericFlags:       'string[] — adaptations that are generic rather than targeted',
    improvements:       'string[] — specific suggested changes',
    summary:            'string — plain English, 2–3 sentences',
  },

  guardrails: [
    'Never accept a score >60 if the adaptation is the same question with simpler vocabulary only.',
    'Never flag an adaptation as generic solely because it is brief — brevity can be appropriate for some need areas.',
    'Do not recommend removing challenge — the goal is to remove barriers, not lower expectations (Equality Act s.20).',
    'Always reference the specific need area in feedback, never give generic SEND advice.',
  ],

  systemPromptFragment: `
You are applying the SEND Differentiation Quality skill under the Equality Act 2010 and DfE SEND Code of Practice 2015.

Student need area: {needArea}
SEND status: {sendStatus}
EHCP provisions (if applicable): {ehcpProvisions}

Evaluate whether the adapted question and scaffolding genuinely reduce barriers for this specific need area.
A score of 0 means no meaningful differentiation. A score of 100 means exemplary, targeted support.

Key test: could this adaptation apply to ANY student with ANY need, or is it specifically designed for this student's need area?
Generic = low score. Targeted = high score.

Return JSON:
{
  "adaptationScore": number,
  "needAreaAddressed": boolean,
  "ehcpAligned": boolean | null,
  "genericFlags": string[],
  "improvements": string[],
  "summary": string
}
`.trim(),
} as const

export type SendDifferentiationOutput = {
  adaptationScore:   number
  needAreaAddressed: boolean
  ehcpAligned:       boolean | null
  genericFlags:      string[]
  improvements:      string[]
  summary:           string
}
