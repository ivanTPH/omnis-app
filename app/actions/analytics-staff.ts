'use server'

import { requireAuth }       from '@/lib/session'
import { prisma }            from '@/lib/prisma'
import { redirect }          from 'next/navigation'

const ALLOWED = ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN']

// ── Types ─────────────────────────────────────────────────────────────────────

export type StaffTeacher = {
  id:         string
  name:       string
  email:      string
  classCount: number
  department: string
}

export type TeacherClassStat = {
  id:             string
  name:           string
  subject:        string
  yearGroup:      number
  studentCount:   number
  sendCount:      number
  avgGrade:       number | null   // 0–9 scale
  ungraded:       number
  submissionRate: number          // 0–1
  homeworkSet30d: number
}

export type TeacherAnalyticsData = {
  teacher: StaffTeacher
  classes: TeacherClassStat[]
  totals: {
    classes:           number
    students:          number
    sendStudents:      number
    homeworkSet30d:    number
    ungraded:          number
    avgGrade:          number | null
    avgTurnaroundDays: number | null
  }
  bloomsCoverage: { level: string; count: number }[]
}

export type DeptTeacherRow = {
  id:             string
  name:           string
  classCount:     number
  studentCount:   number
  sendCount:      number
  avgGrade:       number | null
  ungraded:       number
  submissionRate: number
  homeworkSet30d: number
}

