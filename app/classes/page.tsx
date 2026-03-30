import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import MyClassesView from '@/components/MyClassesView'
import { getTeacherDefaults } from '@/app/actions/analytics'

export default async function ClassesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, firstName, lastName, schoolName } = session.user as any
  const { teacherClasses } = await getTeacherDefaults()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-[20px] font-bold text-gray-900">My Classes</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Select a class to view students, plans, and performance data.
          </p>
        </div>
        <MyClassesView classes={teacherClasses} />
      </div>
    </AppShell>
  )
}
