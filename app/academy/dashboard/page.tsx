import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getAcademyStats, getAcademySchools } from '@/app/actions/academy'
import AcademyDashboardStats from '@/components/academy/AcademyDashboardStats'
import AcademySchoolsTable from '@/components/academy/AcademySchoolsTable'

export default async function AcademyDashboardPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['ACADEMY_ADMIN', 'PLATFORM_ADMIN'].includes(role)) redirect('/dashboard')

  const [stats, schools] = await Promise.all([
    getAcademyStats(),
    getAcademySchools(),
  ])

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8 space-y-6">

          <div>
            <h1 className="text-[22px] font-bold text-gray-900">Academy Dashboard</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              Cross-school overview — {schools.length} {schools.length === 1 ? 'school' : 'schools'}
            </p>
          </div>

          <AcademyDashboardStats stats={stats} />

          <div>
            <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Schools
            </h2>
            <AcademySchoolsTable schools={schools} />
          </div>

        </div>
      </main>
    </AppShell>
  )
}