export type DepartmentAnalyticsData = {
  department:     string
  departments:    string[]
  teachers:       DeptTeacherRow[]
  bloomsCoverage: { level: string; count: number }[]
  totals: {
    teachers:   number
    classes:    number
    students:   number
    avgGrade:   number | null
    sendPct:    number
    ungraded:   number
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getDeptForHod(schoolId: string, userId: string): Promise<string | null> {
  const cls = await prisma.classTeacher.findFirst({
    where:  { userId, class: { schoolId } },
    select: { class: { select: { department: true } } },
  })
  return cls?.class.department ?? null
}

async function buildClassStats(
  classIds: string[],
  schoolId: string,
): Promise<Map<string, Omit<TeacherClassStat, 'id' | 'name' | 'subject' | 'yearGroup'>>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [enrolments, sendStatuses, aggRecords, submissions, homework30d] = await Promise.all([
    prisma.enrolment.findMany({
      where:  { classId: { in: classIds } },
      select: { classId: true, userId: true },
    }),
    prisma.sendStatus.findMany({
      where:  { student: { schoolId, enrolments: { some: { classId: { in: classIds } } } }, NOT: { activeStatus: 'NONE' } },
      select: { studentId: true, student: { select: { enrolments: { where: { classId: { in: classIds } }, select: { classId: true } } } } },
    }),
    prisma.classPerformanceAggregate.findMany({
      where:   { classId: { in: classIds } },
      orderBy: { termId: 'desc' },
      select:  { classId: true, avgScore: true },
    }),
    prisma.submission.findMany({
      where:  { homework: { classId: { in: classIds } } },
      select: { homework: { select: { classId: true } }, status: true, finalScore: true },
    }),
    prisma.homework.findMany({
      where:  { classId: { in: classIds }, createdAt: { gte: thirtyDaysAgo } },
      select: { classId: true },
    }),
  ])

  // Latest agg per class
  const aggByClass = new Map<string, number | null>()
  for (const a of aggRecords) {
    if (!aggByClass.has(a.classId)) aggByClass.set(a.classId, a.avgScore)
  }

  // Enrollments per class
  const stuByClass = new Map<string, Set<string>>()
  for (const e of enrolments) {
    if (!stuByClass.has(e.classId)) stuByClass.set(e.classId, new Set())
    stuByClass.get(e.classId)!.add(e.userId)
  }

  // SEND per class
  const sendByClass = new Map<string, number>()
  for (const s of sendStatuses) {
    for (const enr of s.student.enrolments) {
      sendByClass.set(enr.classId, (sendByClass.get(enr.classId) ?? 0) + 1)
    }
  }

  // Submissions per class
  type SubRow = { status: string; finalScore: number | null }
  const subsByClass = new Map<string, SubRow[]>()
  for (const s of submissions) {
    const cid = s.homework.classId
    if (!subsByClass.has(cid)) subsByClass.set(cid, [])
    subsByClass.get(cid)!.push({ status: s.status, finalScore: s.finalScore })
  }

  // Homework set per class (30d)
  const hw30ByClass = new Map<string, number>()
  for (const h of homework30d) {
    hw30ByClass.set(h.classId, (hw30ByClass.get(h.classId) ?? 0) + 1)
  }

  const result = new Map<string, Omit<TeacherClassStat, 'id' | 'name' | 'subject' | 'yearGroup'>>()
  for (const cid of classIds) {
    const subs       = subsByClass.get(cid) ?? []
    const stuSet     = stuByClass.get(cid) ?? new Set()
    const total      = subs.length
    const submitted  = subs.filter(s => s.status !== 'SUBMITTED' || s.finalScore != null).length
    const ungraded   = subs.filter(s => ['SUBMITTED', 'UNDER_REVIEW'].includes(s.status) && s.finalScore == null).length
    const submRate   = stuSet.size > 0 && total > 0 ? submitted / total : 0

    result.set(cid, {
      studentCount:   stuSet.size,
      sendCount:      sendByClass.get(cid) ?? 0,
      avgGrade:       aggByClass.get(cid) ?? null,
      ungraded,
      submissionRate: Math.min(1, submRate),
      homeworkSet30d: hw30ByClass.get(cid) ?? 0,
    })
  }

  return result
}

// ── Teacher list ──────────────────────────────────────────────────────────────

export async function getTeacherList(filterDept?: string): Promise<StaffTeacher[]> {
  const { schoolId, role, id: userId } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const dept = role === 'HEAD_OF_DEPT' ? await getDeptForHod(schoolId, userId) : filterDept ?? null

  const classTeachers = await prisma.classTeacher.findMany({
    where: { class: { schoolId, ...(dept ? { department: dept } : {}) } },
    select: {
      userId: true,
      user:   { select: { id: true, firstName: true, lastName: true, email: true } },
      class:  { select: { id: true, department: true } },
    },
  })

  const teacherMap = new Map<string, { name: string; email: string; classIds: Set<string>; department: string }>()
  for (const ct of classTeachers) {
    if (!teacherMap.has(ct.userId)) {
      teacherMap.set(ct.userId, {
        name:       `${ct.user.firstName} ${ct.user.lastName}`,
        email:      ct.user.email,
        classIds:   new Set(),
        department: ct.class.department,
      })
    }
    teacherMap.get(ct.userId)!.classIds.add(ct.class.id)
  }

  return [...teacherMap.entries()]
    .map(([id, t]) => ({ id, name: t.name, email: t.email, classCount: t.classIds.size, department: t.department }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ── Teacher analytics ─────────────────────────────────────────────────────────

export async function getTeacherAnalytics(teacherId: string): Promise<TeacherAnalyticsData | null> {
  const { schoolId, role } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const teacher = await prisma.user.findFirst({
    where:  { id: teacherId, schoolId },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
  if (!teacher) return null

  const classTeachers = await prisma.classTeacher.findMany({
    where:  { userId: teacherId, class: { schoolId } },
    select: { class: { select: { id: true, name: true, subject: true, yearGroup: true, department: true } } },
  })

  const classes   = classTeachers.map(ct => ct.class)
  const classIds  = classes.map(c => c.id)
  if (classIds.length === 0) {
    return {
      teacher:        { id: teacher.id, name: `${teacher.firstName} ${teacher.lastName}`, email: teacher.email, classCount: 0, department: '' },
      classes:        [],
      totals:         { classes: 0, students: 0, sendStudents: 0, homeworkSet30d: 0, ungraded: 0, avgGrade: null, avgTurnaroundDays: null },
      bloomsCoverage: [],
    }
  }

  const [stats, turnaroundSubs, bloomsHw] = await Promise.all([
    buildClassStats(classIds, schoolId),
    prisma.submission.findMany({
      where:  { homework: { classId: { in: classIds } }, markedAt: { not: null } },
      select: { submittedAt: true, markedAt: true },
      take:   500,
    }),
    prisma.homework.findMany({
      where:  { classId: { in: classIds }, bloomsLevel: { not: null } },
      select: { bloomsLevel: true },
    }),
  ])

  // Turnaround — use updatedAt as proxy for submission date
  const turnaroundDays = turnaroundSubs
    .filter(s => s.markedAt)
    .map(s => (s.markedAt!.getTime() - s.submittedAt.getTime()) / (1000 * 60 * 60 * 24))
    .filter(d => d >= 0 && d < 90)
  const avgTurnaround = turnaroundDays.length > 0
    ? Math.round(turnaroundDays.reduce((a, b) => a + b, 0) / turnaroundDays.length * 10) / 10
    : null

  // Blooms
  const bloomsMap = new Map<string, number>()
  for (const h of bloomsHw) {
    if (h.bloomsLevel) bloomsMap.set(h.bloomsLevel, (bloomsMap.get(h.bloomsLevel) ?? 0) + 1)
  }
  const bloomsOrder = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create']
  const bloomsCoverage = bloomsOrder
    .filter(l => bloomsMap.has(l))
    .map(l => ({ level: l, count: bloomsMap.get(l)! }))

  const classRows: TeacherClassStat[] = classes.map(c => ({
    id:      c.id,
    name:    c.name,
    subject: c.subject,
    yearGroup: c.yearGroup,
    ...(stats.get(c.id) ?? { studentCount: 0, sendCount: 0, avgGrade: null, ungraded: 0, submissionRate: 0, homeworkSet30d: 0 }),
  }))

  const dept = classes[0]?.department ?? ''
  const allGrades = classRows.map(c => c.avgGrade).filter((g): g is number => g != null)

  return {
    teacher: { id: teacher.id, name: `${teacher.firstName} ${teacher.lastName}`, email: teacher.email, classCount: classes.length, department: dept },
    classes: classRows,
    totals: {
      classes:           classes.length,
      students:          classRows.reduce((s, c) => s + c.studentCount, 0),
      sendStudents:      classRows.reduce((s, c) => s + c.sendCount, 0),
      homeworkSet30d:    classRows.reduce((s, c) => s + c.homeworkSet30d, 0),
      ungraded:          classRows.reduce((s, c) => s + c.ungraded, 0),
      avgGrade:          allGrades.length > 0 ? Math.round(allGrades.reduce((a, b) => a + b, 0) / allGrades.length * 10) / 10 : null,
      avgTurnaroundDays: avgTurnaround,
    },
    bloomsCoverage,
  }
}

// ── Department list ───────────────────────────────────────────────────────────

export async function getDepartmentList(): Promise<string[]> {
  const { schoolId, role } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const classes = await prisma.schoolClass.findMany({
    where:  { schoolId },
    select: { department: true },
    distinct: ['department'],
  })
  return classes.map(c => c.department).sort()
}

// ── Department analytics ──────────────────────────────────────────────────────

export async function getDepartmentAnalytics(department?: string): Promise<DepartmentAnalyticsData> {
  const { schoolId, role, id: userId } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const dept = role === 'HEAD_OF_DEPT'
    ? (await getDeptForHod(schoolId, userId)) ?? department ?? ''
    : department ?? ''

  const departments = await getDepartmentList()

  const deptClasses = await prisma.schoolClass.findMany({
    where:  { schoolId, ...(dept ? { department: dept } : {}) },
    select: {
      id: true, name: true, subject: true, yearGroup: true, department: true,
      teachers: { select: { userId: true, user: { select: { id: true, firstName: true, lastName: true } } } },
    },
  })

  if (deptClasses.length === 0) {
    return {
      department:     dept || 'All departments',
      departments,
      teachers:       [],
      bloomsCoverage: [],
      totals:         { teachers: 0, classes: 0, students: 0, avgGrade: null, sendPct: 0, ungraded: 0 },
    }
  }

  const classIds = deptClasses.map(c => c.id)
  const [classStatsMap, bloomsHw] = await Promise.all([
    buildClassStats(classIds, schoolId),
    prisma.homework.findMany({
      where:  { classId: { in: classIds }, bloomsLevel: { not: null } },
      select: { bloomsLevel: true },
    }),
  ])

  // Group by teacher
  const teacherMap = new Map<string, { name: string; classIds: Set<string> }>()
  for (const cls of deptClasses) {
    for (const ct of cls.teachers) {
      if (!teacherMap.has(ct.userId)) {
        teacherMap.set(ct.userId, { name: `${ct.user.firstName} ${ct.user.lastName}`, classIds: new Set() })
      }
      teacherMap.get(ct.userId)!.classIds.add(cls.id)
    }
  }

  const teachers: DeptTeacherRow[] = [...teacherMap.entries()].map(([id, t]) => {
    const tClassIds = [...t.classIds]
    let students = 0, send = 0, ungraded = 0, hw30 = 0
    const grades: number[] = []

    for (const cid of tClassIds) {
      const s = classStatsMap.get(cid)
      if (!s) continue
      students += s.studentCount
      send     += s.sendCount
      ungraded += s.ungraded
      hw30     += s.homeworkSet30d
      if (s.avgGrade != null) grades.push(s.avgGrade)
    }

    return {
      id,
      name:           t.name,
      classCount:     t.classIds.size,
      studentCount:   students,
      sendCount:      send,
      avgGrade:       grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length * 10) / 10 : null,
      ungraded,
      submissionRate: 0,   // not meaningful cross-class; omit from dept view
      homeworkSet30d: hw30,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  // Blooms coverage
  const bloomsMap = new Map<string, number>()
  for (const h of bloomsHw) {
    if (h.bloomsLevel) bloomsMap.set(h.bloomsLevel, (bloomsMap.get(h.bloomsLevel) ?? 0) + 1)
  }
  const bloomsOrder = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create']
  const bloomsCoverage = bloomsOrder
    .filter(l => bloomsMap.has(l))
    .map(l => ({ level: l, count: bloomsMap.get(l)! }))

  const allGrades = teachers.map(t => t.avgGrade).filter((g): g is number => g != null)
  const totalStudents = teachers.reduce((s, t) => s + t.studentCount, 0)
  const totalSend     = teachers.reduce((s, t) => s + t.sendCount, 0)

  return {
    department:     dept || 'All departments',
    departments,
    teachers,
    bloomsCoverage,
    totals: {
      teachers:   teachers.length,
      classes:    deptClasses.length,
      students:   totalStudents,
      avgGrade:   allGrades.length > 0 ? Math.round(allGrades.reduce((a, b) => a + b, 0) / allGrades.length * 10) / 10 : null,
      sendPct:    totalStudents > 0 ? Math.round((totalSend / totalStudents) * 100) : 0,
      ungraded:   teachers.reduce((s, t) => s + t.ungraded, 0),
    },
  }
}

// ── School-wide staff overview (for SLT /slt/staff) ──────────────────────────

export type StaffOverviewRow = {
  id:             string
  name:           string
  email:          string
  department:     string
  classCount:     number
  studentCount:   number
  sendCount:      number
  avgGrade:       number | null   // 0–9 scale
  submissionRate: number          // 0–1
  homeworkSet30d: number
  turnaroundDays: number | null
}

export async function getStaffOverview(): Promise<StaffOverviewRow[]> {
  const { schoolId, role } = await requireAuth()
  if (!['SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  // All class-teacher links with class info
  const classTeachers = await prisma.classTeacher.findMany({
    where:  { class: { schoolId } },
    select: {
      userId: true,
      user:   { select: { id: true, firstName: true, lastName: true, email: true } },
      class:  { select: { id: true, department: true } },
    },
  })

  // Build teacher → classId map
  const teacherMap = new Map<string, {
    name: string; email: string; department: string; classIds: string[]
  }>()
  for (const ct of classTeachers) {
    if (!teacherMap.has(ct.userId)) {
      teacherMap.set(ct.userId, { name: `${ct.user.firstName} ${ct.user.lastName}`, email: ct.user.email, department: ct.class.department, classIds: [] })
    }
    teacherMap.get(ct.userId)!.classIds.push(ct.class.id)
  }

  const allClassIds = [...new Set(classTeachers.map(ct => ct.class.id))]

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Parallel data fetches
  const [enrolments, sendStatuses, latestAggs, submissions, homework30d] = await Promise.all([
    prisma.enrolment.findMany({ where: { classId: { in: allClassIds } }, select: { classId: true, userId: true } }),
    prisma.sendStatus.findMany({
      where:  { activeStatus: { not: 'NONE' }, student: { schoolId } },
      select: { studentId: true },
    }),
    prisma.classPerformanceAggregate.findMany({
      where:   { classId: { in: allClassIds } },
      orderBy: { updatedAt: 'desc' },
      select:  { classId: true, avgScore: true, completionRate: true },
    }),
    prisma.submission.findMany({
      where:   { homework: { classId: { in: allClassIds } }, markedAt: { not: null } },
      select:  { submittedAt: true, markedAt: true, homework: { select: { classId: true } } },
    }),
    prisma.homework.findMany({
      where:   { classId: { in: allClassIds }, createdAt: { gte: thirtyDaysAgo } },
      select:  { classId: true },
    }),
  ])

  // Build lookup maps
  const sendUserIds     = new Set(sendStatuses.map(s => s.studentId))
  const enrolByClass    = new Map<string, string[]>()
  for (const e of enrolments) {
    if (!enrolByClass.has(e.classId)) enrolByClass.set(e.classId, [])
    enrolByClass.get(e.classId)!.push(e.userId)
  }

  // Latest agg per class
  const latestAggMap = new Map<string, { avgScore: number; completionRate: number }>()
  for (const agg of latestAggs) {
    if (!latestAggMap.has(agg.classId)) latestAggMap.set(agg.classId, { avgScore: agg.avgScore, completionRate: agg.completionRate })
  }

  const hw30ByClass  = new Map<string, number>()
  for (const hw of homework30d) {
    hw30ByClass.set(hw.classId, (hw30ByClass.get(hw.classId) ?? 0) + 1)
  }

  // Turnaround per class (0-90 day filter)
  const turnaroundByClass = new Map<string, number[]>()
  for (const s of submissions) {
    const classId = s.homework.classId
    if (!s.markedAt) continue
    const days = (s.markedAt.getTime() - s.submittedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (days < 0 || days > 90) continue
    if (!turnaroundByClass.has(classId)) turnaroundByClass.set(classId, [])
    turnaroundByClass.get(classId)!.push(days)
  }

  const rows: StaffOverviewRow[] = []

  for (const [teacherId, t] of teacherMap.entries()) {
    const classIds = t.classIds

    let studentCount = 0; const studentIds = new Set<string>()
    let hw30 = 0
    const grades: number[] = []; const rates: number[] = []; const turnaround: number[] = []

    for (const classId of classIds) {
      const members = enrolByClass.get(classId) ?? []
      members.forEach(uid => studentIds.add(uid))

      const agg = latestAggMap.get(classId)
      if (agg) {
        if (agg.avgScore != null) grades.push(agg.avgScore)
        rates.push(agg.completionRate)
      }
      hw30 += hw30ByClass.get(classId) ?? 0
      const ta = turnaroundByClass.get(classId) ?? []
      turnaround.push(...ta)
    }
    studentCount = studentIds.size
    const sendCount = [...studentIds].filter(uid => sendUserIds.has(uid)).length

    rows.push({
      id:             teacherId,
      name:           t.name,
      email:          t.email,
      department:     t.department,
      classCount:     classIds.length,
      studentCount,
      sendCount,
      avgGrade:       grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length * 10) / 10 : null,
      submissionRate: rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length * 1000) / 1000 : 0,
      homeworkSet30d: hw30,
      turnaroundDays: turnaround.length > 0 ? Math.round(turnaround.reduce((a, b) => a + b, 0) / turnaround.length * 10) / 10 : null,
    })
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name))
}
