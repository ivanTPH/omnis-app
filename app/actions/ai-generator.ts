'use server'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GeneratedResourceData = {
  id: string
  schoolId: string
  createdBy: string
  title: string
  subject: string
  yearGroup: string
  resourceType: string
  topic: string
  content: string
  sendAdapted: boolean
  sendNotes: string | null
  modelVersion: string
  createdAt: Date
  linkedLessonId: string | null
}

export type GenerateInput = {
  schoolId: string        // accepted for backwards compat but overridden by session
  subject: string
  yearGroup: string
  topic: string
  resourceType: string
  sendAdaptations: string[]
  additionalNotes?: string
  lessonId?: string
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const VALID_RESOURCE_TYPES = ['worksheet', 'quiz', 'lesson_plan', 'exit_ticket', 'knowledge_organiser'] as const

const GenerateInputSchema = z.object({
  subject:      z.string().min(1, 'Subject is required').max(200, 'Subject must not exceed 200 characters'),
  yearGroup:    z.string().min(1, 'Year group is required').max(50, 'Year group must not exceed 50 characters'),
  topic:        z.string().min(1, 'Topic is required').max(200, 'Topic must not exceed 200 characters (prevents prompt injection)'),
  resourceType: z.enum(VALID_RESOURCE_TYPES, { error: 'Invalid resource type' }),
  sendAdaptations: z.array(z.string().max(50)).max(10),
  additionalNotes: z.string().max(1000, 'Additional notes must not exceed 1,000 characters').optional(),
})

// ─── Prompt builders ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert UK secondary school teacher and curriculum designer.
You create high-quality, classroom-ready resources aligned to the UK National Curriculum and common UK exam specifications (AQA, Edexcel, OCR).
Your resources are clear, well-structured, and immediately usable.
Always respond with the resource content in clean markdown — no preamble, no explanation, just the resource itself starting with a # Title.`

const RESOURCE_TYPE_PROMPTS: Record<string, string> = {
  worksheet:
    'Create a classroom worksheet with clear instructions, scaffolded tasks (starter → main → extension), and a mark scheme.',
  quiz:
    'Create a 10-question quiz with a mix of multiple choice and short answer questions. Include an answer key at the end.',
  lesson_plan:
    'Create a detailed lesson plan with: learning objectives, starter activity, main activities with timings, plenary, and assessment for learning checkpoints.',
  exit_ticket:
    'Create a 3-question exit ticket to assess understanding at the end of the lesson. Include expected answers.',
  knowledge_organiser:
    'Create a knowledge organiser with key vocabulary, key concepts, key people/dates (if relevant), and a self-quiz section.',
}

const SEND_ADAPTATION_PROMPTS: Record<string, string> = {
  dyslexia:
    'Use short sentences. Avoid walls of text. Use bullet points. Suggest font size 14+ and cream/yellow background. Avoid underlining.',
  adhd:
    'Break tasks into small, numbered steps. Include frequent check-in points. Use visual separators between sections.',
  eal:
    'Include a key vocabulary box at the start. Define technical terms in plain English. Use simple sentence structures.',
  low_literacy:
    'Use reading age 9-11 vocabulary. Short sentences. Include sentence starters and writing frames.',
  autism:
    'Use explicit, literal language. Avoid metaphors. Provide clear structure with numbered steps. State expectations explicitly.',
}

function buildUserPrompt(input: GenerateInput): string {
  const typePrompt = RESOURCE_TYPE_PROMPTS[input.resourceType] ?? 'Create a classroom resource.'
  const lines = [
    `Subject: ${input.subject}`,
    `Year Group: ${input.yearGroup}`,
    `Topic: ${input.topic}`,
    '',
    typePrompt,
  ]

  if (input.sendAdaptations.length > 0) {
    lines.push('', 'SEND Adaptations required — apply all of the following:')
    for (const adapt of input.sendAdaptations) {
      const prompt = SEND_ADAPTATION_PROMPTS[adapt]
      if (prompt) lines.push(`- ${adapt.toUpperCase()}: ${prompt}`)
    }
  }

  if (input.additionalNotes?.trim()) {
    lines.push('', `Additional teacher notes: ${input.additionalNotes.trim()}`)
  }

  return lines.join('\n')
}

// ─── Actions ──────────────────────────────────────────────────────────────────

const AI_DAILY_LIMIT = 20

export async function generateResource(
  input: GenerateInput,
): Promise<{ id: string; content: string; title: string }> {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any

  // Validate input (includes length limits to prevent prompt injection)
  const validated = GenerateInputSchema.parse(input)

  // Security: always use session IDs — never trust client-provided schoolId/userId
  const schoolId = user.schoolId as string

  // Rate limiting: max 20 AI generations per user per day
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayCount = await prisma.generatedResource.count({
    where: { createdBy: user.id, createdAt: { gte: today } },
  })
  if (todayCount >= AI_DAILY_LIMIT) {
    throw new Error(`Daily generation limit reached (${AI_DAILY_LIMIT}/day). Try again tomorrow.`)
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  let content: string
  let title: string

  if (apiKey) {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt({ ...input, ...validated }) }],
    })
    content = (message.content[0] as { type: string; text: string }).text.trim()
  } else {
    // Fallback stub when API key is absent
    const typeLabel = validated.resourceType.replace(/_/g, ' ')
    content = `# ${validated.topic} — ${typeLabel}\n\n*AI service unavailable. This is a placeholder resource.*\n\n## Learning Objectives\n- Understand ${validated.topic}\n\n## Activity\n1. Task one\n2. Task two\n\n## Extension\nFurther investigation of ${validated.topic}.`
  }

  // Extract title from first # heading
  const titleMatch = content.match(/^#\s+(.+)$/m)
  title = titleMatch ? titleMatch[1].trim() : `${validated.topic} — ${validated.resourceType}`

  const sendNotes =
    validated.sendAdaptations.length > 0
      ? `Adapted for: ${validated.sendAdaptations.join(', ')}`
      : null

  const saved = await prisma.generatedResource.create({
    data: {
      schoolId,           // Security: from session
      createdBy: user.id, // Security: from session
      title,
      subject:        validated.subject,
      yearGroup:      validated.yearGroup,
      resourceType:   validated.resourceType,
      topic:          validated.topic,
      content,
      sendAdapted:    validated.sendAdaptations.length > 0,
      sendNotes,
      linkedLessonId: input.lessonId ?? null,
    },
  })

  revalidatePath('/ai-generator')
  return { id: saved.id, content: saved.content, title: saved.title }
}

