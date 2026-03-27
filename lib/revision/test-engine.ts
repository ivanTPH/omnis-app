import Anthropic from '@anthropic-ai/sdk'
import { percentToGcseGrade } from '@/lib/grading'

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuestionType = 'mcq' | 'written' | 'fill_blank' | 'matching'
export type Difficulty   = 'easy' | 'medium' | 'hard'

export interface TestQuestion {
  index:        number
  type:         QuestionType
  text:         string
  difficulty:   Difficulty
  topic:        string
  marks:        number
  // MCQ
  options?:      string[]
  correctIndex?: number
  // written
  modelAnswer?: string
  // fill_blank
  sentence?:    string
  blankAnswer?: string
  // matching
  pairs?: { term: string; definition: string }[]
}

export interface TestAnswer {
  questionIndex: number
  answer:        string
  score:         number
  maxScore:      number
  topic:         string
  questionType:  QuestionType
  feedback:      string
}

export interface TestResults {
  totalScore:     number
  maxScore:       number
  percentage:     number
  estimatedGrade: string
  areasToRevisit: { topic: string; questionTypes: string[] }[]
  questionCount:  number
}

// ── Question type cycle ────────────────────────────────────────────────────────

const CYCLE_DEFAULT: QuestionType[]  = ['written', 'mcq', 'written', 'mcq', 'written', 'mcq', 'written', 'mcq']
const CYCLE_WITH_ILP: QuestionType[] = ['mcq', 'written', 'fill_blank', 'matching', 'mcq', 'written', 'fill_blank', 'matching']

export function selectQuestionType(index: number, hasIlp: boolean): QuestionType {
  return (hasIlp ? CYCLE_WITH_ILP : CYCLE_DEFAULT)[index % 8]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function difficultyLabel(d: Difficulty): string {
  return { easy: 'straightforward recall (AO1)', medium: 'application and explanation (AO2)', hard: 'analysis, evaluation, extended response (AO3)' }[d]
}

function typeJsonSchema(type: QuestionType, difficulty: Difficulty): string {
  switch (type) {
    case 'mcq':
      return `{"text":"Question text here?","type":"mcq","difficulty":"${difficulty}","topic":"topic name","marks":1,"options":["A. first option","B. second option","C. third option","D. fourth option"],"correctIndex":0}`
    case 'written':
      return `{"text":"Question text here?","type":"written","difficulty":"${difficulty}","topic":"topic name","marks":4,"modelAnswer":"Mark scheme answer here."}`
    case 'fill_blank':
      return `{"text":"Complete the sentence:","type":"fill_blank","difficulty":"${difficulty}","topic":"topic name","marks":1,"sentence":"The ___ is responsible for...","blankAnswer":"correct word or phrase"}`
    case 'matching':
      return `{"text":"Match each term to its correct definition:","type":"matching","difficulty":"${difficulty}","topic":"topic name","marks":4,"pairs":[{"term":"Term 1","definition":"Definition 1"},{"term":"Term 2","definition":"Definition 2"},{"term":"Term 3","definition":"Definition 3"},{"term":"Term 4","definition":"Definition 4"}]}`
  }
}

// ── Question generation ────────────────────────────────────────────────────────

export async function generateQuestion(params: {
  subject:      string
  yearGroup:    number
  topics:       string[]
  type:         QuestionType
  difficulty:   Difficulty
  excludeTexts: string[]
  ilpTargets:   string[]
}): Promise<TestQuestion> {
  const { subject, yearGroup, topics, type, difficulty, excludeTexts, ilpTargets } = params

  if (!process.env.ANTHROPIC_API_KEY) {
    return buildStubQuestion(type, difficulty, topics[0] ?? subject)
  }

  const topicStr = topics.slice(0, 6).join(', ')
  const exclStr  = excludeTexts.length > 0
    ? `\nDo NOT generate questions similar to these already-asked ones: ${excludeTexts.slice(0, 5).map(t => `"${t}"`).join('; ')}`
    : ''
  const ilpStr   = ilpTargets.length > 0
    ? `\nConsider these student learning targets when selecting topic focus: ${ilpTargets.slice(0, 3).join('; ')}`
    : ''

  const prompt = `You are a UK secondary school exam question generator.

Generate ONE ${type.replace('_', '-')} question for Year ${yearGroup} ${subject} students.
Topics available: ${topicStr}
Difficulty: ${difficulty} — ${difficultyLabel(difficulty)}
Align to AQA, Edexcel, or OCR examination board standards as appropriate for ${subject}.${exclStr}${ilpStr}

Return ONLY valid JSON with no markdown fences, matching exactly this structure:
${typeJsonSchema(type, difficulty)}`

  const anthropic = new Anthropic()

  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 700,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const m   = raw.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('No JSON in response')
    const parsed = JSON.parse(m[0])
    if (!parsed.text || !parsed.type || typeof parsed.marks !== 'number') throw new Error('Incomplete question object')

    // Clamp marks for reasonableness
    parsed.marks = Math.min(Math.max(1, parsed.marks), type === 'written' ? 8 : 4)

    return { ...parsed, index: 0 } as TestQuestion
  } catch (err) {
    console.error('[generateQuestion] AI failed, using stub:', err)
    return buildStubQuestion(type, difficulty, topics[0] ?? subject)
  }
}

// ── Answer evaluation ─────────────────────────────────────────────────────────

