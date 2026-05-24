import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getClassList } from '@/app/actions/admin'
import AdminClassTable from '@/components/admin/AdminClassTable'

export default async function AdminClassesPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const classes = await getClassList()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
          <AdminClassTable classes={classes} />
        </div>
      </main>
    </AppShell>
  )
}
