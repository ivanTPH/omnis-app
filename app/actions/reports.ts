'use server'

import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { percentToGcseGrade } from '@/lib/grading'
import { AI_ONE_SHOT_OPTS } from '@/lib/ai-timeouts'

// Same staff roles, same "own school" scoping as the existing report-card export route.
const ALLOWED_ROLES = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN']

export type ReportSubjectComparison = {
  subject:         string
  predictedGrade:  number | null
  predictedSource: 'Teacher prediction' | 'Baseline (KS2/CATs)' | null
  actualGrade:     number | null
  gap:             number | null   // actualGrade - predictedGrade
}

export type ReportIlpTarget = {
  target:     string
  status:     string
  targetDate: string | null
}

export type ReportSourceData = {
  studentId:         string
  studentName:       string
  yearGroup:         number | null
  tutorGroup:        string | null
  schoolName:        string
  academicYearLabel: string
  attendancePct:     number | null
  passport: {
    workingAtGrade: number | null
    targetGrade:    number | null
    predictedGrade: number | null
  }
  subjects:   ReportSubjectComparison[]
  ilpTargets: ReportIlpTarget[]
  behaviour: {
    positiveCount: number
    negativeCount: number
    netPoints:     number
  }
}

export type ReportNarrativeSections = {
  performance:         string
  potential:           string
  areasForImprovement: string
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Returns { start, label } for the current UK academic year (1 Sept – 31 Aug). */
function currentAcademicYear(): { start: Date; label: string } {
  const now   = new Date()
  const month = now.getMonth() // 0-indexed
  const year  = now.getFullYear()
  const startYear = month >= 8 ? year : year - 1
  return {
    start: new Date(startYear, 8, 1),
    label: `${startYear}-${String(startYear + 1).slice(-2)}`,
  }
}

/** Mirrors lib/actions/rag.ts's maxFromBands/toPercent — normalises a raw score to 0-100. */
function maxFromBands(bands: unknown): number {
  if (!bands || typeof bands !== 'object') return 9
  const keys = Object.keys(bands as Record<string, string>)
  const nums = keys.flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n)))
  return nums.length ? Math.max(...nums) : 9
}

function toPercent(rawScore: number, bands: unknown): number {
  const max = maxFromBands(bands)
  if (max <= 0) return 0
  return Math.min(100, Math.round((rawScore / max) * 100))
}

async function assertAccess(studentId: string) {
  const user = await requireAuth()
  if (!ALLOWED_ROLES.includes(user.role)) throw new Error('Forbidden')

  const student = await prisma.user.findFirst({
    where:  { id: studentId, schoolId: user.schoolId, role: 'STUDENT' },
    select: {
      id: true, firstName: true, lastName: true,
      yearGroup: true, tutorGroup: true, attendancePercentage: true,
    },
  })
  if (!student) throw new Error('Student not found')

  return { user, student }
}

// ── Step 0/1: structured source data (predicted vs actual, attendance, ILP, behaviour) ──

