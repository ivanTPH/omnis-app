import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getSchoolList } from '@/app/actions/platform-admin'
import SchoolListTable from '@/components/platform-admin/SchoolListTable'

export default async function PlatformSchoolsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { role, firstName, lastName, schoolName } = session.user as any
  if (role !== 'PLATFORM_ADMIN') redirect('/dashboard')

  const schools = await getSchoolList()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
          <div className="mb-6">
            <h1 className="text-[22px] font-bold text-gray-900">Schools</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              Manage all schools on the Omnis platform
            </p>
          </div>
          <SchoolListTable schools={schools} />
        </div>
      </main>
    </AppShell>
  )
}
