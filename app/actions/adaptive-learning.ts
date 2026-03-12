'use server'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

async function requireStaff() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as { id: string; schoolId: string; role: string }
  if (!['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(user.role)) {
    redirect('/dashboard')
  }
  return user
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type StudentLearningProfileData = {
  id: string
  studentId: string
  typePerformance: Record<string, { avgScore: number; count: number; avgTimeMin: number }>
  bloomsPerformance: Record<string, number>
  subjectPerformance: Record<string, { avg: number; trend: string }>
  preferredTypes: string[]
  strengthAreas: string[]
  developmentAreas: string[]
  avgCompletionRate: number
  profileSummary: string | null
  profileUpdatedAt: Date | null
}

export type SpacedRepetitionSuggestion = {
  suggestedDate: Date
  priorHomeworkIds: string[]
  rationale: string
}

export type LayeredSequence = {
  topics: string[]
  bloomsProgression: string[]
  gaps: string[]
  homeworkCount: number
}

export type NextHomeworkSuggestion = {
  suggestedType: string
  bloomsLevel: string
  topicsToReinforce: string[]
  spacingRecommendation: string
  ilpTargetsToAddress: string[]
}

export type AdaptiveHomeworkSuggestions = {
  adaptations: string[]
  alternativeType: string | null
  scaffolding: string[]
  ilpAlignments: string[]
}

// ─── Learning Profile ─────────────────────────────────────────────────────────

export async function getStudentLearningProfile(studentId: string): Promise<StudentLearningProfileData | null> {
  const user = await requireStaff()
  const schoolId = user.schoolId

  // Verify student in same school
  const student = await prisma.user.findFirst({
    where: { id: studentId, schoolId, role: 'STUDENT' },
    select: { id: true },
  })
  if (!student) return null

  let profile = await prisma.studentLearningProfile.findUnique({ where: { studentId } })

  if (!profile) {
    // Create default profile
    profile = await prisma.studentLearningProfile.create({
      data: { studentId, schoolId },
    })
  }

  return {
    id: profile.id,
    studentId: profile.studentId,
    typePerformance: (profile.typePerformance as any) ?? {},
    bloomsPerformance: (profile.bloomsPerformance as any) ?? {},
    subjectPerformance: (profile.subjectPerformance as any) ?? {},
    preferredTypes: profile.preferredTypes,
    strengthAreas: profile.strengthAreas,
    developmentAreas: profile.developmentAreas,
    avgCompletionRate: profile.avgCompletionRate,
    profileSummary: profile.profileSummary,
    profileUpdatedAt: profile.profileUpdatedAt,
  }
}

export async function updateLearningProfile(studentId: string): Promise<StudentLearningProfileData | null> {
  const user = await requireStaff()
  const schoolId = user.schoolId

  const student = await prisma.user.findFirst({
    where: { id: studentId, schoolId, role: 'STUDENT' },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!student) return null

  // Gather all submissions
  const submissions = await prisma.submission.findMany({
    where: { studentId, schoolId },
    select: {
      finalScore: true,
      status: true,
      submittedAt: true,
      timeSpentMins: true,
      homework: {
        select: {
          homeworkVariantType: true,
          bloomsLevel: true,
          estimatedMins: true,
          class: { select: { subject: true } },
        },
      },
    },
  })

  // Calculate type performance
  const typeMap: Record<string, { scores: number[]; times: number[] }> = {}
  const bloomsMap: Record<string, number[]> = {}
  const subjectMap: Record<string, { scores: number[]; recent: number[] }> = {}
  let submittedCount = 0

  for (const sub of submissions) {
    if (sub.status !== 'RETURNED') continue
    submittedCount++

    const varType = sub.homework.homeworkVariantType ?? 'free_text'
    if (!typeMap[varType]) typeMap[varType] = { scores: [], times: [] }
    if (sub.finalScore != null) typeMap[varType].scores.push(sub.finalScore)
    if (sub.timeSpentMins && sub.homework.estimatedMins) {
      typeMap[varType].times.push(sub.timeSpentMins / sub.homework.estimatedMins)
    }

    if (sub.homework.bloomsLevel && sub.finalScore != null) {
      if (!bloomsMap[sub.homework.bloomsLevel]) bloomsMap[sub.homework.bloomsLevel] = []
      bloomsMap[sub.homework.bloomsLevel].push(sub.finalScore)
    }

    const subject = sub.homework.class?.subject ?? 'Other'
    const isRecent = sub.submittedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    if (!subjectMap[subject]) subjectMap[subject] = { scores: [], recent: [] }
    if (sub.finalScore != null) {
      subjectMap[subject].scores.push(sub.finalScore)
      if (isRecent) subjectMap[subject].recent.push(sub.finalScore)
    }
  }

  const totalAssigned = submissions.length
  const avgCompletionRate = totalAssigned > 0 ? submittedCount / totalAssigned : 0

  const typePerformance: Record<string, { avgScore: number; count: number; avgTimeMin: number }> = {}
  for (const [t, d] of Object.entries(typeMap)) {
    typePerformance[t] = {
      avgScore: d.scores.length ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
      count: d.scores.length,
      avgTimeMin: d.times.length ? Math.round(d.times.reduce((a, b) => a + b, 0) / d.times.length * 100) / 100 : 0,
    }
  }

  const bloomsPerformance: Record<string, number> = {}
  for (const [level, scores] of Object.entries(bloomsMap)) {
    bloomsPerformance[level] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }

  const subjectPerformance: Record<string, { avg: number; trend: string }> = {}
  for (const [subject, d] of Object.entries(subjectMap)) {
    const avg = d.scores.length ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0
    const recentAvg = d.recent.length ? d.recent.reduce((a, b) => a + b, 0) / d.recent.length : avg
    const trend = recentAvg > avg + 5 ? 'improving' : recentAvg < avg - 5 ? 'declining' : 'stable'
    subjectPerformance[subject] = { avg, trend }
  }

  // Derive preferred types (sorted by avg score, min 2 submissions)
  const preferredTypes = Object.entries(typePerformance)
    .filter(([, d]) => d.count >= 2)
    .sort((a, b) => b[1].avgScore - a[1].avgScore)
    .map(([t]) => t)

  // Strength/development areas from subjects
  const sortedSubjects = Object.entries(subjectPerformance).sort((a, b) => b[1].avg - a[1].avg)
  const strengthAreas = sortedSubjects.slice(0, 2).map(([s]) => s)
  const developmentAreas = sortedSubjects.slice(-2).map(([s]) => s)

  // AI profile summary — only if profile is old or this is a batch update
  let profileSummary: string | null = null
  const existingProfile = await prisma.studentLearningProfile.findUnique({ where: { studentId } })
  const needsAiUpdate = !existingProfile?.profileUpdatedAt ||
    new Date(existingProfile.profileUpdatedAt).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000

  if (needsAiUpdate && submittedCount >= 5) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey) {
      try {
        const client = new Anthropic({ apiKey })
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
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
        // AI unavailable — skip
      }
    }
  } else {
    profileSummary = existingProfile?.profileSummary ?? null
  }

  const updated = await prisma.studentLearningProfile.upsert({
    where: { studentId },
    update: {
      typePerformance,
      bloomsPerformance,
      subjectPerformance,
      preferredTypes,
      strengthAreas,
      developmentAreas,
      avgCompletionRate,
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
      profileSummary,
      profileUpdatedAt: profileSummary ? new Date() : null,
    },
  })

  return {
    id: updated.id,
    studentId: updated.studentId,
    typePerformance: (updated.typePerformance as any) ?? {},
    bloomsPerformance: (updated.bloomsPerformance as any) ?? {},
    subjectPerformance: (updated.subjectPerformance as any) ?? {},
    preferredTypes: updated.preferredTypes,
    strengthAreas: updated.strengthAreas,
    developmentAreas: updated.developmentAreas,
    avgCompletionRate: updated.avgCompletionRate,
    profileSummary: updated.profileSummary,
    profileUpdatedAt: updated.profileUpdatedAt,
  }
}

