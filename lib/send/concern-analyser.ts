import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const AI_PREFIX = '⚠️ AI-assisted analysis — must be reviewed by a qualified SENCO before any action is taken.\n\n'

export async function analyseConcernPattern(studentId: string, schoolId: string): Promise<string> {
  // Gather all data about the student
  const [student, concerns, flags, recentSubmissions, sendStatus] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { firstName: true, lastName: true, yearGroup: true },
    }),
    prisma.sendConcern.findMany({
      where: { schoolId, studentId, status: { not: 'closed' } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.earlyWarningFlag.findMany({
      where: { schoolId, studentId, isActioned: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.submission.findMany({
      where: {
        studentId,
        homework: { schoolId },
        submittedAt: { gte: new Date(Date.now() - 56 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { submittedAt: 'desc' },
      take: 15,
      select: { finalScore: true, status: true, submittedAt: true },
    }),
    prisma.sendStatus.findUnique({ where: { studentId } }),
  ])

  if (!student) return AI_PREFIX + 'Unable to retrieve student data.'

  // Build a data summary for the prompt
  const scoredSubmissions = recentSubmissions.filter(s => s.finalScore !== null)
  const avgScore = scoredSubmissions.length > 0
    ? Math.round(scoredSubmissions.reduce((a, s) => a + (s.finalScore ?? 0), 0) / scoredSubmissions.length)
    : null

  const dataSummary = [
    `Student: Year ${student.yearGroup ?? 'unknown'}`,
    `Existing SEND status: ${sendStatus?.activeStatus ?? 'None'}${sendStatus?.needArea ? ` (${sendStatus.needArea})` : ''}`,
    '',
    `Open concerns (${concerns.length}):`,
    ...concerns.map(c => `  - [${c.category}] ${c.description.slice(0, 150)}`),
    '',
    `Early warning flags (${flags.length}):`,
    ...flags.map(f => `  - [${f.severity}] ${f.description}`),
    '',
    `Homework data (last 8 weeks): ${recentSubmissions.length} submissions, avg score: ${avgScore ?? 'n/a'}%`,
  ].join('\n')

  const systemPrompt = `You are a UK SENCO assistant. You help identify patterns in student support data to assist SENCOs in prioritising interventions. You never diagnose — you observe patterns and suggest next steps. Always use professional, non-stigmatising language. Respond in exactly 3 short paragraphs: (1) Pattern observed, (2) Possible factors to investigate, (3) Suggested next steps for the SENCO.`

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return AI_PREFIX + 'AI service unavailable. Please review the concern data manually using the information above.'
  }

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Student data summary:\n\n${dataSummary}\n\nProvide a pattern analysis.`,
      }],
    })

    const text = (message.content[0] as { type: string; text: string }).text.trim()
    return AI_PREFIX + text
  } catch {
    return AI_PREFIX + 'AI analysis temporarily unavailable. Please review the concern data manually.'
  }
}