export async function getReportSourceData(studentId: string): Promise<ReportSourceData> {
  const { user, student } = await assertAccess(studentId)
  const { start: yearStart, label: academicYearLabel } = currentAcademicYear()

  const [
    school, passport, enrolments, predictions, baselines, submissions,
    ilpPlan, behaviourRecords,
  ] = await Promise.all([
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
    prisma.studentLearningProfile.findUnique({
      where:  { studentId },
      select: { workingAtGrade: true, targetGrade: true, predictedGrade: true },
    }),
    prisma.enrolment.findMany({
      where:   { userId: studentId, class: { schoolId: user.schoolId } },
      select:  { class: { select: { subject: true } } },
      distinct: ['classId'],
    }),
    // Most recent TeacherPrediction per subject this academic year
    prisma.teacherPrediction.findMany({
      where:   { studentId, schoolId: user.schoolId, createdAt: { gte: yearStart } },
      select:  { subject: true, predictedScore: true, adjustment: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.studentBaseline.findMany({
      where:  { studentId, schoolId: user.schoolId },
      select: { subject: true, baselineScore: true },
    }),
    prisma.submission.findMany({
      where: {
        studentId, schoolId: user.schoolId,
        finalScore: { not: null },
        status:     { in: ['MARKED', 'RETURNED'] },
        markedAt:   { gte: yearStart },
      },
      select: {
        finalScore: true,
        homework:   { select: { gradingBands: true, class: { select: { subject: true } } } },
      },
    }),
    // Same "safe to show a parent" filter as parent-report/[studentId]/route.ts
    prisma.individualLearningPlan.findFirst({
      where:  { studentId, schoolId: user.schoolId, status: { in: ['active', 'under_review'] } },
      select: {
        targets: {
          where:   { status: { notIn: ['not_achieved'] } },
          select:  { target: true, status: true, targetDate: true },
          orderBy: { targetDate: 'asc' },
          take: 5,
        },
      },
    }),
    prisma.behaviourRecord.findMany({
      where:  { studentId, schoolId: user.schoolId, recordDate: { gte: yearStart } },
      select: { type: true, points: true },
    }),
  ])

  // ── Per-subject predicted vs actual ─────────────────────────────────────────
  const subjectNames = new Set<string>([
    ...enrolments.map(e => e.class.subject),
    ...predictions.map(p => p.subject),
    ...baselines.map(b => b.subject),
  ])

  // predictions is ordered by updatedAt desc — keep only the first (most recent) per subject
  const predMap = new Map<string, (typeof predictions)[number]>()
  for (const p of predictions) if (!predMap.has(p.subject)) predMap.set(p.subject, p)
  const baselineMap = new Map(baselines.map(b => [b.subject, b]))

  const actualBySubject = new Map<string, number[]>()
  for (const s of submissions) {
    const subject = s.homework.class?.subject
    if (!subject) continue
    const pct = toPercent(s.finalScore!, s.homework.gradingBands)
    if (!actualBySubject.has(subject)) actualBySubject.set(subject, [])
    actualBySubject.get(subject)!.push(pct)
  }

  const subjects: ReportSubjectComparison[] = [...subjectNames].sort().map(subject => {
    const pred     = predMap.get(subject)
    const baseline = baselineMap.get(subject)
    const predictedScore = pred ? pred.predictedScore + pred.adjustment : (baseline?.baselineScore ?? null)
    const predictedSource: ReportSubjectComparison['predictedSource'] =
      pred ? 'Teacher prediction' : baseline ? 'Baseline (KS2/CATs)' : null

    const actualScores = actualBySubject.get(subject) ?? []
    const actualScore  = actualScores.length > 0
      ? actualScores.reduce((a, b) => a + b, 0) / actualScores.length
      : null

    const predictedGrade = predictedScore != null ? percentToGcseGrade(predictedScore) : null
    const actualGrade    = actualScore    != null ? percentToGcseGrade(actualScore)    : null

    return {
      subject,
      predictedGrade,
      predictedSource,
      actualGrade,
      gap: predictedGrade != null && actualGrade != null ? actualGrade - predictedGrade : null,
    }
  })

  const positiveCount = behaviourRecords.filter(b => b.type === 'positive').length
  const negativeCount = behaviourRecords.filter(b => b.type === 'negative').length
  const netPoints     = behaviourRecords.reduce((sum, b) => sum + b.points, 0)

  return {
    studentId,
    studentName:       `${student.firstName} ${student.lastName}`,
    yearGroup:         student.yearGroup,
    tutorGroup:        student.tutorGroup,
    schoolName:        school?.name ?? user.schoolName,
    academicYearLabel,
    attendancePct:     student.attendancePercentage,
    passport: {
      workingAtGrade: passport?.workingAtGrade ?? null,
      targetGrade:    passport?.targetGrade    ?? null,
      predictedGrade: passport?.predictedGrade ?? null,
    },
    subjects,
    ilpTargets: (ilpPlan?.targets ?? []).map(t => ({
      target:     t.target,
      status:     t.status,
      targetDate: t.targetDate ? t.targetDate.toISOString() : null,
    })),
    behaviour: { positiveCount, negativeCount, netPoints },
  }
}

// ── Step 2: AI-drafted narrative — built from structured data only ─────────────

const SECTION_KEYS = ['performance', 'potential', 'areasForImprovement'] as const
type SectionKey = (typeof SECTION_KEYS)[number]

const FALLBACK_SECTIONS: ReportNarrativeSections = {
  performance:         '',
  potential:           '',
  areasForImprovement: '',
}

function buildNarrativePrompt(data: ReportSourceData, sections: SectionKey[]): string {
  // Deliberately structured-data only — no TaNote/ParentContactEntry free text.
  // See docs/product/2026-09-02-curriculum-alignment-and-report-card.md for the reasoning.
  const payload = {
    studentFirstName:  data.studentName.split(' ')[0],
    yearGroup:         data.yearGroup,
    academicYear:      data.academicYearLabel,
    attendancePct:     data.attendancePct,
    overallTargetGrade:    data.passport.targetGrade,
    overallPredictedGrade: data.passport.predictedGrade,
    overallWorkingAtGrade: data.passport.workingAtGrade,
    subjects: data.subjects.map(s => ({
      subject:        s.subject,
      predictedGrade: s.predictedGrade,
      actualGrade:    s.actualGrade,
      gapGrades:      s.gap,
    })),
    ilpTargets: data.ilpTargets.map(t => ({ target: t.target, status: t.status })),
    behaviourPositivePoints: data.behaviour.positiveCount,
    behaviourNegativePoints: data.behaviour.negativeCount,
  }

  const sectionList = sections.map(s => {
    if (s === 'performance')         return '"performance": overall academic performance this year — reference specific subjects and grades from the data.'
    if (s === 'potential')           return '"potential": what this student is capable of, grounded in predicted grades, ILP targets, and any positive behaviour/achievement points — genuinely encouraging, not generic.'
    return '"areasForImprovement": specific, actionable areas to improve — reference subjects with a negative gap (actual below predicted) and any open ILP targets.'
  }).join('\n')

  return `You are a UK secondary school teacher writing a short parent-facing report section for ${payload.studentFirstName}, a Year ${payload.yearGroup ?? '?'} student.

Use ONLY the structured data below. Do not invent facts, grades, or claims that are not present in this data. If a data point is null/missing, do not mention it or guess at it — write around it naturally.

DATA:
${JSON.stringify(payload, null, 2)}

Write in plain, warm, specific language suitable for a parent/carer reading about their own child. Avoid jargon, avoid generic filler ("X is a valued member of the class"), and avoid restating raw numbers as a list — write prose.

Return ONLY valid JSON with these keys (write ONLY the sections listed, 2-4 sentences each):
{
${sectionList}
}`
}

/**
 * Generates AI-drafted narrative sections from structured data only. Pass `sections` to
 * regenerate a subset (e.g. just ["potential"]) — omitted sections come back as empty
 * strings so the caller can merge with its own already-edited text.
 */
export async function generateReportNarrativeDraft(
  studentId: string,
  sections?: SectionKey[],
): Promise<ReportNarrativeSections> {
  const { user } = await assertAccess(studentId)

  const wantedSections = sections && sections.length > 0 ? sections : [...SECTION_KEYS]

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return FALLBACK_SECTIONS

  const data = await getReportSourceData(studentId)

  try {
    const client = new Anthropic({ apiKey, ...AI_ONE_SHOT_OPTS })
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 900,
      messages:   [{ role: 'user', content: buildNarrativePrompt(data, wantedSections) }],
    })
    const text      = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON in response')
    const parsed = JSON.parse(jsonMatch[0]) as Partial<ReportNarrativeSections>

    const result: ReportNarrativeSections = { ...FALLBACK_SECTIONS }
    for (const key of wantedSections) {
      result[key] = String(parsed[key] ?? '').trim().slice(0, 1200)
    }

    await writeAudit({
      schoolId:   user.schoolId,
      actorId:    user.id,
      action:     'AI_REPORT_NARRATIVE_GENERATED',
      targetType: 'Student',
      targetId:   studentId,
      metadata:   { sections: wantedSections },
    })

    return result
  } catch (err) {
    console.error('[generateReportNarrativeDraft] AI generation failed:', err)
    return FALLBACK_SECTIONS
  }
}
