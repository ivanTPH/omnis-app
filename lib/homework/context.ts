/**
 * Builds the context and prompt for AI homework generation.
 *
 * This was previously written out twice — in app/api/ai/generate-homework
 * (the route the "Generate with AI" button uses) and in
 * generateHomeworkFromResources (a server action nothing called any more).
 * The copies had drifted: the live route had a thinner SEND profile (no ILP
 * strategies or EHCP outcomes), ignored the class exam board, and never
 * returned the ILP target IDs the lesson screen uses to auto-link homework
 * as ILP evidence. This module is now the single source for both.
 */
import { prisma } from '@/lib/prisma'
import type { HomeworkType } from '@prisma/client'
import { buildTypePrompt } from '@/lib/homework-helpers'
import { getOakPedagogicalContext } from '@/lib/oak-content'

export type HomeworkContext = {
  lessonId:            string
  lessonTitle:         string
  subject:             string
  yearGroup:           number
  qualification:       'KS3' | 'GCSE' | 'A-Level'
  examBoard:           string
  type:                HomeworkType
  /** The complete user prompt for single-pass generation. */
  prompt:              string
  /** Context sections without the type-specific output instructions (used by the staged pipeline). */
  contextBlock:        string
  /** Task instruction describing which source the questions must come from. */
  taskInstruction:     string
  /** ILP targets quoted in the prompt — the lesson screen links the saved homework to these. */
  ilpTargetIds:        string[]
  basedOnSchemeOfWork: boolean
  /** Curriculum facts the staged pipeline plans questions against. */
  curriculum: {
    learningPoints: string[]
    misconceptions: string[]
    vocabulary:     string[]
  }
}

export { HOMEWORK_SYSTEM_PROMPT } from './prompts'

/** Teachers may generate this many AI homeworks per calendar day. */
export const DAILY_GENERATION_LIMIT = 10

export function qualificationFor(yearGroup: number): HomeworkContext['qualification'] {
  return yearGroup <= 9 ? 'KS3' : yearGroup <= 11 ? 'GCSE' : 'A-Level'
}

/** Maps a class subject name to an Oak subject slug for the curriculum benchmark. */
export function oakSubjectSlugFor(subject: string): string {
  return subject.toLowerCase().trim()
    .replace(/math.*/, 'maths')
    .replace(/english lit.*/, 'english')
    .replace(/.*science.*/, 'science')
    .replace(/physical.*|^pe$/, 'physical-education')
    .replace(/religious.*|^r[se]$/, 'religious-education')
    .replace(/computer.*|computing/, 'computing')
    .replace(/\s+/g, '-')
}

const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : [])
const textOf = (v: any, key: string): string => (typeof v === 'string' ? v : typeof v?.[key] === 'string' ? v[key] : '')

type OakDetail = {
  slug: string
  title: string
  pupilLessonOutcome: string | null
  keyLearningPoints: unknown
  lessonKeywords: unknown
  starterQuiz: unknown
  exitQuiz: unknown
  misconceptionsAndCommonMistakes: unknown
  transcriptSentences: unknown
}

function oakContentBlock(oak: OakDetail): string {
  const lines: string[] = []
  if (oak.pupilLessonOutcome) lines.push(`  Learning outcome: ${oak.pupilLessonOutcome}`)

  const klp = asArray(oak.keyLearningPoints).map(p => textOf(p, 'keyLearningPoint')).filter(Boolean)
  if (klp.length > 0) {
    lines.push('  Key learning points:')
    klp.slice(0, 6).forEach((t, i) => lines.push(`    ${i + 1}. ${t}`))
  }

  const vocab = asArray(oak.lessonKeywords).slice(0, 8).map(k => {
    const word = textOf(k, 'keyword')
    const desc = typeof k === 'object' ? textOf(k, 'description') : ''
    return desc ? `${word}: ${desc}` : word
  }).filter(Boolean)
  if (vocab.length > 0) lines.push(`  Key vocabulary: ${vocab.join('; ')}`)

  const quiz = [...asArray(oak.starterQuiz), ...asArray(oak.exitQuiz)].slice(0, 4)
  if (quiz.length > 0) {
    lines.push('  Curriculum quiz questions (use these as models for depth and style):')
    quiz.forEach((q, i) => {
      const stem = q?.questionStem ?? q?.question ?? ''
      if (!stem) return
      lines.push(`    Q${i + 1}: ${stem}`)
      const correct = asArray(q?.answers).find(a => a?.answerIsCorrect)
      if (correct?.answer) lines.push(`         → ${correct.answer}`)
    })
  }

  const misc = asArray(oak.misconceptionsAndCommonMistakes).map(m => textOf(m, 'misconception')).filter(Boolean)
  if (misc.length > 0) {
    lines.push('  Common misconceptions to probe with questions:')
    misc.slice(0, 3).forEach(m => lines.push(`    - ${m}`))
  }

  const trans = asArray(oak.transcriptSentences)
  if (trans.length > 0) {
    // Shorter excerpt when structured learning points are already present.
    const excerpt = trans.slice(0, klp.length > 0 ? 4 : 8)
      .map(t => textOf(t, 'transcriptSentence')).filter(Boolean).join(' ')
      .slice(0, klp.length > 0 ? 300 : 600)
    if (excerpt) lines.push(`  Lesson transcript excerpt: ${excerpt}`)
  }
  return lines.join('\n')
}

