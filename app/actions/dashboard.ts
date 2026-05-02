'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type TodayLesson = {
  id: string
  title: string
  scheduledAt: string
  className: string
  subject: string
}

export type HomeworkToMark = {
  id: string
  title: string
  dueAt: string
  ungradedCount: number
}

export type OpenConcern = {
  id: string
  studentName: string
  description: string
  createdAt: string
}

export type DashboardData = {
  todaysLessons:     TodayLesson[]
  homeworkToMark:    HomeworkToMark[]
  submissionsToday:  number
  openConcernsCount: number
  openConcerns:      OpenConcern[]
}

export async function getDashboardData(): Promise<DashboardData> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId   = (session.user as any).id as string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schoolId = (session.user as any).schoolId as string

  const now        = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999)

  const [todayLessons, hwToMark, subsTodayCount, concernsCount, concerns] = await Promise.all([

    // Today's lessons, sorted by start time
    prisma.lesson.findMany({
      where: {
        schoolId,
        scheduledAt: { gte: todayStart, lte: todayEnd },
        OR: [
          { class: { teachers: { some: { userId } } } },
          { createdBy: userId },
        ],
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        class: { select: { name: true, subject: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    }),

    // Homework with at least one ungraded submission
    prisma.homework.findMany({
      where: {
        schoolId,
        OR: [
          { createdBy: userId },
          { class: { teachers: { some: { userId } } } },
        ],
        submissions: {
          some: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        },
      },
      select: {
        id:    true,
        title: true,
        dueAt: true,
        _count: {
          select: {
            submissions: {
              where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
            },
          },
        },
      },
      orderBy: { dueAt: 'asc' },
      take: 5,
    }),

    // Submissions received today for this teacher's homework
    prisma.submission.count({
      where: {
        schoolId,
        submittedAt: { gte: todayStart },
        homework: {
          OR: [
            { createdBy: userId },
            { class: { teachers: { some: { userId } } } },
          ],
        },
      },
    }),

    // Open concern count (raised by this teacher)
    prisma.sendConcern.count({
      where: {
        schoolId,
        raisedBy: userId,
        status:   { in: ['open', 'under_review'] },
      },
    }),

    // Open concerns top 3 (raised by this teacher)
    prisma.sendConcern.findMany({
      where: {
        schoolId,
        raisedBy: userId,
        status:   { in: ['open', 'under_review'] },
      },
      select: {
        id:          true,
        description: true,
        createdAt:   true,
        student:     { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ])

  return {
    todaysLessons: todayLessons.map(l => ({
      id:          l.id,
      title:       l.title,
      scheduledAt: l.scheduledAt.toISOString(),
      className:   l.class?.name    ?? '—',
      subject:     l.class?.subject ?? '—',
    })),
    homeworkToMark: hwToMark.map(hw => ({
      id:           hw.id,
      title:        hw.title,
      dueAt:        hw.dueAt.toISOString(),
      ungradedCount: hw._count.submissions,
    })),
    submissionsToday:  subsTodayCount,
    openConcernsCount: concernsCount,
    openConcerns: concerns.map(c => ({
      id:          c.id,
      studentName: `${c.student.firstName} ${c.student.lastName}`,
      description: c.description,
      createdAt:   c.createdAt.toISOString(),
    })),
  }
}
