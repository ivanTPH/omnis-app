'use server'
import { auth }         from '@/lib/auth'
import { prisma }       from '@/lib/prisma'
import { redirect }     from 'next/navigation'
import { analyseClassPerformance, type ClassPerformanceAnalysis } from '@/lib/revision/analysis-engine'
import { generateRevisionTask } from '@/lib/revision/content-generator'
import type { TestQuestion, TestAnswer, TestResults } from '@/lib/revision/test-engine'

// ── helpers ───────────────────────────────────────────────────────────────────

async function requireStaff() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any
  const staffRoles = ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SENCO','SLT','SCHOOL_ADMIN','SUPER_ADMIN']
  if (!staffRoles.includes(user.role)) redirect('/student/dashboard')
  return user as { id: string; schoolId: string; role: string }
}

async function requireTeacherOrAbove() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any
  const allowed = ['TEACHER','HEAD_OF_DEPT','SLT','SCHOOL_ADMIN','SUPER_ADMIN']
  if (!allowed.includes(user.role)) redirect('/dashboard')
  return user as { id: string; schoolId: string; role: string }
}

// ── getClassPerformanceAnalysis ───────────────────────────────────────────────

export async function getClassPerformanceAnalysis(
  classId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<ClassPerformanceAnalysis> {
  try {
    const user = await requireStaff()

    // Check cache first
    const cached = await (prisma as any).revisionAnalyticsCache.findFirst({
      where: {
        classId,
        schoolId:    user.schoolId,
        periodStart: { gte: new Date(periodStart.getTime() - 1000) },
        periodEnd:   { lte: new Date(periodEnd.getTime()   + 1000) },
        expiresAt:   { gt: new Date() },
      },
      orderBy: { generatedAt: 'desc' },
    })

    if (cached) return cached.analysis as unknown as ClassPerformanceAnalysis

    const analysis = await analyseClassPerformance(classId, user.schoolId, periodStart, periodEnd, prisma)

    // Fetch subject from class for cache
    const schoolClass = await (prisma as any).schoolClass.findFirst({
      where: { id: classId, schoolId: user.schoolId },
      select: { subject: true },
    })

    try {
      await (prisma as any).revisionAnalyticsCache.create({
        data: {
          schoolId:    user.schoolId,
          classId,
          subject:     schoolClass?.subject ?? '',
          periodStart,
          periodEnd,
          analysis:    analysis as any,
          expiresAt:   new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    } catch (cacheErr) {
      console.error('[getClassPerformanceAnalysis] cache write failed:', cacheErr)
    }

    return analysis
  } catch (err) {
    console.error('[getClassPerformanceAnalysis] error:', err)
    return {
      classId,
      subject: '',
      periodStart,
      periodEnd,
      topicsCovered: [],
      topicPerformance: [],
      studentAnalysis: [],
      classAvgScore: 0,
      overallSubmissionRate: 0,
      topicsNeedingRevision: [],
      topicsToSkip: [],
    }
  }
}

// ── createRevisionProgram ─────────────────────────────────────────────────────

export async function createRevisionProgram(input: {
  classId:          string
  title:            string
  subject:          string
  periodStart:      Date
  periodEnd:        Date
  mode:             'study_guide' | 'formal_assignment'
  deadline?:        Date
  durationWeeks:    number
  overrideTaskType?: string
}): Promise<{ programId: string; taskCount: number }> {
  try {
    const user = await requireTeacherOrAbove()

    // Rate limit: max 3 programs per class per week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentCount = await (prisma as any).revisionProgram.count({
      where: { classId: input.classId, schoolId: user.schoolId, createdAt: { gte: oneWeekAgo } },
    })
    if (recentCount >= 3) {
      throw new Error('Rate limit: maximum 3 revision programs per class per week')
    }

    // Get class info
    const schoolClass = await (prisma as any).schoolClass.findFirst({
      where: { id: input.classId, schoolId: user.schoolId },
      include: { enrolments: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
    })
    if (!schoolClass) throw new Error('Class not found')

    const enrolledStudents = schoolClass.enrolments.map((e: any) => e.user).slice(0, 30)
    if (enrolledStudents.length === 0) throw new Error('No students enrolled in this class')

    // Get performance analysis
    const analysis = await analyseClassPerformance(
      input.classId, user.schoolId, input.periodStart, input.periodEnd, prisma,
    )

    // Fetch ALL lessons taught in the period for multi-topic question coverage
    const periodLessons: { title: string; objectives: string[] }[] = await (prisma as any).lesson.findMany({
      where: {
        classId:  input.classId,
        schoolId: user.schoolId,
        startsAt: { gte: input.periodStart, lte: input.periodEnd },
      },
      orderBy: { startsAt: 'asc' },
      select: { title: true, objectives: true },
    })
    const recentLesson = periodLessons.length > 0 ? periodLessons[periodLessons.length - 1] : null

    // Batch AI generation — max 5 concurrent
    const taskInputs = enrolledStudents.map((student: any) => {
      const studentAnalysis = analysis.studentAnalysis.find(s => s.studentId === student.id)
      return {
        student,
        weakTopics:      studentAnalysis?.weakTopics ?? analysis.topicsNeedingRevision,
        strongTopics:    studentAnalysis?.strongTopics ?? analysis.topicsToSkip,
        taskType:        input.overrideTaskType ?? studentAnalysis?.recommendedTaskType ?? 'retrieval_practice',
        sendAdaptations: studentAnalysis?.sendAdaptations ?? [],
        ilpTargets:      studentAnalysis?.ilpTargetsDue ?? [],
      }
    })

    const generated: { studentId: string; content: Awaited<ReturnType<typeof generateRevisionTask>> }[] = []

    for (let i = 0; i < taskInputs.length; i += 5) {
      const batch = taskInputs.slice(i, i + 5)
      const results = await Promise.all(
        batch.map(async (t: any) => {
          const content = await generateRevisionTask({
            studentId:       t.student.id,
            studentName:     `${t.student.firstName} ${t.student.lastName}`,
            subject:         input.subject,
            yearGroup:       schoolClass.yearGroup,
            weakTopics:      t.weakTopics,
            strongTopics:    t.strongTopics,
            taskType:        t.taskType,
            sendAdaptations: t.sendAdaptations,
            ilpTargets:      t.ilpTargets,
            durationMins:    input.durationWeeks * 30,
            lessonTitle:     recentLesson?.title,
            objectives:      recentLesson?.objectives ?? [],
            allLessons:      periodLessons,
          })
          return { studentId: t.student.id, content }
        }),
      )
      generated.push(...results)
    }

    // Save in transaction
    const result = await prisma.$transaction(async tx => {
      const program = await (tx as any).revisionProgram.create({
        data: {
          schoolId:     user.schoolId,
          classId:      input.classId,
          createdBy:    user.id,
          title:        input.title,
          subject:      input.subject,
          yearGroup:    schoolClass.yearGroup,
          periodStart:  input.periodStart,
          periodEnd:    input.periodEnd,
          topics:       analysis.topicsNeedingRevision,
          mode:         input.mode,
          deadline:     input.deadline,
          durationWeeks: input.durationWeeks,
          status:       'draft',
          aiAnalysis:   analysis as any,
        },
      })

      const taskData = generated.map(g => {
        const ti = taskInputs.find((t: any) => t.student.id === g.studentId)!
        return {
          programId:        program.id,
          studentId:        g.studentId,
          schoolId:         user.schoolId,
          focusTopics:      ti.weakTopics,
          taskType:         ti.taskType,
          structuredContent: g.content.structuredContent as any,
          instructions:     g.content.instructions,
          modelAnswer:      g.content.modelAnswer,
          weakTopics:       ti.weakTopics,
          strongTopics:     ti.strongTopics,
          sendAdaptations:  ti.sendAdaptations,
          ilpTargetIds:     [] as string[],
          estimatedMins:    input.durationWeeks * 30,
        }
      })

      await (tx as any).revisionTask.createMany({ data: taskData })

      return { programId: program.id, taskCount: taskData.length }
    })

    // Notify students for formal assignments
    if (input.mode === 'formal_assignment') {
      try {
        await prisma.notification.createMany({
          data: enrolledStudents.map((s: any) => ({
            userId:   s.id,
            schoolId: user.schoolId,
            type:     'HOMEWORK_REMINDER',
            title:    `New Revision Assignment: ${input.title}`,
            body:     input.deadline
              ? `Due ${new Date(input.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
              : 'Please complete when ready.',
            linkHref: '/student/dashboard',
            read:     false,
          })),
        })
      } catch (notifyErr) {
        console.error('[createRevisionProgram] notification failed:', notifyErr)
      }
    }

    return result
  } catch (err) {
    console.error('[createRevisionProgram] error:', err)
    throw err
  }
}

// ── getRevisionPrograms ───────────────────────────────────────────────────────

export async function getRevisionPrograms(classId?: string): Promise<{
  id: string
  title: string
  subject: string
  status: string
  mode: string
  classId: string | null
  programType: string
  createdAt: Date
  taskCount: number
  completedCount: number
}[]> {
  try {
    const user = await requireStaff()

    const where: any = { schoolId: user.schoolId }
    if (classId) where.classId = classId
    if (user.role === 'TEACHER') where.createdBy = user.id

    const programs = await (prisma as any).revisionProgram.findMany({
      where,
      include: { tasks: { select: { id: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return programs.map((p: any) => ({
      id:             p.id,
      title:          p.title,
      subject:        p.subject,
      status:         p.status,
      mode:           p.mode,
      classId:        p.classId ?? null,
      programType:    p.programType ?? 'class',
      createdAt:      p.createdAt,
      taskCount:      p.tasks.length,
      completedCount: p.tasks.filter((t: any) => ['submitted', 'marked', 'returned'].includes(t.status)).length,
    }))
  } catch (err) {
    console.error('[getRevisionPrograms] error:', err)
    return []
  }
}

// ── getRevisionProgramDetail ──────────────────────────────────────────────────

export async function getRevisionProgramDetail(programId: string): Promise<{
  program: any
  tasks: any[]
  completionStats: { total: number; notStarted: number; inProgress: number; submitted: number; marked: number }
} | null> {
  try {
    const user = await requireStaff()

    const program = await (prisma as any).revisionProgram.findFirst({
      where: { id: programId, schoolId: user.schoolId },
      include: { tasks: { orderBy: { studentId: 'asc' } } },
    })
    if (!program) return null

    const adminRoles = ['SLT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']
    if (!adminRoles.includes(user.role) && program.createdBy !== user.id) return null

    const tasks = program.tasks
    const completionStats = {
      total:      tasks.length,
      notStarted: tasks.filter((t: any) => t.status === 'not_started').length,
      inProgress: tasks.filter((t: any) => t.status === 'in_progress').length,
      submitted:  tasks.filter((t: any) => t.status === 'submitted').length,
      marked:     tasks.filter((t: any) => ['marked', 'returned'].includes(t.status)).length,
    }

    return { program, tasks, completionStats }
  } catch (err) {
    console.error('[getRevisionProgramDetail] error:', err)
    return null
  }
}

// ── submitRevisionTask ────────────────────────────────────────────────────────

export async function submitRevisionTask(
  taskId: string,
  response: object,
  timeSpentMins?: number,
): Promise<void> {
  try {
    const session = await auth()
    if (!session) redirect('/login')
    const user = session.user as any

    const task = await (prisma as any).revisionTask.findFirst({
      where: { id: taskId, schoolId: user.schoolId, studentId: user.id },
    })
    if (!task) throw new Error('Task not found or not authorised')

    const program = await (prisma as any).revisionProgram.findFirst({ where: { id: task.programId } })

    await (prisma as any).revisionTask.update({
      where: { id: taskId },
      data: {
        studentResponse: response as any,
        submittedAt:     new Date(),
        timeSpentMins:   timeSpentMins ?? null,
        status:          'submitted',
      },
    })

    if (program?.mode === 'study_guide') {
      await (prisma as any).revisionTask.update({
        where: { id: taskId },
        data: { completedAt: new Date() },
      })
    }
  } catch (err) {
    console.error('[submitRevisionTask] error:', err)
    throw err
  }
}

// ── selfAssessRevisionTask ────────────────────────────────────────────────────

export async function selfAssessRevisionTask(
  taskId: string,
  confidence: number,
): Promise<void> {
  try {
    const session = await auth()
    if (!session) redirect('/login')
    const user = session.user as any

    const task = await (prisma as any).revisionTask.findFirst({
      where: { id: taskId, schoolId: user.schoolId, studentId: user.id },
      include: { program: { select: { subject: true } } },
    })
    if (!task) throw new Error('Task not found')

    await (prisma as any).revisionTask.update({
      where: { id: taskId },
      data: { selfConfidence: Math.min(5, Math.max(1, confidence)) },
    })

    // Update RevisionProgress for each focus topic
    for (const topic of task.focusTopics) {
      try {
        await (prisma as any).revisionProgress.upsert({
          where: { studentId_subject_topic: { studentId: user.id, subject: task.program.subject, topic } },
          create: {
            studentId:      user.id,
            schoolId:       user.schoolId,
            subject:        task.program.subject,
            topic,
            confidenceLevel: confidence,
            lastRevisedAt:  new Date(),
            nextReviewAt:   new Date(Date.now() + confidence * 3 * 24 * 60 * 60 * 1000),
          },
          update: {
            confidenceLevel: confidence,
            lastRevisedAt:  new Date(),
            nextReviewAt:   new Date(Date.now() + confidence * 3 * 24 * 60 * 60 * 1000),
          },
        })
      } catch (progressErr) {
        console.error('[selfAssessRevisionTask] progress upsert failed for topic:', topic, progressErr)
      }
    }
  } catch (err) {
    console.error('[selfAssessRevisionTask] error:', err)
    throw err
  }
}

// ── markRevisionTask ──────────────────────────────────────────────────────────

export async function markRevisionTask(
  taskId: string,
  teacherScore: number,
  feedback: string,
): Promise<void> {
  try {
    const user = await requireTeacherOrAbove()

    const task = await (prisma as any).revisionTask.findFirst({
      where: { id: taskId, schoolId: user.schoolId },
      include: { program: { select: { subject: true, createdBy: true } } },
    })
    if (!task) throw new Error('Task not found')

    const adminRoles = ['SLT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'HEAD_OF_DEPT']
    if (!adminRoles.includes(user.role) && task.program.createdBy !== user.id) {
      throw new Error('Not authorised to mark this task')
    }

    await (prisma as any).revisionTask.update({
      where: { id: taskId },
      data: {
        teacherScore,
        finalScore:  teacherScore,
        feedback,
        markedAt:    new Date(),
        status:      'returned',
      },
    })

    // Update RevisionProgress with post-revision score
    for (const topic of task.focusTopics) {
      try {
        await (prisma as any).revisionProgress.upsert({
          where: { studentId_subject_topic: { studentId: task.studentId, subject: task.program.subject, topic } },
          create: {
            studentId:      task.studentId,
            schoolId:       user.schoolId,
            subject:        task.program.subject,
            topic,
            postRevisionAvg: teacherScore,
            lastRevisedAt:  new Date(),
          },
          update: {
            postRevisionAvg: teacherScore,
            lastRevisedAt:  new Date(),
          },
        })
      } catch (progressErr) {
        console.error('[markRevisionTask] progress upsert failed for topic:', topic, progressErr)
      }
    }
  } catch (err) {
    console.error('[markRevisionTask] error:', err)
    throw err
  }
}

// ── getStudentRevisionTasks ───────────────────────────────────────────────────

export async function getStudentRevisionTasks(studentId?: string): Promise<{
  active:    any[]
  completed: any[]
  upcoming:  any[]
}> {
  try {
    const session = await auth()
    if (!session) redirect('/login')
    const user = session.user as any

    let targetStudentId = studentId ?? user.id

    // Students can only see own tasks
    if (user.role === 'STUDENT') targetStudentId = user.id

    // Parents: verify this is their child — simple school-scoped check
    if (user.role === 'PARENT' && studentId) {
      const link = await prisma.parentChildLink.findFirst({
        where: { parentId: user.id, childId: studentId },
      })
      if (!link) throw new Error('Not authorised')
    }

    const tasks = await (prisma as any).revisionTask.findMany({
      where: { studentId: targetStudentId, schoolId: user.schoolId },
      include: { program: { select: { title: true, subject: true, mode: true, deadline: true } } },
      orderBy: { program: { deadline: 'asc' } },
    })

    return {
      active:    tasks.filter((t: any) => ['in_progress', 'not_started'].includes(t.status)),
      completed: tasks.filter((t: any) => ['submitted', 'marked', 'returned'].includes(t.status)),
      upcoming:  [],
    }
  } catch (err) {
    console.error('[getStudentRevisionTasks] error:', err)
    return { active: [], completed: [], upcoming: [] }
  }
}

// ── getTeacherSubjectsYearGroups ───────────────────────────────────────────────

export async function getTeacherSubjectsYearGroups(): Promise<
  { subject: string; yearGroup: number; classCount: number }[]
> {
  try {
    const user = await requireTeacherOrAbove()

    const classes = await prisma.schoolClass.findMany({
      where: {
        schoolId: user.schoolId,
        ...(user.role === 'TEACHER' || user.role === 'HEAD_OF_DEPT'
          ? { teachers: { some: { userId: user.id } } }
          : {}),
      },
      select: { subject: true, yearGroup: true },
    })

    // Deduplicate, keeping count
    const map = new Map<string, { subject: string; yearGroup: number; classCount: number }>()
    for (const c of classes) {
      const key = `${c.subject}|${c.yearGroup}`
      if (!map.has(key)) map.set(key, { subject: c.subject, yearGroup: c.yearGroup, classCount: 0 })
      map.get(key)!.classCount++
    }

    return [...map.values()].sort((a, b) =>
      a.subject.localeCompare(b.subject) || a.yearGroup - b.yearGroup
    )
  } catch (err) {
    console.error('[getTeacherSubjectsYearGroups] error:', err)
    return []
  }
}

// ── getYearTopics ──────────────────────────────────────────────────────────────

export async function getYearTopics(
  subject: string,
  yearGroup: number,
): Promise<{ topics: string[]; studentCount: number; classIds: string[] }> {
  try {
    const user = await requireTeacherOrAbove()

    // Academic year start: Sep 1 of current or last calendar year
    const now      = new Date()
    const yearStart = now.getMonth() >= 8
      ? new Date(now.getFullYear(), 8, 1)
      : new Date(now.getFullYear() - 1, 8, 1)

    // All classes for this subject + year group in the school
    const classes = await prisma.schoolClass.findMany({
      where:   { schoolId: user.schoolId, subject, yearGroup },
      select:  { id: true },
    })
    const classIds = classes.map(c => c.id)
    if (classIds.length === 0) return { topics: [], studentCount: 0, classIds: [] }

    // Past lessons in those classes since academic year start
    const lessons = await prisma.lesson.findMany({
      where: {
        schoolId: user.schoolId,
        classId:  { in: classIds },
        scheduledAt: { gte: yearStart, lte: now },
      },
      select: { title: true },
    })

    const topics = [...new Set(
      lessons.map(l => l.title?.trim()).filter((t): t is string => !!t && t.length > 0)
    )].sort()

    // Count distinct enrolled students across all these classes
    const enrolments = await prisma.enrolment.findMany({
      where:    { classId: { in: classIds } },
      select:   { userId: true },
      distinct: ['userId'],
    })

    return { topics, studentCount: enrolments.length, classIds }
  } catch (err) {
    console.error('[getYearTopics] error:', err)
    return { topics: [], studentCount: 0, classIds: [] }
  }
}

// ── createYearRevisionProgram ─────────────────────────────────────────────────

export async function createYearRevisionProgram(input: {
  subject:      string
  yearGroup:    number
  classIds:     string[]
  selectedTopics: string[]
  title:        string
  mode:         'study_guide' | 'formal_assignment'
  deadline?:    Date
}): Promise<{ programId: string; taskCount: number }> {
  try {
    const user = await requireTeacherOrAbove()
    const { generateYearRevisionTask } = await import('@/lib/revision/content-generator')

    // Academic year window
    const now      = new Date()
    const yearStart = now.getMonth() >= 8
      ? new Date(now.getFullYear(), 8, 1)
      : new Date(now.getFullYear() - 1, 8, 1)

    // Deduplicated students across all year-group classes
    const enrolments = await prisma.enrolment.findMany({
      where:    { classId: { in: input.classIds }, class: { schoolId: user.schoolId } },
      select:   { userId: true, user: { select: { id: true, firstName: true, lastName: true } } },
      distinct: ['userId'],
    })
    const students = enrolments.map(e => e.user)
    if (students.length === 0) throw new Error('No students found for this year group and subject')

    // Per-student scores per topic (from submissions linked to lessons with those titles)
    const lessons = await prisma.lesson.findMany({
      where: {
        schoolId: user.schoolId,
        classId:  { in: input.classIds },
        title:    { in: input.selectedTopics },
        scheduledAt: { gte: yearStart, lte: now },
      },
      select: { id: true, title: true, homework: { select: { id: true } } },
    })

    const homeworkIds = lessons.flatMap(l => l.homework.map((h: any) => h.id))
    const topicByHw   = new Map<string, string>()
    for (const l of lessons) {
      for (const h of l.homework as any[]) topicByHw.set(h.id, l.title!)
    }

    const allSubmissions = homeworkIds.length > 0
      ? await prisma.submission.findMany({
          where: {
            homeworkId: { in: homeworkIds },
            studentId:  { in: students.map(s => s.id) },
            finalScore: { not: null },
            status:     { in: ['MARKED', 'RETURNED'] },
          },
          select: { studentId: true, homeworkId: true, finalScore: true },
        })
      : []

    // Compute per-student topic averages + class averages
    const topicScores = new Map<string, number[]>()   // topic → all scores
    const studentTopicScores = new Map<string, Map<string, number[]>>() // studentId → topic → scores

    for (const sub of allSubmissions) {
      const topic = topicByHw.get(sub.homeworkId)
      if (!topic || sub.finalScore == null) continue
      if (!topicScores.has(topic)) topicScores.set(topic, [])
      topicScores.get(topic)!.push(sub.finalScore)

      if (!studentTopicScores.has(sub.studentId)) studentTopicScores.set(sub.studentId, new Map())
      const sm = studentTopicScores.get(sub.studentId)!
      if (!sm.has(topic)) sm.set(topic, [])
      sm.get(topic)!.push(sub.finalScore)
    }

    const classAvgByTopic = new Map<string, number>()
    for (const [topic, scores] of topicScores) {
      classAvgByTopic.set(topic, scores.reduce((a, b) => a + b, 0) / scores.length)
    }

    // SEND status per student
    const sendStatuses = await prisma.sendStatus.findMany({
      where: { studentId: { in: students.map(s => s.id) } },
      select: { studentId: true, activeStatus: true },
    })
    const sendMap = new Map(sendStatuses.map(s => [s.studentId, s.activeStatus]))

    // TeacherPredictions per student for this subject (for predicted grade comparison)
    const predictions = await (prisma as any).teacherPrediction.findMany({
      where: {
        schoolId:  user.schoolId,
        studentId: { in: students.map(s => s.id) },
        subject:   input.subject,
      },
      select: { studentId: true, predictedScore: true, adjustment: true },
    })
    const predMap = new Map(predictions.map((p: any) => [
      p.studentId,
      p.predictedScore + p.adjustment,
    ]))

    // Generate tasks in batches of 5
    const generated: { studentId: string; content: any }[] = []

    for (let i = 0; i < students.length; i += 5) {
      const batch = students.slice(i, i + 5)
      const results = await Promise.all(batch.map(async student => {
        const sm         = studentTopicScores.get(student.id) ?? new Map<string, number[]>()
        const predicted  = predMap.get(student.id) as number | undefined
        const sendStatus = sendMap.get(student.id)
        const isSend     = !!sendStatus && sendStatus !== 'NONE'

        // Focus topics: below class avg OR below predicted grade threshold
        const focusTopics = input.selectedTopics.filter(topic => {
          const classAvg    = classAvgByTopic.get(topic)
          const studentScrs = sm.get(topic)
          if (!studentScrs || studentScrs.length === 0) return false
          const studentAvg  = studentScrs.reduce((a, b) => a + b, 0) / studentScrs.length
          if (classAvg != null && studentAvg < classAvg) return true
          if (predicted != null && studentAvg < predicted * 0.85) return true
          return false
        })

        // Reasons per topic for student-facing copy
        const focusReasons = focusTopics.map(topic => {
          const classAvg    = classAvgByTopic.get(topic)
          const studentScrs = sm.get(topic) ?? []
          const studentAvg  = studentScrs.length
            ? Math.round(studentScrs.reduce((a, b) => a + b, 0) / studentScrs.length)
            : null
          if (classAvg != null && studentAvg != null)
            return `${topic}: your score (${studentAvg}) was below the class average (${Math.round(classAvg)})`
          return `${topic}: needs more practice`
        })

        const content = await generateYearRevisionTask({
          studentName:    `${student.firstName} ${student.lastName}`,
          subject:        input.subject,
          yearGroup:      input.yearGroup,
          allTopics:      input.selectedTopics,
          focusTopics,
          focusReasons,
          sendAdaptations: isSend ? [sendStatus as string] : [],
        })

        return { studentId: student.id, focusTopics, content }
      }))
      generated.push(...results.map(r => ({ studentId: r.studentId, content: r.content, focusTopics: r.focusTopics })))
    }

    // Save in transaction
    const result = await prisma.$transaction(async tx => {
      const program = await (tx as any).revisionProgram.create({
        data: {
          schoolId:     user.schoolId,
          classId:      null,
          createdBy:    user.id,
          title:        input.title,
          subject:      input.subject,
          yearGroup:    input.yearGroup,
          periodStart:  yearStart,
          periodEnd:    now,
          topics:       input.selectedTopics,
          mode:         input.mode,
          deadline:     input.deadline ?? null,
          durationWeeks: 2,
          status:       'draft',
          programType:  'year',
        },
      })

      const taskData = generated.map((g: any) => ({
        programId:        program.id,
        studentId:        g.studentId,
        schoolId:         user.schoolId,
        focusTopics:      g.focusTopics,
        taskType:         'year_revision',
        structuredContent: g.content.structuredContent as any,
        instructions:     g.content.instructions,
        modelAnswer:      null,
        weakTopics:       g.focusTopics,
        strongTopics:     [],
        sendAdaptations:  [],
        ilpTargetIds:     [] as string[],
        estimatedMins:    60,
      }))

      await (tx as any).revisionTask.createMany({ data: taskData })
      return { programId: program.id, taskCount: taskData.length }
    })

    // Notify students
    if (input.mode === 'formal_assignment') {
      try {
        await prisma.notification.createMany({
          data: students.map(s => ({
            userId:   s.id,
            schoolId: user.schoolId,
            type:     'HOMEWORK_REMINDER',
            title:    `Year Revision: ${input.title}`,
            body:     input.deadline
              ? `Due ${new Date(input.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
              : 'Your personalised year revision is ready.',
            linkHref: '/student/revision',
            read:     false,
          })),
        })
      } catch { /* non-fatal */ }
    }

    return result
  } catch (err) {
    console.error('[createYearRevisionProgram] error:', err)
    throw err
  }
}

// ── Test Mode ─────────────────────────────────────────────────────────────────

const QUESTIONS_PER_SESSION = 8

export async function startTestSession(
  taskId:            string,
  previousSessionId?: string,
): Promise<{ sessionId: string; question: TestQuestion; totalQuestions: number }> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const user = session.user as any
  if (user.role !== 'STUDENT') throw new Error('Students only')

  const task = await (prisma as any).revisionTask.findFirst({
    where:   { id: taskId, studentId: user.id, schoolId: user.schoolId },
    include: { program: { select: { subject: true, yearGroup: true } } },
  })
  if (!task) throw new Error('Task not found')

  // Load previous session questions to avoid repeating
  const excludeTexts: string[] = []
  if (previousSessionId) {
    try {
      const prev = await (prisma as any).revisionTestSession.findFirst({
        where:  { id: previousSessionId, studentId: user.id },
        select: { questions: true },
      })
      if (prev) {
        const prevQs = prev.questions as TestQuestion[]
        excludeTexts.push(...prevQs.map((q: TestQuestion) => q.text.slice(0, 100)))
      }
    } catch { /* non-fatal */ }
  }

  // Determine if student has an ILP (use ilpTargetIds stored on task)
  const hasIlp = (task.ilpTargetIds?.length ?? 0) > 0
  let ilpTargets: string[] = []
  if (hasIlp) {
    try {
      const targets = await (prisma as any).iLPTarget.findMany({
        where:  { id: { in: task.ilpTargetIds }, status: 'active' },
        select: { description: true },
      })
      ilpTargets = targets.map((t: any) => String(t.description))
    } catch { /* non-fatal */ }
  }

  const topics = task.focusTopics?.length > 0 ? task.focusTopics : [task.program.subject]

  const { generateQuestion, selectQuestionType } = await import('@/lib/revision/test-engine')
  const question = await generateQuestion({
    subject:      task.program.subject,
    yearGroup:    task.program.yearGroup,
    topics,
    type:         selectQuestionType(0, hasIlp),
    difficulty:   'medium',
    excludeTexts,
    ilpTargets,
  })
  question.index = 0

  const testSession = await (prisma as any).revisionTestSession.create({
    data: {
      taskId,
      studentId: user.id,
      schoolId:  user.schoolId,
      subject:   task.program.subject,
      yearGroup: task.program.yearGroup,
      topics,
      hasIlp,
      questions: [question] as any,
      answers:   [] as any,
      status:    'active',
    },
  })

  return { sessionId: testSession.id, question, totalQuestions: QUESTIONS_PER_SESSION }
}

export async function submitTestAnswer(
  sessionId: string,
  answer:    string,
): Promise<{ nextQuestion: TestQuestion | null; sessionComplete: boolean; results?: TestResults }> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const user = session.user as any

  const testSession = await (prisma as any).revisionTestSession.findFirst({
    where: { id: sessionId, studentId: user.id, schoolId: user.schoolId, status: 'active' },
  })
  if (!testSession) throw new Error('Test session not found or already complete')

  const {
    generateQuestion, evaluateAnswer, calculateResults, selectQuestionType,
  } = await import('@/lib/revision/test-engine')

  const questions: TestQuestion[] = testSession.questions as TestQuestion[]
  const answers:   TestAnswer[]   = testSession.answers   as TestAnswer[]
  const current = questions[questions.length - 1]

  const { score, feedback } = await evaluateAnswer(current, answer, testSession.subject)

  const newAnswer: TestAnswer = {
    questionIndex: current.index,
    answer,
    score,
    maxScore:     current.marks,
    topic:        current.topic,
    questionType: current.type,
    feedback,
  }
  const updatedAnswers = [...answers, newAnswer]
  const isComplete     = updatedAnswers.length >= QUESTIONS_PER_SESSION

  if (isComplete) {
    const results = calculateResults(updatedAnswers)

    await (prisma as any).revisionTestSession.update({
      where: { id: sessionId },
      data: {
        answers:        updatedAnswers as any,
        status:         'completed',
        finalScore:     results.totalScore,
        maxScore:       results.maxScore,
        estimatedGrade: results.estimatedGrade,
        areasToRevisit: results.areasToRevisit as any,
        completedAt:    new Date(),
      },
    })

    // Auto-submit the revision task with the test score
    try {
      await (prisma as any).revisionTask.update({
        where: { id: testSession.taskId },
        data: {
          studentResponse: { testSessionId: sessionId, score: results.percentage } as any,
          submittedAt:     new Date(),
          autoScore:       results.percentage,
          completedAt:     new Date(),
          status:          'submitted',
        },
      })
    } catch (e) {
      console.error('[submitTestAnswer] task auto-submit failed (non-fatal):', e)
    }

    return { nextQuestion: null, sessionComplete: true, results }
  }

  // Calculate running score for difficulty adjustment
  const runningMax = updatedAnswers.reduce((s, a) => s + a.maxScore, 0)
  const runningPct = runningMax > 0
    ? (updatedAnswers.reduce((s, a) => s + a.score, 0) / runningMax) * 100
    : 50
  const nextDifficulty = (runningPct > 70 ? 'hard' : runningPct < 40 ? 'easy' : 'medium') as 'easy' | 'medium' | 'hard'
  const nextType = selectQuestionType(updatedAnswers.length, testSession.hasIlp)
  const excludeTexts = questions.map((q: TestQuestion) => q.text.slice(0, 100))

  const nextQ = await generateQuestion({
    subject:      testSession.subject,
    yearGroup:    testSession.yearGroup,
    topics:       testSession.topics,
    type:         nextType,
    difficulty:   nextDifficulty,
    excludeTexts,
    ilpTargets:   [],
  })
  nextQ.index = updatedAnswers.length

  await (prisma as any).revisionTestSession.update({
    where: { id: sessionId },
    data: {
      questions: [...questions, nextQ] as any,
      answers:   updatedAnswers as any,
    },
  })

  return { nextQuestion: nextQ, sessionComplete: false }
}
