'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SendStatusValue, HomeworkStatus, Role } from '@prisma/client'

// ── Adaptive analytics ────────────────────────────────────────────────────────

export type HomeworkAdaptiveAnalytics = {
  typeBreakdown: { type: string; count: number; avgScore: number }[]
  bloomsDistribution: { level: string; count: number; avgScore: number }[]
  completionByType: { type: string; completionRate: number }[]
  ilpEvidenceRate: number
  ehcpEvidenceRate: number
}

export async function getHomeworkAdaptiveAnalytics(filters?: {
  classId?: string
  studentId?: string
}): Promise<HomeworkAdaptiveAnalytics> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  const hwWhere: any = { schoolId, status: { not: 'DRAFT' } }
  if (filters?.classId) hwWhere.classId = filters.classId

  const homeworks = await prisma.homework.findMany({
    where: hwWhere,
    select: {
      id: true,
      homeworkVariantType: true,
      bloomsLevel: true,
      ilpTargetIds: true,
      ehcpOutcomeIds: true,
      classId: true,
      submissions: {
        where: filters?.studentId ? { studentId: filters.studentId } : undefined,
        select: { finalScore: true, status: true, studentId: true },
      },
    },
    take: 200,
  })

  // Type breakdown
  const typeMap: Record<string, { scores: number[]; submitted: number; total: number }> = {}
  const bloomsMap: Record<string, { scores: number[]; count: number }> = {}

  for (const hw of homeworks) {
    const t = hw.homeworkVariantType ?? 'free_text'
    if (!typeMap[t]) typeMap[t] = { scores: [], submitted: 0, total: 0 }
    for (const sub of hw.submissions) {
      typeMap[t].total++
      if (sub.status !== 'SUBMITTED' || sub.finalScore != null) typeMap[t].submitted++
      if (sub.finalScore != null) typeMap[t].scores.push(sub.finalScore)
    }

    if (hw.bloomsLevel) {
      const b = hw.bloomsLevel
      if (!bloomsMap[b]) bloomsMap[b] = { scores: [], count: 0 }
      bloomsMap[b].count++
      for (const sub of hw.submissions) {
        if (sub.finalScore != null) bloomsMap[b].scores.push(sub.finalScore)
      }
    }
  }

  const typeBreakdown = Object.entries(typeMap).map(([type, d]) => ({
    type,
    count: d.total,
    avgScore: d.scores.length ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
  })).sort((a, b) => b.count - a.count)

  const bloomsOrder = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create']
  const bloomsDistribution = Object.entries(bloomsMap)
    .sort((a, b) => bloomsOrder.indexOf(a[0]) - bloomsOrder.indexOf(b[0]))
    .map(([level, d]) => ({
      level,
      count: d.count,
      avgScore: d.scores.length ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
    }))

  const completionByType = Object.entries(typeMap).map(([type, d]) => ({
    type,
    completionRate: d.total > 0 ? Math.round((d.submitted / d.total) * 100) : 0,
  }))

  // ILP evidence rate
  const totalIlpTargets = await prisma.ilpTarget.count({ where: { ilp: { schoolId, status: 'active' }, status: 'in_progress' } })
  const linkedTargets = await prisma.ilpHomeworkLink.count({ where: { homework: { schoolId } } })
  const ilpEvidenceRate = totalIlpTargets > 0 ? Math.round((linkedTargets / totalIlpTargets) * 100) : 0

  // EHCP evidence rate
  const totalOutcomes = await prisma.ehcpOutcome.count({ where: { ehcp: { schoolId, status: 'active' } } })
  const outcomesWithEvidence = await prisma.ehcpOutcome.count({ where: { ehcp: { schoolId, status: 'active' }, evidenceCount: { gt: 0 } } })
  const ehcpEvidenceRate = totalOutcomes > 0 ? Math.round((outcomesWithEvidence / totalOutcomes) * 100) : 0

  return { typeBreakdown, bloomsDistribution, completionByType, ilpEvidenceRate, ehcpEvidenceRate }
}

export type AnalyticsFilters = {
  subject?:      string
  yearGroup?:    number
  classId?:      string
  sendCategory?: string   // 'SEN_SUPPORT' | 'EHCP'
  studentId?:    string
  dateFrom?:     string   // ISO date string
  dateTo?:       string   // ISO date string
}

export type HomeworkRow = {
  submissionId: string | null
  homeworkId:   string
  title:        string
  dueAt:        string
  subject:      string
  type:         string
  submitted:    boolean
  score:        number | null
  grade:        string | null
}

