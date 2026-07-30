/**
 * lib/agents/skills/engagement-design.ts
 *
 * Engagement Design Skill
 *
 * Generates engagement-optimised homework suggestions for weak topics by
 * leveraging Oak National Academy curriculum data. Each suggestion includes:
 *   - 2-3 gamified MCQ questions with distractors rooted in known misconceptions
 *   - Key vocabulary to pre-teach before the task
 *   - A challenge/extension prompt to stretch higher-attaining students
 *   - A SEND-adaptive version of the core task
 *
 * Grounded in:
 *   - Education Endowment Foundation — Metacognition and Self-regulated Learning (2018)
 *   - Rosenshine's Principles of Instruction (2012) — P1, P2, P6
 *   - Oak National Academy curriculum content (open licence)
 *   - SEND CoP 2015 — §6.1–6.11 (adaptive task design)
 *   - Mayer (2009) — Multimedia Learning Theory (interleaved media + text)
 *   - Zull (2002) — The Art of Changing the Brain (emotional engagement hook)
 */

import { AgentSkillId } from '@prisma/client'

export type EngagementTask = {
  topic:             string      // the weak topic this package targets
  engagementHook:   string      // 1-sentence curiosity hook to open the task
  mcqQuestions:     Array<{
    question:         string
    options:          string[]   // A–D options; correct is first, shuffle on display
    correctIndex:     number     // 0-based index of correct answer after shuffle
    misconception:   string      // which misconception this question addresses
  }>
  preTeachVocab:    string[]    // "word: definition" pairs
  coreTask:         string      // 2-3 sentence focused retrieval/application task
  challengeTask:    string      // 1-2 sentence Bloom's Evaluate/Create extension
  sendAdaptation:   string      // how to scaffold for SEND students
  oakLessonSlugs:   string[]    // source Oak lessons used to generate this package
}

export type EngagementDesignOutput = {
  packages:          EngagementTask[]
  summaryNarrative: string
}

export const ENGAGEMENT_DESIGN_SKILL = {
  id:      AgentSkillId.ENGAGEMENT_DESIGN,
  version: 1,

  standards: [
    'EEF Metacognition and Self-regulated Learning (2018)',
    "Rosenshine's Principles of Instruction (2012) — P1, P2, P6",
    'Oak National Academy Open Curriculum Licence',
    'DfE SEND Code of Practice 2015 §§6.1–6.11',
    'Mayer — Multimedia Learning Theory (2009)',
  ],

  systemPromptFragment: `
ENGAGEMENT DESIGN SKILL (v1)
Authority: EEF Metacognition 2018 · Rosenshine P1/P2/P6 · Oak Curriculum Licence · SEND CoP 2015 §6.1
Principles:
  1. Begin every task with a curiosity hook — pose a surprising or relevant question that intrinsically motivates.
  2. Embed retrieval practice: tasks must require students to recall, not just re-read.
  3. Root MCQ distractors in known Oak curriculum misconceptions, not random wrong answers.
  4. Pre-teach vocabulary: surface 3-5 tier-2/tier-3 words BEFORE the task, with definitions.
  5. Offer a two-tier structure: a core retrieval task accessible to all + a Bloom's Evaluate/Create challenge.
  6. SEND adaptation: every package must include a sentence on how to scaffold the core task for the student's SEND need.
  7. Stay true to Oak lesson content — do not fabricate facts or concepts outside the Oak lesson material provided.
`,
} as const
