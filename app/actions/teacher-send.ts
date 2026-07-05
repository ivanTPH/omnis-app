'use server'

import { requireAuth } from '@/lib/session'
import { prisma }      from '@/lib/prisma'
import { percentToGcseGrade } from '@/lib/grading'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CaseloadTarget = {
  id:         string
  target:     string
  targetDate: string  // ISO
  daysLeft:   number
}

export type CaseloadStudent = {
  id:           string
  firstName:    string
  lastName:     string
  yearGroup:    number | null
  classNames:   string[]   // classes this teacher teaches them in
  sendStatus:   'SEN_SUPPORT' | 'EHCP'
  needArea:     string | null
  hasIlp:       boolean
  ilpId:        string | null
  reviewDate:   string | null   // ISO, null if no ILP
  reviewDaysUntil: number | null
  activeTargets: CaseloadTarget[]
  openConcerns: number
  avgGrade:     number | null   // GCSE 1-9 from teacher's own homework
}

export type TeacherSendCaseload = {
  totalSend:      number
  senSupport:     number
  ehcpCount:      number
  noIlpCount:     number
  reviewsDue14d:  number
  students:       CaseloadStudent[]
  classSummary:   { classId: string; className: string; sendCount: number }[]
}

// ── Main action ───────────────────────────────────────────────────────────────

