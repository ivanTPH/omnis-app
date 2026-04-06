import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'

// Allow up to 300 seconds — bulk ILP generation calls Claude for every student
export const maxDuration = 300

function buildIlpPrompt(
  firstName: string,
  lastName: string,
  yearGroup: number,
  sendCategory: string,
): string {
  const ksLabel = yearGroup <= 9 ? 'KS3' : yearGroup <= 11 ? 'KS4 (GCSE)' : 'KS5 (A-Level)'
  return `Generate a UK secondary school Individual Learning Plan for this student.

Student: ${firstName} ${lastName}
Year: Year ${yearGroup} (${ksLabel})
Support category: ${sendCategory}

Return ONLY valid JSON (no markdown, no explanation):
{
  "likes": "2 sentences describing what Year ${yearGroup} students typically enjoy at school",
  "dislikes": "2 sentences describing common learning challenges for Year ${yearGroup} students",
  "currentStrengths": "2-3 sentences: expected academic strengths at ${ksLabel} level",
  "areasOfNeed": "2-3 sentences: priority development areas based on ${ksLabel} National Curriculum",
  "targets": [
    {"target": "SMART literacy target for Year ${yearGroup}", "strategy": "specific classroom strategy", "successMeasure": "measurable outcome", "targetDateWeeks": 12},
    {"target": "SMART numeracy target for Year ${yearGroup}", "strategy": "specific classroom strategy", "successMeasure": "measurable outcome", "targetDateWeeks": 12},
    {"target": "SMART study-skills/metacognition target", "strategy": "specific classroom strategy", "successMeasure": "measurable outcome", "targetDateWeeks": 12}
  ],
  "strategies": ["strategy 1", "strategy 2", "strategy 3", "strategy 4", "strategy 5"],
  "resourcesNeeded": ["resource 1", "resource 2", "resource 3"],
  "successCriteria": "Overall ILP success measure for the term"
}`
}

export async function POST() {
  const session = await auth()
  const user = session?.user as { schoolId?: string; role?: string; id?: string } | undefined
  if (!user || !['SENCO', 'SCHOOL_ADMIN', 'SLT'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const schoolId = user.schoolId!
  const userId   = user.id!
  const apiKey   = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  // Find students who do NOT already have an active or under_review ILP
  const existingIlps = await prisma.individualLearningPlan.findMany({
    where:  { schoolId, status: { in: ['active', 'under_review'] } },
    select: { studentId: true },
  })
  const existingSet = new Set(existingIlps.map(r => r.studentId))

  // Only generate for students already identified as needing SEND support
  const sendStudentIds = await prisma.sendStatus.findMany({
    where: { studentId: { not: '' }, activeStatus: { in: ['SEN_SUPPORT', 'EHCP'] as any } },
    select: { studentId: true },
  })
  const sendSet = new Set(sendStudentIds.map(r => r.studentId))

  const students = await prisma.user.findMany({
    where:  { schoolId, role: 'STUDENT', isActive: true, id: { in: [...sendSet] } },
    select: {
      id: true, firstName: true, lastName: true, yearGroup: true,
      sendStatus: { select: { needArea: true } },
    },
    orderBy: { lastName: 'asc' },
  })

  const toProcess = students.filter(s => !existingSet.has(s.id))

  let generated = 0
  let skipped   = 0
  const errors: string[] = []

  const client = new Anthropic({ apiKey })
  const BATCH  = 10   // parallel Claude calls per round

  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch = toProcess.slice(i, i + BATCH)

    await Promise.all(batch.map(async student => {
      const yearGroup    = student.yearGroup ?? 9
      const sendCategory = student.sendStatus?.needArea ?? 'General Learning Support'

      try {
        const msg = await client.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1200,
          system:     'You are a UK SENCO creating Individual Learning Plans. Return ONLY valid JSON, no markdown.',
          messages: [{
            role:    'user',
            content: buildIlpPrompt(student.firstName, student.lastName, yearGroup, sendCategory),
          }],
        })

        const raw   = (msg.content[0] as { type: string; text: string }).text.trim()
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) {
          errors.push(`${student.firstName} ${student.lastName}: no JSON in response`)
          return
        }

        const gen = JSON.parse(match[0])

        await prisma.individualLearningPlan.create({
          data: {
            schoolId,
            studentId:        student.id,
            createdBy:        userId,
            sendCategory,
            currentStrengths: String(gen.currentStrengths ?? ''),
            areasOfNeed:      String(gen.areasOfNeed ?? ''),
            strategies:       Array.isArray(gen.strategies) ? gen.strategies.map(String) : [],
            successCriteria:  String(gen.successCriteria ?? ''),
            reviewDate:       new Date(Date.now() + 13 * 7 * 24 * 60 * 60 * 1000), // ~1 term
            autoGenerated:    true,
            approvedBySenco:  false,
            likes:            gen.likes    ? String(gen.likes)    : null,
            dislikes:         gen.dislikes ? String(gen.dislikes) : null,
            resourcesNeeded:  Array.isArray(gen.resourcesNeeded) ? gen.resourcesNeeded.map(String) : [],
            status:           'under_review',
            targets: {
              create: (Array.isArray(gen.targets) ? gen.targets : []).slice(0, 3).map((t: Record<string, unknown>) => ({
                target:         String(t.target         ?? ''),
                strategy:       String(t.strategy       ?? ''),
                successMeasure: String(t.successMeasure ?? ''),
                targetDate:     new Date(Date.now() + (Number(t.targetDateWeeks) || 12) * 7 * 24 * 60 * 60 * 1000),
              })),
            },
          },
        })

        generated++
      } catch (err) {
        errors.push(`${student.firstName} ${student.lastName}: ${String(err).slice(0, 100)}`)
      }
    }))
  }

  skipped = students.length - toProcess.length

  revalidatePath('/senco/ilp')

  return NextResponse.json({
    success:   true,
    generated,
    skipped,
    total:     students.length,
    errors:    errors.slice(0, 20),
  })
}
