'use server'

import { requireAuth } from '@/lib/session'
import { prisma }      from '@/lib/prisma'
import { redirect }    from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

export type WelfareAlert = {
  studentId:   string
  studentName: string
  yearGroup:   number | null
  alerts:      string[]
  riskLevel:   'urgent' | 'monitor'
  sendStatus:  string | null  // 'SEN_SUPPORT' | 'EHCP' | null
}

export type WelfareConcern = {
  id:          string
  studentId:   string
  studentName: string
  category:    string
  status:      string
  daysOpen:    number
  raiserName:  string
  description: string
}

export type WelfareFlag = {
  id:          string
  studentId:   string
  studentName: string
  flagType:    string
  severity:    string
  description: string
  daysActive:  number
}

export type WelfareIlpReview = {
  ilpId:        string
  studentId:    string
  studentName:  string
  reviewDate:   string  // ISO
  daysUntil:    number
  sendCategory: string
}

export type HoyWelfareData = {
  yearGroup:                number | null
  totalStudents:            number
  studentsNeedingAttention: number
  openConcernsCount:        number
  highFlagsCount:           number
  missedHwStudentsCount:    number
  ilpReviewsDue14d:         number
  alerts:                   WelfareAlert[]
  concerns:                 WelfareConcern[]
  flags:                    WelfareFlag[]
  ilpReviews:               WelfareIlpReview[]
}

// ── Main action ───────────────────────────────────────────────────────────────

