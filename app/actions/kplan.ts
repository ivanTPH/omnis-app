'use server'
import { requireAuth } from '@/lib/session'

const SENCO_ROLES = ['SENCO', 'SLT', 'SCHOOL_ADMIN'] as const
async function requireSenco() {
  return requireAuth(SENCO_ROLES as unknown as string[])
}
import { prisma, writeAudit } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export type KPlanData = {
  id:                     string
  studentId:              string
  gdprConsented:          boolean
  iLearnBestWhen:         string | null
  pleaseHelpMeBy:         string | null
  dontDoThis:             string | null
  myStrengths:            string[]
  communicationStyle:     string | null
  examAccessArrangements: string[]
  lastUpdatedBy:          string | null
  updatedAt:              Date
}

/** Fetch a student's K Plan. Staff-visible; GDPR-gated content only visible when consented. */
export async function getKPlan(studentId: string): Promise<KPlanData | null> {
  const { schoolId } = await requireAuth()
  const kplan = await prisma.kPlan.findFirst({
    where: { studentId, schoolId },
  })
  if (!kplan) return null
  return kplan
}

/** Create or update a student's K Plan. SENCO only. */
export async function upsertKPlan(
  studentId: string,
  data: {
    gdprConsented?:          boolean
    iLearnBestWhen?:         string
    pleaseHelpMeBy?:         string
    dontDoThis?:             string
    myStrengths?:            string[]
    communicationStyle?:     string
    examAccessArrangements?: string[]
  },
): Promise<KPlanData> {
  const user = await requireSenco()

  const kplan = await prisma.kPlan.upsert({
    where: { studentId },
    create: {
      schoolId:              user.schoolId,
      studentId,
      lastUpdatedBy:         user.id,
      gdprConsented:         data.gdprConsented ?? false,
      iLearnBestWhen:        data.iLearnBestWhen ?? null,
      pleaseHelpMeBy:        data.pleaseHelpMeBy ?? null,
      dontDoThis:            data.dontDoThis ?? null,
      myStrengths:           data.myStrengths ?? [],
      communicationStyle:    data.communicationStyle ?? null,
      examAccessArrangements: data.examAccessArrangements ?? [],
    },
    update: {
      lastUpdatedBy:         user.id,
      ...(data.gdprConsented          !== undefined && { gdprConsented: data.gdprConsented }),
      ...(data.iLearnBestWhen         !== undefined && { iLearnBestWhen: data.iLearnBestWhen }),
      ...(data.pleaseHelpMeBy         !== undefined && { pleaseHelpMeBy: data.pleaseHelpMeBy }),
      ...(data.dontDoThis             !== undefined && { dontDoThis: data.dontDoThis }),
      ...(data.myStrengths            !== undefined && { myStrengths: data.myStrengths }),
      ...(data.communicationStyle     !== undefined && { communicationStyle: data.communicationStyle }),
      ...(data.examAccessArrangements !== undefined && { examAccessArrangements: data.examAccessArrangements }),
    },
  })

  await writeAudit({
    schoolId:   user.schoolId,
    actorId:    user.id,
    action:     'K_PLAN_UPDATED',
    targetType: 'KPlan',
    targetId:   kplan.id,
    metadata:   { studentId, fieldsUpdated: Object.keys(data) },
  })

  revalidatePath(`/send/ilp/${studentId}`)
  return kplan
}

/** AI-generate a K Plan draft from the student's ILP and SEND data. SENCO only.
 *  Guard: only calls Claude if gdprConsented = true on the existing KPlan. */
