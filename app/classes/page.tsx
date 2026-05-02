import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import MyClassesView from '@/components/MyClassesView'
import { PageHeader } from '@/components/ui/PageHeader'
import { getTeacherDefaults } from '@/app/actions/analytics'

export default async function ClassesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, firstName, lastName, schoolName } = session.user as any
  const { teacherClasses } = await getTeacherDefaults()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="p-6 max-w-4xl mx-auto">
        <PageHeader
          title="My Classes"
          subtitle={`${teacherClasses.length} class${teacherClasses.length !== 1 ? 'es' : ''} this term`}
        />
        <MyClassesView classes={teacherClasses} role={role} />
      </div>
    </AppShell>
  )
}
