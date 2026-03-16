import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import StudentRevisionView from '@/components/revision-program/StudentRevisionView'
import { getStudentRevisionTasks } from '@/app/actions/revision-program'

export default async function StudentRevisionPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName } = session.user as any
  if (role !== 'STUDENT') redirect('/dashboard')

  const { active, completed } = await getStudentRevisionTasks()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <StudentRevisionView active={active as any} completed={completed as any} />
    </AppShell>
  )
}
