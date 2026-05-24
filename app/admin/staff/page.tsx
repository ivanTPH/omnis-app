import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getStaffList } from '@/app/actions/admin'
import AdminStaffTable from '@/components/admin/AdminStaffTable'

export default async function AdminStaffPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const staff = await getStaffList()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
          <AdminStaffTable staff={staff} />
        </div>
      </main>
    </AppShell>
  )
}
