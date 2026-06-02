/**
 * Seed AgentSnapshot records for demo students.
 * Creates realistic COACH, QUALITY, and PLAN_SYNTHESIS snapshots so that
 * the agent insights UI cards are visible immediately without waiting for cron.
 * Idempotent — upserts, safe to re-run.
 */

import { PrismaClient, AgentType } from '@prisma/client'

const prisma = new PrismaClient()

// ── Vocabulary pools ────────────────────────────────────────────────────────

const ENGLISH_WEAK   = ['Unseen poetry analysis', 'Language paper 2 structure', 'Context in AIC', 'Rhetorical devices', 'Comparative essay technique']
const ENGLISH_STRONG = ['Narrative voice', 'Extract analysis', 'Descriptive writing', 'Character motivation']
const ENGLISH_RISK   = ['Gothic fiction conventions', 'Paper 1 Q4 extended response', 'Viewpoint writing']

const MATHS_WEAK   = ['Quadratic equations', 'Trigonometry ratios', 'Probability trees', 'Simultaneous equations', 'Circle theorems']
const MATHS_STRONG = ['Linear equations', 'Area and perimeter', 'Fractions and decimals', 'Basic probability']
const MATHS_RISK   = ['Algebraic fractions', 'Vectors', 'Transformation geometry']

const SCIENCE_WEAK   = ['Balancing equations', 'Forces and motion', 'Genetic inheritance', 'Wave properties']
const SCIENCE_STRONG = ['Cell biology', 'Periodic table', 'Energy transfers']
const SCIENCE_RISK   = ['Required practicals', 'Electromagnetic spectrum', 'Homeostasis']

const BLOOMS_GAPS = [
  ['Evaluation', 'Synthesis'],
  ['Analysis', 'Evaluation'],
  ['Application', 'Analysis'],
  ['Synthesis'],
  ['Evaluation'],
]

const QUALITY_ISSUES = [
  'Homework questions skewed toward recall (Bloom\'s levels 1–2) — consider adding 1–2 application or analysis questions',
  'Feedback on 3 recent submissions was generic ("Good effort") — more specific targets would support progress',
  'No extended writing task set this term — important for exam preparation',
  'Mark scheme not attached to last 2 homework tasks — students lack model answers to self-assess',
  'Questions closely mirror lesson content — consider including at least one transfer/application question',
  'AI auto-mark accepted without teacher review on 2 submissions — review flagged for accuracy',
]

const PLAN_CONFLICTS = [
  'ILP target "improve written organisation" not reflected in any set homework this term',
  'K Plan asks for chunked tasks but last 3 homework pieces were extended-writing format',
  'EHCP provision specifies verbal instructions — no evidence of audio/verbal alternatives in homework',
  'ILP review date passed 3 weeks ago — review required to check target progress',
]

