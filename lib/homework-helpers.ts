/**
 * Shared homework AI helpers — not a 'use server' file so types and sync functions
 * can be imported by both app/actions/homework.ts and the streaming route handler.
 */
import { HomeworkType } from '@prisma/client'

export type MCQQuestion = {
  q:           string
  options:     [string, string, string, string]
  correct:     number
  explanation: string
}

export type SAQuestion = {
  q:                 string
  modelAnswer:       string
  markScheme?:       string
  marks?:            number
  scaffolding_hint?: string
  ehcp_adaptation?:  string
  vocab_support?:    { term: string; definition: string }[]
}

export type ProposalResult = {
  type:                  HomeworkType
  instructions:          string
  modelAnswer:           string
  gradingBands:          Record<string, string>
  targetWordCount:       number
  questionsJson?:        { questions: MCQQuestion[] | SAQuestion[] }
  basedOnSchemeOfWork?:  boolean
}

/** Per-type JSON prompt suffix. */
export function buildTypePrompt(type: HomeworkType, subject: string, qualification: string): string {
  switch (type) {
    case 'MCQ_QUIZ':
      return `Generate exactly 10 multiple-choice questions directly testing the learning objectives above.
Spread questions across Bloom's taxonomy: 3 knowledge/recall, 3 understanding/application, 2 analysis, 2 evaluation.
Each question must have exactly 4 options (A/B/C/D). Include at least one "except" or "which of the following is NOT" style question to test critical thinking.

Return this exact JSON structure (questionsJson is required):
{
  "type": "MCQ_QUIZ",
  "instructions": "Quiz: [short title]\\n\\n1. [Q1 text]\\nA. [opt]\\nB. [opt]\\nC. [opt]\\nD. [opt]\\n\\n2. ...",
  "modelAnswer": "1. B – [1-sentence explanation]\\n2. ...",
  "gradingBands": {},
  "targetWordCount": 0,
  "questionsJson": {
    "questions": [
      {"q": "Question text", "options": ["Option A", "Option B", "Option C", "Option D"], "correct": 1, "explanation": "Why B is correct"},
      ...
    ]
  }
}`

    case 'SHORT_ANSWER':
      return `Generate exactly 6 short-answer questions directly testing the learning objectives above.
Spread questions across Bloom's taxonomy with explicit cognitive demands:
- Q1–Q2: Knowledge/recall (define, identify, describe key facts — 2–3 marks each)
- Q3–Q4: Understanding/application (explain why, how, give examples — 3–4 marks each)
- Q5–Q6: Analysis/evaluation (assess, compare, evaluate significance — 4–6 marks each)
Each question should require a proportionate response (recall: 2–3 sentences; analysis: 5–8 sentences) and include a detailed mark scheme.

For EVERY question provide all four accessibility fields:
- scaffolding_hint: a sentence starter or step-by-step scaffold for SEN Support students (e.g. "Think about... / Start with: The main reason was...")
- ehcp_adaptation: a simplified version of the question in plain, short sentences for EHCP students (same mark scheme applies — lower reading demand, same thinking demand)
- vocab_support: array of exactly 5 key terms with simple one-sentence definitions relevant to this question

Return this exact JSON structure (questionsJson is required):
{
  "type": "SHORT_ANSWER",
  "instructions": "Answer each question in full sentences.\\n\\n1. [Q1 text]\\n\\n2. ...",
  "modelAnswer": "Q1: [model answer]\\n\\nQ2: ...",
  "gradingBands": {"Low (1–3)": "...", "Mid (4–6)": "...", "High (7–9)": "..."},
  "targetWordCount": 0,
  "questionsJson": {
    "questions": [
      {
        "q": "Standard question text",
        "modelAnswer": "Full model answer for this question",
        "markScheme": "Award 1 mark for... Award 2 marks for...",
        "marks": 4,
        "scaffolding_hint": "Think about... / Start your answer with: The key...",
        "ehcp_adaptation": "Simpler version of the question using shorter sentences and plain words.",
        "vocab_support": [
          {"term": "Key term 1", "definition": "Simple one-sentence definition"},
          {"term": "Key term 2", "definition": "Simple one-sentence definition"},
          {"term": "Key term 3", "definition": "Simple one-sentence definition"},
          {"term": "Key term 4", "definition": "Simple one-sentence definition"},
          {"term": "Key term 5", "definition": "Simple one-sentence definition"}
        ]
      }
    ]
  }
}`

    case 'EXTENDED_WRITING':
      return `Generate ONE extended writing question for ${qualification} ${subject} directly related to the learning objectives.
The question should require an analytical, structured response.

Return this exact JSON structure:
{
  "type": "EXTENDED_WRITING",
  "instructions": "[Clear, formal essay question]",
  "modelAnswer": "[250–350 word model response or structured essay plan with paragraph headings]",
  "gradingBands": {"Low (1–3)": "...", "Mid (4–6)": "...", "High (7–9)": "..."},
  "targetWordCount": 300,
  "questionsJson": null
}`

    case 'MIXED':
      return `Generate a mixed assessment: Part A = 3 short knowledge questions (2–3 sentences each), Part B = 1 extended question.
All questions must directly test the learning objectives.

Return this exact JSON structure:
{
  "type": "MIXED",
  "instructions": "Part A – Knowledge Questions\\n1. [Q1]\\n\\n2. [Q2]\\n\\n3. [Q3]\\n\\nPart B – Extended Response\\n[Essay question]",
  "modelAnswer": "Part A mark scheme:\\n1. [answer]\\n2. [answer]\\n3. [answer]\\n\\nPart B model answer:\\n[Extended response]",
  "gradingBands": {"Low (1–3)": "...", "Mid (4–6)": "...", "High (7–9)": "..."},
  "targetWordCount": 0,
  "questionsJson": null
}`

    case 'UPLOAD':
      return `Generate clear pupil-facing instructions for a practical or written task on paper that pupils will photograph and upload.
The task must relate directly to the learning objectives.

Return this exact JSON structure:
{
  "type": "UPLOAD",
  "instructions": "[Step-by-step instructions for what to complete and photograph]",
  "modelAnswer": "[Teacher marking notes — key points to look for, not shown to pupils]",
  "gradingBands": {},
  "targetWordCount": 0,
  "questionsJson": null
}`
  }
}

