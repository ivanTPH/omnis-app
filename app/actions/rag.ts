'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/prisma'
import { currentTermLabel, termLabelToDates } from '@/lib/termUtils'
import { percentToGcseGrade } from '@/lib/grading'

// ── Types ──────────────────────────────────────────────────────────────────────

export type RagStatus = 'green' | 'amber' | 'red' | 'no_data'

export type RagStudent = {
  id:              string
  firstName:       string
  lastName:        string
  avatarUrl:       string | null
  hasSend:         boolean
  sendCategory:    string | null
  baselineScore:   number | null   // from StudentBaseline (null if not entered)
  baselineSource:  string | null
  prediction: {
    id:             string
    predictedScore: number
    adjustment:     number
    effectiveScore: number          // predictedScore + adjustment
    notes:          string | null
    updatedAt:      Date
  } | null
  workingAtScore:          number | null   // avg percentage this term (0-100)
  workingAtGrade:          number | null   // GCSE grade 1-9 derived from workingAtScore
  predictedGrade:          number | null   // GCSE grade 1-9 derived from effectiveScore
  effectivePredictedScore: number | null   // best available predicted score: TeacherPrediction → StudentBaseline → Passport
  recentGrades:    number[]        // last 3 GCSE grades (desc) for trend arrow
  lastScore:       number | null   // most recent percentage
  ragStatus:       RagStatus
}

export type SavePredictionInput = {
  studentId:      string
  subject:        string
  termLabel:      string
  predictedScore: number
  adjustment:     number
  notes:          string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Derive maxScore from a homework's gradingBands JSON.
 * Defaults to 9 (consistent with maxFromBandsServer in lessons.ts) so that
 * homework with no explicit gradingBands is treated as out-of-9 rather than
 * out-of-100 — preventing raw scores like 4 from appearing as 4% instead of 44%.
 */
function maxFromBands(bands: unknown): number {
  if (!bands || typeof bands !== 'object') return 9
  const keys = Object.keys(bands as Record<string, string>)
  const nums = keys.flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n)))
  return nums.length ? Math.max(...nums) : 9
}

/** Normalise a raw finalScore to 0-100 using the homework's gradingBands.
 *  Always produces a value in [0, 100] — never returns impossible percentages. */
function toPercent(finalScore: number, bands: unknown): number {
  const max = maxFromBands(bands)
  if (max <= 0) return 0
  return Math.min(100, Math.round((finalScore / max) * 100))
}

// ── RAG logic ─────────────────────────────────────────────────────────────────

/**
 * Grade-based RAG:
 *   green  = at or above predicted GCSE grade
 *   amber  = 1 grade below predicted
 *   red    = 2+ grades below predicted
 */
function computeRag(workingAt: number | null, effective: number | null): RagStatus {
  if (workingAt == null || effective == null) return 'no_data'
  const workingGrade   = percentToGcseGrade(workingAt)
  const predictedGrade = percentToGcseGrade(effective)
  const diff = workingGrade - predictedGrade
  if (diff >= 0)  return 'green'
  if (diff >= -1) return 'amber'
  return 'red'
}

// ── getClassRagData ────────────────────────────────────────────────────────────

