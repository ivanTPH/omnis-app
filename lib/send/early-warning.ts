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
    include: {
      homework: {
        select: {
          dueAt:               true,
          homeworkVariantType: true,
          class:               { select: { subject: true } },
        },
      },
    },
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

  // ─── C2) Score inconsistency — high variance suggests attention difficulties ──
  const scoredAll = recentSubmissions.filter(s => s.finalScore !== null).slice(0, 8)
  if (scoredAll.length >= 5) {
    const scores = scoredAll.map(s => s.finalScore as number)
    const mean   = scores.reduce((a, b) => a + b, 0) / scores.length
    const stddev = Math.sqrt(scores.reduce((a, s) => a + (s - mean) ** 2, 0) / scores.length)
    // >25 stddev ≈ >2.25 GCSE grade units of variance
    if (stddev > 25) {
      flags.push({
        studentId,
        flagType:    'inconsistency_pattern',
        severity:    stddev > 38 ? 'high' : 'medium',
        description: `Inconsistent performance across last ${scores.length} scored submissions — scores range from ${Math.round(Math.min(...scores))} to ${Math.round(Math.max(...scores))} (stddev ${Math.round(stddev)}). Variable engagement may indicate attention or anxiety-related difficulties.`,
        dataPoints:  { stddev: Math.round(stddev), minScore: Math.min(...scores), maxScore: Math.max(...scores), count: scores.length },
      })
    }
  }

  // ─── C3) Subject-isolated drop — decline in one subject only ──────────────
  const subjectMap: Record<string, { recent: number[]; prior: number[] }> = {}
  for (const s of recentSubmissions) {
    if (s.finalScore == null) continue
    const subj = (s.homework as any).class?.subject ?? 'Unknown'
    if (!subjectMap[subj]) subjectMap[subj] = { recent: [], prior: [] }
    const bucket = s.submittedAt >= fourWeeksAgo ? 'recent' : 'prior'
    subjectMap[subj][bucket].push(s.finalScore)
  }
  const subjectEntries = Object.entries(subjectMap).filter(([, d]) => d.recent.length >= 2 && d.prior.length >= 2)
  if (subjectEntries.length >= 2) {
    const avgs = subjectEntries.map(([subj, d]) => ({
      subj,
      recentAvg: d.recent.reduce((a, b) => a + b, 0) / d.recent.length,
      priorAvg:  d.prior.reduce((a, b) => a + b, 0) / d.prior.length,
    }))
    const dropping = avgs.filter(a => a.priorAvg > 0 && (a.priorAvg - a.recentAvg) / a.priorAvg > 0.25)
    const stable   = avgs.filter(a => a.priorAvg > 0 && (a.priorAvg - a.recentAvg) / a.priorAvg <= 0.1)
    if (dropping.length === 1 && stable.length >= 1) {
      const d = dropping[0]
      flags.push({
        studentId,
        flagType:    'subject_isolated_drop',
        severity:    'medium',
        description: `Score in ${d.subj} has dropped from ${Math.round(d.priorAvg)} to ${Math.round(d.recentAvg)} over 4 weeks while performance in other subjects remains stable. May indicate a subject-specific difficulty rather than a general concern.`,
        dataPoints:  { subject: d.subj, priorAvg: Math.round(d.priorAvg), recentAvg: Math.round(d.recentAvg), stableSubjects: stable.map(s => s.subj) },
      })
    }
  }

  // ─── C4) Format struggle — consistently low on one homework type ───────────
  const formatMap: Record<string, number[]> = {}
  for (const s of recentSubmissions) {
    if (s.finalScore == null) continue
    const fmt = (s.homework as any).homeworkVariantType ?? 'free_text'
    if (!formatMap[fmt]) formatMap[fmt] = []
    formatMap[fmt].push(s.finalScore)
  }
  const overallScored = recentSubmissions.filter(s => s.finalScore != null).map(s => s.finalScore as number)
  const overallAvg    = overallScored.length ? overallScored.reduce((a, b) => a + b, 0) / overallScored.length : 0
  for (const [fmt, scores] of Object.entries(formatMap)) {
    if (scores.length < 4) continue
    const fmtAvg = scores.reduce((a, b) => a + b, 0) / scores.length
    if (fmtAvg < 40 && overallAvg > 55) {
      flags.push({
        studentId,
        flagType:    'format_struggle',
        severity:    'medium',
        description: `Student averages ${Math.round(fmtAvg)}% on ${fmt.replace(/_/g, ' ')} tasks (${scores.length} attempts) but ${Math.round(overallAvg)}% overall. Consider offering this homework type in an alternative format better suited to their learning needs.`,
        dataPoints:  { format: fmt, formatAvg: Math.round(fmtAvg), overallAvg: Math.round(overallAvg), attempts: scores.length },
      })
    }
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

  // Keep StudentLearningProfile.sendConcernLevel in sync with the flag severity
  try {
    const newConcernLevel = flag.severity === 'high' ? 85 : 65
    await prisma.studentLearningProfile.upsert({
      where:  { studentId: flag.studentId },
      create: { studentId: flag.studentId, schoolId, sendConcernLevel: newConcernLevel },
      update: { sendConcernLevel: newConcernLevel },
    })
  } catch {
    // Best-effort — don't abort flag creation if profile update fails
  }

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