// ─── Spaced Repetition & Sequence ────────────────────────────────────────────

export async function suggestSpacedRepetition(
  classId: string,
  subject: string,
  topic: string,
): Promise<SpacedRepetitionSuggestion> {
  const user = await requireStaff()
  const schoolId = user.schoolId

  // Find last 3 homework for this class/subject related to this topic
  const prior = await prisma.homework.findMany({
    where: {
      schoolId,
      classId,
      class: { subject },
      status: 'PUBLISHED',
      title: { contains: topic, mode: 'insensitive' },
    },
    orderBy: { dueAt: 'desc' },
    take: 3,
    select: { id: true, dueAt: true },
  })

  // Spaced repetition intervals: 1 day → 3 days → 7 days → 14 days
  const spacing = [1, 3, 7, 14]
  const intervalDays = spacing[Math.min(prior.length, spacing.length - 1)]

  const lastDue = prior.length > 0 ? prior[0].dueAt : new Date()
  const suggestedDate = new Date(lastDue.getTime() + intervalDays * 24 * 60 * 60 * 1000)

  const rationale = prior.length === 0
    ? `First homework on "${topic}" — no prior spacing needed.`
    : `${prior.length} prior homework${prior.length > 1 ? 's' : ''} on this topic. Spaced repetition suggests ${intervalDays} days after the last (${lastDue.toLocaleDateString('en-GB')}).`

  return {
    suggestedDate,
    priorHomeworkIds: prior.map(p => p.id),
    rationale,
  }
}

