import { requireAuth }       from '@/lib/session'
import { redirect }          from 'next/navigation'
import { prisma }            from '@/lib/prisma'
import AppShell              from '@/components/AppShell'
import LessonsWeekView       from '@/components/cover/LessonsWeekView'

export type SchoolLesson = {
  id:           string
  title:        string
  scheduledAt:  string
  endsAt:       string | null
  className:    string
  subject:      string
  yearGroup:    string
  teacherName:  string
  resourceCount: number
  hasAbsence:   boolean
  absenceId:    string | null
}

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { schoolId, role, firstName, lastName, schoolName } = await requireAuth()
  if (!['COVER_MANAGER', 'SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const sp = await searchParams

  // Week start: Monday of selected or current week
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() + diffToMon)
  thisMonday.setHours(0, 0, 0, 0)

  const weekStart = sp.week ? new Date(sp.week) : thisMonday
  const weekEnd   = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 5)
  weekEnd.setHours(23, 59, 59, 999)

  const [lessons, absences] = await Promise.all([
    prisma.lesson.findMany({
      where: {
        schoolId,
        scheduledAt: { gte: weekStart, lte: weekEnd },
      },
      include: {
        class:     {
          select: {
            name:      true,
            subject:   true,
            yearGroup: true,
            teachers:  { select: { user: { select: { firstName: true, lastName: true } } }, take: 1 },
          },
        },
        resources: { select: { id: true } },
      },
      orderBy: [{ scheduledAt: 'asc' }],
      take: 500,
    }),
    prisma.staffAbsence.findMany({
      where: { schoolId, date: { gte: weekStart, lte: weekEnd } },
      select: { id: true, staffId: true, date: true },
    }),
  ])

  const absenceMap = new Map<string, { id: string; staffId: string }[]>()
  for (const a of absences) {
    const key = a.date.toISOString().split('T')[0]
    if (!absenceMap.has(key)) absenceMap.set(key, [])
    absenceMap.get(key)!.push({ id: a.id, staffId: a.staffId })
  }

  const schoolLessons: SchoolLesson[] = lessons.map(l => {
    const teacher   = l.class?.teachers?.[0]?.user
    const dateKey   = l.scheduledAt.toISOString().split('T')[0]
    const dayAbs    = absenceMap.get(dateKey) ?? []
    const hasAbsence = dayAbs.length > 0
    const absenceId: string | null = dayAbs[0]?.id ?? null

    return {
      id:           l.id,
      title:        l.title,
      scheduledAt:  l.scheduledAt.toISOString(),
      endsAt:       l.endsAt?.toISOString() ?? null,
      className:    l.class?.name ?? '—',
      subject:      l.class?.subject ?? '—',
      yearGroup:    String(l.class?.yearGroup ?? '—'),
      teacherName:  teacher ? `${teacher.firstName} ${teacher.lastName}` : '—',
      resourceCount: l.resources.length,
      hasAbsence,
      absenceId,
    }
  })

  const prevWeek = new Date(weekStart); prevWeek.setDate(weekStart.getDate() - 7)
  const nextWeek = new Date(weekStart); nextWeek.setDate(weekStart.getDate() + 7)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <LessonsWeekView
        lessons={schoolLessons}
        weekStart={weekStart.toISOString()}
        prevWeek={prevWeek.toISOString().split('T')[0]}
        nextWeek={nextWeek.toISOString().split('T')[0]}
        totalAbsences={absences.length}
      />
    </AppShell>
  )
}
