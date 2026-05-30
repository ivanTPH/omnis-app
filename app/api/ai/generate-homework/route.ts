import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { HomeworkType } from '@prisma/client'
import {
  buildTypePrompt,
  noApiKeyFallback,
  type ProposalResult,
} from '@/lib/homework-helpers'

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
        // ── Auth ────────────────────────────────────────────────────────────
        const { schoolId, id: generatingUserId } = await requireAuth()

        const body = await request.json()
        const { lessonId, forceType, preferredResourceId } = body as {
          lessonId: string
          forceType?: HomeworkType
          preferredResourceId?: string
        }

        // ── Load lesson ─────────────────────────────────────────────────────
        emit(controller, { type: 'progress', message: 'Loading lesson…', pct: 10 })

        const lesson = await prisma.lesson.findFirst({
          where:   { id: lessonId, schoolId },
          include: { resources: { orderBy: { createdAt: 'asc' } }, class: { select: { subject: true, yearGroup: true } } },
        })
        if (!lesson) {
          emit(controller, { type: 'error', message: 'Lesson not found' })
          return
        }

        const subject       = lesson.class?.subject   ?? 'the subject'
        const yearGroup     = lesson.class?.yearGroup ?? 10
        const qualification = yearGroup <= 9 ? 'KS3' : yearGroup <= 11 ? 'GCSE' : 'A-Level'
        const examBoard     = (lesson as any).examBoard ?? ''
        const topic         = (lesson as any).topic ?? ''
        const type          = forceType ?? 'SHORT_ANSWER'

        // ── Enrich Oak resources ────────────────────────────────────────────
        emit(controller, { type: 'progress', message: 'Enriching resources…', pct: 22 })

        const oakSlugs = lesson.resources.filter(r => r.oakContentId).map(r => r.oakContentId as string)
        const oakDetails = oakSlugs.length
          ? await prisma.oakLesson.findMany({
              where:  { slug: { in: oakSlugs } },
              select: {
                slug: true, title: true, pupilLessonOutcome: true,
                keyLearningPoints: true, lessonKeywords: true,
                starterQuiz: true, exitQuiz: true,
                misconceptionsAndCommonMistakes: true,
                transcriptSentences: true,
              },
            })
          : []
        const oakBySlug = Object.fromEntries(oakDetails.map(o => [o.slug, o]))

        function buildOakContentBlock(oak: (typeof oakDetails)[number]): string {
          const lines: string[] = []
          if (oak.pupilLessonOutcome) lines.push(`  Learning outcome: ${oak.pupilLessonOutcome}`)
          const klp = Array.isArray(oak.keyLearningPoints) ? oak.keyLearningPoints as any[] : []
          if (klp.length > 0) {
            lines.push(`  Key learning points:`)
            klp.slice(0, 6).forEach((p: any, i: number) => {
              const text = typeof p === 'string' ? p : p?.keyLearningPoint ?? ''
              if (text) lines.push(`    ${i + 1}. ${text}`)
            })
          }
          const kw = Array.isArray(oak.lessonKeywords) ? oak.lessonKeywords as any[] : []
          if (kw.length > 0) {
            const vocabList = kw.slice(0, 8).map((k: any) => {
              const word = typeof k === 'string' ? k : k?.keyword ?? ''
              const desc = typeof k === 'object' ? k?.description ?? '' : ''
              return desc ? `${word}: ${desc}` : word
            }).filter(Boolean)
            if (vocabList.length > 0) lines.push(`  Key vocabulary: ${vocabList.join('; ')}`)
          }
          const quizItems = [...(Array.isArray(oak.starterQuiz) ? oak.starterQuiz as any[] : []), ...(Array.isArray(oak.exitQuiz) ? oak.exitQuiz as any[] : [])].slice(0, 4)
          if (quizItems.length > 0) {
            lines.push(`  Curriculum quiz questions (use these as models for depth and style):`)
            quizItems.forEach((q: any, i: number) => {
              const stem = q?.questionStem ?? q?.question ?? ''
              if (!stem) return
              lines.push(`    Q${i + 1}: ${stem}`)
              const correct = (Array.isArray(q?.answers) ? q.answers as any[] : []).find((a: any) => a?.answerIsCorrect)
              if (correct?.answer) lines.push(`         → ${correct.answer}`)
            })
          }
          const misc = Array.isArray(oak.misconceptionsAndCommonMistakes) ? oak.misconceptionsAndCommonMistakes as any[] : []
          if (misc.length > 0) {
            lines.push(`  Common misconceptions to probe:`)
            misc.slice(0, 3).forEach((m: any) => {
              const mc = typeof m === 'string' ? m : m?.misconception ?? ''
              if (mc) lines.push(`    - ${mc}`)
            })
          }
          return lines.join('\n')
        }

        const orderedResources = preferredResourceId
          ? [...lesson.resources.filter(r => r.id === preferredResourceId), ...lesson.resources.filter(r => r.id !== preferredResourceId)]
          : lesson.resources
        const primaryResource   = orderedResources[0]
        const hasPrimaryNonOak  = !!(primaryResource && !primaryResource.oakContentId && preferredResourceId)

        const objectivesContext = lesson.objectives.length > 0
          ? lesson.objectives.map((o, i) => `  ${i + 1}. ${o}`).join('\n')
          : '  (No learning objectives specified — generate questions appropriate for the lesson title and topic)'

        const resourceContext = orderedResources.length > 0
          ? orderedResources.map((r, idx) => {
              const isPrimary = idx === 0 && !!preferredResourceId
              if (r.oakContentId && oakBySlug[r.oakContentId]) {
                const oak          = oakBySlug[r.oakContentId]
                const contentBlock = buildOakContentBlock(oak)
                const header = isPrimary
                  ? `  - [PRIMARY RESOURCE — BASE ALL QUESTIONS ON THIS] [Oak Lesson] "${oak.title}"`
                  : `  - [Oak Lesson] "${oak.title}"`
                return contentBlock ? `${header}\n${contentBlock}` : header
              }
              const urlPart      = r.url ? ` (${r.url})` : ''
              const extractedText = (r as any).extractedText as string | null | undefined
              if (r.fileKey && !r.url && extractedText) {
                const header = isPrimary
                  ? `  - [PRIMARY RESOURCE — BASE ALL QUESTIONS ON THIS] [${r.type}] "${r.label}" (uploaded file)`
                  : `  - [${r.type}] "${r.label}" (uploaded file)`
                const excerpt = extractedText.slice(0, 3000)
                return `${header}\n  Slide/page content:\n${excerpt.split('\n').map((l: string) => `    ${l}`).join('\n')}`
              }
              return isPrimary
                ? `  - [PRIMARY RESOURCE — BASE ALL QUESTIONS ON THIS] [${r.type}] "${r.label}"${urlPart}`
                : `  - [${r.type}] "${r.label}"${urlPart}`
            }).join('\n')
          : '  - No lesson resources attached'

        // ── SEND context ────────────────────────────────────────────────────
        emit(controller, { type: 'progress', message: 'Building class context…', pct: 33 })

        let sendContextBlock = ''
        try {
          if (lesson.classId) {
            const [classSize, sendStatuses, ilpData] = await Promise.all([
              prisma.enrolment.count({ where: { classId: lesson.classId } }),
              prisma.sendStatus.findMany({
                where: { student: { enrolments: { some: { classId: lesson.classId } } }, NOT: { activeStatus: 'NONE' } },
                select: { studentId: true, activeStatus: true, needArea: true },
              }),
              prisma.individualLearningPlan.findMany({
                where: { approvedBySenco: true, status: 'active', student: { enrolments: { some: { classId: lesson.classId } } } },
                select: { studentId: true, sendCategory: true, areasOfNeed: true, targets: { where: { status: 'active' }, select: { target: true }, take: 2 } },
              }),
            ])
            if (sendStatuses.length > 0) {
              const ilpByStudent: Record<string, any> = Object.fromEntries(ilpData.map((i: any) => [i.studentId, i]))
              const ehcpStudents = sendStatuses.filter(s => s.activeStatus === 'EHCP')
              const senStudents  = sendStatuses.filter(s => s.activeStatus === 'SEN_SUPPORT')
              const noneCount    = Math.max(0, classSize - sendStatuses.length)
              const senNeeds     = [...new Set(senStudents.map(s => ilpByStudent[s.studentId]?.sendCategory || s.needArea || 'SEN Support').filter(Boolean))].slice(0, 4)
              const senTargets   = senStudents.flatMap(s => ilpByStudent[s.studentId]?.targets.map((t: any) => t.target) ?? []).slice(0, 3)
              const ehcpNeeds    = [...new Set(ehcpStudents.map(s => ilpByStudent[s.studentId]?.sendCategory || s.needArea || 'EHCP').filter(Boolean))].slice(0, 4)
              const ehcpAreas    = ehcpStudents.map(s => ilpByStudent[s.studentId]?.areasOfNeed).filter(Boolean).slice(0, 2)
              sendContextBlock = `\nCLASS SEND PROFILE — use this to generate all accessibility fields in every question\n=====================================================================================\n- ${noneCount} student${noneCount !== 1 ? 's' : ''}: standard questions only\n- ${senStudents.length} student${senStudents.length !== 1 ? 's' : ''} SEN Support — needs: ${senNeeds.join(', ') || 'general learning support'}\n  ILP targets: ${senTargets.join('; ') || 'not yet recorded'}\n  → For these students: scaffolding_hint must be a sentence starter or step-by-step scaffold\n- ${ehcpStudents.length} student${ehcpStudents.length !== 1 ? 's' : ''} EHCP — categories: ${ehcpNeeds.join(', ') || 'EHCP'}\n  Areas of need: ${ehcpAreas.join('; ') || 'not yet recorded'}\n  → For these students: ehcp_adaptation must simplify the question into plain language and shorter sentences; vocab_support must define 5 key subject terms simply\n\nALL questions MUST include scaffolding_hint, ehcp_adaptation, and vocab_support fields regardless of class size.\n`
            }
          }
        } catch { /* SEND fetch is best-effort */ }

        // ── Year group plan context ─────────────────────────────────────────
        let ygPlanContext = ''
        try {
          const { getYearGroupPlanContext } = await import('@/app/actions/year-group-plans')
          const ygPlan = await getYearGroupPlanContext(schoolId, subject, yearGroup)
          if (ygPlan) ygPlanContext = `\nSCHEME OF WORK — use this to ensure homework aligns with the curriculum plan:\n${ygPlan.slice(0, 800)}\n`
        } catch { /* best-effort */ }

        // ── Rate limit ──────────────────────────────────────────────────────
        emit(controller, { type: 'progress', message: 'Checking generation limits…', pct: 42 })

        const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)
        const todayCount = await prisma.auditLog.count({
          where: { schoolId, actorId: generatingUserId, action: 'AI_HOMEWORK_GENERATED', createdAt: { gte: todayMidnight } },
        })
        if (todayCount >= 10) {
          emit(controller, { type: 'error', message: 'Daily AI generation limit reached (10 per day). Try again tomorrow.' })
          return
        }

        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          emit(controller, { type: 'done', data: noApiKeyFallback(type, lesson.title, subject) })
          return
        }

        // ── Build prompt ────────────────────────────────────────────────────
        const taskInstruction = hasPrimaryNonOak
          ? `Your homework questions MUST be based on the PRIMARY RESOURCE marked above (the teacher's own uploaded material). The slide/page content extracted from that file is provided above — use it as your primary source. Generate questions that test the SPECIFIC facts, arguments, and evidence from those slides. Each model answer MUST be drawn directly from the content shown, including specific details, dates, names, and key vocabulary. Do NOT generate generic questions.`
          : preferredResourceId
            ? `Your homework questions MUST be based primarily on the PRIMARY RESOURCE marked in the resource list above. Generate questions that test the specific content and learning outcome of that resource. Other resources and learning objectives are supplementary context — do not let them override the PRIMARY RESOURCE selection.`
            : lesson.objectives.length > 0
              ? `Your homework questions MUST directly test the learning objectives listed above. Students should be able to answer from what they learned in this lesson.`
              : `Your homework questions MUST be based on the lesson resources listed above. Use the Oak lesson learning outcomes as your targets — generate questions that test exactly what those outcomes describe. Questions must be specific to "${lesson.title}" — do not generate generic "describe key concepts" questions.`

        const prompt = `You are an expert UK secondary school ${subject} teacher creating homework for a ${qualification} class${examBoard ? ` (${examBoard})` : ''}.

LESSON CONTEXT
==============
Title: "${lesson.title}"${topic ? `\nTopic: ${topic}` : ''}
Year Group: Year ${yearGroup} (${qualification})${examBoard ? `\nExam Board: ${examBoard}` : ''}

LEARNING OBJECTIVES — what was taught in this lesson:
${objectivesContext}

LESSON RESOURCES — source material for questions:
${resourceContext}
${sendContextBlock}${ygPlanContext}
TASK
====
${taskInstruction}

${buildTypePrompt(type, subject, qualification)}`

        // ── Anthropic streaming call ─────────────────────────────────────────
        emit(controller, { type: 'progress', message: 'Sending to AI…', pct: 50 })

        const client      = new Anthropic({ apiKey })
        const claudeStream = client.messages.stream({
          model:      'claude-sonnet-4-6',
          max_tokens: 8000,
          system:     'You are a JSON API. Return ONLY valid JSON. No markdown. No code fences. No comments. In JSON string values, represent newlines as \\n — never use literal line breaks inside string values.',
          messages:   [{ role: 'user', content: prompt }],
        })

        let accumulated = ''
        let lastEmitLen  = 0
        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            accumulated += event.delta.text
            if (accumulated.length - lastEmitLen > 400) {
              lastEmitLen = accumulated.length
              const pct = Math.min(85, 50 + Math.floor(accumulated.length / 80))
              emit(controller, { type: 'progress', message: 'Generating homework…', pct })
            }
          }
        }

        emit(controller, { type: 'progress', message: 'Processing response…', pct: 88 })

        // ── Parse JSON ───────────────────────────────────────────────────────
        const cleaned = accumulated.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
        let parsed: any
        try {
          parsed = JSON.parse(cleaned)
        } catch {
          try {
            const repaired = cleaned.replace(/"(?:[^"\\]|\\.|\n|\r)*"/g, (m: string) => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r'))
            parsed = JSON.parse(repaired)
          } catch {
            emit(controller, { type: 'done', data: noApiKeyFallback(type, lesson.title, subject) })
            return
          }
        }

        // ── Validate questionsJson — retry once if needed ────────────────────
        const needsQuestions = type === 'MCQ_QUIZ' || type === 'SHORT_ANSWER'
        const minQuestions   = type === 'SHORT_ANSWER' ? 5 : 4
        const hasQuestions   = parsed.questionsJson?.questions && Array.isArray(parsed.questionsJson.questions) && parsed.questionsJson.questions.length >= minQuestions

        if (needsQuestions && !hasQuestions) {
          emit(controller, { type: 'progress', message: 'Improving response quality…', pct: 90 })
          try {
            const retryMsg = await client.messages.create({
              model:    'claude-sonnet-4-6',
              max_tokens: 8000,
              system:   'You are a JSON API. Return ONLY valid JSON. No markdown. No code fences. No comments. In JSON string values, represent newlines as \\n — never use literal line breaks inside string values.',
              messages: [
                { role: 'user',      content: prompt },
                { role: 'assistant', content: cleaned },
                { role: 'user',      content: 'The questionsJson field is missing or has too few questions. Please resend the complete JSON with questionsJson containing all required questions. Return ONLY valid JSON, no extra text.' },
              ],
            })
            const retryRaw     = (retryMsg.content[0] as any).text.trim()
            const retryCleaned = retryRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
            try { parsed = JSON.parse(retryCleaned) } catch { /* keep original */ }
          } catch { /* keep original */ }
        }

        // Defensive: Claude sometimes returns questions at root level
        let questionsJson = parsed.questionsJson ?? undefined
        if (!questionsJson && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          questionsJson = { questions: parsed.questions }
        }
        if ((type === 'MCQ_QUIZ' || type === 'SHORT_ANSWER') && (!questionsJson || !Array.isArray((questionsJson as any)?.questions) || (questionsJson as any).questions.length === 0)) {
          questionsJson = noApiKeyFallback(type, lesson.title, subject).questionsJson
        }

        // ── Audit ────────────────────────────────────────────────────────────
        writeAudit({
          schoolId,
          actorId:    generatingUserId,
          action:     'AI_HOMEWORK_GENERATED',
          targetType: 'Lesson',
          targetId:   lessonId,
          metadata:   { homeworkType: type, lessonTitle: lesson.title },
        }).catch(() => {})

        const result: ProposalResult = {
          type,
          instructions:        parsed.instructions    ?? '',
          modelAnswer:         parsed.modelAnswer     ?? '',
          gradingBands:        parsed.gradingBands    ?? {},
          targetWordCount:     parsed.targetWordCount ?? (type === 'EXTENDED_WRITING' ? 300 : 0),
          questionsJson,
          basedOnSchemeOfWork: !!ygPlanContext,
        }

        emit(controller, { type: 'done', data: result })
      } catch (err) {
        emit(controller, { type: 'error', message: err instanceof Error ? err.message : 'Generation failed — please try again.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