/**
 * The SEND profile for a class. ILPs that are active or under review are used
 * (the same rule as the teacher SEND caseload), so a plan awaiting re-approval
 * still shapes the scaffolds pupils get.
 */
async function sendProfile(schoolId: string, classId: string): Promise<{ block: string; ilpTargetIds: string[] }> {
  const [classSize, sendStatuses, ilps] = await Promise.all([
    prisma.enrolment.count({ where: { classId } }),
    prisma.sendStatus.findMany({
      where:  { student: { enrolments: { some: { classId } } }, NOT: { activeStatus: 'NONE' } },
      select: { studentId: true, activeStatus: true, needArea: true },
    }),
    prisma.individualLearningPlan.findMany({
      where: { status: { in: ['active', 'under_review'] }, student: { enrolments: { some: { classId } } } },
      select: {
        studentId: true, sendCategory: true, areasOfNeed: true, strategies: true,
        targets: { where: { status: 'active' }, select: { id: true, target: true, strategy: true }, take: 3 },
      },
    }),
  ])
  if (sendStatuses.length === 0) return { block: '', ilpTargetIds: [] }

  const ilpByStudent = new Map(ilps.map(i => [i.studentId, i]))
  const ehcp = sendStatuses.filter(s => s.activeStatus === 'EHCP')
  const sen  = sendStatuses.filter(s => s.activeStatus === 'SEN_SUPPORT')
  const noneCount = Math.max(0, classSize - sendStatuses.length)

  const ehcpOutcomes = ehcp.length > 0
    ? await prisma.ehcpOutcome.findMany({
        where:   { ehcp: { studentId: { in: ehcp.map(s => s.studentId) }, schoolId, status: 'active' }, status: 'active' },
        select:  { outcomeText: true, provisionRequired: true, section: true },
        take:    4,
        orderBy: { section: 'asc' },
      })
    : []

  const senNeeds = [...new Set(sen.map(s => ilpByStudent.get(s.studentId)?.sendCategory || s.needArea || 'SEN Support'))].slice(0, 4)
  const senTargets = sen.flatMap(s => ilpByStudent.get(s.studentId)?.targets ?? []).slice(0, 4)
  const senStrategies = [...new Set(sen.flatMap(s => ilpByStudent.get(s.studentId)?.strategies ?? []))].slice(0, 4)
  const ehcpNeeds = [...new Set(ehcp.map(s => ilpByStudent.get(s.studentId)?.sendCategory || s.needArea || 'EHCP'))].slice(0, 4)
  const ehcpAreas = ehcp.map(s => ilpByStudent.get(s.studentId)?.areasOfNeed).filter(Boolean).slice(0, 2)
  const plural = (n: number) => `${n} student${n !== 1 ? 's' : ''}`

  const block = `
CLASS SEND PROFILE — use this to generate all accessibility fields in every question
=====================================================================================
Standard (no SEND): ${plural(noneCount)}

SEN SUPPORT — ${plural(sen.length)}:
  Support needs: ${senNeeds.join(', ') || 'general learning support'}
${senTargets.length > 0
    ? '  Active ILP targets and classroom strategies:\n' + senTargets.map(t => `    • Target: "${t.target}"\n      Strategy: "${t.strategy}"`).join('\n')
    : '  No ILP targets recorded yet.'}
${senStrategies.length > 0 ? '  ILP classroom strategies to apply: ' + senStrategies.join(' | ') : ''}
  → scaffolding_hint for EVERY question: write a sentence starter OR step-by-step thinking scaffold that directly applies the ILP strategies above. It must reduce the cognitive load for this specific target without giving away the answer.

EHCP — ${plural(ehcp.length)}:
  Categories: ${ehcpNeeds.join(', ') || 'EHCP'}
  Areas of need: ${ehcpAreas.join('; ') || 'not recorded'}
${ehcpOutcomes.length > 0
    ? '  EHCP outcomes this homework can evidence:\n' + ehcpOutcomes.map(o => `    • [Section ${o.section}] "${o.outcomeText}"${o.provisionRequired ? ` — provision: ${o.provisionRequired}` : ''}`).join('\n')
    : ''}
  → ehcp_adaptation for EVERY question: rewrite the question in plain English (max 2 sentences, no complex clauses), broken into numbered steps if multi-part. Reference the EHCP outcome where relevant.
  → vocab_support for EVERY question: define the key subject terms in simple language.

ALL questions MUST include scaffolding_hint, ehcp_adaptation, and vocab_support fields regardless of class size.
`
  return { block, ilpTargetIds: senTargets.map(t => t.id) }
}

