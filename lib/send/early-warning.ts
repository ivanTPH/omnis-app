import { prisma } from '@/lib/prisma'

export type NewFlag = {
  studentId: string
  flagType: string
  severity: string
  description: string
  dataPoints: object
}

// ─── Analyse all students in a school ────────────────────────────────────────

export async function analyseStudentPatterns(schoolId: string): Promise<number> {
  const now = new Date()
  const fourWeeksAgo = new Date(now)
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  const eightWeeksAgo = new Date(now)
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

  // Get all students in school
  const students = await prisma.user.findMany({
    where: { schoolId, role: 'STUDENT', isActive: true },
    select: { id: true, firstName: true, lastName: true },
  })

  let newFlagCount = 0

  for (const student of students) {
    const flags = await analyseStudent(student.id, schoolId, fourWeeksAgo, eightWeeksAgo, now)
    for (const flag of flags) {
      await upsertFlag(flag, schoolId, now)
      newFlagCount++
    }
  }

  return newFlagCount
}

// ─── Analyse a single student ─────────────────────────────────────────────────

async function analyseStudent(
  studentId: string,
  schoolId: string,
  fourWeeksAgo: Date,
  eightWeeksAgo: Date,
  now: Date,
): Promise<NewFlag[]> {
  const flags: NewFlag[] = []

  // Get recent submissions
  const recentSubmissions = await prisma.submission.findMany({
    where: {
      studentId,
      homework: { schoolId },
      submittedAt: { gte: eightWeeksAgo },
    },
    orderBy: { submittedAt: 'desc' },
    take: 20,
    include: { homework: { select: { dueAt: true } } },
  })

  const recent4w = recentSubmissions.filter(s => s.submittedAt >= fourWeeksAgo)
  const prior4w  = recentSubmissions.filter(s => s.submittedAt < fourWeeksAgo)

  // ─── A) Homework completion drop ─────────────────────────────────────────
  if (recentSubmissions.length >= 4) {
    const recentRate = recent4w.length > 0
      ? recent4w.filter(s => s.status !== 'SUBMITTED' || s.finalScore !== null).length / Math.max(recent4w.length, 1)
      : 0
    const priorRate = prior4w.length > 0
      ? prior4w.filter(s => s.status !== 'SUBMITTED' || s.finalScore !== null).length / Math.max(prior4w.length, 1)
      : 1

    const drop = priorRate - recentRate
    if (priorRate > 0.8 && recentRate < 0.5 && drop > 0.3) {
      const severity = drop > 0.5 ? 'high' : 'medium'
      flags.push({
        studentId,
        flagType: 'completion_drop',
        severity,
        description: `Homework completion dropped from ${Math.round(priorRate * 100)}% to ${Math.round(recentRate * 100)}% over the last 4 weeks.`,
        dataPoints: { priorRate, recentRate, drop, submissions: recentSubmissions.length },
      })
    }
  }

  // ─── B) Score decline ─────────────────────────────────────────────────────
  const gradedRecent = recent4w.filter(s => s.finalScore !== null && s.finalScore !== undefined)
  const gradedPrior  = prior4w.filter(s => s.finalScore !== null && s.finalScore !== undefined)

  if (gradedRecent.length >= 2 && gradedPrior.length >= 2) {
    const avgRecent = gradedRecent.reduce((a, s) => a + (s.finalScore ?? 0), 0) / gradedRecent.length
    const avgPrior  = gradedPrior.reduce((a, s) => a + (s.finalScore ?? 0), 0) / gradedPrior.length
    const decline   = avgPrior - avgRecent

    if (avgPrior > 0 && (decline / avgPrior) > 0.2) {
      flags.push({
        studentId,
        flagType: 'score_decline',
        severity: decline / avgPrior > 0.35 ? 'high' : 'medium',
        description: `Average score declined from ${Math.round(avgPrior)}% to ${Math.round(avgRecent)}% over the last 4 weeks.`,
        dataPoints: { avgRecent, avgPrior, declinePercent: Math.round((decline / avgPrior) * 100) },
      })
    }
  }

  // ─── C) Multiple open concerns ────────────────────────────────────────────
  const openConcerns = await prisma.sendConcern.count({
    where: { schoolId, studentId, status: { in: ['open', 'under_review'] } },
  })

  if (openConcerns >= 3) {
    flags.push({
      studentId,
      flagType: 'multiple_concerns',
      severity: 'high',
      description: `Student has ${openConcerns} open SEND concerns awaiting review.`,
      dataPoints: { openConcerns },
    })
  }

  // ─── D) Consecutive missed homeworks ─────────────────────────────────────
  const lastEight = recentSubmissions.slice(0, 8)
  let consecutive = 0
  let maxConsecutive = 0
  for (const s of lastEight) {
    if (!s.finalScore && s.status === 'SUBMITTED') {
      consecutive++
      maxConsecutive = Math.max(maxConsecutive, consecutive)
    } else {
      consecutive = 0
    }
  }

  if (maxConsecutive >= 3) {
    flags.push({
      studentId,
      flagType: 'pattern_absence',
      severity: maxConsecutive >= 5 ? 'high' : 'medium',
      description: `Student has missed ${maxConsecutive} consecutive homework submissions.`,
      dataPoints: { consecutiveMissed: maxConsecutive },
    })
  }

  return flags
}

// ─── Upsert flag + notify ─────────────────────────────────────────────────────

async function upsertFlag(flag: NewFlag, schoolId: string, now: Date): Promise<void> {
  // Check if an active flag of this type already exists for this student
  const existing = await prisma.earlyWarningFlag.findFirst({
    where: {
      schoolId,
      studentId: flag.studentId,
      flagType: flag.flagType,
      isActioned: false,
      expiresAt: { gte: now },
    },
  })

  if (existing) return // Don't duplicate

  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + 30)

  await prisma.earlyWarningFlag.create({
    data: {
      schoolId,
      studentId: flag.studentId,
      flagType: flag.flagType,
      severity: flag.severity,
      description: flag.description,
      dataPoints: flag.dataPoints,
      expiresAt,
    },
  })

  // Notify all SENCOs in the school
  const sencos = await prisma.user.findMany({
    where: { schoolId, role: 'SENCO', isActive: true },
    select: { id: true },
  })

  const student = await prisma.user.findUnique({
    where: { id: flag.studentId },
    select: { firstName: true, lastName: true },
  })

  if (student && sencos.length > 0) {
    await prisma.sendNotification.createMany({
      data: sencos.map(s => ({
        schoolId,
        recipientId: s.id,
        type: 'pattern_detected',
        title: `Early warning: ${flag.flagType.replace(/_/g, ' ')}`,
        body: `${student.firstName} ${student.lastName}: ${flag.description}`,
      })),
    })
  }

  await prisma.sendReviewLog.create({
    data: {
      schoolId,
      studentId: flag.studentId,
      action: 'concern_raised',
      actorId: sencos[0]?.id ?? flag.studentId, // system actor fallback
      metadata: { flagType: flag.flagType, severity: flag.severity, automated: true },
    },
  })
}
