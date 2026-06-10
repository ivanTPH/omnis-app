import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { requireAuth } from '@/lib/session'
import { getAcademySchools } from '@/app/actions/academy'
import AcademySchoolsTable from '@/components/academy/AcademySchoolsTable'

export default async function AcademySchoolsPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['ACADEMY_ADMIN', 'PLATFORM_ADMIN'].includes(role)) redirect('/dashboard')

  const schools = await getAcademySchools()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-8 sm:py-8 space-y-6">
          <PageHeader
            title="Schools"
            subtitle={`${schools.length} school${schools.length !== 1 ? 's' : ''} in the trust`}
            backHref="/academy/dashboard"
            backLabel="Academy Dashboard"
          />
          <AcademySchoolsTable schools={schools} />
        </div>
      </main>
    </AppShell>
  )
}