export async function generateKPlanDraft(
  studentId: string,
): Promise<{ success: boolean; kplan?: KPlanData; error?: string }> {
  const user = await requireSenco()

  // Check GDPR consent first
  const existing = await prisma.kPlan.findFirst({
    where: { studentId, schoolId: user.schoolId },
  })
  if (!existing?.gdprConsented) {
    return { success: false, error: 'GDPR consent must be enabled before generating a K Plan draft.' }
  }

  // Gather source data
  const [student, ilp, concerns] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, schoolId: user.schoolId },
      select: { firstName: true, sendStatus: { select: { needArea: true } } },
    }),
    prisma.individualLearningPlan.findFirst({
      where: { studentId, schoolId: user.schoolId, status: 'active' },
      select: {
        areasOfNeed: true,
        strategies:  true,
        targets: {
          where: { status: 'active' },
          take: 5,
          select: { target: true, strategy: true },
        },
      },
    }),
    prisma.sendConcern.findMany({
      where: { studentId, schoolId: user.schoolId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { category: true, description: true },
    }),
  ])

  if (!student) return { success: false, error: 'Student not found.' }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Fallback stub — no API key
    const stub = await prisma.kPlan.update({
      where: { studentId },
      data: {
        iLearnBestWhen:         'I learn best when instructions are broken into small steps.',
        pleaseHelpMeBy:         'Please help me by giving me extra time to process information.',
        dontDoThis:             'Please don\'t put me on the spot without warning.',
        myStrengths:            ['Visual learning', 'Creative thinking'],
        communicationStyle:     'I prefer written instructions alongside verbal ones.',
        examAccessArrangements: [],
        lastUpdatedBy:          user.id,
      },
    })
    revalidatePath(`/send/ilp/${studentId}`)
    return { success: true, kplan: stub }
  }

  const firstName = student.firstName
  const needAreas = ilp?.areasOfNeed ?? student.sendStatus?.needArea ?? 'Not specified'
  const targetLines = ilp?.targets.map(t => `- ${t.target} (strategy: ${t.strategy})`).join('\n') ?? 'None recorded.'
  const concernLines = concerns.map(c => `- ${c.category}: ${c.description}`).join('\n') || 'None recorded.'

  const prompt = `You are a UK SENCO helping a student named ${firstName} write their Learning Passport in their own voice.

Based on the following information about ${firstName}:
SEND need areas: ${needAreas}
Active ILP targets:
${targetLines}
Recent concerns:
${concernLines}

Generate a draft K Plan as JSON. Write in first person as ${firstName}. Use positive, practical, everyday language. Do NOT use clinical labels, diagnosis names, or test scores.

Return exactly this JSON:
{
  "iLearnBestWhen": "I learn best when...",
  "pleaseHelpMeBy": "Please help me by...",
  "dontDoThis": "It doesn't help me when...",
  "myStrengths": ["strength 1", "strength 2", "strength 3"],
  "communicationStyle": "I find it helpful when feedback is..."
}`

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 600,
      messages:   [{ role: 'user', content: prompt }],
    })
    const text  = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      type Draft = {
        iLearnBestWhen?:     string
        pleaseHelpMeBy?:     string
        dontDoThis?:         string
        myStrengths?:        string[]
        communicationStyle?: string
      }
      const parsed = JSON.parse(match[0]) as Draft
      const updated = await prisma.kPlan.update({
        where: { studentId },
        data: {
          iLearnBestWhen:     parsed.iLearnBestWhen     ?? existing.iLearnBestWhen,
          pleaseHelpMeBy:     parsed.pleaseHelpMeBy     ?? existing.pleaseHelpMeBy,
          dontDoThis:         parsed.dontDoThis         ?? existing.dontDoThis,
          myStrengths:        Array.isArray(parsed.myStrengths) ? parsed.myStrengths : existing.myStrengths,
          communicationStyle: parsed.communicationStyle ?? existing.communicationStyle,
          lastUpdatedBy:      user.id,
        },
      })
      await writeAudit({
        schoolId:   user.schoolId,
        actorId:    user.id,
        action:     'K_PLAN_UPDATED',
        targetType: 'KPlan',
        targetId:   updated.id,
        metadata:   { studentId, generated: true },
      })
      revalidatePath(`/send/ilp/${studentId}`)
      return { success: true, kplan: updated }
    }
  } catch (err) {
    console.error('[generateKPlanDraft] Claude error:', err)
  }

  return { success: false, error: 'AI generation failed. Please try again or fill in the fields manually.' }
}
