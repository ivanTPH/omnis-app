import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import HomeworkFilterView, { type HomeworkListItem } from '@/components/HomeworkFilterView'

export const dynamic = 'force-dynamic'

export default async function HomeworkPage() {
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = await requireAuth()

  // Teachers and cover managers only see their own classes' homework.
  // All other staff roles (HOD, HOY, SENCO, SLT, SCHOOL_ADMIN) see the full school.
  const isTeacher = role === 'TEACHER' || role === 'COVER_MANAGER'

  // Wrap both queries in try/catch so DB connection issues don't throw to the error boundary.
  // HomeworkFilterView renders an inline error banner + refresh button on fetchError.
  let items: HomeworkListItem[] = []
  let fetchError = false

  // Guard: if schoolId is missing from the session JWT, bail immediately
  if (!schoolId) {
    fetchError = true
    console.error('[HomeworkPage] schoolId missing from session — cannot scope query')
  }

  // Retry helper — transient PgBouncer connection failures on Vercel cold-starts
  // resolve on the second attempt. One retry with 300ms back-off is sufficient.
  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try { return await fn() } catch {
      await new Promise(r => setTimeout(r, 300))
      return fn()
    }
  }

  if (!fetchError) try {
    const homework = await withRetry(() => prisma.homework.findMany({
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
    }))

    const classIds = [...new Set(homework.map(h => h.classId).filter(Boolean))] as string[]
    const enrolmentCounts = classIds.length
      ? await withRetry(() => prisma.enrolment.groupBy({
          by:    ['classId'],
          where: { classId: { in: classIds } },
          _count: { classId: true },
        }))
      : []

    const countByClass = Object.fromEntries(
      enrolmentCounts.map(e => [e.classId, e._count.classId]),
    )

    items = homework.map(hw => {
      const total     = countByClass[hw.classId!] ?? 0
      const submitted = hw.submissions.length
      // Only RETURNED = teacher has graded and given back to student.
      // MARKED = auto-marked but teacher hasn't reviewed/returned yet → still needs action.
      const returned = hw.submissions.filter(s => s.status === 'RETURNED').length
      return {
        id:             hw.id,
        title:          hw.title,
        status:         hw.status as string,
        dueAt:          hw.dueAt.toISOString(),
        classId:        hw.classId,
        class:          hw.class,
        lesson:         hw.lesson,
        submittedCount: submitted,
        markedCount:    returned,
        needsMarkCount: submitted - returned,
        totalEnrolled:  total,
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[HomeworkPage] data fetch failed:', msg)
    fetchError = true
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto">
        <HomeworkFilterView homework={items} fetchError={fetchError} />
      </main>
    </AppShell>
  )
}
