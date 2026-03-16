'use server'
import { auth }         from '@/lib/auth'
import { prisma }       from '@/lib/prisma'
import { redirect }     from 'next/navigation'
import { analyseClassPerformance, type ClassPerformanceAnalysis } from '@/lib/revision/analysis-engine'
import { generateRevisionTask } from '@/lib/revision/content-generator'

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
            studentId:      t.student.id,
            studentName:    `${t.student.firstName} ${t.student.lastName}`,
            subject:        input.subject,
            yearGroup:      schoolClass.yearGroup,
            weakTopics:     t.weakTopics,
            strongTopics:   t.strongTopics,
            taskType:       t.taskType,
            sendAdaptations: t.sendAdaptations,
            ilpTargets:     t.ilpTargets,
            durationMins:   input.durationWeeks * 30,
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
  classId: string
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
      classId:        p.classId,
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