export async function getTeacherSendCaseload(): Promise<TeacherSendCaseload> {
  const { schoolId, id: userId, role } = await requireAuth()
  const allowed = ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SLT','SCHOOL_ADMIN']
  if (!allowed.includes(role)) throw new Error('Unauthorised')

  const now     = new Date()
  const since90 = new Date(now.getTime() - 90 * 86_400_000)

  // 1. Teacher's classes (for HOD: fall back to department-wide if not assigned as ClassTeacher)
  let classes = await prisma.schoolClass.findMany({
    where:   { schoolId, teachers: { some: { userId } } },
    select:  { id: true, name: true, subject: true, yearGroup: true, department: true },
    orderBy: [{ yearGroup: 'asc' }, { name: 'asc' }],
  })

  if (classes.length === 0 && role === 'HEAD_OF_DEPT') {
    // HOD may not be a ClassTeacher on individual classes — look up department via any class link
    const deptLink = await prisma.classTeacher.findFirst({
      where:  { userId, class: { schoolId } },
      select: { class: { select: { department: true } } },
    })
    const dept = deptLink?.class.department ?? null
    classes = await prisma.schoolClass.findMany({
      where:   { schoolId, ...(dept ? { department: dept } : {}) },
      select:  { id: true, name: true, subject: true, yearGroup: true, department: true },
      orderBy: [{ yearGroup: 'asc' }, { name: 'asc' }],
    })
  }

  const classIds = classes.map(c => c.id)

  if (classIds.length === 0) {
    return { totalSend: 0, senSupport: 0, ehcpCount: 0, noIlpCount: 0,
             reviewsDue14d: 0, students: [], classSummary: [] }
  }

  // 2. All enrolments for these classes
  const enrolments = await prisma.enrolment.findMany({
    where:  { classId: { in: classIds } },
    select: { classId: true, userId: true },
  })
  const allStudentIds = [...new Set(enrolments.map(e => e.userId))]

  // 3. SEND statuses — only SEND students
  const sendStatuses = await prisma.sendStatus.findMany({
    where:  { studentId: { in: allStudentIds }, NOT: { activeStatus: 'NONE' } },
    select: { studentId: true, activeStatus: true, needArea: true },
  })
  const sendStudentIds = sendStatuses.map(s => s.studentId)
  if (sendStudentIds.length === 0) {
    return { totalSend: 0, senSupport: 0, ehcpCount: 0, noIlpCount: 0,
             reviewsDue14d: 0, students: [],
             classSummary: classes.map(c => ({ classId: c.id, className: c.name, sendCount: 0 })) }
  }

  const sendStatusMap = new Map(sendStatuses.map(s => [s.studentId, s]))

  // 4. Student details
  const students = await prisma.user.findMany({
    where:  { id: { in: sendStudentIds } },
    select: { id: true, firstName: true, lastName: true, yearGroup: true },
  })
  const studentMap = new Map(students.map(s => [s.id, s]))

  // 5. Active ILPs for SEND students — include under_review so hasIlp reflects reality
  const ilps = await prisma.individualLearningPlan.findMany({
    where: {
      schoolId,
      studentId: { in: sendStudentIds },
      status:    { in: ['active', 'under_review'] },
    },
    select: {
      id: true, studentId: true, reviewDate: true, sendCategory: true,
      targets: {
        where:   { status: 'active' },
        select:  { id: true, target: true, targetDate: true },
        orderBy: { targetDate: 'asc' },
        take: 3,
      },
    },
  })
  // Latest approved ILP per student
  const ilpByStudent = new Map<string, typeof ilps[0]>()
  for (const ilp of ilps) {
    if (!ilpByStudent.has(ilp.studentId)) ilpByStudent.set(ilp.studentId, ilp)
  }

  // 6. Open concerns count per student
  const concerns = await prisma.sendConcern.findMany({
    where:  { schoolId, studentId: { in: sendStudentIds }, status: { notIn: ['closed', 'no_action'] } },
    select: { studentId: true },
  })
  const concernCount = new Map<string, number>()
  for (const c of concerns) {
    concernCount.set(c.studentId, (concernCount.get(c.studentId) ?? 0) + 1)
  }

  // 7. Recent submissions (teacher's own homework only) for avg grade
  const recentSubmissions = await prisma.submission.findMany({
    where: {
      studentId:    { in: sendStudentIds },
      schoolId,
      finalScore:   { not: null },
      submittedAt:  { gte: since90 },
      homework:     { classId: { in: classIds } },
    },
    select: { studentId: true, finalScore: true, homework: { select: { gradingBands: true } } },
  })

  function maxFromBands(bands: unknown): number {
    if (!bands || typeof bands !== 'object') return 9
    const keys = Object.keys(bands as Record<string, string>)
    const nums = keys.flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n)))
    return nums.length ? Math.max(...nums) : 9
  }

  const gradesByStudent = new Map<string, number[]>()
  for (const sub of recentSubmissions) {
    const max = maxFromBands(sub.homework.gradingBands)
    const pct = Math.min(100, Math.round(((sub.finalScore ?? 0) / max) * 100))
    const grade = percentToGcseGrade(pct)
    if (!gradesByStudent.has(sub.studentId)) gradesByStudent.set(sub.studentId, [])
    gradesByStudent.get(sub.studentId)!.push(grade)
  }

  // Per-student: which classes (this teacher's) they're in
  const studentClasses = new Map<string, string[]>()
  for (const e of enrolments) {
    if (!sendStudentIds.includes(e.userId)) continue
    if (!studentClasses.has(e.userId)) studentClasses.set(e.userId, [])
    const cls = classes.find(c => c.id === e.classId)
    if (cls) studentClasses.get(e.userId)!.push(cls.name)
  }

  // Class SEND count
  const sendEnrolSet = new Set(sendStudentIds)
  const classSendCount = new Map<string, number>()
  for (const e of enrolments) {
    if (sendEnrolSet.has(e.userId)) {
      classSendCount.set(e.classId, (classSendCount.get(e.classId) ?? 0) + 1)
    }
  }

  // ── Build output ──────────────────────────────────────────────────────────
  const caseloadStudents: CaseloadStudent[] = sendStudentIds.map(sid => {
    const student   = studentMap.get(sid)!
    const ss        = sendStatusMap.get(sid)!
    const ilp       = ilpByStudent.get(sid) ?? null
    const grades    = gradesByStudent.get(sid) ?? []
    const avgGrade  = grades.length
      ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length)
      : null

    const reviewDate     = ilp?.reviewDate ?? null
    const reviewDaysUntil = reviewDate
      ? Math.max(0, Math.floor((new Date(reviewDate).getTime() - now.getTime()) / 86_400_000))
      : null

    const activeTargets: CaseloadTarget[] = (ilp?.targets ?? []).map(t => ({
      id:         t.id,
      target:     t.target,
      targetDate: t.targetDate.toISOString(),
      daysLeft:   Math.max(0, Math.floor((t.targetDate.getTime() - now.getTime()) / 86_400_000)),
    }))

    return {
      id:           sid,
      firstName:    student.firstName,
      lastName:     student.lastName,
      yearGroup:    student.yearGroup,
      classNames:   studentClasses.get(sid) ?? [],
      sendStatus:   ss.activeStatus as 'SEN_SUPPORT' | 'EHCP',
      needArea:     ss.needArea ?? null,
      hasIlp:       ilp != null,
      ilpId:        ilp?.id ?? null,
      reviewDate:   reviewDate ? new Date(reviewDate).toISOString() : null,
      reviewDaysUntil,
      activeTargets,
      openConcerns: concernCount.get(sid) ?? 0,
      avgGrade,
    }
  }).sort((a, b) => {
    // Sort: EHCP first, then SEN Support; within each group by name
    if (a.sendStatus !== b.sendStatus) return a.sendStatus === 'EHCP' ? -1 : 1
    return a.lastName.localeCompare(b.lastName)
  })

  const noIlpCount    = caseloadStudents.filter(s => !s.hasIlp).length
  const reviewsDue14d = caseloadStudents.filter(
    s => s.reviewDaysUntil != null && s.reviewDaysUntil <= 14
  ).length

  return {
    totalSend:    caseloadStudents.length,
    senSupport:   caseloadStudents.filter(s => s.sendStatus === 'SEN_SUPPORT').length,
    ehcpCount:    caseloadStudents.filter(s => s.sendStatus === 'EHCP').length,
    noIlpCount,
    reviewsDue14d,
    students:     caseloadStudents,
    classSummary: classes.map(c => ({
      classId:   c.id,
      className: c.name,
      sendCount: classSendCount.get(c.id) ?? 0,
    })),
  }
}
