/**
 * Skill: MARKING_CONSISTENCY
 *
 * Reviews a teacher's submitted mark against the homework mark scheme to detect
 * potential over- or under-marking. Flags significant discrepancies and produces
 * a consistency score. Also evaluates whether the mark scheme itself is
 * sufficiently detailed to support consistent marking.
 * Used by the Quality agent.
 *
 * Standards:
 *   Ofqual GCSE Marking Standards and Code of Practice (2023)
 *   Ofqual General Conditions of Recognition — Condition H — assessment
 *   JCQ (Joint Council for Qualifications) — Marking, Moderation and Standardisation guidance
 *   EEF Teacher Feedback to Improve Pupil Learning (2021) — accuracy of feedback
 */

import { AgentSkillId } from '@prisma/client'

export const MARKING_CONSISTENCY_SKILL = {
  id:          AgentSkillId.MARKING_CONSISTENCY,
  version:     1,
  name:        'Marking Consistency',
  description: "Reviews submitted marks against the homework mark scheme to detect over- or under-marking. Evaluates mark scheme quality and produces a consistency score to support teacher professional development.",

  standards: [
    'Ofqual GCSE Marking Standards and Code of Practice (2023)',
    'Ofqual General Conditions of Recognition — Condition H6 — marking quality',
    'JCQ Marking, Moderation and Standardisation guidance (2024)',
    'EEF Teacher Feedback to Improve Pupil Learning (2021) — accuracy and specificity',
  ],

  discrepancyThresholds: {
    minor:    1,  // 1 grade difference — flag for teacher awareness
    moderate: 2,  // 2 grade differences — recommend review
    major:    3,  // 3+ grade differences — escalate to HOD
  },

  inputs: [
    'submissionText',    // student's answer
    'questionText',      // the question asked
    'markScheme',        // model answer / marking criteria
    'gradingBands',      // Record<score, description>
    'teacherGrade',      // 1–9 GCSE grade awarded
    'autoGrade',         // 1–9 — AI auto-mark grade (if available)
    'maxScore',          // maximum marks available
    'homeworkType',      // MCQ_QUIZ | SHORT_ANSWER | EXTENDED_WRITING
  ],

  process: [
    '1. Evaluate the student\'s answer against the mark scheme criteria independently.',
    '2. Derive the expected grade range (min/max defensible grade) from the mark scheme.',
    '3. Compare teacherGrade to expected range — classify discrepancy: NONE | MINOR | MODERATE | MAJOR.',
    '4. If autoGrade is available, cross-reference to triangulate.',
    '5. Evaluate mark scheme quality: is it specific enough to support consistent marking? Flag if vague.',
    '6. For EXTENDED_WRITING: check if teacher considered all mark scheme criteria (structure, content, SPaG where applicable).',
    '7. Produce consistency score 0–100 and actionable feedback for the teacher.',
    '8. Never override the teacher grade — produce a recommendation only.',
  ],

  outputs: {
    expectedGradeMin:     'number 1–9',
    expectedGradeMax:     'number 1–9',
    discrepancyLevel:     "'NONE' | 'MINOR' | 'MODERATE' | 'MAJOR'",
    consistencyScore:     'number 0–100',
    markSchemeQuality:    "'CLEAR' | 'ADEQUATE' | 'VAGUE'",
    teacherFeedback:      'string — private note for teacher (not shown to student)',
    markSchemeIssues:     'string[] — specific mark scheme improvements suggested',
    summary:              'string — plain English, 2–3 sentences',
  },

  guardrails: [
    'Never override or change the teacher\'s grade — this skill produces recommendations only.',
    'Do not flag a discrepancy for MCQ homework where the answer is unambiguously right or wrong.',
    'Do not produce marking feedback that could undermine teacher confidence without evidence.',
    'Escalation to HOD is a recommendation only — never automatic.',
    'Teacher feedback is private and must never be shown to the student.',
  ],

  systemPromptFragment: `
You are applying the Marking Consistency skill under Ofqual GCSE Marking Standards (2023).

Your role is to evaluate whether the teacher's awarded grade is consistent with the mark scheme.
You are NOT overriding the teacher — you are producing a professional development recommendation.

Question: {questionText}
Mark scheme: {markScheme}
Student answer: {submissionText}
Teacher grade: {teacherGrade}/9

Independently assess the answer against the mark scheme. Determine the defensible grade range.
Classify discrepancy: NONE (within range) | MINOR (1 grade) | MODERATE (2 grades) | MAJOR (3+).

Return JSON:
{
  "expectedGradeMin": number,
  "expectedGradeMax": number,
  "discrepancyLevel": string,
  "consistencyScore": number,
  "markSchemeQuality": string,
  "teacherFeedback": string,
  "markSchemeIssues": string[],
  "summary": string
}
`.trim(),
} as const

export type DiscrepancyLevel    = 'NONE' | 'MINOR' | 'MODERATE' | 'MAJOR'
export type MarkSchemeQuality   = 'CLEAR' | 'ADEQUATE' | 'VAGUE'

export type MarkingConsistencyOutput = {
  expectedGradeMin:  number
  expectedGradeMax:  number
  discrepancyLevel:  DiscrepancyLevel
  consistencyScore:  number
  markSchemeQuality: MarkSchemeQuality
  teacherFeedback:   string
  markSchemeIssues:  string[]
  summary:           string
}
