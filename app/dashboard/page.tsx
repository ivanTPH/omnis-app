import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import DashboardMorningView from '@/components/DashboardMorningView'
import { getDashboardData, getTeacherTodayTimetable } from '@/app/actions/dashboard'

export default async function DashboardPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()

  // Fetch both in parallel server-side — eliminates the client-side useEffect waterfall
  const [initialData, initialTimetable] = await Promise.all([
    getDashboardData().catch(() => null),
    getTeacherTodayTimetable().catch(() => []),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <DashboardMorningView
        firstName={firstName}
        role={role}
        initialData={initialData}
        initialTimetable={initialTimetable}
      />
    </AppShell>
  )
}
