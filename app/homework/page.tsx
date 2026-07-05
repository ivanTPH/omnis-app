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
  // can take 1–2 seconds to resolve. Two retries with increasing back-off covers
  // the vast majority of cold-start pool exhaustion cases.
  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try { return await fn() } catch {
      await new Promise(r => setTimeout(r, 800))
      try { return await fn() } catch {
        await new Promise(r => setTimeout(r, 1500))
        return fn()
      }
    }
  }

  if (!fetchError) try {
    const homework = await withRetry(() => prisma.homework.findMany({
      where: {
        schoolId,
        // Mirror the dashboard scope: createdBy OR class teacher, so
        // homework created directly (e.g. cover lessons) appears in both views.
        ...(isTeacher ? { OR: [{ createdBy: userId }, { class: { teachers: { some: { userId } } } }] } : {}),
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
      const returned  = hw.submissions.filter(s => s.status === 'RETURNED').length
      // needsMarkCount mirrors the dashboard's criterion: non-RETURNED submissions
      // that have not yet been given a finalScore (ungraded). This aligns the
      // "To Mark" figure between the dashboard and the homework list.
      const needsMarkCount = hw.submissions.filter(s => s.status !== 'RETURNED' && !s.finalScore).length
      return {
        id:             hw.id,
        title:          hw.title,
        status:         hw.status as string,
        dueAt:          hw.dueAt instanceof Date ? hw.dueAt.toISOString() : String(hw.dueAt),
        classId:        hw.classId,
        class:          hw.class,
        lesson:         hw.lesson,
        submittedCount: submitted,
        markedCount:    returned,
        needsMarkCount,
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
