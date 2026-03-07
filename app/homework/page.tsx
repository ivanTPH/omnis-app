import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import HomeworkFilterView from '@/components/HomeworkFilterView'

export default async function HomeworkPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any

  // Teachers and cover managers only see their own classes' homework.
  // All other staff roles (HOD, HOY, SENCO, SLT, SCHOOL_ADMIN) see the full school.
  const isTeacher = role === 'TEACHER' || role === 'COVER_MANAGER'

  const homework = await prisma.homework.findMany({
    where: {
      schoolId,
      ...(isTeacher ? { class: { teachers: { some: { userId } } } } : {}),
    },
    include: {
      class:       { select: { name: true, subject: true, yearGroup: true } },
      lesson:      { select: { id: true, title: true } },
      submissions: { select: { id: true, status: true, finalScore: true } },
    },
    orderBy: { dueAt: 'asc' },
  })

  // Enrolment counts per class (for submission rate denominator)
  const classIds = [...new Set(homework.map(h => h.classId).filter(Boolean))] as string[]
  const enrolmentCounts = await prisma.enrolment.groupBy({
    by:    ['classId'],
    where: { classId: { in: classIds } },
    _count: { classId: true },
  })
  const countByClass = Object.fromEntries(
    enrolmentCounts.map(e => [e.classId, e._count.classId]),
  )

  const items = homework.map(hw => {
    const total    = countByClass[hw.classId!] ?? 0
    const submitted = hw.submissions.length
    const marked    = hw.submissions.filter(s => s.status === 'RETURNED' || s.status === 'MARKED').length
    return {
      id:             hw.id,
      title:          hw.title,
      status:         hw.status as string,
      dueAt:          hw.dueAt.toISOString(),
      classId:        hw.classId,
      class:          hw.class,
      lesson:         hw.lesson,
      submittedCount: submitted,
      markedCount:    marked,
      needsMarkCount: submitted - marked,
      totalEnrolled:  total,
    }
  })

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto">
        <HomeworkFilterView homework={items} />
      </main>
    </AppShell>
  )
}
