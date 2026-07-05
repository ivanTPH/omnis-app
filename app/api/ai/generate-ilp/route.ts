import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { revalidatePath } from 'next/cache'
import { buildIlpPrompt } from '@/lib/ilp-helpers'

export const runtime = 'nodejs'
export const maxDuration = 60

function emit(controller: ReadableStreamDefaultController<Uint8Array>, event: object) {
  const encoder = new TextEncoder()
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
}

export async function POST(request: Request) {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // ── Auth — SENCO only ────────────────────────────────────────────────
        const user = await requireAuth()
        if (user.role !== 'SENCO') {
          emit(controller, { type: 'error', message: 'Only SENCOs can generate ILPs.' })
          return
        }
        const { id: actorId, schoolId } = user

        const body = await request.json()
        const { studentId } = body as { studentId: string }

        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          emit(controller, { type: 'error', message: 'ANTHROPIC_API_KEY not configured' })
          return
        }

        // ── Rate limit — 20 ILPs per SENCO per day ──────────────────────────
        emit(controller, { type: 'progress', message: 'Checking limits…', pct: 10 })

        const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)
        const todayCount = await prisma.auditLog.count({
          where: { schoolId, actorId, action: 'AI_ILP_GENERATED', createdAt: { gte: todayMidnight } },
        })
        if (todayCount >= 20) {
          emit(controller, { type: 'error', message: 'Daily AI ILP generation limit reached (20 per day). Try again tomorrow.' })
          return
        }

        // ── Guard: no duplicate active ILP ──────────────────────────────────
        const existing = await prisma.individualLearningPlan.findFirst({
          where: { schoolId, studentId, status: { in: ['active', 'under_review'] } },
        })
        if (existing) {
          emit(controller, { type: 'error', message: 'An active ILP already exists for this student.' })
          return
        }

        // ── Load student ─────────────────────────────────────────────────────
        emit(controller, { type: 'progress', message: 'Loading student data…', pct: 20 })

        const student = await prisma.user.findFirst({
          where:  { id: studentId, schoolId, role: 'STUDENT' },
          select: { id: true, firstName: true, lastName: true, yearGroup: true },
        })
        if (!student) {
          emit(controller, { type: 'error', message: 'Student not found.' })
          return
        }

        const sendStatus = await prisma.sendStatus.findUnique({
          where:  { studentId },
          select: { activeStatus: true, needArea: true },
        })
        if (!sendStatus || sendStatus.activeStatus === 'NONE') {
          emit(controller, { type: 'error', message: 'ILPs can only be created for students on the SEND register.' })
          return
        }
        const sendCategory = sendStatus.needArea ?? 'General Learning Support'
        const yearGroup    = student.yearGroup ?? 9

        // ── Anthropic streaming call ─────────────────────────────────────────
        emit(controller, { type: 'progress', message: 'Sending to AI…', pct: 35 })

        const client       = new Anthropic({ apiKey })
        const claudeStream = client.messages.stream({
          model:      'claude-sonnet-4-6',
          max_tokens: 1200,
          system:     'You are a UK SENCO creating Individual Learning Plans. Return ONLY valid JSON, no markdown.',
          messages:   [{ role: 'user', content: buildIlpPrompt(student.firstName, student.lastName, yearGroup, sendCategory) }],
        })

        let accumulated = ''
        let lastEmitLen  = 0
        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            accumulated += event.delta.text
            if (accumulated.length - lastEmitLen > 300) {
              lastEmitLen = accumulated.length
              const pct = Math.min(80, 35 + Math.floor(accumulated.length / 40))
              emit(controller, { type: 'progress', message: 'Generating ILP…', pct })
            }
          }
        }

        emit(controller, { type: 'progress', message: 'Processing result…', pct: 85 })

        // ── Parse and save ───────────────────────────────────────────────────
        const raw   = accumulated.trim()
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) {
          emit(controller, { type: 'error', message: 'AI did not return valid JSON — please try again.' })
          return
        }
        const gen = JSON.parse(match[0])

        const thirteenWeeks = new Date(Date.now() + 13 * 7 * 24 * 60 * 60 * 1000)

        await prisma.individualLearningPlan.create({
          data: {
            schoolId,
            studentId,
            createdBy:        actorId,
            sendCategory,
            currentStrengths: String(gen.currentStrengths ?? ''),
            areasOfNeed:      String(gen.areasOfNeed ?? ''),
            strategies:       Array.isArray(gen.strategies) ? gen.strategies.map(String) : [],
            successCriteria:  String(gen.successCriteria ?? ''),
            reviewDate:       thirteenWeeks,
            autoGenerated:    true,
            approvedBySenco:  false,
            likes:            gen.likes    ? String(gen.likes)    : null,
            dislikes:         gen.dislikes ? String(gen.dislikes) : null,
            resourcesNeeded:  Array.isArray(gen.resourcesNeeded) ? gen.resourcesNeeded.map(String) : [],
            status:           'under_review',
            targets: {
              create: (Array.isArray(gen.targets) ? gen.targets : []).slice(0, 3).map((t: Record<string, unknown>) => ({
                target:         String(t.target ?? ''),
                strategy:       String(t.strategy ?? ''),
                successMeasure: String(t.successMeasure ?? ''),
                targetDate:     new Date(Date.now() + ((Number(t.targetDateWeeks) || 12)) * 7 * 24 * 60 * 60 * 1000),
              })),
            },
          },
        })

        revalidatePath('/senco/ilp')

        writeAudit({
          schoolId,
          actorId,
          action:     'AI_ILP_GENERATED',
          targetType: 'Student',
          targetId:   studentId,
          metadata:   { sendCategory, yearGroup },
        }).catch(() => {})

        emit(controller, { type: 'done', data: { success: true } })
      } catch (err) {
        emit(controller, {
          type: 'error',
          message: err instanceof Error ? err.message : 'ILP generation failed — please try again.',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