export async function getMyResources(
  _schoolId: string,
  _userId: string,
): Promise<GeneratedResourceData[]> {
  // Security: always use session IDs — never trust client-provided schoolId/userId
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any

  return prisma.generatedResource.findMany({
    where: { schoolId: user.schoolId, createdBy: user.id },
    orderBy: { createdAt: 'desc' },
  }) as Promise<GeneratedResourceData[]>
}

export async function getSchoolResources(
  schoolId: string,
): Promise<GeneratedResourceData[]> {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session.user as any).role
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')
  return prisma.generatedResource.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' },
  }) as Promise<GeneratedResourceData[]>
}

export async function deleteGeneratedResource(id: string): Promise<void> {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any

  // Security: verify resource belongs to user's school before fetching
  const resource = await prisma.generatedResource.findFirst({
    where: { id, schoolId: user.schoolId },
  })
  if (!resource) throw new Error('Resource not found')

  const isOwner = resource.createdBy === user.id
  const isAdmin = ['SCHOOL_ADMIN', 'SLT'].includes(user.role)
  if (!isOwner && !isAdmin) throw new Error('Not authorised to delete this resource')

  await prisma.generatedResource.delete({ where: { id } })
  revalidatePath('/ai-generator')
}

export async function linkResourceToLesson(
  resourceId: string,
  lessonId: string,
): Promise<void> {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any

  // Security: verify resource belongs to user's school (IDOR protection)
  const resource = await prisma.generatedResource.findFirst({
    where: { id: resourceId, schoolId: user.schoolId },
  })
  if (!resource) throw new Error('Resource not found')

  await prisma.generatedResource.update({
    where: { id: resourceId },
    data: { linkedLessonId: lessonId },
  })
  revalidatePath('/ai-generator')
}
