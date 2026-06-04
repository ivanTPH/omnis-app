import { requireAuth }        from '@/lib/session'
import { redirect }           from 'next/navigation'
import { prisma }             from '@/lib/prisma'
import AppShell               from '@/components/AppShell'
import StudentHomeworkListView from '@/components/student/StudentHomeworkListView'
import type { MobileHw }      from '@/components/StudentMobileDashboard'

export default async function StudentHomeworkListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { schoolId, id: userId, role, firstName, lastName, schoolName } = await requireAuth()
  if (role !== 'STUDENT') redirect('/student/dashboard')

  const sp = await searchParams

  const enrolments = await prisma.enrolment.findMany({ where: { userId }, select: { classId: true } })
  const classIds   = enrolments.map(e => e.classId)

  const allHw = await prisma.homework.findMany({
    where: {
      schoolId,
      classId: { in: classIds },
      status:  'PUBLISHED',
      OR: [{ isAdapted: false, adaptedFor: null }, { isAdapted: true, adaptedFor: userId }],
    },
    include: {
      class:       { select: { name: true, subject: true } },
      submissions: {
        where:  { studentId: userId },
        select: { id: true, status: true, grade: true, finalScore: true, submittedAt: true,
                  feedback: true, homework: { select: { gradingBands: true } } },
      },
    },
    orderBy: { dueAt: 'asc' },
  })

  // Deduplicate — prefer adapted variant per lesson
  const map = new Map<string, typeof allHw[0]>()
  for (const hw of allHw) {
    const key = hw.lessonId ?? hw.id
    if (hw.isAdapted || !map.has(key)) map.set(key, hw)
  }

  const now  = new Date()
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const homework: MobileHw[] = Array.from(map.values()).map(hw => {
    const sub   = hw.submissions[0] ?? null
    const dueAt = new Date(hw.dueAt)
    let status: MobileHw['status']
    if (sub?.grade)      status = 'graded'
    else if (sub)        status = 'submitted'
    else if (dueAt < now) status = 'overdue'
    else if (dueAt <= soon) status = 'due_soon'
    else                 status = 'upcoming'

    let score: number | null = null
    if (sub?.finalScore != null) {
      const bands = sub.homework?.gradingBands
      const max   = bands && typeof bands === 'object'
        ? Math.max(0, ...Object.keys(bands as Record<string, string>).flatMap(k =>
            k.split(/[-–]/).map(Number).filter(n => !isNaN(n))))
        : 9
      score = max > 0 ? Math.min(100, Math.round((sub.finalScore / max) * 100)) : null
    }

    return {
      id:           hw.id,
      title:        hw.title,
      dueAt:        hw.dueAt.toISOString(),
      subject:      hw.class.subject,
      className:    hw.class.name,
      status,
      grade:        sub?.grade ?? null,
      score,
      homeworkType: hw.homeworkVariantType ?? (
        hw.type === 'MCQ_QUIZ'          ? 'quiz'
        : hw.type === 'SHORT_ANSWER'    ? 'short_answer'
        : hw.type === 'EXTENDED_WRITING' ? 'essay'
        : null
      ),
    }
  })

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <StudentHomeworkListView homework={homework} initialStatus={sp.status} />
    </AppShell>
  )
}
