import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import WeeklyCalendar, { type CalendarLesson, type UnscheduledLesson } from '@/components/WeeklyCalendar'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any

  // Current week Mon 00:00 → Fri 23:59
  const now    = new Date()
  const dow    = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  friday.setHours(23, 59, 59, 999)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let school: any = null, weekLessons: any[] = [], futureLessons: any[] = [], classes: any[] = [], allClasses: any[] = []

  try {
    ;[school, weekLessons, futureLessons, classes, allClasses] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId } }),

      prisma.lesson.findMany({
        where: {
          schoolId,
          scheduledAt: { gte: monday, lte: friday },
          OR: [
            { class: { teachers: { some: { userId } } } },
            { createdBy: userId },
          ],
        },
        include: {
          class: true,
          resources: { select: { type: true } },
          homework:  { select: { id: true, status: true } },
        },
      }),

      prisma.lesson.findMany({
        where: {
          schoolId,
          published: false,
          scheduledAt: { gt: friday },
          OR: [
            { class: { teachers: { some: { userId } } } },
            { createdBy: userId },
          ],
        },
        include: { class: true },
        orderBy: { scheduledAt: 'asc' },
        take: 30,
      }),

      prisma.schoolClass.findMany({
        where: { schoolId, teachers: { some: { userId } } },
        select: { id: true, name: true, subject: true, yearGroup: true },
        orderBy: [{ yearGroup: 'asc' }, { name: 'asc' }],
      }),

      prisma.schoolClass.findMany({
        where:   { schoolId },
        select:  { id: true, name: true, subject: true, yearGroup: true },
        orderBy: [{ yearGroup: 'asc' }, { name: 'asc' }],
      }),
    ])
  } catch (err) {
    console.error('[DashboardPage] data fetch failed:', err)
    // Render empty calendar rather than crashing
  }

  const lessons: CalendarLesson[] = weekLessons.map(l => ({
    id:          l.id,
    title:       l.title,
    scheduledAt: l.scheduledAt.toISOString(),
    endsAt:      l.endsAt?.toISOString(),
    published:   l.published,
    className:   l.class?.name  ?? '—',
    subject:     l.class?.subject ?? '—',
    lessonType:  l.lessonType,
    hasPlan:     l.resources.some((r: { type: string }) => r.type === 'PLAN'),
    hasSlides:   l.resources.some((r: { type: string }) => r.type === 'SLIDES'),
    hasHomework:    l.homework.length > 0,
    homeworkStatus: l.homework.length > 0 ? l.homework[0].status : null,
    hasOther:       l.resources.some((r: { type: string }) => r.type !== 'PLAN' && r.type !== 'SLIDES'),
  }))

  const unscheduled: UnscheduledLesson[] = futureLessons.map(l => ({
    id:        l.id,
    title:     l.title,
    className: l.class?.name    ?? '—',
    subject:   l.class?.subject ?? '—',
  }))

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <WeeklyCalendar
        lessons={lessons}
        unscheduled={unscheduled}
        firstName={firstName}
        classes={classes}
        allClasses={allClasses}
        teacherSubjects={[...new Set(classes.map(c => c.subject))]}
        startHour={school?.dayStartHour  ?? 8}
        endHour={school?.dayEndHour      ?? 16}
        extStartHour={school?.extStartHour ?? 7}
        extEndHour={school?.extEndHour   ?? 19}
      />
    </AppShell>
  )
}