export function defaultBands() {
  return {
    'Low (1–3)':  'Limited understanding; response is mainly narrative or list-based with minimal subject vocabulary. For written tasks, typically fewer than 3 developed sentences.',
    'Mid (4–6)':  'Developing understanding; some relevant explanation with attempts to use subject-specific language; ideas are partially developed but lack consistency or analytical depth.',
    'High (7–9)': 'Secure, analytical understanding; well-structured argument with sustained development across multiple paragraphs; accurate subject vocabulary used throughout; response demonstrates clear command of the topic.',
  }
}

export function noApiKeyFallback(type: HomeworkType, lessonTitle: string, subject: string): ProposalResult {
  const placeholders: Record<HomeworkType, { instructions: string; modelAnswer: string }> = {
    MCQ_QUIZ: {
      instructions: `Quiz: ${lessonTitle}\n\n1. [Question 1]\nA. [Option A]\nB. [Option B]\nC. [Option C]\nD. [Option D]\n\n2. [Question 2]...`,
      modelAnswer:  `1. B – [Add explanation]\n2. [Continue answer key...]`,
    },
    SHORT_ANSWER: {
      instructions: `Based on today's ${subject} lesson on "${lessonTitle}", answer the following questions:\n\n1. [Question 1]\n\n2. [Question 2]`,
      modelAnswer:  `Q1: [Model answer for question 1]\n\nQ2: [Model answer for question 2]`,
    },
    EXTENDED_WRITING: {
      instructions: `[Essay question about ${lessonTitle}]`,
      modelAnswer:  `[250–350 word model response or essay plan for "${lessonTitle}"]`,
    },
    MIXED: {
      instructions: `Part A – Knowledge Questions\n1. [Q1]\n2. [Q2]\n\nPart B – Extended Response\n[Essay/explanation question]`,
      modelAnswer:  `Part A mark scheme:\n1. [Answer]\n2. [Answer]\n\nPart B model answer:\n[Extended response]`,
    },
    UPLOAD: {
      instructions: `Complete the following task and upload a clear photograph of your work:\n\n${lessonTitle} – [Describe task here]`,
      modelAnswer:  `[Teacher marking notes — not visible to pupils]`,
    },
  }
  const questionsJson: ProposalResult['questionsJson'] =
    type === 'MCQ_QUIZ' ? {
      questions: [
        { q: `[Edit] Question 1 about "${lessonTitle}"`, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 0, explanation: '' },
        { q: `[Edit] Question 2 about "${lessonTitle}"`, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 1, explanation: '' },
        { q: `[Edit] Question 3 about "${lessonTitle}"`, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 2, explanation: '' },
      ] as MCQQuestion[],
    } :
    type === 'SHORT_ANSWER' ? {
      questions: [
        { q: `[Edit] Describe the key concepts from "${lessonTitle}".`,  modelAnswer: '[Add model answer]' },
        { q: `[Edit] Give an example related to "${lessonTitle}".`,       modelAnswer: '[Add model answer]' },
        { q: `[Edit] Explain why "${lessonTitle}" matters in ${subject}.`, modelAnswer: '[Add model answer]' },
      ] as SAQuestion[],
    } : undefined

  return {
    type,
    ...placeholders[type],
    gradingBands:    type === 'MCQ_QUIZ' || type === 'UPLOAD' ? {} : defaultBands(),
    targetWordCount: type === 'EXTENDED_WRITING' ? 300 : 0,
    questionsJson,
  }
}