export async function evaluateAnswer(
  question: TestQuestion,
  answer:   string,
  subject:  string,
): Promise<{ score: number; feedback: string }> {

  // ── MCQ: deterministic ──
  if (question.type === 'mcq') {
    const idx     = parseInt(answer, 10)
    const correct = !isNaN(idx) ? idx === question.correctIndex
      : answer === question.options?.[question.correctIndex ?? 0]
    return {
      score:    correct ? question.marks : 0,
      feedback: correct
        ? 'Correct!'
        : `Incorrect. The answer was: ${question.options?.[question.correctIndex ?? 0] ?? ''}`,
    }
  }

  // ── Matching: deterministic ──
  if (question.type === 'matching') {
    try {
      const submitted: Record<string, string> = JSON.parse(answer)
      const pairs = question.pairs ?? []
      let correct = 0
      for (const p of pairs) {
        if ((submitted[p.term] ?? '').toLowerCase().trim() === p.definition.toLowerCase().trim()) correct++
      }
      const score = pairs.length > 0 ? Math.round((correct / pairs.length) * question.marks) : 0
      return { score, feedback: `${correct} of ${pairs.length} pairs matched correctly` }
    } catch {
      return { score: 0, feedback: 'Could not evaluate matching response' }
    }
  }

  // ── Written / fill_blank: AI evaluation ──
  if (!process.env.ANTHROPIC_API_KEY) {
    const hasContent = answer.trim().length > 3
    return {
      score:    hasContent ? Math.ceil(question.marks / 2) : 0,
      feedback: hasContent ? 'Answer recorded.' : 'No answer provided.',
    }
  }

  const anthropic = new Anthropic()

  const prompt = question.type === 'fill_blank'
    ? `Mark this fill-in-the-blank answer.
Sentence: "${question.sentence}"
Expected answer: "${question.blankAnswer}"
Student wrote: "${answer}"
Accept synonyms and minor spelling variations.
Return ONLY valid JSON: {"score":N,"feedback":"brief comment"} where N is 0 or ${question.marks}.`
    : `You are marking a Year ${subject} exam answer.
Question: ${question.text}
Model answer: ${question.modelAnswer ?? 'N/A'}
Marks available: ${question.marks}
Student answer: ${answer.trim() || '(blank)'}

Apply UK mark scheme conventions. Award marks fairly.
Return ONLY valid JSON: {"score":N,"feedback":"1-2 sentence marking comment"} where N is 0–${question.marks}.`

  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 150,
      messages:   [{ role: 'user', content: prompt }],
    })
    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const m   = raw.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('No JSON')
    const parsed = JSON.parse(m[0])
    return {
      score:    Math.min(question.marks, Math.max(0, Number(parsed.score) || 0)),
      feedback: String(parsed.feedback || ''),
    }
  } catch {
    const partial = answer.trim().length > 10 ? Math.ceil(question.marks * 0.5) : 0
    return { score: partial, feedback: 'Evaluated.' }
  }
}

// ── Results calculation ────────────────────────────────────────────────────────

export function calculateResults(answers: TestAnswer[]): TestResults {
  const totalScore = answers.reduce((s, a) => s + a.score, 0)
  const maxScore   = answers.reduce((s, a) => s + a.maxScore, 0)
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

  // Areas to revisit: topics where score < 50%
  const topicMap = new Map<string, { score: number; max: number; types: Set<string> }>()
  for (const a of answers) {
    if (!topicMap.has(a.topic)) topicMap.set(a.topic, { score: 0, max: 0, types: new Set() })
    const t = topicMap.get(a.topic)!
    t.score += a.score
    t.max   += a.maxScore
    t.types.add(a.questionType)
  }
  const areasToRevisit = [...topicMap.entries()]
    .filter(([, t]) => t.max > 0 && t.score / t.max < 0.5)
    .map(([topic, t]) => ({ topic, questionTypes: [...t.types] }))

  return {
    totalScore,
    maxScore,
    percentage,
    estimatedGrade: `Grade ${percentToGcseGrade(percentage)}`,
    areasToRevisit,
    questionCount: answers.length,
  }
}

// ── Stub fallback ─────────────────────────────────────────────────────────────

function buildStubQuestion(type: QuestionType, difficulty: Difficulty, topic: string): TestQuestion {
  const stubs: Record<QuestionType, Omit<TestQuestion, 'index'>> = {
    mcq: {
      type: 'mcq', difficulty, topic, marks: 1,
      text: `Which of the following best describes a key concept in ${topic}?`,
      options:      ['A. The first option', 'B. The second option', 'C. The third option', 'D. The fourth option'],
      correctIndex: 0,
    },
    written: {
      type: 'written', difficulty, topic,
      marks:       difficulty === 'hard' ? 6 : difficulty === 'medium' ? 4 : 2,
      text:        `Explain the key features of ${topic}.`,
      modelAnswer: `A strong answer describes the main concepts of ${topic} with supporting detail and evidence.`,
    },
    fill_blank: {
      type: 'fill_blank', difficulty, topic, marks: 1,
      text:        'Complete the sentence:',
      sentence:    `${topic} is important because ___.`,
      blankAnswer: 'it underpins understanding of the subject',
    },
    matching: {
      type: 'matching', difficulty, topic, marks: 4,
      text:  `Match each term to its correct definition (${topic}):`,
      pairs: [
        { term: 'Concept A', definition: 'The primary definition of concept A' },
        { term: 'Concept B', definition: 'The primary definition of concept B' },
        { term: 'Concept C', definition: 'The primary definition of concept C' },
        { term: 'Concept D', definition: 'The primary definition of concept D' },
      ],
    },
  }
  return { ...stubs[type], index: 0 }
}
