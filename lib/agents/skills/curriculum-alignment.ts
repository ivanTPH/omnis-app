/**
 * Skill: CURRICULUM_ALIGNMENT
 *
 * Maps homework and revision content to National Curriculum attainment targets
 * for the relevant subject and year group. Verifies cognitive demand and
 * vocabulary are age-appropriate. Used by Quality and Coach agents.
 *
 * Standards:
 *   DfE National Curriculum (2014, updated 2023)
 *   Ofqual GCSE Subject-Level Conditions and Requirements
 *   Ofsted EIF 2023 — Quality of Education: Intent
 */

import { AgentSkillId } from '@prisma/client'

export const CURRICULUM_ALIGNMENT_SKILL = {
  id:          AgentSkillId.CURRICULUM_ALIGNMENT,
  version:     1,
  name:        'Curriculum Alignment',
  description: 'Verifies that homework and assessment content is correctly aligned to National Curriculum attainment targets for the subject and year group.',

  standards: [
    'DfE National Curriculum 2014 (updated 2023) — subject attainment targets',
    'Ofqual GCSE Subject-Level Conditions — Assessment Objectives',
    'Ofsted EIF 2023 §§174–176 — Intent: ambitious, sequenced curriculum',
  ],

  inputs: [
    'subject',          // e.g. "English Literature"
    'yearGroup',        // 7–13
    'lessonObjectives', // string[]
    'questions',        // generated question texts
    'keyVocabulary',    // string[] from lesson
  ],

  process: [
    '1. Identify the National Curriculum programme of study for the subject and year group.',
    '2. Map each question to a specific attainment target or GCSE Assessment Objective.',
    '3. Check vocabulary complexity is appropriate for the year group (no unexplained KS4 terms in KS3 content).',
    '4. Flag any question that cannot be mapped to an attainment target — these are out-of-scope.',
    '5. Check that questions collectively address the lesson objectives — no objective should be entirely untested.',
    '6. Produce an alignment score 0–100 and a list of gaps.',
  ],

  outputs: {
    alignmentScore:       'number 0–100',
    mappings:             'Array<{ question: string; attainmentTarget: string; assessmentObjective?: string }>',
    outOfScopeQuestions:  'string[] — questions with no curriculum mapping',
    untestedObjectives:   'string[] — lesson objectives with no covering question',
    vocabularyFlags:      'string[] — terms likely above year group level',
    summary:              'string — plain English, 2–3 sentences',
  },

  guardrails: [
    'Never accept a question set where >20% of questions are out of scope for the year group.',
    'Never accept a question set that leaves a core lesson objective entirely untested.',
    'Do not penalise appropriately challenging extension questions — flag but do not reject.',
  ],

  systemPromptFragment: `
You are applying the Curriculum Alignment skill. Your job is to verify that the provided questions
are correctly aligned to the National Curriculum for the subject and year group supplied.

For each question, identify the specific attainment target or GCSE Assessment Objective it addresses.
Flag any question that cannot be mapped. Check that collectively the questions cover all lesson objectives.
Check vocabulary is appropriate for Year {yearGroup}.

Return a JSON object matching this schema:
{
  "alignmentScore": number,          // 0-100
  "mappings": [{ "question": string, "attainmentTarget": string }],
  "outOfScopeQuestions": string[],
  "untestedObjectives": string[],
  "vocabularyFlags": string[],
  "summary": string
}
`.trim(),
} as const

export type CurriculumAlignmentOutput = {
  alignmentScore:      number
  mappings:            Array<{ question: string; attainmentTarget: string; assessmentObjective?: string }>
  outOfScopeQuestions: string[]
  untestedObjectives:  string[]
  vocabularyFlags:     string[]
  summary:             string
}