export async function getLayeredLearningSequence(
  classId: string,
  subject: string,
): Promise<LayeredSequence> {
  const user = await requireStaff()
  const schoolId = user.schoolId

  const homeworks = await prisma.homework.findMany({
    where: { schoolId, classId, class: { subject }, status: 'PUBLISHED' },
    orderBy: { dueAt: 'asc' },
    select: { id: true, bloomsLevel: true, learningObjectives: true, dueAt: true },
    take: 30,
  })

  const bloomsOrder = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create']
  const bloomsProgression = [...new Set(
    homeworks.map(h => h.bloomsLevel).filter(Boolean) as string[]
  )].sort((a, b) => bloomsOrder.indexOf(a) - bloomsOrder.indexOf(b))

  const topics: string[] = [...new Set(
    homeworks.flatMap(h => h.learningObjectives.slice(0, 2))
  )].slice(0, 10)

  // Identify gaps in Bloom's progression
  const covered = new Set(bloomsProgression)
  const gaps = bloomsOrder.filter(level => !covered.has(level))

  return {
    topics,
    bloomsProgression,
    gaps,
    homeworkCount: homeworks.length,
  }
}

export async function suggestNextHomework(
  classId: string,
  lessonId: string,
): Promise<NextHomeworkSuggestion> {
  const user = await requireStaff()
  const schoolId = user.schoolId

  const [lesson, recentHw, ilpTargetsDue] = await Promise.all([
    prisma.lesson.findFirst({
      where: { id: lessonId, schoolId },
      select: { title: true, objectives: true, topic: true },
    }),
    prisma.homework.findMany({
      where: { schoolId, classId, status: 'PUBLISHED' },
      orderBy: { dueAt: 'desc' },
      take: 5,
      select: { bloomsLevel: true, homeworkVariantType: true, learningObjectives: true },
    }),
    prisma.ilpTarget.findMany({
      where: {
        ilp: {
          schoolId,
          status: 'active',
          student: { enrolments: { some: { classId } } },
        },
        status: 'in_progress',
        targetDate: { lte: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, target: true },
      take: 5,
    }),
  ])

  const bloomsOrder = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create']
  const lastBloomsLevel = recentHw.find(h => h.bloomsLevel)?.bloomsLevel ?? 'remember'
  const lastBloomsIdx = bloomsOrder.indexOf(lastBloomsLevel)
  const nextBloomsLevel = bloomsOrder[Math.min(lastBloomsIdx + 1, bloomsOrder.length - 1)]

  // Suggest type based on Bloom's level
  const typeByBlooms: Record<string, string> = {
    remember: 'retrieval_practice',
    understand: 'quiz',
    apply: 'multiple_choice',
    analyse: 'short_answer',
    evaluate: 'essay',
    create: 'mind_map',
  }

  const topicsToReinforce = lesson?.objectives?.slice(0, 3) ?? []

  return {
    suggestedType: typeByBlooms[nextBloomsLevel] ?? 'quiz',
    bloomsLevel: nextBloomsLevel,
    topicsToReinforce,
    spacingRecommendation: `Target a ${nextBloomsLevel}-level task to progress from the recent ${lastBloomsLevel}-level work.`,
    ilpTargetsToAddress: ilpTargetsDue.map(t => t.target),
  }
}

// ─── Adaptive Suggestions ─────────────────────────────────────────────────────

export async function getAdaptiveHomeworkSuggestions(
  studentId: string,
  homeworkId: string,
): Promise<AdaptiveHomeworkSuggestions> {
  const user = await requireStaff()
  const schoolId = user.schoolId

  const [profile, sendStatus, ilpTargets, hw] = await Promise.all([
    prisma.studentLearningProfile.findUnique({ where: { studentId } }),
    prisma.sendStatus.findUnique({ where: { studentId } }),
    prisma.ilpTarget.findMany({
      where: { ilp: { schoolId, studentId, status: 'active' }, status: 'in_progress' },
      select: { id: true, target: true, strategy: true },
      take: 5,
    }),
    prisma.homework.findFirst({ where: { id: homeworkId, schoolId }, select: { homeworkVariantType: true, bloomsLevel: true, learningObjectives: true } }),
  ])

  const adaptations: string[] = []
  const scaffolding: string[] = []

  // SEND adaptations
  if (sendStatus?.activeStatus === 'EHCP' || sendStatus?.activeStatus === 'SEN_SUPPORT') {
    adaptations.push('Provide printed copy of instructions in advance')
    adaptations.push('Allow extra time for completion (25%+)')
    adaptations.push('Break multi-step tasks into numbered sub-tasks')
    scaffolding.push('Offer a sentence starter or writing frame')
    scaffolding.push('Provide key vocabulary list')
  }

  // Profile-based adaptations
  if (profile) {
    const typePerf = (profile.typePerformance as any) ?? {}
    const hwType = hw?.homeworkVariantType ?? 'free_text'
    const typeData = typePerf[hwType]

    if (typeData && typeData.avgScore < 50 && typeData.count >= 3) {
      scaffolding.push(`Student historically scores below 50% on ${hwType} tasks — consider additional scaffolding or model examples`)
    }
  }

  // Determine alternative type based on profile
  let alternativeType: string | null = null
  if (profile && (profile.typePerformance as any)) {
    const typePerf = (profile.typePerformance as any) as Record<string, { avgScore: number; count: number }>
    const best = Object.entries(typePerf)
      .filter(([, d]) => d.count >= 2 && d.avgScore > 65)
      .sort((a, b) => b[1].avgScore - a[1].avgScore)[0]
    if (best && best[0] !== hw?.homeworkVariantType) {
      alternativeType = best[0]
    }
  }

  // ILP alignments
  const ilpAlignments = ilpTargets.map(t => t.target)

  return { adaptations, alternativeType, scaffolding, ilpAlignments }
}

// ─── ILP Evidence Dashboard ───────────────────────────────────────────────────

export async function getIlpEvidenceDashboard(schoolId: string) {
  const session = await auth()
  if (!session) redirect('/login')

  const now = new Date()

  const [activePlans, targets, links] = await Promise.all([
    prisma.individualLearningPlan.findMany({
      where: { schoolId, status: 'active' },
      include: { targets: true },
    }),
    prisma.ilpTarget.findMany({
      where: { ilp: { schoolId, status: 'active' } },
      include: { ilp: true },
    }),
    prisma.ilpHomeworkLink.findMany({
      where: { homework: { schoolId } },
      select: { ilpTargetId: true },
    }),
  ])

  const linkedTargetIds = new Set(links.map(l => l.ilpTargetId))
  const studentsWithIlp = new Set(activePlans.map(p => p.studentId)).size

  const targetsOnTrack = targets.filter(t => linkedTargetIds.has(t.id) || t.status === 'achieved').length
  const targetsBehind = targets.filter(t => !linkedTargetIds.has(t.id) && t.targetDate < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) && t.status === 'in_progress').length
  const targetsWithNoEvidence = targets.filter(t => !linkedTargetIds.has(t.id) && t.status === 'in_progress').length

  // Upcoming reviews
  const reviewsIn30Days = activePlans.filter(p => {
    const daysUntil = (p.reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysUntil >= 0 && daysUntil <= 30
  })

  const studentIds = [...new Set(reviewsIn30Days.map(p => p.studentId))]
  const students = await prisma.user.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true },
  })
  const studentMap = new Map(students.map(s => [s.id, s]))

  const upcomingReviews = reviewsIn30Days.map(p => {
    const s = studentMap.get(p.studentId)
    const planTargets = targets.filter(t => t.ilp.studentId === p.studentId)
    const evidenceGaps = planTargets
      .filter(t => !linkedTargetIds.has(t.id) && t.status === 'in_progress')
      .map(t => t.target.slice(0, 60))

    return {
      studentId: p.studentId,
      studentName: s ? `${s.firstName} ${s.lastName}` : 'Unknown',
      reviewDate: p.reviewDate,
      evidenceGaps,
    }
  })

  return {
    studentsWithIlp,
    targetsOnTrack,
    targetsBehind,
    targetsWithNoEvidence,
    upcomingReviews,
  }
}