export async function getClassRagData(
  classId:    string,
  termLabel?: string,
): Promise<RagStudent[]> {
  try {
  const session = await auth()
  if (!session) return []
  const { schoolId, id: teacherId } = session.user as any

  const term       = termLabel ?? currentTermLabel()
  const { from, to } = termLabelToDates(term)

  // ── 1+2. Resolve class + enrolled students in one query ─────────────────────
  const cls = await prisma.schoolClass.findUnique({
    where:  { id: classId },
    select: {
      subject:    true,
      enrolments: { where: { class: { schoolId } }, select: { userId: true }, distinct: ['userId'] },
    },
  })
  if (!cls) return []
  const subject    = cls.subject
  const studentIds = cls.enrolments.map(e => e.userId)
  if (studentIds.length === 0) return []

  // ── 3. Bulk-fetch supporting data ───────────────────────────────────────────
  const [users, sendStatuses, baselines, predictions, submissionsThisTerm, passportProfiles] =
    await Promise.all([
      prisma.user.findMany({
        where:  { id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      }),
      prisma.sendStatus.findMany({
        where:  { studentId: { in: studentIds } },
        select: { studentId: true, activeStatus: true },
      }),
      prisma.studentBaseline.findMany({
        where:  { studentId: { in: studentIds }, subject },
        select: { studentId: true, baselineScore: true, source: true },
      }),
      prisma.teacherPrediction.findMany({
        where:  { studentId: { in: studentIds }, teacherId, subject, termLabel: term },
        select: { id: true, studentId: true, predictedScore: true, adjustment: true, notes: true, updatedAt: true },
      }),
      // Current-term submissions — fall back to all-time for this class if none found
      (async () => {
        const termSubs = await prisma.submission.findMany({
          where: {
            studentId:  { in: studentIds },
            finalScore: { not: null },
            status:     { in: ['MARKED', 'RETURNED'] },
            homework:   { classId, dueAt: { gte: from, lte: to } },
          },
          select:  { studentId: true, finalScore: true, markedAt: true, homework: { select: { gradingBands: true } } },
          orderBy: { markedAt: 'desc' },
        })
        // If no current-term data, widen to all-time for this class
        if (termSubs.length === 0) {
          return prisma.submission.findMany({
            where: {
              studentId:  { in: studentIds },
              finalScore: { not: null },
              status:     { in: ['MARKED', 'RETURNED'] },
              homework:   { classId },
            },
            select:  { studentId: true, finalScore: true, markedAt: true, homework: { select: { gradingBands: true } } },
            orderBy: { markedAt: 'desc' },
          })
        }
        return termSubs
      })(),
      // Passport predicted grades — fallback when no TeacherPrediction or StudentBaseline
      prisma.studentLearningProfile.findMany({
        where:  { studentId: { in: studentIds } },
        select: { studentId: true, predictedGrade: true },
      }),
    ])

  // ── 4. Index into maps ──────────────────────────────────────────────────────
  const sendMap       = new Map(sendStatuses.map(s => [s.studentId, s.activeStatus]))
  const baselineMap   = new Map(baselines.map(b => [b.studentId, b]))
  const predMap       = new Map(predictions.map(p => [p.studentId, p]))
  const passportMap   = new Map(passportProfiles.map(p => [p.studentId, p]))

  // Group submissions per student (already ordered desc by markedAt from DB)
  const submissionsByStudent = new Map<string, typeof submissionsThisTerm>()
  for (const sub of submissionsThisTerm) {
    if (!submissionsByStudent.has(sub.studentId)) submissionsByStudent.set(sub.studentId, [])
    submissionsByStudent.get(sub.studentId)!.push(sub)
  }

  // ── 5. Build result ─────────────────────────────────────────────────────────
  return users
    .map(u => {
      const activeStatus = sendMap.get(u.id)
      const hasSend      = !!activeStatus && activeStatus !== 'NONE'
      const baseline     = baselineMap.get(u.id) ?? null
      const pred         = predMap.get(u.id) ?? null
      const subs         = submissionsByStudent.get(u.id) ?? []

      // Normalise each submission score to 0-100 before averaging so it's
      // on the same scale as predictedScore (which is always 0-100).
      const workingAtScore = subs.length > 0
        ? Math.round(
            subs.reduce((acc, s) => acc + toPercent(s.finalScore ?? 0, s.homework.gradingBands), 0)
            / subs.length,
          )
        : null
      const lastScore = subs.length > 0
        ? toPercent(subs[0].finalScore ?? 0, subs[0].homework.gradingBands)
        : null

      const prediction = pred
        ? {
            id:             pred.id,
            predictedScore: pred.predictedScore,
            adjustment:     pred.adjustment,
            effectiveScore: pred.predictedScore + pred.adjustment,
            notes:          pred.notes,
            updatedAt:      pred.updatedAt,
          }
        : null

      // Passport fallback: convert GCSE grade 1-9 → 0-100 percentage
      const passportGrade = passportMap.get(u.id)?.predictedGrade ?? null
      const passportScore = passportGrade != null ? Math.round(passportGrade * 11.11) : null

      const effectivePredicted =
        prediction?.effectiveScore ?? baseline?.baselineScore ?? passportScore

      const recentGrades = subs.slice(0, 3).map(s =>
        percentToGcseGrade(toPercent(s.finalScore ?? 0, s.homework.gradingBands)),
      )

      return {
        id:             u.id,
        firstName:      u.firstName,
        lastName:       u.lastName,
        avatarUrl:      u.avatarUrl,
        hasSend,
        sendCategory:   hasSend ? (activeStatus as string) : null,
        baselineScore:  baseline?.baselineScore ?? null,
        baselineSource: baseline?.source ?? null,
        prediction,
        workingAtScore,
        workingAtGrade:          workingAtScore != null ? percentToGcseGrade(workingAtScore) : null,
        predictedGrade:          effectivePredicted != null ? percentToGcseGrade(effectivePredicted) : null,
        effectivePredictedScore: effectivePredicted,
        recentGrades,
        lastScore,
        ragStatus: computeRag(workingAtScore, effectivePredicted),
      }
    })
    .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`))
  } catch (err) {
    console.error('[getClassRagData] error:', err)
    return []
  }
}

// ── upsertTeacherPrediction ────────────────────────────────────────────────────

export async function upsertTeacherPrediction(input: SavePredictionInput): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: teacherId } = session.user as any

  await prisma.teacherPrediction.upsert({
    where: {
      studentId_teacherId_subject_termLabel: {
        studentId: input.studentId,
        teacherId,
        subject:   input.subject,
        termLabel: input.termLabel,
      },
    },
    update: {
      predictedScore: input.predictedScore,
      adjustment:     input.adjustment,
      notes:          input.notes || null,
    },
    create: {
      studentId:      input.studentId,
      teacherId,
      schoolId,
      subject:        input.subject,
      termLabel:      input.termLabel,
      predictedScore: input.predictedScore,
      adjustment:     input.adjustment,
      notes:          input.notes || null,
    },
  })

  await writeAudit({
    schoolId,
    actorId:    teacherId,
    action:     'USER_SETTINGS_CHANGED',
    targetType: 'TeacherPrediction',
    targetId:   input.studentId,
    metadata:   { subject: input.subject, termLabel: input.termLabel, predictedScore: input.predictedScore, adjustment: input.adjustment },
  })
}
