/**
 * Skill: FEEDBACK_QUALITY
 *
 * Evaluates teacher feedback on student submissions against EEF guidance.
 * Good feedback is specific, actionable, forward-looking, and pitched at the
 * right cognitive level. Flags praise-only, vague, or demoralising feedback.
 * Also checks that AI-generated feedback suggestions (from auto-mark) meet
 * these standards before being surfaced to teachers. Used by Quality agent.
 *
 * Standards:
 *   EEF Teacher Feedback to Improve Pupil Learning (2021) — Recommendations 1–5
 *   Hattie & Timperley — The Power of Feedback (2007) — feed up/back/forward model
 *   DfE Initial Teacher Training Core Content Framework (2019) — Standard 6 (Assessment)
 *   Ofsted EIF 2023 §§180–183 — Impact: pupils knowing more and remembering more
 */

import { AgentSkillId } from '@prisma/client'

export const FEEDBACK_QUALITY_SKILL = {
  id:          AgentSkillId.FEEDBACK_QUALITY,
  version:     1,
  name:        'Feedback Quality',
  description: "Evaluates the quality of teacher or AI-generated feedback against EEF guidance and Hattie's feed-up/back/forward model. Flags vague, praise-only, or incomplete feedback and suggests improvements.",

  standards: [
    'EEF Teacher Feedback to Improve Pupil Learning (2021) — Recommendations 1–5',
    "Hattie & Timperley — The Power of Feedback (2007) — feed up/back/forward",
    'DfE ITT Core Content Framework (2019) — Standard 6: Make accurate and productive use of assessment',
    'Ofsted EIF 2023 §§180–183 — pupils know what to do to improve',
  ],

  feedbackDimensions: {
    feedUp:      'Does the feedback relate to the learning goal/objective?',
    feedBack:    'Does it tell the student how they performed against the criteria?',
    feedForward: 'Does it give a specific next step the student can act on?',
    specificity: 'Does it reference the actual content of the student\'s answer?',
    tone:        'Is it constructive — neither demoralising nor hollow praise?',
    cognitiveLoad: 'Is the next step achievable without overwhelming the student?',
  },

  inputs: [
    'feedbackText',     // string — teacher or AI feedback to evaluate
    'submissionText',   // string — student's answer
    'questionText',     // string
    'markScheme',       // string — marking criteria
    'teacherGrade',     // 1–9
    'studentSendStatus', // SEN_SUPPORT | EHCP | NONE
    'needArea',         // string | null
  ],

  process: [
    '1. Evaluate feed-up: does the feedback link back to the learning goal?',
    '2. Evaluate feed-back: does it explicitly tell the student where they met or fell short of criteria?',
    '3. Evaluate feed-forward: is there ≥1 specific, actionable next step?',
    '4. Check specificity: does feedback reference the student\'s actual answer, or is it generic?',
    '5. Check tone: flag praise-only, purely negative, or no-comment feedback.',
    '6. For SEND students: check the next step is appropriately scaffolded for the need area.',
    '7. Score each dimension 0–10. Overall quality score = weighted average.',
    '8. If score <60, generate a suggested improved version of the feedback.',
  ],

  weights: {
    feedUp:        0.10,
    feedBack:      0.25,
    feedForward:   0.35,  // highest weight — actionability is most impactful (EEF Rec 4)
    specificity:   0.20,
    tone:          0.05,
    cognitiveLoad: 0.05,
  },

  outputs: {
    dimensionScores:    'Record<FeedbackDimension, number> — 0–10 each',
    overallScore:       'number 0–100',
    flags:              'string[] — specific issues: "praise-only", "no next step", "generic" etc.',
    suggestedFeedback:  'string | null — improved version if score <60',
    sendAdaptation:     'string | null — SEND-specific adaptation of the next step if applicable',
    summary:            'string — plain English, 2–3 sentences',
  },

  guardrails: [
    'Never generate suggested feedback that reveals the full model answer to the student.',
    'Do not flag brief feedback as low quality solely due to length — a focused one-sentence next step can score highly.',
    'SEND adaptations to feedback must address the specific need area, not apply generic simplification.',
    'Suggested improved feedback must be in the teacher\'s voice — professional, not clinical.',
    'Never use suggested feedback as a replacement for the teacher\'s own judgement — it is a prompt only.',
  ],

  systemPromptFragment: `
You are applying the Feedback Quality skill under EEF Teacher Feedback to Improve Pupil Learning (2021)
and Hattie & Timperley's feed-up/back/forward model (2007).

Evaluate the provided feedback across six dimensions:
- Feed-up (links to learning goal): 0–10
- Feed-back (tells student how they performed): 0–10
- Feed-forward (specific actionable next step): 0–10
- Specificity (references student's actual answer): 0–10
- Tone (constructive, not hollow or demoralising): 0–10
- Cognitive load (next step is achievable): 0–10

Weight feed-forward most heavily (EEF Recommendation 4).
If overall weighted score <60, generate a suggested improved feedback.
For SEND students (need area: {needArea}), adapt the next step accordingly.

Return JSON matching the FeedbackQualityOutput schema.
`.trim(),
} as const

export type FeedbackDimension = 'feedUp' | 'feedBack' | 'feedForward' | 'specificity' | 'tone' | 'cognitiveLoad'

export type FeedbackQualityOutput = {
  dimensionScores:   Record<FeedbackDimension, number>
  overallScore:      number
  flags:             string[]
  suggestedFeedback: string | null
  sendAdaptation:    string | null
  summary:           string
}