export async function getHoyWelfareData(): Promise<HoyWelfareData> {
  const { schoolId, role, id: userId } = await requireAuth()
  if (!['HEAD_OF_YEAR', 'SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const now      = new Date()
  const in14days = new Date(now.getTime() + 14 * 86_400_000)
  const since30  = new Date(now.getTime() - 30 * 86_400_000)

  // HOY's own year group (from user record); admins see all
  const userRecord = await prisma.user.findUnique({
    where:  { id: userId },
    select: { yearGroup: true },
  })
  const yearGroup = role === 'HEAD_OF_YEAR' ? (userRecord?.yearGroup ?? null) : null

  // Students in this year group (or all)
  const students = await prisma.user.findMany({
    where:  { schoolId, role: 'STUDENT', ...(yearGroup ? { yearGroup } : {}) },
    select: { id: true, firstName: true, lastName: true, yearGroup: true },
  })
  const studentIds = students.map(s => s.id)
  const studentMap = new Map(students.map(s => [s.id, s]))

  const empty: HoyWelfareData = {
    yearGroup, totalStudents: students.length,
    studentsNeedingAttention: 0, openConcernsCount: 0,
    highFlagsCount: 0, missedHwStudentsCount: 0, ilpReviewsDue14d: 0,
    alerts: [], concerns: [], flags: [], ilpReviews: [],
  }
  if (studentIds.length === 0) return empty

  const [
    rawConcerns,
    rawFlags,
    rawIlpReviews,
    sendStatuses,
    classes,
  ] = await Promise.all([
    // 1. Open SEND concerns
    prisma.sendConcern.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        status:    { notIn: ['closed', 'no_action'] },
      },
      select: {
        id:           true,
        studentId:    true,
        category:     true,
        status:       true,
        createdAt:    true,
        description:  true,
        raisedByUser: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // 2. Active early warning flags
    prisma.earlyWarningFlag.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        isActioned: false,
        expiresAt:  { gt: now },
      },
      select: { id: true, studentId: true, flagType: true, severity: true, description: true, createdAt: true },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    }),

    // 3. ILP reviews due in 14 days
    prisma.individualLearningPlan.findMany({
      where: {
        schoolId,
        studentId:  { in: studentIds },
        status:     'active',
        reviewDate: { gte: now, lte: in14days },
      },
      select: { id: true, studentId: true, reviewDate: true, sendCategory: true },
      orderBy: { reviewDate: 'asc' },
    }),

    // 4. SEND statuses
    prisma.sendStatus.findMany({
      where:  { studentId: { in: studentIds }, NOT: { activeStatus: 'NONE' } },
      select: { studentId: true, activeStatus: true },
    }),

    // 5. Classes in this year group (for homework analysis)
    prisma.schoolClass.findMany({
      where:  { schoolId, ...(yearGroup ? { yearGroup } : {}) },
      select: { id: true },
    }),
  ])

  const sendStatusMap = new Map(sendStatuses.map(s => [s.studentId, s.activeStatus]))

  // ── Homework non-submission analysis ────────────────────────────────────────
  const classIds = classes.map(c => c.id)
  const missedByStudent = new Map<string, { missed: number; total: number }>()

  if (classIds.length > 0) {
    const [recentHw, enrolments] = await Promise.all([
      prisma.homework.findMany({
        where:  { classId: { in: classIds }, status: 'PUBLISHED', dueAt: { gte: since30, lte: now } },
        select: { id: true, classId: true },
      }),
      prisma.enrolment.findMany({
        where:  { classId: { in: classIds }, userId: { in: studentIds } },
        select: { classId: true, userId: true },
      }),
    ])

    if (recentHw.length > 0) {
      const hwIds = recentHw.map(h => h.id)
      const submissions = await prisma.submission.findMany({
        where:  { homeworkId: { in: hwIds }, studentId: { in: studentIds } },
        select: { studentId: true, homeworkId: true },
      })

      const submittedSet = new Set(submissions.map(s => `${s.studentId}:${s.homeworkId}`))
      const hwByClass    = new Map<string, string[]>()
      for (const hw of recentHw) {
        if (!hwByClass.has(hw.classId)) hwByClass.set(hw.classId, [])
        hwByClass.get(hw.classId)!.push(hw.id)
      }
      const studentToClasses = new Map<string, Set<string>>()
      for (const e of enrolments) {
        if (!studentToClasses.has(e.userId)) studentToClasses.set(e.userId, new Set())
        studentToClasses.get(e.userId)!.add(e.classId)
      }

      for (const [sid, classSet] of studentToClasses) {
        let total = 0, missed = 0
        for (const cid of classSet) {
          const hwList = hwByClass.get(cid) ?? []
          total  += hwList.length
          missed += hwList.filter(hid => !submittedSet.has(`${sid}:${hid}`)).length
        }
        if (total > 0) missedByStudent.set(sid, { missed, total })
      }
    }
  }

  // ── Build per-student alert list ─────────────────────────────────────────────
  const concernsByStudent = new Map<string, number>()
  for (const c of rawConcerns) {
    concernsByStudent.set(c.studentId, (concernsByStudent.get(c.studentId) ?? 0) + 1)
  }

  const flagsByStudent = new Map<string, { high: number; medium: number; low: number }>()
  for (const f of rawFlags) {
    if (!flagsByStudent.has(f.studentId)) flagsByStudent.set(f.studentId, { high: 0, medium: 0, low: 0 })
    const b = flagsByStudent.get(f.studentId)!
    if (f.severity === 'high') b.high++
    else if (f.severity === 'medium') b.medium++
    else b.low++
  }

  const alertsMap = new Map<string, string[]>()

  const addAlert = (sid: string, msg: string) => {
    if (!alertsMap.has(sid)) alertsMap.set(sid, [])
    alertsMap.get(sid)!.push(msg)
  }

  for (const [sid, count] of concernsByStudent) {
    addAlert(sid, `${count} open concern${count !== 1 ? 's' : ''}`)
  }
  for (const [sid, counts] of flagsByStudent) {
    if (counts.high   > 0) addAlert(sid, `${counts.high} high-severity flag${counts.high   !== 1 ? 's' : ''}`)
    if (counts.medium > 0) addAlert(sid, `${counts.medium} medium flag${counts.medium !== 1 ? 's' : ''}`)
  }
  for (const [sid, { missed, total }] of missedByStudent) {
    if (missed >= 3 || (total >= 4 && missed / total >= 0.5)) {
      addAlert(sid, `Missed ${missed}/${total} recent homework`)
    }
  }

  const alerts: WelfareAlert[] = Array.from(alertsMap.entries()).map(([sid, alertList]) => {
    const student   = studentMap.get(sid)!
    const highFlags = flagsByStudent.get(sid)?.high ?? 0
    const concerns  = concernsByStudent.get(sid) ?? 0
    const riskLevel: 'urgent' | 'monitor' =
      highFlags > 0 || (concerns > 0 && alertList.length >= 2) ? 'urgent' : 'monitor'
    return {
      studentId:   sid,
      studentName: `${student.firstName} ${student.lastName}`,
      yearGroup:   student.yearGroup,
      alerts:      alertList,
      riskLevel,
      sendStatus:  sendStatusMap.get(sid) ?? null,
    }
  }).sort((a, b) => {
    if (a.riskLevel !== b.riskLevel) return a.riskLevel === 'urgent' ? -1 : 1
    return b.alerts.length - a.alerts.length
  })

  // ── Shape output lists ────────────────────────────────────────────────────────
  const concerns: WelfareConcern[] = rawConcerns.map(c => ({
    id:          c.id,
    studentId:   c.studentId,
    studentName: (() => { const s = studentMap.get(c.studentId); return s ? `${s.firstName} ${s.lastName}` : 'Unknown' })(),
    category:    c.category,
    status:      c.status,
    daysOpen:    Math.floor((now.getTime() - new Date(c.createdAt).getTime()) / 86_400_000),
    raiserName:  `${c.raisedByUser.firstName} ${c.raisedByUser.lastName}`,
    description: c.description,
  }))

  const flags: WelfareFlag[] = rawFlags.map(f => ({
    id:          f.id,
    studentId:   f.studentId,
    studentName: (() => { const s = studentMap.get(f.studentId); return s ? `${s.firstName} ${s.lastName}` : 'Unknown' })(),
    flagType:    f.flagType,
    severity:    f.severity,
    description: f.description,
    daysActive:  Math.floor((now.getTime() - new Date(f.createdAt).getTime()) / 86_400_000),
  }))

  const ilpReviews: WelfareIlpReview[] = rawIlpReviews.map(r => ({
    ilpId:        r.id,
    studentId:    r.studentId,
    studentName:  (() => { const s = studentMap.get(r.studentId); return s ? `${s.firstName} ${s.lastName}` : 'Unknown' })(),
    reviewDate:   r.reviewDate.toISOString(),
    daysUntil:    Math.max(0, Math.floor((r.reviewDate.getTime() - now.getTime()) / 86_400_000)),
    sendCategory: r.sendCategory,
  }))

  const missedHwCount = [...missedByStudent.values()]
    .filter(({ missed, total }) => missed >= 3 || (total >= 4 && missed / total >= 0.5)).length

  return {
    yearGroup,
    totalStudents:            students.length,
    studentsNeedingAttention: alerts.length,
    openConcernsCount:        rawConcerns.length,
    highFlagsCount:           rawFlags.filter(f => f.severity === 'high').length,
    missedHwStudentsCount:    missedHwCount,
    ilpReviewsDue14d:         rawIlpReviews.length,
    alerts,
    concerns,
    flags,
    ilpReviews,
  }
}
