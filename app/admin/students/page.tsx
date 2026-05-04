import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getStudentList } from '@/app/actions/admin'
import AdminStudentTable from '@/components/admin/AdminStudentTable'

export default async function AdminStudentsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { role, firstName, lastName, schoolName } = session.user as any
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const students = await getStudentList()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
          <AdminStudentTable students={students} />
        </div>
      </main>
    </AppShell>
  )
}
