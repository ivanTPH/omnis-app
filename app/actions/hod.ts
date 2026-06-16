'use server'

import { requireAuth } from '@/lib/session'
import { prisma }      from '@/lib/prisma'
import { redirect }    from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

export type HodClassRow = {
  id:             string
  name:           string
  subject:        string
  yearGroup:      number
  studentCount:   number
  sendCount:      number
  teacherNames:   string[]
  teacherIds:     string[]
  avgScore:       number | null   // 0–9 GCSE scale
  completionRate: number | null   // 0–1
  ungradedCount:  number
  rag:            'green' | 'amber' | 'red' | null
}

export type HodStaffRow = {
  id:            string
  name:          string
  email:         string
  classCount:    number
  studentCount:  number
  ungradedCount: number
  avgScore:      number | null
}

export type HodDashboardData = {
  department:      string
  subjects:        string[]
  totalClasses:    number
  totalStudents:   number
  sendStudents:    number
  activeIlps:      number
  openConcerns:    number
  avgScore:        number | null
  avgCompletion:   number | null
  totalUngraded:   number
  classes:         HodClassRow[]
  staff:           HodStaffRow[]
}

export type HodCurriculumUnit = {
  unitSlug:      string
  unitTitle:     string
  keystage:      string
  yearGroup:     number | null
  totalLessons:  number
  usedLessons:   number
  coveragePct:   number
  usedSlugs:     string[]
}

