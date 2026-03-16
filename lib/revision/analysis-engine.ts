import type { PrismaClient } from '@prisma/client'

export interface ClassPerformanceAnalysis {
  classId: string
  subject: string
  periodStart: Date
  periodEnd: Date
  topicsCovered: {
    topic: string
    lessonDate: Date
    homeworkCount: number
  }[]
  topicPerformance: {
    topic: string
    classAvgScore: number
    submissionRate: number
    needsRevision: boolean
  }[]
  studentAnalysis: {
    studentId: string
    studentName: string
    sendStatus: string | null
    preferredTaskType: string
    weakTopics: string[]
    strongTopics: string[]
    avgScore: number
    completionRate: number
    ilpTargetsDue: string[]
    recommendedTaskType: string
    sendAdaptations: string[]
  }[]
  classAvgScore: number
  overallSubmissionRate: number
  topicsNeedingRevision: string[]
  topicsToSkip: string[]
}

const EMPTY_ANALYSIS = (classId: string): ClassPerformanceAnalysis => ({
  classId,
  subject: '',
  periodStart: new Date(),
  periodEnd: new Date(),
  topicsCovered: [],
  topicPerformance: [],
  studentAnalysis: [],
  classAvgScore: 0,
  overallSubmissionRate: 0,
  topicsNeedingRevision: [],
  topicsToSkip: [],
})

