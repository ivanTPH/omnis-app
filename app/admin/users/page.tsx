import { requireAuth } from '@/lib/session'
import { redirect }    from 'next/navigation'
import AppShell        from '@/components/AppShell'
import Link             from 'next/link'
import Icon             from '@/components/ui/Icon'
import { getSchoolAllUsers } from '@/app/actions/admin'
import UserManagementTable   from '@/components/admin/UserManagementTable'
import PageHeader            from '@/components/ui/PageHeader'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const { filter: filterParam } = await searchParams
  const initialFilter = ['all','students','parents','staff','pending'].includes(filterParam ?? '')
    ? (filterParam as 'all' | 'students' | 'parents' | 'staff' | 'pending')
    : 'all'

  const users = await getSchoolAllUsers('all')

  const counts = {
    all:      users.length,
    students: users.filter(u => u.role === 'STUDENT').length,
    parents:  users.filter(u => u.role === 'PARENT').length,
    staff:    users.filter(u => !['STUDENT', 'PARENT'].includes(u.role)).length,
    pending:  users.filter(u => !u.activatedAt && u.isActive).length,
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
          <PageHeader
            title="User Management"
            subtitle={`${schoolName} — all accounts, roles and activation status`}
            backHref="/admin/dashboard"
            backLabel="Admin"
            action={
              <Link
                href="/api/export/data-quality"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <Icon name="download" size="sm" />
                Data Quality CSV
              </Link>
            }
          />
          <UserManagementTable users={users} counts={counts} initialFilter={initialFilter} />
        </div>
      </main>
    </AppShell>
  )
}