const PLAN_SUGGESTIONS = [
  'Set one chunked short-answer homework per fortnight to align with ILP scaffolding strategy',
  'Add model sentence starters to next homework to support literacy target',
  'Book SENCO review — ILP targets have not been updated since last term',
  'Consider linking upcoming homework to EHCP outcome 3 (written communication)',
  'Raise with class teacher: attendance pattern may be affecting homework completion rate',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

function pickN<T>(arr: T[], n: number, seed: number): T[] {
  const result: T[] = []
  for (let i = 0; i < n; i++) {
    result.push(arr[(seed + i * 7) % arr.length])
  }
  return [...new Set(result)].slice(0, n)
}

function topicsFor(yearGroup: number | null, seed: number) {
  const pools = (yearGroup ?? 9) >= 10
    ? { weak: MATHS_WEAK, strong: MATHS_STRONG, risk: MATHS_RISK }   // upper school → maths focus
    : seed % 3 === 0
    ? { weak: ENGLISH_WEAK, strong: ENGLISH_STRONG, risk: ENGLISH_RISK }
    : { weak: SCIENCE_WEAK, strong: SCIENCE_STRONG, risk: SCIENCE_RISK }
  return pools
}

function coachNarrative(firstName: string, weak: string[], strong: string[], focus: string[]): string {
  const templates = [
    `${firstName} is performing well in ${strong[0] ?? 'core topics'} but is consistently scoring below 60% on ${weak[0] ?? 'some areas'}. Spaced repetition on ${focus[0] ?? weak[0] ?? 'key topics'} is recommended before the next assessment.`,
    `Recent homework data shows ${firstName} is strong at ${strong[0] ?? 'foundational content'} but has gaps in ${weak[0] ?? 'higher-order skills'}. Priority focus: ${focus[0] ?? 'revision of weaker topics'} this fortnight.`,
    `${firstName} has not been tested on ${focus[0] ?? 'retention-risk topics'} in over 3 weeks — these are at risk of fading. Good performance in ${strong[0] ?? 'recent tasks'} suggests confidence when content is fresh.`,
    `Analysis of ${firstName}'s last 8 submissions shows consistent difficulty with ${weak[0] ?? 'analytical tasks'}. Bloom\'s level coverage is uneven — evaluation-level questions are rarely attempted successfully.`,
  ]
  return templates[Math.abs(firstName.charCodeAt(0) - 65) % templates.length]
}

function qualityNarrative(firstName: string, score: number, issues: string[]): string {
  if (issues.length === 0)
    return `Homework quality for ${firstName}'s class is strong this term — good Bloom's balance, timely feedback, and appropriate SEND adaptation.`
  if (score >= 70)
    return `Homework quality for ${firstName}'s class is generally good. ${issues.length} minor issue${issues.length > 1 ? 's' : ''} flagged for attention this term.`
  return `${issues.length} quality flag${issues.length > 1 ? 's' : ''} detected for ${firstName}'s homework this term. SEND adaptation score is below threshold — review differentiation approach.`
}

function planNarrative(firstName: string, ilp: string, ehcp: string, kplan: string): string {
  const all = [ilp, ehcp, kplan]
  const urgent   = all.filter(v => v === 'URGENT').length
  const review   = all.filter(v => v === 'REVIEW_NEEDED').length
  if (urgent > 0)
    return `Urgent: ${firstName}'s SEND plans have statutory compliance issues that require immediate SENCO attention. At least one plan has not been reviewed within the required timeframe.`
  if (review > 0)
    return `${firstName}'s SEND plans are broadly coherent but ${review} area${review > 1 ? 's' : ''} need review. ILP targets and classroom strategies may have drifted out of alignment since last update.`
  return `${firstName}'s ILP, EHCP provisions, and K Plan are well-aligned and up to date. No coherence issues detected this cycle.`
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding AgentSnapshot records…')

  const teacher = await prisma.user.findFirst({
    where: { role: 'TEACHER', email: { contains: 'omnisdemo' } },
  })
  if (!teacher) {
    console.error('Demo school not found — run npm run db:seed first')
    return
  }
  const schoolId = teacher.schoolId

  const students = await prisma.user.findMany({
    where: { schoolId, role: 'STUDENT', isActive: true },
    select: {
      id: true, firstName: true, yearGroup: true,
      sendStatus: { select: { activeStatus: true, needArea: true } },
    },
    orderBy: { lastName: 'asc' },
  })

  console.log(`Found ${students.length} students`)

  const now = new Date()
  const oneWeek = new Date(now); oneWeek.setDate(now.getDate() + 7)
  const oneMonth = new Date(now); oneMonth.setMonth(now.getMonth() + 1)

  let coachCreated = 0, qualityCreated = 0, planCreated = 0

  for (const [i, student] of students.entries()) {
    const seed = i + student.firstName.charCodeAt(0)
    const isSend = student.sendStatus?.activeStatus && student.sendStatus.activeStatus !== 'NONE'
    const pools = topicsFor(student.yearGroup, seed)

    const weakTopics       = pickN(pools.weak,   2, seed)
    const strongTopics     = pickN(pools.strong,  1, seed + 3)
    const retentionRisk    = pickN(pools.risk,    1, seed + 5)
    const bloomsGaps       = pick(BLOOMS_GAPS, seed)
    const recommendedFocus = pickN(pools.weak,    2, seed + 1)

    // ── COACH snapshot ──────────────────────────────────────────────────────
    const coachKnowledge = {
      weakTopics,
      strongTopics,
      retentionRisk,
      bloomsGaps,
      recommendedFocus,
      lastHomeworkIds:  [],
      lastRevisionIds:  [],
      summaryNarrative: coachNarrative(student.firstName, weakTopics, strongTopics, recommendedFocus),
    }

    await prisma.agentSnapshot.upsert({
      where:  { studentId_agentType: { studentId: student.id, agentType: AgentType.COACH } },
      create: {
        studentId:    student.id,
        schoolId,
        agentType:    AgentType.COACH,
        knowledgeJson: coachKnowledge,
        lastRunAt:    now,
        nextReviewAt: oneWeek,
      },
      update: {
        knowledgeJson: coachKnowledge,
        lastRunAt:    now,
        nextReviewAt: oneWeek,
        dirtyAt:      null,
      },
    })
    coachCreated++

    // ── QUALITY snapshot ────────────────────────────────────────────────────
    const issueCount = isSend ? (seed % 3) : (seed % 2)   // SEND students slightly more likely to have issues
    const issues = pickN(QUALITY_ISSUES, issueCount, seed + 2)
    const sendAdaptationScore = isSend
      ? 45 + (seed % 30)    // 45–74 — room to improve
      : 65 + (seed % 25)    // 65–89 — generally good

    const bloomsBalance: Record<string, number> = {
      'Remember':  3 + (seed % 3),
      'Understand': 2 + (seed % 2),
      'Apply':     1 + (seed % 2),
      'Analyse':   seed % 2,
      'Evaluate':  seed % 2 === 0 ? 0 : 1,
    }

    const qualityKnowledge = {
      lastCheckedHomeworkId: 'demo',
      issues,
      bloomsBalance,
      sendAdaptationScore,
      summaryNarrative: qualityNarrative(student.firstName, sendAdaptationScore, issues),
    }

    await prisma.agentSnapshot.upsert({
      where:  { studentId_agentType: { studentId: student.id, agentType: AgentType.QUALITY } },
      create: {
        studentId:    student.id,
        schoolId,
        agentType:    AgentType.QUALITY,
        knowledgeJson: qualityKnowledge,
        lastRunAt:    now,
        nextReviewAt: oneWeek,
      },
      update: {
        knowledgeJson: qualityKnowledge,
        lastRunAt:    now,
        nextReviewAt: oneWeek,
        dirtyAt:      null,
      },
    })
    qualityCreated++

    // ── PLAN_SYNTHESIS snapshot (SEND only) ─────────────────────────────────
    if (isSend) {
      const coherenceOptions: Array<'OK' | 'REVIEW_NEEDED' | 'URGENT'> = ['OK', 'OK', 'REVIEW_NEEDED']
      const ilpCoherence   = coherenceOptions[(seed    ) % coherenceOptions.length]
      const ehcpCoherence  = coherenceOptions[(seed + 1) % coherenceOptions.length]
      const kPlanCoherence = coherenceOptions[(seed + 2) % coherenceOptions.length]

      const conflictCount    = (ilpCoherence !== 'OK' || kPlanCoherence !== 'OK') ? 1 : 0
      const suggestionCount  = 2
      const conflicts        = conflictCount   ? [pick(PLAN_CONFLICTS,    seed)] : []
      const suggestions      = pickN(PLAN_SUGGESTIONS, suggestionCount, seed + 4)

      const planKnowledge = {
        ilpCoherence,
        ehcpCoherence,
        kPlanCoherence,
        conflicts,
        suggestions,
        summaryNarrative: planNarrative(student.firstName, ilpCoherence, ehcpCoherence, kPlanCoherence),
      }

      await prisma.agentSnapshot.upsert({
        where:  { studentId_agentType: { studentId: student.id, agentType: AgentType.PLAN_SYNTHESIS } },
        create: {
          studentId:    student.id,
          schoolId,
          agentType:    AgentType.PLAN_SYNTHESIS,
          knowledgeJson: planKnowledge,
          lastRunAt:    now,
          nextReviewAt: oneMonth,
        },
        update: {
          knowledgeJson: planKnowledge,
          lastRunAt:    now,
          nextReviewAt: oneMonth,
          dirtyAt:      null,
        },
      })
      planCreated++
    }
  }

  console.log(`Done — ${coachCreated} Coach, ${qualityCreated} Quality, ${planCreated} Plan Synthesis snapshots upserted`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
