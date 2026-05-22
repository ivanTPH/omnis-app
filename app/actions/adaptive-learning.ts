'use server'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { computeAndSaveAdaptiveProfile } from '@/lib/adaptive-profile'

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
  typePerformance: Record<string, { avgScore: number; count: number; avgTimeMin: number; avgSelfAssessment?: number | null }>
  bloomsPerformance: Record<string, number>
  subjectPerformance: Record<string, { avg: number; trend: string }>
  preferredTypes: string[]
  strengthAreas: string[]
  developmentAreas: string[]
  avgCompletionRate: number
  sendConcernLevel: number | null   // rolling avg of last 10 sendRiskScores (0–100)
  lastHomeworkAt:   Date | null     // most recent submission timestamp
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
    sendConcernLevel: (profile as any).sendConcernLevel ?? null,
    lastHomeworkAt:   (profile as any).lastHomeworkAt   ?? null,
    profileSummary: profile.profileSummary,
    profileUpdatedAt: profile.profileUpdatedAt,
  }
}

export async function updateLearningProfile(studentId: string): Promise<StudentLearningProfileData | null> {
  const user = await requireStaff()
  return computeAndSaveAdaptiveProfile(studentId, user.schoolId) as Promise<StudentLearningProfileData | null>
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
  // Uses OR: title match OR learningObjectives array contains the topic
  let prior = await prisma.homework.findMany({
    where: {
      schoolId,
      classId,
      class: { subject },
      status: 'PUBLISHED',
      OR: [
        { title: { contains: topic, mode: 'insensitive' } },
        { learningObjectives: { has: topic } },
      ],
    },
    orderBy: { dueAt: 'desc' },
    take: 3,
    select: { id: true, dueAt: true },
  })

  // Spaced repetition intervals: 1 day → 3 days → 7 days → 14 days
  const spacing = [1, 3, 7, 14]

  // Fallback: if no topic-specific homework found, use last 3 for this class+subject
  const usedFallback = prior.length === 0 && topic.length > 0
  if (usedFallback) {
    prior = await prisma.homework.findMany({
      where: { schoolId, classId, class: { subject }, status: 'PUBLISHED' },
      orderBy: { dueAt: 'desc' },
      take: 3,
      select: { id: true, dueAt: true },
    })
  }

  const intervalDays = spacing[Math.min(prior.length, spacing.length - 1)]
  const lastDue = prior.length > 0 ? prior[0].dueAt : new Date()
  const suggestedDate = new Date(lastDue.getTime() + intervalDays * 24 * 60 * 60 * 1000)

  const rationale = usedFallback
    ? `No topic-specific homework found for "${topic}". Based on ${prior.length} recent homework${prior.length !== 1 ? 's' : ''} for this class, spacing of ${intervalDays} days suggested.`
    : prior.length === 0
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
        status: 'active',
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

// ─── Class Format Insights ────────────────────────────────────────────────────

export type ClassFormatInsight = {
  studentCount:         number   // SEND/ILP students with a clear format preference
  recommendedType:      string | null
  recommendedTypeLabel: string | null
  avgScoreOnRecommended: number | null
  sendStudentsAffected: string[] // first names only, for display
  rationale:            string
}

const FORMAT_LABELS: Record<string, string> = {
  retrieval_practice: 'Retrieval Practice',
  quiz:               'Quiz',
  multiple_choice:    'Multiple Choice',
  short_answer:       'Short Answer',
  essay:              'Essay',
  mind_map:           'Mind Map',
  reading_response:   'Reading Response',
  research_task:      'Research Task',
  creative:           'Creative Task',
  practical:          'Practical Task',
  free_text:          'Free Text',
}

export async function getClassFormatInsights(
  classId:      string,
  currentType:  string,
): Promise<ClassFormatInsight | null> {
  const user = await requireStaff()
  const schoolId = user.schoolId

  // Get enrolled students
  const enrolments = await prisma.enrolment.findMany({
    where:  { classId, class: { schoolId } },
    select: { userId: true },
  })
  const studentIds = enrolments.map(e => e.userId)
  if (studentIds.length === 0) return null

  // Filter to SEND students only
  const sendStatuses = await prisma.sendStatus.findMany({
    where:  { studentId: { in: studentIds }, NOT: { activeStatus: 'NONE' } },
    select: { studentId: true },
  })
  const sendIds = sendStatuses.map(s => s.studentId)
  if (sendIds.length === 0) return null

  // Load their learning profiles
  const profiles = await prisma.studentLearningProfile.findMany({
    where:  { studentId: { in: sendIds } },
    select: { studentId: true, preferredTypes: true, typePerformance: true },
  })

  // Fetch first names for affected students
  const users = await prisma.user.findMany({
    where:  { id: { in: sendIds } },
    select: { id: true, firstName: true },
  })
  const nameMap = new Map(users.map(u => [u.id, u.firstName]))

  // Find students where preferred type differs from currentType with >15% score gap
  const typeScores: Record<string, number[]> = {}
  const affectedStudents: string[] = []

  for (const profile of profiles) {
    const perf = (profile.typePerformance as Record<string, { avgScore: number; count: number }> | null) ?? {}
    const currentScore = perf[currentType]?.avgScore
    const preferred    = profile.preferredTypes[0]

    if (!preferred || preferred === currentType) continue
    const preferredScore = perf[preferred]?.avgScore
    if (preferredScore == null || currentScore == null) continue

    const gap = preferredScore - currentScore
    if (gap > 15 && (perf[preferred]?.count ?? 0) >= 2) {
      if (!typeScores[preferred]) typeScores[preferred] = []
      typeScores[preferred].push(preferredScore)
      const name = nameMap.get(profile.studentId)
      if (name) affectedStudents.push(name)
    }
  }

  if (affectedStudents.length === 0) return null

  // Find the most commonly recommended type
  const topType = Object.entries(typeScores)
    .sort((a, b) => b[1].length - a[1].length)[0]

  if (!topType) return null

  const [recommendedType, scores] = topType
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  const label    = FORMAT_LABELS[recommendedType] ?? recommendedType

  const currentLabel = FORMAT_LABELS[currentType] ?? currentType
  const names = affectedStudents.length <= 2
    ? affectedStudents.join(' and ')
    : `${affectedStudents[0]} and ${affectedStudents.length - 1} others`

  return {
    studentCount:          affectedStudents.length,
    recommendedType,
    recommendedTypeLabel:  label,
    avgScoreOnRecommended: avgScore,
    sendStudentsAffected:  affectedStudents,
    rationale: `${names} (SEND) score ~${avgScore}% on average with ${label} tasks — significantly higher than ${currentLabel}. Consider this format if the learning objective can be equally assessed either way.`,
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
      where: { ilp: { schoolId, studentId, status: 'active' }, status: 'active' },
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

// ─── ILP Evidence Students (rich per-student breakdown for SENCO view) ────────

export type IlpEvidenceTarget = {
  id: string
  target: string
  status: string
  targetDate: Date
  evidenceCount: number
  lastLinkedAt: Date | null
  progressNote: string | null
}

export type IlpEvidenceStudent = {
  studentId: string
  studentName: string
  yearGroup: number | null
  sendStatus: string
  needArea: string | null
  ilpId: string
  sendCategory: string
  reviewDate: Date
  daysUntilReview: number
  targets: IlpEvidenceTarget[]
  totalTargets: number
  targetsWithEvidence: number
  targetsOnTrack: number
  hasEvidenceGap: boolean
  reviewSoon: boolean
  workingAtGrade: number | null
  predictedGrade: number | null
  profileSummary: string | null
  reviewRecommendation: string
}

export type IlpEvidenceSummary = {
  studentsWithIlp: number
  targetsOnTrack: number
  targetsBehind: number
  targetsWithNoEvidence: number
  students: IlpEvidenceStudent[]
}

export async function getIlpEvidenceStudents(): Promise<IlpEvidenceSummary> {
  const user = await requireStaff()
  const schoolId = user.schoolId
  const now = new Date()

  const [activePlans, linkedTargets, sendStatuses, learningProfiles] = await Promise.all([
    prisma.individualLearningPlan.findMany({
      where:   { schoolId, status: 'active' },
      include: { targets: { orderBy: { targetDate: 'asc' } } },
      orderBy: { reviewDate: 'asc' },
    }),
    prisma.ilpHomeworkLink.findMany({
      where:  { homework: { schoolId } },
      select: { ilpTargetId: true, linkedAt: true, homework: { select: { title: true, dueAt: true } } },
    }),
    prisma.sendStatus.findMany({
      where:  { student: { schoolId } },
      select: { studentId: true, activeStatus: true, needArea: true },
    }),
    prisma.studentLearningProfile.findMany({
      where:  { schoolId },
      select: { studentId: true, workingAtGrade: true, predictedGrade: true, profileSummary: true },
    }),
  ])

  const studentIds = [...new Set(activePlans.map(p => p.studentId))]
  const users = await prisma.user.findMany({
    where:  { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, yearGroup: true },
  })
  const userMap    = new Map(users.map(u => [u.id, u]))
  const sendMap    = new Map(sendStatuses.map(s => [s.studentId, s]))
  const profileMap = new Map(learningProfiles.map(p => [p.studentId, p]))

  // Build evidence map: targetId → { count, lastLinkedAt }
  const evidenceMap = new Map<string, { count: number; lastLinkedAt: Date | null }>()
  for (const link of linkedTargets) {
    const existing = evidenceMap.get(link.ilpTargetId)
    const linkDate = link.linkedAt ?? (link.homework.dueAt as Date | null)
    if (!existing) {
      evidenceMap.set(link.ilpTargetId, { count: 1, lastLinkedAt: linkDate })
    } else {
      existing.count++
      if (linkDate && (!existing.lastLinkedAt || linkDate > existing.lastLinkedAt)) {
        existing.lastLinkedAt = linkDate
      }
    }
  }

  // Aggregate stats
  let totalTargetsOnTrack    = 0
  let totalTargetsBehind     = 0
  let totalTargetsNoEvidence = 0

  const students: IlpEvidenceStudent[] = activePlans.map(plan => {
    const u       = userMap.get(plan.studentId)
    const ss      = sendMap.get(plan.studentId)
    const profile = profileMap.get(plan.studentId)
    const daysUntilReview = Math.ceil((plan.reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const targets: IlpEvidenceTarget[] = plan.targets.map(t => {
      const ev = evidenceMap.get(t.id)
      return {
        id:            t.id,
        target:        t.target,
        status:        t.status,
        targetDate:    t.targetDate,
        evidenceCount: ev?.count ?? 0,
        lastLinkedAt:  ev?.lastLinkedAt ?? null,
        progressNote:  t.progressNotes,
      }
    })

    const totalTargets      = targets.length
    const targetsWithEvid   = targets.filter(t => t.evidenceCount > 0 || t.status === 'achieved').length
    const targetsOnTrack    = targets.filter(t => t.evidenceCount > 0 || t.status === 'achieved').length
    const hasEvidenceGap    = targets.some(t => t.evidenceCount === 0 && t.status === 'active')
    const targetsBehind     = targets.filter(t => t.evidenceCount === 0 && t.targetDate < in14Days && t.status === 'active').length

    totalTargetsOnTrack    += targetsOnTrack
    totalTargetsBehind     += targetsBehind
    totalTargetsNoEvidence += targets.filter(t => t.evidenceCount === 0 && t.status === 'active').length

    // Generate a review recommendation
    const gradeGap = (profile?.predictedGrade ?? 0) - (profile?.workingAtGrade ?? 0)
    let reviewRecommendation = ''
    if (daysUntilReview <= 7) {
      reviewRecommendation = 'Review overdue — schedule immediately'
    } else if (daysUntilReview <= 14) {
      reviewRecommendation = 'Review due within 2 weeks — prepare evidence pack'
    } else if (targetsBehind > 0) {
      reviewRecommendation = `${targetsBehind} target${targetsBehind > 1 ? 's' : ''} behind — consider early review or additional support`
    } else if (gradeGap >= 2 && profile?.workingAtGrade) {
      reviewRecommendation = `Grade gap: working at ${profile.workingAtGrade}, predicted ${profile.predictedGrade} — focus strategies on closing gap`
    } else if (hasEvidenceGap) {
      reviewRecommendation = 'Evidence gaps present — ask subject teachers to link homework'
    } else {
      reviewRecommendation = 'On track — continue current support'
    }

    return {
      studentId:           plan.studentId,
      studentName:         u ? `${u.firstName} ${u.lastName}` : 'Unknown',
      yearGroup:           u?.yearGroup ?? null,
      sendStatus:          ss?.activeStatus ?? 'SEN_SUPPORT',
      needArea:            ss?.needArea ?? null,
      ilpId:               plan.id,
      sendCategory:        plan.sendCategory,
      reviewDate:          plan.reviewDate,
      daysUntilReview,
      targets,
      totalTargets,
      targetsWithEvidence: targetsWithEvid,
      targetsOnTrack,
      hasEvidenceGap,
      reviewSoon:          daysUntilReview <= 30 && daysUntilReview >= 0,
      workingAtGrade:      profile?.workingAtGrade ?? null,
      predictedGrade:      profile?.predictedGrade ?? null,
      profileSummary:      profile?.profileSummary ?? null,
      reviewRecommendation,
    }
  })

  return {
    studentsWithIlp:      students.length,
    targetsOnTrack:       totalTargetsOnTrack,
    targetsBehind:        totalTargetsBehind,
    targetsWithNoEvidence: totalTargetsNoEvidence,
    students,
  }
}

// ─── Differentiated Versions ──────────────────────────────────────────────────

export async function generateDifferentiatedVersions(
  homeworkId: string,
  studentIds: string[],
): Promise<{
  studentId: string
  studentName: string
  adaptedContent: object
  adaptationNotes: string
  adaptationType: 'send' | 'profile' | 'standard'
}[]> {
  const user = await requireStaff()
  const schoolId = user.schoolId

  if (studentIds.length > 20) throw new Error('Maximum 20 students per differentiation batch')

  const hw = await prisma.homework.findFirst({
    where: { id: homeworkId, schoolId },
    select: { structuredContent: true, homeworkVariantType: true, learningObjectives: true, bloomsLevel: true, title: true },
  })
  if (!hw) throw new Error('Homework not found')
  const hwData = hw

  const students = await prisma.user.findMany({
    where: { id: { in: studentIds }, schoolId, role: 'STUDENT' },
    select: { id: true, firstName: true, lastName: true },
  })
  const studentMap = new Map(students.map(s => [s.id, s]))

  async function processStudent(studentId: string): Promise<{
    studentId: string
    studentName: string
    adaptedContent: object
    adaptationNotes: string
    adaptationType: 'send' | 'profile' | 'standard'
  }> {
    const student = studentMap.get(studentId)
    const studentName = student ? `${student.firstName} ${student.lastName}` : 'Unknown'

    const [profile, sendStatus, ilpTargets] = await Promise.all([
      prisma.studentLearningProfile.findUnique({ where: { studentId } }),
      prisma.sendStatus.findUnique({ where: { studentId } }),
      prisma.ilpTarget.findMany({
        where: {
          ilp: { schoolId, studentId, status: 'active' },
          status: 'active',
          targetDate: { lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
        },
        select: { target: true, strategy: true },
        take: 5,
      }),
    ])

    const hasSend = sendStatus?.activeStatus === 'EHCP' || sendStatus?.activeStatus === 'SEN_SUPPORT'
    const hasProfile = profile && profile.preferredTypes.length > 0
    const adaptationType: 'send' | 'profile' | 'standard' =
      hasSend ? 'send' : hasProfile ? 'profile' : 'standard'

    if (adaptationType === 'standard') {
      return {
        studentId,
        studentName,
        adaptedContent: hwData.structuredContent as object ?? {},
        adaptationNotes: 'Standard version — no adaptations required.',
        adaptationType,
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return {
        studentId,
        studentName,
        adaptedContent: hwData.structuredContent as object ?? {},
        adaptationNotes: `${adaptationType === 'send' ? 'SEND' : 'Profile'} adaptation required but AI unavailable.`,
        adaptationType,
      }
    }

    const sendContext = hasSend
      ? `SEND status: ${sendStatus?.activeStatus}${sendStatus?.needArea ? `, need area: ${sendStatus.needArea}` : ''}`
      : ''
    const profileContext = hasProfile
      ? `Preferred homework types: ${profile!.preferredTypes.slice(0, 3).join(', ')}. Strength areas: ${profile!.strengthAreas.join(', ')}. Development areas: ${profile!.developmentAreas.join(', ')}.`
      : ''
    const ilpContext = ilpTargets.length > 0
      ? `Active ILP targets to incorporate:\n${ilpTargets.map((t, i) => `${i + 1}. ${t.target} (strategy: ${t.strategy})`).join('\n')}`
      : ''

    try {
      const client = new Anthropic({ apiKey })
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: 'You are a UK SENCO and differentiation expert. Adapt homework for specific student needs. Keep the same learning objectives. Return ONLY valid JSON matching the original structuredContent schema exactly.',
        messages: [{
          role: 'user',
          content: `Adapt this ${hwData.homeworkVariantType} homework for a student with the following profile.

Homework: "${hwData.title}"
Bloom's level: ${hwData.bloomsLevel ?? 'understand'}
Learning objectives: ${hwData.learningObjectives.join('; ')}
Original content: ${JSON.stringify(hwData.structuredContent)}

Student profile:
${sendContext}
${profileContext}
${ilpContext}

Return a JSON object with:
{
  "adaptedContent": { /* same schema as original content but adapted */ },
  "adaptationNotes": "Brief teacher-facing explanation of what was adapted and why (2-3 sentences)"
}`,
        }],
      })
      const raw = (msg.content[0] as any).text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
      const parsed = JSON.parse(raw)
      return {
        studentId,
        studentName,
        adaptedContent: parsed.adaptedContent ?? (hwData.structuredContent as object ?? {}),
        adaptationNotes: parsed.adaptationNotes ?? `Adapted for ${adaptationType} needs.`,
        adaptationType,
      }
    } catch {
      return {
        studentId,
        studentName,
        adaptedContent: hwData.structuredContent as object ?? {},
        adaptationNotes: `${adaptationType === 'send' ? 'SEND' : 'Profile'} adaptation requested — AI unavailable, original content returned.`,
        adaptationType,
      }
    }
  }

  // Process in batches of 5 to limit concurrent API calls
  const results: Awaited<ReturnType<typeof processStudent>>[] = []
  for (let i = 0; i < studentIds.length; i += 5) {
    const chunk = studentIds.slice(i, i + 5)
    const chunkResults = await Promise.all(chunk.map(processStudent))
    results.push(...chunkResults)
  }

  return results
}

// ─── Learning Format Notes ────────────────────────────────────────────────────

export async function saveLearningFormatNotes(studentId: string, notes: string): Promise<void> {
  const user = await requireStaff()
  const { schoolId } = user

  await prisma.studentLearningProfile.upsert({
    where:  { studentId },
    update: { learningFormatNotes: notes },
    create: { studentId, schoolId, learningFormatNotes: notes },
  })
}

// ─── AI Narrative ─────────────────────────────────────────────────────────────

export async function generateAdaptiveNarrative(
  studentId: string,
  classId:   string,
): Promise<string> {
  const user = await requireStaff()
  const { schoolId } = user

  // Gather student context
  const [student, profile, sendStatus, ilp] = await Promise.all([
    prisma.user.findFirst({
      where:  { id: studentId, schoolId, role: 'STUDENT' },
      select: { firstName: true, lastName: true, yearGroup: true },
    }),
    prisma.studentLearningProfile.findUnique({
      where:  { studentId },
      select: { typePerformance: true, learningFormatNotes: true, preferredTypes: true, strengthAreas: true, developmentAreas: true },
    }),
    prisma.sendStatus.findFirst({
      where:  { studentId },
      select: { activeStatus: true, needArea: true },
    }),
    prisma.individualLearningPlan.findFirst({
      where:   { studentId, schoolId, status: 'active' },
      include: {
        targets: {
          where:  { status: 'active' },
          select: { target: true, strategy: true },
          take:   3,
        },
      },
    }),
  ])

  if (!student) throw new Error('Student not found')

  // Build context strings
  const sendContext = sendStatus?.activeStatus && sendStatus.activeStatus !== 'NONE'
    ? `SEND status: ${sendStatus.activeStatus}${sendStatus.needArea ? ` — ${sendStatus.needArea}` : ''}`
    : 'No SEND status'

  const ilpContext = ilp
    ? `Active ILP with ${ilp.targets.length} target(s):\n${ilp.targets.map(t => `- ${t.target}${t.strategy ? ` (strategy: ${t.strategy})` : ''}`).join('\n')}`
    : 'No active ILP'

  const profileContext = profile
    ? [
        profile.learningFormatNotes ? `Learning format notes: ${profile.learningFormatNotes}` : null,
        profile.preferredTypes.length ? `Preferred homework types: ${profile.preferredTypes.join(', ')}` : null,
        profile.strengthAreas.length ? `Strengths: ${profile.strengthAreas.join(', ')}` : null,
        profile.developmentAreas.length ? `Development areas: ${profile.developmentAreas.join(', ')}` : null,
      ].filter(Boolean).join('\n')
    : 'No learning profile data yet'

  // Fetch recent grade trend for this class
  const recentSubs = await prisma.submission.findMany({
    where:   { studentId, schoolId, homework: { classId }, status: 'RETURNED' },
    orderBy: { submittedAt: 'desc' },
    take:    6,
    select:  { finalScore: true, homework: { select: { title: true, gradingBands: true } } },
  })

  const gradeContext = recentSubs.length
    ? `Recent grades (newest first): ${recentSubs.map(s => s.finalScore != null ? `${s.finalScore}%` : 'unscored').join(', ')}`
    : 'No recent submissions in this class'

  const prompt = `You are an adaptive learning assistant for a UK secondary school teacher.

Provide a concise 2–3 sentence narrative about ${student.firstName} ${student.lastName} (Year ${student.yearGroup ?? '?'}) that:
1. Summarises their recent performance trend and any patterns
2. Highlights key SEND or ILP considerations the teacher should keep in mind
3. Suggests one specific teaching action for this student

Student data:
${sendContext}
${ilpContext}
${profileContext}
${gradeContext}

Write in plain English, teacher-to-teacher tone. Be specific and actionable, not generic. Do not use bullet points — write as connected sentences.`

  try {
    const client = new Anthropic()
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages:   [{ role: 'user', content: prompt }],
    })
    return (msg.content[0] as { text: string }).text.trim()
  } catch {
    return `${student.firstName} is currently ${recentSubs.length ? 'being tracked' : 'awaiting submissions'} in this class. ${sendContext !== 'No SEND status' ? `Note their ${sendContext}. ` : ''}${ilp ? `Active ILP with ${ilp.targets.length} target(s) — review strategies before setting homework.` : 'No active ILP — consider raising a concern if performance is below expected.'}`
  }
}
