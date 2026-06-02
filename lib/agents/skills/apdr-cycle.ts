/**
 * Skill: APDR_CYCLE
 *
 * Evaluates coherence of a student's SEND support cycle — Assess, Plan, Do,
 * Review — as defined by the DfE SEND Code of Practice 2015. Checks that ILP
 * targets are SMART, K Plan strategies are being implemented, EHCP provisions
 * are reflected in classroom practice, and reviews are timely.
 * Used exclusively by the Plan Synthesis agent.
 *
 * Standards:
 *   DfE SEND Code of Practice 2015 §§6.44–6.56 — graduated approach
 *   DfE SEND Code of Practice 2015 §§9.51–9.69 — EHCP outcomes and review
 *   Ofsted SEND Review (2021) — what good SEND provision looks like
 *   NASEN (National Association for Special Educational Needs) — SMART targets guidance
 */

import { AgentSkillId } from '@prisma/client'

export const APDR_CYCLE_SKILL = {
  id:          AgentSkillId.APDR_CYCLE,
  version:     1,
  name:        'Graduated Approach — APDR Cycle',
  description: 'Evaluates the coherence and completeness of the SEND graduated approach for a student. Checks SMART target quality, strategy implementation, EHCP alignment, and review timeliness.',

  standards: [
    'DfE SEND Code of Practice 2015 §§6.44–6.56 — graduated approach: Assess, Plan, Do, Review',
    'DfE SEND Code of Practice 2015 §§9.51–9.69 — EHCP annual review requirements',
    'Ofsted SEND Review (2021) — identifying need, provision, and impact',
    'NASEN SMART Targets Guidance (2019)',
  ],

  smartCriteria: {
    Specific:    'Target describes a precise skill or behaviour, not a vague aspiration',
    Measurable:  'Progress can be observed or evidenced with homework, assessment, or observation data',
    Achievable:  'Target is realistic within the review period given the student\'s starting point',
    Relevant:    'Target addresses the student\'s identified need area',
    TimeBound:   'Target has a clear review date',
  },

  inputs: [
    'ilpTargets',       // Array<{ description, status, createdAt, reviewDate? }>
    'ilpEvidenceEntries', // Array<{ classification, createdAt, summary }>
    'kPlanActions',     // Array<{ action, strategy, appliesTo, status }>
    'ehcpOutcomes',     // Array<{ description, section, targetDate? }> | null
    'ehcpReviewDate',   // Date | null
    'sendStatus',       // SEN_SUPPORT | EHCP
    'concernEntries',   // Array<{ type, createdAt }> — recent flagged concerns
    'lastIlpReviewAt',  // Date | null
  ],

  process: [
    // ASSESS
    '1. Check there is sufficient assessment data (ILP evidence entries) to inform the plan — minimum 2 entries per active target.',
    '2. Check recent concern entries — 3+ CONCERN classifications in term = escalation risk.',
    // PLAN
    '3. Evaluate each ILP target against SMART criteria — score each dimension.',
    '4. Check targets are specific to identified need area, not generic.',
    '5. For EHCP students: verify ILP targets are derived from EHCP Section B/E outcomes.',
    // DO
    '6. Check K Plan strategies are active and not stale (updated within last term).',
    '7. Cross-reference K Plan strategies against ILP targets — every active target should have at least one K Plan strategy.',
    '8. Flag targets with active status but zero evidence entries (Plan exists, Do is missing).',
    // REVIEW
    '9. Check ILP review is not overdue (>12 weeks since last review for SEN Support; EHCP annual review statutory).',
    '10. Assess overall coherence: Assess → Plan → Do → Review chain has no broken links.',
  ],

  outputs: {
    assessPhase: {
      evidenceSufficiency:  "'SUFFICIENT' | 'INSUFFICIENT' | 'MISSING'",
      escalationRisk:       'boolean',
    },
    planPhase: {
      smartScores:          'Array<{ targetDescription: string; specific: boolean; measurable: boolean; achievable: boolean; relevant: boolean; timeBound: boolean; overallScore: number }>',
      ehcpAlignment:        "'ALIGNED' | 'PARTIAL' | 'NOT_APPLICABLE'",
    },
    doPhase: {
      strategiesCoverage:   'boolean — every active target has ≥1 K Plan strategy',
      staleStrategies:      'string[]',
      targetsWithNoEvidence:'string[]',
    },
    reviewPhase: {
      reviewOverdue:        'boolean',
      daysSinceLastReview:  'number | null',
      ehcpReviewDue:        'boolean | null',
    },
    overallCoherence:       "'OK' | 'REVIEW_NEEDED' | 'URGENT'",
    conflicts:              'string[] — specific contradictions found',
    suggestions:            'string[] — recommended actions for SENCO',
    summary:                'string — plain English, 3–4 sentences',
  },

  guardrails: [
    'Never classify coherence as URGENT without identifying at least one specific statutory obligation at risk.',
    'Do not flag a target as non-SMART based on brevity alone — a short target can be SMART.',
    'EHCP annual review deadlines are statutory — always escalate if overdue, never downgrade.',
    'K Plan strategy staleness threshold is one term (approximately 12 weeks) — do not flag more recently.',
    'Suggestions must be actionable by a SENCO, not generic "improve monitoring" statements.',
  ],

  systemPromptFragment: `
You are applying the DfE Graduated Approach APDR Cycle skill (SEND Code of Practice 2015 §§6.44–6.56).

Student SEND status: {sendStatus}
Last ILP review: {lastIlpReviewAt}
EHCP review date: {ehcpReviewDate}

Evaluate the four phases in order:
ASSESS → PLAN → DO → REVIEW

For each phase, check the specific criteria in the skill definition.
Classify overall coherence as OK | REVIEW_NEEDED | URGENT.
URGENT requires a specific statutory obligation to be at risk.

Return JSON matching the APDRCycleOutput schema.
`.trim(),
} as const

export type APDRCoherence = 'OK' | 'REVIEW_NEEDED' | 'URGENT'

export type APDRCycleOutput = {
  assessPhase: {
    evidenceSufficiency:   'SUFFICIENT' | 'INSUFFICIENT' | 'MISSING'
    escalationRisk:        boolean
  }
  planPhase: {
    smartScores:           Array<{ targetDescription: string; specific: boolean; measurable: boolean; achievable: boolean; relevant: boolean; timeBound: boolean; overallScore: number }>
    ehcpAlignment:         'ALIGNED' | 'PARTIAL' | 'NOT_APPLICABLE'
  }
  doPhase: {
    strategiesCoverage:    boolean
    staleStrategies:       string[]
    targetsWithNoEvidence: string[]
  }
  reviewPhase: {
    reviewOverdue:         boolean
    daysSinceLastReview:   number | null
    ehcpReviewDue:         boolean | null
  }
  overallCoherence:        APDRCoherence
  conflicts:               string[]
  suggestions:             string[]
  summary:                 string
}
