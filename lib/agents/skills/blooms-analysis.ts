/**
 * Skill: BLOOMS_ANALYSIS
 *
 * Classifies questions by Bloom's Revised Taxonomy cognitive level and checks
 * the distribution is appropriate for the homework type and year group.
 * Good homework should include multiple levels — over-reliance on pure recall
 * is flagged. Used by Quality and Coach agents.
 *
 * Standards:
 *   Anderson & Krathwohl — Revised Bloom's Taxonomy (2001)
 *   EEF Cognitive Science Approaches in the Classroom (2021)
 *   Ofsted EIF 2023 §§177–179 — Implementation: curriculum sequencing
 */

import { AgentSkillId } from '@prisma/client'

export const BLOOMS_ANALYSIS_SKILL = {
  id:          AgentSkillId.BLOOMS_ANALYSIS,
  version:     1,
  name:        "Bloom's Taxonomy Analysis",
  description: "Classifies each question by Bloom's Revised Taxonomy level and evaluates whether the cognitive demand distribution is appropriate for the year group and homework type.",

  standards: [
    "Anderson & Krathwohl — A Taxonomy for Learning, Teaching and Assessing (2001)",
    'EEF Cognitive Science Approaches in the Classroom (2021) — retrieval and elaboration',
    'Ofsted EIF 2023 §§177–179 — sequencing to build towards more complex knowledge',
  ],

  levels: {
    REMEMBER:   'Recall facts, definitions, key vocabulary',
    UNDERSTAND:  'Explain concepts, summarise, paraphrase',
    APPLY:       'Use knowledge in a new context, solve problems',
    ANALYSE:     'Break down, compare, contrast, distinguish',
    EVALUATE:    'Judge, critique, justify, defend a position',
    CREATE:      'Produce, design, construct a new response',
  },

  inputs: [
    'questions',    // string[] — question texts
    'yearGroup',    // 7–13 — affects expected distribution
    'homeworkType', // MCQ_QUIZ | SHORT_ANSWER | EXTENDED_WRITING | MIXED
  ],

  process: [
    '1. Classify each question into exactly one Bloom\'s level (Remember/Understand/Apply/Analyse/Evaluate/Create).',
    '2. Calculate the distribution — percentage of questions at each level.',
    '3. Apply year-group expectations: KS3 (Y7–9) should have ≥30% Apply+; KS4 (Y10–11) ≥40% Analyse+; KS5 ≥30% Evaluate+.',
    '4. Flag if >60% of questions are at Remember/Understand (over-reliance on recall).',
    '5. Flag if there are zero questions above Apply level for KS4/KS5.',
    '6. For MCQ homework: flag if all questions are Remember-only — MCQs can and should test higher levels.',
    '7. Produce a recommended redistribution if gaps are found.',
  ],

  outputs: {
    classifications: 'Array<{ question: string; level: BloomsLevel; rationale: string }>',
    distribution:    'Record<BloomsLevel, number> — percentage at each level',
    passesThreshold: 'boolean — meets year-group expectations',
    flags:           'string[] — specific issues found',
    recommendation:  'string | null — suggested fix if threshold not met',
    summary:         'string — plain English, 2–3 sentences',
  },

  guardrails: [
    "Never classify a question as Create unless it genuinely requires the student to produce something original.",
    'Do not penalise a predominantly Remember-level quiz for KS3 early-term retrieval practice — context matters.',
    'Always provide a rationale for each classification, not just a label.',
  ],

  systemPromptFragment: `
You are applying the Bloom's Revised Taxonomy Analysis skill. Classify each question into one of:
REMEMBER | UNDERSTAND | APPLY | ANALYSE | EVALUATE | CREATE.

For each question provide a one-sentence rationale. Then calculate the percentage distribution.
Apply these thresholds for year group {yearGroup}:
- KS3 (Y7–9): at least 30% of questions should be at Apply level or above
- KS4 (Y10–11): at least 40% should be at Analyse level or above
- KS5 (Y12–13): at least 30% should be at Evaluate level or above

Flag any issues. Recommend specific changes if thresholds are not met.

Return JSON:
{
  "classifications": [{ "question": string, "level": string, "rationale": string }],
  "distribution": { "REMEMBER": number, "UNDERSTAND": number, "APPLY": number, "ANALYSE": number, "EVALUATE": number, "CREATE": number },
  "passesThreshold": boolean,
  "flags": string[],
  "recommendation": string | null,
  "summary": string
}
`.trim(),
} as const

export type BloomsLevel = 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYSE' | 'EVALUATE' | 'CREATE'

export type BloomsAnalysisOutput = {
  classifications: Array<{ question: string; level: BloomsLevel; rationale: string }>
  distribution:    Record<BloomsLevel, number>
  passesThreshold: boolean
  flags:           string[]
  recommendation:  string | null
  summary:         string
}