export type HodCurriculumData = {
  department:  string
  subjects:    string[]
  units:       HodCurriculumUnit[]
  totalUsed:   number
  totalOak:    number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HOD_ALLOWED = ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN']

async function getDeptFromUser(schoolId: string, userId: string): Promise<string | null> {
  const ct = await prisma.classTeacher.findFirst({
    where:  { userId, class: { schoolId } },
    select: { class: { select: { department: true } } },
  })
  return ct?.class.department ?? null
}

// ── Dashboard action ───────────────────────────────────────────────────────────

export async function getHodDashboardData(): Promise<HodDashboardData> {
  const { schoolId, role, id: userId } = await requireAuth()
  if (!HOD_ALLOWED.includes(role)) redirect('/dashboard')

  const department = role === 'HEAD_OF_DEPT'
    ? await getDeptFromUser(schoolId, userId)
    : null  // SLT/ADMIN: caller must pass department

  const deptFilter = department ? { department } : {}

  const deptClasses = await prisma.schoolClass.findMany({
    where: { schoolId, ...deptFilter },
    include: {
      teachers:   { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      _count:     { select: { enrolments: true } },
    },
  })

  if (deptClasses.length === 0) {
    return {
      department:    department ?? 'Unknown',
      subjects:      [],
      totalClasses:  0,
      totalStudents: 0,
      sendStudents:  0,
      activeIlps:    0,
      openConcerns:  0,
      avgScore:      null,
      avgCompletion: null,
      totalUngraded: 0,
      classes:       [],
      staff:         [],
    }
  }

  const classIds   = deptClasses.map(c => c.id)
  const resolvedDept = department ?? (deptClasses[0]?.department ?? 'Department')
  const subjects   = [...new Set(deptClasses.map(c => c.subject).filter(Boolean))].sort()

  // Latest perf aggregates
  const allAggs = await prisma.classPerformanceAggregate.findMany({
    where:   { classId: { in: classIds } },
    orderBy: { termId: 'desc' },
  })
  const aggByClass = new Map<string, typeof allAggs[0]>()
  for (const a of allAggs) { if (!aggByClass.has(a.classId)) aggByClass.set(a.classId, a) }

  // Enrolled students
  const enrolments = await prisma.enrolment.findMany({
    where:  { classId: { in: classIds } },
    select: { classId: true, userId: true },
  })
  const studentIdsByClass = new Map<string, Set<string>>()
  const allStudentIds     = new Set<string>()
  for (const e of enrolments) {
    if (!studentIdsByClass.has(e.classId)) studentIdsByClass.set(e.classId, new Set())
    studentIdsByClass.get(e.classId)!.add(e.userId)
    allStudentIds.add(e.userId)
  }
  const studentIdArr = [...allStudentIds]

  // SEND + ILP + concerns
  const [sendStatuses, ilpCount, concernCount, ungradedSubs] = await Promise.all([
    prisma.sendStatus.findMany({
      where:  { studentId: { in: studentIdArr }, NOT: { activeStatus: 'NONE' } },
      select: { studentId: true },
    }),
    prisma.individualLearningPlan.count({
      where: { schoolId, studentId: { in: studentIdArr }, status: 'active' },
    }),
    prisma.sendConcern.count({
      where: { schoolId, studentId: { in: studentIdArr }, status: { notIn: ['closed', 'no_action'] } },
    }),
    prisma.submission.findMany({
      where: {
        homework: { classId: { in: classIds } },
        status:   { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        teacherScore: null,
        autoScore:    null,
      },
      select: { homeworkId: true, homework: { select: { classId: true, createdBy: true } } },
    }),
  ])

  const sendStudentSet = new Set(sendStatuses.map(s => s.studentId))

  // Ungraded per class
  const ungradedByClass = new Map<string, number>()
  for (const sub of ungradedSubs) {
    const cid = sub.homework.classId
    ungradedByClass.set(cid, (ungradedByClass.get(cid) ?? 0) + 1)
  }

  // Build class rows
  const classes: HodClassRow[] = deptClasses.map(cls => {
    const agg        = aggByClass.get(cls.id)
    const stuSet     = studentIdsByClass.get(cls.id) ?? new Set()
    const sendCount  = [...stuSet].filter(id => sendStudentSet.has(id)).length
    const teacherNames = cls.teachers.map(t => `${t.user.firstName} ${t.user.lastName}`)
    const avgScore   = agg?.avgScore ?? null
    const comp       = agg?.completionRate ?? null

    let rag: 'green' | 'amber' | 'red' | null = null
    if (avgScore != null) {
      if (avgScore >= 5.5) rag = 'green'
      else if (avgScore >= 4) rag = 'amber'
      else rag = 'red'
    }

    return {
      id:             cls.id,
      name:           cls.name,
      subject:        cls.subject,
      yearGroup:      cls.yearGroup,
      studentCount:   stuSet.size,
      sendCount,
      teacherNames,
      teacherIds:     cls.teachers.map(t => t.user.id),
      avgScore,
      completionRate: comp,
      ungradedCount:  ungradedByClass.get(cls.id) ?? 0,
      rag,
    }
  }).sort((a, b) => a.yearGroup - b.yearGroup || a.name.localeCompare(b.name))

  // Build staff rows
  const staffMap = new Map<string, {
    id: string; name: string; email: string
    classIds: Set<string>; studentIds: Set<string>
    scores: number[]
  }>()

  for (const cls of deptClasses) {
    const stuSet = studentIdsByClass.get(cls.id) ?? new Set()
    for (const ct of cls.teachers) {
      const u = ct.user
      if (!staffMap.has(u.id)) {
        staffMap.set(u.id, { id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email, classIds: new Set(), studentIds: new Set(), scores: [] })
      }
      const entry = staffMap.get(u.id)!
      entry.classIds.add(cls.id)
      for (const sid of stuSet) entry.studentIds.add(sid)
      const agg = aggByClass.get(cls.id)
      if (agg?.avgScore != null) entry.scores.push(agg.avgScore)
    }
  }

  const ungradedByTeacher = new Map<string, number>()
  for (const sub of ungradedSubs) {
    const createdBy = sub.homework.createdBy
    ungradedByTeacher.set(createdBy, (ungradedByTeacher.get(createdBy) ?? 0) + 1)
  }

  const staff: HodStaffRow[] = [...staffMap.values()].map(s => ({
    id:            s.id,
    name:          s.name,
    email:         s.email,
    classCount:    s.classIds.size,
    studentCount:  s.studentIds.size,
    ungradedCount: ungradedByTeacher.get(s.id) ?? 0,
    avgScore:      s.scores.length > 0 ? s.scores.reduce((a, b) => a + b, 0) / s.scores.length : null,
  })).sort((a, b) => a.name.localeCompare(b.name))

  // School-wide averages
  const aggs        = classes.map(c => aggByClass.get(c.id)).filter(Boolean) as typeof allAggs
  const avgScore    = aggs.length > 0 ? aggs.reduce((s, a) => s + a.avgScore, 0) / aggs.length : null
  const avgCompletion = aggs.length > 0 ? aggs.reduce((s, a) => s + a.completionRate, 0) / aggs.length : null

  return {
    department:    resolvedDept,
    subjects,
    totalClasses:  deptClasses.length,
    totalStudents: allStudentIds.size,
    sendStudents:  sendStudentSet.size,
    activeIlps:    ilpCount,
    openConcerns:  concernCount,
    avgScore,
    avgCompletion,
    totalUngraded: ungradedSubs.length,
    classes,
    staff,
  }
}

// ── Curriculum map action ──────────────────────────────────────────────────────

export async function getHodCurriculumData(): Promise<HodCurriculumData> {
  const { schoolId, role, id: userId } = await requireAuth()
  if (!HOD_ALLOWED.includes(role)) redirect('/dashboard')

  const department = role === 'HEAD_OF_DEPT'
    ? await getDeptFromUser(schoolId, userId)
    : null

  const deptFilter = department ? { department } : {}

  const deptClasses = await prisma.schoolClass.findMany({
    where:  { schoolId, ...deptFilter },
    select: { id: true, subject: true },
  })

  const classIds = deptClasses.map(c => c.id)
  const subjects = [...new Set(deptClasses.map(c => c.subject).filter(Boolean))]
  const resolvedDept = department ?? 'Department'

  if (subjects.length === 0) {
    return { department: resolvedDept, subjects: [], units: [], totalUsed: 0, totalOak: 0 }
  }

  // Map subject names to Oak subject slugs (simple lowercase mapping)
  const subjectSlugs = subjects.map(s =>
    s.toLowerCase()
     .replace('mathematics', 'maths')
     .replace('english language', 'english')
     .replace('english literature', 'english')
     .replace('physical education', 'physical-education')
     .replace(/ /g, '-')
  )

  // Oak lessons used by resources in lessons taught by these classes
  const usedResources = await prisma.resource.findMany({
    where: {
      schoolId,
      lesson: { classId: { in: classIds } },
      oakContentId: { not: null },
    },
    select: { oakContentId: true },
  })
  const usedOakSlugs = new Set(usedResources.map(r => r.oakContentId!))

  // All Oak units + lessons for these subjects
  const oakUnits = await prisma.oakUnit.findMany({
    where:   { subjectSlug: { in: subjectSlugs } },
    include: { lessons: { select: { slug: true, title: true } } },
    orderBy: [{ keystage: 'asc' }, { yearGroup: 'asc' }, { title: 'asc' }],
  })

  const units: HodCurriculumUnit[] = oakUnits
    .filter(u => u.lessons.length > 0)
    .map(u => {
      const usedInUnit = u.lessons.filter(l => usedOakSlugs.has(l.slug))
      const pct = u.lessons.length > 0
        ? Math.round((usedInUnit.length / u.lessons.length) * 100)
        : 0
      return {
        unitSlug:     u.slug,
        unitTitle:    u.title,
        keystage:     u.keystage,
        yearGroup:    u.yearGroup,
        totalLessons: u.lessons.length,
        usedLessons:  usedInUnit.length,
        coveragePct:  pct,
        usedSlugs:    usedInUnit.map(l => l.slug),
      }
    })

  const totalOak  = units.reduce((s, u) => s + u.totalLessons, 0)
  const totalUsed = units.reduce((s, u) => s + u.usedLessons, 0)

  return { department: resolvedDept, subjects: subjects.sort(), units, totalUsed, totalOak }
}

// ── Per-class student breakdown ───────────────────────────────────────────────

export type HodStudentRow = {
  id:            string
  firstName:     string
  lastName:      string
  avgScore:      number | null   // 0–9 scale, from last 5 submissions
  lateCount:     number          // submissions after dueAt
  sendStatus:    string | null
}

export type HodClassDetail = {
  classId:    string
  className:  string
  subject:    string
  yearGroup:  number
  students:   HodStudentRow[]
}

export async function getHodClassDetail(classId: string): Promise<HodClassDetail | null> {
  const { schoolId, role } = await requireAuth()
  if (!HOD_ALLOWED.includes(role)) redirect('/dashboard')

  const cls = await prisma.schoolClass.findFirst({
    where:  { id: classId, schoolId },
    select: { id: true, name: true, subject: true, yearGroup: true },
  })
  if (!cls) return null

  const enrolments = await prisma.enrolment.findMany({
    where:  { classId, user: { schoolId, role: 'STUDENT', isActive: true } },
    select: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ user: { lastName: 'asc' } }],
  })

  const studentIds = enrolments.map(e => e.user.id)
  if (studentIds.length === 0) {
    return { classId, className: cls.name, subject: cls.subject, yearGroup: cls.yearGroup, students: [] }
  }

  // Last 5 submissions per student for this class
  const submissions = await prisma.submission.findMany({
    where: {
      studentId: { in: studentIds },
      homework:  { classId, status: 'CLOSED' },
      status:    'RETURNED',
    },
    select: {
      studentId: true,
      finalScore: true,
      teacherScore: true,
      submittedAt: true,
      homework: { select: { dueAt: true } },
    },
    orderBy: { submittedAt: 'desc' },
  })

  // Group last 5 per student; compute avg + late count
  const subsByStudent = new Map<string, typeof submissions>()
  for (const s of submissions) {
    if (!subsByStudent.has(s.studentId)) subsByStudent.set(s.studentId, [])
    const arr = subsByStudent.get(s.studentId)!
    if (arr.length < 5) arr.push(s)
  }

  // SEND statuses
  const sendRecords = await prisma.sendStatus.findMany({
    where:  { studentId: { in: studentIds } },
    select: { studentId: true, activeStatus: true },
  })
  const sendMap = new Map(sendRecords.map(s => [s.studentId, s.activeStatus]))

  const students: HodStudentRow[] = enrolments.map(e => {
    const u    = e.user
    const subs = subsByStudent.get(u.id) ?? []
    const scores = subs
      .map(s => s.finalScore ?? s.teacherScore)
      .filter((v): v is number => v != null)
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
    const lateCount = subs.filter(s =>
      s.submittedAt && s.homework.dueAt && new Date(s.submittedAt) > new Date(s.homework.dueAt)
    ).length
    const ss = sendMap.get(u.id)
    return {
      id:         u.id,
      firstName:  u.firstName,
      lastName:   u.lastName,
      avgScore:   avgScore != null ? Math.round(avgScore * 10) / 10 : null,
      lateCount,
      sendStatus: (ss && ss !== 'NONE') ? ss : null,
    }
  })

  return { classId, className: cls.name, subject: cls.subject, yearGroup: cls.yearGroup, students }
}
