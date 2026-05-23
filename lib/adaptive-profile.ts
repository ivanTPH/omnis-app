/**
 * Core adaptive profile computation — no auth dependency.
 * Called by updateLearningProfile (server action) and the early-warning cron.
 */

import { prisma } from '@/lib/prisma'
import Anthropic    from '@anthropic-ai/sdk'

export type AdaptiveProfileResult = {
  id:                 string
  studentId:          string
  typePerformance:    Record<string, { avgScore: number; count: number; avgTimeMin: number; avgSelfAssessment?: number | null }>
  bloomsPerformance:  Record<string, number>
  subjectPerformance: Record<string, { avg: number; trend: string }>
  preferredTypes:     string[]
  strengthAreas:      string[]
  developmentAreas:   string[]
  avgCompletionRate:  number
  sendConcernLevel:   number | null
  lastHomeworkAt:     Date | null
  profileSummary:     string | null
  profileUpdatedAt:   Date | null
}

export async function computeAndSaveAdaptiveProfile(
  studentId: string,
  schoolId:  string,
): Promise<AdaptiveProfileResult | null> {
  const student = await prisma.user.findFirst({
    where: { id: studentId, schoolId, role: 'STUDENT' },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!student) return null

  const submissions = await prisma.submission.findMany({
    where: { studentId, schoolId },
    select: {
      finalScore:     true,
      status:         true,
      submittedAt:    true,
      timeSpentMins:  true,
      selfAssessment: true,
      sendRiskScore:  true,
      homework: {
        select: {
          homeworkVariantType: true,
          bloomsLevel:         true,
          estimatedMins:       true,
          class: { select: { subject: true } },
        },
      },
    },
  })

  const typeMap:    Record<string, { scores: number[]; times: number[]; selfScores: number[] }> = {}
  const bloomsMap:  Record<string, number[]> = {}
  const subjectMap: Record<string, { scores: number[]; recent: number[] }> = {}
  let submittedCount = 0

  for (const sub of submissions) {
    if (sub.status !== 'RETURNED') continue
    submittedCount++

    const varType = sub.homework.homeworkVariantType ?? 'free_text'
    if (!typeMap[varType]) typeMap[varType] = { scores: [], times: [], selfScores: [] }
    if (sub.finalScore != null) typeMap[varType].scores.push(sub.finalScore)
    if (sub.timeSpentMins && sub.homework.estimatedMins) {
      typeMap[varType].times.push(sub.timeSpentMins / sub.homework.estimatedMins)
    }
    if (sub.selfAssessment) typeMap[varType].selfScores.push(sub.selfAssessment)

    if (sub.homework.bloomsLevel && sub.finalScore != null) {
      if (!bloomsMap[sub.homework.bloomsLevel]) bloomsMap[sub.homework.bloomsLevel] = []
      bloomsMap[sub.homework.bloomsLevel].push(sub.finalScore)
    }

    const subject  = sub.homework.class?.subject ?? 'Other'
    const isRecent = sub.submittedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    if (!subjectMap[subject]) subjectMap[subject] = { scores: [], recent: [] }
    if (sub.finalScore != null) {
      subjectMap[subject].scores.push(sub.finalScore)
      if (isRecent) subjectMap[subject].recent.push(sub.finalScore)
    }
  }

  const totalAssigned     = submissions.length
  const avgCompletionRate = totalAssigned > 0 ? submittedCount / totalAssigned : 0

  const typePerformance: Record<string, { avgScore: number; count: number; avgTimeMin: number; avgSelfAssessment?: number | null }> = {}
  for (const [t, d] of Object.entries(typeMap)) {
    typePerformance[t] = {
      avgScore:   d.scores.length ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
      count:      d.scores.length,
      avgTimeMin: d.times.length  ? Math.round(d.times.reduce((a, b) => a + b, 0)  / d.times.length * 100) / 100 : 0,
      avgSelfAssessment: d.selfScores.length
        ? Math.round(d.selfScores.reduce((a, b) => a + b, 0) / d.selfScores.length * 10) / 10
        : null,
    }
  }

  const bloomsPerformance: Record<string, number> = {}
  for (const [level, scores] of Object.entries(bloomsMap)) {
    bloomsPerformance[level] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }

  const subjectPerformance: Record<string, { avg: number; trend: string }> = {}
  for (const [subject, d] of Object.entries(subjectMap)) {
    const avg       = d.scores.length ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0
    const recentAvg = d.recent.length ? d.recent.reduce((a, b) => a + b, 0) / d.recent.length : avg
    const trend     = recentAvg > avg + 5 ? 'improving' : recentAvg < avg - 5 ? 'declining' : 'stable'
    subjectPerformance[subject] = { avg, trend }
  }

  const preferredTypes = Object.entries(typePerformance)
    .filter(([, d]) => d.count >= 2)
    .sort((a, b) => {
      const scoreA = a[1].avgScore
      const selfA  = a[1].avgSelfAssessment != null ? a[1].avgSelfAssessment * 20 : scoreA
      const scoreB = b[1].avgScore
      const selfB  = b[1].avgSelfAssessment != null ? b[1].avgSelfAssessment * 20 : scoreB
      return (scoreB * 0.6 + selfB * 0.4) - (scoreA * 0.6 + selfA * 0.4)
    })
    .map(([t]) => t)

  const sortedSubjects   = Object.entries(subjectPerformance).sort((a, b) => b[1].avg - a[1].avg)
  const strengthAreas    = sortedSubjects.slice(0, 2).map(([s]) => s)
  const developmentAreas = sortedSubjects.slice(-2).map(([s]) => s)

  const riskScores = submissions
    .filter(s => s.sendRiskScore != null)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 10)
    .map(s => s.sendRiskScore as number)
  const submissionBasedConcern: number | null = riskScores.length > 0
    ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
    : null

  // Factor in IlpEvidenceEntry CONCERN count this term.
  // Each CONCERN entry raises the concern level by 10 points (capped at 100).
  // Blended 50/50 with submission-based score; pure evidence-based if no risk scores exist.
  const now         = new Date()
  const currentTerm = await prisma.termDate.findFirst({
    where: { schoolId, startsAt: { lte: now }, endsAt: { gte: now } },
  })
  const termStart      = currentTerm?.startsAt ?? new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000)
  const ilpConcernCount = await prisma.ilpEvidenceEntry.count({
    where: { schoolId, studentId, evidenceType: 'CONCERN', createdAt: { gte: termStart } },
  })
  const evidenceBasedConcern = Math.min(ilpConcernCount * 10, 100)

  let sendConcernLevel: number | null
  if (ilpConcernCount === 0 && submissionBasedConcern === null) {
    sendConcernLevel = null
  } else if (submissionBasedConcern === null) {
    sendConcernLevel = evidenceBasedConcern
  } else if (ilpConcernCount === 0) {
    sendConcernLevel = submissionBasedConcern
  } else {
    // Blend: submission risk score (50%) + ILP evidence concern (50%)
    sendConcernLevel = Math.round((submissionBasedConcern + evidenceBasedConcern) / 2)
  }

  const lastHomeworkAt: Date | null = submissions.length > 0
    ? submissions.reduce((latest, s) =>
        new Date(s.submittedAt) > new Date(latest.submittedAt) ? s : latest
      ).submittedAt
    : null

  // AI profile summary — only regenerate if > 30 days old and student has enough data.
  // Uses claude-haiku (cheap) for batch cron updates.
  let profileSummary: string | null = null
  const existingProfile = await prisma.studentLearningProfile.findUnique({ where: { studentId } })
  const needsAiUpdate   = !existingProfile?.profileUpdatedAt ||
    new Date(existingProfile.profileUpdatedAt).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000

  if (needsAiUpdate && submittedCount >= 5) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey) {
      try {
        const client = new Anthropic({ apiKey })
        const msg = await client.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: 'You are a UK secondary school teacher writing professional student learning profiles. Use positive, strengths-based language. No diagnoses.',
          messages: [{
            role: 'user',
            content: `Write a 2-paragraph learning profile for ${student.firstName} ${student.lastName}.

Performance data:
- Overall completion rate: ${Math.round(avgCompletionRate * 100)}%
- Best homework types: ${preferredTypes.slice(0, 3).join(', ') || 'insufficient data'}
- Strength subjects: ${strengthAreas.join(', ') || 'none identified'}
- Development areas: ${developmentAreas.join(', ') || 'none identified'}
- Bloom's performance: ${Object.entries(bloomsPerformance).map(([l, s]) => `${l}: ${s}%`).join(', ') || 'insufficient data'}

Paragraph 1: Strengths and preferred learning styles. Paragraph 2: Development areas and recommended approaches.`,
          }],
        })
        profileSummary = (msg.content[0] as any).text.trim()
      } catch {
        // AI unavailable — still save the computed stats
      }
    }
  } else {
    profileSummary = existingProfile?.profileSummary ?? null
  }

  const updated = await prisma.studentLearningProfile.upsert({
    where:  { studentId },
    update: {
      typePerformance,
      bloomsPerformance,
      subjectPerformance,
      preferredTypes,
      strengthAreas,
      developmentAreas,
      avgCompletionRate,
      sendConcernLevel,
      lastHomeworkAt,
      ...(profileSummary ? { profileSummary, profileUpdatedAt: new Date() } : {}),
    },
    create: {
      studentId,
      schoolId,
      typePerformance,
      bloomsPerformance,
      subjectPerformance,
      preferredTypes,
      strengthAreas,
      developmentAreas,
      avgCompletionRate,
      sendConcernLevel,
      lastHomeworkAt,
      profileSummary,
      profileUpdatedAt: profileSummary ? new Date() : null,
    },
  })

  return {
    id:                 updated.id,
    studentId:          updated.studentId,
    typePerformance:    (updated.typePerformance    as any) ?? {},
    bloomsPerformance:  (updated.bloomsPerformance  as any) ?? {},
    subjectPerformance: (updated.subjectPerformance as any) ?? {},
    preferredTypes:     updated.preferredTypes,
    strengthAreas:      updated.strengthAreas,
    developmentAreas:   updated.developmentAreas,
    avgCompletionRate:  updated.avgCompletionRate,
    sendConcernLevel:   (updated as any).sendConcernLevel ?? null,
    lastHomeworkAt:     (updated as any).lastHomeworkAt   ?? null,
    profileSummary:     updated.profileSummary,
    profileUpdatedAt:   updated.profileUpdatedAt,
  }
}
