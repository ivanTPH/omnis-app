/**
 * Skill: RETRIEVAL_SPACING
 *
 * Identifies knowledge gaps and retention risks based on a student's homework
 * and revision history. Applies spaced repetition science to recommend which
 * topics to revisit and when. Drives the Coach agent's homework adaptation.
 * Used exclusively by the Coach agent.
 *
 * Standards:
 *   Rosenshine's Principles of Instruction (2012) — Principles 3, 9, 10
 *   EEF Cognitive Science Approaches in the Classroom (2021) — retrieval practice, spacing
 *   Cepeda et al. (2006) — Distributed practice in verbal recall tasks (spacing effect)
 *   Ebbinghaus Forgetting Curve — practical thresholds: 14 days without retrieval = risk
 */

import { AgentSkillId } from '@prisma/client'

export const RETRIEVAL_SPACING_SKILL = {
  id:          AgentSkillId.RETRIEVAL_SPACING,
  version:     1,
  name:        'Retrieval Practice & Spaced Learning',
  description: 'Analyses a student\'s submission and revision history to identify weak topics, retention risks (topics not revisited within the spacing threshold), and recommends an interleaved retrieval practice schedule.',

  standards: [
    "Rosenshine's Principles of Instruction (2012) — P3: Ask many questions; P9: Weekly review; P10: Monthly review",
    'EEF Cognitive Science Approaches in the Classroom (2021) — retrieval practice and distributed practice',
    'Cepeda et al. (2006) — spacing effect thresholds for verbal recall',
    'Ebbinghaus Forgetting Curve — 14-day no-retrieval threshold for risk flagging',
  ],

  spacingThresholds: {
    retentionRiskDays:   14,  // topic not tested in 14+ days = retention risk
    weakTopicThreshold:  60,  // avg score <60% = weak topic
    strongTopicThreshold: 80, // avg score >80% = strong topic (reduce frequency)
    mastered:            90,  // avg score >90% over 3+ attempts = mastered
  },

  inputs: [
    'studentId',
    'recentSubmissions',   // Array<{ homeworkId, topic, score, submittedAt }>
    'revisionSessions',    // Array<{ topic, completedAt, confidenceRating }>
    'previousKnowledge',   // CoachKnowledge | null — cached state from last run
    'subject',
    'yearGroup',
  ],

  process: [
    '1. Build a topic × performance matrix from recentSubmissions and revisionSessions since lastRunAt.',
    '2. Identify weak topics: avg score <60% across ≥2 attempts.',
    '3. Identify retention risks: topics with avg score ≥60% but no retrieval in 14+ days.',
    '4. Identify strong topics: avg score >80% — reduce homework frequency, maintain monthly review.',
    '5. Detect Bloom\'s gaps per topic — student may recall but fail to apply (topic-level gap).',
    '6. Apply interleaving principle: recommended next homework should mix 1 new topic + 2 retrieval topics.',
    '7. Merge with previousKnowledge using delta update — do not re-analyse unchanged data.',
    '8. Produce prioritised list: up to 3 focus topics for next homework, ranked by gap severity.',
  ],

  outputs: {
    weakTopics:          'Array<{ topic: string; avgScore: number; attempts: number }>',
    retentionRisks:      'Array<{ topic: string; daysSinceLastRetrieval: number }>',
    strongTopics:        'string[]',
    masteredTopics:      'string[]',
    bloomsGapsByTopic:   'Record<string, BloomsLevel[]> — levels consistently missed per topic',
    recommendedFocus:    'Array<{ topic: string; reason: string; priority: 1|2|3 }>',
    interleaveSuggestion:'string — plain English recommendation for next homework structure',
    summary:             'string — 2–3 sentences for teacher/SENCO view',
  },

  guardrails: [
    'Never recommend removing a topic from homework because a student scored well once — require ≥3 attempts before classifying as mastered.',
    'Never flag a topic as weak from a single low score — require ≥2 data points.',
    'Do not recommend more than 3 focus topics per homework — overloading defeats the spacing benefit.',
    'Always distinguish between a topic not attempted and a topic attempted with low score.',
    'For SEND students, apply a reduced spacing threshold (10 days) to account for potential retrieval difficulties.',
  ],

  systemPromptFragment: `
You are applying the Retrieval Practice & Spaced Learning skill, grounded in Rosenshine's Principles
of Instruction (2012) and EEF Cognitive Science Approaches (2021).

Subject: {subject} | Year Group: {yearGroup}

Analyse the student's submission and revision history provided below. Identify:
1. Weak topics (avg score <60%, ≥2 attempts)
2. Retention risks (avg score ≥60% but no retrieval in 14+ days)
3. Strong topics (avg score >80%)
4. Bloom's level gaps per topic

Apply the interleaving principle: the next homework should include 1 new topic + 2 retrieval topics.
Prioritise by gap severity. Limit to 3 recommended focus topics.

Delta mode: only analyse records since {lastRunAt}. Merge with previous knowledge state provided.

Return JSON matching the RetrievalSpacingOutput schema.
`.trim(),
} as const

export type RetrievalSpacingOutput = {
  weakTopics:           Array<{ topic: string; avgScore: number; attempts: number }>
  retentionRisks:       Array<{ topic: string; daysSinceLastRetrieval: number }>
  strongTopics:         string[]
  masteredTopics:       string[]
  bloomsGapsByTopic:    Record<string, string[]>
  recommendedFocus:     Array<{ topic: string; reason: string; priority: 1 | 2 | 3 }>
  interleaveSuggestion: string
  summary:              string
}
