'use server'
import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { revalidatePath, unstable_cache } from 'next/cache'

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

export type ConcernHomeworkEvidence = {
  id: string          // homework id
  submissionId: string
  title: string
  dueAt: string
}

export type OpenConcern = {
  id: string
  studentId: string
  studentName: string
  description: string
  category: string
  status: string
  evidenceNotes: string | null
  createdAt: string
  todayLesson: { scheduledAt: string; className: string } | null
  recentHomework: ConcernHomeworkEvidence[]
}

export type SencoAlert = {
  id:        string
  title:     string
  body:      string
  linkHref:  string | null
  createdAt: string
}

export type DashboardData = {
  todaysLessons:     TodayLesson[]
  homeworkToMark:    HomeworkToMark[]
  submissionsToday:  number
  openConcernsCount: number
  openConcerns:      OpenConcern[]
  sencoAlerts:       SencoAlert[]
}

// Inner function — no auth() call, safe to cache
async function fetchDashboardData(userId: string, schoolId: string, dateKey: string): Promise<DashboardData> {
  // Reconstruct day boundaries from the stable dateKey (todayStart ISO string)
  const todayStart = new Date(dateKey)
  const todayEnd   = new Date(todayStart); todayEnd.setHours(23, 59, 59, 999)
  const now        = new Date()

  const [todayLessons, hwToMark, subsTodayCount, concernsCount, concerns, alertNotifs] = await Promise.all([

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

    // Open concerns (raised by this teacher)
    prisma.sendConcern.findMany({
      where: {
        schoolId,
        raisedBy: userId,
        status:   { in: ['open', 'under_review'] },
      },
      select: {
        id:            true,
        studentId:     true,
        description:   true,
        category:      true,
        status:        true,
        evidenceNotes: true,
        createdAt:     true,
        student:       { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Unread SENCO alerts sent to this teacher
    prisma.notification.findMany({
      where: { schoolId, userId, type: 'SENCO_ALERT', read: false },
      select: { id: true, title: true, body: true, linkHref: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  // For each concern, find today's lesson + recent homework evidence in parallel
  const concernsWithData = await Promise.all(
    concerns.map(async c => {
      const lessonSelect = { scheduledAt: true, class: { select: { name: true } } } as const
      const baseWhere = {
        schoolId,
        scheduledAt: { gte: todayStart, lte: todayEnd },
        class: { enrolments: { some: { userId: c.studentId } } },
      }

      const [upcoming, recentSubs] = await Promise.all([
        prisma.lesson.findFirst({
          where: { ...baseWhere, scheduledAt: { gte: now, lte: todayEnd } },
          select: lessonSelect,
          orderBy: { scheduledAt: 'asc' },
        }),
        prisma.submission.findMany({
          where: {
            schoolId,
            studentId: c.studentId,
            homework: {
              OR: [
                { createdBy: userId },
                { class: { teachers: { some: { userId } } } },
              ],
            },
          },
          select: {
            id: true,
            homework: { select: { id: true, title: true, dueAt: true } },
          },
          orderBy: { submittedAt: 'desc' },
          take: 3,
        }),
      ])

      // Fall back to earliest lesson today if all are in the past
      const lesson = upcoming ?? await prisma.lesson.findFirst({
        where: baseWhere,
        select: lessonSelect,
        orderBy: { scheduledAt: 'asc' },
      })

      return { concern: c, lesson, recentSubs }
    }),
  )

  return {
    todaysLessons: todayLessons.map(l => ({
      id:          l.id,
      title:       l.title,
      scheduledAt: l.scheduledAt.toISOString(),
      className:   l.class?.name    ?? '—',
      subject:     l.class?.subject ?? '—',
    })),
    homeworkToMark: hwToMark.map(hw => ({
      id:            hw.id,
      title:         hw.title,
      dueAt:         hw.dueAt.toISOString(),
      ungradedCount: hw._count.submissions,
    })),
    submissionsToday:  subsTodayCount,
    openConcernsCount: concernsCount,
    sencoAlerts: alertNotifs.map(n => ({
      id:        n.id,
      title:     n.title,
      body:      n.body,
      linkHref:  n.linkHref,
      createdAt: n.createdAt.toISOString(),
    })),
    openConcerns: concernsWithData.map(({ concern: c, lesson, recentSubs }) => ({
      id:            c.id,
      studentId:     c.studentId,
      studentName:   `${c.student.firstName} ${c.student.lastName}`,
      description:   c.description,
      category:      c.category,
      status:        c.status,
      evidenceNotes: c.evidenceNotes,
      createdAt:     c.createdAt.toISOString(),
      todayLesson:   lesson
        ? { scheduledAt: lesson.scheduledAt.toISOString(), className: lesson.class?.name ?? '—' }
        : null,
      recentHomework: recentSubs.map(s => ({
        id:           s.homework.id,
        submissionId: s.id,
        title:        s.homework.title,
        dueAt:        s.homework.dueAt.toISOString(),
      })),
    })),
  }
}

// Cache keyed by (userId, schoolId, dateKey) — busts at midnight and on revalidatePath('/dashboard')
const getCachedDashboardData = unstable_cache(
  fetchDashboardData,
  ['dashboard-data'],
  { revalidate: 60 },
)

export async function getDashboardData(): Promise<DashboardData> {
  const { id: userId, schoolId } = await requireAuth()

  // Use local-time day start as the date key — cache busts automatically at midnight
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

  return getCachedDashboardData(userId, schoolId, todayStart.toISOString())
}

// ─── Concern actions (for raising teacher from dashboard) ─────────────────────

export async function addConcernNote(concernId: string, note: string): Promise<void> {
  const { schoolId, id: userId, firstName, lastName } = await requireAuth()

  const concern = await prisma.sendConcern.findFirst({
    where: { id: concernId, schoolId, raisedBy: userId },
    select: { id: true, evidenceNotes: true },
  })
  if (!concern) throw new Error('Concern not found or not yours')

  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const prefix  = `[${firstName} ${lastName} – ${dateStr}]:`
  const appended = concern.evidenceNotes
    ? `${concern.evidenceNotes}\n\n${prefix} ${note.trim()}`
    : `${prefix} ${note.trim()}`

  await prisma.sendConcern.update({
    where: { id: concernId },
    data:  { evidenceNotes: appended },
  })

  revalidatePath('/dashboard')
}

export async function escalateConcernToStaff(
  concernId: string,
  targetRoles: string[],
  message: string,
): Promise<{ notified: number }> {
  const { schoolId, firstName, lastName } = await requireAuth()

  const concern = await prisma.sendConcern.findFirst({
    where: { id: concernId, schoolId },
    select: { id: true, studentId: true, category: true },
  })
  if (!concern) throw new Error('Concern not found')

  const student = await prisma.user.findUnique({
    where: { id: concern.studentId },
    select: { firstName: true, lastName: true },
  })
  const studentName = student ? `${student.firstName} ${student.lastName}` : 'a student'

  const recipients = await prisma.user.findMany({
    where: { schoolId, isActive: true, role: { in: targetRoles as never[] } },
    select: { id: true },
  })

  if (recipients.length === 0) return { notified: 0 }

  await prisma.sendNotification.createMany({
    data: recipients.map(r => ({
      schoolId,
      recipientId: r.id,
      concernId,
      type:  'concern_escalated',
      title: `Concern escalated: ${studentName}`,
      body:  `${firstName} ${lastName} has escalated a ${concern.category} concern about ${studentName}. Message: ${message.slice(0, 200)}`,
    })),
    skipDuplicates: true,
  })

  // Mark concern as escalated
  await prisma.sendConcern.update({
    where: { id: concernId },
    data:  { status: 'escalated' },
  })

  revalidatePath('/dashboard')
  return { notified: recipients.length }
}

// ─── SENCO alert actions ──────────────────────────────────────────────────────

export async function sendSencoAlert(
  studentId:   string,
  studentName: string,
  message:     string,
  teacherIds:  string[],
): Promise<{ notified: number }> {
  const { id: actorId, schoolId, role, firstName, lastName } = await requireAuth()
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)) throw new Error('Not authorized')
  if (!teacherIds.length) return { notified: 0 }

  // Verify recipients belong to this school
  const teachers = await prisma.user.findMany({
    where: { id: { in: teacherIds }, schoolId, isActive: true },
    select: { id: true },
  })
  if (!teachers.length) return { notified: 0 }

  await prisma.notification.createMany({
    data: teachers.map(t => ({
      schoolId,
      userId:   t.id,
      type:     'SENCO_ALERT',
      title:    `SENCO Alert: ${studentName}`,
      body:     `${firstName} ${lastName}: ${message.slice(0, 500)}`,
      linkHref: `/students/${studentId}`,
    })),
  })

  await writeAudit({
    schoolId,
    actorId,
    action:     'MESSAGE_SENT',
    targetType: 'Student',
    targetId:   studentId,
    metadata:   { type: 'SENCO_ALERT', teacherCount: teachers.length, preview: message.slice(0, 100) },
  })

  return { notified: teachers.length }
}

export async function dismissSencoAlert(notificationId: string): Promise<void> {
  const { id: userId, schoolId } = await requireAuth()

  await prisma.notification.updateMany({
    where: { id: notificationId, schoolId, userId },
    data:  { read: true },
  })
}

// ─── Teacher timetable (Wonde MIS) ────────────────────────────────────────────

export type TeacherTimetableLesson = {
  startTime: string
  endTime:   string
  subject:   string | null
  className: string
  room:      string | null
}

/** Returns the teacher's timetable for today sourced from Wonde MIS data.
 *  Matches the logged-in User to a WondeEmployee by name, then looks up
 *  WondeTimetableEntry records for today's day of week.
 *  Returns [] when no Wonde record exists or today is a weekend.
 */
export async function getTeacherTodayTimetable(): Promise<TeacherTimetableLesson[]> {
  const { schoolId, firstName, lastName } = await requireAuth()

  // JS getDay(): 0=Sun, 1=Mon…6=Sat → ISO school day 1–5 (Mon–Fri)
  const jsDay    = new Date().getDay()
  const todayNum = jsDay === 0 ? 7 : jsDay  // keep 1-6, let filter below reject 6 & 7
  if (todayNum < 1 || todayNum > 5) return []

  // Resolve teacher via name match (same bridge as student timetable)
  const employee = await prisma.wondeEmployee.findFirst({
    where: { schoolId, firstName, lastName },
    select: { id: true },
  })
  if (!employee) return []

  const entries = await prisma.wondeTimetableEntry.findMany({
    where: {
      schoolId,
      employeeId: employee.id,
      period: { dayOfWeek: todayNum },
    },
    include: {
      wondeClass: { select: { name: true, subject: true } },
      period:     { select: { startTime: true, endTime: true } },
    },
    orderBy: { period: { startTime: 'asc' } },
  })

  return entries.map(e => {
    const raw  = e.roomName
    const room = raw && !/^[A-Z]\d{6,}$/.test(raw) ? raw : null
    return {
      startTime: e.period.startTime.slice(0, 5),
      endTime:   e.period.endTime.slice(0, 5),
      subject:   e.wondeClass.subject,
      className: e.wondeClass.name,
      room,
    }
  })
}