export type StudentData = {
  id:             string
  firstName:      string
  lastName:       string
  completionRate: number      // 0–100
  avgScore:       number | null
  classAvgScore:  number | null
  scoreVsClass:   number | null
  hasSend:        boolean
  sendCategory:   string | null   // 'SEN_SUPPORT' | 'EHCP' | null
  homeworks:      HomeworkRow[]
}

export type StudentPerformanceResult = {
  students:      StudentData[]
  totalStudents: number
  avgCompletion: number
  avgScore:      number | null
  sendCount:     number
}

export type FilterOptions = {
  subjects:       string[]
  yearGroups:     number[]
  classes:        { id: string; name: string; subject: string; yearGroup: number }[]
  students:       { id: string; firstName: string; lastName: string }[]
  sendCategories: string[]
}

export async function getAnalyticsFilters(): Promise<FilterOptions> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  const [classes, students, sendStatuses] = await Promise.all([
    prisma.schoolClass.findMany({
      where:   { schoolId },
      select:  { id: true, name: true, subject: true, yearGroup: true },
      orderBy: [{ yearGroup: 'asc' }, { subject: 'asc' }, { name: 'asc' }],
    }),
    prisma.user.findMany({
      where:   { schoolId, role: Role.STUDENT, isActive: true },
      select:  { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.sendStatus.findMany({
      where:    { activeStatus: { not: SendStatusValue.NONE }, student: { schoolId } },
      select:   { activeStatus: true },
      distinct: ['activeStatus'],
    }),
  ])

  const subjects      = [...new Set(classes.map(c => c.subject))].sort()
  const yearGroups    = [...new Set(classes.map(c => c.yearGroup))].sort((a, b) => a - b)
  const sendCategories = sendStatuses.map(s => s.activeStatus as string)

  return { subjects, yearGroups, classes, students, sendCategories }
}

export async function getStudentPerformance(filters: AnalyticsFilters): Promise<StudentPerformanceResult> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  // ── Step 1: Resolve student IDs ──────────────────────────────────────────
  let studentIds: string[]

  if (filters.studentId) {
    studentIds = [filters.studentId]
  } else {
    const classFilter: any = { schoolId }
    if (filters.classId)   classFilter.id        = filters.classId
    if (filters.subject)   classFilter.subject   = filters.subject
    if (filters.yearGroup) classFilter.yearGroup  = Number(filters.yearGroup)

    const enrolments = await prisma.enrolment.findMany({
      where:    { class: classFilter },
      select:   { userId: true },
      distinct: ['userId'],
    })
    studentIds = enrolments.map(e => e.userId)
  }

  // Further filter by SEND category
  if (filters.sendCategory && studentIds.length > 0) {
    const sendWhere: any = {
      studentId: { in: studentIds },
      activeStatus: { not: SendStatusValue.NONE },
    }
    // '__send_only__' means any SEND student; otherwise filter by specific category
    if (filters.sendCategory !== '__send_only__') {
      sendWhere.activeStatus = filters.sendCategory as SendStatusValue
    }
    const sendMatches = await prisma.sendStatus.findMany({
      where:  sendWhere,
      select: { studentId: true },
    })
    studentIds = sendMatches.map(s => s.studentId)
  }

  if (studentIds.length === 0) {
    return { students: [], totalStudents: 0, avgCompletion: 0, avgScore: null, sendCount: 0 }
  }

  // ── Step 2: Resolve homework class scope ─────────────────────────────────
  const allEnrolments = await prisma.enrolment.findMany({
    where:  { userId: { in: studentIds } },
    select: { userId: true, classId: true },
  })
  const allEnrolledClassIds = [...new Set(allEnrolments.map(e => e.classId))]

  let targetClassIds: string[]
  if (filters.classId) {
    targetClassIds = [filters.classId]
  } else if (filters.subject || filters.yearGroup) {
    const narrowed = await prisma.schoolClass.findMany({
      where: {
        id:        { in: allEnrolledClassIds },
        schoolId,
        ...(filters.subject   ? { subject:   filters.subject }            : {}),
        ...(filters.yearGroup ? { yearGroup: Number(filters.yearGroup) }  : {}),
      },
      select: { id: true },
    })
    targetClassIds = narrowed.map(c => c.id)
  } else {
    targetClassIds = allEnrolledClassIds
  }

  if (targetClassIds.length === 0) {
    return { students: [], totalStudents: 0, avgCompletion: 0, avgScore: null, sendCount: 0 }
  }

  // ── Step 3: Fetch homeworks ───────────────────────────────────────────────
  const dueAtFilter: any = {}
  if (filters.dateFrom) dueAtFilter.gte = new Date(filters.dateFrom)
  if (filters.dateTo)   dueAtFilter.lte = new Date(filters.dateTo)

  const homeworks = await prisma.homework.findMany({
    where: {
      schoolId,
      classId: { in: targetClassIds },
      status:  { not: HomeworkStatus.DRAFT },
      ...(Object.keys(dueAtFilter).length > 0 ? { dueAt: dueAtFilter } : {}),
    },
    select: {
      id:      true,
      title:   true,
      dueAt:   true,
      type:    true,
      classId: true,
      class:   { select: { subject: true } },
    },
  })

  const homeworkIds = homeworks.map(h => h.id)

  // ── Step 4: Fetch submissions, students, SEND ────────────────────────────
  const [submissions, students, sendStatusList] = await Promise.all([
    homeworkIds.length > 0
      ? prisma.submission.findMany({
          where:  { studentId: { in: studentIds }, homeworkId: { in: homeworkIds } },
          select: {
            id:         true,
            homeworkId: true,
            studentId:  true,
            finalScore: true,
            grade:      true,
            status:     true,
            submittedAt: true,
          },
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where:   { id: { in: studentIds } },
      select:  { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.sendStatus.findMany({
      where:  { studentId: { in: studentIds } },
      select: { studentId: true, activeStatus: true },
    }),
  ])

  // ── Step 5: Build per-student rows ────────────────────────────────────────
  const sendByStudent = new Map(sendStatusList.map(s => [s.studentId, s]))

  const classIdsByStudent = new Map<string, Set<string>>()
  for (const e of allEnrolments) {
    if (!classIdsByStudent.has(e.userId)) classIdsByStudent.set(e.userId, new Set())
    classIdsByStudent.get(e.userId)!.add(e.classId)
  }

  // key: `studentId:homeworkId`
  const subMap = new Map<string, typeof submissions[0]>()
  for (const s of submissions) subMap.set(`${s.studentId}:${s.homeworkId}`, s)

  // Class avg score in-memory
  const classScoreMap = new Map<string, number[]>()
  for (const sub of submissions) {
    if (sub.finalScore != null) {
      const hw = homeworks.find(h => h.id === sub.homeworkId)
      if (hw) {
        const arr = classScoreMap.get(hw.classId) ?? []
        arr.push(sub.finalScore)
        classScoreMap.set(hw.classId, arr)
      }
    }
  }
  const classAvgMap = new Map<string, number>()
  for (const [cid, scores] of classScoreMap) {
    classAvgMap.set(cid, scores.reduce((a, b) => a + b, 0) / scores.length)
  }

  const studentRows: StudentData[] = students.map(student => {
    const enrolledClasses = classIdsByStudent.get(student.id) ?? new Set()
    const assignedHws     = homeworks.filter(h => enrolledClasses.has(h.classId))
    const send            = sendByStudent.get(student.id)

    const hwRows: HomeworkRow[] = assignedHws
      .map(hw => {
        const sub = subMap.get(`${student.id}:${hw.id}`)
        return {
          submissionId: sub?.id ?? null,
          homeworkId:   hw.id,
          title:        hw.title,
          dueAt:        hw.dueAt.toISOString(),
          subject:      hw.class.subject,
          type:         hw.type,
          submitted:    sub != null,
          score:        sub?.finalScore ?? null,
          grade:        sub?.grade ?? null,
        }
      })
      .sort((a, b) => b.dueAt.localeCompare(a.dueAt))

    const submittedCount  = hwRows.filter(h => h.submitted).length
    const scoredHws       = hwRows.filter(h => h.score != null)
    const completionRate  = assignedHws.length > 0
      ? Math.round((submittedCount / assignedHws.length) * 100)
      : 0
    const avgScore        = scoredHws.length > 0
      ? Math.round(scoredHws.reduce((a, h) => a + (h.score ?? 0), 0) / scoredHws.length)
      : null

    // Class avg: mean across enrolled target classes that have score data
    const classAvgScores = [...enrolledClasses]
      .filter(cid => targetClassIds.includes(cid) && classAvgMap.has(cid))
      .map(cid => classAvgMap.get(cid)!)
    const classAvgScore = classAvgScores.length > 0
      ? Math.round(classAvgScores.reduce((a, b) => a + b, 0) / classAvgScores.length)
      : null
    const scoreVsClass  = avgScore != null && classAvgScore != null
      ? Math.round(avgScore - classAvgScore)
      : null

    const hasSend       = send != null && send.activeStatus !== SendStatusValue.NONE

    return {
      id:             student.id,
      firstName:      student.firstName,
      lastName:       student.lastName,
      completionRate,
      avgScore,
      classAvgScore,
      scoreVsClass,
      hasSend,
      sendCategory:   hasSend ? (send?.activeStatus ?? null) : null,
      homeworks:      hwRows,
    }
  })

  const avgCompletion   = studentRows.length > 0
    ? Math.round(studentRows.reduce((a, s) => a + s.completionRate, 0) / studentRows.length)
    : 0
  const scoredStudents  = studentRows.filter(s => s.avgScore != null)
  const avgScore        = scoredStudents.length > 0
    ? Math.round(scoredStudents.reduce((a, s) => a + (s.avgScore ?? 0), 0) / scoredStudents.length)
    : null
  const sendCount       = studentRows.filter(s => s.hasSend).length

  return { students: studentRows, totalStudents: studentRows.length, avgCompletion, avgScore, sendCount }
}

// ── Student detail (individual dashboard) ──────────────────────────────────

export type StudentDetailData = {
  id:         string
  firstName:  string
  lastName:   string
  yearGroup:  number | null
  email:      string
  hasSend:    boolean
  sendStatus: string | null   // 'SEN_SUPPORT' | 'EHCP' | null
  classes:    { id: string; name: string; subject: string; yearGroup: number }[]
  totalAssigned:  number
  completionRate: number
  avgScore:       number | null
  subjectRows:  { subject: string; assigned: number; submitted: number; avgScore: number | null }[]
  homeworks:    (HomeworkRow & { class: string })[]
}

export async function getStudentDetail(studentId: string): Promise<StudentDetailData | null> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  const student = await prisma.user.findFirst({
    where:   { id: studentId, schoolId, role: 'STUDENT' },
    select:  { id: true, firstName: true, lastName: true, email: true, yearGroup: true },
  })
  if (!student) return null

  const [enrolments, sendStatus] = await Promise.all([
    prisma.enrolment.findMany({
      where:   { userId: studentId },
      include: { class: { select: { id: true, name: true, subject: true, yearGroup: true } } },
    }),
    prisma.sendStatus.findFirst({ where: { studentId } }),
  ])

  const classes     = enrolments.map(e => e.class)
  const classIds    = classes.map(c => c.id)

  const homeworks = await prisma.homework.findMany({
    where:   { schoolId, classId: { in: classIds }, status: { not: 'DRAFT' } },
    select:  { id: true, title: true, dueAt: true, type: true, classId: true,
               class: { select: { subject: true, name: true } } },
    orderBy: { dueAt: 'desc' },
  })

  const submissions = homeworks.length > 0
    ? await prisma.submission.findMany({
        where:  { studentId, homeworkId: { in: homeworks.map(h => h.id) } },
        select: { id: true, homeworkId: true, finalScore: true, grade: true, status: true, submittedAt: true },
      })
    : []
  const subMap = new Map(submissions.map(s => [s.homeworkId, s]))

  const hwRows: (HomeworkRow & { class: string })[] = homeworks.map(hw => {
    const sub = subMap.get(hw.id)
    return {
      submissionId: sub?.id ?? null,
      homeworkId:   hw.id,
      title:        hw.title,
      dueAt:        hw.dueAt.toISOString(),
      subject:      hw.class.subject,
      class:        hw.class.name,
      type:         hw.type,
      submitted:    sub != null,
      score:        sub?.finalScore ?? null,
      grade:        sub?.grade ?? null,
    }
  })

  // Per-subject aggregation
  const bySubject = new Map<string, { assigned: number; submitted: number; scores: number[] }>()
  for (const hw of hwRows) {
    const row = bySubject.get(hw.subject) ?? { assigned: 0, submitted: 0, scores: [] }
    row.assigned++
    if (hw.submitted) row.submitted++
    if (hw.score != null) row.scores.push(hw.score)
    bySubject.set(hw.subject, row)
  }
  const subjectRows = [...bySubject.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([subject, row]) => ({
      subject,
      assigned:  row.assigned,
      submitted: row.submitted,
      avgScore:  row.scores.length > 0 ? Math.round(row.scores.reduce((a, b) => a + b, 0) / row.scores.length) : null,
    }))

  const totalAssigned  = hwRows.length
  const submitted      = hwRows.filter(h => h.submitted).length
  const completionRate = totalAssigned > 0 ? Math.round((submitted / totalAssigned) * 100) : 0
  const scored         = hwRows.filter(h => h.score != null)
  const avgScore       = scored.length > 0
    ? Math.round(scored.reduce((a, h) => a + (h.score ?? 0), 0) / scored.length)
    : null

  const hasSend = sendStatus != null && sendStatus.activeStatus !== 'NONE'

  return {
    id:             student.id,
    firstName:      student.firstName,
    lastName:       student.lastName,
    email:          student.email,
    yearGroup:      student.yearGroup,
    hasSend,
    sendStatus:     hasSend ? sendStatus!.activeStatus : null,
    classes,
    totalAssigned,
    completionRate,
    avgScore,
    subjectRows,
    homeworks:      hwRows,
  }
}

export async function getSubmissionDetail(submissionId: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId } = session.user as any

  const sub = await prisma.submission.findFirst({
    where:   { id: submissionId, schoolId },
    include: {
      student:  { select: { firstName: true, lastName: true } },
      homework: { select: { id: true, title: true, instructions: true, type: true } },
    },
  })
  if (!sub) return null

  return {
    submissionId: sub.id,
    studentName:  `${sub.student.firstName} ${sub.student.lastName}`,
    content:      sub.content,
    finalScore:   sub.finalScore,
    grade:        sub.grade,
    feedback:     sub.teacherScoreReason,
    submittedAt:  sub.submittedAt.toISOString(),
    status:       sub.status,
    homework: {
      id:           sub.homework.id,
      title:        sub.homework.title,
      instructions: sub.homework.instructions,
      type:         sub.homework.type,
    },
    markingUrl: `/homework/${sub.homework.id}/mark/${sub.id}`,
  }
}

// ── Class-level analytics summary ────────────────────────────────────────────

export type ClassSummary = {
  id:            string
  name:          string
  subject:       string
  yearGroup:     number
  studentCount:  number
  hwCount:       number
  avgCompletion: number | null
  avgScore:      number | null
  sendCount:     number
}

export async function getClassSummaries(
  dateFrom?: string,
  dateTo?:   string,
): Promise<ClassSummary[]> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, id: userId, role } = session.user as any

  const restrictToTeacher = ['TEACHER', 'COVER_MANAGER', 'HEAD_OF_DEPT'].includes(role)

  const classes = await prisma.schoolClass.findMany({
    where: {
      schoolId,
      ...(restrictToTeacher ? { teachers: { some: { userId } } } : {}),
    },
    include: {
      enrolments: { select: { userId: true } },
      homework: {
        where: {
          status: 'PUBLISHED',
          ...(dateFrom || dateTo ? {
            dueAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
            },
          } : {}),
        },
        select: {
          submissions: { select: { finalScore: true, studentId: true } },
        },
      },
    },
    orderBy: [{ yearGroup: 'asc' }, { name: 'asc' }],
  })

  const allStudentIds = [...new Set(classes.flatMap(c => c.enrolments.map(e => e.userId)))]
  const sendStatuses  = allStudentIds.length
    ? await prisma.sendStatus.findMany({
        where:  { studentId: { in: allStudentIds }, NOT: { activeStatus: 'NONE' } },
        select: { studentId: true },
      })
    : []
  const sendSet = new Set(sendStatuses.map(s => s.studentId))

  return classes.map(cls => {
    const studentIds = new Set(cls.enrolments.map(e => e.userId))
    const sendCount  = [...studentIds].filter(id => sendSet.has(id)).length

    let totalRate = 0
    let hwWithData = 0
    const allScores: number[] = []

    for (const hw of cls.homework) {
      if (studentIds.size === 0) continue
      const submitted = new Set(hw.submissions.map(s => s.studentId))
      totalRate += (submitted.size / studentIds.size) * 100
      hwWithData++
      hw.submissions.forEach(s => { if (s.finalScore != null) allScores.push(s.finalScore) })
    }

    const avgCompletion = hwWithData > 0 ? Math.round(totalRate / hwWithData) : null
    const avgScore      = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : null

    return {
      id:            cls.id,
      name:          cls.name,
      subject:       cls.subject,
      yearGroup:     cls.yearGroup,
      studentCount:  studentIds.size,
      hwCount:       cls.homework.length,
      avgCompletion,
      avgScore,
      sendCount,
    }
  })
}
