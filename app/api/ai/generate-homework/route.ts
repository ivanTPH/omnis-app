import { requireAuth } from '@/lib/session'
import { writeAudit } from '@/lib/prisma'
import { SafeAnthropic } from '@/lib/ai/safe-anthropic'
import { HomeworkType } from '@prisma/client'
import { noApiKeyFallback } from '@/lib/homework-helpers'
import { AI_STREAM_OPTS } from '@/lib/ai-timeouts'
import { buildHomeworkContext, underDailyLimit, DAILY_GENERATION_LIMIT } from '@/lib/homework/context'
import { generateHomework, toProposal } from '@/lib/homework/generate'
import { homeworkPipelineEnabled } from '@/lib/homework/flags'
import { anthropicLlm } from '@/lib/homework/llm'

export const runtime = 'nodejs'
export const maxDuration = 120

function emit(controller: ReadableStreamDefaultController<Uint8Array>, event: object) {
  const encoder = new TextEncoder()
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
}

/**
 * Streams AI homework generation to the lesson screen as server-sent events:
 * `progress` events, then exactly one `done` (ProposalResult) or `error`.
 * Prompt building, validation and the optional staged pipeline live in
 * lib/homework/ and are shared with generateHomeworkFromResources.
 */
export async function POST(request: Request) {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let resultEmitted = false
      try {
        const { schoolId, id: userId } = await requireAuth()
        const { lessonId, forceType, preferredResourceId } = await request.json() as {
          lessonId: string
          forceType?: HomeworkType
          preferredResourceId?: string
        }
        const type = forceType ?? 'SHORT_ANSWER'

        emit(controller, { type: 'progress', message: 'Loading lesson and class context…', pct: 15 })
        const ctx = await buildHomeworkContext({ schoolId, lessonId, type, preferredResourceId })
        if (!ctx) {
          emit(controller, { type: 'error', message: 'Lesson not found' })
          resultEmitted = true
          return
        }

        emit(controller, { type: 'progress', message: 'Checking generation limits…', pct: 40 })
        if (!(await underDailyLimit(schoolId, userId))) {
          emit(controller, { type: 'error', message: `Daily AI generation limit reached (${DAILY_GENERATION_LIMIT} per day). Try again tomorrow.` })
          resultEmitted = true
          return
        }

        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          emit(controller, { type: 'done', data: noApiKeyFallback(type, ctx.lessonTitle, ctx.subject) })
          resultEmitted = true
          return
        }

        emit(controller, { type: 'progress', message: 'Sending to AI…', pct: 45 })
        const llm = anthropicLlm(new SafeAnthropic({ apiKey, ...AI_STREAM_OPTS }))
        const staged = await homeworkPipelineEnabled(schoolId)
        const { result, meta } = await generateHomework(ctx, llm, {
          staged,
          onProgress: (message, pct) => emit(controller, { type: 'progress', message, pct }),
        })
        emit(controller, { type: 'progress', message: 'Processing response…', pct: 95 })

        // Only successful generations count towards the daily limit.
        if (!result) console.error('[generate-homework] no usable AI output — returning editable stubs', meta)
        else writeAudit({
          schoolId,
          actorId:    userId,
          action:     'AI_HOMEWORK_GENERATED',
          targetType: 'Lesson',
          targetId:   lessonId,
          metadata:   { homeworkType: type, lessonTitle: ctx.lessonTitle, generation: meta },
        }).catch(() => {})

        emit(controller, { type: 'done', data: toProposal(ctx, result) })
        resultEmitted = true
      } catch (err) {
        try {
          emit(controller, { type: 'error', message: err instanceof Error ? err.message : 'Generation failed — please try again.' })
          resultEmitted = true
        } catch { /* controller may already be closed */ }
      } finally {
        // Safety net: if nothing was emitted (emit itself threw), send a fallback error
        if (!resultEmitted) {
          try { emit(controller, { type: 'error', message: 'Generation failed — please try again.' }) } catch { }
        }
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
      'Content-Encoding':  'identity',  // prevent Nginx gzip buffering SSE stream
    },
  })
}