export async function analyseClassPerformance(
  classId: string,
  schoolId: string,
  periodStart: Date,
  periodEnd: Date,
  prisma: PrismaClient,
): Promise<ClassPerformanceAnalysis> {
  try {
    // 1. Fetch lessons in period
    const lessons = await prisma.lesson.findMany({
      where: { classId, schoolId, scheduledAt: { gte: periodStart, lte: periodEnd } },
      select: { id: true, title: true, topic: true, scheduledAt: true },
      orderBy: { scheduledAt: 'asc' },
    })

    // 2. Fetch class info and enrolled students
    const schoolClass = await (prisma as any).schoolClass.findFirst({
      where: { id: classId, schoolId },
      select: { subject: true, enrolments: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
    })
    if (!schoolClass) return EMPTY_ANALYSIS(classId)

    const subject = schoolClass.subject
    const enrolledStudents = schoolClass.enrolments.map((e: any) => e.user)
    const studentIds = enrolledStudents.map((s: any) => s.id)

    if (studentIds.length === 0) return { ...EMPTY_ANALYSIS(classId), subject }

    // 3. Fetch homework and submissions in period
    const homeworks = await prisma.homework.findMany({
      where: { classId, schoolId, dueAt: { gte: periodStart, lte: periodEnd } },
      include: {
        submissions: {
          include: { student: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    })

    // 4. Fetch learning profiles
    const profiles = await (prisma as any).studentLearningProfile.findMany({
      where: { studentId: { in: studentIds }, schoolId },
    })
    const profileByStudent = Object.fromEntries(profiles.map((p: any) => [p.studentId, p]))

    // 5. Fetch SEND status (SendStatus has no schoolId — scoped by enrolled studentIds)
    const sendStatuses = await prisma.sendStatus.findMany({
      where: { studentId: { in: studentIds } },
    })
    const sendByStudent = Object.fromEntries(sendStatuses.map((s: any) => [s.studentId, s]))

    // 6. Fetch ILP targets due within 28 days
    const ilpTargets = await (prisma as any).ilpTarget.findMany({
      where: {
        ilp: { schoolId, studentId: { in: studentIds }, status: 'active' },
        status: 'active',
        targetDate: { lte: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, target: true, ilp: { select: { studentId: true } } },
    })
    const ilpByStudent: Record<string, string[]> = {}
    for (const t of ilpTargets) {
      const sid = t.ilp.studentId
      if (!ilpByStudent[sid]) ilpByStudent[sid] = []
      ilpByStudent[sid].push(t.target)
    }

    // 7. Build topic → homework mapping
    const topicsByLesson = Object.fromEntries(lessons.map(l => [l.id, l.topic ?? l.title]))

    // Map each homework to a topic via lessonId if available
    const hwByTopic: Record<string, typeof homeworks> = {}
    for (const hw of homeworks) {
      const topic = (hw as any).lessonId ? (topicsByLesson[(hw as any).lessonId] ?? hw.title) : hw.title
      if (!hwByTopic[topic]) hwByTopic[topic] = []
      hwByTopic[topic].push(hw)
    }

    // Topics covered = lessons in period
    const topicsCovered = lessons.map(l => ({
      topic: l.topic ?? l.title,
      lessonDate: l.scheduledAt,
      homeworkCount: hwByTopic[l.topic ?? l.title]?.length ?? 0,
    }))

    // Deduplicate topics
    const allTopics = [...new Set(topicsCovered.map(t => t.topic))]

    // 8. Calculate per-topic class performance
    const topicPerformance = allTopics.map(topic => {
      const hws = hwByTopic[topic] ?? []
      if (hws.length === 0) return { topic, classAvgScore: 0, submissionRate: 0, needsRevision: true }

      const allSubs = hws.flatMap(hw => hw.submissions)
      const scoredSubs = allSubs.filter(s => s.finalScore != null)
      const classAvgScore = scoredSubs.length > 0
        ? scoredSubs.reduce((sum, s) => sum + (s.finalScore ?? 0), 0) / scoredSubs.length
        : 0
      const submissionRate = studentIds.length > 0 ? allSubs.length / (hws.length * studentIds.length) : 0

      return {
        topic,
        classAvgScore: Math.round(classAvgScore * 10) / 10,
        submissionRate: Math.round(submissionRate * 100) / 100,
        needsRevision: classAvgScore < 6,
      }
    })

    // 9. Per-student analysis
    const studentAnalysis = enrolledStudents.map((student: any) => {
      const profile = profileByStudent[student.id] as any
      const send = sendByStudent[student.id] as any
      const ilpTargetsDue = ilpByStudent[student.id] ?? []

      const preferredTypes: string[] = profile?.preferredTypes ?? []
      const preferredTaskType = preferredTypes[0] ?? 'retrieval_practice'

      // Calculate per-topic scores for this student
      const weakTopics: string[] = []
      const strongTopics: string[] = []
      let totalScore = 0
      let scoredCount = 0
      let submittedCount = 0
      let totalHw = 0

      for (const hw of homeworks) {
        totalHw++
        const sub = hw.submissions.find(s => s.student.id === student.id)
        if (sub) {
          submittedCount++
          if (sub.finalScore != null) {
            totalScore += sub.finalScore
            scoredCount++
          }
        }
      }

      // Topic-level weakness check
      for (const topic of allTopics) {
        const hws = hwByTopic[topic] ?? []
        const studentSubs = hws.flatMap(hw => hw.submissions).filter(s => s.student.id === student.id && s.finalScore != null)
        if (studentSubs.length === 0) continue
        const topicAvg = studentSubs.reduce((sum, s) => sum + (s.finalScore ?? 0), 0) / studentSubs.length
        // Assuming max score of 9 (GCSE scale)
        const topicPct = (topicAvg / 9) * 100
        if (topicPct < 60) weakTopics.push(topic)
        else if (topicPct > 75) strongTopics.push(topic)
      }

      const avgScore = scoredCount > 0 ? Math.round((totalScore / scoredCount) * 10) / 10 : 0
      const completionRate = totalHw > 0 ? Math.round((submittedCount / totalHw) * 100) / 100 : 0

      // SEND adaptations
      const sendAdaptations: string[] = []
      if (send && send.activeStatus !== 'NONE' && send.needArea) {
        sendAdaptations.push(send.needArea)
      }

      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        sendStatus: send?.activeStatus ?? null,
        preferredTaskType,
        weakTopics,
        strongTopics,
        avgScore,
        completionRate,
        ilpTargetsDue,
        recommendedTaskType: preferredTaskType,
        sendAdaptations,
      }
    })

    // 10. Summary stats
    const scoredSubs = homeworks.flatMap(hw => hw.submissions).filter(s => s.finalScore != null)
    const classAvgScore = scoredSubs.length > 0
      ? Math.round((scoredSubs.reduce((sum, s) => sum + (s.finalScore ?? 0), 0) / scoredSubs.length) * 10) / 10
      : 0
    const totalPossibleSubs = homeworks.length * studentIds.length
    const overallSubmissionRate = totalPossibleSubs > 0
      ? Math.round((homeworks.flatMap(hw => hw.submissions).length / totalPossibleSubs) * 100) / 100
      : 0

    const topicsNeedingRevision = topicPerformance.filter(t => t.needsRevision).map(t => t.topic)
    const topicsToSkip = topicPerformance.filter(t => !t.needsRevision && t.classAvgScore > 7).map(t => t.topic)

    return {
      classId,
      subject,
      periodStart,
      periodEnd,
      topicsCovered,
      topicPerformance,
      studentAnalysis,
      classAvgScore,
      overallSubmissionRate,
      topicsNeedingRevision,
      topicsToSkip,
    }
  } catch (err) {
    console.error('[analyseClassPerformance] error:', err)
    return EMPTY_ANALYSIS(classId)
  }
}