/** Loads everything needed to generate homework for a lesson. Returns null if the lesson is not in this school. */
export async function buildHomeworkContext(args: {
  schoolId:             string
  lessonId:             string
  type:                 HomeworkType
  preferredResourceId?: string
}): Promise<HomeworkContext | null> {
  const { schoolId, lessonId, type, preferredResourceId } = args
  const lesson = await prisma.lesson.findFirst({
    where:   { id: lessonId, schoolId },
    include: {
      resources: { orderBy: { createdAt: 'asc' } },
      class:     { select: { subject: true, yearGroup: true, examBoard: true } },
    },
  })
  if (!lesson) return null

  const subject       = lesson.class?.subject ?? 'the subject'
  const yearGroup     = lesson.class?.yearGroup ?? 10
  const qualification = qualificationFor(yearGroup)
  const examBoard     = lesson.examBoard ?? lesson.class?.examBoard ?? ''
  const topic         = (lesson as { topic?: string | null }).topic ?? ''

  // ── Resources, with Oak lesson content expanded ────────────────────────────
  const oakSlugs = lesson.resources.filter(r => r.oakContentId).map(r => r.oakContentId as string)
  const oakDetails: OakDetail[] = oakSlugs.length
    ? await prisma.oakLesson.findMany({
        where:  { slug: { in: oakSlugs } },
        select: {
          slug: true, title: true, pupilLessonOutcome: true, keyLearningPoints: true, lessonKeywords: true,
          starterQuiz: true, exitQuiz: true, misconceptionsAndCommonMistakes: true, transcriptSentences: true,
        },
      })
    : []
  const oakBySlug = new Map(oakDetails.map(o => [o.slug, o]))

  const ordered = preferredResourceId
    ? [...lesson.resources.filter(r => r.id === preferredResourceId), ...lesson.resources.filter(r => r.id !== preferredResourceId)]
    : lesson.resources
  const hasPrimaryNonOak = !!(ordered[0] && !ordered[0].oakContentId && preferredResourceId)

  const resourceContext = ordered.length > 0
    ? ordered.map((r, idx) => {
        const primary = idx === 0 && !!preferredResourceId ? '[PRIMARY RESOURCE — BASE ALL QUESTIONS ON THIS] ' : ''
        const oak = r.oakContentId ? oakBySlug.get(r.oakContentId) : undefined
        if (oak) {
          const content = oakContentBlock(oak)
          return `  - ${primary}[Oak Lesson] "${oak.title}"${content ? `\n${content}` : ''}`
        }
        const extracted = (r as { extractedText?: string | null }).extractedText
        if (r.fileKey && !r.url && extracted) {
          const excerpt = extracted.slice(0, 3000).split('\n').map(l => `    ${l}`).join('\n')
          return `  - ${primary}[${r.type}] "${r.label}" (uploaded file)\n  Slide/page content:\n${excerpt}`
        }
        return `  - ${primary}[${r.type}] "${r.label}"${r.url ? ` (${r.url})` : ''}`
      }).join('\n')
    : '  - No lesson resources attached'

  const objectivesContext = lesson.objectives.length > 0
    ? lesson.objectives.map((o, i) => `  ${i + 1}. ${o}`).join('\n')
    : '  (No learning objectives specified — generate questions appropriate for the lesson title and topic)'

  // ── SEND profile (best effort) ─────────────────────────────────────────────
  let send = { block: '', ilpTargetIds: [] as string[] }
  if (lesson.classId) {
    try { send = await sendProfile(schoolId, lesson.classId) } catch { /* best effort */ }
  }

  // ── Scheme of work (best effort) ───────────────────────────────────────────
  let ygPlanContext = ''
  try {
    const { getYearGroupPlanContext } = await import('@/app/actions/year-group-plans')
    const plan = await getYearGroupPlanContext(schoolId, subject, yearGroup)
    if (plan) ygPlanContext = `\nSCHEME OF WORK — use this to ensure homework aligns with the curriculum plan:\n${plan.slice(0, 800)}\n`
  } catch { /* best effort */ }

  // ── Curriculum facts: from linked Oak lessons, or an Oak benchmark when none are linked
  const curriculum = {
    learningPoints: oakDetails.flatMap(o => asArray(o.keyLearningPoints).map(p => textOf(p, 'keyLearningPoint'))).filter(Boolean).slice(0, 10),
    misconceptions: oakDetails.flatMap(o => asArray(o.misconceptionsAndCommonMistakes).map(m => textOf(m, 'misconception'))).filter(Boolean).slice(0, 8),
    vocabulary:     oakDetails.flatMap(o => asArray(o.lessonKeywords).map(k => textOf(k, 'keyword'))).filter(Boolean).slice(0, 12),
  }
  let benchmark = ''
  if (oakDetails.length === 0) {
    try {
      const ctx = await getOakPedagogicalContext(oakSubjectSlugFor(subject), yearGroup, 8, yearGroup >= 10 ? (examBoard || null) : null)
      if (ctx.lessonCount > 0) {
        const parts = [
          `\nOAK NATIONAL ACADEMY — CURRICULUM QUALITY BENCHMARK (Year ${yearGroup} ${subject})`,
          'Use this as a quality and depth guide — questions must reach this curriculum standard.',
        ]
        if (ctx.klps.length) parts.push(`Key learning points at this level:\n${ctx.klps.slice(0, 6).map(k => `  • ${k}`).join('\n')}`)
        if (ctx.vocabulary.length) parts.push(`Subject vocabulary at this level:\n${ctx.vocabulary.slice(0, 8).map(v => `  • ${v}`).join('\n')}`)
        if (ctx.misconceptions.length) parts.push(`Common misconceptions to address:\n${ctx.misconceptions.slice(0, 4).map(m => `  • ${m}`).join('\n')}`)
        if (ctx.outcomePatterns.length) parts.push(`Example learning outcomes (match this depth and specificity):\n${ctx.outcomePatterns.slice(0, 3).map(o => `  • ${o}`).join('\n')}`)
        benchmark = parts.join('\n') + '\n'
        curriculum.misconceptions = ctx.misconceptions.slice(0, 8)
        curriculum.vocabulary = ctx.vocabulary.slice(0, 12)
      }
    } catch { /* best effort */ }
  }

  const taskInstruction = hasPrimaryNonOak
    ? "Your homework questions MUST be based on the PRIMARY RESOURCE marked above (the teacher's own uploaded material). The slide/page content extracted from that file is provided above — use it as your primary source. Generate questions that test the SPECIFIC facts, arguments, and evidence from those slides. Each model answer MUST be drawn directly from the content shown, including specific details, dates, names, and key vocabulary. Do NOT generate generic questions."
    : preferredResourceId
      ? 'Your homework questions MUST be based primarily on the PRIMARY RESOURCE marked in the resource list above. Generate questions that test the specific content and learning outcome of that resource. Other resources and learning objectives are supplementary context — do not let them override the PRIMARY RESOURCE selection.'
      : lesson.objectives.length > 0
        ? 'Your homework questions MUST directly test the learning objectives listed above. Students should be able to answer from what they learned in this lesson.'
        : `Your homework questions MUST be based on the lesson resources listed above. Use the Oak lesson learning outcomes as your targets — generate questions that test exactly what those outcomes describe. Questions must be specific to "${lesson.title}" — do not generate generic "describe key concepts" questions.`

  const contextBlock = `You are an expert UK secondary school ${subject} teacher creating homework for a ${qualification} class${examBoard ? ` (${examBoard})` : ''}.

LESSON CONTEXT
==============
Title: "${lesson.title}"${topic ? `\nTopic: ${topic}` : ''}
Year Group: Year ${yearGroup} (${qualification})${examBoard ? `\nExam Board: ${examBoard}` : ''}

LEARNING OBJECTIVES — what was taught in this lesson:
${objectivesContext}

LESSON RESOURCES — source material for questions:
${resourceContext}
${send.block}${ygPlanContext}${benchmark}`

  const prompt = `${contextBlock}
TASK
====
${taskInstruction}

${buildTypePrompt(type, subject, qualification)}`

  return {
    lessonId, lessonTitle: lesson.title, subject, yearGroup, qualification, examBoard, type,
    prompt, contextBlock, taskInstruction,
    ilpTargetIds: send.ilpTargetIds,
    basedOnSchemeOfWork: !!ygPlanContext,
    curriculum,
  }
}

/** True while the teacher is under the daily AI homework limit. Counted from the audit log, so it survives restarts. */
export async function underDailyLimit(schoolId: string, userId: string): Promise<boolean> {
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
  const count = await prisma.auditLog.count({
    where: { schoolId, actorId: userId, action: 'AI_HOMEWORK_GENERATED', createdAt: { gte: midnight } },
  })
  return count < DAILY_GENERATION_LIMIT
}
