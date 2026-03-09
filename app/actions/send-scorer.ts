'use server'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export type SendQualityScoreData = {
  id: string
  oakLessonSlug: string
  overallScore: number
  readabilityScore: number
  visualLoadScore: number
  cognitiveScore: number
  languageScore: number
  structureScore: number
  summary: string
  recommendations: string[]
  scoredAt: Date
  modelVersion: string
}

export type LessonWithScore = {
  slug: string
  title: string
  subjectSlug: string
  keystage: string
  yearGroup: number | null
  sendQualityScore: SendQualityScoreData | null
}

type ScorePayload = {
  readability: number
  visualLoad: number
  cognitive: number
  language: number
  structure: number
  summary: string
  recommendations: string[]
}

async function scoreLessonWithAI(lesson: {
  slug: string
  title: string
  subjectSlug: string
  keystage: string
  pupilLessonOutcome: string | null
  keyLearningPoints: unknown
  lessonKeywords: unknown
  lessonOutline: unknown
  starterQuiz: unknown
  exitQuiz: unknown
}): Promise<ScorePayload> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return fallbackScore()

  try {
    const client = new Anthropic({ apiKey })

    const keywords = (lesson.lessonKeywords as Array<{ keyword: string; description?: string }> | null) ?? []
    const klp = (lesson.keyLearningPoints as Array<{ keyLearningPoint: string }> | null) ?? []
    const outline = (lesson.lessonOutline as Array<{ lessonOutline: string }> | null) ?? []

    const context = [
      `Lesson title: "${lesson.title}"`,
      `Subject: ${lesson.subjectSlug}`,
      `Key stage: ${lesson.keystage}`,
      lesson.pupilLessonOutcome ? `Learning outcome: "${lesson.pupilLessonOutcome}"` : '',
      klp.length ? `Key learning points:\n${klp.map(k => `- ${k.keyLearningPoint}`).join('\n')}` : '',
      outline.length ? `Lesson outline:\n${outline.map(o => `- ${o.lessonOutline}`).join('\n')}` : '',
      keywords.length
        ? `Key vocabulary (${keywords.length} terms): ${keywords.slice(0, 10).map(k => k.keyword).join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    const prompt = `You are an expert in SEND (Special Educational Needs and Disabilities) educational best practice in UK secondary schools.

Assess the following Oak National Academy lesson for SEND accessibility across 5 dimensions. Score each 0–100.

${context}

Score each dimension on these criteria:

readability — sentence length, vocabulary complexity, clarity of instructions, paragraph density
visualLoad — balance of text vs visual support, use of diagrams, infographics, colour coding
cognitive — chunking of information, use of worked examples, scaffolding, reduction of extraneous load
language — subject-specific vocabulary support, glossary provision, accessible language level
structure — clear headings, logical flow, numbered steps, section breaks, signposting

Also provide:
- summary: 1–2 sentence plain-English summary of SEND accessibility strengths and gaps
- recommendations: 3–5 specific, actionable improvements for the classroom teacher

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "readability": <0-100>,
  "visualLoad": <0-100>,
  "cognitive": <0-100>,
  "language": <0-100>,
  "structure": <0-100>,
  "summary": "<string>",
  "recommendations": ["<string>", ...]
}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (message.content[0] as { type: string; text: string }).text.trim()
    const parsed = JSON.parse(text) as ScorePayload

    return {
      readability: clamp(parsed.readability),
      visualLoad: clamp(parsed.visualLoad),
      cognitive: clamp(parsed.cognitive),
      language: clamp(parsed.language),
      structure: clamp(parsed.structure),
      summary: parsed.summary ?? '',
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 5) : [],
    }
  } catch {
    return fallbackScore()
  }
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function fallbackScore(): ScorePayload {
  return {
    readability: 60,
    visualLoad: 55,
    cognitive: 60,
    language: 58,
    structure: 62,
    summary:
      'Score unavailable — AI scoring service is offline. Fallback estimates shown.',
    recommendations: [
      'Ensure all key vocabulary is explicitly defined with student-friendly explanations.',
      'Break long explanatory text into shorter, numbered steps.',
      'Add visual representations (diagrams, timelines) to support written content.',
      'Include sentence starters and writing frames for extended tasks.',
      'Provide worked examples before asking students to attempt questions independently.',
    ],
  }
}

function computeOverall(p: ScorePayload) {
  return Math.round(
    (p.readability + p.visualLoad + p.cognitive + p.language + p.structure) / 5,
  )
}

// ─── Public actions ────────────────────────────────────────────────────────

export async function getOrCreateSendScore(
  oakLessonSlug: string,
): Promise<SendQualityScoreData> {
  const session = await auth()
  if (!session) redirect('/login')

  // Return cached score if present
  const existing = await prisma.sendQualityScore.findUnique({
    where: { oakLessonSlug },
  })
  if (existing) return existing as SendQualityScoreData

  // Fetch lesson content
  const lesson = await prisma.oakLesson.findUnique({
    where: { slug: oakLessonSlug },
    select: {
      slug: true,
      title: true,
      subjectSlug: true,
      keystage: true,
      pupilLessonOutcome: true,
      keyLearningPoints: true,
      lessonKeywords: true,
      lessonOutline: true,
      starterQuiz: true,
      exitQuiz: true,
    },
  })

  if (!lesson) throw new Error(`OakLesson not found: ${oakLessonSlug}`)

  const scores = await scoreLessonWithAI(lesson)
  const overall = computeOverall(scores)

  const created = await prisma.sendQualityScore.create({
    data: {
      oakLessonSlug,
      overallScore: overall,
      readabilityScore: scores.readability,
      visualLoadScore: scores.visualLoad,
      cognitiveScore: scores.cognitive,
      languageScore: scores.language,
      structureScore: scores.structure,
      summary: scores.summary,
      recommendations: scores.recommendations,
    },
  })

  return created as SendQualityScoreData
}

export async function forceRescoreLesson(
  oakLessonSlug: string,
): Promise<SendQualityScoreData> {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session.user as any).role
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  // Delete existing score
  await prisma.sendQualityScore.deleteMany({ where: { oakLessonSlug } })

  return getOrCreateSendScore(oakLessonSlug)
}

export async function getExistingScore(
  oakLessonSlug: string,
): Promise<SendQualityScoreData | null> {
  const session = await auth()
  if (!session) redirect('/login')

  const score = await prisma.sendQualityScore.findUnique({
    where: { oakLessonSlug },
  })
  return score as SendQualityScoreData | null
}

export async function searchLessonsWithScores(opts: {
  query?: string
  subject?: string
  keystage?: string
  limit?: number
  offset?: number
}): Promise<{ lessons: LessonWithScore[]; total: number }> {
  const session = await auth()
  if (!session) redirect('/login')

  const where = {
    ...(opts.query
      ? { title: { contains: opts.query, mode: 'insensitive' as const } }
      : {}),
    ...(opts.subject ? { subjectSlug: opts.subject } : {}),
    ...(opts.keystage ? { keystage: opts.keystage } : {}),
  }

  const [lessons, total] = await Promise.all([
    prisma.oakLesson.findMany({
      where,
      take: opts.limit ?? 20,
      skip: opts.offset ?? 0,
      orderBy: { title: 'asc' },
      select: {
        slug: true,
        title: true,
        subjectSlug: true,
        keystage: true,
        yearGroup: true,
        sendQualityScore: true,
      },
    }),
    prisma.oakLesson.count({ where }),
  ])

  return {
    lessons: lessons.map(l => ({
      ...l,
      sendQualityScore: l.sendQualityScore as SendQualityScoreData | null,
    })),
    total,
  }
}
